"""The size of the points environment term (iscfPointMultiplier, ISCF_POINT_PER_SD in model-core.js): on top of a skater's
points rate (to the power 0.792, the fitted exponent), the opponent's ISCF/G rank as a smooth term exp(k z), against the
Assists/G rank steps as shipped (+16% / +8% / -12%) and a smooth assists term, fitted on half the dates and scored on the
other half (deviance), forwards / defensemen / all. Usage: python3 -I tools/predictors/points_env_fit.py <games dir> [...]"""
import json, os, sys, math, random
from collections import defaultdict

KEYS = ('a', 'pts', 'iscf', 'sog')
rows = []
for gdir in sys.argv[1:]:
    games = []
    for f in sorted(os.listdir(gdir)):
        games += [g for g in json.load(open(os.path.join(gdir, f)))['games'] if g.get('gameType') == 2]
    games.sort(key=lambda g: (g['date'], g['id']))
    P = defaultdict(lambda: defaultdict(float))
    T = defaultdict(lambda: {'F': defaultdict(float), 'D': defaultdict(float), 'gp': 0})
    by_date = defaultdict(list)
    for g in games: by_date[g['date']].append(g)
    val = lambda s, k: (s['g'] + s['a']) if k == 'pts' else (s.get(k) or 0)
    for d in sorted(by_date):
        lg = {grp: {k: (sum(t[grp][k] for t in T.values()) / max(1, sum(t[grp]['n'] for t in T.values()))) for k in KEYS} for grp in 'FD'}
        idx = {grp: {tm: {k: (t[grp][k] / t[grp]['n']) / lg[grp][k] for k in KEYS if lg[grp][k] > 0}
                     for tm, t in T.items() if t['gp'] >= 10 and t[grp]['n'] > 0} for grp in 'FD'}
        rank = {grp: {tm: i + 1 for i, tm in enumerate(sorted(idx[grp], key=lambda x: -idx[grp][x]['a']))} for grp in 'FD'}
        for g in by_date[d]:
            for s in g['skaters']:
                if s.get('toi', 0) <= 0: continue
                grp = 'D' if s['pos'] == 'D' else 'F'
                p = P[s['id']]
                if p['n'] >= 10 and s['opp'] in idx[grp]:
                    rows.append(dict(pos=grp, ar=p['a'] / p['n'], pr=p['pts'] / p['n'], gr=p['g'] / p['n'], toi=p['toi'] / p['n'],
                                     orank=rank[grp][s['opp']], **{f'e_{k}': v for k, v in idx[grp][s['opp']].items()},
                                     pts=s['g'] + s['a'], a=s['a'], date=d))
        for g in by_date[d]:
            for side in ('home', 'away'): T[g[side]['abbrev']]['gp'] += 1
            for s in g['skaters']:
                if s.get('toi', 0) <= 0: continue
                grp = 'D' if s['pos'] == 'D' else 'F'
                p = P[s['id']]; p['n'] += 1; p['a'] += s['a']; p['g'] += s['g']; p['pts'] += s['g'] + s['a']; p['toi'] += s['toi']
                t = T[s['opp']][grp]; t['n'] += 1
                for k in KEYS: t[k] += val(s, k)

import math
# ranks each morning by iSCF allowed and by assists allowed (1 = most), from the indices on the row (same morning tables)
by = defaultdict(list)
for r in rows: by[(r['date'], r['pos'])].append(r)
# rebuild ranks per (date, group) over the teams present that morning: use distinct (team-index) values
def ranks_for(R, key):
    vals = sorted({round(r[key], 9) for r in R}, reverse=True)
    pos = {v: i + 1 for i, v in enumerate(vals)}
    n = len(vals)
    return pos, n
for (d, grp), R in by.items():
    pi, ni = ranks_for(R, 'e_iscf'); pa, na = ranks_for(R, 'e_a')
    for r in R:
        r['ri'] = pi[round(r['e_iscf'], 9)]; r['ra'] = pa[round(r['e_a'], 9)]; r['n32'] = 32
z = lambda rank, n=32: ((n + 1) / 2 - rank) / (n / math.sqrt(12))
def steps(r):
    m = 1.0
    if r['ra'] <= 10: m += 0.16
    elif r['ra'] <= 16: m += 0.08
    if r['ra'] >= 24: m -= 0.12
    return m
def fitk(R, f):
    # 1-D: points ~ Poisson(his rate^0.79 * A * exp(k f)); Newton on (A, k) with offset
    a, k = 0.0, 0.0
    off = [0.792 * math.log(r['pr']) for r in R]
    for _ in range(30):
        g0 = g1 = h00 = h01 = h11 = 0
        for r, o in zip(R, off):
            x = f(r); mu = math.exp(o + a + k * x)
            g0 += r['pts'] - mu; g1 += (r['pts'] - mu) * x; h00 += mu; h01 += mu * x; h11 += mu * x * x
        det = h00 * h11 - h01 * h01
        if abs(det) < 1e-9: a += g0 / h00; continue
        a += (h11 * g0 - h01 * g1) / det; k += (h00 * g1 - h01 * g0) / det
    return a, k
def dev(R, a, k, f, offk=0.792):
    s = 0
    for r in R:
        mu = math.exp(offk * math.log(r['pr']) + a + k * f(r)); y = r['pts']
        s += 2 * ((y * math.log(y / mu) if y else 0) - (y - mu))
    return s
for lab in ('F', 'D', 'all'):
    R0 = [r for r in rows if r['pr'] > 0 and (lab == 'all' or r['pos'] == lab)]
    dates = sorted({r['date'] for r in R0}); fold = {d: i % 2 for i, d in enumerate(dates)}
    res = {}
    for name, f in (('none', lambda r: 0.0), ('assist steps (log)', lambda r: math.log(steps(r))),
                    ('smooth assists rank z', lambda r: z(r['ra'])), ('smooth iSCF rank z', lambda r: z(r['ri']))):
        tot = 0
        for kf in (0, 1):
            tr = [r for r in R0 if fold[r['date']] != kf]; te = [r for r in R0 if fold[r['date']] == kf]
            if name == 'none':
                a, _ = fitk(tr, lambda r: 0.0); k = 0
            elif name == 'assist steps (log)':
                k = 1.0; a, _ = fitk([dict(r, pr=r['pr'] * steps(r) ** (1 / 0.792)) for r in tr], lambda r: 0.0)   # the steps as shipped, intercept refit
            else:
                a, k = fitk(tr, f)
            tot += dev(te, a, k, f)
        a, k = fitk(R0, f) if name not in ('none', 'assist steps (log)') else (0, 1 if name.startswith('assist') else 0)
        res[name] = (tot, k)
    b = res['none'][0]
    print(f'{lab} (n={len(R0)}):')
    for name, (tot, k) in res.items():
        extra = f'  per SD {k:.4f} -> rank 1 x{math.exp(k*z(1)):.3f}, rank 32 x{math.exp(k*z(32)):.3f}' if 'smooth' in name else ''
        print(f'   {name:24} CV deviance gain {b - tot:7.1f}{extra}')

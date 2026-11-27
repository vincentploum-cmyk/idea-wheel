"""Does the opponent's table at his group add to a skater's own rate, defensemen and forwards, held out by date (fitted on
half the dates, deviance on the other half): shots (his SOG and iCF rates; iCF / SOG allowed to the group), goals (his
iSCF and goal rates; iSCF / goals allowed), points (his points rate; iSCF / assists / SOG allowed). Behind ICF_ENV_EXP_D
(docs/audits/2026-11-27-nhl-icf-thresholds.md, "Defensemen"). Usage: python3 -I tools/predictors/env_by_group.py <games dir> [...]"""
import json, os, sys, math
from collections import defaultdict
KEYS = ('icf', 'sog', 'iscf', 'g', 'a')
rows = []
for gdir in sys.argv[1:]:
    games = []
    for f in sorted(os.listdir(gdir)):
        games += [g for g in json.load(open(os.path.join(gdir, f)))['games'] if g.get('gameType') == 2]
    games.sort(key=lambda g: (g['date'], g['id']))
    P = defaultdict(lambda: defaultdict(float)); T = defaultdict(lambda: {'F': defaultdict(float), 'D': defaultdict(float), 'gp': 0})
    by = defaultdict(list)
    for g in games: by[g['date']].append(g)
    for d in sorted(by):
        lg = {grp: {k: sum(t[grp][k] for t in T.values()) / max(1, sum(t[grp]['n'] for t in T.values())) for k in KEYS} for grp in 'FD'}
        idx = {grp: {tm: {k: (t[grp][k] / t[grp]['n']) / lg[grp][k] for k in KEYS if lg[grp][k] > 0}
                     for tm, t in T.items() if t['gp'] >= 10 and t[grp]['n'] > 0} for grp in 'FD'}
        for g in by[d]:
            for s in g['skaters']:
                if s.get('toi', 0) <= 0 or s.get('icf') is None: continue
                grp = 'D' if s['pos'] == 'D' else 'F'; p = P[s['id']]
                if p['n'] >= 10 and s['opp'] in idx[grp]:
                    e = idx[grp][s['opp']]
                    rows.append(dict(pos=grp, date=d, sr=p['sog'] / p['n'], icfr=p['icf'] / p['n'], iscfr=p['iscf'] / p['n'],
                                     gr=p['g'] / p['n'], pr=(p['g'] + p['a']) / p['n'], sog=s['sog'], g=s['g'], pts=s['g'] + s['a'],
                                     **{f'e_{k}': max(0.3, v) for k, v in e.items()}))
        for g in by[d]:
            for side in ('home', 'away'): T[g[side]['abbrev']]['gp'] += 1
            for s in g['skaters']:
                if s.get('toi', 0) <= 0 or s.get('icf') is None: continue
                grp = 'D' if s['pos'] == 'D' else 'F'; p = P[s['id']]; p['n'] += 1
                for k in KEYS: p[k] += s.get(k) or 0
                t = T[s['opp']][grp]; t['n'] += 1
                for k in KEYS: t[k] += s.get(k) or 0

def fit(R, feats, y):
    X = [[1.0] + [f(r) for f in feats] for r in R]; Y = [r[y] for r in R]; k = len(X[0])
    w = [math.log(max(1e-6, sum(Y) / len(Y)))] + [0.0] * (k - 1)
    for _ in range(25):
        g = [0.0] * k; H = [[0.0] * k for _ in range(k)]
        for x, yy in zip(X, Y):
            mu = math.exp(sum(a * b for a, b in zip(w, x)))
            for i in range(k):
                g[i] += (yy - mu) * x[i]
                for j in range(i, k): H[i][j] += mu * x[i] * x[j]
        for i in range(k):
            for j in range(i): H[i][j] = H[j][i]
        M = [H[i][:] + [g[i]] for i in range(k)]
        for c in range(k):
            p = max(range(c, k), key=lambda r_: abs(M[r_][c])); M[c], M[p] = M[p], M[c]
            for r_ in range(k):
                if r_ != c:
                    f_ = M[r_][c] / M[c][c]; M[r_] = [a - f_ * b for a, b in zip(M[r_], M[c])]
        w = [a + M[i][k] / M[i][i] for i, a in enumerate(w)]
    return w
def dev(R, w, feats, y):
    s = 0
    for r in R:
        mu = math.exp(w[0] + sum(c * f(r) for c, f in zip(w[1:], feats))); yy = r[y]
        s += 2 * ((yy * math.log(yy / mu) if yy > 0 else 0) - (yy - mu))
    return s
L = lambda k: (lambda r: math.log(r[k]))
def cv(R0, base, extra, y):
    dates = sorted({r['date'] for r in R0}); fold = {d: i % 2 for i, d in enumerate(dates)}
    out = []
    for name, feats in [('his rate only', base)] + [(n, base + f) for n, f in extra]:
        tot = 0
        for kf in (0, 1):
            tr = [r for r in R0 if fold[r['date']] != kf]; te = [r for r in R0 if fold[r['date']] == kf]
            tot += dev(te, fit(tr, feats, y), feats, y)
        out.append((name, tot, fit(R0, feats, y)[len(base) + 1:]))
    b = out[0][1]
    for name, tot, co in out:
        print(f'    {name:28} held-out deviance saved {b - tot:7.1f}   env coef {", ".join(f"{c:.3f}" for c in co)}')
for grp in ('D', 'F'):
    R = [r for r in rows if r['pos'] == grp and r['sr'] > 0 and r['icfr'] > 0 and r['iscfr'] > 0]
    print(f'\n### {grp} (n={len(R)})')
    print('  SHOTS (his SOG rate + iCF rate):')
    cv(R, [L('sr'), L('icfr')], [('+ iCF allowed', [L('e_icf')]), ('+ SOG allowed', [L('e_sog')])], 'sog')
    Rg = [r for r in R if r['gr'] > 0]
    print(f'  GOALS (his iSCF + goal rate, n={len(Rg)}):')
    cv(Rg, [L('iscfr'), L('gr')], [('+ iSCF allowed', [L('e_iscf')]), ('+ goals allowed', [L('e_g')])], 'g')
    Rp = [r for r in R if r['pr'] > 0]
    print(f'  POINTS (his points rate, n={len(Rp)}):')
    cv(Rp, [L('pr')], [('+ iSCF allowed', [L('e_iscf')]), ('+ assists allowed', [L('e_a')]), ('+ SOG allowed', [L('e_sog')])], 'pts')

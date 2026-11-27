"""Assists / points thresholds for 1+ / 2+ points by the skater's assists and points a game, and which opponent read
(assists, points, chances, shots allowed to his group, F / D) carries points over his own rate, leak-free and scored on
held-out dates (docs/audits/2026-11-27-nhl-icf-thresholds.md, "Points"; behind iscfPointMultiplier and pointDefenseMult's
iSCF ratio in model-core.js). Usage: python3 -I tools/predictors/points_thresholds.py <games dir> [...]; no numpy."""
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

def rt(R, k, key='pts'): return sum(r[key] >= k for r in R) / len(R) if R else float('nan')
F = [r for r in rows if r['pos'] == 'F']; D = [r for r in rows if r['pos'] == 'D']
print(f'{len(rows)} skater-games; 1+ pt {rt(rows,1):.1%}, 2+ {rt(rows,2):.1%}; F 1+ {rt(F,1):.1%} 2+ {rt(F,2):.1%}; D 1+ {rt(D,1):.1%}')

print('\n== 1. PLAYER: assists a game coming in -> points (forwards / D)')
for lab, R0, bands in (('F', F, [0, .1, .15, .2, .25, .3, .35, .4, .5, .6, .8, 9]), ('D', D, [0, .1, .15, .2, .25, .3, .4, .5, 9])):
    print(f'  {lab}:')
    for lo, hi in zip(bands, bands[1:]):
        R = [r for r in R0 if lo <= r['ar'] < hi]
        if len(R) >= 80:
            print(f'    A/G {lo:.2f}-{hi if hi < 9 else "+":<5}: 1+ pt {rt(R,1):5.1%}  2+ {rt(R,2):5.1%}  1+ A {rt(R,1,"a"):5.1%}  (his P/G {sum(r["pr"] for r in R)/len(R):.2f}) n={len(R)}')
print('  forwards by POINTS a game:')
for lo, hi in zip([0, .2, .3, .4, .5, .6, .7, .8, 1.0, 1.2], [.2, .3, .4, .5, .6, .7, .8, 1.0, 1.2, 9]):
    R = [r for r in F if lo <= r['pr'] < hi]
    if len(R) >= 80: print(f'    P/G {lo:.1f}-{hi if hi < 9 else "+":<4}: 1+ {rt(R,1):5.1%}  2+ {rt(R,2):5.1%}  n={len(R)}')

print('\n== 2. DEFENSE: opponent assists allowed per skater at his group, by rank (1 = most)')
for lab, R0 in (('F', F), ('D', D)):
    print(f'  {lab}:')
    for name, a, b in (('1-5', 1, 5), ('6-10', 6, 10), ('11-22', 11, 22), ('23-27', 23, 27), ('28-32', 28, 32)):
        R = [r for r in R0 if a <= r['orank'] <= b]
        rel = sum(r['pts'] for r in R) / sum(r['pr'] for r in R)
        print(f'    rank {name:6} A idx {sum(r["e_a"] for r in R)/len(R):.2f}  1+ pt {rt(R,1):5.1%}  points vs his rate x{rel:.3f} (n={len(R)})')

def fit(R, feats, y='pts'):
    X = [[1.0] + [f(r) for f in feats] for r in R]; Y = [r[y] for r in R]; k = len(X[0])
    w = [math.log(sum(Y) / len(Y))] + [0.0] * (k - 1)
    for _ in range(30):
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
def dev(R, w, feats, y='pts'):
    s = 0
    for r in R:
        mu = math.exp(w[0] + sum(c * f(r) for c, f in zip(w[1:], feats))); yy = r[y]
        s += 2 * ((yy * math.log(yy / mu) if yy > 0 else 0) - (yy - mu))
    return s
lg_ = lambda k: (lambda r: math.log(max(0.3, r.get(f'e_{k}', 1))))
print('\n== 3. Which opponent read carries points? Poisson on log(his points rate) + one env read; CV by date halves')
for lab, R0 in (('F', [r for r in F if r['pr'] > 0]), ('D', [r for r in D if r['pr'] > 0])):
    dates = sorted({r['date'] for r in R0}); random.seed(7)
    fold = {d: i % 2 for i, d in enumerate(dates)}
    base = [lambda r: math.log(r['pr'])]
    out = []
    for name, feats in (('his rate only', base), ('+ assists allowed', base + [lg_('a')]), ('+ points allowed', base + [lg_('pts')]),
                        ('+ iSCF allowed', base + [lg_('iscf')]), ('+ shots allowed', base + [lg_('sog')]),
                        ('+ assists + iSCF', base + [lg_('a'), lg_('iscf')])):
        tot = 0
        for k in (0, 1):
            tr = [r for r in R0 if fold[r['date']] != k]; te = [r for r in R0 if fold[r['date']] == k]
            w = fit(tr, feats); tot += dev(te, w, feats)
        wa = fit(R0, feats)
        out.append((name, tot, wa))
    b0 = out[0][1]
    print(f'  {lab} (n={len(R0)}):')
    for name, tot, wa in out:
        print(f'    {name:20} CV deviance gain {b0 - tot:7.1f}   coefs {", ".join(f"{c:.3f}" for c in wa[1:])}')

print('\n== 4. Forwards: assists a game x assists-allowed env (tough < 0.90 / firm / loose / soft > 1.10), 1+ point')
ENV = ((0, 0.90), (0.90, 1.0), (1.0, 1.10), (1.10, 9))
print('  env shares:', ', '.join(f'{sum(a <= r["e_a"] < b for r in F)/len(F):.0%}' for a, b in ENV))
for lo, hi in ((.1, .2), (.2, .3), (.3, .4), (.4, .55), (.55, 9)):
    cells = []
    for a, b in ENV:
        R = [r for r in F if lo <= r['ar'] < hi and a <= r['e_a'] < b]
        cells.append(f'{rt(R,1):6.1%} ({len(R):4})')
    print(f'  A/G {lo}-{hi if hi < 9 else "+":<4} ' + '  '.join(cells))
print('  same, iSCF-allowed env:')
for lo, hi in ((.1, .2), (.2, .3), (.3, .4), (.4, .55), (.55, 9)):
    cells = []
    for a, b in ((0, 0.92), (0.92, 1.0), (1.0, 1.08), (1.08, 9)):
        R = [r for r in F if lo <= r['ar'] < hi and a <= r['e_iscf'] < b]
        cells.append(f'{rt(R,1):6.1%} ({len(R):4})')
    print(f'  A/G {lo}-{hi if hi < 9 else "+":<4} ' + '  '.join(cells))


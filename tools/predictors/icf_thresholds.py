"""iCF thresholds for 3+ / 4+ / 5+ SOG by the skater's attempts a game and the opponent's attempts allowed to his
position group (F / D), leak-free (docs/audits/2026-11-27-nhl-icf-thresholds.md, behind matchupIcf in model-core.js).
Each skater-game read with what was known that morning: his season-to-date iCF / SOG a game (10+ games), the
opponent's season-to-date iCF allowed per skater at his group (10+ games), its rank and its ratio to the league.
Prints the grid by environment, a Poisson fit SOG = A x iCF^b x env^c and the iCF needed by environment, and
the head-to-head of a lower shooter against a soft defense and a higher one against a tough defense.
Usage: python3 -I tools/predictors/icf_thresholds.py <games dir> [...]   (fetch.mjs output); no numpy needed."""
import json, os, sys
from collections import defaultdict

rows = []
for gdir in sys.argv[1:]:
    games = []
    for f in sorted(os.listdir(gdir)):
        games += [g for g in json.load(open(os.path.join(gdir, f)))['games'] if g.get('gameType') == 2]
    games.sort(key=lambda g: (g['date'], g['id']))
    P = defaultdict(lambda: [0, 0, 0, 0.0])          # gp, icf, sog, toi
    T = defaultdict(lambda: {'F': [0, 0, 0], 'D': [0, 0, 0], 'gp': 0})  # skater-games, icf, sog allowed
    by_date = defaultdict(list)
    for g in games: by_date[g['date']].append(g)
    for d in sorted(by_date):
        # morning tables
        lg = {}
        for grp in 'FD':
            n = sum(t[grp][0] for t in T.values()); lg[grp] = sum(t[grp][1] for t in T.values()) / n if n else None
        rate = {grp: {tm: t[grp][1] / t[grp][0] for tm, t in T.items() if t['gp'] >= 10} for grp in 'FD'}
        rank = {grp: {tm: i + 1 for i, tm in enumerate(sorted(rate[grp], key=lambda x: -rate[grp][x]))} for grp in 'FD'}
        for g in by_date[d]:
            for s in g['skaters']:
                if s.get('toi', 0) <= 0 or s.get('icf') is None: continue
                grp = 'D' if s['pos'] == 'D' else 'F'
                p = P[s['id']]
                if p[0] >= 10 and s['opp'] in rate[grp]:
                    rows.append(dict(pos=grp, icf=p[1] / p[0], sogr=p[2] / p[0], toi=p[3] / p[0],
                                     oicf=rate[grp][s['opp']], orank=rank[grp][s['opp']], oidx=rate[grp][s['opp']] / lg[grp],
                                     sog=s['sog'], gicf=s['icf']))
        # update after the day
        for g in by_date[d]:
            for side in ('home', 'away'): T[g[side]['abbrev']]['gp'] += 1
            for s in g['skaters']:
                if s.get('toi', 0) <= 0 or s.get('icf') is None: continue
                grp = 'D' if s['pos'] == 'D' else 'F'
                p = P[s['id']]; p[0] += 1; p[1] += s['icf']; p[2] += s['sog']; p[3] += s['toi']
                t = T[s['opp']][grp]; t[0] += 1; t[1] += s['icf']; t[2] += s['sog']

import math
F = [r for r in rows if r['pos'] == 'F']
D = [r for r in rows if r['pos'] == 'D']
def rate(R, k): return sum(r['sog'] >= k for r in R) / len(R) if R else float('nan')
ENV = (('tough <0.93', 0, 0.93), ('firm 0.93-1.0', 0.93, 1.0), ('loose 1.0-1.07', 1.0, 1.07), ('soft >1.07', 1.07, 9))
BANDS = ((2.5, 3.5), (3.5, 4.5), (4.5, 5.5), (5.5, 6.5), (6.5, 99))
for lab, R0 in (('FORWARDS', F), ('DEFENSEMEN', D)):
    print(f'\n######## {lab}  (env = opponent iCF allowed at his group / league)')
    print('  env shares:', ', '.join(f'{e[0]} {sum(e[1] <= r["oidx"] < e[2] for r in R0)/len(R0):.0%}' for e in ENV))
    for k in (3, 4, 5):
        print(f'  -- {k}+ SOG')
        print('  his iCF/G (SOG/G)     ' + ''.join(f'{e[0]:>18}' for e in ENV))
        for lo, hi in BANDS:
            Rb = [r for r in R0 if lo <= r['icf'] < hi]
            sg = sum(r['sogr'] for r in Rb) / len(Rb)
            cells = []
            for _, a, b in ENV:
                R = [r for r in Rb if a <= r['oidx'] < b]
                cells.append(f'{rate(R, k):6.1%} ({len(R):4})' if len(R) >= 60 else f'{"-":>13}')
            print(f'  {lo}-{hi if hi < 99 else "+":<4} ({sg:.1f})        ' + ''.join(f'{c:>18}' for c in cells))

# Poisson fit: log lambda = a + b log(icf) + c log(oidx), Newton, pure python
def fit(R):
    X = [(1.0, math.log(r['icf']), math.log(r['oidx'])) for r in R]; y = [r['sog'] for r in R]
    w = [math.log(sum(y) / len(y)), 1.0, 0.0]
    for _ in range(25):
        g = [0.0] * 3; H = [[0.0] * 3 for _ in range(3)]
        for x, yy in zip(X, y):
            mu = math.exp(sum(wi * xi for wi, xi in zip(w, x)))
            for i in range(3):
                g[i] += (yy - mu) * x[i]
                for j in range(3): H[i][j] += mu * x[i] * x[j]
        # solve H d = g (3x3, Cramer)
        def det(M): return (M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1]) - M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0]) + M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]))
        dH = det(H); d = []
        for i in range(3):
            M = [row[:] for row in H]
            for r_ in range(3): M[r_][i] = g[r_]
            d.append(det(M) / dH)
        w = [wi + di for wi, di in zip(w, d)]
    return w
def pois_ge(lam, k): return 1 - sum(math.exp(-lam) * lam ** i / math.factorial(i) for i in range(k))
print('\n######## Fitted: SOG = A x iCF^b x env^c  (env = opponent index)')
for lab, R0 in (('F', F), ('D', D)):
    a, b, c = fit([r for r in R0 if r['icf'] > 0])
    print(f'  {lab}: A={math.exp(a):.3f} b={b:.3f} c={c:.3f}  -> env x1.10 vs x0.90 is worth x{(1.10/0.90)**(c/b):.2f} on his iCF')
    for k in (3, 4, 5):
        out = []
        for env in (0.88, 0.95, 1.0, 1.05, 1.12):
            # iCF needed for 50% (3+), 35% (4+), 20% (5+) ... report iCF needed for a coin flip-ish target
            tgt = {3: 0.5, 4: 0.33, 5: 0.2}[k]
            lo_, hi_ = 0.5, 20
            for _ in range(60):
                m = (lo_ + hi_) / 2
                lam = math.exp(a) * m ** b * env ** c
                lo_, hi_ = (m, hi_) if pois_ge(lam, k) < tgt else (lo_, m)
            out.append(f'env {env}: {m:4.1f}')
        print(f'    iCF/G needed for {k}+ at {int(tgt*100)}%:  ' + '   '.join(out))

print('\n######## Head to head: lower shooter in soft env vs high shooter in tough env (forwards)')
pairs = [((3.5, 4.5), 1.07, 9, (5.5, 99), 0, 0.93), ((4.5, 5.5), 1.07, 9, (5.5, 99), 0, 0.93),
         ((4.5, 5.5), 1.07, 9, (6.5, 99), 0, 0.93), ((3.5, 4.5), 1.07, 9, (4.5, 5.5), 0, 0.93)]
for (l1, a1, b1, l2, a2, b2) in pairs:
    A = [r for r in F if l1[0] <= r['icf'] < l1[1] and a1 <= r['oidx'] < b1]
    B = [r for r in F if l2[0] <= r['icf'] < l2[1] and a2 <= r['oidx'] < b2]
    m = lambda R: sum(r['sog'] for r in R) / len(R)
    print(f'  iCF {l1} vs soft: avg {m(A):.2f} SOG, 3+ {rate(A,3):.0%}, 4+ {rate(A,4):.0%}, 5+ {rate(A,5):.0%} (n={len(A)})'
          f'   |   iCF {l2} vs tough: avg {m(B):.2f}, 3+ {rate(B,3):.0%}, 4+ {rate(B,4):.0%}, 5+ {rate(B,5):.0%} (n={len(B)})')

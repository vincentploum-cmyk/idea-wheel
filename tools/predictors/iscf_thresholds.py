"""iSCF thresholds for 1+ / 2+ goals by the skater's scoring chances a game and the opponent's chances allowed to his
group (F / D), leak-free (docs/audits/2026-11-27-nhl-icf-thresholds.md, "Goals"; behind matchupIscf in model-core.js).
Each skater-game read with what was known that morning: his season-to-date iSCF / goals a game (10+ games), the
opponent's season-to-date iSCF and goals allowed per skater at his group (10+ games), rank and ratio to the league.
Usage: python3 -I tools/predictors/iscf_thresholds.py <games dir> [...]   (fetch.mjs output); no numpy needed."""
import json, os, sys, math
from collections import defaultdict

rows = []
for gdir in sys.argv[1:]:
    games = []
    for f in sorted(os.listdir(gdir)):
        games += [g for g in json.load(open(os.path.join(gdir, f)))['games'] if g.get('gameType') == 2]
    games.sort(key=lambda g: (g['date'], g['id']))
    P = defaultdict(lambda: [0, 0, 0, 0, 0])   # gp, iscf, goals, sog, ihdcf
    T = defaultdict(lambda: {'F': [0, 0, 0], 'D': [0, 0, 0], 'gp': 0})  # skater-games, iscf allowed, goals allowed
    by_date = defaultdict(list)
    for g in games: by_date[g['date']].append(g)
    for d in sorted(by_date):
        lg = {}
        for grp in 'FD':
            n = sum(t[grp][0] for t in T.values()); lg[grp] = sum(t[grp][1] for t in T.values()) / n if n else None
        rate = {grp: {tm: t[grp][1] / t[grp][0] for tm, t in T.items() if t['gp'] >= 10} for grp in 'FD'}
        grate = {grp: {tm: t[grp][2] / t[grp][0] for tm, t in T.items() if t['gp'] >= 10} for grp in 'FD'}
        lgg = {}
        for grp in 'FD':
            n = sum(t[grp][0] for t in T.values()); lgg[grp] = sum(t[grp][2] for t in T.values()) / n if n else None
        rank = {grp: {tm: i + 1 for i, tm in enumerate(sorted(rate[grp], key=lambda x: -rate[grp][x]))} for grp in 'FD'}
        for g in by_date[d]:
            for s in g['skaters']:
                if s.get('toi', 0) <= 0 or s.get('iscf') is None: continue
                grp = 'D' if s['pos'] == 'D' else 'F'
                p = P[s['id']]
                if p[0] >= 10 and s['opp'] in rate[grp] and p[1] > 0:
                    rows.append(dict(pos=grp, iscf=p[1] / p[0], gr=p[2] / p[0], sogr=p[3] / p[0], hd=p[4] / p[0],
                                     orank=rank[grp][s['opp']], oidx=rate[grp][s['opp']] / lg[grp],
                                     gidx=grate[grp][s['opp']] / lgg[grp] if lgg[grp] else 1, g=s['g'], giscf=s['iscf']))
        for g in by_date[d]:
            for side in ('home', 'away'): T[g[side]['abbrev']]['gp'] += 1
            for s in g['skaters']:
                if s.get('toi', 0) <= 0 or s.get('iscf') is None: continue
                grp = 'D' if s['pos'] == 'D' else 'F'
                p = P[s['id']]; p[0] += 1; p[1] += s['iscf']; p[2] += s['g']; p[3] += s['sog']; p[4] += s.get('ihdcf') or 0
                t = T[s['opp']][grp]; t[0] += 1; t[1] += s['iscf']; t[2] += s['g']

def rt(R, k): return sum(r['g'] >= k for r in R) / len(R) if R else float('nan')
F = [r for r in rows if r['pos'] == 'F']; D = [r for r in rows if r['pos'] == 'D']
print(f'{len(rows)} skater-games; 1+ goal {rt(rows,1):.1%}, 2+ {rt(rows,2):.1%}; forwards 1+ {rt(F,1):.1%}, D {rt(D,1):.1%}')

print('\n== 0. In the game: scoring chances that night -> 1+ goal')
for k in range(0, 8):
    R = [r for r in rows if r['giscf'] == k]; print(f'  {k} chances: 1+ {rt(R,1):5.1%}  2+ {rt(R,2):5.1%} (n={len(R)})')

print('\n== 1. PLAYER: season-to-date iSCF a game -> goals (forwards / D)')
for lab, R0, bands in (('F', F, [0, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 9]), ('D', D, [0, 0.4, 0.6, 0.8, 1, 1.2, 1.5, 9])):
    print(f'  {lab}:')
    for lo, hi in zip(bands, bands[1:]):
        R = [r for r in R0 if lo <= r['iscf'] < hi]
        if len(R) >= 60:
            print(f'    iSCF {lo}-{hi if hi < 9 else "+":<5}: 1+ {rt(R,1):5.1%}  2+ {rt(R,2):5.1%}  G/G {sum(r["g"] for r in R)/len(R):.3f}  (his G/G {sum(r["gr"] for r in R)/len(R):.3f}) n={len(R)}')

print('\n== 2. DEFENSE: opponent iSCF allowed per skater at his group')
for lab, R0 in (('F', F), ('D', D)):
    print(f'  {lab}:')
    for name, a, b in (('rank 1-5 (most)', 1, 5), ('6-10', 6, 10), ('11-22', 11, 22), ('23-27', 23, 27), ('28-32 (fewest)', 28, 32)):
        R = [r for r in R0 if a <= r['orank'] <= b]
        rel = sum(r['g'] for r in R) / sum(r['gr'] for r in R)
        print(f'    {name:16} idx {sum(r["oidx"] for r in R)/len(R):.2f}  1+ {rt(R,1):5.1%}  goals vs his rate x{rel:.3f} (n={len(R)})')

ENV = (('tough <0.92', 0, 0.92), ('firm 0.92-1.0', 0.92, 1.0), ('loose 1.0-1.08', 1.0, 1.08), ('soft >1.08', 1.08, 9))
print('\n== 3. BOTH (forwards): his iSCF a game x env (iSCF allowed / league)')
print('  env shares:', ', '.join(f'{e[0]} {sum(e[1] <= r["oidx"] < e[2] for r in F)/len(F):.0%}' for e in ENV))
for k in (1, 2):
    print(f'  -- {k}+ goals')
    for lo, hi in ((0.75, 1.25), (1.25, 1.75), (1.75, 2.25), (2.25, 2.75), (2.75, 9)):
        Rb = [r for r in F if lo <= r['iscf'] < hi]
        cells = []
        for _, a, b in ENV:
            R = [r for r in Rb if a <= r['oidx'] < b]
            cells.append(f'{rt(R,k):6.1%} ({len(R):4})' if len(R) >= 60 else f'{"-":>13}')
        print(f'  iSCF {lo}-{hi if hi < 9 else "+":<5} ' + ''.join(f'{c:>16}' for c in cells))

def fit(R, feats):
    X = [[1.0] + [f(r) for f in feats] for r in R]; y = [r['g'] for r in R]; k = len(X[0])
    w = [math.log(sum(y) / len(y))] + [0.0] * (k - 1)
    for _ in range(30):
        g = [0.0] * k; H = [[0.0] * k for _ in range(k)]
        for x, yy in zip(X, y):
            mu = math.exp(sum(a * b for a, b in zip(w, x)))
            for i in range(k):
                g[i] += (yy - mu) * x[i]
                for j in range(k): H[i][j] += mu * x[i] * x[j]
        # gaussian elimination
        M = [H[i][:] + [g[i]] for i in range(k)]
        for c in range(k):
            p = max(range(c, k), key=lambda r_: abs(M[r_][c])); M[c], M[p] = M[p], M[c]
            for r_ in range(k):
                if r_ != c:
                    f_ = M[r_][c] / M[c][c]
                    M[r_] = [a - f_ * b for a, b in zip(M[r_], M[c])]
        d = [M[i][k] / M[i][i] for i in range(k)]
        w = [a + b for a, b in zip(w, d)]
    return w
def pge(lam, k): return 1 - sum(math.exp(-lam) * lam ** i / math.factorial(i) for i in range(k))

print('\n== 4. Fitted: goals = A x iSCF^b x env^c ; then with his own goal rate in')
for lab, R0 in (('F', F), ('D', D)):
    a, b, c = fit(R0, [lambda r: math.log(r['iscf']), lambda r: math.log(r['oidx'])])
    print(f'  {lab}: A={math.exp(a):.3f} b={b:.3f} c={c:.3f}  -> matchup worth iSCF x env^{c/b:.2f}; x0.88 -> x1.12 = x{(1.12/0.88)**(c/b):.2f} on his iSCF')
    for k, tgt in ((1, 0.40 if lab == 'F' else 0.20), (2, 0.08 if lab == 'F' else 0.03)):
        out = []
        for env in (0.88, 0.95, 1.0, 1.05, 1.12):
            lo_, hi_ = 0.05, 15
            for _ in range(60):
                m = (lo_ + hi_) / 2; lam = math.exp(a) * m ** b * env ** c
                lo_, hi_ = (m, hi_) if pge(lam, k) < tgt else (lo_, m)
            out.append(f'env {env}: {m:4.2f}')
        print(f'    iSCF needed for {k}+ at {tgt:.0%}:  ' + '   '.join(out))
    R1 = [r for r in R0 if r['gr'] > 0]
    a2, b2, gcoef, c2 = fit(R1, [lambda r: math.log(r['iscf']), lambda r: math.log(r['gr']), lambda r: math.log(r['oidx'])])
    print(f'    with his goal rate: iSCF^{b2:.3f} x G/G^{gcoef:.3f} x env^{c2:.3f} (n={len(R1)})')
    a3, b3, c3 = fit(R0, [lambda r: math.log(r['iscf']), lambda r: math.log(max(0.3, r['gidx']))])
    print(f'    goals-allowed index instead of iSCF-allowed: env^{c3:.3f}')

print('\n== 5. Head to head (forwards): lower chance creator vs soft vs higher vs tough')
for l1, l2 in (((1.25, 1.75), (1.75, 2.25)), ((1.75, 2.25), (2.25, 2.75)), ((1.25, 1.75), (2.25, 9)), ((1.75, 2.25), (2.75, 9))):
    A = [r for r in F if l1[0] <= r['iscf'] < l1[1] and r['oidx'] >= 1.08]
    B = [r for r in F if l2[0] <= r['iscf'] < l2[1] and r['oidx'] < 0.92]
    m = lambda R: sum(r['g'] for r in R) / len(R)
    print(f'  iSCF {l1} soft: G/G {m(A):.3f}, 1+ {rt(A,1):.1%} (n={len(A)})   |   iSCF {l2} tough: G/G {m(B):.3f}, 1+ {rt(B,1):.1%} (n={len(B)})')


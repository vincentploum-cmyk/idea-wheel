# The NFL's pick rules (docs/audits/2026-11-08-nfl-picks.md; Vincent, 2026-11-08: "work on the pick rules"). The board lists
# every player with his strong / lean / thin rungs (60 / 45 / 30%) and sorts the lists by projection; nothing says which
# rungs to play. The engines study (2026-11-03) found each week's top two by projection landing well under what their rungs
# said. Here, on the PropFinder replay as shipped (the shrink and the target share in; 2024 weeks 6–18, 2025 weeks 4–18,
# 2026 weeks 1–8, the games he played):
#   A. the rungs by the size of the projection, said against landed (is the top of a list miscalibrated as a class?)
#   B. each week's top K by projection — what a reader of the lists sees first — said against landed
#   C. what predicts a rung landing beyond its said chance (logistic on logit(said) + one feature, fitted 2024–25, scored 2026)
#   D. the rules: each week's K plays per market picked by a key, hit rate and said against landed on every season
#
#   node --import ./tools/audit/register.mjs tools/audit/nfl-pf-audit.mjs --pf .nhl-data/audit/nfl-pf --raw .nhl-data/audit/nfl --dump --check-to 8
#   python3 -I tools/audit/nfl_picks.py [--audit .nhl-data/audit] [--json out.json]
import sys, os, io, json, runpy, contextlib, collections as C
import numpy as np
from scipy.optimize import minimize

arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
ROOT = arg('--audit', '.nhl-data/audit'); OUT = arg('--json')
# The player-games and their features: nfl_sources.py's builder (PropFinder's logs cut before each game, the board's read).
here = os.path.dirname(os.path.abspath(__file__))
argv0 = sys.argv; sys.argv = [os.path.join(here, 'nfl_sources.py'), '--audit', ROOT]
with contextlib.redirect_stdout(io.StringIO()):
    G = runpy.run_path(os.path.join(here, 'nfl_sources.py'), run_name='nfl_sources')
sys.argv = argv0
data = G['data']; nz = G['nz']
print('player-games', C.Counter(x['season'] for x in data), file=sys.stderr)

# lib/nfl/projections.js RESID and the ladder (ladderTiers) as shipped
RESID = {
    'rec_yds': [-1.17, -0.95, -0.817, -0.703, -0.588, -0.472, -0.358, -0.245, -0.115, -0.002, 0.116, 0.271, 0.425, 0.604, 0.803, 1.034, 1.353, 1.809, 2.484],
    'rush_yds': [-1.212, -0.91, -0.746, -0.644, -0.519, -0.4, -0.3, -0.213, -0.11, 0.0, 0.13, 0.271, 0.422, 0.558, 0.754, 1.037, 1.373, 1.923, 2.798],
    'pass_yds': [-1.428, -1.167, -0.957, -0.828, -0.715, -0.563, -0.415, -0.235, -0.111, -0.008, 0.088, 0.22, 0.335, 0.414, 0.557, 0.746, 1.009, 1.236, 1.584],
    'receptions': [-1.481, -1.155, -0.97, -0.794, -0.655, -0.496, -0.374, -0.259, -0.156, -0.052, 0.088, 0.246, 0.399, 0.57, 0.755, 0.953, 1.254, 1.649, 2.317],
}
STEP = {'rec_yds': 10, 'rush_yds': 10, 'pass_yds': 25, 'receptions': 1}
TIERS = (('strong', .6), ('lean', .45), ('thin', .3))
def cdf(q, z):
    if z <= q[0]: return max(0.01, 0.05 - 0.05 * (q[0] - z) / max(1e-6, q[1] - q[0]))
    if z >= q[18]: return min(0.99, 0.95 + 0.05 * (z - q[18]) / max(1e-6, q[18] - q[17]))
    for i in range(18):
        if z <= q[i + 1]: return 0.05 * (i + 1) + 0.05 * (z - q[i]) / max(1e-6, q[i + 1] - q[i])
    return 0.95
def chance(m, proj, sd, mark): return round(1 - cdf(RESID[m], (mark - 0.5 - proj) / sd), 3)
def tiers(m, proj, sd):
    if proj is None or not sd: return {}
    step = 5 if m in ('rec_yds', 'rush_yds') and proj < 40 else STEP[m]
    marks = []; mk = step
    while mk <= proj + 3 * sd: marks.append((mk, chance(m, proj, sd, mk))); mk += step
    out = {}; used = set()
    for t, at in TIERS:
        b = [x for x in marks if x[1] >= at]
        if b and b[-1][0] not in used: out[t] = b[-1]
        if b: used.add(b[-1][0])
    return out

# The lists' populations (lib/nfl/projections.js listsOf): receiving WR / TE / RB from 10 yards (receptions with them),
# rushing backs and quarterbacks from 10, passing the starters from 100.
MK = {
    'rec_yds': dict(y='recYds', keep=lambda x: x['pos'] in ('WR', 'TE', 'RB') and nz(x['b_rec_yds']) >= 10),
    'receptions': dict(y='rec', keep=lambda x: x['pos'] in ('WR', 'TE', 'RB') and nz(x['b_rec_yds']) >= 10 and nz(x['b_receptions']) >= 1),
    'rush_yds': dict(y='rushYds', keep=lambda x: x['pos'] in ('RB', 'QB') and nz(x['b_rush_yds']) >= 10),
    'pass_yds': dict(y='passYds', keep=lambda x: x['pos'] == 'QB' and nz(x['b_pass_yds']) >= 100 and x['qb_starts'] >= 1 and x['passAtt'] >= 10),
}
# One row per player-game-market-tier: the rung, its said chance, the hit, and the features a rule may read.
R = []
for m, spec in MK.items():
    for x in data:
        if not spec['keep'](x) or not x.get(f'sd_{m}'): continue
        proj, sd = x[f'b_{m}'], x[f'sd_{m}']
        for t, (mark, p) in tiers(m, proj, sd).items():
            R.append(dict(m=m, tier=t, season=x['season'], tag=x['tag'], key=x['key'], pos=x['pos'], team=x['team'], proj=proj, sd=sd,
                          mark=mark, said=p, hit=1 if x[spec['y']] >= mark else 0, cv=sd / max(proj, 1e-6), cushion=(proj - mark) / sd,
                          share=nz(x['sh_tgt5']) if m in ('rec_yds', 'receptions') else nz(x['sh_car5']), vol=nz(x['tgt5']) if m in ('rec_yds', 'receptions') else nz(x['car5']),
                          implied=x['implied'], fav=x['fav'], total=x['total'], def_=x['def_recPos'] if m in ('rec_yds', 'receptions') else x['def_ypc'] if m == 'rush_yds' else x['def_ypa'],
                          own17=x['rec17'] if m == 'rec_yds' else x['rush17'] if m == 'rush_yds' else x.get('qb_att') or 0))
print('rungs', C.Counter((r['m'], r['tier']) for r in R), file=sys.stderr)
report = {}
SEASONS = (2024, 2025, 2026)
fmt = lambda xs: f"{len(xs):5d} said {100 * np.mean([r['said'] for r in xs]):4.1f}% landed {100 * np.mean([r['hit'] for r in xs]):4.1f}%" if xs else '    —'

# ---- A. the rungs by the size of the projection
print('\n=== A. the rungs by the projection\'s fifth (the market\'s population, every season)')
report['A'] = {}
for m in MK:
    xs = [r for r in R if r['m'] == m]
    q = np.percentile([r['proj'] for r in xs], [20, 40, 60, 80])
    band = lambda v: int(np.searchsorted(q, v, side='right'))
    print(f"  {m}: fifths at {', '.join(f'{v:.0f}' for v in q)}")
    for t, _ in TIERS:
        line = []
        for b in range(5):
            ys = [r for r in xs if r['tier'] == t and band(r['proj']) == b]
            line.append((len(ys), float(np.mean([r['said'] for r in ys])) if ys else None, float(np.mean([r['hit'] for r in ys])) if ys else None))
        report['A'][f'{m} {t}'] = line
        print(f"    {t:6s} " + ' | '.join(f"{n:4d} {100*s:4.1f}→{100*h:4.1f}" if n else '—' for n, s, h in line))

# ---- B. each week's top K by projection
print('\n=== B. each week\'s top K by projection: the strong rung, said → landed (2024 · 2025 · 2026)')
report['B'] = {}
def week_top(xs, key, k):
    by = C.defaultdict(list)
    for r in xs: by[r['tag']].append(r)
    out = []
    for t, ys in by.items(): out += sorted(ys, key=key, reverse=True)[:k]
    return out
for m in MK:
    for k in (2, 5, 10):
        res = {}
        for t, _ in TIERS:
            xs = [r for r in R if r['m'] == m and r['tier'] == t]
            res[t] = {s: week_top([r for r in xs if r['season'] == s], lambda r: r['proj'], k) for s in SEASONS}
        report['B'][f'{m} top {k}'] = {t: {s: [len(v), float(np.mean([r['said'] for r in v])), float(np.mean([r['hit'] for r in v]))] for s, v in d.items() if v} for t, d in res.items()}
        print(f"  {m:10s} top {k:2d}  strong " + ' · '.join(fmt(res['strong'][s]) for s in SEASONS))
    allx = [r for r in R if r['m'] == m and r['tier'] == 'strong']
    print(f"  {m:10s} everyone strong " + ' · '.join(fmt([r for r in allx if r['season'] == s]) for s in SEASONS))

# ---- C. what predicts a rung landing beyond what it says
def logit(p): p = np.clip(np.asarray(p, float), 1e-3, 1 - 1e-3); return np.log(p / (1 - p))
def fit(X, y, l2=1e-3):
    f = lambda b: (lambda p: -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)) + l2 * np.sum(b[1:] ** 2))(np.clip(1 / (1 + np.exp(-(X @ b))), 1e-6, 1 - 1e-6))
    return minimize(f, np.zeros(X.shape[1]), method='BFGS').x
def ll(p, y): p = np.clip(p, 1e-6, 1 - 1e-6); return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))
def boot(d, B=2000, seed=1):
    rng = np.random.default_rng(seed); n = len(d); bs = [d[rng.integers(0, n, n)].mean() for _ in range(B)]
    return float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))
FEATS = {
    'the projection (over the market\'s median)': lambda r, med: r['proj'] / med - 1,
    'the spread over the projection (cv)': lambda r, med: r['cv'],
    'the cushion: (projection − mark) / spread': lambda r, med: r['cushion'],
    'his volume (targets / carries, last five)': lambda r, med: r['vol'],
    'his share (target / carry, last five)': lambda r, med: r['share'],
    'his own yards a game, last 17': lambda r, med: r['own17'] / med - 1,
    'implied points': lambda r, med: r['implied'] - 22,
    'spread (favourite +)': lambda r, med: r['fav'],
    'game total': lambda r, med: r['total'] - 44.5,
    'the defense at his position': lambda r, med: r['def_'],
    'a tight end': lambda r, med: 1.0 if r['pos'] == 'TE' else 0.0,
    'a back': lambda r, med: 1.0 if r['pos'] == 'RB' else 0.0,
}
print('\n=== C. the strong and lean rungs: what reads a hit beyond the said chance (fit 2024–25, log loss ×1000 on 2026)')
report['C'] = {}
for m in MK:
    xs = [r for r in R if r['m'] == m and r['tier'] in ('strong', 'lean')]
    tune = [r for r in xs if r['season'] < 2026]; chk = [r for r in xs if r['season'] == 2026]
    med = float(np.median([r['proj'] for r in tune]))
    yt = np.array([r['hit'] for r in tune], float); yc = np.array([r['hit'] for r in chk], float)
    said_c = np.array([r['said'] for r in chk])
    base = ll(said_c, yc)
    X0t = np.column_stack([np.ones(len(tune)), logit([r['said'] for r in tune])]); X0c = np.column_stack([np.ones(len(chk)), logit(said_c)])
    b0 = fit(X0t, yt); p0 = 1 / (1 + np.exp(-(X0c @ b0)))
    print(f"  {m} ({len(tune)} / {len(chk)}): the said chance {1000*base:.1f}; recalibrated {1000*ll(p0, yc):.1f}")
    rep = {'said': base, 'recal': ll(p0, yc), 'feats': {}}
    for nm, f in FEATS.items():
        Xt = np.column_stack([X0t, [f(r, med) for r in tune]]); Xc = np.column_stack([X0c, [f(r, med) for r in chk]])
        b = fit(Xt, yt); pc = 1 / (1 + np.exp(-(Xc @ b)))
        d = np.array([-(y * np.log(max(1e-6, p)) + (1 - y) * np.log(max(1e-6, 1 - p))) for p, y in zip(pc, yc)]) - np.array([-(y * np.log(max(1e-6, p)) + (1 - y) * np.log(max(1e-6, 1 - p))) for p, y in zip(p0, yc)])
        lo, hi = boot(d)
        rep['feats'][nm] = dict(beta=[round(float(v), 4) for v in b], ll=ll(pc, yc), vs_recal=[float(d.mean()), lo, hi])
        print(f"    + {nm:44s} {1000*ll(pc, yc):6.1f} ({1000*d.mean():+5.1f}, {1000*lo:+5.1f} to {1000*hi:+5.1f})  w {b[2]:+.3f}")
    report['C'][m] = rep

if OUT: json.dump(report, open(OUT, 'w'), indent=1)

# ---- E. the curves by position group: a back's receiving and a quarterback's rushing land unlike the market's pool
# (the receivers' curve is mostly wide receivers', a quarterback's rushing borrowed the backs'); each group's misses in his
# spread at 5% steps, fitted on 2024–25 (the games he played, the list's population), the rungs scored on 2026.
print('\n=== E. the rungs on a curve of their own (fit 2024–25, scored 2026; said → landed)')
GROUPS = {('rec_yds', 'RB'): 'recYds', ('rush_yds', 'QB'): 'rushYds', ('rush_yds', 'RB'): 'rushYds', ('rec_yds', 'WR'): 'recYds', ('rec_yds', 'TE'): 'recYds', ('receptions', 'RB'): 'rec'}
report['E'] = {}
CURVES = {}
for (m, pos), ycol in GROUPS.items():
    xs = [x for x in data if MK[m]['keep'](x) and x['pos'] == pos and x.get(f'sd_{m}')]
    tune = [x for x in xs if x['season'] < 2026]; chk = [x for x in xs if x['season'] == 2026]
    z = np.array([(x[ycol] - x[f'b_{m}']) / x[f'sd_{m}'] for x in tune])
    q = [round(float(v), 3) for v in np.percentile(z, np.arange(5, 100, 5))]
    CURVES[(m, pos)] = q
    def rungs(rows_, curve):
        old = RESID[m]; RESID[m] = curve
        acc = C.defaultdict(list)
        for x in rows_:
            for t, (mk, p) in tiers(m, x[f'b_{m}'], x[f'sd_{m}']).items(): acc[t].append((p, 1 if x[ycol] >= mk else 0))
        RESID[m] = old
        return {t: (len(v), float(np.mean([a for a, _ in v])), float(np.mean([b for _, b in v]))) for t, v in acc.items()}
    before = rungs(chk, RESID[m]); after = rungs(chk, q); after_t = rungs(tune, q)
    report['E'][f'{m} {pos}'] = dict(curve=q, before=before, after=after, tune=after_t, range=[-q[3], q[15]])
    show = lambda d: ' · '.join(f"{t} {100*d[t][1]:4.1f}→{100*d[t][2]:4.1f} ({d[t][0]})" for t, _ in TIERS if t in d)
    print(f"  {m} {pos}: pooled curve   {show(before)}")
    print(f"  {' ' * len(m)} {pos}: its own curve {show(after)}   [2024–25: {show(after_t)}]")
    print(f"      curve {q}  range [{-q[3]}, {q[15]}]")
if OUT: json.dump(report, open(OUT, 'w'), indent=1)

# ---- D. the pick rules, on the rungs as they will ship (the three groups on their own curves): each week's K plays per
# list picked by a key, their strong (or lean) rung said → landed and the hit rate, every season.
SHIP_CURVES = {k: CURVES[k] for k in (('rec_yds', 'RB'), ('rush_yds', 'QB'), ('rush_yds', 'RB'))}
def tiers_for(m, pos, proj, sd):
    c = SHIP_CURVES.get((m, pos))
    if not c: return tiers(m, proj, sd)
    old = RESID[m]; RESID[m] = c
    try: return tiers(m, proj, sd)
    finally: RESID[m] = old
P = []
for m, spec in MK.items():
    for x in data:
        if not spec['keep'](x) or not x.get(f'sd_{m}'): continue
        tt = tiers_for(m, x['pos'], x[f'b_{m}'], x[f'sd_{m}'])
        for t, (mark, p) in tt.items():
            P.append(dict(m=m, tier=t, season=x['season'], tag=x['tag'], pos=x['pos'], proj=x[f'b_{m}'], sd=x[f'sd_{m}'], mark=mark, said=p,
                          hit=1 if x[spec['y']] >= mark else 0, cv=x[f'sd_{m}'] / max(1e-6, x[f'b_{m}']),
                          vol=nz(x['tgt5']) if m in ('rec_yds', 'receptions') else nz(x['car5']) if m == 'rush_yds' else nz(x.get('qb_att')),
                          share=nz(x['sh_tgt5']) if m in ('rec_yds', 'receptions') else nz(x['sh_car5']), implied=x['implied']))
KEYS = {
    'the projection (the lists\' order)': lambda r: r['proj'],
    'the rung\'s chance': lambda r: r['said'],
    'the mark (the highest strong rung)': lambda r: r['mark'],
    'the steadiest (lowest spread / projection)': lambda r: -r['cv'],
    'the volume (targets / carries, last five)': lambda r: r['vol'],
    'the share (last five)': lambda r: r['share'],
    'implied points': lambda r: r['implied'],
}
print('\n=== D. each week\'s plays per list, by key, on the shipped curves (said → landed; 2024 · 2025 · 2026)')
report['D'] = {}
for m in MK:
    for t in ('strong', 'lean'):
        for k in (3, 5):
            print(f"  {m} {t}, top {k} a week")
            for nm, key in KEYS.items():
                xs = [r for r in P if r['m'] == m and r['tier'] == t]
                cells = {s: week_top([r for r in xs if r['season'] == s], key, k) for s in SEASONS}
                allp = [r for s in SEASONS for r in cells[s]]
                report['D'][f'{m} {t} top {k} | {nm}'] = {s: [len(v), float(np.mean([r['said'] for r in v])), float(np.mean([r['hit'] for r in v]))] for s, v in cells.items() if v}
                print(f"    {nm:44s} " + ' · '.join(fmt(cells[s]) for s in SEASONS) + f"  | all {100*np.mean([r['hit'] for r in allp]):4.1f}% on {100*np.mean([r['said'] for r in allp]):4.1f}%, mark {np.mean([r['mark'] for r in allp]):5.1f}")
            if t == 'strong' and k == 5:
                xs = [r for r in P if r['m'] == m and r['tier'] == t]
                print(f"    {'everyone':44s} " + ' · '.join(fmt([r for r in xs if r['season'] == s]) for s in SEASONS))
if OUT: json.dump(report, open(OUT, 'w'), indent=1)

"""Model vs study vs blend, on the games the model actually projected. Reads the site's scorecard
export (signed in: /api/nhl/data/scorecard?rows=1&from=<date>, saved as JSON) and rebuilds the
study's λ for every graded skater-game leak-free from the public box scores (the relabelled games
dirs run.sh writes), the way lib/nhl-data/picks-pure.js does: the skater's rates this season
blended into last season's at n / (n + 18) shots and attempts, n / (n + 40) goals and chances,
n / (n + 5) TOI; home ice; back-to-back; what the opponent allows per skater at his position,
this season blended into last season's table at games / (games + 15) shots, games / (games + 40)
goals. Then grades the model's λ, the study's λ and their blends (study share 0, 0.25, 0.5,
0.75, 1) on the same rows: MAE, bias, Poisson Brier and log loss for 3+ SOG and 1+ goal, the
hit rate of the top 10 / 20 shooters and scorers a slate, and the board rule (every skater over
P(3+) 50% / P(1+ G) 35%).

  python3 -I tools/predictors/grade_blend.py <scorecard rows json> <this season games-pos dir> <previous season games-pos dir>
"""
import sys, glob, json, math, unicodedata, re
from collections import defaultdict
from datetime import date as D

export_path, cur_dir, prev_dir = sys.argv[1:4]
POS = ('C', 'LW', 'RW', 'D')
S = dict(const=-1.4391, sog=0.3923, icf=0.4484, toi=0.297, home=0.0341, pos=0.6869, b2b=-0.026)
G = dict(const=-1.0539, g=0.3735, iscf=0.4356, sog=0.4007, home=0.0682, pos=0.4448, b2b=-0.0677)
LEAGUE = {'C': (1.73, 0.23), 'LW': (1.63, 0.21), 'RW': (1.69, 0.215), 'D': (1.27, 0.077)}
lg = lambda v: math.log(max(v, 0.05))
mean = lambda xs: sum(xs) / len(xs) if xs else None
norm = lambda s: re.sub(r'[^a-z]', '', unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower())

def load(d):
    gs = []
    for f in sorted(glob.glob(f'{d}/*.json')): gs += json.load(open(f))['games']
    return sorted(gs, key=lambda g: (g['date'], g['id']))
cur, prev = load(cur_dir), load(prev_dir)

# last season's base: per player and per (defending team, position)
pph = defaultdict(list); oppp = defaultdict(lambda: dict(sog=0, g=0, n=0, games=set()))
for g in prev:
    for s in g['skaters']:
        if s['pos'] not in POS: continue
        pph[s['id']].append(s); o = oppp[(s['opp'], s['pos'])]; o['sog'] += s['sog']; o['g'] += s['g']; o['n'] += 1; o['games'].add(g['id'])

def poisson_at_least(lam, k):
    term = math.exp(-lam); below = 0
    for i in range(k): below += term; term *= lam / (i + 1)
    return max(1e-9, min(1 - 1e-9, 1 - below))

exp = json.load(open(export_path))
rows = exp['rows'] if isinstance(exp, dict) else exp
rows = [r for r in rows if r.get('lambdaS') is not None and r['pos'] in POS]
dates = sorted({r['date'] for r in rows})
print(f'{len(rows)} graded skater-games on {len(dates)} slates ({dates[0]} → {dates[-1]}), model run saved before each puck drop.')

# walk the dates: the study's read from the rows strictly before each
ph = defaultdict(list); oppc = defaultdict(lambda: dict(sog=0, g=0, n=0, games=set())); last = {}
gi = 0
graded = []
for date in dates:
    while gi < len(cur) and cur[gi]['date'] < date:
        g = cur[gi]; gi += 1
        for team in (g['away']['abbrev'], g['home']['abbrev']): last[team] = g['date']
        for s in g['skaters']:
            if s['pos'] not in POS: continue
            ph[s['id']].append(s); o = oppc[(s['opp'], s['pos'])]; o['sog'] += s['sog']; o['g'] += s['g']; o['n'] += 1; o['games'].add(g['id'])
    def rates(pid):
        c, p = ph.get(pid, []), pph.get(pid, [])
        n = len(c); base = len(p) >= 10
        if not base and n < 5: return None
        def bl(k, prior):
            w = n / (n + prior) if base else 1
            return w * (mean([x[k] for x in c]) or 0) + (1 - w) * (mean([x[k] for x in p]) if base else 0)
        toi = bl('toi', 5)
        return dict(sog=bl('sog', 18), icf=bl('icf', 18), g=bl('g', 40), iscf=bl('iscf', 40), toiL5=mean([x['toi'] for x in c[-5:]]) if n else toi)
    def opp_read(team, pos):
        c, p = oppc.get((team, pos)), oppp.get((team, pos))
        cs = c['sog'] / c['n'] if c and c['n'] else None; cg = c['g'] / c['n'] if c and c['n'] else None
        ok = p and p['n'] and len(p['games']) >= 10
        ps = p['sog'] / p['n'] if ok else None; pg = p['g'] / p['n'] if ok else None
        games = len(c['games']) if c else 0
        def bl(cv, pv, k): return cv if pv is None else pv if cv is None else (games / (games + k)) * cv + (k / (games + k)) * pv
        if cs is None and ps is None: return None
        return dict(sog=bl(cs, ps, 15), g=bl(cg, pg, 40))
    # the day's skaters by (team, normalised name) → id, from the box scores of the date
    ids = {}
    for g in cur:
        if g['date'] != date: continue
        for s in g['skaters']: ids[(s['team'], norm(s['name']))] = s['id']
    for r in rows:
        if r['date'] != date: continue
        pid = ids.get((r['team'], norm(r['name'])))
        if pid is None: continue
        rt = rates(pid)
        if not rt: continue
        o = opp_read(r['opp'], r['pos']) or dict(sog=LEAGUE[r['pos']][0], g=LEAGUE[r['pos']][1])
        is_home = 1 if r['venue'] == 'H' else 0
        l = last.get(r['team']); bb = bool(l) and (D.fromisoformat(date) - D.fromisoformat(l)).days == 1
        lamS = math.exp(S['const'] + S['sog'] * lg(rt['sog']) + S['icf'] * lg(rt['icf']) + S['toi'] * lg(rt['toiL5']) + S['home'] * is_home + S['pos'] * lg(o['sog']) + S['b2b'] * bb)
        lamG = math.exp(G['const'] + G['g'] * math.log(max(rt['g'], 0) + 0.05) + G['iscf'] * lg(rt['iscf']) + G['sog'] * lg(rt['sog']) + G['home'] * is_home + G['pos'] * math.log(max(o['g'], 0) + 0.1) + G['b2b'] * bb)
        graded.append(dict(r, studyS=lamS, studyG=lamG))

print(f'{len(graded)} of them have a study read (a base of 10+ games last season or 5+ this season) and a matching box-score skater.\n')
WEIGHTS = (0, 0.25, 0.5, 0.75, 1)
def lam_of(r, stat, w):
    m, s = (r['lambdaS'], r['studyS']) if stat == 'sog' else (r['lambdaG'] or 0, r['studyG'])
    return (1 - w) * m + w * s
def score(stat, k, w):
    lams = [lam_of(r, stat, w) for r in graded]; acts = [r[stat] for r in graded]
    ps = [poisson_at_least(l, k) for l in lams]; hits = [1 if a >= k else 0 for a in acts]
    n = len(lams)
    return dict(n=n, avg=mean(lams), actual=mean(acts), mae=mean([abs(l - a) for l, a in zip(lams, acts)]), bias=mean([l - a for l, a in zip(lams, acts)]),
                said=mean(ps), hit=mean(hits), brier=mean([(p - h) ** 2 for p, h in zip(ps, hits)]), logloss=mean([-(math.log(p) if h else math.log(1 - p)) for p, h in zip(ps, hits)]))
def topk(stat, k, floor_k, w, top):
    """Hit rate of the top `top` skaters a slate by the blended λ on the floor_k market."""
    byd = defaultdict(list)
    for r in graded: byd[r['date']].append(r)
    hit = n = 0
    for d, lst in byd.items():
        lst = sorted(lst, key=lambda r: -lam_of(r, stat, w))[:top]
        for r in lst: n += 1; hit += 1 if r[stat] >= floor_k else 0
    return hit / n if n else None, n
def board(stat, floor_k, floor_p, w):
    """The board rule: every skater over the floor, graded."""
    n = hit = 0; said = 0
    for r in graded:
        p = poisson_at_least(lam_of(r, stat, w), floor_k)
        if p >= floor_p: n += 1; hit += 1 if r[stat] >= floor_k else 0; said += p
    return (hit / n if n else None, said / n if n else None, n)

for stat, k, label, floor_p, tops in (('sog', 3, '3+ SOG', 0.5, (10, 20)), ('g', 1, '1+ goal', 0.35, (10, 20))):
    print(f'=== {label}: study share → 0 = the model alone, 1 = the study alone ===')
    print(f"{'share':>6} {'proj':>6} {'actual':>7} {'bias':>7} {'MAE':>6} {'said':>6} {'hit':>6} {'Brier':>7} {'logloss':>8}   top10 hit   top20 hit   board: hit / said / calls")
    for w in WEIGHTS:
        sc = score(stat, k, w); t10, _ = topk(stat, k, k, w, tops[0]); t20, _ = topk(stat, k, k, w, tops[1]); bh, bs, bn = board(stat, k, floor_p, w)
        print(f"{w:>6.2f} {sc['avg']:>6.2f} {sc['actual']:>7.2f} {sc['bias']:>+7.2f} {sc['mae']:>6.3f} {sc['said']:>6.1%} {sc['hit']:>6.1%} {sc['brier']:>7.4f} {sc['logloss']:>8.4f}   {t10:>9.1%}   {t20:>9.1%}   {bh if bh is None else f'{bh:.1%}':>7} / {bs if bs is None else f'{bs:.1%}':>6} / {bn}")
    # paired bootstrap: is the half blend's Brier better than the model's beyond noise?
    import random
    random.seed(7)
    def brier_rows(w):
        return [(poisson_at_least(lam_of(r, stat, w), k) - (1 if r[stat] >= k else 0)) ** 2 for r in graded]
    bm, bb = brier_rows(0), brier_rows(0.5)
    diffs = [a - b for a, b in zip(bm, bb)]
    n = len(diffs); boots = []
    for _ in range(2000):
        idx = [random.randrange(n) for _ in range(n)]
        boots.append(sum(diffs[i] for i in idx) / n)
    boots.sort()
    print(f"  half blend vs model, Brier gain {mean(diffs):+.5f} (positive = blend better); 95% bootstrap {boots[50]:+.5f} … {boots[1949]:+.5f}; the blend better in {sum(1 for b in boots if b > 0) / len(boots):.0%} of resamples\n")
print('Read: lower MAE / Brier / log loss is better; "said" should match "hit"; the top-k and board columns are what the user sees. A gain that holds across shares and whose bootstrap interval excludes zero is proof; one that flips sign between slates is noise.')

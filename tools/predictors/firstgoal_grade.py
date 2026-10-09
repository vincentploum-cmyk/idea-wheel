"""How well does the 1st goal tab pick the game's first goal scorer? Replays the tab's score
(lib/nhl-data/firstgoal.js: the model's 1+ goal odds, the player's own first-goal rate, the
opponent's first-goal leak to his position at tonight's venue, head to head) for every
skater-game, from games before the row only, and grades the ranking against who scored first.
The model's 1+ goal odds are not available offline: they are stood in for by the player's own
goal rate (last season blended with this season, which section 5 found to be what the goal
odds track), and the tab is also scored without that term (its own fallback formula).
argv: <rows.csv> <games dir of the season> <games dir of the previous season> <label>
"""
import sys, glob, json, math, warnings
from collections import defaultdict
import numpy as np, pandas as pd
warnings.filterwarnings('ignore')
rows_csv, cur_dir, prev_dir, label = sys.argv[1:5]
POS = ('C', 'LW', 'RW', 'D')
LEAGUE_FG, SHRINK = 0.028, 20
clamp = lambda v, lo, hi: min(hi, max(lo, v))
def score(p1g, rate_adj, leak_ratio, h2h_gpg):
    own = clamp(rate_adj / 0.15, 0, 1); leak = clamp(leak_ratio, 0, 2) / 2; h2h = clamp(h2h_gpg, 0, 1)
    s = 0.45 * clamp(p1g / 0.45, 0, 1) + 0.30 * own + 0.15 * leak + 0.10 * h2h if p1g is not None else 0.55 * own + 0.30 * leak + 0.15 * h2h
    return round(clamp(s, 0, 1) * 100)
def load(d):
    out = []
    for f in sorted(glob.glob(f'{d}/*.json')): out += json.load(open(f))['games']
    return sorted(out, key=lambda g: (g['date'], g['id']))
prev, cur = load(prev_dir), load(cur_dir)
# state carried forward: the player's fg record (last 100 flagged games), h2h goals, and each defence's first goals given up by venue and position
rec = defaultdict(list); h2h = defaultdict(lambda: [0, 0]); fga = defaultdict(lambda: defaultdict(lambda: [0, 0]))  # (team, venue) -> pos -> [games, allowed]
def add_game(g):
    fg = g.get('firstGoal') or {}
    scorer = fg.get('playerId')
    for s in g['skaters']:
        if s['pos'] not in POS: continue
        rec[s['id']].append(1 if s['id'] == scorer else 0)
        h = h2h[(s['id'], s['opp'])]; h[0] += 1; h[1] += s['g']
    for side, other in (('home', 'away'), ('away', 'home')):
        dv = 'H' if side == 'home' else 'A'; t = g[side]['abbrev']
        tab = fga[(t, dv)]
        for p in POS + ('All',): tab[p][0] += 1
        if scorer and fg.get('team') == g[other]['abbrev']:
            sp = next((s['pos'] for s in g['skaters'] if s['id'] == scorer), None)
            tab['All'][1] += 1
            if sp in POS: tab[sp][1] += 1
for g in prev: add_game(g)
d = pd.read_csv(rows_csv)
n = d.n_prior.fillna(0); w = n / (n + 40)
d['bl_g'] = np.where(d.p_g_avg.notna(), w * d.p_g_avg.fillna(0) + (1 - w) * d.ls_g_pg, d.ls_g_pg)
prior = {(r.gameId, r.playerId): r.bl_g for r in d.itertuples()}
rows = []
by_date = defaultdict(list)
for g in cur: by_date[g['date']].append(g)
for date in sorted(by_date):
    for g in by_date[date]:
        fg = g.get('firstGoal') or {}
        if not fg.get('playerId'): continue
        # league share of first goals given up at each venue to each position, from the games so far
        lg = {}
        for dv in 'HA':
            for p in POS:
                cells = [fga[(t, dv)][p] for (t, v) in list(fga) if v == dv]
                gp = sum(c[0] for c in cells); lg[(dv, p)] = sum(c[1] for c in cells) / gp if gp else None
        for s in g['skaters']:
            if s['pos'] not in POS: continue
            r = rec[s['id']][-100:]; gp = len(r); f = sum(r)
            rate_adj = (f + LEAGUE_FG * SHRINK) / (gp + SHRINK)
            dv = 'H' if s['venue'] == 'A' else 'A'
            cell = fga[(s['opp'], dv)][s['pos']]; league = lg[(dv, s['pos'])]
            leak = (cell[1] / cell[0]) / league if cell[0] and league else 1.0
            hh = h2h[(s['id'], s['opp'])]; gpg = hh[1] / hh[0] if hh[0] else 0
            bg = prior.get((g['id'], s['id']))
            p1g = (1 - math.exp(-bg)) if bg is not None and not (isinstance(bg, float) and math.isnan(bg)) else None
            rows.append(dict(date=date, gameId=g['id'], id=s['id'], name=s['name'], team=s['team'], opp=s['opp'], pos=s['pos'],
                             own_gp=gp, own_fg=f, rate_adj=rate_adj, leak=leak, h2h_gpg=gpg, p1g=p1g,
                             score=score(p1g, rate_adj, leak, gpg), score_nomodel=score(None, rate_adj, leak, gpg),
                             fg=1 if s['id'] == fg['playerId'] else 0, g1=1 if s['g'] >= 1 else 0, g=s['g']))
    for g in by_date[date]: add_game(g)
t = pd.DataFrame(rows)
t.to_csv(rows_csv.replace('.csv', '-firstgoal.csv'), index=False)
games = t.gameId.nunique()
print(f'=== {label}: {games} games with a first goal, {len(t)} skater-games, {t.score.notna().sum()} scored; {t.p1g.notna().mean()*100:.0f}% of rows have a goal-rate prior ===')
pd.set_option('display.width', 200)

def grade(col, name):
    t['rk'] = t.groupby('gameId')[col].rank(ascending=False, method='first')
    fgr = t[t.fg == 1]
    top1 = t[t.rk == 1]; top3 = t[t.rk <= 3]; top5 = t[t.rk <= 5]
    return dict(ranking=name, first_goal_rank_mean=fgr.rk.mean(), first_goal_rank_median=fgr.rk.median(),
                top1_scores_first=top1.fg.mean(), top3_has_first=top3.groupby('gameId').fg.max().mean(), top5_has_first=top5.groupby('gameId').fg.max().mean(),
                top1_scores_any=top1.g1.mean(), top3_scores_any=top3.g1.mean(), top5_scores_any=top5.g1.mean())
print('\n--- 1. Per game: where the actual first-goal scorer sat in each ranking (about 36 skaters a game; chance = 2.8% top-1, 8.3% top-3, 14% top-5) ---')
t['rand'] = np.random.default_rng(1).random(len(t))
res = [grade('score', '1st goal tab score (goal-rate prior standing in for the model)'), grade('score_nomodel', 'tab score without the model term (own rate + leak + h2h)'),
       grade('rate_adj', 'own first-goal rate alone'), grade('p1g', 'goal-rate prior alone (P(1+ goal))'), grade('leak', 'opponent leak alone'), grade('rand', 'random')]
print(pd.DataFrame(res).to_string(index=False, float_format=lambda v: f'{v:.3f}'))

print('\n--- 2. Score buckets: what the number on the tab is worth ---')
t['bucket'] = pd.cut(t.score, [-1, 19, 29, 39, 49, 59, 69, 100], labels=['0-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70+'])
b = t.groupby('bucket', observed=True).agg(n=('fg', 'size'), scored_first=('fg', 'mean'), scored_any=('g1', 'mean'), goals=('g', 'mean'))
b['first_goal_share_of_all'] = t.groupby('bucket', observed=True).fg.sum() / t.fg.sum()
print(b.to_string(float_format=lambda v: f'{v:.3f}'))

print('\n--- 3. Slate-wide top 10 / top 40 each day (the tab\'s board) ---')
for k in (10, 40):
    t['drk'] = t.groupby('date').score.rank(ascending=False, method='first')
    top = t[t.drk <= k]
    print(f'   top {k:2d}: {len(top)} player-games over {t.date.nunique()} days; scored first {top.fg.mean()*100:.1f}%, scored at all {top.g1.mean()*100:.1f}%; '
          f'the rest of the slate: first {t[t.drk > k].fg.mean()*100:.1f}%, any {t[t.drk > k].g1.mean()*100:.1f}%')

print('\n--- 4. Which part of the score carries it: logistic regression of "scored first" on the four parts (z-scores) ---')
import statsmodels.api as sm
s = t.dropna(subset=['p1g']).copy()
s['own'] = (s.rate_adj / 0.15).clip(0, 1); s['leakn'] = s.leak.clip(0, 2) / 2; s['h2h'] = s.h2h_gpg.clip(0, 1); s['p1gn'] = (s.p1g / 0.45).clip(0, 1)
for target in ('fg', 'g1'):
    m = sm.Logit(s[target], sm.add_constant(s[['p1gn', 'own', 'leakn', 'h2h']].astype(float))).fit(disp=0)
    print(f'   {target}: ' + ', '.join(f'{k} z={m.tvalues[k]:.1f}' for k in ['p1gn', 'own', 'leakn', 'h2h']))
print('\n--- 5. Own first-goal record: does a player who has scored first often keep doing it? (rows with 20+ flagged games) ---')
s2 = t[t.own_gp >= 20].copy(); s2['own_rate'] = s2.own_fg / s2.own_gp
s2['ob'] = pd.cut(s2.own_rate, [-0.01, 0.0, 0.03, 0.06, 0.1, 1], labels=['0', '0-3%', '3-6%', '6-10%', '10%+'])
print(s2.groupby('ob', observed=True).agg(n=('fg', 'size'), scored_first=('fg', 'mean'), scored_any=('g1', 'mean'), goal_rate_prior=('p1g', 'mean')).to_string(float_format=lambda v: f'{v:.3f}'))
print('\n--- 6. Opponent leak: first goals given up to the position at the venue, by ratio to the league ---')
t['lb'] = pd.cut(t.leak, [-1, 0.5, 0.8, 1.2, 1.6, 99], labels=['<0.5', '0.5-0.8', '0.8-1.2', '1.2-1.6', '1.6+'])
print(t.groupby('lb', observed=True).agg(n=('fg', 'size'), scored_first=('fg', 'mean'), scored_any=('g1', 'mean')).to_string(float_format=lambda v: f'{v:.3f}'))

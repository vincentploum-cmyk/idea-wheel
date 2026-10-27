"""The 1st goal tab replayed over a window of slates and graded game by game.

Section 11 of docs/shots-goals-predictors.md graded the tab over whole seasons (firstgoal_grade.py).
This one answers the question "how did the tab do over the last N slates?": it rebuilds the tab's
score (lib/nhl-data/firstgoal.js) leak-free for every skater who dressed in every game of the
window, from the games before each date only, ranks each game's skaters the way the tab does,
and reads where the actual first scorer sat. It needs no rows.csv: the player's blended goal
rate and the shipped formula's goal λ (picks-pure.js, the same code as tonight.py) are built
from the games directly.

The model's 1+ goal odds (the saved runs) are not available offline. Two stand-ins are graded:
  rate   = the player's own goal rate, this season blended into last at n / (n + 40), as P(1+) = 1 - e^-rate
           (what section 5 found the model's goal odds track);
  study  = the shipped formula's goal λ (own blended goals, chances and shots, home ice, back-to-back,
           the opponent's goals allowed per skater at the position blended across the season boundary).
The tab is also scored without the model term (its own fallback formula), and each part alone.

argv: <this season's games dir (relabelled)> <previous season's games dir (relabelled)>
      [--last N] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out prefix]
Writes <prefix>-rows.csv (every skater-game of the season with the tab's parts and scores) and
<prefix>-games.csv (one line a game of the window: the first scorer, his rank, the tab's #1).
"""
import sys, glob, json, math, argparse, warnings
from collections import defaultdict
from datetime import date as D
import numpy as np, pandas as pd
warnings.filterwarnings('ignore')

ap = argparse.ArgumentParser()
ap.add_argument('cur_dir'); ap.add_argument('prev_dir')
ap.add_argument('--last', type=int, default=10, help='the last N slate dates with a game stored')
ap.add_argument('--from', dest='date_from'); ap.add_argument('--to', dest='date_to')
ap.add_argument('--out', default=None, help='output prefix (default: <cur_dir>/../firstgoal-window)')
args = ap.parse_args()
out = args.out or f'{args.cur_dir.rstrip("/")}/../firstgoal-window'

POS = ('C', 'LW', 'RW', 'D')
LEAGUE_FG, SHRINK = 0.028, 20
# The shipped goal formula (lib/nhl-data/picks-pure.js; tools/predictors/tonight.py carries the same numbers).
G = dict(const=-1.0539, g=0.3735, iscf=0.4356, sog=0.4007, home=0.0682, pos=0.4448, b2b=-0.0677)
LEAGUE_POS_G = {'C': 0.23, 'LW': 0.21, 'RW': 0.215, 'D': 0.077}
clamp = lambda v, lo, hi: min(hi, max(lo, v))
lg = lambda v: math.log(max(v, 0.05))
mean = lambda xs: sum(xs) / len(xs) if xs else None

def score(p1g, rate_adj, leak_ratio, h2h_gpg):
    """firstGoalScore in lib/nhl-data/firstgoal.js."""
    own = clamp(rate_adj / 0.15, 0, 1); leak = clamp(leak_ratio, 0, 2) / 2; h2h = clamp(h2h_gpg, 0, 1)
    s = 0.45 * clamp(p1g / 0.45, 0, 1) + 0.30 * own + 0.15 * leak + 0.10 * h2h if p1g is not None else 0.55 * own + 0.30 * leak + 0.15 * h2h
    return round(clamp(s, 0, 1) * 100)

def load(d):
    gs = []
    for f in sorted(glob.glob(f'{d}/*.json')): gs += json.load(open(f))['games']
    return sorted(gs, key=lambda g: (g['date'], g['id']))

cur, prev = load(args.cur_dir), load(args.prev_dir)
dates = sorted({g['date'] for g in cur})
if args.date_from or args.date_to:
    window = [d for d in dates if (not args.date_from or d >= args.date_from) and (not args.date_to or d <= args.date_to)]
else:
    window = dates[-args.last:]
wset = set(window)

# ── state carried forward, game by game (every read on a row comes from games before its date) ──
rec = defaultdict(list)                                  # player → 0/1 per flagged game (both seasons), the tab's own record
h2h = defaultdict(lambda: [0, 0])                        # (player, opp) → [gp, g] (both seasons), the tab's head to head
fga = defaultdict(lambda: defaultdict(lambda: [0, 0]))   # (defending team, its venue) → pos → [games, allowed] (both seasons), the tab's leak
ph, pph = defaultdict(list), defaultdict(list)           # player → his skater rows this season / last season (the rate and the study λ)
oppc = defaultdict(lambda: dict(g=0, n=0, games=set()))  # (defending team, pos) → goals allowed per skater at the position, this season
oppp = defaultdict(lambda: dict(g=0, n=0, games=set()))  # … last season
last = {}                                                # team → date of its last game (back-to-back)

def add_game(g, season):
    fg = g.get('firstGoal') or {}
    scorer = fg.get('playerId')
    for s in g['skaters']:
        if s['pos'] not in POS: continue
        rec[s['id']].append(1 if s['id'] == scorer else 0)
        h = h2h[(s['id'], s['opp'])]; h[0] += 1; h[1] += s['g']
        (ph if season == 'cur' else pph)[s['id']].append(s)
        o = (oppc if season == 'cur' else oppp)[(s['opp'], s['pos'])]; o['g'] += s['g']; o['n'] += 1; o['games'].add(g['id'])
    for side, other in (('home', 'away'), ('away', 'home')):
        dv = 'H' if side == 'home' else 'A'; t = g[side]['abbrev']
        tab = fga[(t, dv)]
        for p in POS + ('All',): tab[p][0] += 1
        if scorer and fg.get('team') == g[other]['abbrev']:
            sp = next((s['pos'] for s in g['skaters'] if s['id'] == scorer), None)
            tab['All'][1] += 1
            if sp in POS: tab[sp][1] += 1
        last[t] = g['date']

def rates(pid):
    """tonight.py's blend: this season into last at n / (n + 40) for goals and chances, n / (n + 18) for shots."""
    c, p = ph.get(pid, []), pph.get(pid, [])
    n = len(c); base = len(p) >= 10
    if not n and not p: return None
    def bl(k, prior):
        if not base: return mean([x[k] for x in c]) if c else mean([x[k] for x in p])
        w = n / (n + prior)
        return w * (mean([x[k] for x in c]) or 0) + (1 - w) * mean([x[k] for x in p])
    return dict(n=n, base=len(p), g=bl('g', 40), iscf=bl('iscf', 40), sog=bl('sog', 18), study_ok=base or n >= 5)

def opp_read(team, pos):
    """The opponent's goals allowed per skater at the position: this season blended into last at games / (games + 40)."""
    c, p = oppc.get((team, pos)), oppp.get((team, pos))
    cg = c['g'] / c['n'] if c and c['n'] else None
    pg = p['g'] / p['n'] if p and p['n'] and len(p['games']) >= 10 else None
    games = len(c['games']) if c else 0
    if cg is None and pg is None: return LEAGUE_POS_G[pos]
    if pg is None: return cg
    if cg is None: return pg
    return (games / (games + 40)) * cg + (40 / (games + 40)) * pg

for g in prev: add_game(g, 'prev')

rows = []
by_date = defaultdict(list)
for g in cur: by_date[g['date']].append(g)
for date in dates:
    # league share of first goals given up at each venue to each position: the mean of the teams' shares (defense.js)
    league = {}
    for dv in 'HA':
        for p in POS:
            shares = [tab[p][1] / tab[p][0] for (t, v), tab in fga.items() if v == dv and tab[p][0]]
            league[(dv, p)] = sum(shares) / len(shares) if shares else None
    for g in by_date[date]:
        fg = g.get('firstGoal') or {}
        if not fg.get('playerId'): continue  # a 0-0 shootout: no first goal to grade
        n_sk = sum(1 for s in g['skaters'] if s['pos'] in POS)
        for s in g['skaters']:
            if s['pos'] not in POS: continue
            r = rec[s['id']][-100:]; gp = len(r); f = sum(r)
            rate_adj = (f + LEAGUE_FG * SHRINK) / (gp + SHRINK)
            dv = 'H' if s['venue'] == 'A' else 'A'
            cell = fga[(s['opp'], dv)][s['pos']]; lgs = league[(dv, s['pos'])]
            leak = (cell[1] / cell[0]) / lgs if cell[0] and lgs else 1.0
            hh = h2h[(s['id'], s['opp'])]; gpg = hh[1] / hh[0] if hh[0] else 0
            rt = rates(s['id'])
            p1g_rate = (1 - math.exp(-rt['g'])) if rt else None
            if rt and rt['study_ok']:
                is_home = 1 if s['venue'] == 'H' else 0
                bb = bool(last.get(s['team'])) and (D.fromisoformat(date) - D.fromisoformat(last[s['team']])).days == 1
                lamG = math.exp(G['const'] + G['g'] * math.log(max(rt['g'], 0) + 0.05) + G['iscf'] * lg(rt['iscf']) + G['sog'] * lg(rt['sog'])
                                + G['home'] * is_home + G['pos'] * math.log(max(opp_read(s['opp'], s['pos']), 0) + 0.1) + G['b2b'] * bb)
                p1g_study = 1 - math.exp(-lamG)
            else:
                lamG, p1g_study = None, p1g_rate
            rows.append(dict(date=date, gameId=g['id'], game=f"{g['away']['abbrev']} @ {g['home']['abbrev']}", id=s['id'], name=s['name'], team=s['team'], opp=s['opp'],
                             venue=s['venue'], pos=s['pos'], n_skaters=n_sk, own_gp=gp, own_fg=f, rate_adj=rate_adj, leak=leak, leak_games=cell[0], h2h_gp=hh[0], h2h_g=hh[1], h2h_gpg=gpg,
                             p1g_rate=p1g_rate, lamG=lamG, p1g_study=p1g_study,
                             score_rate=score(p1g_rate, rate_adj, leak, gpg), score_study=score(p1g_study, rate_adj, leak, gpg), score_nomodel=score(None, rate_adj, leak, gpg),
                             fg=1 if s['id'] == fg['playerId'] else 0, g1=1 if s['g'] >= 1 else 0, g=s['g'], sog=s['sog'],
                             fg_period=fg.get('period') if s['id'] == fg['playerId'] else None, fg_time=fg.get('time') if s['id'] == fg['playerId'] else None))
    for g in by_date[date]: add_game(g, 'cur')

t = pd.DataFrame(rows)
t['rand'] = np.random.default_rng(1).random(len(t))
t['in_window'] = t.date.isin(wset)
t.to_csv(f'{out}-rows.csv', index=False)
pd.set_option('display.width', 220)
F = lambda v: f'{v:.3f}' if isinstance(v, float) else str(v)

RANKINGS = [('score_rate', 'tab score, goal rate for the model term'), ('score_study', 'tab score, shipped λG for the model term'),
            ('score_nomodel', 'tab without the model term (own + leak + h2h)'), ('p1g_rate', 'goal rate alone'), ('p1g_study', 'shipped λG alone'),
            ('rate_adj', 'own first-goal rate alone'), ('leak', 'opponent leak alone'), ('h2h_gpg', 'head to head alone'), ('rand', 'random')]

def rank_in(d, by, col):
    """1 = the highest value of `col` within each `by` group; ties broken at random (the tab breaks them by lineup
    order, the away side's first line first, which can move a game or two), missing values last."""
    order = d.sort_values([col, 'rand'], ascending=[False, False], na_position='last')
    return order.groupby(by).cumcount().add(1).reindex(d.index)

def grade(df, col, name):
    d = df.copy()
    d['rk'] = rank_in(d, 'gameId', col)
    fgr = d[d.fg == 1]
    per_game = d.groupby('gameId')
    top = lambda k: per_game.apply(lambda x: x[x.rk <= k].fg.max(), include_groups=False)
    r1 = d[d.rk == 1]
    return dict(ranking=name, games=d.gameId.nunique(), first_scorer_rank_mean=fgr.rk.mean(), first_scorer_rank_median=fgr.rk.median(),
                top1_scores_first=r1.fg.mean(), top3_has_first=top(3).mean(), top5_has_first=top(5).mean(), top6_has_first=top(6).mean(),
                top1_scores_any=r1.g1.mean(), top3_scores_any=d[d.rk <= 3].g1.mean(), top6_scores_any=d[d.rk <= 6].g1.mean())

def chance(df):
    n = df.groupby('gameId').n_skaters.first()
    return dict(ranking='chance (1 / skaters dressed)', games=len(n), first_scorer_rank_mean=((n + 1) / 2).mean(), first_scorer_rank_median=((n + 1) / 2).median(),
                top1_scores_first=(1 / n).mean(), top3_has_first=(3 / n).mean(), top5_has_first=(5 / n).mean(), top6_has_first=(6 / n).mean(),
                top1_scores_any=df.g1.mean(), top3_scores_any=df.g1.mean(), top6_scores_any=df.g1.mean())

def wilson(k, n, z=1.96):
    if not n: return (0.0, 0.0)
    p = k / n; den = 1 + z * z / n; c = p + z * z / (2 * n); h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return ((c - h) / den, (c + h) / den)

def fair(p):
    return '—' if not (0 < p < 1) else (f'-{round(100 * p / (1 - p))}' if p >= 0.5 else f'+{round(100 * (1 - p) / p)}')

def report(df, label):
    print(f'\n==================== {label}: {df.gameId.nunique()} games on {df.date.nunique()} slates, {len(df)} skater-games, {df.fg.sum()} first goals ====================')
    print(f'   skaters a game: {df.groupby("gameId").n_skaters.first().mean():.1f}; rows with a goal-rate prior {df.p1g_rate.notna().mean()*100:.0f}%, with a study λ {df.lamG.notna().mean()*100:.0f}%')
    print('\n--- 1. Per game: where the actual first scorer sat in each ranking (ties broken at random) ---')
    res = [chance(df)] + [grade(df, c, n) for c, n in RANKINGS]
    print(pd.DataFrame(res).to_string(index=False, float_format=lambda v: f'{v:.3f}'))
    print('\n--- 2. The per-game #1: what a first-goal price has to clear (Wilson 95% interval on the hit rate) ---')
    for col, name in RANKINGS[:2] + RANKINGS[3:5]:
        d = df.copy(); d['rk'] = rank_in(d, 'gameId', col)
        r1 = d[d.rk == 1]; p = r1.fg.mean(); pa = r1.g1.mean()
        lo, hi = wilson(int(r1.fg.sum()), len(r1)); lo2, hi2 = wilson(int(r1.g1.sum()), len(r1))
        print(f'   {name:46s} #1 scored first in {int(r1.fg.sum()):3d} of {len(r1)} ({p*100:4.1f}%, {lo*100:.1f}-{hi*100:.1f}%, break-even {fair(p)}); '
              f'scored at all in {int(r1.g1.sum()):3d} ({pa*100:4.1f}%, {lo2*100:.1f}-{hi2*100:.1f}%, break-even {fair(pa)})')
    # paired: does the tab's score put the first scorer higher than the goal rate alone would?
    d = df.copy()
    for col in ('score_rate', 'p1g_rate', 'score_study', 'p1g_study'): d[f'rk_{col}'] = rank_in(d, 'gameId', col)
    f = d[d.fg == 1]
    for a, b, la, lb in (('score_rate', 'p1g_rate', 'the tab score', 'the goal rate alone'), ('score_study', 'p1g_study', 'the tab score (λG)', 'the shipped λG alone'), ('score_rate', 'score_nomodel', 'the tab score', 'the tab without the model term')):
        if f'rk_{b}' not in d: d[f'rk_{b}'] = rank_in(d, 'gameId', b); f = d[d.fg == 1]
        up = int((f[f'rk_{a}'] < f[f'rk_{b}']).sum()); down = int((f[f'rk_{a}'] > f[f'rk_{b}']).sum()); same = len(f) - up - down
        print(f'   first scorer ranked higher by {la} than by {lb} in {up} games, lower in {down}, the same in {same} (mean rank {f[f"rk_{a}"].mean():.1f} vs {f[f"rk_{b}"].mean():.1f})')
    print('\n--- 3. Score buckets (goal-rate stand-in): what the number on the tab is worth ---')
    d = df.copy(); d['bucket'] = pd.cut(d.score_rate, [-1, 19, 29, 39, 49, 59, 69, 100], labels=['0-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70+'])
    b = d.groupby('bucket', observed=True).agg(n=('fg', 'size'), scored_first=('fg', 'mean'), scored_any=('g1', 'mean'), goals=('g', 'mean'))
    b['share_of_first_goals'] = d.groupby('bucket', observed=True).fg.sum() / max(1, d.fg.sum())
    print(b.to_string(float_format=lambda v: f'{v:.3f}'))
    print('\n--- 4. Slate-wide board (the "Whole slate" view): the top 10 / top 40 each day ---')
    for col, name in RANKINGS[:2] + [RANKINGS[3]]:
        d = df.copy(); d['drk'] = rank_in(d, 'date', col)
        for k in (10, 40):
            top = d[d.drk <= k]; rest = d[d.drk > k]
            print(f'   {name:46s} top {k:2d}: {len(top):4d} player-games; scored first {top.fg.mean()*100:4.1f}% (rest {rest.fg.mean()*100:.1f}%), scored at all {top.g1.mean()*100:4.1f}% (rest {rest.g1.mean()*100:.1f}%)')
    print('\n--- 5. Which part carries it: logistic regression of "scored first" / "scored at all" on the four parts (z-scores) ---')
    try:
        import statsmodels.api as sm
        s = df.dropna(subset=['p1g_rate']).copy()
        s['own'] = (s.rate_adj / 0.15).clip(0, 1); s['leakn'] = s.leak.clip(0, 2) / 2; s['h2h'] = s.h2h_gpg.clip(0, 1); s['p1gn'] = (s.p1g_rate / 0.45).clip(0, 1)
        for target in ('fg', 'g1'):
            m = sm.Logit(s[target], sm.add_constant(s[['p1gn', 'own', 'leakn', 'h2h']].astype(float))).fit(disp=0)
            print(f'   {target}: ' + ', '.join(f'{k} z={m.tvalues[k]:+.1f}' for k in ['p1gn', 'own', 'leakn', 'h2h']) + f'   (n = {len(s)})')
    except Exception as e:
        print('   (statsmodels not available:', e, ')')
    print('\n--- 6. The parts on their own: first-goal rate by own record, by the opponent\'s leak, by the goal-rate prior ---')
    d = df[df.own_gp >= 20].copy(); d['own_rate'] = d.own_fg / d.own_gp
    d['ob'] = pd.cut(d.own_rate, [-0.01, 0.0, 0.03, 0.06, 0.1, 1], labels=['0', '0-3%', '3-6%', '6-10%', '10%+'])
    print('   own first-goal record (20+ flagged games):')
    print(d.groupby('ob', observed=True).agg(n=('fg', 'size'), scored_first=('fg', 'mean'), scored_any=('g1', 'mean'), goal_rate_prior=('p1g_rate', 'mean')).to_string(float_format=lambda v: f'{v:.3f}'))
    d = df.copy(); d['lb'] = pd.cut(d.leak, [-1, 0.5, 0.8, 1.2, 1.6, 99], labels=['<0.5', '0.5-0.8', '0.8-1.2', '1.2-1.6', '1.6+'])
    print('   opponent leak to the position at the venue, ratio to the league:')
    print(d.groupby('lb', observed=True).agg(n=('fg', 'size'), scored_first=('fg', 'mean'), scored_any=('g1', 'mean')).to_string(float_format=lambda v: f'{v:.3f}'))
    d = df.dropna(subset=['p1g_rate']).copy(); d['pb'] = pd.cut(d.p1g_rate, [-1, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 1], labels=['<10%', '10-15', '15-20', '20-25', '25-30', '30-40', '40%+'])
    print('   goal-rate prior P(1+ goal):')
    print(d.groupby('pb', observed=True).agg(n=('fg', 'size'), scored_first=('fg', 'mean'), scored_any=('g1', 'mean'), stated=('p1g_rate', 'mean')).to_string(float_format=lambda v: f'{v:.3f}'))

report(t[t.in_window], f'LAST {len(window)} SLATES ({window[0]} to {window[-1]})')
report(t, f'SEASON TO DATE ({dates[0]} to {dates[-1]})')

# ── the window, game by game ──
print(f'\n==================== Game by game, {window[0]} to {window[-1]} (goal-rate stand-in for the model term) ====================')
w = t[t.in_window].copy()
w['rk'] = rank_in(w, 'gameId', 'score_rate')
w['rk_rate'] = rank_in(w, 'gameId', 'p1g_rate')
w['rk_study'] = rank_in(w, 'gameId', 'score_study')
lines = []
for gid, grp in w.groupby('gameId', sort=False):
    fgr = grp[grp.fg == 1].iloc[0]
    one = grp[grp.rk == 1].iloc[0]
    lines.append(dict(date=fgr.date, game=fgr.game, first_scorer=fgr['name'], team=fgr.team, pos=fgr.pos, period=fgr.fg_period, time=fgr.fg_time,
                      tab_rank=int(fgr.rk), of=int(fgr.n_skaters), tab_score=int(fgr.score_rate), rank_by_rate=int(fgr.rk_rate), rank_by_study=int(fgr.rk_study),
                      tab_no1=one['name'], no1_team=one.team, no1_score=int(one.score_rate), no1_p1g=round(float(one.p1g_rate), 3) if pd.notna(one.p1g_rate) else None,
                      no1_scored_first=int(one.fg), no1_scored=int(one.g1), no1_sog=int(one.sog)))
gl = pd.DataFrame(lines).sort_values(['date', 'game'])
gl.to_csv(f'{out}-games.csv', index=False)
print(gl.to_string(index=False))
print(f'\n   {len(gl)} games: the tab\'s #1 scored first in {gl.no1_scored_first.sum()}, scored at all in {gl.no1_scored.sum()}; '
      f'the first scorer sat in the top 3 in {(gl.tab_rank <= 3).sum()}, the top 5 in {(gl.tab_rank <= 5).sum()}, the top 6 (the By game table) in {(gl.tab_rank <= 6).sum()}, '
      f'the top 10 in {(gl.tab_rank <= 10).sum()}; median rank {gl.tab_rank.median():.0f} of {gl["of"].median():.0f}.')
print(f'   by slate: ' + '; '.join(f'{d} {int(x.no1_scored_first.sum())}/{len(x)} first, {int(x.no1_scored.sum())} scored' for d, x in gl.groupby('date')))
print(f'\nwritten {out}-rows.csv and {out}-games.csv')

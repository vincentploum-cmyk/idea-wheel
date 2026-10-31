"""Special teams and the predicted score, measured on the box scores (Vincent, 2026-10-31: "if a team
allows a lot of penalties, the other team gets a lot of extra minutes on the ice … I bet it has an
impact on shots / goals prediction", and "a predicted score based on all the data available").

Inputs (public, from the NHL API; nothing from the store):
  .nhl-data/pp/<season>/<gameId>.json      the right-rail team game stats: SOG, power plays (goals/opportunities), PIM, the score
  .nhl-data/predictors/<season>/games/*.json  the box scores through the repo's record builder (tools/predictors/fetch.mjs)

  python3 -I tools/audit/nhl_special_teams.py --pp .nhl-data/pp --games .nhl-data/predictors --out .nhl-data/audit/out/nhl-special-teams.md

Every read is leak-free: a team's or a skater's figure before a game uses the games before that date only.
The fit season is 2025-26, the check season 2026-27 (to the day the data was pulled).
"""
import argparse, glob, json, math
from collections import defaultdict
import warnings
import numpy as np, pandas as pd
import statsmodels.api as sm
warnings.filterwarnings('ignore')

ap = argparse.ArgumentParser()
ap.add_argument('--pp', required=True); ap.add_argument('--games', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--fit', default='2025'); ap.add_argument('--check', default='2026')
args = ap.parse_args()
md = []
def line(s=''): md.append(s)
def table(head, rows):
    line('| ' + ' | '.join(head) + ' |'); line('| ' + ' | '.join('---' for _ in head) + ' |')
    for r in rows: line('| ' + ' | '.join(str(x) for x in r) + ' |')
    line()
f2 = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v:.2f}'
f3 = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v:.3f}'
f4 = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v:.4f}'
pct = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{100 * v:.1f}%'

# ------------------------------------------------------------------ the team-games with power plays
def load_pp(season):
    rows = []
    for f in sorted(glob.glob(f'{args.pp}/{season}/*.json')):
        g = json.load(open(f))
        st = g['stats']
        if 'powerPlay' not in st or 'sog' not in st: continue
        pp = {k: [int(x) for x in str(st['powerPlay'][k]).split('/')] for k in ('away', 'home')}
        for side, other, home in (('away', 'home', 0), ('home', 'away', 1)):
            rows.append(dict(season=season, date=g['date'], gid=int(g['id']), team=g[side], opp=g[other], home=home,
                             SF=int(st['sog'][side]), SA=int(st['sog'][other]), GF=int(g['score'][side]), GA=int(g['score'][other]),
                             PPG=pp[side][0], PPO=pp[side][1], PKG=pp[other][0], PKO=pp[other][1], PIM=int(st.get('pim', {}).get(side, 0) or 0),
                             ot=g.get('last') in ('OT', 'SO')))
    return pd.DataFrame(rows).sort_values(['date', 'gid']).reset_index(drop=True)

tg = {s: load_pp(s) for s in (args.fit, args.check)}
line('# Special teams and the predicted score, measured (2026-10-31)'); line()
line(f'Team-games with power-play counts: {args.fit}-{int(args.fit) % 100 + 1}: {len(tg[args.fit])} ({len(tg[args.fit]) // 2} games) · {args.check}-{int(args.check) % 100 + 1}: {len(tg[args.check])} ({len(tg[args.check]) // 2} games).'); line()

# ------------------------------------------------------------------ A. what a power play is worth inside a game
line('## A. Inside a game: what a power play is worth in shots and goals'); line()
line('OLS of a team\'s shots and goals in the game on the power plays it got (PPO) and the power plays it killed (PKO), home ice in. Both seasons pooled.'); line()
both = pd.concat([tg[args.fit], tg[args.check]], ignore_index=True)
def ols(df, y, xs):
    X = sm.add_constant(df[xs].astype(float)); m = sm.OLS(df[y].astype(float), X).fit()
    return m
rows = []
for y, label in (('SF', 'shots'), ('GF', 'goals')):
    m = ols(both, y, ['PPO', 'PKO', 'home'])
    rows.append([label, f2(m.params['const']), f'{f2(m.params["PPO"])} (z {m.tvalues["PPO"]:.1f})', f'{f2(m.params["PKO"])} (z {m.tvalues["PKO"]:.1f})', f'{f2(m.params["home"])} (z {m.tvalues["home"]:.1f})', f3(m.rsquared), len(both)])
table(['Stat', 'Constant', 'Per power play for', 'Per power play killed', 'Home ice', 'R²', 'n'], rows)
WORTH = {'shotsPerPP': ols(both, 'SF', ['PPO', 'PKO', 'home']).params['PPO'], 'shotsPerPK': ols(both, 'SF', ['PPO', 'PKO', 'home']).params['PKO'],
         'goalsPerPP': ols(both, 'GF', ['PPO', 'PKO', 'home']).params['PPO'], 'goalsPerPK': ols(both, 'GF', ['PPO', 'PKO', 'home']).params['PKO']}
ppg_share = both['PPG'].sum() / both['GF'].sum()
line(f'Power-play goals are {pct(ppg_share)} of all goals ({both["PPG"].sum()} of {both["GF"].sum()}); a team gets {f2(both["PPO"].mean())} power plays a game and converts {pct(both["PPG"].sum() / both["PPO"].sum())}.'); line()
line('By the count of power plays a team got, its shots and goals (the raw slope the regression summarises):'); line()
rows = []
for k, grp in both.groupby(pd.cut(both['PPO'], [-1, 1, 2, 3, 4, 5, 20], labels=['0–1', '2', '3', '4', '5', '6+'])):
    if len(grp): rows.append([k, len(grp), f2(grp['SF'].mean()), f2(grp['GF'].mean()), f2(grp['PPG'].mean()), f2(grp['PKO'].mean())])
table(['Power plays got', 'Team-games', 'Shots', 'Goals', 'PP goals', 'Power plays killed'], rows)

# ------------------------------------------------------------------ B. can tonight's power plays be foreseen?
line('## B. Can tonight\'s power plays be foreseen from the two teams\' rates?'); line()
def st_features(df, K):
    """Leak-free season-to-date rates before each game: the team's power plays drawn and given a game, the opponent's,
    the league's to date; each ratio to the league shrunk toward 1 at gp / (gp + K)."""
    hist = defaultdict(lambda: dict(gp=0, ppo=0, pko=0, ppg=0, pkg=0, sf=0, sa=0, gf=0, ga=0))
    lg = dict(gp=0, ppo=0, ppg=0, pkg=0, sf=0, gf=0)
    out = []
    for date, day in df.groupby('date', sort=True):
        for _, r in day.iterrows():
            t, o = hist[r.team], hist[r.opp]
            L_ppo = lg['ppo'] / lg['gp'] if lg['gp'] >= 60 else 3.2
            L_sf = lg['sf'] / lg['gp'] if lg['gp'] >= 60 else 28.0
            L_gf = lg['gf'] / lg['gp'] if lg['gp'] >= 60 else 3.1
            L_conv = lg['ppg'] / lg['ppo'] if lg['ppo'] >= 150 else 0.21
            L_kill = 1 - lg['pkg'] / lg['ppo'] if lg['ppo'] >= 150 else 0.79
            def ratio(num, gp, L):
                if gp == 0: return 1.0
                w = gp / (gp + K)
                return w * (num / gp) / L + (1 - w)
            def rate_pct(made, opps, L, Kp):
                if opps == 0: return 1.0
                w = opps / (opps + Kp)
                return w * (made / opps) / L + (1 - w)
            out.append(dict(
                drawn=ratio(t['ppo'], t['gp'], L_ppo), given=ratio(t['pko'], t['gp'], L_ppo),
                opp_drawn=ratio(o['ppo'], o['gp'], L_ppo), opp_given=ratio(o['pko'], o['gp'], L_ppo),
                own_sf=ratio(t['sf'], t['gp'], L_sf), opp_sa=ratio(o['sa'], o['gp'], L_sf),
                own_gf=ratio(t['gf'], t['gp'], L_gf), opp_ga=ratio(o['ga'], o['gp'], L_gf),
                own_conv=rate_pct(t['ppg'], t['ppo'], L_conv, 40), opp_kill_leak=rate_pct(o['pkg'], o['pko'], 1 - L_kill, 40),
                gp=t['gp'], opp_gp=o['gp'], L_ppo=L_ppo, L_sf=L_sf, L_gf=L_gf, L_conv=L_conv,
            ))
        for _, r in day.iterrows():
            t = hist[r.team]; t['gp'] += 1; t['ppo'] += r.PPO; t['pko'] += r.PKO; t['ppg'] += r.PPG; t['pkg'] += r.PKG; t['sf'] += r.SF; t['sa'] += r.SA; t['gf'] += r.GF; t['ga'] += r.GA
            lg['gp'] += 1; lg['ppo'] += r.PPO; lg['ppg'] += r.PPG; lg['pkg'] += r.PKG; lg['sf'] += r.SF; lg['gf'] += r.GF
    return pd.concat([df.reset_index(drop=True), pd.DataFrame(out)], axis=1)

def poisson(df, y, xs, offset=None):
    X = sm.add_constant(df[xs].astype(float))
    m = sm.GLM(df[y].astype(float), X, family=sm.families.Poisson(), offset=offset).fit()
    return m
def deviance_on(m, df, y, xs, offset=None):
    X = sm.add_constant(df[xs].astype(float), has_constant='add')
    mu = m.predict(X, offset=offset)
    yv = df[y].astype(float).values
    return float(np.mean(2 * (np.where(yv > 0, yv * np.log(yv / mu), 0) - (yv - mu))))

line('Poisson regression of a team\'s power plays tonight on log(its drawn rate / league) and log(the opponent\'s given rate / league), season to date before the game, both ratios shrunk toward 1 at gp / (gp + K). Fitted on the fit season from each team\'s 6th game; the check season scored with the fit season\'s coefficients. Deviance per team-game, lower is better; the constant-only read is the league rate.'); line()
rows = []; best = None
for K in (0, 5, 10, 20, 40):
    fit = st_features(tg[args.fit], K); fit = fit[(fit.gp >= 5) & (fit.opp_gp >= 5)]
    chk = st_features(tg[args.check], K); chk = chk[(chk.gp >= 5) & (chk.opp_gp >= 5)]
    for df in (fit, chk):
        for c in ('drawn', 'given', 'opp_drawn', 'opp_given', 'own_sf', 'opp_sa', 'own_gf', 'opp_ga', 'own_conv', 'opp_kill_leak'): df['l_' + c] = np.log(df[c].clip(lower=0.2))
    m = poisson(fit, 'PPO', ['l_drawn', 'l_opp_given', 'home'])
    m0 = poisson(fit, 'PPO', ['home'])
    dfit = deviance_on(m, fit, 'PPO', ['l_drawn', 'l_opp_given', 'home']); d0fit = deviance_on(m0, fit, 'PPO', ['home'])
    dchk = deviance_on(m, chk, 'PPO', ['l_drawn', 'l_opp_given', 'home']) if len(chk) else float('nan'); d0chk = deviance_on(m0, chk, 'PPO', ['home']) if len(chk) else float('nan')
    rows.append([K, f'{f2(m.params["l_drawn"])} (z {m.tvalues["l_drawn"]:.1f})', f'{f2(m.params["l_opp_given"])} (z {m.tvalues["l_opp_given"]:.1f})', f'{f2(m.params["home"])} (z {m.tvalues["home"]:.1f})', f4(dfit), f4(d0fit), f4(dchk), f4(d0chk), len(fit), len(chk)])
    if best is None or dchk < best[0]: best = (dchk, K, m)
table(['K', 'Elasticity: own drawn', 'Elasticity: opponent gives', 'Home', 'Deviance fit', 'league only', 'Deviance check', 'league only', 'n fit', 'n check'], rows)
K_BEST = best[1]; ST_FIT = best[2]
line(f'Kept: K = {K_BEST} (the lowest check-season deviance), elasticities own drawn {f2(ST_FIT.params["l_drawn"])}, opponent gives {f2(ST_FIT.params["l_opp_given"])}.'); line()

# Split-half persistence of the two rates in the fit season.
line('How stable the two rates are: each team\'s odd-numbered games against its even-numbered games over the fit season (a trait correlates; noise does not).'); line()
rows = []
d = tg[args.fit].copy(); d['k'] = d.groupby('team').cumcount()
for col, label in (('PPO', 'power plays drawn a game'), ('PKO', 'power plays given a game'), ('SF', 'shots a game'), ('SA', 'shots allowed a game'), ('GF', 'goals a game'), ('GA', 'goals allowed a game')):
    a = d[d.k % 2 == 0].groupby('team')[col].mean(); b = d[d.k % 2 == 1].groupby('team')[col].mean()
    rows.append([label, f3(a.corr(b)), f2(d.groupby('team')[col].mean().std())])
for col, label in (('PPG/PPO', 'power-play conversion'), ('PKG/PKO', 'penalty-kill leak (goals allowed per kill)')):
    num, den = col.split('/')
    a = d[d.k % 2 == 0].groupby('team').apply(lambda x: x[num].sum() / max(1, x[den].sum())); b = d[d.k % 2 == 1].groupby('team').apply(lambda x: x[num].sum() / max(1, x[den].sum()))
    rows.append([label, f3(a.corr(b)), f3(d.groupby('team').apply(lambda x: x[num].sum() / max(1, x[den].sum())).std())])
table(['Rate', 'Odd / even games correlation', 'Spread across teams (SD)'], rows)

# ------------------------------------------------------------------ C. does the opponent's discipline move a team's shots and goals beyond the usual reads?
line('## C. On top of the usual reads: does the opponent\'s discipline move a team\'s shots and goals?'); line()
line('Poisson regression of a team\'s shots (goals) in the game on its own rate, what the opponent allows, home ice, then the special-teams reads: the opponent\'s power plays given (the team\'s extra power plays), the opponent\'s power plays drawn (the team\'s extra kills), and for goals the opponent\'s penalty-kill leak (goals allowed per kill, shrunk toward the league at 40 kills). Season-to-date reads shrunk at K = ' + str(K_BEST) + ', from each team\'s 6th game. Fitted on the fit season, scored on the check season.'); line()
fit = st_features(tg[args.fit], K_BEST); fit = fit[(fit.gp >= 5) & (fit.opp_gp >= 5)].copy()
chk = st_features(tg[args.check], K_BEST); chk = chk[(chk.gp >= 5) & (chk.opp_gp >= 5)].copy()
A_DRAWN = float(ST_FIT.params['l_drawn']); B_GIVEN = float(ST_FIT.params['l_opp_given'])
def mech(df):
    """The mechanical special-teams factor: the power plays the forecast adds over the team's usual (and the kills), × what one is worth
    inside a game (section A), over the team's usual shots / goals a game."""
    pp_exp = df['L_ppo'] * df['drawn'] ** A_DRAWN * df['opp_given'] ** B_GIVEN
    pk_exp = df['L_ppo'] * df['given'] ** A_DRAWN * df['opp_drawn'] ** B_GIVEN
    # The usual is the same forecast against an average opponent, so the difference is the opponent's part alone (the site's rule).
    d_pp = pp_exp - df['L_ppo'] * df['drawn'] ** A_DRAWN; d_pk = pk_exp - df['L_ppo'] * df['given'] ** A_DRAWN
    df['stf_shots'] = 1 + (d_pp * WORTH['shotsPerPP'] + d_pk * WORTH['shotsPerPK']) / (df['L_sf'] * df['own_sf'])
    # Goals: the extra power plays at the league's conversion, every power play tonight through the opponent's kill leak, the kills at their cost.
    df['stf_goals'] = 1 + (pp_exp * df['L_conv'] * df['opp_kill_leak'] - df['L_ppo'] * df['drawn'] ** A_DRAWN * df['L_conv'] + d_pk * WORTH['goalsPerPK']) / (df['L_gf'] * df['own_gf'])
    df['l_stf_shots'] = np.log(df['stf_shots'].clip(lower=0.5)); df['l_stf_goals'] = np.log(df['stf_goals'].clip(lower=0.5))
for df in (fit, chk):
    for c in ('drawn', 'given', 'opp_drawn', 'opp_given', 'own_sf', 'opp_sa', 'own_gf', 'opp_ga', 'own_conv', 'opp_kill_leak'): df['l_' + c] = np.log(df[c].clip(lower=0.2))
    mech(df)
line(f'The mechanical factor (`stf`): the power plays the forecast (section B) adds over the team\'s usual, × a power play\'s worth inside a game (section A), over the team\'s usual shots; a coefficient of 1 on its log says the mechanics are the right size, 0 that nothing of it shows. Its spread across team-games: shots SD {fit["stf_shots"].std():.4f} (min {fit["stf_shots"].min():.3f}, max {fit["stf_shots"].max():.3f}), goals SD {fit["stf_goals"].std():.4f}.'); line()
specs = {
    'shots: own × allowed': ('SF', ['l_own_sf', 'l_opp_sa', 'home']),
    'shots: + opponent gives power plays': ('SF', ['l_own_sf', 'l_opp_sa', 'home', 'l_opp_given']),
    'shots: + opponent gives and draws': ('SF', ['l_own_sf', 'l_opp_sa', 'home', 'l_opp_given', 'l_opp_drawn']),
    'shots: + the mechanical factor': ('SF', ['l_own_sf', 'l_opp_sa', 'home', 'l_stf_shots']),
    'goals: own × allowed': ('GF', ['l_own_gf', 'l_opp_ga', 'home']),
    'goals: + opponent gives power plays': ('GF', ['l_own_gf', 'l_opp_ga', 'home', 'l_opp_given']),
    'goals: + opponent gives, draws, kill leak': ('GF', ['l_own_gf', 'l_opp_ga', 'home', 'l_opp_given', 'l_opp_drawn', 'l_opp_kill_leak']),
    'goals: + the mechanical factor': ('GF', ['l_own_gf', 'l_opp_ga', 'home', 'l_stf_goals']),
}
rows = []; FITS = {}
for name, (y, xs) in specs.items():
    m = poisson(fit, y, xs); FITS[name] = m
    coef = ' · '.join(f'{(k[2:] if k.startswith("l_") else k)} {m.params[k]:.3f} (z {m.tvalues[k]:.1f})' for k in xs)
    rows.append([name, coef, f4(deviance_on(m, fit, y, xs)), f4(deviance_on(m, chk, y, xs)) if len(chk) else '—'])
table(['Read', 'Coefficients', 'Deviance fit', 'Deviance check'], rows)
# The size of the effect at the extremes seen this season.
m = FITS['shots: + opponent gives and draws']
line(f'Size: with the opponent giving power plays at 1.25× the league (the most undisciplined teams this season sit near 1.3×), a team\'s shots read ×{math.exp(m.params["l_opp_given"] * math.log(1.25)):.3f}; at 0.8× (the most disciplined) ×{math.exp(m.params["l_opp_given"] * math.log(0.8)):.3f}. The opponent drawing 1.25× the league\'s power plays (so the team kills more): ×{math.exp(m.params["l_opp_drawn"] * math.log(1.25)):.3f}.'); line()
mg = FITS['goals: + opponent gives, draws, kill leak']
line(f'Goals: the opponent giving 1.25× the power plays ×{math.exp(mg.params["l_opp_given"] * math.log(1.25)):.3f}; a kill leaking goals at 1.25× the league\'s rate ×{math.exp(mg.params["l_opp_kill_leak"] * math.log(1.25)):.3f}.'); line()
key = lambda k: k[2:] if k.startswith('l_') else k
ST_COEF = {'shots': {key(k): round(float(m.params[k]), 4) for k in m.params.index}, 'goals': {key(k): round(float(mg.params[k]), 4) for k in mg.params.index}}

# ------------------------------------------------------------------ D. the predicted score
line('## D. The predicted score: each team\'s goals tonight'); line()
POS = ['C', 'LW', 'RW', 'D']
LEAGUE_POS = {'C': 0.23, 'LW': 0.21, 'RW': 0.215, 'D': 0.077}
GOALS_FIT = dict(const=-1.0539, g=0.3735, iscf=0.4356, sog=0.4007, home=0.0682, pos=0.4448, b2b=-0.0677)
def lg_(v): return math.log(max(v, 0.05))

def load_games(season):
    games = []
    for f in sorted(glob.glob(f'{args.games}/{season}/games/*.json')): games += json.load(open(f))['games']
    return sorted(games, key=lambda g: (g['date'], g['id']))

def study_team_goals(games, prev_games):
    """Σ over the dressed skaters of the study's λ goals (picks-pure.js `project`, the goals half), leak-free: his rates this
    season from his fifth game (last season's regular season standing in with 10+ games), the opponent's goals allowed per
    skater at his position this season (last season's until its first game), home ice, back-to-back; the goal rate shrunk to
    the league's at his position at n / (n + 8). A skater without a base counts the league figure at his position. Returns
    { (gid, team): Σλ }."""
    prev = defaultdict(list)
    for g in prev_games:
        for s in g['skaters']:
            if s['pos'] in POS: prev[s['id']].append(s)
    prevPos = defaultdict(lambda: defaultdict(lambda: [0.0, 0]))
    for g in prev_games:
        for s in g['skaters']:
            if s['pos'] in POS: prevPos[s['opp']][s['pos']][0] += s['g']; prevPos[s['opp']][s['pos']][1] += 1
    cur = defaultdict(list); curPos = defaultdict(lambda: defaultdict(lambda: [0.0, 0])); last = {}
    out = {}
    by_date = defaultdict(list)
    for g in games: by_date[g['date']].append(g)
    def mean(rows, k): return sum(r[k] for r in rows) / len(rows) if rows else 0.0
    for date in sorted(by_date):
        for g in by_date[date]:
            for team, opp, home in ((g['away']['abbrev'], g['home']['abbrev'], 0), (g['home']['abbrev'], g['away']['abbrev'], 1)):
                lam = 0.0
                dprev = (pd.Timestamp(date) - pd.Timedelta(days=1)).strftime('%Y-%m-%d')
                b2b = 1 if last.get(team) == dprev else 0
                for s in g['skaters']:
                    if s['team'] != team or s['pos'] not in POS: continue
                    c = cur.get(s['id'], []); p = prev.get(s['id'], [])
                    n = len(c); league = LEAGUE_POS[s['pos']]
                    if n < 5 and len(p) < 10:
                        lam += league; continue
                    held = n < 5; use = p if held else c
                    rg, riscf, rsog = mean(use, 'g'), mean(use, 'iscf'), mean(use, 'sog')
                    wG = 1.0 if held or n == 0 else n / (n + 8)
                    gRate = wG * max(rg, 0) + (1 - wG) * league
                    cp = curPos[opp][s['pos']]; pp = prevPos[opp][s['pos']]
                    posG = cp[0] / cp[1] if cp[1] else (pp[0] / pp[1] if pp[1] else league)
                    lam += math.exp(GOALS_FIT['const'] + GOALS_FIT['g'] * math.log(gRate + 0.05) + GOALS_FIT['iscf'] * lg_(riscf) + GOALS_FIT['sog'] * lg_(rsog) + GOALS_FIT['home'] * home + GOALS_FIT['pos'] * math.log(max(posG, 0) + 0.1) + GOALS_FIT['b2b'] * b2b)
                out[(g['id'], team)] = lam
        for g in by_date[date]:
            for s in g['skaters']:
                if s['pos'] not in POS: continue
                cur[s['id']].append(s); curPos[s['opp']][s['pos']][0] += s['g']; curPos[s['opp']][s['pos']][1] += 1
            last[g['away']['abbrev']] = date; last[g['home']['abbrev']] = date
    return out

games_fit = load_games(args.fit); games_chk = load_games(args.check)
line(f'Skater box scores: {len(games_fit)} games {args.fit}-{int(args.fit) % 100 + 1}, {len(games_chk)} games {args.check}-{int(args.check) % 100 + 1}.'); line()
sum_fit = study_team_goals(games_fit, []); sum_chk = study_team_goals(games_chk, games_fit)
fit['study'] = [sum_fit.get((r.gid, r.team), np.nan) for r in fit.itertuples()]
chk['study'] = [sum_chk.get((r.gid, r.team), np.nan) for r in chk.itertuples()]
fit = fit.dropna(subset=['study']).copy(); chk = chk.dropna(subset=['study']).copy()
fit['l_study'] = np.log(fit['study'].clip(lower=0.3)); chk['l_study'] = np.log(chk['study'].clip(lower=0.3))

def grade(df, pred, label):
    err = df[pred] - df['GF']
    # Poisson log score and the win call: the two λ of a game → P(team wins) by a Poisson race, ties split half and half.
    ll = float(np.mean(df['GF'] * np.log(df[pred].clip(lower=0.05)) - df[pred]))
    return [label, len(df), f2(df[pred].mean()), f2(df['GF'].mean()), f'{err.mean():+.3f}', f3(err.abs().mean()), f3(np.sqrt((err ** 2).mean())), f4(-ll)]

def win_prob(lam_a, lam_b, kmax=12):
    pa = [math.exp(-lam_a) * lam_a ** k / math.factorial(k) for k in range(kmax)]
    pb = [math.exp(-lam_b) * lam_b ** k / math.factorial(k) for k in range(kmax)]
    win = sum(pa[i] * pb[j] for i in range(kmax) for j in range(kmax) if i > j); tie = sum(pa[i] * pb[i] for i in range(kmax))
    return win + tie / 2

def game_grade(df, pred, label):
    """Per game: the total's error and the win call, the home side's λ against the away side's."""
    h = df[df.home == 1].set_index('gid'); a = df[df.home == 0].set_index('gid')
    idx = h.index.intersection(a.index)
    tot = h.loc[idx, pred] + a.loc[idx, pred]; act = h.loc[idx, 'GF'] + a.loc[idx, 'GF']
    p = np.array([win_prob(h.loc[i, pred], a.loc[i, pred]) for i in idx]); won = (h.loc[idx, 'GF'] > a.loc[idx, 'GF']).astype(float).values
    called = np.where(p >= 0.5, won, 1 - won).mean()
    return [label, len(idx), f2(tot.mean()), f2(act.mean()), f'{(tot - act).mean():+.3f}', f3((tot - act).abs().mean()), pct(called), f4(np.mean((p - won) ** 2)), pct(p.mean()), pct(won.mean())]

# The candidates, fitted on the fit season where they have parameters.
cands = {}
cands['league'] = (lambda df: df['L_gf'] * np.exp(0.0) , 'The league\'s goals a game to date')
m_team = poisson(fit, 'GF', ['l_own_gf', 'l_opp_ga', 'home'])
m_team_st = FITS['goals: + opponent gives, draws, kill leak']
m_study = poisson(fit, 'GF', ['l_study'])
m_study_h = poisson(fit, 'GF', ['l_study', 'home'])
m_blend = poisson(fit, 'GF', ['l_study', 'l_own_gf', 'l_opp_ga', 'home'])
m_blend_st = poisson(fit, 'GF', ['l_study', 'l_own_gf', 'l_opp_ga', 'home', 'l_opp_given', 'l_opp_drawn', 'l_opp_kill_leak'])
m_blend_mech = poisson(fit, 'GF', ['l_study', 'l_own_gf', 'l_opp_ga', 'home', 'l_stf_goals'])
m_study_team = poisson(fit, 'GF', ['l_study', 'l_own_gf', 'l_opp_ga'])
def pred(m, xs):
    return lambda df: m.predict(sm.add_constant(df[xs].astype(float), has_constant='add'))
cands['gfga'] = (lambda df: df['L_gf'] * df['own_gf'] * df['opp_ga'] * np.where(df.home == 1, 1.03, 0.97), 'Own goals × opponent\'s allowed / league, ±3% home ice (the plain read)')
cands['team'] = (pred(m_team, ['l_own_gf', 'l_opp_ga', 'home']), f'The team layer fitted: own goals^{m_team.params["l_own_gf"]:.2f} × allowed^{m_team.params["l_opp_ga"]:.2f}, home {math.exp(m_team.params["home"]) - 1:+.1%}')
cands['team_st'] = (pred(m_team_st, ['l_own_gf', 'l_opp_ga', 'home', 'l_opp_given', 'l_opp_drawn', 'l_opp_kill_leak']), 'The team layer with the special-teams reads')
cands['study'] = (lambda df: df['study'], 'Σ of the skaters\' study λ goals (the board\'s goals read, summed over the dressed skaters)')
cands['study_fit'] = (pred(m_study, ['l_study']), f'Σ study λ rescaled: × exp({m_study.params["const"]:.3f}) ^{m_study.params["l_study"]:.2f}')
cands['blend'] = (pred(m_blend, ['l_study', 'l_own_gf', 'l_opp_ga', 'home']), f'Σ study λ^{m_blend.params["l_study"]:.2f} × own goals^{m_blend.params["l_own_gf"]:.2f} × allowed^{m_blend.params["l_opp_ga"]:.2f}, home {math.exp(m_blend.params["home"]) - 1:+.1%}')
cands['blend_st'] = (pred(m_blend_st, ['l_study', 'l_own_gf', 'l_opp_ga', 'home', 'l_opp_given', 'l_opp_drawn', 'l_opp_kill_leak']), 'The blend with the special-teams reads')
cands['blend_mech'] = (pred(m_blend_mech, ['l_study', 'l_own_gf', 'l_opp_ga', 'home', 'l_stf_goals']), 'The blend with the mechanical special-teams factor')
cands['study_team'] = (pred(m_study_team, ['l_study', 'l_own_gf', 'l_opp_ga']), f'Σ study λ^{m_study_team.params["l_study"]:.2f} × own goals^{m_study_team.params["l_own_gf"]:.2f} × allowed^{m_study_team.params["l_opp_ga"]:.2f} (no home term: the skaters’ λ carry home ice)')
line('Each team-game\'s goals against every read, from each team\'s 6th game. Bias = projected − actual; the Poisson log score is −mean(y log λ − λ), lower is better. The parameters are fitted on the fit season; the check season is scored with them unchanged.'); line()
for season_label, df in ((f'{args.fit}-{int(args.fit) % 100 + 1} (fit)', fit), (f'{args.check}-{int(args.check) % 100 + 1} (check)', chk)):
    if not len(df): continue
    line(f'### {season_label}: per team'); line()
    rows = []
    for k, (fn, label) in cands.items():
        df[k] = np.asarray(fn(df)); rows.append(grade(df, k, label))
    table(['Read', 'Team-games', 'Projected', 'Actual', 'Bias', 'MAE', 'RMSE', 'Poisson log score'], rows)
    line(f'### {season_label}: per game (the total and the winner)'); line()
    rows = [game_grade(df, k, cands[k][1]) for k in cands]
    table(['Read', 'Games', 'Projected total', 'Actual', 'Bias', 'MAE total', 'Winner called', 'Brier (home win)', 'Home win said', 'Home won'], rows)
line('### The blend\'s coefficients'); line()
for name, m in (('study alone', m_study), ('study + home', m_study_h), ('study + team reads', m_study_team), ('blend', m_blend), ('blend + special teams', m_blend_st), ('blend + mechanical factor', m_blend_mech)):
    line(f'- {name}: ' + ', '.join(f'{key(k)} {m.params[k]:.4f} (z {m.tvalues[k]:.1f})' for k in m.params.index))
line()
line('### For the site (JSON)'); line()
line('```json')
line(json.dumps({'K': K_BEST, 'ppElasticity': {'drawn': round(float(ST_FIT.params['l_drawn']), 4), 'opponentGives': round(float(ST_FIT.params['l_opp_given']), 4)},
                 'worth': {k: round(float(v), 4) for k, v in WORTH.items()}, 'ppGoalShare': round(float(ppg_share), 4),
                 'teamCoef': ST_COEF,
                 'blend': {key(k): round(float(v), 4) for k, v in m_blend.params.items()},
                 'blendSt': {key(k): round(float(v), 4) for k, v in m_blend_st.params.items()},
                 'blendMech': {key(k): round(float(v), 4) for k, v in m_blend_mech.params.items()},
                 'studyTeam': {key(k): round(float(v), 4) for k, v in m_study_team.params.items()},
                 'mechCoef': {'shots': round(float(FITS['shots: + the mechanical factor'].params['l_stf_shots']), 4), 'goals': round(float(FITS['goals: + the mechanical factor'].params['l_stf_goals']), 4)},
                 'teamSt': {key(k): round(float(v), 4) for k, v in m_team_st.params.items()},
                 'team': {key(k): round(float(v), 4) for k, v in m_team.params.items()}}, indent=1))
line('```')
open(args.out, 'w').write('\n'.join(md) + '\n')
print('\n'.join(md))

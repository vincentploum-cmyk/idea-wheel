"""Tonight's best shots and goals pick per game, from the study's rules: the skater's own rate
(this season blended with his previous-season base at n / (n + 18) for shots, n / (n + 40) for
goals), this season's shot attempts, home ice, and the opponent's shots allowed this season
(team total and to the position). Poisson rates are fitted on the previous full season's rows
(the control, with the same leak-free features) and applied to tonight's skaters. Lineup =
the skaters who dressed in each team's last game (scratches and injuries since are not known).
argv: <control rows -envsrc.csv> <this season's games dir (played positions)> <moneypuck skaters csv of last season> <schedule json> <date>
"""
import sys, glob, json, math, warnings
from collections import defaultdict
import numpy as np, pandas as pd, statsmodels.api as sm
from scipy import stats
warnings.filterwarnings('ignore')
ctl_csv, games_dir, mp_csv, sched_json, date = sys.argv[1:6]
POS = ('C', 'LW', 'RW', 'D')

# ---- fit on the control
c = pd.read_csv(ctl_csv)
n = c.n_prior.fillna(0); w = n / (n + 18); wg = n / (n + 40)
c['bl_sog'] = np.where(c.p_sog_avg.notna(), w * c.p_sog_avg.fillna(0) + (1 - w) * c.ls_sog_pg, c.ls_sog_pg)
c['bl_icf'] = np.where(c.p_icf_avg.notna(), w * c.p_icf_avg.fillna(0) + (1 - w) * c.ls_icf_pg, c.ls_icf_pg)
c['bl_g'] = np.where(c.p_g_avg.notna(), wg * c.p_g_avg.fillna(0) + (1 - wg) * c.ls_g_pg, c.ls_g_pg)
S_COLS = ['bl_sog', 'bl_icf', 'home', 'team_std_sog', 'std_all_sog']
G_COLS = ['bl_g', 'ls_xg_pg', 'bl_sog', 'home']
cs = c.dropna(subset=S_COLS + ['sog']); ms = sm.GLM(cs.sog.astype(float), sm.add_constant(cs[S_COLS].astype(float)), family=sm.families.Poisson()).fit()
cg = c.dropna(subset=G_COLS + ['g']); mg = sm.GLM(cg.g.astype(float), sm.add_constant(cg[G_COLS].astype(float)), family=sm.families.Poisson()).fit()

# ---- last season's priors
mp = pd.read_csv(mp_csv); mp = mp[(mp.situation == 'all') & (mp.games_played >= 10)]
ls = {int(r.playerId): dict(ls_sog_pg=r.I_F_shotsOnGoal / r.games_played, ls_icf_pg=r.I_F_shotAttempts / r.games_played, ls_g_pg=r.I_F_goals / r.games_played, ls_xg_pg=r.I_F_xGoals / r.games_played) for r in mp.itertuples()}

# ---- this season so far
games = []
for f in sorted(glob.glob(f'{games_dir}/*.json')): games += json.load(open(f))['games']
games.sort(key=lambda g: (g['date'], g['id']))
ph = defaultdict(list); last_dressed = {}; team_sa = defaultdict(list); pos_sa = defaultdict(list)
for g in games:
    if g['date'] >= date: continue
    for side, other in (('home', 'away'), ('away', 'home')):
        t = g[side]['abbrev']; team_sa[t].append(g[other]['sog'])
        last_dressed[t] = [s for s in g['skaters'] if s['team'] == t and s['pos'] in POS]
        tot = {p: 0 for p in POS}
        for s in g['skaters']:
            if s['opp'] == t and s['pos'] in POS: tot[s['pos']] += s['sog']
        for p in POS: pos_sa[(t, p)].append(tot[p])
    for s in g['skaters']:
        if s['pos'] in POS: ph[s['id']].append(s)
lg_pos = {p: np.mean([v for (t, q), vs in pos_sa.items() if q == p for v in vs]) for p in POS}
lg_team = np.mean([v for vs in team_sa.values() for v in vs])
def rank_of(vals, v): return 1 + sum(1 for x in vals if x > v)

sched = json.load(open(sched_json))
day = next(d for d in sched['gameWeek'] if d['date'] == date)
fair = lambda p: (f'-{round(100 * p / (1 - p))}' if p >= 0.5 else f'+{round(100 * (1 - p) / p)}')
out = []
for gm in day['games']:
    if gm['gameType'] != 2: continue
    away, home = gm['awayTeam']['abbrev'], gm['homeTeam']['abbrev']
    for team, opp, is_home in ((away, home, 0), (home, away, 1)):
        for s in last_dressed.get(team, []):
            h = ph[s['id']]; nn = len(h); pr = ls.get(s['id'])
            if not pr: continue
            p_sog = np.mean([x['sog'] for x in h]); p_icf = np.mean([x['icf'] for x in h]); p_g = np.mean([x['g'] for x in h])
            w = nn / (nn + 18); wg = nn / (nn + 40)
            bl_sog = w * p_sog + (1 - w) * pr['ls_sog_pg']; bl_icf = w * p_icf + (1 - w) * pr['ls_icf_pg']; bl_g = wg * p_g + (1 - wg) * pr['ls_g_pg']
            team_std = np.mean(team_sa[opp]); std_all = np.mean(pos_sa[(opp, s['pos'])])
            lam_s = float(ms.predict(pd.DataFrame([dict(const=1, bl_sog=bl_sog, bl_icf=bl_icf, home=is_home, team_std_sog=team_std, std_all_sog=std_all)]))[0])
            lam_g = float(mg.predict(pd.DataFrame([dict(const=1, bl_g=bl_g, ls_xg_pg=pr['ls_xg_pg'], bl_sog=bl_sog, home=is_home)]))[0])
            prank = rank_of([np.mean(v) for (t, q), v in pos_sa.items() if q == s['pos']], std_all)
            trank = rank_of([np.mean(v) for v in team_sa.values()], team_std)
            out.append(dict(game=f'{away} @ {home}', team=team, opp=opp, name=s['name'], pos=s['pos'], gp=nn, sog_ts=round(p_sog, 2), sog_ls=round(pr['ls_sog_pg'], 2), lam_s=round(lam_s, 2),
                            p2=1 - stats.poisson.cdf(1, lam_s), p3=1 - stats.poisson.cdf(2, lam_s), p4=1 - stats.poisson.cdf(3, lam_s),
                            g_ts=round(p_g, 2), g_ls=round(pr['ls_g_pg'], 2), lam_g=round(lam_g, 2), p1g=1 - math.exp(-lam_g),
                            opp_pos_rank=prank, opp_team_rank=trank))
t = pd.DataFrame(out)
t.to_csv(f'.nhl-data/predictors/picks-{date}.csv', index=False)
pd.set_option('display.width', 220)
print(f'Shots model (control fit): ' + ', '.join(f'{k} {ms.params[k]:+.3f}' for k in S_COLS))
print(f'Goals model (control fit): ' + ', '.join(f'{k} {mg.params[k]:+.3f}' for k in G_COLS))
print(f'league this season: {lg_team:.1f} shots allowed a game; per position ' + ', '.join(f'{p} {v:.1f}' for p, v in lg_pos.items()))
for game, grp in t.groupby('game', sort=False):
    print(f'\n=== {game} ===')
    sh = grp.sort_values('p3', ascending=False)
    top = sh[(sh.p3 >= 0.5) | (sh.p3 >= sh.p3.max() - 0.001)]
    print('  SHOTS  (P(3+) 50%+, else the best):')
    for r in top.itertuples():
        print(f'    {r.name:22s} {r.team} {r.pos:2s}  λ {r.lam_s:.2f}  2+ {r.p2*100:4.0f}% ({fair(r.p2)})  3+ {r.p3*100:4.0f}% ({fair(r.p3)})  4+ {r.p4*100:4.0f}% ({fair(r.p4)})   this season {r.sog_ts:.2f}/g in {r.gp}, base {r.sog_ls:.2f}  opp allows #{r.opp_pos_rank} to {r.pos}, #{r.opp_team_rank} overall')
    nxt = sh[~sh.index.isin(top.index)].head(3)
    print('    next: ' + '; '.join(f'{r.name} 3+ {r.p3*100:.0f}%' for r in nxt.itertuples()))
    go = grp.sort_values('p1g', ascending=False)
    topg = go[(go.p1g >= 0.35) | (go.p1g >= go.p1g.max() - 0.001)]
    print('  GOALS  (P(1+) 35%+, else the best):')
    for r in topg.itertuples():
        print(f'    {r.name:22s} {r.team} {r.pos:2s}  λ {r.lam_g:.2f}  1+ goal {r.p1g*100:4.0f}% ({fair(r.p1g)})   this season {r.g_ts:.2f}/g in {r.gp}, base {r.g_ls:.2f}')
    nxtg = go[~go.index.isin(topg.index)].head(3)
    print('    next: ' + '; '.join(f'{r.name} {r.p1g*100:.0f}%' for r in nxtg.itertuples()))

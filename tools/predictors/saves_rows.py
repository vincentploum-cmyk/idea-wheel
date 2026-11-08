"""The saves study's rows: one per starting goalie per game, every feature from games dated strictly before it.

Reads the games fetch.mjs pulled (one JSON a date, lib/nhl-data/game.js's record) for one or more seasons,
oldest first, and writes one CSV row per starter:

  what he got   sv, sa, ga, toi, pulled (left a regulation game before 50 minutes), ot, team_sa (every
                goalie's shots against: what the team allowed), opp_sog
  his own       g_starts, g_sv_ps (saves a start this season), g_sv_l5 / g_sv_l10, g_sa_ps, g_pct (raw save %),
                g_pct_shr (toward the league at shots / (shots + 150), the site's shrunkSv), g_ls_pct / g_ls_sv_ps
                (last season), g_pull_rate (his starts left early this season and last)
  his team      t_sa (shots allowed a game: season, l5, l10, l20, venue), t_ca / t_fa / t_sca / t_hdca (attempts,
                unblocked, chances, high-danger chances against), t_pim, t_gd (goal difference a game), t_ls_sa
  the opponent  o_sf (shots a game: season, l5, l10, l20, venue), o_cf / o_ff / o_scf / o_hdcf, o_pim, o_gd,
                o_ls_sf, o_sh_pct (its shooting %)
  the night     home, b2b / o_b2b, rest / o_rest, arena (the home rink's recorded-shots index from the home
                team's games at home against away, last season and this to date, shrunk), lg_sf (the league's
                shots a team a game to date), t_games / o_games
  blends        t_sa_bl / o_sf_bl: this season into last at games / (games + 10)

Usage: python3 -I tools/predictors/saves_rows.py <out.csv> <games dir> [<games dir> ...]   (oldest season first)
"""
import glob
import json
import os
import sys

import numpy as np
import pandas as pd

out_csv, dirs = sys.argv[1], sys.argv[2:]
SV_K = 150
BLEND_K = 10
ARENA_K = 20  # games at home before the arena's own index counts half


def season_of(date):
    y, m = int(date[:4]), int(date[5:7])
    return y if m >= 8 else y - 1


teams, goalies = [], []
for d in dirs:
    for f in sorted(glob.glob(os.path.join(d, '*.json'))):
        for g in json.load(open(f))['games']:
            if g.get('gameType') != 2:
                continue
            ot = g.get('lastPeriodType') not in (None, 'REG')
            sk = pd.DataFrame(g['skaters']) if g['skaters'] else None
            for side, other in (('home', 'away'), ('away', 'home')):
                ab, op = g[side]['abbrev'], g[other]['abbrev']
                me = sk[sk.team == ab] if sk is not None else None
                them = sk[sk.team == op] if sk is not None else None
                s = lambda df, k: float(df[k].sum()) if df is not None and len(df) else np.nan
                gl = [x for x in g['goalies'] if x['team'] == ab]
                rec = dict(date=g['date'], season=season_of(g['date']), gameId=g['id'], team=ab, opp=op,
                           home=int(side == 'home'), arena=g['home']['abbrev'], ot=int(ot),
                           sf=g[side]['sog'], sa=g[other]['sog'], gf=g[side]['score'], ga=g[other]['score'],
                           cf=s(me, 'icf'), ca=s(them, 'icf'), ff=s(me, 'iff'), fa=s(them, 'iff'),
                           scf=s(me, 'iscf'), sca=s(them, 'iscf'), hdcf=s(me, 'ihdcf'), hdca=s(them, 'ihdcf'),
                           pim=s(me, 'pim'), opim=s(them, 'pim'), gsa=sum(x['sa'] for x in gl))
                teams.append(rec)
                st = [x for x in gl if x['starter']]
                if st:
                    x = st[0]
                    goalies.append(dict(date=g['date'], season=rec['season'], gameId=g['id'], team=ab, opp=op,
                                        gid=x['id'], name=x['name'], sv=x['sv'], sa=x['sa'], ga=x['ga'], toi=x['toi'],
                                        pulled=int(x['toi'] < 50 and not ot and x['toi'] < 58), ot=int(ot),
                                        relief=int(any(y['toi'] > 0 and not y['starter'] for y in gl))))

T = pd.DataFrame(teams).sort_values(['date', 'gameId']).reset_index(drop=True)
G = pd.DataFrame(goalies).sort_values(['date', 'gameId']).reset_index(drop=True)
T['gd'] = T.gf - T.ga


def prior_means(df, keys, cols, windows, prefix):
    """Per team-season, the mean of each column over the games strictly before (season and the last n)."""
    out = pd.DataFrame(index=df.index)
    grp = df.groupby(keys, sort=False)
    for c in cols:
        sh = grp[c].shift(1)
        g2 = sh.groupby([df[k] for k in keys])
        out[f'{prefix}{c}'] = g2.transform(lambda s: s.expanding().mean())
        for w in windows:
            out[f'{prefix}{c}_l{w}'] = g2.transform(lambda s: s.rolling(w, min_periods=1).mean())
    out[f'{prefix}games'] = grp.cumcount()
    return out


cols = ['sf', 'sa', 'cf', 'ca', 'ff', 'fa', 'scf', 'sca', 'hdcf', 'hdca', 'pim', 'opim', 'gd', 'gf', 'ga']
P = prior_means(T, ['team', 'season'], cols, [5, 10, 20], 'p_')
T = pd.concat([T, P], axis=1)
# venue split: the team's earlier games at the same venue this season
V = prior_means(T, ['team', 'season', 'home'], ['sf', 'sa'], [5], 'v_')
T['v_sf'], T['v_sa'], T['v_games'] = V['v_sf'], V['v_sa'], V['v_games']
# rest
T['dt'] = pd.to_datetime(T.date)
T['rest'] = T.groupby(['team', 'season']).dt.diff().dt.days
T['b2b'] = (T.rest == 1).astype(int)
# last season's full figures
LS = T.groupby(['team', 'season'])[['sf', 'sa', 'gd']].mean().reset_index()
LS['season'] += 1
LS = LS.rename(columns={'sf': 'ls_sf', 'sa': 'ls_sa', 'gd': 'ls_gd'})
T = T.merge(LS, on=['team', 'season'], how='left')
# the league's shots a team a game before the date (this season)
day = T.groupby(['season', 'date']).sf.agg(['sum', 'count']).reset_index()
day['cs'] = day.groupby('season')['sum'].cumsum() - day['sum']
day['cn'] = day.groupby('season')['count'].cumsum() - day['count']
day['lg_sf'] = day.cs / day.cn.replace(0, np.nan)
T = T.merge(day[['season', 'date', 'lg_sf']], on=['season', 'date'], how='left')
LG = T.groupby('season').sf.mean().rename('lg_ls_sf').reset_index()
LG['season'] += 1
T = T.merge(LG, on='season', how='left')
T['lg_sf'] = T.lg_sf.fillna(T.lg_ls_sf)

# Arena index: a home team's games at home, the shots both sides were credited with against the same two
# teams' figures on the road (their road sf + sa), last season's and this season's earlier games, shrunk.
T = T.sort_values(['date', 'gameId']).reset_index(drop=True)
road = {}
arena_acc = {}  # arena -> list of (date, ratio)
arena_idx = np.full(len(T), np.nan)
games_seen = set()
by_game = {gid: grp for gid, grp in T.groupby('gameId')}
for date, day_rows in T.groupby('date', sort=True):
    # read before the day's games
    for i, r in day_rows.iterrows():
        acc = arena_acc.get(r.arena, [])
        acc = [a for a in acc if a[0] >= f'{season_of(date) - 1}-08-01']
        n = len(acc)
        val = np.mean([a[1] for a in acc]) if n else 1.0
        arena_idx[i] = (val * n + 1.0 * ARENA_K) / (n + ARENA_K)
    # then fold the day in
    for gid in day_rows.gameId.unique():
        g = by_game[gid]
        h = g[g.home == 1].iloc[0]
        a = g[g.home == 0].iloc[0]
        tot = h.sf + h.sa
        # expected total: the home team's road games (sf+sa) and the away team's road games, averaged
        rh, ra = road.get(h.team, []), road.get(a.team, [])
        rh = [x for x in rh if x[0] >= f'{season_of(date) - 1}-08-01']
        ra = [x for x in ra if x[0] >= f'{season_of(date) - 1}-08-01']
        if len(rh) >= 5 and len(ra) >= 5:
            exp = (np.mean([x[1] for x in rh]) + np.mean([x[1] for x in ra])) / 2
            arena_acc.setdefault(h.arena, []).append((date, tot / exp))
        road.setdefault(a.team, []).append((date, a.sf + a.sa))
T['arena_idx'] = arena_idx

# Goalie history
G = G.sort_values(['date', 'gameId']).reset_index(drop=True)
gg = G.groupby(['gid', 'season'], sort=False)
for c in ['sv', 'sa', 'ga', 'pulled']:
    sh = gg[c].shift(1)
    G[f'g_{c}_ps'] = sh.groupby([G.gid, G.season]).transform(lambda s: s.expanding().mean())
    G[f'g_{c}_l5'] = sh.groupby([G.gid, G.season]).transform(lambda s: s.rolling(5, min_periods=1).mean())
    G[f'g_{c}_l10'] = sh.groupby([G.gid, G.season]).transform(lambda s: s.rolling(10, min_periods=1).mean())
    G[f'g_{c}_cum'] = sh.groupby([G.gid, G.season]).transform(lambda s: s.expanding().sum())
G['g_starts'] = gg.cumcount()
G['g_pct'] = G.g_sv_cum / G.g_sa_cum
GLS = G.groupby(['gid', 'season']).agg(ls_sv=('sv', 'sum'), ls_sa=('sa', 'sum'), ls_starts=('sv', 'size'), ls_svps=('sv', 'mean'), ls_pull=('pulled', 'mean')).reset_index()
GLS['season'] += 1
G = G.merge(GLS, on=['gid', 'season'], how='left')
G['g_ls_pct'] = G.ls_sv / G.ls_sa
lg = T.groupby('season').apply(lambda d: 1 - d.ga.sum() / d.sa.sum(), include_groups=False).rename('lg_pct_season')
G['lg_pct'] = 0.900
# prior: last season's figure toward the league; then this season's toward that prior
prior = ((G.ls_sv.fillna(0) + 0.900 * SV_K) / (G.ls_sa.fillna(0) + SV_K))
G['g_prior_pct'] = prior
G['g_pct_shr'] = (G.g_sv_cum.fillna(0) + 0.900 * SV_K) / (G.g_sa_cum.fillna(0) + SV_K)  # the site's read
G['g_pct_shr2'] = (G.g_sv_cum.fillna(0) + prior * SV_K) / (G.g_sa_cum.fillna(0) + SV_K)  # toward his own last season

# join the team (his) and the opponent's priors
keep = ['gameId', 'team', 'home', 'arena', 'ot', 'sa', 'sf', 'b2b', 'rest', 'arena_idx', 'lg_sf', 'ls_sf', 'ls_sa', 'ls_gd', 'v_sf', 'v_sa', 'v_games', 'gsa'] + list(P.columns)
TT = T[keep].rename(columns={'sa': 'team_sa_box', 'sf': 'team_sf_box'})
mine = TT.add_prefix('t_').rename(columns={'t_gameId': 'gameId', 't_team': 'team'})
theirs = TT.add_prefix('o_').rename(columns={'o_gameId': 'gameId', 'o_team': 'opp'})
R = G.merge(mine, on=['gameId', 'team']).merge(theirs, on=['gameId', 'opp'])
R = R.rename(columns={'t_home': 'home', 't_arena': 'arena', 't_arena_idx': 'arena_idx', 't_lg_sf': 'lg_sf', 't_gsa': 'team_sa'})
R['opp_sog'] = R['t_team_sa_box']
R['t_sa_bl'] = (R.t_p_sa * R.t_p_games + R.t_ls_sa.fillna(R.lg_sf) * BLEND_K) / (R.t_p_games + BLEND_K)
R['o_sf_bl'] = (R.o_p_sf * R.o_p_games + R.o_ls_sf.fillna(R.lg_sf) * BLEND_K) / (R.o_p_games + BLEND_K)
R.loc[R.t_p_games == 0, 't_sa_bl'] = R.t_ls_sa.fillna(R.lg_sf)
R.loc[R.o_p_games == 0, 'o_sf_bl'] = R.o_ls_sf.fillna(R.lg_sf)
R.to_csv(out_csv, index=False)
print(f'{len(R)} starter rows, {R.season.nunique()} seasons -> {out_csv}')

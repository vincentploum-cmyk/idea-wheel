"""Soft spots: do skaters shoot more against the defenses that allow the most shots to their position?

Every skater-game (8+ games into his season) from the games fetch.mjs pulled, oldest season first. Each defending
team's shots allowed to a position over its last 10 games (5 at least, the box score's position, PropFinder's L10
shape: the position's total a game) ranked across the league on the morning of the game, rank 1 = allows the most.
Against his own rate (0.6 × his season + 0.4 × his last ten, before the date) and its Poisson 3+ / 4+ chances, by
the opponent's rank band: shots got ÷ his rate, 3+ / 4+ expected and landed; for every skater, left wings, and
left wings under 2.2 shots a game (Marchment's kind). docs/audits/2026-11-10-nhl-soft-spots.md.

Usage: python3 -I tools/predictors/soft_spots.py <games dir> [<games dir> ...]   (oldest season first)
"""
import glob
import json
import os
import sys

import numpy as np
import pandas as pd
from scipy import stats

rows = []
for d in sys.argv[1:]:
    for f in sorted(glob.glob(os.path.join(d, '*.json'))):
        for g in json.load(open(f))['games']:
            if g.get('gameType') != 2:
                continue
            y, m = int(g['date'][:4]), int(g['date'][5:7])
            season = y if m >= 8 else y - 1
            for s in g['skaters']:
                rows.append((g['date'], season, g['id'], s['id'], s['team'], s['opp'], s['pos'], s['sog']))
S = pd.DataFrame(rows, columns=['date', 'season', 'gid', 'pid', 'team', 'opp', 'pos', 'sog']).sort_values(['date', 'gid']).reset_index(drop=True)
g = S.groupby(['pid', 'season'])
S['n'] = g.cumcount()
sh = g.sog.shift(1).groupby([S.pid, S.season])
S['sog_s'] = sh.transform(lambda s: s.expanding().mean())
S['sog_l10'] = sh.transform(lambda s: s.rolling(10, min_periods=1).mean())

# Each defending team's shots allowed to a position a game, its last ten (5+) as of each morning, ranked.
P = S.groupby(['season', 'date', 'gid', 'opp', 'pos']).sog.sum().reset_index().sort_values(['date', 'gid'])
P['l10_after'] = P.groupby(['season', 'opp', 'pos']).sog.transform(lambda s: s.rolling(10, min_periods=5).mean())
out = []
for (season, pos), grp in P.groupby(['season', 'pos']):
    latest = {}
    for date, day in grp.groupby('date', sort=True):
        vals = {t: v for t, v in latest.items() if v == v}
        order = sorted(vals, key=lambda t: -vals[t])
        rank = {t: i + 1 for i, t in enumerate(order)}
        for r in day.itertuples():
            out.append((r.gid, r.opp, pos, rank.get(r.opp), len(order)))
        for r in day.itertuples():
            latest[r.opp] = r.l10_after
R = pd.DataFrame(out, columns=['gid', 'opp', 'pos', 'opp_rank', 'nteams'])
D = S.merge(R, on=['gid', 'opp', 'pos'])
D = D[(D.n >= 8) & D.opp_rank.notna() & (D.nteams >= 25)].copy()
D['own'] = 0.6 * D.sog_s + 0.4 * D.sog_l10
D['p3'] = 1 - stats.poisson.cdf(2, D.own)
D['p4'] = 1 - stats.poisson.cdf(3, D.own)
D['y3'] = (D.sog >= 3).astype(int)
D['y4'] = (D.sog >= 4).astype(int)
D['band'] = pd.cut(D.opp_rank, [0, 3, 5, 10, 22, 27, 32], labels=['1-3 most', '4-5', '6-10', '11-22', '23-27', '28-32 fewest'])

print(f'# Soft spots: {len(D)} skater-games, seasons {sorted(D.season.unique())}\n')
for name, d in (('every skater', D), ('left wings', D[D.pos == 'LW']), ('left wings under 2.2 shots a game', D[(D.pos == 'LW') & (D.own < 2.2)])):
    t = d.groupby('band', observed=True).agg(n=('y3', 'size'), own=('own', 'mean'), got=('sog', 'mean'), said3=('p3', 'mean'), got3=('y3', 'mean'), said4=('p4', 'mean'), got4=('y4', 'mean'))
    t['got_over_own'] = t.got / t.own
    print(f'## {name}\n')
    print(t.round(3).to_string())
    print()
per_night = D.groupby('date').size().mean()
top = D[D.opp_rank <= 5].groupby('date').size().mean()
print(f'A night: {per_night:.0f} skaters with 8+ games, {top:.0f} of them against a top-5 defense at their position.')

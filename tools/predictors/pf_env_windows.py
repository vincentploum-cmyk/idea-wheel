# Which window of the opponent's environment predicts best this season: shots / goals / ISCF allowed over its last
# 5, 10, 15 games or its season to date, at the skater's PropFinder position and for the team as a whole, rebuilt from
# the box scores with PropFinder's position labels (the export stores the Season table only). Each skater-game is set
# against his own PropFinder season rate (5+ GP); each window is scored as (1) a multiplier (opp / league)^b, b fitted
# on the first half of the dates and scored on the second (Poisson deviance saved over no environment), and (2) the
# green / amber / red split its rank gives (1-11 / 12-22 / 23-32), on the rows where the opponent has 15+ games so
# every window is full. python3 -I tools/predictors/pf_env_windows.py <study export json> <this season games dir>
import json, glob, os, sys, math
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(__file__))
from pf_allows import build, norm

WINDOWS = [('L5', 5), ('L10', 10), ('L15', 15), ('Season', None)]


def load(d):
    rows = []
    for f in sorted(glob.glob(os.path.join(d, '*.json'))):
        for g in json.load(open(f))['games']:
            if g.get('gameType') != 2: continue
            for s in g['skaters']:
                rows.append(dict(gid=g['id'], date=g['date'], pid=s['id'], name=s['name'], key=norm(s['name']), last=norm(s['name'].split(' ')[-1]),
                                 team=s['team'], opp=s['opp'], venue=s['venue'], pos=s['pos'], toi=s['toi'], sog=s['sog'], g=s['g'], iscf=s.get('iscf', 0)))
    return pd.DataFrame(rows)


def env_table(R, pos_of):
    """Per (defending team, game): what it allowed, total and by PropFinder position, per game."""
    R = R.assign(ppos=[pos_of.get((g, p), b) for g, p, b in zip(R.gid, R.pid, R.pos)])
    tot = R.groupby(['opp', 'gid', 'date'])[['sog', 'g', 'iscf']].sum().reset_index().assign(ppos='All')
    byp = R.groupby(['opp', 'ppos', 'gid', 'date'])[['sog', 'g', 'iscf']].sum().reset_index()
    games = tot[['opp', 'gid', 'date']]
    full = []
    for p in ['C', 'LW', 'RW', 'D']:   # a game where nobody at the position shot still counts as 0
        x = games.merge(byp[byp.ppos == p], on=['opp', 'gid', 'date'], how='left').fillna({'sog': 0, 'g': 0, 'iscf': 0}).assign(ppos=p)
        full.append(x)
    return pd.concat([tot] + full).sort_values('date')


def reads(E, dates):
    """For each morning: every team's per-game figure per window and slot, its rank among the teams (1 = the most)."""
    out = {}
    for d in dates:
        prior = E[E.date < d]
        for (team, ppos), s in prior.groupby(['opp', 'ppos']):
            gp = len(s)
            for wl, n in WINDOWS:
                t = s.tail(n) if n else s
                out[(d, team, ppos, wl)] = (gp, t.sog.mean(), t.g.mean(), t.iscf.mean())
    df = pd.DataFrame([(d, t, p, w, *v) for (d, t, p, w), v in out.items()], columns=['date', 'team', 'ppos', 'win', 'gp', 'sog', 'g', 'iscf'])
    for m in ['sog', 'g', 'iscf']:
        df[f'{m}_rank'] = df.groupby(['date', 'ppos', 'win'])[m].rank(ascending=False, method='min')
        df[f'{m}_lg'] = df.groupby(['date', 'ppos', 'win'])[m].transform('mean')
    return df


def dev(y, lam):
    lam = np.clip(lam, 1e-4, None)
    return 2 * np.sum(np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / lam), 0) - (y - lam))


def third(r, n=32):
    return np.where(r <= math.ceil(n / 3), 'green', np.where(r > n - math.floor(n / 3), 'red', 'amber'))


if __name__ == '__main__':
    export = json.load(open(sys.argv[1])); R = load(sys.argv[2])
    S = build(export, R)
    S = S[S.pf_season_sog.notna() & (S.pf_season_gp.fillna(0) >= 5)].copy()
    pos_of = {(g, p): pp for g, p, pp in zip(S.gid, S.pid, S.pf_pos)}
    E = env_table(R, pos_of)
    Rd = reads(E, sorted(S.date.unique()))
    S['pf_pos'] = S.pf_pos.where(S.pf_pos.isin(['C', 'LW', 'RW', 'D']), 'C')
    split = sorted(S.date.unique())[len(S.date.unique()) // 2]
    print(f'{len(S)} skater-games with a PropFinder season rate (5+ GP); fit before {split}, scored from it')
    for metric, base, lab in [('sog', 'pf_season_sog', 'SHOTS'), ('g', 'pf_season_g', 'GOALS (by goals allowed)'), ('iscf', 'pf_season_g', 'GOALS (by ISCF allowed)')]:
        y_col = 'g' if metric in ('g', 'iscf') else 'sog'
        print(f'\n=================== {lab} ===================')
        for slot in ['pos', 'all']:
            print(f'-- the opponent {"at his position" if slot == "pos" else "as a team (All)"}')
            print(f"{'window':7} {'rows':>5} {'b':>5} {'dev saved (2nd half)':>21} | opp 15+ games: {'green':>6} {'amber':>6} {'red':>6} {'green-red':>9}")
            for wl, _ in WINDOWS:
                key = S.pf_pos if slot == 'pos' else 'All'
                X = S.assign(ppos=key, win=wl).merge(Rd, left_on=['date', 'opp', 'ppos', 'win'], right_on=['date', 'team', 'ppos', 'win'], how='inner', suffixes=('', '_o'))
                X = X[(X.gp >= 5) & (X[f'{metric}_lg'] > 0)]
                X['x'] = np.log((X[metric + '_o' if metric + '_o' in X else metric] + 0.01) / (X[f'{metric}_lg'] + 0.01))
                y = X[y_col].values; b0 = X[base].clip(lower=0.01).values
                fit = (X.date < split).values; te = ~fit
                grid = np.linspace(-0.5, 2.0, 101)
                bb = grid[np.argmin([dev(y[fit], b0[fit] * np.exp(b * X.x.values[fit])) for b in grid])]
                saved = dev(y[te], b0[te]) - dev(y[te], b0[te] * np.exp(bb * X.x.values[te]))
                F = X[X.gp >= 15]
                F = F.assign(t=third(F[f'{metric}_rank'].values))
                r = {t: F[F.t == t][y_col].sum() / F[F.t == t][base].sum() for t in ['green', 'amber', 'red']}
                print(f"{wl:7} {len(X):5d} {bb:5.2f} {saved:21.1f} | {len(F):13d}  {r['green']:6.3f} {r['amber']:6.3f} {r['red']:6.3f} {r['green'] - r['red']:+9.3f}")

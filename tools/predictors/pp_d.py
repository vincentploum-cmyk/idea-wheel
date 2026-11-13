"""Do defensemen shoot more against kills that give their power-play shots to defensemen?

Every defenseman's skater-game (8+ games into his season) from the relabelled games, with what he shot. Leak-free reads
from the games before the date, this season only: his own rate (0.6 x season + 0.4 x last ten, as soft_spots.py), his
power-play shots on goal a game (from pp_shots.mjs: does he play the power play), and the opponent's kill: power-play
SOG allowed a game, the share of them defensemen took, and power-play SOG allowed to defensemen a game (both at once),
over its games so far (10 at least). Each read enters a Poisson GLM with his rate as the offset (5-fold CV by date,
gain per 1,000 skater-games, bootstrap over dates), for every defenseman and for the power-play ones; then 3+ / 2+ SOG
landed against the Poisson expectation by the read's third, and the same for his power-play shots alone.
Usage: python3 -I tools/predictors/pp_d.py <games-pos dir> <pp_shots.csv> [<games-pos dir> <pp_shots.csv> ...]
"""
import glob, json, os, sys
import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats

rng = np.random.default_rng(11)
S, A = [], []
args = sys.argv[1:]
for gdir, csv in zip(args[0::2], args[1::2]):
    for f in sorted(glob.glob(os.path.join(gdir, '*.json'))):
        for g in json.load(open(f))['games']:
            if g.get('gameType') != 2:
                continue
            for s in g['skaters']:
                S.append((g['date'], g['id'], s['id'], s['team'], s['opp'], {'L': 'LW', 'R': 'RW'}.get(s['pos'], s['pos']), s['sog'], s['toi']))
    a = pd.read_csv(csv)
    A.append(a[(a.strength == 'pp') & (a.type == 'sog')])
S = pd.DataFrame(S, columns=['date', 'gid', 'pid', 'team', 'opp', 'pos', 'sog', 'toi'])
S['date'] = pd.to_datetime(S.date)
S['season'] = np.where(S.date.dt.month >= 8, S.date.dt.year, S.date.dt.year - 1)
A = pd.concat(A)
pp = A.groupby(['gameId', 'shooterId']).size().rename('ppsog')
S = S.join(pp, on=['gid', 'pid']).fillna({'ppsog': 0}).sort_values(['date', 'gid']).reset_index(drop=True)

g = S.groupby(['pid', 'season'])
S['n'] = g.cumcount()
sh = g.sog.shift(1).groupby([S.pid, S.season])
S['rate'] = 0.6 * sh.transform(lambda s: s.expanding().mean()) + 0.4 * sh.transform(lambda s: s.rolling(10, min_periods=1).mean())
S['own_pp'] = g.ppsog.shift(1).groupby([S.pid, S.season]).transform(lambda s: s.expanding().mean())

# The kill: per defending team and game, PP SOG allowed in all and to D; season to date before each game.
K = S.groupby(['season', 'date', 'gid', 'opp']).agg(pp=('ppsog', 'sum')).join(
    S[S.pos == 'D'].groupby(['season', 'date', 'gid', 'opp']).ppsog.sum().rename('ppd')).fillna(0).reset_index().sort_values(['date', 'gid'])
kg = K.groupby(['season', 'opp'])
K['k_n'] = kg.cumcount()
for c in ['pp', 'ppd']:
    K[f'k_{c}'] = kg[c].transform(lambda s: s.shift(1).expanding().sum())
K['k_pp_g'] = K.k_pp / K.k_n
K['k_ppd_g'] = K.k_ppd / K.k_n
K['k_share'] = K.k_ppd / K.k_pp
D = S[(S.pos == 'D') & (S.n >= 8)].merge(K[['gid', 'opp', 'k_n', 'k_pp_g', 'k_ppd_g', 'k_share']], on=['gid', 'opp'])
D = D[(D.k_n >= 10) & (D.rate > 0)].dropna(subset=['rate', 'own_pp', 'k_share']).copy()
# Each read as its rank among the teams that morning would be the site's; here a z-score of the value over the rows.
for c in ['k_pp_g', 'k_share', 'k_ppd_g']:
    D[f'z_{c}'] = (D[c] - D[c].mean()) / D[c].std()
D['pp_role'] = D.own_pp >= 0.25   # about one power-play shot every four games or more: he plays the power play
print(f'{len(D):,} defenseman-games ({D.pp_role.sum():,} by power-play defensemen, own PP SOG 0.25+ a game), seasons {sorted(D.season.unique())}')
print(f'PP defensemen: {D[D.pp_role].pid.nunique()} players, mean own PP SOG {D[D.pp_role].own_pp.mean():.2f} a game; others {D[~D.pp_role].own_pp.mean():.2f}')


def cv(df, y, off, feats, folds=5):
    dates = df.date.unique(); fo = dict(zip(dates, rng.permutation(len(dates)) % folds)); fold = df.date.map(fo).values
    X = sm.add_constant(df[feats].values, has_constant='add') if feats else np.ones((len(df), 1))
    mu = np.empty(len(df)); co = []
    for k in range(folds):
        tr, te = fold != k, fold == k
        fit = sm.GLM(y[tr], X[tr], family=sm.families.Poisson(), offset=off[tr]).fit()
        mu[te] = np.exp(X[te] @ fit.params + off[te]); co.append(fit.params)
    with np.errstate(divide='ignore', invalid='ignore'):
        dev = 2 * (np.where(y > 0, y * np.log(y / mu), 0) - (y - mu))
    return dev, np.mean(co, axis=0)


def ladder(df, label):
    y, off = df.sog.values, np.log(df.rate.values)
    base, _ = cv(df, y, off, [])
    ud = np.unique(df.date.values); idx = {d: np.where(df.date.values == d)[0] for d in ud}; cnt = np.array([len(idx[d]) for d in ud])
    print(f'\n{label}: {len(df):,} games. Deviance gain on his SOG over his own rate, per 1,000 (5-fold CV by date, 95% bootstrap):')
    for name, f in [('kill: PP SOG allowed a game', ['z_k_pp_g']), ('kill: share of them to D', ['z_k_share']), ('kill: PP SOG allowed to D a game', ['z_k_ppd_g'])]:
        dev, co = cv(df, y, off, f); diff = base - dev
        per = np.array([diff[idx[d]].sum() for d in ud])
        b = [per[s].sum() / cnt[s].sum() * 1000 for s in (rng.integers(0, len(ud), len(ud)) for _ in range(400))]
        print(f'  {name:<36} {diff.mean() * 1000:7.2f}  [{np.percentile(b, 2.5):6.2f}, {np.percentile(b, 97.5):6.2f}]   x{np.exp(co[1]):.3f} per SD')


def thirds(df, label, col='k_ppd_g'):
    t = pd.qcut(df[col], 3, labels=['low', 'mid', 'high'])
    print(f'\n{label}, by the kill\'s PP SOG allowed to D a game (thirds of the rows):')
    for b in ['high', 'mid', 'low']:
        x = df[t == b]
        e3 = (1 - stats.poisson.cdf(2, x.rate)).mean(); e2 = (1 - stats.poisson.cdf(1, x.rate)).mean()
        print(f'  {b:<5} ({x[col].min():.2f}-{x[col].max():.2f}) n {len(x):>6,}  SOG x{x.sog.sum() / x.rate.sum():.3f} his rate · 2+ {(x.sog >= 2).mean():.1%} vs {e2:.1%} · 3+ {(x.sog >= 3).mean():.1%} vs {e3:.1%} · his PP SOG {x.ppsog.mean():.2f} (own {x.own_pp.mean():.2f})')


ladder(D, 'Every defenseman')
ladder(D[D.pp_role], 'Power-play defensemen')
ladder(D[~D.pp_role], 'Other defensemen')
thirds(D[D.pp_role], 'Power-play defensemen')
thirds(D[~D.pp_role], 'Other defensemen')

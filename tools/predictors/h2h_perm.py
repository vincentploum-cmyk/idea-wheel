"""Permutation test for cross-season H2H. Real: last-season goals/game vs tonight's opponent,
added to the player's last-season rate vs everyone else. Null: shuffle which opponent each of
the player's last-season games was against (keeps his rate, kills any matchup effect), refit.
argv: prev rows csv, cur rows csv, n permutations"""
import sys, numpy as np, pandas as pd, statsmodels.api as sm, warnings
warnings.filterwarnings('ignore'); np.random.seed(11)
prev = pd.read_csv(sys.argv[1]); cur = pd.read_csv(sys.argv[2]); NP = int(sys.argv[3])
ov = prev.groupby('playerId').agg(pgp=('g', 'size'), pgsum=('g', 'sum'), psog=('sog', 'mean')).reset_index()
ov = ov[ov.pgp >= 20]
prev = prev[prev.playerId.isin(ov.playerId)].copy()
cur = cur.merge(ov, on='playerId')

def stat(prev_df):
    h = prev_df.groupby(['playerId', 'opp']).agg(hn=('g', 'size'), hg=('g', 'sum')).reset_index()
    d = cur.merge(h, on=['playerId', 'opp'])
    d['hgpg'] = d.hg / d.hn
    d['pg_ex'] = (d.pgsum - d.hg) / (d.pgp - d.hn)
    X = sm.add_constant(d[['pg_ex', 'hgpg']].astype(float)); m = sm.GLM(d.g.astype(float), X, family=sm.families.Poisson()).fit()
    X0 = sm.add_constant(d[['pg_ex']].astype(float)); m0 = sm.GLM(d.g.astype(float), X0, family=sm.families.Poisson()).fit()
    hot = d[d.hg >= 3]
    return dict(n=len(d), coef=m.params['hgpg'], z=m.tvalues['hgpg'], dgain=m0.deviance - m.deviance,
                hot_n=len(hot), hot_p1=hot.g1.mean(), hot_exp=(1 - np.exp(-hot.pg_ex)).mean())
real = stat(prev)
print('REAL   ', {k: round(float(v), 3) for k, v in real.items()})
null = []
for i in range(NP):
    p = prev.copy()
    p['opp'] = p.groupby('playerId')['opp'].transform(lambda s: np.random.permutation(s.values))
    null.append(stat(p))
null = pd.DataFrame(null)
print('NULL   coef mean %.3f sd %.3f | z mean %.2f sd %.2f | deviance gain mean %.1f, 95th pct %.1f' % (null.coef.mean(), null.coef.std(), null.z.mean(), null.z.std(), null.dgain.mean(), null.dgain.quantile(.95)))
print('p-value (share of shuffles with a deviance gain >= real): %.3f' % (null.dgain >= real['dgain']).mean())
print('p-value on the coefficient: %.3f' % (null.coef >= real['coef']).mean())
print('hot (3+ goals vs opp last season): real P(1+) %.3f vs expected %.3f; null P(1+) mean %.3f' % (real['hot_p1'], real['hot_exp'], null.hot_p1.mean()))

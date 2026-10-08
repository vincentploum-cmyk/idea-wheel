"""Calibration of the recommended early-season SOG / goal models + tonight's regression list."""
import sys, numpy as np, pandas as pd, statsmodels.api as sm, warnings
from scipy import stats
from sklearn.model_selection import GroupKFold
warnings.filterwarnings('ignore')
d = pd.read_csv(sys.argv[1])
w = d[(d.n_prior >= 1) & d.ls_sog_pg.notna()].copy()
def cvpred(df, cols, target):
    X = sm.add_constant(df[cols].astype(float), has_constant='add'); y = df[target].values.astype(float); pred = np.zeros(len(df))
    for tr, te in GroupKFold(5).split(X, y, df.gameId):
        pred[te] = sm.GLM(y[tr], X.iloc[tr], family=sm.families.Poisson()).fit().predict(X.iloc[te])
    return pred
w['lam_s'] = cvpred(w, ['ls_sog_pg', 'p_icf_avg', 'opp_ls_sa_pg'], 'sog')
w['lam_g'] = cvpred(w, ['ls_xg_pg', 'home', 'opp_ls_xga_pg'], 'g')
for k in (2, 3, 4):
    w[f'p{k}'] = 1 - stats.poisson.cdf(k - 1, w.lam_s)
    w['bin'] = pd.cut(w[f'p{k}'], [0, .1, .2, .3, .4, .5, .6, .7, .8, 1], include_lowest=True)
    t = w.groupby('bin', observed=True).agg(n=('sog', 'size'), predicted=(f'p{k}', 'mean'), actual=('sog', lambda s: (s >= k).mean()))
    print(f'\nCalibration P({k}+ SOG), out-of-fold:'); print(t.to_string(float_format=lambda v: f'{v:.3f}'))
w['pg'] = 1 - np.exp(-w.lam_g)
w['bin'] = pd.cut(w.pg, [0, .05, .1, .15, .2, .25, .3, .4, 1], include_lowest=True)
t = w.groupby('bin', observed=True).agg(n=('g1', 'size'), predicted=('pg', 'mean'), actual=('g1', 'mean'))
print('\nCalibration P(1+ goal), out-of-fold:'); print(t.to_string(float_format=lambda v: f'{v:.3f}'))

# regression list: this season's SOG pace vs last season's, 2+ games
last = d.sort_values('date').groupby('playerId').tail(1)
cur = d.groupby('playerId').agg(name=('name', 'last'), team=('team', 'last'), pos=('pos', 'last'), gp=('sog', 'size'), sog_avg=('sog', 'mean'), icf_avg=('icf', 'mean'), toi=('toi', 'mean'), g=('g', 'sum'), ls_sog=('ls_sog_pg', 'last'), ls_toi=('ls_toi_pg', 'last'), ls_xg=('ls_xg_pg', 'last')).reset_index()
cur = cur[(cur.gp >= 2) & cur.ls_sog.notna() & (cur.ls_sog >= 1.5)]
cur['gap'] = cur.sog_avg - cur.ls_sog
cur['blend'] = 0.1 * cur.sog_avg + 0.9 * cur.ls_sog
pd.set_option('display.width', 200)
cols = ['name', 'team', 'pos', 'gp', 'sog_avg', 'icf_avg', 'ls_sog', 'blend', 'gap', 'toi', 'ls_toi']
print('\nRunning HOT vs last season (market likely over-prices):'); print(cur.sort_values('gap', ascending=False).head(15)[cols].to_string(index=False, float_format=lambda v: f'{v:.2f}'))
print('\nRunning COLD vs last season (market likely under-prices):'); print(cur.sort_values('gap').head(15)[cols].to_string(index=False, float_format=lambda v: f'{v:.2f}'))
# 4-goal / multi-goal this season
mg = d[d.g >= 2][['date', 'name', 'team', 'opp', 'g', 'sog', 'ls_g_pg', 'ls_xg_pg']].sort_values('g', ascending=False)
print('\nMulti-goal games so far:'); print(mg.head(25).to_string(index=False, float_format=lambda v: f'{v:.2f}'))

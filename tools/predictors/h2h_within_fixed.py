"""Within-season H2H, done right: the player's season-to-date rate EXCLUDES his earlier games
vs tonight's opponent, then ask whether his record in those games adds anything. Plus the same
permutation null (shuffle opponent labels among his prior games). argv: rows csv, n perms"""
import sys, numpy as np, pandas as pd, statsmodels.api as sm, warnings
from collections import defaultdict
warnings.filterwarnings('ignore'); np.random.seed(5)
d = pd.read_csv(sys.argv[1]); NP = int(sys.argv[2])
d = d.sort_values(['date', 'gameId']).reset_index(drop=True)

def build(d, shuffle=False):
    hist = defaultdict(list)  # playerId -> list of (date, opp, g, sog)
    out = []
    by_date = d.groupby('date', sort=True)
    for date, day in by_date:
        for r in day.itertuples():
            h = hist[r.playerId]
            if len(h) >= 10:
                opps = [x[1] for x in h]
                if shuffle: opps = list(np.random.permutation(opps))
                vs = [x for x, o in zip(h, opps) if o == r.opp]
                if vs:
                    g_all = sum(x[2] for x in h); g_vs = sum(x[2] for x in vs)
                    out.append(dict(g=r.g, g1=r.g1, sog=r.sog, n=len(h), hn=len(vs), hg=g_vs, hgpg=g_vs / len(vs),
                                    pg_ex=(g_all - g_vs) / (len(h) - len(vs)), psog_ex=(sum(x[3] for x in h) - sum(x[3] for x in vs)) / (len(h) - len(vs)),
                                    hsog=sum(x[3] for x in vs) / len(vs)))
        for r in day.itertuples():
            hist[r.playerId].append((date, r.opp, r.g, r.sog))
    return pd.DataFrame(out)

def stat(x):
    X = sm.add_constant(x[['pg_ex', 'hgpg']].astype(float)); m = sm.GLM(x.g.astype(float), X, family=sm.families.Poisson()).fit()
    X0 = sm.add_constant(x[['pg_ex']].astype(float)); m0 = sm.GLM(x.g.astype(float), X0, family=sm.families.Poisson()).fit()
    Xs = sm.add_constant(x[['psog_ex', 'hsog']].astype(float)); ms = sm.GLM(x.sog.astype(float), Xs, family=sm.families.Poisson()).fit()
    hot = x[x.hg >= 2]
    return dict(n=len(x), coef=m.params['hgpg'], z=m.tvalues['hgpg'], dgain=m0.deviance - m.deviance, sog_coef=ms.params['hsog'], sog_z=ms.tvalues['hsog'],
                hot_n=len(hot), hot_p1=hot.g1.mean(), hot_exp=(1 - np.exp(-hot.pg_ex)).mean())
real_df = build(d); real = stat(real_df)
print('REAL (rate excludes the H2H games, 10+ prior games):', {k: round(float(v), 3) for k, v in real.items()})
real_df['b'] = pd.cut(real_df.hg, [-1, 0, 1, 2, 3, 99], labels=['0', '1', '2', '3', '4+'])
real_df['exp'] = 1 - np.exp(-real_df.pg_ex)
t = real_df.groupby('b', observed=True).agg(n=('g1', 'size'), meetings=('hn', 'mean'), h2h_gpg=('hgpg', 'mean'), rate_ex=('pg_ex', 'mean'), actual_P1=('g1', 'mean'), expected_P1=('exp', 'mean'), actual_gpg=('g', 'mean'))
t['diff'] = t.actual_P1 - t.expected_P1
print(t.to_string(float_format=lambda v: f'{v:.3f}'))
null = pd.DataFrame([stat(build(d, shuffle=True)) for _ in range(NP)])
print('NULL: coef mean %.3f sd %.3f | z mean %.2f sd %.2f | dgain 95th %.1f | sog_z mean %.2f sd %.2f | hot P(1+) mean %.3f' % (null.coef.mean(), null.coef.std(), null.z.mean(), null.z.std(), null.dgain.quantile(.95), null.sog_z.mean(), null.sog_z.std(), null.hot_p1.mean()))
print('p-value goals (deviance gain): %.3f   p-value SOG coef: %.3f' % ((null.dgain >= real['dgain']).mean(), (null.sog_coef >= real['sog_coef']).mean()))

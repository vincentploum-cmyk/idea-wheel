"""Cross-season H2H: does a player's record vs an opponent LAST season predict his goals vs
that opponent THIS season, beyond his overall rate? argv: prev rows csv, cur rows csv, label."""
import sys, numpy as np, pandas as pd, statsmodels.api as sm, warnings
from scipy import stats
warnings.filterwarnings('ignore')
prev = pd.read_csv(sys.argv[1]); cur = pd.read_csv(sys.argv[2]); label = sys.argv[3]
# last season per player: overall, and per opponent
ov = prev.groupby('playerId').agg(pgp=('g', 'size'), pg=('g', 'mean'), psog=('sog', 'mean'), pg1=('g1', 'mean')).reset_index()
ov = ov[ov.pgp >= 20]
h = prev.groupby(['playerId', 'opp']).agg(hn=('g', 'size'), hg=('g', 'sum'), hgpg=('g', 'mean'), hsog=('sog', 'mean'), hg1=('g1', 'mean')).reset_index()
d = cur.merge(ov, on='playerId').merge(h, on=['playerId', 'opp'], how='left')
d = d[d.hn.notna()].copy()
# the player's last-season rate EXCLUDING the games vs this opponent (so the H2H isn't double counted)
d['pg_ex'] = (d.pg * d.pgp - d.hg) / (d.pgp - d.hn)
d['exp_g1'] = 1 - np.exp(-d.pg_ex)
d['h2h_vs_rate'] = d.hgpg - d.pg_ex
print(f'=== {label}: {len(d)} skater-games with 20+ GP last season and 1+ meeting vs tonight\'s opponent last season ===')
print('\na) Last-season goals vs this opponent (total) -> this season vs the same opponent')
d['b'] = pd.cut(d.hg, [-1, 0, 1, 2, 3, 99], labels=['0', '1', '2', '3', '4+'])
t = d.groupby('b', observed=True).agg(n=('g1', 'size'), meetings_LS=('hn', 'mean'), LS_h2h_gpg=('hgpg', 'mean'), LS_overall_gpg=('pg_ex', 'mean'), actual_P1=('g1', 'mean'), expected_P1=('exp_g1', 'mean'), actual_gpg=('g', 'mean'))
t['actual_minus_expected'] = t.actual_P1 - t.expected_P1
print(t.to_string(float_format=lambda v: f'{v:.3f}'))
print('\nb) Same, by how much the H2H rate beat the player\'s own rate (goals/game vs opp minus goals/game vs everyone else), 2+ meetings:')
dd = d[d.hn >= 2].copy()
dd['b'] = pd.cut(dd.h2h_vs_rate, [-9, -0.3, -0.1, 0.1, 0.3, 0.6, 9], labels=['<-.3', '-.3 to -.1', '-.1 to .1', '.1 to .3', '.3 to .6', '>.6'])
t = dd.groupby('b', observed=True).agg(n=('g1', 'size'), LS_h2h_gpg=('hgpg', 'mean'), LS_overall_gpg=('pg_ex', 'mean'), actual_P1=('g1', 'mean'), expected_P1=('exp_g1', 'mean'), actual_gpg=('g', 'mean'))
t['actual_minus_expected'] = t.actual_P1 - t.expected_P1
print(t.to_string(float_format=lambda v: f'{v:.3f}'))
print('\nc) Poisson, goals ~ last-season overall rate (ex this opp) [+ last-season H2H goals/game]:')
for cols in (['pg_ex'], ['pg_ex', 'hgpg'], ['pg_ex', 'psog', 'hgpg'], ['pg_ex', 'psog', 'hgpg', 'hsog']):
    X = sm.add_constant(dd[cols].astype(float)); m = sm.GLM(dd.g.astype(float), X, family=sm.families.Poisson()).fit()
    print('   ', cols, 'deviance %.1f' % m.deviance, {k: f'{v:.3f} (z {m.tvalues[k]:.1f})' for k, v in m.params.items() if k != 'const'})
print('\nd) The literal claim: 3+ goals vs the opponent last season ->')
hot = d[d.hg >= 3]
print(f'   n={len(hot)} skater-games; scored in {hot.g1.mean():.3f} of them; expected from their own rate {hot.exp_g1.mean():.3f}; goals/game {hot.g.mean():.3f} vs rate {hot.pg_ex.mean():.3f}; SOG {hot.sog.mean():.2f} vs their LS SOG/g {hot.psog.mean():.2f}')
print('   the list (this season):')
cols = ['date', 'name', 'team', 'opp', 'g', 'sog', 'hg', 'hn', 'pg_ex']
print(hot.sort_values('hg', ascending=False)[cols].head(40).to_string(index=False, float_format=lambda v: f'{v:.2f}'))
print('\ne) And the mirror: 0 goals vs the opponent in 3+ meetings last season ->')
cold = d[(d.hg == 0) & (d.hn >= 3)]
print(f'   n={len(cold)}; scored in {cold.g1.mean():.3f}; expected {cold.exp_g1.mean():.3f}')

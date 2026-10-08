"""Which window of the opponent's shots / goals allowed best predicts a skater's SOG and goals?
argv: rows csv, label. Windows are the opponent's prior games only (leak-free)."""
import sys, numpy as np, pandas as pd, statsmodels.api as sm, warnings
from collections import defaultdict
from scipy import stats
from sklearn.model_selection import GroupKFold
warnings.filterwarnings('ignore')
d = pd.read_csv(sys.argv[1]); label = sys.argv[2]
d = d.sort_values(['date', 'gameId']).reset_index(drop=True)
WINS = [3, 5, 10, 15, 20, 30]
# per game, per defending team: shots and goals allowed overall and to each position
g = d.groupby(['gameId', 'date', 'opp', 'venue']).agg(sa=('sog', 'sum'), ga=('g', 'sum')).reset_index()
gp = d.groupby(['gameId', 'opp', 'pos']).agg(sa=('sog', 'sum'), ga=('g', 'sum'), n=('sog', 'size')).reset_index()
gp['sa_per'] = gp.sa / gp.n; gp['ga_per'] = gp.ga / gp.n   # per skater at the position (robust to 11F/7D nights)
pos_tab = {(r.gameId, r.opp, r.pos): (r.sa_per, r.ga_per) for r in gp.itertuples()}
# venue of the defending team = opposite of the attacker's venue
g['dvenue'] = np.where(g.venue == 'H', 'A', 'H')

hist = defaultdict(list)       # defteam -> [(date, sa, ga, dvenue, {pos:(sa_per, ga_per)})]
rows = []
by_date = {k: v for k, v in g.groupby('date')}
# attacker rows grouped by date too
drows = {k: v for k, v in d.groupby('date')}
for date in sorted(by_date):
    for r in drows[date].itertuples():
        h = hist[r.opp]
        rec = dict(idx=r.Index, opp_n=len(h))
        for w in WINS + [999]:
            hh = h[-w:] if w != 999 else h
            tag = f'L{w}' if w != 999 else 'season'
            rec[f'sa_{tag}'] = np.mean([x[1] for x in hh]) if hh else np.nan
            rec[f'ga_{tag}'] = np.mean([x[2] for x in hh]) if hh else np.nan
            ps = [x[4].get(r.pos) for x in hh]; ps = [p for p in ps if p]
            rec[f'psa_{tag}'] = np.mean([p[0] for p in ps]) if ps else np.nan
            rec[f'pga_{tag}'] = np.mean([p[1] for p in ps]) if ps else np.nan
        # venue-matched (the opponent at the venue it plays tonight)
        dv = 'A' if r.venue == 'H' else 'H'
        hv = [x for x in h if x[3] == dv]
        for w in (5, 10):
            hh = hv[-w:]
            rec[f'sa_venueL{w}'] = np.mean([x[1] for x in hh]) if hh else np.nan
            rec[f'psa_venueL{w}'] = np.nan
            ps = [x[4].get(r.pos) for x in hh]; ps = [p for p in ps if p]
            rec[f'psa_venueL{w}'] = np.mean([p[0] for p in ps]) if ps else np.nan
        rows.append(rec)
    for r in by_date[date].itertuples():
        hist[r.opp].append((date, r.sa, r.ga, r.dvenue, {p: pos_tab[(r.gameId, r.opp, p)] for p in ('C', 'LW', 'RW', 'D') if (r.gameId, r.opp, p) in pos_tab}))
env = pd.DataFrame(rows).set_index('idx')
d = d.join(env)
d.to_csv(sys.argv[1].replace('.csv', '-env.csv'), index=False)

print(f'=== {label}: {len(d)} rows ===')
# ---------------- 1. reliability: how well does each window predict the opponent's NEXT 10 games?
print('\n--- 1. Reliability of the environment read itself: correlation of each window with the opponent\'s shots allowed over its NEXT 10 games ---')
tg = g.sort_values('date').copy()
tg['next10_sa'] = tg.groupby('opp').sa.transform(lambda s: s[::-1].rolling(10, min_periods=10).mean()[::-1].shift(-1))
tg['next10_ga'] = tg.groupby('opp').ga.transform(lambda s: s[::-1].rolling(10, min_periods=10).mean()[::-1].shift(-1))
for w in WINS + [999]:
    tag = f'L{w}' if w != 999 else 'season'
    tg[f'sa_{tag}'] = tg.groupby('opp').sa.transform(lambda s: s.shift(1).rolling(w if w != 999 else 200, min_periods=min(w, 3) if w != 999 else 3).mean())
    tg[f'ga_{tag}'] = tg.groupby('opp').ga.transform(lambda s: s.shift(1).rolling(w if w != 999 else 200, min_periods=min(w, 3) if w != 999 else 3).mean())
tg['n_prior'] = tg.groupby('opp').cumcount()
sub = tg[(tg.n_prior >= 30) & tg.next10_sa.notna()]
print(f'   opponents with 30+ prior games, {len(sub)} team-games:')
for w in WINS + [999]:
    tag = f'L{w}' if w != 999 else 'season'
    print(f'   {tag:7s} shots allowed r = {stats.pearsonr(sub[f"sa_{tag}"], sub.next10_sa)[0]:.3f}   goals allowed r = {stats.pearsonr(sub[f"ga_{tag}"], sub.next10_ga)[0]:.3f}')
sub2 = tg[(tg.n_prior >= 10) & (tg.n_prior < 20) & tg.next10_sa.notna()]
print(f'   opponents with 10-19 prior games ({len(sub2)} team-games), windows up to L10 + season:')
for tag in ['L3', 'L5', 'L10', 'season']:
    print(f'   {tag:7s} shots allowed r = {stats.pearsonr(sub2[f"sa_{tag}"], sub2.next10_sa)[0]:.3f}   goals allowed r = {stats.pearsonr(sub2[f"ga_{tag}"], sub2.next10_ga)[0]:.3f}')

# ---------------- 2. incremental value in the player projection, same rows
def cv(df, cols, target):
    df = df.dropna(subset=cols + [target]); X = sm.add_constant(df[cols].astype(float), has_constant='add'); y = df[target].values.astype(float); pred = np.zeros(len(df))
    for tr, te in GroupKFold(5).split(X, y, df.gameId):
        pred[te] = np.clip(sm.GLM(y[tr], X.iloc[tr], family=sm.families.Poisson()).fit().predict(X.iloc[te]), 0.02, 15)
    dev = 2 * np.mean(np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / pred), 0) - (y - pred))
    out = dict(n=len(df), dev=dev)
    for k in ([2, 3] if target == 'sog' else [1]):
        p = np.clip(1 - stats.poisson.cdf(k - 1, pred), 1e-3, 1 - 1e-3); hit = (y >= k).astype(float)
        out[f'll{k}'] = -np.mean(hit * np.log(p) + (1 - hit) * np.log(1 - p))
    return out
base = d[(d.n_prior >= 20) & (d.opp_n >= 30) & d.ls_sog_pg.notna()].copy()
core_s = ['p_sog_avg', 'ls_sog_pg', 'p_icf_avg', 'p_toi_l5', 'home']
print(f'\n--- 2. SOG: player core + ONE environment window (skaters with 20+ games, opponents with 30+ games, n={len(base)}) ---')
res = [dict(window='none (player core only)', **cv(base, core_s, 'sog'))]
for fam, nm in [('sa', 'opp shots allowed / game'), ('psa', 'opp shots allowed per skater at the POSITION')]:
    for w in WINS + [999]:
        tag = f'L{w}' if w != 999 else 'season'
        res.append(dict(window=f'{nm}: {tag}', **cv(base, core_s + [f'{fam}_{tag}'], 'sog')))
for c, nm in [('sa_venueL5', 'opp shots allowed, at tonight\'s venue, L5'), ('sa_venueL10', 'opp shots allowed, at tonight\'s venue, L10'), ('psa_venueL5', 'position, at venue, L5'), ('psa_venueL10', 'position, at venue, L10')]:
    res.append(dict(window=nm, **cv(base, core_s + [c], 'sog')))
for cols, nm in [(['sa_L10', 'sa_season'], 'overall L10 + season'), (['psa_L10', 'psa_season'], 'position L10 + season'), (['psa_L15', 'sa_season'], 'position L15 + overall season'), (['psa_L10', 'psa_season', 'sa_season'], 'position L10 + position season + overall season')]:
    res.append(dict(window=nm, **cv(base, core_s + cols, 'sog')))
res = pd.DataFrame(res); pd.set_option('display.width', 200)
print(res.to_string(index=False, float_format=lambda v: f'{v:.4f}'))
res.to_csv(sys.argv[1].replace('.csv', '-env-sog.csv'), index=False)
# coefficients: size of the effect per window
print('\n   effect size (full fit, log-rate per extra shot allowed per game / per skater at the position):')
for fam in ('sa', 'psa'):
    for tag in ['L5', 'L10', 'L15', 'season']:
        df = base.dropna(subset=core_s + [f'{fam}_{tag}']); X = sm.add_constant(df[core_s + [f'{fam}_{tag}']].astype(float)); m = sm.GLM(df.sog.astype(float), X, family=sm.families.Poisson()).fit()
        sd = df[f'{fam}_{tag}'].std()
        print(f'   {fam}_{tag:7s} coef {m.params[f"{fam}_{tag}"]:.4f} (z {m.tvalues[f"{fam}_{tag}"]:.1f}); one SD of the read ({sd:.2f}) = {100*(np.exp(m.params[f"{fam}_{tag}"]*sd)-1):.1f}% SOG')

core_g = ['p_sog_avg', 'p_iscf_avg', 'ls_xg_pg', 'p_g_avg', 'ls_shpct', 'home']
baseg = base[base.ls_xg_pg.notna() & base.ls_shpct.notna()]
print(f'\n--- 3. Goals: goal core + ONE environment window (n={len(baseg)}) ---')
res = [dict(window='none (goal core only)', **cv(baseg, core_g, 'g'))]
for fam, nm in [('ga', 'opp goals allowed / game'), ('pga', 'opp goals allowed per skater at the POSITION'), ('sa', 'opp shots allowed / game'), ('psa', 'opp shots allowed per skater at the position')]:
    for w in [5, 10, 15, 20, 30, 999]:
        tag = f'L{w}' if w != 999 else 'season'
        res.append(dict(window=f'{nm}: {tag}', **cv(baseg, core_g + [f'{fam}_{tag}'], 'g')))
for cols, nm in [(['pga_L10', 'ga_season'], 'position GA L10 + overall GA season'), (['pga_season', 'psa_L10'], 'position GA season + position SA L10'), (['pga_L15', 'pga_season'], 'position GA L15 + season')]:
    res.append(dict(window=nm, **cv(baseg, core_g + cols, 'g')))
res = pd.DataFrame(res)
print(res.to_string(index=False, float_format=lambda v: f'{v:.4f}'))
res.to_csv(sys.argv[1].replace('.csv', '-env-goal.csv'), index=False)
print('\n   effect size:')
for fam in ('ga', 'pga'):
    for tag in ['L5', 'L10', 'L15', 'season']:
        df = baseg.dropna(subset=core_g + [f'{fam}_{tag}']); X = sm.add_constant(df[core_g + [f'{fam}_{tag}']].astype(float)); m = sm.GLM(df.g.astype(float), X, family=sm.families.Poisson()).fit()
        sd = df[f'{fam}_{tag}'].std()
        print(f'   {fam}_{tag:7s} coef {m.params[f"{fam}_{tag}"]:.4f} (z {m.tvalues[f"{fam}_{tag}"]:.1f}); one SD of the read ({sd:.3f}) = {100*(np.exp(m.params[f"{fam}_{tag}"]*sd)-1):.1f}% goals')

# ---------------- 4. early season: opponents with 5-15 prior games, which window?
early = d[(d.n_prior >= 5) & (d.opp_n >= 5) & (d.opp_n <= 15) & d.ls_sog_pg.notna()].copy()
core_e = ['p_sog_avg', 'ls_sog_pg', 'p_icf_avg', 'home']
print(f'\n--- 4. Early season (opponent has 5-15 prior games, skater 5+), SOG, n={len(early)} ---')
res = [dict(window='none', **cv(early, core_e, 'sog')), dict(window='opp LAST SEASON shots allowed', **cv(early, core_e + ['opp_ls_sa_pg'], 'sog'))]
for fam, nm in [('sa', 'overall'), ('psa', 'position')]:
    for tag in ['L3', 'L5', 'L10', 'season']:
        res.append(dict(window=f'{nm} {tag}', **cv(early, core_e + [f'{fam}_{tag}'], 'sog')))
res.append(dict(window='last season + overall season-to-date', **cv(early, core_e + ['opp_ls_sa_pg', 'sa_season'], 'sog')))
res.append(dict(window='last season + position season-to-date', **cv(early, core_e + ['opp_ls_sa_pg', 'psa_season'], 'sog')))
print(pd.DataFrame(res).to_string(index=False, float_format=lambda v: f'{v:.4f}'))

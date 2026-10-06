"""Which data points predict a skater's SOG and goals in his next game?
Usage: python3 -I tools/predictors/analyze.py rows.csv [label] [bootstrap resamples]
All features are leak-free (prior games only / previous-season priors).
"""
import sys, warnings, numpy as np, pandas as pd
from scipy import stats
import statsmodels.api as sm
from sklearn.model_selection import GroupKFold
warnings.filterwarnings('ignore')
np.random.seed(7)

path = sys.argv[1]; label = sys.argv[2] if len(sys.argv) > 2 else path
NBOOT = int(sys.argv[3]) if len(sys.argv) > 3 else 400
d = pd.read_csv(path)
d['pos_f'] = d.pos.map({'C': 'F', 'LW': 'F', 'RW': 'F', 'D': 'D'})
print(f'=== {label}: {len(d)} skater-games, {d.gameId.nunique()} games, {d.playerId.nunique()} skaters ===')
print('league avg SOG/skater-game %.2f, goals %.3f, P(1+ goal) %.3f' % (d.sog.mean(), d.g.mean(), d.g1.mean()))

# ------------------------------------------------------------------ helpers
def boot_corr(x, y, groups, n=None):
    n = n or NBOOT
    """Spearman rho with a 95% CI from resampling whole games."""
    m = x.notna() & y.notna()
    x, y, groups = x[m].values, y[m].values, groups[m].values
    if len(x) < 30: return np.nan, (np.nan, np.nan), len(x)
    r = stats.spearmanr(x, y).correlation
    ug = np.unique(groups); idx = {g: np.where(groups == g)[0] for g in ug}
    bs = []
    for _ in range(n):
        pick = np.random.choice(ug, len(ug), replace=True)
        ii = np.concatenate([idx[g] for g in pick])
        bs.append(stats.spearmanr(x[ii], y[ii]).correlation)
    return r, (np.nanpercentile(bs, 2.5), np.nanpercentile(bs, 97.5)), len(x)

def poisson_cv(df, cols, target, folds=5):
    """Grouped (by game) K-fold Poisson GLM. Returns deviance/row, MAE, log-loss for P(target>=k)."""
    df = df.dropna(subset=cols + [target]).copy()
    X = sm.add_constant(df[cols].astype(float), has_constant='add'); y = df[target].values.astype(float)
    pred = np.zeros(len(df))
    for tr, te in GroupKFold(folds).split(X, y, df.gameId):
        try:
            m = sm.GLM(y[tr], X.iloc[tr], family=sm.families.Poisson()).fit()
            pred[te] = np.clip(m.predict(X.iloc[te]), 0.02, 15)
        except Exception:
            pred[te] = y[tr].mean()
    dev = 2 * np.mean(np.where(y > 0, y * np.log(y / pred), 0) - (y - pred))
    mae = np.mean(np.abs(y - pred))
    out = dict(n=len(df), dev=dev, mae=mae)
    ks = [1, 2, 3] if target == 'sog' else [1]
    for k in ks:
        p = 1 - stats.poisson.cdf(k - 1, pred); p = np.clip(p, 1e-3, 1 - 1e-3)
        hit = (y >= k).astype(float)
        out[f'll{k}'] = -np.mean(hit * np.log(p) + (1 - hit) * np.log(1 - p))
        out[f'brier{k}'] = np.mean((hit - p) ** 2)
    return out

def fit_poisson(df, cols, target):
    df = df.dropna(subset=cols + [target])
    X = sm.add_constant(df[cols].astype(float), has_constant='add')
    return sm.GLM(df[target].astype(float), X, family=sm.families.Poisson()).fit(), len(df)

# ------------------------------------------------------------------ 1. univariate
print('\n--- 1. Univariate Spearman correlation with the game''s SOG and goals (95% CI, games resampled) ---')
feats = [
    ('p_sog_l1', 'last game SOG'), ('p_sog_l3', 'L3 SOG avg'), ('p_sog_l5', 'L5 SOG avg'), ('p_sog_l10', 'L10 SOG avg'),
    ('p_sog_avg', 'season-to-date SOG avg'), ('p_sog60', 'season-to-date SOG/60'),
    ('p_icf_avg', 'season-to-date iCF avg'), ('p_iff_avg', 'season-to-date iFF avg'), ('p_iscf_avg', 'season-to-date iSCF avg'), ('p_ihdcf_avg', 'season-to-date iHDCF avg'),
    ('p_toi_avg', 'season-to-date TOI avg'), ('p_toi_l1', 'last game TOI'),
    ('p_g_avg', 'season-to-date goals/game'), ('p_g_l1', 'last game goals'), ('p_g1_rate', 'season-to-date P(1+ goal)'), ('p_shpct', 'season-to-date SH%'),
    ('ls_sog_pg', 'LAST SEASON SOG/game'), ('ls_sog60', 'LAST SEASON SOG/60'), ('ls_icf_pg', 'LAST SEASON iCF/game'), ('ls_iff_pg', 'LAST SEASON iFF/game'),
    ('ls_xg_pg', 'LAST SEASON xG/game'), ('ls_g_pg', 'LAST SEASON goals/game'), ('ls_hd_pg', 'LAST SEASON HD shots/game'), ('ls_toi_pg', 'LAST SEASON TOI/game'), ('ls_shpct', 'LAST SEASON SH%'), ('ls_gax_pg', 'LAST SEASON goals above xG/game'),
    ('opp_sa_pg', 'opp SOG allowed/game (this season, prior)'), ('opp_ga_pg', 'opp goals allowed/game (this season, prior)'), ('opp_pos_sog_pg', 'opp SOG allowed to position (this season, prior)'), ('opp_pos_g_pg', 'opp goals allowed to position (this season, prior)'),
    ('opp_ls_sa_pg', 'opp LAST SEASON SOG allowed/game'), ('opp_ls_ca_pg', 'opp LAST SEASON attempts allowed/game'), ('opp_ls_xga_pg', 'opp LAST SEASON xGA/game'), ('opp_ls_ga_pg', 'opp LAST SEASON GA/game'),
    ('team_sf_pg', 'own team SOG/game (this season, prior)'), ('team_ls_sf_pg', 'own team LAST SEASON SOG/game'), ('team_ls_cf_pg', 'own team LAST SEASON attempts/game'),
    ('home', 'home ice'), ('b2b', 'back-to-back'), ('opp_b2b', 'opponent on back-to-back'), ('rest_days', 'rest days'),
    ('h2h_sog_avg', 'H2H SOG avg vs this opp (this season)'), ('h2h_g_avg', 'H2H goals avg vs this opp (this season)'),
]
rows = []
for c, name in feats:
    if c not in d: continue
    rs, cis, ns = boot_corr(d[c], d.sog, d.gameId)
    rg, cig, ng = boot_corr(d[c], d.g, d.gameId)
    rows.append(dict(feature=name, n=ns, rho_sog=rs, sog_lo=cis[0], sog_hi=cis[1], rho_goal=rg, g_lo=cig[0], g_hi=cig[1]))
uni = pd.DataFrame(rows).sort_values('rho_sog', ascending=False)
pd.set_option('display.width', 220); pd.set_option('display.max_rows', 200)
print(uni.to_string(index=False, float_format=lambda v: f'{v:.3f}'))
uni.to_csv(path.replace('.csv', '-univariate.csv'), index=False)

# ------------------------------------------------------------------ 2. SOG model ladder
print('\n--- 2. Shots: grouped 5-fold CV Poisson models (lower is better). ll2/ll3 = log loss of P(2+/3+ SOG) ---')
base = d[d.n_prior >= 1].copy()
withls = base[base.ls_sog_pg.notna()].copy()
withenv = withls[withls.opp_n_prior >= 1].copy()
ladder = [
    ('intercept only (league mean)', [], base),
    ('position only', ['isD'], base),
    ('last game SOG', ['p_sog_l1'], base),
    ('L3 SOG avg', ['p_sog_l3'], base),
    ('season-to-date SOG avg', ['p_sog_avg'], base),
    ('season-to-date iCF avg', ['p_icf_avg'], base),
    ('season-to-date iFF avg', ['p_iff_avg'], base),
    ('season-to-date TOI avg', ['p_toi_avg'], base),
    ('season-to-date SOG avg + TOI avg', ['p_sog_avg', 'p_toi_avg'], base),
    ('season-to-date SOG + iCF + TOI', ['p_sog_avg', 'p_icf_avg', 'p_toi_avg'], base),
    ('LAST SEASON SOG/game', ['ls_sog_pg'], withls),
    ('LAST SEASON SOG/60 + TOI/game', ['ls_sog60', 'ls_toi_pg'], withls),
    ('LAST SEASON iCF/game', ['ls_icf_pg'], withls),
    ('LAST SEASON SOG/game + season-to-date SOG avg', ['ls_sog_pg', 'p_sog_avg'], withls),
    ('LAST SEASON SOG/game + this-season iCF avg', ['ls_sog_pg', 'p_icf_avg'], withls),
    ('LAST SEASON SOG/game + this-season TOI avg', ['ls_sog_pg', 'p_toi_avg'], withls),
    ('LAST SEASON SOG + sTD SOG + sTD TOI', ['ls_sog_pg', 'p_sog_avg', 'p_toi_avg'], withls),
    ('LAST SEASON SOG + sTD SOG + sTD iCF + sTD TOI', ['ls_sog_pg', 'p_sog_avg', 'p_icf_avg', 'p_toi_avg'], withls),
    ('player core + home', ['ls_sog_pg', 'p_sog_avg', 'p_toi_avg', 'home'], withls),
    ('player core + opp LAST SEASON SOG allowed', ['ls_sog_pg', 'p_sog_avg', 'p_toi_avg', 'opp_ls_sa_pg'], withls),
    ('player core + opp LAST SEASON attempts allowed', ['ls_sog_pg', 'p_sog_avg', 'p_toi_avg', 'opp_ls_ca_pg'], withls),
    ('player core + opp this-season SOG allowed (prior)', ['ls_sog_pg', 'p_sog_avg', 'p_toi_avg', 'opp_sa_pg'], withenv),
    ('player core + opp this-season SOG allowed to position (prior)', ['ls_sog_pg', 'p_sog_avg', 'p_toi_avg', 'opp_pos_sog_pg'], withenv),
    ('player core + own team LAST SEASON SOG/game', ['ls_sog_pg', 'p_sog_avg', 'p_toi_avg', 'team_ls_sf_pg'], withls),
    ('player core + home + opp LS SOG allowed + b2b', ['ls_sog_pg', 'p_sog_avg', 'p_toi_avg', 'home', 'opp_ls_sa_pg', 'b2b'], withls),
    ('player core + home + opp LS SOG allowed + opp sTD SOG allowed (same rows)', ['ls_sog_pg', 'p_sog_avg', 'p_toi_avg', 'home', 'opp_ls_sa_pg', 'opp_sa_pg'], withenv),
    ('player core + home + opp LS SOG allowed (same rows as above)', ['ls_sog_pg', 'p_sog_avg', 'p_toi_avg', 'home', 'opp_ls_sa_pg'], withenv),
]
for df_ in (base, withls, withenv): df_['isD'] = (df_.pos == 'D').astype(int)
res = []
for name, cols, df_ in ladder:
    r = poisson_cv(df_, cols, 'sog'); r['model'] = name; res.append(r)
res = pd.DataFrame(res)[['model', 'n', 'dev', 'mae', 'll2', 'll3', 'brier2', 'brier3']]
print(res.to_string(index=False, float_format=lambda v: f'{v:.4f}'))
res.to_csv(path.replace('.csv', '-sog-ladder.csv'), index=False)

# full fit for coefficients
print('\n   Full-sample Poisson fit, SOG ~ last-season SOG/game + season-to-date SOG avg + season-to-date TOI avg + home + opp LS SOG allowed:')
m, n = fit_poisson(withls, ['ls_sog_pg', 'p_sog_avg', 'p_toi_avg', 'home', 'opp_ls_sa_pg'], 'sog')
print(pd.DataFrame({'coef': m.params, 'z': m.tvalues, 'p': m.pvalues}).to_string(float_format=lambda v: f'{v:.3f}'), f'   (n={n})')

# ------------------------------------------------------------------ 3. shrinkage: how much to trust this season
print('\n--- 3. Shrinkage: E[SOG] = w * (season-to-date SOG avg) + (1-w) * (last-season SOG/game), w fitted by n_prior ---')
for n_lo, n_hi in [(1, 1), (2, 2), (3, 3), (4, 5), (6, 10), (11, 20), (21, 99)]:
    sub = withls[(withls.n_prior >= n_lo) & (withls.n_prior <= n_hi)]
    if len(sub) < 60: continue
    best = None
    for w in np.arange(0, 1.001, 0.05):
        pred = np.clip(w * sub.p_sog_avg + (1 - w) * sub.ls_sog_pg, 0.05, 15)
        y = sub.sog.values
        dev = 2 * np.mean(np.where(y > 0, y * np.log(y / pred), 0) - (y - pred))
        if best is None or dev < best[1]: best = (w, dev)
    # bootstrap CI on w (resample games)
    ws = []
    gid = sub.gameId.values; ug = np.unique(gid); idx = {g: np.where(gid == g)[0] for g in ug}
    ps, ls_, yy = sub.p_sog_avg.values, sub.ls_sog_pg.values, sub.sog.values
    for _ in range(min(NBOOT, 200)):
        ii = np.concatenate([idx[g] for g in np.random.choice(ug, len(ug), replace=True)])
        bw = None
        for w in np.arange(0, 1.001, 0.05):
            pred = np.clip(w * ps[ii] + (1 - w) * ls_[ii], 0.05, 15); y = yy[ii]
            dev = 2 * np.mean(np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / pred), 0) - (y - pred))
            if bw is None or dev < bw[1]: bw = (w, dev)
        ws.append(bw[0])
    print(f'  prior games {n_lo}-{n_hi}: n={len(sub):5d}  best w(this season)={best[0]:.2f}  95% CI [{np.percentile(ws,2.5):.2f}, {np.percentile(ws,97.5):.2f}]')

# ------------------------------------------------------------------ 4. intuitive buckets
print('\n--- 4. Bucket reads ---')
def bucket(df_, col, bins, labels, target='sog'):
    df_ = df_.dropna(subset=[col]).copy()
    df_['b'] = pd.cut(df_[col], bins=bins, labels=labels, include_lowest=True)
    t = df_.groupby('b', observed=True).agg(n=(target, 'size'), avg=(target, 'mean'), p2=('sog', lambda s: (s >= 2).mean()), p3=('sog', lambda s: (s >= 3).mean()), p_goal=('g1', 'mean'))
    return t
print('\n  a) By LAST SEASON SOG/game bucket -> this season actual:')
print(bucket(withls, 'ls_sog_pg', [0, 1, 1.5, 2, 2.5, 3, 3.5, 10], ['<1', '1-1.5', '1.5-2', '2-2.5', '2.5-3', '3-3.5', '3.5+']).to_string(float_format=lambda v: f'{v:.2f}'))
print('\n  b) By season-to-date SOG avg bucket (prior games this season):')
print(bucket(base, 'p_sog_avg', [0, 0.99, 1.99, 2.99, 3.99, 20], ['<1', '1-2', '2-3', '3-4', '4+']).to_string(float_format=lambda v: f'{v:.2f}'))
print('\n  c) Hot hand: LAST GAME SOG bucket -> next game, with the player''s last-season SOG/game as the baseline:')
hh = withls.dropna(subset=['p_sog_l1']).copy()
hh['b'] = pd.cut(hh.p_sog_l1, [-1, 0, 1, 2, 3, 4, 20], labels=['0', '1', '2', '3', '4', '5+'])
t = hh.groupby('b', observed=True).agg(n=('sog', 'size'), next_sog=('sog', 'mean'), ls_baseline=('ls_sog_pg', 'mean'), p3=('sog', lambda s: (s >= 3).mean()))
t['next_minus_baseline'] = t.next_sog - t.ls_baseline
print(t.to_string(float_format=lambda v: f'{v:.2f}'))
print('\n  d) Scored last game? -> P(1+ goal) next game, with the player''s last-season goals/game as the baseline:')
gg = withls.dropna(subset=['p_g_l1']).copy()
gg['b'] = np.where(gg.p_g_l1 >= 2, '2+ goals', np.where(gg.p_g_l1 == 1, '1 goal', '0 goals'))
t = gg.groupby('b').agg(n=('g1', 'size'), p_goal_next=('g1', 'mean'), goals_next=('g', 'mean'), ls_goals_pg=('ls_g_pg', 'mean'), ls_xg_pg=('ls_xg_pg', 'mean'))
print(t.to_string(float_format=lambda v: f'{v:.3f}'))
print('\n  e) By LAST SEASON xG/game bucket -> P(1+ goal) this season:')
print(bucket(withls, 'ls_xg_pg', [0, 0.1, 0.2, 0.3, 0.4, 0.5, 2], ['<.10', '.10-.20', '.20-.30', '.30-.40', '.40-.50', '.50+'], 'g').to_string(float_format=lambda v: f'{v:.3f}'))
print('\n  f) By opponent LAST SEASON SOG allowed/game bucket -> SOG per skater-game (all rows):')
print(bucket(d, 'opp_ls_sa_pg', [0, 26, 27, 28, 29, 30, 40], ['<26', '26-27', '27-28', '28-29', '29-30', '30+']).to_string(float_format=lambda v: f'{v:.3f}'))
print('\n  g) By opponent this-season SOG allowed/game (prior games only) -> SOG per skater-game:')
print(bucket(d[d.opp_n_prior >= 1], 'opp_sa_pg', [0, 22, 25, 28, 31, 60], ['<22', '22-25', '25-28', '28-31', '31+']).to_string(float_format=lambda v: f'{v:.3f}'))
print('\n  h) Home vs away, back-to-back (all rows):')
print(d.groupby('home').agg(n=('sog', 'size'), sog=('sog', 'mean'), p_goal=('g1', 'mean')).to_string(float_format=lambda v: f'{v:.3f}'))
print(d[d.rest_days.notna()].groupby('b2b').agg(n=('sog', 'size'), sog=('sog', 'mean'), p_goal=('g1', 'mean')).to_string(float_format=lambda v: f'{v:.3f}'))

# ------------------------------------------------------------------ 5. goals ladder
print('\n--- 5. Goals: grouped 5-fold CV Poisson models for goals; ll1 = log loss of P(1+ goal), brier1 likewise ---')
gl = [
    ('intercept only', [], base),
    ('season-to-date goals/game', ['p_g_avg'], base),
    ('last game goals', ['p_g_l1'], base),
    ('season-to-date SOG avg', ['p_sog_avg'], base),
    ('season-to-date iSCF avg', ['p_iscf_avg'], base),
    ('season-to-date iHDCF avg', ['p_ihdcf_avg'], base),
    ('season-to-date SH%', ['p_shpct'], base),
    ('LAST SEASON goals/game', ['ls_g_pg'], withls),
    ('LAST SEASON xG/game', ['ls_xg_pg'], withls),
    ('LAST SEASON SOG/game', ['ls_sog_pg'], withls),
    ('LAST SEASON SH%', ['ls_shpct'], withls),
    ('LAST SEASON xG/game + SH%', ['ls_xg_pg', 'ls_shpct'], withls),
    ('LAST SEASON xG/game + goals above xG/game', ['ls_xg_pg', 'ls_gax_pg'], withls),
    ('LAST SEASON xG/game + season-to-date SOG avg', ['ls_xg_pg', 'p_sog_avg'], withls),
    ('LAST SEASON xG/game + season-to-date goals/game', ['ls_xg_pg', 'p_g_avg'], withls),
    ('LAST SEASON xG/game + season-to-date iSCF avg', ['ls_xg_pg', 'p_iscf_avg'], withls),
    ('LAST SEASON xG + sTD SOG + sTD TOI', ['ls_xg_pg', 'p_sog_avg', 'p_toi_avg'], withls),
    ('goal core + home', ['ls_xg_pg', 'p_sog_avg', 'p_toi_avg', 'home'], withls),
    ('goal core + opp LAST SEASON xGA/game', ['ls_xg_pg', 'p_sog_avg', 'p_toi_avg', 'opp_ls_xga_pg'], withls),
    ('goal core + opp LAST SEASON GA/game', ['ls_xg_pg', 'p_sog_avg', 'p_toi_avg', 'opp_ls_ga_pg'], withls),
    ('goal core + opp this-season GA/game (prior)', ['ls_xg_pg', 'p_sog_avg', 'p_toi_avg', 'opp_ga_pg'], withenv),
    ('goal core + opp this-season goals allowed to position (prior)', ['ls_xg_pg', 'p_sog_avg', 'p_toi_avg', 'opp_pos_g_pg'], withenv),
    ('goal core (same rows as the two above)', ['ls_xg_pg', 'p_sog_avg', 'p_toi_avg'], withenv),
]
res = []
for name, cols, df_ in gl:
    r = poisson_cv(df_, cols, 'g'); r['model'] = name; res.append(r)
res = pd.DataFrame(res)[['model', 'n', 'dev', 'll1', 'brier1']]
print(res.to_string(index=False, float_format=lambda v: f'{v:.4f}'))
res.to_csv(path.replace('.csv', '-goal-ladder.csv'), index=False)
print('\n   Full-sample Poisson fit, goals ~ last-season xG/game + sTD SOG avg + sTD TOI avg + home + opp LS xGA/game:')
m, n = fit_poisson(withls, ['ls_xg_pg', 'p_sog_avg', 'p_toi_avg', 'home', 'opp_ls_xga_pg'], 'g')
print(pd.DataFrame({'coef': m.params, 'z': m.tvalues, 'p': m.pvalues}).to_string(float_format=lambda v: f'{v:.3f}'), f'   (n={n})')

# ------------------------------------------------------------------ 6. H2H
print('\n--- 6. Head-to-head: prior meetings vs this opponent (this season) ---')
hv = d[d.h2h_n >= 1].copy()
print(f'  rows with a prior meeting this season: {len(hv)} (of {len(d)})')
if len(hv) >= 30:
    hv = hv[hv.ls_sog_pg.notna()]
    for col, nm in [('h2h_sog_avg', 'H2H SOG avg'), ('h2h_g_avg', 'H2H goals avg')]:
        print(f'  {nm}: Spearman with this game SOG = {stats.spearmanr(hv[col], hv.sog).correlation:.3f}, with goals = {stats.spearmanr(hv[col], hv.g).correlation:.3f}  (n={len(hv)})')
    # does H2H add anything beyond the player's own baseline?
    for cols, nm in [(['ls_sog_pg', 'p_sog_avg'], 'baseline'), (['ls_sog_pg', 'p_sog_avg', 'h2h_sog_avg'], 'baseline + H2H SOG')]:
        m, n = fit_poisson(hv, cols, 'sog'); print(f'  SOG ~ {nm}: deviance {m.deviance:.1f} (n={n})', {k: round(v, 3) for k, v in m.params.items()})
    for cols, nm in [(['ls_xg_pg', 'p_sog_avg'], 'baseline'), (['ls_xg_pg', 'p_sog_avg', 'h2h_g_avg'], 'baseline + H2H goals')]:
        m, n = fit_poisson(hv, cols, 'g'); print(f'  goals ~ {nm}: deviance {m.deviance:.1f} (n={n})', {k: round(v, 3) for k, v in m.params.items()})
    sc = hv[hv.h2h_g >= 1]
    print(f'  skaters who had scored vs this opp earlier this season: n={len(sc)}, P(1+ goal) in the rematch = {sc.g1.mean():.3f} vs their last-season goals/game {sc.ls_g_pg.mean():.3f} and the league P(1+ goal) {d.g1.mean():.3f}')

# ------------------------------------------------------------------ 7. windows (needs a deep season)
deep = withls[withls.n_prior >= 20].copy()
if len(deep) >= 500:
    print(f'\n--- 7. Which window? Skaters with 20+ prior games this season (n={len(deep)}), CV Poisson for SOG ---')
    res = []
    for name, cols in [('last game', ['p_sog_l1']), ('L3', ['p_sog_l3']), ('L5', ['p_sog_l5']), ('L10', ['p_sog_l10']), ('season-to-date', ['p_sog_avg']),
                       ('last season', ['ls_sog_pg']), ('season-to-date + last season', ['p_sog_avg', 'ls_sog_pg']),
                       ('L5 + season-to-date', ['p_sog_l5', 'p_sog_avg']), ('L10 + season-to-date', ['p_sog_l10', 'p_sog_avg']),
                       ('L5 + season-to-date + last season', ['p_sog_l5', 'p_sog_avg', 'ls_sog_pg']),
                       ('season-to-date SOG + sTD iCF', ['p_sog_avg', 'p_icf_avg']), ('sTD SOG + sTD iCF + sTD TOI', ['p_sog_avg', 'p_icf_avg', 'p_toi_avg']),
                       ('sTD SOG + sTD iCF + L5 TOI', ['p_sog_avg', 'p_icf_avg', 'p_toi_l5']),
                       ('sTD SOG + sTD iCF + L5 TOI + home + opp LS SOG allowed', ['p_sog_avg', 'p_icf_avg', 'p_toi_l5', 'home', 'opp_ls_sa_pg']),
                       ('sTD SOG + sTD iCF + L5 TOI + home + opp sTD SOG allowed', ['p_sog_avg', 'p_icf_avg', 'p_toi_l5', 'home', 'opp_sa_pg']),
                       ('sTD SOG + sTD iCF + L5 TOI + home + opp sTD SOG allowed to position', ['p_sog_avg', 'p_icf_avg', 'p_toi_l5', 'home', 'opp_pos_sog_pg']),
                       ('... + b2b + rest', ['p_sog_avg', 'p_icf_avg', 'p_toi_l5', 'home', 'opp_sa_pg', 'b2b', 'rest_days'])]:
        r = poisson_cv(deep, cols, 'sog'); r['model'] = name; res.append(r)
    res = pd.DataFrame(res)[['model', 'n', 'dev', 'mae', 'll2', 'll3']]
    print(res.to_string(index=False, float_format=lambda v: f'{v:.4f}'))
    m, n = fit_poisson(deep, ['p_sog_l5', 'p_sog_avg', 'ls_sog_pg', 'p_icf_avg', 'p_toi_l5', 'home', 'opp_sa_pg', 'b2b'], 'sog')
    print('   full fit:'); print(pd.DataFrame({'coef': m.params, 'z': m.tvalues, 'p': m.pvalues}).to_string(float_format=lambda v: f'{v:.3f}'))
    print(f'\n   Goals, same skaters: CV Poisson')
    res = []
    for name, cols in [('season-to-date goals/game', ['p_g_avg']), ('L5 goals', ['p_g_l5']), ('L10 goals', ['p_g_l10']), ('season-to-date SOG', ['p_sog_avg']), ('season-to-date iSCF', ['p_iscf_avg']), ('season-to-date iHDCF', ['p_ihdcf_avg']),
                       ('last season xG/game', ['ls_xg_pg']), ('last season goals/game', ['ls_g_pg']),
                       ('sTD SOG + sTD iSCF', ['p_sog_avg', 'p_iscf_avg']), ('sTD SOG + sTD iSCF + sTD goals', ['p_sog_avg', 'p_iscf_avg', 'p_g_avg']),
                       ('sTD SOG + sTD iSCF + LS xG', ['p_sog_avg', 'p_iscf_avg', 'ls_xg_pg']), ('sTD SOG + sTD iSCF + LS xG + sTD goals', ['p_sog_avg', 'p_iscf_avg', 'ls_xg_pg', 'p_g_avg']),
                       ('sTD SOG + sTD iSCF + LS xG + sTD goals + LS SH%', ['p_sog_avg', 'p_iscf_avg', 'ls_xg_pg', 'p_g_avg', 'ls_shpct']),
                       ('... + home + opp sTD GA + opp LS xGA', ['p_sog_avg', 'p_iscf_avg', 'ls_xg_pg', 'p_g_avg', 'ls_shpct', 'home', 'opp_ga_pg', 'opp_ls_xga_pg']),
                       ('... + b2b', ['p_sog_avg', 'p_iscf_avg', 'ls_xg_pg', 'p_g_avg', 'ls_shpct', 'home', 'opp_ga_pg', 'opp_ls_xga_pg', 'b2b'])]:
        r = poisson_cv(deep, cols, 'g'); r['model'] = name; res.append(r)
    res = pd.DataFrame(res)[['model', 'n', 'dev', 'll1', 'brier1']]
    print(res.to_string(index=False, float_format=lambda v: f'{v:.4f}'))
    m, n = fit_poisson(deep, ['p_sog_avg', 'p_iscf_avg', 'ls_xg_pg', 'p_g_avg', 'ls_shpct', 'home', 'opp_ga_pg', 'opp_ls_xga_pg', 'b2b'], 'g')
    print('   full fit:'); print(pd.DataFrame({'coef': m.params, 'z': m.tvalues, 'p': m.pvalues}).to_string(float_format=lambda v: f'{v:.3f}'))

# ------------------------------------------------------------------ 8. H2H deep dive (full season)
hv = d[(d.h2h_n >= 1) & (d.n_prior >= 5)].copy()
if len(hv) >= 2000:
    print(f'\n--- 8. H2H deep dive: rows with a prior meeting this season and 5+ prior games (n={len(hv)}) ---')
    hv['b'] = pd.cut(hv.h2h_g, [-1, 0, 1, 2, 3, 99], labels=['0', '1', '2', '3', '4+'])
    t = hv.groupby('b', observed=True).agg(n=('g1', 'size'), meetings=('h2h_n', 'mean'), p_goal=('g1', 'mean'), goals=('g', 'mean'), sTD_goals_pg=('p_g_avg', 'mean'), ls_goals_pg=('ls_g_pg', 'mean'), sog=('sog', 'mean'), sTD_sog=('p_sog_avg', 'mean'))
    t['goals_minus_sTD'] = t.goals - t.sTD_goals_pg
    print('  a) goals scored vs this opponent in EARLIER meetings this season -> this meeting (sTD = the player\'s season-to-date rate going in):')
    print(t.to_string(float_format=lambda v: f'{v:.3f}'))
    hv['bs'] = pd.cut(hv.h2h_sog_avg, [-1, 0.99, 1.99, 2.99, 3.99, 99], labels=['<1', '1-2', '2-3', '3-4', '4+'])
    t = hv.groupby('bs', observed=True).agg(n=('sog', 'size'), sog=('sog', 'mean'), sTD_sog=('p_sog_avg', 'mean'), p3=('sog', lambda s: (s >= 3).mean()))
    t['sog_minus_sTD'] = t.sog - t.sTD_sog
    print('  b) SOG avg vs this opponent in earlier meetings -> this meeting:')
    print(t.to_string(float_format=lambda v: f'{v:.3f}'))
    print('  c) Does H2H add anything once the player\'s own season-to-date rate is in? (full-sample Poisson, z-scores)')
    for cols, nm, tg in [(['p_g_avg', 'p_sog_avg', 'ls_xg_pg'], 'goals ~ sTD goals + sTD SOG + LS xG', 'g'),
                         (['p_g_avg', 'p_sog_avg', 'ls_xg_pg', 'h2h_g_avg'], 'goals ~ same + H2H goals/meeting', 'g'),
                         (['p_g_avg', 'p_sog_avg', 'ls_xg_pg', 'h2h_g_avg', 'h2h_sog_avg'], 'goals ~ same + H2H goals + H2H SOG', 'g'),
                         (['p_sog_avg', 'p_icf_avg', 'ls_sog_pg'], 'SOG ~ sTD SOG + sTD iCF + LS SOG', 'sog'),
                         (['p_sog_avg', 'p_icf_avg', 'ls_sog_pg', 'h2h_sog_avg'], 'SOG ~ same + H2H SOG/meeting', 'sog')]:
        m, n = fit_poisson(hv, cols, tg)
        print(f'     {nm}: CV ', {k: round(v, 4) for k, v in poisson_cv(hv, cols, tg).items() if k in ('dev', 'll1', 'll2', 'll3')}, ' z:', {k: round(v, 2) for k, v in m.tvalues.items() if k != 'const'})
    # the literal question: multi-goal games vs a team, then the rematch
    hot = hv[hv.h2h_g >= 2]
    print(f"  d) skaters with 2+ goals vs this opponent in earlier meetings: n={len(hot)}, P(1+ goal) in the next meeting {hot.g1.mean():.3f}, goals {hot.g.mean():.3f}, their season-to-date goals/game {hot.p_g_avg.mean():.3f}, Poisson P(1+) at that rate {(1-np.exp(-hot.p_g_avg)).mean():.3f}")
    hot = hv[hv.h2h_g >= 3]
    print(f"     3+ goals: n={len(hot)}, P(1+ goal) next meeting {hot.g1.mean():.3f}, goals {hot.g.mean():.3f}, season-to-date goals/game {hot.p_g_avg.mean():.3f}, Poisson P(1+) {(1-np.exp(-hot.p_g_avg)).mean():.3f}")
    hot = hv[(hv.h2h_g >= 2) & (hv.h2h_n == 1)]
    print(f"     2+ goals in ONE meeting then the rematch: n={len(hot)}, P(1+ goal) {hot.g1.mean():.3f}, goals {hot.g.mean():.3f}, season-to-date goals/game {hot.p_g_avg.mean():.3f}, Poisson P(1+) {(1-np.exp(-hot.p_g_avg)).mean():.3f}")

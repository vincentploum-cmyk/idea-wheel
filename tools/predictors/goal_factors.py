"""Which of the model's four goal factors weighs heaviest — the opponent's environment, the
skater's own venue split, his hot streak, his head-to-head record — on top of his own
season-to-date goal rate. This season's data only: every read on a row comes from games
before it in the same season (build_rows.py), no previous-season blend anywhere.

Rows: skaters (C / LW / RW / D) with `min prior` games this season (so a venue split and a
last five exist) against opponents with 5+ games. Four readings of the same question:
  1. each factor alone: Spearman with goals, AUC for 1+ goal, P(1+ goal) by fifth;
  2. a Poisson fit on the log features (the study's form): his rate, then + one factor, then
     all of them, then all minus one (cross-validated by slate), coefficients with z, and the
     swing each factor gives P(1+ goal) between its 10th and 90th percentile for a median
     skater — the weight in the model's own currency, a multiplier on λ;
  3. as filters, the way picks are made: the slate's top 20 by his rate alone, by his rate ×
     one factor, by one factor alone, by the fitted model — share that scored;
  4. tiers: his rate tier × the factor's third, P(1+ goal) and the lift over the tier's mean,
     with the model's own cuts (hot = L5 goals > 1.45 × season, the board's flame = 3+ in L5,
     scored last game, home ice, a goal against them already this season).

Usage: python3 -I tools/predictors/goal_factors.py <rows.csv> <label> [min prior games=10] [bootstrap=300]
Writes <stem>-goal-factors-*.csv beside the rows. numpy + pandas only.
"""
import sys, numpy as np, pandas as pd
import warnings; warnings.filterwarnings('ignore')
rows_path, label = sys.argv[1], sys.argv[2]
MIN_PRIOR = int(sys.argv[3]) if len(sys.argv) > 3 else 10
BOOT = int(sys.argv[4]) if len(sys.argv) > 4 else 300
stem = rows_path[:-4]
pd.set_option('display.width', 230); pd.set_option('display.max_columns', 40)
f3 = lambda v: f'{v:.3f}'

d = pd.read_csv(rows_path)
d = d[d.pos.isin(['C', 'LW', 'RW', 'D'])].copy()
d = d[(d.n_prior >= MIN_PRIOR) & (d.opp_n_prior >= 5) & d.p_g_avg.notna() & d.opp_pos_g_per.notna()].copy()
d['g1'] = (d.g >= 1).astype(int)
d['p_g_venue'] = d.p_g_venue.fillna(d.p_g_avg)
d['venue_ratio'] = (d.p_g_venue + 0.1) / (d.p_g_avg + 0.1)
d['streak_ratio'] = (d.p_g_l5 + 0.1) / (d.p_g_avg + 0.1)
d['hot_model'] = (d.p_g_l5 > 1.45 * d.p_g_avg) & (d.p_g_l5 * 5 >= 2)
d['flame'] = d.p_g_l5 * 5 >= 3
d['scored_last'] = d.p_g_l1 >= 1
d['h2h_any'] = d.h2h_n >= 1
d['h2h_ratio'] = np.where(d.h2h_any, (d.h2h_g_avg.fillna(0) + 0.1) / (d.p_g_avg + 0.1), 1.0)
pos_mean = d.groupby('pos').opp_pos_g_per.transform('mean')
d['env_rel'] = d.opp_pos_g_per / pos_mean          # the opponent's row over the league's at his position
lg = lambda s, e: np.log(np.clip(s, 0, None) + e)
d['x_base'] = lg(d.p_g_avg, 0.05); d['x_env'] = lg(d.opp_pos_g_per, 0.1)
d['x_venue'] = np.log(d.venue_ratio); d['x_streak'] = np.log(d.streak_ratio); d['x_h2h'] = np.log(d.h2h_ratio)
d['x_home'] = d.home.astype(float); d['x_h2h_any'] = d.h2h_any.astype(float)
for p_ in ('LW', 'RW', 'D'): d[f'x_pos_{p_}'] = (d.pos == p_).astype(float)   # position fixed effects: every factor is read within the position
POS_FX = ['x_pos_LW', 'x_pos_RW', 'x_pos_D']
d['tier'] = pd.qcut(d.p_g_avg.rank(method='first'), 3, labels=['low', 'mid', 'high'])

print(f'=== {label}: {len(d):,} skater-games with {MIN_PRIOR}+ prior games, {d.date.nunique()} slates, {d.date.min()} to {d.date.max()}; '
      f'P(1+ goal) {d.g1.mean():.3f}, goals / game {d.g.mean():.3f}; a meeting already this season on {d.h2h_any.mean():.0%} of rows')

# ---------------------------------------------------------------- helpers
def auc(score, y):
    s = pd.Series(np.asarray(score, float)).rank(method='average').values; y = np.asarray(y) == 1
    n1 = y.sum(); n0 = (~y).sum()
    return (s[y].sum() - n1 * (n1 + 1) / 2) / (n1 * n0) if n1 and n0 else np.nan
def spearman(a, b):
    return np.corrcoef(pd.Series(a).rank().values, pd.Series(b).rank().values)[0, 1]
def fit(X, y):
    b = np.zeros(X.shape[1]); b[0] = np.log(max(y.mean(), 1e-3)); H = None
    for _ in range(60):
        eta = X @ b; mu = np.exp(np.clip(eta, -12, 4)); z = eta + (y - mu) / mu
        XtW = X.T * mu; H = XtW @ X + 1e-9 * np.eye(X.shape[1])
        nb = np.linalg.solve(H, XtW @ z); done = np.max(np.abs(nb - b)) < 1e-10; b = nb
        if done: break
    return b, np.sqrt(np.diag(np.linalg.inv(H)))
def scored(mu, y):
    y1 = (y >= 1).astype(float); p1 = 1 - np.exp(-mu); p = np.clip(p1, 1e-6, 1 - 1e-6)
    with np.errstate(divide='ignore', invalid='ignore'):
        dev = 2 * np.mean(np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / mu), 0) - (y - mu))
    return dict(dev=dev, brier=np.mean((p1 - y1) ** 2), logloss=-np.mean(y1 * np.log(p) + (1 - y1) * np.log(1 - p)))
dates = np.array(sorted(d.date.unique())); fold_of = dict(zip(dates, np.random.default_rng(11).integers(0, 5, len(dates)))); folds = d.date.map(fold_of).values
def design(cols): return np.column_stack([np.ones(len(d))] + [d[c].values.astype(float) for c in cols])
def cv(cols):
    X = design(cols); y = d.g.values.astype(float); mu = np.zeros(len(d))
    for i in range(5):
        tr = folds != i; b, _ = fit(X[tr], y[tr]); mu[~tr] = np.exp(np.clip(X[~tr] @ b, -12, 4))
    return scored(mu, y), mu

# ---------------------------------------------------------------- 1. each factor alone
print('\n--- 1. Each factor alone (raw read): Spearman with goals, AUC for 1+ goal, P(1+ goal) by fifth of the read (lowest → highest) ---')
FACTORS = [('his season-to-date goal rate', 'p_g_avg'), ('environment: opp goals allowed per skater at his position', 'opp_pos_g_per'),
           ('environment: opp row over the league\'s at his position', 'env_rel'), ('environment: opp goals allowed a game (team)', 'opp_ga_pg'), ('environment: opp goals to the position, last 10', 'opp_pos_g_l10'),
           ('venue: his goal rate at tonight\'s venue', 'p_g_venue'), ('venue: his venue rate over his season rate', 'venue_ratio'),
           ('hot streak: his last-5 goal rate', 'p_g_l5'), ('hot streak: his last 5 over his season rate', 'streak_ratio'), ('scored last game', 'p_g_l1'),
           ('head-to-head: his goals a game vs them this season (meetings only)', 'h2h_g_avg'), ('head-to-head: vs them over his season rate (meetings only)', 'h2h_ratio')]
if 'pls_h2h_g' in d and d.pls_h2h_n.gt(0).any():
    d['pls_h2h_g_avg'] = d.pls_h2h_g / d.pls_h2h_n.replace(0, np.nan)
    FACTORS.append(('head-to-head: his goals a game vs them LAST season (for the record)', 'pls_h2h_g_avg'))
uni = []
for nm, c in FACTORS:
    m = d[c].notna() & np.isfinite(d[c]) if c != 'h2h_ratio' else d.h2h_any
    s = d.loc[m]
    if len(s) < 50: continue
    q = pd.qcut(s[c].rank(method='first'), 5, labels=False)
    fifths = s.groupby(q).g1.mean().values
    uni.append(dict(factor=nm, n=len(s), rho_goals=spearman(s[c], s.g), auc_1g=auc(s[c], s.g1), **{f'q{i + 1}': fifths[i] for i in range(5)}, lift_q5_q1=fifths[4] - fifths[0]))
uni = pd.DataFrame(uni); print(uni.to_string(index=False, float_format=f3)); uni.to_csv(f'{stem}-goal-factors-alone.csv', index=False)

# ---------------------------------------------------------------- 2. the Poisson fit: ladder, ablation, coefficients, swings
print('\n--- 2a. Poisson on the log features, cross-validated by slate: his rate, + one factor, all four, all minus one (lower is better) ---')
ONE = {'environment (opp goals per skater at his position)': ['x_env'], 'venue (his venue rate / season rate)': ['x_venue'], 'hot streak (his L5 / season rate)': ['x_streak'],
       'head-to-head (vs them / season rate, + met flag)': ['x_h2h', 'x_h2h_any'], 'home ice': ['x_home']}
ALL = ['x_env', 'x_venue', 'x_streak', 'x_h2h', 'x_h2h_any', 'x_home']
rows = []
base, _ = cv(['x_base'] + POS_FX); rows.append(dict(model='his rate alone (+ position)', **base))
for nm, cols in ONE.items():
    r, _ = cv(['x_base'] + POS_FX + cols); rows.append(dict(model=f'+ {nm}', **r))
full, mu_full = cv(['x_base'] + POS_FX + ALL); rows.append(dict(model='his rate + all four + home', **full))
for nm, cols in ONE.items():
    r, _ = cv(['x_base'] + POS_FX + [c for c in ALL if c not in cols]); rows.append(dict(model=f'all minus {nm}', **r))
nobase, _ = cv(POS_FX + ALL); rows.append(dict(model='all four + home WITHOUT his rate (+ position)', **nobase))
lad = pd.DataFrame(rows); lad['dev_gain_vs_rate'] = base['dev'] - lad.dev; lad['brier_gain_vs_rate'] = base['brier'] - lad.brier
print(lad.to_string(index=False, float_format=lambda v: f'{v:.5f}')); lad.to_csv(f'{stem}-goal-factors-ladder.csv', index=False)
d['mu_full'] = mu_full

print('\n--- 2b. The full fit: coefficient (elasticity on λ), z, and the swing P(1+ goal) makes between the factor\'s 10th and 90th percentile for a median skater (others at their medians) ---')
NAMES = {'x_base': 'his season-to-date goal rate', 'x_env': 'environment: opp goals per skater at his position', 'x_env_l10': 'environment: opp goals to his position, last 10 (per game)',
         'x_venue': 'venue: his venue rate / season rate', 'x_streak': 'hot streak: his L5 / season rate', 'x_h2h': 'head-to-head: vs them / season rate',
         'x_h2h_any': 'head-to-head: has met them this season', 'x_home': 'home ice'}
EPS = {'x_base': 0.05, 'x_env': 0.1, 'x_env_l10': 0.1}
def swing_table(dd, cols):
    X = np.column_stack([np.ones(len(dd))] + [dd[c].values.astype(float) for c in cols]); y = dd.g.values.astype(float); b, se = fit(X, y)
    med = np.concatenate([[1.0], np.median(X[:, 1:], axis=0)]); met = dd.h2h_any.values; out = []
    for i, c in enumerate(cols, start=1):
        if c in POS_FX: continue
        lo, hi = (0.0, 1.0) if c in ('x_home', 'x_h2h_any') else np.percentile(X[met, i] if c == 'x_h2h' else X[:, i], [10, 90])
        pp = []
        for v in (lo, hi):
            x = med.copy(); x[i] = v; pp.append(1 - np.exp(-np.exp(x @ b)))
        raw = (lambda v: np.exp(v) - EPS.get(c, 0)) if c not in ('x_home', 'x_h2h_any') else (lambda v: v)
        out.append(dict(factor=NAMES[c], n=len(dd), coef=b[i], z=b[i] / se[i], p10=raw(lo), p90=raw(hi), lambda_mult_p10_to_p90=np.exp(b[i] * (hi - lo)), p1g_at_p10=pp[0], p1g_at_p90=pp[1], swing_pts=100 * (pp[1] - pp[0])))
    return pd.DataFrame(out).sort_values('swing_pts', key=abs, ascending=False)
sw = swing_table(d, ['x_base'] + ALL + POS_FX)
print(sw.to_string(index=False, float_format=f3)); sw.to_csv(f'{stem}-goal-factors-swing.csv', index=False)

print('\n--- 2c. The same fit where the opponent had 30+ games behind its table (a mature read), and with the position\'s last-10 goals allowed in place of the season table ---')
d['x_env_l10'] = lg(d.opp_pos_g_l10, 0.1)
for title, m, cols in (('opponent 30+ games, season table', d.opp_n_prior >= 30, ['x_base'] + ALL + POS_FX),
                       ('opponent 30+ games, position last-10 table', (d.opp_n_prior >= 30) & d.opp_pos_g_l10.notna(), ['x_base', 'x_env_l10'] + ALL[1:] + POS_FX),
                       ('all rows, position last-10 table', d.opp_pos_g_l10.notna(), ['x_base', 'x_env_l10'] + ALL[1:] + POS_FX)):
    if m.sum() < 500: continue
    t = swing_table(d[m], cols); print(f'\n   {title}: {int(m.sum()):,} rows'); print(t.to_string(index=False, float_format=f3))

# ---------------------------------------------------------------- 3. as filters
print('\n--- 3. As filters: the slate\'s top 20 by each read, share that scored 1+ goal (slates with 20+ rated skaters); paired bootstrap vs his rate alone ---')
rng = np.random.default_rng(3); jit = rng.uniform(0, 1e-9, len(d))
SC = {'his rate alone': d.p_g_avg, 'his rate × environment (opp row / league at his position)': (d.p_g_avg + 0.05) * d.env_rel,
      'his rate × venue ratio': (d.p_g_avg + 0.05) * d.venue_ratio, 'his rate × streak ratio': (d.p_g_avg + 0.05) * d.streak_ratio,
      'his rate × head-to-head ratio': (d.p_g_avg + 0.05) * d.h2h_ratio, 'the fitted model (rate + all four + home, out of fold)': d.mu_full,
      'environment alone': d.env_rel, 'venue rate alone': d.p_g_venue, 'last-5 goal rate alone': d.p_g_l5, 'head-to-head goals vs them alone (no meeting = 0)': d.h2h_g_avg.fillna(0),
      'his L5 over season (streak ratio) alone': d.streak_ratio}
per = {}
for nm, s in SC.items():
    d['_s'] = s.values + jit
    hits = {}
    for date, g in d.groupby('date'):
        if len(g) < 20: continue
        hits[date] = g.nlargest(20, '_s').g1.mean()
    per[nm] = pd.Series(hits)
per = pd.DataFrame(per).dropna()
ref = per['his rate alone'].values
boot = {nm: [] for nm in per.columns}
idx = np.arange(len(per))
for _ in range(BOOT):
    smp = rng.choice(idx, len(idx), replace=True)
    for nm in per.columns: boot[nm].append(per[nm].values[smp].mean() - ref[smp].mean())
filt = pd.DataFrame([dict(read=nm, slates=len(per), top20_hit=per[nm].mean(), vs_rate=per[nm].mean() - ref.mean(), ci_lo=np.percentile(boot[nm], 2.5), ci_hi=np.percentile(boot[nm], 97.5)) for nm in per.columns]).sort_values('top20_hit', ascending=False)
print(filt.to_string(index=False, float_format=f3)); filt.to_csv(f'{stem}-goal-factors-filters.csv', index=False)
print(f'   the slate\'s base rate (any rated skater): {d.g1.mean():.3f}')

# ---------------------------------------------------------------- 4. tiers × the model's own cuts
print('\n--- 4. His rate tier (thirds of season-to-date goal rate) × each factor: P(1+ goal), n, and the lift in points over the tier\'s mean ---')
tier_mean = d.groupby('tier', observed=True).g1.mean()
def table(col, labels, title):
    t = d.groupby(['tier', col], observed=True).g1.agg(['mean', 'size']).rename(columns={'mean': 'p', 'size': 'n'}).reset_index()
    t['lift_pts'] = 100 * (t.p - t.tier.map(tier_mean).astype(float))
    piv = t.pivot(index='tier', columns=col, values=['n', 'p', 'lift_pts'])
    print(f'\n   {title}'); print(piv.to_string(float_format=f3))
    return t.assign(cut=title)
tabs = []
d['env_third'] = d.groupby('pos').env_rel.transform(lambda s: pd.qcut(s.rank(method='first'), 3, labels=['tight third', 'middle', 'soft third']))
tabs.append(table('env_third', None, 'environment: the opponent\'s goals allowed per skater at his position, third among the teams'))
d['venue_cut'] = np.select([d.venue_ratio < 0.75, d.venue_ratio > 1.33], ['scores less here', 'scores more here'], 'about the same')
tabs.append(table('venue_cut', None, 'venue: his goal rate at tonight\'s venue against his season rate'))
tabs.append(table('home', None, 'home ice (0 = away, 1 = home)'))
d['streak_cut'] = np.select([d.flame, d.hot_model, d.p_g_l5 == 0], ['flame: 3+ in L5', 'hot: L5 > 1.45 × season', 'cold: none in L5'], 'normal')
tabs.append(table('streak_cut', None, 'hot streak: the model\'s spike cut and the board\'s flame'))
tabs.append(table('scored_last', None, 'scored last game (False / True)'))
d['h2h_cut'] = np.select([~d.h2h_any, d.h2h_g.fillna(0) == 0], ['no meeting yet', 'met, no goal vs them'], 'met, scored vs them')
tabs.append(table('h2h_cut', None, 'head-to-head this season'))
pd.concat(tabs).to_csv(f'{stem}-goal-factors-tiers.csv', index=False)
print('\n   tier means:', ', '.join(f'{k} {v:.3f}' for k, v in tier_mean.items()),
      '| tier edges (season goal rate):', ', '.join(f'{k} ≤ {v:.2f}' for k, v in d.groupby("tier", observed=True).p_g_avg.max().items()))

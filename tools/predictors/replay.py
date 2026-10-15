"""Could we have called it? Candidate formulas for a skater's shots and goals, fitted on a
finished season (the control) and replayed leak-free on every skater-game of the season under
test, then graded against the box scores: deviance, Brier of P(2+ / 3+ / 4+ SOG) and P(1+ goal),
calibration by band, the picks-board rule (every skater over the floor per game), the slate's
top-10 shooters and scorers, and the literal question: when a skater had 5+ shots or 2+ goals,
where did the formula have him on the slate before puck drop?

The site's own plain-rate read (lib/nhl-data/picks-pure.js, SHOTS_FIT / GOALS_FIT) is replayed
with its fixed coefficients as the yardstick; every other formula is refitted on the control.

argv: <control rows.csv> <target rows.csv> <label> [second control rows.csv]
Writes <target>-replay.csv (one row per skater-game with every formula's λ and probabilities,
for explain.py) and <target>-replay-*.csv tables.
"""
import sys, os, warnings, numpy as np, pandas as pd, statsmodels.api as sm
from scipy import stats
warnings.filterwarnings('ignore')
pd.set_option('display.width', 240); pd.set_option('display.max_rows', 400)
sys.path.insert(0, os.path.dirname(__file__))
from features import derive

ctl_path, tgt_path, label = sys.argv[1:4]
ctl2_path = sys.argv[4] if len(sys.argv) > 4 else None
ctl = derive(pd.read_csv(ctl_path)); tgt = derive(pd.read_csv(tgt_path))
ctl2 = derive(pd.read_csv(ctl2_path)) if ctl2_path else None
stem = tgt_path[:-4]

# the site's fixed coefficients today (lib/nhl-data/picks-pure.js)
SITE_S = dict(const=-1.932, sog=0.8231, icf=0.1601, home=0.0392, team=0.5366)
SITE_G = dict(const=-1.2315, g=0.5818, iscf=0.5498, sog=0.155, home=0.0467)
def site_shots(d):
    return np.exp(SITE_S['const'] + SITE_S['sog'] * d.log_site_sog + SITE_S['icf'] * d.log_site_icf + SITE_S['home'] * d.home + SITE_S['team'] * np.log(np.clip(d.opp_sa_pg.fillna(27), 0.05, None)))
def site_goals(d):
    return np.exp(SITE_G['const'] + SITE_G['g'] * d.log_site_g + SITE_G['iscf'] * d.log_site_iscf + SITE_G['sog'] * d.log_site_sog + SITE_G['home'] * d.home)

# candidate formulas: name -> columns (Poisson log-link, fitted on the control)
SHOTS = {
    'S0 site today (fixed coefficients)': None,
    'S1 site refit: blend SOG + blend iCF + home + opp team SA this season': ['log_bl_sog', 'log_bl_icf', 'home', 'log_opp_sa_pg'],
    'S2 core + home + opp team SA blended across seasons': ['log_bl_sog', 'log_bl_icf', 'log_toi_l5_or_bl', 'home', 'log_opp_sa_blend'],
    'S3 core + home + opp per-skater position SA blended': ['log_bl_sog', 'log_bl_icf', 'log_toi_l5_or_bl', 'home', 'log_opp_pos_sog_per_blend'],
    'S4 S3 + opp team SA blended': ['log_bl_sog', 'log_bl_icf', 'log_toi_l5_or_bl', 'home', 'log_opp_pos_sog_per_blend', 'log_opp_sa_blend'],
    'S5 S3 + slot read blended': ['log_bl_sog', 'log_bl_icf', 'log_toi_l5_or_bl', 'home', 'log_opp_pos_sog_per_blend', 'log_opp_slot_sog_blend'],
    'S6 S3 + back-to-back + opp back-to-back': ['log_bl_sog', 'log_bl_icf', 'log_toi_l5_or_bl', 'home', 'log_opp_pos_sog_per_blend', 'b2b', 'opp_b2b'],
    'S7 S3 without TOI': ['log_bl_sog', 'log_bl_icf', 'home', 'log_opp_pos_sog_per_blend'],
    'S8 S3 + last game SOG (hot hand)': ['log_bl_sog', 'log_bl_icf', 'log_toi_l5_or_bl', 'home', 'log_opp_pos_sog_per_blend', 'p_sog_l1'],
    'S9 S3 + L5 SOG': ['log_bl_sog', 'log_bl_icf', 'log_toi_l5_or_bl', 'home', 'log_opp_pos_sog_per_blend', 'p_sog_l5'],
    'S* SITE SHAPE: S3 + back-to-back on the site\'s own inputs (stored rows as last season)': ['log_site_sog', 'log_site_icf', 'log_site_toi_l5', 'home', 'log_opp_pos_sog_per_blend', 'b2b'],
}
GOALS = {
    'G0 site today (fixed coefficients)': None,
    'G1 site refit: blend G + blend iSCF + blend SOG + home': ['log_bl_g', 'log_bl_iscf', 'log_bl_sog', 'home'],
    'G2 G1 + opp goals per skater at the position, blended across seasons': ['log_bl_g', 'log_bl_iscf', 'log_bl_sog', 'home', 'log_opp_pos_g_per_blend'],
    'G3 G1 + opp goals to the position AND slot, blended': ['log_bl_g', 'log_bl_iscf', 'log_bl_sog', 'home', 'log_opp_slot_g_blend'],
    'G4 G2 + opposing starter save % (blended)': ['log_bl_g', 'log_bl_iscf', 'log_bl_sog', 'home', 'log_opp_pos_g_per_blend', 'gk_svpct_blend'],
    'G5 G4 + back-to-back': ['log_bl_g', 'log_bl_iscf', 'log_bl_sog', 'home', 'log_opp_pos_g_per_blend', 'gk_svpct_blend', 'b2b'],
    'G6 G2 + opp team SA blended (volume environment)': ['log_bl_g', 'log_bl_iscf', 'log_bl_sog', 'home', 'log_opp_pos_g_per_blend', 'log_opp_sa_blend'],
    'G7 G2 + last season xG + SH%': ['log_bl_g', 'log_bl_iscf', 'log_bl_sog', 'home', 'log_opp_pos_g_per_blend', 'ls_xg_pg', 'ls_shpct'],
    'G8 G2 + L5 goals (hot streak)': ['log_bl_g', 'log_bl_iscf', 'log_bl_sog', 'home', 'log_opp_pos_g_per_blend', 'p_g_l5'],
    'G9 G2 + H2H goals last season': ['log_bl_g', 'log_bl_iscf', 'log_bl_sog', 'home', 'log_opp_pos_g_per_blend', 'pls_h2h_g'],
    'G* SITE SHAPE: G2 + back-to-back on the site\'s own inputs': ['log_site_g', 'log_site_iscf', 'log_site_sog', 'home', 'log_opp_pos_g_per_blend', 'b2b'],
}

def fit(df, cols, target):
    df = df.dropna(subset=cols + [target]); X = sm.add_constant(df[cols].astype(float), has_constant='add')
    return sm.GLM(df[target].astype(float), X, family=sm.families.Poisson()).fit(), len(df)

def predict(m, df, cols):
    X = sm.add_constant(df[cols].astype(float), has_constant='add')
    ok = X.notna().all(axis=1)
    out = pd.Series(np.nan, index=df.index); out[ok] = np.clip(m.predict(X[ok]), 0.02, 15)
    return out

def grade(y, lam, target):
    ok = lam.notna() & y.notna(); y = y[ok].astype(float).values; lam = lam[ok].values
    dev = 2 * np.mean(np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / lam), 0) - (y - lam))
    out = dict(n=int(ok.sum()), dev=dev, mae=np.mean(np.abs(y - lam)), mean_pred=lam.mean(), mean_actual=y.mean())
    for k in ([2, 3, 4] if target == 'sog' else [1, 2]):
        p = np.clip(1 - stats.poisson.cdf(k - 1, lam), 1e-4, 1 - 1e-4); hit = (y >= k).astype(float)
        out[f'll{k}'] = -np.mean(hit * np.log(p) + (1 - hit) * np.log(1 - p)); out[f'brier{k}'] = np.mean((hit - p) ** 2)
    return out

# the rows every formula can score: a prior game this season is not required (the blend falls back to last season)
base_t = tgt[tgt.bl_sog.notna() & tgt.bl_g.notna()].copy()
site_rows = tgt.site_sog.notna() & tgt.site_g.notna()
print(f'rows the site itself would rate (a 10-game base last season or 5 games this season): {int(site_rows.sum())}')
print(f'=== {label}: replay on {len(base_t)} skater-games ({tgt.gameId.nunique()} games; {len(tgt) - len(base_t)} rows without any rate dropped) ===')
print(f'control: {ctl_path} ({len(ctl)} rows)' + (f'; second control {ctl2_path}' if ctl2 is not None else ''))

fits = {}
def run(family, target):
    rows = []
    for name, cols in family.items():
        if cols is None:
            lam = site_shots(base_t) if target == 'sog' else site_goals(base_t)
            fits[name] = None
            base_t[f'lam_{name.split()[0]}'] = lam
            r = grade(base_t[target], lam, target); r['formula'] = name; r['fit_n'] = 0; rows.append(r); continue
        else:
            if any(c not in ctl or c not in base_t for c in cols): continue
            m, n = fit(ctl, cols, target); fits[name] = (m, cols, n)
            lam = predict(m, base_t, cols)
        key = name.split()[0]
        base_t[f'lam_{key}'] = lam
        r = grade(base_t[target], lam, target); r['formula'] = name; r['fit_n'] = fits[name][2] if fits[name] else 0
        if fits[name]:
            m, cols, _ = fits[name]
            r['coef'] = ' '.join(f'{c}={m.params[c]:+.3f}' for c in ['const'] + cols)
            if ctl2 is not None and all(c in ctl2 for c in cols):
                m2, _ = fit(ctl2, cols, target)
                r['coef_2nd_control'] = ' '.join(f'{m2.params[c]:+.3f}' for c in ['const'] + cols)
                lam2 = predict(m2, base_t, cols); r['dev_fit_on_2nd'] = grade(base_t[target], lam2, target)['dev']
        rows.append(r)
    t = pd.DataFrame(rows)
    return t

ts = run(SHOTS, 'sog')
print('\n--- SHOTS: formulas fitted on the control, graded on this season (lower is better; mean_pred vs mean_actual = overall level) ---')
print(ts[['formula', 'n', 'dev', 'mae', 'brier2', 'brier3', 'brier4', 'll3', 'mean_pred', 'mean_actual']].to_string(index=False, float_format=lambda v: f'{v:.4f}'))
print('\n   coefficients (control fit; second control in brackets):')
for r in ts.itertuples():
    if isinstance(r.coef, str): print(f'   {r.formula}\n      {r.coef}' + (f'\n      [{r.coef_2nd_control}]  deviance when fitted on the second control instead: {r.dev_fit_on_2nd:.4f}' if hasattr(r, 'coef_2nd_control') and isinstance(r.coef_2nd_control, str) else ''))
ts.to_csv(f'{stem}-replay-shots.csv', index=False)

tg = run(GOALS, 'g')
print('\n--- GOALS: formulas fitted on the control, graded on this season ---')
print(tg[['formula', 'n', 'dev', 'brier1', 'll1', 'brier2', 'mean_pred', 'mean_actual']].to_string(index=False, float_format=lambda v: f'{v:.4f}'))
print('\n   coefficients:')
for r in tg.itertuples():
    if isinstance(r.coef, str): print(f'   {r.formula}\n      {r.coef}' + (f'\n      [{r.coef_2nd_control}]  deviance fitted on the second control: {r.dev_fit_on_2nd:.4f}' if hasattr(r, 'coef_2nd_control') and isinstance(r.coef_2nd_control, str) else ''))
tg.to_csv(f'{stem}-replay-goals.csv', index=False)

print('\n--- The site-shape coefficients, for lib/nhl-data/picks-pure.js (fitted on the control; the second control in brackets) ---')
for key, fam in (('S*', SHOTS), ('G*', GOALS)):
    name = next(k for k in fam if k.startswith(key)); m, cols, nfit = fits[name]
    print(f'   {name} (n={nfit}):')
    print('      ' + ', '.join(f'{c}: {m.params[c]:.4f}' for c in ['const'] + cols))
    print('      z: ' + ', '.join(f'{c} {m.tvalues[c]:+.1f}' for c in cols))
    if ctl2 is not None:
        m2, _ = fit(ctl2, cols, 'sog' if key == 'S*' else 'g')
        print('      [' + ', '.join(f'{m2.params[c]:.4f}' for c in ['const'] + cols) + ']')
    # the same formula fitted on both controls pooled
    both = pd.concat([ctl, ctl2]) if ctl2 is not None else ctl
    mp, npool = fit(both, cols, 'sog' if key == 'S*' else 'g')
    print(f'      pooled two seasons (n={npool}): ' + ', '.join(f'{c}: {mp.params[c]:.4f}' for c in ['const'] + cols))
    ok = base_t[cols].notna().all(axis=1)
    lam_pool = predict(mp, base_t, cols); r = grade(base_t['sog' if key == 'S*' else 'g'], lam_pool, 'sog' if key == 'S*' else 'g')
    print(f'      graded on this season: dev {r["dev"]:.4f}, mean_pred {r["mean_pred"]:.3f} vs actual {r["mean_actual"]:.3f}, n {r["n"]}')
    base_t[f'lam_{key}pool'] = lam_pool

# ---------------------------------------------------------------- choose the formulas to read the rest with
full_s = ts[ts.n == ts.n.max()]; full_g = tg[tg.n == tg.n.max()]
best_s = full_s.sort_values('dev').iloc[0]; best_g = full_g.sort_values('dev').iloc[0]
print('\n   (formulas scored on fewer rows are not comparable on deviance; the best is chosen among those scoring every row)')
print(f'\nbest shots formula on this season: {best_s.formula}; best goals formula: {best_g.formula}')
# everything below reads the site-shape formulas fitted on both controls (what ships), on the rows the site rates
BS, BG = 'S*pool', 'G*pool'
base_t = base_t[base_t[f'lam_{BS}'].notna() & base_t[f'lam_{BG}'].notna() & base_t.lam_S0.notna() & base_t.lam_G0.notna()].copy()
print(f'the sections below grade the site-shape formulas (pooled fit) against the site today, on the {len(base_t)} rows the site rates')
for key in ('S0', BS):
    lam = base_t[f'lam_{key}']
    for k in (2, 3, 4, 5): base_t[f'p{k}s_{key}'] = 1 - stats.poisson.cdf(k - 1, lam)
for key in ('G0', BG):
    lam = base_t[f'lam_{key}']
    base_t[f'p1g_{key}'] = 1 - np.exp(-lam); base_t[f'p2g_{key}'] = 1 - stats.poisson.cdf(1, lam)

# ---------------------------------------------------------------- calibration by band
def calib(p, hit, edges):
    b = pd.cut(p, edges, include_lowest=True)
    t = pd.DataFrame(dict(b=b, p=p, hit=hit)).groupby('b', observed=True).agg(n=('hit', 'size'), stated=('p', 'mean'), hit=('hit', 'mean'))
    t['diff_pts'] = 100 * (t.hit - t.stated)
    return t
print(f'\n--- Calibration on this season: P(3+ SOG) by stated band, site today (S0) vs {BS} ---')
print(pd.concat([calib(base_t[f'p3s_S0'], (base_t.sog >= 3).astype(float), [0, .1, .2, .3, .4, .5, .6, .7, 1]).add_prefix('S0_'),
                 calib(base_t[f'p3s_{BS}'], (base_t.sog >= 3).astype(float), [0, .1, .2, .3, .4, .5, .6, .7, 1]).add_prefix(f'{BS}_')], axis=1).to_string(float_format=lambda v: f'{v:.3f}'))
print(f'\n--- Calibration: P(1+ goal) by stated band, site today (G0) vs {BG} ---')
print(pd.concat([calib(base_t[f'p1g_G0'], base_t.g1.astype(float), [0, .1, .15, .2, .25, .3, .35, .4, .5, 1]).add_prefix('G0_'),
                 calib(base_t[f'p1g_{BG}'], base_t.g1.astype(float), [0, .1, .15, .2, .25, .3, .35, .4, .5, 1]).add_prefix(f'{BG}_')], axis=1).to_string(float_format=lambda v: f'{v:.3f}'))
print(f'\n--- λ shots by band: is the top compressed? ({BS}) ---')
lb = pd.cut(base_t[f'lam_{BS}'], [0, .75, 1, 1.5, 2, 2.5, 3, 3.5, 4, 10])
print(base_t.groupby(lb, observed=True).agg(n=('sog', 'size'), lam=(f'lam_{BS}', 'mean'), actual=('sog', 'mean'), p3_stated=(f'p3s_{BS}', 'mean'), p3_hit=('sog', lambda s: (s >= 3).mean()), p4_stated=(f'p4s_{BS}', 'mean'), p4_hit=('sog', lambda s: (s >= 4).mean())).to_string(float_format=lambda v: f'{v:.3f}'))

# ---------------------------------------------------------------- by games played and by position
print(f'\n--- Brier of P(3+ SOG) and P(1+ goal) by the skater\'s prior games this season (S0 vs {BS}; G0 vs {BG}) ---')
base_t['np_b'] = pd.cut(base_t.n_prior, [-1, 0, 2, 4, 6, 99], labels=['0', '1-2', '3-4', '5-6', '7+'])
rows = []
for b, sub in base_t.groupby('np_b', observed=True):
    rows.append(dict(prior_games=b, n=len(sub), S0_brier3=np.mean(((sub.sog >= 3) - sub.p3s_S0) ** 2), **{f'{BS}_brier3': np.mean(((sub.sog >= 3) - sub[f'p3s_{BS}']) ** 2)},
                     G0_brier1=np.mean((sub.g1 - sub.p1g_G0) ** 2), **{f'{BG}_brier1': np.mean((sub.g1 - sub[f'p1g_{BG}']) ** 2)}))
print(pd.DataFrame(rows).to_string(index=False, float_format=lambda v: f'{v:.4f}'))
rows = []
for b, sub in base_t.groupby('pos'):
    rows.append(dict(pos=b, n=len(sub), S0_brier3=np.mean(((sub.sog >= 3) - sub.p3s_S0) ** 2), **{f'{BS}_brier3': np.mean(((sub.sog >= 3) - sub[f'p3s_{BS}']) ** 2)},
                     sog_pred=sub[f'lam_{BS}'].mean(), sog_actual=sub.sog.mean(), G0_brier1=np.mean((sub.g1 - sub.p1g_G0) ** 2), **{f'{BG}_brier1': np.mean((sub.g1 - sub[f'p1g_{BG}']) ** 2)}, g_pred=sub[f'lam_{BG}'].mean(), g_actual=sub.g.mean()))
print(pd.DataFrame(rows).to_string(index=False, float_format=lambda v: f'{v:.4f}'))

# ---------------------------------------------------------------- the picks board rule, replayed
def board(df, pcol, hitcol, floor, k_min=3, k_max=4):
    """Per game: everyone over the floor, three to four a table (fill-ins under the floor), as PicksPanel lists them."""
    out = []
    for gid, g in df.groupby('gameId'):
        g = g.sort_values(pcol, ascending=False)
        over = int((g[pcol] >= floor).sum()); take = g.head(min(k_max, max(k_min, over))).copy(); take['under'] = take[pcol] < floor
        out.append(take)
    return pd.concat(out)
print(f'\n--- The picks board replayed: every skater over the floor per game (3+ SOG at 50%, 1+ goal at 35%), fill-ins to three marked under ---')
for key, pcol, hitfn, floor, nm in [('S0', 'p3s_S0', lambda d: d.sog >= 3, 0.5, 'site today, 3+ SOG'), (BS, f'p3s_{BS}', lambda d: d.sog >= 3, 0.5, f'{BS}, 3+ SOG'),
                                      ('G0', 'p1g_G0', lambda d: d.g >= 1, 0.35, 'site today, 1+ goal'), (BG, f'p1g_{BG}', lambda d: d.g >= 1, 0.35, f'{BG}, 1+ goal')]:
    b = board(base_t, pcol, None, floor)
    ov = b[~b.under]; un = b[b.under]
    def line(x, tag):
        if len(x) == 0: return f'      {tag}: none'
        h = hitfn(x).mean(); st = x[pcol].mean()
        return f'      {tag}: {len(x)} calls, stated {st:.3f}, hit {h:.3f} ({100 * (h - st):+.1f} pts), break-even at the stated price {"-" if st >= .5 else "+"}{round(100 * st / (1 - st)) if st >= .5 else round(100 * (1 - st) / st)}'
    print(f'   {nm}:'); print(line(ov, 'over the floor')); print(line(un, 'fill-ins under the floor')); print(line(b, 'all rows shown'))
    # the single best per game
    top1 = b.groupby('gameId').head(1)
    print(line(top1, 'the #1 row in each game'))

# ---------------------------------------------------------------- slate top-10 by P(3+) / P(1+G), and the "would we have had him" question
print(f'\n--- Slate ranking: the top 10 / 20 / 40 skaters by stated probability each slate day, hit rates ({BS} / {BG}; site today in brackets) ---')
base_t['rk_s'] = base_t.groupby('date')[f'p3s_{BS}'].rank(ascending=False, method='first')
base_t['rk_s0'] = base_t.groupby('date')['p3s_S0'].rank(ascending=False, method='first')
base_t['rk_g'] = base_t.groupby('date')[f'p1g_{BG}'].rank(ascending=False, method='first')
base_t['rk_g0'] = base_t.groupby('date')['p1g_G0'].rank(ascending=False, method='first')
base_t['slate_n'] = base_t.groupby('date').sog.transform('size')
for k in (10, 20, 40):
    s = base_t[base_t.rk_s <= k]; s0 = base_t[base_t.rk_s0 <= k]; g = base_t[base_t.rk_g <= k]; g0 = base_t[base_t.rk_g0 <= k]
    print(f'   top {k:2d}: 3+ SOG hit {(s.sog >= 3).mean():.3f} stated {s[f"p3s_{BS}"].mean():.3f} [site {(s0.sog >= 3).mean():.3f} / {s0.p3s_S0.mean():.3f}]   4+ SOG hit {(s.sog >= 4).mean():.3f} stated {s[f"p4s_{BS}"].mean():.3f}   1+ goal hit {g.g1.mean():.3f} stated {g[f"p1g_{BG}"].mean():.3f} [site {g0.g1.mean():.3f} / {g0.p1g_G0.mean():.3f}]   (n={len(s)})')
print(f'   whole slate: 3+ SOG {(base_t.sog >= 3).mean():.3f}, 1+ goal {base_t.g1.mean():.3f}')

big = base_t[base_t.sog >= 5].copy()
print(f'\n--- Every 5+ SOG night this season ({len(big)} of {len(base_t)} skater-games = {100 * len(big) / len(base_t):.1f}%): where the formula had the shooter before puck drop ---')
big['pct_rank'] = 100 * (1 - (big.rk_s - 1) / big.slate_n)
print(f'   in the slate\'s top 10 by P(3+): {(big.rk_s <= 10).mean():.1%}; top 20: {(big.rk_s <= 20).mean():.1%}; top 40: {(big.rk_s <= 40).mean():.1%}; top quarter of the slate: {(big.pct_rank >= 75).mean():.1%}; bottom half: {(big.pct_rank < 50).mean():.1%}')
print(f'   their stated P(3+) averaged {big[f"p3s_{BS}"].mean():.3f}, P(5+) {big[f"p5s_{BS}"].mean():.3f}; the whole slate\'s P(5+) averages {base_t[f"p5s_{BS}"].mean():.3f}')
print(f'   by prior games this season: ' + ', '.join(f'{b}: {len(s)} nights, {(s.rk_s <= 20).mean():.0%} in the top 20' for b, s in big.groupby('np_b', observed=True)))
multi = base_t[base_t.g >= 2].copy()
print(f'\n--- Every 2+ goal night ({len(multi)}): where the formula had the scorer ---')
print(f'   in the slate\'s top 10 by P(1+ goal): {(multi.rk_g <= 10).mean():.1%}; top 20: {(multi.rk_g <= 20).mean():.1%}; top 40: {(multi.rk_g <= 40).mean():.1%}; their stated P(1+) averaged {multi[f"p1g_{BG}"].mean():.3f} vs the slate\'s {base_t[f"p1g_{BG}"].mean():.3f}')
scorers = base_t[base_t.g >= 1]
print(f'   all {len(scorers)} goal-scorer nights: top 10 {(scorers.rk_g <= 10).mean():.1%}, top 20 {(scorers.rk_g <= 20).mean():.1%}, top 40 {(scorers.rk_g <= 40).mean():.1%}; the top 40 is {(40 / base_t.slate_n).mean():.0%} of an average slate')

# the lift from the environment term alone, read as the ShotPropz cheat sheet would: soft / mid / tough third of the blended position read, within tier
print(f'\n--- The cheat-sheet read, graded: the opponent\'s blended per-skater shots allowed to the position (rank thirds within the slate day) x the skater\'s blended SOG tier ---')
sub = base_t.dropna(subset=['opp_pos_sog_per_blend']).copy()
sub['third'] = sub.groupby(['date', 'pos']).opp_pos_sog_per_blend.transform(lambda s: pd.qcut(s.rank(method='first'), 3, labels=['tough', 'mid', 'soft']) if s.notna().sum() >= 6 else pd.Series(['mid'] * len(s), index=s.index))
sub['tier'] = pd.cut(sub.bl_sog, [0, 1.5, 2, 2.5, 3, 20], labels=['<1.5', '1.5-2', '2-2.5', '2.5-3', '3+'])
t = sub.groupby(['tier', 'third'], observed=True).agg(n=('sog', 'size'), sog=('sog', 'mean'), p3=('sog', lambda s: (s >= 3).mean()), p4=('sog', lambda s: (s >= 4).mean())).reset_index()
print(t.pivot(index='tier', columns='third', values=['n', 'sog', 'p3', 'p4']).to_string(float_format=lambda v: f'{v:.3f}'))
sub = base_t.dropna(subset=['opp_pos_g_per_blend']).copy()
sub['third'] = sub.groupby(['date', 'pos']).opp_pos_g_per_blend.transform(lambda s: pd.qcut(s.rank(method='first'), 3, labels=['tough', 'mid', 'soft']) if s.notna().sum() >= 6 else pd.Series(['mid'] * len(s), index=s.index))
sub['tier'] = pd.cut(sub.bl_g, [-1, .15, .25, .35, .5, 9], labels=['<.15', '.15-.25', '.25-.35', '.35-.5', '.5+'])
t = sub.groupby(['tier', 'third'], observed=True).agg(n=('g1', 'size'), p_goal=('g1', 'mean')).reset_index()
print('\n   goals allowed per skater at the position (blended), rank thirds x goal tier: P(1+ goal)')
print(t.pivot(index='tier', columns='third', values=['n', 'p_goal']).to_string(float_format=lambda v: f'{v:.3f}'))

keep = ['date', 'gameId', 'playerId', 'name', 'team', 'opp', 'venue', 'pos', 'boxPos', 'home', 'sog', 'g', 'toi', 'icf', 'iscf', 'n_prior', 'p_slot_l1', 'bl_sog', 'bl_icf', 'bl_g', 'bl_iscf', 'toi_l5_or_bl',
        'p_sog_avg', 'p_sog_l5', 'p_sog_l10', 'ls_sog_pg', 'ls_g_pg', 'ls_xg_pg', 'p_g_avg', 'p_sog_venue', 'pls_sog_same_venue', 'pls_sog_pg',
        'opp_n_prior', 'opp_sa_pg', 'opp_sa_l5', 'opp_sa_pg_venue', 'opp_ls_sa_pg', 'opp_sa_blend', 'opp_pos_sog_pg', 'opp_pos_sog_per', 'opp_pos_sog_l5', 'opp_pos_sog_venue', 'opp_pls_pos_sog_per', 'opp_pos_sog_per_blend',
        'opp_slot_sog_pg', 'opp_pls_slot_sog_pg', 'opp_slot_sog_blend', 'opp_ga_pg', 'opp_pos_g_pg', 'opp_pos_g_per', 'opp_pls_pos_g_per', 'opp_pos_g_per_blend', 'opp_slot_g_blend', 'opp_ls_ga_pg', 'opp_ls_xga_pg',
        'gk_name', 'gk_n', 'gk_std_svpct', 'gk_ls_svpct', 'gk_svpct_blend', 'pace_game_std', 'pace_game_ls', 'rest_days', 'b2b', 'opp_b2b', 'h2h_g', 'pls_h2h_g', 'pls_h2h_sog_avg',
        'rk_s', 'rk_s0', 'rk_g', 'rk_g0', 'slate_n'] + [c for c in base_t if c.startswith(('lam_', 'p2s_', 'p3s_', 'p4s_', 'p5s_', 'p1g_', 'p2g_'))]
base_t[[c for c in keep if c in base_t]].to_csv(f'{stem}-replay.csv', index=False)
print(f'\nwritten {stem}-replay.csv and {stem}-replay-shots.csv / -goals.csv')

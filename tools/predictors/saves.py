"""What predicts a starting goalie's saves: the study on saves_rows.py's rows.

  1. The night as it lands: saves, shots, pulled starts, overtime; how much of saves is shots against.
  2. Every pre-game read alone: Spearman with saves and with shots against (rows with 10+ team games).
  3. Formulas fitted on 2024-25, checked on 2025-26 and on 2026-27 to date: MAE / RMSE / R² of the saves,
     and the Brier score of 22+ / 25+ / 28+ / 30+ saves, beside the site's shape (the opponent's shots × his
     shrunk save %, a normal with SD 6 × save %) and the bettor's read (his saves a start).
  4. The spread: the residual's SD by projection band, the left tail (pulled starts), normal vs the empirical
     residuals, and the calibration of the said chance of each mark.
  5. Against a line set at his own saves a start (no book lines on record before 2026-10-31: a stand-in):
     how often the over landed when the formula sat 1 / 2 / 3 saves above or below his average.

Usage: python3 -I tools/predictors/saves.py <rows.csv> [--out report.md]
"""
import sys

import numpy as np
import pandas as pd
from scipy import stats

rows = sys.argv[1]
out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
R = pd.read_csv(rows)
lines = []
P = lambda *a: lines.append(' '.join(str(x) for x in a))


def tbl(df, floatfmt=3):
    cols = list(df.columns)
    P('| ' + ' | '.join(str(c) for c in cols) + ' |')
    P('|' + '---|' * len(cols))
    for _, r in df.iterrows():
        P('| ' + ' | '.join((f'{v:.{floatfmt}f}' if isinstance(v, (float, np.floating)) else str(v)) for v in r.values) + ' |')
    P('')


R['lg_sf'] = R.lg_sf.fillna(R.lg_sf.mean())
R['t_ls_sa'] = R.t_ls_sa.fillna(R.lg_sf)
R['o_ls_sf'] = R.o_ls_sf.fillna(R.lg_sf)
# derived reads
R['log5'] = R.o_sf_bl * R.t_sa_bl / R.lg_sf  # the opponent's shots × the team's allowed, over the league
R['gmean'] = np.sqrt(R.o_sf_bl * R.t_sa_bl)
R['site_shots'] = R.o_sf_bl  # the board sums the opponent's skaters' λ: their own shots a game, near enough
R['site_lam'] = R.site_shots * R.g_pct_shr
R['gd_diff'] = R.o_p_gd.fillna(0) - R.t_p_gd.fillna(0)  # positive: the opponent is the better side
R['t_ca_bl'] = R.t_p_ca
R['pim_edge'] = R.o_p_opim.fillna(R.o_p_opim.mean())  # the penalties the opponent draws a game
R['g_ls_svps'] = R.ls_svps
R['bettor'] = R.g_sv_ps.where(R.g_starts >= 3, R.ls_svps).fillna(R.sv.mean())

P('# What predicts a goalie\'s saves')
P('')
P(f'{len(R)} starts: ' + ', '.join(f'{s}-{str(s + 1)[2:]} {n}' for s, n in R.groupby("season").size().items()) + '. Every read from games dated before the start.')
P('')
P('## 1. The night as it lands')
P('')
g = R.groupby('season').agg(starts=('sv', 'size'), saves=('sv', 'mean'), sd=('sv', 'std'), shots=('sa', 'mean'), team_sog=('opp_sog', 'mean'), pulled=('pulled', 'mean'), ot=('ot', 'mean'),
                            p25=('sv', lambda s: (s >= 25).mean()), p28=('sv', lambda s: (s >= 28).mean()), p30=('sv', lambda s: (s >= 30).mean())).reset_index()
tbl(g, 3)
full = R[R.pulled == 0]
P(f'Saves against shots faced (starts he finished): r = {np.corrcoef(full.sv, full.sa)[0, 1]:.3f}; the save % that night: r = {np.corrcoef(full.sv, full.sv / full.sa.clip(1))[0, 1]:.3f}. '
  f'Saves = shots × save %: the variance of saves is {np.var(full.sv):.1f}; shots alone at the league\'s .900 leaves {np.var(full.sv - 0.9 * full.sa):.1f}.')
P('')
P(f'Pulled (left a regulation game before 50 minutes): {R.pulled.mean():.1%} of starts, {R[R.pulled == 1].sv.mean():.1f} saves on average against {R[R.pulled == 0].sv.mean():.1f}. Overtime: {R[R.ot == 1].sv.mean() - R[R.ot == 0].sv.mean():+.1f} saves.')
P('')
P(f'Home {R[R.home == 1].sv.mean():.2f} / away {R[R.home == 0].sv.mean():.2f} saves; home {R[R.home == 1].sa.mean():.2f} / away {R[R.home == 0].sa.mean():.2f} shots.')
P('')

# 2. univariate
P('## 2. Each read alone (rows where both teams have 10+ games this season)')
P('')
D = R[(R.t_p_games >= 10) & (R.o_p_games >= 10)].copy()
feats = {
    'o_p_sf': 'opponent shots a game, season', 'o_p_sf_l5': 'opponent shots, last 5', 'o_p_sf_l10': 'opponent shots, last 10', 'o_p_sf_l20': 'opponent shots, last 20', 'o_v_sf': 'opponent shots at tonight\'s venue',
    'o_p_cf': 'opponent attempts a game', 'o_p_ff': 'opponent unblocked attempts', 'o_p_scf': 'opponent chances', 'o_p_hdcf': 'opponent high-danger chances', 'o_ls_sf': 'opponent shots, last season',
    't_p_sa': 'his team shots allowed, season', 't_p_sa_l5': 'team shots allowed, last 5', 't_p_sa_l10': 'team shots allowed, last 10', 't_p_sa_l20': 'team shots allowed, last 20', 't_v_sa': 'team shots allowed at the venue',
    't_p_ca': 'team attempts allowed', 't_p_fa': 'team unblocked allowed', 't_p_sca': 'team chances allowed', 't_ls_sa': 'team shots allowed, last season',
    'log5': 'opponent × team ÷ league (blended)', 'gmean': 'geometric mean (blended)', 'o_sf_bl': 'opponent shots, blended', 't_sa_bl': 'team allowed, blended',
    'g_sv_ps': 'his saves a start', 'g_sv_l5': 'his saves, last 5', 'g_sv_l10': 'his saves, last 10', 'g_sa_ps': 'his shots faced a start', 'g_pct': 'his save %, raw', 'g_pct_shr': 'his save %, shrunk (site)', 'g_ls_pct': 'his save %, last season',
    'site_lam': 'site shape: opponent shots × shrunk save %', 'gd_diff': 'opponent goal diff − team goal diff', 't_p_gd': 'team goal diff a game', 'o_p_gd': 'opponent goal diff a game',
    'o_p_opim': 'penalties the opponent draws (PIM a game)', 't_p_pim': 'his team\'s PIM a game', 'arena_idx': 'rink\'s recorded-shots index', 'home': 'home', 't_b2b': 'his team on a back to back', 'o_b2b': 'opponent on a back to back',
    't_rest': 'his team\'s days of rest', 'o_rest': 'opponent\'s days of rest', 'g_pulled_ps': 'his pulled rate this season',
}
res = []
for k, name in feats.items():
    x = D[[k, 'sv', 'sa']].dropna()
    if len(x) < 200:
        continue
    rs = stats.spearmanr(x[k], x.sv)[0]
    ra = stats.spearmanr(x[k], x.sa)[0]
    # bootstrap by date
    res.append(dict(read=name, col=k, n=len(x), rho_saves=rs, rho_shots=ra))
U = pd.DataFrame(res).sort_values('rho_saves', key=abs, ascending=False)
tbl(U[['read', 'n', 'rho_saves', 'rho_shots']], 3)

# 3. formulas: fit on 2024, check 2025 / 2026
P('## 3. Formulas fitted on 2024-25, checked on the seasons after')
P('')
SD_SITE = lambda pct: np.maximum(2, 6 * pct)


def norm_p(lam, sd, k):
    return 1 - stats.norm.cdf((k - 0.5 - lam) / sd)


MARKS = [22, 25, 28, 30]
specs = {
    'his saves a start (bettor)': ['bettor'],
    'opponent shots, blended': ['o_sf_bl'],
    'team allowed, blended': ['t_sa_bl'],
    'opponent + team (blended)': ['o_sf_bl', 't_sa_bl'],
    'log5 (blended)': ['log5'],
    '+ save % shrunk': ['o_sf_bl', 't_sa_bl', 'g_pct_shr'],
    '+ home, arena': ['o_sf_bl', 't_sa_bl', 'g_pct_shr', 'home', 'arena_idx'],
    '+ goal diff': ['o_sf_bl', 't_sa_bl', 'g_pct_shr', 'home', 'arena_idx', 'gd_diff'],
    '+ last 10 windows': ['o_sf_bl', 't_sa_bl', 'g_pct_shr', 'home', 'arena_idx', 'gd_diff', 'o_p_sf_l10', 't_p_sa_l10'],
    '+ attempts': ['o_sf_bl', 't_sa_bl', 'g_pct_shr', 'home', 'arena_idx', 'gd_diff', 'o_p_cf', 't_p_ca'],
    '+ his saves a start': ['o_sf_bl', 't_sa_bl', 'g_pct_shr', 'home', 'arena_idx', 'gd_diff', 'bettor'],
    '+ rest, penalties': ['o_sf_bl', 't_sa_bl', 'g_pct_shr', 'home', 'arena_idx', 'gd_diff', 't_b2b', 'o_b2b', 'o_p_opim', 't_p_pim'],
}


def prep(df, cols):
    X = df[cols].copy()
    for c in cols:
        X[c] = X[c].fillna(R[c].median() if c in R else 0)
    return X


def fit(df, cols):
    X = np.column_stack([np.ones(len(df)), prep(df, cols).values])
    b, *_ = np.linalg.lstsq(X, df.sv.values, rcond=None)
    return b


def predict(df, cols, b):
    return np.column_stack([np.ones(len(df)), prep(df, cols).values]) @ b


train = R[R.season == 2024]
resid_sd = {}
out_rows = []
for name, cols in [('site shape (as shipped)', None)] + list(specs.items()):
    if cols is None:
        b = None
    else:
        b = fit(train, cols)
        resid_sd[name] = np.std(train.sv - predict(train, cols, b))
    for s in (2025, 2026):
        te = R[R.season == s]
        lam = te.site_lam.values if cols is None else predict(te, cols, b)
        sd = SD_SITE(te.g_pct_shr.values) if cols is None else resid_sd[name]
        e = te.sv.values - lam
        row = dict(formula=name, season=s, mae=np.mean(np.abs(e)), rmse=np.sqrt(np.mean(e ** 2)), r2=1 - np.var(e) / np.var(te.sv), bias=np.mean(e))
        for k in MARKS:
            row[f'brier{k}'] = np.mean((norm_p(lam, sd, k) - (te.sv.values >= k)) ** 2)
        out_rows.append(row)
F = pd.DataFrame(out_rows)
for s in (2025, 2026):
    P(f'**{s}-{str(s + 1)[2:]}** ({(R.season == s).sum()} starts; the base rate\'s Brier at 25+ is {np.var(R[R.season == s].sv >= 25):.4f})')
    P('')
    tbl(F[F.season == s].drop(columns='season'), 4)
best_cols = specs['+ goal diff']
b = fit(train, best_cols)
P('Coefficients of "+ goal diff" on 2024-25: ' + ', '.join(f'{c} {v:+.3f}' for c, v in zip(['const'] + best_cols, b)) + f'; residual SD {resid_sd["+ goal diff"]:.2f}.')
P('')
both = R[R.season.isin([2024, 2025])]
b2 = fit(both, best_cols)
P('Refitted on 2024-25 + 2025-26: ' + ', '.join(f'{c} {v:+.3f}' for c, v in zip(['const'] + best_cols, b2)) + f'; residual SD {np.std(both.sv - predict(both, best_cols, b2)):.2f}.')
P('')

# shots model then × save %: does the goalie matter?
P('### Shots first, then the save %')
P('')
sh_cols = ['o_sf_bl', 't_sa_bl', 'home', 'arena_idx', 'gd_diff']
Xs = lambda df: np.column_stack([np.ones(len(df)), prep(df, sh_cols).values])
bs, *_ = np.linalg.lstsq(Xs(train), train.sa.values, rcond=None)
rr = []
for s in (2025, 2026):
    te = R[R.season == s]
    shots = Xs(te) @ bs
    for nm, pct in [('league .900', 0.9), ('his shrunk (site, k=150)', te.g_pct_shr), ('his shrunk toward last season', te.g_pct_shr2), ('his raw this season', te.g_pct.fillna(0.9).clip(0.85, 0.95))]:
        lam = shots * pct
        e = te.sv - lam
        rr.append(dict(season=s, save_pct=nm, mae=np.mean(np.abs(e)), rmse=np.sqrt(np.mean(e ** 2)), bias=e.mean()))
tbl(pd.DataFrame(rr), 4)

# 4. the spread
P('## 4. The spread around the projection')
P('')
te = R[R.season.isin([2025, 2026])].copy()
te['lam'] = predict(te, best_cols, b)
te['e'] = te.sv - te.lam
te['band'] = pd.cut(te.lam, [0, 22, 24, 26, 28, 40])
sp = te.groupby('band', observed=True).agg(n=('e', 'size'), lam=('lam', 'mean'), saves=('sv', 'mean'), sd=('e', 'std'), sd_finished=('e', lambda s: s[te.loc[s.index, 'pulled'] == 0].std()), pulled=('pulled', 'mean')).reset_index()
sp['band'] = sp.band.astype(str)
tbl(sp, 2)
P(f'The residual\'s SD {te.e.std():.2f} (the site uses 6 × save % ≈ {6 * 0.9:.1f}); skew {stats.skew(te.e):.2f}; finished starts only {te[te.pulled == 0].e.std():.2f}.')
P('')
# calibration of the said chance: normal at the fitted SD vs the site's SD vs the empirical residuals
sd_fit = resid_sd['+ goal diff']
emp = (train.sv - predict(train, best_cols, b)).values
cal = []
for k in MARKS:
    hit = (te.sv >= k).values
    p_site = norm_p(te.site_lam.values, SD_SITE(te.g_pct_shr.values), k)
    p_fit = norm_p(te.lam.values, sd_fit, k)
    p_emp = np.array([(emp >= k - 0.5 - l).mean() for l in te.lam.values])
    for nm, p in [('site shape, SD 5.4', p_site), (f'fitted, normal SD {sd_fit:.1f}', p_fit), ('fitted, empirical residuals', p_emp)]:
        cal.append(dict(mark=f'{k}+', read=nm, said=p.mean(), landed=hit.mean(), brier=np.mean((p - hit) ** 2),
                        top_said=p[p >= 0.6].mean() if (p >= 0.6).any() else np.nan, top_landed=hit[p >= 0.6].mean() if (p >= 0.6).any() else np.nan, top_n=int((p >= 0.6).sum())))
tbl(pd.DataFrame(cal), 3)
P('The calls at 60%+ by band of the said chance (fitted, empirical residuals), every mark from 20 to 32 pooled:')
P('')
pool = []
for k in range(20, 33):
    p_emp = np.array([(emp >= k - 0.5 - l).mean() for l in te.lam.values])
    pool.append(pd.DataFrame(dict(p=p_emp, hit=(te.sv >= k).values)))
pool = pd.concat(pool)
pool['band'] = pd.cut(pool.p, [0, .3, .4, .5, .6, .7, .8, 1.0])
tbl(pool.groupby('band', observed=True).agg(n=('hit', 'size'), said=('p', 'mean'), landed=('hit', 'mean')).reset_index().assign(band=lambda d: d.band.astype(str)), 3)

# 5. against his own average
P('## 5. Against a line at his own saves a start (a stand-in for the book)')
P('')
P('Books had no saves lines on record here before 2026-10-31; the usual line sits near the goalie\'s average, so the stand-in is his saves a start this season (3+ starts) rounded to the half below, o24.5 for 24.9. The over hit rate by how far the formula sat from that line:')
P('')
L = te[te.g_starts >= 3].copy()
L['line'] = np.floor(L.g_sv_ps) + 0.5
L['line'] = np.where(L.g_sv_ps - np.floor(L.g_sv_ps) < 0.5, np.floor(L.g_sv_ps) - 0.5, L['line'])
L['gap'] = L.lam - L.line
L['over'] = (L.sv > L.line).astype(int)
L['gapb'] = pd.cut(L.gap, [-20, -3, -2, -1, 0, 1, 2, 3, 20])
tbl(L.groupby('gapb', observed=True).agg(n=('over', 'size'), gap=('gap', 'mean'), over=('over', 'mean'), saves=('sv', 'mean'), line=('line', 'mean')).reset_index().assign(gapb=lambda d: d.gapb.astype(str)), 3)
P(f'Every start: the over at his own average landed {L.over.mean():.1%} ({len(L)} starts). The under is helped by the pulled starts ({L.pulled.mean():.1%}).')
P('')
# team and opponent split: which side matters more
P('### Which side drives it: the opponent\'s shots or the team\'s shots allowed')
P('')
for s in (2025, 2026):
    t2 = R[(R.season == s) & (R.t_p_games >= 10) & (R.o_p_games >= 10)]
    m = stats.spearmanr(t2.o_sf_bl, t2.sa)[0]
    n = stats.spearmanr(t2.t_sa_bl, t2.sa)[0]
    P(f'- {s}-{str(s + 1)[2:]}: opponent\'s shots ρ {m:.3f}, team\'s allowed ρ {n:.3f} with the shots he faced')
P('')
# extremes
P('### The extreme matchups (top / bottom fifth of the fitted projection)')
P('')
te['q'] = pd.qcut(te.lam, 5, labels=['lowest', '2', '3', '4', 'highest'])
tbl(te.groupby('q', observed=True).agg(n=('sv', 'size'), lam=('lam', 'mean'), saves=('sv', 'mean'), p25=('sv', lambda s: (s >= 25).mean()), p28=('sv', lambda s: (s >= 28).mean()), p30=('sv', lambda s: (s >= 30).mean()), pulled=('pulled', 'mean')).reset_index().assign(q=lambda d: d.q.astype(str)), 3)

# 6. the rinks
P('## 6. The rinks: shots credited at home against the same teams on the road')
P('')
last = R.sort_values('date').groupby('arena').tail(1)[['arena', 'date', 'arena_idx']].sort_values('arena_idx', ascending=False)
P(f'The index as of each rink\'s last game in the rows (last season and this, shrunk at {20} home games): 1.03 = the two sides were credited 3% more shots there than the same teams on the road. Highest and lowest five:')
P('')
tbl(pd.concat([last.head(5), last.tail(5)]).rename(columns={'date': 'as of', 'arena_idx': 'index'}), 3)

text = '\n'.join(lines)
if out:
    open(out, 'w').write(text + '\n')
print(text)

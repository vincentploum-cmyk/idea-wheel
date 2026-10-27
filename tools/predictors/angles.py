"""Every angle, scored: which pre-game reads predict a skater's shots and goals, and how much
each adds on top of his own rate. Grouped (by game) 5-fold cross-validated Poisson models, the
gain measured as deviance per row against the same rows; effect sizes from the full fit.

Angles: the skater's own windows (last game, L3, L5, L10, L15, L20, season to date, last
season, two seasons ago, blended), attempts and chances, TOI and its trend, line slot (TOI
rank), venue split (own and last season's), days since his last game; the opponent's totals
by window (L5, L10, L15, season), at tonight's venue, by position (per game and per skater),
by position and slot, last season's table by position / venue / slot, MoneyPuck's last-season
figures; pace (both teams' shots both ways, this season and last); the opposing starter (this
season's save %, last season's save % and GSAx); home ice, back-to-back, rest, games in four
nights; head to head this season and last.

argv: <rows.csv> <label> [min prior games for the skater, default 0]
Writes <rows>-angles-*.csv beside the input and prints the tables.
"""
import sys, warnings, numpy as np, pandas as pd, statsmodels.api as sm
from scipy import stats
from sklearn.model_selection import GroupKFold
warnings.filterwarnings('ignore')
np.random.seed(7)
pd.set_option('display.width', 240); pd.set_option('display.max_rows', 400); pd.set_option('display.max_columns', 40)

path, label = sys.argv[1], sys.argv[2]
MIN_PRIOR = int(sys.argv[3]) if len(sys.argv) > 3 else 0
d = pd.read_csv(path)
stem = path[:-4]

# ---------------------------------------------------------------- derived reads (tools/predictors/features.py)
sys.path.insert(0, __import__('os').path.dirname(__file__))
from features import derive
d = derive(d)

print(f'=== {label}: {len(d)} skater-games, {d.gameId.nunique()} games, {d.playerId.nunique()} skaters; teams have played {d.team_game_no.min()}-{d.team_game_no.max()} games ===')
print(f'league SOG / skater-game {d.sog.mean():.3f}, goals {d.g.mean():.3f}, P(1+ goal) {d.g1.mean():.3f}, P(3+ SOG) {(d.sog >= 3).mean():.3f}')

# ---------------------------------------------------------------- helpers
def cv(df, cols, target, folds=5):
    df = df.dropna(subset=cols + [target])
    if len(df) < 200: return dict(n=len(df), dev=np.nan)
    X = sm.add_constant(df[cols].astype(float), has_constant='add'); y = df[target].values.astype(float); pred = np.zeros(len(df))
    for tr, te in GroupKFold(folds).split(X, y, df.gameId):
        try: pred[te] = np.clip(sm.GLM(y[tr], X.iloc[tr], family=sm.families.Poisson()).fit().predict(X.iloc[te]), 0.02, 15)
        except Exception: pred[te] = y[tr].mean()
    dev = 2 * np.mean(np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / pred), 0) - (y - pred))
    out = dict(n=len(df), dev=dev, mae=np.mean(np.abs(y - pred)))
    for k in ([2, 3, 4] if target == 'sog' else [1]):
        p = np.clip(1 - stats.poisson.cdf(k - 1, pred), 1e-3, 1 - 1e-3); hit = (y >= k).astype(float)
        out[f'll{k}'] = -np.mean(hit * np.log(p) + (1 - hit) * np.log(1 - p)); out[f'brier{k}'] = np.mean((hit - p) ** 2)
    return out

def fit(df, cols, target):
    df = df.dropna(subset=cols + [target]); X = sm.add_constant(df[cols].astype(float), has_constant='add')
    return sm.GLM(df[target].astype(float), X, family=sm.families.Poisson()).fit(), df

def ladder(df, base_cols, angles, target, title, same_rows=True):
    """Base model, then base + each angle, on the rows every angle shares (so gains compare)."""
    need = base_cols + [c for cols in angles.values() for c in cols] if same_rows else base_cols
    sub = df.dropna(subset=[c for c in need if c in df] + [target])
    print(f'\n--- {title} (n={len(sub)}) ---')
    rows = [dict(angle='base: ' + ' + '.join(base_cols), **cv(sub, base_cols, target))]
    b = rows[0]['dev']
    for name, cols in angles.items():
        if any(c not in sub for c in cols): continue
        r = cv(sub, base_cols + cols, target); r['angle'] = name; r['gain'] = b - r['dev']
        m, _ = fit(sub, base_cols + cols, target)
        r['z'] = ' '.join(f'{m.tvalues[c]:+.1f}' for c in cols)
        extra = cols[-1]; sd = sub[extra].std()
        r['pct_per_sd'] = 100 * (np.exp(m.params[extra] * sd) - 1)
        rows.append(r)
    t = pd.DataFrame(rows)
    cols_show = ['angle', 'n', 'dev', 'gain', 'mae'] + (['ll3', 'brier3', 'brier4'] if target == 'sog' else ['ll1', 'brier1']) + ['z', 'pct_per_sd']
    t = t[[c for c in cols_show if c in t]]
    print(t.to_string(index=False, float_format=lambda v: f'{v:.4f}'))
    return t

def forward(df, start, pool, target, max_steps=8, min_gain=0.0005):
    """Greedy forward selection by CV deviance."""
    sub = df.dropna(subset=start + pool + [target])
    cur = list(start); best = cv(sub, cur, target)['dev']; path_ = [('start', best, len(sub))]
    pool = [p for p in pool if p not in cur]
    for _ in range(max_steps):
        trial = [(cv(sub, cur + [p], target)['dev'], p) for p in pool]
        trial.sort()
        if not trial or best - trial[0][0] < min_gain: break
        best, p = trial[0]; cur.append(p); pool.remove(p); path_.append((p, best, len(sub)))
    return cur, path_

# ---------------------------------------------------------------- 0. univariate on the new angles
print('\n--- 0. Spearman correlation of the new angles with the game\'s SOG / goals (rows with the read) ---')
uni = []
for c in ['bl_sog', 'bl_icf', 'bl12_sog', 'p_sog_l5', 'p_sog_l10', 'p_sog_l15', 'p_sog_l20', 'p_sog_avg', 'ls_sog_pg', 'ls2_sog_pg', 'p_sog_venue', 'pls_sog_same_venue', 'pls_venue_ratio',
          'p_slot_l1', 'p_slot_l5', 'p_toi_l1', 'p_toi_l5', 'p_toi_trend', 'p_days_since',
          'opp_sa_pg', 'opp_sa_l5', 'opp_sa_l10', 'opp_sa_l15', 'opp_sa_pg_venue', 'opp_pos_sog_pg', 'opp_pos_sog_per', 'opp_pos_icf_pg', 'opp_pos_iff_pg', 'opp_pos_iscf_pg', 'opp_pos_icf_per', 'opp_pos_iff_per', 'opp_pos_iscf_per', 'opp_pos_sog_l5', 'opp_pos_sog_l10', 'opp_pos_sog_venue', 'opp_slot_sog_pg',
          'opp_pls_pos_sog_pg', 'opp_pls_pos_sog_venue', 'opp_pls_slot_sog_pg', 'opp_ls_sa_pg', 'opp_ls_ca_pg',
          'pace_game_std', 'pace_game_ls', 'pace_opp_std', 'pace_team_std', 'cpace_opp_ls', 'team_sf_pg', 'opp_sf_pg',
          'gk_std_svpct', 'gk_ls_svpct', 'gk_ls_gsax60', 'opp_ga_pg', 'opp_ga_l5', 'opp_ga_pg_venue', 'opp_pos_g_pg', 'opp_pos_g_l5', 'opp_pos_g_venue', 'opp_slot_g_pg', 'opp_pls_pos_g_pg', 'opp_pls_pos_g_venue', 'opp_ls_ga_pg', 'opp_ls_xga_pg',
          'home', 'b2b', 'opp_b2b', 'rest_days', 'games_in_4', 'h2h_g_avg', 'pls_h2h_g', 'pls_h2h_sog_avg', 'bl_g', 'bl12_g', 'ls_xg_pg', 'p_iscf_avg', 'bl_iscf']:
    if c not in d: continue
    m = d[c].notna()
    if m.sum() < 100: continue
    uni.append(dict(angle=c, n=int(m.sum()), rho_sog=stats.spearmanr(d.loc[m, c], d.loc[m, 'sog']).correlation, rho_goal=stats.spearmanr(d.loc[m, c], d.loc[m, 'g']).correlation))
uni = pd.DataFrame(uni)
print(uni.to_string(index=False, float_format=lambda v: f'{v:.3f}'))
uni.to_csv(f'{stem}-angles-univariate.csv', index=False)

# ---------------------------------------------------------------- 1. SOG: the skater's own rate, every window
base = d[(d.n_prior >= max(1, MIN_PRIOR)) & d.ls_sog_pg.notna()].copy()
print(f'\n--- 1. SOG: the skater\'s own rate, which window / prior (rows with a prior game and a last-season record, n={len(base)}) ---')
own = {
    'last game': ['p_sog_l1'], 'L3': ['p_sog_l3'], 'L5': ['p_sog_l5'], 'L10': ['p_sog_l10'], 'season to date': ['p_sog_avg'],
    'last season (MoneyPuck)': ['ls_sog_pg'], 'two-season prior (2:1)': ['ls12_sog_pg'],
    'blend n/(n+18) of season to date + last season': ['log_bl_sog'],
    'blend with the two-season prior': ['bl12_sog'],
    'blend + blended attempts (iCF)': ['log_bl_sog', 'log_bl_icf'],
    'blend + iCF + blended TOI': ['log_bl_sog', 'log_bl_icf', 'log_bl_toi'],
    'blend + iCF + L5 TOI': ['log_bl_sog', 'log_bl_icf', 'log_p_toi_l5'],
    'blend + iCF + last game TOI': ['log_bl_sog', 'log_bl_icf', 'log_p_toi_l1'],
    'blend + iCF + L5 SOG (recent form on top)': ['log_bl_sog', 'log_bl_icf', 'p_sog_l5'],
    'blend + iCF + L10 SOG': ['log_bl_sog', 'log_bl_icf', 'p_sog_l10'],
    'blend + iCF + last game SOG': ['log_bl_sog', 'log_bl_icf', 'p_sog_l1'],
    'blend + iCF + TOI trend (L3 - season)': ['log_bl_sog', 'log_bl_icf', 'p_toi_trend'],
    'blend + iCF + slot last game (1-4)': ['log_bl_sog', 'log_bl_icf', 'slot_l1'],
    'blend + iCF + days since last game': ['log_bl_sog', 'log_bl_icf', 'p_days_since'],
}
rows = []
for name, cols in own.items():
    if any(c not in base for c in cols): continue
    r = cv(base, cols, 'sog'); r['model'] = name; rows.append(r)
t = pd.DataFrame(rows)[['model', 'n', 'dev', 'mae', 'll3', 'brier3', 'brier4']]
print(t.to_string(index=False, float_format=lambda v: f'{v:.4f}'))
t.to_csv(f'{stem}-angles-own-sog.csv', index=False)

# ---------------------------------------------------------------- 2. SOG: environment and situation on top of the player core
core_s = ['log_bl_sog', 'log_bl_icf', 'log_p_toi_l5']
env_s = {
    'home ice': ['home'],
    'back-to-back': ['b2b'], 'opponent on back-to-back': ['opp_b2b'], 'rest days': ['rest_days'], 'games in 4 nights': ['games_in_4'],
    'opp shots allowed / game, season to date': ['log_opp_sa_pg'],
    'opp shots allowed, L5': ['log_opp_sa_l5'], 'opp shots allowed, L10': ['log_opp_sa_l10'], 'opp shots allowed, L15': ['log_opp_sa_l15'],
    'opp shots allowed at tonight\'s venue, season': ['log_opp_sa_pg_venue'],
    'opp shots allowed to the POSITION / game, season': ['log_opp_pos_sog_pg'],
    'opp shots allowed per skater at the position, season': ['log_opp_pos_sog_per'],
    'opp iCF allowed to the POSITION / game, season (the table\'s column)': ['log_opp_pos_icf_pg'],
    'opp iFF allowed to the POSITION / game, season (the table\'s column)': ['log_opp_pos_iff_pg'],
    'opp iSCF allowed to the POSITION / game, season (the table\'s column)': ['log_opp_pos_iscf_pg'],
    'opp iCF allowed per skater at the position, season': ['log_opp_pos_icf_per'],
    'opp iFF allowed per skater at the position, season': ['log_opp_pos_iff_per'],
    'opp iSCF allowed per skater at the position, season': ['log_opp_pos_iscf_per'],
    'opp SOG + iFF allowed per skater at the position, season (both)': ['log_opp_pos_sog_per', 'log_opp_pos_iff_per'],
    'opp SOG + iCF + iFF + iSCF per skater at the position (the lane rule\'s four)': ['log_opp_pos_sog_per', 'log_opp_pos_icf_per', 'log_opp_pos_iff_per', 'log_opp_pos_iscf_per'],
    'opp to the position, L5': ['log_opp_pos_sog_l5'], 'opp to the position, L10': ['log_opp_pos_sog_l10'], 'opp to the position, L15': ['log_opp_pos_sog_l15'],
    'opp to the position at tonight\'s venue': ['log_opp_pos_sog_venue'],
    'opp to the position AND his slot (TOI rank), season': ['log_opp_slot_sog_pg'],
    'opp LAST SEASON to the position (box scores)': ['log_opp_pls_pos_sog_pg'],
    'opp LAST SEASON per skater at the position': ['log_opp_pls_pos_sog_per'],
    'BLEND: position per skater, this season at n/(n+15) over last season': ['log_opp_pos_sog_per_blend'],
    'BLEND: team shots allowed across the seasons': ['log_opp_sa_blend'],
    'BLEND: position and slot across the seasons': ['log_opp_slot_sog_blend'],
    'opp LAST SEASON to the position at the venue': ['log_opp_pls_pos_sog_venue'],
    'opp LAST SEASON to the position and slot': ['log_opp_pls_slot_sog_pg'],
    'opp LAST SEASON shots allowed (MoneyPuck)': ['log_opp_ls_sa_pg'],
    'opp LAST SEASON attempts allowed (MoneyPuck)': ['opp_ls_ca_pg'],
    'pace: both teams\' shots both ways, this season': ['log_pace_game_std'],
    'pace: last season (MoneyPuck)': ['log_pace_game_ls'],
    'pace: the opponent\'s games this season': ['log_pace_opp_std'],
    'pace: own team\'s games this season': ['log_pace_team_std'],
    'own team shots for / game, this season': ['log_team_sf_pg'],
    'own team shots for / game, last season': ['log_team_ls_sf_pg'],
    'opp shots FOR / game (possession proxy)': ['log_opp_sf_pg'],
    'opposing starter: save % this season (shrunk)': ['gk_std_svpct_shr'],
    'opposing starter: save % last season': ['gk_ls_svpct_f'],
    'own venue split: SOG at this venue, this season': ['p_sog_venue'],
    'own venue split: last season\'s ratio at this venue, shrunk': ['pls_venue_ratio_shr'],
    'H2H this season, SOG avg': ['h2h_sog_avg'], 'H2H last season, SOG avg': ['pls_h2h_sog_avg'],
    'position season + team season (both)': ['log_opp_pos_sog_pg', 'log_opp_sa_pg'],
    'position season + slot season (both)': ['log_opp_pos_sog_pg', 'log_opp_slot_sog_pg'],
    'position season + last season\'s position table': ['log_opp_pos_sog_pg', 'log_opp_pls_pos_sog_pg'],
    'position season + home + pace': ['log_opp_pos_sog_pg', 'home', 'log_pace_game_std'],
}
# only rows where every window exists would throw away the early season; run two ladders:
sub_all = base.copy()
t_env = ladder(sub_all, core_s, {k: v for k, v in env_s.items() if not any('l5' in c or 'l10' in c or 'l15' in c or 'venue' in c or 'h2h' in c for c in v)}, 'sog', '2a. SOG: player core + ONE angle, all rows with a prior game', same_rows=True)
t_env.to_csv(f'{stem}-angles-env-sog.csv', index=False)
deep = base[(base.n_prior >= 10) & (base.opp_n_prior >= 15)]
if len(deep) > 2000:
    t_env2 = ladder(deep, core_s, env_s, 'sog', '2b. SOG: player core + ONE angle, skaters with 10+ games and opponents with 15+ (every window defined)', same_rows=True)
    t_env2.to_csv(f'{stem}-angles-env-sog-deep.csv', index=False)
    print('\n   forward selection (deep rows), SOG:')
    pool = ['home', 'b2b', 'opp_b2b', 'log_opp_sa_pg', 'log_opp_pos_sog_pg', 'log_opp_pos_sog_per', 'log_opp_pos_sog_per_blend', 'log_opp_slot_sog_blend', 'log_opp_slot_sog_pg', 'log_opp_pos_sog_l5', 'log_opp_pos_sog_l10', 'log_opp_pos_sog_venue', 'log_opp_sa_pg_venue',
            'log_opp_pls_pos_sog_pg', 'log_opp_ls_sa_pg', 'log_pace_game_std', 'log_pace_game_ls', 'log_team_sf_pg', 'gk_ls_svpct_f', 'p_sog_l5', 'p_sog_l1', 'slot_l1', 'p_toi_trend', 'rest_days', 'pls_venue_ratio_shr', 'log_opp_sf_pg']
    pool = [p for p in pool if p in deep]
    chosen, path_ = forward(deep, core_s, pool, 'sog')
    for p, dev, nn in path_: print(f'     {p:30s} dev {dev:.4f}  (n={nn})')
early = base[(base.n_prior <= 10)]
if len(early) > 2000:
    t_env3 = ladder(early, core_s, {k: v for k, v in env_s.items() if not any('l5' in c or 'l10' in c or 'l15' in c or 'h2h' in c for c in v)}, 'sog', '2c. SOG, EARLY SEASON (skater with 1-10 prior games): player core + ONE angle', same_rows=True)
    t_env3.to_csv(f'{stem}-angles-env-sog-early.csv', index=False)
    print('\n   forward selection (early rows), SOG:')
    pool = ['home', 'b2b', 'log_opp_sa_pg', 'log_opp_pos_sog_pg', 'log_opp_pos_sog_per', 'log_opp_pos_sog_per_blend', 'log_opp_sa_blend', 'log_opp_slot_sog_blend', 'log_opp_slot_sog_pg', 'log_opp_pls_pos_sog_pg', 'log_opp_pls_pos_sog_per', 'log_opp_pls_pos_sog_venue', 'log_opp_pls_slot_sog_pg', 'log_opp_ls_sa_pg', 'log_pace_game_ls', 'log_pace_game_std', 'log_team_ls_sf_pg', 'gk_ls_svpct_f', 'p_sog_l1', 'slot_l1', 'log_p_toi_l1', 'pls_venue_ratio_shr', 'bl12_sog', 'ls12_sog_pg']
    pool = [p for p in pool if p in early]
    chosen, path_ = forward(early, core_s, pool, 'sog')
    for p, dev, nn in path_: print(f'     {p:30s} dev {dev:.4f}  (n={nn})')

# ---------------------------------------------------------------- 3. SOG by position: does the environment read differ by position?
print('\n--- 3. SOG: the position read within each position (gain of opp-to-position season over the player core) ---')
for pos in ('C', 'LW', 'RW', 'D'):
    sub = base[(base.pos == pos)].dropna(subset=core_s + ['log_opp_pos_sog_pg', 'log_opp_sa_pg'])
    if len(sub) < 500: continue
    b = cv(sub, core_s, 'sog')['dev']; p1 = cv(sub, core_s + ['log_opp_pos_sog_pg'], 'sog')['dev']; p2 = cv(sub, core_s + ['log_opp_sa_pg'], 'sog')['dev']
    p3 = cv(sub, core_s + ['log_opp_slot_sog_pg'], 'sog')['dev'] if sub.log_opp_slot_sog_pg.notna().mean() > 0.9 else np.nan
    p4 = cv(sub, core_s + ['log_opp_pos_sog_per'], 'sog')['dev']
    m, _ = fit(sub, core_s + ['log_opp_pos_sog_per'], 'sog')
    print(f'   {pos:2s} n={len(sub):6d}  base {b:.4f}  +position per game {p1:.4f} (gain {b - p1:+.4f})  +position PER SKATER {p4:.4f} (gain {b - p4:+.4f}, z {m.tvalues["log_opp_pos_sog_per"]:+.1f}, elasticity {m.params["log_opp_pos_sog_per"]:.3f})  +team total {p2:.4f} (gain {b - p2:+.4f})  +slot {p3:.4f} (gain {b - p3:+.4f})')

# ---------------------------------------------------------------- 4. goals
print('\n--- 4. GOALS: the skater\'s own rate, which window / prior ---')
gown = {
    'season-to-date goals': ['p_g_avg'], 'L5 goals': ['p_g_l5'], 'L10 goals': ['p_g_l10'],
    'last season goals (MoneyPuck)': ['ls_g_pg'], 'last season xG': ['ls_xg_pg'], 'two-season prior goals': ['ls12_g_pg'],
    'blend n/(n+40) goals': ['log_bl_g'], 'blend with the two-season prior': ['bl12_g'],
    'blend goals + blend SOG': ['log_bl_g', 'log_bl_sog'],
    'blend goals + blend SOG + blend iSCF': ['log_bl_g', 'log_bl_sog', 'log_bl_iscf'],
    'blend goals + blend SOG + iSCF + last season xG': ['log_bl_g', 'log_bl_sog', 'log_bl_iscf', 'ls_xg_pg'],
    '... + last season SH%': ['log_bl_g', 'log_bl_sog', 'log_bl_iscf', 'ls_xg_pg', 'ls_shpct'],
    '... + L5 TOI': ['log_bl_g', 'log_bl_sog', 'log_bl_iscf', 'ls_xg_pg', 'ls_shpct', 'log_p_toi_l5'],
    'goal core + scored last game': ['log_bl_g', 'log_bl_sog', 'log_bl_iscf', 'ls_xg_pg', 'p_g_l1'],
    'goal core + L5 goals (hot streak)': ['log_bl_g', 'log_bl_sog', 'log_bl_iscf', 'ls_xg_pg', 'p_g_l5'],
    'goal core + this-season SH%': ['log_bl_g', 'log_bl_sog', 'log_bl_iscf', 'ls_xg_pg', 'p_shpct'],
}
rows = []
for name, cols in gown.items():
    if any(c not in base for c in cols): continue
    r = cv(base, cols, 'g'); r['model'] = name; rows.append(r)
t = pd.DataFrame(rows)[['model', 'n', 'dev', 'll1', 'brier1']]
print(t.to_string(index=False, float_format=lambda v: f'{v:.4f}'))
t.to_csv(f'{stem}-angles-own-goal.csv', index=False)

core_g = ['log_bl_g', 'log_bl_sog', 'log_bl_iscf', 'ls_xg_pg']
env_g = {
    'home ice': ['home'], 'back-to-back': ['b2b'], 'opponent on back-to-back': ['opp_b2b'], 'rest days': ['rest_days'],
    'opp goals allowed / game, season': ['log_opp_ga_pg'], 'opp goals allowed, L5': ['log_opp_ga_l5'], 'opp goals allowed, L10': ['log_opp_ga_l10'],
    'opp goals allowed at tonight\'s venue': ['log_opp_ga_pg_venue'],
    'opp goals allowed to the POSITION, season': ['log_opp_pos_g_pg'], 'opp goals to the position, L5': ['log_opp_pos_g_l5'], 'opp goals to the position, L10': ['log_opp_pos_g_l10'],
    'opp goals to the position at the venue': ['log_opp_pos_g_venue'],
    'opp goals to the position AND slot': ['log_opp_slot_g_pg'],
    'opp shots allowed to the position, season': ['log_opp_pos_sog_pg'],
    'opp shots allowed / game, season': ['log_opp_sa_pg'],
    'opp LAST SEASON goals to the position (box scores)': ['log_opp_pls_pos_g_pg'],
    'opp LAST SEASON goals per skater at the position': ['log_opp_pls_pos_g_per'],
    'BLEND: goals per skater at the position, this season at n/(n+40) over last': ['log_opp_pos_g_per_blend'],
    'BLEND: goals to the position and slot across the seasons': ['log_opp_slot_g_blend'],
    'BLEND: team goals allowed across the seasons': ['log_opp_ga_blend'],
    'opposing starter: save % blended (this season over last at starts/(starts+20))': ['gk_svpct_blend'],
    'opp LAST SEASON goals to the position at the venue': ['log_opp_pls_pos_g_venue'],
    'opp LAST SEASON goals to the position and slot': ['log_opp_pls_slot_g_pg'],
    'opp LAST SEASON goals allowed (MoneyPuck)': ['log_opp_ls_ga_pg'], 'opp LAST SEASON xGA (MoneyPuck)': ['log_opp_ls_xga_pg'],
    'opposing starter: save % this season (shrunk)': ['gk_std_svpct_shr'], 'opposing starter: save % last season': ['gk_ls_svpct_f'], 'opposing starter: GSAx/60 last season': ['gk_ls_gsax60_f'],
    'starter last season + opp shots to position': ['gk_ls_svpct_f', 'log_opp_pos_sog_pg'],
    'pace this season': ['log_pace_game_std'], 'pace last season': ['log_pace_game_ls'],
    'own team goals for / game, this season': ['team_gf_pg'],
    'own venue split: goals at this venue last season': ['pls_g_same_venue'],
    'H2H goals this season': ['h2h_g_avg'], 'H2H goals last season (count)': ['pls_h2h_g'],
}
t_g = ladder(base, core_g, {k: v for k, v in env_g.items() if not any('l5' in c or 'l10' in c or 'venue' in c or 'h2h' in c for c in v)}, 'g', '5a. GOALS: goal core + ONE angle, all rows with a prior game')
t_g.to_csv(f'{stem}-angles-env-goal.csv', index=False)
deepg = base[(base.n_prior >= 10) & (base.opp_n_prior >= 15)]
if len(deepg) > 2000:
    t_g2 = ladder(deepg, core_g, env_g, 'g', '5b. GOALS: goal core + ONE angle, skaters with 10+ games and opponents with 15+')
    t_g2.to_csv(f'{stem}-angles-env-goal-deep.csv', index=False)
    print('\n   forward selection (deep rows), goals:')
    pool = ['home', 'b2b', 'log_opp_ga_pg', 'log_opp_pos_g_pg', 'log_opp_pos_g_per_blend', 'log_opp_slot_g_blend', 'log_opp_ga_blend', 'gk_svpct_blend', 'log_opp_slot_g_pg', 'log_opp_pos_sog_pg', 'log_opp_sa_pg', 'log_opp_pls_pos_g_pg', 'log_opp_ls_xga_pg', 'gk_std_svpct_shr', 'gk_ls_svpct_f', 'gk_ls_gsax60_f', 'log_pace_game_std', 'ls_shpct', 'p_g_l5', 'p_g_l1', 'log_p_toi_l5', 'slot_l1', 'pls_h2h_g']
    pool = [p for p in pool if p in deepg]
    chosen, path_ = forward(deepg, core_g, pool, 'g', min_gain=0.0002)
    for p, dev, nn in path_: print(f'     {p:30s} dev {dev:.4f}  (n={nn})')
earlyg = base[base.n_prior <= 10]
if len(earlyg) > 2000:
    t_g3 = ladder(earlyg, core_g, {k: v for k, v in env_g.items() if not any('l5' in c or 'l10' in c or 'h2h' in c for c in v)}, 'g', '5c. GOALS, EARLY SEASON (skater with 1-10 prior games): goal core + ONE angle')
    t_g3.to_csv(f'{stem}-angles-env-goal-early.csv', index=False)

# ---------------------------------------------------------------- 6. the "Anderson" cut: the opponent leaks to his position, by goals and by shots
print('\n--- 6. Cheat-sheet cut: opponent\'s rank third for goals / shots allowed to the position (season to date, prior games) x the skater\'s blended goal rate ---')
def tier(v, lo, hi): return np.where(v >= hi, 'high', np.where(v >= lo, 'mid', 'low'))
sub = base.dropna(subset=['opp_pos_g_pg', 'opp_pos_sog_pg', 'bl_g']).copy()
sub = sub[sub.opp_n_prior >= 5]
if len(sub) > 1000:
    # rank the opponent within the slate day by position
    for c, nm in (('opp_pos_g_pg', 'goals'), ('opp_pos_sog_pg', 'shots')):
        sub[f'{nm}_third'] = sub.groupby(['date', 'pos'])[c].transform(lambda s: pd.qcut(s.rank(method='first'), 3, labels=['tough', 'mid', 'soft']) if s.notna().sum() >= 6 else pd.Series(['mid'] * len(s), index=s.index))
    sub['g_tier'] = pd.cut(sub.bl_g, [-1, 0.15, 0.25, 0.35, 0.5, 9], labels=['<.15', '.15-.25', '.25-.35', '.35-.5', '.5+'])
    for nm in ('goals', 'shots'):
        t = sub.groupby(['g_tier', f'{nm}_third'], observed=True).agg(n=('g1', 'size'), p_goal=('g1', 'mean'), exp=('bl_g', lambda s: (1 - np.exp(-s)).mean()), sog=('sog', 'mean')).reset_index()
        t['lift_pts'] = 100 * (t.p_goal - t.exp)
        print(f'\n   opponent {nm} allowed to the position, rank third (within the slate day) x skater goal tier: P(1+ goal) actual vs the blend alone')
        print(t.pivot(index='g_tier', columns=f'{nm}_third', values=['n', 'p_goal', 'lift_pts']).to_string(float_format=lambda v: f'{v:.3f}'))

print('\nwritten', f'{stem}-angles-*.csv')

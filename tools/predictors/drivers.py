"""What drives a skater's shots, goals and points, and when a goal streak carries (Vincent, 2026-11-13: "find out when a
goal hot streak predicts the next game of a goal … see what the drivers are for shots, points and goals. Is it the
environment. Is it toi? How is toi determined? … the l5, l10, l15 season values that must hold true for 3 shots, 4
shots, per position, per line, home and away. Investigate every angle").

  python3 -I tools/predictors/drivers.py <frame.pkl> --out <report.md> --tables <tables.md> [--season 2026] [--boot 200]

The frame is tools/predictors/drivers_frame.py's: every read on a row comes from the games before it. Sections:
  A  the goal streak (and the point / 3+ SOG streak): what happened next against what his numbers said
  B  the drivers: cross-validated Poisson by group of reads, alone / dropped / laddered, and the hindsight ceilings
  C  minutes: what they are made of, what moves them, what they are worth in shots, goals and points
  D  what the L5 / L10 / L15 / season averages must be for 2+ … 5+ SOG, by position, line and venue
  E  every other angle on top of the full read, the shape of the count, the top of the night
  F  the site's plain-rate formula (lib/nhl-data/picks-pure.js) with this season's rate alone against blended into last season's
numpy, pandas, scikit-learn, statsmodels.
"""
import argparse, math, warnings
import numpy as np, pandas as pd
from sklearn.linear_model import PoissonRegressor, LogisticRegression
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
import statsmodels.api as sm
warnings.filterwarnings('ignore')

ap = argparse.ArgumentParser()
ap.add_argument('frame'); ap.add_argument('--out', required=True); ap.add_argument('--tables', required=True)
ap.add_argument('--season', type=int, default=2026); ap.add_argument('--boot', type=int, default=200)
ap.add_argument('--only', default='ABCDEF')
args = ap.parse_args()
rng = np.random.default_rng(7)
d = pd.read_pickle(args.frame).reset_index(drop=True)
CUR = args.season; SEASONS = sorted(d.season.unique()); FIRST = SEASONS[0]
lab = lambda s: f'{s}-{(s + 1) % 100:02d}'

md, tb = [], []
def out(s='', to=None):
    (md if to is None else to).append(s)
    if to is not None and s.startswith('## '): open(args.tables, 'w').write('\n'.join(tb) + '\n')
def fmt(x):
    if isinstance(x, (float, np.floating)): return '' if np.isnan(x) else (f'{x:.0f}' if abs(x) >= 1000 else f'{x:.3f}' if abs(x) < 1 else f'{x:.2f}')
    return str(x)
def table(df, to=None, index=False):
    df = df.reset_index() if index else df
    out('| ' + ' | '.join(str(c) for c in df.columns) + ' |', to); out('| ' + ' | '.join('---' for _ in df.columns) + ' |', to)
    for r in df.itertuples(index=False): out('| ' + ' | '.join(fmt(x) for x in r) + ' |', to)
    out('', to)
pct = lambda x: f'{100 * x:.1f}%'

# ── the reads, by group ──────────────────────────────────────────────────────────────────────────────────────────────
lg1 = lambda s: np.log(s.clip(lower=0) + 0.1)
X = pd.DataFrame(index=d.index)
for p in ('C', 'LW', 'RW'): X[f'pos_{p}'] = (d.pos == p).astype(float)
X['n_log'] = np.log1p(d.n); X['has_ls'] = (d.ls_n >= 10).astype(float)
BASE = ['pos_C', 'pos_LW', 'pos_RW', 'n_log', 'has_ls']
def shrunk(c, k):  # this season's rate blended into last season's (the position's without one) at n / (n + k)
    prior = d[f'ls_{c}'].where(d.ls_n >= 10).fillna(d.groupby(['season', 'pos'])[c].transform('mean'))
    return (d[f's_{c}'].fillna(0) * d.n + prior * k) / (d.n + k)
G = {}
def add(group, name, v): X[name] = v; G.setdefault(group, []).append(name)
for c, k in (('sog', 12), ('g', 30), ('a', 25), ('pts', 20)):
    add('own', f'b_{c}', lg1(shrunk(c, k)))
    for w in (5, 10, 20): add('own', f'l{w}_{c}', lg1(d[f'l{w}_{c}']))
    add('own', f'ls_{c}', lg1(d[f'ls_{c}']))
for c, k in (('icf', 12), ('iff', 12), ('iscf', 15), ('ihdcf', 20)):
    add('att', f'b_{c}', lg1(shrunk(c, k))); add('att', f'l10_{c}', lg1(d[f'l10_{c}'])); add('att', f'ls_{c}', lg1(d[f'ls_{c}']))
add('toi', 'b_toi', np.log(shrunk('toi', 5).clip(lower=4))); add('toi', 'l5_toi', np.log(d.l5_toi.clip(lower=4))); add('toi', 'l10_toi', np.log(d.l10_toi.clip(lower=4)))
add('toi', 'ls_toi', np.log(d.ls_toi.clip(lower=4))); add('toi', 'toi_trend', d.l3_toi - d.l20_toi)
for s in ('F1', 'F2', 'F3', 'D1', 'D2'): add('toi', f'slot_{s}', (d.slot == s).astype(float))
add('pp', 'l10_pp', d.l10_pp); add('pp', 'b_pp', shrunk('pp', 5)); add('pp', 'pp1', d.pp1.astype(float)); add('pp', 'pp_share', d.pp_share.clip(upper=1.5))
add('pp', 'l10_ppsog', d.l10_ppsog); add('pp', 'l10_sh', d.l10_sh)
add('env', 'opp_b_sa', np.log(d.opp_b_sa)); add('env', 'opp_l10_sa', np.log(d.opp_l10_sa)); add('env', 'opp_b_ga', np.log(d.opp_b_ga)); add('env', 'opp_l10_ga', np.log(d.opp_l10_ga.clip(lower=1)))
for c in ('sog', 'g', 'icf', 'iscf', 'pts'):
    add('env', f'oppX_{c}', np.log(d[f'oppX_{c}'].clip(0.4, 2.5)).where(d.oppP_games >= 5)); add('env', f'oppX10_{c}', np.log(d[f'oppX10_{c}'].clip(0.4, 2.5)))
add('env', 'gk_sv', d.gk_sv); add('env', 'opp_s_tsh', d.opp_s_tsh); add('env', 'opp_b2b', d.opp_tb2b.astype(float)); add('env', 'opp_win', d.opp_s_win)
add('sit', 'home', d.home.astype(float)); add('sit', 'b2b', d.b2b.astype(float)); add('sit', 'rest', d.rest.clip(upper=6))
add('sit', 'v_sog_x', (lg1(d.v_sog) - lg1(d.s_sog)).where(d.vn >= 5))     # his venue split against his season
add('sit', 'v_g_x', (d.v_g - d.s_g).where(d.vn >= 5))
add('team', 'team_b_sf', np.log(d.team_b_sf)); add('team', 'team_l10_sf', np.log(d.team_l10_sf)); add('team', 'team_b_gf', np.log(d.team_b_gf)); add('team', 'team_l10_gf', np.log(d.team_l10_gf.clip(lower=1)))
add('team', 'team_s_ppo', d.team_s_ppo); add('team', 'team_win', d.team_s_win)
add('out', 'miss_f6', d.miss_f6.astype(float)); add('out', 'miss_d4', d.miss_d4.astype(float)); add('out', 'miss_sog', d.miss_sog); add('out', 'miss_pp', d.miss_pp.astype(float))
add('out', 'miss_f6_new_F', d.miss_f6_new * d.F); add('out', 'miss_d4_new_D', d.miss_d4_new * (1 - d.F))
add('out', 'miss_f6_F', d.miss_f6 * d.F); add('out', 'miss_d4_D', d.miss_d4 * (1 - d.F))
add('streak', 'gstreak', d.gstreak.clip(upper=4).astype(float)); add('streak', 'pstreak', d.pstreak.clip(upper=6).astype(float)); add('streak', 's3streak', d.s3streak.clip(upper=5).astype(float))
add('streak', 'gdrought', np.log1p(d.gdrought.clip(upper=20))); add('streak', 'l3_g', d.l3_g); add('streak', 'l3_sog', lg1(d.l3_sog)); add('streak', 'l3_pts', d.l3_pts)
# hindsight: what tonight turned out to be (ceilings, never a read)
add('h_toi', 'h_toi', np.log(d.toi.clip(lower=1)))
add('h_split', 'h_ev', np.log(d.ev.clip(lower=1))); add('h_split', 'h_pp', d.pp); add('h_split', 'h_sh', d.sh)
for s_ in ('F1', 'F2', 'F3', 'D1', 'D2'): add('h_line', f'h_slot_{s_}', (d.slot_played == s_).astype(float))
add('h_line', 'h_up', (d.slot_rank - d.slot_played_rank).clip(-6, 6))
add('h_team', 'h_sf', np.log(d.team_sf.clip(lower=8))); add('h_team', 'h_gf', d.team_gf.astype(float))
add('h_game', 'h_ppo', d.team_ppo); add('h_game', 'h_ot', d.team_ot.astype(float)); add('h_game', 'h_diff', (d.team_gf - d.team_ga).clip(-4, 4).astype(float))
GROUPS = ['own', 'att', 'toi', 'pp', 'env', 'sit', 'team', 'out', 'streak']
NAMES = {'own': 'his production (shots, goals, assists: season, L5 / L10 / L20, last season)', 'att': 'his attempts and chances', 'toi': 'his minutes and line',
         'pp': 'his power-play / kill role', 'env': 'the opponent (tables, position cell, goalie, penalties)', 'sit': 'home, rest, venue split',
         'team': 'his team (shots, goals, power plays drawn)', 'out': 'regulars not dressed', 'streak': 'streaks and the last three games'}
FULL = BASE + [c for g in GROUPS for c in G[g]]
YS = {'sog': 'shots', 'g': 'goals', 'pts': 'points'}

def dev_rows(y, mu):
    mu = np.clip(mu, 1e-6, None); y = np.asarray(y, float)
    return 2 * (np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / mu), 0) - (y - mu))
def cv_pois(rows, cols, y, folds=5, gbm=False, alpha=1e-3):
    """Out-of-fold λ, the folds whole dates."""
    Xr = X.loc[rows, cols]; yr = d.loc[rows, y].values.astype(float); grp = d.loc[rows, 'date'].values
    pred = np.zeros(len(yr))
    for tr, te in GroupKFold(folds).split(Xr, yr, grp):
        A = Xr.iloc[tr]; B = Xr.iloc[te]
        if gbm:
            m = HistGradientBoostingRegressor(loss='poisson', max_iter=250, learning_rate=0.04, max_depth=4, min_samples_leaf=80, l2_regularization=1.0, random_state=0)
            m.fit(A, yr[tr]); pred[te] = m.predict(B)
        else:
            med = A.median(); A = A.fillna(med); B = B.fillna(med); sc = StandardScaler().fit(A)
            m = PoissonRegressor(alpha=alpha, max_iter=100, solver='newton-cholesky').fit(sc.transform(A), yr[tr]); pred[te] = m.predict(sc.transform(B))
    return pd.Series(pred, index=rows)
def boot_gain(rows, y, a, b):
    """Deviance of a minus b per skater-game, with a 95% interval, dates resampled."""
    da = pd.Series(dev_rows(d.loc[rows, y], a.loc[rows]), index=rows); db = pd.Series(dev_rows(d.loc[rows, y], b.loc[rows]), index=rows)
    by = (da - db).groupby(d.loc[rows, 'date']).agg(['sum', 'size']); s = by['sum'].values; n = by['size'].values
    k = rng.integers(0, len(s), (args.boot, len(s))); v = s[k].sum(1) / n[k].sum(1)
    return s.sum() / n.sum(), np.percentile(v, 2.5), np.percentile(v, 97.5)
p_at = lambda lam, k: 1 - sum(np.exp(-lam) * lam ** i / math.factorial(i) for i in range(k))

MAIN = d.index[(d.season > FIRST) & ((d.n >= 5) | (d.ls_n >= 10))]      # the rows with a rate behind them
cur = lambda rows: rows[d.loc[rows, 'season'].values == CUR]
prv = lambda rows: rows[d.loc[rows, 'season'].values == CUR - 1]
games = d.groupby('season').gid.nunique()
out(f'<!-- built by tools/predictors/drivers.py from {len(d)} skater-games: ' + ', '.join(f'{lab(s)} {games[s]} games' for s in SEASONS) + ' -->')
out()

# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# B first: the fits everything else leans on
# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
fits = {}
def fit(name, cols, y, rows=MAIN, **kw):
    key = (name, y)
    if key not in fits: fits[key] = cv_pois(rows, cols, y, **kw)
    return fits[key]
def d2(rows, y, mu):
    base = d.loc[rows].groupby('pos')[y].transform('mean')
    return 1 - dev_rows(d.loc[rows, y], mu.loc[rows]).sum() / dev_rows(d.loc[rows, y], base).sum()

if 'B' in args.only:
    out('## B. The drivers', tb); out('', tb)
    out(f'Cross-validated Poisson (five folds of whole dates over {lab(CUR - 1)} and {lab(CUR)} together), scored on each season. The figure is the share of the '
        'deviance explained over the position\'s average (0 = knowing only his position). "alone" = that group of reads with nothing else; "dropped" = what '
        'the full read loses without it (what only that group knows); the ladder adds the groups in order.', tb); out('', tb)
    res = []
    for y in YS:
        full = fit('full', FULL, y)
        for s, rows in ((CUR, cur(MAIN)), (CUR - 1, prv(MAIN))):
            r = dict(stat=YS[y], season=lab(s), n=len(rows), mean=d.loc[rows, y].mean(), var=d.loc[rows, y].var(), full=100 * d2(rows, y, full))
            res.append(r)
    table(pd.DataFrame(res), tb)
    rows_a = []
    for g in GROUPS:
        r = dict(group=NAMES[g])
        for y in YS:
            alone = fit(f'alone_{g}', BASE + G[g], y); drop = fit(f'drop_{g}', [c for c in FULL if c not in G[g]], y); full = fit('full', FULL, y)
            for s, rows in ((CUR, cur(MAIN)), (CUR - 1, prv(MAIN))):
                r[f'{YS[y]} {lab(s)} alone'] = 100 * d2(rows, y, alone); r[f'{YS[y]} {lab(s)} dropped'] = 100 * (d2(rows, y, full) - d2(rows, y, drop))
        rows_a.append(r)
    A = pd.DataFrame(rows_a)
    for y in YS:
        out(f'**{YS[y].capitalize()}** — % of deviance explained alone, and lost when dropped from the full read', tb); out('', tb)
        table(A[['group'] + [c for c in A.columns if c.startswith(YS[y] + ' ')]].rename(columns=lambda c: c.replace(YS[y] + ' ', '')), tb)
    # the ladder
    lad = []; cols = list(BASE)
    for g in GROUPS:
        cols = cols + G[g]; r = dict(step='+ ' + NAMES[g])
        for y in YS:
            m = fit(f'lad_{g}', list(cols), y)
            for s, rows in ((CUR, cur(MAIN)), (CUR - 1, prv(MAIN))): r[f'{YS[y]} {lab(s)}'] = 100 * d2(rows, y, m)
        lad.append(r)
    out('**The ladder** (% explained as each group is added)', tb); out('', tb); table(pd.DataFrame(lad), tb)
    # the gain of each group over the rest, with intervals (this season)
    out(f'**What each group adds to the rest, with a 95% interval** (deviance per skater-game ×1000, {lab(CUR)}; negative = the read is better with the group)', tb); out('', tb)
    ci = []
    for g in GROUPS:
        r = dict(group=NAMES[g])
        for y in YS:
            m, lo, hi = boot_gain(cur(MAIN), y, fit('full', FULL, y), fit(f'drop_{g}', [c for c in FULL if c not in G[g]], y))
            r[YS[y]] = f'{1000 * m:+.1f} ({1000 * lo:+.1f} … {1000 * hi:+.1f})'
        ci.append(r)
    table(pd.DataFrame(ci), tb)
    # the ceilings
    out('**The ceilings** — the full read, then with what tonight turned out to be handed to it (hindsight, never a read), and the count\'s own noise', tb); out('', tb)
    ce = []
    spec = [('the position\'s average', None), ('the site\'s plain-rate formula (picks-pure.js)', 'site'), ('his production alone', BASE + G['own']), ('the full read', FULL),
            ('the full read, boosted trees', 'gbm'),
            ('+ the line he played tonight (his even-strength rank)', FULL + G['h_line']), ('+ tonight\'s minutes', FULL + G['h_toi']), ('+ tonight\'s minutes split EV / PP / SH', FULL + G['h_split']),
            ('+ his team\'s shots and goals tonight', FULL + G['h_team']), ('+ the game (power plays, overtime, margin)', FULL + G['h_game']),
            ('+ all of tonight', FULL + G['h_split'] + G['h_team'] + G['h_game'])]
    for name, cols in spec:
        r = dict(read=name)
        for y in YS:
            for s, rows in ((CUR, cur(MAIN)), (CUR - 1, prv(MAIN))):
                if cols is None: v = 0.0
                elif cols == 'site':
                    if y == 'pts': v = np.nan
                    else:
                        mu = d['site_lam_s' if y == 'sog' else 'site_lam_g']; ok = rows[mu.loc[rows].notna().values]; v = 100 * d2(ok, y, mu)
                elif cols == 'gbm': v = 100 * d2(rows, y, fit('gbm', FULL, y, gbm=True))
                else: v = 100 * d2(rows, y, fit(name, cols, y))
                r[f'{YS[y]} {lab(s)}'] = v
        ce.append(r)
    # his true rate: the rest of his season with this game left out (future games in: the ceiling a perfect read of the skater reaches)
    r = dict(read='hindsight: his true rate (the rest of his season, this game left out)')
    for y in YS:
        gsum = d.groupby(['id', 'season'])[y].transform('sum'); gn = d.groupby(['id', 'season'])[y].transform('size')
        loo = ((gsum - d[y]) / (gn - 1).clip(lower=1)).clip(lower=0.02)
        for s, rows in ((CUR, cur(MAIN)), (CUR - 1, prv(MAIN))):
            ok = rows[(gn.loc[rows] >= 20).values]; r[f'{YS[y]} {lab(s)}'] = 100 * d2(ok, y, loo) if len(ok) > 500 else np.nan
    ce.append(r)
    table(pd.DataFrame(ce), tb)
    # can the team's night be seen coming
    tgm = d[d.season >= CUR - 1].drop_duplicates(['gid', 'team']); tgm = tgm[(tgm.team_tgp >= 8) & (tgm.opp_tgp >= 8)]
    out(f'**Can his team\'s night be seen coming?** {len(tgm)} team-games with 8+ games behind both sides: the team\'s shots tonight against its own shots a game × what the opponent allows '
        f'(both blended into last season): r {np.log(tgm.team_sf.clip(lower=8)).corr(np.log(tgm.team_b_sf * tgm.opp_b_sa)):.2f} (r² {np.log(tgm.team_sf.clip(lower=8)).corr(np.log(tgm.team_b_sf * tgm.opp_b_sa)) ** 2:.2f}); '
        f'its goals tonight against its goals a game × the opponent\'s allowed: r {tgm.team_gf.corr(tgm.team_b_gf * tgm.opp_b_ga):.2f} (r² {tgm.team_gf.corr(tgm.team_b_gf * tgm.opp_b_ga) ** 2:.2f}).', tb); out('', tb)
    # variance shares
    out('**How much of a night is chance** — the variance of the count against the variance of the read behind it', tb); out('', tb)
    vs = []
    for y in YS:
        rows = cur(MAIN); lam = fit('full', FULL, y).loc[rows]; yy = d.loc[rows, y]
        allh = fit('+ all of tonight', FULL + G['h_split'] + G['h_team'] + G['h_game'], y).loc[rows]
        vs.append(dict(stat=YS[y], mean=yy.mean(), variance=yy.var(), read_var=lam.var(), share_read=100 * lam.var() / yy.var(), share_with_tonight=100 * allh.var() / yy.var(),
                       poisson_noise=100 * yy.mean() / yy.var()))
    table(pd.DataFrame(vs).rename(columns={'read_var': 'variance of the read', 'share_read': '% the read explains', 'share_with_tonight': '% with tonight known', 'poisson_noise': '% a Poisson count leaves to chance'}), tb)

# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# A. streaks
# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
if 'A' in args.only:
    out('## A. The goal streak', tb); out('', tb)
    # what his numbers said, the heat left out: no streak, no last-3 / last-5 / last-10 goals or points
    HOT = set(G['streak']) | {'l5_g', 'l10_g', 'l5_pts', 'l10_pts', 'l5_a', 'l10_a'}
    COOL = [c for c in FULL if c not in HOT]
    SR = d.index[(d.n >= 8)]                              # eight games this season behind the rate, every season pulled
    lam = cv_pois(SR, COOL, 'g'); lam_full = cv_pois(SR, FULL, 'g')
    S = d.loc[SR].copy(); S['exp'] = 1 - np.exp(-lam); S['exp_full'] = 1 - np.exp(-lam_full); S['hit'] = (S.g > 0).astype(int)
    S['season_rate'] = 1 - np.exp(-S.s_g)
    def rowsum(df, name):
        n = len(df); h = df.hit.mean() if n else np.nan; e = df.exp.mean() if n else np.nan
        se = math.sqrt(h * (1 - h) / n) if n else np.nan
        return dict(cut=name, n=n, scored=h, said=e, ratio=h / e if n and e else np.nan, lo=(h - 1.96 * se) / e if n else np.nan, hi=(h + 1.96 * se) / e if n else np.nan,
                    his_rate=df.season_rate.mean() if n else np.nan, said_with_heat=df.exp_full.mean() if n else np.nan)
    out(f'Every skater-game of {", ".join(lab(s) for s in SEASONS)} with 8+ games this season behind it ({len(S)}). "said" = P(1+ goal) from the full read with the heat '
        'taken out (no streak, no last-3 / 5 / 10 goals or points: his season and last season, shots, chances, minutes, the opponent), cross-validated. '
        '"ratio" = scored / said with its 95% interval: 1.00 means the streak told nothing his numbers had not. "his rate" = his raw goals a game this season going in, as a '
        'chance (it carries the streak itself, so it overstates). "said with heat" = the full read with the streak and recent goals in.', tb); out('', tb)
    S['gs'] = S.gstreak.clip(upper=5)
    names = {0: 'no goal last game', 1: '1 game', 2: '2 straight', 3: '3 straight', 4: '4 straight', 5: '5+ straight'}
    table(pd.DataFrame([rowsum(S[S.gs == k], names[k]) for k in range(6)] + [rowsum(S[S.gstreak >= 2], '2+ straight'), rowsum(S[S.gstreak >= 3], '3+ straight'), rowsum(S[S.gstreak >= 4], '4+ straight')]), tb)
    out('By season', tb); out('', tb)
    table(pd.DataFrame([dict(season=lab(s), **rowsum(S[(S.season == s) & (S.gstreak >= k)], f'{k}+ straight')) for s in SEASONS for k in (1, 2, 3)]), tb)
    # when it carries
    T = S[S.gstreak >= 2].copy()
    T['run_sog'] = T.gs_sog / T.gstreak; T['run_sh'] = T.gs_g / T.gs_sog.clip(lower=1); T['run_iscf'] = T.gs_iscf / T.gstreak
    T['run_toi_x'] = T.gs_toi / T.gstreak - T.l20_toi; T['run_multi'] = (T.gs_g > T.gstreak).astype(int)
    T['sog_x'] = T.run_sog / T.s_sog.clip(lower=0.5)
    def cuts(df, col, edges, labels): return pd.cut(df[col], edges, labels=labels, include_lowest=True)
    conds = [
        ('shots a game during the run', cuts(T, 'run_sog', [-1, 2, 3, 4, 99], ['under 2', '2–3', '3–4', '4+'])),
        ('shots during the run against his season', cuts(T, 'sog_x', [-1, 0.9, 1.15, 1.5, 99], ['under 0.9×', '0.9–1.15×', '1.15–1.5×', '1.5×+'])),
        ('shooting % during the run', cuts(T, 'run_sh', [-1, 0.2, 0.34, 0.5, 9], ['under 20%', '20–34%', '34–50%', '50%+'])),
        ('scoring chances a game during the run', cuts(T, 'run_iscf', [-1, 1.5, 2.5, 3.5, 99], ['under 1.5', '1.5–2.5', '2.5–3.5', '3.5+'])),
        ('minutes during the run against his last 20', cuts(T, 'run_toi_x', [-99, -1, 1, 2.5, 99], ['down 1+', 'level', 'up 1–2.5', 'up 2.5+'])),
        ('a multi-goal game in the run', T.run_multi.map({0: 'no', 1: 'yes'})),
        ('first power-play unit', T.pp1.map({0: 'no', 1: 'yes'})),
        ('line', T.slot), ('position', T.pos), ('venue', T.home.map({1: 'home', 0: 'away'})),
        ('rest', cuts(T, 'rest', [0, 1, 2, 3, 99], ['back-to-back', '1 day off', '2 days off', '3+ days off'])),
        ('his numbers said (heat out)', cuts(T, 'exp', [0, 0.15, 0.22, 0.30, 1], ['under 15%', '15–22%', '22–30%', '30%+'])),
        ('the opponent\'s goals allowed, season (blended)', pd.qcut(T.opp_b_ga, 3, labels=['tight third', 'middle', 'leaky third'])),
        ('the opponent\'s goals allowed, last 5', pd.qcut(T.opp_l5_ga, 3, labels=['tight third', 'middle', 'leaky third'], duplicates='drop')),
        ('the opponent\'s chances allowed to his position (× league)', pd.qcut(T.oppX_iscf, 3, labels=['tight third', 'middle', 'leaky third'])),
        ('the opposing starter\'s save %', pd.qcut(T.gk_sv, 3, labels=['low third', 'middle', 'high third'])),
        ('his team\'s goals a game, last 10', pd.qcut(T.team_l10_gf, 3, labels=['low third', 'middle', 'high third'])),
        ('games into the season', cuts(T, 'n', [0, 15, 30, 50, 99], ['8–15', '16–30', '31–50', '51+'])),
    ]
    out(f'**When does it carry?** Skaters with a goal in 2+ straight games going in ({len(T)} skater-games, scored {pct(T.hit.mean())}, said {pct(T.exp.mean())}), cut one way at a time', tb); out('', tb)
    rr = []
    for name, key in conds:
        for v in [x for x in pd.unique(key.dropna())] if not hasattr(key, 'cat') else key.cat.categories:
            r = rowsum(T[key == v], str(v)); r = dict(cut_by=name, **r); rr.append(r)
    W = pd.DataFrame(rr).drop(columns=['his_rate']); table(W, tb)
    # the same cuts among everyone (does the cut carry without a streak?)
    out('The same shots / chances cuts on the last two games of skaters WITHOUT a streak (did the volume carry, or the goals?)', tb); out('', tb)
    N = S[(S.gstreak == 0) & (S.n >= 8)].copy(); N['l2x'] = d.loc[N.index, 'l3_sog'] / N.s_sog.clip(lower=0.5)
    table(pd.DataFrame([rowsum(N[k], nm) for nm, k in (('last-3 shots under 0.9× his season', N.l2x < 0.9), ('0.9–1.15×', (N.l2x >= 0.9) & (N.l2x < 1.15)), ('1.15–1.5×', (N.l2x >= 1.15) & (N.l2x < 1.5)), ('1.5×+', N.l2x >= 1.5))]).drop(columns=['his_rate']), tb)
    # a logistic on top of what his numbers said
    T2 = S.copy(); off = np.log(-np.log(1 - T2.exp.clip(1e-4, 0.999)))   # log λ
    Z = pd.DataFrame({'streak1': (T2.gstreak == 1).astype(float), 'streak2': (T2.gstreak == 2).astype(float), 'streak3p': (T2.gstreak >= 3).astype(float)})
    T2['run_sog_x'] = np.where(T2.gstreak >= 2, np.log((T2.gs_sog / T2.gstreak.clip(lower=1)).clip(lower=0.5) / T2.s_sog.clip(lower=0.5)), 0)
    T2['run_toi'] = np.where(T2.gstreak >= 2, (T2.gs_toi / T2.gstreak.clip(lower=1) - T2.l20_toi).clip(-5, 5), 0)
    Z['run_shots_x'] = T2.run_sog_x; Z['run_minutes_up'] = T2.run_toi.fillna(0)
    m = sm.GLM(T2.g.clip(upper=1) * 0 + T2.g, sm.add_constant(Z), family=sm.families.Poisson(), offset=off).fit()
    out('**On top of what his numbers said** — Poisson on goals with the heat-free read as the offset: e^coef is the multiplier the streak earns', tb); out('', tb)
    table(pd.DataFrame({'term': m.params.index, 'multiplier': np.exp(m.params.values), 'low': np.exp(m.conf_int()[0].values), 'high': np.exp(m.conf_int()[1].values), 'z': m.tvalues.values}), tb)
    # goals in the last five, whatever the order
    S['l5g'] = (d.loc[S.index, 'l5_g'] * 5).round().clip(upper=5)
    out('**Goals in his last five, whatever the order**', tb); out('', tb)
    table(pd.DataFrame([rowsum(S[S.l5g == k], f'{int(k)} goals in the last 5' + ('+' if k == 5 else '')) for k in range(6)]), tb)
    S['dr'] = pd.cut(S.gdrought, [-1, 0, 2, 5, 9, 99], labels=['scored last game', '1–2 games without', '3–5', '6–9', '10+'])
    out('**The drought** (games since his last goal), among skaters whose numbers said 20%+', tb); out('', tb)
    table(pd.DataFrame([rowsum(S[(S.dr == k) & (S.exp >= 0.20)], str(k)) for k in S.dr.cat.categories]), tb)
    # the other streaks
    for col, y, k, name, said_cols in (('pstreak', 'pts', 1, 'point', {'l5_pts', 'l10_pts', 'l5_g', 'l10_g', 'l5_a', 'l10_a'}), ('s3streak', 'sog', 3, '3+ SOG', {'l5_sog', 'l10_sog'})):
        cool = [c for c in FULL if c not in set(G['streak']) | said_cols]
        l2 = cv_pois(SR, cool, y); P = d.loc[SR].copy(); P['exp'] = p_at(l2, k); P['hit'] = (P[y] >= k).astype(int); P['season_rate'] = np.nan; P['exp_full'] = np.nan
        out(f'**The {name} streak** — {name} in N straight going in, what happened next against the heat-free read', tb); out('', tb)
        P['ks'] = P[col].clip(upper=6)
        table(pd.DataFrame([rowsum(P[P.ks == j], f'{j} straight' + ('+' if j == 6 else '')) for j in range(7)]).drop(columns=['his_rate', 'said_with_heat']), tb)
    # the case
    ek = d[(d.name.str.contains('Eklund')) & (d.season == CUR)].tail(8)
    if len(ek):
        e2 = ek.join(S[['exp', 'exp_full']], how='left')
        out('**The case** — ' + ek.name.iloc[-1] + ', his last games', tb); out('', tb)
        table(e2[['date', 'team', 'opp', 'home', 'toi', 'sog', 'iscf', 'g', 'gstreak', 'slot', 'exp', 'exp_full']].rename(columns={'gstreak': 'streak going in', 'exp': 'said (heat out)', 'exp_full': 'said (heat in)'}), tb)

# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# C. minutes
# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
if 'C' in args.only:
    out('## C. Minutes', tb); out('', tb)
    c = d[d.season == CUR].copy()
    out(f'**What the minutes are made of** ({lab(CUR)}, the line = his last-10 even-strength minutes ranked among the skaters dressed)', tb); out('', tb)
    comp = c.groupby('slot').agg(skater_games=('id', 'size'), toi=('toi', 'mean'), ev=('ev', 'mean'), pp=('pp', 'mean'), sh=('sh', 'mean'), sog=('sog', 'mean'), goals=('g', 'mean'), points=('pts', 'mean')).reset_index()
    comp['pp share of minutes'] = comp.pp / comp.toi; comp['sog / 60'] = comp.sog / comp.toi * 60
    table(comp, tb)
    # between and within
    out('**Whose minutes move** — the spread between skaters (the role) against one skater\'s own night to night (skaters with 8+ games)', tb); out('', tb)
    cc = c[c.groupby('id').id.transform('size') >= 8]
    vr = []
    for k in ('toi', 'ev', 'pp', 'sh'):
        within = cc.groupby('id')[k].transform(lambda x: x - x.mean()); vr.append(dict(minutes=k, mean=cc[k].mean(), sd_between=cc.groupby('id')[k].mean().std(), sd_within=within.std(), share_role=100 * (1 - within.var() / cc[k].var())))
    table(pd.DataFrame(vr).rename(columns={'sd_between': 'sd between skaters', 'sd_within': 'sd night to night', 'share_role': '% of the variance that is the role'}), tb)
    # what moves a night (hindsight) — both seasons
    h = d[(d.season >= CUR - 1) & (d.n_all >= 10)].copy(); h['dev'] = h.toi - h.l10_toi
    h['ppx'] = h.team_ppo - h.team_ppo.mean(); h['pkx'] = h.team_tsh - h.team_tsh.mean(); h['pk1'] = (h.l10_sh >= 1.0).astype(int)
    h['margin'] = (h.team_gf - h.team_ga).clip(-4, 4); h['top'] = h.slot.isin(['F1', 'D1']).astype(int); h['bot'] = h.slot.isin(['F4', 'D3']).astype(int)
    h['up'] = (h.slot_rank - h.slot_played_rank).clip(-6, 6)       # places gained in the even-strength order tonight
    Z = pd.DataFrame({'power plays tonight (vs average) × first unit': h.ppx * h.pp1, 'power plays tonight × not on it': h.ppx * (1 - h.pp1),
                      'kills tonight (vs average) × a killer': h.pkx * h.pk1, 'kills tonight × not a killer': h.pkx * (1 - h.pk1),
                      'overtime': h.team_ot, 'margin (goals, ±4) × first line / pair': h.margin * h.top, 'margin × middle': h.margin * (1 - h.top) * (1 - h.bot), 'margin × fourth line / third pair': h.margin * h.bot,
                      'back-to-back': h.b2b, 'home': h.home, 'a top-six forward out × forward': h.miss_f6 * h.F, 'a top-four defenseman out × defenseman': h.miss_d4 * (1 - h.F),
                      'eleven forwards dressed × forward': (h.nF <= 11) * h.F, 'seven defensemen × defenseman': (h.nF <= 11) * (1 - h.F),
                      'places moved up the even-strength order': h.up, 'his last 5 minus his last 10': (h.l5_toi - h.l10_toi)})
    ok = Z.notna().all(axis=1) & h.dev.notna()
    m = sm.OLS(h.dev[ok], sm.add_constant(Z[ok])).fit()
    out(f'**What moves a skater\'s minutes off his last 10** (hindsight: tonight\'s game as it went; {lab(CUR - 1)} and {lab(CUR)}, {int(ok.sum())} skater-games; minutes, R² {m.rsquared:.2f}; sd of the move {h.dev[ok].std():.2f})', tb); out('', tb)
    table(pd.DataFrame({'term': m.params.index, 'minutes': m.params.values, 't': m.tvalues.values}), tb)
    one = []
    for k in Z.columns:
        r2 = sm.OLS(h.dev[ok], sm.add_constant(Z.loc[ok, [k]])).fit().rsquared; one.append(dict(term=k, r2_alone=100 * r2))
    out('Each term alone, % of the night-to-night move it explains', tb); out('', tb); table(pd.DataFrame(one).sort_values('r2_alone', ascending=False), tb)
    # the margin by line
    out('**The score and the bench** — minutes against his last 10 by the final margin and the line (regulation games)', tb); out('', tb)
    hh = h[h.team_ot == 0].copy(); hh['m'] = pd.cut(hh.team_gf - hh.team_ga, [-99, -3, -2, -1, 0, 1, 2, 99], labels=['lost by 3+', 'lost by 2', 'lost by 1', '', 'won by 1', 'won by 2', 'won by 3+'])
    table(hh[hh.m != ''].pivot_table(index='slot', columns='m', values='dev', aggfunc='mean', observed=True).drop(columns=[''], errors='ignore').reset_index(), tb)
    # before the game
    out(f'**Before the game** — the miss (minutes) of each read of tonight\'s minutes, {lab(CUR)}, skaters with 10+ games on record', tb); out('', tb)
    b = h.copy(); bt = (b.season == CUR)
    pre = pd.DataFrame({'l5': b.l5_toi, 'l10': b.l10_toi, 'season': b.s_toi.fillna(b.l10_toi), 'l20': b.l20_toi, 'l3': b.l3_toi, 'F': b.F, 'pp1': b.pp1,
                        'out_f': b.miss_f6 * b.F, 'out_d': b.miss_d4 * (1 - b.F), 'b2b': b.b2b, 'home': b.home, 'opp_pen': b.opp_s_tsh.fillna(3.1), 'own_pp': b.team_s_ppo.fillna(3.1)})
    for s in ('F1', 'F2', 'F3', 'D1', 'D2'): pre[s] = (b.slot == s).astype(float)
    okp = pre.notna().all(axis=1) & b.toi.notna(); tr = okp & ~bt; te = okp & bt
    def miss(cols):
        mm = sm.OLS(b.toi[tr], sm.add_constant(pre.loc[tr, cols])).fit(); return (b.toi[te] - mm.predict(sm.add_constant(pre.loc[te, cols]))).abs().mean(), mm
    rows_ = [dict(read='his last 10', miss=(b.toi[te] - b.l10_toi[te]).abs().mean()), dict(read='his last 5', miss=(b.toi[te] - b.l5_toi[te]).abs().mean()),
             dict(read='his season', miss=(b.toi[te] - pre.season[te]).abs().mean())]
    base_cols = ['l3', 'l5', 'l10', 'l20', 'season']
    for name, cols in (('fitted: his windows (L3, L5, L10, L20, season)', base_cols), ('+ the line by his recent minutes', base_cols + ['F1', 'F2', 'F3', 'D1', 'D2', 'F']), ('+ first power-play unit', base_cols + ['F1', 'F2', 'F3', 'D1', 'D2', 'F', 'pp1']),
                       ('+ a regular out at his position', base_cols + ['F1', 'F2', 'F3', 'D1', 'D2', 'F', 'pp1', 'out_f', 'out_d']),
                       ('+ back-to-back, home', base_cols + ['F1', 'F2', 'F3', 'D1', 'D2', 'F', 'pp1', 'out_f', 'out_d', 'b2b', 'home']),
                       ('+ the penalties the matchup should bring', base_cols + ['F1', 'F2', 'F3', 'D1', 'D2', 'F', 'pp1', 'out_f', 'out_d', 'b2b', 'home', 'opp_pen', 'own_pp'])):
        v, mm = miss(cols); rows_.append(dict(read=name, miss=v))
    table(pd.DataFrame(rows_), tb)
    out('The last fit\'s terms (minutes; fitted on ' + lab(CUR - 1) + ')', tb); out('', tb)
    table(pd.DataFrame({'term': mm.params.index, 'minutes': mm.params.values, 't': mm.tvalues.values}), tb)
    # the power play before the game
    tgm = d[d.season >= CUR - 1].drop_duplicates(['gid', 'team'])
    f = tgm[(tgm.team_tgp >= 8) & (tgm.opp_tgp >= 8)]
    out(f'**Can the power plays be seen coming?** {len(f)} team-games with 8+ games behind both sides: a team\'s power plays tonight against its own drawn a game '
        f'(r {f.team_ppo.corr(f.team_s_ppo):.2f}), the opponent\'s times short-handed a game (r {f.team_ppo.corr(f.opp_s_tsh):.2f}), the two multiplied '
        f'(r {f.team_ppo.corr(f.team_s_ppo * f.opp_s_tsh):.2f}). His share of his team\'s power-play minutes tonight against his last-10 share: '
        f'r {(h.pp / h.team_ppmin.clip(lower=0.5)).clip(upper=1).corr(h.pp_share):.2f}.', tb); out('', tb)
    # what a minute is worth
    out(f'**What a minute is worth** ({lab(CUR)}) — shots on goal per 60 by strength (power-play shots from the play-by-play\'s situation code)', tb); out('', tb)
    w = c.groupby(np.where(c.F == 1, 'forwards', 'defensemen')).apply(lambda x: pd.Series({'PP SOG / 60': x.ppsog.sum() / x.pp.sum() * 60, 'other SOG / 60': (x.sog - x.ppsog).sum() / (x.ev + x.sh).sum() * 60,
                                                                                            'share of his shots on the PP': x.ppsog.sum() / x.sog.sum(), 'share of his minutes on the PP': x.pp.sum() / x.toi.sum()})).reset_index()
    table(w, tb)
    w1 = c[c.pp1 == 1].groupby(np.where(c[c.pp1 == 1].F == 1, 'first-unit forwards', 'first-unit defensemen')).apply(lambda x: pd.Series({'PP SOG / 60': x.ppsog.sum() / x.pp.sum() * 60, 'other SOG / 60': (x.sog - x.ppsog).sum() / (x.ev + x.sh).sum() * 60,
                                                                                            'share of his shots on the PP': x.ppsog.sum() / x.sog.sum(), 'share of his minutes on the PP': x.pp.sum() / x.toi.sum(), 'PP minutes a game': x.pp.mean()})).reset_index()
    table(w1, tb)
    # points and goals per minute by strength: a linear fit through the origin
    pm = []
    for y in ('sog', 'g', 'pts'):
        for nm, x in (('forwards', c[c.F == 1]), ('defensemen', c[c.F == 0])):
            mm2 = sm.OLS(x[y], x[['ev', 'pp', 'sh']]).fit(); pm.append(dict(stat=YS[y], who=nm, per_60_ev=60 * mm2.params['ev'], per_60_pp=60 * mm2.params['pp'], per_60_sh=60 * mm2.params['sh'], pp_vs_ev=mm2.params['pp'] / mm2.params['ev']))
    out('Per 60 minutes by strength, a straight fit through the origin (every skater)', tb); out('', tb); table(pd.DataFrame(pm), tb)
    # the night he plays more than usual
    out('**The night he plays more than usual** — tonight\'s minutes against his last 10, and what he did against what the full read said', tb); out('', tb)
    if ('full', 'sog') not in fits: [fit('full', FULL, y) for y in YS]
    hm = d.loc[MAIN].copy(); hm = hm[hm.n_all >= 10]; hm['dv'] = pd.cut(hm.toi - hm.l10_toi, [-99, -3, -1.5, -0.5, 0.5, 1.5, 3, 99], labels=['3+ fewer', '1.5–3 fewer', '0.5–1.5 fewer', 'level', '0.5–1.5 more', '1.5–3 more', '3+ more'])
    for y in YS: hm[f'lam_{y}'] = fits[('full', y)].loc[hm.index]
    t_ = hm.groupby('dv', observed=True).agg(n=('id', 'size'), shots=('sog', 'mean'), shots_said=('lam_sog', 'mean'), goals=('g', 'mean'), goals_said=('lam_g', 'mean'), points=('pts', 'mean'), points_said=('lam_pts', 'mean')).reset_index()
    for y, k in (('shots', 'shots'), ('goals', 'goals'), ('points', 'points')): t_[f'{y} ×'] = t_[k] / t_[f'{k}_said']
    table(t_, tb)
    el = []
    for y in YS:
        q = hm[(hm.toi > 2) & (hm.l10_toi > 2)]
        Zq = pd.DataFrame({'log(tonight / last 10)': np.log(q.toi / q.l10_toi)}); mq = sm.GLM(q[y], sm.add_constant(Zq), family=sm.families.Poisson(), offset=np.log(q[f'lam_{y}'])).fit()
        Z2 = pd.DataFrame({'ev minutes over last 10': q.ev - q.l10_ev, 'pp minutes over last 10': q.pp - q.l10_pp, 'sh minutes over last 10': q.sh - q.l10_sh}); m2 = sm.GLM(q[y], sm.add_constant(Z2), family=sm.families.Poisson(), offset=np.log(q[f'lam_{y}'])).fit()
        el.append(dict(stat=YS[y], elasticity=mq.params.iloc[1], z=mq.tvalues.iloc[1], per_ev_minute=np.exp(m2.params.iloc[1]) - 1, per_pp_minute=np.exp(m2.params.iloc[2]) - 1, per_sh_minute=np.exp(m2.params.iloc[3]) - 1))
    out('The elasticity to tonight\'s minutes (1.0 = 10% more minutes, 10% more of it) and the % change per extra minute by strength', tb); out('', tb); table(pd.DataFrame(el), tb)
    # the regular out
    out('**A regular out** — his team\'s top-six forwards (by minutes) not dressed, the forwards who did dress against what the full read (without the "out" reads) said', tb); out('', tb)
    for y in YS: fit('drop_out', [c_ for c_ in FULL if c_ not in G['out']], y)
    ro = d.loc[MAIN].copy()
    for y in YS: ro[f'lam_{y}'] = fits[('drop_out', y)].loc[ro.index]
    ro['k'] = np.where(ro.F == 1, ro.miss_f6.clip(upper=2), ro.miss_d4.clip(upper=2))
    t2 = ro.groupby(['F', 'k']).agg(n=('id', 'size'), minutes=('toi', 'mean'), minutes_l10=('l10_toi', 'mean'), shots=('sog', 'mean'), shots_said=('lam_sog', 'mean'), goals=('g', 'mean'), goals_said=('lam_g', 'mean'), points=('pts', 'mean'), points_said=('lam_pts', 'mean')).reset_index()
    t2['who'] = np.where(t2.F == 1, 'forwards, top-six F out: ', 'defensemen, top-four D out: ') + t2.k.astype(int).astype(str)
    for y in ('shots', 'goals', 'points'): t2[f'{y} ×'] = t2[y] / t2[f'{y}_said']
    table(t2.drop(columns=['F', 'k'])[['who', 'n', 'minutes', 'minutes_l10', 'shots', 'shots_said', 'shots ×', 'goals ×', 'points ×']], tb)
    ro['k2'] = np.where(ro.F == 1, ro.miss_f6_new.clip(upper=2), ro.miss_d4_new.clip(upper=2))
    t4 = ro.groupby(['F', 'k2']).agg(n=('id', 'size'), minutes=('toi', 'mean'), minutes_l10=('l10_toi', 'mean'), shots=('sog', 'mean'), shots_said=('lam_sog', 'mean'), goals=('g', 'mean'), goals_said=('lam_g', 'mean'), points=('pts', 'mean'), points_said=('lam_pts', 'mean')).reset_index()
    t4['who'] = np.where(t4.F == 1, 'forwards, top-six F newly out: ', 'defensemen, top-four D newly out: ') + t4.k2.astype(int).astype(str)
    for y in ('shots', 'goals', 'points'): t4[f'{y} ×'] = t4[y] / t4[f'{y}_said']
    out('The same, counting only regulars out three games or fewer (the absence his last 10 has not absorbed)', tb); out('', tb)
    table(t4[['who', 'n', 'minutes', 'minutes_l10', 'shots', 'shots_said', 'shots ×', 'goals ×', 'points ×']], tb)
    # the first-line / first-unit skaters when a first-unit mate is out
    ro['topsh'] = ro.miss_top3sh.clip(upper=2)
    t3 = ro[ro.F == 1].groupby('topsh').agg(n=('id', 'size'), shots=('sog', 'mean'), shots_said=('lam_sog', 'mean'), goals=('g', 'mean'), goals_said=('lam_g', 'mean'), points=('pts', 'mean'), points_said=('lam_pts', 'mean')).reset_index()
    for y in ('shots', 'goals', 'points'): t3[f'{y} ×'] = t3[y] / t3[f'{y}_said']
    out('Forwards, by how many of the team\'s three heaviest shooters are out', tb); out('', tb); table(t3[['topsh', 'n', 'shots', 'shots_said', 'shots ×', 'goals ×', 'points ×']], tb)

# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# D. what the averages must be
# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
if 'D' in args.only:
    out('## D. What the averages must be', tb); out('', tb)
    t = d[(d.n >= 5) & (d.n_all >= 15)].copy()          # five games this season, fifteen on record: every window is whole
    WIN = {'L5': 'l5_sog', 'L10': 'l10_sog', 'L15': 'l15_sog', 'season': 's_sog'}
    MARKS = (2, 3, 4, 5)
    for k in MARKS: t[f'h{k}'] = (t.sog >= k).astype(int)
    out(f'Skater-games with 5+ games this season and 15+ on record, so every window is whole (L5 / L10 / L15 run across the season boundary, as a props screen shows them; '
        f'"season" is this season to date): {len(t)} over {", ".join(lab(s) for s in SEASONS)}, {int((t.season == CUR).sum())} of them {lab(CUR)}. Base rates: '
        + ', '.join(f'{k}+ {pct(t[f"h{k}"].mean())}' for k in MARKS) + f' ({lab(CUR)}: ' + ', '.join(f'{k}+ {pct(t.loc[t.season == CUR, f"h{k}"].mean())}' for k in MARKS) + ').', tb); out('', tb)
    edges = [-1, 1, 1.5, 2, 2.5, 3, 3.5, 4, 99]; labels = ['under 1.0', '1.0–1.5', '1.5–2.0', '2.0–2.5', '2.5–3.0', '3.0–3.5', '3.5–4.0', '4.0+']
    for wname, col in WIN.items():
        t[f'bin_{wname}'] = pd.cut(t[col], edges, labels=labels, right=False)
        g_ = t.groupby(f'bin_{wname}', observed=True).agg(n=('id', 'size'), **{f'{k}+': (f'h{k}', 'mean') for k in MARKS}).reset_index()
        g2 = t[t.season == CUR].groupby(f'bin_{wname}', observed=True).agg(**{f'n {lab(CUR)}': ('id', 'size'), **{f'{k}+ {lab(CUR)}': (f'h{k}', 'mean') for k in (3, 4)}}).reset_index()
        out(f'**Hit rate by his {wname} shots a game**', tb); out('', tb); table(g_.merge(g2, on=f'bin_{wname}', how='left').rename(columns={f'bin_{wname}': f'{wname} average'}), tb)
    # the average needed: a logistic in the window's average, per segment
    def need(df, col, k, target):
        x = df[col].values.reshape(-1, 1); y_ = df[f'h{k}'].values
        if len(df) < 400 or y_.sum() < 40: return np.nan
        m = LogisticRegression(C=1e6, max_iter=200).fit(x, y_); a, b = m.intercept_[0], m.coef_[0][0]
        v = (math.log(target / (1 - target)) - a) / b
        return v if 0 < v <= np.quantile(x, 0.99) else np.nan     # past what the segment's skaters ever average: it never gets there
    SEG = [('everyone', t.index == t.index)] + [(p, t.pos == p) for p in ('C', 'LW', 'RW', 'D')] + [(s, t.slot == s) for s in ('F1', 'F2', 'F3', 'F4', 'D1', 'D2', 'D3')]
    TARGETS = {2: (0.6, 0.7), 3: (0.5, 0.6), 4: (0.4, 0.5), 5: (0.3, 0.4)}
    for k in MARKS:
        for target in TARGETS[k]:
            rr = []
            for nm, mask in SEG:
                for vn, vm in (('all', t.home >= 0), ('home', t.home == 1), ('away', t.home == 0)):
                    seg = t[mask & vm]; r = dict(segment=nm, venue=vn, n=len(seg), base=seg[f'h{k}'].mean())
                    for wname, col in WIN.items(): r[wname] = need(seg, col, k, target)
                    rr.append(r)
            out(f'**{k}+ SOG at {int(100 * target)}%: the shots a game he needs on each window, read alone** (a logistic per segment; blank = the segment never gets there or is too thin)', tb); out('', tb)
            table(pd.DataFrame(rr), tb)
    # every window over the bar at once
    out('**Every window over the bar at once** (L5, L10, L15 and season all at or over the figure)', tb); out('', tb)
    rr = []
    for bar in (2.0, 2.5, 3.0, 3.5, 4.0):
        allw = (t.l5_sog >= bar) & (t.l10_sog >= bar) & (t.l15_sog >= bar) & (t.s_sog >= bar)
        for nm, mask in [('everyone', t.home >= 0), ('home', t.home == 1), ('away', t.home == 0), ('forwards', t.F == 1), ('defensemen', t.F == 0), ('C', t.pos == 'C'), ('LW', t.pos == 'LW'), ('RW', t.pos == 'RW'),
                         ('F1', t.slot == 'F1'), ('F2', t.slot == 'F2'), ('F3 / F4', t.slot.isin(['F3', 'F4'])), ('D1', t.slot == 'D1'), ('D2 / D3', t.slot.isin(['D2', 'D3'])), (lab(CUR), t.season == CUR)]:
            s_ = t[allw & mask]
            if len(s_) >= 25: rr.append(dict(bar=f'{bar:.1f}+', segment=nm, n=len(s_), a_night=len(s_) / t[mask].date.nunique(), **{f'{k}+': s_[f'h{k}'].mean() for k in MARKS}))
    table(pd.DataFrame(rr), tb)
    # the hit-rate windows a screen shows
    out('**The hit rates a screen shows** — he went 3+ in at least this share of his L5, L10, L15 and season, all at once', tb); out('', tb)
    rr = []
    for k, key in ((3, 'h3'), (4, 'h4')):
        for bar in (0.4, 0.5, 0.6, 0.7, 0.8):
            allw = (t[f'l5_{key}'] >= bar) & (t[f'l10_{key}'] >= bar) & (t[f'l15_{key}'] >= bar) & (t[f's_{key}'] >= bar)
            for nm, mask in [('everyone', t.home >= 0), ('home', t.home == 1), ('away', t.home == 0), (lab(CUR), t.season == CUR)]:
                s_ = t[allw & mask]
                if len(s_) >= 25: rr.append(dict(mark=f'{k}+', share=f'{int(100 * bar)}%+ on every window', segment=nm, n=len(s_), a_night=len(s_) / t[mask].date.nunique(), landed=s_[f'h{k}'].mean(), said_by_l10=s_[f'l10_{key}'].mean(), said_by_season=s_[f's_{key}'].mean()))
    table(pd.DataFrame(rr), tb)
    # which window carries the read
    out('**Which window carries it** — each alone (AUC), then all four together (standardised weights of a logistic)', tb); out('', tb)
    rr = []
    for k in MARKS:
        r = dict(mark=f'{k}+')
        for wname, col in WIN.items(): r[f'AUC {wname}'] = roc_auc_score(t[f'h{k}'], t[col])
        Z = StandardScaler().fit_transform(t[list(WIN.values())]); m = LogisticRegression(C=1e6, max_iter=300).fit(Z, t[f'h{k}'])
        w = m.coef_[0] / m.coef_[0].sum()
        for (wname, _), v in zip(WIN.items(), w): r[f'weight {wname}'] = v
        r['AUC all four'] = roc_auc_score(t[f'h{k}'], m.decision_function(Z)); rr.append(r)
    table(pd.DataFrame(rr), tb)
    # the same average on a different line / venue / position
    t['avg'] = (t.l10_sog + t.s_sog) / 2
    t['tier'] = pd.cut(t.avg, [-1, 1.5, 2, 2.5, 3, 3.5, 99], labels=['under 1.5', '1.5–2.0', '2.0–2.5', '2.5–3.0', '3.0–3.5', '3.5+'], right=False)
    for k in (3, 4):
        out(f'**The same average on a different line, position, venue: {k}+ SOG** (the average = L10 and season, halved; n in brackets)', tb); out('', tb)
        rows_ = []
        for nm, mask in [(s, t.slot == s) for s in ('F1', 'F2', 'F3', 'F4', 'D1', 'D2', 'D3')] + [(p, t.pos == p) for p in ('C', 'LW', 'RW', 'D')] + [('home', t.home == 1), ('away', t.home == 0), ('first PP unit', t.pp1 == 1), ('not on it', t.pp1 == 0)]:
            r = dict(segment=nm)
            for tier in t.tier.cat.categories:
                s_ = t[mask & (t.tier == tier)]; r[tier] = f'{100 * s_[f"h{k}"].mean():.0f}% ({len(s_)})' if len(s_) >= 40 else ''
            rows_.append(r)
        table(pd.DataFrame(rows_), tb)
    # venue split: his average at tonight's venue
    v = t[(t.vn >= 6)].copy(); v['vx'] = v.v_sog - v.s_sog
    v['vb'] = pd.cut(v.vx, [-9, -0.5, -0.2, 0.2, 0.5, 9], labels=['0.5+ under his season', '0.2–0.5 under', 'level', '0.2–0.5 over', '0.5+ over his season'])
    if ('full', 'sog') in fits:
        v = v[v.index.isin(fits[('full', 'sog')].index)]; v['lam'] = fits[('drop_sit', 'sog')].loc[v.index] if ('drop_sit', 'sog') in fits else fits[('full', 'sog')].loc[v.index]
        out('**His average at tonight\'s venue against his season** (6+ games at the venue) — shots against what the read without the venue split said', tb); out('', tb)
        table(v.groupby('vb', observed=True).agg(n=('id', 'size'), shots=('sog', 'mean'), said=('lam', 'mean'), went_3=('h3', 'mean')).assign(ratio=lambda x: x.shots / x.said).reset_index(), tb)

# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# E. every other angle, the shape of the count, the top of the night
# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
if 'E' in args.only:
    out('## E. Every other angle', tb); out('', tb)
    for y in YS: fit('full', FULL, y)
    # one read at a time on top of his production + attempts + minutes (the core), this season and last
    CORE = BASE + G['own'] + G['att'] + G['toi']
    singles = [c_ for g in ('pp', 'env', 'sit', 'team', 'out', 'streak') for c_ in G[g]]
    extra = {'per-60 × projected minutes (shots)': lg1(shrunk('sog', 12) / shrunk('toi', 5).clip(lower=4) * d.l5_toi.clip(lower=4)),
             'shots spread, last 10 (sd)': d.sd10_sog, 'his best game of the last 10': d.max10_sog,
             'opponent on a back-to-back, he is not': ((d.opp_tb2b == 1) & (d.b2b == 0)).astype(float),
             'the two teams\' shots (own for × opp allowed)': np.log(d.team_b_sf * d.opp_b_sa), 'the two teams\' goals (own for × opp allowed)': np.log(d.team_b_gf * d.opp_b_ga),
             'the opponent\'s win rate minus his team\'s': d.opp_s_win - d.team_s_win,
             'his shooting % this season over last (goals luck)': (d.s_g / d.s_sog.clip(lower=0.3) - d.ls_g / d.ls_sog.clip(lower=0.3)).where((d.n >= 8) & (d.ls_n >= 20))}
    for k_, v_ in extra.items():
        if v_ is not None: X[k_] = v_; singles.append(k_)
    core = {y: fit('core', CORE, y) for y in YS}
    def on_top(col, y):
        """Out-of-fold λ of the core × e^(a + b · the read): the core's λ as the offset (a rate y / λ weighted by λ is the same Poisson fit)."""
        x = X.loc[MAIN, [col]]; lam = core[y].loc[MAIN].values; yy = d.loc[MAIN, y].values.astype(float); grp = d.loc[MAIN, 'date'].values; pred = np.zeros(len(yy))
        for tr, te in GroupKFold(5).split(x, yy, grp):
            med = x.iloc[tr][col].median(); a_ = x.iloc[tr].fillna(med).values; b_ = x.iloc[te].fillna(med).values; mu, sd = a_.mean(), a_.std() or 1.0
            m = PoissonRegressor(alpha=0, max_iter=200).fit((a_ - mu) / sd, yy[tr] / lam[tr], sample_weight=lam[tr]); pred[te] = lam[te] * m.predict((b_ - mu) / sd)
        return pd.Series(pred, index=MAIN)
    rr = []
    for c_ in singles:
        r = dict(read=c_)
        for y in YS:
            g_, lo, hi = boot_gain(MAIN, y, on_top(c_, y), core[y]); r[YS[y]] = 1000 * g_; r[f'{YS[y]} 95%'] = f'{1000 * lo:+.1f} … {1000 * hi:+.1f}'; r[f'_{y}'] = hi < 0
        rr.append(r)
    R = pd.DataFrame(rr)
    out(f'One read at a time on top of the core (his production, attempts, minutes and line), both seasons, {len(MAIN)} skater-games: the change in deviance per skater-game ×1000 '
        '(negative = better) with its 95% interval over dates. A read counts when the whole interval is under 0.', tb); out('', tb)
    for y in YS:
        out(f'**{YS[y].capitalize()}** — the reads whose interval clears 0, then the rest', tb); out('', tb)
        a = R[R[f'_{y}']].sort_values(YS[y])[['read', YS[y], f'{YS[y]} 95%']]; b = R[~R[f'_{y}']].sort_values(YS[y])[['read', YS[y], f'{YS[y]} 95%']]
        table(a, tb); out('The rest: ' + '; '.join(f'{nm} {v:+.1f}' for nm, v in zip(b.read, b[YS[y]])), tb); out('', tb)
    # the effect sizes of the reads that clear: bottom fifth to top fifth on top of the core
    out('**What they are worth** — the count against the core\'s read, bottom fifth to top fifth of each read', tb); out('', tb)
    es = []
    for y in YS:
        for c_ in R[R[f'_{y}']].sort_values(YS[y]).read.head(8):
            x = X.loc[MAIN, c_]; q = pd.DataFrame({'x': x, 'y': d.loc[MAIN, y], 'lam': core[y]}).dropna()
            if q.x.nunique() <= 3: lo_, hi_ = q[q.x == q.x.min()], q[q.x == q.x.max()]; nm = 'no / yes'
            else: lo_, hi_ = q[q.x <= q.x.quantile(0.2)], q[q.x >= q.x.quantile(0.8)]; nm = 'bottom / top fifth'
            es.append(dict(stat=YS[y], read=c_, cut=nm, low=lo_.y.sum() / lo_.lam.sum(), high=hi_.y.sum() / hi_.lam.sum(), n_low=len(lo_), n_high=len(hi_)))
    table(pd.DataFrame(es), tb)
    # the shape of the count
    out('**The shape of the count** — is a Poisson at the read\'s λ the right ladder? Said against landed by band of the full read, shots', tb); out('', tb)
    q = d.loc[MAIN].copy(); q['lam'] = fits[('full', 'sog')]
    q['band'] = pd.cut(q.lam, [0, 1, 1.5, 2, 2.5, 3, 3.5, 9], labels=['under 1.0', '1.0–1.5', '1.5–2.0', '2.0–2.5', '2.5–3.0', '3.0–3.5', '3.5+'])
    sh = q.groupby('band', observed=True).apply(lambda x: pd.Series({'n': len(x), 'λ': x.lam.mean(), 'shots': x.sog.mean(), 'variance / mean': x.sog.var() / x.sog.mean(),
        **{f'{k}+ said': p_at(x.lam, k).mean() for k in (2, 3, 4, 5)}, **{f'{k}+ landed': (x.sog >= k).mean() for k in (2, 3, 4, 5)}})).reset_index()
    table(sh[['band', 'n', 'λ', 'shots', 'variance / mean', '2+ said', '2+ landed', '3+ said', '3+ landed', '4+ said', '4+ landed', '5+ said', '5+ landed']], tb)
    for y, k, nm in (('g', 1, '1+ goal'), ('pts', 1, '1+ point'), ('pts', 2, '2+ points')):
        q['l2'] = fits[('full', y)]; q['p'] = p_at(q.l2, k); q['pb'] = pd.cut(q.p, [0, .05, .1, .15, .2, .25, .3, .4, .5, .6, 1])
        out(f'{nm}: said against landed (Poisson at the full read)', tb); out('', tb)
        table(q.groupby('pb', observed=True).agg(n=('id', 'size'), said=('p', 'mean'), landed=(y, lambda x: (x >= k).mean())).reset_index().rename(columns={'pb': 'said band'}), tb)
    # does steadiness matter at the same λ
    q['sdb'] = pd.qcut(q.sd10_sog / np.sqrt(q.l10_sog.clip(lower=0.3)), 3, labels=['steady third', 'middle', 'streaky third'])
    out('**Steady against streaky at the same read** — skaters the full read has at 2.5+ shots, by the spread of their last 10 (sd / √mean)', tb); out('', tb)
    table(q[q.lam >= 2.5].groupby('sdb', observed=True).apply(lambda x: pd.Series({'n': len(x), 'λ': x.lam.mean(), 'shots': x.sog.mean(), '3+ said': p_at(x.lam, 3).mean(), '3+ landed': (x.sog >= 3).mean(), '4+ said': p_at(x.lam, 4).mean(), '4+ landed': (x.sog >= 4).mean()})).reset_index(), tb)
    # the top of the night
    out(f'**The top of the night** — the best 1 / 3 / 5 a night by each read and every call over a bar, {lab(CUR)} and {lab(CUR - 1)}', tb); out('', tb)
    reads = {'the site\'s plain-rate formula': {'sog': d.site_lam_s, 'g': d.site_lam_g}, 'his production alone': {y: fit('his production alone', BASE + G['own'], y) for y in YS},
             'the full read': {y: fits[('full', y)] for y in YS}, 'the full read, boosted': {y: fit('gbm', FULL, y, gbm=True) for y in YS},
             'hindsight: + tonight\'s minutes': {y: fit('+ tonight\'s minutes split EV / PP / SH', FULL + G['h_split'], y) for y in YS},
             'hindsight: + all of tonight': {y: fit('+ all of tonight', FULL + G['h_split'] + G['h_team'] + G['h_game'], y) for y in YS},
             'hindsight: his true rate (the rest of his season, this game left out; 20+ games)': {y: (((d.groupby(['id', 'season'])[y].transform('sum') - d[y]) / (d.groupby(['id', 'season'])[y].transform('size') - 1).clip(lower=1)).clip(lower=0.02)).where(d.groupby(['id', 'season'])[y].transform('size') >= 20) for y in YS}}
    for y, k, nm in (('sog', 3, '3+ SOG'), ('sog', 4, '4+ SOG'), ('g', 1, '1+ goal'), ('pts', 1, '1+ point')):
        rr = []
        for rn, rd_ in reads.items():
            if y not in rd_: continue
            for s in (CUR, CUR - 1):
                rows = MAIN[d.loc[MAIN, 'season'].values == s]; q2 = pd.DataFrame({'date': d.loc[rows, 'date'], 'lam': rd_[y].loc[rows], 'hit': (d.loc[rows, y] >= k).astype(int)}).dropna()
                q2['rk'] = q2.groupby('date').lam.rank(ascending=False, method='first'); q2['p'] = p_at(q2.lam, k)
                r = dict(read=rn, season=lab(s), top1=q2[q2.rk <= 1].hit.mean(), top3=q2[q2.rk <= 3].hit.mean(), top5=q2[q2.rk <= 5].hit.mean(), top10=q2[q2.rk <= 10].hit.mean(),
                         auc=roc_auc_score(q2.hit, q2.lam), brier=((q2.p - q2.hit) ** 2).mean())
                rr.append(r)
        out(f'{nm}', tb); out('', tb); table(pd.DataFrame(rr), tb)

# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# F. the site's plain-rate formula: this season alone against blended into last season
# ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
if 'F' in args.only:
    out('## F. The site\'s plain-rate formula, this season alone against blended', tb); out('', tb)
    SH = dict(const=-1.4391, sog=0.3923, icf=0.4484, toi=0.297, home=0.0341, pos=0.6869, b2b=-0.026)
    GO = dict(const=-1.0539, g=0.3735, iscf=0.4356, sog=0.4007, home=0.0682, pos=0.4448, b2b=-0.0677)
    LEAGUE = {'C': (1.73, 0.23), 'LW': (1.63, 0.21), 'RW': (1.69, 0.215), 'D': (1.27, 0.077)}
    lsog = d.pos.map(lambda p: LEAGUE[p][0]); lgl = d.pos.map(lambda p: LEAGUE[p][1]); lgv = lambda v: np.log(np.maximum(v, 0.05))
    posS = d.oppP_sog.fillna(lsog); posG = d.oppP_g.fillna(lgl)
    toi5 = d.groupby(['id', 'season'], sort=False).toi.transform(lambda x: x.shift().rolling(5, min_periods=1).mean()).fillna(d.ls_toi)
    def blend(c, k):          # this season into last at n / (n + k); k = 0 is this season alone, as shipped from his fifth game
        if k == 0: return d[f's_{c}']
        return (d[f's_{c}'].fillna(0) * d.n + d[f'ls_{c}'] * k) / (d.n + k)
    def lam_s(k): return np.exp(SH['const'] + SH['sog'] * lgv(blend('sog', k)) + SH['icf'] * lgv(blend('icf', k)) + SH['toi'] * lgv(toi5) + SH['home'] * d.home + SH['pos'] * lgv(posS) + SH['b2b'] * d.b2b)
    def lam_g(k, kg):
        wG = d.n / (d.n + 8); gR = (wG * d.s_g.clip(lower=0) + (1 - wG) * lgl) if kg == 0 else blend('g', kg)
        return np.exp(GO['const'] + GO['g'] * np.log(gR + 0.05) + GO['iscf'] * lgv(blend('iscf', k)) + GO['sog'] * lgv(blend('sog', k)) + GO['home'] * d.home + GO['pos'] * np.log(np.maximum(posG, 0) + 0.1) + GO['b2b'] * d.b2b)
    # the rows where the choice exists: five games this season (the shipped read is this season alone) and a last season to blend into
    FR = d.index[(d.season == CUR) & (d.n >= 5) & (d.ls_n >= 10)]
    out(f'{lab(CUR)}, the {len(FR)} skater-games with 5+ games this season (where the shipped read is this season\'s rate alone; Vincent\'s call, 2026-10-27) and 10+ last season to blend into. '
        'Same coefficients throughout; only the rates going in change: this season × n / (n + k) + last season × k / (n + k).', tb); out('', tb)
    def grade(lam, y, k, rows):
        q = pd.DataFrame({'date': d.loc[rows, 'date'], 'lam': lam.loc[rows], 'y': d.loc[rows, y]}).dropna(); q['p'] = p_at(q.lam, k); q['hit'] = (q.y >= k).astype(int)
        q['rk'] = q.groupby('date').lam.rank(ascending=False, method='first')
        base = d.loc[q.index].groupby('pos')[y].transform('mean')
        hi = q[q.p >= (0.5 if y == 'sog' else 0.3)]; top = q[q.p >= (0.6 if y == 'sog' else 0.4)]
        return dict(explained=100 * (1 - dev_rows(q.y, q.lam).sum() / dev_rows(q.y, base).sum()), brier=((q.p - q.hit) ** 2).mean(), top3=q[q.rk <= 3].hit.mean(), top10=q[q.rk <= 10].hit.mean(),
                    calls=len(hi), said=hi.p.mean(), landed=hi.hit.mean(), calls_top=len(top), said_top=top.p.mean(), landed_top=top.hit.mean())
    rr = [dict(read=f'shots, k = {k}' + (' (shipped)' if k == 0 else ''), **grade(lam_s(k), 'sog', 3, FR)) for k in (0, 5, 10, 15, 20, 30, 50)]
    out('**3+ SOG** (calls = said 50%+, then 60%+)', tb); out('', tb); table(pd.DataFrame(rr), tb)
    rr = [dict(read=f'goals, k = {k} (volume), his goal rate ' + ('as shipped: to the league\'s at n / (n + 8)' if kg == 0 else f'into last season\'s at k = {kg}'), **grade(lam_g(k, kg), 'g', 1, FR)) for k, kg in ((0, 0), (10, 0), (15, 0), (15, 20), (15, 40), (30, 40))]
    out('**1+ goal** (calls = said 30%+, then 40%+)', tb); out('', tb); table(pd.DataFrame(rr), tb)
    out('**By games played this season** — the share of the deviance explained, shipped against k = 15', tb); out('', tb)
    rr = []
    for a, b in ((5, 9), (10, 14), (15, 30)):
        rows = FR[(d.loc[FR, 'n'].values >= a) & (d.loc[FR, 'n'].values <= b)]
        if len(rows) > 300: rr.append(dict(games=f'{a}–{b}', n=len(rows), shots_shipped=grade(lam_s(0), 'sog', 3, rows)['explained'], shots_blended=grade(lam_s(15), 'sog', 3, rows)['explained'],
                                           goals_shipped=grade(lam_g(0, 0), 'g', 1, rows)['explained'], goals_blended=grade(lam_g(15, 40), 'g', 1, rows)['explained']))
    table(pd.DataFrame(rr), tb)
    # the same on last season, where the whole year is there
    PR = d.index[(d.season == CUR - 1) & (d.n >= 5) & (d.ls_n >= 10)]
    out(f'**The same on {lab(CUR - 1)}, by games played** ({len(PR)} skater-games)', tb); out('', tb)
    rr = []
    for a, b in ((5, 9), (10, 19), (20, 39), (40, 82)):
        rows = PR[(d.loc[PR, 'n'].values >= a) & (d.loc[PR, 'n'].values <= b)]
        rr.append(dict(games=f'{a}–{b}', n=len(rows), shots_shipped=grade(lam_s(0), 'sog', 3, rows)['explained'], shots_k15=grade(lam_s(15), 'sog', 3, rows)['explained'], shots_k30=grade(lam_s(30), 'sog', 3, rows)['explained'],
                       goals_shipped=grade(lam_g(0, 0), 'g', 1, rows)['explained'], goals_k15_40=grade(lam_g(15, 40), 'g', 1, rows)['explained']))
    table(pd.DataFrame(rr), tb)

open(args.tables, 'w').write('\n'.join(tb) + '\n')
open(args.out, 'w').write('\n'.join(md) + '\n')
print('written', args.tables)

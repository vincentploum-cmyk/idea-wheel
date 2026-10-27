"""Environment: Rink or PropFinder? Which defense read on the Matchups rink best picks the
skaters who go on to get shots and goals, graded against the box scores.

The rink's ice can be tinted two ways. "Rink" ranks the opponent from our stored skater rows
(this season AND last, by lineup position) over the window picked above the rink: tonight's
venue (the default), L5, L10, L5 home / away, head to head. "PropFinder" ranks it from
PropFinder's opponent table on the tab pressed above the rink: last season's full table,
this season's, or its L5 / L10 / L15. Every one of those reads is rebuilt here, leak-free
(from games before the row only), for one season of skater-games, then scored three ways:
how it correlates with what the skater actually did, what it adds to a projection on top of
the skater's own baseline, and, the practical one, the hit rate of 2+ / 3+ / 4+ SOG and
1+ goal when the rink shows the band soft / mid / tough.

Section 7 (2026-10-27): the tint by the MODEL'S LANE RULE against the tint by the SOG rank third.
The rink tinted by shots allowed alone while the model (`classifyDefenseLaneState` in
components/nhl/model-core.js) reads the opponent's shots, iCF, iFF and iSCF ranks together, so the
season tabs' attempts columns (per game to the position, PropFinder's figure, and per skater) are
rebuilt and ranked the same way, the lane state is read off them by the model's rule, and both tints
are scored: each column alone on top of the skater's baseline, the band as a categorical read, and
the hit rates by band.

argv: <rows.csv of the season under test> <games dir of that season> <games dir of the
previous season> <label> [propfinder opponents csv of the previous season]

The previous season's games give the "last season" reads (what the PropFinder tab shows
until this season's table fills, and the half of the Rink's two-season window the stored
rows carry). When the PropFinder CSV (tools/predictors/pf_dump.py) is given, its own
numbers and ranks are scored as a read of their own, next to the same figure rebuilt from
the NHL box scores.
"""
import sys, glob, json, csv, math, warnings
from collections import defaultdict
import numpy as np, pandas as pd, statsmodels.api as sm
from scipy import stats
from sklearn.model_selection import GroupKFold
warnings.filterwarnings('ignore')

rows_csv, cur_dir, prev_dir, label = sys.argv[1:5]
pf_csv = sys.argv[5] if len(sys.argv) > 5 else None
POS = ('C', 'LW', 'RW', 'D')
TEAMS = 32

def load_games(d):
    out = []
    for f in sorted(glob.glob(f'{d}/*.json')):
        out += json.load(open(f))['games']
    out.sort(key=lambda g: (g['date'], g['id']))
    return out

def defense_games(games):
    """Per defending team, in date order: what it allowed in each game, by position."""
    hist = defaultdict(list)
    for g in games:
        for side, other in (('home', 'away'), ('away', 'home')):
            d = g[side]['abbrev']
            tot = {p: [0, 0, 0, 0, 0, 0] for p in POS}  # sog, g, skaters, icf, iff, iscf
            for s in g['skaters']:
                if s['opp'] != d or s['pos'] not in POS: continue
                t = tot[s['pos']]; t[0] += s['sog']; t[1] += s['g']; t[2] += 1; t[3] += s['icf']; t[4] += s['iff']; t[5] += s['iscf']
            hist[d].append(dict(date=g['date'], gameId=g['id'], dv='H' if side == 'home' else 'A',
                                sa=g[other]['sog'], ga=g[other]['score'], pos=tot))
    return hist

def agg(gs, pos, k):
    """Per-game total allowed to `pos` (k=0 shots, 1 goals, 3 iCF, 4 iFF, 5 iSCF), PropFinder's definition, and per skater."""
    if not gs: return (np.nan, np.nan)
    tot = sum(x['pos'][pos][k] for x in gs); n = sum(x['pos'][pos][2] for x in gs)
    return (tot / len(gs), tot / n if n else np.nan)

cur, prev = load_games(cur_dir), load_games(prev_dir)
cur_hist, prev_hist = defense_games(cur), defense_games(prev)
teams = sorted(set(cur_hist) | set(prev_hist))

# ---- static reads from last season (what the PropFinder tab shows as last season, and the
# ---- stored rows' older half): full season, last 10 games, at each venue
static = {}  # (team, pos, read) -> (shots per game, goals per game)
for t in teams:
    h = prev_hist.get(t, [])
    for p in POS:
        static[(t, p, 'ls_season')] = agg(h, p, 0)[0], agg(h, p, 1)[0]
        static[(t, p, 'ls_L10')] = agg(h[-10:], p, 0)[0], agg(h[-10:], p, 1)[0]
        for v in 'HA':
            hv = [x for x in h if x['dv'] == v]
            static[(t, p, f'ls_venue{v}')] = agg(hv, p, 0)[0], agg(hv, p, 1)[0]
    static[(t, 'team', 'ls_season')] = (np.mean([x['sa'] for x in h]) if h else np.nan, np.mean([x['ga'] for x in h]) if h else np.nan)

# ---- the attempts columns of the two season tabs (what PropFinder's table shows beside SOG and goals),
# ---- per game to the position and per skater, for the lane rule and the column-by-column comparison
XCOLS = ['sog', 'g', 'icf', 'iff', 'iscf']
XK = {'sog': 0, 'g': 1, 'icf': 3, 'iff': 4, 'iscf': 5}
LANE_READS = ['std_all', 'ls_season']
def attempts_of(gs, pos):
    out = {}
    for c, k in XK.items():
        pg, per = agg(gs, pos, k)
        out[c] = pg; out[f'{c}_per'] = per
    return out
static_x = {(t, p): attempts_of(prev_hist.get(t, []), p) for t in teams for p in POS}

def lane_shots(sog, icf, iff, iscf):
    """classifyDefenseLaneState(…, 'shots') in model-core.js on the four ranks (1 = allows the most; nan = no rank)."""
    rs = [r for r in (sog, icf, iff, iscf) if r == r]
    opened = sum(1 for r in rs if r <= 12); supp = sum(1 for r in rs if r >= 23)
    if opened >= 2 or (sog == sog and sog <= 12) or (iscf == iscf and iscf <= 12): return 'open'
    if supp >= 3 or (sog == sog and sog >= 23 and iscf == iscf and iscf >= 23): return 'suppressed'
    return 'neutral'
def lane_goals(g, iscf, sog):
    """classifyDefenseLaneState(…, 'goals'): goals, iSCF and shots allowed."""
    rs = [r for r in (g, iscf, sog) if r == r]
    opened = sum(1 for r in rs if r <= 16); supp = sum(1 for r in rs if r >= 23)
    if opened >= 2 or (g == g and g <= 16) or (iscf == iscf and iscf <= 12): return 'open'
    if supp >= 2 or (g == g and g >= 23 and iscf == iscf and iscf >= 23): return 'suppressed'
    return 'neutral'

pf = {}
if pf_csv:
    for r in csv.DictReader(open(pf_csv)):
        pf[(r['abbr'], r['position'], r['window'])] = r

# ---- the reads, per date: every team's value on that date, then its league rank (1 = most allowed)
READS = ['pf_ls_season', 'pf_ls_L10', 'ls_season', 'ls_L10', 'ls_venue', 'std_all', 'std_venue', 'L5', 'L10', 'L5_venue',
         'rink_venue', 'rink_L5', 'rink_L10', 'rink_L5_venue', 'team_ls', 'team_std', 'team_L10']
DESC = {
    'pf_ls_season': "PropFinder tab, last season's full table (its own numbers + ranks)",
    'pf_ls_L10': "PropFinder tab, last season's L10 (its own numbers + ranks)",
    'ls_season': "last season, full, by position (rebuilt from box scores)",
    'ls_L10': "last season's last 10 games, by position",
    'ls_venue': "last season at tonight's venue, by position",
    'std_all': "this season to date, all games, by position (PropFinder's this-season tab)",
    'std_venue': "this season to date at tonight's venue, by position",
    'L5': "last 5 games this season, by position (PropFinder L5 / Rink L5 once the season is older)",
    'L10': "last 10 games this season, by position (PropFinder L10)",
    'L5_venue': "last 5 at tonight's venue, this season (Rink L5 home / away)",
    'rink_venue': "RINK DEFAULT: tonight's venue, last season + this season, by position",
    'rink_L5': "Rink L5: last 5 games across the two seasons, by position",
    'rink_L10': "Rink L10: last 10 across the two seasons, by position",
    'rink_L5_venue': "Rink L5 home / away across the two seasons",
    'team_ls': "team total shots / goals allowed per game, last season",
    'team_std': "team total, this season to date",
    'team_L10': "team total, last 10 this season",
}

def reads_for(team, pos, dv, h):
    """h = the team's games this season before today. Returns {read: (sog/g, g/g)}."""
    hv = [x for x in h if x['dv'] == dv]
    ph = prev_hist.get(team, [])
    phv = [x for x in ph if x['dv'] == dv]
    two = ph + h; twov = phv + hv
    out = {
        'ls_season': static[(team, pos, 'ls_season')], 'ls_L10': static[(team, pos, 'ls_L10')], 'ls_venue': static[(team, pos, f'ls_venue{dv}')],
        'std_all': (agg(h, pos, 0)[0], agg(h, pos, 1)[0]), 'std_venue': (agg(hv, pos, 0)[0], agg(hv, pos, 1)[0]),
        'L5': (agg(h[-5:], pos, 0)[0], agg(h[-5:], pos, 1)[0]) if len(h) >= 5 else (np.nan, np.nan),
        'L10': (agg(h[-10:], pos, 0)[0], agg(h[-10:], pos, 1)[0]) if len(h) >= 10 else (np.nan, np.nan),
        'L5_venue': (agg(hv[-5:], pos, 0)[0], agg(hv[-5:], pos, 1)[0]) if len(hv) >= 5 else (np.nan, np.nan),
        'rink_venue': (agg(twov, pos, 0)[0], agg(twov, pos, 1)[0]),
        'rink_L5': (agg(two[-5:], pos, 0)[0], agg(two[-5:], pos, 1)[0]),
        'rink_L10': (agg(two[-10:], pos, 0)[0], agg(two[-10:], pos, 1)[0]),
        'rink_L5_venue': (agg(twov[-5:], pos, 0)[0], agg(twov[-5:], pos, 1)[0]),
        'team_ls': static[(team, 'team', 'ls_season')],
        'team_std': (np.mean([x['sa'] for x in h]) if h else np.nan, np.mean([x['ga'] for x in h]) if h else np.nan),
        'team_L10': (np.mean([x['sa'] for x in h[-10:]]) if len(h) >= 10 else np.nan, np.mean([x['ga'] for x in h[-10:]]) if len(h) >= 10 else np.nan),
    }
    r = pf.get((team, pos, 'season')); r10 = pf.get((team, pos, '10'))
    out['pf_ls_season'] = (float(r['sog']), float(r['g'])) if r else (np.nan, np.nan)
    out['pf_ls_L10'] = (float(r10['sog']), float(r10['g'])) if r10 else (np.nan, np.nan)
    return out

def rank_of(vals, v):
    """1 = most allowed among the league's values that day; ties share the better rank."""
    if v is None or (isinstance(v, float) and math.isnan(v)): return np.nan
    return 1 + sum(1 for x in vals if x > v)

d = pd.read_csv(rows_csv).sort_values(['date', 'gameId']).reset_index(drop=True)
hist = defaultdict(list)
feat = []
cur_by_date = defaultdict(list)
for g in cur: cur_by_date[g['date']].append(g)
for date, day in d.groupby('date', sort=True):
    # every team's reads today, for the ranks
    league = {}
    for t in teams:
        for p in POS:
            for dv in 'HA':
                league[(t, p, dv)] = reads_for(t, p, dv, hist[t])
    rank_pool = {}
    for p in POS:
        for dv in 'HA':
            for rd in READS:
                for k in (0, 1):
                    rank_pool[(p, dv, rd, k)] = [league[(t, p, dv)][rd][k] for t in teams if not math.isnan(league[(t, p, dv)][rd][k])]
    # the season tabs' attempts columns today (neither depends on the venue), with their league ranks
    xleague = {(t, p, 'std_all'): attempts_of(hist[t], p) for t in teams for p in POS}
    xleague.update({(t, p, 'ls_season'): static_x[(t, p)] for t in teams for p in POS})
    xpool = {(p, rd, c): [xleague[(t, p, rd)][c] for t in teams if xleague[(t, p, rd)][c] == xleague[(t, p, rd)][c]] for p in POS for rd in LANE_READS for c in XCOLS}
    for r in day.itertuples():
        dv = 'A' if r.venue == 'H' else 'H'
        rr = league[(r.opp, r.pos, dv)]
        rec = {'idx': r.Index, 'opp_games': len(hist[r.opp])}
        for rd in LANE_READS:
            x = xleague[(r.opp, r.pos, rd)]
            for c in XCOLS:
                rec[f'{rd}_x_{c}'] = x[c]; rec[f'{rd}_x_{c}_per'] = x[f'{c}_per']
                rec[f'{rd}_x_{c}_rank'] = rank_of(xpool[(r.pos, rd, c)], x[c])
            rec[f'{rd}_lane_sog'] = lane_shots(rec[f'{rd}_x_sog_rank'], rec[f'{rd}_x_icf_rank'], rec[f'{rd}_x_iff_rank'], rec[f'{rd}_x_iscf_rank']) if x['sog'] == x['sog'] else 'n/a'
            rec[f'{rd}_lane_g'] = lane_goals(rec[f'{rd}_x_g_rank'], rec[f'{rd}_x_iscf_rank'], rec[f'{rd}_x_sog_rank']) if x['sog'] == x['sog'] else 'n/a'
        for rd in READS:
            rec[f'{rd}_sog'], rec[f'{rd}_g'] = rr[rd]
            if rd.startswith('pf_'):
                src = pf.get((r.opp, r.pos, 'season' if rd == 'pf_ls_season' else '10'))
                rec[f'{rd}_sog_rank'] = float(src['sog_rank']) if src else np.nan
                rec[f'{rd}_g_rank'] = float(src['g_rank']) if src else np.nan
            else:
                rec[f'{rd}_sog_rank'] = rank_of(rank_pool[(r.pos, dv, rd, 0)], rr[rd][0])
                rec[f'{rd}_g_rank'] = rank_of(rank_pool[(r.pos, dv, rd, 1)], rr[rd][1])
        feat.append(rec)
    for g in cur_by_date.get(date, []):
        for side, other in (('home', 'away'), ('away', 'home')):
            t = g[side]['abbrev']
            tot = {p: [0, 0, 0, 0, 0, 0] for p in POS}
            for s in g['skaters']:
                if s['opp'] != t or s['pos'] not in POS: continue
                x = tot[s['pos']]; x[0] += s['sog']; x[1] += s['g']; x[2] += 1; x[3] += s['icf']; x[4] += s['iff']; x[5] += s['iscf']
            hist[t].append(dict(date=g['date'], gameId=g['id'], dv='H' if side == 'home' else 'A', sa=g[other]['sog'], ga=g[other]['score'], pos=tot))
d = d.join(pd.DataFrame(feat).set_index('idx'))
d.to_csv(rows_csv.replace('.csv', '-envsrc.csv'), index=False)

# ---- the skater's own baseline: last season blended with this season at n / (n + 18) (shots), n / (n + 40) (goals)
n = d.n_prior.fillna(0)
w = n / (n + 18); wg = n / (n + 40)
d['bl_sog'] = np.where(d.p_sog_avg.notna(), w * d.p_sog_avg.fillna(0) + (1 - w) * d.ls_sog_pg, d.ls_sog_pg)
d['bl_icf'] = np.where(d.p_icf_avg.notna(), w * d.p_icf_avg.fillna(0) + (1 - w) * d.ls_icf_pg, d.ls_icf_pg)
d['bl_g'] = np.where(d.p_g_avg.notna(), wg * d.p_g_avg.fillna(0) + (1 - wg) * d.ls_g_pg, d.ls_g_pg)
d['bl_xg'] = np.where(d.p_iscf_avg.notna(), wg * d.p_iscf_avg.fillna(0) * d.ls_xg_pg / d.ls_iscf_pg.replace(0, np.nan) if 'ls_iscf_pg' in d else d.ls_xg_pg, d.ls_xg_pg) if False else d.ls_xg_pg
base = d[d.ls_sog_pg.notna()].copy()
print(f'=== {label}: {len(d)} skater-games, {d.gameId.nunique()} games; {len(base)} with a last-season prior ===')

def tone(rank):
    third = TEAMS / 3
    return np.where(rank.isna(), 'n/a', np.where(rank <= third, 'soft', np.where(rank > TEAMS - third, 'tough', 'mid')))

def cv(df, cols, target):
    df = df.dropna(subset=cols + [target]); X = sm.add_constant(df[cols].astype(float), has_constant='add'); y = df[target].values.astype(float); pred = np.zeros(len(df))
    for tr, te in GroupKFold(5).split(X, y, df.gameId):
        pred[te] = np.clip(sm.GLM(y[tr], X.iloc[tr], family=sm.families.Poisson()).fit().predict(X.iloc[te]), 0.02, 15)
    dev = 2 * np.mean(np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / pred), 0) - (y - pred))
    out = dict(n=len(df), dev=dev)
    for k in ([3] if target == 'sog' else [1]):
        p = np.clip(1 - stats.poisson.cdf(k - 1, pred), 1e-3, 1 - 1e-3); hit = (y >= k).astype(float)
        out[f'll{k}'] = -np.mean(hit * np.log(p) + (1 - hit) * np.log(1 - p))
    return out

pd.set_option('display.width', 220)
fmt = lambda v: f'{v:.4f}'

# ---------------- 1. PropFinder's table vs the same figure rebuilt from box scores
if pf:
    print('\n--- 1. PropFinder\'s last-season table vs the same figure rebuilt from the NHL box scores ---')
    chk = base.dropna(subset=['pf_ls_season_sog', 'ls_season_sog']).drop_duplicates(['opp', 'pos'])
    print(f'   {len(chk)} team x position cells: SOG/G rebuilt vs PropFinder r = {stats.pearsonr(chk.ls_season_sog, chk.pf_ls_season_sog)[0]:.3f}, '
          f'rank agreement (Spearman) = {stats.spearmanr(chk.ls_season_sog_rank, chk.pf_ls_season_sog_rank)[0]:.3f}; '
          f'G/G r = {stats.pearsonr(chk.ls_season_g, chk.pf_ls_season_g)[0]:.3f}, rank {stats.spearmanr(chk.ls_season_g_rank, chk.pf_ls_season_g_rank)[0]:.3f}')
    same = (tone(chk.ls_season_sog_rank) == tone(chk.pf_ls_season_sog_rank)).mean()
    print(f'   same soft / mid / tough band on SOG in {100*same:.0f}% of cells (PropFinder\'s full season includes the playoffs; the rebuild is regular season)')

# ---------------- 2. correlation with what happened, raw and after the skater's own baseline
print('\n--- 2. Each read against the box score: Spearman of the band rank (position-neutral; + = softer band, more shots) with SOG and goals, raw and after the skater\'s own baseline ---')
X = sm.add_constant(base[['bl_sog', 'bl_icf', 'home']].astype(float)); m = sm.GLM(base.sog.astype(float), X, family=sm.families.Poisson()).fit()
base['res_sog'] = base.sog - m.predict(X)
bg = base.dropna(subset=['bl_g', 'ls_xg_pg']).copy()
Xg = sm.add_constant(bg[['bl_g', 'ls_xg_pg', 'bl_sog', 'home']].astype(float)); mg = sm.GLM(bg.g.astype(float), Xg, family=sm.families.Poisson()).fit()
bg['res_g'] = bg.g - mg.predict(Xg)
tab = []
for rd in READS:
    s = base.dropna(subset=[f'{rd}_sog']); gg = bg.dropna(subset=[f'{rd}_g'])
    if len(s) < 50: continue
    tab.append(dict(read=rd, n=len(s), rho_sog=-stats.spearmanr(s[f'{rd}_sog_rank'], s.sog)[0], rho_sog_resid=-stats.spearmanr(s[f'{rd}_sog_rank'], s.res_sog)[0],
                    rho_g=-stats.spearmanr(gg[f'{rd}_g_rank'], gg.g)[0] if len(gg) else np.nan, rho_g_resid=-stats.spearmanr(gg[f'{rd}_g_rank'], gg.res_g)[0] if len(gg) else np.nan))
print(pd.DataFrame(tab).to_string(index=False, float_format=lambda v: f'{v:.3f}'))

# ---------------- 3. value on top of the baseline, same rows (every read present)
print('\n--- 3. SOG: skater baseline + ONE environment read, cross-validated Poisson deviance (lower is better), same rows ---')
core = ['bl_sog', 'bl_icf', 'home']
avail = [rd for rd in READS if base[f'{rd}_sog'].notna().mean() > 0.5]
common = base.dropna(subset=[f'{rd}_sog' for rd in avail if not rd.startswith('L') and rd not in ('team_L10',)])
print(f'   rows where every season-type read exists: {len(common)} (L5 / L10 reads need the opponent to have 5 / 10 games and are scored on their own rows below)')
res = [dict(read='none (skater only)', **cv(common, core, 'sog'))]
for rd in avail:
    res.append(dict(read=rd, **cv(common, core + [f'{rd}_sog'], 'sog')))
for cols, nm in [(['ls_season_sog', 'std_all_sog'], 'last season + this season to date (position)'), (['pf_ls_season_sog', 'std_all_sog'], 'PropFinder last season + this season to date'), (['rink_venue_sog', 'std_all_sog'], 'rink venue + this season to date')]:
    if all(common[c].notna().mean() > 0.5 for c in cols): res.append(dict(read=nm, **cv(common, core + cols, 'sog')))
r3 = pd.DataFrame(res); r3['gain_vs_none'] = r3.dev.iloc[0] - r3.dev
print(r3.to_string(index=False, float_format=fmt))
print('\n   effect size per read (full fit): % SOG per one SD of the read, and z')
for rd in avail:
    df = common.dropna(subset=[f'{rd}_sog']); Xr = sm.add_constant(df[core + [f'{rd}_sog']].astype(float)); mr = sm.GLM(df.sog.astype(float), Xr, family=sm.families.Poisson()).fit()
    sd = df[f'{rd}_sog'].std(); print(f'   {rd:14s} {100*(np.exp(mr.params[f"{rd}_sog"]*sd)-1):6.1f}% per SD ({sd:.2f} SOG/G allowed)   z {mr.tvalues[f"{rd}_sog"]:5.1f}')

print('\n--- 3b. Goals: goal baseline + ONE environment read (goals allowed and shots allowed to the position) ---')
coreg = ['bl_g', 'ls_xg_pg', 'bl_sog', 'home']
cg = bg.dropna(subset=[f'{rd}_g' for rd in avail if not rd.startswith('L') and rd not in ('team_L10',)])
res = [dict(read='none (skater only)', **cv(cg, coreg, 'g'))]
for rd in avail:
    res.append(dict(read=f'{rd} goals allowed', **cv(cg, coreg + [f'{rd}_g'], 'g')))
    res.append(dict(read=f'{rd} shots allowed', **cv(cg, coreg + [f'{rd}_sog'], 'g')))
r3g = pd.DataFrame(res); r3g['gain_vs_none'] = r3g.dev.iloc[0] - r3g.dev
print(r3g.to_string(index=False, float_format=fmt))

# ---------------- 4. the practical read: hit rates by the band's colour, within the skater's tier
print('\n--- 4. What the band colour is worth: actual hit rates by soft / mid / tough (rank thirds, as the rink tints), skaters with a last-season prior ---')
def band_table(df, rd, stat='sog'):
    t = df.copy(); t['tone'] = tone(t[f'{rd}_{stat}_rank']); t = t[t.tone != 'n/a']
    if not len(t): return None
    out = t.groupby('tone').agg(n=('sog', 'size'), sog=('sog', 'mean'), p2=('sog', lambda s: (s >= 2).mean()), p3=('sog', lambda s: (s >= 3).mean()), p4=('sog', lambda s: (s >= 4).mean()), g1=('g', lambda s: (s >= 1).mean()))
    return out.reindex(['soft', 'mid', 'tough'])
for rd in avail:
    bt = band_table(base, rd)
    if bt is None or bt.n.min() < 30: continue
    print(f'\n   {rd}: {DESC[rd]}')
    print(bt.to_string(float_format=lambda v: f'{v:.3f}'))
    print(f'   soft - tough: SOG {bt.sog.soft - bt.sog.tough:+.2f}, P(3+) {100*(bt.p3.soft - bt.p3.tough):+.1f} pts, P(1+ G) {100*(bt.g1.soft - bt.g1.tough):+.1f} pts')

# within tiers: the filter the user applies pre-game
print('\n--- 5. Pre-game filter: last-season SOG/G tier x band colour -> what happened (the two best season reads and the rink default) ---')
base['tier'] = pd.cut(base.ls_sog_pg, [0, 1.5, 2, 2.5, 3, 10], labels=['<1.5', '1.5-2', '2-2.5', '2.5-3', '3+'], right=False)
for rd in [x for x in ['pf_ls_season', 'ls_season', 'std_all', 'rink_venue', 'rink_L5', 'L10'] if x in avail]:
    t = base.copy(); t['tone'] = tone(t[f'{rd}_sog_rank']); t = t[t.tone != 'n/a']
    if len(t) < 200: continue
    print(f'\n   {rd}: {DESC[rd]}')
    piv = t.groupby(['tier', 'tone'], observed=True).agg(n=('sog', 'size'), sog=('sog', 'mean'), p3=('sog', lambda s: (s >= 3).mean()), p4=('sog', lambda s: (s >= 4).mean())).unstack('tone')
    piv = piv.reindex(columns=pd.MultiIndex.from_product([['n', 'sog', 'p3', 'p4'], ['soft', 'mid', 'tough']]))
    print(piv.to_string(float_format=lambda v: f'{v:.2f}'))
print('\n--- 5b. Goals: last-season goals/G tier x goals-allowed band colour -> P(1+ goal) ---')
bg['gtier'] = pd.cut(bg.ls_g_pg, [0, 0.15, 0.25, 0.35, 0.5, 5], labels=['<.15', '.15-.25', '.25-.35', '.35-.5', '.5+'], right=False)
for rd in [x for x in ['pf_ls_season', 'ls_season', 'std_all', 'rink_venue', 'rink_L5'] if x in avail]:
    t = bg.copy(); t['tone'] = tone(t[f'{rd}_g_rank']); t = t[t.tone != 'n/a']
    if len(t) < 200: continue
    print(f'\n   {rd} (goals allowed to the position): {DESC[rd]}')
    piv = t.groupby(['gtier', 'tone'], observed=True).agg(n=('g', 'size'), g1=('g', lambda s: (s >= 1).mean())).unstack('tone')
    piv = piv.reindex(columns=pd.MultiIndex.from_product([['n', 'g1'], ['soft', 'mid', 'tough']]))
    print(piv.to_string(float_format=lambda v: f'{v:.3f}'))
    t2 = t.copy(); t2['tone'] = tone(t2[f'{rd}_sog_rank']); t2 = t2[t2.tone != 'n/a']
    piv = t2.groupby(['gtier', 'tone'], observed=True).agg(g1=('g', lambda s: (s >= 1).mean())).unstack('tone').reindex(columns=pd.MultiIndex.from_product([['g1'], ['soft', 'mid', 'tough']]))
    print('   same tiers, band by SHOTS allowed to the position:')
    print(piv.to_string(float_format=lambda v: f'{v:.3f}'))

# ---------------- 6. by how old the opponent's season is: when does this season's read overtake last season's?
print('\n--- 6. By the opponent\'s games played this season: deviance of baseline + last season (position) vs + this season to date (position) vs + rink default ---')
for lo, hi in [(0, 4), (5, 9), (10, 14), (15, 19), (20, 29), (30, 49), (50, 99)]:
    sub = base[(base.opp_games >= lo) & (base.opp_games <= hi)].dropna(subset=['ls_season_sog', 'rink_venue_sog'])
    if len(sub) < 400: continue
    r0 = cv(sub, core, 'sog')['dev']; r1 = cv(sub, core + ['ls_season_sog'], 'sog')['dev']
    r2 = cv(sub, core + ['std_all_sog'], 'sog')['dev'] if sub.std_all_sog.notna().all() else np.nan
    r3v = cv(sub, core + ['rink_venue_sog'], 'sog')['dev']; r4 = cv(sub, core + ['ls_season_sog', 'std_all_sog'], 'sog')['dev'] if sub.std_all_sog.notna().all() else np.nan
    r5 = cv(sub, core + ['pf_ls_season_sog'], 'sog')['dev'] if pf and sub.pf_ls_season_sog.notna().all() else np.nan
    print(f'   opp games {lo:2d}-{hi:2d}  n={len(sub):6d}  none {r0:.4f}  last season {r1:.4f}  PropFinder last season {r5:.4f}  this season {r2:.4f}  rink venue {r3v:.4f}  last+this {r4:.4f}')

# ---------------- 7. the model's lane rule vs the SOG rank third: which tint reads better? (2026-10-27)
print('\n--- 7. The tint by the MODEL\'S LANE RULE (shots, iCF, iFF, iSCF allowed together; classifyDefenseLaneState in model-core.js) against the tint by the SOG rank third, on the season tabs ---')
LANE_DESC = {'std_all': "this season to date, by position (PropFinder's this-season tab, the one the rink opens on)", 'ls_season': "last season's full table, by position"}
def dummies(df, col, levels=('soft', 'tough')):
    out = []
    for lv in levels:
        name = f'{col}_is_{lv}'; df[name] = (df[col] == lv).astype(float); out.append(name)
    return out
for rd in LANE_READS:
    sub = base[base[f'{rd}_x_sog'].notna()].copy()
    if len(sub) < 400: continue
    print(f'\n   === {rd}: {LANE_DESC[rd]} ({len(sub)} skater-games) ===')
    # 7a. each column of the table alone on top of the skater's baseline, per game to the position and per skater
    print('   7a. SOG: skater baseline + ONE column of the table, cross-validated Poisson deviance (lower is better), gain over the skater alone, z and % SOG per SD (full fit)')
    r0 = cv(sub, core, 'sog')['dev']
    for unit, suffix in (('per game to the position (the table\'s figure)', ''), ('per skater at the position', '_per')):
        print(f'      {unit}:')
        for c in ('sog', 'icf', 'iff', 'iscf'):
            col = f'{rd}_x_{c}{suffix}'
            df = sub.dropna(subset=[col]); df = df[df[col] > 0]
            if len(df) < 400: continue
            dev = cv(df, core + [col], 'sog')['dev']; b0 = cv(df, core, 'sog')['dev']
            Xr = sm.add_constant(df[core + [col]].astype(float)); mr = sm.GLM(df.sog.astype(float), Xr, family=sm.families.Poisson()).fit(); sd = df[col].std()
            print(f'         {c:5s} allowed  dev {dev:.4f}  gain {b0 - dev:+.4f}  z {mr.tvalues[col]:5.1f}  {100*(np.exp(mr.params[col]*sd)-1):5.1f}% per SD')
        # all four together
        cols = [f'{rd}_x_{c}{suffix}' for c in ('sog', 'icf', 'iff', 'iscf')]
        df = sub.dropna(subset=cols)
        if len(df) >= 400:
            print(f'         all four      dev {cv(df, core + cols, "sog")["dev"]:.4f}  gain {cv(df, core, "sog")["dev"] - cv(df, core + cols, "sog")["dev"]:+.4f}')
    # 7b. the two tints as categorical reads (soft / tough dummies) on the same rows
    sub['third_sog'] = tone(sub[f'{rd}_x_sog_rank']); sub['third_iff'] = tone(sub[f'{rd}_x_iff_rank']); sub['third_g'] = tone(sub[f'{rd}_x_g_rank'])
    both = sub[(sub.third_sog != 'n/a') & (sub[f'{rd}_lane_sog'] != 'n/a')].copy()
    d_third = dummies(both, 'third_sog'); d_iff = dummies(both, 'third_iff'); d_lane = dummies(both, f'{rd}_lane_sog', ('open', 'suppressed'))
    b0 = cv(both, core, 'sog')['dev']
    print(f'   7b. SOG: the tint as a read (soft / tough dummies on top of the skater baseline), {len(both)} rows: none {b0:.4f}'
          f'  SOG third {cv(both, core + d_third, "sog")["dev"]:.4f} (gain {b0 - cv(both, core + d_third, "sog")["dev"]:+.4f})'
          f'  iFF third {cv(both, core + d_iff, "sog")["dev"]:.4f} (gain {b0 - cv(both, core + d_iff, "sog")["dev"]:+.4f})'
          f'  model lane {cv(both, core + d_lane, "sog")["dev"]:.4f} (gain {b0 - cv(both, core + d_lane, "sog")["dev"]:+.4f})'
          f'  SOG third + lane {cv(both, core + d_third + d_lane, "sog")["dev"]:.4f}')
    agree = (both.third_sog.map({'soft': 'open', 'mid': 'neutral', 'tough': 'suppressed'}) == both[f'{rd}_lane_sog']).mean()
    print(f'       the lane and the SOG third give the same colour on {100*agree:.0f}% of rows; share of rows: ' + ', '.join(f'{k} {100*v:.0f}%' for k, v in both[f'{rd}_lane_sog'].value_counts(normalize=True).items()) + ' (lane) vs ' + ', '.join(f'{k} {100*v:.0f}%' for k, v in both.third_sog.value_counts(normalize=True).items()) + ' (SOG third)')
    # 7c. hit rates by band, each tint
    def band_rates(df, col, order):
        t = df[df[col].isin(order)]
        out = t.groupby(col).agg(n=('sog', 'size'), sog=('sog', 'mean'), p2=('sog', lambda s: (s >= 2).mean()), p3=('sog', lambda s: (s >= 3).mean()), p4=('sog', lambda s: (s >= 4).mean()), g1=('g', lambda s: (s >= 1).mean()))
        return out.reindex(order)
    for name, col, order in (('SOG rank third (the tint until 2026-10-27)', 'third_sog', ['soft', 'mid', 'tough']), ('iFF rank third', 'third_iff', ['soft', 'mid', 'tough']), ('the model\'s lane rule (the tint since)', f'{rd}_lane_sog', ['open', 'neutral', 'suppressed'])):
        bt = band_rates(both, col, order)
        if bt.n.min() < 30: continue
        print(f'   7c. by {name}:')
        print('      ' + bt.to_string(float_format=lambda v: f'{v:.3f}').replace('\n', '\n      '))
        print(f'      favourable - stingy: SOG {bt.sog.iloc[0] - bt.sog.iloc[2]:+.2f}, P(3+) {100*(bt.p3.iloc[0] - bt.p3.iloc[2]):+.1f} pts, P(4+) {100*(bt.p4.iloc[0] - bt.p4.iloc[2]):+.1f} pts, P(1+ G) {100*(bt.g1.iloc[0] - bt.g1.iloc[2]):+.1f} pts')
    # where they disagree: SOG third says soft but the lane says neutral / suppressed, and the other way
    dis = both[(both.third_sog == 'soft') & (both[f'{rd}_lane_sog'] != 'open')]; dis2 = both[(both.third_sog != 'soft') & (both[f'{rd}_lane_sog'] == 'open')]
    dis3 = both[(both.third_sog == 'tough') & (both[f'{rd}_lane_sog'] != 'suppressed')]; dis4 = both[(both.third_sog != 'tough') & (both[f'{rd}_lane_sog'] == 'suppressed')]
    print(f'       disagreements: SOG-soft but not lane-open n={len(dis)} SOG {dis.sog.mean():.2f} P(3+) {100*(dis.sog >= 3).mean():.1f}% · lane-open but not SOG-soft n={len(dis2)} SOG {dis2.sog.mean():.2f} P(3+) {100*(dis2.sog >= 3).mean():.1f}%'
          f' · SOG-tough but not lane-suppressed n={len(dis3)} SOG {dis3.sog.mean():.2f} P(3+) {100*(dis3.sog >= 3).mean():.1f}% · lane-suppressed but not SOG-tough n={len(dis4)} SOG {dis4.sog.mean():.2f} P(3+) {100*(dis4.sog >= 3).mean():.1f}%')
    # within the skater's tier (the filter the user applies), the two tints
    both['tier'] = pd.cut(both.ls_sog_pg, [0, 1.5, 2, 2.5, 3, 10], labels=['<1.5', '1.5-2', '2-2.5', '2.5-3', '3+'], right=False)
    for name, col, order in (('SOG third', 'third_sog', ['soft', 'mid', 'tough']), ('model lane', f'{rd}_lane_sog', ['open', 'neutral', 'suppressed'])):
        piv = both.groupby(['tier', col], observed=True).agg(n=('sog', 'size'), p3=('sog', lambda s: (s >= 3).mean())).unstack(col).reindex(columns=pd.MultiIndex.from_product([['n', 'p3'], order]))
        print(f'   7d. last-season SOG/G tier x {name}:')
        print('      ' + piv.to_string(float_format=lambda v: f'{v:.2f}').replace('\n', '\n      '))
    # by the opponent's games played (this season's tab only reads once the opponent has games)
    if rd == 'std_all':
        print('   7e. SOG: the tint as a read by the opponent\'s games played this season (none / SOG third / lane), same rows')
        for lo, hi in [(1, 4), (5, 9), (10, 14), (15, 19), (20, 29), (30, 49), (50, 99)]:
            s2 = both[(both.opp_games >= lo) & (both.opp_games <= hi)]
            if len(s2) < 400: continue
            b = cv(s2, core, 'sog')['dev']; t3 = cv(s2, core + d_third, 'sog')['dev']; ln = cv(s2, core + d_lane, 'sog')['dev']; fi = cv(s2, core + [f'{rd}_x_iff'], 'sog')['dev']; so = cv(s2, core + [f'{rd}_x_sog'], 'sog')['dev']
            print(f'      opp games {lo:2d}-{hi:2d}  n={len(s2):6d}  none {b:.4f}  SOG third {t3:.4f} ({b - t3:+.4f})  lane {ln:.4f} ({b - ln:+.4f})  SOG allowed {so:.4f} ({b - so:+.4f})  iFF allowed {fi:.4f} ({b - fi:+.4f})')
    # 7f. goals: the goals lane (goals, iSCF, shots allowed) against the goals rank third
    bg2 = bg[bg[f'{rd}_x_sog'].notna()].copy()
    bg2['third_g'] = tone(bg2[f'{rd}_x_g_rank']); bg2 = bg2[(bg2.third_g != 'n/a') & (bg2[f'{rd}_lane_g'] != 'n/a')]
    if len(bg2) >= 400:
        g_third = dummies(bg2, 'third_g'); g_lane = dummies(bg2, f'{rd}_lane_g', ('open', 'suppressed'))
        b0 = cv(bg2, coreg, 'g')['dev']
        print(f'   7f. GOALS: the tint as a read on top of the goal baseline, {len(bg2)} rows: none {b0:.4f}  goals third {cv(bg2, coreg + g_third, "g")["dev"]:.4f} ({b0 - cv(bg2, coreg + g_third, "g")["dev"]:+.4f})  goals lane {cv(bg2, coreg + g_lane, "g")["dev"]:.4f} ({b0 - cv(bg2, coreg + g_lane, "g")["dev"]:+.4f})')
        for name, col, order in (('goals rank third', 'third_g', ['soft', 'mid', 'tough']), ('the model\'s goals lane', f'{rd}_lane_g', ['open', 'neutral', 'suppressed'])):
            t = bg2[bg2[col].isin(order)].groupby(col).agg(n=('g', 'size'), g1=('g', lambda s: (s >= 1).mean()), g=('g', 'mean')).reindex(order)
            print(f'      by {name}: ' + ' · '.join(f'{k} n={int(v.n)} P(1+ G) {100*v.g1:.1f}%' for k, v in t.iterrows()) + f'  (favourable - stingy {100*(t.g1.iloc[0] - t.g1.iloc[2]):+.1f} pts)')

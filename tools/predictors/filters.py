"""Which filter finds tonight's shooters and scorers? The windows a props screen offers — his hit
rate or average over the last 5 / 10 / 15 / 20 games, the last 10 at tonight's venue ("L10 home"),
this season to date, last season, the same at the venue — graded as *candidate filters*: rank every
skater on the slate by the filter, take the top 10 / 20, and count how often they hit 3+ SOG
(2+ / 4+) and 1+ goal; the precision of the thresholds a screen uses ("hit in 8 of L10"); and what a
stated hit rate was actually worth (an L5 at 100% is not a 100% player). The study's blend (this
season's rate into last season's at n / (n + 18) for shots, n / (n + 40) for goals) and the shipped
formula with the opponent read (docs/shots-goals-predictors.md section 13) are scored on the same
rows as the yardsticks. Every read is built from games strictly before the row's game.

argv: <this season games-pos dir> <previous season games-pos dir> <rows.csv for this season>
      <label> [--min-prior 20]
Writes <rows stem>-filters-<market>.csv (one table per market) and <rows stem>-filters-rows.csv.
"""
import sys, os, glob, json, math, warnings
from collections import defaultdict
import numpy as np, pandas as pd
from scipy import stats
from sklearn.metrics import roc_auc_score
warnings.filterwarnings('ignore')
pd.set_option('display.width', 250); pd.set_option('display.max_rows', 500); pd.set_option('display.max_columns', 40)
sys.path.insert(0, os.path.dirname(__file__))
from features import derive

args = sys.argv[1:]; opts = {}; pos_args = []
i = 0
while i < len(args):
    if args[i].startswith('--'): opts[args[i][2:]] = args[i + 1]; i += 2
    else: pos_args.append(args[i]); i += 1
cur_dir, prev_dir, rows_path, label = pos_args[:4]
MIN_PRIOR = int(opts.get('min-prior', 20))
stem = rows_path[:-4]
POS = ('C', 'LW', 'RW', 'D')
PRIOR = dict(sog=18, g=40)
# the shipped formulas (lib/nhl-data/picks-pure.js SHOTS_FIT / GOALS_FIT, pooled fit of 2024-25 and 2025-26)
SHOTS_FIT = dict(const=-1.4391, sog=0.3923, icf=0.4484, toi=0.297, home=0.0341, pos=0.6869, b2b=-0.026)
GOALS_FIT = dict(const=-1.0497, g=0.3717, iscf=0.4414, sog=0.3975, home=0.0684, pos=0.4418, b2b=-0.0683)
MARKETS = {'3+ SOG': ('sog', 3), '2+ SOG': ('sog', 2), '4+ SOG': ('sog', 4), '1+ goal': ('g', 1)}

def load_games(d):
    gs = []
    for f in sorted(glob.glob(f'{d}/*.json')):
        gs += json.load(open(f))['games']
    gs.sort(key=lambda g: (g['date'], g['id']))
    return gs

def ptail(lam, k):
    """P(X >= k) for Poisson(lam)."""
    lam = np.clip(np.asarray(lam, dtype=float), 1e-6, None)
    return 1 - stats.poisson.cdf(k - 1, lam)

# ------------------------------------------------------------------ the windows, leak-free
prev = load_games(prev_dir); cur = load_games(cur_dir)
prev_season = prev[0]['season'] if prev else None
hist = defaultdict(list)       # playerId -> [{date, season, venue, sog, g}]
for g in prev:
    for s in g['skaters']:
        if s['pos'] in POS:
            hist[s['id']].append(dict(date=g['date'], season=g['season'], venue=s['venue'], sog=s['sog'], g=s['g']))
by_date = defaultdict(list)
for g in cur: by_date[g['date']].append(g)

rows = []
def win(hs, n): return hs[-n:] if len(hs) >= n else None
def rate(hs, stat, k): return float(np.mean([h[stat] >= k for h in hs]))
def avg(hs, stat): return float(np.mean([h[stat] for h in hs]))
for date in sorted(by_date):
    for g in by_date[date]:
        season = g['season']
        for s in g['skaters']:
            if s['pos'] not in POS: continue
            h = hist[s['id']]
            if len(h) < MIN_PRIOR: continue
            this = [x for x in h if x['season'] == season]
            last = [x for x in h if x['season'] == prev_season]
            same_v = [x for x in h if x['venue'] == s['venue']]
            this_v = [x for x in this if x['venue'] == s['venue']]
            last_v = [x for x in last if x['venue'] == s['venue']]
            row = dict(date=date, gameId=g['id'], playerId=s['id'], name=s['name'], team=s['team'], opp=s['opp'], venue=s['venue'],
                       pos=s['pos'], home=1 if s['venue'] == 'H' else 0, sog=s['sog'], g=s['g'], n_this=len(this), n_last=len(last), n_all=len(h))
            for stat, k, tag in (('sog', 3, 's3'), ('sog', 2, 's2'), ('sog', 4, 's4'), ('g', 1, 'g1')):
                for n in (5, 10, 15, 20):                    # across the season boundary, as a props screen shows "last N games"
                    w = win(h, n); row[f'hr_{tag}_L{n}'] = rate(w, stat, k) if w else np.nan
                w = win(same_v, 10); row[f'hr_{tag}_L10venue'] = rate(w, stat, k) if w else np.nan
                w = win(same_v, 5); row[f'hr_{tag}_L5venue'] = rate(w, stat, k) if w else np.nan
                for n in (5, 10):                            # this season only (the mid-season screen)
                    w = win(this, n); row[f'hr_{tag}_L{n}this'] = rate(w, stat, k) if w else np.nan
                row[f'hr_{tag}_season'] = rate(this, stat, k) if len(this) >= 3 else np.nan
                row[f'hr_{tag}_seasonvenue'] = rate(this_v, stat, k) if len(this_v) >= 3 else np.nan
                row[f'hr_{tag}_last'] = rate(last, stat, k) if len(last) >= 20 else np.nan
                row[f'hr_{tag}_lastvenue'] = rate(last_v, stat, k) if len(last_v) >= 10 else np.nan
                # the hit-rate blend: this season's share into last season's at n / (n + k)
                if len(last) >= 20:
                    wgt = len(this) / (len(this) + PRIOR[stat])
                    row[f'hr_{tag}_blend'] = wgt * (rate(this, stat, k) if this else 0) + (1 - wgt) * rate(last, stat, k)
                else:
                    row[f'hr_{tag}_blend'] = np.nan
            for stat in ('sog', 'g'):
                for n in (5, 10, 15, 20):
                    w = win(h, n); row[f'avg_{stat}_L{n}'] = avg(w, stat) if w else np.nan
                w = win(same_v, 10); row[f'avg_{stat}_L10venue'] = avg(w, stat) if w else np.nan
                for n in (5, 10):
                    w = win(this, n); row[f'avg_{stat}_L{n}this'] = avg(w, stat) if w else np.nan
                row[f'avg_{stat}_season'] = avg(this, stat) if len(this) >= 3 else np.nan
                row[f'avg_{stat}_last'] = avg(last, stat) if len(last) >= 20 else np.nan
                row[f'avg_{stat}_lastvenue'] = avg(last_v, stat) if len(last_v) >= 10 else np.nan
                if len(last) >= 20:
                    wgt = len(this) / (len(this) + PRIOR[stat])
                    row[f'avg_{stat}_blend'] = wgt * (avg(this, stat) if this else 0) + (1 - wgt) * avg(last, stat)
                else:
                    row[f'avg_{stat}_blend'] = np.nan
            rows.append(row)
    for g in by_date[date]:
        for s in g['skaters']:
            if s['pos'] in POS:
                hist[s['id']].append(dict(date=date, season=g['season'], venue=s['venue'], sog=s['sog'], g=s['g']))
d = pd.DataFrame(rows)

# the study's reads from rows.csv (build_rows.py + features.derive): the blend with attempts, TOI and the opponent read
r = derive(pd.read_csv(rows_path))
r = r[['gameId', 'playerId', 'bl_sog', 'bl_icf', 'bl_g', 'bl_iscf', 'toi_l5_or_bl', 'b2b', 'opp_pos_sog_per_blend', 'opp_pos_g_per_blend',
       'opp_pos_sog_l5', 'opp_pos_sog_l10', 'opp_pos_sog_per', 'opp_pls_pos_sog_per', 'opp_pos_sog_venue', 'opp_sa_l5', 'opp_sa_l10', 'opp_sa_pg', 'opp_sa_blend', 'opp_n_prior']]
d = d.merge(r, on=['gameId', 'playerId'], how='left')
lg = lambda v: np.log(np.clip(np.asarray(v, dtype=float), 0.05, None))
F = SHOTS_FIT
d['lam_formula_s'] = np.exp(F['const'] + F['sog'] * lg(d.bl_sog) + F['icf'] * lg(d.bl_icf) + F['toi'] * lg(d.toi_l5_or_bl) + F['home'] * d.home + F['pos'] * lg(d.opp_pos_sog_per_blend) + F['b2b'] * d.b2b.fillna(0))
G = GOALS_FIT
d['lam_formula_g'] = np.exp(G['const'] + G['g'] * lg(d.bl_g + 0.05) + G['iscf'] * lg(d.bl_iscf) + G['sog'] * lg(d.bl_sog) + G['home'] * d.home + G['pos'] * lg(d.opp_pos_g_per_blend + 0.1) + G['b2b'] * d.b2b.fillna(0))
# the blend alone with each environment window multiplied in at the fitted elasticity, to rank the opponent windows as filters
lg_env = {}
for key, col in (('env L5', 'opp_pos_sog_l5'), ('env L10', 'opp_pos_sog_l10'), ('env season', 'opp_pos_sog_per'), ('env last season', 'opp_pls_pos_sog_per'),
                 ('env venue', 'opp_pos_sog_venue'), ('env blend', 'opp_pos_sog_per_blend'), ('env team L5', 'opp_sa_l5'), ('env team L10', 'opp_sa_l10'), ('env team season', 'opp_sa_pg')):
    v = d[col]; m = v.notna()
    ratio = np.where(m, v / v[m].mean(), np.nan)      # the read over the league's average that season
    d[f'lam_{key}'] = d.avg_sog_blend * np.power(ratio, 0.69 if 'team' not in key else 0.54)
d['rnd'] = np.random.default_rng(7).random(len(d))
d.to_csv(f'{stem}-filters-rows.csv', index=False)
print(f'=== {label}: {len(d)} skater-games with {MIN_PRIOR}+ prior games across the two seasons, {d.date.nunique()} slates, {d.gameId.nunique()} games ===')

# ------------------------------------------------------------------ grading
def filters_for(tag, stat, k):
    """name -> (score column, probability column or None). Hit-rate filters are their own probability; averages
    read through the Poisson tail; λ likewise."""
    out = {}
    for w, lab in (('L5', 'hit rate L5'), ('L10', 'hit rate L10'), ('L15', 'hit rate L15'), ('L20', 'hit rate L20'), ('L10venue', 'hit rate L10 at venue (L10 home / away)'),
                   ('L5venue', 'hit rate L5 at venue'), ('L5this', 'hit rate L5, this season only'), ('L10this', 'hit rate L10, this season only'),
                   ('season', 'hit rate season to date'), ('seasonvenue', 'hit rate season to date at venue'), ('last', 'hit rate last season'),
                   ('lastvenue', 'hit rate last season at venue'), ('blend', 'hit rate blend (season into last, n/(n+k))')):
        out[lab] = (f'hr_{tag}_{w}', f'hr_{tag}_{w}', f'avg_{stat}_{w}' if f'avg_{stat}_{w}' in d else None)
    for w, lab in (('L5', 'average L5'), ('L10', 'average L10'), ('L15', 'average L15'), ('L20', 'average L20'), ('L10venue', 'average L10 at venue'),
                   ('L5this', 'average L5, this season only'), ('L10this', 'average L10, this season only'), ('season', 'average season to date'),
                   ('last', 'average last season'), ('lastvenue', 'average last season at venue'), ('blend', 'average blend (season into last)')):
        d[f'p_{tag}_avg_{w}'] = ptail(d[f'avg_{stat}_{w}'], k)
        out[lab] = (f'avg_{stat}_{w}', f'p_{tag}_avg_{w}', None)
    lam = 'lam_formula_s' if stat == 'sog' else 'lam_formula_g'
    d[f'p_{tag}_formula'] = ptail(d[lam], k)
    out['formula: blend + attempts + TOI + opponent per-skater position read (shipped)'] = (lam, f'p_{tag}_formula', None)
    if stat == 'sog':
        for key in ('env L5', 'env L10', 'env season', 'env last season', 'env venue', 'env blend', 'env team L5', 'env team L10', 'env team season'):
            d[f'p_{tag}_{key}'] = ptail(d[f'lam_{key}'], k)
            out[f'average blend × opponent {key[4:]} (position per skater)' if 'team' not in key else f'average blend × opponent {key[4:]} shots allowed'] = (f'lam_{key}', f'p_{tag}_{key}', None)
    return out

def grade(sub, score, prob, tie, hit, topk=(10, 20), slates=None):
    s = sub.dropna(subset=[score]).copy()
    if len(s) < 200: return None
    y = s[hit].values.astype(int)
    rec = dict(n=len(s), base=y.mean())
    rec['auc'] = roc_auc_score(y, s[score]) if 0 < y.sum() < len(y) else np.nan
    rec['rho'] = stats.spearmanr(s[score], s[hit.replace('hit_', 'cnt_')] if hit.replace('hit_', 'cnt_') in s else y).correlation
    if prob:
        p = s[prob].clip(0, 1).values
        rec['brier'] = float(np.mean((p - y) ** 2)); rec['stated'] = float(p.mean())
    # per slate, the top-K by the filter (ties by the companion average, then by the blend)
    order = [score] + ([tie] if tie and tie in s else []) + ['rnd']
    s = s.sort_values(['date'] + order, ascending=[True] + [False] * len(order))
    for k in topk:
        t = s.groupby('date').head(k)
        rec[f'top{k}'] = t[hit].mean(); rec[f'top{k}_n'] = len(t)
        if prob: rec[f'top{k}_stated'] = t[prob].clip(0, 1).mean()
    # recall: of the slate's hits, the share inside the top 20
    t20 = s.groupby('date').head(20)
    rec['recall20'] = t20[hit].sum() / max(1, s[hit].sum())
    return rec

def paired_boot(sub, a, b, hit, k=20, B=400, seed=1):
    """Bootstrap over slates of the top-k hit-rate difference (a - b), same slates in both."""
    s = sub.dropna(subset=[a[0], b[0]])
    dates = sorted(s.date.unique())
    def topk(sc, tie):
        order = [sc] + ([tie] if tie and tie in s else []) + ['rnd']
        t = s.sort_values(['date'] + order, ascending=[True] + [False] * len(order)).groupby('date').head(k)
        return t.groupby('date')[hit].agg(['sum', 'size'])
    ta, tb = topk(*a), topk(*b)
    rng = np.random.default_rng(seed); diffs = []
    for _ in range(B):
        pick = rng.choice(dates, len(dates), replace=True)
        xa = ta.loc[pick]; xb = tb.loc[pick]
        diffs.append(xa['sum'].sum() / xa['size'].sum() - xb['sum'].sum() / xb['size'].sum())
    diffs = np.array(diffs)
    return float(ta['sum'].sum() / ta['size'].sum()), float(tb['sum'].sum() / tb['size'].sum()), float(np.percentile(diffs, 2.5)), float(np.percentile(diffs, 97.5))

for market, (stat, k) in MARKETS.items():
    tag = {'3+ SOG': 's3', '2+ SOG': 's2', '4+ SOG': 's4', '1+ goal': 'g1'}[market]
    d[f'hit_{tag}'] = (d[stat] >= k).astype(int); d[f'cnt_{tag}'] = d[stat]
    fl = filters_for(tag, stat, k)
    # the same rows for every filter: where every cross-boundary and last-season read is defined
    need = [v[0] for n, v in fl.items() if 'this season only' not in n and 'season to date' not in n and 'env' not in v[0]]
    same = d.dropna(subset=need)
    print(f'\n--- {market}: every filter on the same {len(same)} rows (all cross-boundary and last-season reads defined; base rate {same[f"hit_{tag}"].mean():.3f}) ---')
    out = []
    for name, (score, prob, tie) in fl.items():
        if 'this season only' in name or 'season to date' in name or 'env' in score: continue
        rec = grade(same, score, prob, tie, f'hit_{tag}')
        if rec: rec['filter'] = name; out.append(rec)
    t = pd.DataFrame(out).sort_values('top20', ascending=False)
    cols = ['filter', 'n', 'auc', 'rho', 'brier', 'stated', 'top10', 'top10_stated', 'top20', 'top20_stated', 'recall20']
    print(t[[c for c in cols if c in t]].to_string(index=False, float_format=lambda v: f'{v:.3f}'))
    t.to_csv(f'{stem}-filters-{tag}.csv', index=False)
    if stat == 'sog':
        env_cols = [v[0] for n, v in fl.items() if 'env' in v[0]]
        envrows = same.dropna(subset=env_cols)
        if len(envrows) >= 500:
            print(f'\n   the opponent\'s window as the filter: the blend × each environment read, on the {len(envrows)} rows where every window is defined (opponents with 10+ games; base {envrows[f"hit_{tag}"].mean():.3f})')
            out = []
            for name, (score, prob, tie) in fl.items():
                if 'env' in score or name.startswith('average blend (') or name.startswith('formula'):
                    rec = grade(envrows, score, prob, tie, f'hit_{tag}')
                    if rec: rec['filter'] = name; out.append(rec)
            te = pd.DataFrame(out).sort_values('top20', ascending=False)
            print(te[[c for c in cols if c in te]].to_string(index=False, float_format=lambda v: f'{v:.3f}'))
            te.to_csv(f'{stem}-filters-{tag}-env.csv', index=False)
    # the mid-season screen: this season's own windows against each other, skaters with 10+ games this season
    mid = d[d.n_this >= 10].dropna(subset=[f'hr_{tag}_L10this', f'hr_{tag}_season', f'hr_{tag}_blend', f'avg_{stat}_L10this', f'avg_{stat}_season', f'avg_{stat}_blend'])
    if len(mid) >= 1000:
        print(f'\n   mid-season screen, skaters with 10+ games this season ({len(mid)} rows, base {mid[f"hit_{tag}"].mean():.3f}): this season\'s windows against the blend')
        out = []
        for name in ('hit rate L5, this season only', 'hit rate L10, this season only', 'hit rate L10 at venue (L10 home / away)', 'hit rate season to date', 'hit rate season to date at venue',
                     'hit rate last season', 'hit rate blend (season into last, n/(n+k))', 'average L5, this season only', 'average L10, this season only', 'average L10 at venue',
                     'average season to date', 'average last season', 'average blend (season into last)', 'formula: blend + attempts + TOI + opponent per-skater position read (shipped)'):
            score, prob, tie = fl[name]
            rec = grade(mid, score, prob, tie, f'hit_{tag}')
            if rec: rec['filter'] = name; out.append(rec)
        t2 = pd.DataFrame(out).sort_values('top20', ascending=False)
        print(t2[[c for c in cols if c in t2]].to_string(index=False, float_format=lambda v: f'{v:.3f}'))
        t2.to_csv(f'{stem}-filters-{tag}-midseason.csv', index=False)
    # what a stated hit rate was worth: calibration of the L5 / L10 / L20 / season / blend hit rates
    print(f'\n   what the hit rate was worth: actual {market} rate by the window\'s stated hit rate (same rows)')
    bins = [-0.01, 0.2, 0.4, 0.6, 0.8, 0.99, 1.01]; labels = ['0-20%', '20-40%', '40-60%', '60-80%', '80-99%', '100%']
    cal = {}
    for w, lab in (('L5', 'L5'), ('L10', 'L10'), ('L10venue', 'L10 venue'), ('L20', 'L20'), ('last', 'last season'), ('blend', 'blend')):
        c = pd.cut(same[f'hr_{tag}_{w}'], bins, labels=labels)
        g = same.groupby(c, observed=False)[f'hit_{tag}'].agg(['mean', 'size'])
        cal[lab] = [f'{m:.2f} ({n})' if n >= 20 else '—' for m, n in zip(g['mean'], g['size'])]
    print(pd.DataFrame(cal, index=labels).to_string())
    # thresholds a screen uses
    print(f'\n   threshold filters: rows passing, and their {market} rate (same rows; the slate has {len(same) / same.date.nunique():.0f} rated skaters a night)')
    th = []
    cuts = (0.6, 0.7, 0.8, 1.0) if stat == 'sog' else (0.3, 0.4, 0.5, 0.6)
    for w, lab in (('L5', 'L5'), ('L10', 'L10'), ('L10venue', 'L10 at venue'), ('L20', 'L20'), ('last', 'last season'), ('blend', 'blend')):
        for cut in cuts:
            m = same[f'hr_{tag}_{w}'] >= cut - 1e-9
            if m.sum() >= 30:
                th.append(dict(window=lab, threshold=f'>= {cut:.0%}', rows=int(m.sum()), per_slate=m.sum() / same.date.nunique(), hit=same.loc[m, f'hit_{tag}'].mean()))
    fcuts = (0.5, 0.6, 0.7) if (stat == 'sog' and k == 3) else (0.3, 0.35, 0.4) if stat == 'g' else (0.25, 0.4, 0.6) if k == 4 else (0.7, 0.8, 0.9)
    for cut in fcuts:
        m = same[f'p_{tag}_formula'] >= cut
        if m.sum() >= 30: th.append(dict(window='formula P(k+)', threshold=f'>= {cut:.0%}', rows=int(m.sum()), per_slate=m.sum() / same.date.nunique(), hit=same.loc[m, f'hit_{tag}'].mean()))
    print(pd.DataFrame(th).to_string(index=False, float_format=lambda v: f'{v:.3f}'))
    # paired bootstrap: the blend and the formula against L5, L10 and L10 at venue on the top 20 a slate
    print(f'\n   top 20 a slate, paired bootstrap over slates (difference, 95% interval):')
    ref = fl['formula: blend + attempts + TOI + opponent per-skater position read (shipped)']
    for name in ('hit rate L5', 'hit rate L10', 'hit rate L10 at venue (L10 home / away)', 'hit rate season to date', 'hit rate last season', 'average L10', 'average blend (season into last)'):
        a, b = ref, fl[name]
        if name == 'hit rate season to date':
            sub = same.dropna(subset=[b[0]])
        else: sub = same
        ha, hb, lo, hi = paired_boot(sub, (a[0], a[2]), (b[0], b[2]), f'hit_{tag}')
        print(f'   formula {ha:.3f} vs {name} {hb:.3f}: {ha - hb:+.3f} [{lo:+.3f}, {hi:+.3f}]')

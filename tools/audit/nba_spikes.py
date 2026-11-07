"""The NBA's outlier nights: does the board see the 10-rebound night coming from a player it projects at 4 or 5?

Vincent, 2026-11-07: "we need to start calibrating the nba model. I just checked the rebounds and the 3s, we need to
be able to predict outliers better. For example, yesterday a few players were projected by us to get 4 or 5 rebounds
but they actually got 10+. These are the things I need to be able to predict because that is where the money is for
nba. The big players are nuked in odds anyways."

Every row is one player-game of the site's board replayed (`nba-audit.mjs` rows: `exp` = the ladder's centre, `sd` =
the ladder's spread), joined to ESPN's box scores for what he did before that night (`nba_stat_drivers.py`'s cached rows
for the context: teammates out, the opponent, minutes). Four questions, rebounds and threes first:
  1. The tail as the board states it: his chance of reaching his centre + 2, + 3, … (the normal over his spread), said
     against landed, by the size of the projection; and the night's "spike" (double his projection, at least + 4
     rebounds / + 2 threes).
  2. The shape: the normal against counts with the same centre and spread (the negative binomial matched to the board's
     own mean and variance, the variance widened by a fitted factor), and the board's whole chance (the tail at 0.7, his
     own hit rates at 0.3) rebuilt with each.
  3. What sees a spike coming beyond the shape: his own spike record, his minutes' upside, his rate a minute against his
     minutes, a start tonight off the bench, teammates out, the opponent's misses and rebounds allowed, his threes
     attempted lately — one at a time on top of the best shape (a logistic with the shape's logit as offset), fitted on
     2025-26, scored unchanged on this season.
  4. The night's likeliest spikes, ranked by each read: how often the top of the list landed.

  python3 -I tools/audit/nba_spikes.py --box .nhl-data/audit/nba-box \
      --rows 2026:.nhl-data/audit/sp/nba-2026-04-12-site-rows.csv 2027:.nhl-data/audit/sp/nba-2026-11-06-site-rows.csv \
      --out docs/audits/2026-11-07-nba-outliers-tables.md

--box holds ESPN's box scores (`nba-box-fetch.mjs`) and `stat-drivers-rows.pkl` (run `nba_stat_drivers.py` once);
--rows maps ESPN's season label (2026 = 2025-26) to the replay's rows. Needs numpy, pandas, scipy.
"""
import argparse, glob, json, math, os, pickle
from collections import defaultdict
import numpy as np, pandas as pd
from scipy.stats import nbinom, norm, poisson
from scipy.optimize import minimize

ap = argparse.ArgumentParser()
ap.add_argument('--box', required=True)
ap.add_argument('--rows', nargs='+', required=True, help='<season label>:<rows.csv>, the first is the fit')
ap.add_argument('--out', required=True)
ap.add_argument('--json', default=None, help='write the fitted settings here')
args = ap.parse_args()

MARKETS = ['reb', 'tpm', 'pts', 'ast']
NAME = {'reb': 'Rebounds', 'tpm': 'Threes', 'pts': 'Points', 'ast': 'Assists'}
# a spike: at least double his projection and at least this many over it (the money nights, Vincent's 4–5 → 10+)
SPIKE_ADD = {'reb': 4, 'tpm': 2, 'pts': 10, 'ast': 4}
# the tail marks graded: centre + d for each d (whole counts, "d+ over his centre")
DS = {'reb': [2, 3, 4, 5, 6, 8], 'tpm': [1, 2, 3, 4], 'pts': [5, 8, 10, 15], 'ast': [2, 3, 4, 6]}
HIT_W = (0.1, 0.3, 0.6)      # the board's hit-rate windows: L5, L10, season (this season's)
LADDER_MODEL, EMP_K = 0.7, 6


def num(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0


def dash(v, i):
    try: return float(str(v).split('-')[i])
    except (TypeError, ValueError, IndexError): return 0.0


# ------------------------------------------------------------------ his history from the box scores
def load_box(box):
    out = []
    for f in glob.glob(os.path.join(box, '[0-9]*', '*.json')):
        j = json.load(open(f)); h = j['header']
        season = int(h['season']['year']); gid = str(h['id'])
        for t in j['boxscore'].get('players', []):
            team = t['team']['abbreviation']; s = (t.get('statistics') or [None])[0]
            if not s: continue
            keys = s.get('keys', [])
            for a in s.get('athletes', []):
                ath = a.get('athlete') or {}; v = a.get('stats') or []
                if not ath.get('id') or a.get('didNotPlay') or not v: continue
                at = lambda k: v[keys.index(k)] if k in keys and len(v) > keys.index(k) else None
                m = num(at('minutes'))
                if m <= 0: continue
                tp = at('threePointFieldGoalsMade-threePointFieldGoalsAttempted')
                out.append(dict(pid=str(ath['id']), gid=gid, date=j['date'], season=season, team=team, starter=int(bool(a.get('starter'))), min=m,
                                pts=num(at('points')), reb=num(at('rebounds')), ast=num(at('assists')), oreb=num(at('offensiveRebounds')),
                                tpm=dash(tp, 0), tpa=dash(tp, 1)))
    return pd.DataFrame(out).sort_values(['pid', 'date', 'gid']).reset_index(drop=True)


def history_features(bx):
    """Per player-game, from his games before it (regular season box scores, across seasons)."""
    feats = []
    for pid, g in bx.groupby('pid', sort=False):
        A = {c: g[c].values for c in ('gid', 'date', 'season', 'starter', 'min', 'tpa', 'oreb') + tuple(MARKETS)}
        for i in range(5, len(g)):
            lo = max(0, i - 82); sea = A['season'][i]
            sm = A['season'][lo:i] == sea
            f = dict(pid=pid, gid=A['gid'][i], date=A['date'][i], starterTonight=int(A['starter'][i]), act_min=float(A['min'][i]), n82=i - lo, nS=int(sm.sum()))
            st = A['starter'][lo:i]; mins = A['min'][lo:i]
            f['startShare10'] = float(st[-10:].mean())
            f['promoted'] = int(A['starter'][i] == 1 and f['startShare10'] < 0.5)
            f['minMean10'] = float(mins[-10:].mean()); f['minQ90_20'] = float(np.quantile(mins[-20:], 0.9)); f['minSd20'] = float(mins[-20:].std())
            f['minMax20'] = float(mins[-20:].max())
            for s in MARKETS:
                v = A[s][lo:i]; mu = v.mean()
                f[f'{s}_mean82'] = float(mu); f[f'{s}_sd82'] = float(v.std(ddof=1))
                f[f'{s}_max20'] = float(v[-20:].max()); f[f'{s}_q90'] = float(np.quantile(v, 0.9))
                # his spike record: the share of his last 40 nights at double his long mean and SPIKE_ADD over it
                mark = max(2 * mu, mu + SPIKE_ADD[s])
                f[f'{s}_spike40'] = float((v[-40:] >= mark).mean())
                # his rate a minute (last 20) and what it reaches at his long minutes (the minutes' upside)
                rate = v[-20:].sum() / max(mins[-20:].sum(), 1)
                f[f'{s}_pm20'] = float(rate); f[f'{s}_upMin'] = float(rate * f['minQ90_20'])
                # the values behind the board's hit-rate half
                f[f'{s}_l5'] = v[-5:].tolist(); f[f'{s}_l10'] = v[-10:].tolist(); f[f'{s}_szn'] = v[sm].tolist()
            tpa = A['tpa'][lo:i]
            f['tpa_l5'] = float(tpa[-5:].mean()); f['tpa_l10'] = float(tpa[-10:].mean())
            f['tpa_pm20'] = float(tpa[-20:].sum() / max(mins[-20:].sum(), 1))
            f['oreb_share'] = float(A['oreb'][lo:i].sum() / max(A['reb'][lo:i].sum(), 1))
            feats.append(f)
    return pd.DataFrame(feats)


# ------------------------------------------------------------------ the tails
def nb_params(mu, var):
    """Negative binomial (n, p) with this mean and variance; None where the variance is no wider than the mean (Poisson)."""
    if var <= mu * 1.0001: return None
    p = mu / var; n = mu * p / (1 - p)
    return n, p


def tail_normal(mu, sd, k):           # P(X ≥ k), k whole: the board's continuity read
    return norm.sf((k - 0.5 - mu) / np.maximum(sd, 0.01))


def tail_nb(mu, sd, k, widen=1.0):
    mu = np.maximum(mu, 0.05); var = (sd * widen) ** 2
    out = np.empty(len(mu))
    for i in range(len(mu)):
        pr = nb_params(mu[i], var[i])
        out[i] = poisson.sf(k[i] - 1, mu[i]) if pr is None else nbinom.sf(k[i] - 1, pr[0], pr[1])
    return out


def emp_rate(vals, k):
    return None if not len(vals) else float(np.mean(np.array(vals) >= k))


def board_mix(model, row, s, k):
    """The board's whole chance at a mark: the tail at wModel, his hit rates (L5 / L10 / season) the rest."""
    parts = [(emp_rate(row[f'{s}_l5'], k), HIT_W[0]), (emp_rate(row[f'{s}_l10'], k), HIT_W[1]), (emp_rate(row[f'{s}_szn'], k), HIT_W[2])]
    parts = [(v, w) for v, w in parts if v is not None]
    if not parts: return model
    emp = sum(v * w for v, w in parts) / sum(w for _, w in parts)
    n = min(row['nS'], 17); keep = n / (n + EMP_K)
    w = LADDER_MODEL + (1 - LADDER_MODEL) * (1 - keep)
    return w * model + (1 - w) * emp


# ------------------------------------------------------------------ load
cache = os.path.join(args.box, 'spikes-hist.pkl')
if os.path.exists(cache):
    hist = pickle.load(open(cache, 'rb'))
else:
    bx = load_box(args.box); print(f'{len(bx)} box rows')
    hist = history_features(bx); pickle.dump(hist, open(cache, 'wb'))
print(f'{len(hist)} history rows')
drv, _ = pickle.load(open(os.path.join(args.box, 'stat-drivers-rows.pkl'), 'rb'))
drv = drv.rename(columns={'id': 'pid'})
ctxCols = ['f_pace', 'f_oppMiss', 'f_missEnv', 'f_oppOrebAllowed', 'f_oppFgPctAllowed', 'f_opp3paAllowed', 'reb_oppAll', 'reb_oppAllL10', 'tpm_oppAll',
           'reb_vac', 'tpm_vac', 'pts_vac', 'ast_vac', 'min_vac', 'nOut', 'pos', 'tp_pct', 'home', 'rest']
drv = drv[['gid', 'pid'] + [c for c in ctxCols if c in drv.columns]]

frames = []
for spec in args.rows:
    lab, path = spec.split(':', 1)
    r = pd.read_csv(path, dtype={'espnId': str, 'game': str})
    r = r[r.market.isin(MARKETS) & r.exp.notna() & r.sd.notna() & r.actual.notna() & r.espnId.notna() & (r.out != True)]
    r = r.rename(columns={'espnId': 'pid', 'slate': 'date', 'game': 'gid'}); r['label'] = int(lab)
    frames.append(r[['label', 'date', 'gid', 'pid', 'player', 'team', 'opp', 'market', 'exp', 'sd', 'actual', 'actualMin', 'minTonight', 'base', 'up']])
rows = pd.concat(frames, ignore_index=True)
rows = rows.merge(hist.drop(columns=['date']), on=['pid', 'gid'], how='inner').merge(drv, on=['gid', 'pid'], how='left')
rows = rows[rows.actualMin.fillna(0) > 0]
FIT, CHECK = int(args.rows[0].split(':')[0]), [int(s.split(':')[0]) for s in args.rows[1:]]
SNAME = {2026: '2025-26', 2027: 'this season'}
print(f'{len(rows)} board rows joined')

out = []
def w(s=''): out.append(s)
def pc(x): return '—' if x is None or (isinstance(x, float) and math.isnan(x)) else f'{100 * x:.1f}%'
def f3(x): return '—' if x is None or (isinstance(x, float) and math.isnan(x)) else f'{x:.3f}'
def table(head, body):
    w('| ' + ' | '.join(head) + ' |'); w('|' + '---|' * len(head))
    for b in body: w('| ' + ' | '.join(str(x) for x in b) + ' |')
    w()
def ll(p, y): p = np.clip(p, 1e-4, 1 - 1e-4); return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))
def brier(p, y): return float(np.mean((p - y) ** 2))


# ------------------------------------------------------------------ the marks: one row per player-game × mark
def marks_of(df, s):
    d = df[df.market == s].copy()
    recs = []
    centre = np.ceil(d.exp.values).astype(int)
    for dd in DS[s]:
        e = d.copy(); e['d'] = dd; e['k'] = centre + dd; recs.append(e)
    # the spike: double his projection and SPIKE_ADD over it
    e = d.copy(); e['d'] = 'spike'; e['k'] = np.maximum(np.ceil(2 * d.exp.values), np.ceil(d.exp.values + SPIKE_ADD[s])).astype(int); recs.append(e)
    m = pd.concat(recs, ignore_index=True)
    m['y'] = (m.actual >= m.k).astype(int)
    return m


def add_models(m, s, widen):
    mu, sd, k = m.exp.values, m.sd.values, m.k.values.astype(int)
    m['p_norm'] = tail_normal(mu, sd, k)
    m['p_nb'] = tail_nb(mu, sd, k, 1.0)
    m['p_nbw'] = tail_nb(mu, sd, k, widen)
    for c in ('norm', 'nb', 'nbw'):
        m[f'b_{c}'] = [board_mix(p, r, s, kk) for p, (_, r), kk in zip(m[f'p_{c}'].values, m.iterrows(), k)]
    return m


def fit_widen(m):
    """The variance factor on the board's spread that best fits the fit season's tail marks (log loss)."""
    best = None
    for wv in np.arange(0.9, 1.61, 0.05):
        p = tail_nb(m.exp.values, m.sd.values, m.k.values.astype(int), wv)
        v = ll(p, m.y.values)
        if best is None or v < best[1]: best = (round(float(wv), 2), v)
    return best[0]


# ------------------------------------------------------------------ the context on top of the shape
CTX = {
    'reb': ['reb_spike40', 'reb_upMinRatio', 'minUpside', 'promoted', 'starterTonight', 'reb_vac', 'min_vac', 'f_oppMiss', 'f_oppOrebAllowed', 'reb_oppAll', 'reb_oppAllL10', 'f_pace', 'reb_cv', 'oreb_share', 'isC', 'reb_max20Ratio'],
    'tpm': ['tpm_spike40', 'tpm_upMinRatio', 'minUpside', 'promoted', 'starterTonight', 'tpm_vac', 'min_vac', 'f_opp3paAllowed', 'tpm_oppAll', 'f_pace', 'tpa_l5Ratio', 'tpaVolume', 'tp_pct', 'tpm_cv', 'tpm_max20Ratio'],
    'pts': ['pts_spike40', 'pts_upMinRatio', 'minUpside', 'promoted', 'starterTonight', 'pts_vac', 'min_vac', 'f_pace', 'pts_cv', 'pts_max20Ratio'],
    'ast': ['ast_spike40', 'ast_upMinRatio', 'minUpside', 'promoted', 'starterTonight', 'ast_vac', 'min_vac', 'f_pace', 'ast_cv', 'ast_max20Ratio'],
}


def derive(m, s):
    m = m.copy()
    m['minUpside'] = np.log((m.minQ90_20 + 1) / (m.minMean10 + 1))
    m[f'{s}_upMinRatio'] = np.log((m[f'{s}_upMin'] + 0.5) / (m.exp + 0.5))
    m[f'{s}_cv'] = m[f'{s}_sd82'] / np.maximum(m[f'{s}_mean82'], 0.5)
    m[f'{s}_max20Ratio'] = np.log((m[f'{s}_max20'] + 0.5) / (m.exp + 0.5))
    m['isC'] = (m.pos == 'C').astype(float)
    m['tpa_l5Ratio'] = np.log((m.tpa_l5 + 0.5) / (m.tpa_l10 + 0.5))
    m['tpaVolume'] = np.log(m.tpa_l10 + 0.5)
    for c in CTX[s]:
        if c in m: m[c] = m[c].astype(float).fillna(0.0)
    return m


def logit(p): p = np.clip(p, 1e-4, 1 - 1e-4); return np.log(p / (1 - p))


def fit_logit(X, y, off, ridge=1.0):
    """σ(a + b · offset + w · X): the offset's slope free, ridge on the context."""
    Xs = np.column_stack([np.ones(len(y)), off, X])
    def nll(beta):
        z = Xs @ beta; p = 1 / (1 + np.exp(-z))
        p = np.clip(p, 1e-6, 1 - 1e-6)
        return -np.sum(y * np.log(p) + (1 - y) * np.log(1 - p)) + ridge * np.sum(beta[2:] ** 2)
    b0 = np.zeros(Xs.shape[1]); b0[1] = 1.0
    res = minimize(nll, b0, method='L-BFGS-B')
    return res.x


def apply_logit(beta, X, off):
    Xs = np.column_stack([np.ones(len(off)), off, X]); return 1 / (1 + np.exp(-(Xs @ beta)))


# ------------------------------------------------------------------ the report
w('# The NBA\'s outlier nights: the tables')
w()
w(f'{len(rows):,} board projections replayed (the site\'s `buildBoard` on ESPN\'s logs, `nba-audit.mjs --cocktail site`), joined to the box scores. '
  f'Fit season {SNAME.get(FIT, FIT)}; checked unchanged on {", ".join(SNAME.get(c, str(c)) for c in CHECK)}. A mark "+d" is his centre rounded up plus d '
  f'(a 4.4 projection: +3 = 8+ rebounds); "spike" is double his projection and at least {SPIKE_ADD["reb"]} rebounds / {SPIKE_ADD["tpm"]} threes / {SPIKE_ADD["pts"]} points / {SPIKE_ADD["ast"]} assists over it.')
w()
settings = {}
for s in MARKETS:
    allm = marks_of(rows, s)
    fitm = derive(allm[allm.label == FIT], s)
    widen = fit_widen(fitm[fitm.d != 'spike'])
    settings[s] = {'widen': widen}
    allm = derive(add_models(allm, s, widen), s)
    w(f'## {NAME[s]}')
    w()
    w(f'The variance factor on the board\'s spread that fits {SNAME.get(FIT)}\'s marks best (negative binomial, log loss): **×{widen}** (the spread × {math.sqrt(widen ** 2):.2f}).')
    w()
    for lab in [FIT] + CHECK:
        m = allm[allm.label == lab]
        if not len(m): continue
        w(f'### {SNAME.get(lab, lab)}: said against landed at each mark')
        w()
        body = []
        for dd in DS[s] + ['spike']:
            x = m[m.d == dd]
            if not len(x): continue
            body.append([f'+{dd}' if dd != 'spike' else 'spike', f'{len(x):,}', pc(x.y.mean()), pc(x.p_norm.mean()), pc(x.p_nb.mean()), pc(x.p_nbw.mean()),
                         pc(x.b_norm.mean()), pc(x.b_nbw.mean()), f3(ll(x.b_norm.values, x.y.values)), f3(ll(x.b_nbw.values, x.y.values))])
        table(['mark', 'n', 'landed', 'normal tail', 'NB tail', f'NB ×{widen}', 'board (normal)', f'board (NB ×{widen})', 'log loss board', f'log loss NB ×{widen}'], body)
        # by the size of the projection, the spike and +4 / +2
        key = 'spike'
        x = m[m.d == key].copy()
        edges = {'reb': [0, 3, 4.5, 6, 8, 99], 'tpm': [0, 1, 1.75, 2.5, 99], 'pts': [0, 8, 12, 18, 25, 99], 'ast': [0, 2, 3.5, 5, 99]}[s]
        x['band'] = pd.cut(x.exp, edges, right=False)
        body = []
        for band, y in x.groupby('band', observed=True):
            body.append([str(band), f'{len(y):,}', pc(y.y.mean()), pc(y.b_norm.mean()), pc(y.b_nbw.mean()), f'{y.actual[y.y == 1].mean():.1f}' if y.y.sum() else '—'])
        w(f'The spike by the size of the projection ({SNAME.get(lab, lab)}):')
        w()
        table(['projected', 'n', 'landed', 'board said', f'NB ×{widen} said', 'his figure when it landed'], body)

    # the context on top of the shape (fit on FIT, scored on the checks), the spike and +3 / +2 marks pooled
    w(f'### What sees a {NAME[s].lower()} spike coming, on top of the board\'s chance (NB ×{widen})')
    w()
    w('Each read alone, then all of them, in σ(a + b · logit(board) + w · read), fitted on the fit season\'s marks (all of them), scored unchanged. '
      'Δ log loss against the board\'s chance recalibrated alone (a + b · logit); negative = better. "top 2%" = how often the night\'s top 2% by chance of the spike landed.')
    w()
    F = allm[allm.label == FIT]; offF = logit(F.b_nbw.values)
    base_beta = fit_logit(np.zeros((len(F), 0)), F.y.values, offF)
    body = []
    results = {}
    cands = [c for c in CTX[s] if c in F.columns]
    for name, cols in [('(recalibrated board)', [])] + [(c, [c]) for c in cands] + [('all', cands)]:
        Xf = F[cols].values.astype(float) if cols else np.zeros((len(F), 0))
        mu_, sd_ = (Xf.mean(0), Xf.std(0) + 1e-9) if cols else (None, None)
        beta = fit_logit((Xf - mu_) / sd_ if cols else Xf, F.y.values, offF)
        row = [name]
        for lab in CHECK + [FIT]:
            C = allm[allm.label == lab]
            if not len(C): continue
            Xc = ((C[cols].values.astype(float) - mu_) / sd_) if cols else np.zeros((len(C), 0))
            p = apply_logit(beta, Xc, logit(C.b_nbw.values))
            p0 = apply_logit(base_beta, np.zeros((len(C), 0)), logit(C.b_nbw.values))
            sp = C.d.values == 'spike'
            top = np.argsort(-p[sp])[: max(1, int(0.02 * sp.sum()))]
            row += [f'{1000 * (ll(p, C.y.values) - ll(p0, C.y.values)):+.2f}', pc(C.y.values[sp][top].mean())]
        results[name] = (cols, beta, mu_, sd_)
        if cols: row.append(' '.join(f'{b:+.2f}' for b in beta[2:]) if len(cols) <= 1 else '…')
        else: row.append(f'a {beta[0]:+.2f} b {beta[1]:.2f}')
        body.append(row)
    head = ['read'] + sum(([f'{SNAME.get(lab, lab)} Δ ll ×1000', f'top 2% landed'] for lab in CHECK + [FIT] if len(allm[allm.label == lab])), []) + ['weight (sd units)']
    table(head, body)
    cols, beta, mu_, sd_ = results['all']
    w('All reads at once, the weights (per standard deviation of the read):')
    w()
    table(['read', 'weight', 'mean', 'sd'], [[c, f'{b:+.3f}', f3(mu_[i]), f3(sd_[i])] for i, (c, b) in enumerate(zip(cols, beta[2:]))])
    settings[s]['all'] = {'a': float(beta[0]), 'b': float(beta[1]), 'w': {c: float(b) for c, b in zip(cols, beta[2:])}, 'mu': {c: float(v) for c, v in zip(cols, mu_)}, 'sd': {c: float(v) for c, v in zip(cols, sd_)}}

    # the night's top of the list: who the reads put first, against what landed (check seasons)
    for lab in CHECK:
        C = allm[(allm.label == lab) & (allm.d == 'spike')].copy()
        if not len(C): continue
        Xc = (C[cols].values.astype(float) - mu_) / sd_
        C['p_all'] = apply_logit(beta, Xc, logit(C.b_nbw.values))
        body = []
        for name, col in [('board (normal)', 'b_norm'), (f'board (NB ×{widen})', 'b_nbw'), ('board + context', 'p_all')]:
            hits = []; said = []
            for _, nightly in C.groupby('date'):
                t = nightly.nlargest(5, col); hits += list(t.y.values); said += list(t[col].values)
            body.append([name, f'{len(hits):,}', pc(np.mean(said)), pc(np.mean(hits))])
        body.append(['every row', f'{len(C):,}', '—', pc(C.y.mean())])
        w(f'The night\'s five likeliest {NAME[s].lower()} spikes by each read, {SNAME.get(lab, lab)}:')
        w()
        table(['read', 'picks', 'said', 'landed'], body)
        # the spikes that landed this season: what the board said
        L = C[C.y == 1].sort_values('date')
        w(f'Every {NAME[s].lower()} spike that landed {SNAME.get(lab, lab)} ({len(L)} of {len(C):,}): what each read said, by the size of its chance.')
        w()
        body = []
        for lo, hi in [(0, 0.02), (0.02, 0.05), (0.05, 0.1), (0.1, 0.2), (0.2, 1.01)]:
            body.append([f'{100*lo:.0f}–{100*hi:.0f}%', int(((L.b_norm >= lo) & (L.b_norm < hi)).sum()), int(((L.b_nbw >= lo) & (L.b_nbw < hi)).sum()), int(((L.p_all >= lo) & (L.p_all < hi)).sum())])
        table(['chance band', 'board (normal)', f'NB ×{widen}', 'board + context'], body)
        last = L[L.date == L.date.max()]
        if len(last):
            w(f'The last night ({last.date.iloc[0]}):')
            w()
            table(['player', 'team', 'projected', 'spread', 'got', 'mark', 'board said', f'NB ×{widen}', '+ context'],
                  [[r.player, r.team, f'{r.exp:.1f}', f'{r.sd:.2f}', int(r.actual), f'{int(r.k)}+', pc(r.b_norm), pc(r.b_nbw), pc(r.p_all)] for r in last.itertuples()])

os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
open(args.out, 'w').write('\n'.join(out) + '\n')
if args.json: json.dump(settings, open(args.json, 'w'), indent=1)
print(f'written {args.out}')

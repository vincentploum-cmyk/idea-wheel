"""The big NHL games, mined (Vincent, 2026-11-01: "Do the same big games study for the NHL"; the NFL's is nfl_big.py, the
NBA's nba_big.py).

Every skater-game of 2025-26 and 2026-27 (tools/predictors: fetch.mjs → faceoffs.mjs → relabel.py → build_rows.py, the
rows leak-free, every figure from the games before) with the board's read rebuilt as the site builds it: the study's λ
(`project` in lib/nhl-data/picks-pure.js, the fixed SHOTS_FIT / GOALS_FIT coefficients) on his rates the site's way
(`blendRates`: this season alone from his fifth game, last season's regular season from ten games before that), his TOI
over his last five, home, a back-to-back, what the opponent allows per skater at his position this season (last season's
for a team without a game). Beside it what else was known that morning: his own record over his last 20 games across the
season boundary (how often he reached the mark, his best and his spread), his attempts, unblocked attempts, scoring and
high-danger chances and ice time lately, his line, the opponent's shots and goals allowed, its goalie, both teams' pace,
rest.

Big games: 5+ / 6+ / 7+ shots on goal, 2+ goals. The board's chance of a mark = the Poisson tail of the study's λ. Two
checks, each fitted on what came before it: 2025-26 Nov-Jan → Feb-Apr, and 2025-26 (from November) → 2026-27 (Oct).
Small models (the board plus one context), everything (logistic, trees), and one- to three-condition rules mined on the fit.

  python3 -I tools/audit/nhl_big.py [--root .nhl-data/predictors] [--out .nhl-data/audit/out]
"""
import argparse, glob, json, math, os, sys
from collections import defaultdict
import numpy as np
import pandas as pd
from scipy.stats import poisson
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score, brier_score_loss
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline

ap = argparse.ArgumentParser()
ap.add_argument('--root', default='.nhl-data/predictors')
ap.add_argument('--out', default='.nhl-data/audit/out')
A = ap.parse_args()

# The site's study fit (lib/nhl-data/picks-pure.js).
SF = dict(const=-1.4391, sog=0.3923, icf=0.4484, toi=0.297, home=0.0341, pos=0.6869, b2b=-0.026)
GF = dict(const=-1.0539, g=0.3735, iscf=0.4356, sog=0.4007, home=0.0682, pos=0.4448, b2b=-0.0677)
LEAGUE_POS = dict(C=(1.73, 0.23), LW=(1.63, 0.21), RW=(1.69, 0.215), D=(1.27, 0.077))
lg = lambda v: math.log(max(v, 0.05))

# Every skater-game of the three seasons, by player, date order (the site's stored rows: last season's regular season + this one).
hist = defaultdict(list)
for y in (2024, 2025, 2026):
    for f in sorted(glob.glob(f'{A.root}/{y}/games-pos/*.json')):
        for g in json.load(open(f))['games']:
            for s in g['skaters']:
                if s['pos'] not in LEAGUE_POS: continue
                hist[s['id']].append(dict(date=g['date'], season=y, sog=s['sog'], g=s['g'], icf=s['icf'], iff=s['iff'], iscf=s['iscf'], ihdcf=s['ihdcf'], toi=s['toi']))
for k in hist: hist[k].sort(key=lambda r: r['date'])
print('players', len(hist), file=sys.stderr)

MARKS = [('sog', 5), ('sog', 6), ('sog', 7), ('g', 2)]
recs = []
for y in (2025, 2026):
    d = pd.read_csv(f'{A.root}/{y}/rows.csv', low_memory=False)
    for r in d.itertuples(index=False):
        H = hist.get(r.playerId, [])
        before = [h for h in H if h['date'] < r.date]
        cur = [h for h in before if h['season'] == y]
        prev = [h for h in before if h['season'] == y - 1]
        n = len(cur)
        if len(prev) < 10 and n < 5: continue
        held = n < 5
        src = prev if held else cur
        m = lambda k, xs=src: sum(x[k] for x in xs) / len(xs)
        toi = m('toi'); toiL5 = sum(x['toi'] for x in cur[-5:]) / len(cur[-5:]) if n else toi
        lsog, lgg = LEAGUE_POS[r.pos]
        if not pd.isna(r.opp_pos_sog_per) and (r.opp_n_prior or 0) > 0: ps, pg_ = r.opp_pos_sog_per, r.opp_pos_g_per
        elif not pd.isna(getattr(r, 'opp_pls_pos_sog_per', np.nan)): ps, pg_ = r.opp_pls_pos_sog_per, r.opp_pls_pos_g_per
        else: ps, pg_ = lsog, lgg
        wG = 1 if held or n == 0 else n / (n + 8)
        gRate = wG * max(m('g'), 0) + (1 - wG) * lgg
        b2b = 1 if r.b2b == 1 else 0
        lamS = math.exp(SF['const'] + SF['sog'] * lg(m('sog')) + SF['icf'] * lg(m('icf')) + SF['toi'] * lg(toiL5) + SF['home'] * r.home + SF['pos'] * lg(ps) + SF['b2b'] * b2b)
        lamG = math.exp(GF['const'] + GF['g'] * math.log(gRate + 0.05) + GF['iscf'] * lg(m('iscf')) + GF['sog'] * lg(m('sog')) + GF['home'] * r.home + GF['pos'] * math.log(max(pg_, 0) + 0.1) + GF['b2b'] * b2b)
        last5, last10, last20 = before[-5:], before[-10:], before[-20:]
        mn = lambda xs, k: float(np.mean([x[k] for x in xs])) if xs else np.nan
        f = dict(season=y, slate=r.date, pid=r.playerId, name=r.name, team=r.team, opp=r.opp, pos=r.pos, isD=1 if r.pos == 'D' else 0, sog=r.sog, g=r.g,
                 lamS=lamS, lamG=lamG, n=n, held=1 if held else 0,
                 sog_l5=mn(last5, 'sog'), icf_l5=mn(last5, 'icf'), icf_l10=mn(last10, 'icf'), iff_l5=mn(last5, 'iff'), toi_l5=mn(last5, 'toi'), toi_l10=mn(last10, 'toi'),
                 iscf_l10=mn(last10, 'iscf'), ihdcf_l10=mn(last10, 'ihdcf'), g_l20=mn(last20, 'g'),
                 sog_max10=max(x['sog'] for x in last10) if last10 else np.nan, sog_sd20=float(np.std([x['sog'] for x in last20])) if last20 else np.nan,
                 shpct20=(sum(x['g'] for x in last20) / max(1, sum(x['sog'] for x in last20))) if last20 else np.nan,
                 slot=r.p_slot_l1, home=r.home, b2b=b2b, opp_b2b=1 if r.opp_b2b == 1 else 0, rest=r.rest_days,
                 opp_sa=r.opp_sa_pg, opp_sa_l10=r.opp_sa_l10, opp_ga=r.opp_ga_pg, opp_pos_sog=ps, opp_pos_g=pg_,
                 pace=r.pace_game_std, gk_sv=getattr(r, 'gk_std_svpct', np.nan), gk_n=getattr(r, 'gk_n', np.nan), team_sf=r.team_sf_pg)
        for mk in (5, 6, 7):
            f[f'big{mk}_20'] = float(np.mean([1.0 if x['sog'] >= mk else 0.0 for x in last20])) if last20 else 0.0
            f[f'p_sog{mk}'] = float(poisson.sf(mk - 1, lamS)); f[f'y_sog{mk}'] = 1.0 if r.sog >= mk else 0.0
        f['big2g_20'] = float(np.mean([1.0 if x['g'] >= 2 else 0.0 for x in last20])) if last20 else 0.0
        f['big2g_82'] = float(np.mean([1.0 if x['g'] >= 2 else 0.0 for x in before[-82:]])) if before else 0.0
        f['p_g2'] = float(poisson.sf(1, lamG)); f['y_g2'] = 1.0 if r.g >= 2 else 0.0
        recs.append(f)
df = pd.DataFrame(recs)
print('rows', len(df), df.groupby('season').size().to_dict(), file=sys.stderr)
os.makedirs(A.out, exist_ok=True)
df.to_csv(f'{A.out}/nhl-big-rows.csv', index=False)

FOLDS = [
    ('2025-26 Nov–Jan → Feb–Apr', lambda d: (d.season == 2025) & (d.slate >= '2025-11-01') & (d.slate < '2026-02-01'), lambda d: (d.season == 2025) & (d.slate >= '2026-02-01')),
    ('2025-26 → 2026-27', lambda d: (d.season == 2025) & (d.slate >= '2025-11-01'), lambda d: d.season == 2026),
]
CONTEXTS = {
    'big20': ['BIG20'], 'big82': ['big2g_82'], 'sog_l5': ['sog_l5'], 'attempts': ['icf_l5'], 'attempts10': ['icf_l10'], 'unblocked': ['iff_l5'],
    'toi': ['toi_l5'], 'best10': ['sog_max10'], 'sd20': ['sog_sd20'], 'chances': ['iscf_l10'], 'hd_chances': ['ihdcf_l10'], 'shpct': ['shpct20'],
    'goals20': ['g_l20'], 'slot': ['slot'], 'defense': ['isD'], 'home': ['home'], 'b2b': ['b2b', 'opp_b2b'], 'rest': ['rest'],
    'opp_sa': ['opp_sa'], 'opp_sa_l10': ['opp_sa_l10'], 'opp_ga': ['opp_ga'], 'opp_pos': ['opp_pos_sog'], 'pace': ['pace'], 'goalie': ['gk_sv'], 'team_sf': ['team_sf'],
}
def logit(p): p = np.clip(p, 1e-4, 1 - 1e-4); return np.log(p / (1 - p))
def topk(d, p, y, k=5):
    t = d.assign(_p=p, _y=y).sort_values('_p', ascending=False).groupby('slate').head(k)
    return [round(float(t._p.mean()), 3), round(float(t._y.mean()), 3), len(t)]
def fit_pred(tr, te, cols, yc):
    med = tr[cols].median() if cols else None
    X = lambda x: np.column_stack([logit(x.p.values)] + [x[c].fillna(med[c]).values for c in cols])
    lr = LogisticRegression(C=1e6, max_iter=3000).fit(X(tr), tr[yc])
    return lr.predict_proba(X(te))[:, 1], lr
TARGETS = [('sog5', 'p_sog5', 'y_sog5', 'big5_20', 1.5), ('sog6', 'p_sog6', 'y_sog6', 'big6_20', 1.5), ('sog7', 'p_sog7', 'y_sog7', 'big7_20', 1.5), ('g2', 'p_g2', 'y_g2', 'big2g_20', 0)]
report = {}; coefs = {}
for name, pc, yc, bc, lam_min in TARGETS:
    d = df.copy(); d['p'] = d[pc]; d['BIG20'] = d[bc]
    if name.startswith('sog'): d = d[d.lamS >= lam_min]
    report[name] = {}; coefs[name] = {}
    for fold, ftr, fte in FOLDS:
        tr, te = d[ftr(d)], d[fte(d)]
        yt = te[yc].values
        res = dict(train=len(tr), train_rate=round(float(tr[yc].mean()), 4), test=len(te), test_rate=round(float(yt.mean()), 4), models={})
        def put(k, p): res['models'][k] = dict(brier=round(brier_score_loss(yt, p), 6), auc=round(roc_auc_score(yt, p), 4) if 0 < yt.sum() < len(yt) else None, said=round(float(np.mean(p)), 4), top5=topk(te, p, yt))
        put('board', te.p.values)
        p, lr = fit_pred(tr, te, [], yc); put('board_cal', p); coefs[name].setdefault('board_cal', {})[fold] = [round(float(lr.intercept_[0]), 4), round(float(lr.coef_[0][0]), 4)]
        for cname, cols in CONTEXTS.items():
            p, lr = fit_pred(tr, te, cols, yc); put(f'+{cname}', p)
            coefs[name].setdefault(cname, {})[fold] = [round(float(lr.intercept_[0]), 4)] + [round(float(c), 4) for c in lr.coef_[0]]
        allc = sorted({c for cols in CONTEXTS.values() for c in cols})
        med = tr[allc].median()
        Xtr = np.column_stack([logit(tr.p.values), tr[allc].fillna(med).values]); Xte = np.column_stack([logit(te.p.values), te[allc].fillna(med).values])
        lr = make_pipeline(StandardScaler(), LogisticRegression(C=0.05, max_iter=5000)).fit(Xtr, tr[yc]); put('+all (logistic)', lr.predict_proba(Xte)[:, 1])
        gb = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.04, max_iter=300, min_samples_leaf=100, l2_regularization=2.0, random_state=0).fit(Xtr, tr[yc]); put('+all (trees)', gb.predict_proba(Xte)[:, 1])
        report[name][fold] = res
    b = {f: report[name][f]['models'] for f in report[name]}
    cal = {f: b[f]['board_cal']['brier'] for f in b}
    wins = [k for k in b[FOLDS[0][0]] if k.startswith('+') and all(b[f][k]['brier'] < cal[f] for f in b)]
    print(name, 'base', [report[name][f]['test_rate'] for f in b], 'said', [b[f]['board']['said'] for f in b], 'board', [b[f]['board']['brier'] for f in b], 'cal', list(cal.values()),
          'beats cal on both:', sorted([(k, [b[f][k]['brier'] for f in b]) for k in wins], key=lambda x: sum(x[1]))[:6], file=sys.stderr)

def mine(d, y, cols, min_sup=60, beam=40, depth=3):
    conds = []
    for c in cols:
        v = d[c].dropna()
        if v.nunique() < 3: continue
        for q in (0.5, 0.67, 0.8, 0.9, 0.95): conds.append((c, '>=', float(v.quantile(q))))
        for q in (0.2, 0.33): conds.append((c, '<=', float(v.quantile(q))))
    def mask(rule, dd):
        mm = np.ones(len(dd), bool)
        for c, op, t in rule:
            x = dd[c].values.astype(float); mm &= ((x >= t) if op == '>=' else (x <= t)) & ~np.isnan(x)
        return mm
    best = []; level = [()]
    for _ in range(depth):
        cand = []
        for r in level:
            used = {c for c, _, _ in r}
            for cd in conds:
                if cd[0] in used: continue
                rr = tuple(sorted(r + (cd,))); mm = mask(rr, d); n = int(mm.sum())
                if n < min_sup: continue
                rate = float(y[mm].mean()); z = 1.64
                lb = (rate + z * z / (2 * n) - z * math.sqrt(rate * (1 - rate) / n + z * z / (4 * n * n))) / (1 + z * z / n)
                cand.append((lb, rate, n, rr))
        cand = sorted({c[3]: c for c in cand}.values(), key=lambda c: -c[0])[:beam]
        best += cand; level = [c[3] for c in cand]
    return sorted({c[3]: c for c in best}.values(), key=lambda c: -c[0])[:8], mask
rules = {}
for name, pc, yc, bc, lam_min in TARGETS:
    d = df.copy(); d['p'] = d[pc]; d['BIG20'] = d[bc]
    if name.startswith('sog'): d = d[d.lamS >= lam_min]
    tr = d[(d.season == 2025) & (d.slate >= '2025-11-01') & (d.slate < '2026-02-01')]
    checks = {'Feb–Apr': d[(d.season == 2025) & (d.slate >= '2026-02-01')], '2026-27': d[d.season == 2026]}
    cols = ['p', 'lamS', 'lamG'] + sorted({c for cols in CONTEXTS.values() for c in cols})
    best, mask = mine(tr, tr[yc].values, cols)
    out = []
    for lb, rate, n, rule in best:
        o = dict(rule=[f'{c} {op} {round(t, 3)}' for c, op, t in rule], fit=dict(n=n, rate=round(rate, 3)))
        for k, te in checks.items():
            mm = mask(rule, te); nt = int(mm.sum())
            o[k] = dict(n=nt, rate=round(float(te[yc].values[mm].mean()), 3) if nt else None, board_said=round(float(te.p.values[mm].mean()), 3) if nt else None)
        out.append(o)
    rules[name] = out
    print(name, 'rules', json.dumps(out[:3]), file=sys.stderr)

# The level: a Poisson tail of the λ against a negative binomial with one dispersion fitted on the fit's counts (r), per mark.
from scipy.stats import nbinom
from scipy.optimize import minimize_scalar
level = {}
for stat, lamc, marks, lmin in (('sog', 'lamS', (5, 6, 7), 1.5), ('g', 'lamG', (2, 3), 0)):
    dd = df[df[lamc] >= lmin] if lmin else df
    for fold, ftr, fte in FOLDS:
        TR, TE = dd[ftr(dd)], dd[fte(dd)]
        nll = lambda lr: -nbinom.logpmf(TR[stat].values, np.exp(lr), np.exp(lr) / (np.exp(lr) + TR[lamc].values)).sum()
        r = float(np.exp(minimize_scalar(nll, bounds=(-1, 6), method='bounded').x))
        out = {}
        for k in marks:
            y = (TE[stat] >= k).astype(float).values
            pp = poisson.sf(k - 1, TE[lamc].values); pn = nbinom.sf(k - 1, r, r / (r + TE[lamc].values))
            out[f'{k}+'] = dict(landed=round(float(y.mean()), 4), poisson=round(float(pp.mean()), 4), poisson_brier=round(brier_score_loss(y, pp), 6), nb=round(float(pn.mean()), 4), nb_brier=round(brier_score_loss(y, pn), 6))
        level.setdefault(stat, {})[fold] = dict(r=round(r, 2), marks=out)
        print(stat, fold, 'r', round(r, 2), out, file=sys.stderr)
with open(f'{A.out}/nhl-big.json', 'w') as fh: json.dump(dict(models=report, coefs=coefs, rules=rules, level=level), fh, indent=1)
print('done', file=sys.stderr)

"""The big NBA games, mined (Vincent, 2026-11-01: "Do the same big games study for the NBA"; the NFL's is nfl_big.py).

Every player-game the site's NBA board projected on the replay (tools/audit/nba-audit.mjs: the board rebuilt from ESPN's
box scores slate by slate, its rows with the projection, his spread, the minutes read, the matchup, the lifts), with
what was known that morning from ESPN's box scores and lines: his minutes, usage, shots and threes attempted over his
last 5 / 10, his own big games over his last 20, his best of the last 10; the game's total and spread (ESPN's pickcenter),
his team's implied points, home, a back-to-back for either side; both teams' pace (possessions a game this season); the
opponent's rank at his spot and the matchup factor; teammates out (the without split, the vacated lift).

Big games: 30+ / 40+ points, 12+ / 15+ rebounds, 10+ / 12+ assists, 5+ / 7+ threes, 40+ / 50+ PRA. The board's chance of a
mark = the normal tail of his distribution (the projection, the rung's spread). Two checks, each fitted on what came
before it: 2025-26 Oct-Jan → Feb-Apr, and 2025-26 → 2026-27 (Oct 22-31). Small models (the board plus one context), the
groups, everything (logistic, trees), and one- to three-condition rules mined on the fit.

  python3 tools/audit/nba_big.py [--rows .nhl-data/audit/big] [--raw .nhl-data/audit/nba] [--out .nhl-data/audit/out]
"""
import argparse, glob, json, math, os, re, sys
from collections import defaultdict
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score, brier_score_loss, log_loss
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline

ap = argparse.ArgumentParser()
ap.add_argument('--rows', default='.nhl-data/audit/big')
ap.add_argument('--raw', default='.nhl-data/audit/nba')
ap.add_argument('--out', default='.nhl-data/audit/out')
A = ap.parse_args()

def load(f):
    with open(f) as fh: return json.load(fh)
def et_date(iso):
    # ESPN's UTC kickoff to the ET slate date (UTC-4 in Oct-early Nov, UTC-5 Nov-Mar: an evening tip never crosses).
    from datetime import datetime, timedelta
    d = datetime.strptime(iso[:16], '%Y-%m-%dT%H:%M')
    return (d - timedelta(hours=5)).strftime('%Y-%m-%d')

# ESPN's box scores: per player-game the figures, per team-game the possessions; per game the line.
pg = defaultdict(list)       # espnId -> [{date, team, opp, min, pts, reb, ast, tpm, tpa, fga, fta, tov, usg}]
team_games = defaultdict(list)   # team -> [(date, poss, opp)]
lines = {}                   # (date, team) -> {total, fav_by, implied, home}
num = lambda v: float(v) if v not in (None, '', '--') else 0.0
def split(v, i):
    try: return float(str(v).split('-')[i])
    except Exception: return 0.0
for folder in (f'{A.raw}/prior/games', f'{A.raw}/games'):
    for f in glob.glob(f'{folder}/*.json'):
        j = load(f)
        comp = j['header']['competitions'][0]
        if not comp.get('status', {}).get('type', {}).get('completed', True): pass
        date = et_date(comp['date'])
        teams = {c['homeAway']: c['team']['abbreviation'] for c in comp['competitors']}
        H, Aw = teams.get('home'), teams.get('away')
        pc = next((p for p in (j.get('pickcenter') or []) if p.get('overUnder') is not None), None)
        fav_team, pts = None, None
        if pc:
            m = re.match(r'^([A-Z]{2,4})\s*-?(\d+(?:\.\d+)?)$', str(pc.get('details') or '').strip())
            if m: fav_team, pts = m.group(1), float(m.group(2))
            elif re.match(r'^(even|pk)', str(pc.get('details') or ''), re.I): pts = 0.0
        for t, o, home in ((H, Aw, 1), (Aw, H, 0)):
            if pc and pts is not None:
                sign = pts if fav_team == t else -pts if fav_team else 0.0
                lines[(date, t)] = dict(total=float(pc['overUnder']), fav_by=sign, implied=float(pc['overUnder']) / 2 + sign / 2, home=home)
            else:
                lines[(date, t)] = dict(total=np.nan, fav_by=np.nan, implied=np.nan, home=home)
        tot = defaultdict(lambda: defaultdict(float))
        rows = []
        for tb in j['boxscore'].get('players', []):
            t = tb['team']['abbreviation']; o = Aw if t == H else H
            st = tb['statistics'][0]; keys = st.get('keys') or []
            ix = {k: i for i, k in enumerate(keys)}
            for a in st.get('athletes', []):
                s = a.get('stats') or []
                if not s or a.get('didNotPlay') or not (a.get('athlete') or {}).get('id'): continue
                g = lambda k, s=s: s[ix[k]] if k in ix and ix[k] < len(s) else None
                r = dict(id=str(a['athlete']['id']), date=date, team=t, opp=o, min=num(g('minutes')), pts=num(g('points')), reb=num(g('rebounds')), ast=num(g('assists')),
                         tpm=split(g('threePointFieldGoalsMade-threePointFieldGoalsAttempted'), 0), tpa=split(g('threePointFieldGoalsMade-threePointFieldGoalsAttempted'), 1),
                         fga=split(g('fieldGoalsMade-fieldGoalsAttempted'), 1), fta=split(g('freeThrowsMade-freeThrowsAttempted'), 1), tov=num(g('turnovers')), oreb=num(g('offensiveRebounds')))
                if r['min'] <= 0: continue
                rows.append(r)
                for k in ('min', 'fga', 'fta', 'tov', 'oreb'): tot[t][k] += r[k]
        for r in rows:
            T = tot[r['team']]
            use = r['fga'] + 0.44 * r['fta'] + r['tov']; tuse = T['fga'] + 0.44 * T['fta'] + T['tov']
            r['usg'] = 100 * use * (T['min'] / 5) / (r['min'] * tuse) if tuse > 0 and r['min'] > 0 else np.nan
            r['pra'] = r['pts'] + r['reb'] + r['ast']
            pg[r['id']].append(r)
        for t, o in ((H, Aw), (Aw, H)):
            T = tot[t]
            if T['min'] > 0: team_games[t].append((date, T['fga'] + 0.44 * T['fta'] - T['oreb'] + T['tov'], o))
for k in pg: pg[k].sort(key=lambda r: r['date'])
for t in team_games: team_games[t].sort()
print('players', len(pg), 'team-games', sum(len(v) for v in team_games.values()), file=sys.stderr)

def season_of(d): return 2025 if d < '2026-07-01' else 2026
def pace(team, date):
    s = season_of(date)
    xs = [p for d, p, o in team_games[team] if d < date and season_of(d) == s]
    return float(np.mean(xs)) if len(xs) >= 3 else np.nan
def b2b(team, date):
    from datetime import datetime, timedelta
    prev = (datetime.strptime(date, '%Y-%m-%d') - timedelta(days=1)).strftime('%Y-%m-%d')
    return 1.0 if any(d == prev for d, _, _ in team_games[team]) else 0.0

TARGETS = [('pts', 30), ('pts', 40), ('reb', 12), ('reb', 15), ('ast', 10), ('ast', 12), ('tpm', 5), ('tpm', 7), ('pra', 40), ('pra', 50)]
POP = {'pts': 12, 'reb': 5, 'ast': 4, 'tpm': 1.5, 'pra': 20}
from math import erf, sqrt
def tail(exp, sd, mark):
    if not (sd and sd > 0) or exp is None or np.isnan(exp): return np.nan
    z = (mark - 0.5 - exp) / sd
    return 1 - 0.5 * (1 + erf(z / sqrt(2)))

recs = []
for f in glob.glob(f'{A.rows}/nba-*-rows.csv'):
    tag = 'prior' if '-prior-' in f else 'cur'
    d = pd.read_csv(f)
    for r in d.itertuples(index=False):
        if r.market not in POP or pd.isna(r.exp) or r.exp < POP[r.market] or pd.isna(r.actual): continue
        eid = str(int(r.espnId)) if not pd.isna(r.espnId) else None
        hist = [x for x in pg.get(eid, []) if x['date'] < r.slate] if eid else []
        if len(hist) < 5: continue
        last5, last10, last20 = hist[-5:], hist[-10:], hist[-20:]
        stat = r.market
        f_ = dict(src=tag, slate=r.slate, season=season_of(r.slate), key=r.key, team=r.team, opp=r.opp, market=stat, exp=r.exp, sd=r.sd, actual=r.actual,
                  up=r.up, matchup=r.matchup, rank_where=(1 - 2 * (r.rank - 1) / (r.count - 1)) if not pd.isna(r.rank) and r.count > 1 else np.nan,
                  minTonight=r.minTonight, minBase=r.minBase, lift=r.lift, withoutN=r.withoutN, nThis=r.nThis,
                  min_l5=np.mean([x['min'] for x in last5]), usg_l5=np.nanmean([x['usg'] for x in last5]), usg_l10=np.nanmean([x['usg'] for x in last10]),
                  fga_l5=np.mean([x['fga'] for x in last5]), tpa_l5=np.mean([x['tpa'] for x in last5]), fta_l5=np.mean([x['fta'] for x in last5]),
                  best10=max(x[stat] for x in last10), sd20=float(np.std([x[stat] for x in last20])), mean20=float(np.mean([x[stat] for x in last20])))
        for mk in (30, 40, 12, 15, 10, 5, 7, 50):
            f_[f'big{mk}_20'] = np.mean([1.0 if x[stat] >= mk else 0.0 for x in last20])
        ln = lines.get((r.slate, r.team), {})
        f_.update(total=ln.get('total', np.nan), fav_by=ln.get('fav_by', np.nan), implied=ln.get('implied', np.nan), home=ln.get('home', np.nan))
        f_['pace_own'] = pace(r.team, r.slate); f_['pace_opp'] = pace(r.opp, r.slate)
        f_['pace_game'] = np.nanmean([f_['pace_own'], f_['pace_opp']]) if not (np.isnan(f_['pace_own']) and np.isnan(f_['pace_opp'])) else np.nan
        f_['b2b'] = b2b(r.team, r.slate); f_['opp_b2b'] = b2b(r.opp, r.slate)
        f_['blowout'] = abs(f_['fav_by']) if not np.isnan(f_['fav_by']) else np.nan
        for m2, mark in TARGETS:
            if m2 != stat: continue
            f_[f'p_{mark}'] = tail(r.exp, r.sd, mark)
            f_[f'y_{mark}'] = 1.0 if r.actual >= mark else 0.0
        recs.append(f_)
df = pd.DataFrame(recs)
print('rows', len(df), df.groupby(['season', 'market']).size().to_dict(), file=sys.stderr)
os.makedirs(A.out, exist_ok=True)
df.to_csv(f'{A.out}/nba-big-rows.csv', index=False)

FOLDS = [
    ('2025-26 Oct–Jan → Feb–Apr', lambda d: (d.season == 2025) & (d.slate >= '2025-11-01') & (d.slate < '2026-02-01'), lambda d: (d.season == 2025) & (d.slate >= '2026-02-01')),
    ('2025-26 → 2026-27', lambda d: (d.season == 2025) & (d.slate >= '2025-11-01'), lambda d: d.season == 2026),
]
CONTEXTS = {
    'minutes': ['minTonight'], 'min_l5': ['min_l5'], 'usage': ['usg_l5'], 'shots': ['fga_l5'], 'threes_att': ['tpa_l5'], 'ft_att': ['fta_l5'],
    'upside': ['up'], 'best10': ['best10'], 'sd20': ['sd20'], 'big20': ['BIG20'],
    'total': ['total'], 'implied': ['implied'], 'spread': ['blowout'], 'home': ['home'], 'b2b': ['b2b', 'opp_b2b'],
    'pace': ['pace_game'], 'matchup': ['matchup'], 'rank': ['rank_where'], 'teammates_out': ['lift', 'withoutN'],
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
report = {}
for stat, mark in TARGETS:
    name = f'{stat}{mark}'
    d = df[(df.market == stat)].copy()
    d['p'] = d[f'p_{mark}']; d = d[d.p.notna()]
    big = {'pts': 30, 'reb': 12, 'ast': 10, 'tpm': 5, 'pra': 40}.get(stat)
    d['BIG20'] = d.get(f'big{mark}_20', d.get(f'big{big}_20'))
    yc = f'y_{mark}'
    report[name] = {}
    for fold, ftr, fte in FOLDS:
        tr, te = d[ftr(d)], d[fte(d)]
        yt = te[yc].values
        res = dict(train=len(tr), train_rate=round(float(tr[yc].mean()), 4), test=len(te), test_rate=round(float(yt.mean()), 4), models={})
        def put(k, p): res['models'][k] = dict(brier=round(brier_score_loss(yt, p), 5), auc=round(roc_auc_score(yt, p), 4) if 0 < yt.sum() < len(yt) else None, said=round(float(np.mean(p)), 4), top5=topk(te, p, yt))
        put('board', te.p.values)
        p, _ = fit_pred(tr, te, [], yc); put('board_cal', p)
        for cname, cols in CONTEXTS.items():
            p, _ = fit_pred(tr, te, cols, yc); put(f'+{cname}', p)
        allc = sorted({c for cols in CONTEXTS.values() for c in cols})
        med = tr[allc].median()
        Xtr = np.column_stack([logit(tr.p.values), tr[allc].fillna(med).values]); Xte = np.column_stack([logit(te.p.values), te[allc].fillna(med).values])
        lr = make_pipeline(StandardScaler(), LogisticRegression(C=0.05, max_iter=5000)).fit(Xtr, tr[yc]); put('+all (logistic)', lr.predict_proba(Xte)[:, 1])
        gb = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.04, max_iter=300, min_samples_leaf=60, l2_regularization=2.0, random_state=0).fit(Xtr, tr[yc]); put('+all (trees)', gb.predict_proba(Xte)[:, 1])
        report[name][fold] = res
    b = {f: report[name][f]['models'] for f in report[name]}
    cal = {f: b[f]['board_cal']['brier'] for f in b}
    wins = [k for k in b[FOLDS[0][0]] if k.startswith('+') and all(b[f][k]['brier'] < cal[f] for f in b)]
    print(name, 'base', [report[name][f]['test_rate'] for f in b], 'board', [b[f]['board']['brier'] for f in b], 'cal', list(cal.values()), 'beats cal on both:',
          sorted([(k, [b[f][k]['brier'] for f in b]) for k in wins], key=lambda x: sum(x[1]))[:5], file=sys.stderr)

# The rules: one to three conditions mined on 2025-26 before February, scored on Feb–Apr and on 2026-27.
def mine(d, y, cols, min_sup=40, beam=40, depth=3):
    conds = []
    for c in cols:
        v = d[c].dropna()
        if v.nunique() < 4: continue
        for q in (0.5, 0.67, 0.8, 0.9): conds.append((c, '>=', float(v.quantile(q))))
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
for stat, mark in TARGETS:
    name = f'{stat}{mark}'
    d = df[(df.market == stat)].copy(); d['p'] = d[f'p_{mark}']; d = d[d.p.notna()]
    d['BIG20'] = d.get(f'big{mark}_20'); yc = f'y_{mark}'
    tr = d[(d.season == 2025) & (d.slate >= '2025-11-01') & (d.slate < '2026-02-01')]
    checks = {'Feb–Apr': d[(d.season == 2025) & (d.slate >= '2026-02-01')], '2026-27': d[d.season == 2026]}
    cols = ['p', 'exp'] + sorted({c for cols in CONTEXTS.values() for c in cols})
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
with open(f'{A.out}/nba-big.json', 'w') as fh: json.dump(dict(models=report, rules=rules), fh, indent=1)
print('done', file=sys.stderr)

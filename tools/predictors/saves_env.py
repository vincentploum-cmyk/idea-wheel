"""Goalie saves: what it takes for 25 / 28 / 30 saves and which environment read predicts them, leak-free
(docs/audits/2026-11-27-nhl-icf-thresholds.md, "Goalie saves"). One row per starting goalie, every read from games before
the date, last season's gap as the prior the way the site blends (games / (games + 10), shotsAgainst in
lib/nhl-data/goalies-pure.js). The site's SAVES_SHOTS_FIT as shipped, then refits of the same form on shots, attempts (iCF),
chances (iSCF) and last-10 windows, fitted on the earlier seasons and scored on the last one given (MAE, bias, r, Brier of
25+ / 28+ / 30+ at SAVES_SD 6.8); the grid by both teams' gaps; saves by the projected shots.
Usage: python3 -I tools/predictors/saves_env.py <games dir oldest> ... <games dir newest>   (fetch.mjs output)"""
import json, os, sys, math
from collections import defaultdict

K = 10
SITE = dict(opp=0.89, team=0.87, home=0.53)
STARTER_SHARE, SD = 0.97, 6.8

def load(d):
    out = []
    for f in sorted(os.listdir(d)):
        out += [g for g in json.load(open(os.path.join(d, f)))['games'] if g.get('gameType') == 2]
    return sorted(out, key=lambda g: (g['date'], g['id']))

def side_stats(g, me, op):
    sk = [s for s in g['skaters'] if s['team'] == g[me]['abbrev']]
    ok = [s for s in g['skaters'] if s['team'] == g[op]['abbrev']]
    return dict(sf=g[me]['sog'], sa=g[op]['sog'], cf=sum(s.get('icf') or 0 for s in sk), ca=sum(s.get('icf') or 0 for s in ok),
                xf=sum(s.get('iscf') or 0 for s in sk), xa=sum(s.get('iscf') or 0 for s in ok))
KEYS = ('sf', 'sa', 'cf', 'ca', 'xf', 'xa')

seasons = [load(d) for d in sys.argv[1:]]
rows = []
prev_tot, prev_lg = None, None
for si, games in enumerate(seasons):
    T = defaultdict(lambda: {'n': 0, **{k: 0.0 for k in KEYS}, 'hist': []})
    gsv = defaultdict(lambda: [0, 0])   # goalie shots, saves this season (for his own save %)
    by = defaultdict(list)
    for g in games: by[g['date']].append(g)
    for d in sorted(by):
        n_all = sum(t['n'] for t in T.values())
        lg = {k: (sum(t[k] for t in T.values()) / n_all if n_all else None) for k in KEYS}
        lgsv = (sum(v[1] for v in gsv.values()) / sum(v[0] for v in gsv.values())) if gsv else 0.9
        def read(team, k, l10=False):
            t = T[team]; pg = 0.0
            if prev_tot and team in prev_tot and prev_tot[team]['n']:
                pg = prev_tot[team][k] / prev_tot[team]['n'] - prev_lg[k]
            if l10:
                h = t['hist'][-10:]
                if len(h) < 5: return None
                return sum(x[k] for x in h) / len(h) - (lg[k] or 0)
            if not t['n'] or lg[k] is None: return pg
            return ((t[k] / t['n'] - lg[k]) * t['n'] + pg * K) / (t['n'] + K)
        for g in by[d]:
            for me, op in (('home', 'away'), ('away', 'home')):
                team, opp = g[me]['abbrev'], g[op]['abbrev']
                st = [x for x in g['goalies'] if x['team'] == team and x.get('starter')]
                if not st or lg['sf'] is None or T[team]['n'] < 5 or T[opp]['n'] < 5: continue
                gl = st[0]
                gs = gsv[gl['id']]
                rows.append(dict(season=si, date=d, team=team, opp=opp, home=1 if me == 'home' else 0,
                                 lg=lg['sf'], lgsv=lgsv, gsv=(gs[1] + 300 * lgsv) / (gs[0] + 300),
                                 o_sf=read(opp, 'sf'), t_sa=read(team, 'sa'), o_cf=read(opp, 'cf'), t_ca=read(team, 'ca'),
                                 o_xf=read(opp, 'xf'), t_xa=read(team, 'xa'),
                                 o_sf10=read(opp, 'sf', True), t_sa10=read(team, 'sa', True),
                                 shots=g[op]['sog'], sv=gl['sv'], sa_g=gl['sa']))
        for g in by[d]:
            for me, op in (('home', 'away'), ('away', 'home')):
                t = T[g[me]['abbrev']]; s = side_stats(g, me, op)
                t['n'] += 1; t['hist'].append(s)
                for k in KEYS: t[k] += s[k]
            for x in g['goalies']:
                if x.get('sa'): gsv[x['id']][0] += x['sa']; gsv[x['id']][1] += x['sv']
    prev_tot = {tm: dict(t) for tm, t in T.items()}
    n_all = sum(t['n'] for t in T.values())
    prev_lg = {k: sum(t[k] for t in T.values()) / n_all for k in KEYS}

test_si = len(seasons) - 1
R = [r for r in rows if r['o_sf10'] is not None and r['t_sa10'] is not None]
train = [r for r in R if r['season'] < test_si]; test = [r for r in R if r['season'] == test_si]
print(f'{len(R)} starts: train {len(train)} (seasons 0-{test_si-1}), test {len(test)} (season {test_si})')
print(f'saves a start: train {sum(r["sv"] for r in train)/len(train):.2f}, test {sum(r["sv"] for r in test)/len(test):.2f}')

def ols(rows, feats, y):
    X = [[1.0] + [f(r) for f in feats] for r in rows]; Y = [y(r) for r in rows]; k = len(X[0])
    A = [[sum(x[i] * x[j] for x in X) for j in range(k)] for i in range(k)]; b = [sum(x[i] * yy for x, yy in zip(X, Y)) for i in range(k)]
    M = [A[i] + [b[i]] for i in range(k)]
    for c in range(k):
        p = max(range(c, k), key=lambda r_: abs(M[r_][c])); M[c], M[p] = M[p], M[c]
        for r_ in range(k):
            if r_ != c:
                f_ = M[r_][c] / M[c][c]; M[r_] = [a - f_ * bb for a, bb in zip(M[r_], M[c])]
    return [M[i][k] / M[i][i] for i in range(k)]
def ncdf(z): return 0.5 * (1 + math.erf(z / math.sqrt(2)))
def grade(name, proj, rows=test):
    err = [r['sv'] - proj(r) for r in rows]
    mae = sum(abs(e) for e in err) / len(err); bias = sum(err) / len(err)
    br = {}
    for k in (25, 28, 30):
        br[k] = sum(((1 - ncdf((k - 0.5 - proj(r)) / SD)) - (r['sv'] >= k)) ** 2 for r in rows) / len(rows)
    # rank: spearman-ish via pearson of projection vs saves
    ps = [proj(r) for r in rows]; ys = [r['sv'] for r in rows]
    mp, my = sum(ps) / len(ps), sum(ys) / len(ys)
    cor = sum((a - mp) * (b - my) for a, b in zip(ps, ys)) / math.sqrt(sum((a - mp) ** 2 for a in ps) * sum((b - my) ** 2 for b in ys))
    print(f'  {name:46} MAE {mae:5.3f}  bias {bias:+5.2f}  r {cor:5.3f}  Brier 25+ {br[25]:.4f} 28+ {br[28]:.4f} 30+ {br[30]:.4f}')
    return mae

sv = lambda r: r['lgsv']
print('\n== Scored on the test season (saves = shots x 0.97 x league save %; SD 6.8):')
grade('league average only', lambda r: r['lg'] * STARTER_SHARE * sv(r))
site = lambda r: (r['lg'] + SITE['opp'] * r['o_sf'] + SITE['team'] * r['t_sa'] + (-1 if r['home'] else 1) * SITE['home']) * STARTER_SHARE * sv(r)
grade('site formula as shipped (0.89 / 0.87 / 0.53)', site)
grade('site formula, his own shrunk save %', lambda r: (r['lg'] + SITE['opp'] * r['o_sf'] + SITE['team'] * r['t_sa'] + (-1 if r['home'] else 1) * SITE['home']) * STARTER_SHARE * r['gsv'])

hs = lambda r: (-1 if r['home'] else 1)
specs = {
    'refit: shots for / against (season blend)': [lambda r: r['o_sf'], lambda r: r['t_sa'], hs],
    'refit: attempts for / against (iCF)': [lambda r: r['o_cf'], lambda r: r['t_ca'], hs],
    'refit: chances for / against (iSCF)': [lambda r: r['o_xf'], lambda r: r['t_xa'], hs],
    'refit: shots + attempts': [lambda r: r['o_sf'], lambda r: r['t_sa'], lambda r: r['o_cf'], lambda r: r['t_ca'], hs],
    'refit: shots, last 10 instead of season': [lambda r: r['o_sf10'], lambda r: r['t_sa10'], hs],
    'refit: shots season + last 10': [lambda r: r['o_sf'], lambda r: r['t_sa'], lambda r: r['o_sf10'], lambda r: r['t_sa10'], hs],
}
print('\n== Fitted on the earlier seasons (team shots against = league + terms), scored on the test season:')
fits = {}
for name, feats in specs.items():
    w = ols(train, feats, lambda r: r['shots'] - r['lg'])
    fits[name] = (w, feats)
    proj = (lambda w, feats: lambda r: (r['lg'] + w[0] + sum(c * f(r) for c, f in zip(w[1:], feats))) * STARTER_SHARE * sv(r))(w, feats)
    grade(name, proj)
    print(f'      coefs: const {w[0]:+.2f}, ' + ', '.join(f'{c:.3f}' for c in w[1:]))

print('\n== What it takes (test season + train pooled): saves 25+ / 28+ / 30+ by the opponent\'s shots-a-game gap x his team\'s shots-allowed gap')
ALL = R
cuts = (-99, -1.5, 1.5, 99)
names = ('opp shoots little (< -1.5)', 'opp average', 'opp shoots a lot (> +1.5)')
for k in (25, 28, 30):
    print(f'  -- {k}+ saves (all: {sum(r["sv"] >= k for r in ALL)/len(ALL):.1%})')
    print('     his team allows:      little (< -1.5)       average       a lot (> +1.5)')
    for i in range(3):
        cells = []
        for j in range(3):
            Rc = [r for r in ALL if cuts[i] <= r['o_sf'] < cuts[i + 1] and cuts[j] <= r['t_sa'] < cuts[j + 1]]
            cells.append(f'{sum(r["sv"] >= k for r in Rc)/len(Rc):6.1%} ({len(Rc):4})' if Rc else '   -')
        print(f'     {names[i]:26} ' + '   '.join(cells))
print('\n== By the site\'s projected shots against (all seasons): saves 25+ / 28+ / 30+ and the saves made')
for lo, hi in ((0, 25), (25, 26.5), (26.5, 28), (28, 29.5), (29.5, 31), (31, 99)):
    Rc = [r for r in ALL if lo <= site(r) / (STARTER_SHARE * sv(r)) < hi]
    if Rc:
        print(f'  projected shots {lo}-{hi if hi < 99 else "+":<5}: saves {sum(r["sv"] for r in Rc)/len(Rc):5.2f}  25+ {sum(r["sv"]>=25 for r in Rc)/len(Rc):5.1%}  28+ {sum(r["sv"]>=28 for r in Rc)/len(Rc):5.1%}  30+ {sum(r["sv"]>=30 for r in Rc)/len(Rc):5.1%}  (n={len(Rc)})')

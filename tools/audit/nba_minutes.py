# The minutes read, tested (2026-10-31): the replay's rows (nba-audit.mjs, --cocktail site) say the points projection
# misses by 5.0 and by 4.1 had the board known his minutes. This script reads each player's minutes history from ESPN's
# box scores (this season) and his game log (last season), tries minutes predictors against the minutes he played, and
# re-projects each stat as his per-minute read × the predicted minutes. Walk-forward: the predictors are compared on
# the test slates (--test-from) after being chosen on the fit slates. Also: a straight shrink of the projection's spread.
#   python3 -I tools/audit/nba_minutes.py --rows .nhl-data/audit/out/nba-2026-10-30-site-rows.csv --raw .nhl-data/audit/nba --test-from 2026-10-27
import argparse, csv, glob, json, os, re, unicodedata
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import numpy as np, pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument('--rows', required=True); ap.add_argument('--raw', required=True); ap.add_argument('--test-from', required=True)
args = ap.parse_args()
ET = ZoneInfo('America/New_York')
STATS = ['pts', 'reb', 'ast', 'tpm', 'pra']

def norm(name):
    s = unicodedata.normalize('NFD', str(name or ''))
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'\b(?:JR|SR|III|II|IV)\b', '', s, flags=re.I)
    s = s.replace('-', ' ')
    s = re.sub(r"[.,'’‘`]", '', s)
    return re.sub(r'\s+', ' ', s).strip().lower()
def et_date(iso):
    d = datetime.fromisoformat(iso.replace('Z', '+00:00'))
    return d.astimezone(ET).strftime('%Y-%m-%d')

# ---- this season's minutes per player-game from the box scores; last season's from the game logs
hist = defaultdict(list)     # key → [(slate, minutes)]
id_of = {}                   # key → espnId
for f in glob.glob(os.path.join(args.raw, 'games', '*.json')):
    j = json.load(open(f))
    comp = j.get('header', {}).get('competitions', [{}])[0]
    if not comp or comp.get('status', {}).get('type', {}).get('completed') is False: continue
    slate = et_date(comp['date'])
    for t in j.get('boxscore', {}).get('players', []):
        for s in t.get('statistics', []):
            keys = s.get('keys', [])
            if 'minutes' not in keys: continue
            mi = keys.index('minutes')
            for a in s.get('athletes', []):
                name = a.get('athlete', {}).get('displayName'); k = norm(name)
                if not k: continue
                id_of[k] = str(a['athlete'].get('id'))
                if a.get('didNotPlay'): continue
                try: m = float(a['stats'][mi])
                except Exception: continue
                hist[k].append((slate, m))
for k in hist: hist[k].sort()
prior = {}   # key → (avg minutes last season, games)
for k, pid in id_of.items():
    f = os.path.join(args.raw, 'gamelogs', f'{pid}.json')
    if not os.path.exists(f): continue
    try: j = json.load(open(f))
    except Exception: continue
    names = j.get('names', [])
    if 'minutes' not in names: continue
    mi = names.index('minutes'); mins = []
    for st in j.get('seasonTypes', []):
        if 'Regular' not in (st.get('displayName') or ''): continue
        for c in st.get('categories', []):
            for e in c.get('events', []):
                try: mins.append(float(e['stats'][mi]))
                except Exception: pass
    if mins: prior[k] = (float(np.mean(mins)), len(mins))

# ---- the replay's rows
rows = []
with open(args.rows) as fh:
    for r in csv.DictReader(fh):
        if r['market'] not in STATS or r['actual'] in ('', None) or r['out'] == 'true': continue
        try: am = float(r['actualMin'])
        except Exception: continue
        if am <= 0: continue
        rows.append(r)
df = pd.DataFrame(rows)
for c in ['exp', 'rate', 'actual', 'actualMin', 'minTonight', 'minBase', 'nThis', 'ownSeason', 'env']:
    df[c] = pd.to_numeric(df[c], errors='coerce')
df = df[df.minTonight > 0].copy()
matched = df.key.isin(hist.keys()).mean()
print(f'rows {len(df)} · players matched to box scores {matched:.1%} · with last-season minutes {df.key.isin(prior.keys()).mean():.1%}')

# ---- minutes predictors from the history before the slate
def before(k, slate): return [m for d, m in hist.get(k, []) if d < slate]
def ewma(xs, a):
    v = None
    for x in xs: v = x if v is None else a * x + (1 - a) * v
    return v
def shrink_prior(xs, k, K):
    p = prior.get(k)
    if not xs and not p: return None
    if not p: return float(np.mean(xs))
    n = len(xs)
    return (sum(xs) + K * p[0]) / (n + K)
preds = {
    'shipped (the board’s read)': lambda k, s, r: r.minTonight,
    'season to date': lambda k, s, r: (np.mean(before(k, s)) if before(k, s) else None),
    'last 3': lambda k, s, r: (np.mean(before(k, s)[-3:]) if before(k, s) else None),
    'last 5': lambda k, s, r: (np.mean(before(k, s)[-5:]) if before(k, s) else None),
    'last game': lambda k, s, r: (before(k, s)[-1] if before(k, s) else None),
    'EWMA α 0.3': lambda k, s, r: ewma(before(k, s), 0.3),
    'EWMA α 0.5': lambda k, s, r: ewma(before(k, s), 0.5),
    'last 3 half, season half': lambda k, s, r: ((np.mean(before(k, s)[-3:]) + np.mean(before(k, s))) / 2 if before(k, s) else None),
    'last season behind it (K 4)': lambda k, s, r: shrink_prior(before(k, s), k, 4),
    'last season behind it (K 8)': lambda k, s, r: shrink_prior(before(k, s), k, 8),
    'last 3 half, prior-shrunk season half (K 4)': lambda k, s, r: ((np.mean(before(k, s)[-3:]) + shrink_prior(before(k, s), k, 4)) / 2 if before(k, s) else shrink_prior([], k, 4)),
    'EWMA α 0.3, started at last season': lambda k, s, r: ewma(([prior[k][0]] if k in prior else []) + before(k, s), 0.3),
}
for name, fn in preds.items():
    df[f'm:{name}'] = [fn(k, s, r) for k, s, r in zip(df.key, df.slate, df.itertuples())]
test = df.slate >= args.test_from
print(f'\n## Minutes predicted against minutes played (points rows; fit slates < {args.test_from}, test slates from it)\n')
pts = df[df.market == 'pts']
print('| Predictor | n fit | MAE min, fit | bias | n test | MAE min, test | bias |')
print('| --- | --- | --- | --- | --- | --- | --- |')
for name in preds:
    c = f'm:{name}'
    for split, mask in [('fit', ~test), ('test', test)]:
        pass
    a = pts[(~test.loc[pts.index]) & pts[c].notna()]; b = pts[(test.loc[pts.index]) & pts[c].notna()]
    print(f'| {name} | {len(a)} | {np.mean(np.abs(a[c] - a.actualMin)):.2f} | {np.mean(a[c] - a.actualMin):+.2f} | {len(b)} | {np.mean(np.abs(b[c] - b.actualMin)):.2f} | {np.mean(b[c] - b.actualMin):+.2f} |')

# ---- the projection re-read on predicted minutes: his per-minute read (exp over the minutes the board read) × the prediction
print(f'\n## The projection on predicted minutes (avg miss; the shipped figure beside it)\n')
head = ['Stat', 'rows test', 'shipped'] + [n for n in preds if not n.startswith('shipped')] + ['had we known his minutes']
print('| ' + ' | '.join(head) + ' |'); print('| ' + ' | '.join('---' for _ in head) + ' |')
for s in STATS:
    g = df[(df.market == s) & test]
    per_min = g.exp / g.minTonight
    cells = [s, str(len(g)), f'{np.mean(np.abs(g.exp - g.actual)):.3f}']
    for n in preds:
        if n.startswith('shipped'): continue
        c = f'm:{n}'; m = g[c].notna()
        proj = per_min[m] * g[c][m]
        cells.append(f'{np.mean(np.abs(proj - g.actual[m])):.3f}')
    cells.append(f'{np.mean(np.abs(per_min * g.actualMin - g.actual)):.3f}')
    print('| ' + ' | '.join(cells) + ' |')

# ---- the spread of the projection: a linear shrink fitted on the fit slates, scored on the test slates
print(f'\n## The projection’s spread: actual = a + b · projection, fitted on the fit slates, scored on the test slates\n')
print('| Stat | a | b | shipped MAE (test) | shrunk MAE (test) | bias shipped → shrunk | 20+ / 8+ projected: bias shipped → shrunk |')
print('| --- | --- | --- | --- | --- | --- | --- |')
for s in STATS:
    f = df[(df.market == s) & ~test]; g = df[(df.market == s) & test]
    b, a = np.polyfit(f.exp, f.actual, 1)
    sh = a + b * g.exp
    big = g.exp >= (20 if s in ('pts', 'pra') else 8 if s == 'reb' else 5 if s == 'ast' else 2.5)
    print(f'| {s} | {a:.2f} | {b:.3f} | {np.mean(np.abs(g.exp - g.actual)):.3f} | {np.mean(np.abs(sh - g.actual)):.3f} | {np.mean(g.exp - g.actual):+.2f} → {np.mean(sh - g.actual):+.2f} | {np.mean(g.exp[big] - g.actual[big]):+.2f} → {np.mean(sh[big] - g.actual[big]):+.2f} ({big.sum()}) |')

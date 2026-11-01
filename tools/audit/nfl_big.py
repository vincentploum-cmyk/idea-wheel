"""The big NFL games, mined (Vincent, 2026-11-01: "find out what the best cocktail is to predict super match ups by looking
for patterns in the box scores of players that reached these").

Every player-game of 2025 (weeks 4-18, the tuning season) and 2026 (weeks 1-7, the check) that the board projected, with
what was known that morning: his PropFinder logs before the game (volume, shares, red zone, air yards, explosiveness, his
own big games), his team's context (ESPN's spread and total, the team's own offense), the opponent's defense from the
same logs (what it allows to his position, season and last 3 / 5, the big games it has allowed, yards a carry, the long
plays), and the board's own read (projection, spread, matchup, its chance of the mark). Targets: 100+ / 150+ rushing (RB,
QB), 100+ / 150+ receiving (WR, TE, RB), 300+ / 350+ passing (QB).

Fitted on 2025, scored unchanged on 2026: the board's chance; the board recalibrated; logistic regressions on feature
groups; gradient-boosted trees on everything; and one- to three-condition rules mined on 2025 (beam search). Brier, log
loss, AUC, and the week's top 5 / top 10 said against landed.

  python3 tools/audit/nfl_big.py [--pf .nhl-data/audit/nfl-pf] [--raw .nhl-data/audit/nfl] [--board .nhl-data/audit/out/nfl-board-rows.json] [--out .nhl-data/audit/out]
"""
import argparse, glob, gzip, json, math, os, re, sys
from collections import defaultdict
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score, brier_score_loss, log_loss
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.inspection import permutation_importance

ap = argparse.ArgumentParser()
ap.add_argument('--pf', default='.nhl-data/audit/nfl-pf')
ap.add_argument('--raw', default='.nhl-data/audit/nfl')
ap.add_argument('--board', default='.nhl-data/audit/out/nfl-board-rows.json')
ap.add_argument('--out', default='.nhl-data/audit/out')
A = ap.parse_args()
SKILL = {'QB', 'RB', 'WR', 'TE'}

def load(p):
    if p.endswith('.gz'):
        with gzip.open(p, 'rt') as f: return json.load(f)
    with open(p) as f: return json.load(f)

# ESPN's games: id, UTC day, week, teams, the line.
games = {}
at = {}
for season in (2024, 2025, 2026):
    if not os.path.isdir(f'{A.raw}/{season}/games'): continue
    week_of = {}
    for f in glob.glob(f'{A.raw}/{season}/weeks/*.json'):
        j = load(f)
        for e in j.get('events', []): week_of[str(e['id'])] = (j.get('week') or {}).get('number') or int(os.path.basename(f)[1:3])
    for f in glob.glob(f'{A.raw}/{season}/games/*.json'):
        j = load(f)
        comp = (j.get('header') or {}).get('competitions', [{}])[0]
        cs = comp.get('competitors', [])
        if len(cs) != 2 or not (comp.get('status', {}).get('type', {}).get('completed')): continue
        home = next(c for c in cs if c.get('homeAway') == 'home'); away = next(c for c in cs if c.get('homeAway') == 'away')
        H = home['team']['abbreviation']; Aw = away['team']['abbreviation']
        pc = next((p for p in (j.get('pickcenter') or []) if p.get('overUnder') is not None and p.get('details')), None) or j.get('coreOdds') or None
        spread_team, spread_pts, total = None, None, None
        if pc:
            total = pc.get('overUnder')
            m = re.match(r'^([A-Z]{2,4})\s*([+-]?\d+(?:\.\d+)?)$', str(pc.get('details') or '').strip())
            if m: spread_team, spread_pts = m.group(1), abs(float(m.group(2)))
            elif re.match(r'^(even|pk)', str(pc.get('details') or ''), re.I): spread_pts = 0.0
        gid = str(j['header']['id']); date = comp.get('date')
        g = dict(id=gid, season=season, week=week_of.get(gid), date=date, day=date[:10], home=H, away=Aw, total=total, fav=spread_team, pts=spread_pts)
        games[gid] = g
        at[(g['day'], H)] = (g, Aw); at[(g['day'], Aw)] = (g, H)
print('espn games', len(games), file=sys.stderr)

# PropFinder's logs, the newest pull first.
players = {}
for f in sorted(glob.glob(f'{A.pf}/w[0-9][0-9].json')):
    for p in load(f)['pull']['data']['players']:
        if p.get('pos') not in SKILL or not p.get('games'): continue
        cur = players.setdefault(p['id'], dict(id=p['id'], key=p['key'], pos=p['pos'], team=p['team'], rows={}))
        cur.update(key=p['key'], pos=p['pos'], team=p['team'])
        periods = any(k.startswith('h1') for g in p['games'] for k in g)
        for g in p['games']: cur['rows'][(g['date'], g['opp'])] = g
NUM = ['passAtt', 'passCmp', 'passYds', 'passTd', 'passInt', 'rushAtt', 'rushYds', 'rushTd', 'rushLong', 'rec', 'recYds', 'recTd', 'recLong', 'tgt',
       'tgtShare', 'rushShare', 'rzTgt', 'rzAtt', 'airYds', 'yac', 'passLong']
logs = {}
for pid, p in players.items():
    out = []
    for (d, opp), g in p['rows'].items():
        r = {k: float(g.get(k) or 0) for k in NUM}
        r.update(date=d, opp=opp, season=g.get('season'), type=g.get('type'))
        hit = at.get((d, opp))
        if hit and g.get('type') == 'REG':
            gm, team = hit
            r.update(gid=gm['id'], team=team, week=gm['week'])
        out.append(r)
    out.sort(key=lambda r: r['date'])
    logs[pid] = out
print('players', len(logs), file=sys.stderr)

# Per game and team: what each position did (the opponent's side of it is what that defense allowed).
team_game = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))   # (gid, team) -> pos -> stat
for pid, rows in logs.items():
    pos = players[pid]['pos']
    for r in rows:
        if 'gid' not in r: continue
        tg = team_game[(r['gid'], r['team'])]
        for k in ('rushAtt', 'rushYds', 'recYds', 'rec', 'tgt', 'passYds', 'passAtt'): tg[pos][k] += r[k]; tg['ALL'][k] += r[k]
        if pos in ('RB', 'QB') and r['rushYds'] >= 100: tg[pos]['big_rush'] += 1; tg['ALL']['big_rush'] += 1
        if r['recYds'] >= 100: tg[pos]['big_rec'] += 1; tg['ALL']['big_rec'] += 1
        if pos == 'QB' and r['passYds'] >= 300: tg['QB']['big_pass'] += 1
        tg[pos]['long_rush'] = max(tg[pos]['long_rush'], r['rushLong']); tg[pos]['long_rec'] = max(tg[pos]['long_rec'], r['recLong'])
# The games each team played, in order.
team_games = defaultdict(list)
for g in games.values():
    for t, o in ((g['home'], g['away']), (g['away'], g['home'])): team_games[t].append((g['date'], g['id'], o, g['season']))
for t in team_games: team_games[t].sort()

def allowed(defense, season, before, pos, n=None):
    """What `defense` allowed to `pos` a game: its games this season before `before` (the last n with n)."""
    gs = [(d, gid, o) for d, gid, o, s in team_games[defense] if s == season and d < before]
    if n: gs = gs[-n:]
    if not gs: return None
    agg = defaultdict(float)
    for d, gid, o in gs:
        for k, v in team_game[(gid, o)][pos].items():
            agg[k] += v if not k.startswith('long') else 0
            if k.startswith('long'): agg[k] += v
    return {k: v / len(gs) for k, v in agg.items()} | {'gp': len(gs)}

def own_team(team, season, before, n=None):
    gs = [(d, gid) for d, gid, o, s in team_games[team] if s == season and d < before]
    if n: gs = gs[-n:]
    if not gs: return None
    agg = defaultdict(float)
    for d, gid in gs:
        for k, v in team_game[(gid, team)]['ALL'].items(): agg[k] += v
    return {k: v / len(gs) for k, v in agg.items()} | {'gp': len(gs)}

def mean(xs): return float(np.mean(xs)) if len(xs) else np.nan

# The board's reads (tools/audit/nfl-pf-audit.mjs --dump) and its chance of a mark (lib/nfl/projections.js RESID).
RESID = {
    'rec_yds': [-1.413, -1.174, -1.052, -0.947, -0.834, -0.729, -0.633, -0.53, -0.426, -0.312, -0.184, -0.039, 0.1, 0.284, 0.484, 0.735, 1.051, 1.446, 2.149],
    'rush_yds': [-1.535, -1.234, -0.996, -0.866, -0.75, -0.648, -0.552, -0.424, -0.312, -0.208, -0.093, 0.066, 0.221, 0.371, 0.56, 0.829, 1.164, 1.63, 2.325],
    'pass_yds': [-1.895, -1.397, -1.136, -0.902, -0.729, -0.539, -0.428, -0.264, -0.101, 0.034, 0.145, 0.22, 0.421, 0.532, 0.645, 0.816, 1.004, 1.242, 1.731],
}
def resid_cdf(q, z):
    if z <= q[0]: return max(0.01, 0.05 - 0.05 * (q[0] - z) / max(1e-6, q[1] - q[0]))
    if z >= q[18]: return min(0.99, 0.95 + 0.05 * (z - q[18]) / max(1e-6, q[18] - q[17]))
    for i in range(18):
        if z <= q[i + 1]: return 0.05 * (i + 1) + 0.05 * (z - q[i]) / max(1e-6, q[i + 1] - q[i])
    return 0.95
def board_chance(m, proj, sd, mark):
    if proj is None or not sd or sd <= 0: return np.nan
    return 1 - resid_cdf(RESID[m], (mark - 0.5 - proj) / sd)

board = load(A.board)
by_key = defaultdict(dict)
for b in board:
    s, w = b['tag'].split('w'); by_key[(int(s), int(w), b['key'], b['team'])][b['m']] = b
key_pid = {}
for pid, p in players.items(): key_pid.setdefault(p['key'], []).append(pid)

TARGETS = [('rush_yds', 'rushYds', 100, {'RB', 'QB'}), ('rush_yds', 'rushYds', 150, {'RB', 'QB'}), ('rec_yds', 'recYds', 100, {'WR', 'TE', 'RB'}),
           ('rec_yds', 'recYds', 150, {'WR', 'TE', 'RB'}), ('pass_yds', 'passYds', 300, {'QB'}), ('pass_yds', 'passYds', 350, {'QB'})]

# One row a player-game the board projected.
recs = []
for (season, week, key, team), mk in by_key.items():
    pid = next((p for p in key_pid.get(key, []) if any(r.get('season') == season and r.get('week') == week and r.get('team') == team for r in logs[p])), None)
    if not pid: continue
    rows = logs[pid]
    now = next(r for r in rows if r.get('season') == season and r.get('week') == week and r.get('team') == team)
    gm = games[now['gid']]; opp = now['opp']; day = now['date']; before = gm['date']
    prior = [r for r in rows if r['date'] < day]
    if not prior: continue
    seas = [r for r in prior if r.get('season') == season and r.get('type') == 'REG']
    pos = players[pid]['pos']
    f = dict(season=season, week=week, key=key, team=team, opp=opp, pos=pos, gid=gm['id'], n_prior=len(prior), n_season=len(seas))
    for k in ('rushAtt', 'rushYds', 'tgt', 'rec', 'recYds', 'passAtt', 'passYds', 'airYds', 'rzAtt', 'rzTgt', 'tgtShare', 'rushShare', 'yac', 'rushLong', 'recLong'):
        f[f'{k}_l3'] = mean([r[k] for r in prior[-3:]]); f[f'{k}_l5'] = mean([r[k] for r in prior[-5:]])
        f[f'{k}_s'] = mean([r[k] for r in seas]) if seas else f[f'{k}_l5']
        f[f'{k}_l17'] = mean([r[k] for r in prior[-17:]])
    for k, marks in (('rushYds', (100, 150)), ('recYds', (100, 150)), ('passYds', (300, 350))):
        last = [r[k] for r in prior[-17:]]
        f[f'{k}_max10'] = max([r[k] for r in prior[-10:]])
        f[f'{k}_p90'] = float(np.percentile(last, 90)); f[f'{k}_sd'] = float(np.std(last))
        for mk_ in marks: f[f'{k}_big{mk_}_17'] = sum(1 for v in last if v >= mk_) / len(last); f[f'{k}_big{mk_}_n'] = sum(1 for v in last if v >= mk_)
    # His share of the team's carries and targets in the games he played lately.
    sh_r, sh_t = [], []
    for r in prior[-5:]:
        if 'gid' not in r: continue
        tg = team_game[(r['gid'], r['team'])]['ALL']
        if tg['rushAtt']: sh_r.append(r['rushAtt'] / tg['rushAtt'])
        if tg['tgt']: sh_t.append(r['tgt'] / tg['tgt'])
    f['carry_share_l5'] = mean(sh_r); f['tgt_share_l5'] = mean(sh_t)
    # The game: home, the spread for his team (+ = favoured), the total, his team's implied points.
    f['home'] = 1.0 if gm['home'] == team else 0.0
    sign = 0.0 if gm['pts'] is None else (gm['pts'] if gm['fav'] == team else -gm['pts'] if gm['fav'] else 0.0)
    f['fav_by'] = sign if gm['pts'] is not None else np.nan
    f['total'] = float(gm['total']) if gm['total'] is not None else np.nan
    f['implied'] = f['total'] / 2 + sign / 2 if gm['total'] is not None else np.nan
    # His team's own offense, the opponent's defense at his position and in all.
    ot = own_team(team, season, before)
    f['team_rush_pg'] = ot['rushYds'] if ot else np.nan; f['team_pass_pg'] = ot['passYds'] if ot else np.nan
    for lbl, n in (('s', None), ('l3', 3), ('l5', 5)):
        al = allowed(opp, season, before, pos, n); aa = allowed(opp, season, before, 'ALL', n)
        f[f'opp_rushYds_{lbl}'] = al['rushYds'] if al else np.nan
        f[f'opp_recYds_{lbl}'] = al['recYds'] if al else np.nan
        f[f'opp_passYds_{lbl}'] = al['passYds'] if al else np.nan
        f[f'opp_ypc_{lbl}'] = (al['rushYds'] / al['rushAtt']) if al and al.get('rushAtt') else np.nan
        f[f'opp_all_rush_{lbl}'] = aa['rushYds'] if aa else np.nan; f[f'opp_all_rec_{lbl}'] = aa['recYds'] if aa else np.nan
        f[f'opp_big_rush_{lbl}'] = aa['big_rush'] if aa and 'big_rush' in aa else (0.0 if aa else np.nan)
        f[f'opp_big_rec_{lbl}'] = aa['big_rec'] if aa and 'big_rec' in aa else (0.0 if aa else np.nan)
        f[f'opp_big_rec_pos_{lbl}'] = al['big_rec'] if al and 'big_rec' in al else (0.0 if al else np.nan)
        f[f'opp_long_rush_{lbl}'] = al['long_rush'] if al and 'long_rush' in al else np.nan
    f['opp_gp'] = (allowed(opp, season, before, 'ALL') or {}).get('gp', 0)
    for m in ('rush_yds', 'rec_yds', 'pass_yds'):
        b = mk.get(m)
        f[f'b_{m}_proj'] = b['proj'] if b else np.nan; f[f'b_{m}_sd'] = b['sd'] if b else np.nan; f[f'b_{m}_mu'] = (b.get('matchup') or 1.0) if b else np.nan
    for m, stat, mark, poss in TARGETS:
        b = mk.get(m)
        f[f'b_p_{stat}{mark}'] = board_chance(m, b['proj'], b['sd'], mark) if b else np.nan
        f[f'y_{stat}{mark}'] = 1.0 if now[stat] >= mark else 0.0
    f['act_rushYds'] = now['rushYds']; f['act_recYds'] = now['recYds']; f['act_passYds'] = now['passYds']
    recs.append(f)
df = pd.DataFrame(recs)
print('rows', len(df), df.groupby('season').size().to_dict(), file=sys.stderr)
os.makedirs(A.out, exist_ok=True)
df.to_csv(f'{A.out}/nfl-big-rows.csv', index=False)

# ── The models ───────────────────────────────────────────────────────────────────────────────────────
# Two checks, each fitted on the seasons before it: 2024 (weeks 6-18) → 2025 (weeks 4-18), and 2024 + 2025 → 2026 (weeks 1-7).
FOLDS = [
    ('2024 → 2025', lambda d: (d.season == 2024) & (d.week >= 6), lambda d: (d.season == 2025) & (d.week >= 4)),
    ('2024-25 → 2026', lambda d: ((d.season == 2024) & (d.week >= 6)) | ((d.season == 2025) & (d.week >= 4)), lambda d: (d.season == 2026) & (d.week <= 7)),
]
GROUPS = {
    'volume': lambda st: [c for c in df.columns if re.match(r'^(rushAtt|tgt|rec|passAtt|rzAtt|rzTgt|tgtShare|rushShare|airYds)_', c)] + ['carry_share_l5', 'tgt_share_l5'],
    'production': lambda st: [c for c in df.columns if re.match(rf'^{st}_(l3|l5|s|l17)$', c)],
    'explosive': lambda st: [c for c in df.columns if re.match(rf'^{st}_(max10|p90|sd|big\d+_17|big\d+_n)$', c)] + [c for c in df.columns if re.match(r'^(rushLong|recLong|yac)_', c)],
    'game': lambda st: ['home', 'fav_by', 'total', 'implied', 'team_rush_pg', 'team_pass_pg'],
    'defense': lambda st: [c for c in df.columns if c.startswith('opp_')],
}
def topk(d, p, y, k):
    out = []
    for (s_, w), g in d.assign(_p=p, _y=y).groupby(['season', 'week']):
        out.append(g.sort_values('_p', ascending=False).head(k))
    t = pd.concat(out)
    return dict(n=len(t), said=round(float(t._p.mean()), 3), landed=round(float(t._y.mean()), 3))
def score(d, p, y):
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return dict(n=len(y), base=round(float(y.mean()), 4), brier=round(brier_score_loss(y, p), 5), logloss=round(log_loss(y, p, labels=[0, 1]), 5),
                auc=round(roc_auc_score(y, p), 4) if 0 < y.sum() < len(y) else None, said=round(float(p.mean()), 4), top5=topk(d, p, y, 5), top10=topk(d, p, y, 10))
def logit(p): p = np.clip(p, 1e-4, 1 - 1e-4); return np.log(p / (1 - p))
def pop(m, poss):
    d = df[df.pos.isin(poss) & df[f'b_{m}_proj'].notna()]
    return d[d[f'b_{m}_proj'] >= (100 if m == 'pass_yds' else 15)]

report = {}
for m, stat, mark, poss in TARGETS:
    name = f'{stat}{mark}'
    d = pop(m, poss); bp = f'b_p_{name}'; yc = f'y_{name}'
    report[name] = {}
    for fold, ftr, fte in FOLDS:
        tr, te = d[ftr(d)], d[fte(d)]
        y_tr, y_te = tr[yc].values, te[yc].values
        res = {'train_n': len(tr), 'train_rate': round(float(y_tr.mean()), 4), 'test_n': len(te), 'test_rate': round(float(y_te.mean()), 4), 'models': {}}
        res['models']['board'] = score(te, te[bp].values, y_te)
        lr = LogisticRegression(C=1e6, max_iter=1000).fit(logit(tr[bp].values).reshape(-1, 1), y_tr)
        res['models']['board_cal'] = score(te, lr.predict_proba(logit(te[bp].values).reshape(-1, 1))[:, 1], y_te)
        res['board_cal'] = dict(a=round(float(lr.intercept_[0]), 4), b=round(float(lr.coef_[0][0]), 4))
        feats_all = []
        for g, fn in GROUPS.items():
            cols = [c for c in fn(stat) if c in d.columns]
            feats_all += cols
            med = tr[cols].median()
            Xtr = np.column_stack([logit(tr[bp].values), tr[cols].fillna(med).values]); Xte = np.column_stack([logit(te[bp].values), te[cols].fillna(med).values])
            pipe = make_pipeline(StandardScaler(), LogisticRegression(C=0.05, max_iter=3000)).fit(Xtr, y_tr)
            res['models'][f'board+{g}'] = score(te, pipe.predict_proba(Xte)[:, 1], y_te)
        feats_all = list(dict.fromkeys(feats_all)); med = tr[feats_all].median()
        Xtr = np.column_stack([logit(tr[bp].values), tr[feats_all].fillna(med).values]); Xte = np.column_stack([logit(te[bp].values), te[feats_all].fillna(med).values])
        for C in (0.005, 0.02, 0.1):
            pipe = make_pipeline(StandardScaler(), LogisticRegression(C=C, max_iter=5000)).fit(Xtr, y_tr)
            res['models'][f'board+all (logistic C={C})'] = score(te, pipe.predict_proba(Xte)[:, 1], y_te)
            if C == 0.02: res['logistic_top'] = sorted([(n_, round(float(c), 3)) for n_, c in zip(['board'] + feats_all, pipe[-1].coef_[0])], key=lambda x: -abs(x[1]))[:15]
        gb = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.04, max_iter=300, min_samples_leaf=60, l2_regularization=2.0, random_state=0).fit(Xtr, y_tr)
        res['models']['board+all (trees)'] = score(te, gb.predict_proba(Xte)[:, 1], y_te)
        pi = permutation_importance(gb, Xte, y_te, scoring='neg_brier_score', n_repeats=5, random_state=0)
        res['trees_top'] = sorted([(n_, round(float(v) * 1e4, 2)) for n_, v in zip(['board'] + feats_all, pi.importances_mean)], key=lambda x: -x[1])[:12]
        report[name][fold] = res
        print(name, fold, json.dumps({k: (v['brier'], v['auc'], v['top5']['said'], v['top5']['landed']) for k, v in res['models'].items()}), file=sys.stderr)

# ── The rules: one to three conditions mined on 2024, scored on 2025 and 2026 apart ──────────────────
def mine(d, y, cols, min_sup=30, beam=40, depth=3):
    conds = []
    for c in cols:
        v = d[c].dropna()
        if v.nunique() < 4: continue
        for q in (0.5, 0.67, 0.8, 0.9): conds.append((c, '>=', float(v.quantile(q))))
        for q in (0.2, 0.33): conds.append((c, '<=', float(v.quantile(q))))
    def mask(rule, dd):
        mm = np.ones(len(dd), bool)
        for c, op, t in rule:
            x = dd[c].values.astype(float)
            mm &= ((x >= t) if op == '>=' else (x <= t)) & ~np.isnan(x)
        return mm
    best = []; level = [()]
    for _ in range(depth):
        cand = []
        for r in level:
            used = {c for c, _, _ in r}
            for cd in conds:
                if cd[0] in used: continue
                rr = tuple(sorted(r + (cd,)))
                mm = mask(rr, d); n = int(mm.sum())
                if n < min_sup: continue
                rate = float(y[mm].mean()); z = 1.64
                lb = (rate + z * z / (2 * n) - z * math.sqrt(rate * (1 - rate) / n + z * z / (4 * n * n))) / (1 + z * z / n)
                cand.append((lb, rate, n, rr))
        cand = sorted({c[3]: c for c in cand}.values(), key=lambda c: -c[0])[:beam]
        best += cand; level = [c[3] for c in cand]
    return sorted({c[3]: c for c in best}.values(), key=lambda c: -c[0])[:12], mask
rules_report = {}
for m, stat, mark, poss in TARGETS:
    name = f'{stat}{mark}'
    d = pop(m, poss); yc = f'y_{name}'; bp = f'b_p_{name}'
    tr = d[(d.season == 2024) & (d.week >= 6)]
    checks = {'2025': d[(d.season == 2025) & (d.week >= 4)], '2026': d[(d.season == 2026) & (d.week <= 7)]}
    cols = list(dict.fromkeys(sum([fn(stat) for fn in GROUPS.values()], []) + [bp, f'b_{m}_proj', f'b_{m}_mu']))
    cols = [c for c in cols if c in d.columns]
    best, mask = mine(tr, tr[yc].values, cols)
    out = []
    for lb, rate, n, rule in best:
        o = dict(rule=[f'{c} {op} {round(t, 3)}' for c, op, t in rule], fit2024=dict(n=n, rate=round(rate, 3)))
        for k, te in checks.items():
            mm = mask(rule, te); nt = int(mm.sum())
            o[k] = dict(n=nt, rate=round(float(te[yc].values[mm].mean()), 3) if nt else None, board_said=round(float(te[bp].values[mm].mean()), 3) if nt else None)
        out.append(o)
    rules_report[name] = dict(base={k: round(float(v[yc].mean()), 3) for k, v in [('2024', tr)] + list(checks.items())}, rules=out)
    print(name, 'rules', json.dumps(out[:4]), file=sys.stderr)

with open(f'{A.out}/nfl-big.json', 'w') as f: json.dump(dict(models=report, rules=rules_report), f, indent=1)
print('done', file=sys.stderr)

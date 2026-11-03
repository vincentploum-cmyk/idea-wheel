# The two-engine NFL spec, tested (docs/audits/2026-11-03-nfl-engines.md; Vincent, 2026-11-03, a spec to implement:
# "TD plays and yardage plays are two separate models" — Engine 1 the yards, proj = volume × matchup × efficiency × game
# script, a "max ladder" gate for volume monsters, two receiving and two rushing ladders a card; Engine 2 the touchdowns,
# red-zone opportunity × the team's implied total, six a card; an outlier rule for a top-decile red-zone player left off).
# Every piece scored case by case on 2026's weeks 1–7 against the board as shipped (the replay's dump: nfl-pf-audit.mjs
# --dump writes the yards and, since this study, the touchdown reads), fitted on 2025's weeks 4–18 where a piece has a
# weight. PropFinder's logs carry red-zone carries (`rzAtt`) and targets (`rzTgt`) for 2024–2026; no inside-5 split, no
# cornerback or offensive-line rank: the matchup is what the defense gives up at his position.
#
#   node --import ./tools/audit/register.mjs tools/audit/nfl-pf-audit.mjs --pf .nhl-data/audit/nfl-pf --raw .nhl-data/audit/nfl --dump
#   python3 -I tools/audit/nfl_engines.py [--audit .nhl-data/audit] [--dump <dir with nfl-board-rows.json, nfl-board-tds.json>] [--json out.json]
import json, gzip, glob, re, sys, math, collections as C
import numpy as np

arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
ROOT = arg('--audit', '.nhl-data/audit'); DUMP = arg('--dump', f'{ROOT}/out'); OUT = arg('--json')
mean = lambda xs: sum(xs) / len(xs) if xs else None
num = lambda v: float(v) if isinstance(v, (int, float)) else 0.0

# --- ESPN: every final game, its week, its line
games = {}; opp_of = {}
for season in (2024, 2025, 2026):
    wk = {}
    for f in glob.glob(f'{ROOT}/nfl/{season}/weeks/*.json'):
        j = json.load(open(f))
        for e in j.get('events', []): wk[str(e['id'])] = j.get('week', {}).get('number')
    for f in glob.glob(f'{ROOT}/nfl/{season}/games/*.json'):
        j = json.load(open(f)); c = j['header']['competitions'][0]
        if c['status']['type']['name'] != 'STATUS_FINAL': continue
        t = {x['homeAway']: x['team']['abbreviation'] for x in c['competitors']}
        gid = str(j['header']['id']); date = c['date']; w = wk.get(gid)
        if w is None and season == 2026 and date >= '2026-10-29': w = 8
        pc = next((p for p in j.get('pickcenter', []) if p.get('overUnder') and p.get('details')), None) or j.get('coreOdds')
        total = fav_home = None
        if pc and pc.get('overUnder') and pc.get('details'):
            total = float(pc['overUnder']); m = re.match(r'([A-Z]+)\s*([-+]?\d+(\.\d+)?)', pc['details'])
            fav_home = (abs(float(m.group(2))) / 2 * (1 if m.group(1) == t['home'] else -1)) if m else 0.0
        games[gid] = dict(id=gid, season=season, week=w, date=date, day=date[:10], home=t['home'], away=t['away'], total=total, fav_home=fav_home)
        opp_of[(date[:10], t['home'])] = (t['away'], gid); opp_of[(date[:10], t['away'])] = (t['home'], gid)
print('ESPN games', C.Counter(g['season'] for g in games.values()), file=sys.stderr)

# --- PropFinder: every skill player's rows, placed on their ESPN game (his team = the opponent's opponent that day)
STATS = ['passYds', 'passAtt', 'passTd', 'rushYds', 'rushAtt', 'rushTd', 'rec', 'recYds', 'recTd', 'tgt', 'rzAtt', 'rzTgt']
pl = {}
for f in sorted(glob.glob(f'{ROOT}/nfl-pf/w*.json.gz')):
    d = json.load(gzip.open(f))
    for p in d['pull']['data']['players']:
        if p['pos'] not in ('QB', 'RB', 'WR', 'TE'): continue
        q = pl.setdefault(p['id'], {'id': p['id'], 'key': p['key'], 'pos': p['pos'], 'rows': {}}); q['pos'] = p['pos']
        for g in p.get('games', []): q['rows'][(g['date'], g['opp'])] = g
rows = []
for q in pl.values():
    for (date, opp), g in q['rows'].items():
        if g.get('type') != 'REG': continue
        r = {k: num(g.get(k)) for k in STATS}
        r.update(pid=q['id'], key=q['key'], pos=q['pos'], date=date, opp=opp, season=g.get('season'))
        r['td'] = r['rushTd'] + r['recTd'] + num(g.get('retTd'))
        r['active'] = (r['rushAtt'] + r['tgt'] + r['passAtt'] + r['rec']) > 0
        r['team'] = None; r['gid'] = None
        # the opponent `opp` played someone that day; that someone is his team
        o = opp_of.get((date, opp))
        if o: r['team'], r['gid'] = o[0], o[1]
        rows.append(r)
by_pid = C.defaultdict(list)
for r in rows: by_pid[r['pid']].append(r)
for k in by_pid: by_pid[k].sort(key=lambda r: r['date'], reverse=True)
placed = [r for r in rows if r['gid']]
print('PropFinder rows', len(rows), 'placed', len(placed), file=sys.stderr)


# --- team-games: the pulled players' rows on a side; targets, carries and red-zone looks a game
TG = C.defaultdict(dict)
for r in placed: TG[(r['gid'], r['team'])][r['pid']] = r
tot = {k: {'tgt': sum(x['tgt'] for x in v.values()), 'car': sum(x['rushAtt'] for x in v.values() if x['pos'] != 'QB'),
           'rz': sum(x['rzAtt'] + x['rzTgt'] for x in v.values())} for k, v in TG.items()}
def share(x, k):
    t = tot.get((x['gid'], x['team']))
    if not t: return None
    if k == 'tgt': return x['tgt'] / t['tgt'] if t['tgt'] >= 15 else None
    if k == 'car': return x['rushAtt'] / t['car'] if t['car'] >= 10 else None
    if k == 'rz': return (x['rzAtt'] + x['rzTgt']) / t['rz'] if t['rz'] >= 3 else None
team_days = C.defaultdict(set)
for g in games.values(): team_days[(g['season'], g['home'])].add(g['day']); team_days[(g['season'], g['away'])].add(g['day'])
allowed = C.defaultdict(list); acc = C.defaultdict(lambda: C.defaultdict(float))
for r in placed:
    k = (r['season'], r['opp'], r['pos'], r['date'])
    for st in ('recYds', 'rushYds'): acc[k][st] += r[st]
    acc[k]['td'] += r['td']
for (s, d, pos, day), v in acc.items(): allowed[(s, d, pos)].append((day, v))
def defense(season, d, pos, day, st):
    xs = [v[st] for dd, v in allowed[(season, d, pos)] if dd < day]
    return (mean(xs), len(xs))
LG = {}
def league(season, pos, day, st):
    k = (season, pos, day, st)
    if k not in LG:
        vals = [defense(season, d, pos, day, st)[0] for (s, d, p) in list(allowed) if s == season and p == pos]
        LG[k] = mean([v for v in vals if v is not None])
    return LG[k]

board = {}; board_td = {}
for x in json.load(open(f'{DUMP}/nfl-board-rows.json')): board[(x['tag'], x['key'], x['team'], x['m'])] = x
for x in json.load(open(f'{DUMP}/nfl-board-tds.json')): board_td[(x['tag'], x['key'], x['team'])] = x
POS_YPT, POS_YPC = {}, {}
for pos in ('WR', 'TE', 'RB'):
    xs = [r for r in placed if r['pos'] == pos and r['season'] == 2024]
    POS_YPT[pos] = sum(r['recYds'] for r in xs) / max(1, sum(r['tgt'] for r in xs)); POS_YPC[pos] = sum(r['rushYds'] for r in xs) / max(1, sum(r['rushAtt'] for r in xs))

data = []
for r in placed:
    if r['pos'] not in ('WR', 'TE', 'RB') or not r['active']: continue
    g = games[r['gid']]
    if not ((g['season'] == 2025 and g['week'] and 4 <= g['week'] <= 18) or (g['season'] == 2026 and g['week'] and g['week'] <= 7)): continue
    own = [x for x in by_pid[r['pid']] if x['date'] < r['date'] and x['active']]
    if len(own) < 3: continue
    cur = [x for x in own if x['season'] == g['season']]
    tag = f"{g['season']}w{g['week']}"
    f = dict(tag=tag, season=g['season'], week=g['week'], pos=r['pos'], key=r['key'], team=r['team'], opp=r['opp'],
             recYds=r['recYds'], rushYds=r['rushYds'], tgt=r['tgt'], car=r['rushAtt'], td=1 if r['td'] > 0 else 0)
    for st, nm in (('tgt', 'tgt'), ('rushAtt', 'car'), ('recYds', 'rec'), ('rushYds', 'rush'), ('td', 'tdn')):
        f[f'{nm}3'] = mean([x[st] for x in own[:3]]); f[f'{nm}5'] = mean([x[st] for x in own[:5]]); f[f'{nm}17'] = mean([x[st] for x in own[:17]])
        f[f'{nm}s'] = mean([x[st] for x in cur]) if cur else f[f'{nm}17']
    for k in ('tgt', 'car', 'rz'):
        shs = [v for v in (share(x, k) for x in own if x['gid']) if v is not None]
        f[f'sh_{k}3'] = mean(shs[:3]); f[f'sh_{k}5'] = mean(shs[:5]); f[f'sh_{k}min3'] = min(shs[:3]) if len(shs) >= 3 else None
        shc = [v for v in (share(x, k) for x in cur if x['gid']) if v is not None]; f[f'sh_{k}s'] = mean(shc) if shc else f[f'sh_{k}5']
    f['rz5'] = mean([x['rzAtt'] + x['rzTgt'] for x in own[:5]]); f['rzs'] = mean([x['rzAtt'] + x['rzTgt'] for x in cur]) if cur else f['rz5']
    t17 = sum(x['tgt'] for x in own[:17]); c17 = sum(x['rushAtt'] for x in own[:17])
    f['ypt'] = (sum(x['recYds'] for x in own[:17]) + 40 * POS_YPT[r['pos']]) / (t17 + 40)
    f['ypc'] = (sum(x['rushYds'] for x in own[:17]) + 60 * POS_YPC[r['pos']]) / (c17 + 60)
    for st, nm in (('recYds', 'rec'), ('rushYds', 'rush'), ('td', 'td')):
        a, gp = defense(g['season'], r['opp'], r['pos'], r['date'], st); lg = league(g['season'], r['pos'], r['date'], st)
        f[f'def_{nm}'] = ((a / lg - 1) * gp / (gp + 8)) if a is not None and lg and gp >= 3 else 0.0
    fav = 0.0
    if g['fav_home'] is not None: fav = g['fav_home'] if r['team'] == g['home'] else -g['fav_home']
    f['fav'] = fav; f['total'] = g['total'] if g['total'] else 44.5; f['implied'] = f['total'] / 2 + fav
    for m in ('rec_yds', 'rush_yds'):
        b = board.get((tag, r['key'], r['team'], m)); f[f'b_{m}'] = b['proj'] if b else None; f[f'sd_{m}'] = b['sd'] if b else None
    bt = board_td.get((tag, r['key'], r['team'])); f['b_td'] = bt['p'] if bt else None
    data.append(f)
nz = lambda v, d: v if v is not None else d
print('player-games', C.Counter(x['season'] for x in data), file=sys.stderr)
report = {}
def boot(d, B=3000, seed=1):
    rng = np.random.default_rng(seed); n = len(d); bs = [d[rng.integers(0, n, n)].mean() for _ in range(B)]
    return float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))
def cases(pred, y, tol=(10, 20, 30)):
    e = np.abs(y - pred); return dict(close=float(np.mean(e <= tol[0])), near=float(np.mean(e <= tol[1])), way_off=float(np.mean(e > tol[2])), median=float(np.median(e)))
fmt = lambda c: f"close (±10) {c['close']*100:4.1f}% · near (±20) {c['near']*100:4.1f}% · way off (>30) {c['way_off']*100:4.1f}% · median {c['median']:5.1f}"

# ================= Engine 1: the yards =================
RESID = {'rec_yds': [-1.413, -1.174, -1.052, -0.947, -0.834, -0.729, -0.633, -0.53, -0.426, -0.312, -0.184, -0.039, 0.1, 0.284, 0.484, 0.735, 1.051, 1.446, 2.149],
         'rush_yds': [-1.535, -1.234, -0.996, -0.866, -0.75, -0.648, -0.552, -0.424, -0.312, -0.208, -0.093, 0.066, 0.221, 0.371, 0.56, 0.829, 1.164, 1.63, 2.325]}
def cdf(q, z):
    if z <= q[0]: return max(0.01, 0.05 - 0.05 * (q[0] - z) / max(1e-6, q[1] - q[0]))
    if z >= q[18]: return min(0.99, 0.95 + 0.05 * (z - q[18]) / max(1e-6, q[18] - q[17]))
    for i in range(18):
        if z <= q[i + 1]: return 0.05 * (i + 1) + 0.05 * (z - q[i]) / max(1e-6, q[i + 1] - q[i])
def tiers(proj, sd, m):
    """The board's strong / lean / thin rungs (lib/nfl/projections.js ladderTiers)."""
    if proj is None or not sd: return {}
    step = 5 if proj < 40 else 10
    marks = [(mk, 1 - cdf(RESID[m], (mk - 0.5 - proj) / sd)) for mk in range(step, int(proj + 3 * sd) + 1, step)]
    out = {}; used = set()
    for t, at in (('strong', .6), ('lean', .45), ('thin', .3)):
        b = [x for x in marks if x[1] >= at]
        if b and b[-1][0] not in used: out[t] = b[-1]
        if b: used.add(b[-1][0])
    return out

def engine1(x, m, wm=0.6, ws=0.0, vw=(0.4, 0.35, 0.25)):
    """The spec's proj = volume × matchup × efficiency × script: volume L3 / L5 / season by `vw`, matchup 1 + wm × the
    defense's damped ratio, efficiency his yards a target / a carry, script ∓ ws a point of half spread (receivers up when
    trailing, backs up when leading)."""
    if m == 'rec_yds':
        vol = vw[0] * x['tgt3'] + vw[1] * x['tgt5'] + vw[2] * x['tgts']; eff = x['ypt']; mm = 1 + wm * x['def_rec']; sc = 1 - ws * x['fav']
    else:
        vol = vw[0] * x['car3'] + vw[1] * x['car5'] + vw[2] * x['cars']; eff = x['ypc']; mm = 1 + wm * x['def_rush']; sc = 1 + ws * x['fav']
    return max(0.0, vol * eff * mm * sc)

for m, ystat, keep in (('rec_yds', 'recYds', lambda x: x['rec17'] >= 10), ('rush_yds', 'rushYds', lambda x: x['pos'] == 'RB' and x['rush17'] >= 10)):
    rows = [x for x in data if keep(x) and x[f'b_{m}'] is not None]
    tune = [x for x in rows if x['season'] == 2025]; chk = [x for x in rows if x['season'] == 2026]
    yt = np.array([x[ystat] for x in tune]); yc = np.array([x[ystat] for x in chk])
    print(f"\n=== Engine 1, {m}: fit {len(tune)}, check {len(chk)}")
    out = {}
    bb = np.array([x[f'b_{m}'] for x in chk]); out['board'] = cases(bb, yc); print(f"  {'the board as shipped':54s} {fmt(out['board'])}")
    # the spec's weights searched on 2025 (close rate), then scored on 2026
    best = None
    for wm in (0, 0.3, 0.6, 1.0):
        for ws in (0, 0.01, 0.02, 0.04):
            for vw in ((0.4, 0.35, 0.25), (0.5, 0.5, 0), (0, 1, 0), (0.2, 0.3, 0.5)):
                c = cases(np.array([engine1(x, m, wm, ws, vw) for x in tune]), yt)['close']
                if best is None or c > best[0]: best = (c, wm, ws, vw)
    for nm, (wm, ws, vw) in (('spec as written (matchup 0.6, script 0.02, L3/L5/season .4/.35/.25)', (0.6, 0.02, (0.4, 0.35, 0.25))),
                             ('volume × efficiency alone (no matchup, no script)', (0, 0, (0.4, 0.35, 0.25))),
                             (f'spec, weights searched on 2025 (matchup {best[1]}, script {best[2]}, {best[3]})', (best[1], best[2], best[3]))):
        p = np.array([engine1(x, m, wm, ws, vw) for x in chk]); c = cases(p, yc)
        d = (np.abs(yc - p) <= 10).astype(float) - (np.abs(yc - bb) <= 10).astype(float); lo, hi = boot(d)
        c['close_vs_board'] = [float(d.mean()), lo, hi]; out[nm] = c
        print(f"  {nm:54s} {fmt(c)}  close vs board {d.mean()*100:+.1f} [{lo*100:+.1f}, {hi*100:+.1f}]")
    report[f'engine1 {m}'] = out

    # --- the max-ladder gate: do "volume monsters" land their rungs more than the rest?
    if m == 'rec_yds':
        gate = lambda x: x['tgt5'] >= 8 and nz(x['sh_tgt5'], 0) >= 0.22 and (x['sh_tgtmin3'] or 0) >= 0.15
        gname = 'volume monster: 8+ targets over his last 5, 22%+ of the team\'s, 15%+ in each of his last 3'
    else:
        gate = lambda x: nz(x['sh_car3'], 0) >= 0.6 and x['def_rush'] > 0.03 and x['fav'] > 0
        gname = 'bellcow: 60%+ of the carries over his last 3 + a weak run defense + favoured'
    print(f"  the max-ladder gate — {gname}")
    rec = {}
    for lab, grp in (('gated', [x for x in chk if gate(x)]), ('not gated', [x for x in chk if not gate(x)])):
        res = {}
        for t in ('strong', 'lean', 'thin'):
            hs = [(tt[t][1], x[ystat] >= tt[t][0]) for x in grp for tt in [tiers(x[f'b_{m}'], x[f'sd_{m}'], m)] if t in tt]
            res[t] = (len(hs), float(np.mean([a for a, _ in hs])) if hs else None, float(np.mean([h for _, h in hs])) if hs else None)
        rec[lab] = {'n': len(grp), **res}
        print(f"    {lab:10s} ({len(grp):4d}) " + ' · '.join(f"{t} said {res[t][1]*100:4.1f}% landed {res[t][2]*100:4.1f}% ({res[t][0]})" for t in res if res[t][0]))
    report[f'gate {m}'] = rec

    # --- the card: two ladders a week, picked by the board's projection, by the engine, by the gate + the projection
    print(f"  the card: 2 {m} ladders a week (their rungs, said → landed)")
    card = {}
    for nm, key, flt in (('top 2 by the board\'s projection', lambda x: x[f'b_{m}'], lambda x: True),
                         ('top 2 by volume', lambda x: x['tgt5'] if m == 'rec_yds' else x['car5'], lambda x: True),
                         ('top 2 gated, by the board\'s projection', lambda x: x[f'b_{m}'], gate)):
        picks = []
        for t in sorted(set(x['tag'] for x in chk)):
            picks += sorted([x for x in chk if x['tag'] == t and flt(x)], key=lambda x: -key(x))[:2]
        res = {}
        for t in ('strong', 'lean', 'thin'):
            hs = [(tt[t][1], x[ystat] >= tt[t][0]) for x in picks for tt in [tiers(x[f'b_{m}'], x[f'sd_{m}'], m)] if t in tt]
            res[t] = (len(hs), float(np.mean([a for a, _ in hs])) if hs else None, float(np.mean([h for _, h in hs])) if hs else None)
        card[nm] = {'n': len(picks), **res}
        print(f"    {nm:42s} ({len(picks):2d}) " + ' · '.join(f"{t} {res[t][1]*100:4.1f}% → {res[t][2]*100:4.1f}%" for t in res if res[t][0]))
    report[f'card {m}'] = card

# ================= Engine 2: the touchdowns =================
rows = [x for x in data if x['b_td'] is not None and (x['tgt17'] + x['car17']) >= 3]
tune = [x for x in rows if x['season'] == 2025]; chk = [x for x in rows if x['season'] == 2026]
yt = np.array([x['td'] for x in tune], float); yc = np.array([x['td'] for x in chk], float)
def logit_fit(X, y, ridge=1e-3):
    w = np.zeros(X.shape[1])
    for _ in range(60):
        p = 1 / (1 + np.exp(-X @ w)); H = X.T @ (X * (p * (1 - p))[:, None]) + ridge * np.eye(len(w)); w += np.linalg.solve(H, X.T @ (y - p) - ridge * w)
    return w
TD = {
    'the board as shipped': None,
    'spec: red-zone share × implied total': lambda x: [nz(x['sh_rz5'], 0) * x['implied'], nz(x['sh_rzs'], 0) * x['implied']],
    'red-zone looks a game (last 5, season)': lambda x: [x['rz5'], x['rzs']],
    'red-zone looks + implied total': lambda x: [x['rz5'], x['rzs'], x['implied']],
    'the board\'s read + red-zone looks + implied': lambda x: [math.log(max(1e-3, x['b_td']) / max(1e-3, 1 - x['b_td'])), x['rz5'], x['rzs'], x['implied'] - 22],
    'shipped: the board\'s read + red-zone looks (last 5) + implied': lambda x: [math.log(max(1e-3, x['b_td']) / max(1e-3, 1 - x['b_td'])), x['rz5'], x['implied'] - 22],
}
print(f"\n=== Engine 2, anytime TD: fit {len(tune)}, check {len(chk)}; {yc.mean()*100:.1f}% of the check rows scored")
tdout = {}; probs = {}
for nm, fn in TD.items():
    if fn is None: p = np.array([x['b_td'] for x in chk])
    else:
        w = logit_fit(np.array([fn(x) + [1] for x in tune]), yt); p = 1 / (1 + np.exp(-np.array([fn(x) + [1] for x in chk]) @ w))
    probs[nm] = p
    if fn is not None: report.setdefault('td_weights', {})[nm] = [float(v) for v in w]
    top6 = []; top15 = []
    for t in sorted(set(x['tag'] for x in chk)):
        idx = sorted([i for i, x in enumerate(chk) if x['tag'] == t], key=lambda i: -p[i]); top6 += idx[:6]; top15 += idx[:15]
    r6 = (float(np.mean([p[i] for i in top6])), float(np.mean([yc[i] for i in top6])))
    tdout[nm] = {'brier': float(np.mean((p - yc) ** 2)), 'top6_said': r6[0], 'top6_landed': r6[1], 'top6_n': len(top6), 'top15': float(np.mean([yc[i] for i in top15]))}
    print(f"  {nm:46s} each week's top 6: said {r6[0]*100:4.1f}% landed {r6[1]*100:4.1f}% ({sum(yc[i] for i in top6):.0f} of {len(top6)}) · top 15 landed {tdout[nm]['top15']*100:4.1f}% · Brier {tdout[nm]['brier']:.4f}")
report['engine2'] = tdout
# the outlier rule: top-decile red-zone share left off the week's top 6 (the board's)
p = probs['the board as shipped']; off = []; on = []
for t in sorted(set(x['tag'] for x in chk)):
    idx = [i for i, x in enumerate(chk) if x['tag'] == t]
    top = set(sorted(idx, key=lambda i: -p[i])[:6])
    cut = np.percentile([nz(chk[i]['sh_rz5'], 0) for i in idx], 90)
    for i in idx:
        if nz(chk[i]['sh_rz5'], 0) >= cut and nz(chk[i]['sh_rz5'], 0) > 0: (on if i in top else off).append(i)
print(f"  the outlier rule: top-decile red-zone share (last 5) players — on the board's top 6: {len(on)}, {np.mean([yc[i] for i in on])*100:.1f}% scored (said {np.mean([p[i] for i in on])*100:.1f}%)")
print(f"                    left off it: {len(off)}, {np.mean([yc[i] for i in off])*100:.1f}% scored (the board said {np.mean([p[i] for i in off])*100:.1f}%)")
p2 = probs["shipped: the board's read + red-zone looks (last 5) + implied"]; on2 = []
for t in sorted(set(x['tag'] for x in chk)):
    idx = [i for i, x in enumerate(chk) if x['tag'] == t]; top = set(sorted(idx, key=lambda i: -p2[i])[:6])
    cut = np.percentile([nz(chk[i]['sh_rz5'], 0) for i in idx], 90)
    on2 += [i for i in idx if nz(chk[i]['sh_rz5'], 0) >= cut and nz(chk[i]['sh_rz5'], 0) > 0 and i in top]
print(f"                    under the shipped engine: {len(on2)} of them make the week's top 6, {np.mean([yc[i] for i in on2])*100:.1f}% scored")
report['outlier'] = {'on': [len(on), float(np.mean([yc[i] for i in on]))], 'off': [len(off), float(np.mean([yc[i] for i in off])), float(np.mean([p[i] for i in off]))]}
if OUT: json.dump(report, open(OUT, 'w'), indent=1)

# ================= checks on the two findings =================
# (a) the touchdown engine against the board, Brier per row with its interval; the top 6 on both seasons (2025 in-sample)
print('\n=== checks')
bb = (probs['the board as shipped'] - yc) ** 2
for nm in ('spec: red-zone share × implied total', 'red-zone looks + implied total', "the board's read + red-zone looks + implied", "shipped: the board's read + red-zone looks (last 5) + implied"):
    d = (probs[nm] - yc) ** 2 - bb; lo, hi = boot(d)
    print(f"  TD Brier, {nm} − the board: {d.mean():+.5f} [{lo:+.5f}, {hi:+.5f}]")
    report.setdefault('td_brier_vs_board', {})[nm] = [float(d.mean()), lo, hi]
# (b) the card on both seasons: each week's top 2 by the board's projection — their rungs against everyone's
for m, ystat, keep in (('rec_yds', 'recYds', lambda x: x['rec17'] >= 10), ('rush_yds', 'rushYds', lambda x: x['pos'] == 'RB' and x['rush17'] >= 10)):
    rows = [x for x in data if keep(x) and x[f'b_{m}'] is not None]
    for k in (2, 5):
        picks = []
        for t in sorted(set(x['tag'] for x in rows)):
            picks += sorted([x for x in rows if x['tag'] == t], key=lambda x: -x[f'b_{m}'])[:k]
        res = {}
        for t in ('strong', 'lean', 'thin'):
            hs = [(tt[t][1], x[ystat] >= tt[t][0]) for x in picks for tt in [tiers(x[f'b_{m}'], x[f'sd_{m}'], m)] if t in tt]
            res[t] = (len(hs), float(np.mean([a for a, _ in hs])), float(np.mean([h for _, h in hs])))
        bias = float(np.mean([x[ystat] - x[f'b_{m}'] for x in picks]))
        report.setdefault('top_of_week', {})[f'{m} top {k}'] = {'n': len(picks), 'bias': bias, **res}
        print(f"  {m}, each week's top {k} by the board's projection, 2025 + 2026 ({len(picks)}): got − projected {bias:+.1f} · " + ' · '.join(f"{t} {res[t][1]*100:4.1f}% → {res[t][2]*100:4.1f}%" for t in res))
    # the board's bias by projection decile
    dec = np.percentile([x[f'b_{m}'] for x in rows], [80, 90, 95])
    for lo_, lab in ((dec[0], 'top 20%'), (dec[1], 'top 10%'), (dec[2], 'top 5%')):
        xs = [x for x in rows if x[f'b_{m}'] >= lo_]
        print(f"     projected in the {lab} (from {lo_:.0f}): {len(xs)} games, got − projected {np.mean([x[ystat] - x[f'b_{m}'] for x in xs]):+.1f}, median got {np.median([x[ystat] for x in xs]):.0f} vs median projected {np.median([x[f'b_{m}'] for x in xs]):.0f}")
if OUT: json.dump(report, open(OUT, 'w'), indent=1)

# (c) the top shrink: proj' = c + b · proj, least absolute deviation on 2025 (a median read: the game a player is likeliest
#     to have), the ladder's curve refitted on 2025's residuals of proj'; scored on 2026 case by case and on the top picks
def lad(x, y):
    A = np.column_stack([x, np.ones(len(x))]); w = np.linalg.lstsq(A, y, rcond=None)[0]
    for _ in range(300):
        r = np.abs(y - A @ w); wt = 1 / np.maximum(r, 1.0); W = np.sqrt(wt); w = np.linalg.lstsq(A * W[:, None], y * W, rcond=None)[0]
    return w
print('\n=== the top shrink')
for m, ystat, keep in (('rec_yds', 'recYds', lambda x: x['rec17'] >= 10), ('rush_yds', 'rushYds', lambda x: x['pos'] == 'RB' and x['rush17'] >= 10)):
    rows = [x for x in data if keep(x) and x[f'b_{m}'] is not None and x[f'sd_{m}']]
    tune = [x for x in rows if x['season'] == 2025]; chk = [x for x in rows if x['season'] == 2026]
    b, c = lad(np.array([x[f'b_{m}'] for x in tune]), np.array([x[ystat] for x in tune]))
    sh = lambda x: max(0.0, c + b * x[f'b_{m}'])
    z = np.array([(x[ystat] - sh(x)) / x[f'sd_{m}'] for x in tune]); Q = [float(np.quantile(z, 0.05 * i)) for i in range(1, 20)]
    yc = np.array([x[ystat] for x in chk]); p0 = np.array([x[f'b_{m}'] for x in chk]); p1 = np.array([sh(x) for x in chk])
    c0, c1 = cases(p0, yc), cases(p1, yc)
    d = (np.abs(yc - p1) <= 10).astype(float) - (np.abs(yc - p0) <= 10).astype(float); lo, hi = boot(d)
    print(f"  {m}: proj' = {c:.1f} + {b:.3f} × proj (2025, {len(tune)} games)")
    print(f"     board  {fmt(c0)}\n     shrunk {fmt(c1)}  close {d.mean()*100:+.1f} [{lo*100:+.1f}, {hi*100:+.1f}]")
    def tiers_q(proj, sd, q):
        step = 5 if proj < 40 else 10
        marks = [(mk, 1 - cdf(q, (mk - 0.5 - proj) / sd)) for mk in range(step, int(proj + 3 * sd) + 1, step)]
        out = {}; used = set()
        for t, at in (('strong', .6), ('lean', .45), ('thin', .3)):
            bb = [x for x in marks if x[1] >= at]
            if bb and bb[-1][0] not in used: out[t] = bb[-1]
            if bb: used.add(bb[-1][0])
        return out
    for lab, sel in (('every player', lambda xs: xs), ("each week's top 2", lambda xs: [y for t in sorted(set(x['tag'] for x in xs)) for y in sorted([x for x in xs if x['tag'] == t], key=lambda x: -x[f'b_{m}'])[:2]]),
                     ("each week's top 5", lambda xs: [y for t in sorted(set(x['tag'] for x in xs)) for y in sorted([x for x in xs if x['tag'] == t], key=lambda x: -x[f'b_{m}'])[:5]])):
        xs = sel(chk); line = []
        for nm, pr, q in (('board', lambda x: x[f'b_{m}'], RESID[m]), ('shrunk', sh, Q)):
            res = {}
            for t in ('strong', 'lean', 'thin'):
                hs = [(tt[t][1], x[ystat] >= tt[t][0]) for x in xs for tt in [tiers_q(pr(x), x[f'sd_{m}'], q)] if t in tt]
                res[t] = (len(hs), float(np.mean([a for a, _ in hs])) if hs else None, float(np.mean([h for _, h in hs])) if hs else None)
            line.append(f"{nm}: " + ' · '.join(f"{t} {res[t][1]*100:4.1f}% → {res[t][2]*100:4.1f}%" for t in res if res[t][0]))
            report.setdefault('shrink', {}).setdefault(m, {})[f'{lab} {nm}'] = res
        print(f"     {lab} ({len(xs)}): " + ' | '.join(line))
    report['shrink'][m]['fit'] = {'c': float(c), 'b': float(b), 'resid': Q, 'cases_board': c0, 'cases_shrunk': c1, 'close_gain': [float(d.mean()), lo, hi]}
if OUT: json.dump(report, open(OUT, 'w'), indent=1)

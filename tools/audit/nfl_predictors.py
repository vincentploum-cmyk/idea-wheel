# What predicts an NFL player's game best: his recent form, his head to head against tonight's opponent, the matchup
# (what the defense gives up at his position), the line, or a combination (Vincent, 2026-11-03: "we'll need to see what
# predicts receiving yards, rushing yards, tds and passing yards the best. Is it h2h, is it matchup, is it recent form or a
# combination of all 3?"; docs/audits/2026-11-03-nfl-predictors.md).
#
# Every regular-season game of 2025 (weeks 4–18, the fit) and 2026 (weeks 1–7, the check) in PropFinder's logs (the
# nfl-pf-export artifact, zeros in), each player's figures built from the games before it alone (2024 behind 2025), the
# defenses' tables rebuilt from the same logs, the line from ESPN (`tools/audit/nfl-fetch.mjs` for 2024–2026). The
# board's own read beside them where the replay's dump has it (`nfl-pf-audit.mjs --dump`).
#
#   python3 -I tools/audit/nfl_predictors.py [--audit .nhl-data/audit] [--dump <nfl-board-rows.json>] [--json out.json]
import json, gzip, glob, re, sys, math, collections as C
import numpy as np

arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
ROOT = arg('--audit', '.nhl-data/audit'); DUMP = arg('--dump', f'{ROOT}/out/nfl-board-rows.json'); OUT = arg('--json')
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
STATS = ['passYds', 'passAtt', 'passTd', 'rushYds', 'rushAtt', 'rushTd', 'rec', 'recYds', 'recTd', 'tgt']
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
        hit = None
        for (d0, team), (o, gid) in ():
            pass
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

# --- the defenses: what each team gave up a game to each position (all of that position's players summed), by date
team_days = C.defaultdict(set)
for g in games.values():
    team_days[(g['season'], g['home'])].add(g['day']); team_days[(g['season'], g['away'])].add(g['day'])
allowed = C.defaultdict(list)   # (season, defense, pos) -> [(day, {stat: sum})] per game
tmp = C.defaultdict(lambda: C.defaultdict(float))
for r in placed:
    key = (r['season'], r['opp'], r['pos'], r['date'])
    for k in ('passYds', 'rushYds', 'recYds', 'rec', 'td'): tmp[key][k] += r[k]
for (s, d, pos, day), v in tmp.items(): allowed[(s, d, pos)].append((day, v))
for k in allowed: allowed[k].sort(key=lambda x: x[0], reverse=True)
def defense(season, d, pos, day, stat, last=None):
    xs = [v[stat] for dd, v in allowed[(season, d, pos)] if dd < day]
    if last: xs = xs[:last]
    return (mean(xs), len(xs))
LEAGUE = {}
def league(season, pos, day, stat):
    k = (season, pos, day, stat)
    if k not in LEAGUE:
        vals = [defense(season, d, pos, day, stat)[0] for (s, d, p) in list(allowed) if s == season and p == pos]
        vals = [v for v in vals if v is not None]
        LEAGUE[k] = mean(vals)
    return LEAGUE[k]

# --- the targets: per market the stat, who counts, and what makes a game "his"
MARKETS = {
    'rec_yds':  dict(stat='recYds',  pos=('WR', 'TE', 'RB'), act=lambda r: r['active'], vol='tgt'),
    'rush_yds': dict(stat='rushYds', pos=('RB',),             act=lambda r: r['active'], vol='rushAtt'),
    'pass_yds': dict(stat='passYds', pos=('QB',),             act=lambda r: r['passAtt'] >= 10, vol='passAtt'),
    'td':       dict(stat='td',      pos=('RB', 'WR', 'TE'),  act=lambda r: r['active'], vol=None),
}
board = {}
try:
    for x in json.load(open(DUMP)): board[(x['tag'], x['key'], x['team'], x['m'])] = x['proj']
except Exception as e: print('no dump', e, file=sys.stderr)

def feats(r, m):
    spec = MARKETS[m]; st = spec['stat']; day = r['date']
    prior = [x for x in by_pid[r['pid']] if x['date'] < day]
    own = [x for x in prior if spec['act'](x)]
    if len(own) < 3: return None
    cur = [x for x in own if x['season'] == r['season']]
    f = {}
    for n in (1, 3, 5, 10, 17): f[f'l{n}'] = mean([x[st] for x in own[:n]])
    f['sea'] = mean([x[st] for x in cur]) if cur else None; f['n_season'] = len(cur)
    if spec['vol']:
        f['vol5'] = mean([x[spec['vol']] for x in own[:5]]); f['vol17'] = mean([x[spec['vol']] for x in own[:17]])
    if m == 'td':
        f['touch5'] = mean([x['rushAtt'] + x['tgt'] for x in own[:5]]); f['touch17'] = mean([x['rushAtt'] + x['tgt'] for x in own[:17]])
    # head to head: his games against tonight's opponent before tonight (any season)
    h = [x for x in own if x['opp'] == r['opp']][:4]
    f['h2h_n'] = len(h); f['h2h'] = mean([x[st] for x in h]) if h else None
    # the matchup: what the defense gives up a game at his position this season before tonight (last season's before its
    # third game), against the league's, and over its last five
    a, gp = defense(r['season'], r['opp'], r['pos'], day, st if st != 'td' else 'td')
    lg = league(r['season'], r['pos'], day, st)
    if gp < 3:
        a, gp = defense(r['season'] - 1, r['opp'], r['pos'], '9999', st); lg = league(r['season'] - 1, r['pos'], '9999', st); f['def_held'] = True
    f['def'] = a; f['def_gp'] = gp; f['lg'] = lg
    f['def_ratio'] = (a / lg) if a is not None and lg else None
    a5, n5 = defense(r['season'], r['opp'], r['pos'], day, st, last=5); f['def5_ratio'] = (a5 / lg) if a5 is not None and lg and n5 >= 3 else None
    # the line
    g = games[r['gid']]
    fav = None
    if g['fav_home'] is not None: fav = g['fav_home'] if r['team'] == g['home'] else -g['fav_home']
    f['total'] = g['total']; f['fav'] = fav; f['home'] = 1 if r['team'] == g['home'] else 0
    return f

data = {m: [] for m in MARKETS}
for r in placed:
    g = games[r['gid']]
    if not ((g['season'] == 2025 and g['week'] and 4 <= g['week'] <= 18) or (g['season'] == 2026 and g['week'] and g['week'] <= 7)): continue
    for m, spec in MARKETS.items():
        if r['pos'] not in spec['pos'] or not spec['act'](r): continue
        f = feats(r, m)
        if f is None: continue
        if m in ('rec_yds', 'rush_yds') and (f['l17'] or 0) < 10: continue   # the lists' floor: 10 yards a game
        if m == 'td' and (f['touch17'] or 0) < 3: continue
        tag = f"{g['season']}w{g['week']}"
        f.update(tag=tag, season=g['season'], week=g['week'], pos=r['pos'], key=r['key'], team=r['team'], opp=r['opp'], y=r[spec['stat']] if m != 'td' else (1 if r['td'] > 0 else 0),
                 board=board.get((tag, r['key'], r['team'], m)), gvol=r[spec['vol']] if spec['vol'] else r['rushAtt'] + r['tgt'])
        data[m].append(f)
print({m: (len([x for x in v if x['season'] == 2025]), len([x for x in v if x['season'] == 2026])) for m, v in data.items()}, file=sys.stderr)

# --- the reads
nz = lambda v, d: v if v is not None else d
def ols(X, y): return np.linalg.lstsq(X, y, rcond=None)[0]
def logit_fit(X, y, ridge=1e-3):
    w = np.zeros(X.shape[1])
    for _ in range(60):
        p = 1 / (1 + np.exp(-X @ w)); H = X.T @ (X * (p * (1 - p))[:, None]) + ridge * np.eye(len(w)); w += np.linalg.solve(H, X.T @ (y - p) - ridge * w)
    return w
def boot(d, B=3000, seed=1):
    rng = np.random.default_rng(seed); n = len(d)
    bs = [d[rng.integers(0, n, n)].mean() for _ in range(B)]
    return float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))

def matchup_term(x):
    """The matchup as a multiplicative nudge on his own form: (allowed / league − 1), damped by the games behind it."""
    r = x['def_ratio']
    return 0.0 if r is None else (r - 1) * x['def_gp'] / (x['def_gp'] + 8)
def h2h_term(x):
    """Head to head as his over / under-performance against this opponent, against his own long form, damped by meetings."""
    if x['h2h'] is None or not x['l17']: return 0.0
    return (x['h2h'] - x['l17']) * x['h2h_n'] / (x['h2h_n'] + 2)

FEATS = {
    'form':      lambda x: [x['l3'], x['l5'], x['l10'], x['l17'], nz(x['sea'], x['l17'])],
    'matchup':   lambda x: [x['l17'] * matchup_term(x)],
    'h2h':       lambda x: [h2h_term(x)],
    'line':      lambda x: [nz(x['total'], 44.5) - 44.5, nz(x['fav'], 0)],
    'volume':    lambda x: [nz(x.get('vol5'), 0), nz(x.get('vol17'), 0)],
}
def design(rows, parts):
    return np.array([sum((FEATS[p](x) for p in parts), []) + [1.0] for x in rows])

report = {}
for m, X in data.items():
    tune = [x for x in X if x['season'] == 2025]; chk = [x for x in X if x['season'] == 2026]
    yt = np.array([x['y'] for x in tune], float); yc = np.array([x['y'] for x in chk], float)
    out = {'n': [len(tune), len(chk)], 'mean': [float(yt.mean()), float(yc.mean())], 'single': {}, 'combo': {}, 'h2h_rows': {}}
    print(f"\n=== {m}: fit {len(tune)}, check {len(chk)}; mean {yt.mean():.2f} / {yc.mean():.2f}")
    if m == 'td':
        score = lambda p, y: float(np.mean((p - y) ** 2))
        def tdcases(p, y, rows):
            # each week's 15 likeliest by the read: how many scored; and the players the read put at 45%+: how many scored
            top = []; tags = sorted(set(x['tag'] for x in rows))
            for t in tags:
                idx = [i for i, x in enumerate(rows) if x['tag'] == t]
                idx.sort(key=lambda i: -p[i]); top += [y[i] for i in idx[:15]]
            hi = [y[i] for i in range(len(y)) if p[i] >= 0.45]
            return {'top15': float(np.mean(top)), 'hi_n': len(hi), 'hi': float(np.mean(hi)) if hi else None, 'brier': score(p, y)}
        tdfmt = lambda c: f"each week's top 15: {c['top15']*100:4.1f}% scored · called 45%+: {c['hi_n']:3d} players, {('%4.1f%%' % (c['hi']*100)) if c['hi'] is not None else '  — '} scored"
        print(f"  (everyone: {yc.mean()*100:.1f}% scored)")
        base_rate = yt.mean()

        # single reads, each as a rate through a one-feature logistic fitted on 2025
        TD_SINGLE = {
            'his TD rate, last 5': lambda x: [x['l5']], 'last 10': lambda x: [x['l10']], 'last 17': lambda x: [x['l17']], 'this season': lambda x: [nz(x['sea'], x['l17'])],
            'his touches, last 5': lambda x: [x['touch5']], 'touches, last 17': lambda x: [x['touch17']],
            'matchup: TDs allowed at his position vs league': lambda x: [nz(x['def_ratio'], 1)],
            'head to head: TD rate vs this opponent (2+ meetings)': lambda x: [nz(x['h2h'], x['l17']) if x['h2h_n'] >= 2 else x['l17']],
            'line: team implied points': lambda x: [nz(x['total'], 44.5) / 2 + nz(x['fav'], 0)],
        }
        for name, fn in TD_SINGLE.items():
            A = np.array([fn(x) + [1] for x in tune]); w = logit_fit(A, yt)
            p = 1 / (1 + np.exp(-np.array([fn(x) + [1] for x in chk]) @ w)); out['single'][name] = tdcases(p, yc, chk)
            print(f"  {name:44s} {tdfmt(out['single'][name])}")
        # the head to head's 45%+ calls against the long form's on the same players
        def fitp(fn):
            A = np.array([fn(x) + [1] for x in tune]); w = logit_fit(A, yt); return 1 / (1 + np.exp(-np.array([fn(x) + [1] for x in chk]) @ w))
        ph = fitp(TD_SINGLE['head to head: TD rate vs this opponent (2+ meetings)']); pl17 = fitp(TD_SINGLE['last 17'])
        hi = [i for i in range(len(yc)) if ph[i] >= 0.45]
        if hi:
            both = [i for i in hi if pl17[i] >= 0.45]
            out['h2h_td'] = {'n': len(hi), 'scored': int(sum(yc[i] for i in hi)), 'l17_also_45': len(both), 'l17_mean': float(np.mean([pl17[i] for i in hi]))}
            print(f"  h2h's 45%+ calls: {len(hi)} players, {int(sum(yc[i] for i in hi))} scored; the last-17 rate also put {len(both)} of them at 45%+ (its mean call on them {np.mean([pl17[i] for i in hi])*100:.0f}%)")
            extra = [i for i in hi if pl17[i] < 0.45]
            if extra: print(f"     the {len(extra)} only h2h called: {int(sum(yc[i] for i in extra))} scored")
        TD_COMBO = {
            'form (rate L5/L10/L17 + touches)': lambda x: [x['l5'], x['l10'], x['l17'], x['touch5'], x['touch17']],
        }
        TD_COMBO['form + matchup'] = lambda x: TD_COMBO['form (rate L5/L10/L17 + touches)'](x) + [nz(x['def_ratio'], 1) - 1]
        TD_COMBO['form + h2h'] = lambda x: TD_COMBO['form (rate L5/L10/L17 + touches)'](x) + [h2h_term(x)]
        TD_COMBO['form + line'] = lambda x: TD_COMBO['form (rate L5/L10/L17 + touches)'](x) + [nz(x['total'], 44.5) / 2 + nz(x['fav'], 0) - 22]
        TD_COMBO['form + matchup + h2h + line'] = lambda x: TD_COMBO['form + matchup'](x) + [h2h_term(x), nz(x['total'], 44.5) / 2 + nz(x['fav'], 0) - 22]
        base = None
        for name, fn in TD_COMBO.items():
            A = np.array([fn(x) + [1] for x in tune]); w = logit_fit(A, yt)
            p = 1 / (1 + np.exp(-np.array([fn(x) + [1] for x in chk]) @ w)); e = (p - yc) ** 2
            if base is None: base = e
            c = tdcases(p, yc, chk)
            out['combo'][name] = {**c, 'vs_form': float((e - base).mean())}
            print(f"  {name:44s} {tdfmt(c)}")
        report[m] = out; continue
    TOL = {'rec_yds': (10, 20, 30), 'rush_yds': (10, 20, 30), 'pass_yds': (25, 50, 75)}[m]
    def cases(pred, y):
        e = np.abs(y - pred)
        return {'close': float(np.mean(e <= TOL[0])), 'near': float(np.mean(e <= TOL[1])), 'way_off': float(np.mean(e > TOL[2])), 'median': float(np.median(e)), 'mae': float(e.mean())}
    fmt = lambda c: f"close (±{TOL[0]}) {c['close']*100:4.1f}% · near (±{TOL[1]}) {c['near']*100:4.1f}% · way off (>{TOL[2]}) {c['way_off']*100:4.1f}% · median miss {c['median']:5.1f}"
    mae = lambda pred, y: cases(pred, y)
    # single reads: each on its own (a window as it stands; the matchup as his long form × the defense's ratio)
    SINGLE = {
        'last game': lambda x: x['l1'], 'last 3': lambda x: x['l3'], 'last 5': lambda x: x['l5'], 'last 10': lambda x: x['l10'], 'last 17': lambda x: x['l17'],
        'this season': lambda x: nz(x['sea'], x['l17']),
        'last 17 × the defense ratio (undamped)': lambda x: x['l17'] * nz(x['def_ratio'], 1),
    }
    for name, fn in SINGLE.items():
        out['single'][name] = mae(np.array([fn(x) for x in chk]), yc)
        print(f"  {name:44s} {fmt(out['single'][name])}")
    hb = [x for x in chk if x['board'] is not None]
    if hb: out['single']['the board (as shipped)'] = mae(np.array([x['board'] for x in hb]), np.array([x['y'] for x in hb])); print(f"  {'the board (as shipped, ' + str(len(hb)) + ' rows)':44s} {fmt(out['single']['the board (as shipped)'])}")
    # head to head where it exists: on the rows with 1+ / 2+ meetings, his h2h average against his last 17
    for k in (1, 2, 3):
        hr = [x for x in chk if x['h2h_n'] >= k]
        if len(hr) < 20: continue
        y = np.array([x['y'] for x in hr]); a = mae(np.array([x['h2h'] for x in hr]), y); b = mae(np.array([x['l17'] for x in hr]), y)
        bl = mae(np.array([0.5 * x['h2h'] + 0.5 * x['l17'] for x in hr]), y)
        out['h2h_rows'][k] = {'n': len(hr), 'h2h': a, 'l17': b, 'half': bl}
        print(f"  head to head, {k}+ meetings ({len(hr)} rows):\n      h2h avg      {fmt(a)}\n      his last 17  {fmt(b)}\n      half / half  {fmt(bl)}")
    # the combinations, fitted on 2025, scored on 2026, each against form alone
    base = None
    for parts in (['form'], ['form', 'volume'], ['form', 'matchup'], ['form', 'h2h'], ['form', 'line'], ['form', 'volume', 'matchup'], ['form', 'volume', 'matchup', 'h2h'], ['form', 'volume', 'matchup', 'h2h', 'line']):
        w = ols(design(tune, parts), yt); p = design(chk, parts) @ w; e = np.abs(yc - p)
        close = (e <= TOL[0]).astype(float)
        if base is None: base = close
        lo, hi = boot(close - base)
        name = ' + '.join(parts)
        c = cases(p, yc)
        out['combo'][name] = {**c, 'close_vs_form': float((close - base).mean()), 'ci': [lo, hi], 'w': [round(float(v), 3) for v in w]}
        print(f"  {name:44s} {fmt(c)}  close vs form {(close - base).mean()*100:+5.1f} pts [{lo*100:+.1f}, {hi*100:+.1f}]")
        if parts == ['form']: out['preds'] = [dict(board=x['board'], gvol=x['gvol'], vol17=x.get('vol17'), vol5=x.get('vol5'), key=x['key'], team=x['team'], opp=x['opp'], tag=x['tag'], y=x['y'], pred=float(pp), l5=x['l5'], l17=x['l17'], h2h=x['h2h'], h2h_n=x['h2h_n'], def_ratio=x['def_ratio']) for x, pp in zip(chk, p)]
    report[m] = out
if OUT: json.dump(report, open(OUT, 'w'), indent=1)

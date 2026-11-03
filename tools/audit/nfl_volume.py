# The volume study (docs/audits/2026-11-03-nfl-volume.md; Vincent, 2026-11-03: "yes run the volume study", after
# docs/audits/2026-11-03-nfl-predictors.md found that most way-off receiving and rushing games are volume swings): what
# predicts a receiver's targets and a back's carries tonight — his own recent volume, his share of his team's looks, the
# team's expected volume from the line, the teammates missing tonight (the share they leave) and those coming back — and
# whether a better volume read brings the yards closer, game by game. Fitted on 2025's weeks 4–18, scored on 2026's
# weeks 1–7, case by case (within a few targets / carries / yards, or way off).
#
# A teammate "missing tonight" is a regular (active in 3 of his team's last 5 games this season, still on the team: no game
# for another team since) with no touch in tonight's game: in
# the replay that is read from the game itself, standing in for the injury report the board has before kickoff (a player
# hurt during the game has a row with his touches and is not missing).
#
#   python3 -I tools/audit/nfl_volume.py [--audit .nhl-data/audit] [--json out.json]
import json, gzip, glob, re, sys, math, collections as C
import numpy as np

arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
ROOT = arg('--audit', '.nhl-data/audit'); OUT = arg('--json')
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

# --- every team-game: the pulled players' rows on that side, the team's targets and carries
TG = C.defaultdict(dict)        # (gid, team) -> {pid: row}
for r in placed: TG[(r['gid'], r['team'])][r['pid']] = r
tot = {k: {'tgt': sum(x['tgt'] for x in v.values()), 'car': sum(x['rushAtt'] for x in v.values() if x['pos'] != 'QB'), 'qbcar': sum(x['rushAtt'] for x in v.values() if x['pos'] == 'QB')} for k, v in TG.items()}
team_seq = C.defaultdict(list)  # team -> [(day, gid)] newest first, every season
for g in games.values():
    for t in (g['home'], g['away']):
        if (g['id'], t) in TG: team_seq[t].append((g['day'], g['id']))
for t in team_seq: team_seq[t].sort(reverse=True)
tg_vals = [v['tgt'] for v in tot.values()]
print('team-games', len(tot), 'targets a game: mean', round(mean(tg_vals), 1), 'median', sorted(tg_vals)[len(tg_vals) // 2], file=sys.stderr)
GROUP = {'WR': 'pass', 'TE': 'pass', 'RB': 'run', 'QB': 'qb'}

def share_of(r, stat):
    t = tot.get((r['gid'], r['team']))
    den = t['tgt'] if stat == 'tgt' else t['car']
    return (r[stat] / den) if t and den >= (15 if stat == 'tgt' else 10) else None

def context(team, gid, day, me):
    """The team's last five games before tonight: its targets and carries a game; the regulars (a touch in 3+ of the 5),
    each one's average share; who of them has no touch tonight (missing) and who is back after missing the last two."""
    season = games[gid]['season']
    last = [g for d, g in team_seq[team] if d < day and games[g]['season'] == season][:5]   # this season's games alone
    if len(last) < 3: return None
    t_tgt = mean([tot[(g, team)]['tgt'] for g in last]); t_car = mean([tot[(g, team)]['car'] for g in last])
    seen = C.defaultdict(list)
    for g in last:
        for pid, x in TG[(g, team)].items(): seen[pid].append(x)
    tonight = TG.get((gid, team), {})
    miss = {'tgt': 0.0, 'car': 0.0}; miss_same = {'tgt': 0.0, 'car': 0.0}; back = {'tgt': 0.0, 'car': 0.0}; names = []; ids = []
    my_group = GROUP[pl[me]['pos']]
    for pid, xs in seen.items():
        if pid == me: continue
        act = [x for x in xs if x['active']]
        if len(act) >= 3:
            now = tonight.get(pid)
            # still his: no game for another team since (a trade or a release is a departure, not an absence)
            moved = any(x['date'] < day and x['date'] > act[0]['date'] and x['team'] and x['team'] != team for x in by_pid[pid]) or any(x['date'] == day and x['team'] != team and x['active'] for x in by_pid[pid])
            if moved: continue
            if not now or not now['active']:
                for st, k in (('tgt', 'tgt'), ('rushAtt', 'car')):
                    sh = mean([v for v in (share_of(x, st) for x in act) if v is not None]) or 0
                    miss[k] += sh
                    if GROUP[pl[pid]['pos']] == my_group: miss_same[k] += sh
                names.append(pl[pid]['key']); ids.append(pid)
    # back tonight: active now, no touch in the team's last two games, a regular in the three before
    prev2 = [g for d, g in team_seq[team] if d < day and games[g]['season'] == season][:2]; earlier = [g for d, g in team_seq[team] if d < day and games[g]['season'] == season][2:8]
    for pid, now in tonight.items():
        if pid == me or not now['active']: continue
        if any(TG[(g, team)].get(pid, {}).get('active') for g in prev2): continue
        old = [TG[(g, team)][pid] for g in earlier if TG[(g, team)].get(pid, {}).get('active')]
        if len(old) >= 3:
            for st, k in (('tgt', 'tgt'), ('rushAtt', 'car')):
                sh = mean([v for v in (share_of(x, st) for x in old) if v is not None]) or 0
                back[k] += sh
    return dict(t_tgt=t_tgt, t_car=t_car, miss=miss, miss_same=miss_same, back=back, names=names, ids=ids)

POS_YPT = {}; POS_YPC = {}
for pos in ('WR', 'TE', 'RB'):
    xs = [r for r in placed if r['pos'] == pos and r['season'] == 2024]
    POS_YPT[pos] = sum(r['recYds'] for r in xs) / max(1, sum(r['tgt'] for r in xs))
    POS_YPC[pos] = sum(r['rushYds'] for r in xs) / max(1, sum(r['rushAtt'] for r in xs))
print('league yards a target', {k: round(v, 2) for k, v in POS_YPT.items()}, 'a carry', {k: round(v, 2) for k, v in POS_YPC.items()}, file=sys.stderr)

data = []
for r in placed:
    if r['pos'] not in ('WR', 'TE', 'RB') or not r['active']: continue
    g = games[r['gid']]
    if not ((g['season'] == 2025 and g['week'] and 4 <= g['week'] <= 18) or (g['season'] == 2026 and g['week'] and g['week'] <= 7)): continue
    prior = [x for x in by_pid[r['pid']] if x['date'] < r['date']]
    own = [x for x in prior if x['active']]
    if len(own) < 3: continue
    ctx = context(r['team'], r['gid'], r['date'], r['pid'])
    if not ctx: continue
    f = dict(tag=f"{g['season']}w{g['week']}", season=g['season'], pos=r['pos'], key=r['key'], team=r['team'], opp=r['opp'],
             tgt=r['tgt'], car=r['rushAtt'], recYds=r['recYds'], rushYds=r['rushYds'])
    for n in (1, 3, 5, 10, 17):
        f[f'tgt{n}'] = mean([x['tgt'] for x in own[:n]]); f[f'car{n}'] = mean([x['rushAtt'] for x in own[:n]])
        f[f'rec{n}'] = mean([x['recYds'] for x in own[:n]]); f[f'rush{n}'] = mean([x['rushYds'] for x in own[:n]])
    # his share of the team's looks in his recent games (with whichever team he played for)
    for st, k in (('tgt', 'tgt'), ('rushAtt', 'car')):
        shs = [v for v in (share_of(x, st) for x in own if x['gid']) if v is not None]
        f[f'sh{k}3'] = mean(shs[:3]); f[f'sh{k}5'] = mean(shs[:5]); f[f'sh{k}10'] = mean(shs[:10])
    # his efficiency over his last 17, pulled toward his position's
    t17 = sum(x['tgt'] for x in own[:17]); c17 = sum(x['rushAtt'] for x in own[:17])
    f['ypt'] = (sum(x['recYds'] for x in own[:17]) + 40 * POS_YPT[r['pos']]) / (t17 + 40)
    f['ypc'] = (sum(x['rushYds'] for x in own[:17]) + 60 * POS_YPC[r['pos']]) / (c17 + 60)
    # he himself back after missing his team's last game(s)
    lastg = [gg for d, gg in team_seq[r['team']] if d < r['date']][:1]
    f['self_back'] = 1 if lastg and not TG[(lastg[0], r['team'])].get(r['pid'], {}).get('active') else 0
    fav = None
    if g['fav_home'] is not None: fav = g['fav_home'] if r['team'] == g['home'] else -g['fav_home']
    f.update(fav=fav if fav is not None else 0.0, total=(g['total'] or 44.5) - 44.5, t_tgt=ctx['t_tgt'], t_car=ctx['t_car'],
             miss_tgt=ctx['miss']['tgt'], miss_car=ctx['miss']['car'], miss_same_tgt=ctx['miss_same']['tgt'], miss_same_car=ctx['miss_same']['car'],
             back_tgt=ctx['back']['tgt'], back_car=ctx['back']['car'], missing=ctx['names'])
    # the without split (lib/picks/injuries.js withoutOf, the board's): his games this season, for this team, in which none
    # of tonight's missing teammates had a touch
    wo = []
    if ctx['ids']:
        for x in own:
            if x['season'] != r['season'] or x['team'] != r['team'] or not x['gid']: continue
            if all(not TG[(x['gid'], r['team'])].get(pid, {}).get('active') for pid in ctx['ids']): wo.append(x)
    f['wo_n'] = len(wo); f['wo_tgt'] = mean([x['tgt'] for x in wo]); f['wo_car'] = mean([x['rushAtt'] for x in wo])
    data.append(f)
nz = lambda v, d: v if v is not None else d
tune = [x for x in data if x['season'] == 2025]; chk = [x for x in data if x['season'] == 2026]
print('player-games', len(tune), len(chk), file=sys.stderr)

def boot(d, B=3000, seed=1):
    rng = np.random.default_rng(seed); n = len(d); bs = [d[rng.integers(0, n, n)].mean() for _ in range(B)]
    return float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))
def cases(pred, y, tol):
    e = np.abs(y - pred); return dict(close=float(np.mean(e <= tol[0])), near=float(np.mean(e <= tol[1])), way_off=float(np.mean(e > tol[2])), median=float(np.median(e)))
def fmt(c, tol): return f"close (±{tol[0]}) {c['close']*100:4.1f}% · near (±{tol[1]}) {c['near']*100:4.1f}% · way off (>{tol[2]}) {c['way_off']*100:4.1f}% · median {c['median']:5.2f}"
report = {}

def study(name, rows_t, rows_c, y_of, tol, reads, base_name):
    """Each read scored case by case on 2026: a read named "fit: …" returns features fitted by least squares on 2025."""
    yt = np.array([y_of(x) for x in rows_t], float); yc = np.array([y_of(x) for x in rows_c], float)
    print(f"\n=== {name}: fit {len(rows_t)}, check {len(rows_c)}, mean tonight {yc.mean():.2f}")
    out = {}; preds = {}
    for rn, rd in reads.items():
        if not rn.startswith('fit'): p = np.array([rd(x) for x in rows_c], float)
        else:
            A = np.array([rd(x) + [1] for x in rows_t]); w = np.linalg.lstsq(A, yt, rcond=None)[0]; p = np.array([rd(x) + [1] for x in rows_c]) @ w
        preds[rn] = p; out[rn] = cases(p, yc, tol)
    base = np.abs(yc - preds[base_name]) <= tol[0]
    for rn in reads:
        c = out[rn]; d = (np.abs(yc - preds[rn]) <= tol[0]).astype(float) - base; lo, hi = boot(d)
        c['close_vs_base'] = [float(d.mean()), lo, hi]
        print(f"  {rn:52s} {fmt(c, tol)}   close vs {base_name} {d.mean()*100:+5.1f} [{lo*100:+.1f}, {hi*100:+.1f}]")
    report[name] = out
    return preds, yc

# --- 1. targets (receivers, tight ends, backs with 2+ targets a game)
R = lambda xs: [x for x in xs if (x['tgt17'] or 0) >= 2]
rt, rc = R(tune), R(chk)
TGT = {
    'his targets, last 5': lambda x: x['tgt5'],
    'his targets, last 17': lambda x: x['tgt17'],
    'his share (last 5) × the team\'s targets (last 5)': lambda x: nz(x['shtgt5'], 0) * x['t_tgt'],
    'share × team, the missing teammates\' share handed out': lambda x: nz(x['shtgt5'], 0) * x['t_tgt'] / max(0.4, 1 - x['miss_tgt'] + x['back_tgt']),
    'fit: form (last 3 / 5 / 17)': lambda x: [x['tgt3'], x['tgt5'], x['tgt17']],
    'fit: form + share × team': lambda x: [x['tgt3'], x['tgt5'], x['tgt17'], nz(x['shtgt5'], 0) * x['t_tgt']],
    'fit: form + share + missing / back teammates': lambda x: [x['tgt3'], x['tgt5'], x['tgt17'], nz(x['shtgt5'], 0) * x['t_tgt'], nz(x['shtgt5'], 0) * x['t_tgt'] * x['miss_same_tgt'], nz(x['shtgt5'], 0) * x['t_tgt'] * (x['miss_tgt'] - x['miss_same_tgt']), nz(x['shtgt5'], 0) * x['t_tgt'] * x['back_tgt'], x['self_back']],
    'fit: all of it + the line': lambda x: [x['tgt3'], x['tgt5'], x['tgt17'], nz(x['shtgt5'], 0) * x['t_tgt'], nz(x['shtgt5'], 0) * x['t_tgt'] * x['miss_same_tgt'], nz(x['shtgt5'], 0) * x['t_tgt'] * (x['miss_tgt'] - x['miss_same_tgt']), nz(x['shtgt5'], 0) * x['t_tgt'] * x['back_tgt'], x['self_back'], x['fav'] * nz(x['shtgt5'], 0), x['total'] * nz(x['shtgt5'], 0)],
}
p_tgt, y_tgt = study('targets', rt, rc, lambda x: x['tgt'], (1, 2, 4), TGT, 'his targets, last 5')

# --- 2. carries (backs with 4+ a game)
B = lambda xs: [x for x in xs if x['pos'] == 'RB' and (x['car17'] or 0) >= 4]
bt, bc = B(tune), B(chk)
CAR = {
    'his carries, last 5': lambda x: x['car5'],
    'his carries, last 17': lambda x: x['car17'],
    'his share (last 5) × the team\'s carries (last 5)': lambda x: nz(x['shcar5'], 0) * x['t_car'],
    'share × team, the missing teammates\' share handed out': lambda x: nz(x['shcar5'], 0) * x['t_car'] / max(0.4, 1 - x['miss_car'] + x['back_car']),
    'fit: form (last 3 / 5 / 17)': lambda x: [x['car3'], x['car5'], x['car17']],
    'fit: form + share × team': lambda x: [x['car3'], x['car5'], x['car17'], nz(x['shcar5'], 0) * x['t_car']],
    'fit: form + share + missing / back teammates': lambda x: [x['car3'], x['car5'], x['car17'], nz(x['shcar5'], 0) * x['t_car'], x['t_car'] * x['miss_same_car'], nz(x['shcar5'], 0) * x['t_car'] * x['back_car'], x['self_back']],
    'fit: all of it + the line': lambda x: [x['car3'], x['car5'], x['car17'], nz(x['shcar5'], 0) * x['t_car'], x['t_car'] * x['miss_same_car'], nz(x['shcar5'], 0) * x['t_car'] * x['back_car'], x['self_back'], x['fav'] * nz(x['shcar5'], 0), x['total'] * nz(x['shcar5'], 0)],
}
p_car, y_car = study('carries', bt, bc, lambda x: x['car'], (2, 4, 7), CAR, 'his carries, last 5')

# --- 3. the yards: form, the volume read × his efficiency, and the ceiling (his real volume tonight × his efficiency)
best_t = 'fit: form + share + missing / back teammates'; best_c = 'fit: form + share + missing / back teammates'
RY = lambda xs: [x for x in xs if (x['rec17'] or 0) >= 10]
yt_rows, yc_rows = RY(rt), RY(rc)
# the volume read's targets for these rows (refit on the yards population's own rows, same features)
def fitpred(rd, rows_t, rows_c, y_of):
    A = np.array([rd(x) + [1] for x in rows_t]); w = np.linalg.lstsq(A, np.array([y_of(x) for x in rows_t], float), rcond=None)[0]
    return lambda x: float(np.dot(rd(x) + [1], w))
vt = fitpred(TGT[best_t], rt, rc, lambda x: x['tgt'])
REC = {
    'form: his yards, last 5': lambda x: x['rec5'],
    'form: his yards, last 10': lambda x: x['rec10'],
    'fit: form (yards last 3 / 5 / 10 / 17)': lambda x: [x['rec3'], x['rec5'], x['rec10'], x['rec17']],
    'volume read × his yards a target': lambda x: max(0.0, vt(x)) * x['ypt'],
    'fit: form + volume read × yards a target': lambda x: [x['rec3'], x['rec5'], x['rec10'], x['rec17'], max(0.0, vt(x)) * x['ypt']],
    'ceiling: his real targets tonight × his yards a target': lambda x: x['tgt'] * x['ypt'],
}
study('receiving yards', yt_rows, yc_rows, lambda x: x['recYds'], (10, 20, 30), REC, 'fit: form (yards last 3 / 5 / 10 / 17)')
BY = lambda xs: [x for x in xs if (x['rush17'] or 0) >= 10]
by_t, by_c = BY(bt), BY(bc)
vc = fitpred(CAR[best_c], bt, bc, lambda x: x['car'])
RUSH = {
    'form: his yards, last 5': lambda x: x['rush5'],
    'form: his yards, last 17': lambda x: x['rush17'],
    'fit: form (yards last 3 / 5 / 10 / 17)': lambda x: [x['rush3'], x['rush5'], x['rush10'], x['rush17']],
    'volume read × his yards a carry': lambda x: max(0.0, vc(x)) * x['ypc'],
    'fit: form + volume read × yards a carry': lambda x: [x['rush3'], x['rush5'], x['rush10'], x['rush17'], max(0.0, vc(x)) * x['ypc']],
    'ceiling: his real carries tonight × his yards a carry': lambda x: x['car'] * x['ypc'],
}
study('rushing yards', by_t, by_c, lambda x: x['rushYds'], (10, 20, 30), RUSH, 'fit: form (yards last 3 / 5 / 10 / 17)')

# --- 4. the games with a teammate missing: does the volume read help where it should?
def split(name, rows, y_of, base, new, tol):
    for lab, flt in (('a same-group teammate missing (his share 10%+)', lambda x: x['miss_same_tgt' if name == 'targets' else 'miss_same_car'] >= 0.10), ('nobody missing', lambda x: x['miss_tgt' if name == 'targets' else 'miss_car'] < 0.02)):
        xs = [x for x in rows if flt(x)]
        if len(xs) < 20: continue
        y = np.array([y_of(x) for x in xs], float)
        a = cases(np.array([base(x) for x in xs]), y, tol); b = cases(np.array([new(x) for x in xs]), y, tol)
        print(f"  {name}, {lab} ({len(xs)}):\n      form      {fmt(a, tol)}\n      volume    {fmt(b, tol)}")
        report.setdefault('split', {})[f'{name} | {lab}'] = {'n': len(xs), 'form': a, 'volume': b}
print('\n=== where a teammate is missing')
split('targets', rc, lambda x: x['tgt'], lambda x: x['tgt5'], vt, (1, 2, 4))
split('carries', bc, lambda x: x['car'], lambda x: x['car5'], vc, (2, 4, 7))
# examples: the biggest moves the volume read made over his last 5, and what happened
print('\n=== the volume read\'s biggest calls over his own last five (targets), 2026')
moves = sorted(rc, key=lambda x: -abs(vt(x) - x['tgt5']))[:12]
for x in moves:
    print(f"  {x['tag']} {x['key']:24s} {x['team']}: last 5 {x['tgt5']:.1f}, volume read {vt(x):.1f}, got {x['tgt']:.0f} · missing: {', '.join(x['missing'][:3]) or '—'}")
if OUT: json.dump(report, open(OUT, 'w'), indent=1)

# --- 5. the hand-over, damped: his own last five lifted by λ × the share his missing same-group teammates leave
#     (lib/picks/injuries.js vacatedLifts on the NFL board: VACATED_SHARE 0.6 of an out player's rate to the teammates)
print('\n=== the missing teammates\' share handed over at λ, on his own last five')
for nm, rows, own, miss, y_of, tol in (('targets', rc, 'tgt5', 'miss_same_tgt', lambda x: x['tgt'], (1, 2, 4)), ('carries', bc, 'car5', 'miss_same_car', lambda x: x['car'], (2, 4, 7))):
    y = np.array([y_of(x) for x in rows], float); base = None
    hit = [x for x in rows if x[miss] >= 0.10]; yh = np.array([y_of(x) for x in hit], float)
    for lam in (0, 0.1, 0.2, 0.3, 0.45, 0.6, 1.0):
        f = lambda x: x[own] * (1 + lam * min(x[miss], 0.6) / (1 - min(x[miss], 0.6)))
        p = np.array([f(x) for x in rows]); c = cases(p, y, tol); ch = cases(np.array([f(x) for x in hit]), yh, tol)
        close = (np.abs(y - p) <= tol[0]).astype(float)
        if base is None: base = close
        lo, hi = boot(close - base)
        report.setdefault('handover', {})[f'{nm} λ={lam}'] = {'all': c, 'missing': ch, 'close_vs_0': [float((close - base).mean()), lo, hi]}
        print(f"  {nm} λ={lam:<4} all: {fmt(c, tol)} | with a teammate missing ({len(hit)}): close {ch['close']*100:4.1f}% way off {ch['way_off']*100:4.1f}%")
if OUT: json.dump(report, open(OUT, 'w'), indent=1)

# --- 6. the without split, as the board reads it: his last five moved toward his games without tonight's missing at n / (n + 4)
print('\n=== the without split (his games this season without tonight\'s missing teammates), on his own last five')
for nm, rows, own, wo, y_of, tol in (('targets', rc, 'tgt5', 'wo_tgt', lambda x: x['tgt'], (1, 2, 4)), ('carries', bc, 'car5', 'wo_car', lambda x: x['car'], (2, 4, 7))):
    xs = [x for x in rows if x['wo_n'] >= 1 and x[wo] is not None]
    y = np.array([y_of(x) for x in xs], float)
    b0 = (np.abs(y - np.array([x[own] for x in xs])) <= tol[0]).astype(float)
    b4 = (np.abs(y - np.array([x[own] + x['wo_n'] / (x['wo_n'] + 4) * (x[wo] - x[own]) for x in xs])) <= tol[0]).astype(float)
    lo, hi = boot(b4 - b0); print(f"  {nm}: the board's split (n / (n + 4)) against his last five alone, close {(b4 - b0).mean()*100:+.1f} points [{lo*100:+.1f}, {hi*100:+.1f}]")
    for k in (None, 8, 4, 2):
        f = (lambda x: x[own]) if k is None else (lambda x, k=k: x[own] + x['wo_n'] / (x['wo_n'] + k) * (x[wo] - x[own]))
        c = cases(np.array([f(x) for x in xs]), y, tol)
        report.setdefault('without', {})[f'{nm} k={k}'] = {'n': len(xs), **c}
        print(f"  {nm} ({len(xs)} games with a split) {'last five alone' if k is None else 'split at n / (n + ' + str(k) + ')':22s} {fmt(c, tol)}")
if OUT: json.dump(report, open(OUT, 'w'), indent=1)

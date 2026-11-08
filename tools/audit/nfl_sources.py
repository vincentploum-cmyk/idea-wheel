# PropFinder's new NFL pages, measured against the board as shipped (docs/audits/2026-11-08-nfl-sources.md; Vincent,
# 2026-11-08: "now we have added several new data sources from NFL, analyze and redo our logic to determine rushing,
# passing, receiving props as well as TDs").
#
# The pages (lib/nfl/propfinder-nfl.js `pages`) are kept from 2026-11-08 on: one snapshot each, no week of them graded yet.
# Their numbers are season-to-date sums of what PropFinder's game rows already carry, so every week of 2025 and 2026 is
# rebuilt here from the rows cut before it (the page as it would have read that morning):
#   Team Share       his share of the side's targets, carries, red-zone targets and carries (PropFinder's own `tgtShare`
#                    / `rushShare` on each row, the red-zone counts summed by side)
#   Role Matchups    the opponent's table by slot (WR1 … RB2): the board reads it already (`envPos`)
#   TD Matchups      the opponent's touchdowns allowed by position and its red-zone trips allowed (leagueTeamStats)
#   Rushing Matchups the opponent's yards a carry allowed to backs, its carries faced
#   Milestones       his own record at the mark (the hit rates): the board's rate reads the same games
#   WR vs CB, receiver coverage splits: alignment and coverage by play, in no game row; not rebuildable, not graded.
# Every piece is fitted on 2025's weeks 4–18 on top of the board's figure (least absolute deviation for the yards, the
# game he is likeliest to have; logistic for the touchdowns) and scored unchanged on 2026's weeks 1–8, case by case,
# against the board as shipped (a paired bootstrap's 95% interval).
#
#   node --import ./tools/audit/register.mjs tools/audit/nfl-pf-audit.mjs --pf .nhl-data/audit/nfl-pf --raw .nhl-data/audit/nfl --dump --check-to 8
#   python3 -I tools/audit/nfl_sources.py [--audit .nhl-data/audit] [--json out.json]
import json, gzip, glob, re, sys, collections as C
import numpy as np
from scipy.optimize import minimize

arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
ROOT = arg('--audit', '.nhl-data/audit'); DUMP = arg('--dump', f'{ROOT}/out'); OUT = arg('--json'); CHECK_TO = int(arg('--check-to', '8'))
mean = lambda xs: (sum(xs) / len(xs)) if xs else None
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
        gid = str(j['header']['id']); date = c['date']
        pc = next((p for p in j.get('pickcenter', []) if p.get('overUnder') and p.get('details')), None) or j.get('coreOdds')
        total = fav_home = None
        if pc and pc.get('overUnder') and pc.get('details'):
            total = float(pc['overUnder']); m = re.match(r'([A-Z]+)\s*([-+]?\d+(\.\d+)?)', pc['details'])
            fav_home = (abs(float(m.group(2))) / 2 * (1 if m.group(1) == t['home'] else -1)) if m else 0.0
        games[gid] = dict(id=gid, season=season, week=wk.get(gid), date=date, day=date[:10], home=t['home'], away=t['away'], total=total, fav_home=fav_home)
        # PropFinder dates a game by its UTC day; ESPN's date is UTC too
        opp_of[(date[:10], t['home'])] = (t['away'], gid); opp_of[(date[:10], t['away'])] = (t['home'], gid)
print('ESPN games', C.Counter(g['season'] for g in games.values()), file=sys.stderr)

# --- PropFinder: every skill player's rows (the newest pull's copy of a game wins)
STATS = ['passYds', 'passAtt', 'passTd', 'rushYds', 'rushAtt', 'rushTd', 'rec', 'recYds', 'recTd', 'tgt', 'rzAtt', 'rzTgt',
         'airYds', 'yac', 'passAirYds', 'sacked', 'passRzAtt', 'rushLong', 'recLong', 'retTd']
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
        r['pfTgtShare'] = g.get('tgtShare'); r['pfRushShare'] = g.get('rushShare')
        r.update(pid=q['id'], key=q['key'], pos=q['pos'], date=date, opp=opp, season=g.get('season'))
        r['td'] = r['rushTd'] + r['recTd'] + r['retTd']
        r['active'] = (r['rushAtt'] + r['tgt'] + r['passAtt'] + r['rec']) > 0
        o = opp_of.get((date, opp)); r['team'], r['gid'] = (o if o else (None, None))
        rows.append(r)
by_pid = C.defaultdict(list)
for r in rows: by_pid[r['pid']].append(r)
for k in by_pid: by_pid[k].sort(key=lambda r: r['date'], reverse=True)
placed = [r for r in rows if r['gid']]
print('PropFinder rows', len(rows), 'placed', len(placed), file=sys.stderr)

# --- the side's game: its targets, carries, red-zone looks, passing (Team Share's denominators)
side = C.defaultdict(lambda: C.defaultdict(float))
for r in placed:
    s = side[(r['gid'], r['team'])]
    s['tgt'] += r['tgt']; s['car'] += r['rushAtt']; s['rbcar'] += r['rushAtt'] if r['pos'] == 'RB' else 0
    s['rzTgt'] += r['rzTgt']; s['rzAtt'] += r['rzAtt']; s['passAtt'] += r['passAtt']; s['passYds'] += r['passYds']
    s['airYds'] += r['airYds']; s['sacked'] += r['sacked']; s['td'] += r['rushTd'] + r['recTd']; s['passRzAtt'] += r['passRzAtt']
    s['rushYds'] += r['rushYds']; s['rbRushYds'] += r['rushYds'] if r['pos'] == 'RB' else 0
    s['tdPos_' + r['pos']] += r['rushTd'] + r['recTd']; s['recYdsPos_' + r['pos']] += r['recYds']; s['tgtPos_' + r['pos']] += r['tgt']
    s['n'] += 1
# a side's game counts when the pull covers it (a team throws 25–45 times)
ok_side = lambda s: s['tgt'] >= 15 and s['car'] >= 8
team_games = C.defaultdict(list)   # (season, team) → [(day, side)] the team's own games
opp_games = C.defaultdict(list)    # (season, team) → [(day, side)] what its opponents did against it
for (gid, team), s in side.items():
    if not ok_side(s): continue
    g = games[gid]; opp = g['home'] if team == g['away'] else g['away']
    team_games[(g['season'], team)].append((g['day'], s)); opp_games[(g['season'], opp)].append((g['day'], s))

def before(lst, day, n=None):
    xs = sorted([s for d, s in lst if d < day], key=lambda s: 0)
    return xs
def avg_of(lst, day, k, last=None):
    xs = [(d, s) for d, s in lst if d < day]
    xs.sort(key=lambda t: t[0], reverse=True)
    if last: xs = xs[:last]
    return (mean([s[k] for _, s in xs]), len(xs)) if xs else (None, 0)
def ratio_of(lst, day, a, b):
    xs = [s for d, s in lst if d < day]
    A = sum(s[a] for s in xs); B = sum(s[b] for s in xs)
    return (A / B if B > 0 else None, len(xs))
LEAGUE = {}
def league(season, day, k, b=None):
    """The league's figure before `day`: a per-game mean (b None) or a ratio a / b across every defense's games."""
    key = (season, day, k, b)
    if key not in LEAGUE:
        xs = [s for lst in (v for (s0, _), v in opp_games.items() if s0 == season) for d, s in lst if d < day]
        LEAGUE[key] = (sum(s[k] for s in xs) / sum(s[b] for s in xs) if b and sum(s[b] for s in xs) > 0 else (mean([s[k] for s in xs]) if xs else None))
    return LEAGUE[key]
def damp(val, lg, gp, k=8, mn=3):
    return ((val / lg - 1) * gp / (gp + k)) if val is not None and lg and gp >= mn else 0.0

# --- the board as shipped (the replay's dump)
board = {}; board_td = {}
for x in json.load(open(f'{DUMP}/nfl-board-rows.json')): board[(x['tag'], x['key'], x['team'], x['m'])] = x
for x in json.load(open(f'{DUMP}/nfl-board-tds.json')): board_td[(x['tag'], x['key'], x['team'])] = x
print('board rows', len(board), 'td rows', len(board_td), file=sys.stderr)

POS_YPT = {}; POS_YPC = {}
for pos in ('WR', 'TE', 'RB', 'QB'):
    xs = [r for r in placed if r['pos'] == pos and r['season'] == 2024]
    POS_YPT[pos] = sum(r['recYds'] for r in xs) / max(1, sum(r['tgt'] for r in xs)); POS_YPC[pos] = sum(r['rushYds'] for r in xs) / max(1, sum(r['rushAtt'] for r in xs))

# --split 2024: fit on 2024's weeks 6–18, score on 2025's weeks 4–18 (the same pieces a season earlier)
SPLIT = arg('--split')
# --split pooled: fit on 2024 and 2025 together, score on 2026
FIT_S, CHK_S = ((2024,), 2025) if SPLIT == '2024' else ((2024, 2025), 2026) if SPLIT == 'pooled' else ((2025,), 2026)
def in_window(g):
    return g['week'] and ((g['season'] == 2024 and 6 <= g['week'] <= 18) or (g['season'] == 2025 and 4 <= g['week'] <= 18) or (g['season'] == 2026 and g['week'] <= CHECK_TO))

data = []
for r in placed:
    if not r['active']: continue
    g = games[r['gid']]
    if not in_window(g): continue
    own = [x for x in by_pid[r['pid']] if x['date'] < r['date'] and x['active']]
    if len(own) < 3: continue
    cur = [x for x in own if x['season'] == g['season']]
    tag = f"{g['season']}w{g['week']}"; S = g['season']; day = r['date']; opp = r['opp']; team = r['team']
    f = dict(tag=tag, season=S, week=g['week'], pos=r['pos'], key=r['key'], team=team, opp=opp,
             recYds=r['recYds'], rushYds=r['rushYds'], passYds=r['passYds'], passAtt=r['passAtt'], tgt=r['tgt'], car=r['rushAtt'], rec=r['rec'],
             td=1 if r['td'] > 0 else 0)
    w5 = own[:5]; w17 = own[:17]
    # Team Share: his share of the side's targets / carries / red-zone looks (PropFinder's own share on the row first)
    def shares(xs, k):
        out = []
        for x in xs:
            s = side.get((x['gid'], x['team'])) if x['gid'] else None
            if k == 'tgt':
                # PropFinder's own share on the row only (as the site reads it: lib/nfl/projections.js tgtShareRead)
                v = x['pfTgtShare'] if isinstance(x['pfTgtShare'], (int, float)) else None
            elif k == 'car':
                v = x['pfRushShare'] if isinstance(x['pfRushShare'], (int, float)) else (x['rushAtt'] / s['car'] if s and s['car'] >= 8 else None)
            elif k == 'rz':
                t = (s['rzTgt'] + s['rzAtt']) if s else 0
                v = (x['rzTgt'] + x['rzAtt']) / t if t >= 3 else None
            elif k == 'air':
                v = x['airYds'] / s['airYds'] if s and s['airYds'] >= 40 else None
            if v is not None: out.append(v)
        return out
    for k in ('tgt', 'car', 'rz', 'air'):
        a5 = shares(w5, k); a17 = shares(w17, k); ac = shares(cur, k)
        f[f'sh_{k}5'] = mean(a5); f[f'sh_{k}17'] = mean(a17); f[f'sh_{k}s'] = mean(ac) if ac else mean(a5)
    # his team's volume this season before the game (its own games; last season's when it has none yet)
    tg = team_games[(S, team)] if any(d < day for d, _ in team_games[(S, team)]) else team_games[(S - 1, team)]
    for k in ('tgt', 'car', 'rbcar', 'passAtt', 'rzTgt', 'rzAtt', 'airYds', 'td'):
        f[f'team_{k}'], f['team_gp'] = avg_of(tg, day, k)
    # the opponent: what it allowed this season before the game (TD / Rushing / Role matchups rebuilt)
    og = opp_games[(S, opp)]
    def odef(k, b=None, last=None):
        if b: v, gp = ratio_of(og, day, k, b); lg = league(S, day, k, b)
        else: v, gp = avg_of(og, day, k, last); lg = league(S, day, k)
        return damp(v, lg, gp)
    f['def_ypc'] = odef('rbRushYds', 'rbcar'); f['def_rbcar'] = odef('rbcar'); f['def_ypa'] = odef('passYds', 'passAtt')
    f['def_passAtt'] = odef('passAtt'); f['def_rz'] = odef('rzAtt') + 0.0; f['def_rzAll'] = odef('rzTgt') ; f['def_td'] = odef('td')
    f['def_tdPos'] = odef('tdPos_' + r['pos']); f['def_recPos'] = odef('recYdsPos_' + r['pos']); f['def_ypt'] = odef('recYdsPos_' + r['pos'], 'tgtPos_' + r['pos'])
    f['def_sacks'] = odef('sacked')
    # his own efficiency, shrunk to his position
    t17 = sum(x['tgt'] for x in w17); c17 = sum(x['rushAtt'] for x in w17)
    f['ypt'] = (sum(x['recYds'] for x in w17) + 40 * POS_YPT[r['pos']]) / (t17 + 40)
    f['ypc'] = (sum(x['rushYds'] for x in w17) + 60 * POS_YPC[r['pos']]) / (c17 + 60)
    rec17 = sum(x['rec'] for x in w17)
    f['yac_share'] = (sum(x['yac'] for x in w17) / max(1.0, sum(x['recYds'] for x in w17))) if rec17 >= 5 else None
    f['tgt5'] = mean([x['tgt'] for x in w5]); f['car5'] = mean([x['rushAtt'] for x in w5]); f['rz5'] = mean([x['rzAtt'] + x['rzTgt'] for x in w5])
    f['rec17'] = mean([x['recYds'] for x in w17]); f['rush17'] = mean([x['rushYds'] for x in w17])
    # quarterback: his starts' volume, completed air yards a throw, sacks
    starts = [x for x in own if x['passAtt'] >= 10][:17]
    f['qb_starts'] = len(starts)
    if starts:
        f['qb_att'] = mean([x['passAtt'] for x in starts]); f['qb_ypa'] = sum(x['passYds'] for x in starts) / max(1, sum(x['passAtt'] for x in starts))
        f['qb_air'] = sum(x['passAirYds'] for x in starts) / max(1, sum(x['passAtt'] for x in starts)); f['qb_sacked'] = mean([x['sacked'] for x in starts])
        f['qb_rzAtt'] = mean([x['passRzAtt'] for x in starts])
    fav = 0.0
    if g['fav_home'] is not None: fav = g['fav_home'] if team == g['home'] else -g['fav_home']
    f['fav'] = fav; f['total'] = g['total'] if g['total'] else 44.5; f['implied'] = f['total'] / 2 + fav
    for m in ('rec_yds', 'rush_yds', 'pass_yds', 'receptions'):
        b = board.get((tag, r['key'], team, m)); f[f'b_{m}'] = b['proj'] if b else None; f[f'sd_{m}'] = b['sd'] if b else None
    bt = board_td.get((tag, r['key'], team)); f['b_td'] = bt['p'] if bt else None
    data.append(f)
print('player-games', C.Counter(x['season'] for x in data), file=sys.stderr)

nz = lambda v, d=0.0: v if v is not None else d
def boot(d, B=3000, seed=1):
    rng = np.random.default_rng(seed); n = len(d); bs = [d[rng.integers(0, n, n)].mean() for _ in range(B)]
    return float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))
def cases(pred, y, tol):
    e = np.abs(y - pred); return dict(n=int(len(y)), close=float(np.mean(e <= tol)), way_off=float(np.mean(e > 3 * tol)), mae=float(np.mean(e)), bias=float(np.mean(y - pred)))
def lad(X, y):
    """Least absolute deviation, by iteratively reweighted least squares."""
    w = np.ones(len(y)); beta = None
    for _ in range(60):
        W = np.sqrt(w)[:, None]; beta = np.linalg.lstsq(X * W, y * W[:, 0], rcond=None)[0]
        res = np.abs(y - X @ beta); w = 1 / np.maximum(res, 1.0)
    return beta
report = {'check_to': CHECK_TO, 'yards': {}, 'td': {}}

# ================= the yards =================
# Each market: who is graded (the board's list), the target, the tolerance of a close call, the features to try on top.
SPECS = {
    'rec_yds': dict(y='recYds', tol=10, keep=lambda x: x['pos'] in ('WR', 'TE', 'RB') and nz(x['b_rec_yds']) >= 10,
                    feats={
                        'Team Share: targets (share × side)': lambda x: nz(x['sh_tgt5']) * nz(x['team_tgt'], 32) * x['ypt'] - x['b_rec_yds'],
                        'Team Share: target share (L5)': lambda x: nz(x['sh_tgt5']),
                        'Team Share: target share (season)': lambda x: nz(x['sh_tgts']),
                        'Team Share: red-zone share': lambda x: nz(x['sh_rz5']),
                        'air-yards share (completed)': lambda x: nz(x['sh_air5']),
                        'his yards after catch share': lambda x: nz(x['yac_share'], 0.5) - 0.5,
                        'Role / TD matchups: yards a target allowed at his position': lambda x: x['def_ypt'],
                        'Role matchups: receiving yards allowed at his position': lambda x: x['def_recPos'],
                        'opponent pass attempts faced': lambda x: x['def_passAtt'],
                        'opponent sacks': lambda x: x['def_sacks'],
                        'team pass attempts a game': lambda x: nz(x['team_passAtt'], 33) - 33,
                        'implied points': lambda x: x['implied'] - 22,
                        'spread (favourite +)': lambda x: x['fav'],
                    }),
    'receptions': dict(y='rec', tol=1.5, keep=lambda x: x['pos'] in ('WR', 'TE', 'RB') and nz(x['b_receptions']) >= 1,
                       feats={
                           'Team Share: target share (L5)': lambda x: nz(x['sh_tgt5']),
                           'Team Share: target share (season)': lambda x: nz(x['sh_tgts']),
                           'Team Share: targets (share × side)': lambda x: nz(x['sh_tgt5']) * nz(x['team_tgt'], 32) - x['b_receptions'],
                           'opponent pass attempts faced': lambda x: x['def_passAtt'],
                           'implied points': lambda x: x['implied'] - 22,
                           'spread (favourite +)': lambda x: x['fav'],
                       }),
    'rush_yds': dict(y='rushYds', tol=10, keep=lambda x: x['pos'] == 'RB' and nz(x['b_rush_yds']) >= 10,
                     feats={
                         'Team Share: carries (share × side)': lambda x: nz(x['sh_car5']) * nz(x['team_car'], 26) * x['ypc'] - x['b_rush_yds'],
                         'Team Share: carries (season share × side)': lambda x: nz(x['sh_cars']) * nz(x['team_car'], 26) * x['ypc'] - x['b_rush_yds'],
                         'Team Share: carry share (L5)': lambda x: nz(x['sh_car5']),
                         'Team Share: carry share (season)': lambda x: nz(x['sh_cars']),
                         'Team Share: red-zone share': lambda x: nz(x['sh_rz5']),
                         'Rushing matchups: yards a carry allowed to backs': lambda x: x['def_ypc'],
                         'Rushing matchups: backs\' carries faced': lambda x: x['def_rbcar'],
                         'implied points': lambda x: x['implied'] - 22,
                         'spread (favourite +)': lambda x: x['fav'],
                     }),
    'pass_yds': dict(y='passYds', tol=25, keep=lambda x: x['pos'] == 'QB' and nz(x['b_pass_yds']) >= 100 and x['qb_starts'] >= 1 and x['passAtt'] >= 15,
                     feats={
                         'his attempts a start': lambda x: nz(x.get('qb_att'), 32) - 32,
                         'his completed air yards a throw': lambda x: nz(x.get('qb_air'), 4) - 4,
                         'his sacks a start': lambda x: nz(x.get('qb_sacked'), 2.3) - 2.3,
                         'opponent yards a pass allowed': lambda x: x['def_ypa'],
                         'opponent pass attempts faced': lambda x: x['def_passAtt'],
                         'opponent sacks': lambda x: x['def_sacks'],
                         'team pass attempts a game': lambda x: nz(x['team_passAtt'], 33) - 33,
                     }),
}

def fit_on_top(tune, chk, m, spec, names):
    """y = c + b · board + Σ w · feature (LAD on 2025), scored on 2026 against the board as shipped."""
    yt = np.array([x[spec['y']] for x in tune]); yc = np.array([x[spec['y']] for x in chk])
    Xt = np.column_stack([np.ones(len(tune)), [x[f'b_{m}'] for x in tune]] + [[spec['feats'][n](x) for x in tune] for n in names])
    Xc = np.column_stack([np.ones(len(chk)), [x[f'b_{m}'] for x in chk]] + [[spec['feats'][n](x) for x in chk] for n in names])
    beta = lad(Xt, yt)
    return beta, Xt @ beta, Xc @ beta, yt, yc

for m, spec in SPECS.items():
    rows = [x for x in data if spec['keep'](x) and x[f'b_{m}'] is not None]
    tune = [x for x in rows if x['season'] in FIT_S]; chk = [x for x in rows if x['season'] == CHK_S]
    yt = np.array([x[spec['y']] for x in tune]); yc = np.array([x[spec['y']] for x in chk]); bt = np.array([x[f'b_{m}'] for x in tune]); bc = np.array([x[f'b_{m}'] for x in chk])
    tol = spec['tol']
    print(f"\n=== {m}: fit {len(tune)} ({FIT_S}), check {len(chk)} ({CHK_S}); close = within ±{tol}")
    out = {'board': {'tune': cases(bt, yt, tol), 'check': cases(bc, yc, tol)}, 'pieces': {}}
    print(f"  {'the board as shipped':62s} tune MAE {out['board']['tune']['mae']:6.2f}  check MAE {out['board']['check']['mae']:6.2f} close {out['board']['check']['close']*100:4.1f}%")
    # the board re-scaled alone (c + b × board), so a piece is credited only for what it adds
    beta0, pt0, pc0, _, _ = fit_on_top(tune, chk, m, spec, [])
    def score(name, beta, pt, pc):
        d_mae = np.abs(yc - pc) - np.abs(yc - bc); lo, hi = boot(d_mae)
        d_close = (np.abs(yc - pc) <= tol).astype(float) - (np.abs(yc - bc) <= tol).astype(float); clo, chi = boot(d_close)
        c = cases(pc, yc, tol); t = cases(pt, yt, tol)
        res = dict(beta=[round(float(b), 4) for b in beta], tune=t, check=c, mae_vs_board=[float(d_mae.mean()), lo, hi], close_vs_board=[float(d_close.mean()), clo, chi])
        print(f"  {name[:62]:62s} tune MAE {t['mae']:6.2f}  check MAE {c['mae']:6.2f} ({d_mae.mean():+.2f}, {lo:+.2f} to {hi:+.2f})  close {c['close']*100:4.1f}% ({d_close.mean()*100:+.1f})")
        return res
    out['pieces']['the board, rescaled (c + b × board)'] = score('the board, rescaled (c + b × board)', beta0, pt0, pc0)
    for name in spec['feats']:
        beta, pt, pc, _, _ = fit_on_top(tune, chk, m, spec, [name])
        out['pieces'][name] = score('+ ' + name, beta, pt, pc)
    # forward selection on 2025 (each step must cut 2025's MAE by 0.05), then scored once on 2026
    chosen = []; best_t = np.mean(np.abs(yt - pt0))
    while True:
        cand = None
        for name in spec['feats']:
            if name in chosen: continue
            beta, pt, pc, _, _ = fit_on_top(tune, chk, m, spec, chosen + [name])
            e = np.mean(np.abs(yt - pt))
            if cand is None or e < cand[0]: cand = (e, name)
        if not cand or best_t - cand[0] < 0.05: break
        chosen.append(cand[1]); best_t = cand[0]
    if chosen:
        beta, pt, pc, _, _ = fit_on_top(tune, chk, m, spec, chosen)
        out['pieces']['selected on 2025: ' + ' + '.join(chosen)] = score('selected: ' + ' + '.join(chosen), beta, pt, pc)
    out['selected'] = chosen
    report['yards'][m] = out

# ================= the touchdowns =================
def logit(p): p = np.clip(p, 1e-3, 1 - 1e-3); return np.log(p / (1 - p))
def fit_logit(X, y, l2=1e-3):
    def nll(b):
        z = X @ b; p = 1 / (1 + np.exp(-z)); p = np.clip(p, 1e-6, 1 - 1e-6)
        return -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)) + l2 * np.sum(b[1:] ** 2)
    return minimize(nll, np.zeros(X.shape[1]), method='BFGS').x
TDF = {
    'TD Matchups: touchdowns allowed at his position': lambda x: x['def_tdPos'],
    'TD Matchups: touchdowns allowed in all': lambda x: x['def_td'],
    'TD Matchups: red-zone carries allowed': lambda x: x['def_rz'],
    'TD Matchups: red-zone targets allowed': lambda x: x['def_rzAll'],
    'Team Share: red-zone share (L5)': lambda x: nz(x['sh_rz5']),
    'Team Share: red-zone share (season)': lambda x: nz(x['sh_rzs']),
    'Team Share: red-zone share × team red-zone looks': lambda x: nz(x['sh_rz5']) * (nz(x['team_rzTgt'], 4) + nz(x['team_rzAtt'], 4)),
    'Team Share: target share (L5)': lambda x: nz(x['sh_tgt5']),
    'Team Share: carry share (L5)': lambda x: nz(x['sh_car5']),
    'team touchdowns a game': lambda x: nz(x['team_td'], 2.3) - 2.3,
    'spread (favourite +)': lambda x: x['fav'],
}
td_rows = [x for x in data if x['b_td'] is not None and x['pos'] in ('RB', 'WR', 'TE')]
tune = [x for x in td_rows if x['season'] in FIT_S]; chk = [x for x in td_rows if x['season'] == CHK_S]
yt = np.array([x['td'] for x in tune], float); yc = np.array([x['td'] for x in chk], float)
pt_b = np.array([x['b_td'] for x in tune]); pc_b = np.array([x['b_td'] for x in chk])
brier = lambda p, y: float(np.mean((p - y) ** 2))
def top6(p, rows_):
    by = C.defaultdict(list)
    for i, x in enumerate(rows_): by[x['tag']].append(i)
    hits = []
    for t, idx in by.items():
        idx = sorted(idx, key=lambda i: -p[i])[:6]; hits += [rows_[i]['td'] for i in idx]
    return float(np.mean(hits)), len(hits)
print(f"\n=== anytime TD (RB / WR / TE): fit {len(tune)}, check {len(chk)}")
print(f"  {'the board as shipped (TD_CAL + the engine)':62s} tune Brier {brier(pt_b, yt):.4f}  check Brier {brier(pc_b, yc):.4f}  top-6 {top6(pc_b, chk)[0]*100:4.1f}%")
tdout = {'board': {'tune': brier(pt_b, yt), 'check': brier(pc_b, yc), 'top6': top6(pc_b, chk)}, 'pieces': {}}
def td_fit(names):
    Xt = np.column_stack([np.ones(len(tune)), logit(pt_b)] + [[TDF[n](x) for x in tune] for n in names])
    Xc = np.column_stack([np.ones(len(chk)), logit(pc_b)] + [[TDF[n](x) for x in chk] for n in names])
    b = fit_logit(Xt, yt); return b, 1 / (1 + np.exp(-(Xt @ b))), 1 / (1 + np.exp(-(Xc @ b)))
def td_score(name, b, pt, pc):
    d = (pc - yc) ** 2 - (pc_b - yc) ** 2; lo, hi = boot(d)
    t6 = top6(pc, chk)
    print(f"  {name[:62]:62s} tune Brier {brier(pt, yt):.4f}  check Brier {brier(pc, yc):.4f} ({d.mean():+.4f}, {lo:+.4f} to {hi:+.4f})  top-6 {t6[0]*100:4.1f}%")
    return dict(beta=[round(float(v), 4) for v in b], tune=brier(pt, yt), check=brier(pc, yc), vs_board=[float(d.mean()), lo, hi], top6=t6)
b0, pt0, pc0 = td_fit([]); tdout['pieces']['the board, recalibrated'] = td_score('the board, recalibrated', b0, pt0, pc0)
for name in TDF:
    b, pt, pc = td_fit([name]); tdout['pieces'][name] = td_score('+ ' + name, b, pt, pc)
chosen = []; best_t = brier(pt0, yt)
while True:
    cand = None
    for name in TDF:
        if name in chosen: continue
        b, pt, pc = td_fit(chosen + [name]); e = brier(pt, yt)
        if cand is None or e < cand[0]: cand = (e, name)
    if not cand or best_t - cand[0] < 0.0002: break
    chosen.append(cand[1]); best_t = cand[0]
if chosen:
    b, pt, pc = td_fit(chosen); tdout['pieces']['selected on 2025: ' + ' + '.join(chosen)] = td_score('selected: ' + ' + '.join(chosen), b, pt, pc)
tdout['selected'] = chosen
report['td'] = tdout

if OUT:
    json.dump(report, open(OUT, 'w'), indent=1)
    print('wrote', OUT, file=sys.stderr)

# ================= what ships: the target share on the receiving read, the ladder on it =================
# proj = c + b · board + w · his target share over his last five games (PropFinder's tgtShare on each row: Team Share's
# number as it read before the game), fitted on FIT_S; the ladder's curve (RESID) refitted on the new projection's misses
# in his spread, the rungs scored on CHK_S.
RESID_SHIPPED = {'rec_yds': [-1.087, -0.897, -0.766, -0.643, -0.529, -0.429, -0.318, -0.218, -0.118, -0.001, 0.125, 0.262, 0.41, 0.589, 0.779, 1.031, 1.331, 1.746, 2.432],
                 'receptions': [-1.61, -1.327, -1.151, -1.007, -0.867, -0.741, -0.605, -0.486, -0.342, -0.218, -0.111, 0, 0.183, 0.357, 0.536, 0.742, 1.021, 1.348, 2.024]}
def cdf(q, z):
    if z <= q[0]: return max(0.01, 0.05 - 0.05 * (q[0] - z) / max(1e-6, q[1] - q[0]))
    if z >= q[18]: return min(0.99, 0.95 + 0.05 * (z - q[18]) / max(1e-6, q[18] - q[17]))
    for i in range(18):
        if z <= q[i + 1]: return 0.05 * (i + 1) + 0.05 * (z - q[i]) / max(1e-6, q[i + 1] - q[i])
def tiers(proj, sd, q, step0):
    if proj is None or not sd: return {}
    step = 5 if (step0 == 10 and proj < 40) else step0
    marks = []; mk = step
    while mk <= proj + 3 * sd: marks.append((mk, 1 - cdf(q, (mk - 0.5 - proj) / sd))); mk += step
    out = {}; used = set()
    for t, at in (('strong', .6), ('lean', .45), ('thin', .3)):
        b = [x for x in marks if x[1] >= at]
        if b and b[-1][0] not in used: out[t] = b[-1]
        if b: used.add(b[-1][0])
    return out
def rungs(rows_, proj, q, ycol, step):
    acc = C.defaultdict(lambda: [0, 0.0, 0])
    for x, p in zip(rows_, proj):
        for t, (mk, pr) in tiers(p, x[f"sd_{m}"], q, step).items():
            a = acc[t]; a[0] += 1; a[1] += pr; a[2] += 1 if x[ycol] >= mk else 0
    return {t: dict(n=a[0], said=round(a[1] / a[0], 3), landed=round(a[2] / a[0], 3)) for t, a in acc.items() if a[0]}
SHIP = {}
for m, ycol, step in (('rec_yds', 'recYds', 10), ('receptions', 'rec', 1)):
    spec = SPECS[m]; name = 'Team Share: target share (L5)'
    rows = [x for x in data if spec['keep'](x) and x[f'b_{m}'] is not None and x[f'sd_{m}']]
    tune = [x for x in rows if x['season'] in FIT_S]; chk = [x for x in rows if x['season'] == CHK_S]
    beta, pt, pc, yt, yc = fit_on_top(tune, chk, m, spec, [name])
    z = (yt - pt) / np.array([x[f'sd_{m}'] for x in tune]); q = [round(float(v), 3) for v in np.percentile(z, np.arange(5, 100, 5))]
    bc = np.array([x[f'b_{m}'] for x in chk])
    SHIP[m] = dict(beta=[round(float(b), 4) for b in beta], resid=q,
                   rungs_board=rungs(chk, bc, RESID_SHIPPED[m], ycol, step), rungs_new_shipped_curve=rungs(chk, pc, RESID_SHIPPED[m], ycol, step),
                   rungs_new_refit_curve=rungs(chk, pc, q, ycol, step))
    print(f"\n=== ships: {m} = {beta[0]:.3f} + {beta[1]:.4f} × board + {beta[2]:.3f} × target share (L5)")
    for k in ('rungs_board', 'rungs_new_shipped_curve', 'rungs_new_refit_curve'): print(f"  {k:26s}", SHIP[m][k])
    print('  RESID refit', q)
report['ship'] = SHIP
if OUT: json.dump(report, open(OUT, 'w'), indent=1)

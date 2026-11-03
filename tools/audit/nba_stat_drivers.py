"""What predicts each NBA stat best: points, rebounds, assists, threes, one at a time.

Vincent, 2026-11-03: "what can predict threes the best, rebounds the best, points the best and assists the
best? I expect that our rules need to be slightly different for all categories (maybe for threes we need to
look at h2h results, but for rebounds we should look more at the environment and for points we might rely
more on recent performance)."

Every row is a player-game, every read built from the games before its date (ESPN's box scores, the regular
season, `tools/audit/nba-box-fetch.mjs`). Three questions per stat:
  1. His own record: how far back to look (fixed windows, decayed averages at every half-life, per game or
     per minute × his minutes, attempts × percentage for threes).
  2. On top of the best own read, what moves tonight's figure: the opponent at his position (season, last
     ten), the opponent in all, pace, the rebounds on offer, the opponent's threes allowed, his teammates out,
     home, rest, his venue split, his head to head with the opponent. A Poisson fit with his own read as the
     offset gives each read's elasticity; fitted on one season, scored unchanged on the next.
  3. The head to head against a control: his miss in past meetings with tonight's opponent against his miss
     in games at the same distance in time against other teams.

  python3 -I tools/audit/nba_stat_drivers.py --box .nhl-data/audit/nba-box --out docs/audits/2026-11-03-nba-stat-drivers-tables.md

--box holds <ESPN season label>/<eventId>.json (2024 = 2023-24). The first season is history only; the next
is the fit, the rest are checks. Needs numpy, pandas, scipy.
"""
import argparse, bisect, glob, json, math, os, pickle
from collections import defaultdict, deque
from datetime import date as D
import numpy as np, pandas as pd
from scipy.special import gammaln

ap = argparse.ArgumentParser()
ap.add_argument('--box', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--rebuild', action='store_true')
ap.add_argument('--board', nargs='*', default=[], help="nba-audit.mjs rows (-rows.csv): the site's whole board, compared on the same player-games")
ap.add_argument('--min-l10', type=float, default=15.0, help='rotation players: his last ten at this many minutes or more')
args = ap.parse_args()

STATS = ['pts', 'reb', 'ast', 'tpm']
NAME = {'pts': 'Points', 'reb': 'Rebounds', 'ast': 'Assists', 'tpm': 'Threes'}
VEC = ['min', 'pts', 'reb', 'ast', 'tpm', 'tpa', 'oreb', 'dreb', 'fga', 'fgm', 'fta', 'tov']
VI = {k: i for i, k in enumerate(VEC)}
HLS = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 100]
SHL = [2, 3, 5, 10, 15, 20]
POSG = ['G', 'F', 'C']


def num(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0


def dash(v, i):
    try: return float(str(v).split('-')[i])
    except (TypeError, ValueError, IndexError): return 0.0


def posg(p):
    p = (p or '').upper()
    if p in ('PG', 'SG', 'G'): return 'G'
    if p in ('SF', 'PF', 'F'): return 'F'
    if p == 'C': return 'C'
    return 'F'


# ------------------------------------------------------------------ the box scores
def load(box):
    games = []
    for f in glob.glob(os.path.join(box, '[0-9]*', '*.json')):
        j = json.load(open(f))
        h = j['header']; comp = h['competitions'][0]
        side = {c['homeAway']: c['team']['abbreviation'] for c in comp['competitors']}
        g = dict(id=str(h['id']), date=j['date'], season=int(h['season']['year']), home=side['home'], away=side['away'], players=[])
        for t in j['boxscore'].get('players', []):
            team = t['team']['abbreviation']
            s = (t.get('statistics') or [None])[0]
            if not s: continue
            keys = s.get('keys', [])
            for a in s.get('athletes', []):
                ath = a.get('athlete') or {}
                v = a.get('stats') or []
                if not ath.get('id') or a.get('didNotPlay') or not v: continue
                at = lambda k: v[keys.index(k)] if k in keys and len(v) > keys.index(k) else None
                m = num(at('minutes'))
                if m <= 0: continue
                fg = at('fieldGoalsMade-fieldGoalsAttempted'); tp = at('threePointFieldGoalsMade-threePointFieldGoalsAttempted'); ft = at('freeThrowsMade-freeThrowsAttempted')
                g['players'].append(dict(id=str(ath['id']), name=ath.get('displayName', ''), team=team, opp=side['home'] if team == side['away'] else side['away'],
                                         home=int(team == side['home']), pos=posg((ath.get('position') or {}).get('abbreviation')), starter=int(bool(a.get('starter'))),
                                         min=m, pts=num(at('points')), reb=num(at('rebounds')), ast=num(at('assists')), tov=num(at('turnovers')),
                                         oreb=num(at('offensiveRebounds')), dreb=num(at('defensiveRebounds')), fgm=dash(fg, 0), fga=dash(fg, 1),
                                         tpm=dash(tp, 0), tpa=dash(tp, 1), ftm=dash(ft, 0), fta=dash(ft, 1)))
        if len({p['team'] for p in g['players']}) == 2: games.append(g)
    return sorted(games, key=lambda g: (g['date'], g['id']))


def team_line(ps):
    t = {k: sum(p[k] for p in ps) for k in ('min', 'pts', 'reb', 'ast', 'tpm', 'tpa', 'oreb', 'dreb', 'fga', 'fgm', 'fta', 'tov')}
    t['poss'] = t['fga'] - t['oreb'] + t['tov'] + 0.44 * t['fta']
    t['miss'] = t['fga'] - t['fgm']
    t['pos'] = {p: {s: sum(x[s] for x in ps if x['pos'] == p) for s in ('pts', 'reb', 'ast', 'tpm', 'tpa')} for p in POSG}
    return t


# ------------------------------------------------------------------ the rows
def build(games):
    seasons = sorted({g['season'] for g in games})
    hist = defaultdict(list)                # pid -> [game rows], oldest first
    dec = {}                                # pid -> {hl: (vector sum, weight sum)}
    decS = {}                               # pid -> (season, {hl: (vector sum, weight sum)}): this season's games alone
    decay = {hl: 0.5 ** (1 / hl) for hl in HLS}
    tgames = defaultdict(list)              # (season, team) -> [{own, opp, date}]
    lg = defaultdict(list)                  # season -> [team lines]
    last_date = {}                          # team -> date of its last game
    team_recent = defaultdict(deque)        # team -> last 5 games' {pid: min}
    meet = defaultdict(list)                # (pid, opp) -> [(date, act vector, base vector)]
    rows = []
    prevLeague = None
    for date in sorted({g['date'] for g in games}):
        day = [g for g in games if g['date'] == date]
        season = day[0]['season']
        # the league so far this season, last season's behind it at 60 team-games
        L = lg[season]
        def lgv(fn, fallback):
            prior = fn(prevLeague) if prevLeague else fallback
            return (sum(fn([x]) for x in L) + 60 * prior) / (len(L) + 60)
        def mean_of(key):
            return lambda T: np.mean([x[key] for x in T])
        lgStat = {k: lgv(mean_of(k), d) for k, d in (('pts', 114.0), ('reb', 44.0), ('ast', 26.0), ('tpm', 13.0), ('tpa', 36.0), ('poss', 99.0), ('miss', 47.0), ('oreb', 11.0), ('fga', 89.0), ('fgm', 42.0))}
        lgPos = {p: {s: lgv((lambda T, p=p, s=s: np.mean([x['pos'][p][s] for x in T])), {'pts': 45, 'reb': 17, 'ast': 10, 'tpm': 5, 'tpa': 14}[s]) for s in ('pts', 'reb', 'ast', 'tpm', 'tpa')} for p in POSG}
        for g in day:
            for team, opp in ((g['home'], g['away']), (g['away'], g['home'])):
                T = tgames[(season, team)]; O = tgames[(season, opp)]
                def shr(H, fn, prior, K=10):
                    return (sum(fn(x) for x in H) + K * prior) / (len(H) + K)
                def shrL(H, fn, prior, n=10, K=5):
                    H = H[-n:]; return (sum(fn(x) for x in H) + K * prior) / (len(H) + K)
                rest = (D.fromisoformat(date) - D.fromisoformat(last_date[team])).days if team in last_date else 3
                restO = (D.fromisoformat(date) - D.fromisoformat(last_date[opp])).days if opp in last_date else 3
                ctx = dict(date=date, season=season, gid=g['id'], team=team, opp=opp, rest=min(rest, 4), restO=min(restO, 4), nT=len(T), nO=len(O))
                pace = (shr(T, lambda x: x['own']['poss'], lgStat['poss']) + shr(O, lambda x: x['own']['poss'], lgStat['poss'])) / 2
                ctx['f_pace'] = math.log(pace / lgStat['poss'])
                ctx['f_oppDefEff'] = math.log(shr(O, lambda x: x['opp']['pts'] / x['opp']['poss'] * 100, lgStat['pts'] / lgStat['poss'] * 100)
                                              / (lgStat['pts'] / lgStat['poss'] * 100))
                ctx['f_ownOffEff'] = math.log(shr(T, lambda x: x['own']['pts'] / x['own']['poss'] * 100, lgStat['pts'] / lgStat['poss'] * 100)
                                              / (lgStat['pts'] / lgStat['poss'] * 100))
                # the rebounds on offer: his team's misses a game and the opponent's (as an offense), and how many of
                # his team's misses the opponent lets it rebound
                ownMiss = shr(T, lambda x: x['own']['miss'], lgStat['miss']); oppMiss = shr(O, lambda x: x['own']['miss'], lgStat['miss'])
                ctx['f_missEnv'] = math.log((ownMiss + oppMiss) / (2 * lgStat['miss']))
                ctx['f_oppMiss'] = math.log(oppMiss / lgStat['miss'])
                lgOr = lgStat['oreb'] / lgStat['miss']
                ctx['f_oppOrebAllowed'] = math.log(shr(O, lambda x: x['opp']['oreb'] / max(x['opp']['miss'], 1), lgOr) / lgOr)
                ctx['f_oppOrebOwn'] = math.log(shr(O, lambda x: x['own']['oreb'] / max(x['own']['miss'], 1), lgOr) / lgOr)
                lgFg = lgStat['fgm'] / lgStat['fga']
                ctx['f_ownFgPct'] = math.log(shr(T, lambda x: x['own']['fgm'] / x['own']['fga'], lgFg) / lgFg)
                ctx['f_oppFgPctAllowed'] = math.log(shr(O, lambda x: x['opp']['fgm'] / x['opp']['fga'], lgFg) / lgFg)
                lg3 = lgStat['tpm'] / lgStat['tpa']
                ctx['f_opp3paAllowed'] = math.log(shr(O, lambda x: x['opp']['tpa'], lgStat['tpa']) / lgStat['tpa'])
                ctx['f_opp3pctAllowed'] = math.log(shr(O, lambda x: x['opp']['tpm'] / max(x['opp']['tpa'], 1), lg3) / lg3)
                ctx['f_own3paRate'] = math.log(shr(T, lambda x: x['own']['tpa'] / x['own']['fga'], lgStat['tpa'] / lgStat['fga']) / (lgStat['tpa'] / lgStat['fga']))
                for s in STATS:
                    ctx[f'{s}_oppAll'] = math.log(shr(O, lambda x: x['opp'][s], lgStat[s]) / lgStat[s])
                    ctx[f'{s}_oppAllL10'] = math.log(shrL(O, lambda x: x['opp'][s], lgStat[s]) / lgStat[s])
                    ctx[f'{s}_teamAvg'] = shr(T, lambda x: x['own'][s], lgStat[s])
                # key teammates out: 20+ minutes in 3 of the team's last 5 this season, not in tonight's box score
                # (last season's games are not carried over the summer: departed players are not "out")
                apps = defaultdict(list)
                for sea, mins in team_recent[team]:
                    if sea != season: continue
                    for pid, m in mins.items(): apps[pid].append(m)
                key = {pid for pid, ms in apps.items() if len(ms) >= 3 and np.mean(ms) >= 20}
                played = {p['id'] for p in g['players'] if p['team'] == team}
                out = key - played
                vac = np.zeros(len(VEC))
                for pid in out:
                    d = dec.get(pid)
                    if d: vs, ws = d[10]; vac += vs / ws
                ctx['nOut'] = len(out)
                for p in g['players']:
                    if p['team'] != team: continue
                    H = hist[p['id']]
                    if len(H) < 5: continue
                    d = dec[p['id']]
                    r = dict(ctx); r.update(id=p['id'], name=p['name'], pos=p['pos'], home=p['home'], starter=p['starter'], n=len(H))
                    thisS = [x for x in H if x['season'] == season]; lastS = [x for x in H if x['season'] == season - 1]
                    r['nS'] = len(thisS)
                    # this season's decayed reads (None before his first game) and last season's averages
                    dS = decS.get(p['id']); dS = dS[1] if dS and dS[0] == season else None
                    for hl in SHL:
                        r[f'min_sew{hl}'] = (dS[hl][0][VI['min']] / dS[hl][1]) if dS else None
                        for s in STATS: r[f'{s}_spm{hl}'] = (dS[hl][0][VI[s]] / max(dS[hl][0][VI['min']], 1e-6)) if dS else None
                    r['min_last'] = float(np.mean([x['min'] for x in lastS])) if lastS else None
                    l10min = np.mean([x['min'] for x in H[-10:]]); r['l10min'] = l10min
                    r['act_min'] = p['min']
                    for k in ('min', 'tpa'):
                        for hl in HLS: vs, ws = d[hl]; r[f'{k}_ew{hl}'] = vs[VI[k]] / ws
                    for s in STATS:
                        vals = [x[s] for x in H]
                        r[f'{s}_act'] = p[s]
                        for w in (1, 3, 5, 10, 20, 40): r[f'{s}_l{w}'] = float(np.mean(vals[-w:]))
                        r[f'{s}_szn'] = float(np.mean([x[s] for x in thisS])) if thisS else None
                        r[f'{s}_last'] = float(np.mean([x[s] for x in lastS])) if lastS else None
                        r[f'{s}_l82'] = float(np.mean(vals[-82:]))
                        # the board's windows: this season 0.65 · its last ten 0.35, his last 82 before his first game
                        if thisS: r[f'{s}_site'] = 0.65 * np.mean([x[s] for x in thisS]) + 0.35 * np.mean([x[s] for x in thisS[-10:]])
                        else: r[f'{s}_site'] = r[f'{s}_l82']
                        for hl in HLS:
                            vs, ws = d[hl]
                            r[f'{s}_ew{hl}'] = vs[VI[s]] / ws
                            r[f'{s}_pm{hl}'] = vs[VI[s]] / max(vs[VI['min']], 1e-6)   # per minute, decayed
                        # his split at tonight's venue (this season and last), shrunk at 10 games a side
                        ven = [x[s] for x in H[-164:] if x['home'] == p['home']]; allv = vals[-164:]
                        mu = np.mean(allv)
                        r[f'{s}_venue'] = math.log(((sum(ven) + 10 * mu) / (len(ven) + 10) + 0.05) / (mu + 0.05))
                        # the opponent at his position: season to date, last ten
                        lp = lgPos[p['pos']][s]
                        r[f'{s}_oppPos'] = math.log(shr(O, lambda x: x['opp']['pos'][p['pos']][s], lp) / lp)
                        r[f'{s}_oppPosL10'] = math.log(shrL(O, lambda x: x['opp']['pos'][p['pos']][s], lp) / lp)
                        r[f'{s}_oppPosRaw'] = (np.mean([x['opp']['pos'][p['pos']][s] for x in O]) / lp) if O else None
                        # teammates out: what they produce a game, over the team's figure
                        r[f'{s}_vac'] = math.log1p(vac[VI[s]] / max(ctx[f'{s}_teamAvg'], 1))
                    r['min_vac'] = math.log1p(vac[VI['min']] / 240)
                    # threes off attempts × his percentage (his last 82, shrunk toward the league at 100 attempts)
                    tpaL = sum(x['tpa'] for x in H[-82:]); tpmL = sum(x['tpm'] for x in H[-82:])
                    r['tp_pct'] = (tpmL + 100 * lg3) / (tpaL + 100)
                    # the head to head: his last four meetings with tonight's opponent within two years
                    M = [m for m in meet[(p['id'], opp)] if (D.fromisoformat(date) - D.fromisoformat(m[0])).days <= 730][-4:]
                    r['h2hN'] = len(M)
                    # the control: for each meeting, his game nearest its date against another team
                    ctrl = []
                    if M:
                        dates_ = [x['date'] for x in H]
                        for m in M:
                            i = bisect.bisect_left(dates_, m[0]); best = None
                            for j in range(max(0, i - 6), min(len(H), i + 7)):
                                x = H[j]
                                if x['opp'] == opp or x['date'] == m[0]: continue
                                dd = abs((D.fromisoformat(x['date']) - D.fromisoformat(m[0])).days)
                                if best is None or dd < best[0]: best = (dd, x)
                            if best: ctrl.append(best[1])
                    for s in STATS:
                        if M:
                            a = np.array([m[1][s] for m in M]); b = np.array([m[2][s] for m in M])
                            r[f'{s}_h2hAvg'] = float(a.mean()); r[f'{s}_h2hRes'] = float((a - b).mean())
                            r[f'{s}_h2h'] = math.log((a.sum() + 1 * b.mean() + 0.05) / (b.sum() + 1 * b.mean() + 0.05))
                            r[f'{s}_ctrlRes'] = float(np.mean([x['act'][s] - x['base'][s] for x in ctrl])) if len(ctrl) == len(M) else None
                        else:
                            r[f'{s}_h2hAvg'] = None; r[f'{s}_h2hRes'] = None; r[f'{s}_h2h'] = 0.0; r[f'{s}_ctrlRes'] = None
                    rows.append(r)
        # the day's results into the state
        for g in day:
            for team in (g['home'], g['away']):
                ps = [p for p in g['players'] if p['team'] == team]; os_ = [p for p in g['players'] if p['team'] != team]
                own, oppl = team_line(ps), team_line(os_)
                tgames[(season, team)].append(dict(own=own, opp=oppl, date=date))
                lg[season].append(own)
                team_recent[team].append((season, {p['id']: p['min'] for p in ps}))
                if len(team_recent[team]) > 5: team_recent[team].popleft()
                last_date[team] = date
            for p in g['players']:
                vec = np.array([p[k] for k in VEC], dtype=float)
                d = dec.get(p['id'])
                base = {s: (d[10][0][VI[s]] / d[10][1]) if d else p[s] for s in STATS}
                act = {s: p[s] for s in STATS}
                if d: meet[(p['id'], p['opp'])].append((date, act, base))
                rec = dict(date=date, season=season, opp=p['opp'], home=p['home'], act=act, base=base, **{k: p[k] for k in ('min', 'pts', 'reb', 'ast', 'tpm', 'tpa')})
                hist[p['id']].append(rec)
                dS = decS.get(p['id'])
                if dS is None or dS[0] != season: decS[p['id']] = (season, {hl: (vec.copy(), 1.0) for hl in SHL})
                else: decS[p['id']] = (season, {hl: (dS[1][hl][0] * decay[hl] + vec, dS[1][hl][1] * decay[hl] + 1) for hl in SHL})
                if d is None: dec[p['id']] = {hl: (vec.copy(), 1.0) for hl in HLS}
                else: dec[p['id']] = {hl: (d[hl][0] * decay[hl] + vec, d[hl][1] * decay[hl] + 1) for hl in HLS}
        if lg.get(season - 1) and prevLeague is not lg[season - 1]: prevLeague = lg[season - 1]
    return pd.DataFrame(rows), seasons


cache = os.path.join(args.box, 'stat-drivers-rows.pkl')
if os.path.exists(cache) and not args.rebuild:
    df, seasons = pickle.load(open(cache, 'rb'))
else:
    games = load(args.box)
    print(f'{len(games)} games')
    df, seasons = build(games)
    pickle.dump((df, seasons), open(cache, 'wb'))
print(f'{len(df)} rows, seasons {seasons}')

SNAME = {s: f"{s - 1}-{str(s)[2:]}" for s in seasons}
FIT, CHECKS = seasons[1], seasons[2:]
rot = df[df.l10min >= args.min_l10].copy()
# his minutes tonight, season-aware: this season's decayed (half-life 3) from his first game, last season's average before it
_last = rot['min_last'].fillna(rot['min_ew10']).values.astype(float)
_this = rot['min_sew3'].values.astype(float); _this = np.where(np.isnan(_this), _last, _this)
_w = rot['nS'].values / (rot['nS'].values + 0.5)
rot['min_mix'] = _w * _this + (1 - _w) * _last
out = []
def w(s=''): out.append(s)
def f2(x, d=2): return '—' if x is None or (isinstance(x, float) and math.isnan(x)) else f'{x:.{d}f}'


# ------------------------------------------------------------------ 1. his own record
def mae(pred, act): return float(np.mean(np.abs(pred - act)))
def pdev(pred, act):
    pred = np.maximum(pred, 0.05)
    t = np.where(act > 0, act * np.log(np.where(act > 0, act, 1) / pred), 0.0) - (act - pred)
    return float(2 * np.mean(t))

OWN = {}
w('# Tables: what predicts each NBA stat (2026-11-03)')
w()
w(f'Rows: rotation players (his last ten at {args.min_l10:.0f}+ minutes, 5+ games behind him) who played. Fit = {SNAME[FIT]}, '
  f'checks = {", ".join(SNAME[s] for s in CHECKS)} (unchanged). Player-games: ' + ', '.join(f'{SNAME[s]} {int((rot.season == s).sum()):,}' for s in seasons[1:]) + '.')
w()
w('## 1. His own record: how far back to look')
w()
w('Average miss (MAE, the stat\'s units) of each read on its own. EWk = a decayed average whose weights halve every k games '
  '(his whole history across seasons); PM = the same per minute × his minutes (decayed at 5 games); "× this season\'s minutes" = his minutes '
  'decayed at 3 games over this season\'s games alone from his first game, last season\'s average before it; the board = this season 0.65 · its last ten 0.35.')
w()
for s in STATS:
    reads = {'Last game': f'{s}_l1', 'L3': f'{s}_l3', 'L5': f'{s}_l5', 'L10': f'{s}_l10', 'L20': f'{s}_l20', 'L40': f'{s}_l40', 'Last 82': f'{s}_l82', 'The board\'s windows': f'{s}_site'}
    for hl in HLS: reads[f'EW{hl}'] = f'{s}_ew{hl}'
    for hl in (3, 5, 10, 15, 20, 30, 50): reads[f'PM{hl}'] = None
    res = {}
    for sea in seasons[1:]:
        X = rot[rot.season == sea]; a = X[f'{s}_act'].values
        for k, c in reads.items():
            if c is None:
                hl = int(k[2:]); pred = X[f'{s}_pm{hl}'].values * X['min_ew5'].values
            else: pred = X[c].values
            res[(k, sea)] = mae(pred, a)
    for hr in (5, 10, 15, 20, 30, 50):
        for hm in (1, 2, 3, 5, 10):
            for sea in seasons[1:]:
                X = rot[rot.season == sea]
                res[(f'Rate EW{hr} × minutes EW{hm}', sea)] = mae(X[f'{s}_pm{hr}'].values * X[f'min_ew{hm}'].values, X[f'{s}_act'].values)
    for hr in (10, 15, 20, 30):
        for sea in seasons[1:]:
            X = rot[rot.season == sea]
            res[(f'Rate EW{hr} × this season\'s minutes', sea)] = mae(X[f'{s}_pm{hr}'].values * X['min_mix'].values, X[f'{s}_act'].values)
    if s == 'tpm':
        for sea in seasons[1:]:
            X = rot[rot.season == sea]; a = X['tpm_act'].values
            for hl in (5, 10, 15, 20, 30):
                res[(f'3PA EW{hl} × his %', sea)] = mae(X[f'tpa_ew{hl}'].values * X['tp_pct'].values, a)
    keys = list(dict.fromkeys(k for k, _ in res))
    best_fit = min(keys, key=lambda k: res[(k, FIT)])
    OWN[s] = best_fit
    w(f'### {NAME[s]}')
    w()
    w('| Read | ' + ' | '.join(SNAME[x] for x in seasons[1:]) + ' |')
    w('| --- | ' + ' | '.join('---' for _ in seasons[1:]) + ' |')
    for k in keys:
        if k.startswith('Rate EW') and 'minutes EW' in k: continue
        cells = []
        for sea in seasons[1:]:
            v = res[(k, sea)]; m = min(res[(kk, sea)] for kk in keys)
            cells.append(f'**{v:.3f}**' if abs(v - m) < 1e-9 else f'{v:.3f}')
        w(f'| {k}{" ← best on the fit" if k == best_fit else ""} | ' + ' | '.join(cells) + ' |')
    w()
    for sea in seasons[1:3]:
        w(f'His rate a minute (decayed, half-life in rows) × his minutes (decayed, half-life in columns), MAE on {SNAME[sea]}:')
        w()
        w('| Rate \\ minutes | ' + ' | '.join(f'EW{hm}' for hm in (1, 2, 3, 5, 10)) + ' |')
        w('| --- | --- | --- | --- | --- | --- |')
        m = min(res[(f'Rate EW{hr} × minutes EW{hm}', sea)] for hr in (5, 10, 15, 20, 30, 50) for hm in (1, 2, 3, 5, 10))
        for hr in (5, 10, 15, 20, 30, 50):
            cells = []
            for hm in (1, 2, 3, 5, 10):
                v = res[(f'Rate EW{hr} × minutes EW{hm}', sea)]
                cells.append(f'**{v:.3f}**' if abs(v - m) < 1e-9 else f'{v:.3f}')
            w(f'| EW{hr} | ' + ' | '.join(cells) + ' |')
        w()
    w(f'Best on the fit season: **{best_fit}**.')
    w()


def own_pred(X, s):
    k = OWN[s]
    if k.startswith('3PA EW'): hl = int(k.split()[1][2:]); return X[f'tpa_ew{hl}'].values * X['tp_pct'].values
    if k.startswith('PM'): return X[f'{s}_pm{int(k[2:])}'].values * X['min_ew5'].values
    if k.endswith("this season's minutes"): return X[f'{s}_pm{int(k.split()[1][2:])}'].values * X['min_mix'].values
    if k.endswith("this season's minutes"): return X[f'{s}_pm{int(k.split()[1][2:])}'].values * X['min_mix'].values
    if k.startswith('Rate EW'):
        a, b = k.split(' × minutes EW'); return X[f'{s}_pm{int(a[7:])}'].values * X[f'min_ew{int(b)}'].values
    m = {'Last game': 'l1', 'L3': 'l3', 'L5': 'l5', 'L10': 'l10', 'L20': 'l20', 'L40': 'l40', 'Last 82': 'l82', "The board's windows": 'site'}
    if k in m: return X[f'{s}_{m[k]}'].values
    return X[f'{s}_ew{int(k[2:])}'].values


# ------------------------------------------------------------------ 2. what moves tonight's figure
FEATS = {
    'oppPos': ('The opponent at his position, season', lambda X, s: X[f'{s}_oppPos']),
    'oppPosL10': ('The opponent at his position, last ten', lambda X, s: X[f'{s}_oppPosL10']),
    'oppAll': ('The opponent, all positions, season', lambda X, s: X[f'{s}_oppAll']),
    'oppAllL10': ('The opponent, all positions, last ten', lambda X, s: X[f'{s}_oppAllL10']),
    'pace': ('Pace (the two teams\' possessions)', lambda X, s: X['f_pace']),
    'oppDefEff': ('Opponent\'s points allowed per 100', lambda X, s: X['f_oppDefEff']),
    'ownOffEff': ('His team\'s points per 100', lambda X, s: X['f_ownOffEff']),
    'missEnv': ('Rebounds on offer (both teams\' misses)', lambda X, s: X['f_missEnv']),
    'oppMiss': ('Opponent\'s misses a game', lambda X, s: X['f_oppMiss']),
    'oppOrebOwn': ('Opponent\'s offensive-rebound rate', lambda X, s: X['f_oppOrebOwn']),
    'oppOrebAllowed': ('Offensive boards the opponent allows', lambda X, s: X['f_oppOrebAllowed']),
    'ownFgPct': ('His team\'s FG%', lambda X, s: X['f_ownFgPct']),
    'oppFgPctAllowed': ('Opponent\'s FG% allowed', lambda X, s: X['f_oppFgPctAllowed']),
    'opp3paAllowed': ('Opponent\'s 3PA allowed', lambda X, s: X['f_opp3paAllowed']),
    'opp3pctAllowed': ('Opponent\'s 3P% allowed', lambda X, s: X['f_opp3pctAllowed']),
    'vac': ('Teammates out: their production a game', lambda X, s: X[f'{s}_vac']),
    'minVac': ('Teammates out: their minutes', lambda X, s: X['min_vac']),
    'home': ('Home', lambda X, s: X['home'].astype(float)),
    'b2b': ('His team on a back-to-back', lambda X, s: (X['rest'] == 1).astype(float)),
    'oppB2b': ('Opponent on a back-to-back', lambda X, s: (X['restO'] == 1).astype(float)),
    'venue': ('His own split at tonight\'s venue', lambda X, s: X[f'{s}_venue']),
    'h2h': ('His head to head (last 4 meetings, 2 years)', lambda X, s: X[f'{s}_h2h']),
    'posShare': ('His position over the opponent\'s all (the split alone)', lambda X, s: X[f'{s}_oppPos'] - X[f'{s}_oppAll']),
    'minTrend': ('His minutes: last 3 over his decayed', lambda X, s: np.log((X['min_ew1'] + 1) / (X['min_ew10'] + 1))),
}
GROUPS = {
    'Matchup (opponent tables)': ['posShare', 'oppPos', 'oppPosL10', 'oppAll', 'oppAllL10', 'oppDefEff', 'oppFgPctAllowed', 'opp3paAllowed', 'opp3pctAllowed', 'oppOrebAllowed'],
    'Game environment (pace, misses, team)': ['pace', 'missEnv', 'oppMiss', 'oppOrebOwn', 'ownOffEff', 'ownFgPct'],
    'Teammates out': ['vac', 'minVac'],
    'Schedule (home, rest)': ['home', 'b2b', 'oppB2b'],
    'His venue split': ['venue'],
    'Head to head': ['h2h'],
    'Minutes trend': ['minTrend'],
}


def poisson_fit(Xm, y, off, ridge=1.0):
    """log mu = off + Xm b (Xm with an intercept column), IRLS with a light ridge (not on the intercept)."""
    b = np.zeros(Xm.shape[1]); R = np.eye(Xm.shape[1]) * ridge; R[0, 0] = 0
    for _ in range(50):
        eta = off + Xm @ b; mu = np.exp(eta)
        z = eta - off + (y - mu) / mu
        WX = Xm * mu[:, None]
        H = Xm.T @ WX + R
        nb = np.linalg.solve(H, WX.T @ z)
        if np.max(np.abs(nb - b)) < 1e-8: b = nb; break
        b = nb
    mu = np.exp(off + Xm @ b)
    phi = np.sum((y - mu) ** 2 / mu) / max(len(y) - Xm.shape[1], 1)
    cov = np.linalg.inv(Xm.T @ (Xm * mu[:, None]) + R) * phi
    return b, np.sqrt(np.diag(cov)), phi


def design(X, s, names):
    cols = [np.ones(len(X))]
    for n in names: cols.append(np.asarray(FEATS[n][1](X, s), dtype=float))
    return np.column_stack(cols)


def score(X, s, names, b):
    off = np.log(np.maximum(own_pred(X, s), 0.05))
    pred = np.exp(off + design(X, s, names) @ b)
    a = X[f'{s}_act'].values
    return mae(pred, a), pdev(pred, a), pred


SEL = {}
w('## 2. On top of his own record: what moves tonight\'s figure')
w()
w('Each read added alone to his best own read (a Poisson fit, his own read as the offset). **Elasticity**: × (factor)^b, '
  'so b 0.5 means a matchup 10% above the league adds about 5% to his figure; z its standard error away from 0 '
  '(on the fit season, overdispersion in). **Deviance gain** on each check season, scored unchanged: the share of the own read\'s '
  'Poisson deviance the read takes away (‰ = per thousand); a negative figure means the read made the check worse.')
w()
fitX = rot[rot.season == FIT]
for s in STATS:
    w(f'### {NAME[s]} (own read: {OWN[s]})')
    w()
    w('| Read | Elasticity b | z | ' + ' | '.join(f'Gain {SNAME[c]}' for c in CHECKS) + ' |')
    w('| --- | --- | --- | ' + ' | '.join('---' for _ in CHECKS) + ' |')
    rowsS = []
    off = np.log(np.maximum(own_pred(fitX, s), 0.05)); y = fitX[f'{s}_act'].values
    b0, _, _ = poisson_fit(design(fitX, s, []), y, off)
    base = {c: score(rot[rot.season == c], s, [], b0) for c in CHECKS}
    for n in FEATS:
        b, se, phi = poisson_fit(design(fitX, s, [n]), y, off)
        gains = []
        for c in CHECKS:
            m, dv, _ = score(rot[rot.season == c], s, [n], b)
            gains.append(1000 * (base[c][1] - dv) / base[c][1])
        rowsS.append((n, b[1], b[1] / se[1], gains))
    rowsS.sort(key=lambda r: -r[3][0])
    for n, bb, z, gains in rowsS:
        w(f'| {FEATS[n][0]} | {bb:+.2f} | {z:+.1f} | ' + ' | '.join(f'{g:+.1f}‰' for g in gains) + ' |')
    w()
    # forward selection on the fit season (z ≥ 3 and a fit-season gain), then scored on the checks
    chosen = []
    while True:
        best = None
        for n in FEATS:
            if n in chosen: continue
            b, se, phi = poisson_fit(design(fitX, s, chosen + [n]), y, off)
            _, dv, _ = score(fitX, s, chosen + [n], b)
            z = b[-1] / se[-1]
            if abs(z) >= 3 and (best is None or dv < best[1]): best = (n, dv, z)
        if not best: break
        chosen.append(best[0])
    b, se, phi = poisson_fit(design(fitX, s, chosen), y, off)
    SEL[s] = (chosen, b, se)
    w(f'Selected on the fit season (forward, each new read at |z| ≥ 3): ' + (', '.join(f'{FEATS[n][0]} b {bb:+.2f} (z {bb / ee:+.1f})' for n, bb, ee in zip(chosen, b[1:], se[1:])) or 'none') + '.')
    w()
    w('| Season | Own read MAE | With the selected reads | Deviance gain | The board\'s windows MAE |')
    w('| --- | --- | --- | --- | --- |')
    for c in [FIT] + CHECKS:
        X = rot[rot.season == c]
        m0, d0, _ = score(X, s, [], b0); m1, d1, _ = score(X, s, chosen, b)
        w(f'| {SNAME[c]} | {m0:.3f} | {m1:.3f} | {1000 * (d0 - d1) / d0:+.1f}‰ | {mae(X[f"{s}_site"].values, X[f"{s}_act"].values):.3f} |')
    w()
    # by group: the gain each group brings over the own read, scored on the checks
    w('| Group of reads | ' + ' | '.join(f'Gain {SNAME[c]}' for c in CHECKS) + ' |')
    w('| --- | ' + ' | '.join('---' for _ in CHECKS) + ' |')
    for gname, names in GROUPS.items():
        bg, _, _ = poisson_fit(design(fitX, s, names), y, off)
        gains = []
        for c in CHECKS:
            _, dv, _ = score(rot[rot.season == c], s, names, bg); gains.append(1000 * (base[c][1] - dv) / base[c][1])
        w(f'| {gname} | ' + ' | '.join(f'{g:+.1f}‰' for g in gains) + ' |')
    w()


# ------------------------------------------------------------------ 3. what it is worth, in the stat's units
w('## 3. In the stat\'s units: his figure against his own read, by third of each read')
w()
w(f'On {SNAME[CHECKS[0]]}: the average of (what he did − his own read) in the bottom, middle and top third of each read, '
  'and the top third minus the bottom. A read that carries signal climbs from left to right.')
w()
for s in STATS:
    X = rot[rot.season == CHECKS[0]].copy()
    X['_res'] = X[f'{s}_act'].values - own_pred(X, s)
    X['_rel'] = X['_res'] / np.maximum(own_pred(X, s), 0.3)
    w(f'### {NAME[s]}')
    w()
    w('| Read | Bottom third | Middle | Top third | Top − bottom | As % of his read |')
    w('| --- | --- | --- | --- | --- | --- |')
    for n in ['oppPos', 'oppPosL10', 'oppAll', 'pace', 'missEnv', 'oppOrebAllowed', 'opp3paAllowed', 'opp3pctAllowed', 'oppDefEff', 'vac', 'venue']:
        v = np.asarray(FEATS[n][1](X, s), dtype=float)
        if np.nanstd(v) == 0: continue
        q = pd.qcut(pd.Series(v).rank(method='first'), 3, labels=False).values
        m = [X['_res'].values[q == i].mean() for i in range(3)]; rel = [X['_rel'].values[q == i].mean() for i in range(3)]
        w(f'| {FEATS[n][0]} | {m[0]:+.2f} | {m[1]:+.2f} | {m[2]:+.2f} | **{m[2] - m[0]:+.2f}** | {100 * (rel[2] - rel[0]):+.1f}% |')
    H = X[X.h2hN >= 2]
    v = H[f'{s}_h2h'].values; q = pd.qcut(pd.Series(v).rank(method='first'), 3, labels=False).values
    m = [H['_res'].values[q == i].mean() for i in range(3)]; rel = [H['_rel'].values[q == i].mean() for i in range(3)]
    w(f'| Head to head (2+ meetings, {len(H):,} rows) | {m[0]:+.2f} | {m[1]:+.2f} | {m[2]:+.2f} | **{m[2] - m[0]:+.2f}** | {100 * (rel[2] - rel[0]):+.1f}% |')
    w()


# ------------------------------------------------------------------ 4. the head to head against a control
w('## 4. The head to head against a control')
w()
w('His miss in past meetings with tonight\'s opponent (what he did − his decayed average at the time, last four meetings within '
  'two years) against tonight\'s miss, beside the same for his games at the same distance in time against other teams (the control). '
  'If the opponent itself carried information, the head to head would beat the control. Correlations; rotation players, all seasons after the first.')
w()
w('| Stat | Meetings | Rows | r (head to head) | r (control) | Slope (head to head) | His h2h average as a read, MAE | His own read, same rows |')
w('| --- | --- | --- | --- | --- | --- | --- | --- |')
H2 = rot[rot.season != seasons[0]]
for s in STATS:
    for lo, hi, lab in ((1, 1, '1'), (2, 2, '2'), (3, 4, '3–4')):
        X = H2[(H2.h2hN >= lo) & (H2.h2hN <= hi) & H2[f'{s}_ctrlRes'].notna()]
        if len(X) < 200: continue
        res = X[f'{s}_act'].values - X[f'{s}_ew10'].values
        r1 = np.corrcoef(X[f'{s}_h2hRes'].values, res)[0, 1]; r2 = np.corrcoef(X[f'{s}_ctrlRes'].values, res)[0, 1]
        sl = np.polyfit(X[f'{s}_h2hRes'].values, res, 1)[0]
        w(f'| {NAME[s]} | {lab} | {len(X):,} | {r1:+.3f} | {r2:+.3f} | {sl:+.3f} | {mae(X[f"{s}_h2hAvg"].values, X[f"{s}_act"].values):.3f} | {mae(own_pred(X, s), X[f"{s}_act"].values):.3f} |')
w()

# the threes' made count against attempts, the h2h attempts in particular
w('## 5. Variance explained: how much of a night is predictable at all')
w()
w(f'On {SNAME[CHECKS[0]]}: the share of the night-to-night variance (R²) his own read explains, and with the selected reads; '
  'the miss had he known his minutes (his per-minute decayed rate × the minutes he played) as the ceiling the minutes put on it.')
w()
w('| Stat | Own read R² | With selected reads R² | MAE own | MAE had the minutes been known | Typical figure |')
w('| --- | --- | --- | --- | --- | --- |')
for s in STATS:
    X = rot[rot.season == CHECKS[0]]; a = X[f'{s}_act'].values
    p0 = own_pred(X, s); chosen, b, _ = SEL[s]
    _, _, p1 = score(X, s, chosen, b)
    r2 = lambda p: 1 - np.sum((a - p) ** 2) / np.sum((a - a.mean()) ** 2)
    pm = X[f'{s}_pm15'].values * X['act_min'].values
    w(f'| {NAME[s]} | {r2(p0):.3f} | {r2(p1):.3f} | {mae(p0, a):.3f} | {mae(pm, a):.3f} | {a.mean():.1f} |')
w()

if args.board:
    w("## 6. Against the site's whole board, on the same player-games")
    w()
    w("The site's board replayed night by night by `tools/audit/nba-audit.mjs --cocktail site` (the windows, the matchup, the minutes, the "
      "teammates-out lifts and splits, the role pull, the team ceiling, the ceiling read), joined to the rows above by player and date. "
      "Average miss, and the bias (projection − actual).")
    w()
    w('| Season | Stat | Rows | The board | Bias | His own read | Own + the selected reads | Bias |')
    w('| --- | --- | --- | --- | --- | --- | --- | --- |')
    for f in args.board:
        B = pd.read_csv(f, dtype={'espnId': str})
        B = B[B.market.isin(STATS) & B.actual.notna() & (B.out != True)]
        for s in STATS:
            Bs = B[B.market == s][['espnId', 'slate', 'exp']].rename(columns={'espnId': 'id', 'slate': 'date', 'exp': 'board'})
            J = rot.merge(Bs, on=['id', 'date'])
            if not len(J): continue
            sea = int(J.season.mode()[0]); a = J[f'{s}_act'].values
            chosen, b, _ = SEL[s]
            _, _, p1 = score(J, s, chosen, b)
            w(f'| {SNAME[sea]} | {NAME[s]} | {len(J):,} | {mae(J.board.values, a):.3f} | {np.mean(J.board.values - a):+.2f} | {mae(own_pred(J, s), a):.3f} | '
              f'**{mae(p1, a):.3f}** | {np.mean(p1 - a):+.2f} |')
    w()

os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
open(args.out, 'w').write('\n'.join(out) + '\n')
print('\n'.join(out))

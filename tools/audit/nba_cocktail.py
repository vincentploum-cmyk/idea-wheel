"""The NBA cocktail: which mix of reads predicts a player's points, rebounds, assists, threes and PRA
best, measured on the box scores. Tuned on a full season (2025-26 as "this season", 2024-25 behind
it), checked unchanged on this season's games (2026-27 to --date, 2025-26 behind it).

Every row is a player-game with each read built from the games before its date:
  his windows   last 3 / 5 / 10 / 20 (across seasons, as the pull's logs run), this season to date,
                last season, per game and per minute, his minutes the same ways, his spread over his
                last 82
  the matchup   what the opponent gives up a game to his position group (G / F / C) this season, the
                games behind it, the league's figure at the position
  the script    the book's game total and spread (DraftKings through ESPN's pickcenter, the line the
                board's schedule already carries as `odds`): the team's implied points over its usual,
                the total over its usual game total
  the night     home, his team's and the opponent's back-to-back, key teammates out (played 3 of the
                team's last 5 at 20+ minutes, not tonight) and what they produce a game
and the ladder's rungs (a pseudo main line = his last-ten average floored + 1/2, the board's own
fallback, and the market's steps two under and four over) with his hit rates at each.

  python3 -I tools/audit/nba_cocktail.py --raw .nhl-data/audit/nba --date 2026-10-27 --out .nhl-data/audit/out/nba-cocktail.md

--raw holds this season (days/, games/), last season (prior/days, prior/games) and 2024-25 game logs
(prior/gamelogs/<espnId>.json, ESPN's gamelog?season=2025). Needs numpy, pandas, scipy.
"""
import argparse, glob, json, math, os, pickle, sys
from collections import defaultdict
from datetime import datetime, date as D, timedelta
from zoneinfo import ZoneInfo
import numpy as np, pandas as pd
from scipy.stats import norm

ap = argparse.ArgumentParser()
ap.add_argument('--raw', required=True); ap.add_argument('--date', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--rebuild', action='store_true')
args = ap.parse_args()
ET = ZoneInfo('America/New_York')
BASE = ['min', 'pts', 'reb', 'ast', 'tpm', 'tpa', 'fgm', 'fga', 'ftm', 'fta', 'stl', 'blk', 'tov', 'oreb']
MK = ['pts', 'reb', 'ast', 'tpm', 'pra']
STEP = {'pts': 2, 'reb': 1, 'ast': 1, 'tpm': 1, 'pra': 3}
KS = [-2, -1, 0, 1, 2, 3, 4]
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
    return {'G': 'G', 'F': 'F', 'C': 'C'}.get(p[:1], 'F')
def stat(r, s): return r['pts'] + r['reb'] + r['ast'] if s == 'pra' else r[s]

# ------------------------------------------------------------------ the feeds
def slate_dates(days_dir):
    m = {}
    for f in glob.glob(days_dir + '/*.json'):
        d = os.path.basename(f)[:8]
        try: j = json.load(open(f))
        except Exception: continue
        for e in j.get('events', []): m[str(e['id'])] = f'{d[:4]}-{d[4:6]}-{d[6:]}'
    return m

def parse_game(j, date):
    comp = j['header']['competitions'][0]
    side = {c['homeAway']: c for c in comp['competitors']}
    home = side['home']['team']['abbreviation']; away = side['away']['team']['abbreviation']
    pc = (j.get('pickcenter') or [{}])[0]
    g = dict(id=str(j['header']['id']), date=date, home=home, away=away, hs=num(side['home'].get('score')), aws=num(side['away'].get('score')),
             total=pc.get('overUnder'), spread=pc.get('spread'), players=[])
    for t in j['boxscore'].get('players', []):
        team = t['team']['abbreviation']
        for s in (t.get('statistics') or [])[:1]:
            keys = s.get('keys', [])
            for a in s.get('athletes', []):
                ath = a.get('athlete') or {}
                if not ath.get('id'): continue
                v = a.get('stats') or []
                at = lambda k: v[keys.index(k)] if k in keys and len(v) > keys.index(k) else None
                r = dict(id=str(ath['id']), name=ath.get('displayName', ''), team=team, opp=home if team == away else away, home=int(team == home),
                         pos=posg((ath.get('position') or {}).get('abbreviation')), starter=int(bool(a.get('starter'))))
                played = (not a.get('didNotPlay')) and len(v) > 0 and num(at('minutes')) > 0
                r['played'] = int(played)
                if played:
                    r.update(min=num(at('minutes')), pts=num(at('points')), reb=num(at('rebounds')), ast=num(at('assists')), tov=num(at('turnovers')), stl=num(at('steals')),
                             blk=num(at('blocks')), oreb=num(at('offensiveRebounds')), fgm=dash(at('fieldGoalsMade-fieldGoalsAttempted'), 0), fga=dash(at('fieldGoalsMade-fieldGoalsAttempted'), 1),
                             tpm=dash(at('threePointFieldGoalsMade-threePointFieldGoalsAttempted'), 0), tpa=dash(at('threePointFieldGoalsMade-threePointFieldGoalsAttempted'), 1),
                             ftm=dash(at('freeThrowsMade-freeThrowsAttempted'), 0), fta=dash(at('freeThrowsMade-freeThrowsAttempted'), 1))
                g['players'].append(r)
    return g

def load_season(games_dir, days_dir, until=None):
    dates = slate_dates(days_dir); out = []
    for f in glob.glob(games_dir + '/*.json'):
        try: j = json.load(open(f))
        except Exception: continue
        if (j.get('header', {}).get('season') or {}).get('type') not in (2, None): continue
        if not (j['header']['competitions'][0].get('status') or {}).get('type', {}).get('completed'): continue
        gid = str(j['header']['id']); d = dates.get(gid)
        if not d or (until and d > until): continue
        out.append(parse_game(j, d))
    return sorted(out, key=lambda g: (g['date'], g['id']))

def parse_gamelog(j):
    names = j.get('names', []); evs = j.get('events', {}); rows = []
    for st in j.get('seasonTypes', []):
        label = (st.get('displayName') or '').lower()
        if 'pre' in label.replace('post', ''): continue
        typ = 'PST' if 'post' in label else 'REG'
        for c in st.get('categories', []) or []:
            for e in c.get('events', []) or []:
                ev = evs.get(e.get('eventId')); s = e.get('stats')
                if not ev or not s: continue
                at = lambda k: s[names.index(k)] if k in names else None
                if num(at('minutes')) <= 0: continue
                d = datetime.fromisoformat(ev['gameDate'].replace('Z', '+00:00')).astimezone(ET).date().isoformat()
                rows.append(dict(date=d, type=typ, min=num(at('minutes')), pts=num(at('points')), reb=num(at('totalRebounds')), ast=num(at('assists')), stl=num(at('steals')), blk=num(at('blocks')),
                                 tov=num(at('turnovers')), oreb=0.0, fgm=dash(at('fieldGoalsMade-fieldGoalsAttempted'), 0), fga=dash(at('fieldGoalsMade-fieldGoalsAttempted'), 1),
                                 tpm=dash(at('threePointFieldGoalsMade-threePointFieldGoalsAttempted'), 0), tpa=dash(at('threePointFieldGoalsMade-threePointFieldGoalsAttempted'), 1),
                                 ftm=dash(at('freeThrowsMade-freeThrowsAttempted'), 0), fta=dash(at('freeThrowsMade-freeThrowsAttempted'), 1)))
    return sorted(rows, key=lambda r: r['date'])

# ------------------------------------------------------------------ the rows
def build(games, last_logs, label):
    """One row per player-game (played), every read from the games before the date; and the rungs."""
    hist = defaultdict(list); team_hist = defaultdict(list); part = defaultdict(dict); league = []
    rows = []; rungs = []
    for date in sorted({g['date'] for g in games}):
        day = [g for g in games if g['date'] == date]
        yday = (D.fromisoformat(date) - timedelta(days=1)).isoformat()
        nl = len(league)
        lgPts = (sum(t['pts'] for t in league) + 40 * 114.0) / (nl + 40)
        lgPace = (sum(t['poss'] for t in league) + 40 * 99.0) / (nl + 40)
        lgTot = 2 * lgPts
        lgPos = {p: {s: ((sum(t['ag'][p][s] for t in league) + 40 * {'pts': 38, 'reb': 15, 'ast': 9, 'tpm': 4.5, 'stl': 3, 'blk': 2, 'tov': 5, 'pra': 62}[s] * {'G': 1.0, 'F': 1.0, 'C': 0.55}[p]) / (nl + 40)) for s in ('pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'tov', 'pra')} for p in POSG}
        for g in day:
            for team, opp in ((g['home'], g['away']), (g['away'], g['home'])):
                T, O = team_hist[team], team_hist[opp]
                def shr(H, k, prior, K=10): return (sum(x[k] for x in H) + K * prior) / (len(H) + K)
                tPts = shr(T, 'pts', lgPts); tPA = shr(T, 'pa', lgPts); oPts = shr(O, 'pts', lgPts); oPA = shr(O, 'pa', lgPts)
                tPace = shr(T, 'poss', lgPace); oPace = shr(O, 'poss', lgPace)
                home = team == g['home']
                implied = None
                if g['total'] is not None and g['spread'] is not None:
                    implied = g['total'] / 2 - g['spread'] / 2 if home else g['total'] / 2 + g['spread'] / 2
                ctx = dict(date=date, gid=g['id'], team=team, opp=opp, home=int(home), total=g['total'], implied=implied, tPts=tPts, tPA=tPA, oPts=oPts, oPA=oPA,
                           tPace=tPace, oPace=oPace, lgPace=lgPace, lgPts=lgPts, lgTot=lgTot, nT=len(T), nO=len(O),
                           b2bT=int(bool(T) and T[-1]['date'] == yday), b2bO=int(bool(O) and O[-1]['date'] == yday))
                # what the opponent gives up a game to each position group, this season
                ag = {p: {s: (np.mean([x['ag'][p][s] for x in O]) if O else None) for s in ('pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'tov', 'pra')} for p in POSG}
                # key teammates out tonight
                recent = list(part[team].items())[-5:]
                apps = defaultdict(list)
                for d0, mins in recent:
                    for pid, m in mins.items(): apps[pid].append(m)
                key = {pid for pid, ms in apps.items() if len(ms) >= 3 and np.mean(ms) >= 20}
                played = {p['id'] for p in g['players'] if p['team'] == team and p['played']}
                out = key - played
                def avg_of(pid, s):
                    H = hist.get(pid) or []
                    if H: return np.mean([stat(x, s) for x in H])
                    L = [x for x in last_logs.get(pid, []) if x['type'] == 'REG']
                    return np.mean([stat(x, s) for x in L]) if L else 0.0
                vac = {s: sum(avg_of(pid, s) for pid in out) for s in ('pts', 'reb', 'ast', 'tpm', 'min', 'fga', 'pra')}
                team_avg = {s: (np.mean([x[s] for x in T]) if T else {'pts': lgPts, 'reb': 44.0, 'ast': 26.0, 'tpm': 13.0, 'min': 240.0, 'fga': 89.0, 'pra': lgPts + 70}[s]) for s in ('pts', 'reb', 'ast', 'tpm', 'min', 'fga', 'pra')}
                for p in g['players']:
                    if p['team'] != team or not p['played']: continue
                    H = hist[p['id']]; L = last_logs.get(p['id'], [])
                    n = len(H)
                    logs = (H[::-1] + L[::-1])[:120]   # newest first, this season then last
                    if not logs: continue
                    reg = [x for x in logs if x.get('type', 'REG') == 'REG']
                    r = dict(ctx); r.update(id=p['id'], name=p['name'], pos=p['pos'], starter=p['starter'], n=n, nLast=len([x for x in L if x['type'] == 'REG']), nOut=len(out), agGp=len(O))
                    for s in BASE + ['pra']:
                        vals = [stat(x, s) for x in logs]
                        for w in (3, 5, 10, 20): r[f'{s}_l{w}'] = float(np.mean(vals[:w]))
                        r[f'{s}_szn'] = float(np.mean([stat(x, s) for x in H])) if H else None
                        lastReg = [stat(x, s) for x in L if x['type'] == 'REG']
                        r[f'{s}_last'] = float(np.mean(lastReg)) if lastReg else None
                        long = [stat(x, s) for x in reg[:82]]
                        r[f'{s}_long'] = float(np.mean(long)) if long else None
                        r[f'{s}_sd'] = float(np.std(long, ddof=1)) if len(long) > 1 else 0.0
                        r[f'{s}_act'] = stat(p, s)
                    for s in ('pts', 'reb', 'ast', 'tpm', 'pra'):
                        a = ag[p['pos']][s]
                        r[f'{s}_ag'] = a; r[f'{s}_lgPos'] = lgPos[p['pos']][s]
                        r[f'{s}_vac'] = vac[s]; r[f'{s}_team'] = team_avg[s]
                    r['min_vac'] = vac['min']; r['fga_vac'] = vac['fga']
                    # his games this season without the teammates out tonight
                    if out and H:
                        wo = [x for x in H if all(pid not in part[team].get(x['date'], {}) for pid in out)]
                        r['nWo'] = len(wo)
                        for s in ('pts', 'reb', 'ast', 'tpm', 'pra', 'min'): r[f'{s}_wo'] = float(np.mean([stat(x, s) for x in wo])) if wo else None
                    else:
                        r['nWo'] = 0
                    ri = len(rows); rows.append(r)
                    # the ladder: a pseudo main line and the market's steps around it, his hit rates at each
                    for s in MK:
                        vals10 = np.array([stat(x, s) for x in logs[:10]]); vals5 = vals10[:5]
                        valsS = np.array([stat(x, s) for x in H]) if H else np.array([])
                        main = math.floor(vals10.mean()) + 0.5
                        for k in KS:
                            line = main + k * STEP[s]
                            if line <= 0: continue
                            rungs.append((ri, s, k, line, float((vals5 > line).mean()), len(vals5), float((vals10 > line).mean()), len(vals10),
                                          float((valsS > line).mean()) if len(valsS) else np.nan, len(valsS), int(stat(p, s) > line)))
        # the date's games join the history
        for g in day:
            for team, opp in ((g['home'], g['away']), (g['away'], g['home'])):
                mine = [p for p in g['players'] if p['team'] == team and p['played']]
                theirs = [p for p in g['players'] if p['team'] == opp and p['played']]
                tot = lambda ps, k: sum(p[k] for p in ps)
                poss = tot(mine, 'fga') - tot(mine, 'oreb') + tot(mine, 'tov') + 0.44 * tot(mine, 'fta')
                agp = {pp: {s: sum(stat(p, s) for p in theirs if p['pos'] == pp) for s in ('pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'tov', 'pra')} for pp in POSG}
                rec = dict(date=g['date'], pts=tot(mine, 'pts'), pa=tot(theirs, 'pts'), poss=poss, ag=agp, reb=tot(mine, 'reb'), ast=tot(mine, 'ast'), tpm=tot(mine, 'tpm'), min=tot(mine, 'min'), fga=tot(mine, 'fga'))
                rec['pra'] = rec['pts'] + rec['reb'] + rec['ast']
                team_hist[team].append(rec); league.append(rec)
                part[team][g['date']] = {p['id']: p['min'] for p in mine}
                for p in mine:
                    hist[p['id']].append(dict(p, type='REG', date=g['date']))
    df = pd.DataFrame(rows)
    rg = pd.DataFrame(rungs, columns=['ri', 'mk', 'k', 'line', 'h5', 'n5', 'h10', 'n10', 'hS', 'nS', 'over'])
    print(f'{label}: {len(df)} player-games, {len(rg)} rungs', file=sys.stderr)
    return df, rg

cache = os.path.join(args.raw, 'cocktail-cache.pkl')
if os.path.exists(cache) and not args.rebuild:
    fitD, fitR, testD, testR = pickle.load(open(cache, 'rb'))
else:
    prior_games = load_season(os.path.join(args.raw, 'prior/games'), os.path.join(args.raw, 'prior/days'))
    gl25 = {}
    for f in glob.glob(os.path.join(args.raw, 'prior/gamelogs/*.json')):
        try: gl25[os.path.basename(f)[:-5]] = parse_gamelog(json.load(open(f)))
        except Exception: pass
    fitD, fitR = build(prior_games, gl25, '2025-26')
    last26 = defaultdict(list)
    for g in prior_games:
        for p in g['players']:
            if p['played']: last26[p['id']].append(dict(p, type='REG', date=g['date']))
    test_games = load_season(os.path.join(args.raw, 'games'), os.path.join(args.raw, 'days'), until=args.date)
    testD, testR = build(test_games, last26, '2026-27')
    pickle.dump((fitD, fitR, testD, testR), open(cache, 'wb'))

# ------------------------------------------------------------------ the evaluation
md = []
def line(s=''): md.append(s)
def table(head, rows):
    line('| ' + ' | '.join(head) + ' |'); line('| ' + ' | '.join('---' for _ in head) + ' |')
    for r in rows: line('| ' + ' | '.join(str(x) for x in r) + ' |')
    line()
pct = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{100 * v:.1f}%'
f2 = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v:.2f}'
f3 = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v:.3f}'
f4 = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v:.4f}'

def population(df):
    """The players a book prices: a game this season behind him and 15+ minutes a game over his last ten."""
    return df[(df.n >= 1) & (df.min_l10 >= 15)].copy()
fit = population(fitD); test = population(testD)

def col(df, s, k):
    v = df[f'{s}_{k}']
    return v.astype(float)

# the board today: the season with his last ten (0.65 / 0.35), threes off attempts x percentage (volume, shrunk at 40 attempts)
def board_rate(df, s, wL10=0.35, wL5=0.0, wL20=0.0):
    szn = col(df, s, 'szn')
    l10 = col(df, s, 'l10'); l5 = col(df, s, 'l5'); l20 = col(df, s, 'l20')
    wS = 1 - wL10 - wL5 - wL20
    return wS * szn + wL10 * l10 + wL5 * l5 + wL20 * l20

def rate_of(df, s, cfg):
    """His rate for a stat under a cocktail: the windows' weights, per game or per minute x his minutes."""
    w = cfg['w']
    if s == 'pra' and cfg.get('praParts'):
        return sum(rate_of(df, x, cfg) for x in ('pts', 'reb', 'ast'))
    if cfg.get('perMin'):
        pm = lambda k: col(df, s, k) / col(df, 'min', k).clip(lower=1)
        rpm = w[0] * pm('szn') + w[1] * pm('l10') + w[2] * pm('l5') + w[3] * pm('l20')
        mw = cfg['mw']
        mins = mw[0] * col(df, 'min', 'szn') + mw[1] * col(df, 'min', 'l10') + mw[2] * col(df, 'min', 'l5') + mw[3] * col(df, 'min', 'l3')
        return rpm * mins
    return w[0] * col(df, s, 'szn') + w[1] * col(df, s, 'l10') + w[2] * col(df, s, 'l5') + w[3] * col(df, s, 'l20')

def mult(df, s, cfg):
    m = np.ones(len(df))
    # the matchup: the opponent's allowed at his position over the league's, damped by its games
    E, K = cfg['E'], cfg['K']
    if E:
        ratio = (col(df, s, 'ag') / col(df, s, 'lgPos')).fillna(1.0).values
        gp = df.agGp.values.astype(float); wgp = gp / (gp + K) if K else np.where(gp > 0, 1.0, 0.0)
        m *= 1 + E * wgp * (ratio - 1)
    # the script: the book's implied points for his team over its usual, the total over its usual game
    a = cfg['alpha'].get(s, 0.0)
    if a:
        if s in ('pts', 'pra', 'tpm'):
            r = (df.implied / df.tPts).astype(float)
        else:
            r = (df.total / (df.tPts + df.tPA)).astype(float)
        m *= np.where(r.notna(), r.fillna(1.0) ** a, 1.0)
    h = cfg['home'].get(s, 0.0)
    if h: m *= np.where(df.home == 1, 1 + h, 1 - h)
    b = cfg['b2b']
    if b: m *= np.where(df.b2bT == 1, 1 - b, 1.0)
    # teammates out: a share of what they produce a game, by his share of the team's
    g = cfg['vac']
    if g and s != 'pra':
        frac = (col(df, s, 'vac') / col(df, s, 'team').clip(lower=1)).fillna(0).values
        m *= 1 + g * frac
    elif g:
        frac = sum((col(df, x, 'vac') / col(df, x, 'team').clip(lower=1)).fillna(0).values * col(df, x, 'l10').values for x in ('pts', 'reb', 'ast')) / col(df, 'pra', 'l10').clip(lower=1).values
        m *= 1 + g * frac
    return m

def project(df, s, cfg):
    return (rate_of(df, s, cfg) * mult(df, s, cfg)).values

def mae(df, s, cfg):
    p = project(df, s, cfg); y = col(df, s, 'act').values; ok = ~np.isnan(p)
    return float(np.mean(np.abs(p[ok] - y[ok])))
def bias(df, s, cfg):
    p = project(df, s, cfg); y = col(df, s, 'act').values; ok = ~np.isnan(p)
    return float(np.mean(p[ok] - y[ok]))

BOARD = dict(w=(0.65, 0.35, 0.0, 0.0), perMin=False, mw=(0.5, 0.0, 0.5, 0.0), E=0.6, K=0, alpha={}, home={}, b2b=0.0, vac=0.0)
def rel(df, cfg, base=BOARD, stats=MK):
    return float(np.mean([mae(df, s, cfg) / mae(df, s, base) for s in stats]))

line(f'# The NBA cocktail: what predicts a player’s night, measured (tuned on 2025-26, checked on 2026-27 to {args.date})')
line()
line(f'Fit season: {len(fitD)} player-games ({len(fit)} in the priced population: a game this season behind him, 15+ minutes a game over his last ten). Test season: {len(testD)} ({len(test)}). '
     f'The book’s game total is on {fit.total.notna().mean():.0%} of the fit season’s rows and {test.total.notna().mean():.0%} of the test season’s.')
line()

# ---- 1. the windows
line('## 1. His rate: which windows')
line()
line('Each row is the board’s read (his season to date with his last ten at 0.65 / 0.35) against other weights, by games this season. MAE of the projection against his figure, each market, no matchup or anything else on top; the last row of each block is the best grid point on the fit season.')
line()
grid = []
for wS in np.arange(0.2, 1.01, 0.1):
    for wL10 in np.arange(0, 1.01 - wS, 0.1):
        for wL5 in np.arange(0, 1.01 - wS - wL10, 0.1):
            wL20 = round(1 - wS - wL10 - wL5, 2)
            if wL20 < -1e-9: continue
            grid.append((round(wS, 2), round(wL10, 2), round(wL5, 2), max(0.0, wL20)))
plain = lambda w: dict(BOARD, w=w, E=0.0)
tiers = [('1–3 games this season', 1, 3), ('4–9', 4, 9), ('10–29', 10, 29), ('30+', 30, 999)]
best_w = {}
rows = []
for label, lo, hi in tiers:
    F = fit[(fit.n >= lo) & (fit.n <= hi)]
    scores = sorted((rel(F, plain(w), plain(BOARD['w'])), w) for w in grid)
    best_w[label] = scores[0][1]
    for tag, w in (('board', BOARD['w']), ('best', scores[0][1])):
        rows.append([label, tag, f'{w[0]:.1f} / {w[1]:.1f} / {w[2]:.1f} / {w[3]:.1f}', len(F)] + [f2(mae(F, s, plain(w))) for s in MK] + [f3(rel(F, plain(w), plain(BOARD['w'])))])
table(['Games this season', 'read', 'season / L10 / L5 / L20', 'rows', 'pts MAE', 'reb', 'ast', 'tpm', 'pra', 'MAE vs the board'], rows)

line('### Per minute × his minutes, and last season behind the season to date')
line()
rows = []
W = best_w['10–29']
variants = [
    ('The board’s windows, per game', plain(BOARD['w'])),
    ('Best windows, per game', plain(W)),
    ('Per minute × his minutes (season / L5 half and half)', dict(plain(W), perMin=True, mw=(0.5, 0.0, 0.5, 0.0))),
    ('Per minute × his minutes (L5 / L3 heavy)', dict(plain(W), perMin=True, mw=(0.3, 0.2, 0.3, 0.2))),
    ('Per minute × his minutes (season alone)', dict(plain(W), perMin=True, mw=(1.0, 0.0, 0.0, 0.0))),
]
for label, cfg in variants:
    rows.append([label] + [f2(mae(fit, s, cfg)) for s in MK] + [f3(rel(fit, cfg, plain(BOARD['w'])))] + [f2(mae(test, s, cfg)) for s in MK] + [f3(rel(test, cfg, plain(BOARD['w'])))])
table(['Rate', 'fit pts', 'reb', 'ast', 'tpm', 'pra', 'fit vs board', 'test pts', 'reb', 'ast', 'tpm', 'pra', 'test vs board'], rows)

def with_last(df, s, K, w):
    """His season to date shrunk toward his last season at n / (n + K), then the windows."""
    szn = col(df, s, 'szn'); last = col(df, s, 'last'); n = df.n.astype(float)
    have = last.notna() & (df.nLast >= 10)
    sz = np.where(have, (n * szn + K * last.fillna(0)) / (n + K), szn)
    return w[0] * sz + w[1] * col(df, s, 'l10') + w[2] * col(df, s, 'l5') + w[3] * col(df, s, 'l20')
rows = []
for K in (0, 5, 10, 20, 40):
    r = [K]
    for label, lo, hi in tiers[:3]:
        F = fit[(fit.n >= lo) & (fit.n <= hi)]
        r.append(f3(np.mean([np.mean(np.abs(with_last(F, s, K, BOARD['w']) - col(F, s, 'act'))) / mae(F, s, plain(BOARD['w'])) for s in MK])))
    T = test
    r.append(f3(np.mean([np.mean(np.abs(with_last(T, s, K, BOARD['w']) - col(T, s, 'act'))) / mae(T, s, plain(BOARD['w'])) for s in MK])))
    rows.append(r)
line('Last season behind his season to date (Vincent’s call of 2026-10-27 keeps last season out of the season window; measured here, not used below). MAE against the board’s windows, 1.000 = the same:')
line()
table(['Shrink toward last season (games)', 'fit, 1–3 games', 'fit, 4–9', 'fit, 10–29', 'test season'], rows)

# ---- 2. the multipliers, coordinate by coordinate
line('## 2. On top of his rate: the matchup, the script, the night')
line()
def tune(cfg, F):
    """Coordinate search on the fit season, two passes."""
    cfg = json.loads(json.dumps(cfg))
    for _ in range(2):
        best = (rel(F, cfg), None)
        for E in (0.0, 0.2, 0.4, 0.6, 0.8, 1.0):
            for K in (0, 3, 5, 10, 20, 40):
                c = dict(cfg, E=E, K=K); v = rel(F, c)
                if v < best[0]: best = (v, c)
        if best[1]: cfg = best[1]
        for s in MK:
            best = (mae(F, s, cfg), None)
            for a in (0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5):
                c = json.loads(json.dumps(cfg)); c['alpha'][s] = a; v = mae(F, s, c)
                if v < best[0] - 1e-9: best = (v, c)
            if best[1]: cfg = best[1]
            best = (mae(F, s, cfg), None)
            for h in (0.0, 0.01, 0.02, 0.03, 0.04):
                c = json.loads(json.dumps(cfg)); c['home'][s] = h; v = mae(F, s, c)
                if v < best[0] - 1e-9: best = (v, c)
            if best[1]: cfg = best[1]
        best = (rel(F, cfg), None)
        for b in (0.0, 0.02, 0.04, 0.06):
            c = dict(cfg, b2b=b); v = rel(F, c)
            if v < best[0]: best = (v, c)
        if best[1]: cfg = best[1]
        best = (rel(F, cfg), None)
        for g in (0.0, 0.2, 0.4, 0.6, 0.8, 1.0):
            c = dict(cfg, vac=g); v = rel(F, c)
            if v < best[0]: best = (v, c)
        if best[1]: cfg = best[1]
    return cfg
start = dict(BOARD, w=W)
COCKTAIL = tune(start, fit)
steps = [
    ('The board today: season / L10 0.65 / 0.35 × the matchup at full weight (0.6) from the first game', BOARD),
    ('The board’s rate alone, no matchup', dict(BOARD, E=0.0)),
    ('Best windows, no matchup', dict(BOARD, w=W, E=0.0)),
    (f'+ the matchup at {COCKTAIL["E"]} damped by the opponent’s games at games / (games + {COCKTAIL["K"]})', dict(BOARD, w=W, E=COCKTAIL['E'], K=COCKTAIL['K'])),
    ('+ the book’s script: implied points (pts, threes, PRA) and the game total (reb, ast) over the team’s usual', dict(BOARD, w=W, E=COCKTAIL['E'], K=COCKTAIL['K'], alpha=COCKTAIL['alpha'])),
    ('+ home and back-to-back', dict(BOARD, w=W, E=COCKTAIL['E'], K=COCKTAIL['K'], alpha=COCKTAIL['alpha'], home=COCKTAIL['home'], b2b=COCKTAIL['b2b'])),
    (f'+ teammates out: {COCKTAIL["vac"]} of their share of the team’s production', COCKTAIL),
]
rows = []
for label, cfg in steps:
    rows.append([label] + [f2(mae(fit, s, cfg)) for s in MK] + [f3(rel(fit, cfg))] + [f2(mae(test, s, cfg)) for s in MK] + [f3(rel(test, cfg))] + [f2(np.mean([bias(test, s, cfg) for s in ('pts',)]))])
table(['Cocktail, built up', 'fit pts', 'reb', 'ast', 'tpm', 'pra', 'fit vs board', 'test pts', 'reb', 'ast', 'tpm', 'pra', 'test vs board', 'test pts bias'], rows)
line(f'The tuned parameters: windows season / L10 / L5 / L20 = {" / ".join(f"{x:.1f}" for x in COCKTAIL["w"])}; matchup weight {COCKTAIL["E"]}, damped at games / (games + {COCKTAIL["K"]}); the script’s elasticity {", ".join(f"{k} {v}" for k, v in COCKTAIL["alpha"].items()) or "none"}; home {", ".join(f"{k} ±{v}" for k, v in COCKTAIL["home"].items() if v) or "none"}; back-to-back −{COCKTAIL["b2b"]}; teammates out {COCKTAIL["vac"]}.')
line()
# each ingredient taken out of the cocktail
rows = []
outs = [('the matchup', dict(COCKTAIL, E=0.0)), ('the script', dict(COCKTAIL, alpha={})), ('home', dict(COCKTAIL, home={})), ('back-to-back', dict(COCKTAIL, b2b=0.0)), ('teammates out', dict(COCKTAIL, vac=0.0)), ('the windows (back to the board’s)', dict(COCKTAIL, w=BOARD['w']))]
for label, cfg in outs:
    rows.append([f'Without {label}', f3(rel(fit, cfg, COCKTAIL)), f3(rel(test, cfg, COCKTAIL))])
table(['Each ingredient taken out', 'fit season, MAE vs the cocktail', 'test season'], rows)

# the matchup in detail
rows = []
for E in (0.0, 0.3, 0.6, 1.0):
    for K in (0, 5, 10, 20):
        c = dict(COCKTAIL, E=E, K=K)
        rows.append([E, K, f3(rel(fit, c, COCKTAIL)), f3(rel(test, c, COCKTAIL))])
line('### The matchup grid (MAE against the cocktail; 0 games of damping = the table at full weight from the first game)')
line()
table(['weight', 'damping K', 'fit', 'test'], rows)

# ---- 3. the distribution and the chance
line('## 3. From the projection to the chance at a line')
line()
def rung_frame(D, R, cfg):
    P = {s: project(D, s, cfg) for s in MK}
    out = R.copy()
    out['proj'] = [P[s][i] for s, i in zip(R.mk, R.ri)]
    sd = {s: np.maximum.reduce([col(D, s, 'sd').values, 0.25 * P[s], np.full(len(D), STEP[s] / 2)]) for s in MK}
    out['sd'] = [sd[s][i] for s, i in zip(R.mk, R.ri)]
    out['n'] = D.n.values[R.ri.values]
    return out[~out.proj.isna()]
# the rungs are indexed on the unfiltered frames: rebuild them on the population's positions
def rungs_for(Dfull, R, pop, cfg):
    idx = {old: new for new, old in enumerate(pop.index)}
    R2 = R[R.ri.isin(idx.keys())].copy(); R2['ri'] = R2.ri.map(idx)
    return rung_frame(pop.reset_index(drop=True), R2, cfg)
fitG_board = rungs_for(fitD, fitR, fit, BOARD); testG_board = rungs_for(testD, testR, test, BOARD)
fitG = rungs_for(fitD, fitR, fit, COCKTAIL); testG = rungs_for(testD, testR, test, COCKTAIL)
def tail(G, kappa): return 1 - norm.cdf((G.line - G.proj) / (G.sd * kappa))
WEIGHTS_BOARD = (0.3, 0.3, 0.4)
def emp(G, w=WEIGHTS_BOARD):
    parts = np.vstack([G.h5.values * w[0], G.h10.values * w[1], np.nan_to_num(G.hS.values) * w[2]])
    wsum = w[0] + w[1] + np.where(np.isnan(G.hS.values), 0, w[2])
    return parts.sum(axis=0) / wsum
def chance(G, kappa=1.0, wm=0.5, w=WEIGHTS_BOARD, Ke=0, to='half'):
    m = np.asarray(tail(G, kappa), dtype=float); e = emp(G, w)
    if Ke:
        nn = np.minimum(G.n.values + 0.0, 17)
        e = (nn * e + Ke * (0.5 if to == 'half' else m)) / (nn + Ke)
    return wm * m + (1 - wm) * e
def brier(p, y): return float(np.mean((p - y) ** 2))
def bands(p, y, cuts=((0.6, 0.7), (0.7, 0.8), (0.8, 1.01))):
    return [f'{int(((p >= lo) & (p < hi)).sum())} · {pct(p[(p >= lo) & (p < hi)].mean())} → {pct(y[(p >= lo) & (p < hi)].mean())}' if ((p >= lo) & (p < hi)).any() else '—' for lo, hi in cuts]
cands = []
for kappa in (1.0, 1.2, 1.4, 1.6):
    for wm in (0.5, 0.6, 0.7, 0.8, 1.0):
        for w in ((0.3, 0.3, 0.4), (0.15, 0.35, 0.5), (0.1, 0.3, 0.6), (0.0, 0.5, 0.5)):
            for Ke, to in ((0, 'half'), (6, 'half'), (6, 'model'), (12, 'model')):
                cands.append(((kappa, wm, w, Ke, to), brier(chance(fitG, kappa, wm, w, Ke, to), fitG.over.values)))
cands.sort(key=lambda x: x[1]); (bk, bwm, bw, bKe, bto), _ = cands[0]
main = lambda G: G[G.k == 0]
rows = []
specs = [
    ('The board today: ½ his distribution + ½ hit rates (0.3 / 0.3 / 0.4), his spread as is', 'board', dict(kappa=1.0, wm=0.5, w=WEIGHTS_BOARD, Ke=0)),
    ('The cocktail’s projection, the chance as shipped', 'cocktail', dict(kappa=1.0, wm=0.5, w=WEIGHTS_BOARD, Ke=0)),
    (f'The cocktail: spread × {bk}, {bwm} his distribution, hit rates {"/".join(str(x) for x in bw)}' + (f' shrunk to {"½" if bto == "half" else "the model"} at n / (n + {bKe})' if bKe else ''), 'cocktail', dict(kappa=bk, wm=bwm, w=bw, Ke=bKe, to=bto)),
]
for label, which, kw in specs:
    rows_ = []
    for season, (Gb, Gc) in (('fit', (fitG_board, fitG)), ('test', (testG_board, testG))):
        G = Gb if which == 'board' else Gc
        p = chance(G, **kw); y = G.over.values; pm = chance(main(G), **kw); ym = main(G).over.values
        rows_ += [f4(brier(p, y)), f4(brier(pm, ym)), *bands(p, y)]
    rows.append([label] + rows_)
table(['Chance at the rungs', 'fit Brier', 'fit main rung', 'fit 60–70%', '70–80%', '80%+', 'test Brier', 'test main rung', 'test 60–70%', '70–80%', '80%+'], rows)
line('Ten best settings on the fit season (Brier over every rung):')
line()
table(['spread ×', 'his distribution', 'hit-rate weights L5 / L10 / season', 'shrink', 'fit Brier'], [[c[0][0], c[0][1], ' / '.join(str(x) for x in c[0][2]), f'{c[0][3]} to {c[0][4]}' if c[0][3] else 'none', f4(c[1])] for c in cands[:10]])

# the plays' chance: the hit rates the tables read (before the price) against the cocktail's chance at the line
line('### The tables’ chance: hit rates alone, or the cocktail')
line()
line('The tables rank a play by its hit rates (0.3 / 0.3 / 0.4) shrunk toward the book’s price at n / (n + 6). Without a price here, both reads are shrunk toward ½ the same way; the question is which estimate goes in. Main rung and the rungs either side of it.')
line()
def hits_only(G, w=WEIGHTS_BOARD):
    e = emp(G, w); nn = np.minimum(G.n.values + 0.0, 17); return (nn * e + 6 * 0.5) / (nn + 6)
def cocktail_play(G):
    c = chance(G, bk, bwm, bw, bKe, bto); nn = np.minimum(G.n.values + 0.0, 17); return (nn * c + 6 * 0.5) / (nn + 6)
rows = []
for season, Gb, Gc in (('fit', fitG_board, fitG), ('test', testG_board, testG)):
    near = lambda G: G[G.k.isin([-1, 0, 1])]
    for label, p, y in (('Hit rates (as shipped)', hits_only(near(Gb)), near(Gb).over.values), ('Hit rates at the new weights', hits_only(near(Gb), bw), near(Gb).over.values), ('The cocktail’s chance', cocktail_play(near(Gc)), near(Gc).over.values)):
        sel = p >= 0.55
        rows.append([season, label, f4(brier(p, y)), f'{int(sel.sum())} · {pct(p[sel].mean())} → {pct(y[sel].mean())}'])
table(['Season', 'Estimate', 'Brier', 'over the floor (55%): n · said → hit'], rows)


# ------------------------------------------------------------------ 4. the settings that hold across both seasons
line('## 4. Settling the cocktail: one set of weights for every stage of the season')
line()
CANDS = [(0.65, 0.35, 0.0, 0.0), (0.5, 0.0, 0.0, 0.5), (0.6, 0.0, 0.0, 0.4), (0.3, 0.1, 0.2, 0.4), (0.5, 0.1, 0.2, 0.2), (0.4, 0.1, 0.1, 0.4), (0.5, 0.1, 0.1, 0.3), (0.4, 0.2, 0.1, 0.3)]
def this_season_l20(df, s):
    """His last twenty this season alone (min(n, 20) games): the window without last season's games in it."""
    n = df.n.clip(upper=20).astype(float)
    return np.where(df.n >= 20, col(df, s, 'l20'), col(df, s, 'szn'))
rows = []
for w in CANDS:
    r = [' / '.join(f'{x:.2f}' for x in w)]
    for label, lo, hi in tiers:
        F = fit[(fit.n >= lo) & (fit.n <= hi)]
        r.append(f3(rel(F, plain(w), plain(BOARD['w']))))
    r.append(f3(rel(test, plain(w), plain(BOARD['w']))))
    rows.append(r)
table(['season / L10 / L5 / L20 (L20 across seasons, as L10 is)', 'fit 1–3 games', '4–9', '10–29', '30+', 'test'], rows)
line('The same with the twenty kept inside this season (fewer than twenty games: the season to date stands in), so no game of last season enters past the L10 the board already reads:')
line()
rows = []
for w in CANDS[1:]:
    r = [' / '.join(f'{x:.2f}' for x in w)]
    for label, lo, hi in tiers + [('test', None, None)]:
        F = test if lo is None else fit[(fit.n >= lo) & (fit.n <= hi)]
        v = np.mean([np.mean(np.abs(w[0] * col(F, s, 'szn') + w[1] * col(F, s, 'l10') + w[2] * col(F, s, 'l5') + w[3] * this_season_l20(F, s) - col(F, s, 'act'))) / mae(F, s, plain(BOARD['w'])) for s in MK])
        r.append(f3(v))
    rows.append(r)
table(['season / L10 / L5 / L20 (this season only)', 'fit 1–3 games', '4–9', '10–29', '30+', 'test'], rows)

line('### His spread by games this season (the chance at every rung, the cocktail’s chance otherwise)')
line()
rows = []
for kappa in (1.0, 1.2, 1.4, 1.6):
    r = [kappa]
    for label, lo, hi in tiers:
        G = fitG[(fitG.n >= lo) & (fitG.n <= hi)]
        r.append(f4(brier(chance(G, kappa, bwm, bw, bKe, bto), G.over.values)))
    r.append(f4(brier(chance(testG, kappa, bwm, bw, bKe, bto), testG.over.values)))
    rows.append(r)
table(['spread ×', 'fit 1–3 games', '4–9', '10–29', '30+', 'test'], rows)
def kappa_n(G, a, b=10): return 1 + a * b / (G.n.values + b)
def chance_kn(G, a, b=10):
    m = 1 - norm.cdf((G.line.values - G.proj.values) / (G.sd.values * kappa_n(G, a, b))); e = emp(G, bw)
    if bKe:
        nn = np.minimum(G.n.values + 0.0, 17); e = (nn * e + bKe * (0.5 if bto == 'half' else m)) / (nn + bKe)
    return bwm * m + (1 - bwm) * e
rows = []
for a in (0.0, 0.2, 0.4, 0.6, 0.8):
    for b in (5, 10):
        rows.append([a, b, f4(brier(chance_kn(fitG, a, b), fitG.over.values)), f4(brier(chance_kn(fitG[fitG.n <= 9], a, b), fitG[fitG.n <= 9].over.values)), f4(brier(chance_kn(testG, a, b), testG.over.values)), *bands(chance_kn(testG, a, b), testG.over.values)])
table(['widening a', 'at b games', 'fit Brier', 'fit, 1–9 games', 'test Brier', 'test 60–70%', '70–80%', '80%+'], rows)
line('The spread × (1 + a · b / (n + b)), n his games this season: wide in the first games, his own spread once the season is his.')
line()

open(args.out, 'w').write('\n'.join(md))
json.dump(dict(cocktail=COCKTAIL, chance=dict(kappa=bk, wm=bwm, w=bw, Ke=bKe, to=bto)), open(args.out.replace('.md', '.json'), 'w'), indent=1)
print('\n'.join(md))

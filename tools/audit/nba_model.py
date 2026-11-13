#!/usr/bin/env python3
"""How much accuracy is left (Vincent, 2026-11-13: "put in some REAL effort to improve our accuracy"): a gradient-boosted
model per stat on everything the box scores know before a game, trained on the seasons before and scored on the next,
against the site's board replayed on the same player-games. Then which group of features carries the gain (each group
dropped in turn), so the part worth having can be built into the board.

  python3 -I tools/audit/nba_model.py --box .nhl-data/audit/nba-box --board 2026:.nhl-data/audit/run/nba-2026-04-12-site-rows.csv \\
      2027:.nhl-data/audit/run/nba-2026-11-12-site-rows.csv --out docs/audits/2026-11-13-nba-model-tables.md

Needs numpy, pandas, lightgbm. The rows are cached as model-rows.pkl beside the box scores (--rebuild).
"""
import argparse, glob, json, math, os, sys
from collections import defaultdict
import numpy as np, pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument('--box', required=True); ap.add_argument('--board', nargs='*', default=[]); ap.add_argument('--out', default=None)
ap.add_argument('--rebuild', action='store_true'); ap.add_argument('--ablate', action='store_true')
args = ap.parse_args()

ST = ('pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'tov', 'fga', 'fgm', 'tpa', 'fta', 'ftm', 'oreb', 'min')
TARGETS = ('pts', 'reb', 'ast', 'tpm')
def num(v):
    try: return float(v)
    except Exception: return 0.0
def dash(v, i):
    try: return float(str(v).split('-')[i])
    except Exception: return 0.0
def posg(p):
    p = (p or '').upper()
    return 'G' if p in ('PG', 'SG', 'G') else 'C' if p == 'C' else 'F'

def load(box):
    games = []
    for f in glob.glob(os.path.join(box, '[0-9]*', '*.json')):
        j = json.load(open(f)); h = j['header']; comp = h['competitions'][0]
        side = {c['homeAway']: c['team']['abbreviation'] for c in comp['competitors']}
        pc = (j.get('pickcenter') or [{}])[0] or {}
        g = dict(id=str(h['id']), date=j['date'], season=int(h['season']['year']), home=side['home'], away=side['away'], total=pc.get('overUnder'), spread=pc.get('spread'), players=[])
        for t in j['boxscore'].get('players', []):
            team = t['team']['abbreviation']; s = (t.get('statistics') or [None])[0]
            if not s: continue
            keys = s.get('keys', [])
            for a in s.get('athletes', []):
                ath = a.get('athlete') or {}; v = a.get('stats') or []
                if not ath.get('id') or a.get('didNotPlay') or not v: continue
                at = lambda k: v[keys.index(k)] if k in keys and len(v) > keys.index(k) else None
                m = num(at('minutes'))
                if m <= 0: continue
                fg = at('fieldGoalsMade-fieldGoalsAttempted'); tp = at('threePointFieldGoalsMade-threePointFieldGoalsAttempted'); ft = at('freeThrowsMade-freeThrowsAttempted')
                g['players'].append(dict(id=str(ath['id']), name=ath.get('displayName', ''), team=team, home=int(team == side['home']), pos=posg((ath.get('position') or {}).get('abbreviation')), starter=int(bool(a.get('starter'))),
                                         min=m, pts=num(at('points')), reb=num(at('rebounds')), ast=num(at('assists')), stl=num(at('steals')), blk=num(at('blocks')), tov=num(at('turnovers')), oreb=num(at('offensiveRebounds')),
                                         fgm=dash(fg, 0), fga=dash(fg, 1), tpm=dash(tp, 0), tpa=dash(tp, 1), ftm=dash(ft, 0), fta=dash(ft, 1)))
        if len({p['team'] for p in g['players']}) == 2: games.append(g)
    return sorted(games, key=lambda g: (g['date'], g['id']))

def wmean(vals, w): return float(np.dot(vals, w) / w.sum())

def build(games):
    hist = defaultdict(list)            # pid -> [(vector over ST, season, team, date, starter, mates frozenset)]
    tgames = defaultdict(list)          # (season, team) -> [{'own': totals, 'opp': totals, 'oppPos': {G,F,C: totals}, 'date'}]
    prevTab = {}                        # team -> last season's (allowed per game dict, pace)
    lastSeason = None
    rows = []
    AK = ('pts', 'reb', 'ast', 'tpm', 'tpa', 'fga', 'stl', 'blk')
    def tot(ps):
        t = {k: sum(p[k] for p in ps) for k in ST}; t['poss'] = t['fga'] - t['oreb'] + t['tov'] + 0.44 * t['fta']; return t
    for g in games:
        season = g['season']
        if season != lastSeason:
            if lastSeason is not None:
                for (s, team), L in tgames.items():
                    if s == lastSeason and L: prevTab[team] = ({k: float(np.mean([x['opp'][k] for x in L])) for k in AK}, float(np.mean([x['own']['poss'] for x in L])), {q: {k: float(np.mean([x['oppPos'][q][k] for x in L])) for k in AK} for q in 'GFC'})
            lastSeason = season
        # the league so far (this season's team-games, last season's tables behind them)
        allL = [x for (s, t), L in tgames.items() if s == season for x in L]
        def league(fn, prior):
            v = [fn(x) for x in allL]; n = len(v)
            return (sum(v) + prior * 60) / (n + 60) if prior is not None else (float(np.mean(v)) if v else None)
        pv = list(prevTab.values())
        lgA = {k: league(lambda x, k=k: x['opp'][k], float(np.mean([p[0][k] for p in pv])) if pv else None) for k in AK}
        lgPoss = league(lambda x: x['own']['poss'], float(np.mean([p[1] for p in pv])) if pv else None)
        lgPos = {q: {k: league(lambda x, q=q, k=k: x['oppPos'][q][k], float(np.mean([p[2][q][k] for p in pv])) if pv else None) for k in AK} for q in 'GFC'}
        def allowed(team, k, pos=None, last=None, K=10):
            L = tgames[(season, team)]; L2 = L[-last:] if last else L
            cur = [(x['oppPos'][pos][k] if pos else x['opp'][k]) for x in L2]; n = len(cur)
            pr = prevTab.get(team); prior = (pr[2][pos][k] if pos else pr[0][k]) if pr else (lgPos[pos][k] if pos else lgA[k])
            lg = lgPos[pos][k] if pos else lgA[k]
            if prior is None or lg is None or lg <= 0: return 1.0
            return ((sum(cur) + prior * K) / (n + K)) / lg
        def pace(team, K=10):
            L = tgames[(season, team)]; pr = prevTab.get(team); prior = pr[1] if pr else lgPoss
            if prior is None or not lgPoss: return 1.0
            return ((sum(x['own']['poss'] for x in L) + prior * K) / (len(L) + K)) / lgPoss
        for team in (g['home'], g['away']):
            opp = g['away'] if team == g['home'] else g['home']
            ps = [p for p in g['players'] if p['team'] == team]; playing = {p['id'] for p in ps}
            TL = tgames[(season, team)]; OL = tgames[(season, opp)]
            rest = (pd.Timestamp(g['date']) - pd.Timestamp(TL[-1]['date'])).days if TL else 5
            orest = (pd.Timestamp(g['date']) - pd.Timestamp(OL[-1]['date'])).days if OL else 5
            fav = None if g['spread'] is None else (-g['spread'] if team == g['home'] else g['spread'])
            # every teammate's production this season with the team (decayed), for the absences and the returns
            prod = {}
            mates_all = set().union(*[x['played'] for x in TL[-25:]]) | playing if TL else playing
            for j in mates_all:
                H = [h for h in hist[j] if h[1] == season and h[2] == team][-20:]
                if len(H) < 2: continue
                w = 0.5 ** (np.arange(len(H))[::-1] / 10.0); M = np.array([h[0] for h in H])
                prod[j] = (M * w[:, None]).sum(0) / w.sum()
            tsum = np.array([float(np.mean([x['own'][k] for x in TL[-20:]])) if TL else 1.0 for k in ST]); tsum[tsum <= 0] = 1.0
            for p in ps:
                H = hist[p['id']]
                Hs = [h for h in H if h[1] == season]
                if len(H) < 5: continue
                r = dict(id=p['id'], name=p['name'], date=g['date'], season=season, team=team, opp=opp, home=p['home'], pos=p['pos'], posN='GFC'.index(p['pos']), starter=p['starter'], nSeason=len(Hs), nAll=len(H),
                         rest=min(rest, 6), orest=min(orest, 6), fav=fav, total=g['total'], imp=None if fav is None or g['total'] is None else g['total'] / 2 + fav / 2)
                for k in TARGETS + ('min',): r[f'y_{k}'] = p[k]
                M = np.array([h[0] for h in H[-60:]]); n = len(M); age = np.arange(n)[::-1]
                mins = M[:, ST.index('min')]
                for hl in (3, 8, 20, 50):
                    w = 0.5 ** (age / hl); wm = float(np.dot(mins, w))
                    for k in ST[:-1]: r[f'pm{hl}_{k}'] = float(np.dot(M[:, ST.index(k)], w)) / max(wm, 1e-6)       # per minute, decayed
                    r[f'min{hl}'] = wm / w.sum()
                for k in ('pts', 'reb', 'ast', 'tpm', 'fga', 'tpa', 'min'):
                    c = M[:, ST.index(k)]
                    r[f'l3_{k}'] = float(c[-3:].mean()); r[f'l10_{k}'] = float(c[-10:].mean()); r[f'sd20_{k}'] = float(c[-20:].std()) if n >= 3 else 0.0; r[f'max10_{k}'] = float(c[-10:].max())
                    r[f's_{k}'] = float(np.mean([h[0][ST.index(k)] for h in Hs])) if Hs else float('nan')
                r['last_min'] = float(mins[-1]); r['startShare'] = float(np.mean([h[4] for h in H[-10:]])); r['startLast'] = H[-1][4]
                r['sameTeam'] = float(np.mean([h[2] == team for h in H[-10:]]))
                # his minutes in tonight's role (started / came off the bench), this season
                role = [h[0][ST.index('min')] for h in Hs if h[4] == p['starter']]
                r['minRole'] = float(np.mean(role[-10:])) if role else float('nan'); r['nRole'] = len(role)
                # the teammates: who he usually plays beside against who plays tonight, weighted by what they produce
                Hm = [h for h in H if h[2] == team][-20:]
                if Hm:
                    w = 0.5 ** (np.arange(len(Hm))[::-1] / 15.0); ws = w.sum()
                    out = np.zeros(len(ST)); back = np.zeros(len(ST)); outTop = 0.0; backTop = 0.0
                    for j, pj in prod.items():
                        if j == p['id'] or pj[ST.index('min')] < 12: continue
                        share = float(sum(wi for wi, h in zip(w, Hm) if j in h[5]) / ws)
                        d = (1.0 if j in playing else 0.0) - share
                        if d < 0: out += -d * pj; outTop = max(outTop, -d * pj[0])
                        elif d > 0: back += d * pj; backTop = max(backTop, d * pj[0])
                    for k in ('pts', 'reb', 'ast', 'fga', 'tpa', 'min'):
                        r[f'out_{k}'] = float(out[ST.index(k)] / tsum[ST.index(k)]); r[f'back_{k}'] = float(back[ST.index(k)] / tsum[ST.index(k)])
                    r['outTop'] = outTop; r['backTop'] = backTop
                # the opponent and the pace
                for k in AK:
                    r[f'oa_{k}'] = allowed(opp, k); r[f'oaL_{k}'] = allowed(opp, k, last=10, K=5); r[f'oaP_{k}'] = allowed(opp, k, pos=p['pos'])
                r['pace'] = pace(team); r['opace'] = pace(opp); r['oppGames'] = len(OL)
                rows.append(r)
        for team in (g['home'], g['away']):
            opp = g['away'] if team == g['home'] else g['home']
            ps = [p for p in g['players'] if p['team'] == team]; ops = [p for p in g['players'] if p['team'] == opp]
            played = frozenset(p['id'] for p in ps)
            tgames[(season, team)].append(dict(own=tot(ps), opp=tot(ops), oppPos={q: {k: sum(x[k] for x in ops if x['pos'] == q) for k in AK} for q in 'GFC'}, date=g['date'], played=played))
            for p in ps: hist[p['id']].append((np.array([p[k] for k in ST]), season, team, g['date'], p['starter'], played))
    return rows

cache = os.path.join(args.box, 'model-rows.pkl')
if os.path.exists(cache) and not args.rebuild: X = pd.read_pickle(cache)
else:
    X = pd.DataFrame(build(load(args.box))); X.to_pickle(cache)
print(f'{len(X)} player-games', X.groupby('season').size().to_dict(), file=sys.stderr)

# ------------------------------------------------------------------ the models
import lightgbm as lgb
NAME = {'pts': 'Points', 'reb': 'Rebounds', 'ast': 'Assists', 'tpm': 'Threes'}
SEAS = {2024: '2023-24', 2025: '2024-25', 2026: '2025-26', 2027: '2026-27'}
META = {'id', 'name', 'date', 'season', 'team', 'opp', 'pos'} | {c for c in X.columns if c.startswith('y_')}
FEATS = [c for c in X.columns if c not in META]
GROUPS = {
    'who is out and who is back (teammates)': [c for c in FEATS if c.startswith(('out_', 'back_')) or c in ('outTop', 'backTop')],
    'who is back alone': [c for c in FEATS if c.startswith('back_') or c == 'backTop'],
    'tonight\'s start and his minutes in that role': ['starter', 'startShare', 'startLast', 'minRole', 'nRole'],
    'the opponent (allowed, all / last ten / his position)': [c for c in FEATS if c.startswith(('oa_', 'oaL_', 'oaP_')) or c == 'oppGames'],
    'pace': ['pace', 'opace'],
    'the book\'s spread and total': ['fav', 'total', 'imp'],
    'rest and home': ['rest', 'orest', 'home'],
    'his shot volume (attempts a minute)': [c for c in FEATS if c.split('_')[-1] in ('fga', 'tpa', 'fta', 'fgm', 'ftm') and c.startswith(('pm', 'l3', 'l10', 's_', 'sd20', 'max10'))],
}
PARAMS = dict(objective='poisson', learning_rate=0.03, num_leaves=31, min_data_in_leaf=80, feature_fraction=0.7, bagging_fraction=0.8, bagging_freq=1, lambda_l2=5.0, verbose=-1, num_threads=4, seed=7)
def fit_predict(train, test, y, feats, rounds=600):
    m = lgb.train(PARAMS, lgb.Dataset(train[feats], train[y]), num_boost_round=rounds)
    return m.predict(test[feats]), m

board = {}
for spec in args.board:
    s, f = spec.split(':', 1); b = pd.read_csv(f); b = b[(~b.out) & (b.actualMin > 0)]
    b['id'] = b.espnId.astype(str).str.replace(r'\.0$', '', regex=True)
    board[int(s)] = b[['id', 'slate', 'market', 'exp', 'actual', 'outM', 'teamRank', 'teamScale']].rename(columns={'slate': 'date'})

out = []
def w(s=''): out.append(s); print(s, flush=True)
mae = lambda a, b: float(np.mean(np.abs(np.asarray(a) - np.asarray(b))))
w('# The NBA: a model trained on everything the box scores know, against the board'); w()
preds = {}
for S in sorted(board):
    train = X[X.season < S]; test = X[X.season == S].copy()
    w(f'## {SEAS[S]} (trained on {", ".join(SEAS[s] for s in sorted(train.season.unique()))}: {len(train)} player-games)'); w()
    w('| | player-games | the board: miss / bias | the model: miss / bias | his last ten | his season | gain on the board |'); w('| --- | ---: | ---: | ---: | ---: | ---: | ---: |')
    for k in TARGETS:
        p, m = fit_predict(train, test, f'y_{k}', FEATS); test[f'p_{k}'] = p
        J = test.merge(board[S][board[S].market == k], on=['id', 'date'])
        w(f'| {NAME[k]} | {len(J)} | {mae(J.exp, J.actual):.3f} / {(J.exp - J.actual).mean():+.2f} | {mae(J[f"p_{k}"], J.actual):.3f} / {(J[f"p_{k}"] - J.actual).mean():+.2f} | {mae(J[f"l10_{k}"], J.actual):.3f} | {mae(J[f"s_{k}"].fillna(J[f"l10_{k}"]), J.actual):.3f} | {(1 - mae(J[f"p_{k}"], J.actual) / mae(J.exp, J.actual)) * 100:+.1f}% |')
        if k == 'pts':
            imp = pd.Series(m.feature_importance('gain'), index=FEATS).sort_values(ascending=False)
            top = ', '.join(f'{c} {v / imp.sum() * 100:.0f}%' for c, v in imp.head(12).items())
    w(); w(f'Points, the model\'s gain by feature: {top}'); w()
    preds[S] = test
    # where the model and the board part ways
    w('| Points, by cut | n | the board | the model |'); w('| --- | ---: | ---: | ---: |')
    J = test.merge(board[S][board[S].market == 'pts'], on=['id', 'date'])
    for name, f in [('projected 20+ by the board', J.exp >= 20), ('… a teammate out (lift 3%+)', (J.exp >= 20) & (J.outM.fillna(1) > 1.03)), ('… nobody out', (J.exp >= 20) & (J.outM.fillna(1) <= 1)), ('… soft third', (J.exp >= 20) & (J.teamRank <= 10)),
                    ('… ceiling cut 8%+', (J.exp >= 20) & (J.teamScale.fillna(1) <= .92)), ('a teammate back (back_pts 5%+)', J.back_pts >= 0.05), ('a teammate out (out_pts 10%+)', J.out_pts >= 0.10), ('starts, under half of his last ten started', (J.starter == 1) & (J.startShare < .5)),
                    ('his team favoured by 10+', J.fav >= 10), ('his team an underdog by 10+', J.fav <= -10)]:
        d = J[f]
        if len(d) >= 30: w(f'| {name} | {len(d)} | {mae(d.exp, d.actual):.3f} / {(d.exp - d.actual).mean():+.2f} | {mae(d.p_pts, d.actual):.3f} / {(d.p_pts - d.actual).mean():+.2f} |')
    w()
    if args.ablate:
        w('| Without … (the model\'s miss) | ' + ' | '.join(NAME[k] for k in TARGETS) + ' |'); w('| --- |' + ' ---: |' * len(TARGETS))
        full = {k: mae(test.merge(board[S][board[S].market == k], on=['id', 'date'])[f'p_{k}'], test.merge(board[S][board[S].market == k], on=['id', 'date']).actual) for k in TARGETS}
        w('| nothing (the whole model) | ' + ' | '.join(f'{full[k]:.3f}' for k in TARGETS) + ' |')
        for gname, cols in GROUPS.items():
            feats = [c for c in FEATS if c not in cols]; cells = []
            for k in TARGETS:
                p, _ = fit_predict(train, test, f'y_{k}', feats, rounds=400); t2 = test.assign(q=p).merge(board[S][board[S].market == k], on=['id', 'date'])
                cells.append(f'{mae(t2.q, t2.actual):.3f} ({mae(t2.q, t2.actual) - full[k]:+.3f})')
            w(f'| {gname} | ' + ' | '.join(cells) + ' |')
        w()
pd.to_pickle(preds, os.path.join(args.box, 'model-preds.pkl'))
if args.out: open(args.out, 'w').write('\n'.join(out) + '\n')

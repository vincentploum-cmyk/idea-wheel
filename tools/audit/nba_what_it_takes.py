#!/usr/bin/env python3
"""What it takes (Vincent, 2026-11-13: "what are the propfinder and player thresholds that need to happen to predict a
particular player will have 3 threes"): for a mark of each stat (3+ threes, 25+ points, 10+ rebounds, 8+ assists, 2+ steals …)
which of the things known before the game — his own volume, minutes and record at the mark, what the opponent allows (in all
and to his position group, as a rank of 30, 1 = the most), the teammates out, the start, the spread and total — move the chance,
and the plainest set of thresholds that reaches a stated hit rate. Rules are searched on --fit (default 2024-25) and printed
with what they landed on the later seasons, unchanged.

  python3 -I tools/audit/nba_what_it_takes.py --box .nhl-data/audit/nba-box --out docs/audits/2026-11-13-nba-what-it-takes-tables.md

Reads the trimmed box scores of tools/audit/nba-box-fetch.mjs (<box>/<season>/<event>.json); the feature rows are cached as
what-it-takes-rows.pkl beside them (--rebuild). Whether the site's board already says these chances is nba_stars.py's question.
"""
import argparse, glob, json, math, os, sys
from collections import defaultdict, deque
import numpy as np, pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument('--box', required=True); ap.add_argument('--out', default=None); ap.add_argument('--fit', type=int, default=2025)
ap.add_argument('--rebuild', action='store_true')
args = ap.parse_args()

STATS = ('pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'tpa', 'fga', 'fta', 'min')
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
        g = dict(id=str(h['id']), date=j['date'], season=int(h['season']['year']), home=side['home'], away=side['away'], total=pc.get('overUnder'), spread=pc.get('spread'), players=[], dnp=[])
        for t in j['boxscore'].get('players', []):
            team = t['team']['abbreviation']; s = (t.get('statistics') or [None])[0]
            if not s: continue
            keys = s.get('keys', [])
            for a in s.get('athletes', []):
                ath = a.get('athlete') or {}; v = a.get('stats') or []
                if not ath.get('id'): continue
                at = lambda k: v[keys.index(k)] if k in keys and len(v) > keys.index(k) else None
                m = num(at('minutes')) if v and not a.get('didNotPlay') else 0
                if m <= 0: g['dnp'].append((str(ath['id']), team)); continue
                fg = at('fieldGoalsMade-fieldGoalsAttempted'); tp = at('threePointFieldGoalsMade-threePointFieldGoalsAttempted'); ft = at('freeThrowsMade-freeThrowsAttempted')
                g['players'].append(dict(id=str(ath['id']), name=ath.get('displayName', ''), team=team, opp=side['home'] if team == side['away'] else side['away'], home=int(team == side['home']),
                                         pos=posg((ath.get('position') or {}).get('abbreviation')), starter=int(bool(a.get('starter'))), min=m, pts=num(at('points')), reb=num(at('rebounds')),
                                         ast=num(at('assists')), stl=num(at('steals')), blk=num(at('blocks')), fga=dash(fg, 1), tpm=dash(tp, 0), tpa=dash(tp, 1), fta=dash(ft, 1)))
        if len({p['team'] for p in g['players']}) == 2: games.append(g)
    return sorted(games, key=lambda g: (g['date'], g['id']))

def rank_of(table, team, key):
    """1 = the most allowed, among teams with 5+ games; None before."""
    vals = {t: v[key] for t, v in table.items() if v and v.get('n', 0) >= 5}
    if team not in vals or len(vals) < 20: return None
    return 1 + sum(1 for x in vals.values() if x > vals[team])

def build(games):
    hist = defaultdict(list)                      # pid -> his games, oldest first (all seasons)
    allow = defaultdict(lambda: defaultdict(list))  # season -> team -> [what it allowed a game: {stat, pos: {G,F,C: {stat}}}]
    tlast = {}                                    # team -> last game date
    troster = defaultdict(lambda: deque(maxlen=10))   # (season, team) -> last ten games' sets of pids who played
    rows = []
    for g in games:
        season = g['season']
        # what each defense has allowed so far this season (all positions and by group), as ranks
        tab = {}; tabL = {}; tabP = {p: {} for p in 'GFC'}
        for team, L in allow[season].items():
            if not L: continue
            tab[team] = {k: float(np.mean([x[k] for x in L])) for k in ('pts', 'reb', 'ast', 'tpm', 'tpa', 'stl', 'blk')}; tab[team]['n'] = len(L)
            L10 = L[-10:]; tabL[team] = {k: float(np.mean([x[k] for x in L10])) for k in ('pts', 'reb', 'ast', 'tpm', 'tpa', 'stl', 'blk')}; tabL[team]['n'] = len(L)
            for p in 'GFC': tabP[p][team] = {k: float(np.mean([x['pos'][p][k] for x in L])) for k in ('pts', 'reb', 'ast', 'tpm', 'tpa', 'stl', 'blk')}; tabP[p][team]['n'] = len(L)
        for team in (g['home'], g['away']):
            opp = g['away'] if team == g['home'] else g['home']
            ps = [p for p in g['players'] if p['team'] == team]
            played = {p['id'] for p in ps}
            # teammates out: this season's regulars (20+ minutes over 5+ games, in one of the team's last ten) not playing tonight
            recent = set().union(*troster[(season, team)]) if troster[(season, team)] else set()
            outs = []
            for pid in recent - played:
                H = [x for x in hist[pid] if x['season'] == season and x['team'] == team]
                if len(H) >= 5 and np.mean([x['min'] for x in H]) >= 20: outs.append({k: float(np.mean([x[k] for x in H])) for k in STATS})
            vac = {k: sum(o[k] for o in outs) for k in STATS}
            topOut = max([o['pts'] for o in outs], default=0)
            fav = None
            if g['spread'] is not None: fav = -g['spread'] if team == g['home'] else g['spread']   # + = his team favoured by
            for p in ps:
                H = hist[p['id']]; Hs = [x for x in H if x['season'] == season]
                if len(H) < 10 or len(Hs) < 3: continue
                L10 = H[-10:]; L5 = H[-5:]; L40 = H[-40:]
                r = dict(id=p['id'], name=p['name'], date=g['date'], season=season, team=team, opp=opp, home=p['home'], pos=p['pos'], starter=p['starter'], nSeason=len(Hs),
                         startShare=float(np.mean([x['starter'] for x in L10])), b2b=int(tlast.get(team) is not None and (pd.Timestamp(g['date']) - pd.Timestamp(tlast[team])).days == 1),
                         total=g['total'], fav=fav, nOut=len(outs), topOut=topOut)
                for k in STATS:
                    r[f'a_{k}'] = p[k]; r[f'l10_{k}'] = float(np.mean([x[k] for x in L10])); r[f'l5_{k}'] = float(np.mean([x[k] for x in L5])); r[f's_{k}'] = float(np.mean([x[k] for x in Hs]))
                    r[f'vac_{k}'] = vac[k]
                    r[f'max10_{k}'] = float(max(x[k] for x in L10))
                a40 = sum(x['tpa'] for x in L40); m40 = sum(x['tpm'] for x in L40)
                r['tp_pct'] = (m40 + 0.36 * 40) / (a40 + 40)          # his 3P% over 40 games, 40 league attempts behind it
                r['l10'] = L10
                for k in ('pts', 'reb', 'ast', 'tpm', 'tpa', 'stl', 'blk'):
                    r[f'ork_{k}'] = rank_of(tab, opp, k); r[f'orkL_{k}'] = rank_of(tabL, opp, k); r[f'orkP_{k}'] = rank_of(tabP[p['pos']], opp, k)
                    r[f'oval_{k}'] = tab.get(opp, {}).get(k)
                rows.append(r)
        # after the game: histories, the tables, the rosters
        for p in g['players']: hist[p['id']].append(dict(p, season=season, date=g['date']))
        for team in (g['home'], g['away']):
            opp = g['away'] if team == g['home'] else g['home']
            ops = [p for p in g['players'] if p['team'] == opp]
            line = {k: sum(p[k] for p in ops) for k in ('pts', 'reb', 'ast', 'tpm', 'tpa', 'stl', 'blk')}
            line['pos'] = {q: {k: sum(p[k] for p in ops if p['pos'] == q) for k in ('pts', 'reb', 'ast', 'tpm', 'tpa', 'stl', 'blk')} for q in 'GFC'}
            allow[season][team].append(line)
            troster[(season, team)].append({p['id'] for p in g['players'] if p['team'] == team}); tlast[team] = g['date']
    return rows

cache = os.path.join(args.box, 'what-it-takes-rows.pkl')
if os.path.exists(cache) and not args.rebuild: X = pd.read_pickle(cache)
else:
    X = pd.DataFrame(build(load(args.box))); X.to_pickle(cache)
print(f'{len(X)} player-games', X.groupby('season').size().to_dict(), file=sys.stderr)

# ------------------------------------------------------------------ the marks
MARKS = [('tpm', 2), ('tpm', 3), ('tpm', 4), ('tpm', 5), ('pts', 20), ('pts', 25), ('pts', 30), ('reb', 8), ('reb', 10), ('reb', 12), ('ast', 6), ('ast', 8), ('ast', 10), ('stl', 2), ('blk', 2)]
NAME = {'pts': 'points', 'reb': 'rebounds', 'ast': 'assists', 'tpm': 'threes', 'stl': 'steals', 'blk': 'blocks'}
VOL = {'tpm': ('tpa', 'three-point attempts'), 'pts': ('fga', 'field-goal attempts')}
OPP = {'tpm': [('ork_tpa', 'threes attempted against it, all positions'), ('ork_tpm', 'threes made against it, all positions'), ('orkP_tpm', 'threes made against it by his position group'), ('orkL_tpa', 'threes attempted against it, last ten')],
       'pts': [('ork_pts', 'points allowed, all positions'), ('orkP_pts', 'points allowed to his position group'), ('orkL_pts', 'points allowed, last ten')],
       'reb': [('ork_reb', 'rebounds allowed, all positions'), ('orkP_reb', 'rebounds allowed to his position group'), ('orkL_reb', 'rebounds allowed, last ten')],
       'ast': [('ork_ast', 'assists allowed, all positions'), ('orkP_ast', 'assists allowed to his position group'), ('orkL_ast', 'assists allowed, last ten')],
       'stl': [('ork_stl', 'steals allowed, all positions')], 'blk': [('ork_blk', 'blocks allowed, all positions')]}
FIT = X[X.season == args.fit]; CHK = [(s, X[X.season == s]) for s in sorted(X.season.unique()) if s > args.fit]
SEAS = {2024: '2023-24', 2025: '2024-25', 2026: '2025-26', 2027: '2026-27'}
out = []
def w(s=''): out.append(s)
def pc(v): return '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v * 100:.0f}%'
def rate(D, stat, mark): return float((D[f'a_{stat}'] >= mark).mean()) if len(D) else float('nan')
def cells(mask_fn, stat, mark, minN=40):
    r = []
    for D in [FIT] + [d for _, d in CHK]:
        S = D[mask_fn(D)]; r.append(f'{pc(rate(S, stat, mark))} ({len(S)})' if len(S) >= minN else f'— ({len(S)})')
    return r
HEAD = ' | '.join([SEAS[args.fit]] + [SEAS[s] for s, _ in CHK])
def binned(col, bins, stat, mark, label, sel=None, fmt=lambda a, b: f'{a:g}–{b:g}'):
    w(f'| {label} | {HEAD} |'); w('| --- |' + ' ---: |' * (1 + len(CHK)))
    for a, b in zip(bins[:-1], bins[1:]):
        f = lambda D, a=a, b=b: (D[col] >= a) & (D[col] < b) & (sel(D) if sel else True)
        w(f'| {fmt(a, b)} | ' + ' | '.join(cells(f, stat, mark)) + ' |')
    w()

def rules(stat, mark):
    """The widest rule on the fit season that lands the target: his last-ten average, his volume, his minutes, his games at the mark, alone and with an opponent or a teammate out."""
    hits = FIT.l10.apply(lambda L: sum(1 for x in L if x[stat] >= mark))
    F = FIT.assign(h10=hits)
    vol = VOL.get(stat, (None,))[0]
    own = [(f'l10_{stat}', 0)] + [(f'l10_{stat}', q) for q in sorted(set(np.round(np.quantile(F[f'l10_{stat}'], np.linspace(0.3, 0.99, 36)), 1))) if q > 0]
    mins = [('l10_min', m) for m in (0, 24, 28, 30, 32, 34)]
    vols = [(f'l10_{vol}', 0)] + [(f'l10_{vol}', q) for q in sorted(set(np.round(np.quantile(F[f'l10_{vol}'], np.linspace(0.3, 0.99, 30)), 1))) if q > 0] if vol else [(None, None)]
    hs = [('h10', k) for k in (0, 3, 4, 5, 6, 7)]
    ok = OPP[stat][0][0]
    extras = [('none', lambda D: pd.Series(True, index=D.index), ''), ('soft', lambda D: D[ok] <= 10, f'**the opponent top ten** in {OPP[stat][0][1]}'),
              ('out', lambda D: D.topOut >= 15, '**a teammate scoring 15+ a game out**')]
    res = []
    for target in (0.5, 0.6, 0.7):
        for ename, ef, etext in extras:
            E = F[ef(F)]; hit = (E[f'a_{stat}'] >= mark).values
            best = None
            A = {c: E[c].values for c in {f'l10_{stat}', 'l10_min', 'h10'} | ({f'l10_{vol}'} if vol else set())}
            for (oc, ov) in own:
                m1 = A[oc] >= ov
                for (mc, mv) in mins:
                    m2 = m1 & (A[mc] >= mv)
                    for (vc, vv) in (vols if vol else [(None, None)]):
                        m3 = m2 & (A[vc] >= vv) if vc else m2
                        for (hc, hv) in hs:
                            m = m3 & (A[hc] >= hv); n = int(m.sum())
                            if n < 120: continue
                            r = hit[m].mean()
                            if r < target: continue
                            k = sum(1 for v in (ov, mv, vv, hv) if v)
                            if best is None or n > best[0] * (1.03 if k > best[3] else 1 / 1.03 if k < best[3] else 1): best = (n, r, [(oc, ov), (mc, mv), (vc, vv), (hc, hv)], k)
            if best: res.append((target, ename, etext, ef, best))
    return res

def cond_text(c, v, stat, mark):
    if c is None or not v: return None
    if c == 'h10': return f'{mark}+ in {v}+ of his last ten'
    if c == 'l10_min': return f'{v:g}+ minutes a game'
    k = c.split('_', 1)[1]
    return f'{v:g}+ {VOL[stat][1] if stat in VOL and k == VOL[stat][0] else NAME.get(k, k)} a game'

w('# What it takes: the thresholds behind a mark'); w()
w(f'{len(X)} player-games of ESPN\'s box scores (a player with 10+ games behind him and 3+ this season), the rules searched on {SEAS[args.fit]} ({len(FIT)}) and read unchanged on ' + ', '.join(f'{SEAS[s]} ({len(d)})' for s, d in CHK) + '. "Last ten" is his last ten games played; an opponent\'s rank is 1 = allows the most, of 30, this season to date; a teammate out is a 20-minute regular of this season not in the box score.'); w()
for stat, mark in MARKS:
    w(f'## {mark}+ {NAME[stat]}'); w(); w(f'All player-games: ' + ' · '.join(f'{SEAS[s]} {pc(rate(d, stat, mark))}' for s, d in [(args.fit, FIT)] + CHK)); w()
    q = [0] + sorted(set(np.round(np.quantile(FIT[f'l10_{stat}'], [.5, .7, .8, .9, .95, .98]), 1))) + [99]
    binned(f'l10_{stat}', q, stat, mark, f'His {NAME[stat]} a game, last ten')
    if stat in VOL:
        v = VOL[stat][0]; q = [0] + sorted(set(np.round(np.quantile(FIT[f'l10_{v}'], [.5, .7, .8, .9, .95, .98]), 1))) + [99]
        binned(f'l10_{v}', q, stat, mark, f'His {VOL[stat][1]} a game, last ten')
    binned('l10_min', [0, 20, 26, 30, 33, 36, 60], stat, mark, 'His minutes a game, last ten')
    # the opponent, among the players for whom the mark is a real question (his last ten within 1.5 of it per game … or over)
    thr = max(mark * 0.6, mark - {'pts': 8, 'reb': 3.5, 'ast': 3, 'tpm': 1.2, 'stl': 0.9, 'blk': 0.9}[stat])
    cand = lambda D: (D[f'l10_{stat}'] >= thr) & (D.l10_min >= 24)
    w(f'Among the candidates ({thr:.1f}+ {NAME[stat]} a game over his last ten, 24+ minutes): ' + ' · '.join(f'{SEAS[s]} {pc(rate(d[cand(d)], stat, mark))} of {int(cand(d).sum())}' for s, d in [(args.fit, FIT)] + CHK)); w()
    for col, label in OPP[stat]:
        binned(col, [1, 6, 11, 21, 26, 31], stat, mark, f'Opponent\'s rank: {label}', sel=cand, fmt=lambda a, b: f'{a}–{b - 1}')
    w(f'| Tonight | {HEAD} |'); w('| --- |' + ' ---: |' * (1 + len(CHK)))
    for label, f in [('nobody out on his team', lambda D: D.nOut == 0), ('a teammate out (any 20-minute regular)', lambda D: D.nOut >= 1), ('a 15+ points teammate out', lambda D: D.topOut >= 15), ('a 20+ points teammate out', lambda D: D.topOut >= 20),
                     ('he starts', lambda D: D.starter == 1), ('he comes off the bench', lambda D: D.starter == 0), ('he starts, under half of his last ten started', lambda D: (D.starter == 1) & (D.startShare < 0.5)),
                     ('home', lambda D: D.home == 1), ('away', lambda D: D.home == 0), ('second night of a back-to-back', lambda D: D.b2b == 1),
                     ('his team favoured by 8+', lambda D: D.fav >= 8), ('his team an underdog by 8+', lambda D: D.fav <= -8), ('the total 235+', lambda D: D.total >= 235), ('the total under 222', lambda D: D.total < 222)]:
        w(f'| {label} | ' + ' | '.join(cells(lambda D, f=f: cand(D) & f(D), stat, mark)) + ' |')
    w()
    R = rules(stat, mark)
    if R:
        w(f'**The thresholds** (the widest rule on {SEAS[args.fit]} that lands the target; "a night" = the players it names on an average slate day)'); w()
        w(f'| Target | Needs | {HEAD} | a night |'); w('| --- | --- |' + ' ---: |' * (2 + len(CHK)))
        for target, ename, etext, ef, (n, r, conds, _k) in R:
            def mk(D, conds=conds, ef=ef):
                H = D.l10.apply(lambda L: sum(1 for x in L if x[stat] >= mark)) if any(c == 'h10' and v > 0 for c, v in conds) else pd.Series(0, index=D.index)
                m = ef(D)
                for c, v in conds:
                    if c is None: continue
                    m = m & ((H >= v) if c == 'h10' else (D[c] >= v))
                return m
            texts = [t for t in [cond_text(c, v, stat, mark) for c, v in conds] if t] + ([etext] if etext else [])
            days = FIT.date.nunique()
            w(f'| {int(target * 100)}% | {" · ".join(texts)} | ' + ' | '.join(cells(mk, stat, mark, minN=20)) + f' | {n / days:.1f} |')
        w()
if args.out: open(args.out, 'w').write('\n'.join(out) + '\n'); print('written', args.out, file=sys.stderr)
else: print('\n'.join(out))

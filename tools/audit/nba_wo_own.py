"""Does a player's own record without tonight's out teammates predict him better than the board's lift?

Vincent, 2026-11-23, of Grimes with Reaves out (8.0 -> 25.5 points over 4 games): the board lifts an out star's teammates by
a share-based lift (`outRule: 'overlap'`, STAR_OUT exponents), not by the player's own games without him. Test: every
rotation player-game with a regular teammate out (20+ minutes a game this season over 3+ games, still on the team, not in
the box), the board's read = his rate a minute decayed × his minutes decayed, × (1 + V/T)^b with V the out players'
production × the share of his memory they shared (as nba_star_out.py), and his own average this season over his earlier
games for this team that every one of tonight's out players sat (n of them). Candidates: the read moved toward that average
at n / (n + k). k is chosen on 2024-25 and scored unchanged on 2025-26 and this season. Minutes too.

  python3 -I tools/audit/nba_wo_own.py --box .nhl-data/audit/nba-box --out docs/audits/2026-11-23-nba-own-without-tables.md
"""
import argparse, glob, json, math, os
from collections import defaultdict
import numpy as np

ap = argparse.ArgumentParser(); ap.add_argument('--box', required=True); ap.add_argument('--out', required=True); args = ap.parse_args()
STATS = ['pts', 'reb', 'ast', 'tpm']
NAME = {'pts': 'Points', 'reb': 'Rebounds', 'ast': 'Assists', 'tpm': 'Threes', 'min': 'Minutes'}
HL_RATE = {'pts': 15, 'reb': 20, 'ast': 15, 'tpm': 20}
B = {'pts': 0.7, 'reb': 0.3, 'ast': 0.55, 'tpm': 0.4}   # STAR_OUT, shipped 2026-11-09
HL_OVER = 15
KS = [0.5, 1, 2, 4, 8, 16, 32, math.inf]

def num(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0

def load(box):
    games = []
    for f in glob.glob(os.path.join(box, '[0-9]*', '*.json')):
        j = json.load(open(f)); h = j['header']; comp = h['competitions'][0]
        side = {c['homeAway']: c['team']['abbreviation'] for c in comp['competitors']}
        g = dict(id=str(h['id']), date=j['date'], season=int(h['season']['year']), home=side['home'], away=side['away'], players=[])
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
                tp = at('threePointFieldGoalsMade-threePointFieldGoalsAttempted')
                g['players'].append(dict(id=str(ath['id']), name=ath.get('displayName', ''), team=team, min=m, pts=num(at('points')), reb=num(at('rebounds')), ast=num(at('assists')), tpm=num(str(tp).split('-')[0]) if tp else 0.0))
        if len({p['team'] for p in g['players']}) == 2: games.append(g)
    return sorted(games, key=lambda g: (g['date'], g['id']))

def decayed(rows, key, hl, per_min=False):
    d = 0.5 ** (1 / hl); w = 1.0; x = 0.0; ws = 0.0; m = 0.0
    for r in reversed(rows):
        x += w * r[key]; m += w * r['min']; ws += w; w *= d
        if w < 1e-3: break
    if per_min: return x / max(m, 1e-6)
    return x / ws if ws else None

def build(games):
    hist = defaultdict(list); team_games = defaultdict(list); team_tot = defaultdict(list); last_team = {}; box_of = {}
    rows = []
    for date in sorted({g['date'] for g in games}):
        day = [g for g in games if g['date'] == date]
        for g in day:
            season = g['season']
            for team in (g['home'], g['away']):
                TG = team_games[(season, team)]
                if len(TG) < 5: continue
                tot = {s: np.mean([x[s] for x in team_tot[(season, team)]]) for s in STATS}
                played = {p['id'] for p in g['players'] if p['team'] == team}
                seen = defaultdict(list)
                for _, mins in TG:
                    for pid, m in mins.items(): seen[pid].append(m)
                outW = {pid for pid, ms in seen.items() if np.mean(ms) >= 20 and len(ms) >= 3 and last_team.get(pid) == team} - played
                if not outW: continue
                prod = {pid: {s: decayed(hist[pid], s, 10) for s in STATS} for pid in outW}
                for p in g['players']:
                    if p['team'] != team: continue
                    H = hist[p['id']]
                    if len(H) < 5 or np.mean([x['min'] for x in H[-10:]]) < 15: continue
                    mine = [x for x in H if x['season'] == season and x['team'] == team]
                    if len(mine) < 3: continue
                    mins = decayed(mine, 'min', 3)
                    # the overlap share of his memory each out player took part in
                    dd = 0.5 ** (1 / HL_OVER); w = 1.0; ws = 0.0; part = defaultdict(float)
                    for x in reversed(H):
                        mm = box_of.get((x['team'], x['date']))
                        if x['team'] == team and mm:
                            for pid in outW:
                                if pid in mm: part[pid] += w
                        ws += w; w *= dd
                        if w < 1e-3: break
                    over = {pid: (part[pid] / ws if ws else 0.0) for pid in outW}
                    # his own games this season for this team that every out player sat, and those they all played
                    wo = [x for x in mine if all(pid not in box_of.get((team, x['date']), {}) for pid in outW)]
                    wi = [x for x in mine if all(pid in box_of.get((team, x['date']), {}) for pid in outW)]
                    r = dict(date=date, season=season, pid=p['id'], name=p['name'], n=len(wo), nWith=len(wi), min_act=p['min'], min_base=mins,
                             min_wo=np.mean([x['min'] for x in wo]) if wo else None, min_with=np.mean([x['min'] for x in wi]) if wi else None)
                    for s in STATS:
                        base = decayed(H, s, HL_RATE[s], per_min=True) * mins
                        v = sum(prod[pid][s] * over[pid] for pid in outW) / max(tot[s], 1)
                        r[f'{s}_board'] = base * (1 + v) ** B[s]
                        r[f'{s}_act'] = p[s]
                        r[f'{s}_wo'] = np.mean([x[s] for x in wo]) if wo else None
                        r[f'{s}_with'] = np.mean([x[s] for x in wi]) if wi else None
                    rows.append(r)
        for g in day:
            for team in (g['home'], g['away']):
                ps = [p for p in g['players'] if p['team'] == team]
                team_games[(g['season'], team)].append((date, {p['id']: p['min'] for p in ps}))
                box_of[(team, date)] = {p['id']: p['min'] for p in ps}
                team_tot[(g['season'], team)].append({s: sum(p[s] for p in ps) for s in STATS})
            for p in g['players']:
                hist[p['id']].append(dict(date=date, season=g['season'], team=p['team'], min=p['min'], **{s: p[s] for s in STATS}))
                last_team[p['id']] = p['team']
    return rows

def blend(r, s, k):
    board = r[f'{s}_board'] if s != 'min' else r['min_base']; wo = r[f'{s}_wo']
    if wo is None or k == math.inf: return board
    w = r['n'] / (r['n'] + k); return (1 - w) * board + w * wo

def score(rows, s, k):
    y = np.array([r[f'{s}_act'] for r in rows]); mu = np.array([max(blend(r, s, k), 0.05) for r in rows])
    return float(np.mean(np.abs(y - mu))), float(np.mean(mu - y)), float(np.mean(mu - y * np.log(mu)))

games = load(args.box); rows = build(games)
seasons = sorted({r['season'] for r in rows}); lab = lambda c: f'{c - 1}-{str(c)[2:]}'
md = ['# A player\'s own record without tonight\'s out teammates: the tables', '',
      'Rotation player-games with a regular teammate out (20+ minutes a game this season over 3+ games, still on the team, not in the box): ' + ', '.join(f'{lab(s)} {sum(1 for r in rows if r["season"] == s)}' for s in seasons) + '. "Board" = his decayed rate a minute × his decayed minutes, lifted by the shipped overlap rule; "k" = the read moved toward his own average in his earlier games without them at n / (n + k); k = ∞ is the board. MAE and bias in the stat\'s units; NLL the Poisson negative log-likelihood (lower is better).', '']
pick = {}
for subset, flt in [('every row with a teammate out', lambda r: True), ('2+ games without them', lambda r: r['n'] >= 2), ('a big split (2+ games without, 4+ minutes or points over the games with)', lambda r: r['n'] >= 2 and r['min_with'] is not None and (abs(r['min_wo'] - r['min_with']) >= 4 or abs(r['pts_wo'] - r['pts_with']) >= 4))]:
    md += [f'## {subset}', '']
    for s in ['min'] + STATS:
        md += [f'**{NAME[s]}**', '', '| k | ' + ' | '.join(f'{lab(se)} MAE · bias · NLL (n)' for se in seasons) + ' |', '|---|' + '---|' * len(seasons)]
        for k in KS:
            cells = []
            for se in seasons:
                R = [r for r in rows if r['season'] == se and flt(r)]
                if not R: cells.append('–'); continue
                mae, bias, nll = score(R, s, k); cells.append(f'{mae:.3f} · {bias:+.2f} · {nll:.4f} ({len(R)})')
            md.append(f'| {"∞ (board)" if k == math.inf else k} | ' + ' | '.join(cells) + ' |')
        fitR = [r for r in rows if r['season'] == seasons[0] and flt(r)]
        best = min(KS, key=lambda k: score(fitR, s, k)[2]); pick[(subset, s)] = best
        md += ['', f'Best k on {lab(seasons[0])} (NLL): {"∞" if best == math.inf else best}.', '']
open(args.out, 'w').write('\n'.join(md) + '\n')
print('\n'.join(md))

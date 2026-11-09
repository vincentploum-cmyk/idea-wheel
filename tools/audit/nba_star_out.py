"""Who takes a star's production when he sits: the teammates-out read, player by player.

Vincent, 2026-11-09: "yesterday Reaves had 40+ points. I could have known that since Doncic was out and Reaves had
a good matchup. However, our model was still way too conservative. I want our model to look at these things. So,
based on the injury report, adjust the game script, including our projection for assists, points, rebounds, etc."

The board's recipe (`outRead` in lib/picks/board.js) lifts every active teammate's rate by the same factor,
(1 + V / T)^b: V the out players' production a game, T the team's. Two questions, per stat:

  1. Is the lift the same for everyone? Or does the player who already carries a big share of the team's
     production (the second option beside the star) take more than his share of what the star leaves?
     log mu = log(his read) + c + b log(1 + V/T) + g log(1 + V/T) log(share / ref)
     share = his read over the team's figure, ref = 1/8 (a rotation player's even share). g > 0: the
     big shares take more.
  2. Who counts as out. The board counts a teammate who played 3 of the team's last 5 games at 20+ minutes:
     an absence older than that lifts nobody, though a player's decayed memory (half-life 15 games) still holds
     mostly games with the star in. The alternative: every teammate of this season (20+ minutes a game when he
     played, still on the team) not in tonight's box, his production × the share of the player's decayed memory
     he took part in (`overlap`).

Every row is a rotation player's game (his last ten at 15+ minutes, 5+ games behind him), his read built from the
games before it: his rate a minute decayed at 15 games × his minutes this season decayed at 3 (the recipe's).
Fitted on 2024-25, scored unchanged on 2025-26 and this season (ESPN box scores, `nba-box-fetch.mjs`).

  python3 -I tools/audit/nba_star_out.py --box .nhl-data/audit/nba-box --out docs/audits/2026-11-09-nba-star-out-tables.md
"""
import argparse, glob, json, math, os
from collections import defaultdict
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--box', required=True)
ap.add_argument('--out', required=True)
args = ap.parse_args()

STATS = ['pts', 'reb', 'ast', 'tpm']
NAME = {'pts': 'Points', 'reb': 'Rebounds', 'ast': 'Assists', 'tpm': 'Threes'}
HL_RATE = {'pts': 15, 'reb': 20, 'ast': 15, 'tpm': 20}
HL_OVER = 15
REF = 1 / 8


def num(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0


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
                ath = a.get('athlete') or {}; v = a.get('stats') or []
                if not ath.get('id') or a.get('didNotPlay') or not v: continue
                at = lambda k: v[keys.index(k)] if k in keys and len(v) > keys.index(k) else None
                m = num(at('minutes'))
                if m <= 0: continue
                tp = at('threePointFieldGoalsMade-threePointFieldGoalsAttempted')
                g['players'].append(dict(id=str(ath['id']), name=ath.get('displayName', ''), team=team, min=m, pts=num(at('points')),
                                         reb=num(at('rebounds')), ast=num(at('assists')), tpm=num(str(tp).split('-')[0]) if tp else 0.0))
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
    hist = defaultdict(list)          # pid -> rows (oldest first): date, season, team, min, stats, gid
    team_games = defaultdict(list)    # (season, team) -> [(date, {pid: min})]
    team_tot = defaultdict(list)      # (season, team) -> [{stat: total}]
    last_team = {}                    # pid -> his latest team
    box_of = {}                       # (team, date) -> {pid: min}
    rows = []
    def outs(season, team, g):
        TG = team_games[(season, team)]
        if len(TG) < 3: return None
        tot = {s: np.mean([x[s] for x in team_tot[(season, team)]]) for s in STATS}
        played = {p['id'] for p in g['players'] if p['team'] == team}
        # the board's rule: 20+ minutes in 3 of the team's last 5
        apps = defaultdict(list)
        for _, mins in TG[-5:]:
            for pid, m in mins.items(): apps[pid].append(m)
        key = {pid for pid, ms in apps.items() if len(ms) >= 3 and np.mean(ms) >= 20}
        outB = key - played
        # the wide rule: anyone of this season at 20+ a game when he played (3+ games), still on this team, not in the box
        seen = defaultdict(list)
        for _, mins in TG:
            for pid, m in mins.items(): seen[pid].append(m)
        outW = {pid for pid, ms in seen.items() if np.mean(ms) >= 20 and len(ms) >= 3 and last_team.get(pid) == team} - played
        prod = {}
        for pid in outB | outW:
            H = hist[pid]
            prod[pid] = {s: decayed(H, s, 10) for s in STATS + ['min']} if H else {s: 0.0 for s in STATS + ['min']}
        VB = {s: sum(prod[pid][s] for pid in outB) for s in STATS + ['min']}
        VW = {s: sum(prod[pid][s] for pid in outW) for s in STATS + ['min']}
        return dict(tot=tot, played=played, outB=outB, outW=outW, prod=prod, VB=VB, VW=VW)

    for date in sorted({g['date'] for g in games}):
        day = [g for g in games if g['date'] == date]
        for g in day:
            season = g['season']
            for team, opp in ((g['home'], g['away']), (g['away'], g['home'])):
                o = outs(season, team, g); oo = outs(season, opp, g)
                if not o or not oo: continue
                tot, outB, outW, prod, VB = o['tot'], o['outB'], o['outW'], o['prod'], o['VB']
                for p in g['players']:
                    if p['team'] != team: continue
                    H = hist[p['id']]
                    if len(H) < 5 or np.mean([x['min'] for x in H[-10:]]) < 15: continue
                    mine = [x for x in H if x['season'] == season]
                    mins = decayed(mine, 'min', 3) if mine else np.mean([x['min'] for x in H[-10:]])
                    r = dict(date=date, season=season, team=team, pid=p['id'], name=p['name'], nOutB=len(outB), nOutW=len(outW))
                    # how much of his decayed memory each wide-rule absentee took part in (his games for this team)
                    dd = 0.5 ** (1 / HL_OVER); w = 1.0; ws = 0.0; part = defaultdict(float)
                    for x in reversed(H):
                        mm = box_of.get((x['team'], x['date']))
                        if x['team'] == team and mm:
                            for pid in outW:
                                if pid in mm: part[pid] += w
                        ws += w; w *= dd
                        if w < 1e-3: break
                    over = {pid: (part[pid] / ws if ws else 0.0) for pid in outW}
                    for s in STATS:
                        base = decayed(H, s, HL_RATE[s], per_min=True) * mins
                        r[f'{s}_base'] = base; r[f'{s}_act'] = p[s]; r[f'{s}_T'] = tot[s]
                        r[f'{s}_vB'] = VB[s] / max(tot[s], 1)
                        r[f'{s}_vW'] = sum(prod[pid][s] * over[pid] for pid in outW) / max(tot[s], 1)
                        r[f'{s}_share'] = base / max(tot[s], 1)
                        # the opponent's absentees: their production of the stat over the opponent's figure (new, 3 of last 5)
                        r[f'{s}_oppV'] = oo['VB'][s] / max(oo['tot'][s], 1)
                        r[f'{s}_oppVW'] = oo['VW'][s] / max(oo['tot'][s], 1)
                    r['oppMin'] = oo['VB']['min'] / 240; r['oppMinW'] = oo['VW']['min'] / 240
                    r['pts_shareP'] = r['pts_share']
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


def arr(rows, k): return np.array([r[k] for r in rows], dtype=float)


def feats(rows, s, names):
    lv = {'vB': np.log1p(arr(rows, f'{s}_vB')), 'vW': np.log1p(arr(rows, f'{s}_vW')), 'share': np.log(np.maximum(arr(rows, f'{s}_share'), 1e-3) / REF),
          'oppV': np.log1p(arr(rows, f'{s}_oppV')), 'oppVW': np.log1p(arr(rows, f'{s}_oppVW')), 'oppMin': np.log1p(arr(rows, 'oppMin')), 'oppMinW': np.log1p(arr(rows, 'oppMinW'))}
    lv['vW*share'] = lv['vW'] * lv['share']; lv['vB*share'] = lv['vB'] * lv['share']
    return np.column_stack([np.ones(len(rows))] + [lv[n] for n in names])


def fit(rows, s, names):
    """Poisson with his read as the offset (Newton steps)."""
    X = feats(rows, s, names); y = arr(rows, f'{s}_act'); off = np.log(np.maximum(arr(rows, f'{s}_base'), 1e-3))
    beta = np.zeros(X.shape[1]); beta[0] = math.log(y.sum() / np.exp(off).sum())
    for _ in range(50):
        mu = np.exp(off + X @ beta)
        step = np.linalg.solve(X.T @ (X * mu[:, None]) + 1e-6 * np.eye(len(beta)), X.T @ (y - mu))
        beta += step
        if np.max(np.abs(step)) < 1e-9: break
    mu = np.exp(off + X @ beta)
    cov = np.linalg.inv(X.T @ (X * mu[:, None]))
    return beta, np.sqrt(np.diag(cov))


def predict(rows, s, names, beta):
    return arr(rows, f'{s}_base') * np.exp(feats(rows, s, names) @ beta)


def nll(mu, y): return float(np.mean(mu - y * np.log(np.maximum(mu, 1e-9))))


games = load(args.box)
rows = build(games)
seasons = sorted({r['season'] for r in rows})
fitS = seasons[0]; checks = seasons[1:]
F = [r for r in rows if r['season'] == fitS]
lab = lambda c: f'{c - 1}-{str(c)[2:]}'
md = ['# Who takes a star\'s production: the tables', '', f'Rotation player-games: {", ".join(f"{lab(s)} {sum(1 for r in rows if r["season"] == s)}" for s in seasons)}. Fitted on {lab(fitS)}, scored unchanged on the rest. "Out nights": a teammate out under either rule worth 5%+ of the team\'s figure.', '']
VARIANTS = [('none', []), ('board: flat, 3 of last 5', ['vB']), ('flat, wide rule × overlap', ['vW']),
            ('wide × overlap, + his share', ['vW', 'share']), ('wide × overlap, + his share, + share × out', ['vW', 'share', 'vW*share']),
            ('3 of last 5, + his share, + share × out', ['vB', 'share', 'vB*share']),
            ('wide × overlap, + the opponent\'s out (stat)', ['vW', 'oppV']), ('wide × overlap, + the opponent\'s out (minutes)', ['vW', 'oppMin'])]
FITS = {}
for s in STATS:
    md += [f'## {NAME[s]}', '', '| Variant | Coefficients (z) | ' + ' | '.join(f'{lab(c)} MAE, out nights' for c in checks) + ' | ' + ' | '.join(f'{lab(c)} deviance vs none ×1000' for c in checks) + ' |', '| --- ' * (2 + 2 * len(checks)) + '|']
    dev0 = {}
    for label, names in VARIANTS:
        beta, se = fit(F, s, names); FITS[(s, label)] = (names, beta)
        maes = []; devs = []
        for c in checks:
            C = [r for r in rows if r['season'] == c]
            mu = predict(C, s, names, beta); y = arr(C, f'{s}_act')
            on = (arr(C, f'{s}_vW') > 0.05) | (arr(C, f'{s}_vB') > 0.05)
            d = nll(mu, y); dev0.setdefault(c, d)
            maes.append(float(np.mean(np.abs(mu - y)[on]))); devs.append((d - dev0[c]) * 1000)
        co = ', '.join(f'{n} {b:+.3f} ({b / e:+.1f})' for n, b, e in zip(names, beta[1:], se[1:])) or '—'
        md.append(f'| {label} | {co} | ' + ' | '.join(f'{x:.3f}' for x in maes) + ' | ' + ' | '.join(f'{x:+.2f}' for x in devs) + ' |')
    md.append('')
md += ['## The second option on a star\'s night off (out ≥ 20% of the team\'s figure, his share ≥ 18%), checks', '', '| Stat | Rows | Actual | His read | Board (flat, 3 of 5) | Wide × overlap |', '| --- | --- | --- | --- | --- | --- |']
for s in STATS:
    C = [r for r in rows if r['season'] in checks and max(r[f'{s}_vB'], r[f'{s}_vW']) >= 0.2 and r[f'{s}_share'] >= 0.18]
    if not C: continue
    a = predict(C, s, *FITS[(s, 'board: flat, 3 of last 5')]); b2 = predict(C, s, *FITS[(s, 'flat, wide rule × overlap')])
    md.append(f'| {NAME[s]} | {len(C)} | {np.mean(arr(C, f"{s}_act")):.2f} | {np.mean(arr(C, f"{s}_base")):.2f} | {np.mean(a):.2f} | {np.mean(b2):.2f} |')
md.append('')
open(args.out, 'w').write('\n'.join(md))
json.dump({f'{s} · {label}': dict(zip(['c'] + names, [round(float(x), 4) for x in beta])) for (s, label), (names, beta) in FITS.items()}, open(args.out.replace('.md', '.json'), 'w'), indent=1)
print('\n'.join(md))


if os.environ.get('SHOW'):
    for r in rows:
        if os.environ['SHOW'] in r['name'] and r['season'] == seasons[-1]:
            print(r['date'], r['name'], ' '.join(f"{s}: base {r[f'{s}_base']:.1f} act {r[f'{s}_act']:.0f} vB {r[f'{s}_vB']:.2f} vW {r[f'{s}_vW']:.2f} share {r[f'{s}_share']:.2f}" for s in ('pts', 'ast', 'reb')))

#!/usr/bin/env python3
"""Why a player beat his projection by a lot, on the site's own boards (Vincent, 2026-11-24: "when a player hit well over his
projection, we need to know why so we can find patterns and use them going forward").

Reads the board's projections and their parts (`tools/audit/nba-store-top10.mjs` → store-parts.csv / store-players.csv) and
the store copy itself (`.nhl-data/nba/<date>/`: the PropFinder pull for his games before the night, results/*.json for the box
score). Each big night is split into what happened (box score against the projection and his usual: minutes, shots, threes
tried, free throws, how well he shot, rebound / assist rate a minute, a regular teammate missing who was not listed out,
overtime) and then every pre-game read is checked: does it make a big night more likely than the board's figure says?

  python3 -I tools/audit/nba_overs.py --parts .nhl-data/audit/store/store --store .nhl-data/nba --out docs/audits/<date>-nba-overs-tables.md
"""
import argparse, gzip, json, os, sys
from collections import defaultdict
import numpy as np
import pandas as pd

STATS = ['pts', 'reb', 'ast', 'tpm']
# A big night: at least this many over his projection and at least this multiple of it.
BIG = {'pts': (10, 1.5), 'reb': (4, 1.5), 'ast': (4, 1.5), 'tpm': (3, 2.0)}


def norm(name):
    """A name as the site keys it (lib/nhl-data/names.js normName, near enough): lower case, letters only, no suffix."""
    import re, unicodedata
    n = unicodedata.normalize('NFKD', str(name)).encode('ascii', 'ignore').decode().lower()
    n = re.sub(r"[^a-z ]", '', n.replace('-', ' '))
    return ' '.join(w for w in n.split() if w not in ('jr', 'sr', 'ii', 'iii', 'iv'))


def read_json(path):
    b = open(path, 'rb').read()
    return json.loads(gzip.decompress(b) if b[:2] == b'\x1f\x8b' else b)


def usual(games, season=None):
    """His usual this season (last season's when he has under 5): a game's minutes, shots, threes and free throws tried, how
    well he shot, rebounds and assists a minute, and the same over his last five for the trend."""
    gs = [g for g in games if (g.get('type') or 'REG') == 'REG' and (g.get('min') or 0) > 0]
    gs.sort(key=lambda g: str(g.get('date')))
    seasons = sorted({g.get('season') for g in gs if g.get('season') is not None})
    this = season if season is not None else (seasons[-1] if seasons else None)
    cur = [g for g in gs if g.get('season') == this]
    base = cur if len(cur) >= 5 else gs[-20:]
    if not base:
        return None
    s = lambda k, xs: float(np.sum([x.get(k) or 0 for x in xs]))
    out = {'n': len(cur), 'min': s('min', base) / len(base), 'fga': s('fga', base) / len(base), 'tpa': s('tpa', base) / len(base),
           'fta': s('fta', base) / len(base), 'fgp': s('fgm', base) / max(1, s('fga', base)), 'tpp': s('tpm', base) / max(1, s('tpa', base)),
           'rebMin': s('reb', base) / max(1, s('min', base)), 'astMin': s('ast', base) / max(1, s('min', base)), 'fgaMin': s('fga', base) / max(1, s('min', base)),
           'usg': float(np.nanmean([x.get('usg') for x in base if x.get('usg') is not None])) if any(x.get('usg') is not None for x in base) else np.nan}
    l5 = (cur or gs)[-5:]
    out['min5'] = s('min', l5) / len(l5); out['fga5'] = s('fga', l5) / len(l5); out['tpa5'] = s('tpa', l5) / len(l5)
    for k in STATS:
        vals = [x.get(k) or 0 for x in (cur or gs)[-10:]]
        out[f'{k}10'] = float(np.mean(vals)); out[f'{k}Max10'] = float(np.max(vals)); out[f'{k}Sd10'] = float(np.std(vals))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--parts', required=True, help='prefix of store-parts.csv / store-players.csv')
    ap.add_argument('--store', default='.nhl-data/nba')
    ap.add_argument('--out', required=True)
    ap.add_argument('--csv')
    a = ap.parse_args()
    parts = pd.read_csv(a.parts + '-parts.csv')
    players = pd.read_csv(a.parts + '-players.csv').drop_duplicates(['date', 'key', 'team'])
    rows = []
    for d in sorted(parts.date.unique()):
        base = os.path.join(a.store, d)
        try:
            pf = read_json(os.path.join(base, 'propfinder.json'))
        except Exception:
            continue
        logs = {(x.get('key'), x.get('team')): x.get('games') or [] for x in pf['data']['players']}
        box = {}; games = {}
        rd = os.path.join(base, 'results')
        for f in os.listdir(rd) if os.path.isdir(rd) else []:
            r = json.load(open(os.path.join(rd, f)))
            if not r.get('final'):
                continue
            games[r['id']] = r
            for p in r.get('players', []):
                box[(p['team'], norm(p['name']))] = (p, r)
        dp = players[players.date == d]
        listed_out = defaultdict(set)
        for x in dp.itertuples():
            if x.health == 'Out':
                listed_out[x.team].add(x.key)
        # The regulars of each team (his usual 20+ minutes) and who of them is in the box score.
        played_keys = defaultdict(set)
        for (team, name), (p, r) in box.items():
            if p.get('played') is not False and (p.get('min') or 0) > 0:
                played_keys[team].add(name)
        usual_of = {}
        for x in dp.itertuples():
            u = usual(logs.get((x.key, x.team), []), pf.get('season'))
            if u:
                usual_of[(x.key, x.team)] = u
        late = defaultdict(list)
        for x in dp.itertuples():
            u = usual_of.get((x.key, x.team))
            if u and u['n'] >= 3 and u['min5'] >= 20 and x.health != 'Out' and norm(x.key) not in played_keys[x.team] and any(t == x.team for t, _ in box):
                late[x.team].append(x.key)
        for x in parts[parts.date == d].itertuples():
            u = usual_of.get((x.key, x.team))
            hit = box.get((x.team, norm(x.key)))
            if not u or not hit or x.exp is None or not (x.exp > 0):
                continue
            p, r = hit
            if p.get('played') is False or not (p.get('min') or 0) > 0:
                continue
            pl = dp[(dp.key == x.key) & (dp.team == x.team)]
            proj_min = float(pl.minutes.iloc[0]) if len(pl) and pd.notna(pl.minutes.iloc[0]) else u['min']
            margin = (r['homeScore'] - r['awayScore']) * (1 if x.team == r['home'] else -1)
            rows.append({
                'date': d, 'key': x.key, 'team': x.team, 'opp': x.opp, 'venue': x.venue, 'market': x.market, 'exp': x.exp, 'actual': p.get(x.market),
                'matchup': x.matchup, 'env': x.env, 'model': x.model, 'lineFactor': x.lineFactor, 'sideOut': x.sideOut,
                'projMin': proj_min, 'min': p.get('min'), 'fga': p.get('fga'), 'tpa': p.get('tpa'), 'fta': p.get('fta'), 'fgm': p.get('fgm'), 'tpmBox': p.get('tpm'),
                'reb': p.get('reb'), 'ast': p.get('ast'), 'starter': p.get('starter'), 'margin': margin, 'ot': 'OT' in str(r.get('detail', '')),
                'lateOut': len([k for k in late[x.team] if k != x.key]), 'oppLateOut': len(late[x.opp]),
                **{f'u_{k}': v for k, v in u.items()},
            })
    df = pd.DataFrame(rows)
    df['big'] = [int(a_ >= e + BIG[m][0] and a_ >= e * BIG[m][1]) for a_, e, m in zip(df.actual, df.exp, df.market)]
    # What happened (box score against his usual and the board's minutes).
    df['moreMin'] = (df['min'] >= df.projMin + 6).astype(int)
    df['moreShots'] = (df.fga / df['min'].clip(lower=1) >= 1.25 * df.u_fgaMin).astype(int)
    df['moreThrees'] = (df.tpa >= df.u_tpa + 3).astype(int)
    df['moreFT'] = (df.fta >= df.u_fta + 5).astype(int)
    df['hotFG'] = ((df.fgm / df.fga.clip(lower=1) >= df.u_fgp + 0.12) & (df.fga >= 8)).astype(int)
    df['hot3'] = ((df.tpmBox / df.tpa.clip(lower=1) >= df.u_tpp + 0.15) & (df.tpa >= 4)).astype(int)
    df['moreRebRate'] = (df.reb / df['min'].clip(lower=1) >= 1.35 * df.u_rebMin).astype(int)
    df['moreAstRate'] = (df.ast / df['min'].clip(lower=1) >= 1.35 * df.u_astMin).astype(int)
    df['lateScratch'] = (df.lateOut > 0).astype(int)
    df['otGame'] = df.ot.astype(int)
    df['close'] = (df.margin.abs() <= 8).astype(int)
    # Pre-game reads (known before tip).
    df['minRise'] = df.u_min5 - df.u_min
    df['fgaRise'] = (df.u_fga5 - df.u_fga) / df.u_fga.clip(lower=1)
    df['projOverAvg'] = [e / max(0.1, r_[f'u_{m}10']) for e, m, (_, r_) in zip(df.exp, df.market, df.iterrows())]
    df['ceilGap'] = [r_[f'u_{m}Max10'] - e for e, m, (_, r_) in zip(df.exp, df.market, df.iterrows())]
    df['cv10'] = [r_[f'u_{m}Sd10'] / max(0.3, r_[f'u_{m}10']) for m, (_, r_) in zip(df.market, df.iterrows())]
    if a.csv:
        df.to_csv(a.csv, index=False)

    L = ['# Why players beat their projection by a lot (tables)', '',
         f'Written by `tools/audit/nba_overs.py` on the site\'s boards rebuilt from the store. A big night: {", ".join(f"{m} +{v[0]} and {v[1]}× the projection" for m, v in BIG.items())}. '
         'Every player-night with a box score and a projection.', '']
    L += ['## How many', '', '| stat | player-nights | big nights | share | of them starters |', '| --- | ---: | ---: | ---: | ---: |']
    for m in STATS:
        z = df[df.market == m]; b = z[z.big == 1]
        L.append(f'| {m} | {len(z)} | {len(b)} | {len(b) / max(1, len(z)) * 100:.1f}% | {b.starter.mean() * 100:.0f}% |')
    L += ['', '## What happened on the big nights (share of big nights against every other night)', '',
          'moreMin: 6+ minutes over the board\'s minutes; moreShots: shots a minute 1.25× his usual; moreThrees: 3+ more threes tried than usual; moreFT: 5+ more free throws tried; hotFG: 12+ points over his usual field-goal %; hot3: 15+ over his usual three %; moreRebRate / moreAstRate: 1.35× his usual a minute; lateScratch: a teammate who usually plays 20+ was not in the box score and not listed out before the game; otGame: overtime; close: final margin 8 or less.', '',
          '| why | ' + ' | '.join(f'{m} big | {m} rest' for m in STATS) + ' |', '| --- |' + ' ---: |' * (2 * len(STATS))]
    for c in ['moreMin', 'moreShots', 'moreThrees', 'moreFT', 'hotFG', 'hot3', 'moreRebRate', 'moreAstRate', 'lateScratch', 'otGame', 'close']:
        cells = []
        for m in STATS:
            z = df[df.market == m]
            cells += [f'{z[z.big == 1][c].mean() * 100:.0f}%', f'{z[z.big == 0][c].mean() * 100:.0f}%']
        L.append(f'| {c} | ' + ' | '.join(cells) + ' |')
    # Minutes against rate: how much of the surplus is minutes (his projected rate × the extra minutes).
    L += ['', '## The surplus split: minutes against rate a minute', '', 'Surplus = got − projected. The minutes part = projected ÷ projected minutes × (minutes played − projected minutes); the rest is the rate.', '',
          '| stat | big nights | surplus | from minutes | from the rate |', '| --- | ---: | ---: | ---: | ---: |']
    for m in STATS:
        b = df[(df.market == m) & (df.big == 1)]
        if not len(b):
            continue
        sur = (b.actual - b.exp).mean(); mn = (b.exp / b.projMin.clip(lower=1) * (b['min'] - b.projMin)).mean()
        L.append(f'| {m} | {len(b)} | {sur:+.1f} | {mn:+.1f} | {sur - mn:+.1f} |')
    # Pre-game reads: the big-night rate by quintile, beside the rate the board's own figure would give (same projection band).
    L += ['', '## Before tip: which reads made a big night more likely', '',
          'Big-night share by quintile of the read (Q1 low … Q5 high), each stat. A read worth using rises or falls across the quintiles where the projection does not explain it (projOverAvg: the board\'s figure over his last-ten average; ceilGap: his best of the last ten less the projection; cv10: his last ten\'s spread over their mean; minRise: last-five minutes less his season\'s; fgaRise: last-five shots over his season\'s; matchup / env: the board\'s factors; lateOut is not known before tip and is left out).', '']
    for c in ['projOverAvg', 'ceilGap', 'cv10', 'minRise', 'fgaRise', 'matchup', 'env', 'model', 'sideOut', 'u_usg']:
        x = df.dropna(subset=[c]).copy()
        if x[c].nunique() < 3:
            continue
        x['q'] = x.groupby('market')[c].transform(lambda s: pd.qcut(s.rank(method='first'), 5, labels=['Q1', 'Q2', 'Q3', 'Q4', 'Q5']).astype(str))
        g = x.groupby(['market', 'q']).big.mean().unstack('q') * 100
        L += [f'### {c}', '', '| stat | Q1 | Q2 | Q3 | Q4 | Q5 |', '| --- | ---: | ---: | ---: | ---: | ---: |']
        for m in STATS:
            if m in g.index:
                L.append(f'| {m} | ' + ' | '.join(f'{g.loc[m, q]:.1f}%' for q in ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']) + ' |')
        L.append('')
    L += ['## The biggest nights', '', '| date | player | stat | projected | got | minutes (board) | shots (usual) | threes tried (usual) | free throws (usual) | why |', '| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |']
    top = df[df.big == 1].assign(gap=lambda z: z.actual - z.exp).sort_values('gap', ascending=False).groupby('market').head(8)
    for r in top.sort_values(['market', 'gap'], ascending=[True, False]).itertuples():
        why = [w for w in ['moreMin', 'moreShots', 'moreThrees', 'moreFT', 'hotFG', 'hot3', 'moreRebRate', 'moreAstRate', 'lateScratch', 'otGame'] if getattr(r, w)]
        L.append(f'| {r.date} | {r.key} ({r.team} vs {r.opp}) | {r.market} | {r.exp:.1f} | {r.actual:.0f} | {r.min:.0f} ({r.projMin:.0f}) | {r.fga:.0f} ({r.u_fga:.1f}) | {r.tpa:.0f} ({r.u_tpa:.1f}) | {r.fta:.0f} ({r.u_fta:.1f}) | {", ".join(why) or "—"} |')
    open(a.out, 'w').write('\n'.join(L) + '\n')
    print(f'written {a.out}: {int(df.big.sum())} big nights of {len(df)}', file=sys.stderr)


if __name__ == '__main__':
    main()

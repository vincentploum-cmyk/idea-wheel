#!/usr/bin/env python3
"""The stat lists' top 10 (Points, Rebounds, Assists, Threes tabs), graded: why a listed mark misses.

The tabs (components/nba/NbaGames.jsx `tierRows`) list every player of the night by his projection; each row carries the
highest round mark he clears at 70% (strong), 55% (lean) and 40% (thin) on the shuffle's chance (`tierBoard`). This
script rebuilds that top 10 per night and stat from the replay's `--marks-all` file, joins the replay's rows (the
projection's parts) and asks which reads, known before tip, separate the marks that landed from the ones that missed
beyond the chance the list stated.

  node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs ... --marks-all --tag -x   # writes -marks.csv, -rows.csv
  python3 -I tools/audit/nba_top10.py --prefix .nhl-data/audit/out/nba-2026-11-23-x [--games .nhl-data/audit/nba/games] \
      [--prefix ... --label 2025-26] --out docs/audits/<date>-nba-top10-tables.md

Several --prefix (each with its --label, and its --games for the spread) are pooled and reported side by side.
"""
import argparse, glob, json, math, os, sys
from datetime import date, timedelta
import numpy as np
import pandas as pd

STATS = ['pts', 'reb', 'ast', 'tpm']
TIERS = [('strong', 0.7), ('lean', 0.55), ('thin', 0.4)]
TOP = 10


def top10(marks):
    """Per night and stat: the 10 highest projections, each with his strong / lean / thin mark (as tierBoard reads them)."""
    out = []
    marks = marks[marks.market.isin(STATS)]
    for (slate, mk), g in marks.groupby(['slate', 'market'], sort=False):
        pl = g.groupby(['key', 'team'], sort=False).agg(exp=('exp', 'first'), actual=('actual', 'first')).reset_index()
        pl = pl.sort_values(['exp', 'key'], ascending=[False, True]).head(TOP).reset_index(drop=True)
        by = {k: x.sort_values('mark') for k, x in g.groupby(['key', 'team'], sort=False)}
        for i, r in pl.iterrows():
            gg = by[(r.key, r.team)]
            seen = set()
            for tier, floor in TIERS:
                c = gg[gg.p >= floor]
                if not len(c):
                    continue
                x = c.iloc[-1]
                if x.mark in seen:
                    continue
                seen.add(x.mark)
                out.append(dict(slate=slate, market=mk, pos=i + 1, key=r.key, team=r.team, exp=r.exp, actual=r.actual,
                                tier=tier, mark=int(x.mark), p=float(x.p), hit=int(r.actual >= x.mark)))
    return pd.DataFrame(out)


def spreads(games_dir):
    """ESPN's pickcenter per game: the side's spread (negative = favoured) and the total. None where the feed has none."""
    rows = []
    for f in glob.glob(os.path.join(games_dir, '*.json')):
        try:
            d = json.load(open(f))
        except Exception:
            continue
        pc = (d.get('pickcenter') or [None])[0]
        comp = ((d.get('header') or {}).get('competitions') or [{}])[0]
        teams = {c.get('homeAway'): (c.get('team') or {}).get('abbreviation') for c in comp.get('competitors', [])}
        if not pc or pc.get('spread') is None:
            continue
        home_fav = bool((pc.get('homeTeamOdds') or {}).get('favorite'))
        s = abs(float(pc['spread']))
        gid = os.path.basename(f)[:-5]
        rows.append(dict(game=gid, venue='H', spread=-s if home_fav else s, total=pc.get('overUnder')))
        rows.append(dict(game=gid, venue='A', spread=s if home_fav else -s, total=pc.get('overUnder')))
    return pd.DataFrame(rows)


def history(rows):
    """Reads off his own earlier nights in the replay (this season's, before the slate): his minutes' spread over the last
    ten, his share of the last ten at a mark (filled per row below), the team's back-to-back."""
    r = rows.sort_values('slate')
    mins = r[r.market == 'pts'][['slate', 'key', 'team', 'actualMin']].drop_duplicates(['slate', 'key'])
    mins = mins.sort_values('slate')
    mins['minSd10'] = mins.groupby('key')['actualMin'].transform(lambda s: s.shift(1).rolling(10, min_periods=4).std())
    mins['minMean10'] = mins.groupby('key')['actualMin'].transform(lambda s: s.shift(1).rolling(10, min_periods=4).mean())
    days = r[['slate', 'team']].drop_duplicates().sort_values('slate')
    days['prev'] = days.groupby('team')['slate'].shift(1)
    days['b2b'] = [int(p is not None and isinstance(p, str) and (date.fromisoformat(s) - date.fromisoformat(p)).days == 1) for s, p in zip(days.slate, days.prev)]
    return mins[['slate', 'key', 'minSd10', 'minMean10']], days[['slate', 'team', 'b2b']]


def past_share(t, rows, n=10):
    """His share of his last n games (this season, in the replay) at the mark: the list's own figure read off his nights."""
    act = {}
    for (k, m), g in rows[rows.market.isin(STATS)].sort_values('slate').groupby(['key', 'market']):
        act[(k, m)] = (g.slate.tolist(), g.actual.tolist())
    out = []
    for r in t.itertuples():
        s, a = act.get((r.key, r.market), ([], []))
        prev = [x for d, x in zip(s, a) if d < r.slate and x == x][-n:]
        out.append(np.mean([x >= r.mark for x in prev]) if len(prev) >= 5 else np.nan)
    return out


def load(prefix, games_dir, label):
    marks = pd.read_csv(prefix + '-marks.csv')
    rows = pd.read_csv(prefix + '-rows.csv', low_memory=False)
    t = top10(marks)
    keep = ['slate', 'key', 'team', 'market', 'game', 'venue', 'pos', 'envPos', 'gp', 'nThis', 'ownSeason', 'ownL10', 'ownL5', 'minTonight', 'minBase',
            'matchup', 'rank', 'count', 'env', 'teamScale', 'lift', 'sideOut', 'role', 'starter', 'up', 'down', 'sd', 'floor', 'ceiling']
    keep = [c for c in keep if c in rows.columns]
    rr = rows[keep].rename(columns={'pos': 'position'})
    t = t.merge(rr, on=['slate', 'key', 'team', 'market'], how='left')
    mins, b2b = history(rows)
    t = t.merge(mins, on=['slate', 'key'], how='left').merge(b2b, on=['slate', 'team'], how='left')
    if games_dir and os.path.isdir(games_dir):
        sp = spreads(games_dir)
        if len(sp):
            t['game'] = t['game'].astype(str)
            t = t.merge(sp, on=['game', 'venue'], how='left')
    for c in ['spread', 'total']:
        if c not in t:
            t[c] = np.nan
    t['share10'] = past_share(t, rows)
    t['cushion'] = (t.exp - t.mark) / t.exp
    t['form'] = (t.ownL5 - t.ownSeason) / t.ownSeason.replace(0, np.nan)
    t['minCv'] = t.minSd10 / t.minMean10
    t['minGap'] = (t.minTonight - t.minMean10)
    t['oppRank'] = t['rank']
    t['label'] = label
    # every height of the top 10's players (the shift test below re-reads the tiers off moved chances)
    top = t[['slate', 'key', 'team', 'market']].drop_duplicates()
    allm = marks.merge(top, on=['slate', 'key', 'team', 'market']).merge(b2b, on=['slate', 'team'], how='left')
    allm['label'] = label
    return t, allm


def logit(p):
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p))


def fit_one(df, col):
    """hit ~ σ(a + b·logit(p) + c·z(col)): c and its z-score (Newton's method, no scipy needed)."""
    x = df[[col, 'p', 'hit']].dropna()
    if len(x) < 80 or x[col].std() == 0:
        return None
    z = (x[col] - x[col].mean()) / x[col].std()
    X = np.column_stack([np.ones(len(x)), logit(x.p.values), z.values])
    y = x.hit.values.astype(float)
    w = np.zeros(3)
    for _ in range(50):
        mu = 1 / (1 + np.exp(-X @ w))
        W = mu * (1 - mu)
        H = X.T @ (X * W[:, None]) + 1e-6 * np.eye(3)
        step = np.linalg.solve(H, X.T @ (y - mu))
        w += step
        if np.abs(step).max() < 1e-8:
            break
    cov = np.linalg.inv(H)
    return w[2], w[2] / math.sqrt(cov[2, 2]), len(x)


def table(df, by):
    g = df.groupby(by, observed=True, dropna=False).agg(n=('hit', 'size'), said=('p', 'mean'), hit=('hit', 'mean'))
    g['gap'] = g.hit - g.said
    return g


def fmt(g):
    cols = list(g.columns)
    idx = g.index.names
    lines = ['| ' + ' | '.join([*(str(i) for i in idx), *cols]) + ' |', '| ' + ' | '.join(['---'] * (len(idx) + len(cols))) + ' |']
    for k, row in g.iterrows():
        k = k if isinstance(k, tuple) else (k,)
        vals = []
        for c in cols:
            v = row[c]
            vals.append(f'{int(v)}' if c == 'n' else f'{v * 100:+.1f}' if c == 'gap' else f'{v * 100:.1f}%')
        lines.append('| ' + ' | '.join([*(str(x) for x in k), *vals]) + ' |')
    return '\n'.join(lines)


FEATS = [
    ('cushion', 'projection above the mark, share of the projection'),
    ('pos', 'place on the list (1 = highest projection)'),
    ('share10', 'his share of his last 10 games at the mark'),
    ('form', 'last five against his season (hot > 0)'),
    ('minTonight', 'minutes read tonight'),
    ('minCv', 'his minutes\' spread over the last ten (sd / mean)'),
    ('minGap', 'minutes read tonight less his last-ten mean'),
    ('matchup', 'matchup factor on his rate'),
    ('oppRank', 'opponent\'s rank at his spot (1 = gives up the most)'),
    ('env', 'game environment factor'),
    ('teamScale', 'team scale'),
    ('lift', 'teammates-out lift'),
    ('sideOut', 'his side\'s players out'),
    ('b2b', 'his team on the second night of a back-to-back'),
    ('spread', 'his side\'s spread (negative = favoured)'),
    ('total', 'the game total'),
    ('nThis', 'his games this season'),
    ('sd', 'his spread (sd) on the stat'),
]


def shown(d, pcol):
    """The tiers re-read off a chance column (tierBoard's rule), one row per mark shown."""
    out = []
    for _, g in d.sort_values('mark').groupby(['slate', 'key', 'team'], sort=False):
        seen = set()
        for tier, floor in TIERS:
            c = g[g[pcol] >= floor]
            if not len(c):
                continue
            x = c.iloc[-1]
            if x.mark in seen:
                continue
            seen.add(x.mark)
            out.append((tier, x.mark, x[pcol], int(x.actual >= x.mark), x.b2b))
    return pd.DataFrame(out, columns=['tier', 'mark', 'p', 'hit', 'b2b'])


def shift_test(allm, train, test):
    """The back-to-back as a shift on the odds of every mark: logit p' = logit p + c · b2b, c fitted on `train` (the stated
    chance as the offset) and the tiers re-read on `test`."""
    a = allm.copy()
    a['b2b'] = a.b2b.fillna(0)
    a['hit'] = (a.actual >= a.mark).astype(int)
    L = ['## The back-to-back as a shift on the chance (fitted on ' + train + ', read on ' + test + ')', '',
         'logit p\' = logit p + c · b2b on every height of the top 10\'s players (chances 25–95% in the fit); Brier on every height of the test season, then the tiers re-read off the moved chance.', '',
         '| stat | c | odds × | Brier now | Brier moved | misses now | misses moved | marks now | marks moved | b2b rows hit now | moved |',
         '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
    for mk in STATS:
        tr = a[(a.label == train) & (a.market == mk) & (a.p > 0.25) & (a.p < 0.95)]
        off = logit(tr.p.values); X = tr.b2b.values.astype(float); y = tr.hit.values.astype(float); c = 0.0
        for _ in range(60):
            mu = 1 / (1 + np.exp(-(off + c * X)))
            h = (X * X * mu * (1 - mu)).sum() + 1.0
            step = ((X * (y - mu)).sum() - c) / h
            c += step
            if abs(step) < 1e-10:
                break
        te = a[(a.label == test) & (a.market == mk)].copy()
        te['p2'] = 1 / (1 + np.exp(-(logit(te.p.values) + c * te.b2b.values)))
        b0 = np.mean((te.p - te.hit) ** 2); b1 = np.mean((te.p2 - te.hit) ** 2)
        s0 = shown(te, 'p'); s1 = shown(te, 'p2')
        L.append(f'| {mk} | {c:+.3f} | {math.exp(c):.2f} | {b0:.5f} | {b1:.5f} | {int((1 - s0.hit).sum())} | {int((1 - s1.hit).sum())} | {len(s0)} | {len(s1)} | '
                 f'{s0[s0.b2b == 1].hit.mean() * 100:.1f}% | {s1[s1.b2b == 1].hit.mean() * 100:.1f}% |')
    return L + ['']


STORE_ROOT = '.nhl-data/nba'
STEP = {'pts': 5, 'reb': 1, 'ast': 1, 'tpm': 1}


def load_store(prefix, label):
    """The site's own boards (tools/audit/nba-store-top10.mjs off a copy of the store): the shuffle's chance at every height,
    the out and the idle off the list as `tierBoard` leaves them, the heights on the list's step. A player who did not play
    (no box line) keeps his row on the page as DNP: counted apart, not graded."""
    m = pd.read_csv(prefix + '-marks.csv')
    pl = pd.read_csv(prefix + '-players.csv')
    m = m[(m.health != 'Out') & (m.idle != 1) & m.market.isin(STATS)]
    m = m[m.height % m.market.map(STEP) == 0].rename(columns={'date': 'slate', 'height': 'mark'})
    m['b2b'] = np.nan
    pl = pl.rename(columns={'date': 'slate', 'minutes': 'minTonight'}).drop_duplicates(['slate', 'key', 'team'])
    # The back-to-back from the stored schedules (his team played the night before), not the board's flag: until 2026-11-24
    # that flag read PropFinder's UTC log dates as ET and fired on the team that had played two nights ago.
    played = set()
    for d in os.listdir(STORE_ROOT):
        try:
            for g in json.load(open(os.path.join(STORE_ROOT, d, 'schedule.json'))).get('games', []):
                played.update({(d, g['away']), (d, g['home'])})
        except Exception:
            pass
    prev = lambda d: (date.fromisoformat(d) - timedelta(days=1)).isoformat()
    pl['b2b'] = [int((prev(d), t) in played) for d, t in zip(pl.slate, pl.team)]
    # A game already over when the stored pull was taken (its tip 2h30 or more before the pull's `at`) may sit in the
    # player's own logs that night: left out. The rest of the night is graded as the page had it.
    tips = {}
    for d in m.slate.unique():
        try:
            for g in json.load(open(os.path.join(STORE_ROOT, d, 'schedule.json'))).get('games', []):
                tips[str(g['id'])] = g.get('date')
        except Exception:
            pass
    pull = pl.groupby('slate').pullAt.first().to_dict()
    def done_before(row):
        tip = tips.get(str(row.game)); at = pull.get(row.slate)
        if not tip or not isinstance(at, str):
            return False
        return pd.Timestamp(tip) + pd.Timedelta(minutes=150) <= pd.Timestamp(at)
    gm = m[['slate', 'game']].drop_duplicates()
    gm['leak'] = [done_before(r) for r in gm.itertuples()]
    print(f'{label}: {int(gm.leak.sum())} of {len(gm)} games over before the stored pull, left out', file=sys.stderr)
    m = m.merge(gm, on=['slate', 'game'])
    m = m[~m.leak].drop(columns=['leak'])
    t = top10(m)
    t = t.merge(pl[['slate', 'key', 'team', 'b2b', 'minTonight', 'starter', 'lineupStatus', 'latePull']], on=['slate', 'key', 'team'], how='left')
    t['dnp'] = t.actual.isna().astype(int)
    t['cushion'] = (t.exp - t.mark) / t.exp
    for c in [f for f, _ in FEATS if f not in t]:
        t[c] = np.nan
    t['label'] = label
    top = t[['slate', 'key', 'team', 'market']].drop_duplicates()
    allm = m.drop(columns=['b2b']).merge(top, on=['slate', 'key', 'team', 'market']).merge(pl[['slate', 'key', 'team', 'b2b']], on=['slate', 'key', 'team'], how='left')
    allm['label'] = label
    return t, allm


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--prefix', action='append', required=True)
    ap.add_argument('--label', action='append')
    ap.add_argument('--games', action='append')
    ap.add_argument('--out', required=True)
    ap.add_argument('--csv')
    a = ap.parse_args()
    labels = a.label or [os.path.basename(p) for p in a.prefix]
    games = a.games or [None] * len(a.prefix)
    loaded = [load_store(p[len('store:'):], l) if p.startswith('store:') else load(p, g, l) for p, g, l in zip(a.prefix, games, labels)]
    df = pd.concat([x[0] for x in loaded], ignore_index=True)
    if 'dnp' in df:
        dnp = df[df.dnp == 1]
        if len(dnp):
            print(f'{len(dnp)} marks on a player who did not play, left out of the grading', file=sys.stderr)
        df = df[df.dnp != 1]
    allm = pd.concat([x[1] for x in loaded], ignore_index=True)
    allm = allm[allm.actual.notna()]
    allm = pd.concat([x[1] for x in loaded], ignore_index=True)
    if a.csv:
        df.to_csv(a.csv, index=False)
    L = ['# The stat lists\' top 10, graded (tables)', '', 'Written by `tools/audit/nba_top10.py`. Every mark the Points / Rebounds / Assists / Threes tabs show for the night\'s ten highest projections; `said` is the chance on the mark, `gap` hit less said in points.', '']
    L += ['## Every mark, by season, stat and tier', '', fmt(table(df, ['label', 'market', 'tier'])), '']
    L += ['## Misses a night in the top 10 (marks shown, misses)', '']
    per = df.groupby(['label', 'market', 'slate']).agg(marks=('hit', 'size'), miss=('hit', lambda h: int((1 - h).sum())))
    pn = per.groupby(['label', 'market']).agg(nights=('marks', 'size'), marks=('marks', 'mean'), miss=('miss', 'mean')).round(2)
    L += ['| label | stat | nights | marks a night | misses a night |', '| --- | --- | ---: | ---: | ---: |']
    for (lb, mk), r in pn.iterrows():
        L.append(f'| {lb} | {mk} | {int(r.nights)} | {r.marks:.1f} | {r.miss:.1f} |')
    L.append('')
    L += ['## One read at a time, over the chance stated', '', 'hit = σ(a + b·logit(said) + c·z(read)) per season and stat, every tier pooled: c > 0 means the marks land more often than said as the read rises; |z| ≥ 2 is worth a look, ≥ 3 is solid.', '']
    L += ['| read | ' + ' | '.join(f'{lb} {mk}' for lb in labels for mk in STATS) + ' |', '| --- |' + ' ---: |' * (len(labels) * len(STATS))]
    for col, what in FEATS:
        cells = []
        for lb in labels:
            for mk in STATS:
                r = fit_one(df[(df.label == lb) & (df.market == mk)], col)
                cells.append('—' if r is None else f'{r[0]:+.2f} (z {r[1]:+.1f})')
        L.append(f'| {col}: {what} | ' + ' | '.join(cells) + ' |')
    L.append('')
    if len(labels) > 1:
        L += shift_test(allm, labels[0], labels[-1])
    for col, what in FEATS:
        x = df.dropna(subset=[col]).copy()
        if x[col].nunique() <= 1:
            continue
        if x[col].nunique() <= 3:
            x['bin'] = x[col]
        else:
            try:
                x['bin'] = x.groupby(['label', 'market'])[col].transform(lambda s: pd.qcut(s.rank(method='first'), 4, labels=['Q1 low', 'Q2', 'Q3', 'Q4 high']).astype(str))
            except ValueError:
                continue
        L += [f'### {col}: {what}', '', fmt(table(x, ['label', 'market', 'bin'])), '']
    open(a.out, 'w').write('\n'.join(L) + '\n')
    print(f'written {a.out} ({len(df)} marks)', file=sys.stderr)


if __name__ == '__main__':
    main()

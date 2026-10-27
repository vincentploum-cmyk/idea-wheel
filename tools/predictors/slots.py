#!/usr/bin/env python3
"""Does a defense have a line it is weak against? Three tests of the slot-level read.

  python3 tools/predictors/slots.py <games dir> [<games dir> ...] [--boot 300]

Each games dir is a season of fetch.mjs records (one JSON file a date), oldest season first.
The line slot is the study's: TOI rank within the team-game, forwards 1-4 three a line, defense
pairs 1-3 (build_rows.slot_of), so "LW1" is the left wing who skated the most, not the lineup card.

Test 1, persistence within a season: split every defending team's games into odd and even
(interleaved, so both halves span the season) and correlate what it allowed per skater at each
position, line (F1 … F4, D1 … D3) and slot (LW1 … D3) between the halves, across the league.
Every figure is centred by the league's figure for the key in that half (so "first lines shoot
more than fourth lines everywhere" does not count as persistence), read three ways: the plain
shots per skater; shots over the shooters' own season rates (so a team that happened to face
the best first lines is not read as weak); and, beyond the position, the slot over the team's
own position figure, which asks the sharper question: beyond "weak against left wings", is
there a "weak against LW1 in particular" that persists? The signal share says how much of the
spread between teams in a half season is more than sampling noise.

Test 2, prediction, leak-free: walking the season in date order, every skater-game gets the
opponent's allowance per skater at his position, line and slot as it stood that morning, his
own rate to date, the league's, and (from the second season on) last season's full-season slot
deviation of the opponent. Every deviation is over the league's same figure that morning, so
the read carries the opponent's own pattern and not "first lines shoot more than fourth lines"
(uncentred, the read stands in for the skater's deployment tonight and scores well for the
wrong reason). Poisson regressions with 5-fold cross-validation by date blocks
score each read on top of the position read (the study's metric, deviance per row); tercile
tables give the plain lift. The "consistent" subset is the user's hypothesis as stated:
opponents whose slot deviation sat in the same third over their last 10 games and over the
season to date.

Test 3, persistence across seasons: the full-season figures of one season against the next.
"""
import sys, os, glob, json, math
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm

FWD = {'C', 'LW', 'RW'}
POS = ['C', 'LW', 'RW', 'D']
MIN_OWN = 5          # a skater's own rate needs this many prior games this season
MIN_POS = 30         # an opponent's position read needs this many prior skater-games
MIN_SLOT = 12        # … and the slot read this many
MIN_LINE = 20
MIN_CELL = 8         # a team × half × key cell needs this many skater-games
LEVELS = [('position', 'pos', None), ('line (F1 … F4, D1 … D3)', 'lineKey', 'grp'), ('slot (LW1 … D3)', 'slot', 'pos')]

def slot_of(skaters):
    out = {}
    for team in {s['team'] for s in skaters}:
        f = sorted([s for s in skaters if s['team'] == team and s['pos'] in FWD], key=lambda s: -s['toi'])
        d = sorted([s for s in skaters if s['team'] == team and s['pos'] == 'D'], key=lambda s: -s['toi'])
        for k, s in enumerate(f): out[s['id']] = min(4, 1 + k // 3)
        for k, s in enumerate(d): out[s['id']] = min(3, 1 + k // 2)
    return out

def load(d):
    rows = []
    season = os.path.basename(os.path.dirname(d.rstrip('/'))) or d
    for f in sorted(glob.glob(os.path.join(d, '*.json'))):
        for g in json.load(open(f))['games']:
            sk = [s for s in g['skaters'] if s.get('pos') in POS and s.get('toi', 0) > 0]
            slots = slot_of(sk)
            for s in sk:
                line = slots.get(s['id'])
                if not line: continue
                rows.append({'season': season, 'date': g['date'], 'game': g['id'], 'id': s['id'], 'team': s['team'], 'opp': s['opp'], 'venue': s['venue'],
                             'pos': s['pos'], 'grp': 'F' if s['pos'] in FWD else 'D', 'line': line, 'sog': s['sog'] or 0, 'g': s['g'] or 0, 'toi': s['toi']})
    df = pd.DataFrame(rows)
    df['lineKey'] = df.grp + df.line.astype(str)
    df['slot'] = df.pos + df.line.astype(str)
    return df.sort_values(['date', 'game']).reset_index(drop=True)

def r_ci(x, y, boot=300, seed=1):
    x = np.asarray(x, float); y = np.asarray(y, float)
    ok = ~(np.isnan(x) | np.isnan(y)); x, y = x[ok], y[ok]
    if len(x) < 4: return float('nan'), float('nan'), float('nan'), len(x)
    r = stats.pearsonr(x, y)[0]
    rng = np.random.default_rng(seed); bs = []
    for _ in range(boot):
        i = rng.integers(0, len(x), len(x)); bs.append(stats.pearsonr(x[i], y[i])[0] if np.std(x[i]) > 0 and np.std(y[i]) > 0 else np.nan)
    lo, hi = np.nanpercentile(bs, [2.5, 97.5])
    return r, lo, hi, len(x)

def halves(df):
    """Every defending team's games split odd / even in date order."""
    games = df.groupby(['opp', 'game'])['date'].min().reset_index().sort_values(['opp', 'date'])
    games['half'] = games.groupby('opp').cumcount() % 2
    return df.merge(games[['opp', 'game', 'half']], on=['opp', 'game'])

def with_residual(df, stat):
    """The stat over the shooter's own season mean: what the defense allowed beyond who it faced."""
    d = df.copy()
    d['res'] = d[stat] - d.groupby('id')[stat].transform('mean')
    return d

def cells(d, key, value, by='half'):
    """Per defending team, half and key: the mean of `value` over the skaters it faced there, centred by the league's figure for the key in that half."""
    m = d.groupby(['opp', by, key])[value].agg(['mean', 'var', 'size']).reset_index()
    m = m[m['size'] >= MIN_CELL].copy()
    m['c'] = m['mean'] - m.groupby([by, key])['mean'].transform('mean')
    return m

def deviation(m, d, key, base, value, by='half'):
    """The team's figure at the key over its own figure at the base (its slot over its position), centred by the league's same."""
    b = d.groupby(['opp', by, base])[value].mean().rename('base').reset_index()
    keys = d[[key, base]].drop_duplicates()
    mb = m.merge(keys, on=key).merge(b, on=['opp', by, base])
    mb['c'] = (mb['mean'] - mb['base']) - (mb['mean'] - mb['base']).groupby([mb[by], mb[key]]).transform('mean')
    return mb

def level_values(d, key, base, value, by='half'):
    m = cells(d, key, value, by)
    return deviation(m, d, key, base, value, by) if base else m

def signal_share(m):
    """How much of the spread between teams is more than sampling noise: 1 − the mean squared standard error of a cell / the variance of the centred cell values."""
    noise = (m['var'].fillna(0) / m['size']).mean()
    spread = m['c'].var()
    return max(0.0, 1 - noise / spread) if spread and spread > 0 else float('nan')

def corr_halves(m, key, boot):
    wide = m.pivot_table(index=['opp', key], columns='half', values='c').dropna()
    return r_ci(wide[0], wide[1], boot), wide

def persistence(df, stat, boot):
    d = with_residual(halves(df), stat)
    out = []
    for level, key, base in LEVELS:
        row = {'level': level}
        raw = cells(d, key, stat)
        row['raw'] = corr_halves(raw, key, boot)[0]
        res = cells(d, key, 'res')
        row['res'] = corr_halves(res, key, boot)[0]; row['res share'] = signal_share(res); row['res sd'] = res['c'].std()
        if base:
            dev = deviation(res, d, key, base, 'res')
            (r, lo, hi, n), wide = corr_halves(dev, key, boot)
            row['dev'] = (r, lo, hi, n); row['dev share'] = signal_share(dev); row['dev sd'] = dev['c'].std()
            row['per key'] = {k: stats.pearsonr(sub[0], sub[1])[0] for k, sub in wide.groupby(level=1) if len(sub) >= 10}
        out.append(row)
    return out

def top_bottom(df, stat, key, k):
    """The user's reading: rank the league on a slot in the odd games; what the same slot allowed in the even games, plain and over the shooters' rates."""
    d = with_residual(halves(df), stat)
    d = d[d[key] == k]
    m = d.groupby(['opp', 'half'])[[stat, 'res']].mean().unstack().dropna()
    if len(m) < 10: return None
    order = m[(stat, 0)].sort_values(ascending=False)
    top = m.loc[order.index[:5]]; bot = m.loc[order.index[-5:]]
    return {'teams': len(m), 'league': (m[(stat, 0)].mean(), m[(stat, 1)].mean()),
            'top': (top[(stat, 0)].mean(), top[(stat, 1)].mean(), top[('res', 0)].mean(), top[('res', 1)].mean()),
            'bot': (bot[(stat, 0)].mean(), bot[(stat, 1)].mean(), bot[('res', 0)].mean(), bot[('res', 1)].mean())}

def across_seasons(dfA, dfB, stat, boot):
    """Full-season figures of one season against the next, per level: plain, over the shooters' rates, and beyond the position."""
    rows = []
    for level, key, base in LEVELS:
        row = {'level': level}
        for name, value, dev in [('raw', stat, False), ('res', 'res', False), ('dev', 'res', True)]:
            if dev and not base: continue
            vals = []
            for df in (dfA, dfB):
                d = with_residual(df, stat); d['half'] = 0
                m = cells(d, key, value)
                if dev: m = deviation(m, d, key, base, value)
                vals.append(m.set_index(['opp', key])['c'])
            j = pd.concat(vals, axis=1, keys=[0, 1]).dropna()
            row[name] = r_ci(j[0], j[1], boot)
        rows.append(row)
    return rows

def season_slot_dev(df):
    """Last season's full-season slot deviation per (team, slot): (its slot / its position) over the league's same, as a ratio for the log model."""
    t = df.groupby(['opp', 'slot'])['sog'].mean().rename('slot_mean').reset_index()
    p = df.groupby(['opp', 'pos'])['sog'].mean().rename('pos_mean').reset_index()
    t['pos'] = t.slot.str.extract(r'^([A-Z]+)')[0]
    t = t.merge(p, on=['opp', 'pos'])
    t['ratio'] = (t['slot_mean'] + 0.05) / (t['pos_mean'] + 0.05)
    t['prev_slot_dev'] = t['ratio'] / t.groupby('slot')['ratio'].transform('mean')
    return t[['opp', 'slot', 'prev_slot_dev']]

def build_rows(df, prev=None):
    """Leak-free rows: the opponent's reads and the skater's own rate as they stood before each game."""
    own = {}; opp_pos = {}; opp_line = {}; opp_slot = {}; opp_grp = {}; league = {}; lg_slot = {}; lg_line = {}; lg_grp = {}
    hist_slot = {}   # (opp, slot) -> list of (date, sog) for the "last 10 games" consistency read
    out = []
    for date, day in df.groupby('date', sort=True):
        for r in day.itertuples(index=False):
            o = own.get(r.id)
            po = opp_pos.get((r.opp, r.pos)); li = opp_line.get((r.opp, r.lineKey)); sl = opp_slot.get((r.opp, r.slot)); gr = opp_grp.get((r.opp, r.grp)); lg = league.get(r.pos)
            if not o or len(o) < MIN_OWN or not po or po[1] < MIN_POS or not lg or lg[1] < 200: continue
            ls = lg_slot.get(r.slot); ll = lg_line.get(r.lineKey); lgr = lg_grp.get(r.grp)
            rec = {'date': date, 'game': r.game, 'id': r.id, 'opp': r.opp, 'pos': r.pos, 'grp': r.grp, 'line': r.line, 'slot': r.slot, 'sog': r.sog, 'g': r.g,
                   'own': sum(o) / len(o), 'own_n': len(o), 'league_pos': lg[0] / lg[1], 'opp_pos': po[0] / po[1], 'opp_pos_n': po[1],
                   'opp_slot': sl[0] / sl[1] if sl and sl[1] >= MIN_SLOT else np.nan, 'opp_slot_n': sl[1] if sl else 0,
                   'opp_line': li[0] / li[1] if li and li[1] >= MIN_LINE else np.nan, 'opp_grp': gr[0] / gr[1] if gr and gr[1] >= MIN_POS else np.nan,
                   'league_slot': ls[0] / ls[1] if ls and ls[1] >= 200 else np.nan, 'league_line': ll[0] / ll[1] if ll and ll[1] >= 200 else np.nan, 'league_grp': lgr[0] / lgr[1] if lgr else np.nan}
            hs = hist_slot.get((r.opp, r.slot), [])
            last_games = sorted({h[0] for h in hs})[-10:]
            recent = [h[1] for h in hs if h[0] in last_games]
            rec['opp_slot_l10'] = sum(recent) / len(recent) if len(recent) >= 8 else np.nan
            out.append(rec)
        for r in day.itertuples(index=False):
            own.setdefault(r.id, []).append(r.sog)
            for store, key in [(opp_pos, (r.opp, r.pos)), (opp_line, (r.opp, r.lineKey)), (opp_slot, (r.opp, r.slot)), (opp_grp, (r.opp, r.grp)), (league, r.pos), (lg_slot, r.slot), (lg_line, r.lineKey), (lg_grp, r.grp)]:
                s = store.setdefault(key, [0.0, 0]); s[0] += r.sog; s[1] += 1
            hist_slot.setdefault((r.opp, r.slot), []).append((date, r.sog))
    d = pd.DataFrame(out)
    # Every read over the league's same figure that morning, so "first lines shoot more than fourth lines" is not in the read.
    d['pos_ratio'] = d.opp_pos / d.league_pos
    d['slot_dev'] = (d.opp_slot / d.opp_pos) / (d.league_slot / d.league_pos)
    d['line_dev'] = (d.opp_line / d.opp_grp) / (d.league_line / d.league_grp)
    d['slot_dev_l10'] = (d.opp_slot_l10 / d.opp_pos) / (d.league_slot / d.league_pos)
    if prev is not None: d = d.merge(season_slot_dev(prev), on=['opp', 'slot'], how='left')
    else: d['prev_slot_dev'] = np.nan
    return d

def cv_poisson(d, cols, y='sog', folds=5):
    """Mean held-out Poisson deviance per row, folds = consecutive date blocks; and the full fit for the coefficients."""
    dd = d.dropna(subset=cols).copy()
    X = sm.add_constant(np.column_stack([np.log(dd[c].clip(lower=0.05)) for c in cols]))
    yv = dd[y].values.astype(float)
    dates = np.sort(dd.date.unique()); blocks = np.array_split(dates, folds)
    dev = 0.0; n = 0
    for b in blocks:
        test = dd.date.isin(b).values
        if test.sum() == 0 or (~test).sum() == 0: continue
        m = sm.GLM(yv[~test], X[~test], family=sm.families.Poisson()).fit()
        mu = m.predict(X[test]); yt = yv[test]
        with np.errstate(divide='ignore', invalid='ignore'):
            dv = 2 * np.where(yt > 0, yt * np.log(yt / mu), 0) - 2 * (yt - mu)
        dev += dv.sum(); n += len(yt)
    full = sm.GLM(yv, X, family=sm.families.Poisson()).fit()
    return dev / n, full, len(dd)

def terciles(d, col, y='sog'):
    dd = d.dropna(subset=[col]).copy()
    dd['exp'] = dd.own * dd.pos_ratio
    dd['t'] = pd.qcut(dd[col], 3, labels=['stingy third', 'middle', 'soft third'])
    rows = []
    for t, sub in dd.groupby('t', observed=True):
        rows.append({'tercile': str(t), 'rows': len(sub), 'read': sub[col].mean(), 'actual': sub[y].mean(), 'expected': sub.exp.mean(),
                     'lift': sub[y].mean() / sub.exp.mean(), '3+ actual': (sub[y] >= 3).mean(), '3+ expected': (1 - stats.poisson.cdf(2, sub.exp)).mean()})
    return rows

def fmt(v, d=3):
    return '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v:.{d}f}'

def rr(t):
    return f'{fmt(t[0])} [{fmt(t[1])}, {fmt(t[2])}]' if t else '—'

def print_terciles(rows, head):
    print(f'| {head} | rows | mean read | actual SOG | expected (own × position) | lift | 3+ actual | 3+ expected |')
    print('|---|---|---|---|---|---|---|---|')
    for r in rows:
        print(f'| {r["tercile"]} | {r["rows"]} | {fmt(r["read"], 2)} | {fmt(r["actual"], 2)} | {fmt(r["expected"], 2)} | {fmt(r["lift"], 3)} | {fmt(r["3+ actual"], 3)} | {fmt(r["3+ expected"], 3)} |')
    print()

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    boot = int(sys.argv[sys.argv.index('--boot') + 1]) if '--boot' in sys.argv else 300
    args = [a for a in args if a != str(boot) or a in sys.argv[:1]]
    args = [a for a in args if os.path.isdir(a)]
    seasons = [load(d) for d in args]
    prev = None
    for df in seasons:
        season = df.season.iloc[0]
        print(f'\n# {season}: {df.game.nunique()} games, {len(df)} skater-games, {df.opp.nunique()} teams\n')
        for stat in ['sog', 'g']:
            name = 'shots' if stat == 'sog' else 'goals'
            print(f'## Persistence, {name}: odd games against even games, what each team allows per skater (r between the halves across the league, 95% bootstrap)\n')
            print('| level | plain, r | over the shooters’ own rates, r | signal share | beyond the team’s position figure, r | signal share | pairs |')
            print('|---|---|---|---|---|---|---|')
            prows = persistence(df, stat, boot)
            for row in prows:
                print(f'| {row["level"]} | {rr(row["raw"])} | {rr(row["res"])} | {fmt(row["res share"], 2)} | {rr(row.get("dev"))} | {fmt(row.get("dev share", float("nan")), 2)} | {row["res"][3]} |')
                if row.get('per key'):
                    print(f'|  · beyond the position, key by key (n = teams) | ' + ', '.join(f'{k} {v:+.2f}' for k, v in sorted(row['per key'].items())) + ' | | | | | |')
            print()
            # How big the traits are, in the stat per skater-game: the spread between teams in a half season and the part of it that is real (√r × SD), or at most real (√ of the CI's top).
            size = []
            for row in prows:
                r = row['res'][0]; size.append(f'{row["level"].split(" ")[0]}: teams spread ±{fmt(row["res sd"], 2)} a skater-game in a half season, of which real ±{fmt(math.sqrt(max(r, 0)) * row["res sd"], 2)}')
                if 'dev' in row: size.append(f'{row["level"].split(" ")[0]} beyond the position: spread ±{fmt(row["dev sd"], 2)}, real ±{fmt(math.sqrt(max(row["dev"][0], 0)) * row["dev sd"], 2)}, at most ±{fmt(math.sqrt(max(row["dev"][2], 0)) * row["dev sd"], 2)} (the CI’s top)')
            print('Size of the traits (SD across the league, ' + name + ' per skater-game): ' + '; '.join(size) + '.\n')
            for k in ['LW1', 'LW3', 'C1', 'D1']:
                tb = top_bottom(df, stat, 'slot', k)
                if tb:
                    print(f'- {k} {name}, the user’s reading: the five teams that allowed the most in the odd games allowed {fmt(tb["top"][0], 2)} a skater there and {fmt(tb["top"][1], 2)} in the even games (over the shooters’ own rates {fmt(tb["top"][2], 2):>5} → {fmt(tb["top"][3], 2)}); the five that allowed the least {fmt(tb["bot"][0], 2)} → {fmt(tb["bot"][1], 2)} ({fmt(tb["bot"][2], 2)} → {fmt(tb["bot"][3], 2)}); the league {fmt(tb["league"][0], 2)} / {fmt(tb["league"][1], 2)}.')
            print()
        print('## Prediction, shots: the opponent’s reads as they stood each morning (leak-free), skaters with 5+ games, opponents with 30+ skater-games at the position\n')
        rows = build_rows(df, prev)
        print(f'{len(rows)} skater-games; the slot read defined on {rows.opp_slot.notna().sum()}, the line read on {rows.opp_line.notna().sum()}, last season’s slot deviation on {rows.prev_slot_dev.notna().sum()}.\n')
        print('| model (Poisson, 5-fold CV by date blocks) | rows | held-out deviance / row | saved vs the position read | last term: coefficient (z) |')
        print('|---|---|---|---|---|')
        subset = ['own', 'pos_ratio', 'slot_dev', 'line_dev'] + (['prev_slot_dev'] if rows.prev_slot_dev.notna().any() else [])
        base = rows.dropna(subset=subset)
        ladder = [('own rate', ['own']), ('+ position read (the opponent at his position over the league)', ['own', 'pos_ratio']),
                  ('+ line deviation (his line over the opponent’s forwards / defense figure)', ['own', 'pos_ratio', 'line_dev']),
                  ('+ slot deviation (his slot over the opponent’s position figure)', ['own', 'pos_ratio', 'slot_dev']),
                  ('+ both deviations', ['own', 'pos_ratio', 'line_dev', 'slot_dev'])]
        if 'prev_slot_dev' in subset:
            ladder += [('+ last season’s slot deviation (full season)', ['own', 'pos_ratio', 'prev_slot_dev']), ('+ this season’s and last season’s slot deviations', ['own', 'pos_ratio', 'slot_dev', 'prev_slot_dev'])]
        pos_dev = None
        for label, cols in ladder:
            dev, full, n = cv_poisson(base, cols)
            k = len(cols)
            gain = '' if pos_dev is None else f'{pos_dev - dev:+.4f}'
            print(f'| {label} | {n} | {dev:.4f} | {gain} | {full.params[k]:+.3f} ({full.tvalues[k]:+.1f}) |')
            if label.startswith('+ position'): pos_dev = dev
        print('\n(Deviance saved per row is the study’s unit: the position read itself is worth about 0.010 there. A coefficient of +1 would mean the read is taken at face value; 0 means it adds nothing.)\n')
        print('## The plain lift by third of each read as it stood that morning\n')
        print_terciles(terciles(rows, 'slot_dev'), 'the opponent’s slot over its own position figure, this season to date')
        print_terciles(terciles(rows, 'line_dev'), 'the opponent’s line (F1 … F4 / D1 … D3) over its forwards / defense figure')
        if rows.prev_slot_dev.notna().any():
            print_terciles(terciles(rows, 'prev_slot_dev'), 'the opponent’s slot over its position figure, last season (full)')
        print('## "Consistently": opponents in the same third on the slot over the season to date AND over their last 10 games\n')
        c = rows.dropna(subset=['slot_dev', 'slot_dev_l10']).copy()
        c['exp'] = c.own * c.pos_ratio
        c['t'] = pd.qcut(c.slot_dev, 3, labels=['stingy', 'middle', 'soft']); c['t10'] = pd.qcut(c.slot_dev_l10, 3, labels=['stingy', 'middle', 'soft'])
        print('| season to date | last 10 games | rows | actual SOG | expected (own × position) | lift | 3+ actual | 3+ expected |')
        print('|---|---|---|---|---|---|---|---|')
        for (t, t10), sub in c.groupby(['t', 't10'], observed=True):
            if t != t10 and not (t in ('soft', 'stingy') and t10 in ('soft', 'stingy')): continue
            print(f'| {t} | {t10} | {len(sub)} | {fmt(sub.sog.mean(), 2)} | {fmt(sub.exp.mean(), 2)} | {fmt(sub.sog.mean() / sub.exp.mean(), 3)} | {fmt((sub.sog >= 3).mean(), 3)} | {fmt((1 - stats.poisson.cdf(2, sub.exp)).mean(), 3)} |')
        print()
        if prev is not None:
            print(f'## Across seasons: {prev.season.iloc[0]} full season against {season} full season (r across the league, 95% bootstrap)\n')
            for stat in ['sog', 'g']:
                print(f'{"Shots" if stat == "sog" else "Goals"}:\n')
                print('| level | plain, r | over the shooters’ own rates, r | beyond the team’s position figure, r | pairs |')
                print('|---|---|---|---|---|')
                for row in across_seasons(prev, df, stat, boot):
                    print(f'| {row["level"]} | {rr(row["raw"])} | {rr(row["res"])} | {rr(row.get("dev"))} | {row["res"][3]} |')
                print()
        prev = df

if __name__ == '__main__':
    main()

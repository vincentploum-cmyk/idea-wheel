#!/usr/bin/env python3
"""The NFL's learned read, measured (docs/audits/2026-11-15-nfl-model.md): boosted trees per market on the replay's features
(`nfl-pf-audit.mjs --features`), trained on other weeks and scored beside the board on the same player-games.

  python3 -I tools/audit/nfl_model.py .nhl-data/audit/out/nfl-features.csv [--groups] [--mates] [--lines .nhl-data/audit/nfl-pf]

  (default)  season by season (train 2024 → 2025, 2024–25 → 2026, and 2025–26 → 2024 as a third look), then four forward
             half-season blocks, every market and the touchdowns
  --groups   each group of features left out in turn
  --mates    the regulars missing tonight, read off the game itself (more than the site can know before kickoff), added
  --lines    the books' main lines in the stored pulls (file wNN was pulled after week NN's games: its lines are week NN + 1's)
             beside the board, the trees and the blend
Needs numpy, pandas, lightgbm. tools/audit/nfl_model_fit.py writes the site's trees with the same settings.
"""
import argparse, gzip, json
import numpy as np, pandas as pd, lightgbm as lgb

ap = argparse.ArgumentParser(); ap.add_argument('file'); ap.add_argument('--groups', action='store_true'); ap.add_argument('--mates', action='store_true'); ap.add_argument('--lines', default=None)
args = ap.parse_args()
D = pd.read_csv(args.file); D['t'] = D.season * 100 + D.week; D['backup'] = D.backup.astype(bool); D['active'] = D.active.astype(bool)
META = [c for c in D.columns if c in ('tag', 'season', 'week', 'key', 'team', 'opp', 'pos', 'backup', 'active', 't') or c[:2] in ('y_', 'bp', 'sd')]
FEATS = [c for c in D.columns if c not in META and not c.startswith('b_')]
YARDS = {'rec_yds': (['WR', 'TE', 'RB'], 10, 10), 'rush_yds': (['RB', 'QB'], 10, 10), 'pass_yds': (['QB'], 100, 25), 'receptions': (['WR', 'TE', 'RB'], 1, 1.5)}
SEASONS = [('2024 → 2025', lambda d: d.season == 2024, lambda d: d.season == 2025), ('2024–25 → 2026', lambda d: d.season < 2026, lambda d: d.season == 2026), ('2025–26 → 2024', lambda d: d.season > 2024, lambda d: d.season == 2024)]
BLOCKS = [(f'before → {a % 10000 // 100 + 2000} w{a % 100}–{(b - 1) % 100}', (lambda a: lambda d: d.t < a)(a), (lambda a, b: lambda d: (d.t >= a) & (d.t < b))(a, b)) for a, b in ((202501, 202510), (202510, 202519), (202601, 202606), (202606, 202611))]
P = lambda obj: dict(objective=obj, learning_rate=0.03, num_leaves=7, min_data_in_leaf=60, feature_fraction=0.5, bagging_fraction=0.8, bagging_freq=1, lambda_l2=10.0, verbose=-1, num_threads=4, seed=7, deterministic=True)
rng0 = np.random.default_rng(1)
def boot(d, B=2000):
    d = np.asarray(d); m = d[rng0.integers(0, len(d), (B, len(d)))].mean(1); return np.quantile(m, .025), np.quantile(m, .975)
def lad(x, y):
    X = np.c_[np.ones(len(x)), x]; w = np.ones(len(x)); beta = np.array([0., 1.])
    for _ in range(60):
        beta = np.linalg.lstsq(X * w[:, None], y * w, rcond=None)[0]; w = 1 / np.sqrt(np.maximum(np.abs(y - X @ beta), 1e-3))
    return beta
def pool_of(m):
    pos, floor, tol = YARDS[m]
    d = D[D.pos.isin(pos) & D[f'bp_{m}'].notna()]
    if m == 'pass_yds': d = d[~d.backup]
    return d.assign(y=d[f'y_{m}'].clip(lower=0))
def yards_read(m, tr, te, feats=None):
    """The trees fitted on `tr` (Poisson), on the board's scale by a LAD line on tr's own out-of-fold answers, read on `te`."""
    feats = feats or FEATS; floor = YARDS[m][1]
    rng = np.random.default_rng(1); blk = tr.t.values; folds = np.array_split(rng.permutation(np.unique(blk)), 4); oof = np.zeros(len(tr))
    for fo in folds:
        k = np.isin(blk, fo); oof[k] = lgb.train(P('poisson'), lgb.Dataset(tr[~k][feats], tr[~k].y), num_boost_round=300).predict(tr[k][feats])
    lst = (tr[f'bp_{m}'] >= floor).values; c = lad(oof[lst], tr.y.values[lst])
    return np.maximum(0, c[0] + c[1] * lgb.train(P('poisson'), lgb.Dataset(tr[feats], tr.y), num_boost_round=300).predict(te[feats]))
lg = lambda q: np.log(np.clip(q, 1e-3, 1 - 1e-3) / (1 - np.clip(q, 1e-3, 1 - 1e-3)))

def table(folds, feats=None, markets=YARDS, quiet=False):
    res = {}
    for m in markets:
        pos, floor, tol = YARDS[m]; pool = pool_of(m); tot = []
        if not quiet: print(f'\n{m} (the list: {"/".join(pos)} projected {floor}+; close = within ±{tol})')
        for name, ftr, fte in folds:
            tr = pool[ftr(pool)]; te = pool[fte(pool) & (pool[f'bp_{m}'] >= floor)]
            p = yards_read(m, tr, te, feats); y = te[f'y_{m}'].values; bd = te[f'bp_{m}'].values; e0 = np.abs(bd - y); line = f'  {name} (train {len(tr)}, test {len(te)}): the board {e0.mean():.2f}, close {np.mean(e0 <= tol):.1%}; the trees {np.abs(p - y).mean():.2f}'
            for w in (.25, .5):
                e = np.abs(w * p + (1 - w) * bd - y); lo, hi = boot(e - e0); line += f'; blend {w:g}: {e.mean():.2f} ({(e - e0).mean():+.2f}, {lo:+.2f} to {hi:+.2f}), close {np.mean(e <= tol):.1%}'
            if not quiet: print(line)
            tot.append((len(te), (np.abs(.5 * p + .5 * bd - y) - e0).mean()))
        res[m] = [t[1] for t in tot] + [sum(n * d for n, d in tot) / sum(n for n, _ in tot)]
        if not quiet: print(f'  pooled, blend 0.5: {res[m][-1]:+.3f}')
    return res

def td_table(folds):
    pool = D[D.bp_td.notna()]
    print('\ntouchdowns (every skill player with a board chance; the week\'s six likeliest are not quarterbacks)')
    def six(p, te):
        t = te.assign(p=p); t = t[t.pos != 'QB']; g = t.groupby('tag', group_keys=False).apply(lambda x: x.nlargest(6, 'p')); return g.p.mean(), g.y_td.mean(), len(g)
    for name, ftr, fte in folds:
        tr = pool[ftr(pool)]; te = pool[fte(pool)]; y = te.y_td.values; bd = te.bp_td.values; e0 = (bd - y) ** 2
        p = lgb.train(P('binary'), lgb.Dataset(tr[FEATS], tr.y_td), num_boost_round=250).predict(te[FEATS])
        q = 1 / (1 + np.exp(-(.5 * lg(p) + .5 * lg(bd)))); e = (q - y) ** 2; lo, hi = boot(e - e0); s0, h0, n = six(bd, te); s1, h1, _ = six(q, te)
        print(f'  {name} (train {len(tr)}, test {len(te)}): Brier, the board {e0.mean():.4f}, the trees {((p - y) ** 2).mean():.4f}, the blend {e.mean():.4f} ({(e - e0).mean():+.4f}, {lo:+.4f} to {hi:+.4f}); six likeliest ({n}): the board said {s0:.0%} scored {h0:.0%}, the blend {s1:.0%} / {h1:.0%}')
        for a, b in ((0, .1), (.1, .2), (.2, .3), (.3, .45), (.45, 1.01)):
            k = (q >= a) & (q < b)
            if k.sum(): print(f'      the blend said {a:.0%}–{min(b, 1):.0%}: {k.sum()} games, said {q[k].mean():.1%}, scored {y[k].mean():.1%}')

if not (args.groups or args.mates or args.lines):
    print('== season by season'); table(SEASONS); td_table(SEASONS)
    print('\n== four forward blocks (trained on every week before the block)'); table(BLOCKS); td_table(BLOCKS)
if args.groups:
    grp = {'the side (t_*, his part of it, the team\'s volume)': [c for c in FEATS if c.startswith('t_') or c.startswith('sh_') or 'team' in c], 'tonight (home, the line, his slot)': ['home', 'points', 'total', 'spread', 'depth'], 'how often he has been in the game': ['act5', 'act10', 'lastActive', 'daysSince'],
           'his shares': [c for c in FEATS if 'Share' in c], 'red zone, air yards, after the catch, sacks': [c for c in FEATS if any(k in c for k in ('rz', 'Rz', 'airYds', 'yac', 'AirYds', 'sacked'))], 'what he makes of a look': [c for c in FEATS if any(c.endswith(k) for k in ('_ypt', '_ypc', '_ypa', '_catch'))], 'the windows (last 3, best, worst, spread, season, last game)': [c for c in FEATS if c.split('_')[0] in ('l3', 'max10', 'min5', 'sd10', 's', 'last')]}
    M3 = {k: YARDS[k] for k in ('rec_yds', 'rush_yds')}
    base = table(SEASONS, markets=M3, quiet=True); print('blend 0.5 against the board, pooled over the three seasons — all features:', {k: round(v[-1], 3) for k, v in base.items()})
    for g, cols in grp.items(): r = table(SEASONS, feats=[c for c in FEATS if c not in cols], markets=M3, quiet=True); print(f'  without {g} ({len(cols)}):', {k: round(v[-1], 3) for k, v in r.items()})
if args.mates:
    cols = ['e5_tgtShare', 'e5_rushShare', 'e5_tgt', 'e5_rushAtt', 'e5_recYds', 'e5_rushYds']; out = {c.replace('e5_', 'out_'): np.full(len(D), np.nan) for c in cols}; out['out_n'] = np.full(len(D), np.nan); out['out_qb'] = np.full(len(D), np.nan); at = {k: i for i, k in enumerate(D.index)}
    for (s, t), g in D.groupby(['season', 'team']):
        for w in sorted(g.week.unique()):
            prior = g[(g.week < w) & (g.week >= w - 4) & g.active]
            if not len(prior): continue
            last = prior.sort_values('week').groupby('key').tail(1).set_index('key'); now = g[g.week == w]; cnt = prior.groupby('key').size()
            miss = last[~last.index.isin(set(now[now.active].key))]; miss = miss[np.array([cnt.get(k, 0) >= 2 for k in miss.index], dtype=bool)]
            for i in now.index:
                for c in cols: out[c.replace('e5_', 'out_')][at[i]] = miss[c].sum()
                out['out_n'][at[i]] = len(miss); out['out_qb'][at[i]] = float(((miss.pos == 'QB') & (miss.e5_passAtt >= 15)).any())
    D = pd.concat([D, pd.DataFrame(out, index=D.index)], axis=1)
    a = table(SEASONS, quiet=True); b = table(SEASONS, feats=FEATS + list(out), quiet=True)
    print('blend 0.5 against the board, per season then pooled:'); [print(f'  {m}: as built {np.round(a[m], 2)}, with the regulars missing {np.round(b[m], 2)}') for m in YARDS]
if args.lines:
    rows = []
    for w in range(1, 18):
        try: j = json.load(gzip.open(f'{args.lines}/w{w:02d}.json.gz'))
        except FileNotFoundError: continue
        for p in j['pull']['data']['players']:
            seen = set()
            for x in p.get('props') or []:
                if x.get('isMain') is False or x.get('market') not in YARDS or x['market'] in seen or x.get('line') is None: continue
                seen.add(x['market']); rows.append(dict(season=2026, week=w + 1, key=p['key'], team=p['team'], m=x['market'], line=x['line']))
    L = pd.DataFrame(rows)
    for m in YARDS:
        pool = pool_of(m); tr = pool[pool.season < 2026]; te = pool[pool.season == 2026].copy(); te['p'] = yards_read(m, tr, te); te['blend'] = .5 * te.p + .5 * te[f'bp_{m}']
        J = te.merge(L[L.m == m], on=['season', 'week', 'key', 'team']); J = J[J.active]; y = J[f'y_{m}']; mae = lambda a: np.abs(a - y).mean()
        print(f'\n{m}: {len(J)} played with a line (weeks {sorted(J.week.unique())}); miss: the line {mae(J.line):.2f}, the board {mae(J[f"bp_{m}"]):.2f}, the trees {mae(J.p):.2f}, the blend {mae(J.blend):.2f}')
        for nm, col in (('the board', f'bp_{m}'), ('the blend', 'blend')):
            d = J[col] - J.line
            for thr in (0, .1, .2):
                k = (d.abs() >= thr * J.line) & (y != J.line); win = ((d[k] > 0) == (y[k] > J.line[k]))
                print(f'    {nm} off the line by {thr:.0%}+: {k.sum()} plays, its side won {win.mean():.1%}')

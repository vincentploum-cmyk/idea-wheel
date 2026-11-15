#!/usr/bin/env python3
"""Fits the NFL's learned read (lib/nfl/model.js) and writes its trees for the site.

The training file is the replay's own (`nfl-pf-audit.mjs --features`: every player-game's features as lib/nfl/model.js computes
them on the logs cut before the week, the board's reads, what he got), so the site reads exactly what the trees were trained on.

  # walk-forward: the trees for 2026's replay know 2024–25 only
  python3 -I tools/audit/nfl_model_fit.py .nhl-data/audit/out/nfl-features.csv --test 2026 --out .nhl-data/audit/out/nfl-model-2026.json
  # the site's file: every season, with the parity fixture
  python3 -I tools/audit/nfl_model_fit.py .nhl-data/audit/out/nfl-features.csv --out lib/nfl/model-trees.json --fixture __tests__/fixtures/nfl-model.json

Yards: LightGBM, Poisson (the trees' sum is the log of the mean), then a line by least absolute deviation on the training
weeks' out-of-fold answers (`cal`: the board's figure is the game he is likeliest to have, the mean runs above it). Touchdowns:
binary (the sum is the log-odds). The board's own reads (`b_*`) are not features: the blend is the board and the trees, apart.
Needs numpy, pandas, lightgbm.
"""
import argparse, json, os, sys
import numpy as np, pandas as pd, lightgbm as lgb

ap = argparse.ArgumentParser()
ap.add_argument('file'); ap.add_argument('--test', type=int, default=None); ap.add_argument('--out', default=None); ap.add_argument('--fixture', default=None)
ap.add_argument('--rounds', type=int, default=300); ap.add_argument('--leaves', type=int, default=7)
args = ap.parse_args()
D = pd.read_csv(args.file)
META = [c for c in D.columns if c in ('tag', 'season', 'week', 'key', 'team', 'opp', 'pos', 'backup', 'active') or c[:2] in ('y_', 'bp', 'sd')]
FEATS = [c for c in D.columns if c not in META and not c.startswith('b_')]
# market: the positions it is fitted and read for, the list's floor (the line is fitted on the list), the blend's weight.
# Passing is not in it: on four forward blocks the blend cost 0.5 yards a start (docs/audits/2026-11-15-nfl-model.md).
YARDS = {'rec_yds': (['WR', 'TE', 'RB'], 10, 0.5), 'rush_yds': (['RB', 'QB'], 10, 0.5), 'receptions': (['WR', 'TE', 'RB'], 1, 0.5)}
TD_BLEND = 0.5
train = D if args.test is None else D[D.season < args.test]
print(f'training on {sorted(train.season.unique())}: {len(train)} player-games, {len(FEATS)} features', file=sys.stderr)

def params(obj):
    return dict(objective=obj, learning_rate=0.03, num_leaves=args.leaves, min_data_in_leaf=60, feature_fraction=0.5, bagging_fraction=0.8, bagging_freq=1, lambda_l2=10.0, verbose=-1, num_threads=4, seed=7, deterministic=True)

def lad(x, y):
    X = np.c_[np.ones(len(x)), x]; w = np.ones(len(x)); beta = np.array([0., 1.])
    for _ in range(60):
        beta = np.linalg.lstsq(X * w[:, None], y * w, rcond=None)[0]; w = 1 / np.sqrt(np.maximum(np.abs(y - X @ beta), 1e-3))
    return beta

def pack(node, t):
    """A LightGBM tree as flat arrays; returns the child's reference (a split's index, or −(leaf + 1))."""
    if 'leaf_value' in node and 'split_feature' not in node:
        t['v'].append(float(f"{node['leaf_value']:.6g}")); return -len(t['v'])
    i = len(t['f']); t['f'].append(node['split_feature']); t['t'].append(float(repr(float(node['threshold'])))); t['d'].append(1 if node.get('default_left') else 0); t['l'].append(None); t['r'].append(None)
    assert node.get('decision_type', '<=') == '<='
    t['l'][i] = pack(node['left_child'], t); t['r'][i] = pack(node['right_child'], t)
    return i

def trees_of(b):
    out = []
    for ti in b.dump_model()['tree_info']:
        t = {'f': [], 't': [], 'l': [], 'r': [], 'd': [], 'v': []}; pack(ti['tree_structure'], t); out.append(t)
    return out

model = {'version': 1, 'trained': sorted(int(s) for s in train.season.unique()), 'rows': int(len(train)), 'features': FEATS, 'blend': {}, 'stats': {}}
boosters = {}; cals = {}
for m, (pos, floor, w) in YARDS.items():
    tr = train[train.pos.isin(pos) & train[f'bp_{m}'].notna()].copy(); tr['y'] = tr[f'y_{m}'].clip(lower=0)
    rng = np.random.default_rng(1); blk = (tr.season * 100 + tr.week).values; folds = np.array_split(rng.permutation(np.unique(blk)), 4); oof = np.zeros(len(tr))
    for fo in folds:
        k = np.isin(blk, fo); oof[k] = lgb.train(params('poisson'), lgb.Dataset(tr[~k][FEATS], tr[~k].y), num_boost_round=args.rounds).predict(tr[k][FEATS])
    lst = (tr[f'bp_{m}'] >= floor).values; c = np.round(lad(oof[lst], tr.y.values[lst]), 4)   # as the file carries it
    b = lgb.train(params('poisson'), lgb.Dataset(tr[FEATS], tr.y), num_boost_round=args.rounds); boosters[m] = b; cals[m] = c
    model['stats'][m] = {'pos': pos, 'cal': [float(c[0]), float(c[1])], 'rows': int(len(tr)), 'features': FEATS, 'trees': trees_of(b)}
    model['blend'][m] = w
    print(f'{m}: {len(tr)} rows, the line {c[0]:+.2f} + {c[1]:.3f} × the trees', file=sys.stderr)
tr = train[train.bp_td.notna()]
b = lgb.train(params('binary'), lgb.Dataset(tr[FEATS], tr.y_td), num_boost_round=250); boosters['td'] = b
model['stats']['td'] = {'pos': ['QB', 'RB', 'WR', 'TE'], 'link': 'logit', 'rows': int(len(tr)), 'features': FEATS, 'trees': trees_of(b)}
model['blend']['td'] = TD_BLEND

def read(m, X):
    p = boosters[m].predict(X[FEATS])
    return p if m == 'td' else np.maximum(0, cals[m][0] + cals[m][1] * p)

if args.test is not None:
    T = D[D.season == args.test]
    for m, (pos, floor, w) in YARDS.items():
        te = T[T.pos.isin(pos) & (T[f'bp_{m}'] >= floor)]; p = read(m, te); y = te[f'y_{m}'].values; bd = te[f'bp_{m}'].values
        print(f'{args.test} {m} ({len(te)}): the board {np.abs(bd - y).mean():.2f}, the trees {np.abs(p - y).mean():.2f}, the blend {np.abs(w * p + (1 - w) * bd - y).mean():.2f}')
    te = T[T.bp_td.notna()]; p = read('td', te); lg = lambda q: np.log(np.clip(q, 1e-3, 1 - 1e-3) / (1 - np.clip(q, 1e-3, 1 - 1e-3)))
    q = 1 / (1 + np.exp(-(TD_BLEND * lg(p) + (1 - TD_BLEND) * lg(te.bp_td.values))))
    print(f'{args.test} td ({len(te)}): Brier, the board {((te.bp_td - te.y_td) ** 2).mean():.4f}, the trees {((p - te.y_td) ** 2).mean():.4f}, the blend {((q - te.y_td) ** 2).mean():.4f}')
if args.fixture:
    # A few player-games with the trees' own answers, for the site's parity test (__tests__/nfl-model.test.js).
    last = D[D.season == D.season.max()]; pick = last.iloc[np.linspace(0, len(last) - 1, 10).astype(int)]
    rows = [{'pos': r.pos, 'feats': {c: (None if pd.isna(r[c]) else float(r[c])) for c in FEATS}, 'pred': {m: float(read(m, pd.DataFrame([r[FEATS]]).astype(float))[0]) for m in boosters if r.pos in model['stats'][m]['pos']}} for _, r in pick.iterrows()]
    json.dump(rows, open(args.fixture, 'w'), separators=(',', ':'))
if args.out:
    json.dump(model, open(args.out, 'w'), separators=(',', ':'))
    print(f'written {args.out} ({os.path.getsize(args.out) / 1e6:.2f} MB)', file=sys.stderr)

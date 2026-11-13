#!/usr/bin/env python3
"""Fits the NBA's learned read (lib/nba/model.js) and writes its trees for the site.

The training file is the replay's own (`nba-audit.mjs --features`: every player-night's features as lib/nba/model.js computes
them on the board's pull, with what he got), so the site reads exactly what the trees were trained on.

  # walk-forward check: train on the seasons before --test, score on it beside the board's rows, write the trees for the replay
  python3 -I tools/audit/nba_model_fit.py --features 2025:.nhl-data/audit/run/nba-2025-04-13-feat-features.csv 2026:.nhl-data/audit/run/nba-2026-04-12-feat-features.csv \\
      2027:.nhl-data/audit/run/nba-2026-11-12-feat-features.csv --rows 2026:.nhl-data/audit/run/nba-2026-04-12-site-rows.csv 2027:.nhl-data/audit/run/nba-2026-11-12-site-rows.csv \\
      --test 2027 --out .nhl-data/audit/run/model-2027.json
  # the site's file: every season
  python3 -I tools/audit/nba_model_fit.py --features … --out lib/nba/model-trees.json

Needs numpy, pandas, lightgbm.
"""
import argparse, json, sys
import numpy as np, pandas as pd, lightgbm as lgb

ap = argparse.ArgumentParser()
ap.add_argument('--features', nargs='+', required=True); ap.add_argument('--rows', nargs='*', default=[]); ap.add_argument('--test', type=int, default=None)
ap.add_argument('--out', default=None); ap.add_argument('--fixture', default=None); ap.add_argument('--blend', type=float, default=0.5); ap.add_argument('--rounds', type=int, default=350); ap.add_argument('--leaves', type=int, default=15)
args = ap.parse_args()
STATS = ('pts', 'reb', 'ast', 'tpm')
F = {int(s.split(':', 1)[0]): pd.read_csv(s.split(':', 1)[1]) for s in args.features}
R = {int(s.split(':', 1)[0]): pd.read_csv(s.split(':', 1)[1]) for s in args.rows}
META = ['slate', 'espnId', 'key', 'team', 'y_pts', 'y_reb', 'y_ast', 'y_tpm', 'y_min']
FEATS = [c for c in next(iter(F.values())).columns if c not in META]
PARAMS = dict(objective='poisson', learning_rate=0.05, num_leaves=args.leaves, min_data_in_leaf=100, feature_fraction=0.7, bagging_fraction=0.8, bagging_freq=1, lambda_l2=5.0, verbose=-1, num_threads=4, seed=7, deterministic=True)
train = pd.concat([d for s, d in F.items() if args.test is None or s < args.test])
print(f'training on {sorted(s for s in F if args.test is None or s < args.test)}: {len(train)} player-nights, {len(FEATS)} features', file=sys.stderr)

def pack(node, t):
    """A LightGBM tree as flat arrays; returns the child's reference (a split's index, or −(leaf + 1))."""
    if 'leaf_value' in node and 'split_feature' not in node:
        t['v'].append(float(f"{node['leaf_value']:.6g}")); return -len(t['v'])
    i = len(t['f']); t['f'].append(node['split_feature']); t['t'].append(float(repr(float(node['threshold'])))); t['d'].append(1 if node.get('default_left') else 0); t['l'].append(None); t['r'].append(None)
    assert node.get('decision_type', '<=') == '<='
    t['l'][i] = pack(node['left_child'], t); t['r'][i] = pack(node['right_child'], t)
    return i

model = {'version': 1, 'trained': sorted(int(s) for s in F if args.test is None or s < args.test), 'rows': int(len(train)), 'blend': {'default': args.blend}, 'stats': {}}
boosters = {}
for k in STATS:
    b = lgb.train(PARAMS, lgb.Dataset(train[FEATS], train[f'y_{k}']), num_boost_round=args.rounds); boosters[k] = b
    trees = []
    for ti in b.dump_model()['tree_info']:
        t = {'f': [], 't': [], 'l': [], 'r': [], 'd': [], 'v': []}; pack(ti['tree_structure'], t); trees.append(t)
    model['stats'][k] = {'features': FEATS, 'trees': trees}

mae = lambda a, b: float(np.mean(np.abs(np.asarray(a) - np.asarray(b))))
if args.test is not None and args.test in F:
    T = F[args.test].copy(); T['id'] = T.espnId.astype(str).str.replace(r'\.0$', '', regex=True)
    print(f'\n{args.test}: {len(T)} player-nights')
    for k in STATS:
        T[f'p_{k}'] = boosters[k].predict(T[FEATS])
        line = f'  {k}: the model alone {mae(T[f"p_{k}"], T[f"y_{k}"]):.3f} (bias {(T[f"p_{k}"] - T[f"y_{k}"]).mean():+.2f})'
        if args.test in R:
            b = R[args.test]; b = b[(b.market == k) & (~b.out) & (b.actualMin > 0)].copy(); b['id'] = b.espnId.astype(str).str.replace(r'\.0$', '', regex=True)
            J = T.merge(b[['id', 'slate', 'exp', 'actual', 'matchup']], on=['id', 'slate'])
            line += f' | on the board\'s {len(J)}: the board {mae(J.exp, J.actual):.3f}, the model {mae(J[f"p_{k}"], J.actual):.3f}, ' + ', '.join(f'blend {w:g} {mae(w * J[f"p_{k}"] + (1 - w) * J.exp, J.actual):.3f}' for w in (0.25, 0.5, 0.75))
            mm = J.matchup.fillna(1); line += f' | the model × the board\'s matchup, blend 0.5: {mae(0.5 * J[f"p_{k}"] * mm + 0.5 * J.exp, J.actual):.3f}'
        print(line)
if args.fixture:
    # A few player-nights with the trees' own answers, for the site's parity test (__tests__/nba-model.test.js).
    last = F[max(F)]; pick = last.iloc[np.linspace(0, len(last) - 1, 8).astype(int)]
    rows = [{'feats': {c: (None if pd.isna(r[c]) else float(r[c])) for c in FEATS}, 'pred': {k: float(boosters[k].predict(pd.DataFrame([r[FEATS]]).astype(float))[0]) for k in STATS}} for _, r in pick.iterrows()]
    json.dump(rows, open(args.fixture, 'w'), separators=(',', ':'))
if args.out:
    json.dump(model, open(args.out, 'w'), separators=(',', ':')); import os
    print(f'written {args.out} ({os.path.getsize(args.out) / 1e6:.2f} MB)', file=sys.stderr)

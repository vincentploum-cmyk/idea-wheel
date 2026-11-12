#!/usr/bin/env python3
"""The Patterns tab's 3+ SOG model: a logistic regression and gradient-boosted trees on every figure the study reads
(the 239 of patterns-rows.mjs, plus his position), averaged, the way patterns_backtest.py's "model on all figures"
reads. Fitted on every skater-game through --through and written as JSON the site scores with
lib/nhl-data/patterns-model-pure.js (the trees as node lists, the regression as medians / means / spreads /
coefficients), so the site needs no training. Games after --through, when the csv has them, grade the model as it
stood (frozen, the way the site runs it between refits): said against landed by band, its calls over 50 / 60 / 70%,
its top 1 / 3 / 5 / 10 a night, each half alone beside the average.

  python3 -I tools/predictors/patterns_model.py <patterns.csv> --through YYYY-MM-DD --out <model.json>
          [--check-through YYYY-MM-DD] [--report <report.md>] [--parity <scores.csv>] [--fixture <parity.json>]

--check-through grades a second fit, made through that date, on the games after it up to --through (the shipped
model is still fitted through --through): the check the JSON carries when the shipped fit has no games after it.

--parity writes the model's chance for every graded row (date, playerId, p), for the site's scorer to match.
--fixture writes a few skater-games of the fit's last night with the shipped fit's own chance
(__tests__/fixtures/patterns-model-parity.json: regenerate it with every refit).
numpy, pandas, scikit-learn.
"""
import json
import sys
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression

warnings.filterwarnings('ignore')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {sys.argv[i][2:]: sys.argv[i + 1] for i in range(len(sys.argv) - 1) if sys.argv[i].startswith('--')}
if not args or 'through' not in opt or 'out' not in opt:
    sys.exit(__doc__)
through = opt['through']
MARK, STAT, AT = 's3', 'sog', 3

d = pd.read_csv(args[0], low_memory=False)
d = d[d.gp >= 1].sort_values('date').reset_index(drop=True)
META = {'date', 'gameId', 'playerId', 'name', 'team', 'opp', 'venue', 'slot', 'pos'}
FEATS = [c for c in d.columns if c not in META and not c.startswith('o_')]
X = d[FEATS].astype(float)
for p in ['C', 'LW', 'RW', 'D']:
    X[f'pos_{p}'] = (d.pos == p).astype(float)
NAMES = list(X.columns)
y = d[f'o_y_{MARK}'].astype(int).to_numpy()
tr = (d.date <= through).to_numpy()
te = ~tr

def fit(mask):
    Xtr = X[mask]
    med = Xtr.median()
    mu = Xtr.fillna(med).mean()
    sd = Xtr.fillna(med).std().replace(0, 1).fillna(1)
    med = med.fillna(0)
    std = lambda Z: ((Z.fillna(med) - mu) / sd).clip(-6, 6).to_numpy()
    lr = LogisticRegression(C=0.05, max_iter=2000).fit(std(Xtr), y[mask])
    gb = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=200, min_samples_leaf=40, l2_regularization=1.0,
                                        random_state=0).fit(Xtr.to_numpy(), y[mask])
    return med, mu, sd, std, lr, gb

ck = opt.get('check-through')
if ck:
    fit_mask = (d.date <= ck).to_numpy(); grade_mask = ((d.date > ck) & (d.date <= through)).to_numpy()
else:
    fit_mask = tr; grade_mask = te
_, _, _, g_std, g_lr, g_gb = fit(fit_mask)
med, mu, sd, std, lr, gb = fit(tr) if ck else fit(fit_mask)

# ---- the JSON the site scores ----
r6 = lambda v: float(f'{float(v):.6g}')
trees = []
for it in gb._predictors:
    nodes = it[0].nodes
    # [feature, threshold, missing goes left (1/0), left, right] for a split; [leaf value] for a leaf
    trees.append([[r6(n['value'])] if n['is_leaf'] else [int(n['feature_idx']), float(n['num_threshold']), int(n['missing_go_to_left']), int(n['left']), int(n['right'])]
                  for n in nodes])
baseline = float(np.ravel(gb._baseline_prediction)[0])
model = {
    'mark': MARK, 'label': '3+ SOG', 'builtThrough': str(d.date[tr].max()), 'from': str(d.date[tr].min()), 'rows': int(tr.sum()),
    'base': round(float(y[tr].mean()), 4),
    'feats': NAMES,
    'lr': {'med': [r6(v) for v in med], 'mu': [r6(v) for v in mu], 'sd': [r6(v) for v in sd],
           'coef': [r6(v) for v in lr.coef_[0]], 'intercept': r6(lr.intercept_[0])},
    'gb': {'baseline': baseline, 'trees': trees},
}

out = []
line = out.append
def pct(v): return '—' if v is None or (isinstance(v, float) and np.isnan(v)) else f'{v * 100:.0f}%'

if grade_mask.any():
    Xte, yte, dte = X[grade_mask], y[grade_mask], d[grade_mask]
    p_lr = g_lr.predict_proba(g_std(Xte))[:, 1]
    p_gb = g_gb.predict_proba(Xte.to_numpy())[:, 1]
    p = (p_lr + p_gb) / 2
    days = sorted(dte.date.unique())
    fitted = str(d.date[fit_mask].max())
    model['check'] = {'fitThrough': fitted, 'from': days[0], 'to': days[-1], 'rows': int(grade_mask.sum()), 'calls': {}}
    line(f'# The 3+ SOG model, fitted through {fitted}, graded frozen on {days[0]} to {days[-1]}\n')
    line(f'Fitted on {fit_mask.sum()} skater-games (to {fitted}), graded on {grade_mask.sum()} over {len(days)} nights '
         f'the fit never saw, the model as it stood (no refit). Base rate {pct(yte.mean())}.\n')
    line('| Read | ≥ 50% | ≥ 60% | ≥ 70% | Top 1 | Top 3 | Top 5 | Top 10 | Brier |')
    line('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for name, s in [('Model (average)', p), ('Regression alone', p_lr), ('Trees alone', p_gb)]:
        cells = []
        for b in (0.5, 0.6, 0.7):
            m = s >= b
            cells.append(f'{pct(yte[m].mean()) if m.any() else "—"} ({int(yte[m].sum())}/{int(m.sum())}, said {pct(s[m].mean()) if m.any() else "—"})')
            if s is p:
                model['check']['calls'][f'{int(b * 100)}'] = {'n': int(m.sum()), 'hits': int(yte[m].sum())}
        for k in (1, 3, 5, 10):
            h = n = 0
            for day in days:
                w = (dte.date == day).to_numpy()
                idx = np.argsort(-s[w])[:k]
                h += int(yte[w][idx].sum()); n += len(idx)
            cells.append(f'{pct(h / n)} ({h}/{n})')
        cells.append(f'{np.mean((s - yte) ** 2):.4f}')
        line(f'| {name} | ' + ' | '.join(cells) + ' |')
    line('\n**Said against landed** (the average):\n')
    line('| Said | Skater-games | Said (mean) | Landed |')
    line('| --- | --- | --- | --- |')
    for lo, hi in [(0, .1), (.1, .2), (.2, .3), (.3, .4), (.4, .5), (.5, .6), (.6, .7), (.7, 1.01)]:
        m = (p >= lo) & (p < hi)
        if m.any():
            line(f'| {pct(lo)}–{pct(min(hi, 1))} | {int(m.sum())} | {pct(p[m].mean())} | {pct(yte[m].mean())} |')
    if ck:
        line(f'\nThe shipped model is fitted on every skater-game through {model["builtThrough"]} ({tr.sum()}).')
    if 'parity' in opt:
        pd.DataFrame({'date': dte.date, 'playerId': dte.playerId, 'p': p}).to_csv(opt['parity'], index=False)
else:
    line(f'# The 3+ SOG model, fitted through {through}\n\nFitted on {tr.sum()} skater-games; no games after it in the csv to grade.')

if 'fixture' in opt:
    last = d[tr & (d.date == d.date[tr].max()).to_numpy()]
    pick = pd.concat([last.sort_values('sog_avg', ascending=False).head(4), last[last.pos == 'D'].head(2), last[last.gp <= 3].head(2)]).drop_duplicates('playerId')
    fx = []
    for i, r in pick.iterrows():
        xi = X.loc[[i]]
        p_i = (lr.predict_proba(std(xi))[:, 1][0] + gb.predict_proba(xi.to_numpy())[:, 1][0]) / 2
        f = {k: (None if pd.isna(r[k]) else float(r[k])) for k in FEATS}
        f['pos'] = r.pos
        fx.append({'date': r.date, 'name': r['name'], 'f': f, 'p': float(p_i)})
    json.dump({'note': f"Skater-games of {model['builtThrough']} with scikit-learn's own chance from the shipped 3+ SOG fit "
               f"(tools/predictors/patterns_model.py through {model['builtThrough']}). Regenerate with every refit (--fixture).", 'rows': fx},
              open(opt['fixture'], 'w'))
json.dump(model, open(opt['out'], 'w'), separators=(',', ':'))
text = '\n'.join(out)
if 'report' in opt:
    open(opt['report'], 'w').write(text + '\n')
print(text)
print(f'\nwrote {opt["out"]}: {len(NAMES)} figures, {len(trees)} trees')

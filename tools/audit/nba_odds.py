#!/usr/bin/env python3
"""Can the book's odds help find opportunities (Vincent, 2026-11-13)? On the site's own graded nights: every ladder rung and
play with the price PropFinder carried and what the player did (the nba-odds-export workflow's nba-odds-rows.json.gz =
GET /api/nba/scorecard?rows=1).

  python3 -I tools/audit/nba_odds.py --rows .nhl-data/audit/odds/nba-odds-rows.json.gz --out docs/audits/2026-11-13-nba-odds-tables.md

Asks: is the book's price honest (implied against landed, by price and market, and what a blind bet returns); who reads a
line better, the board or the price, and what each adds to the other; does the board's edge over the price pay, by size of
edge, market and price; and which cuts returned money on both halves of the nights. Needs numpy, pandas, statsmodels.
"""
import argparse, gzip, json, math, sys
import numpy as np, pandas as pd
import statsmodels.api as sm

ap = argparse.ArgumentParser(); ap.add_argument('--rows', required=True); ap.add_argument('--out', default=None)
args = ap.parse_args()
J = json.load(gzip.open(args.rows))
NAME = {'pts': 'Points', 'reb': 'Rebounds', 'ast': 'Assists', 'tpm': 'Threes', 'pra': 'PRA', 'stl': 'Steals', 'blk': 'Blocks'}
def implied(o): return (-o) / (-o + 100) if o < 0 else 100 / (o + 100)
def payout(o): return 100 / (-o) if o < 0 else o / 100          # profit on a 1-unit stake that wins
out = []
def w(s=''): out.append(s)
pc = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v * 100:.1f}%'

R = pd.DataFrame(J['rungs']); P = pd.DataFrame(J['plays'])
R = R[R.odds.notna() & R.p.notna()].copy(); R['odds'] = R.odds.astype(float); R = R[(R.odds.abs() >= 100)]
R['imp'] = R.odds.map(implied); R['pay'] = R.odds.map(payout); R['ret'] = np.where(R.hit == 1, R.pay, -1.0)
# the book's hold, from the plays priced both ways on one line
P = P[P.odds.notna()].copy(); P['imp'] = P.odds.astype(float).map(implied)
both = P.pivot_table(index=['slate', 'key', 'market', 'line'], columns='side', values='imp', aggfunc='first')
hold = float((both['over'] + both['under'] - 1).dropna().mean()) if {'over', 'under'} <= set(both.columns) else 0.07
R['fair'] = R.imp / (1 + hold)                                   # the price with the hold taken off evenly
R['edge'] = R.p - R.imp
slates = sorted(R.slate.unique()); half = slates[len(slates) // 2]
R['second'] = R.slate >= half

def roi(D): return float(D.ret.mean()) if len(D) else float('nan')
def boot(D, n=400):
    """A 90% interval on the return, resampling whole nights."""
    by = [g.ret.values for _, g in D.groupby('slate')]
    if len(by) < 4: return (float('nan'), float('nan'))
    rng = np.random.default_rng(3); v = []
    for _ in range(n):
        pick = rng.integers(0, len(by), len(by)); x = np.concatenate([by[i] for i in pick]); v.append(x.mean())
    return (float(np.quantile(v, .05)), float(np.quantile(v, .95)))
def line(label, D, minN=40):
    if len(D) < minN: return f'| {label} | {len(D)} | — | — | — | — | — | — |'
    lo, hi = boot(D)
    return f'| {label} | {len(D)} | {pc(D.p.mean())} | {pc(D.imp.mean())} | {pc(D.hit.mean())} | {roi(D) * 100:+.1f}% | {lo * 100:+.0f}% to {hi * 100:+.0f}% | {roi(D[~D.second]) * 100:+.1f}% / {roi(D[D.second]) * 100:+.1f}% |'
HEAD = '| | bets | the board said | the price implied | landed | return a unit | 90% range | first / second half |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'

w('# The NBA: the book\'s prices on the site\'s graded nights'); w()
w(f'{len(R)} priced over rungs of {R.slate.nunique()} nights ({slates[0]} to {slates[-1]}), {R.key.nunique()} players; the board\'s chance as it states it before the calibration\'s fit. The book\'s hold on a line priced both ways: {hold * 100:.1f}% ({len(both.dropna())} lines). "Return" is the profit per unit staked on the over at the price carried; the halves split the nights at {half}.'); w()

w('## Is the price honest?'); w(); w(HEAD)
w(line('every priced over', R))
for a, b, lab in [(-10000, -400, '−400 and shorter'), (-400, -200, '−400 to −200'), (-200, -130, '−200 to −130'), (-130, 110, '−130 to +110 (the main lines)'), (110, 200, '+110 to +200'), (200, 400, '+200 to +400'), (400, 100000, '+400 and longer')]:
    w(line(lab, R[(R.odds > a) & (R.odds <= b)]))
for m in NAME:
    w(line(NAME[m], R[R.market == m]))
w(line('the main line', R[R.main == True])); w(line('the alternate lines', R[R.main != True])); w()

w('## The board against the price'); w()
lg = lambda p: np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4)))
def ll(p, y): p = np.clip(p, 1e-4, 1 - 1e-4); return float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean())
w('| | rungs | the board: Brier / log loss | the price (hold off) | half and half | fitted: weight on the board / on the price |'); w('| --- | ---: | ---: | ---: | ---: | ---: |')
for m in [None] + list(NAME):
    D = R if m is None else R[R.market == m]
    if len(D) < 300: continue
    y = D.hit.values; mix = (D.p + D.fair) / 2
    fit = sm.Logit(y, sm.add_constant(np.column_stack([lg(D.p.values), lg(D.fair.values)]))).fit(disp=0)
    w(f'| {"All" if m is None else NAME[m]} | {len(D)} | {((D.p - y) ** 2).mean():.4f} / {ll(D.p.values, y):.4f} | {((D.fair - y) ** 2).mean():.4f} / {ll(D.fair.values, y):.4f} | {((mix - y) ** 2).mean():.4f} / {ll(mix.values, y):.4f} | {fit.params[1]:.2f} / {fit.params[2]:.2f} |')
w()

w('## Does the board\'s edge over the price pay?'); w(); w('Edge = the board\'s chance less the price\'s implied chance (the hold still in it).'); w(); w(HEAD)
for a, b in [(-1, -.15), (-.15, -.08), (-.08, -.03), (-.03, .03), (.03, .08), (.08, .15), (.15, 1)]:
    w(line(f'edge {a * 100:+.0f} to {b * 100:+.0f} points' if a > -1 and b < 1 else (f'edge under {b * 100:+.0f}' if a == -1 else f'edge over {a * 100:+.0f}'), R[(R.edge > a) & (R.edge <= b)]))
w()
for m in NAME:
    D = R[R.market == m]
    if len(D) < 300: continue
    w(f'### {NAME[m]}'); w(); w(HEAD)
    for lab, f in [('edge 5+ points', D.edge >= .05), ('edge 10+ points', D.edge >= .10), ('edge 10+, the main line', (D.edge >= .10) & (D.main == True)), ('edge 10+, alternate, plus money', (D.edge >= .10) & (D.main != True) & (D.odds > 100)),
                   ('edge 10+, the board 55%+', (D.edge >= .10) & (D.p >= .55)), ('edge −5 or worse (the board against the over)', D.edge <= -.05)]:
        w(line(lab, D[f]))
    w()

w('## The unders on the main lines (the plays)'); w()
PU = pd.DataFrame(J['plays']); PU = PU[PU.odds.notna() & PU.p.notna()].copy(); PU['odds'] = PU.odds.astype(float); PU = PU[PU.odds.abs() >= 100]
PU['imp'] = PU.odds.map(implied); PU['pay'] = PU.odds.map(payout); PU['ret'] = np.where(PU.hit == 1, PU.pay, -1.0); PU['edge'] = PU.p - PU.imp; PU['second'] = PU.slate >= half; PU['hit'] = PU.hit.astype(int)
w(HEAD)
for side in ('over', 'under'):
    D = PU[PU.side == side]
    w(line(f'every {side}', D)); w(line(f'{side}, edge 5+ points', D[D.edge >= .05])); w(line(f'{side}, edge 10+ points', D[D.edge >= .10])); w(line(f'{side}, on the board\'s tables', D[D.onBoard == True]))
w()
if args.out: open(args.out, 'w').write('\n'.join(out) + '\n'); print('written', args.out, file=sys.stderr)
else: print('\n'.join(out))

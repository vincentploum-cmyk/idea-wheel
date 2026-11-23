# The direction table for docs/audits/2026-11-23-nba-own-without.md: rows of nba_wo_own.py by the size of his own split.
# python3 -I tools/audit/nba_wo_own_buckets.py  (reads .nhl-data/audit/nba-box)
import sys, runpy, numpy as np
sys.argv = ['x', '--box', '.nhl-data/audit/nba-box', '--out', '/dev/null']
import io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    g = runpy.run_path('tools/audit/nba_wo_own.py')
rows = g['rows']
print('| His split (points, without − with) | games without | player-games | board read | his without avg | with avg | actual | actual − board |')
print('|---|---|---:|---:|---:|---:|---:|---:|')
for lo, hi, lab in [(8, 99, '+8 or more'), (4, 8, '+4 to +8'), (-4, 4, 'within 4'), (-99, -4, '−4 or less')]:
  for nlo, nhi, nl in [(2, 3, '2'), (3, 6, '3–5'), (6, 99, '6+')]:
    R = [r for r in rows if r['pts_with'] is not None and r['n'] >= nlo and r['n'] < nhi and lo <= r['pts_wo'] - r['pts_with'] < hi]
    if len(R) < 30: continue
    m = lambda k: np.mean([r[k] for r in R])
    print(f"| {lab} | {nl} | {len(R)} | {m('pts_board'):.1f} | {m('pts_wo'):.1f} | {m('pts_with'):.1f} | {m('pts_act'):.1f} | {m('pts_act') - m('pts_board'):+.1f} |")
print()
print('| His split (minutes) | player-games | board minutes | without avg | with avg | actual |')
print('|---|---:|---:|---:|---:|---:|')
for lo, hi, lab in [(8, 99, '+8 or more'), (4, 8, '+4 to +8'), (-4, 4, 'within 4'), (-99, -4, '−4 or less')]:
    R = [r for r in rows if r['min_with'] is not None and r['n'] >= 2 and lo <= r['min_wo'] - r['min_with'] < hi]
    m = lambda k: np.mean([r[k] for r in R])
    print(f"| {lab} | {len(R)} | {m('min_base'):.1f} | {m('min_wo'):.1f} | {m('min_with'):.1f} | {m('min_act'):.1f} |")

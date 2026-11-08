"""The NFL's outlier games: double his projection (and +40 yards / +3 receptions) — does the board's chance there land?

Vincent, 2026-11-08: "Build the same outlier functionality for NFL" (the NBA's Big games → Outliers). Reads the replay's
graded yards rows (`nfl-audit.mjs --yards <file>`: 2025's weeks 4–18 and 2026's finished weeks, the site's board and
projections as shipped) and asks, per market: the outlier's rate by the size of the projection, said against landed;
the week's top ten by the board's chance (his own spread), by the chance on the spread usual for his projection
(c · proj^e, fitted on 2025), and half and half; log loss on both seasons. Written up in docs/audits/2026-11-08-nfl-outliers.md.

  node --import ./tools/audit/register.mjs tools/audit/nfl-audit.mjs --raw .nhl-data/audit/nfl --yards .nhl-data/audit/nfl-yards.json --check-to 9
  python3 -I tools/audit/nfl_outliers.py .nhl-data/audit/nfl-yards.json
"""
import json, sys
import numpy as np, pandas as pd

# lib/nfl/projections.js RESID (the shipped curves: (got − projection) / spread at 5% steps; receiving and receptions refitted
# with the target share on 2026-11-08)
RESID = {
 'rec_yds': [-1.17, -0.95, -0.817, -0.703, -0.588, -0.472, -0.358, -0.245, -0.115, -0.002, 0.116, 0.271, 0.425, 0.604, 0.803, 1.034, 1.353, 1.809, 2.484],
 'rush_yds': [-1.212, -0.91, -0.746, -0.644, -0.519, -0.4, -0.3, -0.213, -0.11, 0.0, 0.13, 0.271, 0.422, 0.558, 0.754, 1.037, 1.373, 1.923, 2.798],
 'receptions': [-1.481, -1.155, -0.97, -0.794, -0.655, -0.496, -0.374, -0.259, -0.156, -0.052, 0.088, 0.246, 0.399, 0.57, 0.755, 0.953, 1.254, 1.649, 2.317]}
SPEC = {'rec_yds': (40, 15, [15, 25, 35, 45, 60, 80, 200]), 'rush_yds': (40, 15, [15, 25, 35, 50, 70, 200]), 'receptions': (3, 1.5, [1.5, 2.5, 3.5, 4.5, 6, 12])}


def cdf(q, z):   # residCdf
    if z <= q[0]: return max(0.01, 0.05 - 0.05 * (q[0] - z) / max(1e-6, q[1] - q[0]))
    if z >= q[18]: return min(0.99, 0.95 + 0.05 * (z - q[18]) / max(1e-6, q[18] - q[17]))
    for i in range(18):
        if z <= q[i + 1]: return 0.05 * (i + 1) + 0.05 * (z - q[i]) / max(1e-6, q[i + 1] - q[i])
    return 0.95


def chance(proj, sd, mark, m): return 1 - cdf(RESID[m], (mark - 0.5 - proj) / sd)
def ll(p, y): p = np.clip(p, 1e-4, 1 - 1e-4); return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


r = pd.DataFrame(json.load(open(sys.argv[1] if len(sys.argv) > 1 else '.nhl-data/audit/nfl-yards.json')))
r['season'] = r.tag.str[:4].astype(int); r['week'] = r.tag.str.split('w').str[1].astype(int)
r = r[r.sd > 0]
fit_season = r.season.min()
for m, (add, fl, edges) in SPEC.items():
    x = r[(r.m == m) & (r.proj >= fl)].copy()
    x['k'] = np.maximum(np.ceil(2 * x.proj - 1e-9), np.ceil(x.proj + add - 1e-9)).astype(int)
    x['y'] = (x.actual >= x.k).astype(int)
    x['own'] = [chance(p, s, k, m) for p, s, k in zip(x.proj, x.sd, x.k)]
    F = x[x.season == fit_season]
    e, lc = np.polyfit(np.log(F.proj), np.log(F.sd), 1); c = float(np.exp(lc))
    x['typical'] = [chance(p, c * p ** e, k, m) for p, k in zip(x.proj, x.k)]
    x['half'] = (x.own + x.typical) / 2
    print(f'\n## {m}: +{add} (projected {fl}+); the usual spread {c:.3f} · projection^{e:.3f}')
    x['band'] = pd.cut(x.proj, edges, right=False)
    print(x.groupby(['band', 'season'], observed=True).agg(n=('y', 'size'), said=('own', 'mean'), landed=('y', 'mean')).unstack().round(3).to_string())
    for season, g in x.groupby('season'):
        line = f'{season}: base {100 * g.y.mean():.1f}%'
        for col in ('own', 'typical', 'half'):
            t = g.groupby('week', group_keys=False).apply(lambda d: d.nlargest(10, col))
            line += f' | {col}: log loss {1000 * ll(g[col], g.y):.1f}, the week top ten said {100 * t[col].mean():.1f} landed {100 * t.y.mean():.1f}'
        print(line)

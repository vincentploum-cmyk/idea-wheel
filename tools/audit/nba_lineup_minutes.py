"""His minutes from tonight's starting five (Vincent, 2026-11-07: "can we predict player's minutes based on lineups?").

Every rotation player-game (his last ten at 8+ minutes) of ESPN's box scores (`nba-box-fetch.mjs`), with what he did before it:
`dec` his minutes this season decayed at 3 games (his last ten before his first game), `split` his average in tonight's role
(as a starter or off the bench) over his last 40 games shrunk toward `dec` at 3, his starts over his last ten (`share`), the
starters as tonight's five (`promoted` = in it from under half, `demoted` = out of it from half or more), and `vac` the minutes
the teammates out leave (`nba_stat_drivers.py`'s `min_vac`: run it once for stat-drivers-rows.pkl). Least squares with and
without the five, fitted on the first season, scored on the rest; the coefficients are LINEUP_MINUTES in lib/nba/picks.js.

  python3 -I tools/audit/nba_lineup_minutes.py --box .nhl-data/audit/nba-box --fit 2026
"""
import argparse, glob, json, os, pickle
import numpy as np, pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument('--box', required=True)
ap.add_argument('--fit', type=int, default=2026, help="ESPN's season label of the fit season (2026 = 2025-26)")
args = ap.parse_args()


def num(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0


rows = []
for f in glob.glob(os.path.join(args.box, '[0-9]*', '*.json')):
    j = json.load(open(f)); h = j['header']; season = int(h['season']['year'])
    for t in j['boxscore'].get('players', []):
        s = (t.get('statistics') or [None])[0]
        if not s: continue
        for a in s.get('athletes', []):
            ath = a.get('athlete') or {}; v = a.get('stats') or []
            if not ath.get('id') or a.get('didNotPlay') or not v: continue
            m = num(v[0])
            if m > 0: rows.append((str(ath['id']), str(h['id']), j['date'], season, int(bool(a.get('starter'))), m))
bx = pd.DataFrame(rows, columns=['pid', 'gid', 'date', 'season', 'st', 'min']).sort_values(['pid', 'date', 'gid']).reset_index(drop=True)

out = []
for pid, g in bx.groupby('pid', sort=False):
    M = g['min'].values; S = g.st.values; Se = g.season.values
    for i in range(5, len(g)):
        lo = max(0, i - 40); m = M[lo:i]; st = S[lo:i]; ms = m[Se[lo:i] == Se[i]]
        if len(ms):
            w = 0.5 ** (np.arange(len(ms))[::-1] / 3); dec = (ms * w).sum() / w.sum()
        else: dec = m[-10:].mean()
        share = st[-10:].mean()
        inRole = m[st == 1] if S[i] == 1 else m[st == 0]
        out.append(dict(pid=pid, gid=g.gid.values[i], season=Se[i], act=M[i], stT=S[i], dec=dec, l10=m[-10:].mean(),
                        split=(inRole.sum() + 3 * dec) / (len(inRole) + 3),
                        promoted=float(S[i] == 1 and share < 0.5), demoted=float(S[i] == 0 and share >= 0.5)))
d = pd.DataFrame(out)
drv, _ = pickle.load(open(os.path.join(args.box, 'stat-drivers-rows.pkl'), 'rb'))
d = d.merge(drv[['gid', 'id', 'min_vac']].rename(columns={'id': 'pid'}), on=['gid', 'pid'], how='left')
d['vac'] = np.expm1(d.min_vac.fillna(0)) * 240
d = d[d.l10 >= 8]

L = ['dec', 'split', 'stT', 'promoted', 'demoted', 'vac']; N = ['dec', 'vac']
X = lambda x, c: np.column_stack([np.ones(len(x))] + [x[k].astype(float) for k in c])
fit = d[d.season == args.fit]
bL = np.linalg.lstsq(X(fit, L), fit.act, rcond=None)[0]; bN = np.linalg.lstsq(X(fit, N), fit.act, rcond=None)[0]
print('with the five:', {k: round(float(v), 4) for k, v in zip(['a'] + L, bL)})
print('without:', {k: round(float(v), 4) for k, v in zip(['a'] + N, bN)})
for season, x in d.groupby('season'):
    if season < args.fit: continue
    pL = X(x, L) @ bL; pN = X(x, N) @ bN
    line = f'{season}{" (fit)" if season == args.fit else ""}: n {len(x)}, miss without {np.abs(pN - x.act).mean():.2f}, with {np.abs(pL - x.act).mean():.2f}'
    for r in ('promoted', 'demoted'):
        k = x[r] == 1
        line += f' | {r} {pN[k].mean():.1f} → {pL[k].mean():.1f} (played {x.act[k].mean():.1f}, ratio {np.clip(pL[k] / np.maximum(pN[k], 1), 0.6, 1.6).mean():.3f})'
    print(line)

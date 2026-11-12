"""Shots and goals environment: which of the defense table's columns (Shots/G, ICF/G, IFF/G, ISCF/G, Goals/G allowed to
the position) predict a skater's shots on goal and goals, and how much each should weigh in the rink's combined read.

Every skater-game (8+ games into his season) from the games fetch.mjs pulled (relabelled to the position played,
relabel.py, so the positions match PropFinder's table), oldest season first. Each defending team's total allowed to a
position a game over its last 10 games (5 at least, this season only: PropFinder's L10 tab, the one the rink opens on),
or its season to date, as of the morning of the game, ranked across the league (rank 1 = allows the most).

His own rate = 0.6 x his season + 0.4 x his last ten, before the date (soft_spots.py): shots for the shots market
(0.5+ a game), goals for the goals market (floored at 0.02). Each read enters a Poisson GLM with that rate as the
offset, so only what the environment adds over his own rate counts:
  - shots: each of Shots/G, ICF/G, IFF/G, ISCF/G alone (as its rank, the rink's read, and as its value over the league's
    mean that morning), the plain mean of the four ranks (the rink since 2026-11-12) and the fitted weights;
  - goals: Goals/G alone, ISCF/G alone, the two ranks' mean, their fitted weights, and Shots/G added for reference;
scored by 5-fold cross-validation grouped by date (deviance gain over the rate alone, per 1,000 skater-games, with a
bootstrap over dates), plus the 3+ SOG / 1+ goal hit rate against the Poisson expectation when each read puts the
opponent in the soft / tough third. docs/audits/2026-11-12-nhl-shots-environment.md.

Usage: python3 -I tools/predictors/shots_env.py <games dir> [<games dir> ...]   (oldest season first)
"""
import glob
import json
import os
import sys

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats

COLS = ['sog', 'icf', 'iff', 'iscf', 'g']
SHOT_COLS = ['sog', 'icf', 'iff', 'iscf']
NAME = {'sog': 'Shots/G', 'icf': 'ICF/G', 'iff': 'IFF/G', 'iscf': 'ISCF/G', 'g': 'Goals/G'}
rng = np.random.default_rng(7)

rows = []
for d in sys.argv[1:]:
    for f in sorted(glob.glob(os.path.join(d, '*.json'))):
        for g in json.load(open(f))['games']:
            if g.get('gameType') != 2:
                continue
            y, m = int(g['date'][:4]), int(g['date'][5:7])
            season = y if m >= 8 else y - 1
            for s in g['skaters']:
                pos = {'L': 'LW', 'R': 'RW'}.get(s['pos'], s['pos'])
                rows.append((g['date'], season, g['id'], s['id'], s['team'], s['opp'], pos, *(s.get(k) or 0 for k in COLS)))
S = pd.DataFrame(rows, columns=['date', 'season', 'gid', 'pid', 'team', 'opp', 'pos', *COLS]).sort_values(['date', 'gid']).reset_index(drop=True)
S['date'] = pd.to_datetime(S['date'])
grp = S.groupby(['pid', 'season'])
S['n'] = grp.cumcount()
for k in ['sog', 'g']:
    sh = grp[k].shift(1).groupby([S.pid, S.season])
    S[f'rate_{k}'] = 0.6 * sh.transform(lambda s: s.expanding().mean()) + 0.4 * sh.transform(lambda s: s.rolling(10, min_periods=1).mean())

# Each defending team's totals allowed to a position a game; its last ten (5+) and its season to date after each game.
P = S.groupby(['season', 'date', 'gid', 'opp', 'pos'])[COLS].sum().reset_index().sort_values(['date', 'gid'])
gp = P.groupby(['season', 'opp', 'pos'])
for k in COLS:
    P[f'{k}_l10'] = gp[k].transform(lambda s: s.rolling(10, min_periods=5).mean())
    P[f'{k}_std'] = gp[k].transform(lambda s: s.expanding(min_periods=5).mean())


def morning_reads(win):
    """Every team's read at each position on the morning of each game date (the last value from a game before it), ranked."""
    out = []
    for (season, pos), pg in P.groupby(['season', 'pos']):
        dates = pd.DataFrame({'date': sorted(S.loc[(S.season == season), 'date'].unique())})
        teams = []
        for opp, tg in pg.groupby('opp'):
            tg = tg[['date', *[f'{k}_{win}' for k in COLS]]].dropna().sort_values('date')
            if tg.empty:
                continue
            m = pd.merge_asof(dates, tg, on='date', allow_exact_matches=False).dropna()
            m['opp'] = opp
            teams.append(m)
        if not teams:
            continue
        T = pd.concat(teams)
        T['season'], T['pos'] = season, pos
        for k in COLS:
            v = T[f'{k}_{win}']
            T[f'r_{k}'] = v.groupby(T.date).rank(ascending=False, method='min')
            T[f'x_{k}'] = v / v.groupby(T.date).transform('mean')
        T['teams'] = T.groupby('date').opp.transform('count')
        out.append(T)
    return pd.concat(out)


def cv_dev(df, y, off, feats, folds=5):
    """Out-of-fold Poisson deviance per row (offset = log of his own rate), folds grouped by date."""
    dates = df.date.unique()
    fold_of = dict(zip(dates, rng.permutation(len(dates)) % folds))
    fold = df.date.map(fold_of).values
    X = sm.add_constant(df[feats].values, has_constant='add') if feats else np.ones((len(df), 1))
    mu = np.empty(len(df))
    coefs = []
    for k in range(folds):
        tr, te = fold != k, fold == k
        fit = sm.GLM(y[tr], X[tr], family=sm.families.Poisson(), offset=off[tr]).fit()
        mu[te] = np.exp(X[te] @ fit.params + off[te])
        coefs.append(fit.params)
    with np.errstate(divide='ignore', invalid='ignore'):
        dev = 2 * (np.where(y > 0, y * np.log(y / mu), 0) - (y - mu))
    return dev, np.mean(coefs, axis=0)


def ladder(D, y, off, reads):
    base, _ = cv_dev(D, y, off, [])
    dates = D.date.values
    ud = np.unique(dates)
    idx = {d: np.where(dates == d)[0] for d in ud}
    cnt = np.array([len(idx[d]) for d in ud])
    print(f"{'read':<36}{'gain':>8}{'  95% CI':>18}   coefficients (per SD, + = softer)")
    fitted = {}
    for name, feats in reads:
        dev, coef = cv_dev(D, y, off, feats)
        diff = base - dev
        per = np.array([diff[idx[d]].sum() for d in ud])
        boots = [per[s].sum() / cnt[s].sum() * 1000 for s in (rng.integers(0, len(ud), len(ud)) for _ in range(400))]
        print(f'{name:<36}{diff.mean() * 1000:>8.3f}  [{np.percentile(boots, 2.5):>6.3f}, {np.percentile(boots, 97.5):>6.3f}]   {np.round(coef[1:], 3).tolist()}')
        fitted[name] = coef[1:]
    return fitted


def thirds(D, hit, exp, ratio, reads):
    for name, col in reads:
        third = np.ceil(D.teams / 3)
        band = np.where(D[col] <= third, 'soft', np.where(D[col] > D.teams - third, 'tough', 'mid'))
        parts = []
        for b in ['soft', 'mid', 'tough']:
            m = band == b
            parts.append(f'{b} {hit[m].mean() * 100:5.1f}% vs {exp[m].mean() * 100:5.1f}% (x{ratio[m].mean():.3f}, n {m.sum():,})')
        s, t = band == 'soft', band == 'tough'
        gap = (hit[s].mean() - exp[s].mean()) - (hit[t].mean() - exp[t].mean())
        print(f'  {name:<20}' + ' | '.join(parts) + f' | soft-tough gap {gap * 100:+.1f} pts')


def z(D, col):
    return -(D[col] - D[col].mean()) / D[col].std()  # higher = softer


def report(win, label, min_n=8):
    R = morning_reads(win)
    A = S[S.n >= min_n].merge(R, on=['season', 'date', 'opp', 'pos'], how='inner')
    A = A[A.teams >= 28].copy()
    for k in COLS:
        A[f'z_{k}'] = z(A, f'r_{k}')
        A[f'lx_{k}'] = np.log(A[f'x_{k}'].clip(lower=0.2))
    A['r_mean4'] = A[[f'r_{k}' for k in SHOT_COLS]].mean(axis=1)
    A['z_mean4'] = z(A, 'r_mean4')
    A['r_mean3'] = A[['r_sog', 'r_icf', 'r_iff']].mean(axis=1)
    A['z_mean3'] = z(A, 'r_mean3')
    A['r_w211'] = (2 * A.r_sog + A.r_icf + A.r_iff) / 4
    A['z_w211'] = z(A, 'r_w211')
    A['r_iscf_sog'] = A[['r_iscf', 'r_sog']].mean(axis=1)
    A['z_iscf_sog'] = z(A, 'r_iscf_sog')
    A['r_mean_g'] = A[['r_g', 'r_iscf']].mean(axis=1)
    A['z_mean_g'] = z(A, 'r_mean_g')

    # Shots.
    D = A.dropna(subset=['rate_sog'])
    D = D[D.rate_sog >= 0.5]
    print(f'\n=== SHOTS · {label}: {len(D):,} skater-games, {D.date.nunique()} dates, seasons {sorted(D.season.unique())} ===')
    print('\nThe ranks against each other (Spearman, on the skater-game rows):')
    print(D[[f'r_{k}' for k in COLS]].rename(columns=lambda c: NAME[c[2:]]).corr(method='spearman').round(2).to_string())
    print('\nDeviance gain on SOG over his own shot rate, per 1,000 skater-games (5-fold CV by date; 95% bootstrap over dates):')
    y, off = D.sog.values, np.log(D.rate_sog.values)
    reads = [(f'{NAME[k]} rank', [f'z_{k}']) for k in SHOT_COLS] + [(f'{NAME[k]} value', [f'lx_{k}']) for k in SHOT_COLS]
    reads += [('mean of Shots, ICF, IFF ranks', ['z_mean3']), ('Shots x2 + ICF + IFF ranks', ['z_w211']), ('mean of the four ranks (equal)', ['z_mean4']), ('four ranks, fitted weights', [f'z_{k}' for k in SHOT_COLS]),
              ('four values, fitted weights', [f'lx_{k}' for k in SHOT_COLS])]
    fitted = ladder(D, y, off, reads)
    w = np.clip(fitted['four ranks, fitted weights'], 0, None)
    if w.sum() > 0:
        print('Fitted rank weights, negatives floored at 0, as shares:', {NAME[k]: round(float(v), 2) for k, v in zip(SHOT_COLS, w / w.sum())})
    print('\n3+ SOG, landed vs expected from his own rate, by the read\'s third:')
    thirds(D, (D.sog >= 3).values, 1 - stats.poisson.cdf(2, D.rate_sog.values), (D.sog / D.rate_sog).values,
           [*[(NAME[k], f'r_{k}') for k in SHOT_COLS], ('mean of the four', 'r_mean4'), ('Shots, ICF, IFF', 'r_mean3'), ('Shots x2 + ICF + IFF', 'r_w211')])

    # Goals.
    D = A.dropna(subset=['rate_g']).copy()
    D['rate_gf'] = D.rate_g.clip(lower=0.02)
    print(f'\n=== GOALS · {label}: {len(D):,} skater-games ===')
    print('\nDeviance gain on goals over his own goal rate, per 1,000 skater-games (5-fold CV by date; 95% bootstrap over dates):')
    y, off = D.g.values, np.log(D.rate_gf.values)
    reads = [('Goals/G rank', ['z_g']), ('ISCF/G rank', ['z_iscf']), ('Goals/G value', ['lx_g']), ('ISCF/G value', ['lx_iscf']),
             ('mean of Goals + ISCF ranks (equal)', ['z_mean_g']), ('mean of ISCF + Shots ranks', ['z_iscf_sog']), ('Goals + ISCF ranks, fitted', ['z_g', 'z_iscf']),
             ('Goals + ISCF + Shots ranks, fitted', ['z_g', 'z_iscf', 'z_sog']), ('the four shot ranks, fitted', [f'z_{k}' for k in SHOT_COLS])]
    fitted = ladder(D, y, off, reads)
    w = np.clip(fitted['Goals + ISCF ranks, fitted'], 0, None)
    if w.sum() > 0:
        print('Fitted Goals / ISCF weights, negatives floored at 0, as shares:', {'Goals/G': round(float(w[0] / w.sum()), 2), 'ISCF/G': round(float(w[1] / w.sum()), 2)})
    print('\n1+ goal, landed vs expected from his own rate, by the read\'s third:')
    thirds(D, (D.g >= 1).values, 1 - np.exp(-D.rate_gf.values), (D.g / D.rate_gf).values,
           [('Goals/G', 'r_g'), ('ISCF/G', 'r_iscf'), ('mean Goals + ISCF', 'r_mean_g'), ('mean ISCF + Shots', 'r_iscf_sog')])


report('l10', "Last 10 games (PropFinder's L10, the rink's default tab)")
report('std', 'Season to date')

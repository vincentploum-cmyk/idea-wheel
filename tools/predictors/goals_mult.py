"""The model's goals cheat-sheet multiplier (cheatSheetMajorMultiplier in components/nhl/model-core.js, as
majorFactorProbabilityBlend applies it: boosts x0.9, penalties x0.4) replayed on shots_env.py's rows: per Goals/G and
ISCF/G rank step, what 1+ goal landed against his own rate, and the Brier with and without it.
Usage: python3 -I tools/predictors/goals_mult.py <games-pos dir> [...]   (run from the repo root)
"""
import sys
src = open('tools/predictors/shots_env.py').read()
src = src[:src.index("report('l10'")]
exec(src)

def mult(rg, ri, rs, pos):
    soft = lambda v, c=16: v <= c
    hard = lambda v, c=23: v >= c
    m = 1.0
    if rg <= 10: m += 0.18
    elif rg <= 16: m += 0.09
    if ri <= 10: m += 0.12
    if sum(soft(v) for v in (rg, ri, rs)) >= 2: m += 0.07
    if sum(hard(v) for v in (rg, ri, rs)) >= 2: m -= 0.18
    elif rg >= 24: m -= 0.12
    if pos == 'D': m *= 0.88
    return min(max(m, 0.74), 1.34)

def goal_rule_only(rg):
    return 1.18 if rg <= 10 else 1.09 if rg <= 16 else 0.88 if rg >= 24 else 1.0

for win, label in [('l10', 'last 10'), ('std', 'season to date')]:
    R = morning_reads(win)
    D = S[S.n >= 8].merge(R, on=['season', 'date', 'opp', 'pos']).dropna(subset=['rate_g'])
    D = D[D.teams >= 28].copy()
    D['lam'] = D.rate_g.clip(lower=0.02)
    D['exp1'] = 1 - np.exp(-D.lam)
    D['hit'] = (D.g >= 1).astype(int)
    # Calibrate the base: expected scaled so the whole set lands on its own average (the rate alone is biased low).
    k = D.hit.mean() / D.exp1.mean()
    D['base'] = D.exp1 * k
    print(f'\n=== {label}: {len(D):,} skater-games, 1+ goal {D.hit.mean()*100:.1f}% ===')
    print("The Goals/G rank alone (the model's +18% / +9% / -12% steps): landed vs his own rate")
    for lo, hi, said in [(1, 10, '+18% (x0.9 = +16%)'), (11, 16, '+9% (+8%)'), (17, 23, '0'), (24, 32, '-12% (x0.4 = -5%)')]:
        x = D[(D.r_g >= lo) & (D.r_g <= hi)]
        print(f'  Goals/G rank {lo:>2}-{hi:<2}: n {len(x):>6,}  landed {x.hit.mean()*100:5.2f}%  his rate says {x.base.mean()*100:5.2f}%  actual lift {(x.hit.mean()/x.base.mean()-1)*100:+5.1f}%   model adds {said}')
    print("ISCF/G rank, same steps for comparison:")
    for lo, hi in [(1, 10), (11, 16), (17, 23), (24, 32)]:
        x = D[(D.r_iscf >= lo) & (D.r_iscf <= hi)]
        print(f'  ISCF/G rank {lo:>2}-{hi:<2}: n {len(x):>6,}  landed {x.hit.mean()*100:5.2f}%  his rate says {x.base.mean()*100:5.2f}%  actual lift {(x.hit.mean()/x.base.mean()-1)*100:+5.1f}%')
    D['m'] = [mult(a, b, c, p) for a, b, c, p in zip(D.r_g, D.r_iscf, D.r_sog, D.pos)]
    # The model's blend: boost x0.9, penalty x0.4 (majorFactorProbabilityBlend), on the base chance.
    D['adj'] = np.where(D.m >= 1, 1 + 0.9 * (D.m - 1), 1 - 0.4 * (1 - D.m))
    print("The full goals multiplier (Goals, ISCF, Shots ranks; D x0.88), as the blend applies it:")
    D['band'] = pd.cut(D.adj, [0, 0.95, 0.999, 1.001, 1.10, 1.20, 1.40], labels=['<0.95', '0.95-1', '1.00', '1-1.10', '1.10-1.20', '>1.20'])
    for b, x in D.groupby('band', observed=True):
        print(f'  says x{b:<10} n {len(x):>6,}  mean x{x.adj.mean():.3f}  landed {x.hit.mean()*100:5.2f}%  rate {x.base.mean()*100:5.2f}%  actual x{x.hit.mean()/x.base.mean():.3f}')
    bs = lambda p: np.mean((D.hit - p.clip(0, 1)) ** 2)
    print(f'  Brier, 1+ goal: his rate {bs(D.base):.5f} · rate x the model\'s cheat multiplier {bs(D.base*D.adj):.5f} · rate x the Goals-rank step alone {bs(D.base*(1+0.9*(D.r_g.map(goal_rule_only)-1)).where(D.r_g<24, D.base*0.952)):.5f}')

# ── defenseGoalMultiplier (λ goals' opponent read), old composite vs ISCF ratio alone ──
# Values per game allowed to the position, season to date, over the league's mean that morning (the model's
# teamPos / defenseAvg, PropFinder's Season block), with the model's floors on the means. The published λ goals
# moves by 0.45 x defDamp of the multiplier's deviation (pointDefenseMult → λ points → λ goals); replayed at the
# low / average / elite pass-through (0.45 x 0.48 / 0.64 / 1.0).
print('\n=== defenseGoalMultiplier, season-to-date values ===')
R = morning_reads('std')
D = S[S.n >= 8].merge(R, on=['season', 'date', 'opp', 'pos']).dropna(subset=['rate_g'])
D = D[D.teams >= 28].copy()
D['hit'] = (D.g >= 1).astype(int)
mean_at = lambda k: D[f'{k}_std'] / D[f'x_{k}']   # the league's mean that morning
D = D[mean_at('g') > 0].copy()
gr = D.g_std / mean_at('g')
e = 1 - np.exp(-D.rate_g.clip(lower=0.02)); D['base'] = e * D.hit.mean() / e.mean()
ir = D.iscf_std / mean_at('iscf')
sr = D.sog_std / mean_at('sog')
old = pd.Series(np.where(D.pos == 'D', 0.35 * gr + 0.35 * ir + 0.3 * sr, 0.5 * gr + 0.3 * ir + 0.2 * sr), index=D.index).clip(0.82, 1.22)
new = ir.clip(0.82, 1.22)
bs = lambda p: np.mean((D.hit - p.clip(0, 1)) ** 2)
b0 = bs(D.base)
print(f'  his rate alone: Brier {b0:.5f}  (n {len(D):,}, NaN rows {int(old.isna().sum())})')
for t_name, t in [('low tier', 0.45 * 0.48), ('average', 0.45 * 0.64), ('elite', 0.45)]:
    for name, m in [('old: Goals 50 / ISCF 30 / Shots 20', old), ('new: ISCF ratio alone', new)]:
        p = D.base * (1 + t * (m - 1))
        print(f'  pass-through {t:.2f} ({t_name:<8}) {name:<36} Brier {bs(p):.5f} ({(bs(p) - b0) / b0 * 100:+.3f}%)')
print('  multiplier spread (10th-90th pct): old', np.percentile(old, [10, 90]).round(3), ' new', np.percentile(new, [10, 90]).round(3))

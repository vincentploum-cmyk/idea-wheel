"""How high does the hit rate go when only the very best picks of the night are taken? (Vincent, 2026-10-30, on the
backtests landing at 40-50%: "I don't buy that".) The reports so far graded wide groups (every pick over a bar, the top
ten a night), which land near the bar; this reads the top of the night, one pick at a time, on a whole season where
every rate has a few months behind it.

Per line (3+ / 4+ SOG, 1+ goal), every night graded with what was known that morning:
  - volume   Poisson at his shots (or goals) a game, season blended with his last ten, 10+ games in;
  - model    logistic regression + gradient-boosted trees on all the figures, retrained every week on every game before it;
  - truth    Poisson at his true rate over the season, this game left out (20+ other games): what a perfect read of the
             skater would say, the night's luck left over.
The top 1 / 2 / 3 / 5 a night, the calls in each band of the said chance (how many, how many landed), and the real season
hit rates of the league's best shooters and scorers (60+ games).

Usage: python3 -I tools/predictors/precision_curve.py <patterns.csv> --from YYYY-MM-DD [--retrain 7] [--out report.md]
"""
import sys, math, warnings
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
warnings.filterwarnings('ignore')

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {sys.argv[i][2:]: sys.argv[i + 1] for i in range(len(sys.argv) - 1) if sys.argv[i].startswith('--')}
d = pd.read_csv(args[0], low_memory=False)
d = d[d.gp >= 1].sort_values('date').reset_index(drop=True)
first = opt.get('from', d.date.iloc[0]); every = int(opt.get('retrain', 7))
META = {'date', 'gameId', 'playerId', 'name', 'team', 'opp', 'venue', 'slot', 'pos'}
FEATS = [c for c in d.columns if c not in META and not c.startswith('o_')]
X = d[FEATS].astype(float)
for p in ['C', 'LW', 'RW', 'D']: X[f'pos_{p}'] = (d.pos == p).astype(float)
days = sorted(x for x in d.date.unique() if x >= first)
test = d.date.isin(days).to_numpy()

out = []
def line(s=''): out.append(s)
def table(head, rows):
    line('| ' + ' | '.join(head) + ' |'); line('|' + '|'.join([' --- '] * len(head)) + '|')
    for r in rows: line('| ' + ' | '.join(str(x) for x in r) + ' |')
    line()
pct = lambda v: '—' if v is None or (isinstance(v, float) and np.isnan(v)) else f'{v * 100:.0f}%'
def tail(lam, at): return 1 - sum(np.exp(-lam) * lam ** k / math.factorial(k) for k in range(at))

def model(y):
    p = np.full(len(d), np.nan)
    for i in range(0, len(days), every):
        block = days[i:i + every]
        tr = (d.date < block[0]).to_numpy(); te = d.date.isin(block).to_numpy()
        if y[tr].sum() < 20: continue
        Xtr, Xte = X[tr], X[te]
        med = Xtr.median(); mu = Xtr.fillna(med).mean(); sd = Xtr.fillna(med).std().replace(0, 1)
        f = lambda Z: ((Z.fillna(med) - mu) / sd).clip(-6, 6).to_numpy()
        lr = LogisticRegression(C=0.05, max_iter=2000).fit(f(Xtr), y[tr]).predict_proba(f(Xte))[:, 1]
        gb = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=200, min_samples_leaf=40, l2_regularization=1.0, random_state=0).fit(Xtr.to_numpy(), y[tr]).predict_proba(Xte.to_numpy())[:, 1]
        p[te] = (lr + gb) / 2
    return p

def topk(score, y, k):
    hits = n = 0
    by_day = d.groupby('date').indices
    for day in days:
        idx = np.array([i for i in by_day[day] if not np.isnan(score[i])])
        if not len(idx): continue
        top = idx[np.argsort(-score[idx], kind='stable')[:k]]
        hits += int(y[top].sum()); n += len(top)
    return f'{pct(hits / n)} ({hits}/{n})' if n else '—'

line(f'# How high the top of the night goes: {days[0]} to {days[-1]}')
line()
line(f'{int(test.sum())} skater-games over {len(days)} nights, each graded with what was known that morning (the model retrained every {every} days on every game before).')
line()
for mk, stat, at, label in [('s3', 'sog', 3, '3+ SOG'), ('s4', 'sog', 4, '4+ SOG'), ('g1', 'g', 1, '1+ goal')]:
    y = d[f'o_y_{mk}'].to_numpy()
    base = 'sog' if stat == 'sog' else 'g'
    lam_v = (0.65 * d[f'{base}_avg'] + 0.35 * d[f'{base}_l10']).where(d.gp >= 10).to_numpy(dtype=float)
    vol = np.where(np.isnan(lam_v), np.nan, tail(np.nan_to_num(lam_v), at))
    s = d.groupby('playerId')[f'o_{stat}'].transform('sum'); n = d.groupby('playerId')[f'o_{stat}'].transform('count')
    lam_t = ((s - d[f'o_{stat}']) / (n - 1)).where(n - 1 >= 20).to_numpy(dtype=float)
    truth = np.where(np.isnan(lam_t), np.nan, tail(np.nan_to_num(lam_t), at))
    mdl = model(y)
    line(f'## {label} (base {pct(y[test].mean())})')
    line()
    line('**The best picks of the night**, the top 1 / 2 / 3 / 5 a night:')
    line()
    table(['Read', 'Top 1', 'Top 2', 'Top 3', 'Top 5'], [[name, *[topk(sc, y, k) for k in (1, 2, 3, 5)]] for name, sc in [('Volume (his rate)', vol), ('Model (all figures)', mdl), ('Truth (his true rate)', truth)]])
    bands = [(0.5, 0.6), (0.6, 0.7), (0.7, 0.8), (0.8, 1.01)] if stat == 'sog' and at == 3 else [(0.25, 0.35), (0.35, 0.45), (0.45, 0.55), (0.55, 1.01)]
    rows = []
    for name, sc in [('Volume (his rate)', vol), ('Model (all figures)', mdl), ('Truth (his true rate)', truth)]:
        cells = []
        for lo, hi in bands:
            m = test & (sc >= lo) & (sc < hi)
            cells.append(f'{pct(y[m].mean())} of {int(m.sum())} ({m.sum() / len(days):.1f}/night)' if m.sum() else '—')
        rows.append([name, *cells])
    line('**Said against landed**, by the chance each read gave:')
    line()
    table(['Read', *[f'{int(lo * 100)}–{min(100, int(hi * 100))}%' for lo, hi in bands]], rows)

# The league's best: real season hit rates.
line('## The league’s best, as they actually did (60+ games)')
line()
g = d.groupby(['playerId', 'name']).agg(gp=('o_sog', 'size'), sog=('o_sog', 'mean'), s3=('o_y_s3', 'mean'), s4=('o_y_s4', 'mean'), g=('o_g', 'mean'), g1=('o_y_g1', 'mean')).reset_index()
g = g[g.gp >= 60]
table(['Shooter', 'Games', 'Shots a game', '3+ SOG', '4+ SOG'], [[r['name'], int(r.gp), f'{r.sog:.2f}', pct(r.s3), pct(r.s4)] for _, r in g.sort_values('s3', ascending=False).head(12).iterrows()])
table(['Scorer', 'Games', 'Goals a game', 'Games with a goal'], [[r['name'], int(r.gp), f'{r.g:.2f}', pct(r.g1)] for _, r in g.sort_values('g1', ascending=False).head(12).iterrows()])
text = '\n'.join(out)
if opt.get('out'): open(opt['out'], 'w').write(text); print('written', opt['out'])
else: print(text)

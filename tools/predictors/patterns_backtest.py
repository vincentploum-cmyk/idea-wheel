"""The season backtest (Vincent, 2026-10-30: "did you backtest and improve / combine rules to get as close as possible to
100% for shots / goals?", then "just backtest it on all games of the 26/27 season"): every night of the season graded
with what was known that morning, every method side by side.

  - pills       the Patterns rules, re-mined every week on the weeks before it (patterns.py: searched on the first
                half of the games before the week, kept on the second half), read as the site reads them: the
                strongest held rule or tier a skater meets; a pick = held and over the line's bar;
  - model       logistic regression + gradient-boosted trees on all 239 figures, averaged, retrained every morning
                on every skater-game before it;
  - volume      his shots a game (shots lines) or chances a game (goals) this season, nothing else;
  - env+streak  Vincent's way: a skater on a run against an opponent that gives up a lot (several spellings, each
                half alone beside it);
  - hindsight   the ceiling no read can beat: Poisson at his true rate, his average over every game of the season but
                this one (future games in, 5 of them at least), so only the night's own luck is left.

Per line: the hit rate of each method's top 1 / 3 / 5 / 10 picks a night, of every pick it rates over 50 / 60 / 70%,
and of the filled pills; the env+streak table; how Vincent's slip of the night of `--slip` read.

Usage: python3 -I tools/predictors/patterns_backtest.py <patterns.csv> --from <first graded day> --work <dir> --out <report.md>
       [--slip YYYY-MM-DD:Name,Name,…]
"""
import sys, json, math, os, subprocess, warnings
from datetime import date, timedelta
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
warnings.filterwarnings('ignore')

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {sys.argv[i][2:]: sys.argv[i + 1] for i in range(len(sys.argv) - 1) if sys.argv[i].startswith('--')}
csv = args[0]; first = opt['from']; work = opt['work']; os.makedirs(work, exist_ok=True)
here = os.path.dirname(os.path.abspath(__file__))
d = pd.read_csv(csv, low_memory=False)
d = d[d.gp >= 1].sort_values('date').reset_index(drop=True)
META = {'date', 'gameId', 'playerId', 'name', 'team', 'opp', 'venue', 'slot', 'pos'}
FEATS = [c for c in d.columns if c not in META and not c.startswith('o_')]
X_all = d[FEATS].astype(float)
for p in ['C', 'LW', 'RW', 'D']: X_all[f'pos_{p}'] = (d.pos == p).astype(float)
all_days = sorted(d.date.unique())
days = [x for x in all_days if x >= first]
test = d.date.isin(days).to_numpy()
MARKS = [('s3', 'sog', 3, '3+ SOG'), ('s4', 'sog', 4, '4+ SOG'), ('s5', 'sog', 5, '5+ SOG'), ('s6', 'sog', 6, '6+ SOG'),
         ('g1', 'g', 1, '1+ goal'), ('g2', 'g', 2, '2+ goals')]

out = []
def line(s=''): out.append(s)
def table(head, rows):
    line('| ' + ' | '.join(head) + ' |'); line('|' + '|'.join([' --- '] * len(head)) + '|')
    for r in rows: line('| ' + ' | '.join(str(x) for x in r) + ' |')
    line()
pct = lambda v: '—' if v is None or (isinstance(v, float) and np.isnan(v)) else f'{v * 100:.0f}%'
def rate(y, m):
    n = int(m.sum())
    return f'{pct(y[m].mean())} ({int(y[m].sum())}/{n})' if n else '—'

# ---- the pills, re-mined every week on the weeks before it ----
def week_starts():
    d0 = date.fromisoformat(first); last = date.fromisoformat(all_days[-1])
    while d0 <= last: yield d0.isoformat(); d0 += timedelta(days=7)
rules_for = {}
for ws in week_starts():
    path = f'{work}/rules-before-{ws}.json'
    if not os.path.exists(path):
        before = d[d.date < ws]
        cut = before.date.iloc[len(before) // 2]   # searched on the first half of the games before the week, kept on the second
        sub = f'{work}/rows-before-{ws}.csv'; pd.read_csv(csv, low_memory=False).query('date < @ws').to_csv(sub, index=False)
        subprocess.run([sys.executable, '-I', f'{here}/patterns.py', sub, cut, '--out', f'{work}/patterns-before-{ws}.md', '--rules', path], check=True, capture_output=True)
    rules_for[ws] = json.load(open(path))
def week_of(day): return max(ws for ws in rules_for if ws <= day)
OPS = {'>=': np.greater_equal, '<=': np.less_equal}
def rule_mask(rule, rows):
    m = np.ones(len(rows), bool)
    for c in rule['when']:
        x = rows[c['f']]
        if isinstance(c['v'], str): m &= (x == c['v']).to_numpy(); continue
        xv = x.to_numpy(dtype=float)
        with np.errstate(invalid='ignore'): m &= (xv == c['v'] if c['op'] == '==' else OPS[c['op']](xv, c['v'])) & ~np.isnan(xv)
    return m
def pills(mk):
    p = np.full(len(d), np.nan); sel = np.zeros(len(d), bool)
    for ws, rules in rules_for.items():
        nxt = (date.fromisoformat(ws) + timedelta(days=7)).isoformat()
        rows = ((d.date >= ws) & (d.date < nxt)).to_numpy()
        m = rules['marks'][mk]; sub = d[rows]
        best = np.full(rows.sum(), m['base']); s = np.zeros(rows.sum(), bool)
        for r in m['rules']:
            mm = rule_mask(r, sub)
            best = np.where(mm & (r['rate'] > best), r['rate'], best)
            if r['held'] and r['rate'] >= m['bar']: s |= mm
        p[rows] = best; sel[rows] = s
    return p, sel

# ---- the models, retrained every morning ----
def model(y):
    p = np.full(len(d), np.nan)
    for day in days:
        tr = (d.date < day).to_numpy(); te = (d.date == day).to_numpy()
        Xtr, ytr, Xte = X_all[tr], y[tr], X_all[te]
        med = Xtr.median(); mu = Xtr.fillna(med).mean(); sd = Xtr.fillna(med).std().replace(0, 1)
        f = lambda X: ((X.fillna(med) - mu) / sd).clip(-6, 6).to_numpy()
        lr = LogisticRegression(C=0.05, max_iter=2000).fit(f(Xtr), ytr).predict_proba(f(Xte))[:, 1]
        gb = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=200, min_samples_leaf=40, l2_regularization=1.0, random_state=0).fit(Xtr.to_numpy(), ytr).predict_proba(Xte.to_numpy())[:, 1]
        p[te] = (lr + gb) / 2
    return p

# ---- hindsight: his true rate over the season, this game left out, five games at least ----
def hindsight(stat, at):
    s = d.groupby('playerId')[f'o_{stat}'].transform('sum'); n = d.groupby('playerId')[f'o_{stat}'].transform('count')
    lam = ((s - d[f'o_{stat}']) / (n - 1)).where(n - 1 >= 5).clip(lower=0.01).to_numpy()
    return np.where(np.isnan(lam), np.nan, 1 - sum(np.exp(-lam) * lam ** k / math.factorial(k) for k in range(at)))

def topk(score, y, k, rows=test):
    hits = n = 0
    for day in days:
        idx = np.where(rows & (d.date == day).to_numpy() & ~np.isnan(score))[0]
        if not len(idx): continue
        top = idx[np.argsort(-score[idx], kind='stable')[:k]]
        hits += int(y[top].sum()); n += len(top)
    return f'{pct(hits / n)} ({hits}/{n})' if n else '—'

n_days = len(days)
line(f'# The season backtest, NHL {all_days[0]} to {all_days[-1]}')
line()
line(f'Graded: every night from {days[0]} to {days[-1]} ({n_days} nights, {int(test.sum())} skater-games), each with what was known that morning: '
     f'the models retrained on every game before it, the Patterns rules re-mined every week on the weeks before it. The season’s first '
     f'{len([x for x in all_days if x < first])} nights ({int((~test).sum())} skater-games, every skater 0–3 games in) are graded only for the reads that need no training, '
     'the env+streak table. Hindsight = Poisson at his true rate over the whole season, his future games in: the ceiling.')
line()
SUMMARY_AT = len(out)
summary = []
scores_all = {}
for mk, stat, at, label in MARKS:
    y = d[f'o_y_{mk}'].to_numpy()
    p_pill, sel = pills(mk)
    p_model = model(y)
    vol = d['sog_avg' if stat == 'sog' else 'iscf_avg'].to_numpy(dtype=float)
    hs = hindsight(stat, at)
    scores_all[mk] = {'pills': p_pill, 'model': p_model}
    line(f'## {label}')
    line()
    line(f'Base rate on the graded nights {pct(y[test].mean())} ({int(y[test].sum())} of {int(test.sum())}). '
         f'The filled pills: {rate(y, sel & test)}, {(sel & test).sum() / n_days:.1f} a night.')
    line()
    rows = []
    for name, sc in [('Pills (the rules)', p_pill), ('Model (all figures)', p_model), ('Volume alone', vol), ('Hindsight ceiling', hs)]:
        rows.append([name, *[topk(sc, y, k) for k in (1, 3, 5, 10)]])
    line('**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):')
    line()
    table(['Method', 'Top 1', 'Top 3', 'Top 5', 'Top 10'], rows)
    rows = []
    for name, sc in [('Pills (the rules)', p_pill), ('Model (all figures)', p_model), ('Hindsight ceiling', hs)]:
        cells = []
        for t in (0.5, 0.6, 0.7):
            mm = test & (sc >= t)
            cells.append(f'{rate(y, mm)}, {mm.sum() / n_days:.1f}/night' if mm.sum() else '—')
        rows.append([name, *cells])
    line('**Every pick it rates at or over a chance:**')
    line()
    table(['Method', '≥ 50%', '≥ 60%', '≥ 70%'], rows)
    summary.append([label, pct(y[test].mean()), rate(y, sel & test), topk(p_pill, y, 1), topk(p_model, y, 1), topk(p_model, y, 3), topk(hs, y, 1), topk(hs, y, 3)])

# ---- Vincent's way: on a run, against an opponent that gives up a lot ----
line('## Environment + streak (every night of the season)')
line()
line('Each spelling of "on a run against a soft opponent", the run alone and the soft opponent alone beside it, every skater-game of the season '
     '(ranks: 1 = gives up the most, of the teams with games; soft = top 10). Hit rate (hits / picks) and picks a night.')
line()
alln = len(all_days)
def env_rows(y, specs):
    rows = []
    for name, run, env in specs:
        both = run & env
        rows.append([name, rate(y, both), f'{both.sum() / alln:.1f}', rate(y, run), rate(y, env)])
    return rows
g = lambda c: d[c].to_numpy(dtype=float)
with np.errstate(invalid='ignore'):
    soft_pos_g = g('opp_pos_g_rk') <= 10; soft_ga = g('opp_ga_rk') <= 10; soft_ga5 = g('opp_ga_l5_rk') <= 10
    soft_pos_s = g('opp_pos_sog_rk') <= 10; soft_sa5 = g('opp_sa_l5_rk') <= 10; soft_hd5 = g('opp_pos_ihdcf_l5_rk') <= 10
    fwd2 = (g('fwd') == 1) & (g('sog_avg') >= 2)
    goal_specs = [
        ('Goal last game · opponent top 10 in goals to his position', g('str_g') >= 1, soft_pos_g),
        ('Goal in 2 straight · opponent top 10 in goals to his position', g('str_g') >= 2, soft_pos_g),
        ('Point in 2+ straight · opponent top 10 in goals to his position', g('str_pt') >= 2, soft_pos_g),
        ('Point in 3+ straight · opponent top 10 in goals against', g('str_pt') >= 3, soft_ga),
        ('Goal or 2+ point run · opponent top 10 in goals against, last 5', (g('str_g') >= 1) | (g('str_pt') >= 2), soft_ga5),
        ('…and a forward with 2+ shots a game', ((g('str_g') >= 1) | (g('str_pt') >= 2)) & fwd2, soft_ga5),
        ('Point in 2+ straight, forward with 2+ shots a game · goals to his position top 10', (g('str_pt') >= 2) & fwd2, soft_pos_g),
    ]
    shot_specs = [
        ('3+ SOG in 2 straight · opponent top 10 in shots to his position', g('str_s3') >= 2, soft_pos_s),
        ('2+ SOG in 3 straight · opponent top 10 in shots against, last 5', g('str_s2') >= 3, soft_sa5),
        ('3+ SOG in 2 straight · top 10 in high-danger chances to his position, last 5', g('str_s3') >= 2, soft_hd5),
        ('…and 2.5+ shots a game', (g('str_s3') >= 2) & (g('sog_avg') >= 2.5), soft_hd5),
    ]
yg = d['o_y_g1'].to_numpy(); ys = d['o_y_s3'].to_numpy()
line(f'### 1+ goal (base {pct(yg.mean())})')
line()
table(['On a run · against', 'Both', 'A night', 'The run alone', 'The opponent alone'], env_rows(yg, goal_specs))
line(f'### 3+ SOG (base {pct(ys.mean())})')
line()
table(['On a run · against', 'Both', 'A night', 'The run alone', 'The opponent alone'], env_rows(ys, shot_specs))

# ---- the slip ----
if opt.get('slip'):
    day, names = opt['slip'].split(':'); names = names.split(',')
    line(f'## Vincent’s slip of {day}: 1+ goal')
    line()
    rows = []
    sc_p = scores_all['g1']['pills']; sc_m = scores_all['g1']['model']
    for nm in names:
        r = d[(d.date == day) & d.name.str.contains(nm, na=False)]
        if not len(r): rows.append([nm, 'not in the games of the night'] + [''] * 7); continue
        i = r.index[0]; x = d.loc[i]
        night = (d.date == day).to_numpy()
        rank = lambda sc: int((sc[night] > sc[i]).sum()) + 1 if not np.isnan(sc[i]) else None
        rows.append([x['name'], f'{x.team} vs {x.opp}' if x.venue == 'H' else f'{x.team} at {x.opp}', 'goal' if x.o_g >= 1 else f'no goal ({int(x.o_sog)} SOG)',
                     f'goal {int(x.str_g)} · point {int(x.str_pt)}', f'#{int(x.opp_pos_g_rk)}' if not pd.isna(x.opp_pos_g_rk) else '—', f'#{int(x.opp_ga_l5_rk)}' if not pd.isna(x.opp_ga_l5_rk) else '—',
                     f'{x.iscf_avg:.1f} · {x.sog_avg:.1f}', f'{pct(sc_p[i])} (#{rank(sc_p)})', f'{pct(sc_m[i])} (#{rank(sc_m)})'])
    table(['Skater', 'Game', 'Got', 'Runs in (goal · point)', 'Opp. goals to his position', 'Opp. GA last 5', 'Chances · shots a game', 'Pill 1+ G (rank on the night)', 'Model (rank)'], rows)

summ = ['## In short', '',
        '| Line | Base | Filled pills | Pills: top 1 a night | Model: top 1 | Model: top 3 | Ceiling: top 1 | Ceiling: top 3 |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |'] + ['| ' + ' | '.join(r) + ' |' for r in summary] + ['']
out[SUMMARY_AT:SUMMARY_AT] = summ
open(opt['out'], 'w').write('\n'.join(out))
print('written', opt['out'])

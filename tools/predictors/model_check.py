"""Does the model still work this season? (Vincent, 2026-10-30: "I have a model in place already. I want you to test it
whether the model still works on this season's games.") Reads the site's scorecard export — every stored game graded
against the newest run saved before its puck drop (`/api/nhl/data/scorecard?from=…&rows=1`, signed in) — and asks of
the model's own figures, the 3+ / 4+ / 5+ SOG and 1+ goal chances it publishes:

  - said against landed, by band of the chance it gave (a 60% call should land about 60%);
  - its confident calls (3+ SOG at 50 / 60 / 70 / 80%+, 4+ at 30 / 40 / 50%+, 5+ at 20 / 30%+, 1+ goal at 35 / 45 / 55%+):
    how many, what it said, how many landed;
  - its top picks a night (1 / 3 / 5) and the Best bets calls (`best` on the row);
  - week by week, so a model drifting off shows as a trend;
  - with a second export (last season), the same beside it: still working means landing as it did.

Usage: python3 -I tools/predictors/model_check.py <this season export.json> [--before <last season export.json>] [--out report.md]
"""
import sys, json
import numpy as np
import pandas as pd

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {sys.argv[i][2:]: sys.argv[i + 1] for i in range(len(sys.argv) - 1) if sys.argv[i].startswith('--')}
MARKETS = [('3+ SOG', 'p3s', 'sog', 3, [0.5, 0.6, 0.7, 0.8]), ('4+ SOG', 'p4s', 'sog', 4, [0.3, 0.4, 0.5]),
           ('5+ SOG', 'p5s', 'sog', 5, [0.2, 0.3]), ('1+ goal', 'p1g', 'g', 1, [0.35, 0.45, 0.55])]
BANDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.01]

def load(path):
    j = json.load(open(path))
    rows = pd.DataFrame(j.get('rows') or [])
    if rows.empty: sys.exit(f'{path}: no rows — export with ?rows=1')
    rows['week'] = pd.to_datetime(rows.date).dt.to_period('W-SUN').dt.start_time.dt.strftime('%b %d')
    return rows

cur = load(args[0]); prev = load(opt['before']) if opt.get('before') else None
out = []
def line(s=''): out.append(s)
def table(head, rows):
    line('| ' + ' | '.join(head) + ' |'); line('|' + '|'.join([' --- '] * len(head)) + '|')
    for r in rows: line('| ' + ' | '.join(str(x) for x in r) + ' |')
    line()
pct = lambda v: '—' if v is None or (isinstance(v, float) and np.isnan(v)) else f'{v * 100:.0f}%'
def cell(df, prob, stat, at, m):
    sub = df[m]
    if not len(sub): return '—'
    return f'said {pct(sub[prob].mean())} · landed {pct((sub[stat] >= at).mean())} ({int((sub[stat] >= at).sum())}/{len(sub)})'

seasons = [('This season', cur)] + ([('Last season', prev)] if prev is not None else [])
line(f'# Does the model still work? {cur.date.min()} to {cur.date.max()}')
line()
for name, df in seasons:
    line(f'- {name}: {df.date.min()} to {df.date.max()}, {df.game.nunique()} games, {len(df)} graded skater-games (the newest run saved before each puck drop).')
line()
for label, prob, stat, at, bars in MARKETS:
    line(f'## {label}')
    line()
    rows = []
    for name, df in seasons:
        df = df[df[prob].notna()]
        hit = (df[stat] >= at)
        brier = ((df[prob] - hit) ** 2).mean()
        rows.append([name, len(df), pct(df[prob].mean()), pct(hit.mean()), f'{brier:.4f}'])
    table(['', 'Calls', 'Said on average', 'Landed', 'Brier'], rows)
    line('**Said against landed, by the chance it gave:**')
    line()
    rows = []
    for lo, hi in zip(BANDS[:-1], BANDS[1:]):
        r = [f'{int(lo * 100)}–{min(100, int(hi * 100))}%']
        for name, df in seasons:
            df = df[df[prob].notna()]
            r.append(cell(df, prob, stat, at, (df[prob] >= lo) & (df[prob] < hi)))
        if any(c != '—' for c in r[1:]): rows.append(r)
    table(['Its chance', *[n for n, _ in seasons]], rows)
    line('**Its confident calls:**')
    line()
    rows = []
    for b in bars:
        r = [f'{int(b * 100)}%+']
        for name, df in seasons:
            df = df[df[prob].notna()]
            m = df[prob] >= b
            r.append(cell(df, prob, stat, at, m) + (f', {m.sum() / df.date.nunique():.1f} a night' if m.sum() else ''))
        rows.append(r)
    table(['Calls at', *[n for n, _ in seasons]], rows)
    rows = []
    for k in (1, 3, 5):
        r = [f'Top {k} a night']
        for name, df in seasons:
            df = df[df[prob].notna()]
            top = df.sort_values(prob, ascending=False).groupby('date').head(k)
            r.append(cell(top, prob, stat, at, np.ones(len(top), bool)))
        rows.append(r)
    table(['Its best picks', *[n for n, _ in seasons]], rows)
    df = cur[cur[prob].notna()]
    rows = []
    for wk, sub in df.groupby('week', sort=False):
        conf = sub[sub[prob] >= bars[0]]
        rows.append([wk, len(sub), pct(sub[prob].mean()), pct((sub[stat] >= at).mean()), cell(conf, prob, stat, at, np.ones(len(conf), bool))])
    line(f'**This season, week by week** (every call, and the calls at {int(bars[0] * 100)}%+):')
    line()
    table(['Week of', 'Calls', 'Said', 'Landed', f'At {int(bars[0] * 100)}%+'], rows)

line('## Best bets calls')
line()
rows = []
for name, df in seasons:
    b = df[df.best.notna()]
    for lab, sub in b.groupby('best'):
        mk = next((m for m in MARKETS if m[0].split()[0] in lab), None)
        if not mk: continue
        hit = sub[mk[2]] >= mk[3]
        rows.append([name, lab, len(sub), pct(sub.bestProb.mean()), f'{pct(hit.mean())} ({int(hit.sum())}/{len(sub)})'])
table(['', 'Call', 'Calls', 'Said', 'Landed'], rows)
text = '\n'.join(out)
if opt.get('out'): open(opt['out'], 'w').write(text); print('written', opt['out'])
else: print(text)

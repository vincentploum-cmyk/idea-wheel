"""The NBA board with two cocktails, side by side: tools/audit/nba-audit.mjs summaries (--tag -old / -site).
  python3 -I tools/audit/nba_ab.py <old summary.json> <new summary.json> [label]"""
import json, sys
a, b = json.load(open(sys.argv[1])), json.load(open(sys.argv[2])); label = sys.argv[3] if len(sys.argv) > 3 else ''
pct = lambda v: '—' if v is None else f'{100 * v:.1f}%'
f4 = lambda v: '—' if v is None else f'{v:.4f}'
f2 = lambda v: '—' if v is None else f'{v:.2f}'
def table(head, rows):
    print('| ' + ' | '.join(head) + ' |'); print('| ' + ' | '.join('---' for _ in head) + ' |')
    for r in rows: print('| ' + ' | '.join(str(x) for x in r) + ' |')
    print()
print(f'### {label}: {a["slates"]} slates, {a["games"]} games\n')
sc = lambda s: f'{s["n"]} · {pct(s["said"])} → {pct(s["hit"])} · {f4(s["brier"])}' if s and s.get('n') else '—'
table(['The plays (at the pseudo line): n · said → hit · Brier', 'old', 'new'], [['Every play', sc(a['all']), sc(b['all'])], ['On the tables', sc(a['board']), sc(b['board'])]] +
      [[f'Bucket {x["label"]}', sc(x['all']), sc(y['all'])] for x, y in zip(a['buckets'], b['buckets']) if x['all']['n'] or y['all']['n']] +
      [[f'Form: {x["label"]}', sc(x['all']), sc(y['all'])] for x, y in zip(a['forms'], b['forms'])])
rows = []
for x, y in zip(a['ladders'], b['ladders']):
    rows.append([x['label'], f4(x['blend']['brier']), f4(y['blend']['brier']), f4(x['main']['brier']), f4(y['main']['brier'])] + [f'{pct(bx["said"])} → {pct(bx["hit"])} / {pct(by["said"])} → {pct(by["hit"])}' for bx, by in zip(x['buckets'][5:], y['buckets'][5:])])
table(['Ladder', 'rung Brier old', 'new', 'main rung old', 'new', '60–70% old / new', '70–80%', '80%+'], rows)
rows = []
for x, y in zip(a['predictors'], b['predictors']):
    px = {p['key']: p for p in x.get('predictors') or x.get('each') or []}; py = {p['key']: p for p in y.get('predictors') or y.get('each') or []}
    rows.append([x['label'], f2(px['proj']['mae']), f2(py['proj']['mae']), f2(px['proj']['bias']), f2(py['proj']['bias']), f4(px['proj']['brier']), f4(py['proj']['brier']), px['proj']['n']])
table(['The projection against his figure', 'MAE old', 'new', 'bias old', 'new', 'over the pseudo line Brier old', 'new', 'n'], rows)

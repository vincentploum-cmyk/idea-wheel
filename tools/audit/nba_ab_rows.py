"""The board's projections side by side across cocktails, on the same player-games: nba-audit.mjs's -rows.csv (one row per
player, slate and market: `exp` the projection, `actual` what he did) and -summary.json (the ladder rungs' Brier per market).

  python3 -I tools/audit/nba_ab_rows.py .nhl-data/audit/ab4/nba-2026-11-02 site recipe [more tags …] [--label "This season"]

For each tag reads <prefix>-<tag>-rows.csv and -summary.json. Prints a markdown table: the average miss and the bias per stat,
for every projected player who played and for the rotation (his projected minutes or his last ten at 20+ minutes is not in the
rows, so the rotation here is the players whose own last ten of the stat's market had him at 15+ minutes: `ownL10` is the
stat; the population is the rows where `minBase` ≥ 15), only rows every tag has, then the rung Brier per market.
"""
import csv, json, sys, math
from collections import defaultdict

args = [a for a in sys.argv[1:]]
label = None
if '--label' in args:
    i = args.index('--label'); label = args[i + 1]; del args[i:i + 2]
prefix, tags = args[0], args[1:]
STATS = ['pts', 'reb', 'ast', 'tpm', 'pra']


def num(v):
    try:
        x = float(json.loads(v)) if v not in ('', '""') else None
        return x if x is None or math.isfinite(x) else None
    except Exception:
        return None


rows = {}
for t in tags:
    d = {}
    with open(f'{prefix}-{t}-rows.csv') as f:
        for r in csv.DictReader(f):
            if r['market'].strip('"') not in STATS or r['out'].strip('"') == 'true': continue
            exp, act = num(r['exp']), num(r['actual'])
            if exp is None or act is None: continue
            d[(r['slate'], r['key'], r['market'].strip('"'))] = (exp, act, num(r.get('minBase', '')) or num(r.get('actualMin', '')) or 0)
    rows[t] = d
common = set.intersection(*(set(d) for d in rows.values()))
print(f"### {label or prefix}\n")
print(f"Player-games graded on every variant: {len(common):,} (all markets). Average miss (bias).\n")
for pop, cond in (('every projected player who played', lambda m: True), ('rotation (15+ minutes behind his rate)', lambda m: m >= 15)):
    print(f"**{pop}**\n")
    print('| Variant | ' + ' | '.join(STATS) + ' |')
    print('| --- |' + ' --- |' * len(STATS))
    best = {}
    res = {}
    for t in tags:
        for s in STATS:
            ks = [k for k in common if k[2] == s and cond(rows[tags[0]][k][2])]
            e = [rows[t][k][0] - rows[t][k][1] for k in ks]
            res[(t, s)] = (sum(abs(x) for x in e) / len(e), sum(e) / len(e), len(e)) if e else (None, None, 0)
    for s in STATS:
        vals = [res[(t, s)][0] for t in tags if res[(t, s)][0] is not None]
        best[s] = min(vals) if vals else None
    for t in tags:
        cells = []
        for s in STATS:
            m, b, n = res[(t, s)]
            cells.append('—' if m is None else (f"**{m:.3f}**" if abs(m - best[s]) < 1e-9 else f"{m:.3f}") + f" ({b:+.2f})")
        print(f"| {t} | " + ' | '.join(cells) + ' |')
    print(f"\nRows per stat: " + ', '.join(f"{s} {res[(tags[0], s)][2]:,}" for s in STATS) + '\n')

# the ladder rungs: Brier per market (lower is better), from each summary
print('**The ladder rungs, Brier (lower is better)**\n')
lad = {}
for t in tags:
    S = json.load(open(f'{prefix}-{t}-summary.json'))
    for L in S.get('ladders', []):
        m = L.get('key') or L.get('market')
        if m in STATS: lad[(t, m)] = (L.get('blend') or {}).get('brier') if isinstance(L.get('blend'), dict) else L.get('brier')
print('| Variant | ' + ' | '.join(STATS) + ' |')
print('| --- |' + ' --- |' * len(STATS))
for t in tags:
    print(f"| {t} | " + ' | '.join('—' if lad.get((t, s)) is None else f"{lad[(t, s)]:.4f}" for s in STATS) + ' |')
print()

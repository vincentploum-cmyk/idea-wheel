"""The Patterns study: which combinations of a skater's own figures and tonight's environment lift his chance at each
line — 3+ / 4+ / 5+ / 6+ shots on goal, 1+ / 2+ / 3+ goals — mined on the season's first weeks and checked on the last
week, games the search never saw (Vincent, 2026-10-30: "look at literally every data point that is available to detect
patterns … rules per line … the outcome should be pills").

Reads the rows of patterns-rows.mjs (the site's own feature builder, lib/nhl-data/patterns-pure.js: his windows,
home / away split, streaks, the opponent's allowed to his position and slot by window, team totals, rest, head to head;
this season alone). Per line:

  1. every figure cut at its tenths (and at each value for counts and ranks), both ways: a condition. The opponent's
     reads at his position and slot enter against the league's there (×) and as ranks only: the raw figure sorts
     defensemen from forwards (a defenseman's table runs at two thirds of a forward's) before it sorts opponents;
  2. a beam search on the fit weeks: the best single conditions by the lower bound of their hit rate (one-sided 95%),
     each extended by a second and a third; a rule must fire for 12 skaters at least, so it is no one player's record;
  3. every condition earns its place: one whose removal costs the rule under two points over the whole window goes;
  4. a rule holds when it fires on enough of the check week, keeps half its lift there, and the week's own lower bound
     (one standard error) clears the week's base rate;
  5. the pill's starting figure: the fit weeks' lift cut by how much of it the search's rules kept on the check week
     (the retention, measured over every rule found, not just those that held), updated by the rule's own check-week
     record at 40 skater-games; the ladder (his shots a game by tier, 1–4 or 5+ games behind it) beside the rules,
     so every skater has a figure.

Also the reads asked for by name: the opponent's attempts / unblocked attempts / chances / shots allowed to his
position by window, his home / away split, his streaks — the hit rate across each one's fifths (within his position),
and the streaks by length inside his shot tier.

Usage: python3 -I tools/predictors/patterns.py <patterns.csv> <split YYYY-MM-DD> --out <report.md> --rules <rules.json>
"""
import sys, json, math, re
import numpy as np
import pandas as pd

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {sys.argv[i][2:]: sys.argv[i + 1] for i in range(len(sys.argv) - 1) if sys.argv[i].startswith('--')}
csv, split = args[0], args[1]
d = pd.read_csv(csv, low_memory=False)
d = d[d.gp >= 1].reset_index(drop=True)
fit = (d.date < split).to_numpy()
chk = ~fit
pid = d.playerId.to_numpy()

MARKS = [('s3', '3+ SOG', 0.50), ('s4', '4+ SOG', 0.33), ('s5', '5+ SOG', 0.20), ('s6', '6+ SOG', 0.11),
         ('g1', '1+ goal', 0.35), ('g2', '2+ goals', 0.09), ('g3', '3+ goals', 0.03)]
META = {'date', 'gameId', 'playerId', 'name', 'team', 'opp', 'venue', 'slot', 'pos'}
RAW_OPP = re.compile(r'^opp_pos_\w+?(_l5|_l10|_ven)?$|^opp_slot_(sog|icf|iscf|g)$')
FEATS = [c for c in d.columns if c not in META and not c.startswith('o_')]
MINE = [f for f in FEATS if not RAW_OPP.match(f)]
MIN_PLAYERS = 12; PRUNE = 0.02; M_CHECK = 40

out = []
def line(s=''): out.append(s)
def table(head, rows):
    line('| ' + ' | '.join(head) + ' |'); line('|' + '|'.join([' --- '] * len(head)) + '|')
    for r in rows: line('| ' + ' | '.join(str(x) for x in r) + ' |')
    line()
pct = lambda v: '—' if v is None or (isinstance(v, float) and np.isnan(v)) else f'{v * 100:.1f}%'
pts = lambda v: '—' if v is None or np.isnan(v) else f'{v * 100:+.1f}'

def lower(h, n, z=1.645):
    if n == 0: return 0.0
    p = h / n
    den = 1 + z * z / n
    return (p + z * z / (2 * n) - z * math.sqrt(max(0.0, p * (1 - p) / n + z * z / (4 * n * n)))) / den

# ---- conditions ----
conds = []   # (feature, op, value)
for f in MINE:
    x = d.loc[fit, f].dropna()
    if x.nunique() < 2: continue
    if x.nunique() <= 12:
        vals = sorted(x.unique())
        if set(vals) <= {0, 1}:
            conds += [(f, '==', 1.0), (f, '==', 0.0)]; continue
        for t in vals[1:]: conds.append((f, '>=', float(t)))
        for t in vals[:-1]: conds.append((f, '<=', float(t)))
    else:
        ths = sorted(set(np.round(np.quantile(x, np.arange(0.1, 0.95, 0.1)), 3)))
        for t in ths: conds += [(f, '>=', float(t)), (f, '<=', float(t))]
for p in ['C', 'LW', 'RW', 'D']: conds.append(('pos', '==', p))

def mask_of(df, c):
    f, op, v = c
    if op == '==': return (df[f] == v).to_numpy()
    xv = df[f].to_numpy(dtype=float)
    with np.errstate(invalid='ignore'):
        m = xv >= v if op == '>=' else xv <= v
    return m & ~np.isnan(xv)

C = np.column_stack([mask_of(d, c) for c in conds])
feat_of = np.array([c[0] for c in conds])
Cf = C[fit].astype(np.float32)
print(f'{len(d)} rows ({fit.sum()} fit, {chk.sum()} check), {len(FEATS)} figures ({len(MINE)} mined), {len(conds)} conditions', file=sys.stderr)

def cond_text(c):
    f, op, v = c
    if op == '==' and isinstance(v, str): return f'{f} = {v}'
    return f'{f} {"≥" if op == ">=" else "≤" if op == "<=" else "="} {v:g}'
rule_text = lambda key: ' · '.join(cond_text(conds[i]) for i in key)
players_in = lambda m: len(np.unique(pid[m]))

def search(yf, min_hits, min_n, beam=40, depth=3):
    """Beam search on the fit rows: rules (tuples of condition indices) by the lower bound of their rate."""
    yv = yf.astype(np.float32); pf = pid[fit]
    found = set()
    n1 = Cf.sum(0); h1 = yv @ Cf
    score = np.array([lower(h, n) if h >= min_hits and n >= min_n else -1 for h, n in zip(h1, n1)])
    level = []
    for i in np.argsort(-score):
        if score[i] <= 0 or len(level) >= beam: break
        m = Cf[:, i] > 0
        if len(np.unique(pf[m])) < MIN_PLAYERS: continue
        level.append(((int(i),), m)); found.add((int(i),))
    for _ in range(depth - 1):
        nxt = []
        for r, m in level:
            mf = m.astype(np.float32)
            n2 = mf @ Cf; h2 = (mf * yv) @ Cf
            used = set(feat_of[list(r)])
            sc = np.where((n2 >= min_n) & (h2 >= min_hits), h2 / np.maximum(n2, 1), -1)
            for i in np.argsort(-sc)[:300]:
                if sc[i] <= 0 or feat_of[i] in used: continue
                key = tuple(sorted(r + (int(i),)))
                if key in found: continue
                nxt.append((lower(h2[i], n2[i]), key, m & (Cf[:, i] > 0)))
        nxt.sort(key=lambda t: -t[0])
        level = []; seen = set()
        for s, key, m in nxt:
            sig = m.tobytes()
            if sig in seen or len(np.unique(pf[m])) < MIN_PLAYERS: continue
            seen.add(sig); level.append((key, m)); found.add(key)
            if len(level) >= beam: break
    return found

rules_json = {'builtThrough': str(d.date.max()), 'fit': [str(d.date.min()), str(d.date[fit].max())], 'check': [split, str(d.date.max())], 'rows': int(len(d)), 'marks': {}}
line(f'# Patterns: what fires each line, {d.date.min()} to {d.date.max()}')
line()
line(f'{len(d)} skater-games, {len(FEATS)} figures each ({len(MINE)} searched: the opponent’s reads at his position and slot as × the league’s and as ranks), '
     f'cut into {len(conds)} conditions. Rules searched on {d.date.min()} to {d.date[fit].max()} ({fit.sum()} skater-games) and checked on {split} to '
     f'{d.date.max()} ({chk.sum()} skater-games the search never saw).')
line()
SUMMARY_AT = len(out)

summary = []; kept_all = {}
for mk, label, bar in MARKS:
    y = d[f'o_y_{mk}'].to_numpy()
    yf, yc = y[fit], y[chk]
    base_f, base_c, base = yf.mean(), yc.mean(), y.mean()
    min_hits = 10 if yf.sum() >= 80 else 5
    min_n = max(60, int(math.ceil(10 / max(base_f, 1e-3))))
    need = max(10, int(math.ceil(1 / max(base_c, 1e-3))))
    cache = {}
    def stats(key):
        if key in cache: return cache[key]
        m = np.logical_and.reduce([C[:, i] for i in key]) if key else np.ones(len(d), bool)
        mf_, mc_ = m[fit], m[chk]
        s = dict(key=key, mask=m, n=int(mf_.sum()), h=int(yf[mf_].sum()), nc=int(mc_.sum()), hc=int(yc[mc_].sum()), na=int(m.sum()), ha=int(y[m].sum()),
                 players=players_in(m & fit))
        s['rf'] = s['h'] / s['n'] if s['n'] else float('nan'); s['rc'] = s['hc'] / s['nc'] if s['nc'] else float('nan'); s['ra'] = s['ha'] / s['na'] if s['na'] else float('nan')
        cache[key] = s; return s
    def prune(key):
        key = tuple(key)
        while len(key) > 1:
            full = stats(key)['ra']
            best = max(((stats(tuple(j for j in key if j != i))['ra'], i) for i in key), key=lambda t: t[0])
            if best[0] >= full - PRUNE: key = tuple(j for j in key if j != best[1])
            else: break
        return key
    found = search(yf, min_hits, min_n) if yf.sum() >= 20 else set()
    pruned = {prune(k) for k in found}
    cands = [stats(k) for k in pruned]
    cands = [c for c in cands if c['n'] >= min_n and c['players'] >= MIN_PLAYERS]
    # How much of the fit weeks' lift the search's rules kept on the check week, over every rule found.
    num_ = sum(c['nc'] * (c['rc'] - base_c) for c in cands if c['nc']); den_ = sum(c['nc'] * (c['rf'] - base_f) for c in cands if c['nc'])
    R = float(min(1.0, max(0.0, num_ / den_))) if den_ > 0 else 0.0
    for c in cands:
        lift_f = c['rf'] / base_f; lift_c = c['rc'] / base_c if c['nc'] else float('nan')
        c['held'] = bool(c['nc'] >= need and not np.isnan(lift_c) and lift_f > 1.15 and lift_c >= 1 + 0.5 * (lift_f - 1) and lower(c['hc'], c['nc'], 1.0) > base_c)
        prior = base + R * (c['rf'] - base_f)
        c['start'] = (c['hc'] + M_CHECK * prior) / (c['nc'] + M_CHECK)
        c['score'] = lower(c['h'], c['n'])
    held = [c for c in cands if c['held']]
    keep = []
    for c in sorted(held, key=lambda c: -c['start']):
        if any((c['mask'] & k['mask']).sum() / max(1, (c['mask'] | k['mask']).sum()) > 0.8 for k in keep): continue
        keep.append(c)
        if len(keep) >= 15: break
    kept_all[mk] = keep
    # The ladder: his shots a game by tier, 1–4 or 5+ games behind it.
    tiers = []
    edges = [0, 1, 1.5, 2, 2.5, 3, 3.5, 99]
    for a, b in zip(edges[:-1], edges[1:]):
        for g_lo, g_hi in ((1, 4), (5, 999)):
            m = ((d.sog_avg >= a) & (d.sog_avg < b) & (d.gp >= g_lo) & (d.gp <= g_hi)).to_numpy()
            if m.sum() < 15: continue
            rf = yf[m[fit]].mean() if m[fit].sum() else float('nan'); rc = yc[m[chk]].mean() if m[chk].sum() else float('nan')
            tiers.append(dict(a=a, b=b, g=(g_lo, g_hi), n=int(m.sum()), h=int(y[m].sum()), rate=y[m].mean(), nf=int(m[fit].sum()), hf=int(yf[m[fit]].sum()), rf=rf,
                              nc=int(m[chk].sum()), hcc=int(yc[m[chk]].sum()), rc=rc, held=bool(m[chk].sum() >= 15 and not np.isnan(rc) and abs(rc - rf) <= max(0.08, 0.5 * rf))))
    # ---- the report ----
    line(f'## {label}')
    line()
    line(f'Base rate {pct(base)} ({int(y.sum())} of {len(y)}); fit weeks {pct(base_f)}, check week {pct(base_c)}. The bar a pill must clear to be filled: {pct(bar)} '
         f'(about the price a book usually asks for the line). {len(cands)} rules found on the fit weeks ({min_hits}+ hits on {min_n}+ games, {MIN_PLAYERS}+ skaters, '
         f'every condition worth two points); the check week kept **{R * 100:.0f}% of their lift**; **{len(held)} held**, {len(keep)} kept after near-duplicates.')
    line()
    if keep:
        line('**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the '
             'fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.')
        line()
        rows = []
        for c in keep:
            parts = []
            for i in c['key']:
                if len(c['key']) == 1: break
                without = stats(tuple(j for j in c['key'] if j != i))
                parts.append(f'{cond_text(conds[i])} {pts(c["ra"] - without["ra"])}')
            rows.append([rule_text(c['key']), c['players'], c['n'], pct(c['rf']), c['nc'], pct(c['rc']), '; '.join(parts) or '—', pct(c['start']), '✓' if c['start'] >= bar else ''])
        table(['When', 'Skaters', 'Fit: games', 'Fit: hit', 'Check: games', 'Check: hit', 'Each part adds (pts)', 'Pill starts at', 'Fills'], rows)
    fell = sorted([c for c in cands if not c['held']], key=lambda c: -c['score'])[:6]
    if fell:
        line('**The strongest on the fit weeks that did not hold** (noise the search found):')
        line()
        table(['When', 'Skaters', 'Fit: games', 'Fit: hit', 'Check: games', 'Check: hit'], [[rule_text(c['key']), c['players'], c['n'], pct(c['rf']), c['nc'], pct(c['rc'])] for c in fell])
    line('**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):')
    line()
    table(['Shots a game', 'Games behind', 'Skater-games', 'Hit', 'Fit', 'Check', 'Held'],
          [[f'{t["a"]:g}–{t["b"]:g}' if t['b'] < 99 else f'{t["a"]:g}+', '1–4' if t['g'][0] == 1 else '5+', t['n'], pct(t['rate']), pct(t['rf']), pct(t['rc']), '✓' if t['held'] else ''] for t in tiers])
    # ---- for the site ----
    def jcond(i):
        f, op, v = conds[i]
        return {'f': f, 'op': op, 'v': v if isinstance(v, str) else round(float(v), 3)}
    rules = []
    for j, c in enumerate(keep):
        rules.append({'id': f'{mk}-r{j + 1}', 'kind': 'rule', 'when': [jcond(i) for i in c['key']], 'rate': round(float(c['start']), 4), 'players': c['players'],
                      'fit': {'n': c['n'], 'hits': c['h']}, 'check': {'n': c['nc'], 'hits': c['hc']}, 'held': True})
    for t in tiers:
        when = [{'f': 'sog_avg', 'op': '>=', 'v': t['a']}] + ([{'f': 'sog_avg', 'op': '<=', 'v': round(t['b'] - 0.001, 3)}] if t['b'] < 99 else [])
        when += [{'f': 'gp', 'op': '>=', 'v': t['g'][0]}] + ([{'f': 'gp', 'op': '<=', 'v': t['g'][1]}] if t['g'][1] < 999 else [])
        rules.append({'id': f'{mk}-t{t["a"]:g}-{t["g"][0]}', 'kind': 'tier', 'when': when, 'rate': round(float(t['rate']), 4),
                      'fit': {'n': t['nf'], 'hits': t['hf']}, 'check': {'n': t['nc'], 'hits': t['hcc']}, 'held': t['held']})
    rules_json['marks'][mk] = {'label': label, 'bar': bar, 'base': round(float(base), 4), 'retention': round(R, 3), 'rules': rules}
    fills = [c for c in keep if c['start'] >= bar]
    top = keep[0] if keep else None
    summary.append([label, pct(base), len(cands), f'{R * 100:.0f}%', len(held), len(keep), len(fills),
                    f'{rule_text(top["key"])} (fit {pct(top["rf"])} on {top["n"]}, check {pct(top["rc"])} on {top["nc"]}; pill {pct(top["start"])})' if top else '—'])

# ---- the reads asked for by name ----
line('## The environment, his venue, his streaks: each read across its fifths')
line()
line('The hit rate in the bottom and top fifth of each read, the fifths taken within his position (a defenseman against defensemen; a slot read within the slot), overall and among skaters '
     'with 2+ shots a game this season, where the lines are bet; fit weeks and check week apart. The opponent’s reads are what it gives up per skater at his position, by window.')
line()
reads = [f for f in FEATS if f.startswith(('opp_pos_', 'opp_slot_', 'opp_sa', 'opp_ca', 'opp_fa', 'opp_sca', 'opp_hdca', 'opp_ga', 'ven_', 'team_', 'pace', 'opp_sf'))
         and not f.endswith('_rk') and f not in ('opp_slot_n', 'ven_n')]
vol = (d.sog_avg >= 2).to_numpy()
for mk, label in [('s3', '3+ SOG'), ('s4', '4+ SOG'), ('s5', '5+ SOG'), ('g1', '1+ goal'), ('g2', '2+ goals')]:
    y = d[f'o_y_{mk}'].to_numpy()
    rows = []
    for f in reads:
        x = d[f]
        if x.notna().sum() < 300 or x.nunique() < 5: continue
        q = x.groupby(d.slot if f.startswith('opp_slot_') else d.pos).rank(pct=True, method='first').to_numpy()   # a slot read against the same slot
        lo, hi = q <= 0.2, q > 0.8
        cell = lambda m: f'{pct(y[m].mean())} ({int(m.sum())})' if m.sum() >= 20 else '—'
        sv = y[hi & vol].mean() - y[lo & vol].mean() if (hi & vol).sum() >= 20 and (lo & vol).sum() >= 20 else 0
        rows.append((abs(sv), f, cell(lo), cell(hi), cell(lo & vol), cell(hi & vol), cell(lo & vol & fit), cell(hi & vol & fit), cell(lo & vol & chk), cell(hi & vol & chk)))
    rows.sort(key=lambda r: -r[0])
    line(f'### {label}, the 25 reads that split the 2+ shots-a-game skaters most')
    line()
    table(['Read', 'Bottom fifth', 'Top fifth', 'Bottom, 2+ SOG a game', 'Top, 2+ SOG a game', 'Bottom (fit)', 'Top (fit)', 'Bottom (check)', 'Top (check)'], [r[1:] for r in rows[:25]])

line('## Streaks, inside his shot tier')
line()
line('A 3+ SOG streak mostly marks a high-volume shooter, so each streak is read inside his shots-a-game tier this season: the hit rate by the length of the run he came in on.')
line()
tier = pd.cut(d.sog_avg, [0, 2, 3, 99], right=False, labels=['under 2', '2 – 3', '3+'])
for mk, label in [('s3', '3+ SOG'), ('s4', '4+ SOG'), ('g1', '1+ goal')]:
    y = d[f'o_y_{mk}']
    rows = []
    for f, name in [('str_s2', '2+ SOG streak'), ('str_s3', '3+ SOG streak'), ('str_s4', '4+ SOG streak'), ('str_g', 'goal streak'), ('str_pt', 'point streak'),
                    ('cold_s2', 'under 2 SOG streak'), ('cold_pt', 'pointless streak'), ('since_g', 'games since a goal'), ('since_s3', 'games since 3+ SOG')]:
        b = d[f].clip(upper=3)
        for t in ['under 2', '2 – 3', '3+']:
            cells = []
            for v in [0, 1, 2, 3]:
                m = (tier == t) & (b == v)
                cells.append(f'{pct(y[m].mean())} ({int(m.sum())})' if m.sum() >= 20 else f'— ({int(m.sum())})')
            rows.append([name, t, *cells])
    line(f'### {label}')
    line()
    table(['Run', 'His shots a game', '0', '1', '2', '3+'], rows)

line('## By line slot')
line()
line('How often each slot reached each line (slot = ice-time rank in the game within his position: the box score carries no lineup; the site reads the beat writers’ lineups), '
     'and the rule that fires most often there for 3+ SOG and 1+ goal with its rate inside the slot.')
line()
rows = []
for sl in ['C1', 'LW1', 'RW1', 'C2', 'LW2', 'RW2', 'C3', 'LW3', 'RW3', 'C4', 'LW4', 'RW4', 'D1', 'D2', 'D3']:
    m = (d.slot == sl).to_numpy()
    cells = [pct(d.loc[m, f'o_y_{mk}'].mean()) for mk, _, _ in MARKS]
    extra = []
    for mk in ('s3', 'g1'):
        y = d[f'o_y_{mk}'].to_numpy()
        best = max(((int((k['mask'] & m).sum()), k) for k in kept_all.get(mk, [])), key=lambda t: t[0], default=(0, None))
        extra.append(f'{rule_text(best[1]["key"])}: {pct(y[best[1]["mask"] & m].mean())} of {best[0]}' if best[1] is not None and best[0] >= 15 else '—')
    rows.append([sl, int(m.sum()), *cells, *extra])
table(['Slot', 'Skater-games'] + [l for _, l, _ in MARKS] + ['3+ SOG: the rule firing most there', '1+ goal: the rule firing most there'], rows)

summ = ['| Line | Base | Rules found | Lift kept on the check week | Held | Kept | Fill the pill | The strongest that held |', '| --- | --- | --- | --- | --- | --- | --- | --- |'] + \
       ['| ' + ' | '.join(str(x) for x in r) + ' |' for r in summary] + ['']
out[SUMMARY_AT:SUMMARY_AT] = summ
open(opt['out'], 'w').write('\n'.join(out))
json.dump(rules_json, open(opt['rules'], 'w'), indent=1)
print('written', opt['out'], opt['rules'], file=sys.stderr)
for r in summary: print(r, file=sys.stderr)

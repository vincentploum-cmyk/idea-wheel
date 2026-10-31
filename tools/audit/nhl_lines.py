"""The by-line read, checked (Vincent, 2026-10-31, of the slot badges on the rink: "was it indeed true that the
LW1 had the most shots in that game tonight?"). Every skater-game of both seasons replayed against the
opponent's by-slot table as it stood that morning — what the opponent gives up per skater-game to the LW1,
the C2, the D1 … (lib/nhl-data/defense.js `defenseBySlot`, ranked by `slotBoard`, rank 1 = allows the most,
a cell from three skater-games, the softest slot = the best rank, a tie to the one furthest over the league's
mean) — and graded on the box score.

The site's slots come from the lineups (the beat writers' lines); the public box score carries none, so here a
skater's slot is his ice-time rank inside his position that night (the LW with the most minutes is LW1, the
third pair the two defencemen with the least): the lines as they were played rather than as posted.
Positions are the relabelled ones (tools/predictors/relabel.py: the forwards who took the draws are the
centres) when the games-pos dir is given, else the box score's.

  python3 -I tools/audit/nhl_lines.py --games .nhl-data/predictors --out .nhl-data/audit/out/nhl-lines.md [--dir games-pos]

Sections: A. does the opponent's softest slot produce its top shooter? (the direct question, against the base
rate of each slot and against the skaters' own rates); B. the lift by third of the opponent's slot table at the
skater's slot, beside the position table (the read the ice already carries), his own rate the yardstick; C. the
slot table on top of the position table and his own rate, a Poisson fit; D. how stable a team's slot cells are.
"""
import argparse, glob, json, math, warnings
from collections import defaultdict
import numpy as np, pandas as pd
import statsmodels.api as sm
warnings.filterwarnings('ignore')

ap = argparse.ArgumentParser()
ap.add_argument('--games', required=True); ap.add_argument('--out', required=True); ap.add_argument('--dir', default='games')
ap.add_argument('--seasons', default='2025,2026'); ap.add_argument('--min-games', type=int, default=5)
args = ap.parse_args()
POS = ['C', 'LW', 'RW', 'D']
LINES = {'C': 4, 'LW': 4, 'RW': 4, 'D': 3}
SLOTS = [f'{p}{i}' for i in (1, 2, 3, 4) for p in ('LW', 'C', 'RW')] + ['D1', 'D2', 'D3']
MIN_CELL = 3        # skater-games a cell needs (slotBoard's minSkaterGames)
PRIOR = {'sog': 18, 'g': 40}   # the skater's own rate: this season into last season's at n / (n + k) (defense-grade.js)
md = []
def line(s=''): md.append(s)
def table(head, rows):
    line('| ' + ' | '.join(head) + ' |'); line('| ' + ' | '.join('---' for _ in head) + ' |')
    for r in rows: line('| ' + ' | '.join(str(x) for x in r) + ' |')
    line()
pct = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{100 * v:.1f}%'
f2 = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v:.2f}'
f3 = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v:.3f}'
sgn = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{100 * v:+.1f}%'

def load(season):
    games = []
    for f in sorted(glob.glob(f'{args.games}/{season}/{args.dir}/*.json')): games += json.load(open(f))['games']
    return sorted(games, key=lambda g: (g['date'], g['id']))

def slotted(games):
    """Every skater-game with his slot: ice-time rank inside his position that night, within the position's lines."""
    rows = []
    for g in games:
        for team in (g['away']['abbrev'], g['home']['abbrev']):
            opp = g['home']['abbrev'] if team == g['away']['abbrev'] else g['away']['abbrev']
            mine = [s for s in g['skaters'] if s['team'] == team and s['pos'] in POS]
            for pos in POS:
                group = sorted([s for s in mine if s['pos'] == pos], key=lambda s: -(s['toi'] or 0))
                per = 2 if pos == 'D' else 1
                for i, s in enumerate(group):
                    ln = i // per + 1
                    rows.append(dict(date=g['date'], gid=g['id'], season=int(g['date'][:4]) - (0 if int(g['date'][5:7]) >= 7 else 1), team=team, opp=opp, home=int(team == g['home']['abbrev']),
                                     pid=s['id'], name=s['name'], pos=pos, line=ln if ln <= LINES[pos] else None, slot=f'{pos}{ln}' if ln <= LINES[pos] else None,
                                     toi=s['toi'] or 0, sog=s['sog'] or 0, g=s['g'] or 0, icf=s.get('icf') or 0))
    return pd.DataFrame(rows)

seasons = [int(s) for s in args.seasons.split(',')]
df = pd.concat([slotted(load(s)) for s in seasons], ignore_index=True).sort_values(['date', 'gid']).reset_index(drop=True)
line('# The by-line read, checked'); line()
line(f'Skater-games: ' + ' · '.join(f'{s}-{s % 100 + 1}: {len(df[df.season == s])} ({df[df.season == s].gid.nunique()} games)' for s in seasons) + f'. Positions from the {"relabelled rows (the centres by the draws taken)" if args.dir != "games" else "box score as registered"}; the slot is the ice-time rank inside the position that night.'); line()

# ---------------------------------------------------------------- the leak-free tables, walked date by date, per season
def walk(df_season):
    """For every skater-game: the opponent's by-slot table as it stood that morning (this season's games alone,
    per skater-game, ranked over the teams with a cell), the by-position table the same way, and his own rate going
    in. Returns the rows with the reads attached."""
    slot_sum = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0, 0]))   # opp -> slot -> [sog, g, skater-games]
    pos_sum = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0, 0]))
    team_gp = defaultdict(int)
    own = defaultdict(list)       # pid -> list of (sog, g) this season
    out = []
    for date, day in df_season.groupby('date', sort=True):
        # The tables as of this morning: per team and slot the per-skater-game figure; ranked per slot (1 = allows the most).
        tables = {}
        for key, src in (('slot', slot_sum), ('pos', pos_sum)):
            cells = {}
            for t, d in src.items():
                for k, (s, gg, n) in d.items():
                    if n >= MIN_CELL: cells[(t, k)] = (s / n, gg / n, n)
            ranks = {}
            for k in set(k for (_, k) in cells):
                lst = sorted([(t, cells[(t, k)]) for (t, kk) in cells if kk == k], key=lambda x: -x[1][0])
                nteams = len(lst); mean_s = sum(c[0] for _, c in lst) / nteams; mean_g = sum(c[1] for _, c in lst) / nteams
                lst_g = sorted(lst, key=lambda x: -x[1][1])
                rank_g = {t: i + 1 for i, (t, _) in enumerate(lst_g)}
                for i, (t, c) in enumerate(lst):
                    ranks[(t, k)] = dict(rank=i + 1, of=nteams, value=c[0], ratio=c[0] / mean_s if mean_s else 1, rank_g=rank_g[t], value_g=c[1], ratio_g=c[1] / mean_g if mean_g else 1, n=c[2])
            tables[key] = ranks
        softest = {}
        for (t, k), r in tables['slot'].items():
            cur = softest.get(t)
            if cur is None or r['rank'] < cur[1]['rank'] or (r['rank'] == cur[1]['rank'] and r['ratio'] > cur[1]['ratio']): softest[t] = (k, r)
        for r in day.itertuples():
            o = own.get(r.pid, [])
            n = len(o)
            rec = dict(idx=r.Index, opp_gp=team_gp[r.opp], own_n=n, own_sog=(sum(x[0] for x in o) / n) if n else None, own_g=(sum(x[1] for x in o) / n) if n else None)
            sl = tables['slot'].get((r.opp, r.slot)) if isinstance(r.slot, str) else None; ps = tables['pos'].get((r.opp, r.pos))
            rec.update(slot_rank=sl['rank'] if sl else None, slot_of=sl['of'] if sl else None, slot_ratio=sl['ratio'] if sl else None, slot_rank_g=sl['rank_g'] if sl else None, slot_ratio_g=sl['ratio_g'] if sl else None)
            rec.update(pos_rank=ps['rank'] if ps else None, pos_of=ps['of'] if ps else None, pos_ratio=ps['ratio'] if ps else None, pos_rank_g=ps['rank_g'] if ps else None, pos_ratio_g=ps['ratio_g'] if ps else None)
            so = softest.get(r.opp); rec.update(softest=so[0] if so else None, softest_rank=so[1]['rank'] if so else None)
            out.append(rec)
        # Absorb the day.
        for r in day.itertuples():
            if isinstance(r.slot, str): c = slot_sum[r.opp][r.slot]; c[0] += r.sog; c[1] += r.g; c[2] += 1
            c = pos_sum[r.opp][r.pos]; c[0] += r.sog; c[1] += r.g; c[2] += 1
            own[r.pid].append((r.sog, r.g))
        for gid, gm in day.groupby('gid'):
            for t in gm.team.unique(): team_gp[t] += 1
    return pd.DataFrame(out).set_index('idx')

reads = pd.concat([walk(df[df.season == s]) for s in seasons])
df = df.join(reads)
# The skater's own rate going in: this season into last season's regular season at n / (n + k) (defense-grade.js `blended`).
prev_rate = {}
for s in seasons[1:]:
    p = df[df.season == s - 1].groupby('pid').agg(sog=('sog', 'mean'), g=('g', 'mean'), n=('sog', 'size'))
    prev_rate[s] = p[p.n >= 10]
def blended(r, k):
    n = r.own_n; pr = prev_rate.get(r.season)
    base = pr.loc[r.pid] if pr is not None and r.pid in pr.index else None
    if base is None and n < 5: return None
    cur = r.own_sog if k == 'sog' else r.own_g
    if base is None: return cur
    w = n / (n + PRIOR[k]) if n else 0
    return w * (cur or 0) + (1 - w) * base[k]
df['exp_sog'] = [blended(r, 'sog') for r in df.itertuples()]
df['exp_g'] = [blended(r, 'g') for r in df.itertuples()]
def third(rank, of):
    if rank is None or of is None or (isinstance(rank, float) and math.isnan(rank)): return None
    return 'soft' if rank <= math.ceil(of / 3) else 'tough' if rank > of - math.floor(of / 3) else 'mid'
df['slot_third'] = [third(r.slot_rank, r.slot_of) for r in df.itertuples()]
df['pos_third'] = [third(r.pos_rank, r.pos_of) for r in df.itertuples()]
df['slot_third_g'] = [third(r.slot_rank_g, r.slot_of) for r in df.itertuples()]
df['pos_third_g'] = [third(r.pos_rank_g, r.pos_of) for r in df.itertuples()]
MG = args.min_games
ok = df[(df.opp_gp >= MG)].copy()
line(f'Reads from the opponent\'s {MG}th game of the season on (the tables this season\'s games alone, as the Defense tab\'s Season span); a cell needs {MIN_CELL} skater-games.'); line()

# ---------------------------------------------------------------- A. the softest slot and the top shooter
line('## A. Does the opponent\'s softest slot produce its top shooter?'); line()
line('For every team-game: the slot the opponent ranks softest against (the badge the rink head names), and whether the skater at that slot took the most shots on his team that night (a tie counts). Beside it the base rate of that slot (how often the LW1 is the top shooter whatever the opponent) and the obvious yardstick: the skater with the highest own shot rate going in.'); line()
rows_a = []
for s in seasons:
    sub = ok[ok.season == s]
    tg = []
    for (gid, team), gm in sub.groupby(['gid', 'team']):
        if gm.softest.isna().all(): continue
        soft = gm.softest.iloc[0]
        top = gm.sog.max()
        at = gm[gm.slot == soft]
        if not len(at): continue
        hit = int(at.sog.max() >= top)
        own_pick = gm.dropna(subset=['exp_sog'])
        own_hit = int(own_pick.loc[own_pick.exp_sog.idxmax()].sog >= top) if len(own_pick) else None
        # The base rate for the softest slot: that slot's top-shooter share over every team-game of the season.
        tg.append(dict(soft=soft, hit=hit, own_hit=own_hit, top=top, nskaters=len(gm)))
    tgd = pd.DataFrame(tg)
    if not len(tgd): continue
    # Base rates per slot over every team-game.
    base = {}
    for slot in SLOTS:
        hits = []
        for (gid, team), gm in sub.groupby(['gid', 'team']):
            at = gm[gm.slot == slot]
            if len(at): hits.append(int(at.sog.max() >= gm.sog.max()))
        base[slot] = (np.mean(hits), len(hits)) if hits else (None, 0)
    tgd['base'] = tgd.soft.map(lambda k: base.get(k, (None, 0))[0])
    rows_a.append([f'{s}-{s % 100 + 1}', len(tgd), pct(tgd.hit.mean()), pct(tgd.base.mean()), pct(tgd.own_hit.dropna().mean()), ', '.join(f'{k} {v}' for k, v in tgd.soft.value_counts().head(5).items())])
table(['Season', 'Team-games', 'Softest slot was the top shooter', 'Base rate of that slot', 'Highest own rate was the top shooter', 'The softest slots named most'], rows_a)
# Base rates by slot, both seasons pooled.
rows_b = []
for slot in SLOTS:
    hits = []
    for (gid, team), gm in ok.groupby(['gid', 'team']):
        at = gm[gm.slot == slot]
        if len(at): hits.append(int(at.sog.max() >= gm.sog.max()))
    sub = ok[ok.slot == slot]
    rows_b.append([slot, len(hits), pct(np.mean(hits)) if hits else '—', f2(sub.sog.mean()), f2(sub.toi.mean())])
line('How often each slot is the team\'s top shooter on a night, whatever the opponent, both seasons (the first line shoots the most everywhere: a team\'s raw highest cell is nearly always its first line, which is why the board ranks each slot against the league):'); line()
table(['Slot', 'Team-games', 'Top shooter', 'Shots a game', 'Minutes'], rows_b)

# ---------------------------------------------------------------- B. the lift by third
line('## B. The lift by third: the opponent\'s slot table against the position table'); line()
line('Every skater-game with a read, by the third the opponent\'s rank at his slot falls in (soft = ranks 1 … n/3, allows the most), against his own rate going in (this season into last season\'s at n / (n + 18) for shots, n / (n + 40) for goals; five games this season without a base). The lift is actual over expected − 1. The position table (the read the ice already carries at every chip) beside it on the same rows.'); line()
for stat, exp_col, floor in (('sog', 'exp_sog', 3), ('g', 'exp_g', 1)):
    rows_c = []
    sub = ok.dropna(subset=[exp_col]).copy()
    for key, col in (('slot', 'slot_third' if stat == 'sog' else 'slot_third_g'), ('position', 'pos_third' if stat == 'sog' else 'pos_third_g')):
        for t in ('soft', 'mid', 'tough'):
            x = sub[sub[col] == t]
            if not len(x): continue
            exp = x[exp_col].mean(); act = x[stat].mean()
            hit = (x[stat] >= floor).mean(); hit_exp = np.mean([1 - sum(math.exp(-l) * l ** k / math.factorial(k) for k in range(floor)) for l in x[exp_col]])
            rows_c.append([key, t, len(x), f2(exp), f2(act), sgn(act / exp - 1), pct(hit_exp), pct(hit)])
    line(f'### {"Shots" if stat == "sog" else "Goals"}, {floor}+ the mark'); line()
    table(['Table', 'Third', 'Skater-games', 'Own rate', 'Actual', 'Lift', f'{floor}+ said (Poisson)', f'{floor}+ landed'], rows_c)
    # By rank at the slot, the top five and bottom five.
    rows_r = []
    for rk in range(1, 33):
        x = sub[sub.slot_rank == rk]
        if len(x) < 50: continue
        rows_r.append([rk, len(x), f2(x[exp_col].mean()), f2(x[stat].mean()), sgn(x[stat].mean() / x[exp_col].mean() - 1), pct((x[stat] >= floor).mean())])
    line('By the opponent\'s rank at his slot (1 = allows the most):'); line()
    table(['Rank', 'Skater-games', 'Own rate', 'Actual', 'Lift', f'{floor}+ landed'], rows_r)

# ---------------------------------------------------------------- C. the slot table on top
line('## C. On top of his own rate and the position table'); line()
line('A Poisson fit of his shots (goals) on log(own rate), log(the opponent\'s position cell / league), log(the opponent\'s slot cell / league), home; fitted on 2025-26, scored on 2026-27 (deviance per skater-game, lower is better). A coefficient near 1 on the slot ratio means the slot cell moves his shots in full; near 0, the position cell (or his own rate) already has it.'); line()
rows_d = []
for stat, exp_col in (('sog', 'exp_sog'), ('g', 'exp_g')):
    sub = ok.dropna(subset=[exp_col, 'slot_ratio', 'pos_ratio']).copy()
    sub = sub[sub[exp_col] > 0]
    rc = 'slot_ratio' if stat == 'sog' else 'slot_ratio_g'; pc = 'pos_ratio' if stat == 'sog' else 'pos_ratio_g'
    sub = sub.dropna(subset=[rc, pc])
    sub['l_own'] = np.log(sub[exp_col].clip(lower=0.03)); sub['l_pos'] = np.log(sub[pc].clip(lower=0.2)); sub['l_slot'] = np.log(sub[rc].clip(lower=0.2))
    fit = sub[sub.season == seasons[0]]; chk = sub[sub.season == seasons[-1]]
    for name, xs in (('own rate', ['l_own', 'home']), ('+ position cell', ['l_own', 'l_pos', 'home']), ('+ slot cell', ['l_own', 'l_pos', 'l_slot', 'home']), ('slot cell alone (no position)', ['l_own', 'l_slot', 'home'])):
        X = sm.add_constant(fit[xs].astype(float)); m = sm.GLM(fit[stat].astype(float), X, family=sm.families.Poisson()).fit()
        def dev(d):
            Xd = sm.add_constant(d[xs].astype(float), has_constant='add'); mu = m.predict(Xd); y = d[stat].astype(float).values
            return float(np.mean(2 * (np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / mu), 0) - (y - mu))))
        rows_d.append(['shots' if stat == 'sog' else 'goals', name, ' · '.join(f'{k.replace("l_", "")} {m.params[k]:.3f} (z {m.tvalues[k]:.1f})' for k in xs), f'{dev(fit):.4f}', f'{dev(chk):.4f}' if len(chk) else '—', len(fit), len(chk)])
table(['Stat', 'Read', 'Coefficients', 'Deviance fit', 'Deviance check', 'n fit', 'n check'], rows_d)

# ---------------------------------------------------------------- D. how stable a slot cell is
line('## D. Is "soft against the LW1" a trait? Each team\'s odd games against its even games'); line()
rows_e = []
for s in seasons:
    sub = df[(df.season == s) & df.slot.notna()].copy()
    sub['k'] = sub.groupby(['opp', 'gid']).ngroup()
    g_order = sub.groupby('opp').gid.transform(lambda x: x.rank(method='dense'))
    sub['parity'] = (g_order % 2).astype(int)
    for key, grp in (('slot', 'slot'), ('position', 'pos')):
        a = sub[sub.parity == 0].groupby(['opp', grp]).sog.mean(); b = sub[sub.parity == 1].groupby(['opp', grp]).sog.mean()
        j = pd.concat([a, b], axis=1, keys=['a', 'b']).dropna()
        # Within each slot (across teams): does a team's odd-game cell predict its even-game cell?
        cors = []
        for k, jj in j.groupby(level=1):
            if len(jj) >= 10: cors.append((k, jj.a.corr(jj.b)))
        rows_e.append([f'{s}-{s % 100 + 1}', key, f3(np.mean([c for _, c in cors])), ', '.join(f'{k} {c:.2f}' for k, c in sorted(cors))])
table(['Season', 'Table', 'Mean correlation across cells', 'Per cell'], rows_e)
line('A team\'s odd-numbered games against its even-numbered ones, per cell: a trait correlates, noise does not. The per-position cells have three to four times the skater-games of a slot cell.')
open(args.out, 'w').write('\n'.join(md) + '\n')
print('\n'.join(md))

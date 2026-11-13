"""The top shooters, one by one: when does each go 3+ and when does he miss? (Vincent, 2026-11-13: "don't average …
run it for the top 100 shooters".)

  python3 -I tools/predictors/top_shooters.py <frame.pkl> --out <report-tables.md> [--season 2026] [--top 100] [--min-games 10]

The frame is tools/predictors/drivers_frame.py's. The top N by shots a game this season (--min-games at least); each
one's games of this season and last. Sections:
  1  every one of them: his 3+ rate this season / last, at home / away, against the soft and the tough third of
     defenses, on the nights his minutes were up / level / down, and what his misses had in common
  2  the group's misses, pooled: each condition against each skater's own rate (so a heavy shooter is compared with himself)
  3  do a skater's own splits hold? each split last season against the same split this season, skater by skater
  4  rules: every combination of up to three pre-game conditions, found on last season, checked on this one
numpy, pandas.
"""
import argparse, itertools, math, warnings
import numpy as np, pandas as pd
warnings.filterwarnings('ignore')
ap = argparse.ArgumentParser()
ap.add_argument('frame'); ap.add_argument('--out', required=True)
ap.add_argument('--season', type=int, default=2026); ap.add_argument('--top', type=int, default=100); ap.add_argument('--min-games', type=int, default=10)
args = ap.parse_args()
d = pd.read_pickle(args.frame); CUR = args.season
lab = lambda s: f'{s}-{(s + 1) % 100:02d}'
tb = []
def out(s=''): tb.append(s)
def fmt(x):
    if isinstance(x, (float, np.floating)): return '' if np.isnan(x) else f'{x:.2f}'
    return str(x)
def table(df):
    out('| ' + ' | '.join(str(c) for c in df.columns) + ' |'); out('| ' + ' | '.join('---' for _ in df.columns) + ' |')
    for r in df.itertuples(index=False): out('| ' + ' | '.join(fmt(x) for x in r) + ' |')
    out()
P = lambda s, n=None: '' if (len(s) == 0 or (n and len(s) < n)) else f'{100 * s.mean():.0f}%'
PN = lambda s, n=4: '' if len(s) < n else f'{100 * s.mean():.0f}% ({len(s)})'

# ── the pool ─────────────────────────────────────────────────────────────────────────────────────────────────────────
c = d[d.season == CUR]
tot = c.groupby('id').agg(name=('name', 'last'), team=('team', 'last'), pos=('pos', lambda x: x.mode().iloc[0]), gp=('sog', 'size'), sog=('sog', 'mean'), toi=('toi', 'mean')).reset_index()
top = tot[tot.gp >= args.min_games].nlargest(args.top, 'sog'); ids = set(top.id)
x = d[d.id.isin(ids) & (d.season >= CUR - 1)].copy()
x['hit'] = (x.sog >= 3).astype(int)
# the opponent, ranked each morning among the league: its shots allowed a game (blended into last season), thirds per date-less quantile over the season
for s in (CUR - 1, CUR):
    m = d.season == s; q = d.loc[m].drop_duplicates(['gid', 'opp']).opp_b_sa
    lo, hi = q.quantile(1 / 3), q.quantile(2 / 3)
    x.loc[x.season == s, 'oppT'] = np.where(x.loc[x.season == s, 'opp_b_sa'] >= hi, 'soft', np.where(x.loc[x.season == s, 'opp_b_sa'] <= lo, 'tough', 'middle'))
    q2 = d.loc[m, 'oppX_sog'].dropna(); lo2, hi2 = q2.quantile(1 / 3), q2.quantile(2 / 3)
    x.loc[x.season == s, 'cellT'] = np.where(x.loc[x.season == s, 'oppX_sog'] >= hi2, 'soft', np.where(x.loc[x.season == s, 'oppX_sog'] <= lo2, 'tough', 'middle'))
x['mdev'] = x.toi - x.l10_toi
x['mins'] = pd.cut(x.mdev, [-99, -1.5, 1.5, 99], labels=['down 1.5+', 'level', 'up 1.5+'])
x['own'] = x.groupby('id').hit.transform('mean')                    # his own 3+ rate over the two seasons
x['own_s'] = x.groupby(['id', 'season']).hit.transform('mean')
x['margin'] = x.team_gf - x.team_ga
x['tsf'] = pd.cut(x.team_sf, [0, 24, 29, 34, 99], labels=['under 25', '25–29', '30–34', '35+'])
x['form'] = x.l5_sog - x.s_sog
games = d.groupby('season').gid.nunique()
out(f'<!-- built by tools/predictors/top_shooters.py: the top {len(top)} by shots a game in {lab(CUR)} ({args.min_games}+ games), their {len(x)} games of {lab(CUR - 1)} and {lab(CUR)} -->'); out()
out(f'The top {len(top)} shooters of {lab(CUR)} by shots a game ({args.min_games}+ games; from {top.sog.max():.2f} down to {top.sog.min():.2f} a game): {int((x.season == CUR).sum())} games this season, '
    f'{int((x.season == CUR - 1).sum())} last. As a group they went 3+ in {P(x[x.season == CUR].hit)} of their games this season and {P(x[x.season == CUR - 1].hit)} last season.'); out()

# ── 1. one by one ────────────────────────────────────────────────────────────────────────────────────────────────────
out('## 1. One by one'); out()
out('3+ SOG rates. "now" / "last" = this season / last season; the splits pool both seasons, with the games behind each in brackets (blank under 4). '
    '"soft" / "tough" = the opponent in the third of the league allowing the most / fewest shots a game going in. "mins up / down" = he played 1.5+ minutes over / under his last 10 that night '
    '(known only afterwards). The last columns describe his misses: the share with his minutes down 1.5+, against a tough-third defense, and with his team under 25 shots.'); out()
rows = []
for r in top.itertuples():
    g = x[x.id == r.id]; a = g[g.season == CUR]; b = g[g.season == CUR - 1]; mi = g[g.hit == 0]
    rows.append({'skater': r.name, 'team': r.team, 'pos': r.pos, 'GP': r.gp, 'SOG/g': r.sog, 'TOI': r.toi, 'now': P(a.hit), 'last': PN(b.hit, 10),
                 'home': PN(g[g.home == 1].hit), 'away': PN(g[g.home == 0].hit), 'vs soft': PN(g[g.oppT == 'soft'].hit), 'vs tough': PN(g[g.oppT == 'tough'].hit),
                 'mins up': PN(g[g.mins == 'up 1.5+'].hit), 'mins down': PN(g[g.mins == 'down 1.5+'].hit), 'b2b': PN(g[g.b2b == 1].hit),
                 'misses': len(mi), 'miss: mins down': P(mi.mins == 'down 1.5+'), 'miss: tough D': P(mi.oppT == 'tough'), 'miss: team <25 SOG': P(mi.team_sf < 25)})
table(pd.DataFrame(rows))

# ── 2. the misses, pooled against each skater's own rate ─────────────────────────────────────────────────────────────
out('## 2. What the misses have in common'); out()
out('Every game of the group, both seasons. "own" = the average of each skater\'s own 3+ rate over the same games, so the comparison is each shooter with himself; '
    '"gap" = points over or under it, with a 95% interval. Before the game first, then what is only known afterwards.'); out()
def cond(name, key, order=None, df=x):
    rr = []
    vals = order or [v for v in pd.unique(key.dropna())]
    for v in vals:
        s = df[key == v]; n = len(s)
        if n < 30: continue
        h, o = s.hit.mean(), s.own.mean(); se = math.sqrt(h * (1 - h) / n)
        rr.append(dict(cut=name, value=str(v), games=n, went_3=f'{100 * h:.1f}%', own=f'{100 * o:.1f}%', gap=f'{100 * (h - o):+.1f}', interval=f'{100 * (h - o - 1.96 * se):+.1f} … {100 * (h - o + 1.96 * se):+.1f}',
                       now=P(s[s.season == CUR].hit, 30), now_own=P(s[s.season == CUR].own_s, 30)))
    return rr
pre = []
pre += cond('venue', x.home.map({1: 'home', 0: 'away'}), ['home', 'away'])
pre += cond('the opponent\'s shots allowed (team, blended)', x.oppT, ['soft', 'middle', 'tough'])
pre += cond('the opponent\'s shots allowed to his position', x.cellT, ['soft', 'middle', 'tough'])
pre += cond('the opponent\'s goals allowed, last 10', pd.qcut(x.opp_l10_ga, 3, labels=['tight third', 'middle', 'leaky third']), ['leaky third', 'middle', 'tight third'])
pre += cond('rest', pd.cut(x.rest, [0, 1, 2, 3, 400], labels=['back-to-back', '1 day off', '2 days off', '3+ days off']), ['back-to-back', '1 day off', '2 days off', '3+ days off'])
pre += cond('the opponent on a back-to-back', x.opp_tb2b.map({1: 'yes', 0: 'no'}), ['yes', 'no'])
pre += cond('line going in (by his recent minutes)', x.slot, ['F1', 'F2', 'F3', 'D1', 'D2'])
pre += cond('first power-play unit going in', x.pp1.map({1: 'yes', 0: 'no'}), ['yes', 'no'])
pre += cond('his last 5 against his season (shots a game)', pd.cut(x.form, [-9, -1, -0.3, 0.3, 1, 9], labels=['1+ under', '0.3–1 under', 'level', '0.3–1 over', '1+ over']), ['1+ under', '0.3–1 under', 'level', '0.3–1 over', '1+ over'])
pre += cond('his last game', pd.cut(d.loc[x.index, 'l3_sog'] * 0 + x.s3streak, [-1, 0, 1, 2, 99], labels=['under 3 shots', '3+ once', '3+ in two straight', '3+ in three or more']), ['under 3 shots', '3+ once', '3+ in two straight', '3+ in three or more'])
pre += cond('his minutes trend (last 3 against last 20)', pd.cut(x.l3_toi - x.l20_toi, [-99, -1, 1, 99], labels=['down 1+', 'level', 'up 1+']), ['down 1+', 'level', 'up 1+'])
pre += cond('a top-six forward newly out on his team', x.miss_f6_new.clip(upper=2).map({0: 'none', 1: 'one', 2: 'two or more'}), ['none', 'one', 'two or more'])
pre += cond('his team\'s shots a game going in', pd.qcut(x.team_b_sf, 3, labels=['low third', 'middle', 'high third']), ['high third', 'middle', 'low third'])
pre += cond('his team\'s win rate against the opponent\'s', pd.cut(x.team_s_win - x.opp_s_win, [-2, -0.15, 0.15, 2], labels=['underdog by record', 'even', 'favourite by record']), ['favourite by record', 'even', 'underdog by record'])
pre += cond('games into his season', pd.cut(x.n, [-1, 9, 29, 59, 99], labels=['1–10', '11–30', '31–60', '61+']), ['1–10', '11–30', '31–60', '61+'])
out('**Before the game**'); out(); table(pd.DataFrame(pre))
post = []
post += cond('his minutes against his last 10', pd.cut(x.mdev, [-99, -3, -1.5, 1.5, 3, 99], labels=['3+ fewer', '1.5–3 fewer', 'level', '1.5–3 more', '3+ more']), ['3+ fewer', '1.5–3 fewer', 'level', '1.5–3 more', '3+ more'])
post += cond('his power-play minutes', pd.cut(x.pp, [-1, 1, 2.5, 4, 99], labels=['under 1', '1–2.5', '2.5–4', '4+']), ['under 1', '1–2.5', '2.5–4', '4+'])
post += cond('his team\'s power plays', pd.cut(x.team_ppo, [-1, 1, 2, 3, 4, 99], labels=['0–1', '2', '3', '4', '5+']), ['0–1', '2', '3', '4', '5+'])
post += cond('his team\'s shots', x.tsf, ['under 25', '25–29', '30–34', '35+'])
post += cond('the final margin', pd.cut(x.margin, [-99, -3, -1, 0, 2, 99], labels=['lost by 3+', 'lost by 1–2', '(overtime / shootout loss)', 'won by 1–2', 'won by 3+']), ['lost by 3+', 'lost by 1–2', 'won by 1–2', 'won by 3+'])
post += cond('overtime', x.team_ot.map({1: 'yes', 0: 'no'}), ['yes', 'no'])
post += cond('his attempts (shots, blocked, missed)', pd.cut(x.icf, [-1, 3, 5, 7, 99], labels=['0–3', '4–5', '6–7', '8+']), ['0–3', '4–5', '6–7', '8+'])
out('**Only known afterwards**'); out(); table(pd.DataFrame(post))
# a miss, taken apart
mi = x[x.hit == 0]
out(f'**A miss, taken apart** — the {len(mi)} games under 3 shots: {P(mi.sog == 2)} were 2 shots, {P(mi.sog == 1)} 1, {P(mi.sog == 0)} 0. '
    f'In {P(mi.icf >= 5)} of them he still had 5+ attempts (blocked or wide: {P((mi.icf - mi.sog) >= 3)} had 3+ attempts that did not reach the net). '
    f'His minutes were down 1.5+ in {P(mi.mins == "down 1.5+")} of the misses against {P(x[x.hit == 1].mins == "down 1.5+")} of the hits; '
    f'his team was under 25 shots in {P(mi.team_sf < 25)} against {P(x[x.hit == 1].team_sf < 25)}; the opponent was a tough-third defense in {P(mi.oppT == "tough")} against {P(x[x.hit == 1].oppT == "tough")}.'); out()
# none of the pre-game flags up
flags = (x.home == 0).astype(int) + (x.oppT == 'tough').astype(int) + (x.b2b == 1).astype(int) + (x.form <= -1).astype(int)
out('**How many pre-game flags against him** (away, a tough-third defense, a back-to-back, his last 5 a shot under his season)'); out()
table(pd.DataFrame(cond('flags against', flags.clip(upper=3).map({0: 'none', 1: 'one', 2: 'two', 3: 'three or four'}), ['none', 'one', 'two', 'three or four'])))

# ── 3. do his own splits hold ────────────────────────────────────────────────────────────────────────────────────────
out('## 3. Do a skater\'s own splits hold?'); out()
out(f'For each skater his split in {lab(CUR - 1)} (3+ rate on one side minus the other) against the same split in {lab(CUR)} (10+ games on each side last season, 4+ this season). '
    'r near 0 = last season\'s split says nothing about this season\'s: it was that skater\'s noise, not a trait. Then the odd / even games of last season against each other, the same test with a full season on both sides.'); out()
def split_r(name, a_mask, b_mask):
    def per(df, mn):
        A = df[a_mask.loc[df.index]].groupby('id').hit.agg(['mean', 'size']); B = df[b_mask.loc[df.index]].groupby('id').hit.agg(['mean', 'size'])
        j = A.join(B, lsuffix='_a', rsuffix='_b', how='inner'); j = j[(j.size_a >= mn) & (j.size_b >= mn)]; return j.mean_a - j.mean_b
    last, now = per(x[x.season == CUR - 1], 10), per(x[x.season == CUR], 4); j = pd.concat([last, now], axis=1, keys=['l', 'n']).dropna()
    ls = x[x.season == CUR - 1].copy(); ls['k'] = ls.groupby('id').cumcount() % 2
    o, e = per(ls[ls.k == 0], 5), per(ls[ls.k == 1], 5); j2 = pd.concat([o, e], axis=1, keys=['o', 'e']).dropna()
    return dict(split=name, skaters=len(j), avg_last=f'{100 * last.mean():+.1f}', sd_between_skaters=f'{100 * last.std():.1f}', r_last_to_now=j.l.corr(j.n) if len(j) > 8 else np.nan,
                skaters_odd_even=len(j2), r_odd_even=j2.o.corr(j2.e) if len(j2) > 8 else np.nan)
sp = [split_r('home minus away', x.home == 1, x.home == 0), split_r('soft-third minus tough-third defense', x.oppT == 'soft', x.oppT == 'tough'),
      split_r('soft minus tough at his position', x.cellT == 'soft', x.cellT == 'tough'), split_r('rested minus back-to-back', x.b2b == 0, x.b2b == 1),
      split_r('after a 3+ game minus after a miss', x.s3streak >= 1, x.s3streak == 0), split_r('wins minus losses (afterwards)', x.margin > 0, x.margin < 0)]
table(pd.DataFrame(sp))
# his 3+ rate itself, last season to this
r_ = x.groupby(['id', 'season']).hit.agg(['mean', 'size']).unstack(); r_ = r_[(r_['size'][CUR - 1] >= 30) & (r_['size'][CUR] >= args.min_games)]
out(f'For scale, his 3+ rate itself, last season against this season: r {r_["mean"][CUR - 1].corr(r_["mean"][CUR]):.2f} over {len(r_)} skaters '
    f'(average {100 * r_["mean"][CUR - 1].mean():.0f}% last season, {100 * r_["mean"][CUR].mean():.0f}% this season — this season\'s list is picked on this season\'s shots, so it flatters them). '
    f'The {int((r_["mean"][CUR] >= 0.7).sum())} skaters at 70%+ this season were at {100 * r_["mean"][CUR - 1][r_["mean"][CUR] >= 0.7].mean():.0f}% last season.'); out()
# last season's hottest 20-game starts, and the rest of that season
ls = d[(d.season == CUR - 1)].copy(); ls['hit'] = (ls.sog >= 3).astype(int); ls['k'] = ls.groupby('id').cumcount()
first = ls[ls.k < 20].groupby('id').hit.agg(['mean', 'size']); rest = ls[ls.k >= 20].groupby('id').hit.agg(['mean', 'size'])
j = first.join(rest, lsuffix='_f', rsuffix='_r'); j = j[(j.size_f == 20) & (j.size_r >= 30)]
rr = []
for lo, hi in ((0.8, 1.01), (0.7, 0.8), (0.6, 0.7), (0.5, 0.6), (0.4, 0.5)):
    s = j[(j.mean_f >= lo) & (j.mean_f < hi)]
    if len(s): rr.append(dict(first_20_games=f'{int(100 * lo)}–{int(100 * min(hi, 1))}%', skaters=len(s), first_20=f'{100 * s.mean_f.mean():.0f}%', rest_of_season=f'{100 * s.mean_r.mean():.0f}%', best=f'{100 * s.mean_r.max():.0f}%', worst=f'{100 * s.mean_r.min():.0f}%'))
out(f'**A hot first 20 games, and the rest of that season** ({lab(CUR - 1)}; every skater with 20 games then 30+ more)'); out(); table(pd.DataFrame(rr))

# ── 4. rules ─────────────────────────────────────────────────────────────────────────────────────────────────────────
out('## 4. Rules'); out()
# the pool here must be known that morning: his shots a game going in, not this season's list
y = d[(d.season >= CUR - 1) & (d.n >= 5)].copy(); y['hit'] = (y.sog >= 3).astype(int)
for s in (CUR - 1, CUR):
    m = d.season == s; q = d.loc[m].drop_duplicates(['gid', 'opp']).opp_b_sa; lo, hi = q.quantile(1 / 3), q.quantile(2 / 3)
    y.loc[y.season == s, 'soft'] = (y.loc[y.season == s, 'opp_b_sa'] >= hi).astype(int); y.loc[y.season == s, 'tough'] = (y.loc[y.season == s, 'opp_b_sa'] <= lo).astype(int)
    q2 = d.loc[m, 'oppX_sog'].dropna(); y.loc[y.season == s, 'softcell'] = (y.loc[y.season == s, 'oppX_sog'] >= q2.quantile(2 / 3)).astype(int)
C = {'home': y.home == 1, 'soft-third defense': y.soft == 1, 'not a tough-third defense': y.tough == 0, 'soft at his position': y.softcell == 1, 'first line / pair': y.slot.isin(['F1', 'D1']),
     'first power-play unit': y.pp1 == 1, 'rested (no back-to-back)': y.b2b == 0, 'opponent on a back-to-back': y.opp_tb2b == 1, 'season 3.0+ a game': y.s_sog >= 3.0, 'season 3.5+': y.s_sog >= 3.5,
     'L10 3.0+': y.l10_sog >= 3.0, 'L10 3.5+': y.l10_sog >= 3.5, 'L5 3.0+': y.l5_sog >= 3.0, 'L15 3.0+': y.l15_sog >= 3.0, 'last season 3.0+ a game': y.ls_sog >= 3.0,
     'attempts 5.5+ a game': y.s_icf >= 5.5, 'attempts 6.5+ a game': y.s_icf >= 6.5, 'minutes 19+ (L5)': y.l5_toi >= 19, 'went 3+ in 60%+ of his L10': y.l10_h3 >= 0.6, 'went 3+ in 70%+ of his season': y.s_h3 >= 0.7,
     '3+ in his last two': y.s3streak >= 2, 'his team shoots 30+ a game': y.team_b_sf >= 30, 'a top-six forward newly out': y.miss_f6_new >= 1, 'forward': y.F == 1, '4+ shots last game': y.l3_sog * 0 + d.loc[y.index].groupby('id').sog.shift(1) >= 4}
A = y.season == CUR - 1; B = y.season == CUR; nA = y[A].date.nunique(); nB = y[B].date.nunique()
res = []
names = list(C)
for k in (1, 2, 3):
    for combo in itertools.combinations(names, k):
        m = np.logical_and.reduce([C[c_].values for c_ in combo])
        a = y.hit.values[m & A.values];
        if len(a) < 150: continue
        b = y.hit.values[m & B.values]
        res.append(dict(rule=' + '.join(combo), k=k, last_n=len(a), last_a_night=len(a) / nA, last=a.mean(), now_n=len(b), now=b.mean() if len(b) >= 20 else np.nan))
R = pd.DataFrame(res)
out(f'The pool is every skater with 5+ games this season, so nothing is picked with hindsight. Every combination of one to three of {len(names)} pre-game conditions with 150+ games in {lab(CUR - 1)} '
    f'({len(R)} rules), ranked on {lab(CUR - 1)}, then read unchanged on {lab(CUR)}. The best rule of thousands is partly the luckiest: the check season is the honest figure.'); out()
show = lambda df: df.assign(last=lambda t: (100 * t['last']).round(1).astype(str) + '%', now=lambda t: (100 * t['now']).round(1).astype(str).replace('nan', '') + '%', last_a_night=lambda t: t.last_a_night.round(2))[['rule', 'last_n', 'last_a_night', 'last', 'now_n', 'now']]
out(f'**The 25 best on {lab(CUR - 1)}**'); out(); table(show(R.nlargest(25, 'last')))
top50 = R.nlargest(50, 'last'); t200 = R.nlargest(200, 'last')
out(f'The 50 best averaged {100 * top50["last"].mean():.1f}% on {lab(CUR - 1)} and {100 * np.average(top50["now"].dropna(), weights=top50.now_n[top50["now"].notna()]):.1f}% on {lab(CUR)}; '
    f'the 200 best {100 * t200["last"].mean():.1f}% and {100 * np.average(t200["now"].dropna(), weights=t200.now_n[t200["now"].notna()]):.1f}%. '
    f'The single best rule on either season: {100 * R["last"].max():.1f}% ({lab(CUR - 1)}), {100 * R[R.now_n >= 60]["now"].max():.1f}% ({lab(CUR)}, 60+ games). '
    f'Rules at 75%+ on {lab(CUR - 1)}: {int((R["last"] >= 0.75).sum())}; at 70%+: {int((R["last"] >= 0.70).sum())}; at 70%+ on both seasons (60+ games this season): {int(((R["last"] >= 0.70) & (R["now"] >= 0.70) & (R.now_n >= 60)).sum())}.'); out()
both = R[(R.now_n >= 60)].assign(worst=lambda t: t[['last', 'now']].min(axis=1)).nlargest(20, 'worst')
out('**The 20 rules that held best on both seasons** (ranked by the lower of the two, 60+ games this season)'); out(); table(show(both))
out('**Each condition alone**'); out(); table(show(R[R.k == 1].sort_values('last', ascending=False)))
# the same ladder for 2+ shots, where 90% lives
y['hit2'] = (y.sog >= 2).astype(int); res2 = []
for k in (1, 2, 3):
    for combo in itertools.combinations(names, k):
        m = np.logical_and.reduce([C[c_].values for c_ in combo]); a = y.hit2.values[m & A.values]
        if len(a) < 150: continue
        b = y.hit2.values[m & B.values]; res2.append(dict(rule=' + '.join(combo), k=k, last_n=len(a), last_a_night=len(a) / nA, last=a.mean(), now_n=len(b), now=b.mean() if len(b) >= 20 else np.nan))
R2 = pd.DataFrame(res2); both2 = R2[(R2.now_n >= 60)].assign(worst=lambda t: t[['last', 'now']].min(axis=1)).nlargest(15, 'worst')
out('**The same search at 2+ SOG: the 15 rules that held best on both seasons**'); out(); table(show(both2))
out(f'At 2+ SOG, rules at 85%+ on both seasons (60+ games this season): {int(((R2["last"] >= 0.85) & (R2["now"] >= 0.85) & (R2.now_n >= 60)).sum())}; at 90%+ on both: {int(((R2["last"] >= 0.90) & (R2["now"] >= 0.90) & (R2.now_n >= 60)).sum())}.'); out()

open(args.out, 'w').write('\n'.join(tb) + '\n')
print('written', args.out)

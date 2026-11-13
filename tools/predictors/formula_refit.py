"""The two fits behind the 2026-11-13 changes (Vincent: "no just 2 and 3", of docs/audits/2026-11-13-nhl-drivers.md's list).

  python3 -I tools/predictors/formula_refit.py <frame.pkl> [--lines .nhl-data/toi/lines-20262027.json] [--out tables.md]

1  The opponent as a team beside its position cell, on the site's plain-rate formula (lib/nhl-data/picks-pure.js
   `project`, TEAM_SHOTS_FIT): a Poisson fit over the shipped formula's λ of (the opponent's shots allowed a game / the
   league's)^team x (the position cell / the league's at the position)^cell, this season's tables, the team's games
   shrunk to the league at games / (games + k). Fitted on one or two seasons, read on the next.
2  Shots against the minutes the posted line projects (components/nhl/model-core.js `lineMoveMultiplier`,
   TOI_MOVE_EXP): the model's projected minutes at tonight's posted line over the same at his usual line, against his
   shots; the step it replaces (+6% a line upward only) and the alternatives, each with the formula's level set right
   so a cut is not punished for the formula running low. Posted lines: tools/audit/nhl-toi-lines.mjs (GameDayTweets).
The frame is tools/predictors/drivers_frame.py's (three seasons, oldest first). numpy, pandas, statsmodels.
"""
import argparse, json, warnings
import numpy as np, pandas as pd, statsmodels.api as sm
warnings.filterwarnings('ignore')
ap = argparse.ArgumentParser(); ap.add_argument('frame'); ap.add_argument('--lines'); ap.add_argument('--out'); ap.add_argument('--season', type=int, default=2026)
args = ap.parse_args(); CUR = args.season
d = pd.read_pickle(args.frame); md = []; rng = np.random.default_rng(3)
lab = lambda s: f'{s}-{(s + 1) % 100:02d}'
def out(s=''): md.append(s)
def table(df):
    out('| ' + ' | '.join(str(c) for c in df.columns) + ' |'); out('| ' + ' | '.join('---' for _ in df.columns) + ' |')
    for r in df.itertuples(index=False): out('| ' + ' | '.join((f'{x:.3f}' if isinstance(x, float) else str(x)) for x in r) + ' |')
    out()
def dev(y, mu):
    y = np.asarray(y, float); mu = np.clip(np.asarray(mu, float), 1e-6, None)
    return 2 * (np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / mu), 0) - (y - mu))
p3 = lambda lam: 1 - np.exp(-lam) * (1 + lam + lam ** 2 / 2)
def boot(dates, diff):
    g = pd.DataFrame({'d': np.asarray(dates), 'g': np.asarray(diff)}).groupby('d').g.agg(['sum', 'size']); i = rng.integers(0, len(g), (500, len(g)))
    v = g['sum'].values[i].sum(1) / g['size'].values[i].sum(1); return 1000 * g['sum'].sum() / g['size'].sum(), 1000 * np.percentile(v, 2.5), 1000 * np.percentile(v, 97.5)

# ── 1. the opponent as a team beside its position cell ───────────────────────────────────────────────────────────────
out('## 1. The opponent as a team beside its position cell'); out()
x = d[d.site_lam_s.notna() & (d.n >= 5)].copy()          # five games in: the formula reads this season's rates, no last season needed
tg = d.drop_duplicates(['gid', 'team']).sort_values(['date', 'gid']); tg['lg_sa'] = tg.groupby('season').team_sf.transform(lambda s: s.shift().expanding().mean())
x['lg_sa'] = pd.MultiIndex.from_frame(x[['season', 'date']]).map(tg.groupby(['season', 'date']).lg_sa.last()).values
x = x[x.lg_sa.notna()]
lgP = x.pos.map({'C': 1.73, 'LW': 1.63, 'RW': 1.69, 'D': 1.27}); x['cell'] = np.log(np.maximum(x.oppP_sog.fillna(lgP), 0.05) / lgP)
ratio = lambda k: np.log((((x.opp_s_sa.fillna(x.lg_sa) * x.opp_tgp + x.lg_sa * k) / (x.opp_tgp + k)) / x.lg_sa).clip(0.6, 1.6))
out(f'Skater-games five games into the season, where the formula reads this season\'s rates: ' + ', '.join(f'{lab(s)} {n}' for s, n in x.groupby('season').size().items()) + '. '
    f'Over the shipped λ: (team ratio)^team × (cell ratio)^cell. "cell" is what comes off or goes onto the shipped 0.687. Correlation of the two reads {np.corrcoef(ratio(5), x.cell)[0, 1]:.2f}.'); out()
rr = []
for trainS, testS in (((CUR - 2, CUR - 1), (CUR,)), ((CUR - 2,), (CUR - 1, CUR)), ((CUR - 1,), (CUR,))):
    A = x.season.isin(trainS)
    for k in (0, 3, 5, 10):
        r = ratio(k); m = sm.GLM(x.sog[A], sm.add_constant(pd.DataFrame({'team': r[A], 'cell': x.cell[A]})), family=sm.families.Poisson(), offset=np.log(x.site_lam_s[A])).fit()
        row = dict(fitted_on=' + '.join(lab(s) for s in trainS), k=k, team=m.params['team'], z_team=m.tvalues['team'], cell=m.params['cell'], z_cell=m.tvalues['cell'])
        for t in (CUR - 1, CUR):
            if t in testS:
                B = x.season == t; mu0 = x.site_lam_s[B]; mu1 = mu0 * np.exp(m.params['team'] * r[B] + m.params['cell'] * x.cell[B]); g, lo, hi = boot(x.date[B], dev(x.sog[B], mu1) - dev(x.sog[B], mu0))
                row[f'read on {lab(t)}'] = f'{g:+.1f} ({lo:+.1f} … {hi:+.1f})'
            else: row[f'read on {lab(t)}'] = ''
        rr.append(row)
out('Deviance per skater-game ×1000 against the shipped formula on the season after the fit (negative = better), 95% interval over dates'); out(); table(pd.DataFrame(rr))
T, C, K = 0.63, -0.53, 5
out(f'**Shipped: team {T}, cell {C}, k = {K}** (`TEAM_SHOTS_FIT`), on {lab(CUR)}'); out()
B = x.season == CUR; q = x[B].copy(); r = ratio(K)[B]; q['mu0'] = q.site_lam_s; q['mu1'] = q.mu0 * np.exp(T * r + C * q.cell); q['tr'] = np.exp(r)
for nm, key in (('the opponent\'s shots allowed as a team', pd.qcut(q.tr, 5, labels=['tightest fifth', '2', '3', '4', 'loosest fifth'])), ('the opponent\'s position cell', pd.qcut(q.cell, 5, labels=['tightest fifth', '2', '3', '4', 'loosest fifth']))):
    out(f'Shots over what the formula said, by fifth of {nm}'); out()
    table(q.groupby(key, observed=True).apply(lambda t: pd.Series({'n': len(t), 'as it was': t.sog.sum() / t.mu0.sum(), 'with the team': t.sog.sum() / t.mu1.sum()})).reset_index().rename(columns={'tr': 'fifth', 'cell': 'fifth'}))
hi0 = q[p3(q.mu0) >= 0.5]; hi1 = q[p3(q.mu1) >= 0.5]
q['rk0'] = q.groupby('date').mu0.rank(ascending=False, method='first'); q['rk1'] = q.groupby('date').mu1.rank(ascending=False, method='first')
out(f'3+ SOG calls at 50%+: as it was {len(hi0)}, said {100 * p3(hi0.mu0).mean():.1f}%, landed {100 * (hi0.sog >= 3).mean():.1f}%; with the team {len(hi1)}, said {100 * p3(hi1.mu1).mean():.1f}%, landed {100 * (hi1.sog >= 3).mean():.1f}%. '
    f'Brier of 3+ {((p3(q.mu0) - (q.sog >= 3)) ** 2).mean():.4f} → {((p3(q.mu1) - (q.sog >= 3)) ** 2).mean():.4f}. Best 3 a night {100 * (q[q.rk0 <= 3].sog >= 3).mean():.1f}% → {100 * (q[q.rk1 <= 3].sog >= 3).mean():.1f}%, best 10 {100 * (q[q.rk0 <= 10].sog >= 3).mean():.1f}% → {100 * (q[q.rk1 <= 10].sog >= 3).mean():.1f}%. '
    f'The formula\'s level: shots / said {q.sog.sum() / q.mu0.sum():.3f} → {q.sog.sum() / q.mu1.sum():.3f}.'); out()
m1 = sm.GLM(x.sog[x.season < CUR], sm.add_constant(ratio(K)[x.season < CUR]), family=sm.families.Poisson(), offset=np.log(x.site_lam_s[x.season < CUR])).fit()
out(f'The team read simply added, the cell left at 0.687: exponent {m1.params.iloc[1]:.3f} (z {m1.tvalues.iloc[1]:.1f}) — nothing. The cell already carries the team at too heavy a weight; the gain is in moving the weight, not adding to it.'); out()

# ── 2. shots against the minutes the posted line projects ────────────────────────────────────────────────────────────
if args.lines:
    out('## 2. Shots and the minutes the posted line projects'); out()
    L = json.load(open(args.lines)); rows = [dict(gid=g['gameId'], id=int(p), lu_pos=v.get('pos'), lu_line=v.get('line'), source=g['source']) for g in L['games'] for p, v in g['players'].items()]
    y = d[d.season == CUR].merge(pd.DataFrame(rows).drop_duplicates(['gid', 'id']), on=['gid', 'id'])
    y['toiL5'] = y.groupby('id', sort=False).toi.transform(lambda s: s.shift().rolling(5, min_periods=1).mean())
    y = y[(y.n >= 5) & y.lu_line.notna() & y.toiL5.notna() & y.site_lam_s.notna()].copy(); D = (y.lu_pos == 'D').values
    FIT = dict(line={'F1': 4.05, 'F2': 3.60, 'F3': 3.07, 'F4': 2.16, 'D1': 5.04, 'D2': 4.26, 'D3': 2.98}, mean={'F1': 18.36, 'F2': 16.56, 'F3': 14.47, 'F4': 11.32, 'D1': 22.30, 'D2': 19.84, 'D3': 15.54})
    tl = np.where(D, y.lu_line.clip(1, 3), y.lu_line.clip(1, 4)).astype(int)
    usual = np.array([min(range(1, 4 if a else 5), key=lambda n: abs(FIT['mean'][('D' if a else 'F') + str(n)] - b)) for a, b in zip(D, y.toiL5)])
    pr = lambda ln: pd.Series([('D' if a else 'F') + str(n) for a, n in zip(D, ln)], index=y.index).map(FIT['line']) + 0.345 * y.toiL5 + 0.442 * y.s_toi
    y['p_today'] = pr(tl); y['p_usual'] = pr(usual); lr = np.log(y.p_today / y.p_usual).values; shift = usual - tl
    impF = np.where(y.toiL5 >= 17.5, 1, np.where(y.toiL5 >= 15.1, 2, np.where(y.toiL5 >= 12.3, 3, 4)))        # the model's impliedLine, forwards' cuts for everyone
    lvl = np.where(D, y.sog[D].sum() / y.site_lam_s[D].sum(), y.sog[~D].sum() / y.site_lam_s[~D].sum()); base = y.site_lam_s.values * lvl
    out(f'{len(y)} skater-games of {lab(CUR)} with a posted line and 5+ games ({100 * (y.source == "tweet").mean():.0f}% from that game\'s own tweet, the rest the last lines carried). '
        f'"His usual line" = the line whose mean minutes are nearest his last five; "moved" = the posted line against it. The read is the plain-rate formula with its level set right '
        f'(it ran {lvl[~D][0]:.3f}× low for forwards, {lvl[D][0]:.3f}× for defensemen), so "shots / read" is 1.00 for a skater on his usual line.'); out()
    t = pd.DataFrame({'who': np.where(D, 'defensemen', 'forwards'), 'moved': np.clip(shift, -2, 2), 'sog': y.sog.values, 'said': base, 'toi': y.toi.values, 'l5': y.toiL5.values, 'pt': y.p_today.values, 'pu': y.p_usual.values})
    g = t.groupby(['who', 'moved']).agg(n=('sog', 'size'), last5=('l5', 'mean'), projected=('pt', 'mean'), at_usual=('pu', 'mean'), played=('toi', 'mean'), shots=('sog', 'sum'), said=('said', 'sum')).reset_index()
    g['projected / at usual'] = g.projected / g.at_usual; g['played / at usual'] = g.played / g.at_usual; g['shots / read'] = g.shots / g.said
    g['moved'] = g.moved.map({-2: 'down 2+', -1: 'down 1', 0: 'his usual line', 1: 'up 1', 2: 'up 2+'})
    table(g.drop(columns=['shots', 'said']))
    rr = []
    for who, mk in (('everyone', np.ones(len(y), bool)), ('forwards', ~D), ('defensemen', D)):
        m = sm.GLM(y.sog[mk], sm.add_constant(lr[mk]), family=sm.families.Poisson(), offset=np.log(y.site_lam_s[mk])).fit(); ci = m.conf_int().iloc[1]
        rr.append(dict(who=who, n=int(mk.sum()), exponent=m.params.iloc[1], low=ci[0], high=ci[1], z=m.tvalues.iloc[1]))
    out('The exponent on (projected at the posted line / at his usual line), fitted over the formula: 1 = shots move in step with the projected minutes'); out(); table(pd.DataFrame(rr))
    mt = sm.OLS(np.log(y.toi.clip(lower=3) / y.p_usual), sm.add_constant(lr)).fit()
    out(f'The minutes he then played follow the same ratio at {mt.params.iloc[1]:.2f}; shots follow the minutes played at 0.99 (the drivers study): 0.8 together, the exponent shipped (`TOI_MOVE_EXP`).'); out()
    V = {'no line term': np.ones(len(y)), 'the step it replaces: +6% a line, upward only, forwards\' cuts for everyone': 1 + np.clip((impF - tl) * 0.06, 0, 0.12),
         'the same with defensemen on their own cuts': 1 + np.clip(shift * 0.06, 0, 0.12), '±4% a line, both ways': 1 + np.clip(shift * 0.04, -0.08, 0.08), '±6% a line, both ways': 1 + np.clip(shift * 0.06, -0.12, 0.12),
         'the minutes ratio ^0.7': np.exp(0.7 * lr), 'the minutes ratio ^0.8 (shipped)': np.clip(np.exp(0.8 * lr), 0.88, 1.14), 'the minutes ratio ^1.0': np.exp(lr)}
    def level(mult):
        mu = base * mult; return mu * np.where(D, y.sog[D].sum() / mu[D].sum(), y.sog[~D].sum() / mu[~D].sum())
    ref = dev(y.sog, level(V['no line term'])); rr = []; up, dn = shift > 0, shift < 0
    for nm, mult in V.items():
        mu = level(mult); g_, lo, hi = boot(y.date, dev(y.sog, mu) - ref)
        rr.append({'rule': nm, 'deviance ×1000 against none': f'{g_:+.2f} ({lo:+.2f} … {hi:+.2f})', 'moved up: shots / said': y.sog[up].sum() / mu[up].sum(), 'moved down': y.sog[dn].sum() / mu[dn].sum(), 'usual line': y.sog[~up & ~dn].sum() / mu[~up & ~dn].sum(),
                   'defensemen up': y.sog[up & D].sum() / mu[up & D].sum(), 'defensemen down': y.sog[dn & D].sum() / mu[dn & D].sum()})
    out(f'Each rule on the same read, its level set right ({int(up.sum())} moved up, {int(dn.sum())} down, {int((~up & ~dn).sum())} on their usual line)'); out(); table(pd.DataFrame(rr))
text = '\n'.join(md) + '\n'
if args.out: open(args.out, 'w').write(text)
print(text)

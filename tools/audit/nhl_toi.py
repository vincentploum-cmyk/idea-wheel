"""Can a skater's minutes be projected from his line and the power plays the matchup should bring? (Vincent, 2026-11-07:
"can we predict how many minutes skaters are projected to get based on potential power plays (opponent allows a lot of
powerplays) and the line he is playing? Line 4 gets fewer minutes than line 1".)

Every regular-season skater-game of 2025-26 and of 2026-27 so far from the NHL stats API (tools/audit/nhl-toi-fetch.sh):
his ice time split even strength / power play / short-handed, and each team-game's power plays and kills. Every read is
built from the games before the date: his last 10 / 5 (across the season boundary), his share of his team's power-play
and penalty-kill minutes over his last 10, and the power plays the matchup should bring — specialTeamsRead's shape
(lib/nhl-data/special-teams.js: the league's rate × own drawn ratio^0.46 × the opponent's given ratio^0.42, each shrunk
at gp / (gp + 10), this season's games only) × the league's minutes a power play.

The public box score carries no lines. Two stand-ins: the slot "projected" (the rank of his recent even-strength minutes
among the skaters his team dressed tonight: forwards in threes, defencemen in pairs) and the slot "as played" (tonight's
even-strength rank). The second is drawn from the result itself, so whatever it earns is a ceiling on what a posted
lineup could earn, not a measure of it.

  python3 -I tools/audit/nhl_toi.py --raw .nhl-data/toi --out .nhl-data/audit/out/nhl-toi.md

Fitted on 2025-26, scored unchanged on 2026-27.
"""
import argparse, glob, json, math
import numpy as np, pandas as pd
import statsmodels.formula.api as smf

ap = argparse.ArgumentParser()
ap.add_argument('--raw', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--train', default='20252026'); ap.add_argument('--test', default='20262027')
ap.add_argument('--min-games', type=int, default=5)
args = ap.parse_args()
md = []
def line(s=''): md.append(s)
def table(df, index=True):
    df = df.reset_index() if index else df
    line('| ' + ' | '.join(str(c) for c in df.columns) + ' |'); line('| ' + ' | '.join('---' for _ in df.columns) + ' |')
    for r in df.itertuples(index=False): line('| ' + ' | '.join(f'{x:.2f}' if isinstance(x, float) else str(x) for x in r) + ' |')
    line()

# ── the frame ────────────────────────────────────────────────────────────────────────────────────────────────────────
def load(s, r): return pd.DataFrame([x for f in sorted(glob.glob(f'{args.raw}/{s}/{r}-*.json')) for x in json.load(open(f))['data']])
seasons = (args.train, args.test)
sk = pd.concat([load(s, 'skater-timeonice').assign(season=s) for s in seasons]).drop_duplicates(['gameId', 'playerId'])
pp = pd.concat([load(s, 'team-powerplay').assign(season=s) for s in seasons]).drop_duplicates(['gameId', 'teamId'])
pk = pd.concat([load(s, 'team-penaltykill').assign(season=s) for s in seasons]).drop_duplicates(['gameId', 'teamId'])
for c in ('timeOnIce', 'evTimeOnIce', 'ppTimeOnIce', 'shTimeOnIce'): sk[c] = sk[c].fillna(0) / 60
sk = sk.rename(columns={'timeOnIce': 'toi', 'evTimeOnIce': 'ev', 'ppTimeOnIce': 'pp', 'shTimeOnIce': 'sh', 'teamAbbrev': 'team',
                        'opponentTeamAbbrev': 'opp', 'positionCode': 'pos', 'gameDate': 'date'})
sk['F'] = sk.pos.isin(['C', 'L', 'R'])
teams = sk.groupby('gameId')['team'].agg(lambda x: sorted(set(x)))
def own(r):
    t = [x for x in teams.get(r.gameId, []) if x != r.opponentTeamAbbrev]; return t[0] if len(t) == 1 else None
pp['team'] = pp.apply(own, axis=1); pk['team'] = pk.apply(own, axis=1)
tg = pp[['gameId', 'team', 'gameDate', 'season', 'ppOpportunities', 'ppTimeOnIcePerGame']].merge(
    pk[['gameId', 'team', 'timesShorthanded', 'pkTimeOnIcePerGame']], on=['gameId', 'team'])
tg = tg.rename(columns={'gameDate': 'date', 'ppOpportunities': 'ppo', 'ppTimeOnIcePerGame': 'ppmin', 'timesShorthanded': 'tsh', 'pkTimeOnIcePerGame': 'pkmin'})
tg['ppmin'] /= 60; tg['pkmin'] /= 60

# the matchup's power plays and kills, before the game
tg = tg.sort_values(['date', 'gameId']).reset_index(drop=True)
L = tg.groupby('season')['ppo'].mean().to_dict()
MPP = tg.ppmin.sum() / tg.ppo.sum()
tg['gp'] = tg.groupby(['season', 'team']).cumcount()
for c in ('ppo', 'tsh'): tg[c + 'Pre'] = tg.groupby(['season', 'team'])[c].transform(lambda x: x.shift(1).expanding().mean())
def ratio(r, c):
    v = r[c + 'Pre']; w = r.gp / (r.gp + 10)
    return 1.0 if not np.isfinite(v) else 1 + w * (v / L[r.season] - 1)
tg['drawR'] = tg.apply(lambda r: ratio(r, 'ppo'), axis=1); tg['giveR'] = tg.apply(lambda r: ratio(r, 'tsh'), axis=1)
o = tg[['gameId', 'team', 'drawR', 'giveR']].rename(columns={'team': 'opp', 'drawR': 'oDrawR', 'giveR': 'oGiveR'})
tg = tg.merge(o, on='gameId'); tg = tg[tg.team != tg.opp].copy()
tg['ePPO'] = tg.season.map(L) * tg.drawR ** 0.46 * tg.oGiveR ** 0.42
tg['eTSH'] = tg.season.map(L) * tg.giveR ** 0.42 * tg.oDrawR ** 0.46
tg['ePPmin'] = tg.ePPO * MPP; tg['ePKmin'] = tg.eTSH * MPP

d = sk.merge(tg[['gameId', 'team', 'ppo', 'ppmin', 'tsh', 'pkmin', 'ePPO', 'ePPmin', 'ePKmin']], on=['gameId', 'team'], how='left')
d = d.sort_values(['playerId', 'date', 'gameId']).reset_index(drop=True)
g = d.groupby('playerId')
for c in ('toi', 'ev', 'pp', 'sh', 'ppmin', 'pkmin'): d[c + '10'] = g[c].transform(lambda x: x.shift(1).rolling(10, min_periods=1).sum())
d['toiL5'] = g['toi'].transform(lambda x: x.shift(1).rolling(5, min_periods=1).mean())
d['n'] = g.cumcount(); d['k10'] = d.n.clip(upper=10)
for c in ('toi', 'ev', 'pp', 'sh'): d[c + 'L10'] = d[c + '10'] / d.k10
d['ppShare'] = (d.pp10 / d.ppmin10).where(d.ppmin10 > 0, 0).clip(0, 1)
d['shShare'] = (d.sh10 / d.pkmin10).where(d.pkmin10 > 0, 0).clip(0, 1)
d['evGame10'] = (60 * d.k10 - d.ppmin10 - d.pkmin10) / d.k10
def slot(df, col):
    rk = df.groupby(['gameId', 'team', 'F'])[col].rank(ascending=False, method='first')
    return np.where(df.F, np.minimum(4, np.ceil(rk / 3)), np.minimum(3, np.ceil(rk / 2))).astype(int)
d['evPre'] = d.evL10.fillna(0)
d['slotPre'] = slot(d, 'evPre'); d['slotReal'] = slot(d, 'ev')
d['posK'] = np.where(d.F, 'F', 'D')
d['role'] = np.where(d.ppShare >= 0.45, 'PP1', np.where(d.ppShare >= 0.15, 'PP2', 'none'))
e = d[d.n >= args.min_games].copy()
tr, te = e[e.season == args.train], e[e.season == args.test]

line('# Projected minutes: the line and the power plays (tables)')
line()
line(f'{len(sk):,} skater-games, {len(tg):,} team-games; graded: {len(e):,} skater-games with {args.min_games}+ games before '
     f'({len(tr):,} in {args.train}, {len(te):,} in {args.test}). A power play lasts {MPP:.2f} minutes on average; '
     f'the league\'s power plays a team-game: ' + ', '.join(f'{k} {v:.2f}' for k, v in L.items()) + '.')
line()

# ── A. minutes by line ───────────────────────────────────────────────────────────────────────────────────────────────
line('## A. Minutes a game by line'); line()
line('As played (tonight\'s even-strength rank inside the team: forwards in threes, defencemen in pairs):'); line()
A = e.assign(slot=e.posK + e.slotReal.astype(str)).groupby('slot')[['toi', 'ev', 'pp', 'sh']].mean()
table(A)
line('As projected before the game (the rank of his last-10 even-strength minutes among tonight\'s dressed):'); line()
table(e.assign(slot=e.posK + e.slotPre.astype(str)).groupby('slot')[['toi', 'ev', 'pp', 'sh']].mean())
line(f'The projected slot is the played one for {100 * (e[e.F].slotPre == e[e.F].slotReal).mean():.0f}% of forwards and '
     f'{100 * (e[~e.F].slotPre == e[~e.F].slotReal).mean():.0f}% of defencemen.'); line()
line('By power-play role (his share of the team\'s power-play minutes over his last 10: PP1 ≥ 45%, PP2 ≥ 15%):'); line()
table(e.groupby(['posK', 'role'])[['toi', 'ev', 'pp', 'sh']].mean())

# ── B. what one more power play does, in hindsight ───────────────────────────────────────────────────────────────────
line('## B. What one more power play or kill does to a skater\'s minutes (as it happened)'); line()
line('Least squares of tonight\'s minutes on the team\'s actual power plays and kills, his last 10 as the base.'); line()
rows = []
for (F, role), x in e.groupby(['posK', 'role']):
    m = smf.ols('toi ~ toiL10 + ppo + tsh', data=x).fit(); m2 = smf.ols('pp ~ ppo', data=x).fit(); m3 = smf.ols('ev ~ evL10 + ppo + tsh', data=x).fit()
    rows.append({'pos': F, 'role': role, 'total / PP': m.params.ppo, 'total / kill': m.params.tsh, 'PP min / PP': m2.params.ppo,
                 'EV min / PP': m3.params.ppo, 'EV min / kill': m3.params.tsh, 'n': len(x)})
table(pd.DataFrame(rows), index=False)

# ── C. how well the matchup's power plays are foreseen ──────────────────────────────────────────────────────────────
line('## C. The matchup\'s power plays, foreseen'); line()
t = d.drop_duplicates(['gameId', 'team'])
rows = [{'season': s, 'corr(forecast, actual)': x.ePPO.corr(x.ppo), 'MAE forecast': (x.ePPO - x.ppo).abs().mean(),
         'MAE league mean': (x.ppo - x.ppo.mean()).abs().mean(), 'forecast p5': x.ePPO.quantile(.05), 'forecast p95': x.ePPO.quantile(.95)}
        for s, x in t.groupby('season')]
table(pd.DataFrame(rows), index=False)
x = e[e.F & (e.role == 'PP1')].copy(); x['fifth'] = pd.qcut(x.ePPO, 5, labels=False) + 1
line('First-unit forwards by fifth of the forecast (tonight\'s minutes against his last 10):'); line()
table(x.groupby('fifth').apply(lambda s: pd.Series({'forecast PP': s.ePPO.mean(), 'actual PP': s.ppo.mean(),
      'toi − L10': (s.toi - s.toiL10).mean(), 'PP min − L10': (s.pp - s.ppL10).mean(), 'n': len(s)}, dtype=object)))

# ── D. the projections, scored ───────────────────────────────────────────────────────────────────────────────────────
FLOOR = {('D', 1): 21.0, ('D', 2): 18.5, ('D', 3): 16.0, ('F', 1): 18.5, ('F', 2): 16.0, ('F', 3): 13.5, ('F', 4): 11.0}
fl = lambda df, s: np.array([FLOOR[(p, int(k))] for p, k in zip(df.posK, df[s])])
slotMean = tr.groupby(['posK', 'slotReal']).toi.mean()
for df in (e,):
    df['slotMeanReal'] = [slotMean[(p, k)] for p, k in zip(df.posK, df.slotReal)]
    df['slotMeanPre'] = [slotMean[(p, k)] for p, k in zip(df.posK, df.slotPre)]
reads = {
    'his last 10': e.toiL10, 'his last 5': e.toiL5,
    'the model now, projected slot (max(L5, floor))': np.maximum(e.toiL5, fl(e, 'slotPre')),
    'the model now, slot as played (max(L5, floor))': np.maximum(e.toiL5, fl(e, 'slotReal')),
    'split: EV L10 + PP share × league PP min + kill share × league PK min':
        e.evL10 * (60 - 2 * MPP * e.season.map(L)) / e.evGame10 + (e.ppShare + e.shShare) * MPP * e.season.map(L),
    'split: … × the matchup\'s PP / PK minutes': e.evL10 * (60 - e.ePPmin - e.ePKmin) / e.evGame10 + e.ppShare * e.ePPmin + e.shShare * e.ePKmin,
    'split: … × the actual PP / PK minutes (hindsight)': e.evL10 * (60 - e.ppmin - e.pkmin) / e.evGame10 + e.ppShare * e.ppmin + e.shShare * e.pkmin,
}
fits = {
    'fit: L10 + L5': 'toi ~ toiL10 + toiL5',
    'fit: + projected slot': 'toi ~ toiL10 + toiL5 + slotMeanPre',
    'fit: + projected slot + PP role × matchup': 'toi ~ toiL10 + toiL5 + slotMeanPre + I(ppShare*ePPmin) + I(shShare*ePKmin) + ePPmin + ePKmin',
    'fit: + slot as played (ceiling)': 'toi ~ toiL10 + toiL5 + slotMeanReal',
    'fit: + slot as played + PP role (league PP min)': 'toi ~ toiL10 + toiL5 + slotMeanReal + ppShare + shShare',
    'fit: + slot as played + PP role × matchup': 'toi ~ toiL10 + toiL5 + slotMeanReal + I(ppShare*ePPmin) + I(shShare*ePKmin) + ePPmin + ePKmin',
    'fit: + slot as played + PP role × actual PP (hindsight)': 'toi ~ toiL10 + toiL5 + slotMeanReal + I(ppShare*ppmin) + I(shShare*pkmin) + ppmin + pkmin',
}
params = {}
for k, f in fits.items():
    m = smf.ols(f, data=e[e.season == args.train]).fit(); reads[k] = m.predict(e); params[k] = m.params
rows = []
for k, p in reads.items():
    r = {'read': k}
    for s in seasons:
        msk = e.season == s; err = p[msk] - e.toi[msk]
        r[f'{s} MAE'] = err.abs().mean(); r[f'{s} bias'] = err.mean()
    rows.append(r)
line('## D. The projections, scored (minutes; the fits on ' + args.train + ', scored unchanged on ' + args.test + ')'); line()
table(pd.DataFrame(rows), index=False)
for k in ('fit: + projected slot + PP role × matchup', 'fit: + slot as played (ceiling)', 'fit: + slot as played + PP role (league PP min)'):
    line(f'- {k}: ' + ', '.join(f'{n} {v:+.3f}' for n, v in params[k].items()))
line()

# ── E. a line change ─────────────────────────────────────────────────────────────────────────────────────────────────
line('## E. A skater who played a different slot than his recent minutes say (' + args.test + ')'); line()
te = e[e.season == args.test].assign(moved=lambda x: np.sign(x.slotPre - x.slotReal).map({1: 'up', 0: 'same', -1: 'down'}))
te['the model now'] = np.maximum(te.toiL5, fl(te, 'slotReal')); te['fit with the slot'] = reads['fit: + slot as played + PP role (league PP min)'][te.index]
table(te.groupby('moved').agg(n=('toi', 'size'), toi=('toi', 'mean'), L10=('toiL10', 'mean'), model_now=('the model now', 'mean'),
                              fit_with_slot=('fit with the slot', 'mean')))

open(args.out, 'w').write('\n'.join(md) + '\n'); print('wrote', args.out)

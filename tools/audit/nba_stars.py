#!/usr/bin/env python3
"""Is the board too conservative with the big players — in a soft matchup, with a teammate out? (Vincent, 2026-11-13.)

Reads the site's board replayed (tools/audit/nba-audit.mjs --marks: <tag>-rows.csv with every projection and its parts,
<tag>-marks.csv with the site's chance at round marks) on one or more seasons and prints, per stat: the projection against
what landed for the big players by the opponent's third, the teammates out and the team ceiling's cut; the chance at the
marks said against landed on the same cuts; a Poisson read of each part on top of the projection (a coefficient over 0 =
the board under-reads that part, under 0 = over-reads it); and, with --variants, other cocktails on the same player-games.

  python3 -I tools/audit/nba_stars.py --run .nhl-data/audit/run --seasons 2025-26:2026-04-12 2026-27:2026-11-12 \\
      --box .nhl-data/audit/nba-box --variants reach0 floor9 pow5 --out docs/audits/2026-11-13-nba-stars-tables.md

--box joins nba_what_it_takes.py's rows (his three-point attempts over his last ten) for the threes' cut by volume.
Needs pandas and statsmodels.
"""
import argparse, os, sys
import numpy as np, pandas as pd
import statsmodels.api as sm

ap = argparse.ArgumentParser()
ap.add_argument('--run', required=True); ap.add_argument('--seasons', nargs='+', required=True); ap.add_argument('--tag', default='site')
ap.add_argument('--variants', nargs='*', default=[]); ap.add_argument('--box', default=None); ap.add_argument('--out', default=None)
args = ap.parse_args()
SEAS = [x.split(':') for x in args.seasons]
BIG = {'pts': 20, 'reb': 8, 'ast': 6, 'tpm': 2.5, 'pra': 32}
STAR = {'pts': 22, 'reb': 8, 'ast': 6, 'tpm': 2.3, 'pra': 33}
NAME = {'pts': 'Points', 'reb': 'Rebounds', 'ast': 'Assists', 'tpm': 'Threes', 'pra': 'PRA'}
KEYS = ['slate', 'game', 'team', 'key', 'market']
out = []
def w(s=''): out.append(s)

def rows(date, tag):
    d = pd.read_csv(os.path.join(args.run, f'nba-{date}-{tag}-rows.csv'))
    return d[(~d.out) & (d.actualMin > 0) & (d.exp > 0)]
R = {lab: rows(date, args.tag) for lab, date in SEAS}

GROUPS = [('everyone', lambda x: x.exp > -1), ('the big players', lambda x: x.big), ('big, opponent in the soft third', lambda x: x.big & (x.teamRank <= 10)), ('big, opponent top five', lambda x: x.big & (x.teamRank <= 5)),
          ('big, top five at his position', lambda x: x.big & (x['rank'] <= 5)), ('big, opponent in the tough third', lambda x: x.big & (x.teamRank >= 21)),
          ('big, a teammate out (lifted 3%+)', lambda x: x.big & (x.outM.fillna(1) > 1.03)), ('big, soft third and a teammate out', lambda x: x.big & (x.teamRank <= 10) & (x.outM.fillna(1) > 1.03)),
          ('big, nobody out', lambda x: x.big & (x.outM.fillna(1) <= 1)), ('big, the team ceiling cut 8%+', lambda x: x.big & (x.teamScale.fillna(1) <= 0.92)), ('big, no ceiling cut', lambda x: x.big & (x.teamScale.fillna(1) >= 0.999))]

w('# The big players: the board against what landed'); w()
w('The site\'s board replayed (`nba-audit.mjs --cocktail site --marks`), every active player who played. "Big" = projected ' + ', '.join(f'{v}+ {NAME[k].lower()}' for k, v in BIG.items()) + '. The opponent\'s third is its rank in what it allows to all positions this season (1 = the most); "at his position" is the PropFinder-shaped cell. Bias = projected − landed (+ = the board ran high).'); w()
w('## The projection'); w()
for m in BIG:
    w(f'### {NAME[m]}'); w(); w('| | ' + ' | '.join(f'{lab}: n | projected | landed | bias | average miss | over his ceiling' for lab, _ in SEAS) + ' |'); w('| --- |' + ' ---: |' * (6 * len(SEAS)))
    for gname, gf in GROUPS:
        cells = []
        for lab, _ in SEAS:
            x = R[lab]; x = x[x.market == m]; x = x.assign(big=x.exp >= BIG[m]); x = x[gf(x)]
            cells.append(f'{len(x)} | {x.exp.mean():.2f} | {x.actual.mean():.2f} | {(x.exp - x.actual).mean():+.2f} | {(x.exp - x.actual).abs().mean():.2f} | {(x.actual > x.ceiling).mean() * 100:.0f}%' if len(x) >= 30 else f'{len(x)} | — | — | — | — | —')
        w(f'| {gname} | ' + ' | '.join(cells) + ' |')
    w()

w('## Each part on top of the projection'); w()
w('Poisson, the projection as the offset: log(landed / projected) on the log of each part the board multiplied in. 0 = the part is read right; −0.5 = it should count half; + = it should count more. z in brackets.'); w()
PARTS = [('lm', 'the matchup factor'), ('lo', 'the teammates-out factor'), ('lt', 'the team ceiling\'s cut'), ('ll', 'the lineup\'s minutes factor'), ('big', 'a big projection'), ('softPos', 'a top-ten cell at his position (the ceiling read)')]
w('| | ' + ' | '.join(f'{lab}: {NAME[m]}' for lab, _ in SEAS for m in BIG) + ' |'); w('| --- |' + ' ---: |' * (len(SEAS) * len(BIG)))
fits = {}
for lab, _ in SEAS:
    for m in BIG:
        x = R[lab]; x = x[x.market == m].copy()
        x['lm'] = np.log(x.matchup.fillna(1).clip(.5, 2)); x['lo'] = np.log(x.outM.fillna(1).clip(.5, 3)); x['lt'] = np.log(x.teamScale.fillna(1).clip(.3, 2)); x['ll'] = np.log(x.lineup.fillna(1).clip(.3, 3))
        x['big'] = (x.exp >= BIG[m]).astype(float); x['softPos'] = (x['rank'] <= 10).astype(float)
        fits[(lab, m)] = sm.GLM(x.actual, sm.add_constant(x[[p for p, _ in PARTS]]), family=sm.families.Poisson(), offset=np.log(x.exp)).fit(cov_type='HC1')
for p, label in PARTS:
    w(f'| {label} | ' + ' | '.join(f'{fits[(lab, m)].params[p]:+.2f} ({fits[(lab, m)].params[p] / fits[(lab, m)].bse[p]:+.1f})' for lab, _ in SEAS for m in BIG) + ' |')
w()

# the chance at the marks
box = None
if args.box and os.path.exists(os.path.join(args.box, 'what-it-takes-rows.pkl')):
    box = pd.read_pickle(os.path.join(args.box, 'what-it-takes-rows.pkl'))[['id', 'date', 'l10_tpa']].rename(columns={'id': 'espnId', 'date': 'slate'}); box['espnId'] = box.espnId.astype(str)
M = {}
for lab, date in SEAS:
    f = os.path.join(args.run, f'nba-{date}-{args.tag}-marks.csv')
    if not os.path.exists(f): continue
    x = pd.read_csv(f).merge(R[lab][['slate', 'key', 'team', 'market', 'teamRank', 'rank', 'outM', 'teamScale', 'ownSeason']], on=['slate', 'key', 'team', 'market'])
    x['hit'] = (x.actual >= x.mark).astype(int); x['espnId'] = x.espnId.astype(str).str.replace(r'\.0$', '', regex=True)
    if box is not None: x = x.merge(box, on=['espnId', 'slate'], how='left')
    M[lab] = x
if M:
    w('## The chance at a mark: said against landed'); w()
    w('The site\'s figure at the mark (the shuffle\'s read: the court\'s, the stat lists\' and the card\'s number), before the calibration\'s fit. "Stars" = ' + ', '.join(f'{v}+ {NAME[k].lower()}' for k, v in STAR.items()) + ' a game this season.'); w()
    CUTS = [('everyone', lambda d: d.p > -1), ('stars', lambda d: d.star), ('stars, opponent in the soft third', lambda d: d.star & (d.teamRank <= 10)), ('stars, opponent top five', lambda d: d.star & (d.teamRank <= 5)), ('stars, top five at his position', lambda d: d.star & (d['rank'] <= 5)),
            ('stars, opponent in the tough third', lambda d: d.star & (d.teamRank >= 21)), ('stars, a teammate out (lifted 3%+)', lambda d: d.star & (d.outM.fillna(1) > 1.03)), ('stars, soft third and a teammate out', lambda d: d.star & (d.teamRank <= 10) & (d.outM.fillna(1) > 1.03)),
            ('stars, nobody out', lambda d: d.star & (d.outM.fillna(1) <= 1)), ('stars, the team ceiling cut 8%+', lambda d: d.star & (d.teamScale.fillna(1) <= 0.92)),
            ('said under 20%', lambda d: d.p < .2), ('said 20–40%', lambda d: (d.p >= .2) & (d.p < .4)), ('said 40–60%', lambda d: (d.p >= .4) & (d.p < .6)), ('said 60%+', lambda d: d.p >= .6)]
    VOLC = [(f'his 3PA last ten {a}–{b}', (lambda d, a=a, b=b: (d.l10_tpa >= a) & (d.l10_tpa < b))) for a, b in [(0, 4), (4, 6), (6, 8), (8, 10), (10, 30)]]
    for m, marks in [('pts', [25, 30, 35]), ('tpm', [3, 4, 5]), ('reb', [10, 12]), ('ast', [8, 10]), ('pra', [40, 45])]:
        for mk in marks:
            w(f'### {mk}+ {NAME[m].lower()}'); w(); w('| | ' + ' | '.join(f'{lab}: n | said | landed' for lab in M) + ' |'); w('| --- |' + ' ---: |' * (3 * len(M)))
            for cname, cf in CUTS + (VOLC if m == 'tpm' and box is not None else []):
                cells = []
                for lab, x in M.items():
                    d = x[(x.market == m) & (x.mark == mk)]; d = d.assign(star=d.ownSeason >= STAR[m]); d = d[cf(d)]
                    cells.append(f'{len(d)} | {d.p.mean() * 100:.1f}% | {d.hit.mean() * 100:.1f}%' if len(d) >= 30 else f'{len(d)} | — | —')
                w(f'| {cname} | ' + ' | '.join(cells) + ' |')
            w()

if args.variants:
    w('## Other cocktails on the same player-games'); w()
    w('Average miss / bias. `noceil` = no team ceiling, `pow5` = half the ceiling\'s cut (`ceilingPower` 0.5), `floor9` = the cut capped at 10% (`ceilingFloor` 0.9), `reach0` = the ceiling read off (`reach` 0), `ast5` = the assists\' matchup exponents halved, `out6` = the teammates-out exponents for rebounds and threes at 0.6 and 0.7 (0.3 and 0.4 on the site).'); w()
    VG = [('everyone', lambda x: x.exp0 > -1), ('the big players', lambda x: x.big), ('big, soft third', lambda x: x.big & (x.teamRank <= 10)), ('big, a teammate out', lambda x: x.big & (x.outM.fillna(1) > 1.03)), ('big, nobody out', lambda x: x.big & (x.outM.fillna(1) <= 1)), ('big, ceiling cut 10%+', lambda x: x.big & (x.ts0.fillna(1) <= .9))]
    for lab, date in SEAS:
        tags = [args.tag] + [t for t in args.variants if os.path.exists(os.path.join(args.run, f'nba-{date}-{t}-rows.csv'))]
        D = {t: pd.read_csv(os.path.join(args.run, f'nba-{date}-{t}-rows.csv'))[KEYS + ['exp']] for t in tags[1:]}
        b0 = R[lab][KEYS + ['exp', 'teamScale', 'teamRank', 'outM', 'actual']].rename(columns={'teamScale': 'ts0'}); b0['exp0'] = b0.exp
        w(f'### {lab}'); w(); w('| | | ' + ' | '.join(tags) + ' |'); w('| --- | --- |' + ' ---: |' * len(tags))
        for m in BIG:
            for gname, gf in VG:
                cells = []
                for t in tags:
                    x = b0 if t == args.tag else b0.drop(columns='exp').merge(D[t], on=KEYS)
                    x = x[x.market == m]; x = x.assign(big=x.exp0 >= BIG[m]); x = x[gf(x)]
                    cells.append(f'{(x.exp - x.actual).abs().mean():.3f} / {(x.exp - x.actual).mean():+.2f}')
                w(f'| {NAME[m]} | {gname} | ' + ' | '.join(cells) + ' |')
        w()
if args.out: open(args.out, 'w').write('\n'.join(out) + '\n'); print('written', args.out, file=sys.stderr)
else: print('\n'.join(out))

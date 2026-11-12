"""Power-play shots allowed by position, per defending team (from pp_shots.mjs), and whether it holds.

Per team: its games, power-play shots on goal allowed a game, the share that went to C / LW / RW / D against the
league's share (the lean), and per game to each position (penalties taken x where the shots go: what a prop sees).
Then the test: on a finished season, each team's figures over its first half of games against its second half
(Pearson across teams), for the per-game figures and the shares, with even strength beside them for scale.
Usage: python3 -I tools/predictors/pp_shots.py <season pp_shots.csv> [<finished season pp_shots.csv>]
"""
import sys
import numpy as np
import pandas as pd

POS = ['C', 'LW', 'RW', 'D']


def table(d, strength='pp', typ=('sog',)):
    gp = d.groupby('opp').gameId.nunique()
    x = d[(d.strength == strength) & d.type.isin(typ)]
    by = x.groupby(['opp', 'pos']).size().unstack(fill_value=0).reindex(columns=POS, fill_value=0)
    t = pd.DataFrame({'gp': gp}).join(by).fillna(0)
    t['total'] = t[POS].sum(axis=1)
    for p in POS:
        t[f'{p}/g'] = t[p] / t.gp
        t[f'{p}%'] = t[p] / t.total.replace(0, np.nan)
    t['total/g'] = t.total / t.gp
    return t


cur = pd.read_csv(sys.argv[1])
t = table(cur)
lg = {p: t[p].sum() / t.total.sum() for p in POS}
print(f"League: power-play SOG {t.total.sum() / t.gp.sum():.2f} a team-game · share C {lg['C']:.1%} LW {lg['LW']:.1%} RW {lg['RW']:.1%} D {lg['D']:.1%}\n")
for p in POS:
    t[f'{p} lean'] = t[f'{p}%'] - lg[p]
t['leans to'] = t[[f'{p} lean' for p in POS]].idxmax(axis=1).str.replace(' lean', '')
t['most a game'] = t[[f'{p}/g' for p in POS]].idxmax(axis=1).str.replace('/g', '')
show = t.sort_values('total/g', ascending=False)
print(f"{'team':<5}{'GP':>4}{'PP SOG/g':>9}   {'C/g':>5}{'LW/g':>6}{'RW/g':>6}{'D/g':>6}   {'C%':>5}{'LW%':>5}{'RW%':>5}{'D%':>5}   leans to (share over league)")
for team, r in show.iterrows():
    lean = r['leans to']
    print(f"{team:<5}{int(r.gp):>4}{r['total/g']:>9.2f}   {r['C/g']:>5.2f}{r['LW/g']:>6.2f}{r['RW/g']:>6.2f}{r['D/g']:>6.2f}   {r['C%']:>5.0%}{r['LW%']:>5.0%}{r['RW%']:>5.0%}{r['D%']:>5.0%}   {lean} {r[f'{lean} lean']:+.0%} ({int(r[lean])} of {int(r.total)})")
print('\nRank 1 = allows the most a game, per position:')
for p in POS:
    top = t[f'{p}/g'].sort_values(ascending=False).head(5)
    print(f"  {p:<3}" + ' · '.join(f'{k} {v:.2f}' for k, v in top.items()))

if len(sys.argv) > 2:
    prev = pd.read_csv(sys.argv[2])
    g = prev[['opp', 'gameId', 'date']].drop_duplicates().sort_values('date')
    g['n'] = g.groupby('opp').cumcount()
    half = g.groupby('opp').n.transform('max') / 2
    g['half'] = np.where(g.n <= half, 1, 2)
    prev = prev.merge(g[['opp', 'gameId', 'half']], on=['opp', 'gameId'])
    print(f'\nDoes it hold? {sys.argv[2]}: each team\'s first half of games against its second half (r across 32 teams)')
    print(f"{'':<34}{'C':>7}{'LW':>7}{'RW':>7}{'D':>7}{'all':>7}")
    for strength, typ, label in [('pp', ('sog',), 'power-play SOG'), ('pp', ('sog', 'miss', 'block'), 'power-play attempts'), ('ev', ('sog',), 'even-strength SOG (for scale)')]:
        a, b = table(prev[prev.half == 1], strength, typ), table(prev[prev.half == 2], strength, typ)
        pg = [np.corrcoef(a[f'{p}/g'], b[f'{p}/g'])[0, 1] for p in POS] + [np.corrcoef(a['total/g'], b['total/g'])[0, 1]]
        sh = [np.corrcoef(a[f'{p}%'], b[f'{p}%'])[0, 1] for p in POS]
        print(f"  {label + ', a game':<32}" + ''.join(f'{v:>7.2f}' for v in pg))
        print(f"  {label + ', share':<32}" + ''.join(f'{v:>7.2f}' for v in sh))

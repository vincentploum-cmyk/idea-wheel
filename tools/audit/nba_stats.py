"""The NBA projections, one stat at a time, from the board's replay rows (tools/audit/nba-audit.mjs, -rows.csv).

  report <rows.csv> [label]    how far off each stat is (points, rebounds, assists, threes, PRA): the average and
                               median miss, the bias, against plain reads; how much of the miss is his minutes; by
                               the size of his projection and by his games this season; each ingredient taken out
  pull <fit rows> <test rows>  the pull toward his role a stat at a time (lib/nba/picks.js COCKTAIL.pull): K fitted
                               on the fit season's first two weeks, scored on the test season; run on rows built
                               without the pull ('{"pull":null}' over the cocktail)

The first run is written up in docs/audits/2026-10-29-nba-projections.md. Needs numpy and pandas.
"""
import sys, json, numpy as np, pandas as pd


def report(f, label):
    d = pd.read_csv(f)
    num = ['exp', 'rate', 'matchup', 'teamScale', 'env', 'lift', 'minFactor', 'actual', 'actualMin', 'gp', 'rawMatchup', 'matchupWeight', 'nThis', 'ownSeason', 'ownL10', 'ownL5', 'minTonight', 'minBase']
    for c in num: d[c] = pd.to_numeric(d[c], errors='coerce')
    d = d[d.exp.notna() & d.actual.notna()].copy()
    d['teamScale'] = d.teamScale.fillna(1.0); d['matchup'] = d.matchup.fillna(1.0); d['minFactor'] = d.minFactor.fillna(1.0); d['lift'] = d.lift.fillna(0.0)
    ST = [('pts', 'Points', 4, [10, 20]), ('reb', 'Rebounds', 2, [4, 8]), ('ast', 'Assists', 2, [2, 5]), ('tpm', 'Threes', 1, [1, 2.5]), ('pra', 'Pts + reb + ast', 6, [15, 30])]
    mae = lambda e: float(np.mean(np.abs(e)))
    out = []; P = out.append
    def tbl(head, rows):
        P('| ' + ' | '.join(head) + ' |'); P('|' + ' --- |' * len(head))
        for r in rows: P('| ' + ' | '.join(str(x) for x in r) + ' |')
        P('')
    P(f'## {label}\n')
    P('### How far off, stat by stat\n')
    rows = []
    for s, name, band, _ in ST:
        x = d[d.market == s]; e = x.exp - x.actual
        rows.append([name, len(x), f'{x.exp.mean():.1f}', f'{x.actual.mean():.1f}', f'{e.mean():+.2f}', f'{mae(e):.2f}', f'{np.median(np.abs(e)):.1f}', f'{100 * mae(e) / x.actual.mean():.0f}%', f'±{band}: {100 * (np.abs(e) <= band).mean():.0f}%', f'{100 * (e > 0).mean():.0f}% / {100 * (e < 0).mean():.0f}%'])
    tbl(['Stat', 'player-games', 'avg projected', 'avg actual', 'bias (proj − actual)', 'avg miss', 'median miss', 'miss / his figure', 'within', 'over / under'], rows)
    P('### Against plain reads (avg miss)\n')
    rows = []
    for s, name, band, _ in ST:
        x = d[d.market == s]
        l10 = x[x.ownL10.notna()]; sz = x[x.ownSeason.notna()]
        rows.append([name, f'{mae(x.exp - x.actual):.2f}', f'{mae(l10.ownL10 - l10.actual):.2f}', f'{mae(sz.ownSeason - sz.actual):.2f}', f'{mae((x.exp * x.actualMin / x.minTonight - x.actual)[x.minTonight > 0]):.2f}'])
    tbl(['Stat', 'the projection', 'his last ten (as the board reads it)', 'his season (as the board reads it)', 'the projection, had we known his minutes'], rows)
    P('### Where the miss comes from: his minutes against what he did with them\n')
    P('Minutes surprise = the minutes he played against the minutes the board read for him tonight.\n')
    rows = []
    x0 = d[(d.market == 'pts') & d.minTonight.notna() & d.actualMin.notna()]
    cuts = [('within 4 minutes', 0, 4), ('4–8 off', 4, 8), ('8–14 off', 8, 14), ('14+ off', 14, 99)]
    for s, name, band, _ in ST:
        x = d[(d.market == s) & d.minTonight.notna() & d.actualMin.notna()]
        sur = (x.actualMin - x.minTonight).abs()
        cells = []
        for lab, a, b in cuts:
            y = x[(sur >= a) & (sur < b)]
            cells.append(f'{100 * len(y) / len(x):.0f}% · {mae(y.exp - y.actual):.2f}' if len(y) else '—')
        known = mae((x.exp * x.actualMin / x.minTonight - x.actual)[x.minTonight > 0])
        rows.append([name] + cells + [f'{mae(x.exp - x.actual):.2f} → {known:.2f}'])
    tbl(['Stat (share of rows · avg miss)'] + [c[0] for c in cuts] + ['avg miss → had we known his minutes'], rows)
    P('### By the size of his projection\n')
    rows = []
    for s, name, band, (a, b) in ST:
        x = d[d.market == s]
        for lab, lo, hi in [(f'under {a}', -1, a), (f'{a}–{b}', a, b), (f'{b}+', b, 999)]:
            y = x[(x.exp >= lo) & (x.exp < hi)]
            if len(y): rows.append([name, lab, len(y), f'{y.exp.mean():.1f}', f'{y.actual.mean():.1f}', f'{(y.exp - y.actual).mean():+.2f}', f'{mae(y.exp - y.actual):.2f}', f'{100 * mae(y.exp - y.actual) / max(y.actual.mean(), 0.1):.0f}%'])
    tbl(['Stat', 'projected', 'n', 'avg projected', 'avg actual', 'bias', 'avg miss', 'miss / his figure'], rows)
    P('### By his games this season\n')
    rows = []
    for s, name, band, _ in ST:
        x = d[d.market == s]
        cells = []
        for lab, lo, hi in [('0', 0, 1), ('1–2', 1, 3), ('3–5', 3, 6), ('6–15', 6, 16), ('16+', 16, 999)]:
            y = x[(x.nThis >= lo) & (x.nThis < hi)]
            cells.append(f'{mae(y.exp - y.actual):.2f} ({len(y)})' if len(y) else '—')
        rows.append([name] + cells)
    tbl(['Stat: avg miss (n), by his games this season before the night', '0', '1–2', '3–5', '6–15', '16+'], rows)
    P('### The ingredients, one at a time (avg miss; the projection rebuilt without each)\n')
    rows = []
    for s, name, band, _ in ST:
        x = d[d.market == s]
        base = mae(x.exp - x.actual)
        nomu = mae(x.exp / x.matchup - x.actual)
        noteam = mae(x.exp / x.teamScale - x.actual)
        nolift = mae((x.rate - x.lift) * x.env - x.actual)
        # the minutes cut out: his rate before the factor
        nomin = mae((((x.rate - x.lift) / x.minFactor) + x.lift) * x.env - x.actual)
        def atK(K):
            g = x.gp.fillna(0); raw = x.rawMatchup.fillna(1.0)
            m = 1 + (raw - 1) * np.where(g > 0, g / (g + K), 0) if K > 0 else raw.where(g > 0, 1.0)
            return mae(x.exp / x.matchup * m - x.actual)
        rows.append([name, f'{base:.3f}', f'{nomu:.3f}', f'{atK(10):.3f}', f'{atK(0):.3f}', f'{noteam:.3f}', f'{nolift:.3f}', f'{nomin:.3f}'])
    tbl(['Stat', 'as shipped', 'no matchup', 'matchup at gp/(gp+10)', 'matchup undamped', 'no team ceiling', 'no out-teammate lift', 'no minutes cut'], rows)
    P('How often each ingredient moved the figure, and by how much:\n')
    rows = []
    for s, name, band, _ in ST:
        x = d[d.market == s]
        rows.append([name, f'{100 * (np.abs(x.matchup - 1) > 0.005).mean():.0f}% (avg {np.abs(x.matchup - 1)[np.abs(x.matchup - 1) > 0.005].mean() * 100 if (np.abs(x.matchup - 1) > 0.005).any() else 0:.1f}%)', f'{100 * (x.teamScale < 0.995).mean():.0f}% (avg {(1 - x.teamScale[x.teamScale < 0.995]).mean() * 100 if (x.teamScale < 0.995).any() else 0:.1f}%)', f'{100 * (x.lift > 0).mean():.0f}% (avg +{x.lift[x.lift > 0].mean() if (x.lift > 0).any() else 0:.2f})', f'{100 * (x.minFactor < 0.995).mean():.0f}% (avg {(1 - x.minFactor[x.minFactor < 0.995]).mean() * 100 if (x.minFactor < 0.995).any() else 0:.1f}% off)'])
    tbl(['Stat', 'matchup moved it', 'team ceiling cut it', 'out-teammate lift', 'minutes cut'], rows)
    return '\n'.join(out)


def pull(fit_f, test_f):
    def load(f):
        d = pd.read_csv(f)
        for c in ['exp', 'rate', 'lift', 'minFactor', 'env', 'actual', 'actualMin', 'minTonight', 'minBase', 'nThis']: d[c] = pd.to_numeric(d[c], errors='coerce')
        d = d[d.exp.notna() & d.actual.notna()].copy()
        d['lift'] = d.lift.fillna(0); d['minFactor'] = d.minFactor.fillna(1); d['env'] = d.env.fillna(1)
        d['pg'] = d.pos.map(lambda p: 'G' if p in ('PG', 'SG', 'G') else 'C' if p == 'C' else 'F')
        return d.reset_index(drop=True)
    fit, test = load(fit_f), load(test_f)
    CONST = fit[fit.actualMin >= 5].groupby(['market', 'pg']).apply(lambda x: round(x.actual.sum() / x.actualMin.sum(), 4)).to_dict()
    print('per-minute constants (2025-26):', json.dumps({f'{m}.{g}': v for (m, g), v in CONST.items() if m in ('pts', 'reb', 'ast', 'tpm', 'pra')}))
    def per_min(d):
        out = np.zeros(len(d)); played = d[d.actualMin >= 5]
        for sl in sorted(d.slate.unique()):
            prev = played[played.slate < sl]; idx = d.index[d.slate == sl]
            for (m, g), sub in d.loc[idx].groupby(['market', 'pg']):
                p = prev[(prev.market == m) & (prev.pg == g)]
                out[sub.index] = (p.actual.sum() + 2000 * CONST.get((m, g), 0)) / (p.actualMin.sum() + 2000)
        d['rateMin'] = out; return d
    fit, test = per_min(fit), per_min(test)
    mae = lambda e: float(np.mean(np.abs(e)))
    def shrunk(d, K):
        base = (d.rate - d.lift) / d.minFactor
        prior = d.rateMin * d.minBase
        ok = d.minBase.notna() & (d.nThis > 0)
        w = np.where(ok, d.nThis / (d.nThis + K), 1.0) if K > 0 else 1.0
        b2 = np.where(ok, prior + w * (base - prior), base)
        return (b2 * d.minFactor + d.lift) * d.env
    Ks = [0, 0.5, 1, 1.5, 2, 3, 4, 6, 8]
    print('| Stat | K | 2025-26 days 1–14 | 2025-26 all | 2026-27: avg miss | 2026-27 bias | 2026-27 stretch |')
    print('| --- | --- | --- | --- | --- | --- | --- |')
    for s in ['pts', 'reb', 'ast', 'tpm', 'pra']:
        F = fit[fit.market == s]; T = test[test.market == s]
        early = (pd.to_datetime(F.slate) - pd.Timestamp('2025-10-21')).dt.days < 14
        score = {K: mae(shrunk(F[early], K) - F[early].actual) for K in Ks}
        K = min(score, key=score.get)
        print(f"| {s} | {K} | {score[0]:.3f} → {score[K]:.3f} | {mae(F.exp - F.actual):.3f} → {mae(shrunk(F, K) - F.actual):.3f} | {mae(T.exp - T.actual):.3f} → {mae(shrunk(T, K) - T.actual):.3f} | {(T.exp - T.actual).mean():+.2f} → {(shrunk(T, K) - T.actual).mean():+.2f} | {np.polyfit(T.exp, T.actual, 1)[0]:.2f} → {np.polyfit(shrunk(T, K), T.actual, 1)[0]:.2f} |")
        print('|  | ' + ', '.join(f'{k}: {v:.3f}' for k, v in score.items()) + ' | | | | | |')


if __name__ == '__main__':
    if sys.argv[1] == 'report': print(report(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else sys.argv[2]))
    elif sys.argv[1] == 'pull': pull(sys.argv[2], sys.argv[3])
    else: sys.exit(__doc__)

# This season only, on the site's stored pre-game PropFinder reads: when PropFinder's defense table has tonight's
# opponent in the top third ("allows a lot", green; 1-11 of 32 as rankThird in pf-ui.jsx), amber or the bottom third
# (red), did the skaters beat their own PropFinder rate, and the book's main line? Shots on the SOG rank, goals on the
# G and ISCF ranks, by the opponent's row at the skater's PropFinder position and by its All row, per window the export
# carries (season, L5). Then home / away this season from the box scores (PropFinder publishes no venue split).
#
# python3 -I tools/predictors/pf_allows.py <study export json> <this season's games dir (fetch.mjs)>
# The export: /api/nhl/data/study-export?from=2026-10-01 (signed in as admin).
import json, glob, os, sys, math, re, unicodedata
from collections import defaultdict
import numpy as np, pandas as pd


def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z]', '', s)


def third(rank, n=32):
    if not rank: return None
    if rank <= math.ceil(n / 3): return 'soft'
    if rank > n - math.floor(n / 3): return 'tough'
    return 'mid'


def p_at_least(lam, k):
    return 1 - sum(math.exp(-lam) * lam ** i / math.factorial(i) for i in range(k))


def load_games(d):
    rows = []
    for f in sorted(glob.glob(os.path.join(d, '*.json'))):
        for g in json.load(open(f))['games']:
            if g.get('gameType') != 2: continue
            for s in g['skaters']:
                rows.append(dict(gid=g['id'], date=g['date'], pid=s['id'], name=s['name'], key=norm(s['name']), last=norm(s['name'].split(' ')[-1]),
                                 team=s['team'], opp=s['opp'], venue=s['venue'], pos=s['pos'], toi=s['toi'], sog=s['sog'], g=s['g']))
    return pd.DataFrame(rows)


def wtag(w, season_w):
    if w == season_w: return 'season'
    m = re.search(r'(\d+)', w or '')
    return f'l{m.group(1)}' if m else re.sub(r'\W', '', (w or 'x').lower())


def implied(odds):
    if odds is None: return None
    return 100 / (odds + 100) if odds > 0 else -odds / (-odds + 100)


def build(export, R):
    out = []
    unmatched = 0; total = 0
    for sl in export['slates']:
        d = sl['date']
        box = R[R.date == d]
        if box.empty: continue
        ranks = {}
        for r in sl['defense']:
            ranks[(r['window'], r['team'], (r['pos'] or 'All'))] = r
        windows = sorted({r['window'] for r in sl['defense']} | {s['window'] for s in sl['skaters']})
        pf = {}
        for s in sl['skaters']:
            pf[(s['window'], s['team'], norm(s['name']))] = s
        props = {}
        for s in (sl.get('props') or {}).get('skaters', []) or []:
            props[(s.get('team'), norm(s.get('name')))] = s
        for b in box.itertuples():
            total += 1
            row = dict(date=d, gid=b.gid, pid=b.pid, name=b.name, team=b.team, opp=b.opp, venue=b.venue, sog=b.sog, g=b.g, toi=b.toi)
            # his PropFinder season row (position label, rates before the game)
            season_w = next((w for w in windows if re.search(r'season', w, re.I)), None)
            me = None
            for w in windows:
                m = pf.get((w, b.team, b.key))
                if m is None:
                    cands = [v for (ww, t, k), v in pf.items() if ww == w and t == b.team and k.endswith(b.last)]
                    m = cands[0] if len(cands) == 1 else None
                if m is not None:
                    tag = wtag(w, season_w)
                    row[f'pf_{tag}_sog'] = m.get('sog'); row[f'pf_{tag}_g'] = m.get('g'); row[f'pf_{tag}_gp'] = m.get('gp')
                    if tag == 'season' or me is None: me = m
            if me is None: unmatched += 1
            pos = (me or {}).get('pos') or b.pos
            pos = {'F': 'C', 'L': 'LW', 'R': 'RW'}.get(pos, pos)
            row['pf_pos'] = pos
            for w in windows:
                tag = wtag(w, season_w)
                n = 32  # PropFinder ranks every team; the slate's block holds only tonight's
                for slot, key in [('pos', pos), ('all', 'All')]:
                    dr = ranks.get((w, b.opp, key))
                    if not dr: continue
                    for m in ['sog', 'g', 'iscf']:
                        row[f'{tag}_{slot}_{m}_rank'] = dr.get(f'{m}Rank')
                        row[f'{tag}_{slot}_{m}_tone'] = third(dr.get(f'{m}Rank'), n)
                        row[f'{tag}_{slot}_{m}_val'] = dr.get(m)
            pr = props.get((b.team, b.key))
            if pr and pr.get('sog'):
                row['book_line'] = pr['sog'].get('line'); row['book_implied'] = pr['sog'].get('implied') or implied(pr['sog'].get('odds'))
            if pr and pr.get('goal'):
                row['goal_implied'] = pr['goal'].get('implied') or implied(pr['goal'].get('odds'))
            out.append(row)
    print(f'skater-games on stored slates: {total}, without a PropFinder row: {unmatched}')
    df = pd.DataFrame(out)
    for c in ['book_line', 'book_implied', 'goal_implied', 'pf_season_sog', 'pf_season_g', 'pf_season_gp']:
        if c not in df: df[c] = np.nan
    return df


def boot_gap(x, col_a, col_e, tone_col, rng, n=1000):
    g = x.gid.astype('category').cat.codes.values
    ng = g.max() + 1
    agg = {}
    for t in ['soft', 'tough']:
        m = (x[tone_col] == t).values
        agg[t] = (np.bincount(g[m], x[col_a].values[m], ng), np.bincount(g[m], x[col_e].values[m], ng))
    diffs = []
    for _ in range(n):
        i = rng.integers(0, ng, ng)
        r = {t: agg[t][0][i].sum() / agg[t][1][i].sum() for t in agg}
        diffs.append(r['soft'] - r['tough'])
    return np.percentile(diffs, 2.5), np.percentile(diffs, 97.5)


def verdict_tables(df):
    rng = np.random.default_rng(1)
    print('\n=========== 1. PropFinder\'s defense table and what the skaters did (this season) ===========')
    print('Baseline = his own PropFinder season SOG/G and G/G before the game (GP 5+). green = rank 1-11 (allows the most).')
    for tag in ['season']:  # the export's L10 block is stored on one date only (one file a season, overwritten)
        if f'{tag}_pos_sog_tone' not in df: continue
        for slot, lab in [('pos', 'at his position'), ('all', 'All row (the team as a whole)')]:
            tc = f'{tag}_{slot}_sog_tone'
            x = df[df[tc].notna() & df.pf_season_sog.notna() & (df.pf_season_gp.fillna(0) >= 5)].copy()
            if x.empty: continue
            x['p3'] = x.pf_season_sog.apply(lambda l: p_at_least(l, 3))
            print(f'\n-- SHOTS, the {tag} table, {lab}: {len(x)} skater-games')
            print(f"{'':6} {'n':>6} {'SOG':>6} {'his':>6} {'ratio':>6} {'3+':>6} {'exp':>6} | {'book n':>6} {'over hit':>8} {'implied':>8}")
            for t in ['soft', 'mid', 'tough']:
                s = x[x[tc] == t]
                if s.empty: continue
                bk = s[s.book_line.notna() & s.book_implied.notna()]
                over = (bk.sog > bk.book_line).mean() if len(bk) else float('nan')
                print(f"{t:6} {len(s):6d} {s.sog.mean():6.2f} {s.pf_season_sog.mean():6.2f} {s.sog.sum() / s.pf_season_sog.sum():6.3f} {(s.sog >= 3).mean():6.1%} {s.p3.mean():6.1%} | {len(bk):6d} {over:8.1%} {bk.book_implied.mean() if len(bk) else float('nan'):8.1%}")
            for lab2, mk in [('Oct', x.date < '2026-11-01'), ('Nov', x.date >= '2026-11-01')]:
                y = x[mk]
                if len(y) > 300:
                    print(f'   {lab2}: ' + '  '.join(f"{t} {y[y[tc] == t].sog.sum() / y[y[tc] == t].pf_season_sog.sum():.3f} (3+ {(y[y[tc] == t].sog >= 3).mean():.1%} vs {y[y[tc] == t].p3.mean():.1%}, n {len(y[y[tc] == t])})" for t in ['soft', 'mid', 'tough']))
            lo, hi = boot_gap(x, 'sog', 'pf_season_sog', tc, rng)
            print(f'   green minus red, shots over his own rate: 95% CI [{lo:+.3f}, {hi:+.3f}]')
            sh = x[x.pf_season_sog >= 2.5]
            if len(sh) > 100:
                print('   shooters at 2.5+: ' + '  '.join(f"{t} {(sh[sh[tc] == t].sog >= 3).mean():.0%} 3+ (exp {sh[sh[tc] == t].p3.mean():.0%}, n {len(sh[sh[tc] == t])})" for t in ['soft', 'mid', 'tough']))
        for slot, lab in [('pos', 'at his position'), ('all', 'All row')]:
            for m in ['g', 'iscf']:
                tc = f'{tag}_{slot}_{m}_tone'
                if tc not in df: continue
                x = df[df[tc].notna() & df.pf_season_g.notna() & (df.pf_season_gp.fillna(0) >= 5)].copy()
                if x.empty: continue
                x['p1'] = 1 - np.exp(-x.pf_season_g)
                print(f'\n-- GOALS by the {tag} table\'s {m.upper()} rank, {lab}: {len(x)} skater-games')
                for t in ['soft', 'mid', 'tough']:
                    s = x[x[tc] == t]
                    if s.empty: continue
                    bk = s[s.goal_implied.notna()]
                    print(f"{t:6} n {len(s):5d}  goals/gm {s.g.mean():.3f} vs his {s.pf_season_g.mean():.3f} ({s.g.sum() / max(s.pf_season_g.sum(), 1e-9):.3f})  1+ {(s.g >= 1).mean():.1%} (exp {s.p1.mean():.1%})"
                          + (f" | priced {len(bk)}: scored {(bk.g >= 1).mean():.1%}, implied {bk.goal_implied.mean():.1%}" if len(bk) else ''))
                lo, hi = boot_gap(x, 'g', 'pf_season_g', tc, rng)
                print(f'   green minus red: 95% CI [{lo:+.3f}, {hi:+.3f}]')


def home_away(R):
    from scipy.stats import ttest_ind
    print('\n=========== 2. Home / away, this season (box scores) ===========')
    t = R.groupby(['gid', 'team', 'venue'])[['sog', 'g']].sum().reset_index()
    opp = t.rename(columns={'team': 'opp', 'sog': 'sa', 'g': 'ga', 'venue': 'ov'})
    t = t.merge(opp, on='gid'); t = t[t.team != t.opp]
    print(f"league: home {t[t.venue == 'H'].sog.mean():.1f} shots {t[t.venue == 'H'].g.mean():.2f} goals | away {t[t.venue == 'A'].sog.mean():.1f} {t[t.venue == 'A'].g.mean():.2f}")
    res = []
    for team, s in t.groupby('team'):
        h, a = s[s.venue == 'H'], s[s.venue == 'A']
        res.append(dict(team=team, nH=len(h), nA=len(a), SF_H=h.sog.mean(), SF_A=a.sog.mean(), SA_H=h.sa.mean(), SA_A=a.sa.mean(),
                        GF_H=h.g.mean(), GF_A=a.g.mean(), GA_H=h.ga.mean(), GA_A=a.ga.mean(),
                        p_SF=ttest_ind(h.sog, a.sog, equal_var=False).pvalue, p_SA=ttest_ind(h.sa, a.sa, equal_var=False).pvalue,
                        p_GF=ttest_ind(h.g, a.g, equal_var=False).pvalue, p_GA=ttest_ind(h.ga, a.ga, equal_var=False).pvalue))
    o = pd.DataFrame(res)
    sig = sum((o[c] < 0.05).sum() for c in ['p_SF', 'p_SA', 'p_GF', 'p_GA'])
    print(f'teams: {sig} of {4 * len(o)} splits at p < 0.05 (chance alone {0.05 * 4 * len(o):.1f})')
    for c, m in [('p_SF', 'SF'), ('p_SA', 'SA'), ('p_GF', 'GF'), ('p_GA', 'GA')]:
        s = o[o[c] < 0.10]
        for r in s.itertuples():
            print(f"  {r.team} {m}: home {getattr(r, m + '_H'):.2f} away {getattr(r, m + '_A'):.2f} ({r.nH}/{r.nA} games, p {getattr(r, c):.3f})")
    ps = []
    for pid, s in R.groupby('pid'):
        h, a = s[s.venue == 'H'], s[s.venue == 'A']
        if len(h) < 8 or len(a) < 8: continue
        ps.append(dict(name=s.name.iloc[-1], team=s.team.iloc[-1], nH=len(h), nA=len(a), sH=h.sog.mean(), sA=a.sog.mean(), gH=h.g.mean(), gA=a.g.mean(),
                       h3=(h.sog >= 3).mean(), a3=(a.sog >= 3).mean(), p=ttest_ind(h.sog, a.sog, equal_var=False).pvalue,
                       pg=ttest_ind(h.g, a.g, equal_var=False).pvalue if h.g.var() + a.g.var() > 0 else 1.0))
    P = pd.DataFrame(ps)
    print(f'skaters with 8+ games at each venue: {len(P)}; shots splits at p < 0.05: {(P.p < 0.05).sum()} (chance {0.05 * len(P):.0f}); goals: {(P.pg < 0.05).sum()}')
    print('shots splits at p < 0.05:')
    print(P[P.p < 0.05].sort_values('sH').assign(diff=lambda d: d.sH - d.sA).sort_values('diff')[['name', 'team', 'nH', 'nA', 'sH', 'sA', 'diff', 'h3', 'a3', 'p']].round(2).to_string(index=False))
    own = R.groupby('pid').sog.mean()
    r = R.join(own.rename('own'), on='pid')
    r['tier'] = pd.cut(r.own, [0, 1, 2, 3, 10], labels=['<1', '1-2', '2-3', '3+'])
    tt = r.groupby(['tier', 'venue'], observed=True).sog.mean().unstack()
    print('home lift by shooter tier: ' + '  '.join(f'{k} {tt.loc[k, "H"] / tt.loc[k, "A"] - 1:+.1%}' for k in tt.index))


if __name__ == '__main__':
    export = json.load(open(sys.argv[1]))
    R = load_games(sys.argv[2])
    df = build(export, R)
    verdict_tables(df)
    home_away(R)

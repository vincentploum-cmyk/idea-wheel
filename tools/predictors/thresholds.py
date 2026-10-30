"""What it takes: the numbers a skater carried into the games where he reached 3 / 4 / 5 / 6 shots on goal or
1 / 2 / 3 goals, over a window of games (Vincent, 2026-10-30: "what a player needs to have in terms of stats /
environment (from PropFinder) to get 3 shots, 4 shots, 5 shots, 6 shots, 1 goal, 2 goals, 3 goals, based on the games
played in the last 3 weeks").

Reads the leak-free rows of build_rows.py (every feature from games before the row's), so each figure is what a props
screen showed that morning: his shots, attempts, chances and ice time a game this season and over his last 5 / 10, how
often he reached the mark, last season's rates, and the environment — what tonight's opponent gives up per skater at his
position (PropFinder's defense table, per game), its shots and goals against, the opposing goalie, home, rest.

For each mark: the base rate; what the hitters looked like going in against everyone (medians); which numbers separate
hitters best (AUC, the top fifth against the bottom fifth); the hit rate by his shot rate (the ladder); the environment
inside each shot-rate tier (the opponent's third at his position, home, the goalie); and plain rules from a shallow tree
fitted on the window's first part and checked on its last week. The rarest marks (3 goals) list the games.

Usage: python3 -I tools/predictors/thresholds.py <rows.csv> <from YYYY-MM-DD> <to YYYY-MM-DD> <split YYYY-MM-DD> [--out report.md]
       (rows dated >= split are the check; the rules are fitted on the rows before it)
"""
import sys
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.tree import DecisionTreeClassifier

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = {}
for i, a in enumerate(sys.argv):
    if a == '--out': opts['out'] = sys.argv[i + 1]
rows_csv, d_from, d_to, d_split = args[0], args[1], args[2], args[3]
out_lines = []
def line(s=''): out_lines.append(s)
def table(head, rows):
    line('| ' + ' | '.join(head) + ' |'); line('|' + '|'.join([' --- '] * len(head)) + '|')
    for r in rows: line('| ' + ' | '.join(str(x) for x in r) + ' |')
    line()

d = pd.read_csv(rows_csv, low_memory=False)
w = d[(d.date >= d_from) & (d.date <= d_to) & (d.n_prior >= 1)].copy()
skipped_first = int(((d.date >= d_from) & (d.date <= d_to) & (d.n_prior < 1)).sum())
w['fwd'] = w.pos.isin(['C', 'LW', 'RW'])
w['slot'] = w.p_slot_l5.round().clip(1, 4)
# The opponent's third at his position on the per-skater table (PropFinder's defense table, per game): soft = the third
# of his position's skater-games against the opponents giving up the most, tough = the least.
w['opp_third'] = w.groupby('pos').opp_pos_sog_per.transform(lambda s: pd.qcut(s.rank(method='first', ascending=False), 3, labels=['soft', 'mid', 'tough']).astype(str))
w['opp_third_g'] = w.groupby('pos').opp_pos_g_per.transform(lambda s: pd.qcut(s.rank(method='first', ascending=False), 3, labels=['soft', 'mid', 'tough']).astype(str))
w['gk_third'] = pd.qcut(w.gk_std_svpct.rank(method='first'), 3, labels=['weak goalie', 'mid goalie', 'strong goalie']).astype(str)

# The numbers a props screen shows, by family: his own (this season and windows), last season, the environment.
FEATURES = [
    ('p_sog_avg', 'Shots a game, season'), ('p_sog_l5', 'Shots a game, last 5'), ('p_sog_l10', 'Shots a game, last 10'),
    ('p_icf_avg', 'Shot attempts a game (iCF), season'), ('p_iff_avg', 'Unblocked attempts a game (iFF), season'),
    ('p_iscf_avg', 'Scoring chances a game (iSCF), season'), ('p_ihdcf_avg', 'High-danger chances a game, season'),
    ('p_toi_avg', 'Ice time a game (min), season'), ('p_toi_l5', 'Ice time, last 5'), ('p_sog60', 'Shots per 60'),
    ('p_s3_rate', 'Share of his games at 3+ shots'), ('p_s2_rate', 'Share of his games at 2+ shots'),
    ('p_g_avg', 'Goals a game, season'), ('p_g1_rate', 'Share of his games with a goal'), ('p_shpct', 'Shooting %, season'),
    ('p_sog_max', 'His most shots in a game this season'),
    ('pls_sog_pg', 'Shots a game, last season'), ('pls_g_pg', 'Goals a game, last season'), ('pls_toi_pg', 'Ice time, last season'),
    ('opp_pos_sog_per', 'Opponent: shots allowed per skater at his position'), ('opp_pos_sog_l5', 'Opponent: shots to his position a game, last 5'),
    ('opp_sa_pg', 'Opponent: shots against a game'), ('opp_pos_g_per', 'Opponent: goals allowed per skater at his position'),
    ('opp_ga_pg', 'Opponent: goals against a game'), ('gk_std_svpct', 'Opposing goalie: save % this season'),
    ('team_sf_pg', 'His team: shots for a game'), ('pace_game_std', 'Game pace (both teams’ shots)'), ('home', 'Home'), ('b2b', 'Back-to-back'),
]
FEATURES = [(k, l) for k, l in FEATURES if k in w.columns]
LABEL = dict(FEATURES)
TREE_FEATURES = ['p_sog_avg', 'p_sog_l5', 'p_icf_avg', 'p_toi_avg', 'p_s3_rate', 'p_iscf_avg', 'p_ihdcf_avg', 'p_g_avg', 'pls_sog_pg', 'opp_pos_sog_per', 'opp_sa_pg', 'opp_pos_g_per', 'gk_std_svpct', 'home']
MARKS = [('sog', 3, 'shots'), ('sog', 4, 'shots'), ('sog', 5, 'shots'), ('sog', 6, 'shots'), ('g', 1, 'goal'), ('g', 2, 'goals'), ('g', 3, 'goals')]
pct = lambda v: '—' if v is None or (isinstance(v, float) and np.isnan(v)) else f'{v * 100:.1f}%'
f2 = lambda v: '—' if v is None or (isinstance(v, float) and np.isnan(v)) else f'{v:.2f}'

def fmt_feat(k, v):
    if k in ('p_s3_rate', 'p_s2_rate', 'p_g1_rate', 'p_shpct'): return pct(v)
    if k == 'gk_std_svpct': return f'{v:.3f}'
    if k in ('home', 'b2b'): return pct(v)
    return f2(v)

line(f'# What it takes: 3 / 4 / 5 / 6 shots and 1 / 2 / 3 goals, {d_from} to {d_to}')
line()
line(f'{len(w)} skater-games over {w.gameId.nunique()} games ({skipped_first} more were a skater’s first game this season and carry no figures). '
     'Every number on a row is what was known that morning: his own figures from his earlier games this season (the way PropFinder’s '
     'Season / L5 / L10 read), last season’s from its box scores, and the environment from the opponent’s earlier games. '
     'Built from the NHL’s public box scores and play-by-play with the same definitions as the site’s stored rows; '
     'PropFinder’s own export was not read (its login is the server’s), but its columns are these same counts.')
line()
table(['Mark', 'Hit', 'Of', 'Rate'], [[f'{k}+ {u}', int((w[s] >= k).sum()), len(w), pct((w[s] >= k).mean())] for s, k, u in MARKS])

for stat, k, unit in MARKS:
    y = (w[stat] >= k).astype(int)
    base = y.mean()
    line(f'## {k}+ {unit}')
    line()
    line(f'{int(y.sum())} of {len(w)} skater-games ({pct(base)}).')
    line()
    # What the hitters looked like going in.
    rows = []
    keys = ['p_sog_avg', 'p_sog_l5', 'p_icf_avg', 'p_iscf_avg', 'p_toi_avg', 'p_s3_rate', 'p_g_avg', 'pls_sog_pg', 'opp_pos_sog_per', 'opp_sa_pg', 'opp_pos_g_per', 'gk_std_svpct']
    for key in keys:
        hv = w.loc[y == 1, key]; av = w[key]
        rows.append([LABEL[key], fmt_feat(key, hv.median()), f'{fmt_feat(key, hv.quantile(0.25))} – {fmt_feat(key, hv.quantile(0.75))}', fmt_feat(key, av.median())])
    pos_mix = (w.loc[y == 1, 'pos'].value_counts(normalize=True) * 100).round(0).astype(int).to_dict()
    slot_mix = (w.loc[y == 1, 'slot'].value_counts(normalize=True).sort_index() * 100).round(0).astype(int).to_dict()
    line(f'**What they looked like going in** (median of the {int(y.sum())} who did it, their middle half, and everyone’s median). '
         f'By position: {", ".join(f"{p} {v}%" for p, v in pos_mix.items())}; by line (ice-time rank, last 5): {", ".join(f"{int(s)}: {v}%" for s, v in slot_mix.items())}.')
    line()
    table(['Number', 'Hitters’ median', 'Hitters’ middle half', 'Everyone’s median'], rows)
    # Which numbers separate them.
    sep = []
    for key, label in FEATURES:
        sub = w[[key]].assign(y=y).dropna()
        if sub.y.nunique() < 2 or sub[key].nunique() < 3: continue
        auc = roc_auc_score(sub.y, sub[key])
        q = sub[key].rank(method='first', pct=True)
        top = sub.y[q > 0.8].mean(); bot = sub.y[q <= 0.2].mean()
        sep.append((abs(auc - 0.5), label, auc, top, bot, len(sub)))
    sep.sort(reverse=True)
    line('**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):')
    line()
    table(['Number', 'AUC', 'Top fifth', 'Bottom fifth'], [[label, f'{auc:.3f}', pct(top), pct(bot)] for _, label, auc, top, bot, n in sep[:10]])
    # The ladder by his shot rate, and the environment inside each tier.
    bins = [0, 1, 1.5, 2, 2.5, 3, 3.5, 99]
    names = ['under 1', '1 – 1.5', '1.5 – 2', '2 – 2.5', '2.5 – 3', '3 – 3.5', '3.5 +']
    w['tier'] = pd.cut(w.p_sog_avg, bins, right=False, labels=names)
    third = 'opp_third' if stat == 'sog' else 'opp_third_g'
    rows = []
    for t in names:
        sub = w[w.tier == t]; yy = (sub[stat] >= k)
        if not len(sub): continue
        by = {th: (sub[third] == th) for th in ('soft', 'mid', 'tough')}
        cells = [f'{pct(yy[m].mean())} ({int(m.sum())})' if m.sum() >= 15 else f'— ({int(m.sum())})' for m in by.values()]
        home = yy[sub.home == 1].mean(); away = yy[sub.home == 0].mean()
        rows.append([t, len(sub), pct(yy.mean()), *cells, f'{pct(home)} / {pct(away)}'])
    env = 'shots allowed per skater at his position' if stat == 'sog' else 'goals allowed per skater at his position'
    line(f'**By his shots a game this season** (the ladder), and inside each tier by the opponent’s third on {env} (soft = gives up the most), and home / away:')
    line()
    table(['His shots a game', 'Games', 'Hit', 'Soft opp.', 'Mid opp.', 'Tough opp.', 'Home / away'], rows)
    if stat == 'g':
        # Goals: the goalie and his chances matter beside the shots.
        rows = []
        for t in names:
            sub = w[w.tier == t]; yy = (sub[stat] >= k)
            if len(sub) < 30: continue
            rows.append([t, *[f'{pct(yy[sub.gk_third == g].mean())} ({int((sub.gk_third == g).sum())})' for g in ('weak goalie', 'mid goalie', 'strong goalie')]])
        line('Inside each tier by the opposing goalie’s save % this season (thirds):')
        line()
        table(['His shots a game', 'Weak goalie', 'Mid goalie', 'Strong goalie'], rows)
    # Plain rules: a shallow tree fitted before the split, checked after it.
    train = w[w.date < d_split]; test = w[w.date >= d_split]
    feats = [f for f in TREE_FEATURES if f in w.columns]
    leaf_min = max(25, int(len(train) * (0.02 if base > 0.05 else 0.03)))
    if int((train[stat] >= k).sum()) >= 15 and len(test):
        X = train[feats].fillna(train[feats].median()); yt = (train[stat] >= k).astype(int)
        tree = DecisionTreeClassifier(max_depth=3, min_samples_leaf=leaf_min, random_state=0).fit(X, yt)
        Xt = test[feats].fillna(train[feats].median()); yv = (test[stat] >= k).astype(int)
        leaf_tr = tree.apply(X); leaf_te = tree.apply(Xt)
        t = tree.tree_
        def path(node_id):
            # the conditions down to a leaf
            conds = []
            def walk(n, acc):
                if n == node_id: conds.extend(acc); return True
                if t.children_left[n] == -1: return False
                f = feats[t.feature[n]]; th = t.threshold[n]
                return walk(t.children_left[n], acc + [(f, '≤', th)]) or walk(t.children_right[n], acc + [(f, '>', th)])
            walk(0, [])
            # merge repeated bounds on one feature
            lo = {}; hi = {}
            for f, op, th in conds:
                if op == '>': lo[f] = max(lo.get(f, -1e9), th)
                else: hi[f] = min(hi.get(f, 1e9), th)
            parts = []
            for f in dict.fromkeys([c[0] for c in conds]):
                lab = LABEL.get(f, f)
                a = lo.get(f); b = hi.get(f)
                if f == 'home': parts.append('at home' if a is not None else 'away'); continue
                if a is not None and b is not None: parts.append(f'{lab} {fmt_feat(f, a)}–{fmt_feat(f, b)}')
                elif a is not None: parts.append(f'{lab} over {fmt_feat(f, a)}')
                else: parts.append(f'{lab} up to {fmt_feat(f, b)}')
            return '; '.join(parts)
        leaves = []
        for lf in np.unique(leaf_tr):
            mtr = leaf_tr == lf; mte = leaf_te == lf
            leaves.append((yt[mtr].mean(), path(lf), int(mtr.sum()), yt[mtr].mean(), int(mte.sum()), yv[mte].mean() if mte.sum() else np.nan))
        leaves.sort(reverse=True)
        line(f'**Plain rules** (a three-question tree fitted on {d_from} to the day before {d_split}, {len(train)} skater-games, at least {leaf_min} a rule; checked on {d_split} to {d_to}, {len(test)} skater-games it never saw; base rate {pct(yt.mean())} → {pct(yv.mean())}):')
        line()
        table(['When', 'Fitted: games', 'Fitted: hit', 'Check: games', 'Check: hit'], [[p, n1, pct(h1), n2, pct(h2)] for _, p, n1, h1, n2, h2 in leaves])
    if stat == 'g' and k >= 3:
        hits = w[w[stat] >= k].sort_values('date')
        line('**Every one of them**, with what he carried in:')
        line()
        table(['Date', 'Skater', 'Team', 'vs', 'Shots', 'His shots a game', 'His goals a game', 'Chances a game', 'Ice time', 'Opp. goals allowed to his position (per skater)', 'Goalie sv %'],
              [[r.date, r['name'], r.team, r.opp, int(r.sog), f2(r.p_sog_avg), f2(r.p_g_avg), f2(r.p_iscf_avg), f2(r.p_toi_avg), f2(r.opp_pos_g_per), f'{r.gk_std_svpct:.3f}' if not np.isnan(r.gk_std_svpct) else '—'] for _, r in hits.iterrows()])

text = '\n'.join(out_lines)
if opts.get('out'):
    open(opts['out'], 'w').write(text)
    print('written', opts['out'])
else:
    print(text)

"""What would make the first-goal read better? Every candidate signal specific to the *first*
goal, tested leak-free on a whole season as a conditional-logit over the game's dressed skaters
(P(i scores first | game) = exp(x_i·β) / Σ_j exp(x_j·β)), against the plain goal rate.

Inputs per skater-game (games before the date only; the previous season as the base where he has
10+ games in it, blended at n / (n + k) as the site does):
  goal rate (k 40), the shipped formula's goal λ with the matchup (picks-pure.js), first-period goals
  and shots per game, share of games on the ice for the opening faceoff, seconds on the ice in the
  first 10 minutes and in the first period, power-play goals per game, home ice, the team's share of
  the two sides' summed goal rates, the opposing starter's save %, and the 1st goal tab's own three
  parts (own first-goal record, the opponent's leak to his position at the venue, head to head).
Grades: per-game log loss of the probability on the actual first scorer, top-1 / 3 / 5 hit rates,
calibration of the probabilities, the slate-wide top 10; nested models by grouped 5-fold cross-
validation on the season (fit on four fifths of the games, scored on the fifth) and, with --coef,
coefficients fitted on another season applied out of sample.

argv: <season games-pos dir> <season extras dir> <previous season games-pos dir> <previous season extras dir> <label>
      [--coef <json from another run>] [--out prefix]
Writes <prefix>-coef.json (the full model's coefficients) and <prefix>-rows.csv.
"""
import sys, glob, json, math, argparse, warnings
from collections import defaultdict
import numpy as np, pandas as pd
from scipy.optimize import minimize
warnings.filterwarnings('ignore')

ap = argparse.ArgumentParser()
ap.add_argument('cur_games'); ap.add_argument('cur_extras'); ap.add_argument('prev_games'); ap.add_argument('prev_extras'); ap.add_argument('label')
ap.add_argument('--coef', default=None); ap.add_argument('--out', default=None); ap.add_argument('--folds', type=int, default=5)
args = ap.parse_args()
out = args.out or f'{args.cur_games.rstrip("/")}/../firstgoal-model'

POS = ('C', 'LW', 'RW', 'D')
LEAGUE_FG, SHRINK = 0.028, 20
G = dict(const=-1.0539, g=0.3735, iscf=0.4356, sog=0.4007, home=0.0682, pos=0.4448, b2b=-0.0677)
LEAGUE_POS_G = {'C': 0.23, 'LW': 0.21, 'RW': 0.215, 'D': 0.077}
LEAGUE_SV = 0.905
clamp = lambda v, lo, hi: min(hi, max(lo, v))
lg = lambda v: math.log(max(v, 0.05))

def load(d):
    gs = []
    for f in sorted(glob.glob(f'{d}/*.json')): gs += json.load(open(f))['games']
    return sorted(gs, key=lambda g: (g['date'], g['id']))
def load_extras(d):
    out = {}
    for f in sorted(glob.glob(f'{d}/*.json')):
        for g in json.load(open(f))['games']: out[g['id']] = g
    return out

cur, prev = load(args.cur_games), load(args.prev_games)
xcur, xprev = load_extras(args.cur_extras), load_extras(args.prev_extras)
print(f'{args.label}: {len(cur)} games this season ({len(xcur)} with extras), {len(prev)} the season before ({len(xprev)} with extras)')

# ── running state (sums per player per season; the tab's record / leak / h2h; the opponent's per-position goals; goalies) ──
KEYS = ('g', 'sog', 'iscf', 'toi', 'p1G', 'p1Sog', 'start', 'toi10', 'toiP1', 'ppG')
def zero(): return dict(n=0, **{k: 0.0 for k in KEYS})
sums = {'cur': defaultdict(zero), 'prev': defaultdict(zero)}
gk = {'cur': defaultdict(lambda: dict(sa=0, sv=0, gp=0)), 'prev': defaultdict(lambda: dict(sa=0, sv=0, gp=0))}
rec = defaultdict(list); h2h = defaultdict(lambda: [0, 0]); fga = defaultdict(lambda: defaultdict(lambda: [0, 0]))
oppg = {'cur': defaultdict(lambda: dict(g=0, n=0, games=set())), 'prev': defaultdict(lambda: dict(g=0, n=0, games=set()))}
last = {}
team_first = defaultdict(lambda: [0, 0])  # team → [games with a first goal on record, times it scored first]

def add_game(g, x, season):
    fg = g.get('firstGoal') or {}
    scorer = fg.get('playerId')
    xp = (x or {}).get('players', {})
    for s in g['skaters']:
        if s['pos'] not in POS: continue
        e = xp.get(str(s['id']), {})
        t = sums[season][s['id']]; t['n'] += 1
        t['g'] += s['g']; t['sog'] += s['sog']; t['iscf'] += s['iscf']; t['toi'] += s['toi']
        t['p1G'] += e.get('p1G', 0); t['p1Sog'] += e.get('p1Sog', 0); t['start'] += e.get('start', 0)
        t['toi10'] += e.get('toi10', 0); t['toiP1'] += e.get('toiP1', 0); t['ppG'] += e.get('ppG', 0)
        rec[s['id']].append(1 if s['id'] == scorer else 0)
        h = h2h[(s['id'], s['opp'])]; h[0] += 1; h[1] += s['g']
        o = oppg[season][(s['opp'], s['pos'])]; o['g'] += s['g']; o['n'] += 1; o['games'].add(g['id'])
    for gl in g.get('goalies', []):
        if gl.get('toi', 0) > 0: q = gk[season][gl['id']]; q['sa'] += gl['sa']; q['sv'] += gl['sv']; q['gp'] += 1
    for side, other in (('home', 'away'), ('away', 'home')):
        dv = 'H' if side == 'home' else 'A'; t = g[side]['abbrev']
        tab = fga[(t, dv)]
        for p in POS + ('All',): tab[p][0] += 1
        if scorer:
            team_first[t][0] += 1
            if fg.get('team') == t: team_first[t][1] += 1
            if fg.get('team') == g[other]['abbrev']:
                sp = next((s['pos'] for s in g['skaters'] if s['id'] == scorer), None)
                tab['All'][1] += 1
                if sp in POS: tab[sp][1] += 1
        last[t] = g['date']

def blend(pid, key, k):
    """This season's mean blended into last season's at n / (n + k); last season's alone before his first game; None with nothing."""
    c, p = sums['cur'].get(pid), sums['prev'].get(pid)
    cn = c['n'] if c else 0; pn = p['n'] if p else 0
    if pn >= 10:
        w = cn / (cn + k) if cn else 0
        return w * (c[key] / cn if cn else 0) + (1 - w) * p[key] / pn
    if cn: return c[key] / cn
    if pn: return p[key] / pn
    return None

def opp_read(team, pos):
    c, p = oppg['cur'].get((team, pos)), oppg['prev'].get((team, pos))
    cg = c['g'] / c['n'] if c and c['n'] else None
    pg = p['g'] / p['n'] if p and p['n'] and len(p['games']) >= 10 else None
    games = len(c['games']) if c else 0
    if cg is None and pg is None: return LEAGUE_POS_G[pos]
    if pg is None: return cg
    if cg is None: return pg
    return (games / (games + 40)) * cg + (40 / (games + 40)) * pg

def goalie_sv(gid):
    c, p = gk['cur'].get(gid), gk['prev'].get(gid)
    csa = c['sa'] if c else 0; psa = p['sa'] if p else 0
    if not csa and not psa: return LEAGUE_SV
    w = csa / (csa + 600)
    cs = c['sv'] / csa if csa else LEAGUE_SV
    ps = p['sv'] / psa if psa >= 300 else LEAGUE_SV
    return w * cs + (1 - w) * ps if psa >= 300 else (cs if csa else LEAGUE_SV)

for g in prev: add_game(g, xprev.get(g['id']), 'prev')

rows = []
by_date = defaultdict(list)
for g in cur: by_date[g['date']].append(g)
from datetime import date as D
for date in sorted(by_date):
    league = {}
    for dv in 'HA':
        for p in POS:
            shares = [tab[p][1] / tab[p][0] for (t, v), tab in fga.items() if v == dv and tab[p][0]]
            league[(dv, p)] = sum(shares) / len(shares) if shares else None
    for g in by_date[date]:
        x = xcur.get(g['id']); fg = (x or {}).get('firstGoal') or g.get('firstGoal') or {}
        if not fg.get('playerId') or not x: continue
        sk = [s for s in g['skaters'] if s['pos'] in POS]
        # the opposing starter (the confirmed goalie pre-game): the starter flag, else the goalie who played most
        gl_by_team = defaultdict(list)
        for gl in g.get('goalies', []): gl_by_team[gl['team']].append(gl)
        starter_of = {t: (next((q for q in lst if q.get('starter')), None) or max(lst, key=lambda q: q['toi'])) for t, lst in gl_by_team.items()}
        team_sum = defaultdict(float)
        feats = []
        for s in sk:
            gr = blend(s['id'], 'g', 40)
            feats.append(gr if gr is not None else 0.05)
            team_sum[s['team']] += gr if gr is not None else 0.05
        for s, gr in zip(sk, feats):
            pid = s['id']; is_home = 1 if s['venue'] == 'H' else 0
            r = rec[pid][-100:]; gp = len(r); f = sum(r)
            rate_adj = (f + LEAGUE_FG * SHRINK) / (gp + SHRINK)
            dv = 'H' if s['venue'] == 'A' else 'A'
            cell = fga[(s['opp'], dv)][s['pos']]; lgs = league[(dv, s['pos'])]
            leak = (cell[1] / cell[0]) / lgs if cell[0] and lgs else 1.0
            hh = h2h[(pid, s['opp'])]; gpg = hh[1] / hh[0] if hh[0] else 0
            sog = blend(pid, 'sog', 18); iscf = blend(pid, 'iscf', 40)
            n_cur = sums['cur'][pid]['n'] if pid in sums['cur'] else 0; n_prev = sums['prev'][pid]['n'] if pid in sums['prev'] else 0
            bb = bool(last.get(s['team'])) and (D.fromisoformat(date) - D.fromisoformat(last[s['team']])).days == 1
            lamG = math.exp(G['const'] + G['g'] * math.log(max(gr, 0) + 0.05) + G['iscf'] * lg(iscf or 0) + G['sog'] * lg(sog or 0)
                            + G['home'] * is_home + G['pos'] * math.log(max(opp_read(s['opp'], s['pos']), 0) + 0.1) + G['b2b'] * bb) if (n_prev >= 10 or n_cur >= 5) else None
            ogl = starter_of.get(s['opp'])
            e = x['players'].get(str(pid), {})
            tab_score = round(clamp(0.45 * clamp((1 - math.exp(-gr)) / 0.45, 0, 1) + 0.30 * clamp(rate_adj / 0.15, 0, 1) + 0.15 * clamp(leak, 0, 2) / 2 + 0.10 * clamp(gpg, 0, 1), 0, 1) * 100)
            rows.append(dict(
                date=date, gameId=g['id'], game=f"{g['away']['abbrev']} @ {g['home']['abbrev']}", id=pid, name=s['name'], team=s['team'], opp=s['opp'], pos=s['pos'], home=is_home,
                n_cur=n_cur, n_prev=n_prev, g_pg=gr, lamG=lamG, p1g_pg=blend(pid, 'p1G', 40), p1sog_pg=blend(pid, 'p1Sog', 18), start_rate=blend(pid, 'start', 10),
                toi10=blend(pid, 'toi10', 5), toiP1=blend(pid, 'toiP1', 5), toi=blend(pid, 'toi', 5), ppg_pg=blend(pid, 'ppG', 40),
                team_rate=team_sum[s['team']], opp_rate=team_sum[s['opp']], team_share=team_sum[s['team']] / (team_sum[s['team']] + team_sum[s['opp']]),
                opp_gk_sv=goalie_sv(ogl['id']) if ogl else LEAGUE_SV, rate_adj=rate_adj, leak=leak, h2h_gpg=gpg, tab_score=tab_score,
                fg=1 if pid == fg['playerId'] else 0, fg_secs=fg.get('secs'), fg_period=fg.get('period'), fg_strength=fg.get('strength'),
                g=s['g'], g1=1 if s['g'] >= 1 else 0, started=e.get('start', 0), act_toi10=e.get('toi10', 0), act_p1g=e.get('p1G', 0), n_skaters=len(sk)))
    for g in by_date[date]: add_game(g, xcur.get(g['id']), 'cur')

t = pd.DataFrame(rows)
ok = t.groupby('gameId').fg.sum(); t = t[t.gameId.isin(ok[ok == 1].index)].reset_index(drop=True)
t['rand'] = np.random.default_rng(1).random(len(t))
# hindsight ceilings: the player's actual goals / game over the whole season under test (the game itself included)
t['oracle_g'] = t.groupby('id').g.transform('mean')
t['oracle_p1g'] = t.groupby('id').act_p1g.transform('mean')
pd.set_option('display.width', 230)
games = t.gameId.nunique()
print(f'{games} games with a first goal and extras, {len(t)} skater-games, {t.n_skaters.mean():.1f} skaters a game\n')

# ── 0. the facts of the first goal ──
fgr = t[t.fg == 1]
print('--- 0. When and how the first goal comes ---')
print(f'   period 1: {(fgr.fg_period == 1).mean()*100:.0f}%; within 5 minutes {(fgr.fg_secs <= 300).mean()*100:.0f}%, within 10 {(fgr.fg_secs <= 600).mean()*100:.0f}%; median {fgr.fg_secs.median()/60:.1f} minutes')
print(f'   strength: ' + ', '.join(f'{k} {v*100:.0f}%' for k, v in fgr.fg_strength.value_counts(normalize=True).items()))
print(f'   the home side scored first in {fgr.home.mean()*100:.1f}% of games; the side with the higher summed goal rate in {(fgr.team_share > 0.5).mean()*100:.1f}%')
print(f'   the scorer was on the ice for the opening faceoff in {fgr.started.mean()*100:.0f}% of games (10 of {t.n_skaters.mean():.0f} skaters are: {t.started.mean()*100:.0f}%)')
print(f'   the scorer is a defenseman in {(fgr.pos == "D").mean()*100:.0f}% (defensemen are {(t.pos == "D").mean()*100:.0f}% of skaters)')
sb = t.copy(); sb['tb'] = pd.cut(sb.toi10, [-1, 60, 90, 120, 150, 180, 9999], labels=['<1:00', '1-1:30', '1:30-2', '2-2:30', '2:30-3', '3:00+'])
print('   first-goal rate by the skater\'s usual ice time in the first 10 minutes (prior games):')
print(sb.groupby('tb', observed=True).agg(n=('fg', 'size'), scored_first=('fg', 'mean'), scored_any=('g1', 'mean'), goal_rate=('g_pg', 'mean')).to_string(float_format=lambda v: f'{v:.3f}'))

# ── the conditional logit ──
def design(df, cols):
    X = np.column_stack([df[c].astype(float).values for c in cols]) if cols else np.zeros((len(df), 0))
    return X
def fit_clogit(X, y, gid, l2=1e-4):
    # games as contiguous blocks; one scorer a game, so the scorer rows line up with the blocks in game order
    order = np.argsort(gid, kind='stable'); X = X[order]; y = y[order]; gid = gid[order]
    _, starts, counts = np.unique(gid, return_index=True, return_counts=True)
    k = X.shape[1]; Xs = X[y == 1].sum(0)
    def f(beta):
        z = X @ beta
        m = np.maximum.reduceat(z, starts); zc = z - np.repeat(m, counts)
        e = np.exp(zc); S = np.add.reduceat(e, starts); p = e / np.repeat(S, counts)
        ll = (zc[y == 1] - np.log(S)).sum()
        grad = Xs - p @ X
        return -(ll - l2 * beta @ beta), -(grad - 2 * l2 * beta)
    res = minimize(f, np.zeros(k), jac=True, method='L-BFGS-B')
    return res.x
def predict(X, beta, gid):
    z = X @ beta; p = np.zeros(len(z))
    df = pd.DataFrame({'z': z, 'g': gid})
    m = df.groupby('g').z.transform('max'); e = np.exp(z - m.values); s = pd.Series(e).groupby(gid).transform('sum').values
    return e / s

def grade_p(df, p, name):
    d = df[['gameId', 'date', 'fg', 'g1', 'rand']].copy(); d['p'] = p
    d['rk'] = d.sort_values(['p', 'rand'], ascending=False).groupby('gameId').cumcount().add(1).reindex(d.index)
    f = d[d.fg == 1]
    top = lambda k: d[d.rk <= k].groupby('gameId').fg.max().mean()
    ll = -np.log(np.clip(f.p, 1e-9, 1)).mean()
    d['drk'] = d.sort_values(['p', 'rand'], ascending=False).groupby('date').cumcount().add(1).reindex(d.index)
    s10 = d[d.drk <= 10]
    return dict(model=name, log_loss=ll, top1_first=d[d.rk == 1].fg.mean(), top3=top(3), top5=top(5), top1_any=d[d.rk == 1].g1.mean(), median_rank=f.rk.median(),
                slate_top10_first=s10.fg.mean(), slate_top10_any=s10.g1.mean(), stated_top1=d[d.rk == 1].p.mean())

# features (logs where the signal is a rate; small floors keep zeros finite)
t['f_lg'] = np.log(t.g_pg.fillna(0.05).clip(lower=0.01))
t['f_llam'] = np.log(t.lamG.fillna(t.g_pg.fillna(0.05)).clip(lower=0.01))
t['f_lp1g'] = np.log(t.p1g_pg.fillna(0.01).clip(lower=0.002) + 0.01)
t['f_lp1sog'] = np.log(t.p1sog_pg.fillna(0.3).clip(lower=0.05))
t['f_start'] = t.start_rate.fillna(0.28)
t['f_ltoi10'] = np.log(t.toi10.fillna(100).clip(lower=10))
t['f_ltoiP1'] = np.log(t.toiP1.fillna(300).clip(lower=30))
t['f_ppg'] = t.ppg_pg.fillna(0)
t['f_home'] = t.home.astype(float)
t['f_lshare'] = np.log(t.team_share.clip(0.2, 0.8))
t['f_gk'] = (LEAGUE_SV - t.opp_gk_sv) * 100
t['f_own'] = (t.rate_adj / 0.15).clip(0, 1)
t['f_leak'] = t.leak.clip(0, 2) / 2
t['f_h2h'] = t.h2h_gpg.clip(0, 1)
BLOCKS = [
    ('goal rate', ['f_lg']),
    ('+ shipped λG (matchup)', ['f_lg', 'f_llam']),
    ('+ first-period goals and shots', ['f_lg', 'f_llam', 'f_lp1g', 'f_lp1sog']),
    ('+ opening shift and first-10-minute ice', ['f_lg', 'f_llam', 'f_lp1g', 'f_lp1sog', 'f_start', 'f_ltoi10']),
    ('+ power-play goals', ['f_lg', 'f_llam', 'f_lp1g', 'f_lp1sog', 'f_start', 'f_ltoi10', 'f_ppg']),
    ('+ home, team share, opposing goalie', ['f_lg', 'f_llam', 'f_lp1g', 'f_lp1sog', 'f_start', 'f_ltoi10', 'f_ppg', 'f_home', 'f_lshare', 'f_gk']),
    ("+ the tab's own record, leak, h2h (full)", ['f_lg', 'f_llam', 'f_lp1g', 'f_lp1sog', 'f_start', 'f_ltoi10', 'f_ppg', 'f_home', 'f_lshare', 'f_gk', 'f_own', 'f_leak', 'f_h2h']),
    ('early ice alone (opening shift + first 10 min)', ['f_start', 'f_ltoi10']),
    ('goal rate + early ice only', ['f_lg', 'f_start', 'f_ltoi10']),
    ('goal rate + team share + home only', ['f_lg', 'f_lshare', 'f_home']),
]
gid = t.gameId.values; y = t.fg.values
rng = np.random.default_rng(7); ugames = np.unique(gid); fold_of = dict(zip(ugames, rng.integers(0, args.folds, len(ugames))))
folds = np.array([fold_of[g] for g in gid])

print('\n--- 1. Fixed reads, no fitting: the probability is the rate over the game\'s summed rates (the Poisson read of "who scores first") ---')
res = []
for col, name in (('g_pg', 'goal rate / Σ game'), ('lamG', 'shipped λG / Σ game'), ('p1g_pg', 'first-period goal rate / Σ game'), ('tab_score', '1st goal tab score (normalised)'), ('oracle_g', 'HINDSIGHT: his season goal rate (ceiling)'), ('oracle_p1g', 'HINDSIGHT: his season first-period goal rate'), ('rand', 'random')):
    v = t[col].fillna(t[col].median()).clip(lower=1e-6).values if col != 'rand' else np.ones(len(t))
    p = v / pd.Series(v).groupby(gid).transform('sum').values
    res.append(grade_p(t, p, name))
print(pd.DataFrame(res).to_string(index=False, float_format=lambda v: f'{v:.3f}'))

print(f'\n--- 2. Fitted conditional logits, {args.folds}-fold cross-validated by game (coefficient z from the full fit; the gain is the log-loss drop) ---')
res = []; coefs = {}
for name, cols in BLOCKS:
    X = design(t, cols); p = np.zeros(len(t))
    for k in range(args.folds):
        tr = folds != k; te = ~tr
        b = fit_clogit(X[tr], y[tr], gid[tr]); p[te] = predict(X[te], b, gid[te])
    beta = fit_clogit(X, y, gid)
    # standard errors from the observed information (numerical Hessian of the per-game log-likelihood)
    r = grade_p(t, p, name); r['coef'] = ' '.join(f'{c[2:]}={v:+.2f}' for c, v in zip(cols, beta)); res.append(r); coefs[name] = dict(zip(cols, beta.tolist()))
df = pd.DataFrame(res)
print(df.drop(columns=['coef']).to_string(index=False, float_format=lambda v: f'{v:.3f}'))
print('   coefficients (full fit):')
for r in res: print(f'   {r["model"]:48s} {r["coef"]}')
full_name, full_cols = BLOCKS[6]
json.dump({'label': args.label, 'cols': full_cols, 'beta': coefs[full_name], 'blocks': {n: coefs[n] for n, _ in BLOCKS}}, open(f'{out}-coef.json', 'w'), indent=1)

# z-scores for the full model via a numerical Hessian
def hessian_z(cols):
    X = design(t, cols); beta = np.array([coefs[full_name][c] for c in cols])
    order = np.argsort(gid, kind='stable'); Xo = X[order]; yo = y[order]; go = gid[order]
    _, starts = np.unique(go, return_index=True); ends = np.r_[starts[1:], len(go)]
    H = np.zeros((len(cols), len(cols))); z = Xo @ beta
    for a, b in zip(starts, ends):
        zz = z[a:b]; e = np.exp(zz - zz.max()); p = e / e.sum(); Xg = Xo[a:b]
        mu = p @ Xg; H += (Xg * p[:, None]).T @ Xg - np.outer(mu, mu)
    se = np.sqrt(np.diag(np.linalg.pinv(H)))
    return {c: beta[i] / se[i] for i, c in enumerate(cols)}
zs = hessian_z(full_cols)
print('   full model z-scores: ' + ', '.join(f'{c[2:]} {v:+.1f}' for c, v in zs.items()))

if args.coef:
    cj = json.load(open(args.coef))
    print(f'\n--- 3. Out of sample: the coefficients fitted on {cj["label"]} applied here ---')
    res = []
    for name, cols in BLOCKS:
        b = np.array([cj['blocks'][name][c] for c in cols]); p = predict(design(t, cols), b, gid)
        res.append(grade_p(t, p, name))
    print(pd.DataFrame(res).to_string(index=False, float_format=lambda v: f'{v:.3f}'))
    b = np.array([cj['blocks'][full_name][c] for c in full_cols]); t['p_full'] = predict(design(t, full_cols), b, gid)
else:
    X = design(t, full_cols); p = np.zeros(len(t))
    for k in range(args.folds):
        tr = folds != k; te = ~tr
        bb = fit_clogit(X[tr], y[tr], gid[tr]); p[te] = predict(X[te], bb, gid[te])
    t['p_full'] = p
t['p_rate'] = t.g_pg.fillna(0.05).clip(lower=1e-6) / t.groupby('gameId').g_pg.transform(lambda s: s.fillna(0.05).clip(lower=1e-6).sum())

print('\n--- 4. Calibration: the stated first-goal probability against what happened (full model, out of fold) ---')
t['pb'] = pd.cut(t.p_full, [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.10, 1], labels=['<1%', '1-2', '2-3', '3-4', '4-5', '5-6', '6-8', '8-10', '10%+'])
print(t.groupby('pb', observed=True).agg(n=('fg', 'size'), stated=('p_full', 'mean'), scored_first=('fg', 'mean'), scored_any=('g1', 'mean')).to_string(float_format=lambda v: f'{v:.3f}'))
t['pb'] = pd.cut(t.p_rate, [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.10, 1], labels=['<1%', '1-2', '2-3', '3-4', '4-5', '5-6', '6-8', '8-10', '10%+'])
print('   the plain read, goal rate / Σ game:')
print(t.groupby('pb', observed=True).agg(n=('fg', 'size'), stated=('p_rate', 'mean'), scored_first=('fg', 'mean'), scored_any=('g1', 'mean')).to_string(float_format=lambda v: f'{v:.3f}'))

print('\n--- 5. The slate\'s top 10 by first-goal probability against the top 10 by goal rate (what the Whole slate view would list) ---')
for col, name in (('g_pg', 'goal rate'), ('p_rate', 'goal rate / Σ game'), ('p_full', 'full model')):
    d = t[['date', col, 'fg', 'g1', 'rand']].copy(); d['drk'] = d.sort_values([col, 'rand'], ascending=False).groupby('date').cumcount().add(1).reindex(d.index)
    s = d[d.drk <= 10]
    print(f'   {name:22s} top 10 a slate: scored first {s.fg.mean()*100:.1f}%, scored at all {s.g1.mean()*100:.1f}% ({len(s)} player-games)')

t.drop(columns=['pb']).to_csv(f'{out}-rows.csv', index=False)
print(f'\nwritten {out}-coef.json and {out}-rows.csv')

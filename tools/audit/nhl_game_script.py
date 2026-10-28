"""The game script, tested: how many shots and goals a team takes tonight from its own volume
(season, at tonight's venue, last ten) and the opponent's (what it allows, season, at its venue,
last ten; what it generates), then that volume divided among the skaters by the opponent's
weakness at each position. Graded against the board's plain-rate read on the same skater-games.

The NHL model (components/nhl/model-core.js) is built this way: Stage 1 team expected shots (the
players' anchors x a bucketed multiplier on the opponent's shots / iFF allowed x pace), Stage 2
the shares by line and position lane. The board's goals read since 2026-10-27 (picks-pure.js
`project`) is not: each skater's rate x the opponent's per-skater table at his position. This
script asks, from the box scores alone, which windows of each team move the team's volume, whether
the "strong at home vs leaky over the last ten" script holds, and whether a team projection split
by the opponent's position shares predicts the skaters better than the per-skater table does.

  python3 -I tools/audit/nhl_game_script.py \
    --fit-games .nhl-data/predictors/2025/games-pos --fit-rows .nhl-data/audit/out25/nhl-2026-04-16-rows.csv \
    --test-games .nhl-data/predictors/2026/games-pos --test-rows .nhl-data/audit/out/nhl-2026-10-27-rows.csv \
    --date 2026-10-27 --out .nhl-data/audit/out/nhl-game-script-2026-10-27.md

The rows CSVs are tools/audit/nhl-audit.mjs output (the shipped read and its variants per
skater-game, `studyNone` / `tableNone` = the individual read against a league-average opponent).
The team model is fitted on the fit season and applied unchanged to the test season.
"""
import argparse, glob, json, math, sys
from collections import defaultdict
from datetime import date as D, timedelta
import numpy as np, pandas as pd
import statsmodels.api as sm
from scipy.stats import poisson

ap = argparse.ArgumentParser()
for k in ('--fit-games', '--fit-rows', '--test-games', '--test-rows', '--date', '--out'): ap.add_argument(k, required=True)
args = ap.parse_args()
POS = ['C', 'LW', 'RW', 'D']
# The shipped formula's skater-level venue and back-to-back terms (picks-pure.js SHOTS_FIT / GOALS_FIT):
# the team layer carries venue and rest, so they come off the individual read.
S_HOME, S_B2B, G_HOME, G_B2B = 0.0341, -0.026, 0.0682, -0.0677
md = []
def line(s=''): md.append(s)
def table(head, rows):
    line('| ' + ' | '.join(head) + ' |'); line('| ' + ' | '.join('---' for _ in head) + ' |')
    for r in rows: line('| ' + ' | '.join(str(x) for x in r) + ' |')
    line()
pct = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{100 * v:.1f}%'
f2 = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v:.2f}'
f1 = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v:.1f}'
f4 = lambda v: '—' if v is None or (isinstance(v, float) and math.isnan(v)) else f'{v:.4f}'

# ---------------------------------------------------------------- the team-games
def load(d):
    games = []
    for f in sorted(glob.glob(f'{d}/*.json')): games += json.load(open(f))['games']
    return sorted(games, key=lambda g: (g['date'], g['id']))

def team_games(games):
    out = []
    for g in games:
        a, h = g['away']['abbrev'], g['home']['abbrev']
        sk = [s for s in g['skaters'] if s['pos'] in POS]
        for team, opp, home, side, other in ((a, h, 0, 'away', 'home'), (h, a, 1, 'home', 'away')):
            mine = [s for s in sk if s['team'] == team]; theirs = [s for s in sk if s['team'] == opp]
            r = dict(date=g['date'], gid=g['id'], team=team, opp=opp, home=home,
                     SF=sum(s['sog'] for s in mine), SA=sum(s['sog'] for s in theirs), GF=sum(s['g'] for s in mine), GA=sum(s['g'] for s in theirs),
                     CF=sum(s['icf'] for s in mine), CA=sum(s['icf'] for s in theirs), IF=sum(s['iff'] for s in mine), IA=sum(s['iff'] for s in theirs), XF=sum(s['iscf'] for s in mine), XA=sum(s['iscf'] for s in theirs),
                     score=g[side]['score'], oscore=g[other]['score'])
            for p in POS:
                r[f'SF_{p}'] = sum(s['sog'] for s in mine if s['pos'] == p); r[f'SA_{p}'] = sum(s['sog'] for s in theirs if s['pos'] == p)
                r[f'GF_{p}'] = sum(s['g'] for s in mine if s['pos'] == p); r[f'GA_{p}'] = sum(s['g'] for s in theirs if s['pos'] == p)
            out.append(r)
    return pd.DataFrame(out)

K, KV, KG, KSH = 10, 10, 30, 400   # shrink strengths: team shots (games), venue split (games), team goals (games), shooting % (shots)

def features(tg, lg_prior_sf, lg_prior_g):
    """Every team-game's leak-free reads: the team's and the opponent's history before the date (this season)."""
    hist = defaultdict(list); past = []
    rows = []
    for date, day in tg.groupby('date', sort=True):
        P = 64   # the league's figures carry a prior of 64 team-games until the season has its own
        n = len(past)
        lgSF = (sum(r['SF'] for r in past) + P * lg_prior_sf) / (n + P)
        lgG = (sum(r['GF'] for r in past) + P * lg_prior_g) / (n + P)
        lgSh = lgG / lgSF
        totS = sum(r['SF'] for r in past); totG = sum(r['GF'] for r in past)
        lgShareS = {p: ((sum(r[f'SF_{p}'] for r in past) + 200 * {'C': .26, 'LW': .22, 'RW': .22, 'D': .30}[p]) / (totS + 200)) for p in POS}
        lgShareG = {p: ((sum(r[f'GF_{p}'] for r in past) + 40 * {'C': .31, 'LW': .27, 'RW': .27, 'D': .15}[p]) / (totG + 40)) for p in POS}
        dd = D.fromisoformat(date); yday = (dd - timedelta(days=1)).isoformat()
        for r in day.to_dict('records'):
            T, O = hist[r['team']], hist[r['opp']]
            def side(H, venue):   # one team's reads: venue = the venue it plays at tonight (1 home, 0 away)
                nn = len(H)
                m = lambda k, L=None: (np.mean([x[k] for x in (H if L is None else H[-L:])]) if (H if L is None else H[-L:]) else None)
                out = dict(n=nn)
                for k, lgk, KK in (('SF', lgSF, K), ('SA', lgSF, K), ('GF', lgG, KG), ('GA', lgG, KG)):
                    allv = m(k)
                    shr = ((nn * allv + KK * lgk) / (nn + KK)) if nn else lgk
                    ven = [x[k] for x in H if x['home'] == venue]
                    vshr = (len(ven) * np.mean(ven) + KV * shr) / (len(ven) + KV) if ven else shr
                    l10 = m(k, 10) if nn > 10 else None
                    out[k] = shr; out[k + '_ven'] = vshr; out[k + '_l10r'] = (l10 / allv) if (l10 and allv) else 1.0; out[k + '_raw'] = allv
                    out[k + '_venraw'] = np.mean(ven) if ven else None; out[k + '_nven'] = len(ven); out[k + '_l10raw'] = l10
                sf = sum(x['SF'] for x in H); gf = sum(x['GF'] for x in H); sa = sum(x['SA'] for x in H); ga = sum(x['GA'] for x in H)
                out['sh'] = (gf + KSH * lgSh) / (sf + KSH); out['svA'] = (ga + KSH * lgSh) / (sa + KSH)   # finishing; goals allowed per shot against
                out['b2b'] = int(bool(H) and H[-1]['date'] == yday)
                out['IA_raw'] = m('IA')
                sa_p = {p: sum(x[f'SA_{p}'] for x in H) for p in POS}; ga_p = {p: sum(x[f'GA_{p}'] for x in H) for p in POS}
                out['shareS'] = {p: (sa_p[p], sa) for p in POS}; out['shareG'] = {p: (ga_p[p], ga) for p in POS}
                return out
            t = side(T, r['home']); o = side(O, 1 - r['home'])
            f = dict(r)
            f.update(lgSF=lgSF, lgG=lgG, lgSh=lgSh, nT=t['n'], nO=o['n'], b2bT=t['b2b'], b2bO=o['b2b'])
            f.update(
                tOff=math.log(t['SF'] / lgSF), tDef=math.log(t['SA'] / lgSF), oDef=math.log(o['SA'] / lgSF), oOff=math.log(o['SF'] / lgSF),
                tVen=math.log(t['SF_ven'] / t['SF']), oVen=math.log(o['SA_ven'] / o['SA']), tL10=math.log(t['SF_l10r']), oL10=math.log(o['SA_l10r']),
                tGF=math.log(t['GF'] / lgG), oGA=math.log(o['GA'] / lgG), tSh=math.log(t['sh'] / lgSh), oSv=math.log(o['svA'] / lgSh),
                tGFL10=math.log(t['GF_l10r'] or 1.0) if t['GF_l10r'] > 0 else 0.0, oGAL10=math.log(o['GA_l10r']) if o['GA_l10r'] > 0 else 0.0,
                tSFraw=t['SF_raw'], oIAraw=o['IA_raw'], tGFraw=t['GF_raw'], oGAraw=o['GA_raw'], tSAraw=t['SA_raw'], tSFvenraw=t['SF_venraw'], tSFnven=t['SF_nven'], oSAraw=o['SA_raw'], oSAl10=o['SA_l10raw'], tSFshr=t['SF'], oSAshr=o['SA'], tSFven=t['SF_ven'], oSAven=o['SA_ven'],
                lgShareS=lgShareS, lgShareG=lgShareG, oShareS=o['shareS'], oShareG=o['shareG'],
            )
            rows.append(f)
        for r in day.to_dict('records'): hist[r['team']].append(r); past.append(r)
    return pd.DataFrame(rows)

fit_tg = team_games(load(args.fit_games)); test_tg = team_games(load(args.test_games))
lg_fit_sf, lg_fit_g = 28.5, 3.0    # 2024-25 is not on hand: the fit season's first nights shrink toward a typical league figure
lg_test_sf, lg_test_g = fit_tg.SF.mean(), fit_tg.GF.mean()   # the test season's first nights shrink toward last season's league
fit = features(fit_tg, lg_fit_sf, lg_fit_g); test = features(test_tg, lg_test_sf, lg_test_g)
test = test[test.date <= args.date]

# ---------------------------------------------------------------- 1. the team layer
SHOT_MODELS = [
    ('League average', []),
    ('+ the team’s own shot volume (season)', ['tOff']),
    ('+ what the opponent allows (season)', ['tOff', 'oDef']),
    ('+ home ice, back-to-backs', ['tOff', 'oDef', 'home', 'b2bT', 'b2bO']),
    ('+ possession: the team’s own defense, the opponent’s offense', ['tOff', 'oDef', 'home', 'b2bT', 'b2bO', 'tDef', 'oOff']),
    ('+ venue splits: the team’s shooting at tonight’s venue, the opponent’s allowing at its venue', ['tOff', 'oDef', 'home', 'b2bT', 'b2bO', 'tDef', 'oOff', 'tVen', 'oVen']),
    ('+ last ten: the team’s shooting, the opponent’s allowing', ['tOff', 'oDef', 'home', 'b2bT', 'b2bO', 'tDef', 'oOff', 'tVen', 'oVen', 'tL10', 'oL10']),
]
GOAL_MODELS = [
    ('League average', []),
    ('Shots × finishing: the projected shots × the league’s shooting %', [], 'offG'),
    ('Shots × finishing: + the team’s finishing and the opponent’s goals per shot against, shrunk', ['tSh', 'oSv'], 'offG'),
    ('Shots × finishing: + home and the back-to-backs', ['tSh', 'oSv', 'home', 'b2bT', 'b2bO'], 'offG'),
    ('+ the team’s goals for, the opponent’s goals against (season)', ['tGF', 'oGA']),
    ('+ shot volume both ways and home', ['tGF', 'oGA', 'tOff', 'oDef', 'tDef', 'oOff', 'home', 'b2bT', 'b2bO']),
    ('+ finishing and the opponent’s goals per shot against', ['tGF', 'oGA', 'tOff', 'oDef', 'tDef', 'oOff', 'home', 'b2bT', 'b2bO', 'tSh', 'oSv']),
    ('+ venue splits and last ten (shots), last ten (goals)', ['tGF', 'oGA', 'tOff', 'oDef', 'tDef', 'oOff', 'home', 'b2bT', 'b2bO', 'tSh', 'oSv', 'tVen', 'oVen', 'tL10', 'oL10', 'tGFL10', 'oGAL10']),
]
def glm(df, y, cols, offset):
    X = sm.add_constant(df[cols], has_constant='add') if cols else np.ones((len(df), 1))
    return sm.GLM(df[y], X, family=sm.families.Poisson(), offset=np.log(df[offset])).fit()
def predict(m, df, cols, offset):
    X = sm.add_constant(df[cols], has_constant='add') if cols else np.ones((len(df), 1))
    return m.predict(X, offset=np.log(df[offset]))
def pdev(y, mu): y = np.asarray(y, float); mu = np.asarray(mu, float); return float(np.mean(2 * (np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / mu), 0) - (y - mu))))
def corr(a, b): return float(np.corrcoef(a, b)[0, 1])

fitR = fit[(fit.nT >= 3) & (fit.nO >= 3)]; testR = test[(test.nT >= 3) & (test.nO >= 3)]
line(f'# The game script, tested from the box scores (fit {fit.date.min()} → {fit.date.max()}, test {test.date.min()} → {args.date})')
line()
line(f'Fit season: {fit_tg.gid.nunique()} games ({len(fitR)} team-games with both teams 3+ games in). Test season: {test_tg[test_tg.date <= args.date].gid.nunique()} games ({len(testR)} team-games). '
     'Every read is built from the games before the date; the coefficients are fitted on the fit season and applied unchanged to the test season. '
     f'Shrinkage: a team’s shots at {K} games toward the league, its venue split at {KV} games toward its season, its goals at {KG} games, finishing at {KSH} shots.')
line()
line('## 1. What sets a team’s shots tonight')
line()
line('Each line adds reads to the one above. Deviance: Poisson, per team-game, lower is better; the fit season’s figure is two-fold cross-validated (first half of the dates against the second, and back), the test season’s is out of sample.')
line()
def cv_dev(df, y, cols, off):
    dates = sorted(df.date.unique()); half = dates[len(dates) // 2]
    a, b = df[df.date < half], df[df.date >= half]
    ma, mb = glm(a, y, cols, off), glm(b, y, cols, off)
    return (pdev(b[y], predict(ma, b, cols, off)) * len(b) + pdev(a[y], predict(mb, a, cols, off)) * len(a)) / len(df)
rows = []; shot_fits = {}
for label, cols in SHOT_MODELS:
    m = glm(fitR, 'SF', cols, 'lgSF'); shot_fits[label] = (m, cols)
    mu = predict(m, testR, cols, 'lgSF')
    rows.append([label, f4(cv_dev(fitR, 'SF', cols, 'lgSF')), f4(pdev(testR.SF, mu)), f2(float(np.mean(np.abs(testR.SF - mu)))), f2(corr(testR.SF, mu)) if cols else '—'])
table(['Team shots: reads', 'deviance, fit season (CV)', 'deviance, test season', 'MAE, test (shots)', 'correlation, test'], rows)
full_label, (mS, colsS) = list(shot_fits.items())[-1]
line('Coefficients of the full shots model (fit season; each is the elasticity of the team’s shots to the read, a log ratio; home and the back-to-backs are multipliers e^b):')
line()
table(['Read', 'coefficient', 'z', 'what one standard deviation of the read moves (fit season)'], [[k, f2(mS.params[k]), f1(mS.tvalues[k]), (f'{100 * (math.exp(mS.params[k] * fitR[k].std()) - 1):+.1f}% shots' if k not in ('home', 'b2bT', 'b2bO') else f'{100 * (math.exp(mS.params[k]) - 1):+.1f}% shots')] for k in colsS])

for df in (fit, test):
    df['projSF'] = predict(mS, df, colsS, 'lgSF'); df['offG'] = df.projSF * df.lgSh
fitR = fit[(fit.nT >= 3) & (fit.nO >= 3)]; testR = test[(test.nT >= 3) & (test.nO >= 3)]

line('### The model’s own Stage 1 against the fitted one')
line()
line('`model-core.js` sets a team’s expected shots as the sum of its players’ shot anchors (the team’s own volume) × a step on the opponent’s shots allowed a game (31+ → +6%, 29–31 → +2%, else −3%) and on its unblocked attempts allowed (45+ → +6%, 43–45 → +2%, else −3%), × a pace ceiling (±6% at most, left out here: the pace workbook is not public). Its goals: 0.52 × the players’ goal rates + 0.48 × the opponent’s goals allowed, × a step (3.2+ allowed → +8%, 2.6 or fewer → −7%). Rebuilt here from the same season-to-date figures, the team’s raw averages as the anchors.')
line()
def stage1_shots(df):
    v = df.oSAraw.fillna(df.lgSF); ia = df.oIAraw.fillna(df.oSAraw.fillna(df.lgSF) * 1.45)
    mult = 1 + np.where(v >= 31, .06, np.where(v >= 29, .02, -.03)) + np.where(ia >= 45, .06, np.where(ia >= 43, .02, -.03))
    return np.clip(df.tSFraw.fillna(df.lgSF) * mult, 18, 42)
def stage1_goals(df):
    ga = df.oGAraw.fillna(df.lgG)
    mult = np.clip(0.96 + np.where(ga >= 3.2, .08, np.where(ga <= 2.6, -.07, 0)), .84, 1.2)
    return np.clip((0.52 * df.tGFraw.fillna(df.lgG) + 0.48 * ga) * mult, 1.55, 5.0)
rows = []
for label, R in (('Fit season', fitR), ('Fit season, both teams 20+ games in', fitR[(fitR.nT >= 20) & (fitR.nO >= 20)]), ('Test season', testR)):
    a = stage1_shots(R); b = R.projSF; ga = stage1_goals(R)
    rows.append([label, f4(pdev(R.SF, a)), f2(float(np.mean(np.abs(R.SF - a)))), f4(pdev(R.SF, b)), f2(float(np.mean(np.abs(R.SF - b)))), f'{(a.mean()):.1f} / {(b.mean()):.1f} / {R.SF.mean():.1f}', f4(pdev(R.GF, ga)), f2(float(np.mean(np.abs(R.GF - ga)))), f4(pdev(R.GF, R.lgG)), f4(pdev(R.GF, R.projSF * R.lgSh))])
table(['Season', 'Stage 1 shots: deviance', 'MAE', 'fitted shots: deviance', 'MAE', 'mean said: Stage 1 / fitted / shots taken', 'Stage 1 goals: deviance', 'MAE', 'every team the league’s goals: deviance', 'fitted shots × the league’s shooting %: deviance'], rows)
iaLg = fit.IA.mean()
line(f'The opponent’s side of Stage 1 is a step that bottoms out at −6% (both steps at −3%). The league allowed {fit.SA.mean():.1f} shots and {iaLg:.1f} unblocked attempts a team-game last season, so the iFF step reads +6% only for the leakiest few and the shots step’s −3% floor applies to every defense at 28.9 or under. The fitted elasticity on what the opponent allows is {f2(mS.params["oDef"])}: a defense allowing 24 a game (15% under the league) takes about {100 * (1 - (24 / fit.SA.mean()) ** mS.params["oDef"]):.0f}% off a team’s shots, one allowing 32 adds {100 * ((32 / fit.SA.mean()) ** mS.params["oDef"] - 1):.0f}%; the step reads −6% and +8 to +12% for the same two.')
line()

line('## 2. What sets a team’s goals tonight')
line()
rows = []; goal_fits = {}; cvs = {}
for spec in GOAL_MODELS:
    label, cols = spec[0], spec[1]; off = spec[2] if len(spec) > 2 else 'lgG'
    m = glm(fitR, 'GF', cols, off); goal_fits[label] = (m, cols, off)
    mu = predict(m, testR, cols, off); cvs[label] = cv_dev(fitR, 'GF', cols, off)
    rows.append([label, f4(cvs[label]), f4(pdev(testR.GF, mu)), f2(float(np.mean(np.abs(testR.GF - mu)))), f2(corr(testR.GF, mu)) if (cols or off != 'lgG') else '—'])
table(['Team goals (no shootout): reads', 'deviance, fit season (CV)', 'deviance, test season', 'MAE, test (goals)', 'correlation, test'], rows)
line('Goals for, shooting % and shots are nearly the same read three ways (goals = shots × shooting %), so the models that carry all three fit one half of a season and miss the other; the shots-times-finishing form keeps one of each.')
line()
gl_label = min((k for k in cvs if goal_fits[k][2] == 'offG'), key=lambda k: cvs[k])
mG, colsG, offG = goal_fits[gl_label]
line(f'The goals model used below: “{gl_label}” (the lowest cross-validated deviance of the shots-times-finishing forms). Coefficients (fit season):')
line()
table(['Read', 'coefficient', 'z'], [[k, f2(mG.params[k]), f1(mG.tvalues[k])] for k in colsG] or [['(none: the projected shots × the league’s shooting %)', '', '']])

for df in (fit, test):
    df['projGF'] = predict(mG, df, colsG, offG)
# the opponent's projection for the same game: its shots are this team's shots against
for df in (fit, test):
    opp = df[['gid', 'team', 'projSF', 'projGF']].rename(columns={'team': 'opp', 'projSF': 'projSA', 'projGF': 'projGA'})
    df[['projSA', 'projGA']] = df[['gid', 'opp']].merge(opp, on=['gid', 'opp'], how='left')[['projSA', 'projGA']].values
    df['projShare'] = df.projSF / (df.projSF + df.projSA); df['share'] = df.SF / (df.SF + df.SA)
    df['gShare'] = np.where(df.GF + df.GA > 0, df.GF / (df.GF + df.GA).replace(0, np.nan), np.nan)
    df['win'] = (df.score > df.oscore).astype(int)

# ---------------------------------------------------------------- 3. the script itself
line('## 3. “Strong at home, against a visitor leaking over its last ten”: what happened')
line()
line('Home teams by their shots a game at home this season (thirds of the league that night), against visitors by their shots allowed over their last ten (thirds); both teams 10+ games in. Shots against the home team’s own home average, its share of the game’s shots, its share of the goals and its wins.')
line()
def tiers(df):
    # thirds over the season's games: the home team's shots a game at home, the visitor's shots allowed over its last ten
    d = df[(df.home == 1) & (df.nT >= 10) & (df.nO >= 10)].copy()
    if len(d) < 30: return d
    d['homeTier'] = pd.qcut(d.tSFvenraw.rank(method='first'), 3, labels=['low', 'mid', 'high'])
    d['visL10Tier'] = pd.qcut(d.oSAl10.rank(method='first'), 3, labels=['tight', 'mid', 'leaky'])
    d['visSznTier'] = pd.qcut(d.oSAraw.rank(method='first'), 3, labels=['tight', 'mid', 'leaky'])
    return d
for label, df in (('Fit season', fit), ('Test season', test)):
    d = tiers(df)
    if len(d) < 30: line(f'{label}: {len(d)} games with both teams 10+ games in; too few to cut.'); line(); continue
    rows = []
    for ht in ['high', 'mid', 'low']:
        for vt in ['leaky', 'mid', 'tight']:
            c = d[(d.homeTier == ht) & (d.visL10Tier == vt)]
            if not len(c): continue
            rows.append([f'home {ht} × visitor L10 {vt}', len(c), f1(c.SF.mean()), f'{(c.SF - c.tSFvenraw).mean():+.1f}', f1(c.projSF.mean()), pct(c.share.mean()), pct(c.projShare.mean()), pct(c.gShare.mean()), pct(c.win.mean())])
    line(f'**{label}** ({len(d)} games)')
    line()
    table(['Script', 'games', 'home shots', 'vs its home average', 'projected (full model)', 'home share of shots', 'projected share', 'home share of goals', 'home wins'], rows)
    c = d[(d.homeTier == 'high') & (d.visSznTier == 'leaky')]; c2 = d[(d.homeTier == 'high') & (d.visL10Tier == 'leaky')]
    line(f'The same script with the visitor’s season-long shots allowed in place of its last ten: {len(c)} games, home shots {f1(c.SF.mean())} ({(c.SF - c.tSFvenraw).mean():+.1f} on its home average), share {pct(c.share.mean())}, goals share {pct(c.gShare.mean())}, wins {pct(c.win.mean())} — against the last-ten cut’s {f1(c2.SF.mean())} ({(c2.SF - c2.tSFvenraw).mean():+.1f}), {pct(c2.share.mean())}, {pct(c2.gShare.mean())}, {pct(c2.win.mean())}.')
    line()

line('### Does a projected edge in shots carry to the goals and the result?')
line()
for label, df in (('Fit season', fit), ('Test season', test)):
    d = df[(df.nT >= 5) & (df.nO >= 5)].copy()
    d['bin'] = pd.cut(d.projShare, [0, 0.44, 0.47, 0.5, 0.53, 0.56, 1], labels=['under 44%', '44–47%', '47–50%', '50–53%', '53–56%', '56%+'])
    rows = [[b, len(c), pct(c.projShare.mean()), pct(c.share.mean()), pct(c.gShare.mean()), pct(c.win.mean()), f1(c.projSF.mean()), f1(c.SF.mean())] for b, c in d.groupby('bin', observed=True)]
    line(f'**{label}**: slope of the realized share on the projected share {f2(np.polyfit(d.projShare, d.share, 1)[0])} (1 = the projection holds in full), correlation of shot share and goal share in a game {f2(d[["share", "gShare"]].dropna().corr().iloc[0, 1])}.')
    line()
    table(['Projected share of the game’s shots', 'team-games', 'projected', 'realized share of shots', 'share of goals', 'wins', 'projected shots', 'shots'], rows)

# ---------------------------------------------------------------- 4. dividing the volume
line('## 4. Dividing the team’s shots and goals among the skaters by the opponent’s weakness')
line()
line('Each skater’s individual read against a league-average opponent at a neutral venue (the shipped formula’s own rate, attempts and TOI with the league figure at his position in place of the opponent’s, the skater-level home and back-to-back terms off: `tableNone`; or the study’s blended rates, `studyNone`, test season only) × the **script multiplier**, the team’s projected shots tonight over its usual (every term of the full model except its own level: the opponent’s allowing, venue, last ten, rest, possession) × the **position tilt**, the opponent’s share of the shots it allows that go to his position over the league’s share (shrunk toward the league at a pseudo-count of shots, to a power), normalised over the team’s skaters so the tilt divides the volume and adds none. Goals the same from the goals model and the opponent’s share of goals allowed by position.')
line()
GAME_TERMS = [c for c in colsS if c not in ('tOff', 'tDef')]   # his own rate already carries his team's usual level
GAME_TERMS_G = [c for c in colsG if c not in ('tGF', 'tOff', 'tDef', 'tSh')]   # with the shots-times-finishing form: the opponent's goals per shot against, venue, rest
def script_mult(df, m, cols):
    x = np.zeros(len(df))
    for c in cols:
        v = df[c].astype(float).values
        if c == 'home': v = v - 0.5   # his rate is half home, half away
        x += m.params[c] * v
    return np.exp(x)
for df in (fit, test):
    df['M_S'] = script_mult(df, mS, GAME_TERMS); df['M_G'] = df.M_S * script_mult(df, mG, GAME_TERMS_G) if offG == 'offG' else script_mult(df, mG, GAME_TERMS_G)

def load_rows(path):
    r = pd.read_csv(path)
    r['home'] = r.home.astype(str).str.lower().eq('true').astype(int); r['b2b'] = r.b2b.astype(str).str.lower().eq('true').astype(int)
    return r
fitS = load_rows(args.fit_rows); testS = load_rows(args.test_rows)
def join(rows, tf):
    keep = tf[['gid', 'team', 'opp', 'M_S', 'M_G', 'projSF', 'projGF', 'tSFshr', 'oShareS', 'oShareG', 'lgShareS', 'lgShareG', 'nO', 'oSAshr', 'oSAl10', 'oSAraw', 'tSFvenraw', 'tSFraw', 'SF', 'SA']].rename(columns={'gid': 'gameId', 'SF': 'teamSF', 'SA': 'teamSA'})
    return rows.merge(keep, on=['gameId', 'team', 'opp'], how='inner')
fitJ = join(fitS, fit); testJ = join(testS, test)
fitJ = fitJ[fitJ.date >= '2025-10-20']   # last season's first nights: the fit season has no 2024-25 behind it

line('### Is an opponent’s weakness by position a trait? (fit season, every team’s games split odd / even)')
line()
line('If a defense gives an unusual share of its shots to defensemen, or to left wings, in half its games, does it in the other half? The same for the volume it allows, as a check that the split itself works.')
line()
def split_half(tg):
    out = []
    for team, g in tg.sort_values('date').groupby('team'):
        g = g.reset_index(drop=True); a, b = g[g.index % 2 == 0], g[g.index % 2 == 1]
        r = dict(team=team, SA_a=a.SA.mean(), SA_b=b.SA.mean(), GA_a=a.GA.mean(), GA_b=b.GA.mean())
        for p in POS:
            r[f'S_{p}_a'] = a[f'SA_{p}'].sum() / a.SA.sum(); r[f'S_{p}_b'] = b[f'SA_{p}'].sum() / b.SA.sum()
            r[f'G_{p}_a'] = a[f'GA_{p}'].sum() / max(1, a.GA.sum()); r[f'G_{p}_b'] = b[f'GA_{p}'].sum() / max(1, b.GA.sum())
            r[f'P_{p}_a'] = a[f'SA_{p}'].mean(); r[f'P_{p}_b'] = b[f'SA_{p}'].mean()
        out.append(r)
    return pd.DataFrame(out)
sh = split_half(fit_tg)
rows = [['Shots allowed a game (the volume)', f2(corr(sh.SA_a, sh.SA_b)), f2(sh[['SA_a', 'SA_b']].stack().std()), '—'], ['Goals allowed a game', f2(corr(sh.GA_a, sh.GA_b)), f2(sh[['GA_a', 'GA_b']].stack().std()), '—']]
for p in POS:
    rows.append([f'Share of its shots allowed that go to {p}', f2(corr(sh[f'S_{p}_a'], sh[f'S_{p}_b'])), pct(sh[[f"S_{p}_a", f"S_{p}_b"]].stack().std()), pct(sh[[f"S_{p}_a", f"S_{p}_b"]].stack().mean())])
for p in POS:
    rows.append([f'Shots allowed to {p} a game (volume × share, the per-position table)', f2(corr(sh[f'P_{p}_a'], sh[f'P_{p}_b'])), f2(sh[[f"P_{p}_a", f"P_{p}_b"]].stack().std()), '—'])
for p in POS:
    rows.append([f'Share of its goals allowed that go to {p}', f2(corr(sh[f'G_{p}_a'], sh[f'G_{p}_b'])), pct(sh[[f"G_{p}_a", f"G_{p}_b"]].stack().std()), pct(sh[[f"G_{p}_a", f"G_{p}_b"]].stack().mean())])
def venue_gap(tg):
    out = []
    for team, g in tg.sort_values('date').groupby('team'):
        h = g[g.home == 1].reset_index(drop=True); a = g[g.home == 0].reset_index(drop=True)
        out.append(dict(gap_a=h[h.index % 2 == 0].SF.mean() - a[a.index % 2 == 0].SF.mean(), gap_b=h[h.index % 2 == 1].SF.mean() - a[a.index % 2 == 1].SF.mean(),
                        agap_a=h[h.index % 2 == 0].SA.mean() - a[a.index % 2 == 0].SA.mean(), agap_b=h[h.index % 2 == 1].SA.mean() - a[a.index % 2 == 1].SA.mean()))
    return pd.DataFrame(out)
vg = venue_gap(fit_tg)
rows.append(['A team’s own home-minus-away shots for (how much better it shoots at home)', f2(corr(vg.gap_a, vg.gap_b)), f2(vg[['gap_a', 'gap_b']].stack().std()), f'{vg[["gap_a", "gap_b"]].stack().mean():+.1f}'])
rows.append(['A team’s own home-minus-away shots against', f2(corr(vg.agap_a, vg.agap_b)), f2(vg[['agap_a', 'agap_b']].stack().std()), f'{vg[["agap_a", "agap_b"]].stack().mean():+.1f}'])
table(['Read (41 games a half)', 'correlation, one half to the other', 'spread between teams (sd)', 'league average'], rows)

def tilt(df, Kp, c, which='S'):
    share, lg = ('oShareS', 'lgShareS') if which == 'S' else ('oShareG', 'lgShareG')
    t = []
    for o, l, p in zip(df[share], df[lg], df.pos):
        a, n = o[p]; ls = l[p]
        t.append((((a + Kp * ls) / (n + Kp)) / ls) ** c)
    return np.array(t)
def normalise(df, raw, base):
    d = pd.DataFrame({'gameId': df.gameId.values, 'team': df.team.values, 'w': base * raw, 'b': base})
    s = d.groupby(['gameId', 'team'])[['w', 'b']].transform('sum')
    return raw * (s.b / s.w).values

def reads(df, Kp=300, c=1.0, KpG=40, cG=1.0, d=1.0, dG=1.0):
    out = {}
    ownS = df['tableNone.lamS'] / np.exp(S_HOME * df.home + S_B2B * df.b2b)
    ownG = df['tableNone.lamG'] / np.exp(G_HOME * df.home + G_B2B * df.b2b)
    tS = normalise(df, tilt(df, Kp, c, 'S'), ownS.values); tG = normalise(df, tilt(df, KpG, cG, 'G'), ownG.values)
    out['site'] = (df['site.lamS'].values, df['site.lamG'].values)
    out['none'] = (df['tableNone.lamS'].values, df['tableNone.lamG'].values)
    out['scriptM'] = ((ownS * df.M_S ** d).values, (ownG * df.M_G ** dG).values)
    out['scriptMT'] = ((ownS * df.M_S ** d * tS).values, (ownG * df.M_G ** dG * tG).values)
    if 'studyNone.lamS' in df and df['studyNone.lamS'].notna().any():
        sS = df['studyNone.lamS'] / np.exp(S_HOME * df.home + S_B2B * df.b2b); sG = df['studyNone.lamG'] / np.exp(G_HOME * df.home + G_B2B * df.b2b)
        out['study'] = (df['study.lamS'].values, df['study.lamG'].values)
        out['studyMT'] = ((sS * df.M_S ** d * normalise(df, tilt(df, Kp, c, 'S'), sS.values)).values, (sG * df.M_G ** dG * normalise(df, tilt(df, KpG, cG, 'G'), sG.values)).values)
    return out
LABELS = {'site': 'Shipped: his rate × the opponent’s per-skater table at his position (this season)', 'none': 'His rate alone (league-average opponent)', 'scriptM': 'Game script: his rate × the team’s projected shots tonight over its usual', 'scriptMT': 'Game script + the opponent’s position shares (the volume divided by its weaknesses)', 'study': 'The study as fitted (rates and table blended into last season)', 'studyMT': 'Game script + position shares on the study’s blended rates'}
def brier(lam, y, k): p = poisson.sf(k - 1, lam); return float(np.mean((p - (y >= k)) ** 2))
def said_hit(lam, y, k): p = poisson.sf(k - 1, lam); return float(np.mean(p)), float(np.mean(y >= k))

# tune the tilt and the multiplier's strength on the fit season, then apply to the test season
grid = []
for Kp in (150, 300, 600, 1200):
    for c in (0.5, 1.0):
        for d in (0.5, 1.0, 1.5):
            lamS = reads(fitJ, Kp=Kp, c=c, d=d)['scriptMT'][0]
            grid.append((brier(lamS, fitJ.sog.values, 3), Kp, c, d))
grid.sort(); _, bKp, bc, bd = grid[0]
gridG = []
for KpG in (20, 40, 80, 160):
    for cG in (0.5, 1.0):
        for dG in (0.5, 1.0, 1.5):
            lamG = reads(fitJ, KpG=KpG, cG=cG, dG=dG)['scriptMT'][1]
            gridG.append((brier(lamG, fitJ.g.values, 1), KpG, cG, dG))
gridG.sort(); _, bKpG, bcG, bdG = gridG[0]
line(f'Tuned on the fit season (3+ SOG Brier, then 1+ goal Brier): the shots tilt at a pseudo-count of {bKp} shots to the power {bc}, the script multiplier to the power {bd}; the goals tilt at {bKpG} goals to the power {bcG}, the goals multiplier to the power {bdG}. The test season reads with these, unchanged.')
line()
for label, J in (('Fit season (tuned here; ' + f'{len(fitJ)} skater-games, every skater with five games this season)', fitJ), ('Test season (out of sample; ' + f'{len(testJ)} skater-games)', testJ)):
    R = reads(J, Kp=bKp, c=bc, KpG=bKpG, cG=bcG, d=bd, dG=bdG)
    rows = []
    for k, (lamS, lamG) in R.items():
        ok = ~(np.isnan(lamS) | np.isnan(lamG))
        y, yg = J.sog.values[ok], J.g.values[ok]
        s3, h3 = said_hit(lamS[ok], y, 3); s1, h1 = said_hit(lamG[ok], yg, 1)
        rows.append([LABELS[k], int(ok.sum()), f4(brier(lamS[ok], y, 2)), f'{pct(s3)} → {pct(h3)}', f4(brier(lamS[ok], y, 3)), f4(brier(lamS[ok], y, 4)), f'{pct(s1)} → {pct(h1)}', f4(brier(lamG[ok], yg, 1))])
    line(f'**{label}**')
    line()
    table(['Read', 'n', '2+ SOG Brier', '3+ said → hit', '3+ Brier', '4+ Brier', '1+ goal said → hit', '1+ G Brier'], rows)

line('### The position split where the opponent has a season behind it')
line()
line('The same reads on the fit season’s skater-games against an opponent with 30+ games in, the tilt at a lighter shrink as well as the tuned one.')
line()
late = fitJ[fitJ.nO >= 30]
rows = []
for label, kw in (('Game script, no position split', dict(Kp=bKp, c=0.0, d=bd)), ('+ split, tuned (' + f'{bKp} shots, power {bc})', dict(Kp=bKp, c=bc, d=bd)), ('+ split at 300 shots, power 1', dict(Kp=300, c=1.0, d=bd)), ('+ split at 100 shots, power 1', dict(Kp=100, c=1.0, d=bd))):
    lamS = reads(late, **kw)['scriptMT'][0]
    s3, h3 = said_hit(lamS, late.sog.values, 3)
    rows.append([label, len(late), f4(brier(lamS, late.sog.values, 3)), f4(brier(lamS, late.sog.values, 4)), f'{pct(s3)} → {pct(h3)}'])
lamSite = late['site.lamS'].values; s3, h3 = said_hit(lamSite, late.sog.values, 3)
rows.append(['Shipped (per-skater table at his position)', len(late), f4(brier(lamSite, late.sog.values, 3)), f4(brier(lamSite, late.sog.values, 4)), f'{pct(s3)} → {pct(h3)}'])
table(['Read, opponent 30+ games in', 'n', '3+ Brier', '4+ Brier', '3+ said → hit'], rows)

# the top of the board: the Best bets rule (floor 50% for 3+ SOG, 35% for 1+ goal, three to four a game)
def rule(J, lam, k, floor, stat):
    p = poisson.sf(k - 1, lam); d = J.assign(p=p, y=(J[stat] >= k).astype(int))
    rows = []
    for gid, g in d.groupby('gameId'):
        g = g.sort_values('p', ascending=False); over = int((g.p >= floor).sum())
        t = g.head(min(4, max(3, over))); rows.append(t[t.p >= floor])
    r = pd.concat(rows) if rows else d.iloc[:0]
    return len(r), r.p.mean() if len(r) else None, r.y.mean() if len(r) else None
def bands(J, lam, k, stat, cuts):
    p = poisson.sf(k - 1, lam); y = (J[stat].values >= k)
    return [f'{int(((p >= lo) & (p < hi)).sum())} · {pct(p[(p >= lo) & (p < hi)].mean() if ((p >= lo) & (p < hi)).any() else None)} → {pct(y[(p >= lo) & (p < hi)].mean() if ((p >= lo) & (p < hi)).any() else None)}' for lo, hi in cuts]
line('### The top of the board')
line()
for label, J in (('Fit season', fitJ), ('Test season', testJ)):
    R = reads(J, Kp=bKp, c=bc, KpG=bKpG, cG=bcG, d=bd, dG=bdG)
    rows = []
    for k, (lamS, lamG) in R.items():
        if np.isnan(lamS).any() or np.isnan(lamG).any(): continue
        n, s, h = rule(J, lamS, 3, 0.5, 'sog'); ng, sg, hg = rule(J, lamG, 1, 0.35, 'g')
        rows.append([LABELS[k], f'{n} · {pct(s)} → {pct(h)}', *bands(J, lamS, 3, 'sog', [(0.5, 0.6), (0.6, 0.7), (0.7, 1.01)]), f'{ng} · {pct(sg)} → {pct(hg)}', *bands(J, lamG, 1, 'g', [(0.3, 0.4), (0.4, 1.01)])])
    line(f'**{label}**')
    line()
    table(['Read', 'Best bets shots rows: n · said → hit', '3+ said 50–60%', '60–70%', '70%+', 'Best bets goals rows', '1+ G said 30–40%', '40%+'], rows)

# where the script's multiplier is large: does it hold?
line('### Where the script says the team will out- or under-shoot its usual')
line()
for label, J in (('Fit season', fitJ), ('Test season', testJ)):
    R = reads(J, Kp=bKp, c=bc, KpG=bKpG, cG=bcG, d=bd, dG=bdG)
    d = J.assign(lamScr=R['scriptMT'][0], lamSite=R['site'][0], lamNone=R['none'][0])
    d['Mbin'] = pd.cut(d.M_S ** bd, [0, 0.92, 0.97, 1.03, 1.08, 9], labels=['under 0.92', '0.92–0.97', '0.97–1.03', '1.03–1.08', '1.08+'])
    rows = [[b, len(c), f2(c.M_S.mean()), f2(c.lamNone.mean()), f2(c.lamScr.mean()), f2(c.lamSite.mean()), f2(c.sog.mean()), f'{(c.sog.mean() / c.lamNone.mean()):.2f}'] for b, c in d.groupby('Mbin', observed=True)]
    line(f'**{label}**')
    line()
    table(['Script multiplier', 'skater-games', 'mean multiplier', 'his rate alone', 'game script', 'shipped', 'shots he took', 'took over his rate'], rows)

# ---------------------------------------------------------------- 5. the slate
line(f'## 5. The slate of {args.date} through the script')
line()
day = test[test.date == args.date].copy()
R = reads(testJ, Kp=bKp, c=bc, KpG=bKpG, cG=bcG, d=bd, dG=bdG)
T = testJ.assign(pS=poisson.sf(2, R['scriptMT'][0]), pG=1 - np.exp(-R['scriptMT'][1]), pSsite=poisson.sf(2, R['site'][0]), pGsite=1 - np.exp(-R['site'][1]), lamScr=R['scriptMT'][0], lamGScr=R['scriptMT'][1])
T = T[T.date == args.date]
rows = []
for gid in day.gid.unique():
    g = day[day.gid == gid].sort_values('home')
    for _, r in g.iterrows():
        rows.append([f'{r.team} {"vs" if r.home else "at"} {r.opp}', f1(r.tSFraw), f1(r.tSFvenraw) if r.tSFvenraw is not None and not (isinstance(r.tSFvenraw, float) and math.isnan(r.tSFvenraw)) else '—', f'{f1(r.oSAraw)} / {f1(r.oSAl10) if r.oSAl10 else "—"}', f1(r.projSF), f2(r.M_S ** bd), pct(r.projShare), f2(r.projGF), f'{r.SF} ({pct(r.share)})', f'{r.GF}–{r.GA}'])
table(['Team', 'its shots a game', 'at tonight’s venue', 'opponent allows: season / last ten', 'projected shots', 'script multiplier', 'projected share', 'projected goals', 'shots (share)', 'goals'], rows)
tally = {'site': [0, 0], 'script': [0, 0], 'siteG': [0, 0], 'scriptG': [0, 0]}
for gid in T.gameId.unique():
    g = T[T.gameId == gid]
    for key, col, k, floor, stat in (('site', 'pSsite', 3, .5, 'sog'), ('script', 'pS', 3, .5, 'sog'), ('siteG', 'pGsite', 1, .35, 'g'), ('scriptG', 'pG', 1, .35, 'g')):
        s = g.sort_values(col, ascending=False); over = int((s[col] >= floor).sum()); t = s.head(min(4, max(3, over))); t = t[t[col] >= floor]
        tally[key][0] += int((t[stat] >= k).sum()); tally[key][1] += len(t)
sl = day.dropna(subset=['projShare'])
line(f'On the slate the projected share of the game’s shots and the share taken correlate {f2(corr(sl.projShare, sl.share))} over {len(sl)} team-games; the winners took {pct(sl[sl.win == 1].share.mean())} of the shots, the projected favourite by share won {int(((sl.projShare > 0.5) & (sl.win == 1)).sum())} of {int((sl.projShare > 0.5).sum())}.')
line()
line(f'Over the floor on the slate: shots {tally["script"][0]} / {tally["script"][1]} by the script against {tally["site"][0]} / {tally["site"][1]} shipped; goals {tally["scriptG"][0]} / {tally["scriptG"][1]} against {tally["siteG"][0]} / {tally["siteG"][1]}.')
line()
for gid in T.gameId.unique():
    g = T[T.gameId == gid]
    teams = day[day.gid == gid].sort_values('home')
    head = ' @ '.join(f'{r.team} {r.score}' for _, r in teams.iterrows())
    line(f'### {head}')
    line()
    s = g.sort_values('pS', ascending=False).head(6)
    table(['Skater', 'pos', 'shipped P(3+)', 'script P(3+)', 'script λ', 'shots', 'shipped P(1+ G)', 'script P(1+ G)', 'goals'], [[r['name'], r.pos, pct(r.pSsite), pct(r.pS), f2(r.lamScr), r.sog, pct(r.pGsite), pct(r.pG), r.g] for _, r in s.iterrows()])

open(args.out, 'w').write('\n'.join(md))
print('\n'.join(md))
print(f'written {args.out}', file=sys.stderr)

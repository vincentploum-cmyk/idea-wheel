"""The frame behind the drivers study (tools/predictors/drivers.py): one row per skater-game of the seasons given, every
read on it built from the games before it.

  python3 -I tools/predictors/drivers_frame.py <out.pkl> --toi .nhl-data/toi <games-pos dir> [...]   (oldest season first)

From the games (tools/predictors/fetch.mjs → relabel.py): shots, goals, assists, attempts, chances, minutes, power-play
shots. From the NHL stats API's game reports (tools/audit/nhl-toi-fetch.sh): the minutes split even strength / power play
/ short-handed, each team's power plays and kills. Built here, leak-free:
  s_* / l3_ / l5_ / l10_ / l15_ / ls_*   his season to date, his last 3 / 5 / 10 / 15 (across the season boundary), last season
  v_*                                    his season to date at tonight's venue
  gstreak / pstreak / s3streak           games in a row with a goal / a point / 3+ SOG going in (this season)
  slot / slot_played / pp_rank           the line by his last-10 minutes among the skaters dressed tonight; by tonight's (hindsight)
  opp_* / team_*                         the opponent's and his team's tables, season to date and last 10, the position cell
  miss_*                                 his team's regulars not dressed tonight (miss_*_new: out three games or fewer)
  site_lam_s / site_lam_g                the site's plain-rate formula (lib/nhl-data/picks-pure.js) on the same reads
"""
import argparse, glob, json, math, os
import numpy as np, pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('dirs', nargs='+'); ap.add_argument('--toi', default=None)
args = ap.parse_args()

# ── the games ────────────────────────────────────────────────────────────────────────────────────────────────────────
sk, tg, gk = [], [], []
for d in args.dirs:
    for f in sorted(glob.glob(f'{d}/*.json')):
        for g in json.load(open(f))['games']:
            season = int(str(g['season'])[:4]); ot = g.get('lastPeriodType', 'REG') != 'REG'
            for side, other, v in (('home', 'away', 'H'), ('away', 'home', 'A')):
                tg.append(dict(gid=g['id'], date=g['date'], season=season, team=g[side]['abbrev'], opp=g[other]['abbrev'], home=int(v == 'H'),
                               gf=g[side]['score'], ga=g[other]['score'], sf=g[side]['sog'], sa=g[other]['sog'], ot=int(ot)))
            for s in g['skaters']:
                sk.append(dict(gid=g['id'], date=g['date'], season=season, id=s['id'], name=s['name'], team=s['team'], opp=s['opp'],
                               home=int(s['venue'] == 'H'), pos=s['pos'], toi=s['toi'], g=s['g'], a=s['a'], sog=s['sog'], icf=s['icf'], iff=s['iff'],
                               iscf=s['iscf'], ihdcf=s['ihdcf'], ppsog=s.get('ppSog', 0) or 0, hits=s.get('hits', 0), blk=s.get('blk', 0)))
            for k in g['goalies']:
                if k.get('starter'): gk.append(dict(gid=g['id'], date=g['date'], season=season, gkid=k['id'], team=k['team'], sa=k['sa'], ga=k['ga']))
sk = pd.DataFrame(sk); tg = pd.DataFrame(tg); gk = pd.DataFrame(gk)
sk = sk[sk.toi > 0].copy()
sk['pts'] = sk.g + sk.a
sk['F'] = (sk.pos != 'D').astype(int)

# ── the minutes split and the power plays ────────────────────────────────────────────────────────────────────────────
if args.toi:
    def load(rep): return pd.DataFrame([x for f in sorted(glob.glob(f'{args.toi}/*/{rep}-*.json')) for x in json.load(open(f))['data']])
    t = load('skater-timeonice').drop_duplicates(['gameId', 'playerId'])
    for c in ('evTimeOnIce', 'ppTimeOnIce', 'shTimeOnIce'): t[c] = t[c].fillna(0) / 60
    t = t.rename(columns={'gameId': 'gid', 'playerId': 'id', 'evTimeOnIce': 'ev', 'ppTimeOnIce': 'pp', 'shTimeOnIce': 'sh'})[['gid', 'id', 'ev', 'pp', 'sh']]
    sk = sk.merge(t, on=['gid', 'id'], how='left')
    pp = load('team-powerplay').drop_duplicates(['gameId', 'teamId']); pk = load('team-penaltykill').drop_duplicates(['gameId', 'teamId'])
    # the reports name the opponent, not the team: the team is the game's other side
    def own(df): return df.rename(columns={'gameId': 'gid', 'opponentTeamAbbrev': 'opp'})
    pp = own(pp)[['gid', 'opp', 'ppOpportunities', 'ppTimeOnIcePerGame', 'powerPlayGoalsFor']].rename(columns={'ppOpportunities': 'ppo', 'ppTimeOnIcePerGame': 'ppmin', 'powerPlayGoalsFor': 'ppg'})
    pk = own(pk)[['gid', 'opp', 'timesShorthanded', 'pkTimeOnIcePerGame']].rename(columns={'timesShorthanded': 'tsh', 'pkTimeOnIcePerGame': 'pkmin'})
    pp['ppmin'] /= 60; pk['pkmin'] /= 60
    tg = tg.merge(pp, on=['gid', 'opp'], how='left').merge(pk, on=['gid', 'opp'], how='left')
else:
    for c in ('ev', 'pp', 'sh'): sk[c] = np.nan
    for c in ('ppo', 'ppmin', 'ppg', 'tsh', 'pkmin'): tg[c] = np.nan
sk['ev'] = sk.ev.fillna(sk.toi); sk['pp'] = sk.pp.fillna(0); sk['sh'] = sk.sh.fillna(0)

# ── the team tables, before each game ────────────────────────────────────────────────────────────────────────────────
tg = tg.sort_values(['date', 'gid']).reset_index(drop=True)
grp = tg.groupby(['team', 'season'], sort=False)
tg['tgp'] = grp.cumcount()
for c in ('gf', 'ga', 'sf', 'sa', 'ppo', 'tsh'):
    tg[f's_{c}'] = grp[c].transform(lambda x: x.shift().expanding().mean())
    tg[f'l10_{c}'] = grp[c].transform(lambda x: x.shift().rolling(10, min_periods=3).mean())
    tg[f'l5_{c}'] = grp[c].transform(lambda x: x.shift().rolling(5, min_periods=3).mean())
tg['tdate'] = pd.to_datetime(tg.date)
tg['trest'] = grp['tdate'].diff().dt.days
tg['tb2b'] = (tg.trest == 1).astype(int)
tg['s_win'] = grp['gf'].transform(lambda x: 0).astype(float)
tg['won'] = (tg.gf > tg.ga).astype(int)
tg['s_win'] = grp['won'].transform(lambda x: x.shift().expanding().mean())
# last season's team tables
ls = tg.groupby(['team', 'season'])[['gf', 'ga', 'sf', 'sa']].mean().reset_index()
ls['season'] += 1; ls = ls.rename(columns={c: f'ls_{c}' for c in ('gf', 'ga', 'sf', 'sa')})
tg = tg.merge(ls, on=['team', 'season'], how='left')
K = 15  # blended into last season at tgp / (tgp + 15) (features.py's shot shrink)
lg = tg.groupby('season')[['gf', 'sf']].mean()
for c, lc in (('gf', 'gf'), ('ga', 'gf'), ('sf', 'sf'), ('sa', 'sf')):
    prior = tg[f'ls_{c}'].fillna(tg.season.map(lg[lc]))
    tg[f'b_{c}'] = (tg[f's_{c}'].fillna(0) * tg.tgp + prior * K) / (tg.tgp + K)

# ── the position cell: what a team allows per skater at the position, before each game ───────────────────────────────
cell = sk.groupby(['opp', 'season', 'pos', 'gid', 'date']).agg(sog=('sog', 'sum'), g=('g', 'sum'), icf=('icf', 'sum'), iscf=('iscf', 'sum'), pts=('pts', 'sum'), n=('id', 'count')).reset_index()
cell = cell.sort_values(['date', 'gid'])
cg = cell.groupby(['opp', 'season', 'pos'], sort=False)
for c in ('sog', 'g', 'icf', 'iscf', 'pts', 'n'):
    cell[f'c_{c}'] = cg[c].transform(lambda x: x.shift().expanding().sum())
    cell[f'r_{c}'] = cg[c].transform(lambda x: x.shift().rolling(10, min_periods=5).sum())
for c in ('sog', 'g', 'icf', 'iscf', 'pts'):
    cell[f'oppP_{c}'] = cell[f'c_{c}'] / cell.c_n; cell[f'oppP10_{c}'] = cell[f'r_{c}'] / cell.r_n
cell['oppP_games'] = cg.cumcount()
# against the league's at the position that morning (a raw per-skater figure sorts forwards from defensemen)
lgc = sk.sort_values(['date', 'gid']).groupby(['season', 'pos', 'date']).agg(sog=('sog', 'sum'), g=('g', 'sum'), icf=('icf', 'sum'), iscf=('iscf', 'sum'), pts=('pts', 'sum'), n=('id', 'count')).reset_index()
lgg = lgc.groupby(['season', 'pos'], sort=False)
for c in ('sog', 'g', 'icf', 'iscf', 'pts', 'n'): lgc[f'c_{c}'] = lgg[c].transform(lambda x: x.shift().expanding().sum())
for c in ('sog', 'g', 'icf', 'iscf', 'pts'): lgc[f'lgP_{c}'] = lgc[f'c_{c}'] / lgc.c_n
cell = cell.merge(lgc[['season', 'pos', 'date'] + [f'lgP_{c}' for c in ('sog', 'g', 'icf', 'iscf', 'pts')]], on=['season', 'pos', 'date'], how='left')
for c in ('sog', 'g', 'icf', 'iscf', 'pts'):
    cell[f'oppX_{c}'] = cell[f'oppP_{c}'] / cell[f'lgP_{c}']; cell[f'oppX10_{c}'] = cell[f'oppP10_{c}'] / cell[f'lgP_{c}']
keep = ['opp', 'pos', 'gid', 'oppP_games'] + [f'{p}_{c}' for p in ('oppP', 'oppP10', 'oppX', 'oppX10', 'lgP') for c in ('sog', 'g', 'icf', 'iscf', 'pts')]
sk = sk.merge(cell[keep], on=['opp', 'pos', 'gid'], how='left')

# ── the opposing starter ─────────────────────────────────────────────────────────────────────────────────────────────
gk = gk.sort_values(['date', 'gid']); gg = gk.groupby(['gkid', 'season'], sort=False)
gk['c_sa'] = gg.sa.transform(lambda x: x.shift().expanding().sum()).fillna(0); gk['c_ga'] = gg.ga.transform(lambda x: x.shift().expanding().sum()).fillna(0)
gk['gk_sv'] = 1 - (gk.c_ga + 0.1 * 300) / (gk.c_sa + 300)      # shrunk to .900 at 300 shots
gk['gk_starts'] = gg.cumcount()
sk = sk.merge(gk.rename(columns={'team': 'opp'})[['gid', 'opp', 'gk_sv', 'gk_starts']].drop_duplicates(['gid', 'opp']), on=['gid', 'opp'], how='left')

# ── the skater's own reads ───────────────────────────────────────────────────────────────────────────────────────────
sk = sk.sort_values(['date', 'gid', 'id']).reset_index(drop=True)
STATS = ['sog', 'g', 'a', 'pts', 'icf', 'iff', 'iscf', 'ihdcf', 'toi', 'ev', 'pp', 'sh', 'ppsog']
ps = sk.groupby(['id', 'season'], sort=False); pa = sk.groupby('id', sort=False)
sk['n'] = ps.cumcount(); sk['n_all'] = pa.cumcount()
new = {}
for c in STATS:
    new[f's_{c}'] = ps[c].transform(lambda x: x.shift().expanding().mean())
    for w in (3, 5, 10, 15, 20):
        new[f'l{w}_{c}'] = pa[c].transform(lambda x, w=w: x.shift().rolling(w, min_periods=1).mean())
for m, lab in ((3, 'h3'), (4, 'h4'), (2, 'h2')):
    hit = (sk.sog >= m).astype(float)
    new[f's_{lab}'] = hit.groupby([sk.id, sk.season], sort=False).transform(lambda x: x.shift().expanding().mean())
    for w in (5, 10, 15):
        new[f'l{w}_{lab}'] = hit.groupby(sk.id, sort=False).transform(lambda x, w=w: x.shift().rolling(w, min_periods=1).mean())
new['sd10_sog'] = pa.sog.transform(lambda x: x.shift().rolling(10, min_periods=5).std())
new['max10_sog'] = pa.sog.transform(lambda x: x.shift().rolling(10, min_periods=1).max())
sk = pd.concat([sk, pd.DataFrame(new)], axis=1).copy()
pv = sk.groupby(['id', 'season', 'home'], sort=False)
sk['vn'] = pv.cumcount()
for c in ('sog', 'g', 'pts', 'toi'): sk[f'v_{c}'] = pv[c].transform(lambda x: x.shift().expanding().mean())
# last season
lsp = sk.groupby(['id', 'season'])[STATS].mean().reset_index(); lsn = sk.groupby(['id', 'season']).size().rename('ls_n').reset_index()
lsp = lsp.merge(lsn, on=['id', 'season']); lsp['season'] += 1
lsp = lsp.rename(columns={c: f'ls_{c}' for c in STATS})
sk = sk.merge(lsp, on=['id', 'season'], how='left'); sk['ls_n'] = sk.ls_n.fillna(0)
sk = sk.sort_values(['date', 'gid', 'id']).reset_index(drop=True)

# streaks going in, this season's games
def run_in(flag):
    out = np.zeros(len(flag), dtype=int); k = 0
    for i, v in enumerate(flag): out[i] = k; k = k + 1 if v else 0
    return out
ps = sk.groupby(['id', 'season'], sort=False)
sk['gstreak'] = ps.g.transform(lambda x: run_in(x.values > 0))
sk['pstreak'] = ps.pts.transform(lambda x: run_in(x.values > 0))
sk['s3streak'] = ps.sog.transform(lambda x: run_in(x.values >= 3))
sk['gdrought'] = ps.g.transform(lambda x: run_in(x.values == 0))
# what the streak was made of (the sums over the run going in)
def run_sum(g, col):
    out = np.zeros(len(g)); acc = 0.0
    for i, (flag, v) in enumerate(zip(g.g.values > 0, g[col].values)): out[i] = acc; acc = acc + v if flag else 0.0
    return pd.Series(out, index=g.index)
for col in ('g', 'sog', 'iscf', 'toi', 'pp'):
    sk[f'gs_{col}'] = pd.concat([run_sum(g, col) for _, g in ps]).reindex(sk.index)
sk['pdate'] = pd.to_datetime(sk.date)
sk['rest'] = sk.groupby('id', sort=False).pdate.diff().dt.days
sk['b2b'] = (sk.rest == 1).astype(int)

# the team reads on the row
tcols = ['gid', 'team', 'tgp', 'tb2b', 'ot', 'gf', 'ga', 'sf', 'sa', 'ppo', 'tsh', 'ppmin', 'pkmin', 's_win'] + [f'{p}_{c}' for p in ('s', 'l10', 'l5', 'b') for c in ('gf', 'ga', 'sf', 'sa') if f'{p}_{c}' in tg] + ['s_ppo', 's_tsh', 'l10_ppo', 'l10_tsh']
sk = sk.merge(tg[tcols].rename(columns={c: f'team_{c}' for c in tcols if c not in ('gid', 'team')}), on=['gid', 'team'], how='left')
sk = sk.merge(tg[tcols].rename(columns={'team': 'opp', **{c: f'opp_{c}' for c in tcols if c not in ('gid', 'team')}}), on=['gid', 'opp'], how='left')

# ── the line, by minutes among the skaters dressed ───────────────────────────────────────────────────────────────────
sk['toi_ref'] = sk.l10_ev.fillna(sk.ls_ev).fillna(sk.l10_toi).fillna(sk.ls_toi)
def slots(df, key, out, f_size=3, d_size=2):
    r = df.groupby(['gid', 'team', 'F'])[key].rank(ascending=False, method='first')
    df[out + '_rank'] = r
    fs = np.minimum(np.ceil(r / f_size), 4); ds = np.minimum(np.ceil(r / d_size), 3)
    lab = np.where(df.F == 1, 'F' + fs.fillna(4).astype(int).astype(str), 'D' + ds.fillna(3).astype(int).astype(str))
    df[out] = np.where(df[key].isna(), np.where(df.F == 1, 'F4', 'D3'), lab)
slots(sk, 'toi_ref', 'slot'); slots(sk, 'ev', 'slot_played')
sk['pp_ref'] = sk.l10_pp.fillna(sk.ls_pp).fillna(0)
sk['pp_rank'] = sk.groupby(['gid', 'team'])['pp_ref'].rank(ascending=False, method='first')
sk['pp1'] = ((sk.pp_rank <= 5) & (sk.pp_ref >= 1.0)).astype(int)
sk['pp_share'] = sk.pp_ref / sk.groupby(['gid', 'team']).pp_ref.transform('sum').replace(0, np.nan) * 5
sk['pp1_played'] = (sk.groupby(['gid', 'team'])['pp'].rank(ascending=False, method='first') <= 5).astype(int)
sk['nF'] = sk.groupby(['gid', 'team']).F.transform('sum')

# ── the regulars not dressed tonight ─────────────────────────────────────────────────────────────────────────────────
# a regular = played half or more of his team's games so far (5+), ranked by shots a game / minutes going in
sk['s_ptsg'] = sk.s_pts
reg = sk[['id', 'team', 'season', 'date', 'gid', 'F', 'n', 's_sog', 's_toi', 's_pp', 'team_tgp']].copy()
last = {}   # team -> {id: (F, n, s_sog, s_toi, s_pp)} as of his last game with the team (updated after each game)
miss = []
for (gid, team), df in sk.groupby(['gid', 'team'], sort=False):
    book = last.setdefault((team, df.season.iloc[0]), {}); tgp = df.team_tgp.iloc[0]; here = set(df.id)
    regs = [(i, v) for i, v in book.items() if v['n'] >= 5 and v['n'] >= 0.5 * tgp and tgp - v['last'] <= 12]
    fw = sorted([x for x in regs if x[1]['F']], key=lambda x: -x[1]['toi']); dm = sorted([x for x in regs if not x[1]['F']], key=lambda x: -x[1]['toi'])
    sh = sorted(regs, key=lambda x: -x[1]['sog'])
    out_f = [i for i, _ in fw[:6] if i not in here]; out_d = [i for i, _ in dm[:4] if i not in here]
    out_f3 = [i for i, _ in fw[:3] if i not in here]; out_d2 = [i for i, _ in dm[:2] if i not in here]
    out_sh = [v['sog'] for i, v in sh[:3] if i not in here]
    out_pp = [v['pp'] for i, v in regs if i not in here and v['pp'] >= 1.5]
    new_f = [i for i, v in fw[:6] if i not in here and tgp - v['last'] <= 3]; new_d = [i for i, v in dm[:4] if i not in here and tgp - v['last'] <= 3]   # out three games or fewer
    miss.append(dict(gid=gid, team=team, miss_f6=len(out_f), miss_d4=len(out_d), miss_f3=len(out_f3), miss_d2=len(out_d2), miss_sog=sum(out_sh), miss_top3sh=len(out_sh),
                     miss_pp=len(out_pp), miss_f6_new=len(new_f), miss_d4_new=len(new_d), miss_all_sog=sum(v['sog'] for i, v in regs if i not in here)))
    for r in df.itertuples():
        book[r.id] = dict(F=r.F, n=r.n + 1, sog=(0 if pd.isna(r.s_sog) else r.s_sog * r.n + r.sog) / (r.n + 1), toi=(0 if pd.isna(r.s_toi) else r.s_toi * r.n + r.toi) / (r.n + 1),
                          pp=(0 if pd.isna(r.s_pp) else r.s_pp * r.n + r.pp) / (r.n + 1), last=tgp)
sk = sk.merge(pd.DataFrame(miss), on=['gid', 'team'], how='left')

# ── the site's plain-rate formula (picks-pure.js) ────────────────────────────────────────────────────────────────────
SH = dict(const=-1.4391, sog=0.3923, icf=0.4484, toi=0.297, home=0.0341, pos=0.6869, b2b=-0.026)
GO = dict(const=-1.0539, g=0.3735, iscf=0.4356, sog=0.4007, home=0.0682, pos=0.4448, b2b=-0.0677)
LEAGUE = {'C': (1.73, 0.23), 'LW': (1.63, 0.21), 'RW': (1.69, 0.215), 'D': (1.27, 0.077)}
held = sk.n < 5; ok = (sk.n >= 5) | (sk.ls_n >= 10)
def rd(c): return np.where(held, sk[f'ls_{c}'], sk[f's_{c}'])
lgv = lambda v: np.log(np.maximum(v, 0.05))
lsog = sk.pos.map(lambda p: LEAGUE.get(p, LEAGUE['C'])[0]); lgl = sk.pos.map(lambda p: LEAGUE.get(p, LEAGUE['C'])[1])
posS = sk.oppP_sog.fillna(lsog); posG = sk.oppP_g.fillna(lgl)
toi5 = np.where(sk.n > 0, sk.groupby(['id', 'season'], sort=False).toi.transform(lambda x: x.shift().rolling(5, min_periods=1).mean()), rd('toi'))
wG = np.where(held | (sk.n == 0), 1, sk.n / (sk.n + 8)); gR = wG * np.maximum(rd('g'), 0) + (1 - wG) * lgl
sk['site_lam_s'] = np.where(ok, np.exp(SH['const'] + SH['sog'] * lgv(rd('sog')) + SH['icf'] * lgv(rd('icf')) + SH['toi'] * lgv(toi5) + SH['home'] * sk.home + SH['pos'] * lgv(posS) + SH['b2b'] * sk.b2b), np.nan)
sk['site_lam_g'] = np.where(ok, np.exp(GO['const'] + GO['g'] * np.log(gR + 0.05) + GO['iscf'] * lgv(rd('iscf')) + GO['sog'] * lgv(rd('sog')) + GO['home'] * sk.home + GO['pos'] * np.log(np.maximum(posG, 0) + 0.1) + GO['b2b'] * sk.b2b), np.nan)

sk.to_pickle(args.out)
print(len(sk), 'skater-games;', sk.groupby('season').gid.nunique().to_dict(), 'games; columns', len(sk.columns))

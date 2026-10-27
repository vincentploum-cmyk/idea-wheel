"""Flatten the pulled game records into one leak-free row per skater-game, with every angle
the study tests as a column.

Every feature on a row is computed from games dated strictly BEFORE that row's game (this
season), from the previous season's box scores when a games dir for it is given, or from
MoneyPuck's previous-season summaries (the "last-season prior"). Nothing on a row was
unknowable before puck drop except the opposing goalie (`gk_*`: the starter who actually
played, standing in for the confirmed goalie the slate carries at puck drop).

Usage:
  python3 -I tools/predictors/build_rows.py <games dir> <season start year> <moneypuck dir> <out csv>
          [--prev-games <dir>] [--mp-root <dir>]

  <moneypuck dir> holds skaters-<year-1>.csv and teams-<year-1>.csv (seasonSummary, regular);
  --mp-root <dir> holds mp-skaters-<y>.csv / mp-teams-<y>.csv / mp-goalies-<y>.csv for several
  seasons (the two-seasons-ago prior `ls2_*` and the goalie prior `gk_ls_*` come from here);
  --prev-games <dir> is the previous season's games (fetch.mjs output, relabelled or not): the
  skater's own previous-season venue split and head-to-head record (`pls_*`), and the
  opponent's previous-season table by position, slot and venue (`opp_pls_*`).

Column families (p_ = the skater's own prior games this season; opp_ = the opponent's prior
games; ls_ = MoneyPuck last season; ls2_ = two seasons ago; pls_ = last season from the box
scores; gk_ = the opposing starter; team_ = the skater's own team):
  p_{sog,g,icf,iff,iscf,ihdcf,toi}_{avg,l1,l3,l5,l10,l15,l20}   windows of his own games
  p_sog_venue / p_sog_other_venue, p_slot_l1 / p_slot_l5, p_toi_trend, p_days_since
  opp_sa_{season,l5,l10,l15}, opp_ga_{...}, opp_sa_venue, opp_ga_venue      team totals
  opp_pos_sog_{season,l5,l10,l15}, opp_pos_g_{...}, opp_pos_sog_venue, opp_pos_g_venue   per game to the position
  opp_pos_sog_per, opp_pos_g_per                                        per skater at the position
  opp_slot_sog_pg, opp_slot_g_pg, opp_slot_n                            per game to the position AND line slot
  opp_pls_* (previous season, by position / slot / venue), opp_ls_* (MoneyPuck), gk_*, pace_*
"""
import csv, glob, json, sys, math, os
from collections import defaultdict
from datetime import date as D

args = sys.argv[1:]
opts = {}
pos_args = []
i = 0
while i < len(args):
    if args[i].startswith('--'):
        opts[args[i][2:]] = args[i + 1]; i += 2
    else:
        pos_args.append(args[i]); i += 1
games_dir, year, MP, out = pos_args[0], int(pos_args[1]), pos_args[2], pos_args[3]
prev_dir = opts.get('prev-games')
mp_root = opts.get('mp-root')
POS = ('C', 'LW', 'RW', 'D')
FWD = ('C', 'LW', 'RW')
NAN = float('nan')
mean = lambda xs: sum(xs) / len(xs) if xs else NAN
per60 = lambda num, toi: num / toi * 60 if toi else NAN

def mp_file(kind, season):
    """MoneyPuck summary rows (situation 'all') for a season, from the per-study dir or the shared root."""
    cands = [f'{MP}/{kind}-{season}.csv']
    if mp_root: cands.append(f'{mp_root}/mp-{kind}-{season}.csv')
    for p in cands:
        if os.path.exists(p):
            with open(p) as f:
                return [r for r in csv.DictReader(f) if r['situation'] == 'all']
    return []

# ---- last-season priors (MoneyPuck summary of the previous season, and two seasons ago) ----
def skater_prior(rows, prefix):
    out = {}
    for r in rows:
        gp = float(r['games_played']) or 0
        if gp < 10:  # too few games to be a prior
            continue
        toi_min = float(r['icetime']) / 60
        sog = float(r['I_F_shotsOnGoal'])
        out[int(r['playerId'])] = {
            f'{prefix}_gp': gp,
            f'{prefix}_sog_pg': sog / gp,
            f'{prefix}_icf_pg': float(r['I_F_shotAttempts']) / gp,
            f'{prefix}_iff_pg': float(r['I_F_unblockedShotAttempts']) / gp,
            f'{prefix}_xg_pg': float(r['I_F_xGoals']) / gp,
            f'{prefix}_g_pg': float(r['I_F_goals']) / gp,
            f'{prefix}_hd_pg': float(r['I_F_highDangerShots']) / gp,
            f'{prefix}_toi_pg': toi_min / gp,
            f'{prefix}_sog60': sog / toi_min * 60 if toi_min else NAN,
            f'{prefix}_shpct': float(r['I_F_goals']) / sog if sog else NAN,
            f'{prefix}_gax_pg': (float(r['I_F_goals']) - float(r['I_F_xGoals'])) / gp,
        }
    return out
ls_sk = skater_prior(mp_file('skaters', year - 1), 'ls')
ls2_sk = skater_prior(mp_file('skaters', year - 2), 'ls2')
ls_tm = {}
for r in mp_file('teams', year - 1):
    gp = float(r['games_played']); hours = float(r['iceTime']) / 3600 if r.get('iceTime') else gp
    ls_tm[r['team']] = dict(
        ls_sa_pg=float(r['shotsOnGoalAgainst']) / gp,
        ls_ca_pg=float(r['shotAttemptsAgainst']) / gp,
        ls_xga_pg=float(r['xGoalsAgainst']) / gp,
        ls_ga_pg=float(r['goalsAgainst']) / gp,
        ls_sf_pg=float(r['shotsOnGoalFor']) / gp,
        ls_cf_pg=float(r['shotAttemptsFor']) / gp,
        ls_xgf_pg=float(r['xGoalsFor']) / gp,
        ls_pace_pg=(float(r['shotsOnGoalFor']) + float(r['shotsOnGoalAgainst'])) / gp,
        ls_cpace_60=(float(r['shotAttemptsFor']) + float(r['shotAttemptsAgainst'])) / hours if hours else NAN,
    )
gk_ls = {}
for r in mp_file('goalies', year - 1):
    on = float(r['ongoal']); gp = float(r['games_played']); mins = float(r['icetime']) / 60
    if on < 100: continue
    gk_ls[int(r['playerId'])] = dict(
        gk_ls_gp=gp, gk_ls_svpct=1 - float(r['goals']) / on,
        gk_ls_gsax60=(float(r['xGoals']) - float(r['goals'])) / mins * 60 if mins else NAN,
        gk_ls_xsvpct=1 - float(r['xGoals']) / on,
    )

# ---- the previous season's games (box scores): the skater's own venue split and H2H, the opponent's tables ----
def load_games(d):
    gs = []
    for f in sorted(glob.glob(f'{d}/*.json')):
        gs += json.load(open(f))['games']
    gs.sort(key=lambda g: (g['date'], g['id']))
    return gs

def slot_of(skaters):
    """Line slot by TOI rank within the team-game: forwards 1-4 (three a line), defense pairs 1-3."""
    out = {}
    for team in {s['team'] for s in skaters}:
        f = sorted([s for s in skaters if s['team'] == team and s['pos'] in FWD], key=lambda s: -s['toi'])
        d = sorted([s for s in skaters if s['team'] == team and s['pos'] == 'D'], key=lambda s: -s['toi'])
        for k, s in enumerate(f): out[s['id']] = min(4, 1 + k // 3)
        for k, s in enumerate(d): out[s['id']] = min(3, 1 + k // 2)
    return out

pls = {}           # playerId -> dict of previous-season splits
opp_pls = {}       # (team, pos) -> per-game shots / goals allowed, by venue and slot
pls_h2h = {}       # (playerId, opp) -> (games, sog, g)
if prev_dir:
    pg = load_games(prev_dir)
    acc = defaultdict(lambda: dict(gp=0, sog=0, g=0, hs=0, hg=0, hn=0, as_=0, ag=0, an=0, toi=0.0, l10=[], icf=0, iscf=0))
    h2h = defaultdict(lambda: [0, 0, 0])
    dtot = defaultdict(lambda: defaultdict(list))   # (team,pos) -> key -> per-game totals
    for g in pg:
        slots = slot_of(g['skaters'])
        per = defaultdict(lambda: [0, 0, 0])  # (defteam, pos, venue-of-def, slot) -> sog, g, skaters
        for s in g['skaters']:
            if s['pos'] not in POS: continue
            a = acc[s['id']]; a['gp'] += 1; a['sog'] += s['sog']; a['g'] += s['g']; a['toi'] += s['toi']; a['icf'] += s['icf']; a['iscf'] += s['iscf']
            a['l10'].append(s['sog'])
            if s['venue'] == 'H': a['hs'] += s['sog']; a['hg'] += s['g']; a['hn'] += 1
            else: a['as_'] += s['sog']; a['ag'] += s['g']; a['an'] += 1
            hh = h2h[(s['id'], s['opp'])]; hh[0] += 1; hh[1] += s['sog']; hh[2] += s['g']
            dv = 'A' if s['venue'] == 'H' else 'H'
            for key in (('all',), ('venue', dv), ('slot', slots.get(s['id'], 0))):
                k = per[(s['opp'], s['pos']) + key]; k[0] += s['sog']; k[1] += s['g']; k[2] += 1
        for (team, pos, *key), (sog, gl, cnt) in per.items():
            dtot[(team, pos)][tuple(key)].append((sog, gl, cnt))
    for pid, a in acc.items():
        if a['gp'] < 10: continue
        pls[pid] = dict(pls_gp=a['gp'], pls_sog_pg=a['sog'] / a['gp'], pls_g_pg=a['g'] / a['gp'], pls_toi_pg=a['toi'] / a['gp'], pls_icf_pg=a['icf'] / a['gp'], pls_iscf_pg=a['iscf'] / a['gp'],
                        pls_sog_home=a['hs'] / a['hn'] if a['hn'] else NAN, pls_sog_away=a['as_'] / a['an'] if a['an'] else NAN,
                        pls_g_home=a['hg'] / a['hn'] if a['hn'] else NAN, pls_g_away=a['ag'] / a['an'] if a['an'] else NAN,
                        pls_sog_l10=mean(a['l10'][-10:]))
    for (team, pos), keys in dtot.items():
        rec = {}
        al = keys.get(('all',), [])
        rec['sog_pg'] = mean([x[0] for x in al]); rec['g_pg'] = mean([x[1] for x in al]); rec['n'] = len(al)
        cnt = sum(x[2] for x in al)
        rec['sog_per'] = sum(x[0] for x in al) / cnt if cnt else NAN; rec['g_per'] = sum(x[1] for x in al) / cnt if cnt else NAN
        for v in 'HA':
            vv = keys.get(('venue', v), [])
            rec[f'sog_{v}'] = mean([x[0] for x in vv]); rec[f'g_{v}'] = mean([x[1] for x in vv])
        for sl in (1, 2, 3, 4):
            ss = keys.get(('slot', sl), [])
            rec[f'sog_slot{sl}'] = mean([x[0] for x in ss]) if len(ss) >= 10 else NAN
            rec[f'g_slot{sl}'] = mean([x[1] for x in ss]) if len(ss) >= 10 else NAN
        opp_pls[(team, pos)] = rec
    pls_h2h = {k: tuple(v) for k, v in h2h.items()}

# ---- this season's games, in date order ----
games = load_games(games_dir)

player_hist = defaultdict(list)          # playerId -> prior rows
team_games = defaultdict(list)           # team -> [(date, sf, sa, gf, ga, venue)]
team_dates = defaultdict(list)           # team -> dates played
opp_pos_hist = defaultdict(list)         # (defTeam, pos) -> per-game dicts {date, dv, sog, g, n, slots: {slot: (sog, g)}}
h2h = defaultdict(list)                  # (playerId, opp) -> prior rows vs that opp
gk_hist = defaultdict(list)              # goalieId -> [(sa, ga)]

fields = None
rows_out = []
by_date = defaultdict(list)
for g in games:
    by_date[g['date']].append(g)

def starter(g, team):
    gs = [x for x in g.get('goalies', []) if x['team'] == team]
    if not gs: return None
    st = [x for x in gs if x.get('starter')]
    return (st or sorted(gs, key=lambda x: -x['toi']))[0]

for date in sorted(by_date):
    day = by_date[date]
    # 1) features from strictly earlier dates
    for g in day:
        for s in g['skaters']:
            if s['pos'] not in POS:
                continue
            team, opp = s['team'], s['opp']
            hist = player_hist[s['id']]
            n = len(hist)
            toi_sum = sum(h['toi'] for h in hist)
            row = dict(date=date, gameId=g['id'], playerId=s['id'], name=s['name'], team=team, opp=opp,
                       venue=s['venue'], pos=s['pos'], boxPos=s.get('boxPos', s['pos']), home=1 if s['venue'] == 'H' else 0,
                       toi=s['toi'], sog=s['sog'], g=s['g'], a=s['a'], icf=s['icf'], iff=s['iff'], iscf=s['iscf'], ihdcf=s['ihdcf'],
                       g1=1 if s['g'] >= 1 else 0, n_prior=n, team_game_no=len(team_games[team]) + 1)
            for k in ('sog', 'g', 'icf', 'iff', 'iscf', 'ihdcf', 'toi'):
                row[f'p_{k}_avg'] = mean([h[k] for h in hist])
                row[f'p_{k}_l1'] = hist[-1][k] if hist else NAN
                row[f'p_{k}_l3'] = mean([h[k] for h in hist[-3:]])
                row[f'p_{k}_l5'] = mean([h[k] for h in hist[-5:]])
                row[f'p_{k}_l10'] = mean([h[k] for h in hist[-10:]])
                row[f'p_{k}_l15'] = mean([h[k] for h in hist[-15:]])
                row[f'p_{k}_l20'] = mean([h[k] for h in hist[-20:]])
            for k in ('sog', 'icf', 'iff', 'iscf'):
                row[f'p_{k}60'] = per60(sum(h[k] for h in hist), toi_sum)
            row['p_shpct'] = sum(h['g'] for h in hist) / sum(h['sog'] for h in hist) if sum(h['sog'] for h in hist) else NAN
            row['p_g1_rate'] = mean([1 if h['g'] else 0 for h in hist])
            row['p_s2_rate'] = mean([1 if h['sog'] >= 2 else 0 for h in hist])
            row['p_s3_rate'] = mean([1 if h['sog'] >= 3 else 0 for h in hist])
            row['p_sog_max'] = max([h['sog'] for h in hist]) if hist else NAN
            row['p_sog_sd'] = (sum((h['sog'] - row['p_sog_avg']) ** 2 for h in hist) / (n - 1)) ** 0.5 if n > 1 else NAN
            # venue split of the player's own prior games
            same_venue = [h for h in hist if h['venue'] == s['venue']]
            other_venue = [h for h in hist if h['venue'] != s['venue']]
            row['p_sog_venue'] = mean([h['sog'] for h in same_venue]); row['n_prior_venue'] = len(same_venue)
            row['p_sog_other_venue'] = mean([h['sog'] for h in other_venue])
            row['p_g_venue'] = mean([h['g'] for h in same_venue])
            # role: the line slot he skated in his last game and over his last five, TOI trend, layoff
            row['p_slot_l1'] = hist[-1]['slot'] if hist else NAN
            row['p_slot_l5'] = mean([h['slot'] for h in hist[-5:]])
            row['p_toi_trend'] = (row['p_toi_l3'] - row['p_toi_avg']) if n >= 4 else NAN
            row['p_days_since'] = (D.fromisoformat(date) - D.fromisoformat(hist[-1]['date'])).days if hist else NAN
            # last season (MoneyPuck), two seasons ago, and last season's box-score splits
            row.update(ls_sk.get(s['id'], {}))
            row.update(ls2_sk.get(s['id'], {}))
            row.update(pls.get(s['id'], {}))
            if s['id'] in pls:
                p = pls[s['id']]
                row['pls_sog_same_venue'] = p['pls_sog_home'] if s['venue'] == 'H' else p['pls_sog_away']
                row['pls_g_same_venue'] = p['pls_g_home'] if s['venue'] == 'H' else p['pls_g_away']
            hh2 = pls_h2h.get((s['id'], opp))
            row['pls_h2h_n'] = hh2[0] if hh2 else 0
            row['pls_h2h_sog_avg'] = hh2[1] / hh2[0] if hh2 and hh2[0] else NAN
            row['pls_h2h_g'] = hh2[2] if hh2 else NAN
            # opponent environment, this season, prior games only: team totals by window and venue
            og = team_games[opp]
            dv = 'A' if s['venue'] == 'H' else 'H'  # the defending team's venue tonight
            row['opp_n_prior'] = len(og)
            row['opp_sa_pg'] = mean([x[2] for x in og]); row['opp_ga_pg'] = mean([x[4] for x in og])
            for w in (5, 10, 15):
                row[f'opp_sa_l{w}'] = mean([x[2] for x in og[-w:]]) if len(og) >= w else NAN
                row[f'opp_ga_l{w}'] = mean([x[4] for x in og[-w:]]) if len(og) >= w else NAN
            ogv = [x for x in og if x[5] == dv]
            row['opp_sa_pg_venue'] = mean([x[2] for x in ogv]); row['opp_ga_pg_venue'] = mean([x[4] for x in ogv]); row['opp_n_venue'] = len(ogv)
            row['opp_sf_pg'] = mean([x[1] for x in og])
            # ... by the attacker's position: per game to the position (PropFinder's figure) and per skater
            oph = opp_pos_hist[(opp, s['pos'])]
            row['opp_pos_n'] = len(oph)
            row['opp_pos_sog_pg'] = mean([h['sog'] for h in oph]); row['opp_pos_g_pg'] = mean([h['g'] for h in oph])
            row['opp_pos_icf_pg'] = mean([h['icf'] for h in oph])
            row['opp_pos_iff_pg'] = mean([h['iff'] for h in oph]); row['opp_pos_iscf_pg'] = mean([h['iscf'] for h in oph])
            tot_n = sum(h['n'] for h in oph)
            row['opp_pos_sog_per'] = sum(h['sog'] for h in oph) / tot_n if tot_n else NAN
            row['opp_pos_g_per'] = sum(h['g'] for h in oph) / tot_n if tot_n else NAN
            # attempts and chances allowed per skater at the position (the model's lane rule reads iCF / iFF / iSCF beside SOG)
            for k in ('icf', 'iff', 'iscf'):
                row[f'opp_pos_{k}_per'] = sum(h[k] for h in oph) / tot_n if tot_n else NAN
            for w in (5, 10, 15):
                row[f'opp_pos_sog_l{w}'] = mean([h['sog'] for h in oph[-w:]]) if len(oph) >= w else NAN
                row[f'opp_pos_g_l{w}'] = mean([h['g'] for h in oph[-w:]]) if len(oph) >= w else NAN
            ophv = [h for h in oph if h['dv'] == dv]
            row['opp_pos_sog_venue'] = mean([h['sog'] for h in ophv]); row['opp_pos_g_venue'] = mean([h['g'] for h in ophv])
            # ... by the attacker's slot (his last game's TOI rank) within the position
            sl = row['p_slot_l1']
            if sl == sl:
                sv = [h['slots'].get(int(sl)) for h in oph]; sv = [x for x in sv if x]
                row['opp_slot_n'] = len(sv)
                row['opp_slot_sog_pg'] = mean([x[0] for x in sv]); row['opp_slot_g_pg'] = mean([x[1] for x in sv])
            else:
                row['opp_slot_n'] = 0; row['opp_slot_sog_pg'] = NAN; row['opp_slot_g_pg'] = NAN
            # ... last season's table (box scores): position, venue, slot
            pl = opp_pls.get((opp, s['pos']))
            if pl:
                row['opp_pls_pos_sog_pg'] = pl['sog_pg']; row['opp_pls_pos_g_pg'] = pl['g_pg']
                row['opp_pls_pos_sog_per'] = pl['sog_per']; row['opp_pls_pos_g_per'] = pl['g_per']; row['opp_pls_pos_n'] = pl['n']
                row['opp_pls_pos_sog_venue'] = pl[f'sog_{dv}']; row['opp_pls_pos_g_venue'] = pl[f'g_{dv}']
                row['opp_pls_slot_sog_pg'] = pl.get(f'sog_slot{int(sl)}', NAN) if sl == sl else NAN
                row['opp_pls_slot_g_pg'] = pl.get(f'g_slot{int(sl)}', NAN) if sl == sl else NAN
            # the skater's own team, this season
            tg = team_games[team]
            row['team_sf_pg'] = mean([x[1] for x in tg]); row['team_gf_pg'] = mean([x[3] for x in tg])
            row['team_sa_pg'] = mean([x[2] for x in tg])
            # pace: shots both ways per game, this season (prior) and last season (MoneyPuck)
            row['pace_team_std'] = mean([x[1] + x[2] for x in tg]); row['pace_opp_std'] = mean([x[1] + x[2] for x in og])
            row['pace_game_std'] = mean([v for v in (row['pace_team_std'], row['pace_opp_std']) if v == v]) if tg or og else NAN
            row['pace_team_ls'] = ls_tm.get(team, {}).get('ls_pace_pg', NAN); row['pace_opp_ls'] = ls_tm.get(opp, {}).get('ls_pace_pg', NAN)
            row['pace_game_ls'] = mean([v for v in (row['pace_team_ls'], row['pace_opp_ls']) if v == v])
            row['cpace_team_ls'] = ls_tm.get(team, {}).get('ls_cpace_60', NAN); row['cpace_opp_ls'] = ls_tm.get(opp, {}).get('ls_cpace_60', NAN)
            # schedule
            td = team_dates[team]; od = team_dates[opp]
            def rest(ds):
                if not ds: return NAN
                return (D.fromisoformat(date) - D.fromisoformat(ds[-1])).days
            row['rest_days'] = rest(td); row['opp_rest_days'] = rest(od)
            row['b2b'] = 1 if row['rest_days'] == 1 else 0
            row['opp_b2b'] = 1 if row['opp_rest_days'] == 1 else 0
            row['games_in_4'] = sum(1 for x in td if (D.fromisoformat(date) - D.fromisoformat(x)).days <= 3) if td else 0
            for k, v in ls_tm.get(opp, {}).items():
                if k in ('ls_pace_pg', 'ls_cpace_60'): continue
                row['opp_' + k] = v
            for k in ('ls_sf_pg', 'ls_cf_pg', 'ls_xgf_pg'):
                row['team_' + k] = ls_tm.get(team, {}).get(k, NAN)
            # the opposing goalie: who played (the confirmed starter at puck drop), his season to date and last season
            gk = starter(g, opp)
            if gk:
                gh = gk_hist[gk['id']]
                row['gk_id'] = gk['id']; row['gk_name'] = gk['name']; row['gk_n'] = len(gh)
                sa = sum(x[0] for x in gh); ga = sum(x[1] for x in gh)
                row['gk_std_svpct'] = 1 - ga / sa if sa else NAN
                row['gk_std_ga_pg'] = ga / len(gh) if gh else NAN
                row.update(gk_ls.get(gk['id'], {}))
            hh = h2h[(s['id'], opp)]
            row['h2h_n'] = len(hh)
            row['h2h_g'] = sum(h['g'] for h in hh)
            row['h2h_sog_avg'] = mean([h['sog'] for h in hh])
            row['h2h_g_avg'] = mean([h['g'] for h in hh])
            rows_out.append(row)
            if fields is None:
                fields = list(row.keys())
            for k in row:
                if k not in fields: fields.append(k)
    # 2) then add the day's games to history
    for g in day:
        a, h = g['away'], g['home']
        team_games[a['abbrev']].append((date, a['sog'], h['sog'], a['score'], h['score'], 'A'))
        team_games[h['abbrev']].append((date, h['sog'], a['sog'], h['score'], a['score'], 'H'))
        team_dates[a['abbrev']].append(date); team_dates[h['abbrev']].append(date)
        slots = slot_of(g['skaters'])
        per = {}
        for s in g['skaters']:
            if s['pos'] not in POS:
                continue
            rec = dict(date=date, sog=s['sog'], g=s['g'], icf=s['icf'], iff=s['iff'], iscf=s['iscf'], ihdcf=s['ihdcf'], toi=s['toi'], venue=s['venue'], slot=slots.get(s['id'], NAN))
            player_hist[s['id']].append(rec)
            h2h[(s['id'], s['opp'])].append(rec)
            k = (s['opp'], s['pos'])
            if k not in per:
                per[k] = dict(date=date, dv='A' if s['venue'] == 'H' else 'H', sog=0, g=0, icf=0, iff=0, iscf=0, n=0, slots={})
            p = per[k]; p['sog'] += s['sog']; p['g'] += s['g']; p['icf'] += s['icf']; p['iff'] += s['iff']; p['iscf'] += s['iscf']; p['n'] += 1
            sl = slots.get(s['id'])
            if sl:
                cur = p['slots'].get(sl, (0, 0)); p['slots'][sl] = (cur[0] + s['sog'], cur[1] + s['g'])
        for k, p in per.items():
            opp_pos_hist[k].append(p)
        for gk in g.get('goalies', []):
            if gk['toi'] > 0: gk_hist[gk['id']].append((gk['sa'], gk['ga']))

with open(out, 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    for r in rows_out:
        w.writerow({k: ('' if isinstance(v, float) and math.isnan(v) else v) for k, v in r.items()})
print('rows', len(rows_out), 'games', len(games), 'fields', len(fields))

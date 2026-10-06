"""Flatten the pulled game records into one leak-free row per skater-game.

Every feature on a row is computed from games dated strictly BEFORE that row's game
(this season), or from the previous season's MoneyPuck summary (the "last-season prior").
Usage: python3 -I tools/predictors/build_rows.py <games dir> <season start year> <moneypuck dir> <out csv>
The MoneyPuck dir holds skaters-<year-1>.csv and teams-<year-1>.csv (seasonSummary, regular).
"""
import csv, glob, json, sys, math
from collections import defaultdict

games_dir, year, MP, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]

def mp_rows(kind, season):
    with open(f'{MP}/{kind}-{season}.csv') as f:
        return [r for r in csv.DictReader(f) if r['situation'] == 'all']

# ---- last-season priors (MoneyPuck summary of the previous season) ----
ls_sk = {}
for r in mp_rows('skaters', year - 1):
    gp = float(r['games_played']) or 0
    if gp < 10:  # too few games to be a prior
        continue
    toi_min = float(r['icetime']) / 60
    ls_sk[int(r['playerId'])] = dict(
        ls_gp=gp,
        ls_sog_pg=float(r['I_F_shotsOnGoal']) / gp,
        ls_icf_pg=float(r['I_F_shotAttempts']) / gp,
        ls_iff_pg=float(r['I_F_unblockedShotAttempts']) / gp,
        ls_xg_pg=float(r['I_F_xGoals']) / gp,
        ls_g_pg=float(r['I_F_goals']) / gp,
        ls_hd_pg=float(r['I_F_highDangerShots']) / gp,
        ls_toi_pg=toi_min / gp,
        ls_sog60=float(r['I_F_shotsOnGoal']) / toi_min * 60 if toi_min else float('nan'),
        ls_shpct=float(r['I_F_goals']) / float(r['I_F_shotsOnGoal']) if float(r['I_F_shotsOnGoal']) else float('nan'),
        ls_gax_pg=(float(r['I_F_goals']) - float(r['I_F_xGoals'])) / gp,
    )
ls_tm = {}
for r in mp_rows('teams', year - 1):
    gp = float(r['games_played'])
    ls_tm[r['team']] = dict(
        ls_sa_pg=float(r['shotsOnGoalAgainst']) / gp,
        ls_ca_pg=float(r['shotAttemptsAgainst']) / gp,
        ls_xga_pg=float(r['xGoalsAgainst']) / gp,
        ls_ga_pg=float(r['goalsAgainst']) / gp,
        ls_sf_pg=float(r['shotsOnGoalFor']) / gp,
        ls_cf_pg=float(r['shotAttemptsFor']) / gp,
        ls_xgf_pg=float(r['xGoalsFor']) / gp,
    )

# ---- this season's games, in date order ----
games = []
for f in sorted(glob.glob(f'{games_dir}/*.json')):
    games += json.load(open(f))['games']
games.sort(key=lambda g: (g['date'], g['id']))

mean = lambda xs: sum(xs) / len(xs) if xs else float('nan')
per60 = lambda num, toi: num / toi * 60 if toi else float('nan')

player_hist = defaultdict(list)          # playerId -> prior rows
team_games = defaultdict(list)           # team -> [(date, sf, sa, gf, ga)]
team_dates = defaultdict(list)           # team -> dates played
opp_pos_hist = defaultdict(list)         # (defTeam, pos) -> prior opposing skater rows
h2h = defaultdict(list)                  # (playerId, opp) -> prior rows vs that opp

fields = None
rows_out = []
by_date = defaultdict(list)
for g in games:
    by_date[g['date']].append(g)

for date in sorted(by_date):
    day = by_date[date]
    # 1) features from strictly earlier dates
    for g in day:
        teams = {'A': g['away']['abbrev'], 'H': g['home']['abbrev']}
        for s in g['skaters']:
            if s['pos'] not in ('C', 'LW', 'RW', 'D'):
                continue
            team, opp = s['team'], s['opp']
            hist = player_hist[s['id']]
            n = len(hist)
            toi_sum = sum(h['toi'] for h in hist)
            row = dict(date=date, gameId=g['id'], playerId=s['id'], name=s['name'], team=team, opp=opp,
                       venue=s['venue'], pos=s['pos'], home=1 if s['venue'] == 'H' else 0,
                       toi=s['toi'], sog=s['sog'], g=s['g'], a=s['a'], icf=s['icf'], iff=s['iff'], iscf=s['iscf'], ihdcf=s['ihdcf'],
                       g1=1 if s['g'] >= 1 else 0, n_prior=n)
            for k in ('sog', 'g', 'icf', 'iff', 'iscf', 'ihdcf', 'toi'):
                row[f'p_{k}_avg'] = mean([h[k] for h in hist])
                row[f'p_{k}_l1'] = hist[-1][k] if hist else float('nan')
                row[f'p_{k}_l3'] = mean([h[k] for h in hist[-3:]])
                row[f'p_{k}_l5'] = mean([h[k] for h in hist[-5:]])
                row[f'p_{k}_l10'] = mean([h[k] for h in hist[-10:]])
            for k in ('sog', 'icf', 'iff', 'iscf'):
                row[f'p_{k}60'] = per60(sum(h[k] for h in hist), toi_sum)
            row['p_shpct'] = sum(h['g'] for h in hist) / sum(h['sog'] for h in hist) if sum(h['sog'] for h in hist) else float('nan')
            row['p_g1_rate'] = mean([1 if h['g'] else 0 for h in hist])
            row['p_s2_rate'] = mean([1 if h['sog'] >= 2 else 0 for h in hist])
            row['p_s3_rate'] = mean([1 if h['sog'] >= 3 else 0 for h in hist])
            row['p_sog_max'] = max([h['sog'] for h in hist]) if hist else float('nan')
            row['p_sog_sd'] = (sum((h['sog'] - row['p_sog_avg']) ** 2 for h in hist) / (n - 1)) ** 0.5 if n > 1 else float('nan')
            # venue split of the player's own prior games
            same_venue = [h for h in hist if h['venue'] == s['venue']]
            row['p_sog_venue'] = mean([h['sog'] for h in same_venue])
            row['n_prior_venue'] = len(same_venue)
            # last season
            row.update(ls_sk.get(s['id'], {}))
            # opponent environment, this season, prior games only
            og = team_games[opp]
            row['opp_n_prior'] = len(og)
            row['opp_sa_pg'] = mean([x[2] for x in og])
            row['opp_ga_pg'] = mean([x[4] for x in og])
            row['opp_sa_pg_venue'] = mean([x[2] for x in og if x[5] != s['venue']])  # opp at ITS venue
            oph = opp_pos_hist[(opp, s['pos'])]
            row['opp_pos_sog_pg'] = mean([h['sog'] for h in oph])
            row['opp_pos_g_pg'] = mean([h['g'] for h in oph])
            row['opp_pos_icf_pg'] = mean([h['icf'] for h in oph])
            row['opp_pos_n'] = len(oph)
            tg = team_games[team]
            row['team_sf_pg'] = mean([x[1] for x in tg])
            row['team_gf_pg'] = mean([x[3] for x in tg])
            # schedule
            td = team_dates[team]; od = team_dates[opp]
            def rest(ds):
                if not ds: return float('nan')
                from datetime import date as D
                a = D.fromisoformat(date); b = D.fromisoformat(ds[-1])
                return (a - b).days
            row['rest_days'] = rest(td); row['opp_rest_days'] = rest(od)
            row['b2b'] = 1 if row['rest_days'] == 1 else 0
            row['opp_b2b'] = 1 if row['opp_rest_days'] == 1 else 0
            for k, v in ls_tm.get(opp, {}).items():
                row['opp_' + k] = v
            for k in ('ls_sf_pg', 'ls_cf_pg', 'ls_xgf_pg'):
                row['team_' + k] = ls_tm.get(team, {}).get(k, float('nan'))
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
        for s in g['skaters']:
            if s['pos'] not in ('C', 'LW', 'RW', 'D'):
                continue
            rec = dict(date=date, sog=s['sog'], g=s['g'], icf=s['icf'], iff=s['iff'], iscf=s['iscf'], ihdcf=s['ihdcf'], toi=s['toi'], venue=s['venue'])
            player_hist[s['id']].append(rec)
            opp_pos_hist[(s['opp'], s['pos'])].append(rec)
            h2h[(s['id'], s['opp'])].append(rec)

with open(out, 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    for r in rows_out:
        w.writerow({k: ('' if isinstance(v, float) and math.isnan(v) else v) for k, v in r.items()})
print('rows', len(rows_out), 'games', len(games), 'fields', len(fields))

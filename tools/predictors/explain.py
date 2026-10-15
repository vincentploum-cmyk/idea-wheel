"""Could we have called it? One skater-game, every angle, and where the formulas had him before
puck drop. Reads the replay (tools/predictors/replay.py output <rows>-replay.csv).

  python3 -I tools/predictors/explain.py <replay csv> <date> <team> [player name part]
  python3 -I tools/predictors/explain.py <replay csv> <date> <team> --slot C1       (the team's C1 that night, by TOI rank)
  python3 -I tools/predictors/explain.py <replay csv> --big [n]                      (the season's biggest shot nights and where they ranked)
  python3 -I tools/predictors/explain.py <replay csv> --date <date>                  (the slate's top 10 shooters / scorers that day, graded)
"""
import sys, numpy as np, pandas as pd
from scipy import stats
pd.set_option('display.width', 240); pd.set_option('display.max_rows', 200)
path = sys.argv[1]; args = sys.argv[2:]
d = pd.read_csv(path)
S, G = 'S*pool', 'G*pool'
lamS, lamG = f'lam_{S}', f'lam_{G}'
fair = lambda p: ('—' if not (p > 0) or p >= 1 else (f'-{round(100 * p / (1 - p))}' if p >= 0.5 else f'+{round(100 * (1 - p) / p)}'))
f2 = lambda v: '—' if v is None or (isinstance(v, float) and np.isnan(v)) else f'{v:.2f}'

def pk(lam, k): return 1 - stats.poisson.cdf(k - 1, lam)
def rank_txt(r):
    return f'#{int(r.rk_s)} of {int(r.slate_n)} on the slate by P(3+ SOG), #{int(r.rk_g)} by P(1+ goal) (site today: #{int(r.rk_s0)} / #{int(r.rk_g0)})'

def explain(r):
    slot = f'{"D" if r.pos == "D" else r.pos}{int(r.p_slot_l1)}' if r.p_slot_l1 == r.p_slot_l1 else 'first game'
    print(f'\n=== {r.date}  {r['name']} ({r.team} {r.pos}, last game\'s slot {slot}) {"vs" if r.home else "at"} {r.opp} ===')
    print(f'Box score: {int(r.sog)} SOG, {int(r.g)} goal(s), {r.toi:.1f} min, {int(r.icf)} attempts, {int(r.iscf)} scoring chances.')
    print(f'\nBefore puck drop ({int(r.n_prior)} prior games this season):')
    print(f'  own rate       this season {f2(r.p_sog_avg)} SOG/g (L5 {f2(r.p_sog_l5)}), last season {f2(r.ls_sog_pg)}  → blend {f2(r.bl_sog)} SOG/g; attempts blend {f2(r.bl_icf)}; TOI read {f2(r.toi_l5_or_bl)} min')
    print(f'  goals          this season {f2(r.p_g_avg)}/g, last season {f2(r.ls_g_pg)} (xG {f2(r.ls_xg_pg)})  → blend {f2(r.bl_g)}; chances blend {f2(r.bl_iscf)}')
    print(f'  venue          his SOG at this venue this season {f2(r.p_sog_venue)}, last season {f2(r.pls_sog_same_venue)} vs {f2(r.pls_sog_pg)} overall  (the study: no venue effect once the rate is in)')
    print(f'  opponent       {r.opp} allows {f2(r.opp_sa_pg)} SOG/g this season ({int(r.opp_n_prior)} games; L5 {f2(r.opp_sa_l5)}; at this venue {f2(r.opp_sa_pg_venue)}; last season {f2(r.opp_ls_sa_pg)}) → blend {f2(r.opp_sa_blend)}')
    print(f'  to his position  {r.opp} allows {f2(r.opp_pos_sog_per)} SOG per {r.pos} skater per game this season (all {r.pos}s together: {f2(r.opp_pos_sog_pg)}/g, L5 {f2(r.opp_pos_sog_l5)}, at this venue {f2(r.opp_pos_sog_venue)}), last season {f2(r.opp_pls_pos_sog_per)} per skater → blend {f2(r.opp_pos_sog_per_blend)}   [THE read the formula uses]')
    print(f'  to his slot    {f2(r.opp_slot_sog_pg)} SOG/g to {slot}s this season, {f2(r.opp_pls_slot_sog_pg)} last season → blend {f2(r.opp_slot_sog_blend)}  (adds nothing on top of the position read)')
    print(f'  goals allowed  {r.opp}: {f2(r.opp_ga_pg)} GA/g this season; to {r.pos}s {f2(r.opp_pos_g_per)} per skater (last season {f2(r.opp_pls_pos_g_per)}) → blend {f2(r.opp_pos_g_per_blend)}   [the goal formula\'s read]; slot blend {f2(r.opp_slot_g_blend)}')
    print(f'  goalie         {r.gk_name if isinstance(r.gk_name, str) else "—"}: this season sv {f2(r.gk_std_svpct)} ({int(r.gk_n) if r.gk_n == r.gk_n else 0} starts), last season {f2(r.gk_ls_svpct)} → blend {f2(r.gk_svpct_blend)}  (worth ~3-9% of the goal rate per SD; not in the site formula)')
    print(f'  pace / rest    game pace {f2(r.pace_game_std)} shots both ways (last season {f2(r.pace_game_ls)}); rest {int(r.rest_days) if r.rest_days == r.rest_days else "—"} days, back-to-back {int(r.b2b)}, opp back-to-back {int(r.opp_b2b)}  (pace adds nothing; b2b -3% SOG, -7% goals)')
    print(f'  head to head   goals vs {r.opp} this season {int(r.h2h_g) if r.h2h_g == r.h2h_g else 0}, last season {int(r.pls_h2h_g) if r.pls_h2h_g == r.pls_h2h_g else 0} ({f2(r.pls_h2h_sog_avg)} SOG/g)  (no value once the rate is in)')
    ls_, lg_ = r[lamS], r[lamG]
    print(f'\nThe formulas (fitted on 2024-25 + 2025-26, nothing from this game):')
    print(f'  shots  λ {ls_:.2f}   P(2+) {pk(ls_, 2):.0%} ({fair(pk(ls_, 2))})  P(3+) {pk(ls_, 3):.0%} ({fair(pk(ls_, 3))})  P(4+) {pk(ls_, 4):.0%} ({fair(pk(ls_, 4))})  P(5+) {pk(ls_, 5):.1%} ({fair(pk(ls_, 5))})')
    print(f'  goals  λ {lg_:.2f}   P(1+) {1 - np.exp(-lg_):.0%} ({fair(1 - np.exp(-lg_))})  P(2+) {pk(lg_, 2):.1%} ({fair(pk(lg_, 2))})')
    print(f'  site today: shots λ {r.lam_S0:.2f} (P(3+) {pk(r.lam_S0, 3):.0%}), goals λ {r.lam_G0:.2f} (P(1+) {1 - np.exp(-r.lam_G0):.0%})')
    print(f'  rank: {rank_txt(r)}')
    k = int(r.sog)
    verdict = []
    if k >= 3: verdict.append(f'a {k}-shot night was a {pk(ls_, k):.0%} shot for him by the formula; he was {"in" if r.rk_s <= 20 else "outside"} the slate\'s top 20 shooters')
    if r.g >= 1: verdict.append(f'{int(r.g)} goal(s): P(1+) read {1 - np.exp(-lg_):.0%}, {"a top-20 scorer on the slate" if r.rk_g <= 20 else "not in the slate\'s top 20 scorers"}')
    if verdict: print('  verdict: ' + '; '.join(verdict))

if args and args[0] == '--big':
    n = int(args[1]) if len(args) > 1 else 25
    big = d.sort_values(['sog', lamS], ascending=[False, False]).head(n)
    big = big.assign(p_k=[pk(r[lamS], int(r.sog)) for _, r in big.iterrows()])
    print(f'The {n} biggest shot nights this season and where the formula had the shooter before the game:')
    print(big[['date', 'name', 'team', 'opp', 'pos', 'sog', 'g', lamS, 'p_k', 'rk_s', 'slate_n', 'bl_sog', 'opp_pos_sog_per_blend']].rename(columns={lamS: 'λ', 'p_k': 'P(that many)', 'rk_s': 'slate rank P(3+)', 'bl_sog': 'own blend', 'opp_pos_sog_per_blend': 'opp to pos'}).to_string(index=False, float_format=lambda v: f'{v:.2f}'))
    print(f'\nShare of 5+ SOG nights from the slate\'s top 20 by P(3+): {(d[d.sog >= 5].rk_s <= 20).mean():.0%}; top quarter of the slate: {((1 - (d[d.sog >= 5].rk_s - 1) / d[d.sog >= 5].slate_n) >= 0.75).mean():.0%}')
    multi = d[d.g >= 2].sort_values(lamG, ascending=False)
    print(f'\nThe {len(multi)} multi-goal nights, by the formula\'s goal λ before the game:')
    print(multi[['date', 'name', 'team', 'opp', 'pos', 'g', 'sog', lamG, 'rk_g', 'slate_n', 'bl_g', 'opp_pos_g_per_blend']].rename(columns={lamG: 'λ goals', 'rk_g': 'slate rank P(1+G)', 'bl_g': 'own blend', 'opp_pos_g_per_blend': 'opp to pos'}).to_string(index=False, float_format=lambda v: f'{v:.2f}'))
    sys.exit()
if args and args[0] == '--date':
    day = d[d.date == args[1]].copy()
    print(f'{args[1]}: {day.gameId.nunique()} games, {len(day)} skaters rated. The slate\'s top 10 by P(3+ SOG):')
    t = day.sort_values(lamS, ascending=False).head(10)
    print(t.assign(p3=pk(t[lamS], 3), hit=(t.sog >= 3))[['name', 'team', 'opp', 'pos', lamS, 'p3', 'sog', 'hit']].to_string(index=False, float_format=lambda v: f'{v:.2f}'))
    print('\nThe top 10 by P(1+ goal):')
    t = day.sort_values(lamG, ascending=False).head(10)
    print(t.assign(p1=1 - np.exp(-t[lamG]), hit=(t.g >= 1))[['name', 'team', 'opp', 'pos', lamG, 'p1', 'g', 'hit']].to_string(index=False, float_format=lambda v: f'{v:.2f}'))
    sys.exit()

date, team = args[0], args[1]
rows = d[(d.date == date) & (d.team == team)]
if len(rows) == 0: sys.exit(f'no stored game for {team} on {date}')
if len(args) > 3 and args[2] == '--slot':
    pos, sl = args[3][:-1], int(args[3][-1])
    rows = rows[(rows.pos == pos) & (rows.p_slot_l1 == sl)]
    if len(rows) == 0: sys.exit(f'no {args[3]} on that night (slots are last game\'s TOI rank)')
elif len(args) > 2:
    rows = rows[rows.name.str.contains(args[2], case=False, na=False)]
for _, r in rows.sort_values('toi', ascending=False).iterrows():
    explain(r)

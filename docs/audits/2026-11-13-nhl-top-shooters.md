# The top 100 shooters, one by one (2026-11-13)

Vincent, 2026-11-13, of the drivers study's league-wide figures: *don't average. your approach is not correct*, then
*run it for the top 100 shooters*: for each heavy shooter, when does he miss, and is there a pattern to it.

**Script.** `tools/predictors/top_shooters.py` on the drivers study's frame (`drivers_frame.py`). Every table, the
100 skaters one per row included, is in [2026-11-13-nhl-top-shooters-tables.md](2026-11-13-nhl-top-shooters-tables.md).

**Who.** The top 100 by shots a game in 2026-27 (10+ games; Gauthier's 4.39 down to 2.21): their 1,842 games this
season and 7,391 last. Every comparison is a skater with himself: his 3+ rate under a condition against his own rate.

## In one paragraph

The same hundred went 3+ in 54% of their games this season and 48% last season. **Before the game two things move a
heavy shooter: the defense he faces and the rink.** Against the third of the league allowing the fewest shots he drops
4.3 points under his own rate, against the softest third he gains 3.4; home is +1.7, away −1.7; an opponent on a
back-to-back +2.6. With none of the flags against him he is 4.3 over his rate, with three or four 6.5 under. His recent
form, his last game, his line and a teammate out move nothing. **After the game the misses explain themselves**: his team
was held under 25 shots (34% against 65% when it had 35+), his minutes were cut (36% when 3+ under his usual, 62% when
3+ over), the power plays did not come. None of those is known beforehand. **A skater's own splits do not hold**: his
home / away or soft / tough gap last season says nothing about the same gap this season (r −0.02 and 0.07). **The best
rule that held on both seasons lands 71%**; of 2,365 rules none reached 75% last season. At 2+ shots the same rules
land 87–94%.

## 1. One by one

The table has each skater's 3+ rate this season and last, at home and away, against soft and tough defenses, on the
nights his minutes were up or down, and what his misses had in common. Reading down it:

- **This season's hottest are well over their own record.** The 12 at 70%+ this season were at 63% last season.
  Pastrnak 84% (62% last season), Panarin 82% (47%), Boldy 81% (63%), Connor 80% (60%), Draisaitl 80% (55%).
- **And last season's leaders are under theirs**: MacKinnon 50% (75%), Tkachuk 65% (75%), DeBrincat 70% (76%).
- **A hot first 20 games comes back.** Last season seven skaters went 3+ in 80%+ of their first 20 games (84% on
  average); over the rest of the season they went 63%, the best of them 72%. The eleven at 70–80% finished at 58%.
- Almost every one of them shows the same two lines: minutes up 75–90%, minutes down 35–60%.

## 2. What the misses have in common

Before the game, against each skater's own rate (gap in points, 95% interval):

| | games | went 3+ | gap |
|---|---|---|---|
| against a soft-third defense (team shots allowed) | 3,115 | 52.2% | +3.4 (+1.7 … +5.2) |
| against a tough-third defense | 3,027 | 44.6% | −4.3 (−6.1 … −2.5) |
| tough at his position | 2,976 | 46.3% | −2.5 (−4.3 … −0.7) |
| home / away | 4,615 / 4,618 | 50.4% / 47.1% | +1.7 / −1.7 |
| the opponent on a back-to-back | 1,407 | 51.7% | +2.6 (0.0 … +5.2) |
| his own back-to-back | 1,417 | 47.2% | −1.7 (−4.3 … +0.9) |
| no flag against him (home, not a tough defense, rested, form level) | 2,564 | 52.5% | +4.3 (+2.3 … +6.2) |
| three or four flags | 403 | 43.9% | −6.5 (−11.3 … −1.6) |

Nothing from: his last 5 against his season (a shot under or a shot over: −0.2 / +0.1), 3+ in his last one, two or
three games (+0.8 / −0.3 / −1.8), his line going in, his minutes trend, a top-six forward newly out, his team's shots a
game, favourite or underdog by record.

Only known afterwards:

| | went 3+ | gap to his own rate |
|---|---|---|
| his team under 25 shots / 35+ | 33.9% / 64.8% | −15.4 / +16.2 |
| his minutes 3+ under his last 10 / 3+ over | 36.5% / 62.2% | −13.3 / +12.6 |
| his power-play minutes under 1 / 4+ | 36.9% / 59.3% | −6.1 / +7.6 |
| his team's power plays 0–1 / 5+ | 42.6% / 53.5% | −6.2 / +5.1 |
| lost by 3+ | 45.0% | −3.6 |
| his attempts 0–3 / 4–5 / 6–7 / 8+ | 5% / 41% / 71% / 89% | |

A miss, taken apart (4,733 games under 3): 46% were 2 shots, one short. In 44% he had 3+ attempts that were blocked or
missed the net. His minutes were down 1.5+ in 29% of the misses against 21% of the hits; his team was under 25 shots
in 35% against 19%; the defense was a tough-third one in 35% against 30%.

## 3. Do a skater's own splits hold?

| split, each skater's own | average last season | spread between skaters | last season → this season (r) | odd → even games last season (r) |
|---|---|---|---|---|
| home minus away | +3.5 | 10.5 | −0.02 | −0.16 |
| soft-third minus tough-third defense | +8.1 | 13.1 | 0.07 | 0.02 |
| soft minus tough at his position | +4.4 | 12.0 | 0.01 | −0.02 |
| after a 3+ game minus after a miss | −0.8 | 11.6 | 0.13 | −0.15 |

The gaps are real for the group (+3.5 at home, +8.1 against soft defenses) and are not a trait of any one skater:
MacKinnon's 86% at home against 54% away says he is a 70% shooter with a home lift like everyone's, not a home-only
play. His 3+ rate itself carries (r 0.46 last season to this). So: his own level, plus the group's home and opponent
lifts; not his personal splits.

## 4. Rules

Every combination of one to three of 25 pre-game conditions (2,365 rules with 150+ games), found on 2025-26 and read
unchanged on 2026-27, over every skater with 5+ games (nothing picked with hindsight).

| rule | a night | 2025-26 | 2026-27 |
|---|---|---|---|
| season 3.5+ shots a game + last season 3.0+ + not a tough-third defense | 2.1 | 70.6% | 70.8% (106) |
| season 3.5+ + last season 3.0+ + home | 1.6 | 70.3% | 71.6% (67) |
| went 3+ in 70%+ of his season + last season 3.0+ + home | 1.1 | 69.6% | 75.4% (69) |
| season 3.5+ + not a tough-third defense + rested | 2.9 | 68.6% | 73.2% (112) |
| season 3.5+ + not a tough-third defense | 3.5 | 68.2% | 68.1% (135) |
| season 3.5+ alone | 5.3 | 63.6% | 63.9% (205) |

- **No rule reached 75% on 2025-26; eight reached 70%.** The 50 best averaged 69.3% there and 66.5% on 2026-27.
- **What the surviving rules share**: a heavy season average, the same shooter last season, and not facing a tight
  defense (or being at home). Last season's rate keeps a hot start honest: it is the blend the drivers study proposed.
- **At 2+ shots the same rules land 87–94%** (home + season 3.5+ + last season 3.0+: 88.4% / 94.0%); 144 rules held 85%+
  on both seasons, none 90%+ on both.

## What this adds to the drivers study

1. The opponent's lift is larger for heavy shooters than for the league: −4.3 / +3.4 points on 3+ for a tough / soft
   defense read on **team shots allowed**, the read the plain-rate formula does not carry.
2. Last season's rate belongs in the read of a shooter in November: this season's 80% shooters were 60% shooters, and
   the best rules all carry it.
3. A skater's personal home / away or matchup split should not be shown as a reason to take or skip him.
4. The misses are made of his team's shot total and his minutes on the night. The first is the next thing worth
   trying to forecast (r² 0.11 from own rate × the opponent's allowed today); the second is the posted lineup.

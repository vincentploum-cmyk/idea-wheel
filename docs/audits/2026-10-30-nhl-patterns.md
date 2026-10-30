# Patterns: what fires each line, NHL, 2026-10-01 to 2026-10-29

Vincent, 2026-10-30: "look at minimum iFF, iCF, iSCF allowed in either last 5 / L10 etc., the own player's stats at
home / away, whether he is on a streak or not, etc., so we have rules per line. You should look at literally every
data point that is available to detect patterns and then the outcome should be pills like we have for the
firsthalfscore.com website." This season's games alone.

## What was done

- **Every data point, read the morning of each game** (`lib/nhl-data/patterns-pure.js`, the same code the site runs):
  239 figures a skater-game. His shots, attempts (iCF), unblocked attempts (iFF), chances (iSCF), high-danger chances,
  goals, assists, points, ice time, hits and blocks a game over the season and his last 3 / 5 / 10. Per 60, shooting %,
  his most shots in a game, how often he reached 2+ / 3+ / 4+ / 5+ shots, a goal or a point. His runs: 2+ / 3+ / 4+ SOG,
  goal and point streaks, cold runs, games since a goal or a 3+ night. His home / away split. His head to head. What
  tonight's opponent gives up per skater at his position in all six counts, season / L5 / L10 / at the venue. The same
  as × the league's at the position and as a rank, and to his line slot. The teams' totals for and against by window
  (SA, CA, FA, SCA, HDCA, GA) with ranks. Pace, rest, back-to-backs.
- **Rules per line** (`tools/predictors/patterns.py`): every figure cut at its tenths both ways (2,428 conditions). A
  beam search found the best one-, two- and three-condition rules for each line on Oct 1–22. A rule must fire for 12
  skaters or more, and a condition that adds under two points is dropped. It was then checked on Oct 23–29, games the
  search never saw.
- **The pill's figure** is honest about the search: the fit weeks' lift, cut to the share of it the check week kept
  over every rule found, then updated by the rule's own check week. On the site each rule's rate keeps moving with the
  games after Oct 29, and those games are the record.

## What the season says, line by line

| Line | Happens | Rules found → held | Lift kept on the week they never saw | Filled pills come from |
| --- | --- | --- | --- | --- |
| 3+ SOG | 21.4% | 112 → 106 | 78% | 15 rules at 57–64%: ice time (20+ min over his last 3), a 6+ shot game already this season, chances at tonight's venue |
| 4+ SOG | 9.5% | 118 → 113 | 75% | 15 rules at 35–38%: attempts per 60 or a 6+ ceiling, with **the opponent's goals against** (top 10–23 of 32 in GA) |
| 5+ SOG | 4.0% | 91 → 82 | 64% | no rule clears 20%; the ladder does: 3.5+ shots a game with 5+ games behind it, 25% |
| 6+ SOG | 1.7% | 40 → 39 | 73% | no rule clears 11%; the same ladder tier, 14% |
| 1+ goal | 14.9% | 116 → 100 | 92% | 15 rules at 39–51%: 4.3+ unblocked attempts a game with **his venue split** (18%+ more shots at tonight's venue) |
| 2+ goals | 2.0% | 49 → 38 | 70% | none clears 9%: the best, 2.5+ chances a game with 17½+ minutes at the venue, 8–9% |
| 3+ goals | 13 games | — | — | too few to mine; the ladder only |

What each part of a rule adds (the rate with the rule against the rule without that condition, whole window):

1. **Volume and minutes carry the shots.** For 3+ SOG the parts that matter are his ice time over the last three
   (+10 to +20 points), a 6+ shot game on his record (+10 to +35), and his attempts or chances, overall or at tonight's
   venue (+10 to +20). Line 1 or 2 adds 3.
2. **The opponent's goals against is the environment that counts for 4+ SOG.** A team in the top 10 for goals allowed
   adds 10–15 points on top of a 6+ shot ceiling or 5.9+ attempts a game: 4+ SOG at 40–45% on the fit weeks and 38–42%
   on the check week against a 9.5% base. A leaky team gives up the big shot nights.
3. **His home / away split is the goal signal.** Shooting 18%+ more at tonight's venue adds 15–21 points to 1+ goal on
   top of his volume (4.3+ unblocked attempts a game): 51–57% on the fit weeks, 44–48% on the check week, against 15%.
4. **The opponent's attempts, chances and shots allowed: real, second to his own volume.** Among skaters with 2+ shots
   a game, the opponent's bottom fifth against its top fifth (ranked within his position) moves 3+ SOG by 9–12 points,
   and the team totals move it as much as the position's own figures:
   - chances against a game over its last five (SCA L5): 32% → 42%, check week 38% → 50%;
   - high-danger chances allowed to his position over the last five: 29% → 41%, check week 30% → 39%;
   - attempts against (CA L5 / L10, FA L5 / L10): 31% → 40%, check week 28–33% → 45–50%;
   - shots against L5 and goals against L5: 31% → 41% and 30% → 39%.

   For 1+ goal the same reads move it 4–7 points (unblocked attempts allowed to his position L5: 19% → 26%). Inside a
   rule, on top of his volume, they add 3–8 points when they survive the two-point cut (unblocked attempts against
   L10 34+ a game, shots against L5 27+); the goals-against read for 4+ SOG (+10–15) is the strongest environment read
   found. The minimum that counts, from the rules: an opponent giving up 34+ unblocked attempts a game over its last
   ten, 27+ shots over its last five, or ranked in the top 10 in goals against.
5. **Streaks are colour, mostly.** Inside his shot tier the 3+ SOG run he comes in on moves 3+ SOG by a few points with
   no steady direction. A **point streak** is the one that leans: 3+ shots a game and a point in 3+ straight, 55% on
   3+ SOG against 39% with none. The point streak and his venue split show as notes beside the picks.

Caveats: four weeks of one season, 6,576 skater-games. Enough for 3+ / 4+ SOG and 1+ goal; the rare lines' rules held
in direction, but at rates under the bars. "Line" in the study is the skater's ice-time rank in the game; the site
reads the beat writers' lineups. Rules found on the fit weeks were kept or dropped by the check week, so the check week
is not a clean test of the kept set. The site's record (games after Oct 29) is. No book prices: a filled pill says the
rate clears about what a book asks for the line, not that tonight's price pays.

## The tables

6576 skater-games, 239 figures each (158 searched: the opponent’s reads at his position and slot as × the league’s and as ranks), cut into 2428 conditions. Rules searched on 2026-10-02 to 2026-10-22 (4938 skater-games) and checked on 2026-10-23 to 2026-10-29 (1638 skater-games the search never saw).

| Line | Base | Rules found | Lift kept on the check week | Held | Kept | Fill the pill | The strongest that held |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3+ SOG | 21.4% | 112 | 78% | 106 | 15 | 15 | toi_l3 ≥ 20.345 · sog_max ≥ 6 · ven_iscf ≥ 3.5 (fit 76.5% on 68, check 64.0% on 25; pill 64.3%) |
| 4+ SOG | 9.5% | 118 | 75% | 113 | 15 | 15 | toi_l5 ≥ 18.89 · icf60 ≥ 19.117 · opp_ga_l5_rk ≤ 23 (fit 48.7% on 119, check 37.8% on 37; pill 38.4%) |
| 5+ SOG | 4.0% | 91 | 64% | 82 | 15 | 0 | iff_avg ≥ 4.333 · g1_l5 ≥ 0.2 · opp_ga_l5_rk ≤ 23 (fit 22.9% on 249, check 15.0% on 80; pill 15.3%) |
| 6+ SOG | 1.7% | 40 | 73% | 39 | 15 | 0 | sog_l10 ≥ 3 (fit 6.7% on 553, check 6.5% on 108; pill 6.2%) |
| 1+ goal | 14.9% | 116 | 92% | 100 | 15 | 15 | iff_avg ≥ 4.333 · toi_l10 ≥ 17.615 · ven_sog_x ≥ 1.184 (fit 57.3% on 75, check 45.8% on 24; pill 50.9%) |
| 2+ goals | 2.0% | 49 | 70% | 38 | 15 | 0 | iscf_avg ≥ 2.5 · ven_toi ≥ 17.65 (fit 9.0% on 512, check 8.7% on 183; pill 8.4%) |
| 3+ goals | 0.2% | 0 | 0% | 0 | 0 | 0 | — |

## 3+ SOG

Base rate 21.4% (1407 of 6576); fit weeks 21.2%, check week 22.0%. The bar a pill must clear to be filled: 50.0% (about the price a book usually asks for the line). 112 rules found on the fit weeks (10+ hits on 60+ games, 12+ skaters, every condition worth two points); the check week kept **78% of their lift**; **106 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| toi_l3 ≥ 20.345 · sog_max ≥ 6 · ven_iscf ≥ 3.5 | 25 | 68 | 76.5% | 25 | 64.0% | toi_l3 ≥ 20.345 +15.6; sog_max ≥ 6 +14.4; ven_iscf ≥ 3.5 +13.2 | 64.3% | ✓ |
| ihdcf_l3 ≥ 1 · toi_l3 ≥ 20.345 · sog_max ≥ 6 | 24 | 87 | 73.6% | 36 | 61.1% | ihdcf_l3 ≥ 1 +10.0; toi_l3 ≥ 20.345 +19.5; sog_max ≥ 6 +19.1 | 61.7% | ✓ |
| toi_l3 ≥ 20.345 · sog_max ≥ 6 · ven_sog_x ≥ 1.05 | 31 | 63 | 74.6% | 32 | 59.4% | toi_l3 ≥ 20.345 +19.3; sog_max ≥ 6 +34.9; ven_sog_x ≥ 1.05 +9.6 | 61.4% | ✓ |
| iscf_avg ≥ 3.25 · sog_max ≥ 6 · ven_toi ≥ 20.346 | 20 | 66 | 77.3% | 41 | 56.1% | iscf_avg ≥ 3.25 +11.5; sog_max ≥ 6 +9.6; ven_toi ≥ 20.346 +11.1 | 60.6% | ✓ |
| toi_l3 ≥ 20.345 · sog_max ≥ 6 · g1_l5 ≥ 0.4 | 19 | 69 | 75.4% | 29 | 55.2% | toi_l3 ≥ 20.345 +19.4; sog_max ≥ 6 +19.4; g1_l5 ≥ 0.4 +9.5 | 60.1% | ✓ |
| iscf60 ≥ 11.498 · sog_max ≥ 6 · ven_toi ≥ 18.836 | 20 | 71 | 74.6% | 37 | 56.8% | iscf60 ≥ 11.498 +11.5; sog_max ≥ 6 +9.5; ven_toi ≥ 18.836 +13.2 | 60.1% | ✓ |
| iscf60 ≥ 11.498 · sog_max ≥ 7 · line ≤ 2 | 17 | 61 | 75.4% | 36 | 55.6% | iscf60 ≥ 11.498 +14.7; sog_max ≥ 7 +18.9; line ≤ 2 +3.3 | 59.8% | ✓ |
| iscf_l10 ≥ 3.25 · sog_max ≥ 7 · opp_slot_iscf_x ≤ 1.203 | 19 | 61 | 75.4% | 35 | 54.3% | iscf_l10 ≥ 3.25 +14.1; sog_max ≥ 7 +19.5; opp_slot_iscf_x ≤ 1.203 +5.3 | 59.3% | ✓ |
| iscf_avg ≥ 3.25 · sog_sd ≥ 1.528 · ven_toi ≥ 20.346 | 30 | 81 | 76.5% | 34 | 52.9% | iscf_avg ≥ 3.25 +19.2; sog_sd ≥ 1.528 +10.0; ven_toi ≥ 20.346 +14.1 | 59.2% | ✓ |
| toi_l3 ≥ 20.345 · sog_max ≥ 6 · opp_sa_l5 ≥ 27 | 27 | 65 | 75.4% | 32 | 53.1% | toi_l3 ≥ 20.345 +18.2; sog_max ≥ 6 +33.8; opp_sa_l5 ≥ 27 +8.1 | 59.0% | ✓ |
| toi_l3 ≥ 20.345 · g60 ≥ 0.522 · sog_max ≥ 6 | 27 | 96 | 72.9% | 41 | 56.1% | toi_l3 ≥ 20.345 +20.4; g60 ≥ 0.522 +8.0; sog_max ≥ 6 +21.3 | 58.9% | ✓ |
| toi_l3 ≥ 20.345 · sog_max ≥ 6 · ven_sog_x ≥ 0.96 | 33 | 75 | 74.7% | 44 | 54.5% | toi_l3 ≥ 20.345 +18.4; sog_max ≥ 6 +32.7; ven_sog_x ≥ 0.96 +7.3 | 58.6% | ✓ |
| iscf60 ≥ 9.272 · sog_max ≥ 6 · ven_toi ≥ 18.836 | 27 | 108 | 73.1% | 61 | 55.7% | iscf60 ≥ 9.272 +9.9; sog_max ≥ 6 +9.6; ven_toi ≥ 18.836 +16.0 | 58.2% | ✓ |
| toi_l5 ≥ 18.89 · blk_l3 ≤ 0.333 · sog_max ≥ 6 | 27 | 70 | 75.7% | 60 | 53.3% | toi_l5 ≥ 18.89 +15.8; blk_l3 ≤ 0.333 +8.8; sog_max ≥ 6 +21.7 | 57.6% | ✓ |
| toi_l5 ≥ 18.89 · sog_max ≥ 6 · ven_iscf ≥ 3.5 | 26 | 96 | 74.0% | 44 | 52.3% | toi_l5 ≥ 18.89 +9.7; sog_max ≥ 6 +13.4; ven_iscf ≥ 3.5 +10.6 | 57.2% | ✓ |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| sog_max ≥ 6 · ven_iscf ≥ 3.5 · ven_toi ≥ 20.346 | 25 | 65 | 75.4% | 32 | 50.0% |
| sog_max ≥ 6 · ven_toi ≥ 18.836 · opp_sa_l5 ≥ 27 | 38 | 88 | 73.9% | 66 | 47.0% |
| ihdcf_l3 ≥ 1.667 · toi_l5 ≥ 18.89 · sog_max ≥ 6 | 25 | 71 | 74.6% | 33 | 39.4% |
| g_l5 ≥ 0.4 · sog_max ≥ 6 · ven_toi ≥ 20.346 | 25 | 67 | 74.6% | 47 | 48.9% |
| sog_max ≥ 6 · ven_toi ≥ 18.836 · opp_ga_l5 ≥ 3.5 | 33 | 60 | 75.0% | 39 | 46.2% |
| str_s4 ≥ 2 | 53 | 87 | 51.7% | 24 | 33.3% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 11.1% | 11.4% | 6.4% | ✓ |
| 0–1 | 5+ | 876 | 8.8% | 8.3% | 9.6% | ✓ |
| 1–1.5 | 1–4 | 718 | 15.3% | 15.6% | 9.1% | ✓ |
| 1–1.5 | 5+ | 1193 | 14.6% | 14.4% | 14.8% | ✓ |
| 1.5–2 | 1–4 | 291 | 20.6% | 20.4% | 25.0% |  |
| 1.5–2 | 5+ | 780 | 24.9% | 24.8% | 24.9% | ✓ |
| 2–2.5 | 1–4 | 364 | 23.6% | 24.3% | 11.1% |  |
| 2–2.5 | 5+ | 463 | 32.4% | 31.8% | 33.3% | ✓ |
| 2.5–3 | 1–4 | 144 | 37.5% | 37.7% | 33.3% |  |
| 2.5–3 | 5+ | 274 | 44.2% | 39.8% | 50.9% | ✓ |
| 3–3.5 | 1–4 | 176 | 33.0% | 33.3% | 20.0% |  |
| 3–3.5 | 5+ | 195 | 48.7% | 50.0% | 46.0% | ✓ |
| 3.5+ | 1–4 | 173 | 41.6% | 42.1% | 0.0% |  |
| 3.5+ | 5+ | 118 | 55.9% | 59.5% | 48.7% | ✓ |

## 4+ SOG

Base rate 9.5% (624 of 6576); fit weeks 9.7%, check week 9.0%. The bar a pill must clear to be filled: 33.0% (about the price a book usually asks for the line). 118 rules found on the fit weeks (10+ hits on 104+ games, 12+ skaters, every condition worth two points); the check week kept **75% of their lift**; **113 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| toi_l5 ≥ 18.89 · icf60 ≥ 19.117 · opp_ga_l5_rk ≤ 23 | 46 | 119 | 48.7% | 37 | 37.8% | toi_l5 ≥ 18.89 +18.0; icf60 ≥ 19.117 +29.9; opp_ga_l5_rk ≤ 23 +6.5 | 38.4% | ✓ |
| icf60 ≥ 19.117 · ven_toi ≥ 18.836 · opp_ga_l5_rk ≤ 26 | 44 | 109 | 47.7% | 43 | 37.2% | icf60 ≥ 19.117 +28.5; ven_toi ≥ 18.836 +16.7; opp_ga_l5_rk ≤ 26 +5.8 | 37.6% | ✓ |
| sog_max ≥ 6 · opp_ga_rk ≤ 10 | 49 | 105 | 44.8% | 54 | 38.9% | sog_max ≥ 6 +31.4; opp_ga_rk ≤ 10 +15.3 | 37.6% | ✓ |
| toi_l3 ≥ 20.345 · sog_sd ≥ 1.528 · ven_iff ≥ 4.5 | 41 | 109 | 46.8% | 36 | 36.1% | toi_l3 ≥ 20.345 +10.6; sog_sd ≥ 1.528 +7.0; ven_iff ≥ 4.5 +16.1 | 36.8% | ✓ |
| icf60 ≥ 19.117 · ven_toi ≥ 20.346 | 38 | 106 | 45.3% | 38 | 36.8% | icf60 ≥ 19.117 +27.2; ven_toi ≥ 20.346 +18.7 | 36.5% | ✓ |
| toi_l3 ≥ 20.345 · icf60 ≥ 19.117 · opp_fa_l10 ≥ 34 | 35 | 107 | 46.7% | 26 | 34.6% | toi_l3 ≥ 20.345 +18.5; icf60 ≥ 19.117 +28.4; opp_fa_l10 ≥ 34 +3.6 | 36.3% | ✓ |
| icf_l3 ≥ 4.667 · sog_max ≥ 6 · opp_ga_l5_rk ≤ 13 | 45 | 104 | 47.1% | 43 | 34.9% | icf_l3 ≥ 4.667 +7.2; sog_max ≥ 6 +19.8; opp_ga_l5_rk ≤ 13 +11.8 | 36.2% | ✓ |
| icf_l10 ≥ 5.862 · opp_ga_rk ≤ 7 | 69 | 104 | 40.4% | 24 | 41.7% | icf_l10 ≥ 5.862 +29.4; opp_ga_rk ≤ 7 +12.7 | 36.0% | ✓ |
| a_l10 ≥ 0.4 · icf60 ≥ 19.117 · ven_toi ≥ 18.836 | 35 | 109 | 46.8% | 44 | 34.1% | a_l10 ≥ 0.4 +4.2; icf60 ≥ 19.117 +21.5; ven_toi ≥ 18.836 +13.2 | 35.7% | ✓ |
| toi_l5 ≥ 18.89 · icf60 ≥ 19.117 · pace ≥ 52.417 | 48 | 124 | 46.0% | 49 | 34.7% | toi_l5 ≥ 18.89 +16.2; icf60 ≥ 19.117 +27.3; pace ≥ 52.417 +3.1 | 35.6% | ✓ |
| toi_l10 ≥ 18.849 · icf60 ≥ 19.117 · opp_sa_rk ≤ 23 | 45 | 117 | 47.0% | 36 | 33.3% | toi_l10 ≥ 18.849 +16.7; icf60 ≥ 19.117 +27.7; opp_sa_rk ≤ 23 +4.6 | 35.5% | ✓ |
| iff_avg ≥ 4.333 · opp_ga_l10_rk ≤ 7 | 68 | 112 | 41.1% | 34 | 38.2% | iff_avg ≥ 4.333 +29.2; opp_ga_l10_rk ≤ 7 +10.7 | 35.5% | ✓ |
| sog_max ≥ 6 · ven_toi ≥ 18.836 · opp_ca_l5_rk ≤ 19 | 43 | 104 | 47.1% | 73 | 34.2% | sog_max ≥ 6 +24.4; ven_toi ≥ 18.836 +9.8; opp_ca_l5_rk ≤ 19 +6.3 | 35.4% | ✓ |
| iff_avg ≥ 4.333 · opp_ga_rk ≤ 10 | 78 | 162 | 39.5% | 44 | 38.6% | iff_avg ≥ 4.333 +27.9; opp_ga_rk ≤ 10 +9.6 | 35.4% | ✓ |
| sog_l3 ≥ 1.667 · sog_max ≥ 6 · opp_ga_l5_rk ≤ 10 | 48 | 104 | 47.1% | 45 | 33.3% | sog_l3 ≥ 1.667 +2.7; sog_max ≥ 6 +25.2; opp_ga_l5_rk ≤ 10 +14.1 | 35.4% | ✓ |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| sog_max ≥ 6 · opp_slot_icf_x ≤ 1.248 · opp_ga_l5_rk ≤ 13 | 50 | 104 | 47.1% | 65 | 26.2% |
| toi_l3 ≥ 18.9 · icf60 ≥ 19.117 · opp_sa_l10_rk ≤ 23 | 48 | 119 | 46.2% | 28 | 25.0% |
| a_l5 ≥ 0.8 · str_s2 ≥ 3 | 47 | 105 | 40.0% | 45 | 15.6% |
| s4_l5 ≥ 1 | 75 | 105 | 28.6% | 2 | 0.0% |
| s4_l5 ≥ 0.667 | 84 | 155 | 27.1% | 9 | 0.0% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 3.3% | 3.3% | 4.3% | ✓ |
| 0–1 | 5+ | 876 | 2.7% | 3.1% | 2.1% | ✓ |
| 1–1.5 | 1–4 | 718 | 5.7% | 5.8% | 3.0% | ✓ |
| 1–1.5 | 5+ | 1193 | 5.2% | 5.5% | 4.7% | ✓ |
| 1.5–2 | 1–4 | 291 | 10.0% | 10.0% | 8.3% |  |
| 1.5–2 | 5+ | 780 | 10.4% | 10.6% | 10.1% | ✓ |
| 2–2.5 | 1–4 | 364 | 10.4% | 10.7% | 5.6% | ✓ |
| 2–2.5 | 5+ | 463 | 14.7% | 14.6% | 14.8% | ✓ |
| 2.5–3 | 1–4 | 144 | 17.4% | 17.4% | 16.7% |  |
| 2.5–3 | 5+ | 274 | 22.6% | 23.5% | 21.3% | ✓ |
| 3–3.5 | 1–4 | 176 | 13.6% | 14.0% | 0.0% |  |
| 3–3.5 | 5+ | 195 | 28.2% | 29.5% | 25.4% | ✓ |
| 3.5+ | 1–4 | 173 | 25.4% | 25.7% | 0.0% |  |
| 3.5+ | 5+ | 118 | 37.3% | 39.2% | 33.3% | ✓ |

## 5+ SOG

Base rate 4.0% (261 of 6576); fit weeks 4.0%, check week 3.8%. The bar a pill must clear to be filled: 20.0% (about the price a book usually asks for the line). 91 rules found on the fit weeks (10+ hits on 249+ games, 12+ skaters, every condition worth two points); the check week kept **64% of their lift**; **82 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iff_avg ≥ 4.333 · g1_l5 ≥ 0.2 · opp_ga_l5_rk ≤ 23 | 81 | 249 | 22.9% | 80 | 15.0% | iff_avg ≥ 4.333 +13.9; g1_l5 ≥ 0.2 +3.1; opp_ga_l5_rk ≤ 23 +3.4 | 15.3% |  |
| iff_avg ≥ 4.333 · g_l5 ≥ 0.4 | 78 | 280 | 19.3% | 82 | 15.9% | iff_avg ≥ 4.333 +10.3; g_l5 ≥ 0.4 +3.0 | 15.1% |  |
| toi_l5 ≥ 18.89 · ven_iff ≥ 4.5 | 87 | 272 | 19.5% | 97 | 15.5% | toi_l5 ≥ 18.89 +4.1; ven_iff ≥ 4.5 +11.5 | 15.0% |  |
| iff_avg ≥ 4.333 · iscf_l3 ≥ 2.5 · toi_l5 ≥ 18.89 | 65 | 251 | 22.3% | 82 | 14.6% | iff_avg ≥ 4.333 +5.0; iscf_l3 ≥ 2.5 +2.0; toi_l5 ≥ 18.89 +3.9 | 15.0% |  |
| iff_avg ≥ 4.333 · g1_l5 ≥ 0.2 · team_cf ≥ 55 | 78 | 279 | 22.6% | 91 | 14.3% | iff_avg ≥ 4.333 +12.6; g1_l5 ≥ 0.2 +3.3; team_cf ≥ 55 +2.9 | 14.7% |  |
| iff_avg ≥ 4.333 · g_l5 ≥ 0.2 · pt1_rate ≤ 0.833 | 75 | 252 | 22.2% | 104 | 14.4% | iff_avg ≥ 4.333 +13.8; g_l5 ≥ 0.2 +2.3; pt1_rate ≤ 0.833 +2.3 | 14.7% |  |
| iff_avg ≥ 4.333 · pts_l5 ≥ 0.5 · pt1_rate ≤ 0.833 | 77 | 254 | 22.4% | 98 | 14.3% | iff_avg ≥ 4.333 +13.0; pts_l5 ≥ 0.5 +2.5; pt1_rate ≤ 0.833 +3.4 | 14.7% |  |
| iff_avg ≥ 4.333 · pt1_l5 ≤ 0.8 · opp_ga_l10_rk ≤ 23 | 86 | 251 | 22.3% | 85 | 14.1% | iff_avg ≥ 4.333 +15.8; pt1_l5 ≤ 0.8 +2.5; opp_ga_l10_rk ≤ 23 +2.8 | 14.6% |  |
| iff_avg ≥ 4.333 · toi_avg ≥ 18.849 | 75 | 308 | 19.8% | 104 | 14.4% | iff_avg ≥ 4.333 +11.3; toi_avg ≥ 18.849 +2.9 | 14.3% |  |
| iff_avg ≥ 4.333 · g1_l5 ≥ 0.2 | 94 | 367 | 18.8% | 116 | 13.8% | iff_avg ≥ 4.333 +11.4; g1_l5 ≥ 0.2 +2.0 | 13.7% |  |
| iff_l5 ≥ 4.333 · ven_toi ≥ 18.836 | 75 | 256 | 21.5% | 107 | 13.1% | iff_l5 ≥ 4.333 +11.3; ven_toi ≥ 18.836 +4.0 | 13.6% |  |
| iff_avg ≥ 4.333 · opp_ga_l5_rk ≤ 23 | 108 | 344 | 18.9% | 88 | 13.6% | iff_avg ≥ 4.333 +13.4; opp_ga_l5_rk ≤ 23 +2.3 | 13.6% |  |
| iff_avg ≥ 4.333 · pt1_rate ≤ 0.833 | 101 | 356 | 19.1% | 114 | 13.2% | iff_avg ≥ 4.333 +13.8; pt1_rate ≤ 0.833 +2.1 | 13.3% |  |
| icf60 ≥ 19.117 · ven_toi ≥ 16.525 | 82 | 249 | 20.9% | 65 | 12.3% | icf60 ≥ 19.117 +12.9; ven_toi ≥ 16.525 +6.0 | 13.2% |  |
| iff_avg ≥ 4.333 · a_l5 ≥ 0.4 | 82 | 304 | 19.4% | 109 | 12.8% | iff_avg ≥ 4.333 +11.4; a_l5 ≥ 0.4 +2.1 | 13.1% |  |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| iff_avg ≥ 4.333 · pts_l3 ≥ 0.667 · opp_ga_rk ≤ 23 | 86 | 252 | 22.6% | 80 | 11.2% |
| iff_avg ≥ 4.333 · pts_l3 ≥ 0.5 · opp_ga_rk ≤ 23 | 90 | 258 | 22.5% | 80 | 11.2% |
| iff_avg ≥ 4.333 · opp_ven_gp ≥ 1 · team_gf ≤ 3.333 | 78 | 262 | 22.1% | 81 | 11.1% |
| icf60 ≥ 19.117 · sog_max ≥ 5 | 63 | 253 | 20.6% | 76 | 10.5% |
| icf60 ≥ 19.117 · ven_toi ≥ 15.349 | 94 | 291 | 20.3% | 71 | 11.3% |
| iff_l5 ≥ 4.333 · opp_ga_rk ≤ 20 | 108 | 293 | 19.5% | 88 | 10.2% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 1.1% | 0.9% | 4.3% | ✓ |
| 0–1 | 5+ | 876 | 0.5% | 0.7% | 0.0% | ✓ |
| 1–1.5 | 1–4 | 718 | 1.5% | 1.5% | 3.0% | ✓ |
| 1–1.5 | 5+ | 1193 | 1.5% | 1.2% | 1.9% | ✓ |
| 1.5–2 | 1–4 | 291 | 4.5% | 4.3% | 8.3% |  |
| 1.5–2 | 5+ | 780 | 4.4% | 4.5% | 4.1% | ✓ |
| 2–2.5 | 1–4 | 364 | 4.9% | 5.2% | 0.0% | ✓ |
| 2–2.5 | 5+ | 463 | 6.5% | 6.9% | 5.8% | ✓ |
| 2.5–3 | 1–4 | 144 | 8.3% | 8.0% | 16.7% |  |
| 2.5–3 | 5+ | 274 | 8.8% | 8.4% | 9.3% | ✓ |
| 3–3.5 | 1–4 | 176 | 5.7% | 5.8% | 0.0% |  |
| 3–3.5 | 5+ | 195 | 12.8% | 14.4% | 9.5% | ✓ |
| 3.5+ | 1–4 | 173 | 13.3% | 13.5% | 0.0% |  |
| 3.5+ | 5+ | 118 | 25.4% | 27.8% | 20.5% | ✓ |

## 6+ SOG

Base rate 1.7% (115 of 6576); fit weeks 1.9%, check week 1.4%. The bar a pill must clear to be filled: 11.0% (about the price a book usually asks for the line). 40 rules found on the fit weeks (10+ hits on 537+ games, 12+ skaters, every condition worth two points); the check week kept **73% of their lift**; **39 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sog_l10 ≥ 3 | 173 | 553 | 6.7% | 108 | 6.5% | — | 6.2% |  |
| s4_l10 ≥ 0.333 | 155 | 632 | 6.3% | 130 | 6.2% | — | 5.9% |  |
| icf_l3 ≥ 6 | 166 | 539 | 7.8% | 132 | 5.3% | — | 5.5% |  |
| iscf_l5 ≥ 3.2 | 143 | 540 | 7.4% | 149 | 5.4% | — | 5.5% |  |
| iff_l3 ≥ 4.333 | 174 | 560 | 8.0% | 179 | 5.0% | — | 5.2% |  |
| ven_icf ≥ 5 | 249 | 881 | 6.0% | 248 | 4.8% | — | 4.8% |  |
| ven_sog ≥ 3 | 249 | 617 | 5.8% | 147 | 4.8% | — | 4.7% |  |
| iscf_avg ≥ 2.5 | 223 | 1002 | 5.5% | 281 | 4.6% | — | 4.6% |  |
| s2_rate ≥ 0.75 | 291 | 1017 | 5.2% | 215 | 4.7% | — | 4.6% |  |
| ven_sog ≥ 2.5 | 282 | 863 | 5.2% | 263 | 4.6% | — | 4.5% |  |
| icf_l10 ≥ 4.667 | 210 | 1021 | 5.8% | 268 | 4.5% | — | 4.5% |  |
| sog_l10 ≥ 2.25 | 228 | 1023 | 5.8% | 292 | 4.5% | — | 4.5% |  |
| s4_l5 ≥ 0.4 | 162 | 538 | 6.5% | 185 | 4.3% | — | 4.5% |  |
| iff_l5 ≥ 3.5 | 242 | 991 | 6.2% | 277 | 4.3% | — | 4.4% |  |
| s3_l10 ≥ 0.444 | 250 | 989 | 5.3% | 249 | 4.4% | — | 4.4% |  |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| ihdcf_l5 ≥ 1.5 | 168 | 555 | 5.4% | 151 | 2.6% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 0.5% | 0.5% | 0.0% | ✓ |
| 0–1 | 5+ | 876 | 0.0% | 0.0% | 0.0% | ✓ |
| 1–1.5 | 1–4 | 718 | 0.3% | 0.3% | 0.0% | ✓ |
| 1–1.5 | 5+ | 1193 | 0.4% | 0.3% | 0.6% | ✓ |
| 1.5–2 | 1–4 | 291 | 1.7% | 1.4% | 8.3% |  |
| 1.5–2 | 5+ | 780 | 2.1% | 2.8% | 0.9% | ✓ |
| 2–2.5 | 1–4 | 364 | 2.5% | 2.6% | 0.0% | ✓ |
| 2–2.5 | 5+ | 463 | 2.6% | 2.9% | 2.1% | ✓ |
| 2.5–3 | 1–4 | 144 | 4.2% | 4.3% | 0.0% |  |
| 2.5–3 | 5+ | 274 | 4.4% | 4.2% | 4.6% | ✓ |
| 3–3.5 | 1–4 | 176 | 4.0% | 4.1% | 0.0% |  |
| 3–3.5 | 5+ | 195 | 4.1% | 4.5% | 3.2% | ✓ |
| 3.5+ | 1–4 | 173 | 7.5% | 7.6% | 0.0% |  |
| 3.5+ | 5+ | 118 | 13.6% | 13.9% | 12.8% | ✓ |

## 1+ goal

Base rate 14.9% (978 of 6576); fit weeks 14.7%, check week 15.4%. The bar a pill must clear to be filled: 35.0% (about the price a book usually asks for the line). 116 rules found on the fit weeks (10+ hits on 69+ games, 12+ skaters, every condition worth two points); the check week kept **92% of their lift**; **100 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iff_avg ≥ 4.333 · toi_l10 ≥ 17.615 · ven_sog_x ≥ 1.184 | 39 | 75 | 57.3% | 24 | 45.8% | iff_avg ≥ 4.333 +34.2; toi_l10 ≥ 17.615 +7.4; ven_sog_x ≥ 1.184 +21.0 | 50.9% | ✓ |
| iff_avg ≥ 4.333 · hits_l10 ≤ 1.25 · ven_sog_x ≥ 1.184 | 38 | 69 | 53.6% | 21 | 47.6% | iff_avg ≥ 4.333 +35.4; hits_l10 ≤ 1.25 +5.1; ven_sog_x ≥ 1.184 +21.0 | 49.5% | ✓ |
| iff_avg ≥ 4.333 · sog_sd ≥ 1.414 · ven_sog_x ≥ 1.184 | 43 | 76 | 53.9% | 25 | 44.0% | iff_avg ≥ 4.333 +28.1; sog_sd ≥ 1.414 +4.4; ven_sog_x ≥ 1.184 +16.0 | 48.2% | ✓ |
| iff_avg ≥ 4.333 · ven_sog_x ≥ 1.184 · team_ff ≥ 40.143 | 44 | 74 | 52.7% | 23 | 43.5% | iff_avg ≥ 4.333 +35.5; ven_sog_x ≥ 1.184 +19.4; team_ff ≥ 40.143 +3.4 | 47.4% | ✓ |
| iff_avg ≥ 4.333 · a_avg ≥ 0.286 · ven_sog_x ≥ 1.184 | 40 | 69 | 53.6% | 26 | 42.3% | iff_avg ≥ 4.333 +30.3; a_avg ≥ 0.286 +3.4; ven_sog_x ≥ 1.184 +16.0 | 47.3% | ✓ |
| iff_avg ≥ 4.333 · ven_sog_x ≥ 1.184 · opp_ga ≥ 2.444 | 44 | 72 | 54.2% | 23 | 39.1% | iff_avg ≥ 4.333 +36.0; ven_sog_x ≥ 1.184 +17.3; opp_ga ≥ 2.444 +3.4 | 46.7% | ✓ |
| iff_avg ≥ 4.333 · ven_sog_x ≥ 1.184 · team_hdcf ≥ 9.333 | 48 | 82 | 52.4% | 26 | 42.3% | iff_avg ≥ 4.333 +34.7; ven_sog_x ≥ 1.184 +18.2; team_hdcf ≥ 9.333 +2.9 | 46.6% | ✓ |
| iff_l5 ≥ 4.333 · ven_sog_x ≥ 1.184 · opp_fa_l5_rk ≤ 26 | 48 | 71 | 53.5% | 27 | 40.7% | iff_l5 ≥ 4.333 +34.7; ven_sog_x ≥ 1.184 +17.5; opp_fa_l5_rk ≤ 26 +3.7 | 46.5% | ✓ |
| iff_avg ≥ 4.333 · ven_sog_x ≥ 1.184 · opp_fa_l5_rk ≤ 26 | 50 | 76 | 53.9% | 22 | 36.4% | iff_avg ≥ 4.333 +34.7; ven_sog_x ≥ 1.184 +17.8; opp_fa_l5_rk ≤ 26 +2.9 | 45.7% | ✓ |
| iff_l5 ≥ 4.333 · ven_sog_x ≥ 1.184 · opp_ga_l5 ≥ 2.2 | 47 | 74 | 52.7% | 27 | 37.0% | iff_l5 ≥ 4.333 +33.5; ven_sog_x ≥ 1.184 +16.2; opp_ga_l5 ≥ 2.2 +2.2 | 44.6% | ✓ |
| iscf_avg ≥ 3.25 · a_l10 ≥ 0.5 · ven_toi ≥ 20.346 | 28 | 91 | 52.7% | 41 | 39.0% | iscf_avg ≥ 3.25 +23.2; a_l10 ≥ 0.5 +8.0; ven_toi ≥ 20.346 +11.3 | 44.3% | ✓ |
| icf_l10 ≥ 5.862 · ven_sog_x ≥ 1.184 | 52 | 89 | 43.8% | 23 | 43.5% | icf_l10 ≥ 5.862 +28.9; ven_sog_x ≥ 1.184 +15.5 | 42.3% | ✓ |
| toi_avg ≥ 20.203 · ven_iscf ≥ 3.5 | 45 | 136 | 40.4% | 46 | 41.3% | toi_avg ≥ 20.203 +10.7; ven_iscf ≥ 3.5 +22.5 | 40.0% | ✓ |
| ven_iff ≥ 4.5 · line ≤ 1 | 95 | 264 | 37.5% | 83 | 41.0% | ven_iff ≥ 4.5 +17.5; line ≤ 1 +6.6 | 39.3% | ✓ |
| ihdcf_l3 ≥ 1.667 · toi_l10 ≥ 20.203 | 43 | 103 | 40.8% | 38 | 39.5% | ihdcf_l3 ≥ 1.667 +22.5; toi_l10 ≥ 20.203 +15.4 | 39.1% | ✓ |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| iff_avg ≥ 4.333 · ven_sog_x ≥ 1.184 · opp_ga_l5 ≥ 2.2 | 44 | 77 | 55.8% | 22 | 36.4% |
| iff_avg ≥ 4.333 · ven_sog_x ≥ 1.184 · opp_fa_rk ≤ 26 | 49 | 78 | 55.1% | 22 | 36.4% |
| iff_avg ≥ 4.333 · ven_sog_x ≥ 1.184 · opp_fa ≥ 36.5 | 49 | 77 | 54.5% | 23 | 34.8% |
| iff_avg ≥ 4.333 · ven_sog_x ≥ 1.184 · opp_ga_l5_rk ≤ 26 | 43 | 71 | 54.9% | 20 | 35.0% |
| iff_avg ≥ 4.333 · ven_sog_x ≥ 1.184 · opp_fa_l10_rk ≤ 23 | 48 | 71 | 54.9% | 19 | 31.6% |
| iff_avg ≥ 4.333 · ven_sog_x ≥ 1.184 · team_sa ≤ 27.8 | 39 | 70 | 54.3% | 17 | 35.3% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 6.9% | 7.2% | 2.1% | ✓ |
| 0–1 | 5+ | 876 | 8.0% | 7.9% | 8.1% | ✓ |
| 1–1.5 | 1–4 | 718 | 12.7% | 13.0% | 6.1% | ✓ |
| 1–1.5 | 5+ | 1193 | 13.3% | 13.7% | 12.7% | ✓ |
| 1.5–2 | 1–4 | 291 | 9.3% | 9.3% | 8.3% |  |
| 1.5–2 | 5+ | 780 | 17.1% | 18.8% | 14.5% | ✓ |
| 2–2.5 | 1–4 | 364 | 13.2% | 13.6% | 5.6% |  |
| 2–2.5 | 5+ | 463 | 23.8% | 22.3% | 25.9% | ✓ |
| 2.5–3 | 1–4 | 144 | 25.0% | 25.4% | 16.7% |  |
| 2.5–3 | 5+ | 274 | 25.2% | 22.9% | 28.7% | ✓ |
| 3–3.5 | 1–4 | 176 | 19.3% | 19.9% | 0.0% |  |
| 3–3.5 | 5+ | 195 | 32.3% | 28.0% | 41.3% | ✓ |
| 3.5+ | 1–4 | 173 | 23.7% | 24.0% | 0.0% |  |
| 3.5+ | 5+ | 118 | 34.7% | 40.5% | 23.1% | ✓ |

## 2+ goals

Base rate 2.0% (133 of 6576); fit weeks 2.0%, check week 2.0%. The bar a pill must clear to be filled: 9.0% (about the price a book usually asks for the line). 49 rules found on the fit weeks (10+ hits on 489+ games, 12+ skaters, every condition worth two points); the check week kept **70% of their lift**; **38 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iscf_avg ≥ 2.5 · ven_toi ≥ 17.65 | 121 | 512 | 9.0% | 183 | 8.7% | iscf_avg ≥ 2.5 +5.6; ven_toi ≥ 17.65 +2.8 | 8.4% |  |
| iscf_avg ≥ 2.5 · toi_l5 ≥ 17.615 | 130 | 599 | 8.5% | 180 | 8.3% | iscf_avg ≥ 2.5 +5.2; toi_l5 ≥ 17.615 +2.3 | 8.0% |  |
| toi_l5 ≥ 17.615 · ven_iscf ≥ 2.5 | 138 | 514 | 8.6% | 189 | 7.9% | toi_l5 ≥ 17.615 +2.9; ven_iscf ≥ 2.5 +5.1 | 7.7% |  |
| iff_l10 ≥ 4.333 | 128 | 503 | 8.2% | 126 | 7.9% | — | 7.5% |  |
| iscf_avg ≥ 2.5 · ven_icf ≥ 5 | 142 | 535 | 8.4% | 146 | 7.5% | iscf_avg ≥ 2.5 +2.6; ven_icf ≥ 5 +2.1 | 7.3% |  |
| iscf_avg ≥ 2.5 · ven_sog ≥ 2.5 | 153 | 511 | 8.8% | 156 | 7.1% | iscf_avg ≥ 2.5 +2.8; ven_sog ≥ 2.5 +2.2 | 7.0% |  |
| iscf_l10 ≥ 3.25 | 125 | 504 | 7.5% | 125 | 7.2% | — | 6.9% |  |
| iscf_avg ≥ 2.5 | 223 | 1002 | 6.2% | 281 | 6.0% | — | 5.9% |  |
| iff_l10 ≥ 3.5 | 223 | 989 | 5.6% | 260 | 5.4% | — | 5.3% |  |
| ven_iscf ≥ 2.5 | 274 | 944 | 5.6% | 310 | 5.2% | — | 5.1% |  |
| ven_iff ≥ 3.5 | 278 | 942 | 5.5% | 302 | 5.0% | — | 4.9% |  |
| s4_rate ≥ 0.2 | 222 | 1060 | 5.5% | 302 | 5.0% | — | 4.9% |  |
| iscf_l5 ≥ 3.2 | 143 | 540 | 7.2% | 149 | 4.7% | — | 4.9% |  |
| ven_icf ≥ 5 | 249 | 881 | 5.8% | 248 | 4.8% | — | 4.8% |  |
| icf_l10 ≥ 5.862 | 138 | 494 | 7.1% | 111 | 4.5% | — | 4.8% |  |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| ven_icf ≥ 6 | 168 | 507 | 8.3% | 122 | 3.3% |
| s4_rate ≥ 0.333 | 155 | 632 | 6.6% | 149 | 4.0% |
| icf_l5 ≥ 6 | 147 | 495 | 6.7% | 123 | 2.4% |
| ihdcf_l5 ≥ 1.5 | 168 | 555 | 6.3% | 151 | 3.3% |
| ihdcf_l3 ≥ 1.667 | 195 | 527 | 6.1% | 193 | 2.6% |
| s3_l10 ≥ 0.608 | 177 | 494 | 6.1% | 82 | 3.7% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 0.6% | 0.7% | 0.0% | ✓ |
| 0–1 | 5+ | 876 | 0.1% | 0.0% | 0.3% | ✓ |
| 1–1.5 | 1–4 | 718 | 1.0% | 0.9% | 3.0% | ✓ |
| 1–1.5 | 5+ | 1193 | 1.6% | 2.1% | 0.9% | ✓ |
| 1.5–2 | 1–4 | 291 | 1.0% | 1.1% | 0.0% |  |
| 1.5–2 | 5+ | 780 | 1.7% | 1.3% | 2.2% | ✓ |
| 2–2.5 | 1–4 | 364 | 1.9% | 2.0% | 0.0% | ✓ |
| 2–2.5 | 5+ | 463 | 4.1% | 3.6% | 4.8% | ✓ |
| 2.5–3 | 1–4 | 144 | 6.9% | 7.2% | 0.0% |  |
| 2.5–3 | 5+ | 274 | 5.5% | 5.4% | 5.6% | ✓ |
| 3–3.5 | 1–4 | 176 | 2.8% | 2.9% | 0.0% |  |
| 3–3.5 | 5+ | 195 | 6.2% | 6.8% | 4.8% | ✓ |
| 3.5+ | 1–4 | 173 | 6.4% | 6.4% | 0.0% |  |
| 3.5+ | 5+ | 118 | 5.1% | 6.3% | 2.6% | ✓ |

## 3+ goals

Base rate 0.2% (15 of 6576); fit weeks 0.2%, check week 0.2%. The bar a pill must clear to be filled: 3.0% (about the price a book usually asks for the line). 0 rules found on the fit weeks (5+ hits on 4115+ games, 12+ skaters, every condition worth two points); the check week kept **0% of their lift**; **0 held**, 0 kept after near-duplicates.

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 0.0% | 0.0% | 0.0% | ✓ |
| 0–1 | 5+ | 876 | 0.0% | 0.0% | 0.0% | ✓ |
| 1–1.5 | 1–4 | 718 | 0.0% | 0.0% | 0.0% | ✓ |
| 1–1.5 | 5+ | 1193 | 0.2% | 0.1% | 0.2% | ✓ |
| 1.5–2 | 1–4 | 291 | 0.0% | 0.0% | 0.0% |  |
| 1.5–2 | 5+ | 780 | 0.1% | 0.2% | 0.0% | ✓ |
| 2–2.5 | 1–4 | 364 | 0.3% | 0.3% | 0.0% | ✓ |
| 2–2.5 | 5+ | 463 | 0.9% | 1.1% | 0.5% | ✓ |
| 2.5–3 | 1–4 | 144 | 0.7% | 0.7% | 0.0% |  |
| 2.5–3 | 5+ | 274 | 0.7% | 0.6% | 0.9% | ✓ |
| 3–3.5 | 1–4 | 176 | 0.6% | 0.6% | 0.0% |  |
| 3–3.5 | 5+ | 195 | 0.5% | 0.8% | 0.0% | ✓ |
| 3.5+ | 1–4 | 173 | 0.6% | 0.6% | 0.0% |  |
| 3.5+ | 5+ | 118 | 0.8% | 1.3% | 0.0% | ✓ |

## The environment, his venue, his streaks: each read across its fifths

The hit rate in the bottom and top fifth of each read, the fifths taken within his position (a defenseman against defensemen; a slot read within the slot), overall and among skaters with 2+ shots a game this season, where the lines are bet; fit weeks and check week apart. The opponent’s reads are what it gives up per skater at his position, by window.

### 3+ SOG, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 10.1% (1178) | 42.0% (1181) | 10.3% (68) | 49.3% (743) | 10.3% (58) | 50.2% (530) | — | 46.9% (213) |
| ven_iscf | 10.9% (1178) | 37.6% (1181) | 18.1% (83) | 45.8% (807) | 18.3% (82) | 45.6% (583) | — | 46.4% (224) |
| ven_icf | 10.7% (1178) | 41.4% (1181) | 23.1% (26) | 45.8% (930) | 17.4% (23) | 46.1% (700) | — | 44.8% (230) |
| ven_s3 | 17.2% (1178) | 36.7% (1181) | 25.9% (193) | 42.5% (896) | 25.9% (193) | 41.9% (642) | — | 44.1% (254) |
| ven_iff | 11.8% (1178) | 39.6% (1181) | 30.3% (33) | 44.5% (921) | 29.0% (31) | 44.2% (704) | — | 45.6% (217) |
| opp_pos_ihdcf_l5 | 18.6% (1299) | 23.6% (1303) | 28.9% (401) | 41.3% (361) | 28.7% (338) | 42.1% (273) | 30.2% (63) | 38.6% (88) |
| ven_sog_x | 17.3% (1137) | 21.2% (1141) | 34.2% (193) | 46.5% (230) | 33.6% (152) | 46.0% (174) | 36.6% (41) | 48.2% (56) |
| ven_g1 | 18.8% (1178) | 31.4% (1181) | 30.2% (311) | 42.4% (625) | 30.2% (311) | 41.1% (443) | — | 45.6% (182) |
| ven_g | 18.8% (1178) | 31.8% (1181) | 30.2% (311) | 42.0% (640) | 30.2% (311) | 41.4% (452) | — | 43.6% (188) |
| ven_pts | 17.7% (1178) | 32.5% (1181) | 32.5% (243) | 44.1% (658) | 32.5% (243) | 43.6% (461) | — | 45.2% (197) |
| opp_slot_g | 19.2% (1294) | 23.0% (1306) | 29.9% (461) | 40.2% (376) | 30.1% (459) | 39.0% (313) | — | 46.0% (63) |
| opp_sca_l5 | 18.9% (1299) | 23.9% (1303) | 31.6% (389) | 41.7% (386) | 30.2% (315) | 39.7% (312) | 37.8% (74) | 50.0% (74) |
| opp_pos_ihdcf | 19.8% (1299) | 24.0% (1303) | 29.6% (423) | 39.6% (379) | 29.5% (376) | 38.3% (316) | 29.8% (47) | 46.0% (63) |
| opp_pos_ihdcf_l10 | 19.6% (1299) | 24.2% (1303) | 29.9% (425) | 39.6% (381) | 29.7% (377) | 38.6% (316) | 31.2% (48) | 44.6% (65) |
| opp_sa_l5 | 18.9% (1299) | 22.9% (1303) | 31.4% (392) | 40.7% (371) | 31.5% (321) | 39.4% (249) | 31.0% (71) | 43.4% (122) |
| opp_sca | 19.0% (1299) | 23.9% (1303) | 32.2% (395) | 41.5% (386) | 31.8% (336) | 40.7% (327) | 33.9% (59) | 45.8% (59) |
| opp_ca_l5 | 18.3% (1299) | 23.6% (1303) | 31.1% (373) | 40.4% (394) | 30.7% (290) | 39.2% (324) | 32.5% (83) | 45.7% (70) |
| opp_pos_ihdcf_l5_x | 18.8% (1299) | 22.9% (1303) | 29.2% (411) | 38.3% (363) | 29.0% (334) | 38.3% (295) | 29.9% (77) | 38.2% (68) |
| opp_ca_l10 | 18.5% (1299) | 24.0% (1303) | 31.3% (393) | 40.4% (399) | 31.6% (332) | 39.7% (350) | 29.5% (61) | 44.9% (49) |
| opp_ga_l5 | 19.6% (1299) | 21.9% (1303) | 29.9% (412) | 38.9% (391) | 29.7% (347) | 36.2% (307) | 30.8% (65) | 48.8% (84) |
| opp_pos_iscf | 19.2% (1299) | 24.0% (1303) | 30.6% (409) | 39.6% (402) | 29.9% (355) | 38.0% (358) | 35.2% (54) | 52.3% (44) |
| opp_fa_l10 | 17.7% (1299) | 22.8% (1303) | 30.4% (398) | 39.3% (384) | 30.9% (333) | 37.7% (332) | 27.7% (65) | 50.0% (52) |
| opp_sca_l10 | 19.2% (1299) | 23.9% (1303) | 32.2% (395) | 40.9% (396) | 31.7% (344) | 39.3% (341) | 35.3% (51) | 50.9% (55) |
| opp_fa_l5 | 18.6% (1299) | 22.7% (1303) | 31.4% (398) | 40.2% (381) | 30.9% (314) | 38.5% (314) | 33.3% (84) | 47.8% (67) |
| opp_pos_iff_l5 | 18.2% (1299) | 24.6% (1303) | 31.1% (389) | 39.8% (397) | 30.9% (324) | 39.0% (323) | 32.3% (65) | 43.2% (74) |

### 4+ SOG, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 3.6% (1178) | 22.6% (1181) | 7.4% (68) | 27.6% (743) | 6.9% (58) | 29.2% (530) | — | 23.5% (213) |
| ven_iscf | 3.7% (1178) | 19.1% (1181) | 8.4% (83) | 24.7% (807) | 8.5% (82) | 24.9% (583) | — | 24.1% (224) |
| ven_sog | 4.2% (1178) | 19.9% (1181) | 12.5% (24) | 23.1% (960) | 10.0% (20) | 23.2% (711) | — | 22.9% (249) |
| opp_sca_l5 | 7.3% (1299) | 12.0% (1303) | 14.7% (389) | 23.8% (386) | 14.3% (315) | 24.0% (312) | 16.2% (74) | 23.0% (74) |
| ven_sog_x | 7.1% (1137) | 9.4% (1141) | 16.6% (193) | 25.7% (230) | 18.4% (152) | 27.6% (174) | 9.8% (41) | 19.6% (56) |
| ven_icf | 3.3% (1178) | 21.2% (1181) | 15.4% (26) | 24.3% (930) | 13.0% (23) | 24.6% (700) | — | 23.5% (230) |
| opp_sca | 7.5% (1299) | 12.0% (1303) | 15.2% (395) | 23.8% (386) | 15.8% (336) | 23.5% (327) | 11.9% (59) | 25.4% (59) |
| team_scf | 6.9% (1314) | 11.9% (1317) | 11.7% (248) | 20.3% (537) | 11.6% (215) | 20.4% (476) | 12.1% (33) | 19.7% (61) |
| opp_fa_l5 | 7.2% (1299) | 11.3% (1303) | 14.1% (398) | 22.6% (381) | 14.0% (314) | 22.9% (314) | 14.3% (84) | 20.9% (67) |
| ven_s3 | 7.6% (1178) | 18.4% (1181) | 14.0% (193) | 22.2% (896) | 14.0% (193) | 22.3% (642) | — | 22.0% (254) |
| opp_fa_l10 | 7.0% (1299) | 11.1% (1303) | 13.8% (398) | 21.9% (384) | 14.1% (333) | 21.1% (332) | 12.3% (65) | 26.9% (52) |
| opp_pos_ihdcf_l5 | 8.4% (1299) | 10.4% (1303) | 14.7% (401) | 22.7% (361) | 15.4% (338) | 23.1% (273) | 11.1% (63) | 21.6% (88) |
| opp_sca_l10 | 7.5% (1299) | 12.0% (1303) | 14.9% (395) | 22.7% (396) | 15.7% (344) | 22.6% (341) | 9.8% (51) | 23.6% (55) |
| opp_pos_sog_l5_x | 8.5% (1299) | 10.7% (1303) | 15.4% (377) | 22.9% (385) | 14.9% (309) | 24.5% (298) | 17.6% (68) | 17.2% (87) |
| opp_fa | 7.2% (1299) | 11.1% (1303) | 14.2% (400) | 21.7% (383) | 13.9% (330) | 21.0% (333) | 15.7% (70) | 26.0% (50) |
| opp_ca_l5 | 7.2% (1299) | 11.5% (1303) | 15.3% (373) | 22.6% (394) | 15.5% (290) | 23.1% (324) | 14.5% (83) | 20.0% (70) |
| opp_pos_iscf_l5_x | 7.6% (1299) | 11.4% (1303) | 14.8% (391) | 22.1% (385) | 14.7% (327) | 21.9% (320) | 15.6% (64) | 23.1% (65) |
| opp_pos_sog_l5 | 8.1% (1299) | 10.7% (1303) | 14.9% (377) | 22.0% (381) | 14.6% (314) | 24.0% (288) | 15.9% (63) | 16.1% (93) |
| opp_slot_g | 8.5% (1294) | 10.0% (1306) | 14.1% (461) | 21.3% (376) | 14.2% (459) | 22.0% (313) | — | 17.5% (63) |
| opp_pos_sog_l10 | 8.0% (1299) | 10.8% (1303) | 15.3% (391) | 22.5% (383) | 15.5% (341) | 23.6% (318) | 14.0% (50) | 16.9% (65) |
| opp_sa_l10 | 7.2% (1299) | 10.8% (1303) | 15.1% (391) | 22.2% (383) | 15.3% (327) | 22.4% (303) | 14.1% (64) | 21.2% (80) |
| team_scf_l5 | 7.2% (1314) | 12.3% (1317) | 13.8% (260) | 20.9% (530) | 13.7% (226) | 20.8% (442) | 14.7% (34) | 21.6% (88) |
| opp_sa_l5 | 7.6% (1299) | 11.1% (1303) | 15.1% (392) | 22.1% (371) | 15.6% (321) | 22.5% (249) | 12.7% (71) | 21.3% (122) |
| opp_pos_iff_l5 | 7.9% (1299) | 10.9% (1303) | 13.9% (389) | 20.9% (397) | 13.6% (324) | 22.0% (323) | 15.4% (65) | 16.2% (74) |
| ven_pts | 7.7% (1178) | 16.0% (1181) | 15.6% (243) | 22.6% (658) | 15.6% (243) | 23.6% (461) | — | 20.3% (197) |

### 5+ SOG, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 1.1% (1178) | 11.5% (1181) | 2.9% (68) | 14.8% (743) | 3.4% (58) | 16.0% (530) | — | 11.7% (213) |
| ven_icf | 0.9% (1178) | 10.4% (1181) | 3.8% (26) | 11.8% (930) | 4.3% (23) | 12.4% (700) | — | 10.0% (230) |
| ven_iscf | 1.4% (1178) | 9.2% (1181) | 6.0% (83) | 12.0% (807) | 6.1% (82) | 12.2% (583) | — | 11.6% (224) |
| ven_s3 | 2.5% (1178) | 9.3% (1181) | 6.2% (193) | 11.6% (896) | 6.2% (193) | 11.7% (642) | — | 11.4% (254) |
| opp_slot_g | 3.0% (1294) | 4.4% (1306) | 5.9% (461) | 10.6% (376) | 5.9% (459) | 11.8% (313) | — | 4.8% (63) |
| opp_slot_g_x | 3.0% (1294) | 4.3% (1306) | 5.9% (461) | 10.6% (377) | 5.9% (459) | 11.8% (323) | — | 3.7% (54) |
| team_ff_l5 | 2.3% (1314) | 5.2% (1317) | 4.9% (245) | 9.6% (520) | 4.9% (223) | 9.3% (439) | 4.5% (22) | 11.1% (81) |
| team_scf | 2.5% (1314) | 4.9% (1317) | 5.6% (248) | 9.9% (537) | 6.0% (215) | 9.7% (476) | 3.0% (33) | 11.5% (61) |
| team_scf_l5 | 2.6% (1314) | 4.9% (1317) | 5.8% (260) | 9.8% (530) | 5.8% (226) | 9.7% (442) | 5.9% (34) | 10.2% (88) |
| opp_pos_g | 3.1% (1299) | 4.9% (1303) | 6.2% (405) | 10.1% (398) | 6.5% (371) | 10.9% (331) | 2.9% (34) | 6.0% (67) |
| opp_pos_g_x | 3.3% (1299) | 5.2% (1303) | 6.8% (410) | 10.6% (396) | 6.8% (366) | 11.4% (325) | 6.8% (44) | 7.0% (71) |
| opp_ga | 3.5% (1299) | 4.8% (1303) | 7.5% (413) | 11.2% (385) | 7.5% (348) | 11.7% (332) | 7.7% (65) | 7.5% (53) |
| team_cf_l5 | 2.5% (1314) | 5.0% (1317) | 5.6% (269) | 9.1% (537) | 5.6% (251) | 8.7% (462) | — | 12.0% (75) |
| opp_pos_g_l10 | 3.1% (1299) | 4.7% (1303) | 6.1% (408) | 9.6% (394) | 6.1% (363) | 10.9% (321) | 6.7% (45) | 4.1% (73) |
| opp_ga_l5 | 3.5% (1299) | 4.8% (1303) | 7.3% (412) | 10.7% (391) | 6.9% (347) | 11.4% (307) | 9.2% (65) | 8.3% (84) |
| opp_ga_l10 | 3.3% (1299) | 4.8% (1303) | 7.4% (417) | 10.9% (386) | 7.2% (363) | 11.4% (325) | 9.3% (54) | 8.2% (61) |
| team_sa | 5.0% (1314) | 2.7% (1317) | 9.9% (444) | 6.7% (330) | 11.0% (365) | 6.1% (263) | 5.1% (79) | 9.0% (67) |
| opp_pos_g_l10_x | 3.2% (1299) | 4.9% (1303) | 6.6% (407) | 9.9% (395) | 6.5% (356) | 11.2% (322) | 7.8% (51) | 4.1% (73) |
| ven_sog | 1.5% (1178) | 9.7% (1181) | 8.3% (24) | 11.6% (960) | 10.0% (20) | 12.1% (711) | — | 10.0% (249) |
| opp_pos_g_l5_x | 3.3% (1299) | 4.7% (1303) | 7.5% (413) | 10.6% (377) | 7.1% (336) | 12.8% (297) | 9.1% (77) | 2.5% (80) |
| opp_pos_ihdcf_l5 | 3.5% (1299) | 4.3% (1303) | 7.7% (401) | 10.8% (361) | 8.0% (338) | 11.4% (273) | 6.3% (63) | 9.1% (88) |
| team_hdcf | 2.6% (1314) | 5.1% (1317) | 6.6% (256) | 9.7% (516) | 6.8% (222) | 10.2% (430) | 5.9% (34) | 7.0% (86) |
| opp_pos_iscf_l5_x | 2.9% (1299) | 4.2% (1303) | 6.9% (391) | 9.9% (385) | 7.0% (327) | 10.6% (320) | 6.2% (64) | 6.2% (65) |
| opp_pos_sog_l5_x | 3.6% (1299) | 4.5% (1303) | 8.2% (377) | 11.2% (385) | 7.8% (309) | 12.8% (298) | 10.3% (68) | 5.7% (87) |
| team_cf | 2.4% (1314) | 5.1% (1317) | 6.0% (250) | 8.8% (543) | 6.1% (228) | 9.7% (466) | 4.5% (22) | 3.9% (77) |

### 1+ goal, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 7.2% (1178) | 25.6% (1181) | 7.4% (68) | 31.8% (743) | 8.6% (58) | 30.4% (530) | — | 35.2% (213) |
| ven_iscf | 8.6% (1178) | 22.9% (1181) | 14.5% (83) | 27.9% (807) | 14.6% (82) | 26.2% (583) | — | 32.1% (224) |
| ven_iff | 9.7% (1178) | 24.3% (1181) | 15.2% (33) | 27.0% (921) | 16.1% (31) | 26.0% (704) | — | 30.4% (217) |
| ven_icf | 8.7% (1178) | 24.0% (1181) | 15.4% (26) | 26.7% (930) | 17.4% (23) | 25.3% (700) | — | 30.9% (230) |
| ven_sog_x | 12.5% (1137) | 15.6% (1141) | 23.8% (193) | 31.7% (230) | 24.3% (152) | 32.2% (174) | 22.0% (41) | 30.4% (56) |
| opp_pos_iff_l5 | 13.1% (1299) | 17.2% (1303) | 19.0% (389) | 25.7% (397) | 18.2% (324) | 25.1% (323) | 23.1% (65) | 28.4% (74) |
| opp_pos_iff_l5_x | 13.2% (1299) | 16.7% (1303) | 18.9% (381) | 25.4% (393) | 18.2% (313) | 24.9% (321) | 22.1% (68) | 27.8% (72) |
| opp_ca | 13.3% (1299) | 16.7% (1303) | 19.6% (393) | 25.8% (395) | 19.3% (327) | 24.4% (348) | 21.2% (66) | 36.2% (47) |
| ven_s3 | 13.4% (1178) | 22.4% (1181) | 20.2% (193) | 26.2% (896) | 20.2% (193) | 24.9% (642) | — | 29.5% (254) |
| opp_ca_l10 | 13.2% (1299) | 16.6% (1303) | 19.6% (393) | 25.3% (399) | 19.6% (332) | 24.3% (350) | 19.7% (61) | 32.7% (49) |
| ven_pts | 13.5% (1178) | 20.7% (1181) | 22.6% (243) | 27.4% (658) | 22.6% (243) | 26.2% (461) | — | 29.9% (197) |
| opp_pos_sog_l10 | 14.3% (1299) | 16.9% (1303) | 22.0% (391) | 26.4% (383) | 21.4% (341) | 24.5% (318) | 26.0% (50) | 35.4% (65) |
| team_gf_l5 | 15.0% (1314) | 14.1% (1317) | 25.4% (331) | 21.0% (447) | 23.0% (274) | 19.4% (361) | 36.8% (57) | 27.9% (86) |
| pace | 14.3% (1299) | 15.3% (1303) | 25.8% (337) | 21.5% (461) | 23.1% (316) | 21.4% (387) | 66.7% (21) | 21.6% (74) |
| ven_g | 14.9% (1178) | 19.6% (1181) | 22.5% (311) | 26.7% (640) | 22.5% (311) | 25.2% (452) | — | 30.3% (188) |
| opp_pos_icf_l5_x | 13.2% (1299) | 16.8% (1303) | 20.1% (393) | 24.3% (399) | 18.5% (325) | 24.4% (336) | 27.9% (68) | 23.8% (63) |
| opp_pos_iscf_l5 | 13.5% (1299) | 17.0% (1303) | 20.4% (393) | 24.5% (392) | 18.6% (334) | 24.4% (320) | 30.5% (59) | 25.0% (72) |
| team_hdcf_l5 | 13.9% (1314) | 16.6% (1317) | 20.7% (270) | 24.8% (505) | 19.5% (236) | 24.1% (402) | 29.4% (34) | 27.2% (103) |
| opp_pos_g_l5_x | 13.4% (1299) | 15.0% (1303) | 20.1% (413) | 23.9% (377) | 19.3% (336) | 22.9% (297) | 23.4% (77) | 27.5% (80) |
| team_hdcf | 13.5% (1314) | 16.5% (1317) | 20.3% (256) | 24.0% (516) | 18.5% (222) | 24.2% (430) | 32.4% (34) | 23.3% (86) |
| opp_pos_iff | 13.9% (1299) | 16.7% (1303) | 21.4% (401) | 25.1% (394) | 19.3% (342) | 23.9% (348) | 33.9% (59) | 34.8% (46) |
| opp_pos_icf_l5 | 12.6% (1299) | 16.2% (1303) | 19.7% (391) | 23.4% (394) | 18.1% (321) | 23.8% (332) | 27.1% (70) | 21.0% (62) |
| opp_fa_l10 | 13.5% (1299) | 16.0% (1303) | 21.1% (398) | 24.7% (384) | 20.1% (333) | 23.5% (332) | 26.2% (65) | 32.7% (52) |
| team_ff_l5 | 12.3% (1314) | 16.4% (1317) | 17.6% (245) | 21.2% (520) | 17.0% (223) | 20.0% (439) | 22.7% (22) | 27.2% (81) |
| team_gf | 14.5% (1314) | 14.7% (1317) | 24.1% (353) | 20.5% (459) | 22.2% (302) | 20.2% (382) | 35.3% (51) | 22.1% (77) |

### 2+ goals, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 0.5% (1178) | 5.7% (1181) | 0.0% (68) | 7.9% (743) | 0.0% (58) | 8.5% (530) | — | 6.6% (213) |
| ven_icf | 0.8% (1178) | 5.2% (1181) | 0.0% (26) | 6.3% (930) | 0.0% (23) | 6.9% (700) | — | 4.8% (230) |
| ven_sog_x | 1.4% (1137) | 2.8% (1141) | 4.1% (193) | 10.4% (230) | 4.6% (152) | 11.5% (174) | 2.4% (41) | 7.1% (56) |
| ven_iscf | 0.4% (1178) | 5.2% (1181) | 1.2% (83) | 7.3% (807) | 1.2% (82) | 7.4% (583) | — | 7.1% (224) |
| ven_sog | 0.6% (1178) | 4.6% (1181) | 0.0% (24) | 5.4% (960) | 0.0% (20) | 5.8% (711) | — | 4.4% (249) |
| opp_slot_g | 1.2% (1294) | 2.8% (1306) | 2.4% (461) | 6.1% (376) | 2.4% (459) | 6.1% (313) | — | 6.3% (63) |
| opp_slot_g_x | 1.2% (1294) | 2.8% (1306) | 2.4% (461) | 6.1% (377) | 2.4% (459) | 5.9% (323) | — | 7.4% (54) |
| ven_iff | 0.6% (1178) | 5.3% (1181) | 3.0% (33) | 6.4% (921) | 3.2% (31) | 6.7% (704) | — | 5.5% (217) |
| ven_s3 | 1.1% (1178) | 5.0% (1181) | 3.1% (193) | 6.4% (896) | 3.1% (193) | 6.2% (642) | — | 6.7% (254) |
| opp_pos_iff_l5_x | 0.8% (1299) | 3.1% (1303) | 2.1% (381) | 5.3% (393) | 1.9% (313) | 5.3% (321) | 2.9% (68) | 5.6% (72) |
| opp_pos_iff_l5 | 0.8% (1299) | 3.0% (1303) | 2.1% (389) | 5.3% (397) | 1.9% (324) | 5.3% (323) | 3.1% (65) | 5.4% (74) |
| opp_slot_icf_x | 1.5% (1294) | 2.9% (1306) | 3.5% (397) | 6.5% (400) | 3.7% (351) | 6.4% (357) | 2.2% (46) | 7.0% (43) |
| opp_pos_iff_ven_x | 1.3% (1197) | 2.5% (1200) | 2.8% (361) | 5.6% (340) | 3.1% (295) | 5.8% (276) | 1.5% (66) | 4.7% (64) |
| opp_slot_icf | 1.6% (1294) | 2.8% (1306) | 3.7% (403) | 6.3% (394) | 3.9% (358) | 6.2% (352) | 2.2% (45) | 7.1% (42) |
| opp_pos_iscf_l5 | 0.9% (1299) | 3.0% (1303) | 2.3% (393) | 4.8% (392) | 2.4% (334) | 5.3% (320) | 1.7% (59) | 2.8% (72) |
| opp_slot_sog_x | 1.5% (1294) | 2.8% (1306) | 4.0% (399) | 6.4% (389) | 4.3% (351) | 6.5% (340) | 2.1% (48) | 6.1% (49) |
| opp_slot_sog | 1.5% (1294) | 2.8% (1306) | 3.8% (395) | 6.2% (387) | 3.9% (357) | 6.3% (334) | 2.6% (38) | 5.7% (53) |
| opp_pos_icf_l5_x | 0.9% (1299) | 2.5% (1303) | 2.3% (393) | 4.5% (399) | 2.2% (325) | 4.8% (336) | 2.9% (68) | 3.2% (63) |
| team_sf | 1.9% (1314) | 2.6% (1317) | 5.8% (224) | 3.7% (543) | 6.3% (191) | 4.3% (443) | 3.0% (33) | 1.0% (100) |
| opp_pos_iscf_l5_x | 1.0% (1299) | 2.9% (1303) | 2.6% (391) | 4.7% (385) | 2.8% (327) | 5.3% (320) | 1.6% (64) | 1.5% (65) |
| opp_pos_iscf | 1.3% (1299) | 3.2% (1303) | 3.2% (409) | 5.2% (402) | 3.1% (355) | 4.7% (358) | 3.7% (54) | 9.1% (44) |
| opp_pos_icf_l5 | 0.9% (1299) | 2.5% (1303) | 2.3% (391) | 4.3% (394) | 2.2% (321) | 4.8% (332) | 2.9% (70) | 1.6% (62) |
| opp_pos_iff_ven | 1.4% (1197) | 2.4% (1200) | 3.3% (365) | 5.3% (340) | 3.6% (302) | 5.5% (271) | 1.6% (63) | 4.3% (69) |
| opp_pos_sog_l10 | 1.6% (1299) | 3.1% (1303) | 4.1% (391) | 6.0% (383) | 4.1% (341) | 5.7% (318) | 4.0% (50) | 7.7% (65) |
| team_sf_l5 | 1.8% (1314) | 2.4% (1317) | 5.9% (222) | 4.0% (525) | 6.2% (193) | 4.7% (425) | 3.4% (29) | 1.0% (100) |

## Streaks, inside his shot tier

A 3+ SOG streak mostly marks a high-volume shooter, so each streak is read inside his shots-a-game tier this season: the hit rate by the length of the run he came in on.

### 3+ SOG

| Run | His shots a game | 0 | 1 | 2 | 3+ |
| --- | --- | --- | --- | --- | --- |
| 2+ SOG streak | under 2 | 14.3% (3380) | 15.2% (920) | 18.9% (254) | 27.8% (115) |
| 2+ SOG streak | 2 – 3 | 32.5% (351) | 29.4% (371) | 30.6% (216) | 39.7% (307) |
| 2+ SOG streak | 3+ | 63.2% (57) | 33.2% (211) | 44.0% (125) | 48.3% (269) |
| 3+ SOG streak | under 2 | 14.8% (4216) | 16.9% (414) | 29.7% (37) | — (2) |
| 3+ SOG streak | 2 – 3 | 32.5% (782) | 35.1% (316) | 28.2% (110) | 40.5% (37) |
| 3+ SOG streak | 3+ | 49.7% (159) | 37.1% (272) | 47.4% (116) | 48.7% (115) |
| 4+ SOG streak | under 2 | 14.9% (4542) | 20.3% (123) | — (4) | — (0) |
| 4+ SOG streak | 2 – 3 | 33.0% (1040) | 33.2% (184) | — (18) | — (3) |
| 4+ SOG streak | 3+ | 42.1% (349) | 43.6% (227) | 51.7% (60) | 53.8% (26) |
| goal streak | under 2 | 14.5% (4205) | 20.8% (408) | 19.1% (47) | — (9) |
| goal streak | 2 – 3 | 32.1% (951) | 36.1% (227) | 32.1% (53) | — (14) |
| goal streak | 3+ | 44.0% (414) | 41.0% (183) | 48.9% (47) | — (18) |
| point streak | under 2 | 13.6% (3364) | 18.0% (898) | 20.9% (268) | 22.3% (139) |
| point streak | 2 – 3 | 32.7% (648) | 30.1% (312) | 35.4% (144) | 38.3% (141) |
| point streak | 3+ | 39.1% (258) | 42.3% (213) | 49.5% (93) | 55.1% (98) |
| under 2 SOG streak | under 2 | 17.1% (1289) | 15.8% (1342) | 14.2% (832) | 12.9% (1206) |
| under 2 SOG streak | 2 – 3 | 33.2% (894) | 31.7% (287) | 35.0% (60) | — (4) |
| under 2 SOG streak | 3+ | 42.1% (605) | 62.3% (53) | — (4) | — (0) |
| pointless streak | under 2 | 19.1% (1305) | 15.8% (1124) | 13.1% (757) | 12.1% (1483) |
| pointless streak | 2 – 3 | 33.3% (597) | 34.0% (341) | 33.1% (166) | 29.1% (141) |
| pointless streak | 3+ | 47.0% (404) | 38.7% (181) | 41.8% (55) | 36.4% (22) |
| games since a goal | under 2 | 20.5% (464) | 15.7% (788) | 13.1% (686) | 14.5% (2731) |
| games since a goal | 2 – 3 | 36.1% (294) | 30.6% (314) | 34.2% (225) | 32.0% (412) |
| games since a goal | 3+ | 44.0% (248) | 43.5% (207) | 37.9% (95) | 50.0% (112) |
| games since 3+ SOG | under 2 | 18.1% (453) | 17.1% (840) | 13.7% (774) | 14.3% (2602) |
| games since 3+ SOG | 2 – 3 | 33.9% (463) | 30.9% (473) | 31.2% (192) | 41.0% (117) |
| games since 3+ SOG | 3+ | 42.1% (503) | 50.0% (122) | 56.7% (30) | — (7) |

### 4+ SOG

| Run | His shots a game | 0 | 1 | 2 | 3+ |
| --- | --- | --- | --- | --- | --- |
| 2+ SOG streak | under 2 | 5.3% (3380) | 5.7% (920) | 7.5% (254) | 13.0% (115) |
| 2+ SOG streak | 2 – 3 | 13.4% (351) | 14.0% (371) | 15.7% (216) | 19.5% (307) |
| 2+ SOG streak | 3+ | 40.4% (57) | 18.5% (211) | 20.8% (125) | 29.4% (269) |
| 3+ SOG streak | under 2 | 5.5% (4216) | 6.8% (414) | 8.1% (37) | — (2) |
| 3+ SOG streak | 2 – 3 | 15.7% (782) | 16.1% (316) | 11.8% (110) | 16.2% (37) |
| 3+ SOG streak | 3+ | 30.2% (159) | 21.0% (272) | 25.9% (116) | 27.8% (115) |
| 4+ SOG streak | under 2 | 5.6% (4542) | 8.1% (123) | — (4) | — (0) |
| 4+ SOG streak | 2 – 3 | 16.1% (1040) | 12.5% (184) | — (18) | — (3) |
| 4+ SOG streak | 3+ | 24.4% (349) | 25.1% (227) | 30.0% (60) | 26.9% (26) |
| goal streak | under 2 | 5.4% (4205) | 8.3% (408) | 6.4% (47) | — (9) |
| goal streak | 2 – 3 | 14.5% (951) | 19.4% (227) | 13.2% (53) | — (14) |
| goal streak | 3+ | 26.3% (414) | 21.3% (183) | 27.7% (47) | — (18) |
| point streak | under 2 | 4.9% (3364) | 6.7% (898) | 9.3% (268) | 10.1% (139) |
| point streak | 2 – 3 | 15.3% (648) | 13.1% (312) | 18.8% (144) | 18.4% (141) |
| point streak | 3+ | 22.5% (258) | 23.5% (213) | 32.3% (93) | 29.6% (98) |
| under 2 SOG streak | under 2 | 6.7% (1289) | 5.8% (1342) | 5.6% (832) | 4.4% (1206) |
| under 2 SOG streak | 2 – 3 | 16.3% (894) | 13.6% (287) | 11.7% (60) | — (4) |
| under 2 SOG streak | 3+ | 23.8% (605) | 39.6% (53) | — (4) | — (0) |
| pointless streak | under 2 | 7.6% (1305) | 6.2% (1124) | 4.0% (757) | 4.4% (1483) |
| pointless streak | 2 – 3 | 15.7% (597) | 17.3% (341) | 15.1% (166) | 10.6% (141) |
| pointless streak | 3+ | 27.0% (404) | 22.1% (181) | 23.6% (55) | 22.7% (22) |
| games since a goal | under 2 | 8.2% (464) | 6.9% (788) | 4.7% (686) | 5.1% (2731) |
| games since a goal | 2 – 3 | 18.7% (294) | 15.3% (314) | 11.6% (225) | 15.5% (412) |
| games since a goal | 3+ | 23.4% (248) | 27.1% (207) | 22.1% (95) | 28.6% (112) |
| games since 3+ SOG | under 2 | 6.8% (453) | 6.4% (840) | 5.9% (774) | 5.1% (2602) |
| games since 3+ SOG | 2 – 3 | 15.1% (463) | 14.8% (473) | 17.2% (192) | 17.1% (117) |
| games since 3+ SOG | 3+ | 23.7% (503) | 29.5% (122) | 40.0% (30) | — (7) |

### 1+ goal

| Run | His shots a game | 0 | 1 | 2 | 3+ |
| --- | --- | --- | --- | --- | --- |
| 2+ SOG streak | under 2 | 10.5% (3380) | 12.6% (920) | 17.3% (254) | 18.3% (115) |
| 2+ SOG streak | 2 – 3 | 20.8% (351) | 19.9% (371) | 22.2% (216) | 22.1% (307) |
| 2+ SOG streak | 3+ | 38.6% (57) | 19.4% (211) | 32.0% (125) | 28.3% (269) |
| 3+ SOG streak | under 2 | 11.2% (4216) | 14.0% (414) | 10.8% (37) | — (2) |
| 3+ SOG streak | 2 – 3 | 20.1% (782) | 25.6% (316) | 20.0% (110) | 8.1% (37) |
| 3+ SOG streak | 3+ | 33.3% (159) | 21.7% (272) | 27.6% (116) | 30.4% (115) |
| 4+ SOG streak | under 2 | 11.3% (4542) | 16.3% (123) | — (4) | — (0) |
| 4+ SOG streak | 2 – 3 | 20.5% (1040) | 25.5% (184) | — (18) | — (3) |
| 4+ SOG streak | 3+ | 25.8% (349) | 26.9% (227) | 28.3% (60) | 42.3% (26) |
| goal streak | under 2 | 11.1% (4205) | 15.2% (408) | 12.8% (47) | — (9) |
| goal streak | 2 – 3 | 20.2% (951) | 24.2% (227) | 24.5% (53) | — (14) |
| goal streak | 3+ | 27.5% (414) | 25.1% (183) | 27.7% (47) | — (18) |
| point streak | under 2 | 10.3% (3364) | 14.0% (898) | 15.3% (268) | 16.5% (139) |
| point streak | 2 – 3 | 19.0% (648) | 23.1% (312) | 25.7% (144) | 22.0% (141) |
| point streak | 3+ | 25.2% (258) | 25.4% (213) | 26.9% (93) | 35.7% (98) |
| under 2 SOG streak | under 2 | 14.0% (1289) | 11.7% (1342) | 10.5% (832) | 9.2% (1206) |
| under 2 SOG streak | 2 – 3 | 21.3% (894) | 20.2% (287) | 25.0% (60) | — (4) |
| under 2 SOG streak | 3+ | 26.0% (605) | 39.6% (53) | — (4) | — (0) |
| pointless streak | under 2 | 14.6% (1305) | 12.0% (1124) | 10.3% (757) | 9.0% (1483) |
| pointless streak | 2 – 3 | 23.5% (597) | 19.6% (341) | 15.7% (166) | 21.3% (141) |
| pointless streak | 3+ | 28.2% (404) | 26.0% (181) | 25.5% (55) | 18.2% (22) |
| games since a goal | under 2 | 15.3% (464) | 12.2% (788) | 10.2% (686) | 10.9% (2731) |
| games since a goal | 2 – 3 | 24.1% (294) | 20.1% (314) | 19.1% (225) | 20.9% (412) |
| games since a goal | 3+ | 26.2% (248) | 28.5% (207) | 25.3% (95) | 27.7% (112) |
| games since 3+ SOG | under 2 | 13.7% (453) | 11.1% (840) | 12.7% (774) | 10.9% (2602) |
| games since 3+ SOG | 2 – 3 | 22.9% (463) | 17.3% (473) | 25.0% (192) | 23.1% (117) |
| games since 3+ SOG | 3+ | 25.0% (503) | 32.8% (122) | 36.7% (30) | — (7) |

## By line slot

How often each slot reached each line (slot = ice-time rank in the game within his position: the box score carries no lineup; the site reads the beat writers’ lineups), and the rule that fires most often there for 3+ SOG and 1+ goal with its rate inside the slot.

| Slot | Skater-games | 3+ SOG | 4+ SOG | 5+ SOG | 6+ SOG | 1+ goal | 2+ goals | 3+ goals | 3+ SOG: the rule firing most there | 1+ goal: the rule firing most there |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | 372 | 37.9% | 21.2% | 10.2% | 6.5% | 29.6% | 4.3% | 0.0% | iscf60 ≥ 9.272 · sog_max ≥ 6 · ven_toi ≥ 18.836: 60.9% of 64 | ven_iff ≥ 4.5 · line ≤ 1: 42.9% of 112 |
| LW1 | 372 | 45.7% | 21.5% | 9.9% | 4.0% | 25.0% | 5.1% | 0.8% | ihdcf_l3 ≥ 1 · toi_l3 ≥ 20.345 · sog_max ≥ 6: 82.9% of 41 | ven_iff ≥ 4.5 · line ≤ 1: 37.0% of 81 |
| RW1 | 374 | 42.8% | 22.2% | 10.4% | 4.3% | 32.1% | 7.5% | 0.8% | toi_l5 ≥ 18.89 · blk_l3 ≤ 0.333 · sog_max ≥ 6: 58.6% of 29 | ven_iff ≥ 4.5 · line ≤ 1: 45.7% of 92 |
| C2 | 373 | 28.4% | 14.7% | 7.8% | 2.7% | 22.3% | 2.4% | 0.3% | iscf60 ≥ 9.272 · sog_max ≥ 6 · ven_toi ≥ 18.836: 72.2% of 18 | toi_avg ≥ 20.203 · ven_iscf ≥ 3.5: 33.3% of 18 |
| LW2 | 371 | 28.6% | 14.8% | 6.2% | 3.5% | 21.6% | 3.0% | 1.1% | — | — |
| RW2 | 370 | 30.5% | 11.1% | 4.6% | 2.2% | 18.1% | 2.7% | 0.3% | — | — |
| C3 | 371 | 18.3% | 8.4% | 3.8% | 1.3% | 16.2% | 1.3% | 0.0% | — | — |
| LW3 | 361 | 17.7% | 7.2% | 2.8% | 0.8% | 13.0% | 1.9% | 0.0% | — | — |
| RW3 | 359 | 16.4% | 5.3% | 1.7% | 0.6% | 15.9% | 2.2% | 0.6% | — | — |
| C4 | 359 | 11.4% | 4.5% | 0.6% | 0.0% | 10.9% | 0.6% | 0.0% | — | — |
| LW4 | 342 | 7.6% | 2.0% | 1.5% | 0.3% | 9.4% | 1.2% | 0.0% | — | — |
| RW4 | 331 | 8.5% | 2.7% | 0.0% | 0.0% | 11.5% | 1.2% | 0.3% | — | — |
| D1 | 746 | 25.9% | 11.0% | 3.9% | 2.0% | 8.7% | 0.7% | 0.0% | toi_l3 ≥ 20.345 · sog_max ≥ 6 · ven_sog_x ≥ 0.96: 46.7% of 30 | ven_iff ≥ 4.5 · line ≤ 1: 21.0% of 62 |
| D2 | 745 | 11.7% | 3.6% | 1.3% | 0.4% | 6.4% | 0.5% | 0.0% | — | — |
| D3 | 730 | 6.2% | 1.9% | 0.3% | 0.0% | 5.3% | 0.1% | 0.0% | — | — |

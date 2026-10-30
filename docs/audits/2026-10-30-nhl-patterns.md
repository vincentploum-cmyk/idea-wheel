# Patterns: what fires each line, NHL, 2026-10-01 to 2026-10-29 (checked on Oct 16–29)

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
- **Rules per line** (`tools/predictors/patterns.py`): every figure cut at its tenths both ways (2,308 conditions). A
  beam search found the best one-, two- and three-condition rules for each line on **Oct 1–15** (3,278 skater-games).
  A rule must fire for 12 skaters or more, and a condition that adds under two points is dropped. It was then checked
  on **Oct 16–29** (3,298 skater-games, two weeks the search never saw; Vincent, 2026-10-30: "expand to October 16
  through October 29" — the first cut checked on Oct 23–29 alone).
- **The pill's figure** is honest about the search: the fit weeks' lift, cut to the share of it the check weeks kept
  over every rule found, then updated by the rule's own check weeks. On the site each rule's rate keeps moving with the
  games after Oct 29, and those games are the record.

## What the season says, line by line

| Line | Happens | Rules found → held | Lift kept on the weeks they never saw | Filled pills come from |
| --- | --- | --- | --- | --- |
| 3+ SOG | 21.4% | 99 → 98 | 89% | 15 rules at 55–63%: a 6+ shot game already this season, 18–20+ minutes lately or at tonight's venue, chances at tonight's venue; the 3.5+ shots-a-game tier (5+ games) at 56% |
| 4+ SOG | 9.5% | 105 → 100 | 95% | 15 rules at 34–42%: 18.9+ minutes a game with 19.6+ attempts per 60 (42%), 4.4+ unblocked attempts a game with his minutes; the 3.5+ tier at 37% |
| 5+ SOG | 4.0% | 41 → 41 | 100% | one rule: 4.4+ unblocked attempts a game over his last five, his attempts not running above his season (21%) |
| 6+ SOG | 1.7% | 40 → 38 | 87% | no rule clears 11%; the 3.5+ shots-a-game tier (5+ games), 14% |
| 1+ goal | 14.9% | 117 → 113 | 88% | 15 rules at 40–48%: his volume **at tonight's venue** (4.7+ unblocked attempts a game there), first-line minutes, a point a game |
| 2+ goals | 2.0% | 41 → 39 | 60% | none clears 9%: the best, 2.5+ chances a game, 5% |
| 3+ goals | 13 games | — | — | too few to mine; the ladder only |

What each part of a rule adds (the rate with the rule against the rule without that condition, whole window):

1. **Volume, minutes and a ceiling carry the shots.** For 3+ SOG: a 6+ shot game on his record (+8 to +28 points),
   his minutes over the last three or five, or at tonight's venue (+8 to +15), his chances or unblocked attempts (+10
   to +28). For 4+ SOG his attempts per 60 or unblocked attempts a game (+19 to +26) and his minutes (+4 to +16).
2. **The opponent's goals against stays in the rules, smaller than the one-week check said.** "Not one of the stingiest
   six on goals against over its last five" (GA L5 rank 26 or lower) adds 3–5 points to 3+ and 4+ SOG rules; the
   Oct 23–29 check had read +10–15 for a top-10 GA team, which the wider check does not keep.
3. **His volume at tonight's venue is the goal signal.** 4.7+ unblocked attempts a game at the venue he plays tonight
   adds 10–25 points to 1+ goal rules; first-line minutes add 5–11, the opponent in the top half of goals against over
   its last five 6. The plain split (shooting 18%+ more at tonight's venue) reads the same way across its fifths
   (24% → 32% among 2+ shots-a-game skaters, 20% → 33% on the check weeks).
4. **The opponent's attempts, chances and shots allowed: real, and sharper as the tables fill.** Among skaters with 2+
   shots a game, the opponent's bottom fifth against its top fifth (ranked within his position) moves 3+ SOG by 6–9
   points on Oct 1–15 and by 11–16 points on Oct 16–29, when every table has a few more games behind it:
   - high-danger chances allowed to his position over the last five: 33% → 48% on Oct 16–29;
   - chances against a game over its last five (SCA L5): 36% → 47%;
   - attempts against (CA L5 / L10, FA L10): 31–32% → 44–46%;
   - shots against L5 and goals against L5: 34% → 45% and 36% → 48%.

   For 1+ goal the same reads move it 5–10 points (unblocked attempts allowed to his position L5: 21% → 29%). Inside a
   rule, on top of his volume, they add 2–6 points when they survive the two-point cut: his own numbers still decide.
5. **Streaks are colour, mostly.** Inside his shot tier the 3+ SOG run he comes in on moves 3+ SOG by a few points with
   no steady direction. A **point streak** is the one that leans: 3+ shots a game and a point in 3+ straight, 55% on
   3+ SOG against 39% with none; points a game and a point in four of his last five also appear in the goal rules.

Caveats: four weeks of one season, 6,576 skater-games, fitted on the first two and checked on the last two. Enough for
3+ / 4+ SOG and 1+ goal; the rare lines' rules held in direction, but under the bars (5+ SOG has one rule over 20%).
"Line" in the study is the skater's ice-time rank in the game; the site reads the beat writers' lineups. The check
weeks decided which rules were kept, so they are not a clean test of the kept set; the site's record (games after
Oct 29) is. No book prices: a filled pill says the rate clears about what a book asks for the line, not that tonight's
price pays.

## The tables

6576 skater-games, 239 figures each (158 searched: the opponent’s reads at his position and slot as × the league’s and as ranks), cut into 2308 conditions. Rules searched on 2026-10-02 to 2026-10-15 (3278 skater-games) and checked on 2026-10-16 to 2026-10-29 (3298 skater-games the search never saw).

| Line | Base | Rules found | Lift kept on the check week | Held | Kept | Fill the pill | The strongest that held |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3+ SOG | 21.4% | 99 | 89% | 98 | 15 | 15 | toi_l5 ≥ 17.619 · sog_max ≥ 6 · ven_iscf ≥ 3.5 (fit 71.0% on 62, check 62.2% on 98; pill 63.3%) |
| 4+ SOG | 9.5% | 105 | 95% | 100 | 15 | 15 | toi_avg ≥ 18.88 · icf60 ≥ 19.648 (fit 38.4% on 112, check 44.6% on 83; pill 42.1%) |
| 5+ SOG | 4.0% | 41 | 100% | 41 | 15 | 1 | iff_l5 ≥ 4.4 · icf_trend ≤ 1 (fit 15.5% on 317, check 22.8% on 114; pill 20.9%) |
| 6+ SOG | 1.7% | 40 | 87% | 38 | 15 | 0 | s2_rate ≥ 0.8 (fit 5.1% on 670, check 6.3% on 350; pill 6.1%) |
| 1+ goal | 14.9% | 117 | 88% | 113 | 15 | 15 | iscf_l10 ≥ 3.333 · sog_sd ≥ 1.414 · ven_s3 ≥ 1 (fit 48.6% on 70, check 51.2% on 41; pill 48.2%) |
| 2+ goals | 2.0% | 41 | 60% | 39 | 15 | 0 | iscf_avg ≥ 2.5 (fit 6.8% on 690, check 5.4% on 593; pill 5.4%) |
| 3+ goals | 0.2% | 0 | 0% | 0 | 0 | 0 | — |

## 3+ SOG

Base rate 21.4% (1407 of 6576); fit weeks 21.2%, check week 21.6%. The bar a pill must clear to be filled: 50.0% (about the price a book usually asks for the line). 99 rules found on the fit weeks (10+ hits on 60+ games, 12+ skaters, every condition worth two points); the check week kept **89% of their lift**; **98 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| toi_l5 ≥ 17.619 · sog_max ≥ 6 · ven_iscf ≥ 3.5 | 26 | 62 | 71.0% | 98 | 62.2% | toi_l5 ≥ 17.619 +8.1; sog_max ≥ 6 +14.0; ven_iscf ≥ 3.5 +11.6 | 63.3% | ✓ |
| ihdcf_l3 ≥ 1 · toi_l5 ≥ 18.91 · sog_max ≥ 6 | 24 | 61 | 73.8% | 121 | 60.3% | ihdcf_l3 ≥ 1 +8.1; toi_l5 ≥ 18.91 +14.4; sog_max ≥ 6 +19.5 | 62.3% | ✓ |
| fwd = 1 · toi_l5 ≥ 18.91 · sog_max ≥ 6 | 25 | 74 | 70.3% | 151 | 58.9% | fwd = 1 +5.9; toi_l5 ≥ 18.91 +15.1; sog_max ≥ 6 +16.0 | 60.2% | ✓ |
| blk_l10 ≤ 1 · sog_max ≥ 6 · ven_toi ≥ 18.87 | 28 | 61 | 73.8% | 164 | 57.9% | blk_l10 ≤ 1 +5.2; sog_max ≥ 6 +23.5; ven_toi ≥ 18.87 +14.9 | 59.9% | ✓ |
| a_l5 ≥ 1 · sog_max ≥ 5 | 26 | 63 | 63.5% | 71 | 59.2% | a_l5 ≥ 1 +19.7; sog_max ≥ 5 +26.6 | 59.1% | ✓ |
| sog_max ≥ 6 · ven_toi ≥ 18.87 · opp_ga_l5_rk ≤ 26 | 30 | 61 | 72.1% | 160 | 56.9% | sog_max ≥ 6 +28.3; ven_toi ≥ 18.87 +10.8; opp_ga_l5_rk ≤ 26 +4.0 | 58.9% | ✓ |
| sog_max ≥ 6 · ven_iscf ≥ 3.5 · opp_ga_l5_rk ≤ 26 | 26 | 60 | 71.7% | 97 | 55.7% | sog_max ≥ 6 +14.6; ven_iscf ≥ 3.5 +11.5; opp_ga_l5_rk ≤ 26 +4.3 | 58.8% | ✓ |
| iscf_avg ≥ 3.333 · ven_toi ≥ 20.357 | 32 | 74 | 63.5% | 104 | 58.7% | iscf_avg ≥ 3.333 +28.3; ven_toi ≥ 20.357 +11.9 | 58.8% | ✓ |
| iscf_l10 ≥ 3.333 · sog_max ≥ 6 | 35 | 108 | 59.3% | 144 | 59.7% | iscf_l10 ≥ 3.333 +13.0; sog_max ≥ 6 +10.3 | 58.8% | ✓ |
| toi_l5 ≥ 18.91 · blk_l3 ≤ 1 · sog_max ≥ 6 | 29 | 66 | 71.2% | 167 | 56.3% | toi_l5 ≥ 18.91 +13.5; blk_l3 ≤ 1 +3.7; sog_max ≥ 6 +24.8 | 58.2% | ✓ |
| toi_l3 ≥ 20.257 · sog_max ≥ 6 | 22 | 65 | 64.6% | 148 | 57.4% | toi_l3 ≥ 20.257 +13.1; sog_max ≥ 6 +28.2 | 58.0% | ✓ |
| a_avg ≥ 1 · sog_max ≥ 5 | 26 | 63 | 63.5% | 69 | 56.5% | a_avg ≥ 1 +18.4; sog_max ≥ 5 +26.4 | 57.5% | ✓ |
| iff_l5 ≥ 4.4 · ven_toi ≥ 20.357 | 49 | 102 | 59.8% | 143 | 55.2% | iff_l5 ≥ 4.4 +24.7; ven_toi ≥ 20.357 +8.5 | 55.4% | ✓ |
| sog_max ≥ 6 · ven_iscf ≥ 3.5 | 33 | 86 | 61.6% | 121 | 54.5% | sog_max ≥ 6 +13.2; ven_iscf ≥ 3.5 +11.0 | 55.3% | ✓ |
| iff_l5 ≥ 4.4 · sog_max ≥ 6 | 39 | 115 | 59.1% | 176 | 55.1% | iff_l5 ≥ 4.4 +10.2; sog_max ≥ 6 +8.1 | 55.1% | ✓ |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| sog_max ≥ 6 · rest ≥ 1 · opp_ga_l5_rk ≤ 20 | 38 | 66 | 74.2% | 182 | 47.3% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 11.1% | 11.6% | 8.5% | ✓ |
| 0–1 | 5+ | 876 | 8.8% | 9.2% | 8.7% | ✓ |
| 1–1.5 | 1–4 | 718 | 15.3% | 15.9% | 11.9% | ✓ |
| 1–1.5 | 5+ | 1193 | 14.6% | 15.1% | 14.4% | ✓ |
| 1.5–2 | 1–4 | 291 | 20.6% | 20.9% | 18.2% | ✓ |
| 1.5–2 | 5+ | 780 | 24.9% | 26.6% | 24.4% | ✓ |
| 2–2.5 | 1–4 | 364 | 23.6% | 24.5% | 13.8% | ✓ |
| 2–2.5 | 5+ | 463 | 32.4% | 24.0% | 34.7% | ✓ |
| 2.5–3 | 1–4 | 144 | 37.5% | 39.7% | 15.4% |  |
| 2.5–3 | 5+ | 274 | 44.2% | 40.6% | 45.2% | ✓ |
| 3–3.5 | 1–4 | 176 | 33.0% | 34.5% | 9.1% |  |
| 3–3.5 | 5+ | 195 | 48.7% | 51.0% | 47.9% | ✓ |
| 3.5+ | 1–4 | 173 | 41.6% | 42.0% | 25.0% |  |
| 3.5+ | 5+ | 118 | 55.9% | 50.0% | 58.1% | ✓ |

## 4+ SOG

Base rate 9.5% (624 of 6576); fit weeks 9.4%, check week 9.6%. The bar a pill must clear to be filled: 33.0% (about the price a book usually asks for the line). 105 rules found on the fit weeks (10+ hits on 107+ games, 12+ skaters, every condition worth two points); the check week kept **95% of their lift**; **100 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| toi_avg ≥ 18.88 · icf60 ≥ 19.648 | 46 | 112 | 38.4% | 83 | 44.6% | toi_avg ≥ 18.88 +16.1; icf60 ≥ 19.648 +25.8 | 42.1% | ✓ |
| iff_l5 ≥ 4.4 · toi_l5 ≥ 20.236 · opp_ga_l5_rk ≤ 26 | 49 | 117 | 40.2% | 114 | 36.8% | iff_l5 ≥ 4.4 +21.8; toi_l5 ≥ 20.236 +7.0; opp_ga_l5_rk ≤ 26 +5.0 | 37.3% | ✓ |
| iff_avg ≥ 4.409 · toi_l10 ≥ 18.88 · pt1_l5 ≤ 0.8 | 43 | 119 | 40.3% | 166 | 36.1% | iff_avg ≥ 4.409 +22.9; toi_l10 ≥ 18.88 +5.6; pt1_l5 ≤ 0.8 +3.2 | 36.7% | ✓ |
| iff_avg ≥ 4.409 · a_l3 ≥ 0.667 · team_gf_l5 ≤ 4.6 | 52 | 111 | 41.4% | 139 | 35.3% | iff_avg ≥ 4.409 +21.5; a_l3 ≥ 0.667 +7.2; team_gf_l5 ≤ 4.6 +2.3 | 36.3% | ✓ |
| icf_l5 ≥ 6 · s4_l5 ≥ 0.6 · opp_ga_l5_rk ≤ 29 | 56 | 109 | 40.4% | 78 | 34.6% | icf_l5 ≥ 6 +6.5; s4_l5 ≥ 0.6 +8.9; opp_ga_l5_rk ≤ 29 +3.4 | 36.1% | ✓ |
| iff_avg ≥ 4.409 · toi_l10 ≥ 18.88 · team_cf ≤ 66.5 | 50 | 137 | 39.4% | 176 | 35.2% | iff_avg ≥ 4.409 +21.5; toi_l10 ≥ 18.88 +4.3; team_cf ≤ 66.5 +2.3 | 35.7% | ✓ |
| icf_l10 ≥ 6 · s4_l5 ≥ 0.6 · team_gf_l5 ≤ 4.6 | 49 | 107 | 40.2% | 72 | 33.3% | icf_l10 ≥ 6 +6.0; s4_l5 ≥ 0.6 +8.2; team_gf_l5 ≤ 4.6 +2.4 | 35.3% | ✓ |
| iff_avg ≥ 4.409 · toi_l3 ≥ 20.257 | 52 | 139 | 34.5% | 134 | 35.8% | iff_avg ≥ 4.409 +19.8; toi_l3 ≥ 20.257 +5.5 | 35.3% | ✓ |
| iff_l5 ≥ 4.4 · toi_avg ≥ 20.246 · pace ≥ 51.85 | 48 | 110 | 40.0% | 140 | 34.3% | iff_l5 ≥ 4.4 +19.4; toi_avg ≥ 20.246 +6.3; pace ≥ 51.85 +3.0 | 35.2% | ✓ |
| iff_l5 ≥ 4.4 · a_l3 ≥ 0.667 · opp_hdca_rk ≤ 29 | 55 | 118 | 39.8% | 120 | 34.2% | iff_l5 ≥ 4.4 +20.4; a_l3 ≥ 0.667 +7.1; opp_hdca_rk ≤ 29 +2.1 | 35.2% | ✓ |
| iff_avg ≥ 4.409 · toi_l10 ≥ 18.88 · pace ≤ 55.75 | 50 | 118 | 39.8% | 132 | 34.1% | iff_avg ≥ 4.409 +21.1; toi_l10 ≥ 18.88 +5.3; pace ≤ 55.75 +2.1 | 35.1% | ✓ |
| iff_avg ≥ 4.409 · ven_toi ≥ 18.87 | 59 | 144 | 34.7% | 195 | 35.4% | iff_avg ≥ 4.409 +19.6; ven_toi ≥ 18.87 +5.4 | 35.1% | ✓ |
| icf_l5 ≥ 6 · s4_l5 ≥ 0.6 · b2b = 0 | 55 | 107 | 40.2% | 77 | 32.5% | icf_l5 ≥ 6 +5.7; s4_l5 ≥ 0.6 +8.6; b2b = 0 +2.4 | 34.6% | ✓ |
| fwd = 1 · icf_l5 ≥ 6 · s4_l5 ≥ 0.6 | 52 | 110 | 40.0% | 78 | 32.1% | fwd = 1 +2.1; icf_l5 ≥ 6 +5.5; s4_l5 ≥ 0.6 +7.4 | 34.2% | ✓ |
| sog_max ≥ 5 · ven_icf ≥ 6 · opp_slot_iscf_x ≤ 1.224 | 48 | 107 | 41.1% | 170 | 32.9% | sog_max ≥ 5 +8.4; ven_icf ≥ 6 +12.9; opp_slot_iscf_x ≤ 1.224 +3.0 | 34.2% | ✓ |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| icf_avg ≥ 6 · s4_l5 ≥ 0.667 | 57 | 112 | 34.8% | 20 | 10.0% |
| s4_l5 ≥ 0.667 | 76 | 139 | 28.8% | 25 | 8.0% |
| s4_l5 ≥ 0.75 | 75 | 120 | 28.3% | 24 | 8.3% |
| s4_l5 ≥ 0.8 | 75 | 111 | 27.9% | 23 | 8.7% |
| str_s3 ≥ 2 | 109 | 179 | 24.6% | 238 | 16.8% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 3.3% | 3.4% | 3.1% | ✓ |
| 0–1 | 5+ | 876 | 2.7% | 2.3% | 2.9% | ✓ |
| 1–1.5 | 1–4 | 718 | 5.7% | 6.2% | 3.0% | ✓ |
| 1–1.5 | 5+ | 1193 | 5.2% | 4.7% | 5.4% | ✓ |
| 1.5–2 | 1–4 | 291 | 10.0% | 10.5% | 6.1% | ✓ |
| 1.5–2 | 5+ | 780 | 10.4% | 13.6% | 9.5% | ✓ |
| 2–2.5 | 1–4 | 364 | 10.4% | 10.7% | 6.9% | ✓ |
| 2–2.5 | 5+ | 463 | 14.7% | 9.0% | 16.3% | ✓ |
| 2.5–3 | 1–4 | 144 | 17.4% | 18.3% | 7.7% |  |
| 2.5–3 | 5+ | 274 | 22.6% | 20.3% | 23.3% | ✓ |
| 3–3.5 | 1–4 | 176 | 13.6% | 14.5% | 0.0% |  |
| 3–3.5 | 5+ | 195 | 28.2% | 33.3% | 26.4% | ✓ |
| 3.5+ | 1–4 | 173 | 25.4% | 26.0% | 0.0% |  |
| 3.5+ | 5+ | 118 | 37.3% | 31.2% | 39.5% | ✓ |

## 5+ SOG

Base rate 4.0% (261 of 6576); fit weeks 3.9%, check week 4.0%. The bar a pill must clear to be filled: 20.0% (about the price a book usually asks for the line). 41 rules found on the fit weeks (10+ hits on 257+ games, 12+ skaters, every condition worth two points); the check week kept **100% of their lift**; **41 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iff_l5 ≥ 4.4 · icf_trend ≤ 1 | 116 | 317 | 15.5% | 114 | 22.8% | iff_l5 ≥ 4.4 +13.2; icf_trend ≤ 1 +2.3 | 20.9% | ✓ |
| iff_l10 ≥ 4.409 | 116 | 328 | 14.6% | 246 | 17.5% | — | 17.1% |  |
| icf60 ≥ 19.648 | 138 | 328 | 12.2% | 169 | 17.8% | — | 16.7% |  |
| icf_l10 ≥ 6 | 132 | 365 | 13.2% | 229 | 17.0% | — | 16.5% |  |
| iscf_avg ≥ 3.333 | 118 | 344 | 12.8% | 253 | 17.0% | — | 16.4% |  |
| ven_iff ≥ 4.667 | 132 | 276 | 13.4% | 228 | 16.7% | — | 16.2% |  |
| s3_rate ≥ 0.667 | 167 | 380 | 12.4% | 164 | 17.1% | — | 16.2% |  |
| sog_l10 ≥ 3 | 166 | 417 | 11.5% | 244 | 16.4% | — | 15.7% |  |
| s4_l10 ≥ 0.333 | 149 | 473 | 11.0% | 289 | 16.3% | — | 15.6% |  |
| ven_icf ≥ 6 | 158 | 363 | 11.8% | 266 | 16.2% | — | 15.6% |  |
| icf_l3 ≥ 6 | 151 | 389 | 11.3% | 282 | 14.9% | — | 14.5% |  |
| sog60 ≥ 10.471 | 137 | 328 | 11.3% | 161 | 14.9% | — | 14.2% |  |
| iff_l3 ≥ 4.5 | 132 | 329 | 13.1% | 272 | 14.0% | — | 13.9% |  |
| s3_l5 ≥ 0.75 | 151 | 284 | 11.6% | 150 | 13.3% | — | 13.0% |  |
| sog_l5 ≥ 3 | 169 | 417 | 11.0% | 281 | 13.2% | — | 12.9% |  |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 1.1% | 1.0% | 1.6% | ✓ |
| 0–1 | 5+ | 876 | 0.5% | 0.9% | 0.3% | ✓ |
| 1–1.5 | 1–4 | 718 | 1.5% | 1.5% | 2.0% | ✓ |
| 1–1.5 | 5+ | 1193 | 1.5% | 0.4% | 1.9% | ✓ |
| 1.5–2 | 1–4 | 291 | 4.5% | 4.3% | 6.1% | ✓ |
| 1.5–2 | 5+ | 780 | 4.4% | 6.2% | 3.8% | ✓ |
| 2–2.5 | 1–4 | 364 | 4.9% | 5.4% | 0.0% | ✓ |
| 2–2.5 | 5+ | 463 | 6.5% | 5.0% | 6.9% | ✓ |
| 2.5–3 | 1–4 | 144 | 8.3% | 8.4% | 7.7% |  |
| 2.5–3 | 5+ | 274 | 8.8% | 7.8% | 9.0% | ✓ |
| 3–3.5 | 1–4 | 176 | 5.7% | 6.1% | 0.0% |  |
| 3–3.5 | 5+ | 195 | 12.8% | 19.6% | 10.4% | ✓ |
| 3.5+ | 1–4 | 173 | 13.3% | 13.6% | 0.0% |  |
| 3.5+ | 5+ | 118 | 25.4% | 15.6% | 29.1% |  |

## 6+ SOG

Base rate 1.7% (115 of 6576); fit weeks 2.0%, check week 1.5%. The bar a pill must clear to be filled: 11.0% (about the price a book usually asks for the line). 40 rules found on the fit weeks (5+ hits on 513+ games, 12+ skaters, every condition worth two points); the check week kept **87% of their lift**; **38 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s2_rate ≥ 0.8 | 266 | 670 | 5.1% | 350 | 6.3% | — | 6.1% |  |
| ven_icf ≥ 5 | 234 | 593 | 5.7% | 536 | 5.8% | — | 5.7% |  |
| icf_avg ≥ 4.833 | 197 | 663 | 5.6% | 521 | 5.8% | — | 5.7% |  |
| sog_l10 ≥ 2.333 | 211 | 675 | 5.8% | 554 | 5.6% | — | 5.6% |  |
| s3_l10 ≥ 0.5 | 231 | 722 | 5.0% | 475 | 5.5% | — | 5.4% |  |
| iff_l10 ≥ 3.5 | 216 | 705 | 6.2% | 544 | 5.3% | — | 5.3% |  |
| ven_iff ≥ 3.667 | 239 | 545 | 6.2% | 547 | 5.3% | — | 5.3% |  |
| s4_l5 ≥ 0.25 | 172 | 582 | 5.5% | 391 | 5.1% | — | 5.1% |  |
| ven_sog ≥ 2.5 | 253 | 565 | 5.1% | 561 | 5.0% | — | 5.0% |  |
| iff_l3 ≥ 3.667 | 240 | 664 | 5.9% | 610 | 4.9% | — | 4.9% |  |
| icf60 ≥ 16.461 | 219 | 656 | 5.2% | 494 | 4.9% | — | 4.8% |  |
| iscf_avg ≥ 2.5 | 203 | 690 | 5.8% | 593 | 4.7% | — | 4.7% |  |
| icf_l3 ≥ 4.867 | 222 | 656 | 5.6% | 549 | 4.6% | — | 4.6% |  |
| s4_l10 ≥ 0.2 | 202 | 722 | 4.8% | 721 | 4.6% | — | 4.6% |  |
| iff_avg ≥ 3 | 301 | 1031 | 4.8% | 860 | 4.4% | — | 4.4% |  |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| str_s3 ≥ 1 | 361 | 697 | 4.9% | 722 | 2.2% |
| since_s3 ≤ 0 | 361 | 697 | 4.9% | 722 | 2.2% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 0.5% | 0.6% | 0.0% | ✓ |
| 0–1 | 5+ | 876 | 0.0% | 0.0% | 0.0% | ✓ |
| 1–1.5 | 1–4 | 718 | 0.3% | 0.3% | 0.0% | ✓ |
| 1–1.5 | 5+ | 1193 | 0.4% | 0.0% | 0.5% | ✓ |
| 1.5–2 | 1–4 | 291 | 1.7% | 1.6% | 3.0% | ✓ |
| 1.5–2 | 5+ | 780 | 2.1% | 4.0% | 1.5% | ✓ |
| 2–2.5 | 1–4 | 364 | 2.5% | 2.7% | 0.0% | ✓ |
| 2–2.5 | 5+ | 463 | 2.6% | 3.0% | 2.5% | ✓ |
| 2.5–3 | 1–4 | 144 | 4.2% | 4.6% | 0.0% |  |
| 2.5–3 | 5+ | 274 | 4.4% | 3.1% | 4.8% | ✓ |
| 3–3.5 | 1–4 | 176 | 4.0% | 4.2% | 0.0% |  |
| 3–3.5 | 5+ | 195 | 4.1% | 5.9% | 3.5% | ✓ |
| 3.5+ | 1–4 | 173 | 7.5% | 7.7% | 0.0% |  |
| 3.5+ | 5+ | 118 | 13.6% | 12.5% | 14.0% | ✓ |

## 1+ goal

Base rate 14.9% (978 of 6576); fit weeks 14.4%, check week 15.3%. The bar a pill must clear to be filled: 35.0% (about the price a book usually asks for the line). 117 rules found on the fit weeks (10+ hits on 70+ games, 12+ skaters, every condition worth two points); the check week kept **88% of their lift**; **113 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iscf_l10 ≥ 3.333 · sog_sd ≥ 1.414 · ven_s3 ≥ 1 | 38 | 70 | 48.6% | 41 | 51.2% | iscf_l10 ≥ 3.333 +16.8; sog_sd ≥ 1.414 +12.4; ven_s3 ≥ 1 +13.5 | 48.2% | ✓ |
| ven_iff ≥ 4.667 · opp_ga_l5_rk ≤ 16 · line ≤ 1 | 51 | 73 | 47.9% | 75 | 44.0% | ven_iff ≥ 4.667 +23.8; opp_ga_l5_rk ≤ 16 +6.2; line ≤ 1 +9.2 | 44.2% | ✓ |
| ven_iff ≥ 4.667 · opp_slot_sog_x ≤ 0.96 · line ≤ 1 | 47 | 73 | 47.9% | 64 | 43.8% | ven_iff ≥ 4.667 +24.6; opp_slot_sog_x ≤ 0.96 +6.3; line ≤ 1 +11.1 | 44.0% | ✓ |
| fwd = 1 · toi_l5 ≥ 20.236 · ven_iff ≥ 4.667 | 34 | 71 | 49.3% | 104 | 43.3% | fwd = 1 +7.1; toi_l5 ≥ 20.236 +10.3; ven_iff ≥ 4.667 +10.1 | 43.9% | ✓ |
| iscf_l5 ≥ 3.333 · sog_max ≥ 6 · ven_s3 ≥ 0.667 | 26 | 70 | 48.6% | 80 | 41.2% | iscf_l5 ≥ 3.333 +6.2; sog_max ≥ 6 +8.2; ven_s3 ≥ 0.667 +8.6 | 42.5% | ✓ |
| pts_avg ≥ 1 · ven_iff ≥ 4.667 · line ≤ 1 | 46 | 92 | 46.7% | 95 | 42.1% | pts_avg ≥ 1 +4.7; ven_iff ≥ 4.667 +16.9; line ≤ 1 +4.8 | 42.5% | ✓ |
| iff_avg ≥ 4.409 · sog_sd ≥ 1.414 · pt1_l5 ≥ 0.75 | 32 | 70 | 50.0% | 83 | 39.8% | iff_avg ≥ 4.409 +12.0; sog_sd ≥ 1.414 +7.2; pt1_l5 ≥ 0.75 +8.2 | 41.9% | ✓ |
| pts_avg ≥ 1 · sog_sd ≥ 1.169 · ven_iff ≥ 4.667 | 45 | 93 | 47.3% | 107 | 41.1% | pts_avg ≥ 1 +8.9; sog_sd ≥ 1.169 +4.4; ven_iff ≥ 4.667 +12.3 | 41.9% | ✓ |
| pts_l5 ≥ 1 · sog_sd ≥ 1.414 · ven_iff ≥ 4.667 | 44 | 86 | 47.7% | 98 | 40.8% | pts_l5 ≥ 1 +7.9; sog_sd ≥ 1.414 +5.4; ven_iff ≥ 4.667 +12.7 | 41.8% | ✓ |
| iff_avg ≥ 4.409 · pts_l5 ≥ 1 · sog_sd ≥ 1.414 | 42 | 98 | 46.9% | 133 | 40.6% | iff_avg ≥ 4.409 +12.0; pts_l5 ≥ 1 +7.0; sog_sd ≥ 1.414 +5.8 | 41.3% | ✓ |
| pts_avg ≥ 1 · ven_iff ≥ 4.667 · opp_sa_l5 ≥ 25 | 49 | 93 | 47.3% | 84 | 39.3% | pts_avg ≥ 1 +8.8; ven_iff ≥ 4.667 +17.4; opp_sa_l5 ≥ 25 +3.9 | 40.8% | ✓ |
| iscf_l10 ≥ 3.333 · toi_l3 ≥ 20.257 · team_cf_l5 ≤ 66.5 | 30 | 75 | 48.0% | 105 | 39.0% | iscf_l10 ≥ 3.333 +25.5; toi_l3 ≥ 20.257 +9.7; team_cf_l5 ≤ 66.5 +3.8 | 40.6% | ✓ |
| pts_avg ≥ 1 · ven_iff ≥ 4.667 · opp_slot_sog_x ≥ 0.733 | 53 | 94 | 46.8% | 105 | 39.0% | pts_avg ≥ 1 +7.8; ven_iff ≥ 4.667 +17.0; opp_slot_sog_x ≥ 0.733 +3.1 | 40.3% | ✓ |
| sog_sd ≥ 1.414 · pt1_l10 ≥ 0.667 · ven_iff ≥ 4.667 | 43 | 74 | 48.6% | 82 | 37.8% | sog_sd ≥ 1.414 +6.8; pt1_l10 ≥ 0.667 +6.8; ven_iff ≥ 4.667 +9.9 | 40.2% | ✓ |
| pts_avg ≥ 1 · ven_iff ≥ 4.667 | 70 | 144 | 38.9% | 121 | 40.5% | pts_avg ≥ 1 +6.7; ven_iff ≥ 4.667 +15.4 | 39.5% | ✓ |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| sog_max ≥ 6 · ven_pts ≥ 1 | 36 | 85 | 43.5% | 176 | 29.5% |
| sog_max ≥ 6 · ven_pts ≥ 0.667 | 39 | 93 | 40.9% | 235 | 28.5% |
| ven_iff ≥ 4.667 · team_sa ≤ 24.34 | 48 | 95 | 40.0% | 35 | 28.6% |
| str_s3 ≥ 2 | 109 | 179 | 28.5% | 238 | 18.9% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 6.9% | 7.8% | 2.3% | ✓ |
| 0–1 | 5+ | 876 | 8.0% | 7.8% | 8.1% | ✓ |
| 1–1.5 | 1–4 | 718 | 12.7% | 13.6% | 6.9% | ✓ |
| 1–1.5 | 5+ | 1193 | 13.3% | 15.4% | 12.7% | ✓ |
| 1.5–2 | 1–4 | 291 | 9.3% | 8.9% | 12.1% | ✓ |
| 1.5–2 | 5+ | 780 | 17.1% | 19.2% | 16.4% | ✓ |
| 2–2.5 | 1–4 | 364 | 13.2% | 14.0% | 3.4% |  |
| 2–2.5 | 5+ | 463 | 23.8% | 21.0% | 24.5% | ✓ |
| 2.5–3 | 1–4 | 144 | 25.0% | 26.0% | 15.4% |  |
| 2.5–3 | 5+ | 274 | 25.2% | 21.9% | 26.2% | ✓ |
| 3–3.5 | 1–4 | 176 | 19.3% | 20.6% | 0.0% |  |
| 3–3.5 | 5+ | 195 | 32.3% | 25.5% | 34.7% | ✓ |
| 3.5+ | 1–4 | 173 | 23.7% | 24.3% | 0.0% |  |
| 3.5+ | 5+ | 118 | 34.7% | 46.9% | 30.2% | ✓ |

## 2+ goals

Base rate 2.0% (133 of 6576); fit weeks 2.2%, check week 1.8%. The bar a pill must clear to be filled: 9.0% (about the price a book usually asks for the line). 41 rules found on the fit weeks (5+ hits on 456+ games, 12+ skaters, every condition worth two points); the check week kept **60% of their lift**; **39 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iscf_avg ≥ 2.5 | 203 | 690 | 6.8% | 593 | 5.4% | — | 5.4% |  |
| s4_l10 ≥ 0.333 | 149 | 473 | 7.0% | 289 | 5.2% | — | 5.2% |  |
| icf_l10 ≥ 4.833 | 197 | 663 | 6.0% | 512 | 5.1% | — | 5.0% |  |
| iff_l10 ≥ 3.5 | 216 | 705 | 6.0% | 544 | 5.0% | — | 4.9% |  |
| ven_iff ≥ 3.667 | 239 | 545 | 7.2% | 547 | 4.8% | — | 4.8% |  |
| ven_icf ≥ 5 | 234 | 593 | 6.4% | 536 | 4.7% | — | 4.7% |  |
| icf60 ≥ 16.461 | 219 | 656 | 5.8% | 494 | 4.7% | — | 4.6% |  |
| s3_l10 ≥ 0.5 | 231 | 722 | 5.4% | 475 | 4.6% | — | 4.6% |  |
| ven_s3 ≥ 0.5 | 281 | 667 | 5.8% | 634 | 4.6% | — | 4.6% |  |
| ven_sog ≥ 2.5 | 253 | 565 | 6.7% | 561 | 4.5% | — | 4.5% |  |
| ven_iscf ≥ 2.5 | 243 | 602 | 6.6% | 652 | 4.4% | — | 4.5% |  |
| iscf_l3 ≥ 2.5 | 233 | 695 | 6.0% | 640 | 4.4% | — | 4.4% |  |
| s4_rate ≥ 0.2 | 202 | 722 | 6.4% | 640 | 4.2% | — | 4.2% |  |
| sog_l10 ≥ 2.333 | 211 | 675 | 6.7% | 554 | 4.2% | — | 4.2% |  |
| iff_avg ≥ 3 | 301 | 1031 | 5.2% | 860 | 4.2% | — | 4.2% |  |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| s4_l5 ≥ 0.2 | 214 | 810 | 5.8% | 1101 | 2.9% |
| sog_max ≥ 4 | 214 | 837 | 5.7% | 1499 | 2.8% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 0.6% | 0.6% | 0.8% | ✓ |
| 0–1 | 5+ | 876 | 0.1% | 0.0% | 0.2% | ✓ |
| 1–1.5 | 1–4 | 718 | 1.0% | 0.8% | 2.0% | ✓ |
| 1–1.5 | 5+ | 1193 | 1.6% | 2.2% | 1.4% | ✓ |
| 1.5–2 | 1–4 | 291 | 1.0% | 1.2% | 0.0% | ✓ |
| 1.5–2 | 5+ | 780 | 1.7% | 0.6% | 2.0% | ✓ |
| 2–2.5 | 1–4 | 364 | 1.9% | 2.1% | 0.0% | ✓ |
| 2–2.5 | 5+ | 463 | 4.1% | 8.0% | 3.0% | ✓ |
| 2.5–3 | 1–4 | 144 | 6.9% | 7.6% | 0.0% |  |
| 2.5–3 | 5+ | 274 | 5.5% | 9.4% | 4.3% | ✓ |
| 3–3.5 | 1–4 | 176 | 2.8% | 3.0% | 0.0% |  |
| 3–3.5 | 5+ | 195 | 6.2% | 5.9% | 6.2% | ✓ |
| 3.5+ | 1–4 | 173 | 6.4% | 6.5% | 0.0% |  |
| 3.5+ | 5+ | 118 | 5.1% | 9.4% | 3.5% | ✓ |

## 3+ goals

Base rate 0.2% (15 of 6576); fit weeks 0.3%, check week 0.2%. The bar a pill must clear to be filled: 3.0% (about the price a book usually asks for the line). 0 rules found on the fit weeks (5+ hits on 3643+ games, 12+ skaters, every condition worth two points); the check week kept **0% of their lift**; **0 held**, 0 kept after near-duplicates.

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 811 | 0.0% | 0.0% | 0.0% | ✓ |
| 0–1 | 5+ | 876 | 0.0% | 0.0% | 0.0% | ✓ |
| 1–1.5 | 1–4 | 718 | 0.0% | 0.0% | 0.0% | ✓ |
| 1–1.5 | 5+ | 1193 | 0.2% | 0.0% | 0.2% | ✓ |
| 1.5–2 | 1–4 | 291 | 0.0% | 0.0% | 0.0% | ✓ |
| 1.5–2 | 5+ | 780 | 0.1% | 0.0% | 0.2% | ✓ |
| 2–2.5 | 1–4 | 364 | 0.3% | 0.3% | 0.0% | ✓ |
| 2–2.5 | 5+ | 463 | 0.9% | 2.0% | 0.6% | ✓ |
| 2.5–3 | 1–4 | 144 | 0.7% | 0.8% | 0.0% |  |
| 2.5–3 | 5+ | 274 | 0.7% | 1.6% | 0.5% | ✓ |
| 3–3.5 | 1–4 | 176 | 0.6% | 0.6% | 0.0% |  |
| 3–3.5 | 5+ | 195 | 0.5% | 2.0% | 0.0% | ✓ |
| 3.5+ | 1–4 | 173 | 0.6% | 0.6% | 0.0% |  |
| 3.5+ | 5+ | 118 | 0.8% | 3.1% | 0.0% | ✓ |

## The environment, his venue, his streaks: each read across its fifths

The hit rate in the bottom and top fifth of each read, the fifths taken within his position (a defenseman against defensemen; a slot read within the slot), overall and among skaters with 2+ shots a game this season, where the lines are bet; fit weeks and check week apart. The opponent’s reads are what it gives up per skater at his position, by window.

### 3+ SOG, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 10.1% (1178) | 42.0% (1181) | 10.3% (68) | 49.3% (743) | 10.6% (47) | 47.9% (328) | 9.5% (21) | 50.4% (415) |
| ven_iscf | 10.9% (1178) | 37.6% (1181) | 18.1% (83) | 45.8% (807) | 18.3% (71) | 42.4% (356) | — | 48.6% (451) |
| ven_icf | 10.7% (1178) | 41.4% (1181) | 23.1% (26) | 45.8% (930) | — | 42.7% (454) | — | 48.7% (476) |
| ven_s3 | 17.2% (1178) | 36.7% (1181) | 25.9% (193) | 42.5% (896) | 25.9% (193) | 39.3% (399) | — | 45.1% (497) |
| ven_iff | 11.8% (1178) | 39.6% (1181) | 30.3% (33) | 44.5% (921) | 30.8% (26) | 40.8% (453) | — | 48.1% (468) |
| opp_pos_ihdcf_l5 | 18.6% (1299) | 23.6% (1303) | 28.9% (401) | 41.3% (361) | 27.3% (275) | 35.6% (202) | 32.5% (126) | 48.4% (159) |
| ven_sog_x | 17.3% (1137) | 21.2% (1141) | 34.2% (193) | 46.5% (230) | 34.6% (107) | 44.2% (113) | 33.7% (86) | 48.7% (117) |
| ven_g1 | 18.8% (1178) | 31.4% (1181) | 30.2% (311) | 42.4% (625) | 30.2% (311) | 36.8% (299) | — | 47.5% (326) |
| ven_g | 18.8% (1178) | 31.8% (1181) | 30.2% (311) | 42.0% (640) | 30.2% (311) | 37.4% (286) | — | 45.8% (354) |
| ven_pts | 17.7% (1178) | 32.5% (1181) | 32.5% (243) | 44.1% (658) | 31.9% (238) | 41.5% (277) | — | 45.9% (381) |
| opp_slot_g | 19.2% (1294) | 23.0% (1306) | 29.9% (461) | 40.2% (376) | 29.8% (447) | 35.0% (220) | — | 47.4% (156) |
| opp_sca_l5 | 18.9% (1299) | 23.9% (1303) | 31.6% (389) | 41.7% (386) | 29.2% (243) | 38.3% (235) | 35.6% (146) | 47.0% (151) |
| opp_pos_ihdcf | 19.8% (1299) | 24.0% (1303) | 29.6% (423) | 39.6% (379) | 28.7% (310) | 35.3% (241) | 31.9% (113) | 47.1% (138) |
| opp_pos_ihdcf_l10 | 19.6% (1299) | 24.2% (1303) | 29.9% (425) | 39.6% (381) | 28.9% (311) | 35.2% (244) | 32.5% (114) | 47.4% (137) |
| opp_sa_l5 | 18.9% (1299) | 22.9% (1303) | 31.4% (392) | 40.7% (371) | 29.8% (255) | 36.7% (196) | 34.3% (137) | 45.1% (175) |
| opp_sca | 19.0% (1299) | 23.9% (1303) | 32.2% (395) | 41.5% (386) | 31.3% (262) | 38.9% (247) | 33.8% (133) | 46.0% (139) |
| opp_ca_l5 | 18.3% (1299) | 23.6% (1303) | 31.1% (373) | 40.4% (394) | 30.3% (228) | 37.6% (258) | 32.4% (145) | 45.6% (136) |
| opp_pos_ihdcf_l5_x | 18.8% (1299) | 22.9% (1303) | 29.2% (411) | 38.3% (363) | 27.4% (270) | 32.5% (228) | 32.6% (141) | 48.1% (135) |
| opp_ca_l10 | 18.5% (1299) | 24.0% (1303) | 31.3% (393) | 40.4% (399) | 31.6% (272) | 38.8% (273) | 30.6% (121) | 43.7% (126) |
| opp_ga_l5 | 19.6% (1299) | 21.9% (1303) | 29.9% (412) | 38.9% (391) | 26.9% (271) | 32.9% (240) | 35.5% (141) | 48.3% (151) |
| opp_pos_iscf | 19.2% (1299) | 24.0% (1303) | 30.6% (409) | 39.6% (402) | 30.0% (293) | 36.1% (280) | 31.9% (116) | 47.5% (122) |
| opp_fa_l10 | 17.7% (1299) | 22.8% (1303) | 30.4% (398) | 39.3% (384) | 30.1% (286) | 36.3% (251) | 31.2% (112) | 45.1% (133) |
| opp_sca_l10 | 19.2% (1299) | 23.9% (1303) | 32.2% (395) | 40.9% (396) | 31.0% (268) | 37.2% (261) | 34.6% (127) | 48.1% (135) |
| opp_fa_l5 | 18.6% (1299) | 22.7% (1303) | 31.4% (398) | 40.2% (381) | 30.0% (263) | 35.9% (248) | 34.1% (135) | 48.1% (133) |
| opp_pos_iff_l5 | 18.2% (1299) | 24.6% (1303) | 31.1% (389) | 39.8% (397) | 30.9% (269) | 35.3% (258) | 31.7% (120) | 48.2% (139) |

### 4+ SOG, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 3.6% (1178) | 22.6% (1181) | 7.4% (68) | 27.6% (743) | 6.4% (47) | 27.4% (328) | 9.5% (21) | 27.7% (415) |
| ven_iscf | 3.7% (1178) | 19.1% (1181) | 8.4% (83) | 24.7% (807) | 9.9% (71) | 21.6% (356) | — | 27.1% (451) |
| ven_sog | 4.2% (1178) | 19.9% (1181) | 12.5% (24) | 23.1% (960) | — | 20.8% (452) | — | 25.2% (508) |
| opp_sca_l5 | 7.3% (1299) | 12.0% (1303) | 14.7% (389) | 23.8% (386) | 14.4% (243) | 20.9% (235) | 15.1% (146) | 28.5% (151) |
| ven_sog_x | 7.1% (1137) | 9.4% (1141) | 16.6% (193) | 25.7% (230) | 18.7% (107) | 24.8% (113) | 14.0% (86) | 26.5% (117) |
| ven_icf | 3.3% (1178) | 21.2% (1181) | 15.4% (26) | 24.3% (930) | — | 22.7% (454) | — | 25.8% (476) |
| opp_sca | 7.5% (1299) | 12.0% (1303) | 15.2% (395) | 23.8% (386) | 16.0% (262) | 20.6% (247) | 13.5% (133) | 29.5% (139) |
| team_scf | 6.9% (1314) | 11.9% (1317) | 11.7% (248) | 20.3% (537) | 10.8% (186) | 19.4% (376) | 14.5% (62) | 22.4% (161) |
| opp_fa_l5 | 7.2% (1299) | 11.3% (1303) | 14.1% (398) | 22.6% (381) | 13.7% (263) | 19.8% (248) | 14.8% (135) | 27.8% (133) |
| ven_s3 | 7.6% (1178) | 18.4% (1181) | 14.0% (193) | 22.2% (896) | 14.0% (193) | 20.1% (399) | — | 23.9% (497) |
| opp_fa_l10 | 7.0% (1299) | 11.1% (1303) | 13.8% (398) | 21.9% (384) | 14.3% (286) | 19.1% (251) | 12.5% (112) | 27.1% (133) |
| opp_pos_ihdcf_l5 | 8.4% (1299) | 10.4% (1303) | 14.7% (401) | 22.7% (361) | 14.9% (275) | 17.3% (202) | 14.3% (126) | 29.6% (159) |
| opp_sca_l10 | 7.5% (1299) | 12.0% (1303) | 14.9% (395) | 22.7% (396) | 16.0% (268) | 19.5% (261) | 12.6% (127) | 28.9% (135) |
| opp_pos_sog_l5_x | 8.5% (1299) | 10.7% (1303) | 15.4% (377) | 22.9% (385) | 14.2% (240) | 21.6% (231) | 17.5% (137) | 24.7% (154) |
| opp_fa | 7.2% (1299) | 11.1% (1303) | 14.2% (400) | 21.7% (383) | 14.1% (283) | 19.1% (251) | 14.5% (117) | 26.5% (132) |
| opp_ca_l5 | 7.2% (1299) | 11.5% (1303) | 15.3% (373) | 22.6% (394) | 15.4% (228) | 20.2% (258) | 15.2% (145) | 27.2% (136) |
| opp_pos_iscf_l5_x | 7.6% (1299) | 11.4% (1303) | 14.8% (391) | 22.1% (385) | 13.7% (256) | 19.8% (257) | 17.0% (135) | 26.6% (128) |
| opp_pos_sog_l5 | 8.1% (1299) | 10.7% (1303) | 14.9% (377) | 22.0% (381) | 13.9% (245) | 21.5% (219) | 16.7% (132) | 22.8% (162) |
| opp_slot_g | 8.5% (1294) | 10.0% (1306) | 14.1% (461) | 21.3% (376) | 14.1% (447) | 20.0% (220) | — | 23.1% (156) |
| opp_pos_sog_l10 | 8.0% (1299) | 10.8% (1303) | 15.3% (391) | 22.5% (383) | 15.2% (276) | 21.7% (240) | 15.7% (115) | 23.8% (143) |
| opp_sa_l10 | 7.2% (1299) | 10.8% (1303) | 15.1% (391) | 22.2% (383) | 16.0% (287) | 19.0% (232) | 12.5% (104) | 27.2% (151) |
| team_scf_l5 | 7.2% (1314) | 12.3% (1317) | 13.8% (260) | 20.9% (530) | 9.9% (172) | 20.1% (348) | 21.6% (88) | 22.5% (182) |
| opp_sa_l5 | 7.6% (1299) | 11.1% (1303) | 15.1% (392) | 22.1% (371) | 14.5% (255) | 18.4% (196) | 16.1% (137) | 26.3% (175) |
| opp_pos_iff_l5 | 7.9% (1299) | 10.9% (1303) | 13.9% (389) | 20.9% (397) | 13.4% (269) | 19.8% (258) | 15.0% (120) | 23.0% (139) |
| ven_pts | 7.7% (1178) | 16.0% (1181) | 15.6% (243) | 22.6% (658) | 15.1% (238) | 21.7% (277) | — | 23.4% (381) |

### 5+ SOG, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 1.1% (1178) | 11.5% (1181) | 2.9% (68) | 14.8% (743) | 4.3% (47) | 15.5% (328) | 0.0% (21) | 14.2% (415) |
| ven_icf | 0.9% (1178) | 10.4% (1181) | 3.8% (26) | 11.8% (930) | — | 10.8% (454) | — | 12.8% (476) |
| ven_iscf | 1.4% (1178) | 9.2% (1181) | 6.0% (83) | 12.0% (807) | 7.0% (71) | 9.6% (356) | — | 14.0% (451) |
| ven_s3 | 2.5% (1178) | 9.3% (1181) | 6.2% (193) | 11.6% (896) | 6.2% (193) | 10.3% (399) | — | 12.7% (497) |
| opp_slot_g | 3.0% (1294) | 4.4% (1306) | 5.9% (461) | 10.6% (376) | 6.0% (447) | 10.5% (220) | — | 10.9% (156) |
| opp_slot_g_x | 3.0% (1294) | 4.3% (1306) | 5.9% (461) | 10.6% (377) | 6.0% (447) | 11.0% (236) | — | 9.9% (141) |
| team_ff_l5 | 2.3% (1314) | 5.2% (1317) | 4.9% (245) | 9.6% (520) | 5.0% (179) | 8.0% (337) | 4.5% (66) | 12.6% (183) |
| team_scf | 2.5% (1314) | 4.9% (1317) | 5.6% (248) | 9.9% (537) | 5.4% (186) | 9.6% (376) | 6.5% (62) | 10.6% (161) |
| team_scf_l5 | 2.6% (1314) | 4.9% (1317) | 5.8% (260) | 9.8% (530) | 4.7% (172) | 9.8% (348) | 8.0% (88) | 9.9% (182) |
| opp_pos_g | 3.1% (1299) | 4.9% (1303) | 6.2% (405) | 10.1% (398) | 6.3% (319) | 8.3% (254) | 5.8% (86) | 13.2% (144) |
| opp_pos_g_x | 3.3% (1299) | 5.2% (1303) | 6.8% (410) | 10.6% (396) | 6.2% (307) | 8.4% (249) | 8.7% (103) | 14.3% (147) |
| opp_ga | 3.5% (1299) | 4.8% (1303) | 7.5% (413) | 11.2% (385) | 7.4% (282) | 9.5% (263) | 7.6% (131) | 14.8% (122) |
| team_cf_l5 | 2.5% (1314) | 5.0% (1317) | 5.6% (269) | 9.1% (537) | 5.9% (187) | 8.5% (366) | 4.9% (82) | 10.5% (171) |
| opp_pos_g_l10 | 3.1% (1299) | 4.7% (1303) | 6.1% (408) | 9.6% (394) | 5.8% (311) | 8.4% (249) | 7.2% (97) | 11.7% (145) |
| opp_ga_l5 | 3.5% (1299) | 4.8% (1303) | 7.3% (412) | 10.7% (391) | 7.7% (271) | 9.2% (240) | 6.4% (141) | 13.2% (151) |
| opp_ga_l10 | 3.3% (1299) | 4.8% (1303) | 7.4% (417) | 10.9% (386) | 7.1% (297) | 9.0% (256) | 8.3% (120) | 14.6% (130) |
| team_sa | 5.0% (1314) | 2.7% (1317) | 9.9% (444) | 6.7% (330) | 10.4% (307) | 5.5% (217) | 8.8% (137) | 8.8% (113) |
| opp_pos_g_l10_x | 3.2% (1299) | 4.9% (1303) | 6.6% (407) | 9.9% (395) | 5.7% (299) | 8.4% (249) | 9.3% (108) | 12.3% (146) |
| ven_sog | 1.5% (1178) | 9.7% (1181) | 8.3% (24) | 11.6% (960) | — | 11.1% (452) | — | 12.0% (508) |
| opp_pos_g_l5_x | 3.3% (1299) | 4.7% (1303) | 7.5% (413) | 10.6% (377) | 6.3% (269) | 8.1% (210) | 9.7% (144) | 13.8% (167) |
| opp_pos_ihdcf_l5 | 3.5% (1299) | 4.3% (1303) | 7.7% (401) | 10.8% (361) | 8.4% (275) | 8.4% (202) | 6.3% (126) | 13.8% (159) |
| team_hdcf | 2.6% (1314) | 5.1% (1317) | 6.6% (256) | 9.7% (516) | 4.7% (172) | 8.6% (336) | 10.7% (84) | 11.7% (180) |
| opp_pos_iscf_l5_x | 2.9% (1299) | 4.2% (1303) | 6.9% (391) | 9.9% (385) | 6.6% (256) | 9.3% (257) | 7.4% (135) | 10.9% (128) |
| opp_pos_sog_l5_x | 3.6% (1299) | 4.5% (1303) | 8.2% (377) | 11.2% (385) | 7.9% (240) | 10.8% (231) | 8.8% (137) | 11.7% (154) |
| team_cf | 2.4% (1314) | 5.1% (1317) | 6.0% (250) | 8.8% (543) | 6.5% (201) | 9.3% (364) | 4.1% (49) | 7.8% (179) |

### 1+ goal, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 7.2% (1178) | 25.6% (1181) | 7.4% (68) | 31.8% (743) | 10.6% (47) | 30.5% (328) | 0.0% (21) | 32.8% (415) |
| ven_iscf | 8.6% (1178) | 22.9% (1181) | 14.5% (83) | 27.9% (807) | 15.5% (71) | 25.6% (356) | — | 29.7% (451) |
| ven_iff | 9.7% (1178) | 24.3% (1181) | 15.2% (33) | 27.0% (921) | 19.2% (26) | 25.2% (453) | — | 28.8% (468) |
| ven_icf | 8.7% (1178) | 24.0% (1181) | 15.4% (26) | 26.7% (930) | — | 24.4% (454) | — | 28.8% (476) |
| ven_sog_x | 12.5% (1137) | 15.6% (1141) | 23.8% (193) | 31.7% (230) | 27.1% (107) | 31.0% (113) | 19.8% (86) | 32.5% (117) |
| opp_pos_iff_l5 | 13.1% (1299) | 17.2% (1303) | 19.0% (389) | 25.7% (397) | 18.2% (269) | 24.0% (258) | 20.8% (120) | 28.8% (139) |
| opp_pos_iff_l5_x | 13.2% (1299) | 16.7% (1303) | 18.9% (381) | 25.4% (393) | 17.9% (257) | 24.0% (258) | 21.0% (124) | 28.1% (135) |
| opp_ca | 13.3% (1299) | 16.7% (1303) | 19.6% (393) | 25.8% (395) | 19.5% (267) | 24.0% (271) | 19.8% (126) | 29.8% (124) |
| ven_s3 | 13.4% (1178) | 22.4% (1181) | 20.2% (193) | 26.2% (896) | 20.2% (193) | 24.8% (399) | — | 27.4% (497) |
| opp_ca_l10 | 13.2% (1299) | 16.6% (1303) | 19.6% (393) | 25.3% (399) | 19.9% (272) | 23.8% (273) | 19.0% (121) | 28.6% (126) |
| ven_pts | 13.5% (1178) | 20.7% (1181) | 22.6% (243) | 27.4% (658) | 21.8% (238) | 26.0% (277) | — | 28.3% (381) |
| opp_pos_sog_l10 | 14.3% (1299) | 16.9% (1303) | 22.0% (391) | 26.4% (383) | 20.7% (276) | 23.3% (240) | 25.2% (115) | 31.5% (143) |
| team_gf_l5 | 15.0% (1314) | 14.1% (1317) | 25.4% (331) | 21.0% (447) | 23.4% (214) | 19.9% (281) | 29.1% (117) | 22.9% (166) |
| pace | 14.3% (1299) | 15.3% (1303) | 25.8% (337) | 21.5% (461) | 24.6% (264) | 20.1% (284) | 30.1% (73) | 23.7% (177) |
| ven_g | 14.9% (1178) | 19.6% (1181) | 22.5% (311) | 26.7% (640) | 22.5% (311) | 23.4% (286) | — | 29.4% (354) |
| opp_pos_icf_l5_x | 13.2% (1299) | 16.8% (1303) | 20.1% (393) | 24.3% (399) | 18.0% (261) | 22.6% (274) | 24.2% (132) | 28.0% (125) |
| opp_pos_iscf_l5 | 13.5% (1299) | 17.0% (1303) | 20.4% (393) | 24.5% (392) | 18.3% (263) | 21.6% (259) | 24.6% (130) | 30.1% (133) |
| team_hdcf_l5 | 13.9% (1314) | 16.6% (1317) | 20.7% (270) | 24.8% (505) | 19.8% (192) | 22.8% (311) | 23.1% (78) | 27.8% (194) |
| opp_pos_g_l5_x | 13.4% (1299) | 15.0% (1303) | 20.1% (413) | 23.9% (377) | 18.6% (269) | 21.4% (210) | 22.9% (144) | 26.9% (167) |
| team_hdcf | 13.5% (1314) | 16.5% (1317) | 20.3% (256) | 24.0% (516) | 19.8% (172) | 22.6% (336) | 21.4% (84) | 26.7% (180) |
| opp_pos_iff | 13.9% (1299) | 16.7% (1303) | 21.4% (401) | 25.1% (394) | 18.1% (288) | 23.2% (284) | 30.1% (113) | 30.0% (110) |
| opp_pos_icf_l5 | 12.6% (1299) | 16.2% (1303) | 19.7% (391) | 23.4% (394) | 17.2% (261) | 22.1% (263) | 24.6% (130) | 26.0% (131) |
| opp_fa_l10 | 13.5% (1299) | 16.0% (1303) | 21.1% (398) | 24.7% (384) | 19.6% (286) | 22.7% (251) | 25.0% (112) | 28.6% (133) |
| team_ff_l5 | 12.3% (1314) | 16.4% (1317) | 17.6% (245) | 21.2% (520) | 16.2% (179) | 18.7% (337) | 21.2% (66) | 25.7% (183) |
| team_gf | 14.5% (1314) | 14.7% (1317) | 24.1% (353) | 20.5% (459) | 22.4% (237) | 19.2% (297) | 27.6% (116) | 22.8% (162) |

### 2+ goals, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 0.5% (1178) | 5.7% (1181) | 0.0% (68) | 7.9% (743) | 0.0% (47) | 10.1% (328) | 0.0% (21) | 6.3% (415) |
| ven_icf | 0.8% (1178) | 5.2% (1181) | 0.0% (26) | 6.3% (930) | — | 7.7% (454) | — | 5.0% (476) |
| ven_sog_x | 1.4% (1137) | 2.8% (1141) | 4.1% (193) | 10.4% (230) | 6.5% (107) | 11.5% (113) | 1.2% (86) | 9.4% (117) |
| ven_iscf | 0.4% (1178) | 5.2% (1181) | 1.2% (83) | 7.3% (807) | 1.4% (71) | 8.7% (356) | — | 6.2% (451) |
| ven_sog | 0.6% (1178) | 4.6% (1181) | 0.0% (24) | 5.4% (960) | — | 6.2% (452) | — | 4.7% (508) |
| opp_slot_g | 1.2% (1294) | 2.8% (1306) | 2.4% (461) | 6.1% (376) | 2.5% (447) | 6.4% (220) | — | 5.8% (156) |
| opp_slot_g_x | 1.2% (1294) | 2.8% (1306) | 2.4% (461) | 6.1% (377) | 2.5% (447) | 5.9% (236) | — | 6.4% (141) |
| ven_iff | 0.6% (1178) | 5.3% (1181) | 3.0% (33) | 6.4% (921) | 3.8% (26) | 7.5% (453) | — | 5.3% (468) |
| ven_s3 | 1.1% (1178) | 5.0% (1181) | 3.1% (193) | 6.4% (896) | 3.1% (193) | 7.3% (399) | — | 5.6% (497) |
| opp_pos_iff_l5_x | 0.8% (1299) | 3.1% (1303) | 2.1% (381) | 5.3% (393) | 1.9% (257) | 5.8% (258) | 2.4% (124) | 4.4% (135) |
| opp_pos_iff_l5 | 0.8% (1299) | 3.0% (1303) | 2.1% (389) | 5.3% (397) | 2.2% (269) | 5.8% (258) | 1.7% (120) | 4.3% (139) |
| opp_slot_icf_x | 1.5% (1294) | 2.9% (1306) | 3.5% (397) | 6.5% (400) | 4.2% (288) | 7.1% (283) | 1.8% (109) | 5.1% (117) |
| opp_pos_iff_ven_x | 1.3% (1197) | 2.5% (1200) | 2.8% (361) | 5.6% (340) | 2.6% (233) | 6.4% (203) | 3.1% (128) | 4.4% (137) |
| opp_slot_icf | 1.6% (1294) | 2.8% (1306) | 3.7% (403) | 6.3% (394) | 4.4% (298) | 6.9% (277) | 1.9% (105) | 5.1% (117) |
| opp_pos_iscf_l5 | 0.9% (1299) | 3.0% (1303) | 2.3% (393) | 4.8% (392) | 2.7% (263) | 5.4% (259) | 1.5% (130) | 3.8% (133) |
| opp_slot_sog_x | 1.5% (1294) | 2.8% (1306) | 4.0% (399) | 6.4% (389) | 4.3% (300) | 6.9% (275) | 3.0% (99) | 5.3% (114) |
| opp_slot_sog | 1.5% (1294) | 2.8% (1306) | 3.8% (395) | 6.2% (387) | 4.2% (306) | 6.7% (269) | 2.2% (89) | 5.1% (118) |
| opp_pos_icf_l5_x | 0.9% (1299) | 2.5% (1303) | 2.3% (393) | 4.5% (399) | 2.3% (261) | 5.5% (274) | 2.3% (132) | 2.4% (125) |
| team_sf | 1.9% (1314) | 2.6% (1317) | 5.8% (224) | 3.7% (543) | 5.2% (153) | 5.1% (331) | 7.0% (71) | 1.4% (212) |
| opp_pos_iscf_l5_x | 1.0% (1299) | 2.9% (1303) | 2.6% (391) | 4.7% (385) | 3.1% (256) | 5.4% (257) | 1.5% (135) | 3.1% (128) |
| opp_pos_iscf | 1.3% (1299) | 3.2% (1303) | 3.2% (409) | 5.2% (402) | 3.1% (293) | 5.4% (280) | 3.4% (116) | 4.9% (122) |
| opp_pos_icf_l5 | 0.9% (1299) | 2.5% (1303) | 2.3% (391) | 4.3% (394) | 2.3% (261) | 5.7% (263) | 2.3% (130) | 1.5% (131) |
| opp_pos_iff_ven | 1.4% (1197) | 2.4% (1200) | 3.3% (365) | 5.3% (340) | 3.3% (242) | 6.2% (195) | 3.3% (123) | 4.1% (145) |
| opp_pos_sog_l10 | 1.6% (1299) | 3.1% (1303) | 4.1% (391) | 6.0% (383) | 4.0% (276) | 6.2% (240) | 4.3% (115) | 5.6% (143) |
| team_sf_l5 | 1.8% (1314) | 2.4% (1317) | 5.9% (222) | 4.0% (525) | 5.1% (156) | 5.4% (315) | 7.6% (66) | 1.9% (210) |

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
| C1 | 372 | 37.9% | 21.2% | 10.2% | 6.5% | 29.6% | 4.3% | 0.0% | fwd = 1 · toi_l5 ≥ 18.91 · sog_max ≥ 6: 58.0% of 81 | iff_avg ≥ 4.409 · pts_l5 ≥ 1 · sog_sd ≥ 1.414: 47.2% of 72 |
| LW1 | 372 | 45.7% | 21.5% | 9.9% | 4.0% | 25.0% | 5.1% | 0.8% | iff_l5 ≥ 4.4 · sog_max ≥ 6: 74.6% of 59 | fwd = 1 · toi_l5 ≥ 20.236 · ven_iff ≥ 4.667: 47.7% of 44 |
| RW1 | 374 | 42.8% | 22.2% | 10.4% | 4.3% | 32.1% | 7.5% | 0.8% | iscf_l10 ≥ 3.333 · sog_max ≥ 6: 55.8% of 43 | pts_avg ≥ 1 · ven_iff ≥ 4.667 · line ≤ 1: 46.7% of 45 |
| C2 | 373 | 28.4% | 14.7% | 7.8% | 2.7% | 22.3% | 2.4% | 0.3% | iscf_l10 ≥ 3.333 · sog_max ≥ 6: 59.3% of 27 | pts_avg ≥ 1 · ven_iff ≥ 4.667: 34.6% of 26 |
| LW2 | 371 | 28.6% | 14.8% | 6.2% | 3.5% | 21.6% | 3.0% | 1.1% | iff_l5 ≥ 4.4 · sog_max ≥ 6: 56.0% of 25 | iff_avg ≥ 4.409 · pts_l5 ≥ 1 · sog_sd ≥ 1.414: 47.4% of 19 |
| RW2 | 370 | 30.5% | 11.1% | 4.6% | 2.2% | 18.1% | 2.7% | 0.3% | iscf_l10 ≥ 3.333 · sog_max ≥ 6: 50.0% of 32 | iscf_l5 ≥ 3.333 · sog_max ≥ 6 · ven_s3 ≥ 0.667: 23.5% of 17 |
| C3 | 371 | 18.3% | 8.4% | 3.8% | 1.3% | 16.2% | 1.3% | 0.0% | — | — |
| LW3 | 361 | 17.7% | 7.2% | 2.8% | 0.8% | 13.0% | 1.9% | 0.0% | — | — |
| RW3 | 359 | 16.4% | 5.3% | 1.7% | 0.6% | 15.9% | 2.2% | 0.6% | — | — |
| C4 | 359 | 11.4% | 4.5% | 0.6% | 0.0% | 10.9% | 0.6% | 0.0% | — | — |
| LW4 | 342 | 7.6% | 2.0% | 1.5% | 0.3% | 9.4% | 1.2% | 0.0% | — | — |
| RW4 | 331 | 8.5% | 2.7% | 0.0% | 0.0% | 11.5% | 1.2% | 0.3% | — | — |
| D1 | 746 | 25.9% | 11.0% | 3.9% | 2.0% | 8.7% | 0.7% | 0.0% | iff_l5 ≥ 4.4 · ven_toi ≥ 20.357: 51.0% of 51 | pts_avg ≥ 1 · ven_iff ≥ 4.667 · line ≤ 1: 30.0% of 30 |
| D2 | 745 | 11.7% | 3.6% | 1.3% | 0.4% | 6.4% | 0.5% | 0.0% | — | — |
| D3 | 730 | 6.2% | 1.9% | 0.3% | 0.0% | 5.3% | 0.1% | 0.0% | — | — |

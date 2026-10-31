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
  on **Oct 16–29** (3,370 skater-games, two weeks the search never saw; Vincent, 2026-10-30: "expand to October 16
  through October 29" — the first cut checked on Oct 23–29 alone).
- **The pill's figure** is honest about the search: the fit weeks' lift, cut to the share of it the check weeks kept
  over every rule found, then updated by the rule's own check weeks. On the site each rule's rate keeps moving with the
  games after Oct 29, and those games are the record.

## What the season says, line by line

| Line | Happens | Rules found → held | Lift kept on the weeks they never saw | Filled pills come from |
| --- | --- | --- | --- | --- |
| 3+ SOG | 21.5% | 99 → 98 | 90% | 15 rules at 55–63%: a 6+ shot game already this season, 18–20+ minutes lately or at tonight's venue, chances at tonight's venue; the 3.5+ shots-a-game tier (5+ games) at 56%, 3–3.5 at 50% |
| 4+ SOG | 9.6% | 107 → 103 | 99% | 15 rules at 36–44%: 18.9+ minutes a game with 19.6+ attempts per 60 (44%), 4.4+ unblocked attempts a game with his minutes; the 3.5+ tier at 39% |
| 5+ SOG | 4.0% | 41 → 41 | 100% | one rule: 4.4+ unblocked attempts a game over his last five, his attempts not running above his season, the opponent under 1.5× the league's attempts to his slot (23%) |
| 6+ SOG | 1.8% | 41 → 39 | 94% | no rule clears 11%; the 3.5+ shots-a-game tier (5+ games), 14% |
| 1+ goal | 15.0% | 117 → 112 | 90% | 15 rules at 40–49%: his volume **at tonight's venue** (4.7+ unblocked attempts a game there), first-line minutes, a point a game |
| 2+ goals | 2.0% | 41 → 39 | 66% | none clears 9%: the best, 2.5+ chances a game, 6% |
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
   (24% → 31% among 2+ shots-a-game skaters, 21% → 32% on the check weeks).
4. **The opponent's attempts, chances and shots allowed: real, and sharper as the tables fill.** Among skaters with 2+
   shots a game, the opponent's bottom fifth against its top fifth (ranked within his position) moves 3+ SOG by 6–8
   points on Oct 1–15 and by 11–14 points on Oct 16–29, when every table has a few more games behind it:
   - high-danger chances allowed to his position over the last five: 34% → 47% on Oct 16–29;
   - chances against a game over its last five (SCA L5): 36% → 47%;
   - attempts against (CA L5 / L10, FA L10): 31–32% → 43–45%;
   - goals against over its last five: 36% → 49%.

   For 1+ goal the same reads move it 5–10 points (unblocked attempts allowed to his position L5: 22% → 30% on the check weeks). Inside a
   rule, on top of his volume, they add 2–6 points when they survive the two-point cut: his own numbers still decide.
5. **Streaks are colour, mostly.** Inside his shot tier the 3+ SOG run he comes in on moves 3+ SOG by a few points with
   no steady direction. A **point streak** is the one that leans: 3+ shots a game and a point in 3+ straight, 56% on
   3+ SOG against 40% with none; points a game and a point in four of his last five also appear in the goal rules.

Caveats: four weeks of one season, 6,648 skater-games (all 148 games; the first cut missed two of Oct 29's, pulled before they were final), fitted on the first two and checked on the last two. Enough for
3+ / 4+ SOG and 1+ goal; the rare lines' rules held in direction, but under the bars (5+ SOG has one rule over 20%).
"Line" in the study is the skater's ice-time rank in the game; the site reads the beat writers' lineups. The check
weeks decided which rules were kept, so they are not a clean test of the kept set; the site's record (games after
Oct 29) is. No book prices: a filled pill says the rate clears about what a book asks for the line, not that tonight's
price pays. How the picks did night by night over the whole season, against a model on every figure and the hindsight
ceiling: `docs/audits/2026-10-30-nhl-season-backtest.md`.

## The tables

6648 skater-games, 239 figures each (158 searched: the opponent’s reads at his position and slot as × the league’s and as ranks), cut into 2308 conditions. Rules searched on 2026-10-02 to 2026-10-15 (3278 skater-games) and checked on 2026-10-16 to 2026-10-29 (3370 skater-games the search never saw).

| Line | Base | Rules found | Lift kept on the check week | Held | Kept | Fill the pill | The strongest that held |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3+ SOG | 21.5% | 99 | 90% | 98 | 15 | 15 | toi_l5 ≥ 17.619 · sog_max ≥ 6 · ven_iscf ≥ 3.5 (fit 71.0% on 62, check 62.0% on 100; pill 63.3%) |
| 4+ SOG | 9.6% | 107 | 99% | 103 | 15 | 15 | toi_avg ≥ 18.88 · icf60 ≥ 19.648 (fit 38.4% on 112, check 46.4% on 84; pill 43.9%) |
| 5+ SOG | 4.0% | 41 | 100% | 41 | 15 | 1 | iff_l5 ≥ 4.4 · icf_trend ≤ 1 · opp_slot_icf_x ≤ 1.511 (fit 17.8% on 269, check 24.6% on 118; pill 22.9%) |
| 6+ SOG | 1.8% | 41 | 94% | 39 | 15 | 0 | s2_rate ≥ 0.8 (fit 5.1% on 670, check 7.0% on 355; pill 6.8%) |
| 1+ goal | 15.0% | 117 | 90% | 112 | 15 | 15 | iscf_l10 ≥ 3.333 · sog_sd ≥ 1.414 · ven_s3 ≥ 1 (fit 48.6% on 70, check 51.2% on 41; pill 48.5%) |
| 2+ goals | 2.0% | 41 | 66% | 39 | 15 | 0 | iscf_avg ≥ 2.5 (fit 6.8% on 690, check 5.8% on 607; pill 5.7%) |
| 3+ goals | 0.2% | 0 | 0% | 0 | 0 | 0 | — |

## 3+ SOG

Base rate 21.5% (1426 of 6648); fit weeks 21.2%, check week 21.7%. The bar a pill must clear to be filled: 50.0% (about the price a book usually asks for the line). 99 rules found on the fit weeks (10+ hits on 60+ games, 12+ skaters, every condition worth two points); the check week kept **90% of their lift**; **98 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| toi_l5 ≥ 17.619 · sog_max ≥ 6 · ven_iscf ≥ 3.5 | 26 | 62 | 71.0% | 100 | 62.0% | toi_l5 ≥ 17.619 +8.1; sog_max ≥ 6 +13.7; ven_iscf ≥ 3.5 +11.3 | 63.3% | ✓ |
| ihdcf_l3 ≥ 1 · toi_l5 ≥ 18.91 · sog_max ≥ 6 | 24 | 61 | 73.8% | 123 | 61.0% | ihdcf_l3 ≥ 1 +8.4; toi_l5 ≥ 18.91 +14.5; sog_max ≥ 6 +19.4 | 63.0% | ✓ |
| fwd = 1 · sog_max ≥ 6 · ven_toi ≥ 18.87 | 26 | 65 | 72.3% | 158 | 59.5% | fwd = 1 +5.8; sog_max ≥ 6 +14.7; ven_toi ≥ 18.87 +15.3 | 61.2% | ✓ |
| iscf_avg ≥ 3.333 · ven_toi ≥ 20.357 | 32 | 74 | 63.5% | 105 | 60.0% | iscf_avg ≥ 3.333 +28.8; ven_toi ≥ 20.357 +12.4 | 59.9% | ✓ |
| a_l5 ≥ 1 · sog_max ≥ 5 | 26 | 63 | 63.5% | 72 | 59.7% | a_l5 ≥ 1 +19.9; sog_max ≥ 5 +26.8 | 59.7% | ✓ |
| iscf_l10 ≥ 3.333 · sog_max ≥ 6 | 35 | 108 | 59.3% | 147 | 60.5% | iscf_l10 ≥ 3.333 +13.3; sog_max ≥ 6 +10.4 | 59.6% | ✓ |
| sog_max ≥ 6 · ven_toi ≥ 18.87 · opp_ga_l5_rk ≤ 26 | 30 | 61 | 72.1% | 167 | 57.5% | sog_max ≥ 6 +28.2; ven_toi ≥ 18.87 +10.9; opp_ga_l5_rk ≤ 26 +4.0 | 59.4% | ✓ |
| toi_l5 ≥ 18.91 · blk_l5 ≤ 1 · sog_max ≥ 6 | 28 | 68 | 70.6% | 165 | 57.6% | toi_l5 ≥ 18.91 +14.0; blk_l5 ≤ 1 +4.6; sog_max ≥ 6 +23.9 | 59.2% | ✓ |
| ihdcf_l5 ≥ 0.6 · toi_l10 ≥ 18.88 · sog_max ≥ 6 | 25 | 68 | 70.6% | 160 | 57.5% | ihdcf_l5 ≥ 0.6 +4.9; toi_l10 ≥ 18.88 +13.6; sog_max ≥ 6 +16.5 | 59.2% | ✓ |
| sog_max ≥ 6 · ven_iscf ≥ 3.5 · opp_ga_l5_rk ≤ 26 | 26 | 60 | 71.7% | 101 | 55.4% | sog_max ≥ 6 +14.1; ven_iscf ≥ 3.5 +11.0; opp_ga_l5_rk ≤ 26 +4.1 | 58.8% | ✓ |
| toi_l3 ≥ 20.257 · sog_max ≥ 6 | 22 | 65 | 64.6% | 151 | 57.0% | toi_l3 ≥ 20.257 +12.6; sog_max ≥ 6 +27.9 | 57.7% | ✓ |
| a_avg ≥ 1 · sog_max ≥ 5 | 26 | 63 | 63.5% | 69 | 56.5% | a_avg ≥ 1 +18.2; sog_max ≥ 5 +26.4 | 57.7% | ✓ |
| iff_l5 ≥ 4.4 · ven_toi ≥ 20.357 | 49 | 102 | 59.8% | 146 | 56.8% | iff_l5 ≥ 4.4 +25.4; ven_toi ≥ 20.357 +8.9 | 56.8% | ✓ |
| iff_l5 ≥ 4.4 · sog_max ≥ 6 | 39 | 115 | 59.1% | 179 | 56.4% | iff_l5 ≥ 4.4 +10.8; sog_max ≥ 6 +8.3 | 56.3% | ✓ |
| icf_l10 ≥ 6 | 132 | 365 | 45.5% | 233 | 57.5% | — | 55.4% | ✓ |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| sog_max ≥ 6 · rest ≥ 1 · opp_ga_l5_rk ≤ 20 | 38 | 66 | 74.2% | 190 | 47.4% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 816 | 11.0% | 11.6% | 8.2% | ✓ |
| 0–1 | 5+ | 891 | 8.8% | 9.2% | 8.6% | ✓ |
| 1–1.5 | 1–4 | 718 | 15.3% | 15.9% | 11.9% | ✓ |
| 1–1.5 | 5+ | 1218 | 14.6% | 15.1% | 14.5% | ✓ |
| 1.5–2 | 1–4 | 291 | 20.6% | 20.9% | 18.2% | ✓ |
| 1.5–2 | 5+ | 786 | 24.9% | 26.6% | 24.5% | ✓ |
| 2–2.5 | 1–4 | 365 | 23.6% | 24.5% | 13.3% | ✓ |
| 2–2.5 | 5+ | 476 | 32.8% | 24.0% | 35.1% | ✓ |
| 2.5–3 | 1–4 | 144 | 37.5% | 39.7% | 15.4% |  |
| 2.5–3 | 5+ | 275 | 44.0% | 40.6% | 45.0% | ✓ |
| 3–3.5 | 1–4 | 177 | 32.8% | 34.5% | 8.3% |  |
| 3–3.5 | 5+ | 199 | 50.3% | 51.0% | 50.0% | ✓ |
| 3.5+ | 1–4 | 173 | 41.6% | 42.0% | 25.0% |  |
| 3.5+ | 5+ | 119 | 56.3% | 50.0% | 58.6% | ✓ |

## 4+ SOG

Base rate 9.6% (637 of 6648); fit weeks 9.4%, check week 9.8%. The bar a pill must clear to be filled: 33.0% (about the price a book usually asks for the line). 107 rules found on the fit weeks (10+ hits on 107+ games, 12+ skaters, every condition worth two points); the check week kept **99% of their lift**; **103 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| toi_avg ≥ 18.88 · icf60 ≥ 19.648 | 46 | 112 | 38.4% | 84 | 46.4% | toi_avg ≥ 18.88 +16.4; icf60 ≥ 19.648 +26.3 | 43.9% | ✓ |
| iff_l5 ≥ 4.4 · toi_l5 ≥ 20.236 · opp_ga_l5_rk ≤ 26 | 49 | 117 | 40.2% | 115 | 38.3% | iff_l5 ≥ 4.4 +22.3; toi_l5 ≥ 20.236 +6.8; opp_ga_l5_rk ≤ 26 +5.1 | 38.8% | ✓ |
| iff_avg ≥ 4.409 · toi_l10 ≥ 18.88 · pt1_l5 ≤ 0.8 | 43 | 119 | 40.3% | 169 | 37.9% | iff_avg ≥ 4.409 +23.6; toi_l10 ≥ 18.88 +5.7; pt1_l5 ≤ 0.8 +3.4 | 38.4% | ✓ |
| icf_l5 ≥ 6 · s4_l5 ≥ 0.6 · opp_ga_l5_rk ≤ 29 | 56 | 109 | 40.4% | 80 | 36.2% | icf_l5 ≥ 6 +6.0; s4_l5 ≥ 0.6 +9.1; opp_ga_l5_rk ≤ 29 +3.4 | 37.6% | ✓ |
| icf_l10 ≥ 6 · s4_l5 ≥ 0.6 · team_gf_l5 ≤ 4.6 | 49 | 107 | 40.2% | 75 | 36.0% | icf_l10 ≥ 6 +6.0; s4_l5 ≥ 0.6 +8.5; team_gf_l5 ≤ 4.6 +2.5 | 37.5% | ✓ |
| iff_avg ≥ 4.409 · toi_l5 ≥ 18.91 · team_cf ≤ 66.5 | 51 | 138 | 39.1% | 176 | 36.9% | iff_avg ≥ 4.409 +22.6; toi_l5 ≥ 18.91 +4.3; team_cf ≤ 66.5 +2.6 | 37.3% | ✓ |
| iff_avg ≥ 4.409 · toi_l10 ≥ 18.88 · pace ≤ 55.75 | 50 | 118 | 39.8% | 135 | 36.3% | iff_avg ≥ 4.409 +21.9; toi_l10 ≥ 18.88 +5.4; pace ≤ 55.75 +2.5 | 37.1% | ✓ |
| iff_avg ≥ 4.409 · a_l3 ≥ 0.667 · team_gf_l5 ≤ 4.6 | 52 | 111 | 41.4% | 140 | 35.7% | iff_avg ≥ 4.409 +21.6; a_l3 ≥ 0.667 +6.7; team_gf_l5 ≤ 4.6 +2.3 | 37.0% | ✓ |
| iff_avg ≥ 4.409 · a_l3 ≥ 0.667 · opp_hdca_l10_rk ≤ 29 | 53 | 117 | 40.2% | 128 | 35.9% | iff_avg ≥ 4.409 +21.3; a_l3 ≥ 0.667 +6.3; opp_hdca_l10_rk ≤ 29 +2.0 | 37.0% | ✓ |
| iff_l5 ≥ 4.4 · toi_avg ≥ 20.246 · pace ≥ 51.85 | 48 | 110 | 40.0% | 142 | 35.9% | iff_l5 ≥ 4.4 +20.1; toi_avg ≥ 20.246 +6.4; pace ≥ 51.85 +3.1 | 36.8% | ✓ |
| iff_avg ≥ 4.409 · ven_toi ≥ 18.87 | 59 | 144 | 34.7% | 199 | 37.2% | iff_avg ≥ 4.409 +20.3; ven_toi ≥ 18.87 +5.8 | 36.8% | ✓ |
| iff_avg ≥ 4.409 · toi_l3 ≥ 20.257 | 52 | 139 | 34.5% | 135 | 37.0% | iff_avg ≥ 4.409 +20.3; toi_l3 ≥ 20.257 +5.4 | 36.5% | ✓ |
| icf_l5 ≥ 6 · s4_l5 ≥ 0.6 · b2b = 0 | 55 | 107 | 40.2% | 79 | 34.2% | icf_l5 ≥ 6 +5.2; s4_l5 ≥ 0.6 +8.8; b2b = 0 +2.4 | 36.2% | ✓ |
| iff_l5 ≥ 4.4 · a_l3 ≥ 0.667 · opp_hdca_rk ≤ 29 | 55 | 118 | 39.8% | 121 | 34.7% | iff_l5 ≥ 4.4 +20.6; a_l3 ≥ 0.667 +6.7; opp_hdca_rk ≤ 29 +2.1 | 36.0% | ✓ |
| fwd = 1 · icf_l5 ≥ 6 · s4_l5 ≥ 0.6 | 52 | 110 | 40.0% | 80 | 33.8% | fwd = 1 +2.2; icf_l5 ≥ 6 +5.3; s4_l5 ≥ 0.6 +7.4 | 35.9% | ✓ |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| icf_avg ≥ 6 · s4_l5 ≥ 0.667 | 57 | 112 | 34.8% | 20 | 10.0% |
| s4_l5 ≥ 0.667 | 76 | 139 | 28.8% | 25 | 8.0% |
| s4_l5 ≥ 0.75 | 75 | 120 | 28.3% | 24 | 8.3% |
| s4_l5 ≥ 0.8 | 75 | 111 | 27.9% | 23 | 8.7% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 816 | 3.3% | 3.4% | 3.0% | ✓ |
| 0–1 | 5+ | 891 | 2.7% | 2.3% | 2.8% | ✓ |
| 1–1.5 | 1–4 | 718 | 5.7% | 6.2% | 3.0% | ✓ |
| 1–1.5 | 5+ | 1218 | 5.3% | 4.7% | 5.4% | ✓ |
| 1.5–2 | 1–4 | 291 | 10.0% | 10.5% | 6.1% | ✓ |
| 1.5–2 | 5+ | 786 | 10.4% | 13.6% | 9.5% | ✓ |
| 2–2.5 | 1–4 | 365 | 10.4% | 10.7% | 6.7% | ✓ |
| 2–2.5 | 5+ | 476 | 14.9% | 9.0% | 16.5% | ✓ |
| 2.5–3 | 1–4 | 144 | 17.4% | 18.3% | 7.7% |  |
| 2.5–3 | 5+ | 275 | 22.9% | 20.3% | 23.7% | ✓ |
| 3–3.5 | 1–4 | 177 | 13.6% | 14.5% | 0.0% |  |
| 3–3.5 | 5+ | 199 | 29.6% | 33.3% | 28.4% | ✓ |
| 3.5+ | 1–4 | 173 | 25.4% | 26.0% | 0.0% |  |
| 3.5+ | 5+ | 119 | 38.7% | 31.2% | 41.4% | ✓ |

## 5+ SOG

Base rate 4.0% (268 of 6648); fit weeks 3.9%, check week 4.2%. The bar a pill must clear to be filled: 20.0% (about the price a book usually asks for the line). 41 rules found on the fit weeks (10+ hits on 257+ games, 12+ skaters, every condition worth two points); the check week kept **100% of their lift**; **41 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iff_l5 ≥ 4.4 · icf_trend ≤ 1 · opp_slot_icf_x ≤ 1.511 | 105 | 269 | 17.8% | 118 | 24.6% | iff_l5 ≥ 4.4 +15.5; icf_trend ≤ 1 +3.3; opp_slot_icf_x ≤ 1.511 +2.0 | 22.9% | ✓ |
| iff_l10 ≥ 4.409 | 116 | 328 | 14.6% | 249 | 18.1% | — | 17.6% |  |
| icf_l10 ≥ 6 | 132 | 365 | 13.2% | 233 | 18.0% | — | 17.3% |  |
| icf60 ≥ 19.648 | 138 | 328 | 12.2% | 172 | 18.0% | — | 16.9% |  |
| iscf_avg ≥ 3.333 | 118 | 344 | 12.8% | 257 | 17.1% | — | 16.6% |  |
| sog_l10 ≥ 3 | 166 | 417 | 11.5% | 250 | 17.2% | — | 16.4% |  |
| s3_rate ≥ 0.667 | 167 | 380 | 12.4% | 168 | 17.3% | — | 16.3% |  |
| ven_iff ≥ 4.667 | 132 | 276 | 13.4% | 232 | 16.8% | — | 16.3% |  |
| s4_l10 ≥ 0.333 | 149 | 473 | 11.0% | 296 | 16.9% | — | 16.2% |  |
| ven_icf ≥ 6 | 158 | 363 | 11.8% | 272 | 16.5% | — | 16.0% |  |
| icf_l3 ≥ 6 | 151 | 389 | 11.3% | 288 | 14.9% | — | 14.5% |  |
| sog60 ≥ 10.471 | 137 | 328 | 11.3% | 164 | 15.2% | — | 14.5% |  |
| iff_l3 ≥ 4.5 | 132 | 329 | 13.1% | 273 | 13.9% | — | 13.8% |  |
| s3_l5 ≥ 0.75 | 151 | 284 | 11.6% | 154 | 13.6% | — | 13.2% |  |
| sog_l5 ≥ 3 | 169 | 417 | 11.0% | 289 | 13.5% | — | 13.2% |  |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 816 | 1.1% | 1.0% | 1.5% | ✓ |
| 0–1 | 5+ | 891 | 0.4% | 0.9% | 0.3% | ✓ |
| 1–1.5 | 1–4 | 718 | 1.5% | 1.5% | 2.0% | ✓ |
| 1–1.5 | 5+ | 1218 | 1.6% | 0.4% | 1.9% | ✓ |
| 1.5–2 | 1–4 | 291 | 4.5% | 4.3% | 6.1% | ✓ |
| 1.5–2 | 5+ | 786 | 4.3% | 6.2% | 3.8% | ✓ |
| 2–2.5 | 1–4 | 365 | 4.9% | 5.4% | 0.0% | ✓ |
| 2–2.5 | 5+ | 476 | 6.9% | 5.0% | 7.4% | ✓ |
| 2.5–3 | 1–4 | 144 | 8.3% | 8.4% | 7.7% |  |
| 2.5–3 | 5+ | 275 | 8.7% | 7.8% | 9.0% | ✓ |
| 3–3.5 | 1–4 | 177 | 5.6% | 6.1% | 0.0% |  |
| 3–3.5 | 5+ | 199 | 14.1% | 19.6% | 12.2% | ✓ |
| 3.5+ | 1–4 | 173 | 13.3% | 13.6% | 0.0% |  |
| 3.5+ | 5+ | 119 | 25.2% | 15.6% | 28.7% |  |

## 6+ SOG

Base rate 1.8% (118 of 6648); fit weeks 2.0%, check week 1.6%. The bar a pill must clear to be filled: 11.0% (about the price a book usually asks for the line). 41 rules found on the fit weeks (5+ hits on 513+ games, 12+ skaters, every condition worth two points); the check week kept **94% of their lift**; **39 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s2_rate ≥ 0.8 | 266 | 670 | 5.1% | 355 | 7.0% | — | 6.8% |  |
| ven_icf ≥ 5 | 234 | 593 | 5.7% | 549 | 6.2% | — | 6.1% |  |
| icf_avg ≥ 4.833 | 197 | 663 | 5.6% | 531 | 6.0% | — | 6.0% |  |
| sog_l10 ≥ 2.333 | 211 | 675 | 5.8% | 566 | 5.8% | — | 5.8% |  |
| toi_l3 ≥ 16.42 · icf60 ≥ 14.245 | 166 | 567 | 6.9% | 524 | 5.7% | toi_l3 ≥ 16.42 +2.1; icf60 ≥ 14.245 +3.3 | 5.8% |  |
| iff_avg ≥ 3.5 | 216 | 705 | 6.2% | 556 | 5.8% | — | 5.8% |  |
| s3_rate ≥ 0.5 | 231 | 722 | 5.0% | 466 | 5.8% | — | 5.7% |  |
| ven_iff ≥ 3.667 | 239 | 545 | 6.2% | 561 | 5.5% | — | 5.5% |  |
| iff_l3 ≥ 3.667 | 240 | 664 | 5.9% | 625 | 5.3% | — | 5.3% |  |
| s4_l5 ≥ 0.25 | 172 | 582 | 5.5% | 401 | 5.2% | — | 5.2% |  |
| ven_sog ≥ 2.5 | 253 | 565 | 5.1% | 573 | 5.2% | — | 5.2% |  |
| icf60 ≥ 16.461 | 219 | 656 | 5.2% | 503 | 5.2% | — | 5.1% |  |
| iscf_avg ≥ 2.5 | 203 | 690 | 5.8% | 607 | 5.1% | — | 5.1% |  |
| icf_l3 ≥ 4.867 | 222 | 656 | 5.6% | 563 | 4.8% | — | 4.8% |  |
| s4_l10 ≥ 0.2 | 202 | 722 | 4.8% | 739 | 4.7% | — | 4.7% |  |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| str_s3 ≥ 1 | 361 | 697 | 4.9% | 735 | 2.4% |
| since_s3 ≤ 0 | 361 | 697 | 4.9% | 735 | 2.4% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 816 | 0.5% | 0.6% | 0.0% | ✓ |
| 0–1 | 5+ | 891 | 0.0% | 0.0% | 0.0% | ✓ |
| 1–1.5 | 1–4 | 718 | 0.3% | 0.3% | 0.0% | ✓ |
| 1–1.5 | 5+ | 1218 | 0.4% | 0.0% | 0.5% | ✓ |
| 1.5–2 | 1–4 | 291 | 1.7% | 1.6% | 3.0% | ✓ |
| 1.5–2 | 5+ | 786 | 2.0% | 4.0% | 1.5% | ✓ |
| 2–2.5 | 1–4 | 365 | 2.5% | 2.7% | 0.0% | ✓ |
| 2–2.5 | 5+ | 476 | 2.7% | 3.0% | 2.7% | ✓ |
| 2.5–3 | 1–4 | 144 | 4.2% | 4.6% | 0.0% |  |
| 2.5–3 | 5+ | 275 | 4.4% | 3.1% | 4.7% | ✓ |
| 3–3.5 | 1–4 | 177 | 4.0% | 4.2% | 0.0% |  |
| 3–3.5 | 5+ | 199 | 5.0% | 5.9% | 4.7% | ✓ |
| 3.5+ | 1–4 | 173 | 7.5% | 7.7% | 0.0% |  |
| 3.5+ | 5+ | 119 | 13.4% | 12.5% | 13.8% | ✓ |

## 1+ goal

Base rate 15.0% (998 of 6648); fit weeks 14.4%, check week 15.6%. The bar a pill must clear to be filled: 35.0% (about the price a book usually asks for the line). 117 rules found on the fit weeks (10+ hits on 70+ games, 12+ skaters, every condition worth two points); the check week kept **90% of their lift**; **112 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iscf_l10 ≥ 3.333 · sog_sd ≥ 1.414 · ven_s3 ≥ 1 | 38 | 70 | 48.6% | 41 | 51.2% | iscf_l10 ≥ 3.333 +16.5; sog_sd ≥ 1.414 +12.4; ven_s3 ≥ 1 +13.3 | 48.5% | ✓ |
| ven_iff ≥ 4.667 · opp_ga_l5_rk ≤ 16 · line ≤ 1 | 51 | 73 | 47.9% | 76 | 44.7% | ven_iff ≥ 4.667 +24.0; opp_ga_l5_rk ≤ 16 +6.0; line ≤ 1 +9.1 | 44.9% | ✓ |
| ven_iff ≥ 4.667 · opp_slot_sog_x ≤ 0.96 · line ≤ 1 | 47 | 73 | 47.9% | 64 | 43.8% | ven_iff ≥ 4.667 +24.3; opp_slot_sog_x ≤ 0.96 +5.7; line ≤ 1 +11.1 | 44.3% | ✓ |
| fwd = 1 · toi_l5 ≥ 20.236 · ven_iff ≥ 4.667 | 34 | 71 | 49.3% | 104 | 43.3% | fwd = 1 +7.1; toi_l5 ≥ 20.236 +9.7; ven_iff ≥ 4.667 +10.0 | 44.1% | ✓ |
| iscf_l5 ≥ 3.333 · sog_max ≥ 6 · ven_s3 ≥ 0.667 | 26 | 70 | 48.6% | 80 | 41.2% | iscf_l5 ≥ 3.333 +5.6; sog_max ≥ 6 +8.2; ven_s3 ≥ 0.667 +8.5 | 42.8% | ✓ |
| pts_avg ≥ 1 · ven_iff ≥ 4.667 · line ≤ 1 | 46 | 92 | 46.7% | 95 | 42.1% | pts_avg ≥ 1 +4.1; ven_iff ≥ 4.667 +16.8; line ≤ 1 +4.8 | 42.7% | ✓ |
| iff_avg ≥ 4.409 · sog_sd ≥ 1.414 · pt1_l5 ≥ 0.75 | 32 | 70 | 50.0% | 83 | 39.8% | iff_avg ≥ 4.409 +11.7; sog_sd ≥ 1.414 +6.9; pt1_l5 ≥ 0.75 +8.0 | 42.1% | ✓ |
| pts_avg ≥ 1 · sog_sd ≥ 1.169 · ven_iff ≥ 4.667 | 45 | 93 | 47.3% | 107 | 41.1% | pts_avg ≥ 1 +8.2; sog_sd ≥ 1.169 +4.4; ven_iff ≥ 4.667 +12.3 | 42.1% | ✓ |
| pts_l5 ≥ 1 · sog_sd ≥ 1.414 · ven_iff ≥ 4.667 | 44 | 86 | 47.7% | 98 | 40.8% | pts_l5 ≥ 1 +7.3; sog_sd ≥ 1.414 +5.2; ven_iff ≥ 4.667 +12.6 | 42.0% | ✓ |
| iff_avg ≥ 4.409 · pts_l5 ≥ 1 · sog_sd ≥ 1.414 | 42 | 98 | 46.9% | 133 | 40.6% | iff_avg ≥ 4.409 +11.8; pts_l5 ≥ 1 +6.8; sog_sd ≥ 1.414 +5.6 | 41.5% | ✓ |
| pts_avg ≥ 1 · ven_iff ≥ 4.667 · opp_sa_l5 ≥ 25 | 49 | 93 | 47.3% | 84 | 39.3% | pts_avg ≥ 1 +8.1; ven_iff ≥ 4.667 +17.3; opp_sa_l5 ≥ 25 +3.9 | 41.0% | ✓ |
| sog_max ≥ 6 · ven_iscf ≥ 3.5 · ven_s3 ≥ 0.667 | 29 | 70 | 48.6% | 94 | 38.3% | sog_max ≥ 6 +9.6; ven_iscf ≥ 3.5 +3.6; ven_s3 ≥ 0.667 +5.2 | 40.5% | ✓ |
| iscf_l10 ≥ 3.333 · toi_l3 ≥ 20.257 · team_cf_l5 ≤ 66.5 | 30 | 75 | 48.0% | 106 | 38.7% | iscf_l10 ≥ 3.333 +25.2; toi_l3 ≥ 20.257 +9.3; team_cf_l5 ≤ 66.5 +3.7 | 40.5% | ✓ |
| pts_avg ≥ 1 · ven_iff ≥ 4.667 · opp_slot_sog_x ≥ 0.733 | 53 | 94 | 46.8% | 105 | 39.0% | pts_avg ≥ 1 +7.1; ven_iff ≥ 4.667 +16.9; opp_slot_sog_x ≥ 0.733 +3.1 | 40.5% | ✓ |
| sog_sd ≥ 1.414 · pt1_l10 ≥ 0.667 · ven_iff ≥ 4.667 | 43 | 74 | 48.6% | 82 | 37.8% | sog_sd ≥ 1.414 +6.8; pt1_l10 ≥ 0.667 +6.3; ven_iff ≥ 4.667 +9.9 | 40.4% | ✓ |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| pts_l10 ≥ 1 · sog_max ≥ 6 · ven_icf ≥ 3.333 | 27 | 70 | 48.6% | 146 | 33.6% |
| sog_max ≥ 6 · ven_pts ≥ 1 | 36 | 85 | 43.5% | 178 | 30.3% |
| sog_max ≥ 6 · ven_pts ≥ 0.667 | 39 | 93 | 40.9% | 239 | 28.9% |
| ven_iff ≥ 4.667 · team_sa ≤ 24.34 | 48 | 95 | 40.0% | 35 | 28.6% |
| str_s3 ≥ 2 | 109 | 179 | 28.5% | 240 | 19.6% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 816 | 7.0% | 7.8% | 3.0% | ✓ |
| 0–1 | 5+ | 891 | 8.1% | 7.8% | 8.2% | ✓ |
| 1–1.5 | 1–4 | 718 | 12.7% | 13.6% | 6.9% | ✓ |
| 1–1.5 | 5+ | 1218 | 13.3% | 15.4% | 12.7% | ✓ |
| 1.5–2 | 1–4 | 291 | 9.3% | 8.9% | 12.1% | ✓ |
| 1.5–2 | 5+ | 786 | 17.3% | 19.2% | 16.7% | ✓ |
| 2–2.5 | 1–4 | 365 | 13.2% | 14.0% | 3.3% |  |
| 2–2.5 | 5+ | 476 | 24.6% | 21.0% | 25.5% | ✓ |
| 2.5–3 | 1–4 | 144 | 25.0% | 26.0% | 15.4% |  |
| 2.5–3 | 5+ | 275 | 25.5% | 21.9% | 26.5% | ✓ |
| 3–3.5 | 1–4 | 177 | 19.2% | 20.6% | 0.0% |  |
| 3–3.5 | 5+ | 199 | 32.7% | 25.5% | 35.1% | ✓ |
| 3.5+ | 1–4 | 173 | 23.7% | 24.3% | 0.0% |  |
| 3.5+ | 5+ | 119 | 35.3% | 46.9% | 31.0% | ✓ |

## 2+ goals

Base rate 2.0% (136 of 6648); fit weeks 2.2%, check week 1.9%. The bar a pill must clear to be filled: 9.0% (about the price a book usually asks for the line). 41 rules found on the fit weeks (5+ hits on 456+ games, 12+ skaters, every condition worth two points); the check week kept **66% of their lift**; **39 held**, 15 kept after near-duplicates.

**The rules that held.** "Each part adds" = the rate over the whole window with the rule against the rule without that condition. The pill starts from the fit weeks’ lift cut to what the check week kept, updated by the rule’s own check week.

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit | Each part adds (pts) | Pill starts at | Fills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iscf_avg ≥ 2.5 | 203 | 690 | 6.8% | 607 | 5.8% | — | 5.7% |  |
| s4_l10 ≥ 0.333 | 149 | 473 | 7.0% | 296 | 5.7% | — | 5.7% |  |
| icf_l10 ≥ 4.833 | 197 | 663 | 6.0% | 521 | 5.6% | — | 5.5% |  |
| iff_l10 ≥ 3.5 | 216 | 705 | 6.0% | 557 | 5.2% | — | 5.2% |  |
| icf60 ≥ 16.461 | 219 | 656 | 5.8% | 503 | 5.2% | — | 5.1% |  |
| ven_icf ≥ 5 | 234 | 593 | 6.4% | 549 | 5.1% | — | 5.1% |  |
| ven_iff ≥ 3.667 | 239 | 545 | 7.2% | 561 | 5.0% | — | 5.0% |  |
| s3_l10 ≥ 0.5 | 231 | 722 | 5.4% | 485 | 4.9% | — | 4.9% |  |
| ven_iscf ≥ 2.5 | 243 | 602 | 6.6% | 666 | 4.8% | — | 4.8% |  |
| ven_s3 ≥ 0.5 | 281 | 667 | 5.8% | 647 | 4.8% | — | 4.8% |  |
| ven_sog ≥ 2.5 | 253 | 565 | 6.7% | 573 | 4.7% | — | 4.7% |  |
| iscf_l3 ≥ 2.5 | 233 | 695 | 6.0% | 657 | 4.6% | — | 4.6% |  |
| s4_l5 ≥ 0.333 | 151 | 465 | 7.1% | 386 | 4.4% | — | 4.5% |  |
| sog_l10 ≥ 2.333 | 211 | 675 | 6.7% | 566 | 4.4% | — | 4.5% |  |
| s4_rate ≥ 0.2 | 202 | 722 | 6.4% | 656 | 4.4% | — | 4.4% |  |

**The strongest on the fit weeks that did not hold** (noise the search found):

| When | Skaters | Fit: games | Fit: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- | --- |
| s4_l5 ≥ 0.2 | 214 | 810 | 5.8% | 1126 | 3.1% |
| sog_max ≥ 4 | 214 | 837 | 5.7% | 1535 | 2.9% |

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 816 | 0.6% | 0.6% | 0.7% | ✓ |
| 0–1 | 5+ | 891 | 0.1% | 0.0% | 0.1% | ✓ |
| 1–1.5 | 1–4 | 718 | 1.0% | 0.8% | 2.0% | ✓ |
| 1–1.5 | 5+ | 1218 | 1.6% | 2.2% | 1.4% | ✓ |
| 1.5–2 | 1–4 | 291 | 1.0% | 1.2% | 0.0% | ✓ |
| 1.5–2 | 5+ | 786 | 1.7% | 0.6% | 2.0% | ✓ |
| 2–2.5 | 1–4 | 365 | 1.9% | 2.1% | 0.0% | ✓ |
| 2–2.5 | 5+ | 476 | 4.2% | 8.0% | 3.2% | ✓ |
| 2.5–3 | 1–4 | 144 | 6.9% | 7.6% | 0.0% |  |
| 2.5–3 | 5+ | 275 | 5.5% | 9.4% | 4.3% | ✓ |
| 3–3.5 | 1–4 | 177 | 2.8% | 3.0% | 0.0% |  |
| 3–3.5 | 5+ | 199 | 6.5% | 5.9% | 6.8% | ✓ |
| 3.5+ | 1–4 | 173 | 6.4% | 6.5% | 0.0% |  |
| 3.5+ | 5+ | 119 | 5.9% | 9.4% | 4.6% | ✓ |

## 3+ goals

Base rate 0.2% (16 of 6648); fit weeks 0.3%, check week 0.2%. The bar a pill must clear to be filled: 3.0% (about the price a book usually asks for the line). 0 rules found on the fit weeks (5+ hits on 3643+ games, 12+ skaters, every condition worth two points); the check week kept **0% of their lift**; **0 held**, 0 kept after near-duplicates.

**The ladder** (his shots a game this season; 1–4 or 5+ games behind the rate):

| Shots a game | Games behind | Skater-games | Hit | Fit | Check | Held |
| --- | --- | --- | --- | --- | --- | --- |
| 0–1 | 1–4 | 816 | 0.0% | 0.0% | 0.0% | ✓ |
| 0–1 | 5+ | 891 | 0.0% | 0.0% | 0.0% | ✓ |
| 1–1.5 | 1–4 | 718 | 0.0% | 0.0% | 0.0% | ✓ |
| 1–1.5 | 5+ | 1218 | 0.2% | 0.0% | 0.2% | ✓ |
| 1.5–2 | 1–4 | 291 | 0.0% | 0.0% | 0.0% | ✓ |
| 1.5–2 | 5+ | 786 | 0.1% | 0.0% | 0.2% | ✓ |
| 2–2.5 | 1–4 | 365 | 0.3% | 0.3% | 0.0% | ✓ |
| 2–2.5 | 5+ | 476 | 0.8% | 2.0% | 0.5% | ✓ |
| 2.5–3 | 1–4 | 144 | 0.7% | 0.8% | 0.0% |  |
| 2.5–3 | 5+ | 275 | 0.7% | 1.6% | 0.5% | ✓ |
| 3–3.5 | 1–4 | 177 | 0.6% | 0.6% | 0.0% |  |
| 3–3.5 | 5+ | 199 | 0.5% | 2.0% | 0.0% | ✓ |
| 3.5+ | 1–4 | 173 | 0.6% | 0.6% | 0.0% |  |
| 3.5+ | 5+ | 119 | 1.7% | 3.1% | 1.1% | ✓ |

## The environment, his venue, his streaks: each read across its fifths

The hit rate in the bottom and top fifth of each read, the fifths taken within his position (a defenseman against defensemen; a slot read within the slot), overall and among skaters with 2+ shots a game this season, where the lines are bet; fit weeks and check week apart. The opponent’s reads are what it gives up per skater at his position, by window.

### 3+ SOG, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 9.8% (1193) | 42.3% (1195) | 8.8% (68) | 49.6% (754) | 8.7% (46) | 47.5% (326) | 9.1% (22) | 51.2% (428) |
| ven_iscf | 10.9% (1193) | 37.7% (1195) | 19.0% (84) | 46.0% (821) | 19.7% (71) | 42.4% (356) | — | 48.8% (465) |
| ven_icf | 10.6% (1193) | 41.8% (1195) | 23.1% (26) | 46.2% (942) | — | 42.8% (456) | — | 49.4% (486) |
| ven_s3 | 17.0% (1193) | 37.0% (1195) | 25.9% (193) | 42.7% (906) | 25.9% (193) | 39.4% (396) | — | 45.3% (510) |
| ven_iff | 11.7% (1193) | 39.8% (1195) | 30.3% (33) | 44.7% (931) | 30.8% (26) | 41.0% (454) | — | 48.2% (477) |
| ven_g1 | 18.8% (1193) | 31.5% (1195) | 30.3% (314) | 42.3% (633) | 30.3% (314) | 36.8% (299) | — | 47.3% (334) |
| ven_g | 18.8% (1193) | 31.9% (1195) | 30.3% (314) | 42.0% (647) | 30.3% (314) | 37.4% (286) | — | 45.7% (361) |
| ven_pts | 17.5% (1193) | 32.6% (1195) | 32.7% (245) | 44.2% (665) | 32.1% (240) | 41.4% (278) | — | 46.3% (387) |
| ven_sog_x | 17.5% (1151) | 21.1% (1154) | 35.0% (197) | 46.5% (230) | 34.6% (107) | 43.8% (112) | 35.6% (90) | 49.2% (118) |
| opp_pos_ihdcf_l5 | 18.7% (1314) | 23.2% (1317) | 29.4% (408) | 40.5% (365) | 27.5% (280) | 34.8% (198) | 33.6% (128) | 47.3% (167) |
| opp_slot_g | 19.0% (1309) | 23.1% (1320) | 29.8% (467) | 40.2% (378) | 29.4% (452) | 35.0% (220) | — | 47.5% (158) |
| opp_pos_ihdcf_l10 | 19.7% (1314) | 24.3% (1317) | 30.0% (430) | 40.0% (385) | 29.1% (316) | 35.2% (244) | 32.5% (114) | 48.2% (141) |
| opp_pos_ihdcf | 20.0% (1314) | 24.1% (1317) | 30.1% (429) | 39.8% (384) | 29.5% (315) | 35.0% (243) | 31.6% (114) | 48.2% (141) |
| opp_pos_iscf | 19.2% (1314) | 24.1% (1317) | 30.4% (414) | 40.1% (404) | 30.5% (295) | 36.1% (280) | 30.3% (119) | 49.2% (124) |
| opp_ga_l5 | 19.6% (1314) | 22.1% (1317) | 29.6% (415) | 39.3% (397) | 26.6% (274) | 33.1% (239) | 35.5% (141) | 48.7% (158) |
| opp_sca_l5 | 18.9% (1314) | 23.8% (1317) | 32.1% (393) | 41.6% (392) | 30.0% (247) | 38.0% (229) | 35.6% (146) | 46.6% (163) |
| opp_fa_l10 | 17.6% (1314) | 22.7% (1317) | 29.9% (405) | 39.4% (386) | 29.4% (293) | 36.3% (251) | 31.2% (112) | 45.2% (135) |
| opp_ca_l5 | 18.2% (1314) | 23.3% (1317) | 30.7% (378) | 40.2% (396) | 29.9% (231) | 37.8% (254) | 32.0% (147) | 44.4% (142) |
| opp_pos_ihdcf_l5_x | 18.8% (1314) | 22.9% (1317) | 29.2% (415) | 38.3% (368) | 27.3% (271) | 32.6% (227) | 32.6% (144) | 47.5% (141) |
| opp_sca_l10 | 19.2% (1314) | 24.1% (1317) | 32.4% (398) | 41.4% (399) | 31.2% (269) | 37.2% (261) | 34.9% (129) | 49.3% (138) |
| opp_ca_l10 | 18.4% (1314) | 23.8% (1317) | 31.4% (395) | 40.3% (402) | 31.8% (274) | 38.8% (273) | 30.6% (121) | 43.4% (129) |
| opp_pos_ihdcf_x | 19.9% (1314) | 23.8% (1317) | 29.8% (423) | 38.7% (380) | 29.4% (306) | 33.5% (254) | 30.8% (117) | 49.2% (126) |
| opp_sca | 19.0% (1314) | 23.8% (1317) | 32.1% (399) | 41.0% (393) | 31.2% (266) | 38.2% (254) | 33.8% (133) | 46.0% (139) |
| opp_slot_g_x | 19.0% (1309) | 22.3% (1320) | 29.8% (467) | 38.5% (382) | 29.4% (452) | 34.6% (234) | — | 44.6% (148) |
| opp_fa_l5 | 18.6% (1314) | 22.5% (1317) | 31.3% (403) | 39.9% (386) | 30.0% (267) | 36.0% (247) | 33.8% (136) | 46.8% (139) |

### 4+ SOG, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 3.5% (1193) | 23.0% (1195) | 7.4% (68) | 28.1% (754) | 6.5% (46) | 27.3% (326) | 9.1% (22) | 28.7% (428) |
| ven_iscf | 3.7% (1193) | 19.6% (1195) | 9.5% (84) | 25.2% (821) | 11.3% (71) | 21.6% (356) | — | 28.0% (465) |
| ven_sog | 4.3% (1193) | 20.3% (1195) | 12.5% (24) | 23.5% (971) | — | 20.8% (451) | — | 25.8% (520) |
| ven_icf | 3.3% (1193) | 21.7% (1195) | 15.4% (26) | 24.9% (942) | — | 22.8% (456) | — | 27.0% (486) |
| opp_sca_l5 | 7.2% (1314) | 11.8% (1317) | 14.5% (393) | 23.5% (392) | 14.2% (247) | 20.1% (229) | 15.1% (146) | 28.2% (163) |
| team_scf | 6.8% (1329) | 11.9% (1331) | 11.6% (251) | 20.1% (546) | 10.8% (186) | 19.2% (380) | 13.8% (65) | 22.3% (166) |
| ven_s3 | 7.5% (1193) | 18.7% (1195) | 14.0% (193) | 22.5% (906) | 14.0% (193) | 19.9% (396) | — | 24.5% (510) |
| opp_fa_l5 | 7.2% (1314) | 11.2% (1317) | 13.9% (403) | 22.3% (386) | 13.5% (267) | 19.8% (247) | 14.7% (136) | 26.6% (139) |
| opp_fa_l10 | 6.9% (1314) | 11.0% (1317) | 13.6% (405) | 21.8% (386) | 14.0% (293) | 19.1% (251) | 12.5% (112) | 26.7% (135) |
| opp_sca | 7.5% (1314) | 11.9% (1317) | 15.3% (399) | 23.4% (393) | 16.2% (266) | 20.1% (254) | 13.5% (133) | 29.5% (139) |
| ven_sog_x | 7.5% (1151) | 9.4% (1154) | 17.8% (197) | 25.7% (230) | 18.7% (107) | 24.1% (112) | 16.7% (90) | 27.1% (118) |
| opp_sca_l10 | 7.6% (1314) | 12.1% (1317) | 15.6% (398) | 23.3% (399) | 16.4% (269) | 19.5% (261) | 14.0% (129) | 30.4% (138) |
| opp_ca_l5 | 7.2% (1314) | 11.4% (1317) | 15.1% (378) | 22.5% (396) | 15.2% (231) | 20.5% (254) | 15.0% (147) | 26.1% (142) |
| opp_pos_ihdcf_l10 | 9.6% (1314) | 11.6% (1317) | 16.0% (430) | 23.4% (385) | 15.5% (316) | 18.4% (244) | 17.5% (114) | 31.9% (141) |
| opp_fa | 7.2% (1314) | 11.1% (1317) | 14.4% (403) | 21.7% (387) | 14.3% (286) | 19.0% (252) | 14.5% (117) | 26.7% (135) |
| opp_pos_ihdcf_l5 | 8.6% (1314) | 10.3% (1317) | 15.4% (408) | 22.7% (365) | 15.4% (280) | 17.2% (198) | 15.6% (128) | 29.3% (167) |
| opp_pos_sog_l10 | 8.1% (1314) | 10.8% (1317) | 15.4% (396) | 22.6% (385) | 14.9% (281) | 21.8% (239) | 16.5% (115) | 24.0% (146) |
| opp_slot_g | 8.5% (1309) | 10.0% (1320) | 14.1% (467) | 21.2% (378) | 13.9% (452) | 20.0% (220) | — | 22.8% (158) |
| opp_ga_l5 | 8.4% (1314) | 11.2% (1317) | 15.2% (415) | 22.2% (397) | 15.0% (274) | 17.2% (239) | 15.6% (141) | 29.7% (158) |
| opp_pos_sog | 8.1% (1314) | 10.7% (1317) | 15.5% (400) | 22.5% (383) | 14.8% (283) | 20.8% (240) | 17.1% (117) | 25.2% (143) |
| ven_pts | 7.7% (1193) | 16.2% (1195) | 15.9% (245) | 22.9% (665) | 15.4% (240) | 21.6% (278) | — | 23.8% (387) |
| team_scf_l5 | 7.2% (1329) | 12.2% (1331) | 13.8% (261) | 20.7% (536) | 9.9% (172) | 20.1% (348) | 21.3% (89) | 21.8% (188) |
| opp_pos_iscf | 8.4% (1314) | 11.5% (1317) | 15.5% (414) | 22.3% (404) | 14.6% (295) | 18.9% (280) | 17.6% (119) | 29.8% (124) |
| opp_pos_iscf_l5_x | 7.8% (1314) | 11.3% (1317) | 15.4% (396) | 22.2% (388) | 13.9% (259) | 20.1% (254) | 18.2% (137) | 26.1% (134) |
| opp_pos_sog_l5_x | 8.8% (1314) | 10.6% (1317) | 16.3% (381) | 23.0% (391) | 13.9% (238) | 21.6% (231) | 20.3% (143) | 25.0% (160) |

### 5+ SOG, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 1.1% (1193) | 11.8% (1195) | 2.9% (68) | 15.1% (754) | 4.3% (46) | 15.6% (326) | 0.0% (22) | 14.7% (428) |
| ven_icf | 0.9% (1193) | 10.7% (1195) | 3.8% (26) | 12.2% (942) | — | 11.0% (456) | — | 13.4% (486) |
| ven_iscf | 1.4% (1193) | 9.5% (1195) | 6.0% (84) | 12.3% (821) | 7.0% (71) | 9.6% (356) | — | 14.4% (465) |
| ven_s3 | 2.4% (1193) | 9.3% (1195) | 6.2% (193) | 11.6% (906) | 6.2% (193) | 10.1% (396) | — | 12.7% (510) |
| opp_slot_g | 3.1% (1309) | 4.3% (1320) | 6.0% (467) | 10.3% (378) | 6.0% (452) | 10.5% (220) | — | 10.1% (158) |
| team_ff_l5 | 2.4% (1329) | 5.2% (1331) | 5.3% (246) | 9.5% (526) | 5.1% (178) | 7.9% (340) | 5.9% (68) | 12.4% (186) |
| opp_slot_g_x | 3.1% (1309) | 4.2% (1320) | 6.0% (467) | 10.2% (382) | 6.0% (452) | 10.7% (234) | — | 9.5% (148) |
| team_scf | 2.5% (1329) | 4.8% (1331) | 5.6% (251) | 9.7% (546) | 5.4% (186) | 9.5% (380) | 6.2% (65) | 10.2% (166) |
| opp_ga | 3.4% (1314) | 4.9% (1317) | 7.4% (418) | 11.3% (388) | 7.3% (287) | 9.8% (266) | 7.6% (131) | 14.8% (122) |
| opp_pos_g_x | 3.3% (1314) | 5.2% (1317) | 6.8% (412) | 10.7% (403) | 6.2% (308) | 8.5% (248) | 8.7% (104) | 14.2% (155) |
| opp_pos_g | 3.0% (1314) | 4.8% (1317) | 6.1% (408) | 10.0% (402) | 6.2% (320) | 8.2% (256) | 5.7% (88) | 13.0% (146) |
| opp_ga_l5 | 3.5% (1314) | 4.8% (1317) | 7.2% (415) | 10.8% (397) | 7.7% (274) | 9.2% (239) | 6.4% (141) | 13.3% (158) |
| opp_ga_l10 | 3.3% (1314) | 4.9% (1317) | 7.4% (421) | 10.9% (393) | 7.0% (301) | 9.0% (256) | 8.3% (120) | 14.6% (137) |
| team_scf_l5 | 2.7% (1329) | 4.8% (1331) | 6.1% (261) | 9.7% (536) | 4.7% (172) | 9.8% (348) | 9.0% (89) | 9.6% (188) |
| team_cf_l5 | 2.5% (1329) | 5.0% (1331) | 5.5% (274) | 9.0% (542) | 5.9% (188) | 8.5% (366) | 4.7% (86) | 10.2% (176) |
| team_gf | 4.0% (1329) | 3.5% (1331) | 10.9% (359) | 7.4% (460) | 8.9% (237) | 6.4% (297) | 14.8% (122) | 9.2% (163) |
| ven_sog | 1.6% (1193) | 9.8% (1195) | 8.3% (24) | 11.6% (971) | — | 11.1% (451) | — | 12.1% (520) |
| opp_pos_g_l5_x | 3.3% (1314) | 4.7% (1317) | 7.5% (416) | 10.7% (383) | 6.3% (269) | 8.5% (212) | 9.5% (147) | 13.5% (171) |
| team_sa | 5.0% (1329) | 2.6% (1331) | 9.8% (449) | 6.6% (334) | 10.4% (308) | 5.4% (221) | 8.5% (141) | 8.8% (113) |
| opp_pos_g_l10_x | 3.2% (1314) | 4.9% (1317) | 6.6% (409) | 9.8% (400) | 5.7% (300) | 8.5% (248) | 9.2% (109) | 11.8% (152) |
| team_hdcf | 2.6% (1329) | 5.0% (1331) | 6.6% (259) | 9.6% (519) | 4.6% (173) | 8.6% (337) | 10.5% (86) | 11.5% (182) |
| opp_pos_g_l10 | 3.2% (1314) | 4.6% (1317) | 6.6% (412) | 9.6% (397) | 6.4% (313) | 8.4% (249) | 7.1% (99) | 11.5% (148) |
| team_cf | 2.4% (1329) | 5.1% (1331) | 6.0% (252) | 8.9% (548) | 6.4% (203) | 9.3% (366) | 4.1% (49) | 8.2% (182) |
| opp_pos_ihdcf_l5 | 3.7% (1314) | 4.3% (1317) | 8.1% (408) | 11.0% (365) | 8.6% (280) | 8.6% (198) | 7.0% (128) | 13.8% (167) |
| opp_pos_g_l5 | 3.5% (1314) | 4.7% (1317) | 8.0% (412) | 10.7% (391) | 6.6% (271) | 8.9% (214) | 10.6% (141) | 13.0% (177) |

### 1+ goal, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 7.4% (1193) | 26.0% (1195) | 7.4% (68) | 32.4% (754) | 10.9% (46) | 30.4% (326) | 0.0% (22) | 33.9% (428) |
| ven_iscf | 8.6% (1193) | 23.3% (1195) | 15.5% (84) | 28.3% (821) | 16.9% (71) | 25.6% (356) | — | 30.3% (465) |
| ven_iff | 9.7% (1193) | 24.7% (1195) | 15.2% (33) | 27.3% (931) | 19.2% (26) | 25.1% (454) | — | 29.4% (477) |
| ven_icf | 8.8% (1193) | 24.5% (1195) | 15.4% (26) | 27.2% (942) | — | 24.6% (456) | — | 29.6% (486) |
| opp_pos_iff_l5_x | 13.3% (1314) | 16.8% (1317) | 18.7% (385) | 25.9% (398) | 17.8% (259) | 24.0% (258) | 20.6% (126) | 29.3% (140) |
| ven_sog_x | 12.5% (1151) | 15.7% (1154) | 24.4% (197) | 31.3% (230) | 27.1% (107) | 30.4% (112) | 21.1% (90) | 32.2% (118) |
| opp_pos_iff_l5 | 13.2% (1314) | 17.2% (1317) | 19.1% (392) | 26.0% (400) | 17.9% (268) | 24.0% (258) | 21.8% (124) | 29.6% (142) |
| opp_ca | 13.2% (1314) | 16.6% (1317) | 19.6% (397) | 25.9% (398) | 19.3% (269) | 23.8% (273) | 20.3% (128) | 30.4% (125) |
| ven_s3 | 13.4% (1193) | 22.7% (1195) | 20.2% (193) | 26.4% (906) | 20.2% (193) | 24.5% (396) | — | 27.8% (510) |
| opp_ca_l10 | 13.2% (1314) | 16.5% (1317) | 19.5% (395) | 25.4% (402) | 19.7% (274) | 23.8% (273) | 19.0% (121) | 28.7% (129) |
| ven_pts | 13.5% (1193) | 20.8% (1195) | 22.9% (245) | 27.7% (665) | 22.1% (240) | 25.9% (278) | — | 28.9% (387) |
| ven_g | 14.7% (1193) | 19.7% (1195) | 22.3% (314) | 27.0% (647) | 22.3% (314) | 23.4% (286) | — | 29.9% (361) |
| opp_pos_icf_l5_x | 13.1% (1314) | 16.7% (1317) | 19.8% (398) | 24.3% (399) | 17.7% (260) | 22.1% (272) | 23.9% (138) | 29.1% (127) |
| pace | 14.5% (1314) | 15.3% (1317) | 25.9% (340) | 21.5% (465) | 24.6% (264) | 20.2% (287) | 30.3% (76) | 23.6% (178) |
| team_hdcf_l5 | 13.8% (1329) | 16.6% (1331) | 20.7% (270) | 25.1% (510) | 19.8% (192) | 22.9% (310) | 23.1% (78) | 28.5% (200) |
| opp_pos_iscf_l5 | 13.6% (1314) | 17.1% (1317) | 20.6% (399) | 24.9% (394) | 18.1% (265) | 21.7% (258) | 25.4% (134) | 30.9% (136) |
| opp_pos_sog_l10 | 14.4% (1314) | 16.9% (1317) | 22.0% (396) | 26.2% (385) | 20.6% (281) | 23.0% (239) | 25.2% (115) | 31.5% (146) |
| team_gf_l5 | 14.9% (1329) | 14.3% (1331) | 25.4% (331) | 21.2% (453) | 23.4% (214) | 20.0% (285) | 29.1% (117) | 23.2% (168) |
| opp_pos_sog_l5_x | 13.9% (1314) | 16.2% (1317) | 21.0% (381) | 25.1% (391) | 19.7% (238) | 22.9% (231) | 23.1% (143) | 28.1% (160) |
| opp_fa_l5 | 13.2% (1314) | 16.0% (1317) | 19.9% (403) | 23.8% (386) | 19.1% (267) | 23.1% (247) | 21.3% (136) | 25.2% (139) |
| opp_pos_icf_l5 | 12.9% (1314) | 16.4% (1317) | 20.1% (394) | 23.9% (397) | 17.1% (263) | 22.1% (263) | 26.0% (131) | 27.6% (134) |
| opp_hdca_l5 | 13.3% (1314) | 16.7% (1317) | 20.6% (393) | 24.4% (414) | 19.9% (251) | 21.1% (204) | 21.8% (142) | 27.6% (210) |
| team_ff | 12.3% (1329) | 16.2% (1331) | 17.4% (241) | 21.1% (546) | 16.6% (181) | 19.6% (341) | 20.0% (60) | 23.4% (205) |
| opp_fa_l10 | 13.5% (1314) | 15.9% (1317) | 21.0% (405) | 24.6% (386) | 19.5% (293) | 22.7% (251) | 25.0% (112) | 28.1% (135) |
| opp_pos_g_l5_x | 13.5% (1314) | 15.0% (1317) | 20.4% (416) | 24.0% (383) | 18.6% (269) | 21.7% (212) | 23.8% (147) | 26.9% (171) |

### 2+ goals, the 25 reads that split the 2+ shots-a-game skaters most

| Read | Bottom fifth | Top fifth | Bottom, 2+ SOG a game | Top, 2+ SOG a game | Bottom (fit) | Top (fit) | Bottom (check) | Top (check) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ven_toi | 0.5% (1193) | 5.9% (1195) | 0.0% (68) | 8.2% (754) | 0.0% (46) | 10.1% (326) | 0.0% (22) | 6.8% (428) |
| ven_icf | 0.8% (1193) | 5.4% (1195) | 0.0% (26) | 6.6% (942) | — | 7.7% (456) | — | 5.6% (486) |
| ven_sog_x | 1.4% (1151) | 2.8% (1154) | 4.1% (197) | 10.4% (230) | 6.5% (107) | 10.7% (112) | 1.1% (90) | 10.2% (118) |
| ven_iscf | 0.4% (1193) | 5.4% (1195) | 1.2% (84) | 7.6% (821) | 1.4% (71) | 8.7% (356) | — | 6.7% (465) |
| ven_sog | 0.6% (1193) | 4.7% (1195) | 0.0% (24) | 5.6% (971) | — | 6.2% (451) | — | 5.0% (520) |
| opp_slot_g | 1.2% (1309) | 2.8% (1320) | 2.4% (467) | 6.1% (378) | 2.4% (452) | 6.4% (220) | — | 5.7% (158) |
| opp_slot_g_x | 1.2% (1309) | 2.7% (1320) | 2.4% (467) | 6.0% (382) | 2.4% (452) | 6.0% (234) | — | 6.1% (148) |
| ven_iff | 0.6% (1193) | 5.4% (1195) | 3.0% (33) | 6.6% (931) | 3.8% (26) | 7.5% (454) | — | 5.7% (477) |
| opp_pos_iff_l5_x | 0.8% (1314) | 3.0% (1317) | 1.8% (385) | 5.3% (398) | 1.9% (259) | 5.8% (258) | 1.6% (126) | 4.3% (140) |
| ven_s3 | 1.2% (1193) | 5.1% (1195) | 3.1% (193) | 6.5% (906) | 3.1% (193) | 7.3% (396) | — | 5.9% (510) |
| opp_pos_iff_l5 | 0.8% (1314) | 3.0% (1317) | 2.0% (392) | 5.2% (400) | 2.2% (268) | 5.8% (258) | 1.6% (124) | 4.2% (142) |
| opp_slot_icf_x | 1.6% (1309) | 2.9% (1320) | 3.7% (405) | 6.5% (402) | 4.1% (292) | 7.1% (282) | 2.7% (113) | 5.0% (120) |
| team_sf | 2.0% (1329) | 2.6% (1331) | 6.2% (225) | 3.7% (546) | 5.3% (152) | 5.1% (331) | 8.2% (73) | 1.4% (215) |
| opp_slot_icf | 1.7% (1309) | 2.8% (1320) | 3.9% (409) | 6.3% (397) | 4.3% (301) | 6.8% (278) | 2.8% (108) | 5.0% (119) |
| team_sf_l5 | 1.9% (1329) | 2.4% (1331) | 6.3% (222) | 4.0% (527) | 5.3% (150) | 5.4% (315) | 8.3% (72) | 1.9% (212) |
| opp_pos_iscf_l5 | 0.9% (1314) | 2.9% (1317) | 2.3% (399) | 4.6% (394) | 2.6% (265) | 5.4% (258) | 1.5% (134) | 2.9% (136) |
| opp_pos_iff_ven_x | 1.5% (1211) | 2.5% (1214) | 3.3% (366) | 5.5% (344) | 3.0% (235) | 6.4% (203) | 3.8% (131) | 4.3% (141) |
| opp_slot_sog | 1.5% (1309) | 2.8% (1320) | 4.0% (400) | 6.1% (392) | 4.2% (308) | 6.7% (270) | 3.3% (92) | 4.9% (122) |
| opp_slot_sog_x | 1.6% (1309) | 3.0% (1320) | 4.2% (402) | 6.3% (394) | 4.3% (299) | 6.9% (276) | 3.9% (103) | 5.1% (118) |
| opp_pos_icf_l5_x | 0.9% (1314) | 2.4% (1317) | 2.3% (398) | 4.3% (399) | 2.3% (260) | 5.5% (272) | 2.2% (138) | 1.6% (127) |
| opp_pos_icf_l5 | 0.9% (1314) | 2.6% (1317) | 2.3% (394) | 4.3% (397) | 2.3% (263) | 5.7% (263) | 2.3% (131) | 1.5% (134) |
| opp_sf | 2.7% (1314) | 1.6% (1317) | 6.0% (398) | 4.1% (369) | 5.8% (259) | 4.1% (221) | 6.5% (139) | 4.1% (148) |
| opp_pos_sog_l10 | 1.6% (1314) | 3.1% (1317) | 4.0% (396) | 6.0% (385) | 3.9% (281) | 6.3% (239) | 4.3% (115) | 5.5% (146) |
| opp_pos_iscf_l5_x | 1.1% (1314) | 2.9% (1317) | 2.8% (396) | 4.6% (388) | 3.5% (259) | 5.5% (254) | 1.5% (137) | 3.0% (134) |
| opp_pos_iscf | 1.4% (1314) | 3.2% (1317) | 3.4% (414) | 5.2% (404) | 3.1% (295) | 5.4% (280) | 4.2% (119) | 4.8% (124) |

## Streaks, inside his shot tier

A 3+ SOG streak mostly marks a high-volume shooter, so each streak is read inside his shots-a-game tier this season: the hit rate by the length of the run he came in on.

### 3+ SOG

| Run | His shots a game | 0 | 1 | 2 | 3+ |
| --- | --- | --- | --- | --- | --- |
| 2+ SOG streak | under 2 | 14.3% (3413) | 15.2% (933) | 19.3% (259) | 27.8% (115) |
| 2+ SOG streak | 2 – 3 | 32.1% (358) | 29.6% (372) | 31.5% (219) | 39.5% (311) |
| 2+ SOG streak | 3+ | 65.0% (60) | 33.3% (213) | 44.0% (125) | 48.9% (270) |
| 3+ SOG streak | under 2 | 14.8% (4264) | 17.0% (417) | 29.7% (37) | — (2) |
| 3+ SOG streak | 2 – 3 | 32.3% (790) | 35.7% (322) | 28.2% (110) | 42.1% (38) |
| 3+ SOG streak | 3+ | 50.6% (162) | 37.2% (274) | 48.7% (117) | 48.7% (115) |
| 4+ SOG streak | under 2 | 14.9% (4592) | 20.2% (124) | — (4) | — (0) |
| 4+ SOG streak | 2 – 3 | 33.0% (1050) | 33.9% (189) | — (18) | — (3) |
| 4+ SOG streak | 3+ | 42.6% (352) | 43.7% (229) | 54.1% (61) | 53.8% (26) |
| goal streak | under 2 | 14.5% (4251) | 20.7% (411) | 20.4% (49) | — (9) |
| goal streak | 2 – 3 | 32.2% (962) | 36.1% (230) | 31.5% (54) | — (14) |
| goal streak | 3+ | 44.5% (420) | 41.5% (183) | 48.9% (47) | — (18) |
| point streak | under 2 | 13.5% (3403) | 17.9% (905) | 21.3% (272) | 22.1% (140) |
| point streak | 2 – 3 | 32.8% (658) | 30.0% (313) | 35.4% (147) | 38.7% (142) |
| point streak | 3+ | 39.7% (262) | 42.5% (214) | 50.0% (94) | 56.1% (98) |
| under 2 SOG streak | under 2 | 17.1% (1307) | 15.7% (1354) | 14.2% (839) | 12.8% (1220) |
| under 2 SOG streak | 2 – 3 | 33.5% (902) | 31.4% (290) | 35.5% (62) | — (6) |
| under 2 SOG streak | 3+ | 42.4% (608) | 64.3% (56) | — (4) | — (0) |
| pointless streak | under 2 | 19.1% (1317) | 15.8% (1144) | 13.0% (759) | 12.1% (1500) |
| pointless streak | 2 – 3 | 33.4% (602) | 34.4% (349) | 33.1% (166) | 28.7% (143) |
| pointless streak | 3+ | 47.5% (406) | 39.3% (183) | 42.1% (57) | 36.4% (22) |
| games since a goal | under 2 | 20.5% (469) | 15.8% (797) | 13.0% (690) | 14.5% (2764) |
| games since a goal | 2 – 3 | 35.9% (298) | 30.8% (321) | 34.2% (225) | 32.2% (416) |
| games since a goal | 3+ | 44.4% (248) | 43.8% (208) | 37.5% (96) | 51.7% (116) |
| games since 3+ SOG | under 2 | 18.2% (456) | 17.0% (845) | 13.6% (778) | 14.4% (2641) |
| games since 3+ SOG | 2 – 3 | 34.5% (470) | 30.8% (474) | 31.3% (195) | 39.7% (121) |
| games since 3+ SOG | 3+ | 42.5% (506) | 51.2% (125) | 56.7% (30) | — (7) |

### 4+ SOG

| Run | His shots a game | 0 | 1 | 2 | 3+ |
| --- | --- | --- | --- | --- | --- |
| 2+ SOG streak | under 2 | 5.3% (3413) | 5.6% (933) | 7.3% (259) | 13.0% (115) |
| 2+ SOG streak | 2 – 3 | 13.4% (358) | 14.0% (372) | 16.4% (219) | 19.6% (311) |
| 2+ SOG streak | 3+ | 43.3% (60) | 18.8% (213) | 20.8% (125) | 30.0% (270) |
| 3+ SOG streak | under 2 | 5.5% (4264) | 6.7% (417) | 8.1% (37) | — (2) |
| 3+ SOG streak | 2 – 3 | 15.7% (790) | 16.5% (322) | 11.8% (110) | 18.4% (38) |
| 3+ SOG streak | 3+ | 31.5% (162) | 21.2% (274) | 26.5% (117) | 28.7% (115) |
| 4+ SOG streak | under 2 | 5.6% (4592) | 8.1% (124) | — (4) | — (0) |
| 4+ SOG streak | 2 – 3 | 16.1% (1050) | 13.2% (189) | — (18) | — (3) |
| 4+ SOG streak | 3+ | 25.3% (352) | 25.3% (229) | 31.1% (61) | 26.9% (26) |
| goal streak | under 2 | 5.4% (4251) | 8.3% (411) | 8.2% (49) | — (9) |
| goal streak | 2 – 3 | 14.8% (962) | 19.1% (230) | 13.0% (54) | — (14) |
| goal streak | 3+ | 27.4% (420) | 21.3% (183) | 27.7% (47) | — (18) |
| point streak | under 2 | 4.9% (3403) | 6.6% (905) | 9.6% (272) | 10.0% (140) |
| point streak | 2 – 3 | 15.7% (658) | 13.1% (313) | 18.4% (147) | 18.3% (142) |
| point streak | 3+ | 23.7% (262) | 23.8% (214) | 33.0% (94) | 29.6% (98) |
| under 2 SOG streak | under 2 | 6.6% (1307) | 5.9% (1354) | 5.6% (839) | 4.4% (1220) |
| under 2 SOG streak | 2 – 3 | 16.5% (902) | 13.4% (290) | 12.9% (62) | — (6) |
| under 2 SOG streak | 3+ | 24.2% (608) | 42.9% (56) | — (4) | — (0) |
| pointless streak | under 2 | 7.6% (1317) | 6.2% (1144) | 4.0% (759) | 4.4% (1500) |
| pointless streak | 2 – 3 | 15.6% (602) | 17.8% (349) | 15.1% (166) | 11.2% (143) |
| pointless streak | 3+ | 27.3% (406) | 23.0% (183) | 26.3% (57) | 22.7% (22) |
| games since a goal | under 2 | 8.3% (469) | 6.8% (797) | 4.6% (690) | 5.1% (2764) |
| games since a goal | 2 – 3 | 18.5% (298) | 15.6% (321) | 11.6% (225) | 15.9% (416) |
| games since a goal | 3+ | 23.4% (248) | 27.4% (208) | 22.9% (96) | 31.0% (116) |
| games since 3+ SOG | under 2 | 6.8% (456) | 6.4% (845) | 5.9% (778) | 5.1% (2641) |
| games since 3+ SOG | 2 – 3 | 15.5% (470) | 14.8% (474) | 17.4% (195) | 16.5% (121) |
| games since 3+ SOG | 3+ | 24.1% (506) | 31.2% (125) | 40.0% (30) | — (7) |

### 1+ goal

| Run | His shots a game | 0 | 1 | 2 | 3+ |
| --- | --- | --- | --- | --- | --- |
| 2+ SOG streak | under 2 | 10.5% (3413) | 12.6% (933) | 17.8% (259) | 18.3% (115) |
| 2+ SOG streak | 2 – 3 | 21.5% (358) | 19.9% (372) | 22.8% (219) | 22.5% (311) |
| 2+ SOG streak | 3+ | 38.3% (60) | 19.7% (213) | 32.0% (125) | 28.5% (270) |
| 3+ SOG streak | under 2 | 11.3% (4264) | 13.9% (417) | 10.8% (37) | — (2) |
| 3+ SOG streak | 2 – 3 | 20.4% (790) | 26.1% (322) | 20.0% (110) | 10.5% (38) |
| 3+ SOG streak | 3+ | 33.3% (162) | 21.9% (274) | 28.2% (117) | 30.4% (115) |
| 4+ SOG streak | under 2 | 11.4% (4592) | 16.1% (124) | — (4) | — (0) |
| 4+ SOG streak | 2 – 3 | 20.8% (1050) | 26.5% (189) | — (18) | — (3) |
| 4+ SOG streak | 3+ | 25.9% (352) | 27.1% (229) | 29.5% (61) | 42.3% (26) |
| goal streak | under 2 | 11.2% (4251) | 15.1% (411) | 12.2% (49) | — (9) |
| goal streak | 2 – 3 | 20.5% (962) | 24.8% (230) | 25.9% (54) | — (14) |
| goal streak | 3+ | 27.9% (420) | 25.1% (183) | 27.7% (47) | — (18) |
| point streak | under 2 | 10.4% (3403) | 13.9% (905) | 15.4% (272) | 16.4% (140) |
| point streak | 2 – 3 | 19.3% (658) | 23.3% (313) | 26.5% (147) | 22.5% (142) |
| point streak | 3+ | 25.2% (262) | 25.7% (214) | 27.7% (94) | 35.7% (98) |
| under 2 SOG streak | under 2 | 14.2% (1307) | 11.7% (1354) | 10.4% (839) | 9.3% (1220) |
| under 2 SOG streak | 2 – 3 | 21.5% (902) | 21.0% (290) | 25.8% (62) | — (6) |
| under 2 SOG streak | 3+ | 26.2% (608) | 39.3% (56) | — (4) | — (0) |
| pointless streak | under 2 | 14.5% (1317) | 12.1% (1144) | 10.3% (759) | 9.2% (1500) |
| pointless streak | 2 – 3 | 23.9% (602) | 20.1% (349) | 15.7% (166) | 21.7% (143) |
| pointless streak | 3+ | 28.6% (406) | 26.2% (183) | 24.6% (57) | 18.2% (22) |
| games since a goal | under 2 | 15.1% (469) | 12.3% (797) | 10.1% (690) | 11.1% (2764) |
| games since a goal | 2 – 3 | 24.8% (298) | 20.9% (321) | 19.1% (225) | 20.9% (416) |
| games since a goal | 3+ | 26.2% (248) | 28.8% (208) | 25.0% (96) | 28.4% (116) |
| games since 3+ SOG | under 2 | 13.6% (456) | 11.1% (845) | 12.6% (778) | 11.0% (2641) |
| games since 3+ SOG | 2 – 3 | 23.4% (470) | 17.5% (474) | 25.6% (195) | 23.1% (121) |
| games since 3+ SOG | 3+ | 25.3% (506) | 32.8% (125) | 36.7% (30) | — (7) |

## By line slot

How often each slot reached each line (slot = ice-time rank in the game within his position: the box score carries no lineup; the site reads the beat writers’ lineups), and the rule that fires most often there for 3+ SOG and 1+ goal with its rate inside the slot.

| Slot | Skater-games | 3+ SOG | 4+ SOG | 5+ SOG | 6+ SOG | 1+ goal | 2+ goals | 3+ goals | 3+ SOG: the rule firing most there | 1+ goal: the rule firing most there |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | 376 | 38.0% | 21.5% | 10.6% | 6.6% | 29.8% | 4.3% | 0.0% | icf_l10 ≥ 6: 50.5% of 101 | iff_avg ≥ 4.409 · pts_l5 ≥ 1 · sog_sd ≥ 1.414: 47.2% of 72 |
| LW1 | 376 | 46.0% | 22.1% | 10.4% | 4.5% | 25.8% | 5.6% | 0.8% | icf_l10 ≥ 6: 71.7% of 92 | fwd = 1 · toi_l5 ≥ 20.236 · ven_iff ≥ 4.667: 47.7% of 44 |
| RW1 | 378 | 43.1% | 22.5% | 10.6% | 4.2% | 32.5% | 7.4% | 0.8% | icf_l10 ≥ 6: 50.0% of 96 | ven_iff ≥ 4.667 · opp_ga_l5_rk ≤ 16 · line ≤ 1: 55.6% of 45 |
| C2 | 377 | 28.6% | 15.1% | 8.2% | 2.7% | 22.5% | 2.4% | 0.3% | icf_l10 ≥ 6: 63.2% of 38 | pts_avg ≥ 1 · sog_sd ≥ 1.169 · ven_iff ≥ 4.667: 35.0% of 20 |
| LW2 | 375 | 28.8% | 14.9% | 6.1% | 3.5% | 21.9% | 3.2% | 1.3% | icf_l10 ≥ 6: 65.7% of 35 | iff_avg ≥ 4.409 · pts_l5 ≥ 1 · sog_sd ≥ 1.414: 47.4% of 19 |
| RW2 | 374 | 30.7% | 11.2% | 4.5% | 2.1% | 17.9% | 2.7% | 0.3% | icf_l10 ≥ 6: 44.7% of 47 | sog_max ≥ 6 · ven_iscf ≥ 3.5 · ven_s3 ≥ 0.667: 22.2% of 18 |
| C3 | 375 | 18.1% | 8.3% | 3.7% | 1.3% | 16.0% | 1.3% | 0.0% | icf_l10 ≥ 6: 31.6% of 19 | — |
| LW3 | 365 | 17.5% | 7.1% | 2.7% | 0.8% | 12.9% | 1.9% | 0.0% | — | — |
| RW3 | 363 | 16.5% | 5.2% | 1.7% | 0.6% | 16.0% | 2.2% | 0.6% | — | — |
| C4 | 363 | 11.6% | 4.7% | 0.6% | 0.0% | 11.6% | 0.6% | 0.0% | — | — |
| LW4 | 346 | 7.5% | 2.0% | 1.4% | 0.3% | 9.2% | 1.2% | 0.0% | — | — |
| RW4 | 335 | 8.4% | 2.7% | 0.0% | 0.0% | 11.3% | 1.2% | 0.3% | — | — |
| D1 | 754 | 26.0% | 11.0% | 3.8% | 2.0% | 8.8% | 0.7% | 0.0% | icf_l10 ≥ 6: 43.4% of 113 | pts_avg ≥ 1 · ven_iff ≥ 4.667 · line ≤ 1: 30.0% of 30 |
| D2 | 753 | 11.6% | 3.6% | 1.3% | 0.4% | 6.5% | 0.5% | 0.0% | icf_l10 ≥ 6: 18.8% of 16 | — |
| D3 | 738 | 6.1% | 1.9% | 0.3% | 0.0% | 5.4% | 0.1% | 0.0% | — | — |

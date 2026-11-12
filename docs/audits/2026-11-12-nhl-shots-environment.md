# Which defense columns predict shots and goals (2026-11-12)

Vincent, 2026-11-12, of the Matchups rink tinted by the Blues' SOG-allowed rank: "the main driver for shots is ICF,
not shots themselves", then "it should be a combination of SHOTS/G ICF/G IFF/G ISCF/G", "can't we look at the data and
determine which … should weigh more", and "for goals, check whether ISCF/G should be included or not".

**Script.** `tools/predictors/shots_env.py` on the relabelled box scores (`fetch.mjs` → `faceoffs.mjs` → `relabel.py`,
so positions are the ones played, as on PropFinder's table): 2025-26 whole and 2026-27 to Nov 11, 1,602 games.

**Method.** Each defending team's total allowed to a position a game (Shots, ICF, IFF, ISCF, Goals) over its last 10
games (5 at least, this season: PropFinder's L10 tab, the one the rink opens on) and over its season to date, as of the
morning of each game, ranked across the league (rank 1 = allows the most). Every skater-game 8+ games into his season
(44,481 for shots at 0.5+ SOG a game, 45,393 for goals). His own rate = 0.6 × his season + 0.4 × his last ten before
the date; each read enters a Poisson GLM with that rate as the offset, so only what the environment adds over the
skater counts. Scored by 5-fold cross-validation grouped by date: deviance gain per 1,000 skater-games, 95% bootstrap
over dates. Fold noise moves a figure by about ±0.1 to 0.2 between runs; the ordering below held on every run.

## Shots

The four volume ranks overlap heavily (Spearman on the rows, L10): Shots–IFF 0.85, ICF–IFF 0.89, Shots–ICF 0.78,
ISCF with the others 0.62–0.72, Goals with any of them 0.23–0.32.

| Read (rank) | gain, L10 | gain, season to date | 3+ SOG soft − tough third, L10 / season |
|---|---|---|---|
| Shots/G | **1.35** [0.56, 2.11] | **2.90** [1.86, 4.11] | +2.5 / +3.6 pts |
| ICF/G | 1.11 [0.46, 1.79] | 2.26 [1.31, 3.14] | +2.2 / +3.2 |
| IFF/G | 1.01 [0.30, 1.65] | 2.74 [1.66, 3.73] | +2.1 / +3.3 |
| ISCF/G | 0.47 [0.07, 0.93] | 1.74 [0.83, 2.53] | +1.5 / +3.0 |
| mean of the four | 1.19 | 2.81 | +2.2 / +3.4 |
| mean of Shots, ICF, IFF | 1.32 | 2.88 | |
| Shots ×2 + ICF + IFF | 1.09 | 3.04 | +2.5 / +3.5 |
| the four, fitted weights | 1.30 | 2.85 | |

Fitted together (negatives floored), the shares were Shots 0.57 / ICF 0.43 / IFF 0 / ISCF 0 on the last ten and
Shots 0.53 / ICF 0 / IFF 0.43 / ISCF 0.04 on the season: Shots takes about half every time, the other half goes to
whichever of ICF / IFF is the better read on that window (they are 0.89 alike), ISCF gets none.

**Reading.** ICF alone is not the better read: it trails Shots/G on both windows (the first change of the day, tint by
ICF alone, was a step back and is replaced). No combination beats Shots/G alone beyond the noise; what a combination
buys is robustness to one column's noise on a ten-game window. ISCF dilutes it. Shipped: **Shots ×2 + ICF + IFF**
(`shotsEnvRank` in `lib/nhl-data/propfinder-csv.js`), the fitted shares rounded, ISCF out. The effect stays a
tie-breaker: a soft third lands 3+ SOG about 2.5 to 3.5 points more often than a tough third, against his own rate.

## Goals

| Read (rank) | gain, L10 | gain, season to date | 1+ goal soft − tough third, L10 / season |
|---|---|---|---|
| Goals/G | −0.06 [−0.17, 0.02] | −0.07 [−0.25, 0.10] | +0.2 / +0.7 pts |
| ISCF/G | **0.08 to 0.20** [−0.11, 0.41] | **0.29 to 0.35** [−0.06, 0.70] | +0.8 / +1.2 |
| mean of Goals + ISCF | −0.01 to 0.06 | 0.04 to 0.11 | +0.9 / +1.4 |
| mean of ISCF + Shots | 0.03 | 0.28 | +0.9 / +1.4 |
| Goals + ISCF, fitted | 0.04 | 0.27 | |

Fitted together, ISCF/G took 93–98% of the weight and Goals/G 2–7%. **Reading.** The opponent's goals allowed to a
position says nothing about tonight's scorer beyond his own rate (goaltending noise, as section 9 of
`docs/shots-goals-predictors.md` found for team goals allowed); the chances it gives up (ISCF) are the only column
with a signal, small and at the edge of significance. Averaging Goals in halves it. Shipped: the Goals tint and the
goals soft-spot flag read the **ISCF/G rank** (`goalsEnvRank`; Goals/G only where a source has no ISCF), the goals
figure kept on the hover.

## Not changed

The model's own cheat-sheet multiplier (`cheatSheetMajorMultiplier` in `components/nhl/model-core.js`) still leans on
the Goals/G rank for goals (+0.18 in the top ten) and on Shots / IFF / ISCF for shots; the model's math is ported from
the local app and is left as is. The top-5 soft-spot badge (`topSpot`) and the shuffle's Matchup column
(`matchupOf`) still rank by Shots/G and Goals/G.

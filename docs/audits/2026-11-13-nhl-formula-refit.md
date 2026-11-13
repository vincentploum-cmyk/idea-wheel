# The opponent as a team, and shots that follow the posted line (2026-11-13)

Vincent, 2026-11-13, of the drivers study's list (`2026-11-13-nhl-drivers.md`): build 2 and 3 — the opponent's team
shots allowed in the plain-rate formula, and shots that move with the minutes when the posted line moves a skater.
(1, the blend into last season, stays as his 2026-10-27 call has it.)

**Script.** `tools/predictors/formula_refit.py` on the drivers frame and this season's posted lines
(`tools/audit/nhl-toi-lines.mjs`, GameDayTweets); tables in
[2026-11-13-nhl-formula-refit-tables.md](2026-11-13-nhl-formula-refit-tables.md).

Both came out smaller, and differently shaped, than the study's one-line version. What was built is what the fits say.

## 1. The opponent as a team (`TEAM_SHOTS_FIT` in `lib/nhl-data/picks-pure.js`)

**Adding the team read does nothing.** With the position cell left at its 0.687 the team's shots allowed takes an
exponent of 0.006 (z 0.1). The two reads overlap (r 0.67) and the cell already carries the team, at too heavy a
weight: this season skaters facing the tightest fifth of position cells shot 1.18× what the formula said and the
loosest fifth 0.96×. A cell is a few dozen skater-games; the formula read its noise as defense.

**Moving the weight does.** Fitted together over the shipped λ, the team takes 0.63 and 0.53 comes off the cell
(0.687 → about 0.16), the same on every fit:

| fitted on | team | cell | read on 2025-26 | read on 2026-27 |
|---|---|---|---|---|
| 2024-25 + 2025-26 | 0.633 | −0.527 | | −9.9 (−15.2 … −4.8) |
| 2024-25 | 0.631 | −0.548 | −2.2 (−3.4 … −1.0) | −10.2 (−15.7 … −5.5) |
| 2025-26 | 0.630 | −0.504 | | −9.6 (−14.2 … −5.2) |

(Deviance per skater-game ×1000 against the formula as it was, negative = better, 95% interval over dates; the team's
games shrunk to the league at games / (games + 5) within the season, this season's table.) On 2026-27:

| fifth of the position cell | shots / said, as it was | with the team |
|---|---|---|
| tightest | 1.18 | 1.08 |
| 2 | 1.09 | 1.04 |
| 3 | 1.06 | 1.05 |
| 4 | 1.02 | 1.03 |
| loosest | 0.96 | 1.01 |

3+ SOG calls at 50%+: 565 said 61.4% landed 58.2% → 587 said 60.6% landed 58.8%. Brier 0.1514 → 0.1508. Best three a
night 62.9% → 63.8%. The gain is real and modest; it is larger early in a season, when the cells are thinnest
(2025-26 whole: −2.2).

**Shipped.** `project(rates, { …, oppTeam })`: λ shots × (team ratio)^0.63 × (cell ratio)^−0.53, `oppTeam` =
`{ sog, games, league }` from `shotsAllowed` (this season's rows). The picks (`picks.js`) and the scorecard's replay
(`studyRead`) pass it. Without a team read the formula is as it was. Goals untouched: the drivers study found the
environment adds nothing to the goals read.

## 2. Shots follow the posted line's minutes (`lineMoveMultiplier` in `components/nhl/model-core.js`)

**The model already had half of it.** `lineBoost` lifted λ shots 6% a line when the posted line was above the line his
minutes implied, never lowered a demoted skater, and read defensemen on the forwards' minute cuts (17.5 / 15.1 /
12.3), so it fired for 19% of forwards and 4% of defensemen. The drivers study's "the shots λ does not scale with the
projected minutes" was wrong about that.

**What the posted lines show** (7,044 skater-games of 2026-27, 88% from that game's own tweet; "usual line" = the line
whose mean minutes are nearest his last five; the read's level set right):

| | moved | n | minutes played / at his usual line | shots / read |
|---|---|---|---|---|
| forwards | down 2+ | 165 | 0.95 | 0.95 |
| | down 1 | 996 | 0.97 | 0.98 |
| | usual line | 2,520 | 1.00 | 1.00 |
| | up 1 | 841 | 1.03 | 1.04 |
| | up 2+ | 243 | 1.10 | 1.05 |
| defensemen | down 1 | 402 | 0.97 | 0.95 |
| | usual pair | 1,442 | 1.00 | 1.00 |
| | up 1 | 382 | 1.05 | 1.05 |
| | up 2+ | 30 | 1.16 | 1.09 |

The move is symmetric, the same for defensemen, and the size of the minutes. Fitted, shots take the projected-minutes
ratio at 0.70 (0.16 … 1.24); the minutes he then plays follow it at 0.81 and shots follow minutes at 0.99, so 0.8.

| rule | moved up: shots / said | moved down | defensemen up | defensemen down |
|---|---|---|---|---|
| no line term | 1.04 | 0.97 | 1.05 | 0.95 |
| the step replaced (+6% a line, up only) | 1.00 | 0.98 | 1.05 | 0.95 |
| **the minutes ratio ^0.8 (shipped)** | **1.00** | **1.00** | **1.00** | **0.98** |
| the minutes ratio ^1.0 | 0.99 | 1.01 | 0.99 | 0.99 |

**Shipped.** `lineBoost = lineMoveMultiplier(pos, posted line, his minutes, last 5, season) − 1`: the projected
minutes (`projectedToiFromLineup`) at the posted line over the same at his usual line, to the power `TOI_MOVE_EXP` 0.8,
held to 0.88–1.14; 1 without a posted line or on his usual line. It reaches λ goals and λ points at the 0.12 and 0.08
they took of the old boost, now both ways. A forward moved up a line gains about 2–6% instead of a flat 6%, two lines
about 9%; one moved down loses 2–5%; defensemen are read on their own minutes. Port: group 7 of
`tools/port-model-core.mjs`.

**How much it is worth: little.** It moves 44% of skaters by a few percent. Over the plain-rate read the deviance
gain is −0.9 per 1,000 skater-games with an interval across zero (−3.0 … +1.1), no better than the step it replaces
(−0.8); what it fixes is the direction of the error for demoted skaters and promoted defensemen, who were read 2–5%
off. The model's own run could not be replayed here (that needs the scorecard export); the next graded nights are the
check.

## Not changed

The blend into last season (item 1). The goals read. The cheat-sheet environment steps inside the model.

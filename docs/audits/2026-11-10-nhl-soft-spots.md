# Soft spots: the defenses that allow the most shots to a position (2026-11-10)

Vincent, 2026-11-09, after Mason Marchment (1.74 shots a game) put 4 shots on NYI by the middle of the second period
without being on Best bets: *"It was the simple line that NYI allows shots to Marchment and the L10 PropFinder stats
said that the left wing of the Sharks was vulnerable."* Then, 2026-11-10: *"Let's do [the Soft spots list] but the top 5
worst defenses. We should do the same with NBA. We should mark the players in the rinks with the same flame as players
that are on a hot streak."*

Measured on every regular-season skater-game of 2024-25, 2025-26 and 2026-27 to November 9 (85,402 skater-games, each
skater 8+ games into his season) from the public box scores. Each defending team's shots allowed to a position over its
last 10 games (5 at least; the position's total a game, PropFinder's L10 shape, on the box score's position) is ranked
across the league the morning of the game, rank 1 = allows the most. Each skater's own rate is 0.6 × his season + 0.4 ×
his last ten, before the date, with its Poisson 3+ / 4+ chance. Script: `tools/predictors/soft_spots.py`.

## The answer

**The read is real and small.** Against the three defenses that allow the most shots to his position, a skater shot 5%
over his own rate; against the five that allow the fewest, 6% under. Low-volume left wings (Marchment's kind) gained
the most, 10%:

| Opponent's rank at his position (last 10) | Every skater: got ÷ own rate | 3+ expected → landed | Left wings under 2.2 a game: got ÷ own | 3+ expected → landed |
|---|---|---|---|---|
| 1–3 most | **1.054** | 22.5% → 25.3% | **1.101** | 17.9% → 21.2% |
| 4–5 | 1.039 | 22.8% → 24.0% | 1.047 | 18.0% → 21.3% |
| 6–10 | 1.010 | 22.8% → 22.8% | 1.036 | 17.8% → 19.2% |
| 11–22 | 0.993 | 22.8% → 22.6% | 1.019 | 17.4% → 18.6% |
| 23–27 | 0.977 | 22.5% → 21.5% | 0.999 | 17.6% → 17.5% |
| 28–32 fewest | **0.939** | 22.8% → 20.6% | **0.950** | 17.5% → 16.6% |

So a 1.7-shot winger facing a top-five spot goes from about 27% to about 30% for 3+ shots: a better price to take, never
a favourite. The board already reads this (the study λ's opponent table, per skater at the position this season, at an
elasticity of 0.69; the full season predicts better than the last ten, `docs/shots-goals-predictors.md` section 9). On
a night about 40 of 253 skaters face a top-five defense at their position, so the list has to be filtered to regulars.
Marchment that night: NYI ranked 6th in shots allowed per left wing this season (1.95 against the league's 1.69) and
8th over its last ten on the box score's positions (PropFinder's own positions may rank it higher).

## What shipped

- **Best bets, Soft spots** (`softSpotPlays` / `topSpot` / `topSpotText` in `lib/nhl-data/picks-pure.js`, `softSpots` on
  the picks payload, `SoftSpotsTable` in `components/nhl/PicksPanel.jsx`): the slate's skaters whose opponent ranks in the
  top `SOFT_TOP` = 5 at their position for shots, on PropFinder's table above the rink (the tab it opens on, the same
  read as the soft-spot flag and the ice; the stored per-skater table for a team without one), regulars only
  (`SOFT_SPOT_MIN_SOG` = 1.5 shots a game, line 1 or 2, `SOFT_SPOT_MAX_LINE`), the board's own 2+ / 3+ / 4+ and book line,
  the board's 3+ first, twelve then "Show all", graded on 3+ once final with a tally in the head.
- **The rinks' flame**: a chip whose skater sits in a top-5 spot for the rink's metric carries the hot-streak flame, its
  hover naming the spot; hot and in a top spot is one flame with both reasons (`spotFlame` on `Flags` / `flagsFor`).
- **The NBA**: the same list and flame on the NBA board (`docs/claude/nba.md`).

No projection, chance or calibration moved.

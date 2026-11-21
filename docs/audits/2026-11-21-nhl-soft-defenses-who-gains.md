# Soft defenses: who gains, and when they get softer (2026-11-21)

Vincent, 2026-11-21: "What can we do with the defenses that allow more than normal shots?" Follows
`2026-11-10-nhl-soft-spots.md` (the lift is real and small; the board's study λ reads it at an elasticity of 0.69).

**Data.** Public box scores, 2025-26 whole and 2026-27 to Nov 20: 43,006 skater-games (10+ games into his season, 0.5+
shots a game). Each defense ranked each morning on its season-to-date shots allowed per skater at the position group
(F / D; 10+ games), rank 1 = allows the most. His rate = 0.6 × season + 0.4 × last ten, before the date. Because his rate
regresses (low-volume skaters beat it, high-volume ones fall short against every defense), every split is read as
**soft (ranks 1-6) over middle (11-22) within the same group**. Script: `tools/predictors/soft_who_gains.js <games dirs>`.

| Group | soft-6 ÷ middle | 3+ SOG soft vs middle | 4+ soft vs middle |
| --- | ---: | --- | --- |
| Everyone (tough 28-32: 0.91 of middle) | ×1.070 | 25.9% vs 23.3% | 12.4% vs 10.8% |
| Under 1.5 shots a game | ×1.120 | 14.2% vs 11.7% | 4.7% vs 3.8% |
| 1.5-2.5 | ×1.052 | 32.7% vs 30.3% | 15.9% vs 13.9% |
| 2.5-3.5 | ×1.034 | 52.1% vs 50.6% | 30.9% vs 30.1% |
| 3.5+ | ×1.020 | 63.3% vs 64.0% | 45.3% vs 42.1% |
| Forwards, top line (17+ min) | ×1.075 | 46.2% vs 41.3% | 26.0% vs 22.5% |
| Forwards, bottom (under 14 min) | ×1.114 | 14.9% vs 11.8% | 4.8% vs 3.8% |
| Defensemen, top pair (21+ min) | ×1.020 | 26.4% vs 26.9% | 14.1% vs 11.9% |
| Defense on the 2nd night of a back-to-back | ×1.102 | 27.1% vs 23.8% | 13.8% vs 11.7% |
| His team a low-volume team (-6% shots) | ×1.104 | 23.8% vs 19.7% | 10.6% vs 8.9% |
| Home / away | ×1.062 / ×1.076 | | |

Across every defense, the defending team on the 2nd night of a back-to-back gave up ×1.032 against ×0.994 rested
(6,953 skater-games). The study λ reads the skater's own back-to-back (`SHOTS_FIT.b2b` -0.026), not the defense's: a
candidate term, untested cross-validated. Not shipped.

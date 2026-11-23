# Does a tired defense give up more shots? (2026-11-23)

Vincent, 2026-11-23: "Test the tired defense effect for NHL shots", after the soft-defense study
(`2026-11-21-nhl-soft-defenses-who-gains.md`) found defenses on the 2nd night of a back-to-back gave up ×1.03.

**Data.** Public box scores (`tools/predictors/fetch.mjs`), 2024-25, 2025-26 whole and 2026-27 to Nov 20: 82,128
skater-games (10+ games into his season, 0.3+ shots a game). Leak-free: every read from that season's games before the date.

**Method.** Poisson on tonight's shots with his rate (0.6 × season + 0.4 × last ten) as the offset, the opponent's shots
allowed to his position group over the league (10+ games), home and his own back-to-back as the base (the study λ's
terms); then the defense on the 2nd night of a back-to-back. Five-fold cross-validation by date. Script:
`node tools/predictors/tired_defense.js <games dirs>`.

| Season | defense on a B2B (any) | defense on a B2B, his team rested | defense on a road B2B | defense on a home B2B |
| --- | --- | --- | --- | --- |
| 2024-25 | ×1.014 (z 1.2) | ×1.020 (z 1.5) | ×1.039 (z 2.8) | ×0.962 |
| 2025-26 | ×1.037 (z 3.3) | ×1.049 (z 3.7) | ×1.032 (z 2.3) | ×1.045 |
| 2026-27 | ×1.046 (z 1.3) | ×1.053 (z 1.3) | ×1.069 (z 1.6) | ×0.976 |
| Pooled | ×1.027 (z 3.4) | ×1.036 (z 3.9) | ×1.037 (z 3.8) | ×1.008 (z 0.6) |

- Both teams on a back-to-back: ×1.00 (the fatigue cancels). Three games in four nights adds nothing beyond the B2B
  (×1.007); a defense rested 3+ days gives up nothing less (×0.99).
- On the bars, pooled: against a defense on a B2B 3+ SOG landed 23.5% where 22.6% was expected, 4+ 11.3% where 10.4%.
- Cross-validated, the term is worth −0.10 deviance per 1,000 skater-games pooled (−0.02, −0.18, +0.80 a season): real
  and small, a fifth of the soft-spot table's worth.

**Reading.** The steady form is the **road** back-to-back: the defense travelled after last night's game, ×1.03-1.07 in every
season. A home back-to-back is not (×0.96 to ×1.05). Not shipped: about +3.5% shots, a point on a 3+ SOG call.

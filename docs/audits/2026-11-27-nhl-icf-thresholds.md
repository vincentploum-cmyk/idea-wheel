# iCF thresholds for 3+ / 4+ / 5+ SOG, and what the matchup is worth (2026-11-27)

Vincent, 2026-11-27, after asking for players who still shot and scored against elite defenses: "What are the iCF
thresholds that need to pass for getting 3 shots for a player from both defense and player perspective", then "what
does a player need to have and what does the environment have to be to get 3, 4, 5 shots? … a player not the best in
shooting but the defense allows a lot could still get 3 shots, whereas elite shooters in a tough environment can land on
the same", then "Add the ±0.5 iCF environment adjustment to the model" (`matchupIcf` in `components/nhl/model-core.js`).

**Data.** Public box scores (`tools/predictors/fetch.mjs`): 2025-26 whole (1,312 games) and 2026-27 to Nov 25 (391).
45,455 skater-games, each read with what was known that morning: the skater's season-to-date iCF a game (10+ games in),
the opponent's season-to-date iCF allowed per skater at his group (F / D, box-score positions; 10+ games) as a rank
(1 = allows the most) and as a ratio to the league ("env"). 3+ SOG base rate 22.5%. Script:
`tools/predictors/icf_thresholds.py <games dirs>`.

## Elite defenses first (the question before)

Top-5 shot-suppressing teams of 2025-26 (CAR, VGK, OTT, PHI, COL) and goals-against teams (COL, DAL, TBL, CAR, MIN):
the 20 shooters at 3+ SOG a game with 10+ games against them shot ×0.89 of their rate against the rest (×0.92 in
2026-27 so far); 5 of 20 held it (Matthews 4.55 vs 3.61, Boldy, Larkin, Robertson, Guenther). The 56 scorers at 0.35+
goals a game scored ×0.90 (×0.83 in 2026-27). Whether a skater beats elite defenses does not repeat: his elite / rest
ratio, first half of 2025-26 against the second r = 0.02 (shots) / −0.07 (goals), 2025-26 against 2026-27 r = −0.14 /
−0.12. Read the matchup as a multiplier on his rate, never as a per-player "handles tough defenses" trait.

## In the game: attempts → 3+ SOG

| Attempts that night | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|
| 3+ SOG | 11% | 28% | 46% | 63% | 72% | 84% | 87% | 91% |

## His attempts a game coming in (all skaters)

| iCF / game | 3–3.5 | 3.5–4 | 4–4.5 | 4.5–5 | 5–5.5 | 5.5–6 | 6–6.5 | 6.5–7 | 7–8 |
|---|---|---|---|---|---|---|---|---|---|
| 3+ SOG | 20% | 27% | 33% | 38% | 43% | 50% | 57% | 59% | 60% |

Forwards 3–4: 26%, 4–5: 38%, 5–6: 48%, 6–7: 62%, 7+: 62%. Defensemen 3–4: 17%, 4–5: 27%, 5–6: 41%, 6–7: 42%, 7+: 53%.

## The defense: iCF allowed per skater at his group

| Rank | F allows | F 3+ | F SOG vs his rate | D allows | D 3+ | D SOG vs his rate |
|---|---|---|---|---|---|---|
| 1–5 | 3.64 | 28.9% | ×1.062 | 3.51 | 18.1% | ×1.066 |
| 6–10 | 3.50 | 27.9% | ×1.027 | 3.33 | 16.9% | ×1.062 |
| 11–22 | 3.35 | 26.0% | ×0.993 | 3.16 | 15.8% | ×0.999 |
| 23–27 | 3.18 | 24.3% | ×0.973 | 2.94 | 14.7% | ×0.964 |
| 28–32 | 2.95 | 22.4% | ×0.911 | 2.68 | 13.4% | ×0.905 |

## Both: forwards, by env (tough < 0.93, firm 0.93–1.0, loose 1.0–1.07, soft > 1.07; 17 / 30 / 42 / 11% of games)

| His iCF (SOG) a game | 3+ tough | firm | loose | soft | 4+ tough | firm | loose | soft | 5+ tough | firm | loose | soft |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2.5–3.5 (1.5) | 18.0 | 17.9 | 20.6 | 24.2 | 7.0 | 7.0 | 8.0 | 9.2 | 2.5 | 2.5 | 2.9 | 3.3 |
| 3.5–4.5 (2.1) | 27.9 | 32.7 | 35.5 | 36.5 | 14.2 | 15.7 | 15.9 | 20.8 | 5.1 | 7.2 | 6.7 | 8.9 |
| 4.5–5.5 (2.5) | 39.4 | 42.3 | 44.4 | 42.5 | 18.8 | 23.2 | 23.8 | 24.3 | 9.6 | 10.8 | 12.5 | 9.3 |
| 5.5–6.5 (3.0) | 53.1 | 53.7 | 59.5 | 60.4 | 27.4 | 32.1 | 34.8 | 36.4 | 14.5 | 16.1 | 19.6 | 21.4 |
| 6.5+ (3.5) | 55.9 | 59.7 | 64.8 | 65.2 | 33.2 | 38.4 | 45.0 | 42.5 | 19.8 | 23.9 | 25.3 | 24.3 |

Defensemen (same cuts, 3+): 4.5–5.5 iCF 29.5 / 31.9 / 30.6 / 28.8%, 5.5–6.5 47.0 / 46.0 / 43.3 / 50.6%: flat.

**Fitted** (Poisson, SOG = A × iCF^b × env^c): forwards b 0.890, c 0.650; defensemen b 0.961, c 0.625. For forwards
the matchup is worth iCF × env^0.73, about one attempt a game from env 0.88 to 1.12. iCF a game needed:

| Forwards | env 0.88 | 0.95 | 1.00 | 1.05 | 1.12 |
|---|---|---|---|---|---|
| 3+ at 50% | 6.1 | 5.7 | 5.5 | 5.3 | 5.1 |
| 4+ at 33% | 6.6 | 6.3 | 6.0 | 5.8 | 5.6 |
| 5+ at 20% | 7.1 | 6.7 | 6.5 | 6.3 | 6.0 |

Defensemen (fitted): 3+ at 50% 7.4 → 6.3; 4+ at 33% 8.0 → 6.8; 5+ at 20% 8.5 → 7.3; the real rates do not follow.

**Head to head (forwards).** 3.5–4.5 iCF against a soft defense: 2.21 SOG, 3+ 36%, 4+ 21% — 4.5–5.5 against a tough
one: 2.23, 39%, 19% (even: one band is closed). 4.5–5.5 soft: 2.42, 42%, 24%, 5+ 9% — 5.5+ tough: 2.85, 55%, 30%, 17%
(the higher shooter). The environment closes about one attempt a game, not more.

## What changed

`matchupIcf(posKey, icfSeason, teamPos, defenseAvg)`: a forward's season iCF × (the opponent's iCF allowed at his
position on the cheat-sheet table over the league's mean)^0.73, the shift held to ±0.5 (`ICF_ENV_EXP`,
`ICF_ENV_MAX_SHIFT`). The gates that compare his iCF with a threshold read it in place of his raw figure: the shot volume
gate, the shot explosion engine, the 4+ / 5+ gate, the RW shot filter and the RW elite-volume cap. Defensemen keep their
own iCF; λ's own opponent read (`defMult`) is unchanged, so the shift reaches the published odds only through those
gates (tiers, caps and `shotBias`). Port group 8 of `tools/port-model-core.mjs`; `__tests__/nhl-model-icf-env.test.js`.
Not replayed through the model's scorecard (the model's inputs for past slates are not stored here): grade it on the
History tab's scorecard over the coming weeks.

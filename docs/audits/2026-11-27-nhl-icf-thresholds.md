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
gate, the shot explosion engine, the 4+ / 5+ gate, the RW shot filter and the RW elite-volume cap. Defensemen kept their
own iCF here (they move too since later the same day: "Defensemen" below); λ's own opponent read (`defMult`) is unchanged, so the shift reaches the published odds only through those
gates (tiers, caps and `shotBias`). Port group 8 of `tools/port-model-core.mjs`; `__tests__/nhl-model-icf-env.test.js`.
Not replayed through the model's scorecard (the model's inputs for past slates are not stored here): grade it on the
History tab's scorecard over the coming weeks.

## Goals: iSCF thresholds and the matchup (same day)

Vincent: "now do the same for goals with iSCF thresholds" (`matchupIscf`). Same games, 45,450 skater-games read the same
way with iSCF (scoring chances) in place of iCF and goals as the outcome; 1+ goal 15.7% (forwards 19.7%, defensemen
7.7%), 2+ 1.8%. Script: `tools/predictors/iscf_thresholds.py <games dirs>`.

**In the game:** 0 chances 1+ 2.9%, 1: 11.7%, 2: 20.4%, 3: 29.4%, 4: 34.6%, 5: 40.3%, 6: 43.3%, 7: 50.5%.

**His iSCF a game coming in (forwards):**

| iSCF / game | 1–1.25 | 1.25–1.5 | 1.5–1.75 | 1.75–2 | 2–2.25 | 2.25–2.5 | 2.5–2.75 | 2.75–3 | 3–3.5 | 3.5+ |
|---|---|---|---|---|---|---|---|---|---|---|
| 1+ goal | 11.9% | 14.1% | 16.9% | 18.2% | 21.9% | 24.7% | 27.4% | 27.4% | 32.6% | 37.5% |
| 2+ goals | 0.7% | 1.1% | 1.4% | 2.0% | 2.6% | 3.7% | 4.3% | 4.1% | 5.4% | 7.4% |

Defensemen: 0.8–1 8.8%, 1–1.2 9.4%, 1.2–1.5 14.2%, 1.5+ 19.7%.

**The defense, iSCF allowed per skater at his group (forwards):** ranks 1–5 (×1.11 the league) goals ×1.137 his rate,
1+ 22.2%; 6–10 ×1.013; 11–22 ×0.974; 23–27 ×0.927; 28–32 (×0.88) ×0.950, 1+ 18.6%. Defensemen: ×1.13 / ×1.12 / ×0.98 /
×1.15 / ×0.87, no order.

**Both (forwards, 1+ goal by env: tough < 0.92 / firm / loose / soft > 1.08; 16 / 32 / 37 / 14% of games):**

| His iSCF a game | tough | firm | loose | soft |
|---|---|---|---|---|
| 0.75–1.25 | 9.1% | 11.0% | 10.6% | 11.7% |
| 1.25–1.75 | 14.6% | 15.3% | 14.8% | 18.8% |
| 1.75–2.25 | 20.4% | 18.6% | 19.8% | 23.7% |
| 2.25–2.75 | 24.7% | 25.6% | 26.0% | 29.1% |
| 2.75+ | 29.0% | 32.3% | 32.8% | 36.9% |

**Fitted** (Poisson, goals = A × iSCF^b × env^c): forwards b 1.059, c 0.778 → the matchup is worth iSCF × env^0.74
(×0.91 at env 0.88, ×1.09 at 1.12); with his own goal rate in the fit, env^0.82, so the read is not his iSCF standing in
for finishing. The opponent's goals-allowed ratio in place of its iSCF-allowed ratio: env^0.32 (the 2026-11-12 finding
again: chances allowed carry the signal, goals allowed are noise). iSCF a game needed for 1+ at 40%: 4.62 at env 0.88,
4.21 at 1.00, 3.87 at 1.12 (few forwards get there: the 3.5+ band hits 37.5%); 2+ at 8%: 4.24 / 3.86 / 3.55. Defensemen
b 1.013, c 0.373 (×0.37 of the ratio) and the rank rows above do not line up: left out.

**Head to head (forwards, 1+ goal):** 1.25–1.75 iSCF against a soft defense 18.8% (0.207 goals a game), 1.75–2.25
against a tough one 20.4% (0.228); 1.75–2.25 soft 23.7%, 2.25–2.75 tough 24.7%; 1.25–1.75 soft 18.8%, 2.25+ tough 27.0%.
As with shots, the environment closes one band (about half a chance a game), not two.

**What changed.** `matchupIscf(posKey, iscfSeason, teamPos, defenseAvg)`: a forward's season iSCF × (the opponent's
ISCF/G allowed at his position on the cheat-sheet table over the league's mean)^0.74, the shift held to ±0.25
(`ISCF_ENV_EXP`, `ISCF_ENV_MAX_SHIFT`), his last-5 iSCF moved by the same ratio (`goalGateSkaterOf`). The goal gates that
test his own iSCF read it: `playerGoalFloorProfile` (the goal floor's level, its caps `max1` / `max2`, `premium1Open`
and `defDamp`, which sets how much of `defenseGoalMultiplier` reaches λ goals), `scorerTierInfo` (the tier and its
`baseMult`), `buildFinisherShooterGate` and `buildFinisherGoalModel`. Not the goal-leak overrides
(`positionGoalLeakOverride`, `buildDefenseRoleMarketBoost`), which already fire on the opponent's goals and chances
allowed, and not `defenseGoalMultiplier` itself. Port group 9 of `tools/port-model-core.mjs` (needs group 8);
`__tests__/nhl-model-icf-env.test.js`. Not replayed through the model's scorecard: grade it on the History tab.

## Points: assists thresholds, and which opponent read carries points (same day)

Vincent: "now do the same for points with assists thresholds"; after the findings below, option 1 ("go with option 1"):
move the points environment off assists allowed onto chances allowed. Same games, 45,455 skater-games; 1+ point 35.8%
(forwards 39.1%, defensemen 29.1%), 2+ 9.5%. Scripts: `tools/predictors/points_thresholds.py`, `points_env_fit.py`.

**His assists a game (forwards):** 0.10–0.15 1+ point 26.6%, 0.20–0.25 32.5%, 0.30–0.35 41.5%, 0.35–0.40 47.1%,
0.40–0.50 50.3%, 0.50–0.60 56.3%, 0.60–0.80 61.8%, 0.80+ 69.8% (2+: 4.4 / 7.2 / 10.6 / 13.3 / 17.1 / 20.2 / 24.9 / 35.5%).
An even-money 1+ point takes about 0.4 assists a game (≈ 0.75 points a game: 0.7–0.8 points 51.6%). Defensemen: 0.30–0.40
33.5%, 0.40–0.50 37.9%, 0.50+ 56.1%.

**The opponent's assists allowed (forwards, by rank):** 1–5 (×1.19 the league) points ×1.065 his rate, 6–10 ×1.019,
11–22 ×0.997, 23–27 ×0.967, 28–32 (×0.80) ×0.938. Defensemen ×1.115 / ×1.026 / ×0.997 / ×1.019 / ×0.968.

**Which read carries points** (Poisson on his points rate + one opponent read, fitted on half the dates and scored on the
other, deviance saved over his rate alone):

| Read added | Forwards | Defensemen | Coefficient (F) |
|---|---|---|---|
| Assists allowed | 30.3 | 3.9 | 0.33 |
| Points allowed | 27.7 | 1.7 | 0.35 |
| Shots allowed | 26.5 | 0.8 | 0.66 |
| iSCF allowed | 68.5 | 5.7 | 0.83 |
| Assists + iSCF | 73.0 | 8.3 | 0.14 + 0.73 |

**The cheat sheet's points multiplier, as a rank term** (`points_env_fit.py`, same split): the Assists/G rank steps as
shipped (+16% / +8% / −12%, the assists part only) −38.7 forwards, −23.7 defensemen (worse than no read); a smooth
assists-rank term +5.6 / −5.8; a smooth ISCF-rank term +42.3 at 0.069 per SD of rank (rank 1 ×1.12, rank 32 ×0.89) for
forwards, −0.0 at 0.007 for defensemen.

**Grid (forwards, 1+ point, his assists a game by the iSCF-allowed env tough < 0.92 / firm / loose / soft > 1.08):**
0.1–0.2 26.5 / 27.2 / 27.6 / 33.0%; 0.2–0.3 34.9 / 32.1 / 34.8 / 39.5%; 0.3–0.4 40.5 / 44.6 / 42.2 / 50.1%; 0.4–0.55
48.4 / 51.5 / 52.7 / 55.2%; 0.55+ 57.7 / 64.1 / 63.1 / 67.0%. By the assists-allowed env the 0.3–0.4 row is only
42.6 / 41.6 / 44.9 / 47.4%.

**Why not the same gate shift as shots and goals.** The model has almost no checks on a skater's own assists: the style
classifier's playmaker index (which also sets his shots and goals multipliers, a Playmaker ×0.90 on shots) and the
defensemen's capability score; the rest of its assist cuts sit in the role overrides that already fire on the opponent's
table. The environment was the weak part: it read assists allowed twice (0.35 of `pointDefenseMult`, and the cheat sheet's
steps).

**What changed.** `cheatSheetMajorMultiplier`'s points branch is `iscfPointMultiplier(iscfRank, posKey)`: ×exp(0.069 per SD
of the opponent's ISCF/G rank at the position), forwards only (`ISCF_POINT_PER_SD`); the Assists/G steps and the soft /
hard counts are out. `pointDefenseMult` (λ points) takes its 0.35 from the opponent's iSCF ratio (ISCF/G allowed at the
position over the league's mean, floor 3.5; no iSCF on the table → 1) in place of its assists ratio; the 0.45 on
`defenseGoalMult` and 0.20 on shots stay. Expected goals read part of λ points (`lambdaGDisplay`, the 1+ point chance in
`buildGoalProbabilityFromPipeline`), so goals take a little more of the iSCF ratio, the direction the goals fit above
supports (0.78). Port group 10 of `tools/port-model-core.mjs`; `__tests__/nhl-model-points-env.test.js`. Not replayed
through the model's scorecard: grade it on the History tab.

## Defensemen (same day)

Vincent: "now do the same for defensemen". Every opponent read tested for defensemen the way points was: his own rate
(shots: his SOG and iCF rates; goals: his iSCF and goal rates; points: his points rate), then one opponent read at his
group, fitted on half the dates and scored on the other (deviance saved over his rate alone; 15,179 defenseman-games,
forwards beside them). Script: `tools/predictors/env_by_group.py`.

| Market | Read | Defensemen | coef | Forwards | coef |
|---|---|---|---|---|---|
| Shots | iCF allowed | **59.6** | 0.626 | 102.5 | 0.651 |
| Shots | SOG allowed | 60.1 | 0.499 | 130.4 | 0.666 |
| Goals | iSCF allowed | −1.2 | 0.432 | 27.6 | 0.820 |
| Goals | goals allowed | 5.2 | 0.236 | 7.8 | 0.330 |
| Points | iSCF allowed | 5.7 | 0.250 | 68.5 | 0.832 |
| Points | assists allowed | 4.0 | 0.173 | 30.3 | 0.326 |

**A correction.** The shots section above read the defensemen's 3+ grid as flat and said their shots barely moved with the
defense. The grid was thin (few defensemen reach 3+); their shots against their own rate ran ×1.066 against the five
loosest defenses to ×0.905 against the five tightest, the forwards' ×1.062 to ×0.911, and held out the iCF read saves 59.6
for them (per game, about as much as the forwards' 102.5 on twice the rows). Goals and points stay as they were: nothing
for defensemen.

**What changed.** `matchupIcf` moves defensemen too, at their own exponent `ICF_ENV_EXP_D` 0.65 (their fit's 0.625 over
0.961), the same ±0.5 hold. It reaches them through the same gates as forwards (the shot volume gate's 4.8, the explosion
engine's 5.0, the 4+ / 5+ gate's 5.0 / 5.8 role paths) and through their baseline's capability profile
(`defensemanBaselineProbabilities` → `defensemanCapabilityProfile`: 4.4 / 5.0 / 5.5 / 6.5 on the shot score; its one iCF
point bonus at 5.0 moves with it). No goal or points shift for defensemen. Port group 12 of `tools/port-model-core.mjs`
(it rewrites part of group 8's `matchupIcf`; the tool now counts an edit a later group revised as ported);
`__tests__/nhl-model-icf-env.test.js`. Not replayed through the model's scorecard: grade it on the History tab.

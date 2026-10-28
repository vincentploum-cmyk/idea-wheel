# Model audit: the slates of 2026-10-27, NHL and NBA

Written 2026-10-28 from the public box scores, with the site's own code. The two appendices
hold every table this report quotes: [the NHL replay](2026-10-27-nhl-replay.md) and
[the NBA rebuild](2026-10-27-nba-rebuild.md). The tools that produced them are in
`tools/audit/` (`npm run audit:nhl -- --date …`, `npm run audit:nba -- --date …`), so the same
audit can be run on any slate from here on.

## What this audit could see, and what it could not

The production store (Supabase) is not reachable from this session: no admin session, no sync
token. So the boards as they were shown last night, with PropFinder's lines and the model run's
λ, were not graded here. Everything below is rebuilt leak-free from public data and the site's
own functions, slate by slate from the season's first night to October 27, which is what gives
the numbers their weight: one slate is anecdote, the season to date is evidence.

| Sport | What was rebuilt | From | Rows |
| --- | --- | --- | --- |
| NHL | The plain-rate read of `lib/nhl-data/picks-pure.js` (`blendRates`, `project`, `positionAllowed`, `pickGame`): since 2026-10-27 the board's goals read, and the stand-in for the run's shots λ that the scorecard compares it against | The NHL API: 190 games this season, 1,312 last season, the centres relabelled from the faceoffs | 6,505 skater-games over 27 slates; 388 on the 27th |
| NBA | The board itself (`lib/nba/picks.js` → `lib/picks/board.js` `buildBoard`, graded by `lib/picks/scorecard.js` the way the store's `gradeSlate` does) on a pull built from ESPN's box scores | ESPN: 56 box scores this season, every player's 2025-26 game log, 1,235 box scores of last season for the prior table, the injury report ESPN attaches to each game | 4,559 chance reads, 30,532 ladder rungs, 4,580 projections over 7 slates; 337 projections on the 27th |

What the NBA rebuild cannot do: the book's lines are not public, so a pseudo line stands in (his
last-ten average floored plus a half, the rung the board itself falls back to) and the chance is
graded at it without a price; the positions are ESPN's (a G reads at SG, an F at SF, as the court
does); the pull's population is the ten most-played players a team plus the players out, which is
what PropFinder's odds-only pull lists (77 players for eight teams on the 27th). The run's shots
λ for the NHL needs the History tab's export (`/api/nhl/data/scorecard?rows=1&from=2026-10-27`,
signed in) and `tools/predictors/grade_blend.py`; that comparison is not in this report.

## The verdict, ranked by what it is worth

1. **NHL: this season's opponent table is the biggest leak.** At eleven games a team the
   per-position table reads 1.5 to 2.4 times as wide as a full season's and correlates 0.25 to
   0.53 with last season's; the goals table 2 to 4 times as wide, correlation 0.09 to 0.28, which
   is noise. The shots coefficient on it (0.687) was fitted on a blended, narrower table, so the
   same coefficient now moves the λ further than the fit allowed for. Every alternative beats
   it: last season's table, the blend, the table shrunk toward the league, and no table at all.
2. **NHL: the top of the shots board is over-confident by 7.5 points**, which at the prices those
   rows draw is negative. The rows the Best bets rule lists said 62.1% and hit 54.6% (487 rows,
   break-even of the said −164); the slate's top ten by P(3+) said 64.8%, hit 55.6%. With the
   formula's own blends the same rows go 59.9% → 62.0%. The goals rows said 39.7%, hit 35.6%.
3. **NBA: the matchup factor from a table of one to five games costs every projection.** With the
   factor off, the MAE is 3.44; at the board's 0.6 it is 3.68; last season's full table reads 3.43.
   Shrinking this season's table toward the league at games / (games + 10) recovers all of it.
4. **NBA: the ladder's chance is over-confident above 60%**: rungs said 65% hit 55%, said 75%
   hit 65%, said 88% hit 75% (30,532 rungs). His spread is about 40% too narrow (the sd of his
   figure against his range is 1.42 on points and rebounds, 1.30 on assists). Widening the sd by
   1.4 improves both halves; shrinking the hit-rate half at n / (n + 6) fixes the main rung.
5. **NBA: a "hot" play is a fade.** Plays flagged hot (his last five at 80%+ over the line) said
   54.5% and hit 35.8% (190 plays), the one cut where the read is nineteen points wrong. The
   last-five weight in the chance (0.3) carries the streak the flag was meant to be colour for.
6. **What moved nothing measurable**: the NHL goal-rate shrink (8, 16, 40: the Brier moves in the
   fourth decimal), the last-five TOI read, the NBA vacated lifts (bias −0.53 with, −0.82
   without, MAE equal). The NBA team ceiling helps (MAE 3.74 against 3.99 without, the bias from
   +1.24 to +0.10). The NBA minutes factor hurts a little (MAE 3.62 against 3.52 without), and
   at its cap it is wrong by design: the 48 rows at × 1.3 read 21.9 minutes for men who played 13.1.

## Last night

### NHL, eleven games, 388 skaters rated

The plain-rate read was well calibrated across the slate (3+ SOG said 19.6%, hit 20.4%; 1+ goal
said 14.9%, hit 12.6%) and poor at the top, which is where the board lives: the shots tables
went 12 of 28 over the floor (43% against a said of about 60%), the goals tables 5 of 15 (33%
against 39%).

| Game | Shots table (said → got) | Goals table (said → got) |
| --- | --- | --- |
| CBJ 4 @ PHI 3 | Werenski 57% → 1 ✗, Fantilli 53% → 2 ✗, K. Johnson 48% (fill-in) → 2 | nobody over the floor; Fantilli 26% → 1 ✓ |
| BOS 1 @ CAR 2 | Pastrnak 62% → 1 ✗, Stankoven 56% → 1 ✗, Blake 56% → 4 ✓, Jarvis 54% → 0 ✗ | Stankoven 38% → 0, Jarvis 37% → 0; Aho 34% (fill-in) → 1 |
| LAK 1 @ CHI 2 | Panarin 66% → 0 ✗, Kempe 61% → 1 ✗, Bedard 53% → 3 ✓ | Kempe 36% → 0 |
| MTL 2 @ STL 0 | Caufield 56% → 3 ✓; McTavish 44% (fill-in) → 5 | McTavish 38% → 0 |
| NYI 4 @ NSH 3 | Schaefer 64% → 2 ✗, Forsberg 62% → 4 ✓, Horvat 61% → 2 ✗ | Horvat 36% → 1 ✓; O'Reilly, Forsberg (fill-ins) → 1 each |
| NJD 5 @ DAL 1 | Hughes 68% → 6 ✓, Johnston 51% → 1 ✗ | nobody over the floor; Hughes 31% → 1 |
| FLA 5 @ WPG 1 | Connor 73% → 3 ✓, Reinhart 57% → 2 ✗, Perfetti 53% → 3 ✓, B. Tkachuk 50% → 1 ✗ | Connor 53% → 0 ✗, Perfetti 44% → 0 ✗, Reinhart 37% → 1 ✓ |
| MIN 3 @ UTA 1 | Boldy 67% → 2 ✗, Kaprizov 55% → 4 ✓, Eriksson Ek 51% → 4 ✓ | Kaprizov 41% → 1 ✓, Boldy 38% → 0, Eriksson Ek 35% → 1 ✓ |
| OTT 1 @ VGK 4 | Eichel 50% → 1 ✗ | nobody over the floor |
| VAN 6 @ ANA 5 | Gauthier 74% → 4 ✓, Sennecke 62% → 1 ✗ | Sennecke 37% → 1 ✓ |
| BUF 2 @ SJS 0 | Thompson 78% → 6 ✓, Celebrini 63% → 4 ✓, W. Smith 56% → 2 ✗ | Celebrini 44% → 0, Thompson 40% → 0, W. Smith 37% → 0 |

Where the misses came from, and what the table did to them:

- **The table put men on the board who did not belong there.** Sennecke read 62% because VAN's
  table says "#1 to RWs, 2.30 a game" after ten games; his own rate is 2.55 shots. Kent Johnson
  read 48% off PHI's "#2 to RWs" on a 2.22 rate. Bedard at 53% off LAK's "#5 to Cs" on a 2.20
  rate (he hit). Under the formula's own blends the same tables list Bedard 61%, Panarin 60%,
  Kempe 57% at CHI, and Werenski 57%, Fantilli 48% at PHI: the shooters, not the matchups.
- **The top rate shooters were simply shut down** (Panarin 0, Werenski 1, Pastrnak 1, Boldy 2,
  Schaefer 2): the variance of a 3+ market, and the reason a 66% should not be a 66% at eleven
  games.
- **The big nights the read had nowhere**: Byfield 6 SOG (#89 of 388 by P(3+)), Broberg 6
  (#113), Zucker 6 (#105), Linus Karlsson 6 (#155), Boeser 6 and a goal (#127), Lekkerimäki
  4 shots and 2 goals (#154), A.J. Greer two goals on two shots. Eight of the eighteen 5+ shot
  nights came from skaters the read put under 25%. That is the shape of the market: the study's
  replay found the same share every season, and no window of his own results finds them either
  (own last 5 / last 10 / season Brier 0.164 / 0.159 / 0.162 against the formula's 0.155 on the
  rows every read covers).
- **Goals**: Connor at 53% and Perfetti at 44% at WPG both blanked; the 1+ goal read above 40%
  hit 36.8% season to date (117 rows), above 50% it is a handful. Nothing in the slate's goals
  suggests a change the season-wide tables do not already ask for.
- **First goals**: Fantilli (CBJ, 10:58), Zacha (BOS, 1:31), Helenius (LAK, 2:31), Bolduc (MTL),
  Duclair (NYI, 3:07), Hischier (NJD, 2:41), Verhaeghe (FLA, 7:27), Eriksson Ek (MIN), Bowman
  (VGK), Greer (ANA), Zellweger (BUF). Two of eleven from a skater on his team's goals table
  (Fantilli, Eriksson Ek), three more from its next line (Hischier, Verhaeghe, Greer); the 1st
  goal tab was not rebuilt here.

### NBA, four games, 337 projections

The board's tables did well on the night: 33 of 52 plays over the floor hit (63%) against a
said of 59%. The projections ran a point under (bias −1.06 on points, MAE 5.6), which is the
Celtics' and Nets' night, not the model's.

| Game | Over the floor | The strip (said → got) |
| --- | --- | --- |
| BKN 124 @ BOS 125 | 6 / 7 | BKN: Randle o3.5 ast 57% → 4 ✓, Demin o3.5 reb 55% → 1 ✗ (Mann o0.5 3PM 63% did not play). BOS: Queta o0.5 ast 62% → 2 ✓, George o4.5 reb 61% → 7 ✓, Walsh o6.5 PRA 60% → 22 ✓, Scheierman o2.5 reb 56% → 4 ✓ |
| DET 97 @ NY 111 | 11 / 20 | DET: Cunningham o7.5 ast 63% → 8 ✓, D. Robinson o3.5 3PM 63% → 2 ✗, Reed o5.5 reb 62% → 9 ✓, Huerter o0.5 3PM 60% → 1 ✓. NY: Hart o9.5 pts 61% → 6 ✗, Shamet o1.5 reb 61% → 2 ✓, Towns o16.5 pts 59% → 27 ✓, McBride o0.5 reb 59% → 1 ✓ |
| SAC 103 @ SA 130 | 11 / 18 | SAC: Hunter o0.5 ast 63% → 2 ✓, Sabonis o12.5 reb 60% → 14 ✓, Acuff o2.5 reb 58% → 3 ✓, LaVine o20.5 pts 57% → 22 ✓. SA: K. Johnson o3.5 reb 63% → 4 ✓, Fox o13.5 pts 61% → 11 ✗, Castle o1.5 3PM 58% → 3 ✓, Wembanyama o10.5 reb 55% → 10 ✗ |
| POR 136 @ LAL 129 | 5 / 7 | POR: Avdija o6.5 reb 56% → 4 ✗, Camara o15.5 PRA 56% → 14 ✗. LAL: Thybulle o0.5 ast 62% → 1 ✓, Reaves o21.5 pts 61% → 26 ✓, LaRavia o0.5 ast 57% → 1 ✓ |

Where the projections missed, and which read did it:

- **Tatum 40 points on a 21 projection**, George 7 assists on 2, Pritchard 4 on 17.5: the
  Celtics' spread on the night, and the reason the floor–ceiling needs widening (see 4 above).
- **Towns 27 and 20 on 12.3 and 11**: DET's table after four games read "#1 against Cs" and
  put × 0.696 on him; at five games that table is noise (finding 3). Kessler's matchup at LAL
  read × 0.541 for the same reason, and he went for 13 and 8 on 7.7 and 4.9.
- **Randle 24 / 9 / 4 on 17.4 / 6.9 / 5.2 and Porter 27 / 12 on 15.2 / 4.4**: a Nets side whose
  expected total was 106.9 (four games of its own average through BOS's environment) and which
  scored 124; NY was expected to score 96.9 and scored 111, DET 114.2 and scored 97. The team
  ceiling is right as a rule (it helped season to date); built on four games of a team's own
  average it is off by fifteen either way, and it deserves the same shrink toward the league as
  the table (finding 3).
- **Hunter 24 points on 6.8, LaVine 22 on 22.1 with Murray, Simmons, Raynaud and Cardwell out**:
  the vacated lift handed LaVine +0.5 points and Hunter, on a 6.8 rate, a share too small to
  show. The lifts are too small to matter either way (finding 6); the production an absence
  frees is landing on men the read does not pick.
- **Reed 22 and 9 with Duren out** on 9 and 6.8: his without-Duren split (15 games, weight
  0.79) was in the read and still said 9; Ausar Thompson 11 on 7.4 with the minutes read
  × 1.14 on him. The split is doing what it should; the night was his.
- **The minutes read's cap**: Saraf (× 1.3, 19 minutes read) and Carlson (× 1.3, 17) did not
  play; Potter (× 1.26) did not play. A × 1.3 on a man the rotation has not been using is a
  prediction that he will be, and the season says it is wrong (13 minutes played against 22 read).

## NHL: the evidence

### The variants on the same 6,505 skater-games (lower Brier is better)

| Variant | 3+ SOG said → hit | 3+ Brier | 1+ goal said → hit | 1+ G Brier |
| --- | --- | --- | --- | --- |
| **As shipped**: this season's rate from his fifth game, this season's table, goal rate shrunk at n / (n + 8) | 20.2% → 21.7% | **0.1501** | 15.0% → 15.3% | 0.1222 |
| The formula as fitted: rates and table blended into last season (study sections 3 and 9) | 20.9% → 21.7% | **0.1459** | 15.5% → 15.3% | 0.1212 |
| Shipped rates, last season's table | 20.8% → 21.7% | 0.1473 | 15.3% → 15.3% | 0.1213 |
| Shipped rates, the table blended across the boundary | 20.6% → 21.7% | 0.1474 | 15.3% → 15.3% | 0.1213 |
| Shipped rates, this season's table shrunk toward the league at games / (games + 15), + 40 for goals | 20.3% → 21.7% | 0.1477 | 15.3% → 15.3% | 0.1214 |
| Shipped rates, no table (the league figure at his position) | 20.8% → 21.7% | 0.1477 | 15.3% → 15.3% | 0.1214 |
| Shipped, goal rate not shrunk / shrunk at 16 / at 40 | — | 0.1501 | 14.8% / 15.0% / 14.9% | 0.1229 / 0.1221 / 0.1221 |
| Shipped, season TOI in place of his last five | 20.2% → 21.7% | 0.1503 | — | 0.1222 |

The gap between the shipped read and the table variants (0.1501 against 0.1473–0.1477) is the
table; the gap between those and the fitted formula (0.1459) is the rate blend. A Brier
difference of 0.004 on 6,500 rows is large: the study's section 13 found the whole environment
read worth about 0.003.

### Why: the table at eleven games

| Position | sd of log shots allowed, this season | last season | ratio | correlation this season to last | sd of log goals allowed, this season | last season | correlation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C | 0.12 | 0.08 | 1.49 | 0.53 | 0.29 | 0.13 | 0.28 |
| LW | 0.17 | 0.09 | 1.87 | 0.25 | 0.39 | 0.13 | 0.11 |
| RW | 0.17 | 0.07 | 2.37 | 0.28 | 0.40 | 0.11 | 0.11 |
| D | 0.14 | 0.09 | 1.54 | 0.53 | 0.46 | 0.23 | 0.09 |

The cut by the opponent's rank says the same in hit rates: skaters facing a "stingy third"
opponent this season said 15.0% and hit 20.3%; facing a "soft third" said 25.4% and hit 22.2%.
The table's thirds, at eleven games, point the wrong way by eight points between them.

### The top of the board by variant

| Variant | 3+ said 50–60%: n · said → hit | 60–70% | 70%+ | Best bets shots rows over the floor: n · said → hit | Goals rows: n · said → hit |
| --- | --- | --- | --- | --- | --- |
| As shipped | 254 · 54.6% → 49.2% | 176 · 64.5% → 56.3% | 84 · 77.0% → 61.9% | 487 · 62.1% → 54.6% | 306 · 39.7% → 35.6% |
| The formula as fitted | 221 · 54.6% → 55.2% | 172 · 64.3% → 69.8% | 30 · 72.9% → 63.3% | 416 · 59.9% → 62.0% | 267 · 39.4% → 37.8% |
| The table blended | 285 · 54.8% → 52.3% | 154 · 64.4% → 62.3% | 59 · 75.0% → 64.4% | 474 · 60.5% → 57.4% | 281 · 39.4% → 37.0% |
| The table shrunk toward the league | 263 · 54.9% → 53.6% | 151 · 63.9% → 64.2% | 56 · 74.8% → 60.7% | 449 · 60.5% → 58.6% | 280 · 39.2% → 36.8% |

### The rate: the hard switch at five games

A skater under five games this season is read on last season's rate outright, from the fifth on
this season's alone. The ones running hot on a held rate (his last five at 1.4× it) said 15.3%
and hit 22.1% for 3+ SOG (435 rows, +6.7); at 5–9 games the hot flag is worth +1.8, at 10+
+5.2. Under the fitted blend the hot cut reads +3.3 overall against +5.6 shipped. The soft blend
(n / (n + 18) for shots and attempts, n / (n + 40) for goals and chances) is what the
coefficients were fitted on; the switch at five games is what replaced it on 2026-10-27.

### The cuts that are fine

Back-to-back (said 19.3%, hit 20.1%), venue (away +0.4; home +2.6, the home coefficient of
0.034 is on the light side), the rate tiers (every tier within two points except 3.0+ shooters,
said 58.4%, hit 55.2%), the goal form flags (hot scorers said 28.9%, hit 27.3%: colour only, as
the study said). Positions: LW runs 3.6 under, D 1.6 under, C 1.2 over; a refit item, not a
change now.

## NBA: the evidence

### The matchup factor

| Read of the projection (4,580 rows) | MAE | bias |
| --- | --- | --- |
| His rate alone × the team scale | 3.44 | +0.15 |
| × this season's table at ENV_WEIGHT 0.6 (the board) | **3.68** | +0.19 |
| × this season's table at 0.3 / 1.0 / 1.5 | 3.51 / 4.03 / 4.59 | |
| × last season's full table at 0.6 | **3.43** | +0.17 |
| × this season's table shrunk at games / (games + 5) / (+ 10) / (+ 20) | 3.46 / 3.45 / 3.44 | +0.15 |

The predictor table says it the scorecard's way: "Last 10" alone has the lowest MAE on every
market (points 5.10, rebounds 2.06, assists 1.47, threes 0.97, PRA 6.92), and every "× matchup"
read is worse than its window (points 5.33, rebounds 2.16, assists 1.54, threes 0.99, PRA 7.39).
A full-season table is neutral; a five-game table costs a quarter of a point on every player.

### The ladder's chance

| Chance (30,532 rungs) | Brier | main rung Brier | 60–70%: n · said → hit | 70–80% | 80%+ |
| --- | --- | --- | --- | --- | --- |
| As shipped: ½ his distribution + ½ his hit rate | 0.1626 | 0.2470 | 2066 · 64.9% → 55.0% | 1877 · 74.8% → 64.6% | 2305 · 87.7% → 74.5% |
| His distribution with the sd × 1.4 | 0.1614 | | 2321 · 64.9% → 56.1% | 1929 · 74.8% → 67.9% | 1719 · 86.3% → 76.3% |
| The hit rate shrunk to ½ at n / (n + 6), then ½ + ½ | 0.1686 | **0.2401** | 2857 · 64.8% → 58.8% | 1971 · 74.2% → 68.6% | 413 · 85.0% → 81.4% |
| 0.6 distribution + 0.4 hit rate | 0.1630 | 0.2476 | 2069 · 64.9% → 55.3% | 1922 · 74.8% → 63.7% | 2219 · 87.8% → 74.1% |

Two separate faults. His distribution is too narrow: his figure lands inside the floor–ceiling
43% of the time (the quartiles promise 50%), beyond two sd 8.7% of the time (a normal gives
4.6%). And the hit-rate half says 90% off a short season window with no shrinkage (the plays'
`chanceOf` shrinks at n / (n + 6) toward the price; the ladder's `emp` does not), which is why the
80%+ rungs hit 74%. The shrink costs overall Brier because it pulls the thousands of rungs under
20% toward 50% too; its place is the main rung and the ceilings, which is where the tables and
the strip read.

### The hot flag

| Form of the play (at the pseudo line) | n | said | hit |
| --- | --- | --- | --- |
| Hot (his last five 80%+ over the line) | 190 | 54.5% | 35.8% |
| Cold | 468 | 41.8% | 38.2% |
| Neither | 3,901 | 48.3% | 40.9% |

### The reads that move a figure, season to date

| Rows | n | bias with the read | without it | MAE with | without |
| --- | --- | --- | --- | --- | --- |
| A vacated lift | 265 | −0.53 | −0.82 | 4.64 | 4.61 |
| A minutes factor | 4,198 | +0.26 | −0.09 | 3.62 | 3.52 |
| A team scale under 1 | 3,155 | +0.10 | +1.24 | 3.74 | 3.99 |

| Minutes factor | n | minutes read | behind the rate | played | bias (pts) | bias without the factor |
| --- | --- | --- | --- | --- | --- | --- |
| under 0.9 | 52 | 16.0 | 19.0 | 17.6 | −1.09 | −0.06 |
| 0.9–1.1 | 606 | 27.1 | 26.7 | 25.9 | −0.38 | −0.54 |
| 1.1–1.2 | 127 | 26.4 | 23.1 | 21.1 | +2.33 | +0.89 |
| 1.2–1.3 | 55 | 26.1 | 21.0 | 19.5 | +1.13 | −0.98 |
| 1.3, the cap | 48 | 21.9 | 15.0 | 13.1 | +4.05 | +1.98 |

The factor is right in the middle and wrong at both ends: a man read for fewer minutes played
more, a man read for many more played fewer. The vacated minutes hand-off (the out players'
minutes to the ones who play) is what pushes a bench man to the cap.

### The blend of his windows

OWN_WEIGHTS (last ten 0.35, season 0.65) is on the flat part of the curve: the MAE at a last-ten
weight of 0 / 0.35 / 0.5 / 1 is 3.41 / 3.32 / 3.31 / 3.45. Nothing to change.

### The first week

The chance at the pseudo line ran 11 to 17 points high on the season's first three slates
(35%, 31%, 39% hit against 47–48% said) and 0 to 7 high from the 24th on. Last season's
averages overstate the first week's production (new roles, deep rotations, blowouts), and with
`seasonCap` at 82 they are most of the window until the season is a few weeks old. Time fixes
it; the sd should carry it meanwhile (finding 4).

## What to change, in order

Nothing in the model's numbers was changed by this audit. Each item names the evidence, the
edit and the file; each is one constant or one line.

1. **NHL: stop feeding the raw this-season table into the formula.** Either restore the blend the
   coefficients were fitted on (games / (games + 15) for shots, + 40 for goals, into last season's
   row: Brier 0.1459, the board's shots rows from 62% → 55% to 60% → 62%), or, if the call that no
   last-season number enters a read stands, shrink this season's cell toward the league's average
   per skater at the position at the same strengths (0.1477; the rows 60.5% → 58.6%). Where: the
   `sog` / `g` a cell carries in `positionAllowed`, `lib/nhl-data/picks-pure.js`; the display
   tables on the Defense tab and above the rinks stay this season's as they are. The audit's
   `tableShrunk` variant is the second option written out (`tools/audit/nhl-audit.mjs`,
   `shrunkOpp`).
2. **NBA: damp the matchup by the games behind it.** `matchupOf` in `lib/picks/projection.js`:
   the factor's deviation from 1 × gp / (gp + 10), `gp` already rides on the cell
   (`allowed.rows[pos].gp`); the cheat sheet's read, with no game count, at the same weight as the
   table it stands beside. Expected: MAE 3.68 → 3.45 on every projection, and Towns at × 0.70 and
   Kessler at × 0.54 read near 1 until the table has earned it.
3. **NBA: widen his spread and shrink the ladder's hit rate at the main rung.** `ladderOf` in
   `lib/picks/board.js`: `sd = max(1.4 × sdRaw, 0.25 × proj, step / 2)` (Brier 0.1626 → 0.1614,
   the 70–80% rungs from 64.6% to 67.9% hit) and `emp` moved toward 0.5 at n / (n + 6) the way
   `chanceOf` already moves the plays' chance (the main rung's Brier 0.2470 → 0.2401, the 80%+
   rungs from 74.5% to 81.4%). Revisit the 1.4 at twenty games: part of it is the first week.
4. **NBA: take the streak out of the chance.** `WEIGHTS` in `lib/picks/board.js`: the last five
   from 0.3 to 0.15, the season to 0.55 (the hot cut's 190 plays said 54.5% and hit 35.8%; the
   flame stays as colour). Grade it on the next week's slates with `npm run audit:nba`.
5. **NHL: soften the switch at five games.** `blendRates` in `lib/nhl-data/picks-pure.js`: this
   season's rate into last season's at n / (n + 18) for shots and attempts, n / (n + 40) for goals
   and chances, as fitted (the remaining 0.0015 of Brier; the hot-on-a-held-rate rows from +6.7
   to about +3).
6. **NBA: cap the minutes factor's upside.** `FACTOR_MAX` in `lib/picks/rotations.js` from 1.3 to
   1.15, and the vacated minutes shared only among the players with ten minutes a game behind
   their rate (the 48 rows at the cap read 22 minutes for men who played 13).
7. **Leave alone**: the goal-rate shrink (8), the last-five TOI read, OWN_WEIGHTS, the team
   ceiling, the vacated lifts (right in direction, small in size; let them be).
8. **Grade the run's shots λ** the same way: export the scorecard rows (`?rows=1`) and run
   `tools/predictors/grade_blend.py`; the question whether the run beats the plain-rate read on
   shots is the one this report cannot answer from outside.

## Rerunning this audit

```bash
node tools/predictors/fetch.mjs 2026-10-01 $(date -u +%F) .nhl-data/predictors/2026/games
node tools/predictors/faceoffs.mjs .nhl-data/predictors/2026/games .nhl-data/predictors/2026/faceoffs.json
python3 -I tools/predictors/relabel.py .nhl-data/predictors/2026/games .nhl-data/predictors/2026/faceoffs.json .nhl-data/predictors/2026/games-pos
npm run audit:nhl -- --date 2026-10-28
npm run audit:nba -- --date 2026-10-28 --prior .nhl-data/audit/nba/prior/games
```

`tools/audit/README.md` has the ESPN pulls the NBA script reads. Both scripts write their report
and a CSV of every rated row to `.nhl-data/audit/out/`.

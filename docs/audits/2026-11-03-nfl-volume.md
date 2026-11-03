# The volume study: what predicts a player's targets and carries tonight (2026-11-03)

Vincent, 2026-11-03: "yes run the volume study", after `2026-11-03-nfl-predictors.md` found that most way-off receiving
and rushing games are volume swings (in half of a receiver's or a back's games his targets or carries move 40% or more off
his usual, and 60% of the way-off games come from those).

## How it is scored

Case by case, as the predictors study: every player-game of 2026's weeks 1–7, the fits made on 2025's weeks 4–18 only.
Targets: close within ±1 of what he got, near ±2, way off by more than 4. Carries: ±2 / ±4 / more than 7. Yards: ±10 /
±20 / more than 30. A teammate is **missing** when he was a regular (a touch in 3 of the team's last 5 games this season),
is still on the team (no game for another team since) and has no touch tonight: the replay reads it off the game, standing
in for the injury report the board has before kickoff. `tools/audit/nfl_volume.py` prints every table (`--json` writes them).

## The ceiling: what volume is worth

If we knew a player's targets or carries tonight (his real count × his own yards a target / a carry over his last 17,
pulled toward his position's):

| | The best read (form) | Knowing his volume |
|---|---|---|
| Receiving yards within ±10 | 28.2% | 43.4% |
| Receiving yards way off | 25.7% | 14.5% |
| Rushing yards within ±10 | 18.5% | 53.6% |
| Rushing yards way off | 31.1% | 10.4% |

Volume is most of the miss. The question is whether anything known before the game reads it.

## What predicts the volume

| Read | Targets: close · near · way off | Carries: close · near · way off |
|---|---|---|
| His own last 5 games | **34.7%** · 62.0% · 11.2% | **32.4%** · 57.2% · 16.7% |
| His last 17 | 30.0% · 57.8% · 11.4% | 27.9% · 55.4% · 21.2% |
| His share (last 5) × the team's volume (last 5) | 32.6% · 59.7% · 11.7% | 31.1% · 55.0% · 20.7% |
| … with the missing teammates' share handed out | 28.5% · 53.5% · 15.6% | 24.8% · 49.5% · 27.0% |
| Fit: last 3 / 5 / 17 | 31.1% · 60.1% · 11.0% | 30.2% · 55.4% · 17.1% |
| Fit: + share × team + missing / returning teammates | 33.3% · 60.7% · 11.1% | 26.6% · 58.1% · 17.1% |
| Fit: all of it + the line | 33.6% · 61.4% · 10.7% | 27.5% · 58.6% · 16.7% |

(694 receiver games, 222 back games.) His own last five games lead both. The fits pull every player toward the middle and
lose the stars (St. Brown 12.6 targets over his last five, the fit 9.9, he got 11); the line moves nothing.

**The yards on the volume read**: receiving 29.6% close (form 28.2%, the gap +1.3, 95% interval −1.3 to +4.0), rushing
21.6% (18.5%, +3.2, −1.8 to +8.6). No gain past the noise: the volume read is his own recent volume, and his yards already
carry it.

## Teammates out: the hand-over

**The vacated lift** (`lib/picks/injuries.js` `vacatedLifts`; on the NFL board at `VACATED_SHARE` = 0.6): his last five
lifted by λ × the share his missing same-group teammates leave.

| λ | Targets close (all) | Targets close, a teammate missing (224) | Carries close (all) | Carries close, a teammate missing (77) |
|---|---|---|---|---|
| 0 | 34.7% | 35.7% | 32.4% | 33.8% |
| 0.1 | 33.4% | 32.6% | 33.8% | 37.7% |
| 0.3 | 32.9% | 31.2% | 30.6% | 28.6% |
| **0.6 (the board)** | 31.8% | **29.0%** | 26.1% | **16.9%** |
| 1.0 | 31.8% | 28.6% | 26.1% | 15.6% |

Every hand-over past a tenth reads worse, and worst in the very games it is for. The share a missing player leaves does not
go to the teammates in proportion to their share: it is spread, or taken by a backup the read does not know, or the team
throws less.

**The without split** (`withoutOf`, his games this season without tonight's missing teammates, at n / (n + 4)): on the 127
receiver games with a split, targets close 32.3% on his last five alone, 26.8% with the split (−5.5 points, 95% interval
−11.0 to −0.8); the 41 back games −2.4 (−9.8 to +4.9).

## What shipped

The NFL's cocktail (`lib/nfl/picks.js` `COCKTAIL`): `vacatedShare: 0` and `without: false` — a teammate out tonight moves no
NFL player's read. `lib/picks/board.js` gained the `without` key (default true: the NBA and the NHL boards read as before)
and skips the lifts when `vacatedShare` is 0. The "if role confirmed" word stays beside a name when a regular at his
position group is out (a touch in 3 of his own last five games' dates), its hover saying the projection reads his own
games (`roleOf`'s `regularsOut`).

Week 8 rebuilt before and after (the stored pull of Nov 1 with ESPN's injury feed), on the players who played:

| | With the hand-over | Without |
|---|---|---|
| Receiving yards: close / way off (134) | 27.6% / 29.9% | 32.1% / 24.6% |
| Rushing yards: close / way off (63) | 20.6% / 34.9% | 22.2% / 33.3% |
| Receptions: close (±1) / way off (>3) (142) | 41.5% / 13.4% | 40.8% / 12.0% |

## Open

- The volume is still the miss (43% close with it known against 28–30% without). What would read it before the game is
  not in the data the replay holds: snap counts and routes run, the depth chart week by week, practice reports. PropFinder's
  game rows carry `tgtShare` / `rushShare` / red-zone looks for 2026 (sparse); the shares were read here from the targets
  and carries themselves.

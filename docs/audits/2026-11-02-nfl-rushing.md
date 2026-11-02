# The NFL rushing yards (2026-11-02)

Vincent, 2026-11-02, after the passing read: "Same for rushing yards. They are also far off". On week 8's Sunday games
the rushing list (92 names) missed by 27.8 yards a player who played, and 28 of the 92 never played.

## What was wrong

**The lists carried players who were not on the team.** Every pulled NFL player carries PropFinder's roster `status`
(ACT, PRA = practice squad, OFF_ROSTER, IR, IRD = IR designated to return, PRA_IR, PUP, NON = non-football injury, SUS,
EXE). The board never read it; it read ESPN's injury feed, which does not list a player who is gone. On the pull of
Nov 1, 440 of the skill players were ACT and 511 OFF_ROSTER. On week 8:

| List | Listed | Never played | … of them not ACT | Played and not ACT |
|---|---|---|---|---|
| Rushing | 92 | 28 | 25 (15 OFF_ROSTER, 8 IR / IRD, 2 PRA) | 1 (PRA) |
| Receiving | 222 | 79 | 69 | 4 (PRA) |
| Touchdowns | 391 | 176 | 149 | 6 (PRA) |

Zack Moss on Cincinnati (last game November 2024), Gus Edwards on the Chargers, James Conner and Trey Benson on Arizona's
IR, Amari Cooper on Las Vegas, Tyler Boyd on Cincinnati: each projected off games from a season or two ago.

**A back's projection is not the problem.** On the active backs of the rushing list the board misses by 24.4 (2025) /
24.0 (2026) with no bias (+2.7 / −0.3), and nothing tried beats it out of sample:

| Read (RBs, listed, active) | 2025 (fitted) | 2026 weeks 1–7 |
|---|---|---|
| The board | 24.43 | 23.95 |
| His last 5 and last 17 active games | 24.91 | 24.08 |
| … + his carries over the last 3 | 24.72 | 23.86 |
| … + his share of the team's carries × the team's carries | 24.90 | 24.10 |
| … + carries, the spread and the total | 24.70 | 23.91 |
| … + carries and the defense (RB rushing allowed) | 24.69 | 23.80 |

The best is 0.15 yards better, inside the noise. A back's rushing yards are the game's own swing (a mean of ~45, a miss of
~24); the share of carries, yards a carry, the game script and the defense are already in what his recent games say.

**The quarterbacks' rushing ran high on the rushing list** (bias −1.5 on 2026's listed starts): the board averaged every
logged game, a scramble-heavy stretch of a season ago weighing as much as last week.

## The data

The same as the passing study (`2026-11-02-nfl-passing.md`): PropFinder's logs from the three stored pulls, ESPN's box
scores and lines, the site's replay (`nfl-pf-audit.mjs --dump`, which now carries each game's carries, targets, attempts
and whether he was active). `tools/audit/nfl_rushing.py` prints every table here.

## What shipped

**PropFinder's roster status** (`lib/nfl/roster-status.js`, `applyRosterStatus`, run first in `lib/nfl/picks.js`
`makeBuild`): a player whose status is IR, IRD, PRA_IR, PUP, NON, SUS, EXE, OFF_ROSTER or PRA leaves the board — no row, no
list, no ladder; a player the injury feed already has out is left as he was; ACT, no status or an unknown one stays.
`data.rosterStatus` counts them. Week 8 rebuilt with it:

| List | Listed | Never played |
|---|---|---|
| Rushing | 92 → 66 | 28 → 3 |
| Receiving | 222 → 149 | 79 → 10 |
| Touchdowns | 391 → 236 | 176 → 27 |

- The ten receivers left are ACT players who recorded nothing (or whom ESPN's box spells otherwise: "Kenny" Gainwell,
  140 rushing yards, is PropFinder's Kenneth — the name match is its own fix).
- **Left off, not marked out** — the measured choice. Marked out, they handed their share to the teammates through the
  vacated lifts (`VACATED_SHARE`, never checked on the NFL): 116 receivers moved (Kelce 57 → 74), receiving read 23.5 →
  23.9 a player, rushing 26.6 → 25.9 — one week, both ways, and no replay can check it (the stored pulls have no status
  history). Left off, the players who play keep their projections (moves under a yard, from the team totals no longer
  counting the absent: receiving 23.88 → 23.92, rushing 27.32 → 27.30).
- A practice-squad call-up who plays is not on the board that day (4 receivers and 1 rusher on week 8).

**The quarterback's rushing read** (`QB_RUSH`, `qbRushRead` in `lib/nfl/projections.js`): his rushing yards a start over his
last 17 starts (10+ attempts), pulled toward 8 at n / (n + 3), for the starter (a backup on ESPN's chart, or one without a
start, keeps the board's read); his own spread and `RESID.rush_yds` as before.

| QB rushing, through the site's replay | 2025 | 2026 weeks 1–7 |
|---|---|---|
| Every start: board → read | 12.38 → 11.96 | 11.63 → 11.37 |
| On the rushing list: board → read | 14.85 → 14.32 | 14.39 → 13.45 |

- The gain on 2026: −0.3 a start on every start (95% interval −1.0 to +0.4), −1.0 on the listed (−2.1 to 0.0). Small.
- The rungs land closer, both seasons: on 2026 strong said 66% and landed 65% (the board 67% → 59%), lean 51 → 50,
  thin 36 → 34; log loss 0.3823 → 0.3672 (2025 0.4627 → 0.4468).
- The first fit was on the listed quarterbacks alone (15 / 10): it read 13.7 there and worse than the board on every start
  (11.69 against 11.63) — chosen on a population the board's own read had picked. Refitted on every start.
- The line and the defense added nothing (13.72, 13.55 against 13.67 on the listed).

## Open

- The backs: nothing beat the board. The next levers are the ones the replay cannot see: who is active tonight (the
  status above), the depth chart's RB1, a teammate out (`VACATED_SHARE` on the NFL, unmeasured).
- Elevated practice-squad players: ESPN's game-day inactives would bring them back; not read.

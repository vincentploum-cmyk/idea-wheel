# The NFL passing yards, rebuilt (2026-11-02)

Vincent, 2026-11-02, after grading week 8 against the board stored before kickoff: "We need to work on the passing yards
because nothing hit and our predictions are not even close to the actual". On week 8's Sunday games the passing list
missed by 84 yards a quarterback (16 listed), the strong rungs hit 7 of 16.

## What was wrong

- **The board averaged every game in a quarterback's log.** PropFinder's logs carry a row for every game he was
  rostered: the weeks he sat as the backup (0 attempts), a two-throw relief, an early exit. The board's generic read
  (season 0.65 · last ten 0.35 of every row) counted them all.
- **So a starter read low.** On the starts themselves (15+ attempts): 2025 projected 206, thrown 224; 2026 projected 216,
  thrown 230. A flat league average for everyone missed by less than the board (59.4 against 64.6 a start on 2026's
  weeks 1–8).
- **The rungs inherited it.** On the same starts the strong rung said 66% and landed 72%: the marks sat too low.

## The data

- PropFinder's logs from the site's three stored pulls (the `nfl-pf-export` artifact of 2026-11-01: w06, w07, w08, the
  last pulled at 05:39 UTC on Nov 1, before week 8's Sunday games), every quarterback back to 2024.
- ESPN's box scores and lines (the summary's pickcenter) for 2025's 272 and 2026's 120 finished games
  (`tools/audit/nfl-fetch.mjs`).
- Population: every start (15+ attempts in ESPN's box score) whose quarterback has a start before it. Fitted on 2025's
  weeks 4–18 (430), checked unchanged on 2026's weeks 1–8 (233; week 8 = the 21 Sunday and Monday starts, Thursday's
  game left out because the pull was made after it).
- `tools/audit/nfl_passing.py` builds the table and prints every read below; `nfl-pf-audit.mjs --dump` now carries the
  game's attempts so the site's replay can be scored on the starts.

## The reads, average miss a start

| Read | 2025 (fitted) | 2026 weeks 1–8 (unseen) | Bias on 2026 |
|---|---|---|---|
| The board as it was | 62.2 | 64.6 | +14.8 |
| The league's average for everyone | 59.0 | 59.4 | +3.7 |
| His last 17 starts (10+ attempts) | 58.4 | 58.8 | +3.2 |
| … pulled toward 225 at n / (n + 6) | 56.9 | 57.4 | +3.4 |
| … + the game total | 54.8 | 56.4 | +3.1 |
| … + the total and his team's spread | 53.5 | 56.2 | +4.2 |
| … + the total, the spread and the defense (shipped) | 53.1 | **55.8** | +4.2 |

- **The starts are the fix:** −7.2 yards a start against the board on 2026 (95% interval −12.0 to −2.4, paired bootstrap).
- **The line:** the total and the spread add −1.3 on 2026 (interval −3.5 to +1.0) and −3.4 on 2025. A shootout means more
  passing; the favourite throws for more than the underdog at the same total (his team's implied points carry the
  offense's quality the book sees).
- **The defense:** PropFinder's passing yards allowed to quarterbacks a game over the league's, at gp / (gp + 8): −0.4 on
  2026 (interval −1.0 to +0.2), the same way on 2025. Small, kept: the coefficient (0.48 a yard) is what it is worth.
- **Also tried, not kept:** this season's starts beside the 17 (no gain), the last 34 starts, attempts × yards an attempt
  (overfit: 56.4–57.2 on 2026), home (nothing), the board's own read rescaled.
- **The books:** week 7's main lines missed by 55.0 (23 passers, the Oct 21 pull); the new read through the site's code
  54.2 there (66.7 before). Week 8's lines missed by 66.2 on the 21 starters priced (the old read 70.2, the new 68.3,
  Mayfield's three-throw exit left out): a week nobody read, the two highest totals (54.5) threw 195 and 119, the lowest
  (38.5) 324.

## The shipped read (`PASS`, `passRead` in `lib/nfl/projections.js`)

- proj = 131.44 + 0.4064 · own + 3.9336 · (total − 44.5) + 3.6077 · fav + 0.4828 · def
  - own = his passing yards a start over his last 17 starts of 10+ attempts (any season, playoffs in), pulled toward 225
    at n / (n + 6);
  - total = the book's total (44.5 without a line); fav = his team's implied points over half the total (half the spread,
    + for the favourite);
  - def = PropFinder's QB passing yards allowed a game over the league's, at gp / (gp + 8), from 3 games, never last
    season's table.
- **The spread is flat at 70 yards.** His own game-to-game spread read no better (log loss at 150 … 325 yards 0.5200 against
  0.5121 flat; 0.30 × the projection 0.5135). `RESID.pass_yds` refitted on the 2025 starts against the read (median −0.008
  spreads: no more skew to correct), `RANGE.pass_yds` [0.828, 0.746] for a fifth each side.
- **The rungs on 2026, said → landed:** strong 65.2% → 67.0% (233), lean 52.9% → 50.7%, thin 38.3% → 42.1%.
- **300+ / 350+ read the ladder's chance itself** (`BIG.pass_yds` a 0, b 1): with the total inside the projection, the logit
  + total refit scored the same Brier on 2026 (300+ 0.1349 / 0.1349, 350+ 0.0558 / 0.0560).
- **Who takes it:** the starter. A backup on ESPN's depth chart keeps the board's read (off the lists as before); without a
  chart the quarterback whose latest start is the most recent is the starter for the read. A quarterback without a start
  in his log keeps the board's read.
- **The hover** on the Passing tab's projection and the player card spell it out (`passText`): his starts, the total, the
  favourite, the defense.

## Through the site's code (`nfl-pf-audit.mjs`, PropFinder's logs, no depth chart in the replay)

| | 2025 weeks 4–18 | 2026 weeks 1–7 |
|---|---|---|
| Starts (15+ attempts): before → after | 63.1 → 56.8 (434) | 64.6 → 58.5 (213) |
| The passing list (projected 100+): before → after | 66.0 → 62.2 | 70.2 → 65.2 |

- The replay's 58.5 against the study's 54.9 on the same weeks is week 1: without a chart the fallback takes the
  quarterback with the most recent start, which in week 1 is at times last December's stand-in; 25 of 213 starts kept the
  board's read that way. Where the read applies the two agree to the tenth (mean difference 0.0 on 188 starts). The live
  board reads ESPN's chart.
- Every other market is unmoved (receiving 22.9, rushing 21.6, receptions 1.6 on 2026).

## Open

- 2026 throws more than 2025 (the bias +4 on the check). Refit on both seasons once the season is half played.
- The read is a quarterback's; receivers and backs still read the board's generic rate over every logged game. Whether
  a zero row for a game he sat drags them the same way is not measured yet: worth the same check.

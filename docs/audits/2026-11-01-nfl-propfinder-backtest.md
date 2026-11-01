# The NFL projections on PropFinder's own data (2026-11-01)

Vincent, 2026-11-01: "Are we using propfinder data to determine the matchups?" — yes, the board reads PropFinder's logs
and defense tables — then "Backtest it with the real PropFinder data". The first backtest
(`2026-11-01-nfl-backtest.md`) rebuilt everything from ESPN's box scores. This one runs on what the site stored from
PropFinder.

## The data

- **Source:** the site's three stored NFL pulls, exported read-only by `GET /api/nfl/propfinder?export=1` through the
  `nfl-pf-export` workflow:
  - w06, pulled Oct 21: the Wednesday before week 7.
  - w07, pulled Oct 27: after week 7.
  - w08, pulled Nov 1: before week 8's Sunday games.
- **Logs:** each pull carries every rostered player's PropFinder game logs back to 2024, 908 skill players in all.
  - A game he played and recorded nothing in is a row, which ESPN's box score leaves out.
  - Every 2025–26 regular-season row lands on its ESPN game: 9,863 rows, none left over.
- **Defense tables:** only one pull holds PropFinder's tables as published *before* a week: Oct 21's, going into week 7.
  - Each week's file is overwritten by the next day's pull.
  - So the week-7 file and the week-8 file were last written after those weeks' games.
- **Books' lines:** the same Oct 21 pull carries the books' main lines and anytime TD prices for week 7: 101 receivers,
  40 rushers, 23 passers, 272 TD prices.

## How

- **Every week rebuilt:** each week of 2025 (tune, weeks 4–18) and 2026 (check, weeks 1–7):
  - **Logs:** PropFinder's logs cut before the week.
  - **Defense tables:** each defense's table by position rebuilt from those same logs (this season's games before the
    week, rank 1 = gives up the most).
  - **Game line:** ESPN's, as the site reads it.
  - **Grading:** run through the site's own board and projections, then graded on the player's PropFinder row for the
    game, zeros included.
- **The rebuild checked:** the rebuilt tables were compared against the tables PropFinder published.
- **Week 7 on PropFinder's own tables:** the tables as published going into week 7, beside the rebuilt ones, and every
  projection against the books' lines from the same day.
- **Constants re-searched** on 2025 and checked on 2026:
  - the matchup's damping;
  - the floor and the ceiling;
  - the touchdowns' read.
- `tools/audit/nfl-pf-audit.mjs` writes `nfl-pf-backtest.json`.

## Results

**The rebuilt tables match PropFinder's.**
- Against the Nov 1 pull's season table (this season's figures as published), the per-game figures correlate 0.99–1.00,
  team by team: WR receiving, TE receiving, RB rushing, QB passing, touchdowns.
- The Oct 21 pull's table correlates 0.41–0.67 with the plain season figures. That pull was made while the board still
  blended this season into last season's table.

**The shipped settings hold on PropFinder's logs** (2026 weeks 1–7, never used to tune):

| Market | Graded | Miss | Bias | Under the floor | Over the ceiling |
|---|---|---|---|---|---|
| Receiving yards | 1,287 | 22.9 | −1.6 | 19.7% | 18.7% |
| Rushing yards | 574 | 21.6 | −1.8 | 22.0% | 16.9% |
| Passing yards | 226 | 70.2 | −6.7 | 21.2% | 21.2% |
| Receptions | 1,403 | 1.6 | −0.1 | 19.0% | 18.7% |

- **Against the ESPN backtest:** that run reported 22.5 / 21.7 / 67.5 / 1.6, but on games with a line only. On the same
  population here (a figure recorded) the miss is 23.2 / 21.7 / 67.2 / 1.6.
- **Floor and ceiling:** they land close to the one-game-in-five each side they are fitted for.
- **Touchdowns:** 2,554 player-games, Brier 0.1237. By band, said → landed:
  - 0–10%: 4.8% → 5.4%
  - 10–20%: 14.9% → 13.3%
  - 20–30%: 24.6% → 21.6%
  - 30–45%: 36.1% → 35.2%
  - 45%+: 52.4% → 50.0%
- **First-half touchdowns:** said 9.2%, landed 8.9%, Brier 0.0739.

**Nothing re-searched beats what shipped.**
- **Matchup damping:** k = 8 is the best on 2025 (k = 0: +0.8% miss; 4: +0.1%; 16: +0.0%; 32: +0.3%). On 2026, k = 16–32
  read 0.3–0.4% better, which is inside the noise.
- **Floor / ceiling refit:** fitted on 2025, it narrows the range. 2025 ran calmer than 2026, so the refit put 21–25% of
  2026's games outside each side. The shipped range stays.
- **Touchdowns:** the best on 2025 is the season rate alone pulled at n / (n + 32), with no line. It checks at 0.1241
  against the shipped 0.1237. The shipped read stays.

**Week 7 on PropFinder's published tables:** the same misses as on the rebuilt tables.

| Variant | Receiving | Rushing | Passing | Receptions |
|---|---|---|---|---|
| Rebuilt tables | 21.7 | 24.2 | 72.9 | 1.4 |
| PropFinder's tables as published | 21.7 | 24.5 | 71.2 | 1.4 |
| Slot tables (WR1, RB1 …) from the Nov 1 depth chart | 21.6 | 24.4 | 71.2 | 1.4 |

- The slot tables add nothing over the position tables.
- The books' props loaded on the board move no projection; the ranges do not read them.

**The team's own touchdowns are missing from every pull.**
- PropFinder's NFL team objects carry no Team row, so `totals[ABBR].for` is null and `leagueFor` is empty.
- As a result, the touchdowns' team factor is 1 on the live board: no team rate, no defense total, no game line.
- Measured, this costs nothing: with the team read in, 0.1237; as live, 0.1236. On 2025, 0.1239 and 0.1238.
- Each player's own rate, pulled toward his volume, carries the read.

**Against the books (week 7, one week):**

| Market | Lines | Our miss | Book line's miss | Half and half | Our lean ≥ 10% off the line, hit |
|---|---|---|---|---|---|
| Receiving yards | 101 | 24.3 | 23.7 | 23.5 | 52.6% of 76 |
| Rushing yards | 40 | 26.8 | 25.1 | 25.9 | 46.4% of 28 |
| Passing yards | 23 | 66.7 | 55.0 | 59.5 | 44.4% of 9 |
| Receptions | 104 | 1.5 | 1.5 | 1.5 | 53.7% of 67 |

- **Touchdowns:** on the 272 priced players, the book's implied chance scores Brier 0.1175 (said 18.7%) and ours 0.1214
  (said 17.6%). 18.0% landed.
- **Read:** on one week the book's number is as good as ours or better. Leaning against it by 10% or more hit about half
  the time. That is one week of lines; it says nothing yet about an edge either way.

## What it cannot say yet

- **One week of real pre-game tables and lines.** The store keeps one PropFinder file a week, and each day's pull
  overwrites it. Only week 7 had its pre-game file survive.
  - Keeping each day's pull (about 1 MB gzipped) would let every week be graded on what PropFinder said that morning.
- **No cheat-sheet snapshot to test.**
  - Week 6's sheet was read before the snapshot reader existed.
  - Week 7's sheet has sat at "pending" since Oct 20: the OCR job never finished. "Read again" with a full re-read under
    Data sources would fix it.
  - Week 8's sheet is for games not yet played.
- **Injuries are not replayed.** A player who sat has no row and is not graded.

```bash
# The workflow (GitHub → Actions → NFL PropFinder export) uploads the stored weeks; unzip them into .nhl-data/audit/nfl-pf
node --max-old-space-size=8192 --import ./tools/audit/register.mjs tools/audit/nfl-pf-audit.mjs --pf .nhl-data/audit/nfl-pf --raw .nhl-data/audit/nfl
```

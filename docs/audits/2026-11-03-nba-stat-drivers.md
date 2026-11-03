# What predicts each NBA stat (2026-11-03)

Vincent, 2026-11-03: *can you do an independent research to see what can predict threes the best, rebounds the best,
points the best and assists the best? I expect that our rules need to be slightly different for all categories (maybe
for threes we need to look at h2h results, but for rebounds, we should look more at the environment and for points we
might rely more on recent performance to get to the prediction).*

This study starts from the box scores, not from the board. Every candidate read is built for every player-game from the
games before its date. The reads are tuned on one season, then scored unchanged on the next season and on this one.
**Nothing on the site was changed.** The proposals are at the end. The tables are in the appendix,
[2026-11-03-nba-stat-drivers-tables.md](2026-11-03-nba-stat-drivers-tables.md).

## Your three hunches, answered

| Your hunch | What the data says |
| --- | --- |
| **Threes: look at the head to head** | **No.** A player's past meetings with tonight's opponent carry 1–2% of their over / under into tonight. That is no more than his games against other teams at the same time (the control, below). His average in past meetings, used as a projection, misses by 1.13 threes against 1.01 for his own record. What predicts threes is **a long memory of his own rate** (the longest of the four stats) and **how many threes the opponent lets teams attempt**. The opponent's three-point percentage allowed is luck and predicts nothing. |
| **Rebounds: look more at the environment** | **Partly.** The opponent's rebounds allowed is the strongest read after teammates out. Its soft third against its tough third is worth +0.42 rebounds (+9.6%). But rebounds are not more environment-driven than the other stats: the same spread is +12.4% for assists, +11.3% for threes (on attempts allowed) and +9.2% for points. The pool of misses on offer and pace add almost nothing once the opponent's rebounds allowed is in. |
| **Points: rely more on recent performance** | **Half right: the minutes are recent, the scoring rate is not.** Read per game, points do want the shortest memory of the four (half-life 7 games). Split into rate × minutes, his scoring rate a minute wants about 15 games and his minutes want the last 2–3 games of this season. That split beats every per-game window, for points and for every other stat. |

## The recipe per stat

The best read per stat, chosen on 2024-25, and what held on 2025-26 and this season:

| Stat | His rate a minute: memory (half-life) | His minutes | The opponent | Teammates out | Everything else |
| --- | --- | --- | --- | --- | --- |
| **Points** | **15 games**, across seasons | This season's, half-life 3 | Points allowed, all positions, season (× allowed^0.94) | Their points a game (^0.70) | — |
| **Rebounds** | **20 games** | Same | Rebounds allowed, all positions, **last ten** (^0.65) | Their rebounds (^0.53) | — |
| **Assists** | **15 games** | Same | Assists allowed, all positions, season (^0.62), a little of his position's last ten (^0.18), and 3PA allowed (^0.51) | Their assists (^0.77) | — |
| **Threes** | **20–30 games** (the flattest: 20 to 50 read the same) | Same | **Threes attempted against it** (^1.12) | Their minutes (^0.72) | — |

- **How to read "^0.94".** The opponent's figure over the league's, shrunk toward the league at 10 games, raised to that
  power. A defense allowing 10% more points than the league adds about 9% to a player's points.
- **"Across seasons" means the regular season only.** No playoff game is in this data, which answers the concern of
  2026-10-28 about last season's playoffs in the windows.
- **"This season's minutes"** are his minutes decayed at a half-life of 3 games, over this season's games alone from his
  first game. Before his first game, last season's average stands in.

## What it adds up to, against the site's board

The site's own board was replayed night by night with `tools/audit/nba-audit.mjs --cocktail site`. That replay
includes the windows, matchup, minutes, teammates-out lifts and splits, role pull, team ceiling and ceiling read. Both
were compared on the same player-games (rotation players, his last ten at 15+ minutes). Average miss:

| | Rows | Points | Rebounds | Assists | Threes |
| --- | --- | --- | --- | --- | --- |
| 2025-26, the board | 17,762 | 5.08 (bias −1.37) | 2.01 (−0.39) | 1.50 (−0.37) | 1.04 (−0.14) |
| 2025-26, the per-stat recipe | 17,762 | **4.96** (−0.08) | **1.98** (+0.04) | **1.48** (−0.06) | **1.03** (+0.01) |
| This season, the board | 1,521 | 5.05 (−0.11) | 2.01 (−0.03) | 1.51 (−0.10) | 1.03 (−0.10) |
| This season, the per-stat recipe | 1,521 | **4.99** (+0.91) | **1.93** (+0.08) | **1.45** (+0.16) | **1.02** (+0.07) |

- **Better on every stat, both seasons.** The gains are modest in units, as expected (see "How much can be predicted").
- **The board runs low for rotation players over 2025-26**, by 1.4 points a game. That is the team ceiling: it scaled 84%
  of the points projections down, by 13% on average. Taking the bias out alone closes only a sixth of the gap (5.08 →
  5.06 on the same rows, against 4.96), so the gap is not only the level.
- **The recipe still runs high on points in this season's first games** (+0.9). The board's team ceiling handles the
  level better there. Something has to set the level early in a season; the recipe has nothing that does.

## What every stat shares

1. **His minutes and his rate want different memories.** Rate a minute over 15–30 games, minutes over the last 2–3.
   - Read per game, the best windows were 7 games (points) to 15 (threes). Rate × minutes beats all of them: points
     4.98 against 5.04, this season 4.99 against 5.22.
   - The board's windows (this season 0.65 · its last ten 0.35) missed points by 5.05 over 2025-26 and 5.37 this season.
2. **The minutes must restart each season.** Last April's minutes carried into October read 2–4 minutes high in a
   player's first games: end-of-season minutes for tanking teams' young players, contenders' stars in the playoff push.
   Taking the minutes from this season from his first game fixed most of it. Points in his first four games: 5.24 → 4.93
   (2024-25), 5.19 → 4.85 (2025-26). The rate itself can keep its memory across the boundary. Reading it from this
   season alone added nothing.
3. **Teammates out is the biggest lever for points and assists, and level with the matchup for rebounds and threes.**
   For points it takes away four times the deviance the matchup does, for assists twice. On 2025-26, rotation players
   in the top third of "production missing tonight" beat their own read by:

   | Stat | Points | Rebounds | Assists | Threes |
   | --- | --- | --- | --- | --- |
   | Beat his own read by | +1.16 | +0.20 | +0.26 | +0.08 |
   | Top third against bottom third | +17.5% | +10.3% | +17.4% | +10.2% |

   A teammate out who produces a fifth of the team's points lifts every rotation player's points by about 14%.
4. **The opponent in all, not at his position.** The opponent's total allowed (all positions) beat the opponent at his
   position, for every stat. With the total in, the position split (his position over the total) added nothing: z of
   2.0, −0.2, 3.0 and 1.0 on the fit (points, rebounds, assists, threes), and zero or negative on the checks.
5. **What predicts nothing:**
   - The head to head, for any stat.
   - His home / away split.
   - Home itself, his rest and the opponent's back-to-back: two per thousand of deviance at most.
   - Pace, the pool of misses and the opponent's shooting allowed: little to nothing once the opponent's table is in.

## The head to head, in detail

His miss in past meetings with tonight's opponent was set beside tonight's miss. The control is the same, but for his
games against other teams nearest the dates of those meetings. If the opponent itself carried information, the head
to head would beat the control.

| Stat | Rows (3–4 meetings) | r, head to head | r, control | Carried into tonight |
| --- | --- | --- | --- | --- |
| Points | 26,085 | +0.017 | −0.006 | 3% |
| Rebounds | 26,085 | +0.010 | −0.003 | 2% |
| Assists | 26,085 | +0.027 | −0.009 | 5% |
| Threes | 26,085 | +0.007 | +0.002 | 1% |

A shooter who beat his average by two threes a game over his last four meetings with a team is worth +0.03 threes
tonight. The faint edge the head to head has over the control is the opponent's general softness, which the
opponent's table already carries. Added to the model it took nothing away on the checks.

## How much can be predicted at all

The share of the night-to-night spread his own read explains (R²), on 2025-26:

| Stat | His own read | With the reads above | Miss | Miss had his minutes been known | His typical figure |
| --- | --- | --- | --- | --- | --- |
| Points | 0.44 | 0.45 | 4.98 | 4.13 | 12.6 |
| Rebounds | 0.41 | 0.42 | 1.97 | 1.73 | 4.6 |
| Assists | 0.45 | 0.46 | 1.47 | 1.34 | 2.9 |
| Threes | 0.28 | 0.28 | 0.97 | 0.90 | 1.4 |

- **Threes are the least predictable stat by far.** That is why they want the longest memory: a short window of made
  threes is mostly luck.
- **Most of what is left is the night itself.** Even knowing his minutes in advance, points would still miss by 4.1.

## What I would change (nothing is changed yet)

Each change goes through the site's replay (`nba-audit.mjs`) as its own A / B before it ships:

1. **His rate a minute over a decayed memory, per stat:** 15 games for points and assists, 20 for rebounds, 20–30 for
   threes. Across the season boundary, regular season only. This replaces this season 0.65 · last ten 0.35 per game.
2. **Minutes from this season's last few games, from his first game.** The board's minutes are already this season's,
   so check that this holds in the replay.
3. **For the number, the opponent's all-positions table per stat**, in place of the position cell: rebounds on its last
   ten, the others on the season. PropFinder's position table can stay on the page as colour.
4. **Threes: the opponent's three-point attempts allowed** as the threes matchup, in place of threes made allowed at his
   position.
5. **Teammates out, stronger.** Rotation players absorb roughly half of the missing production in proportion to their
   own. The NBA board hands over 20% (`vacatedShare` 0.2), so test 0.4–0.6 there.
6. **The team ceiling, read again** once 1–5 are in. It cost 1.4 points of bias over 2025-26. It may be doing work that
   the minutes and the opponent's total now do.
7. **No head to head, no venue split** in any number.

## How it was measured, and what it cannot see

- **Data.** ESPN's box scores, regular season: 2023-24 (history only), 2024-25 (the fit), 2025-26 and this season
  through Nov 2 (the checks). 3,793 games.
- **Rows.** Rotation players: his last ten at 15+ minutes, 5+ games behind him, and he played. 19,949 / 20,577 / 1,617
  player-games.
- **The fit.** A Poisson model with his own read as the offset, each read as log(factor / league). Fitted on 2024-25,
  scored unchanged on the checks. Reads were added only at |z| ≥ 3 on the fit.
- **Not testable here:**
  - The book's lines and the game total: ESPN's past summaries carry no pickcenter.
  - The cheat sheet's tiles.
  - PropFinder's five positions (ESPN gives only G / F / C).
  - Usage, rebound chances and potential assists.
- **Teammates out** is read from tonight's box score (who did not play). The site reads it from the injury report before
  the game.
- **The board replay** reads ESPN's logs in place of PropFinder's, as every NBA audit here has. Its population is the
  odds-only pull, ten a team; the live board has read every rostered player since 2026-11-02.

```bash
node tools/audit/nba-box-fetch.mjs --from 2023-10-24 --to 2024-04-14 --out .nhl-data/audit/nba-box   # and 2024-25, 2025-26, this season
python3 -I tools/audit/nba_stat_drivers.py --box .nhl-data/audit/nba-box --out docs/audits/2026-11-03-nba-stat-drivers-tables.md \
  --board .nhl-data/audit/cmp/nba-2026-04-12-site-rows.csv .nhl-data/audit/cmp/nba-2026-11-02-site-rows.csv
```

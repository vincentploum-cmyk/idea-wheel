# The NBA projections, stat by stat (2026-10-29)

Vincent, 2026-10-29: *when you say it hits, I don't get that, because you are only giving % for
basketball. We should look at projected and see how far off we are for points / rebounds / assists /
threes separately. We can't treat them all the same since they depend on different dynamics.*

This note measures the projected figure against what each player did, one stat at a time, in the
stat's own units. No hit rates and no lines. It then asks what each stat needs. The answer, a pull
toward each player's role in his first games with a different strength per stat, is now on the NBA
board as the cocktail's `pull` (`lib/nba/picks.js`).

## PropFinder and the cheat sheets first (later the same day)

Vincent: *the cheat sheets and the data from PropFinder should be the start of everything in
basketball.* Both were in every number. Where the model's own reads had pushed them back, they now
come first:

| PropFinder / the cheat sheet | Where it enters | Changed today |
| --- | --- | --- |
| PropFinder's game logs | His averages, minutes, attempts, hit rates: the base of every projection | The hovers say "in PropFinder's logs" |
| PropFinder's lines and prices | The main line, the ladder, the chance leaning on the book's price early, the edge | — |
| The cheat sheet's rank tiles | The matchup, first | Counted in full again |
| PropFinder's defense table | The matchup, beside the sheet, by the games behind it | Weighted against the sheet, not averaged with it |
| The cheat sheet's player table | Confirms plays (✓); since today the role behind the pull | New: the role's first source |
| PropFinder's games this season | The role behind the pull | Now ahead of the 2025-26 reference |
| Injury report, depth chart, team totals | Who is out, the splits, the lifts, minutes, starters, the team ceiling | — |

**The matchup, the cheat sheet first.**

- **What went wrong.** From October 28 the damping by the games behind the table (gp / (gp + 40))
  applied to the average of the sheet's tile and PropFinder's number. In the first week that cut the
  sheet's say to about a tenth. The damping was measured on PropFinder's tables. The replay had no
  sheets, so it never measured them.
- **Now** the sheet's tile counts in full, alone or beside PropFinder. PropFinder's number counts at
  its games' weight beside it: 1 + ((sheet − 1) + w × (PropFinder − 1)) / (1 + w).
  - In week one the matchup is the sheet's read.
  - Over a season the two come to near-equal say.
  - Without a sheet, PropFinder's table is damped as before.
  - Example: a tile at the league's average beside a PropFinder × 1.12 on four games reads × 1.01.

**The role behind the pull, from the sheets and PropFinder.**

- Each stat's rate a minute by position group now comes first from the slate's cheat-sheet player
  tables (each player's minutes and averages, a game's worth a row). A row past what a minute can
  hold, an OCR misread, is left out.
- PropFinder's players' games this season come next.
- The 2025-26 reference is a starter at 500 minutes, down from 2000. The misses are the same at
  2000, 500 or 200 minutes (points 5.087 this season, 5.352 / 5.355 / 5.357 over 2025-26's first
  two weeks), so the slate's own sources can lead from the first nights.

**The sheets graded on real nights.**

- The replay cannot grade the sheets. The past ones live in the site's store, as do the books'
  lines.
- The site's scorecard now does it. Under "Which number predicts best", **"The matchup, graded"**
  shows, per stat and by where the matchup came from (the cheat sheet, the cheat sheet and
  PropFinder, PropFinder alone, no table), the projection's average miss as it stood and with the
  matchup taken out. It is green where the matchup brought the figure closer to what he did.
- The scorecard rebuilds every stored night with today's code, so the nights already stored are
  graded from the first load.
- On this season's replay, with PropFinder's table alone, the miss is the same with and without the
  matchup (points 5.09 either way): four games of a defense say little. The rows for the sheet fill
  in on the site.

## Usage, rebound chances and potential assists in the role (later the same day)

Vincent: *add usage, rebound chances and potential assists to the projections.* PropFinder's game rows
carry all three (`usagePct`, `reboundChances`, `potentialAssists`, seen in a real pull on October 20).
Until now they were shown on the player card and fed no number.

**Where they go: his role.** The pull's anchor in a player's first games was his position's average
rate a minute. It is now his own opportunity this season, converted at the rate the slate's players
turn that opportunity into the stat. The conversion comes from PropFinder's rows for the slate:

| Stat | His role | Conversion |
| --- | --- | --- |
| Points | His usage × his minutes | Points per usage-minute (2025-26's 0.024 behind the slate's own at 500 minutes) |
| Rebounds | His rebound chances a minute × his minutes | Rebounds per rebound chance |
| Assists | His potential assists a minute × his minutes | Assists per potential assist |
| Pts + reb + ast | The three added up | — |
| Threes | His position's rate a minute, as before (his attempts already drive the read) | — |

- **What stays out.** These are opportunity figures, not outcomes. A hot shooting night moves his
  points, not his usage. A lucky bounce moves his rebounds, not his chances. That is why they make a
  steadier anchor in a player's first games than his own few outcomes.
- **Fallback.** Where the rows lack a figure, the position's rate stands in as before.
- **A stronger pull.** A player's own role earns a stronger pull than his position's
  (`pullOpportunity`). The position's role keeps its K.

**Measured: usage.** ESPN's box scores give usage: his shots, free throws and turnovers over his
team's while he was on the floor. The replay computes it per game the standard way. Average miss on
points and PRA, against the board as it was this morning:

| | Points K | PRA K | Points, this season | Points, 2025-26 first two weeks | Points, 2025-26 after | PRA, this season | PRA, 2025-26 first two weeks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Position's role (this morning) | 1 | 1 | 5.087 | 5.355 | 5.073 | 6.796 | 6.919 |
| Usage role | 1 | 1 | 5.147 | 5.326 | 5.067 | 6.808 | 6.850 |
| Usage role | 5 | 1 | 5.015 | 5.266 | 5.053 | — | — |
| Usage role | 12 | 1 | 4.997 | 5.265 | 5.044 | 6.825 | 6.857 |
| Usage role | 20 | 1 | 4.999 | 5.271 | 5.039 | — | — |
| **Usage role (shipped)** | **12** | **5** | **4.991** | **5.265** | **5.044** | **6.698** | **6.796** |

- **Points** gain from K 5 on and level off between 8 and 20. 12 sits in the middle: his own games
  count at n / (n + 12), a third after six games, half after twelve. Over all of 2025-26: 5.095 →
  5.062.
- **PRA** on its parts is best at K 5: 6.796 → 6.698 this season, 6.676 → 6.652 over 2025-26.
- **The ladders** gain too. Rung scores this season, lower is better: points 0.1755 → 0.1717, PRA
  0.1689 → 0.1662.
- **As a read of its own** (the scorecard's new "His role"), usage × the conversion × his minutes
  missed points by 4.42 on the rows where every read is available. The projection missed by 4.46 on
  those same rows.

**Not measured: rebound chances and potential assists.**

- They are NBA.com's tracking figures. No public box score here carries them, and NBA.com's stats
  API was not reachable from this session.
- They are in on PropFinder's figures, at the K fitted on the position's role (rebounds 2, assists
  0.5). Usage earned a stronger K, so these may deserve one too. That is the next thing to check.
- **How they get graded.** The scorecard's predictor table now carries **"His role"** for every
  stat, with the projection and the blend beside it on the same rows. If rebound chances or potential
  assists beat the projection there over a few weeks, their K goes up.

## How it was measured

- **The board.** The site's own board, replayed night by night with `tools/audit/nba-audit.mjs`,
  each night built only from the games before it.
- **The seasons.** This season from opening night to October 27 (8 nights, 56 games, about 990
  player-games per stat) and all of 2025-26 (1,231 games, about 18,700).
- **The windows.** This season's games alone (the branch's windows).
- **The tool.** `tools/audit/nba_stats.py report` writes every table here from the replay's rows.

## How far off we are

This season, the board on the branch (this season's games, the pull in):

| Stat | His typical figure | Average miss | Median miss | Close | Bias | Before the pull | The board as it was |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Points | 11.7 | **5.09** | 4.2 | 49% within 4 | +0.19 | 5.39 | 5.59 |
| Rebounds | 4.4 | **2.06** | 1.6 | 61% within 2 | +0.02 | 2.20 | 2.28 |
| Assists | 2.6 | **1.53** | 1.2 | 75% within 2 | −0.04 | 1.58 | 1.60 |
| Threes | 1.4 | **1.01** | 0.8 | 62% within 1 | −0.06 | 1.02 | 1.09 |
| Pts + reb + ast | 18.7 | **6.79** | 5.6 | 53% within 6 | +0.32 | 7.08 | 7.52 |

How to read the columns:

- **Average miss** is the average distance between the projection and his figure.
- **Median miss** is the typical night: half the nights land closer than it.
- **Bias** is the average of projection minus actual. Near zero means we do not run high or low
  overall.

**Against plain reads.** His average this season missed points by 5.47, rebounds by 2.23, assists by
1.62 and threes by 1.10. His last ten this season did worse.

**What is luck.** Last season gives a reference point: the miss left even with hindsight.

| 2025-26 | Our projection | His whole season's average, known in advance | That average a minute × the minutes he actually played |
| --- | --- | --- | --- |
| Points | 5.10 | 4.80 | 4.00 |
| Rebounds | 2.02 | 1.93 | 1.69 |
| Assists | 1.49 | 1.42 | 1.31 |
| Threes | 1.02 | 0.99 | 0.92 |

A player who averages 20 scores 14 one night and 27 the next. No read of his level removes that.
What the projection can still win:

- **Points:** about 0.3 against a perfect read of his level, and most of the rest is his minutes.
- **Rebounds and assists:** under a tenth.
- **Threes:** three hundredths.

## Each stat has its own dynamics

**Where the miss comes from.** The table compares the miss as it was with the miss had we known his
minutes in advance (the projection scaled to the minutes he played):

| This season | Miss | Had we known his minutes | Share of the miss that is minutes | Miss when his minutes were 14+ off (6% of nights) |
| --- | --- | --- | --- | --- |
| Points | 5.01 | 4.19 | 16% | 7.80 |
| Rebounds | 2.00 | 1.77 | 12% | 3.09 |
| Assists | 1.54 | 1.40 | 9% | 1.92 |
| Threes | 1.01 | 0.94 | 7% | 1.12 |
| Pts + reb + ast | 6.63 | 5.18 | 22% | 12.27 |

(The miss here is on the rows with a minutes read, so it differs a little from the table above.)

- **Points follow minutes.** A sixth of the points miss is his minutes: foul trouble, a blowout, a
  rotation change. It is the biggest single lever left on any stat.
- **Rebounds follow the position.** A centre rebounds like a centre: a big's role predicts his
  rebounds better than one or two of his own nights do.
- **Assists follow the player.** Who handles the ball is his own role, and the position says
  little: a forward who runs the offence is not an average forward.
- **Threes follow the attempts, then luck.**
  - Reading threes as his attempts × his percentage beats his made threes alone (1.02 against 1.09
    this season before the pull, 1.06 against 1.09 over last season's first two weeks). That read
    was already on the board.
  - Beyond his level, a night's threes are nearly a coin: 1.02 against a hindsight 0.99.

**The stretch.** With one to five games in, the projections ran to the ends. Before the pull, this
season:

- A player projected for 20+ points scored 2.8 under his projection. One projected under 10 scored
  1.1 over.
- Each projected point above the middle was worth 0.77 of a point.

By stat, actual per projected unit (1.00 = right):

| Actual per projected unit | Points | Rebounds | Assists | Threes |
| --- | --- | --- | --- | --- |
| This season, before the pull | 0.77 | 0.73 | 0.75 | 0.62 |
| This season, with the pull | 0.97 | 0.91 | 0.87 | 0.78 |
| Last season, players with 1–2 games, before | 0.76 | 0.74 | 0.78 | 0.64 |
| Last season, players with 1–2 games, with the pull | 0.95 | 0.98 | 0.93 | 0.85 |
| Last season, players with 16+ games | 0.95 | 0.94 | 1.00 | 0.95 |

The stretch is a small-sample effect: it is gone once a player has a few weeks of games. It differs
by stat: threes swing hardest on one or two nights, assists least.

| This season, by the size of the projection | Before the pull: bias | With the pull: bias |
| --- | --- | --- |
| Points projected 20+ | +2.77 | +1.04 |
| Points projected under 10 | −1.05 | +0.22 |
| Rebounds projected 8+ | +1.75 | +0.67 |
| Assists projected 5+ | +0.73 | +0.44 |
| Threes projected 2.5+ | +0.60 | +0.17 |

## The change: each stat pulled toward his role, at its own strength

In a player's first games this season his own read is pulled toward his role:

- **His role** is the league's rate a minute at his position group (guard, forward, centre) × the
  minutes behind his rate.
- **The weight.** His own read counts at n / (n + K) of the way, where n is his games this season.
- **K per stat** was fitted on 2025-26's first two weeks:

| Stat | K | His own read after 1 game / 2 / 5 / 10 | Why |
| --- | --- | --- | --- |
| Rebounds | 2 | 33% / 50% / 71% / 83% | The position says the most |
| Threes | 1.5 | 40% / 57% / 77% / 87% | One or two nights' shooting says little |
| Points | 1 | 50% / 67% / 83% / 91% | |
| Pts + reb + ast | 1 | 50% / 67% / 83% / 91% | |
| Assists | 0.5 | 67% / 80% / 91% / 95% | His role is his own |

- **The league rates.** Each stat and position group's rate a minute comes from the slate's own
  sources: the cheat sheets' player tables and PropFinder's games this season. 2025-26's rates
  (`roleRates`) count as 500 minutes behind them. Until this afternoon it was 2000, with
  PropFinder's games alone; the numbers in this section are from that first version, and the misses
  are the same.
- **What stays out.** Nothing of the player's own last season enters it. Before his first game this
  season, last season's regular season still stands in as it is.
- **Example.** A guard with one game this season (40 points, 2 rebounds, 10 assists in 30 minutes)
  reads:
  - points: halfway to his role's 15.4 → 27.7
  - rebounds: a third of the way from his role's 4.1 → 3.4
  - assists: two thirds of the way from his role's 4.2 → 8.1

  The hovers on the court, the card and the shuffle say how far a figure was pulled.

| Average miss | Points | Rebounds | Assists | Threes | PRA |
| --- | --- | --- | --- | --- | --- |
| This season, before the pull | 5.39 | 2.20 | 1.58 | 1.02 | 7.08 |
| **This season, with the pull** | **5.09** | **2.06** | **1.53** | **1.01** | **6.79** |
| This season, last season's regular season kept behind his first games instead | 5.16 | 2.12 | 1.51 | 1.02 | 6.85 |
| Last season's first two weeks, before | 5.44 | 2.13 | 1.54 | 1.06 | 6.98 |
| Last season's first two weeks, with the pull | 5.35 | 2.04 | 1.53 | 1.05 | 6.92 |
| Last season after two weeks, before → with the pull | 5.07 → 5.07 | 2.02 → 2.02 | 1.48 → 1.48 | 1.02 → 1.02 | 6.66 → 6.66 |

- **Against keeping last season's games.** With the pull, this season's games alone match or beat
  last season's regular season behind the first games, on every stat but assists. So the
  "this season only" rule no longer costs accuracy.
- **Later in the season** it changes nothing, as it should.
- **The ladders,** centred on the projection, gained too. Rung scores this season (lower is better):

  | Rung score | Points | Rebounds | Assists | Threes | PRA |
  | --- | --- | --- | --- | --- | --- |
  | Before the pull | 0.1843 | 0.1760 | 0.1485 | 0.1139 | 0.1747 |
  | With the pull | 0.1755 | 0.1656 | 0.1436 | 0.1116 | 0.1688 |

## Tested per stat and left as they are

| Ingredient | What it does per stat | Decision |
| --- | --- | --- |
| Window weights (season against last ten, last five) | Differences of hundredths, the same direction for every stat | Season 0.65 / last ten 0.35 |
| The matchup (PropFinder's table, rebuilt from the box scores) | Worth about nothing for any stat, damped or not; undamped it costs every stat (points 5.39 → 5.72 this week). The cheat sheet's tile was not in the replay. | PropFinder's table damped; the sheet's tile in full (above) |
| Letting extra minutes raise a figure | Worse for every stat, both seasons | Stays capped |
| An out teammate's production handed on | A hair worse for every stat (points 5.37 without it against 5.39) | Kept at 0.2, your ask |
| The team ceiling (a side scaled to the team's expected total) | See below | Kept, revisit at mid-season |

The team ceiling splits by stat and by season:

- **This season** it helps every stat. Without it the points projection runs 0.8 high and misses
  5.18 against 5.09.
- **Over all of last season** it cost points, assists and PRA: it is most of last season's point of
  under-projection. It helped threes.

This season's evidence says keep it for now. Read it again once the season has a few weeks behind
it.

## Still open

- **His minutes.** They are the biggest lever left on points and PRA. The board reads tonight's
  minutes from his last five and the out players' minutes. A better minutes read (the depth chart,
  the coach's rotation, blowout risk from the spread) is where the next gain on points is.
- **The team ceiling**, as above.
- **The cheat sheet's matchup**, on the site's scorecard (above), as the stored nights add up.
- **October 28.** Its 12 games were not all final when this was run, so the backtest stops at
  October 27.

## Rerun

```bash
node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --date 2026-10-27 --from 2026-10-20 --raw .nhl-data/audit/nba --prior .nhl-data/audit/nba/prior/games --out .nhl-data/audit/ab3 --cocktail site --tag -pull
python3 -I tools/audit/nba_stats.py report .nhl-data/audit/ab3/nba-2026-10-27-pull-rows.csv "This season"
# the pull fitted per stat, on rows built without it
python3 -I tools/audit/nba_stats.py pull .nhl-data/audit/ab3/nba-2026-04-12-base-rows.csv .nhl-data/audit/ab3/nba-2026-10-27-base-rows.csv
```

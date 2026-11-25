# NHL, this season: does "allows a lot" on PropFinder's table hold, and home / away splits (2026-11-25)

Vincent, 2026-11-25: "check if there are teams or players that perform significantly different home and away?
Also … the comment 'team allows a lot of shots / team allows a lot of goals': if that comment is listed, are the
players indeed hitting more?", then "I only care about this season! And based on the stored propfinder data".

Data: the site's study export (`/api/nhl/data/study-export`, downloaded 2026-11-25: 55 slates, Oct 1 – Nov 25, the
pre-game PropFinder defense table by position and every skater's PropFinder season rate) against the NHL API's box
scores of 2026-27 through Nov 24 (`tools/predictors/fetch.mjs`). Script: `tools/predictors/pf_allows.py`. The export
carries no book prices (no `skater-props` file was stored for these slates), so nothing is graded against a line.
The L10 table is stored on one date only, so only the Season table is read.

Method: each skater-game is matched to his PropFinder row by name (13,572 skater-games, 683 without a row), and
kept when PropFinder's season rate stands on 5+ games (9,824). "Hitting more" = beating his own PropFinder season
rate going into the game. The opponent's colour is PropFinder's rank the morning of the game as the table shows it
(`rankThird`: 1–11 green "allows a lot", 12–22 amber, 23–32 red), on the row at his PropFinder position and on the
All row.

## 1. PropFinder's "allows a lot" → shots

| Opponent on PropFinder's SOG rank | at his position: n | shots / his rate | 3+ hit (Poisson at his rate) | All row: shots / his rate | 3+ hit (exp.) |
|---|---|---|---|---|---|
| green, allows a lot | 3,439 | **1.073** | 24.7% (21.9%) | 1.036 | 24.1% (22.4%) |
| amber | 3,327 | 0.961 | 21.4% (22.8%) | 0.998 | 22.4% (22.2%) |
| red, allows few | 3,058 | **0.948** | 20.2% (22.0%) | 0.945 | 19.8% (22.0%) |

- Green against red at his position: +12.5% shots (95% CI +7.5 to +16.9%, games resampled); on the All row +9%
  (+4.6 to +13.4%). The position row is the better read.
- It held in both months: October green 1.082 / red 0.949, November 1.064 / 0.947.
- For shooters at 2.5+ shots a game: 3+ landed **57% against green, 51% amber, 47% red** (each said ~57% off his
  rate). Against a green opponent he hits his rate; against red he falls 10 points short.

## 2. PropFinder's "allows a lot" → goals

| Read | green: goals / his rate (1+ hit, exp.) | amber | red | green − red, 95% CI |
|---|---|---|---|---|
| G rank, at his position | 1.031 (16.1%, 15.4%) | 1.012 | 1.019 | −0.11 to +0.14 (nothing) |
| ISCF rank, at his position | **1.109** (17.3%, 15.6%) | 0.963 | 0.983 | +0.01 to +0.23 |
| G rank, All row | 1.098 (17.0%, 15.5%) | 0.984 | 0.980 | −0.01 to +0.22 |
| ISCF rank, All row | **1.121** (17.7%, 15.6%) | 0.951 | 0.981 | +0.03 to +0.24 |

The goals-allowed rank by position says nothing this season. The scoring-chances-allowed rank (ISCF, what the ice is
tinted by under Goals since 2026-11-12) does: about +11–12% on his goal rate against a green opponent, +1.7–2.1
points on 1+ goal; amber and red read alike.

## 3. Home / away, this season (box scores; PropFinder publishes no venue split)

- League: home 28.2 shots and 3.19 goals a game, away 26.6 and 3.12.
- Teams: 7 of 128 splits (shots and goals for and against) at p < 0.05, chance alone 6.4. The biggest: BUF shots
  allowed 23.7 home / 30.9 away (10 / 14 games, p 0.002), TOR goals 2.5 / 4.3 (p 0.012), EDM shots 26.6 / 22.0
  (p 0.015), NSH shots allowed 27.3 / 32.4, TBL goals allowed 2.25 / 3.55. None of last season's team splits carried
  into this one (`home_away.py`), so these are 10–14 games of noise until shown otherwise.
- Skaters with 8+ games at each venue: 477; shots splits at p < 0.05: 23, chance 24; goals 11. The largest
  (MacKinnon 4.7 / 2.1, Gauthier 5.5 / 3.4, Cuylle 3.1 / 1.1, Kaprizov 3.9 / 2.6, Pionk 1.4 / 2.9) are what chance
  throws up among 477.
- The pattern that holds is by volume: 3+ shot skaters +11.4% at home, 1–3 shots +4–5%, against the board's flat
  +3.5% (`SHOTS_FIT.home`), and it held last season too (+11%).

## What it asks for (nothing changed)

- PropFinder's position row is worth reading: green ≈ +7% on his shots, red ≈ −5%, about ±2–3 points on 3+ and ±5
  for a 2.5+ shooter. Red is as informative as green.
- For goals, read the ISCF colour, not the goals-allowed colour.
- A tiered home term for shots (≈ +11% at 3+ shots a game, +4% at 1–3), to be fitted before it touches `SHOTS_FIT`.
- Team or player home / away splits by name: do not use.
- Store the book's lines with the slate (`skater-props/<date>.json` is empty on every exported date) so the next
  pass can say whether the price already carries the colour.

## 4. Which window of the environment predicts best, this season (`tools/predictors/pf_env_windows.py`)

The opponent's shots / goals / ISCF allowed over its last 5, 10, 15 games and season to date, rebuilt from the box
scores with PropFinder's position labels (the export stores the Season table only), against each skater's own
PropFinder season rate (10,131 skater-games, 5+ GP). Scored two ways: a multiplier (opp / league)^b fitted before Oct 28
and graded after it (Poisson deviance saved over no environment), and the green / amber / red split by rank on the
rows where the opponent has 15+ games, so every window is full (4,405).

| Read | L5 | L10 | L15 | Season |
|---|---|---|---|---|
| Shots, at his position: deviance saved | 5.9 | 14.9 | **15.9** | 14.2 |
| Shots, at his position: green − red | +6.3% | +8.6% | **+10.3%** | +8.6% |
| Shots, team (All): deviance saved | −2.4 | 1.8 | **12.4** | 10.0 |
| Goals by ISCF, at his position: deviance saved | 3.2 | 3.8 | 4.2 | 4.1 |
| Goals by ISCF, team: deviance saved | −2.7 | 2.7 | 4.2 | **4.7** |
| Goals by goals allowed, at his position | ≈ 0 | ≈ 0 | ≈ 0 | ≈ 0 |

L5 is the worst read everywhere (at the team level worse than nothing). For shots at the position L10, L15 and Season
are within noise of each other (the gaps are 1–2 units of deviance); for the team as a whole and for goals the
longer windows win (L15 / Season). The fitted multiplier is small at the position (b ≈ 0.20: an opponent allowing 20%
more than the league adds ≈ 4%). Nothing changed; the Matchups tab's L10 default is fine for shots by position, the
team and goals reads would do better on L15 or the season.

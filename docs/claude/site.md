# Site structure

- `app/page.js`: signed out → `Landing`; signed in but not admin → `Locked`; admin → `Start`
  (a dark band with the date, then three panels NFL · NBA · NHL from `/api/site/status`: the
  figures first (games, plays, the hit tally, sheets / lineups), the slate's games with logos,
  scores and tallies, the sources line; the NFL / NBA panels read their boards from the stored
  files, the NHL panel the day's schedule with scores). Links saved before the start
  screen existed (`/#teams/BUF`, `/#matchups`) are forwarded to `/nhl#…` by `Start`.
- `app/nhl|nfl|nba/page.js` gate through `lib/gate.js` (`gateSport`: sign-in redirect with
  `?next=`, then the admin list). The header (`components/nhl/SiteHeader.jsx`) takes `sport`
  for the mark and carries `components/site/SportNav.jsx` (NFL · NBA · NHL, the start screen's order).
- Every app's tabs are the URL hash (`components/site/hash-tab.js`: `tabOf`, `useHashTab(keys, fallback)`
  → `[tab, mounted]`, a visited panel stays mounted hidden so it keeps its state; `components/site/TabBar.jsx`
  draws the bar). **The NBA page is laid out as the NFL's** (Vincent, 2026-11-01: "for nba, I need the same layout as nfl
  with as addition the propfinder tables for each game when clicking on the game"; `components/nba/NbaGames.jsx`): pill
  tabs over one date picker (the `head()`, drawn on every panel) — `#matchups` (Games, the default: the night's games as a
  sportsbook lists them, a row a team with its logo, spread and total, the tip in ET; press one for the stat pills Points ·
  Rebounds · Assists · Threes · PRA and the position pills All · PG · SG · SF · PF · C, then **each defense in turn, its
  PropFinder table first and the players who face it under it** (`DefenseBlock`; Vincent, 2026-11-01: "when clicking on a
  game, I need first the propfinder table and then the players of the opponent underneath with their projections. I
  should be able to check easily per position and type"): "Nuggets defense against Lakers", the court's `AllowedTable`
  (what DEN gives up per position, opening on L10, the cheat sheet's ✓ / ✗ in each cell, the picked stat's column and
  position's row marked; a pressed row sets the position for both blocks, `pickWord` "below"), the table's cell for the
  pick in a line ("DEN gives up 7.2 ast a game to PGs · #3 of 30 · L10 · league 5.9", tinted by third), beside it what the
  defense gives up to all positions this season, the figure the projection reads since the per-stat recipe ("DEN gives up 26.1
  ast a game in all · #4 of 30 · league 25.3", `side.against` from `sidesOf`: `totals[opp].against` ranked over the teams, its
  last ten and the league's), and with Threes picked its **three-point attempts allowed** (Vincent, 2026-11-03: "if propfinder
  gives us the allowed 3 pt attempts, we need to display that also": "3PA allowed · 8.4 to PGs (#4) · 39.5 in all (#3 of 30,
  league 35.2)"; PropFinder's team rows carry `threePointsAtt`, read as `tpa` in the NBA's `allowed`, so every `AllowedTable`
  has a 3PA column beside 3PM, nine columns at most), the opposing
  team's players at that position, then who is out on that team — each player with his projection and the
  strong / lean / thin marks, 70 / 55 / 40% as the Boards tab read them: round marks off the shuffle's payload per stat,
  `useNbaShuffles` / `tierRows` over `tierBoard`, the book's rungs (`ladderBoard`) until they load, the highest projection
  first, a name opening the card), `#pts`, `#reb`, `#ast`, `#tpm`, `#pra` (`NbaStatList`: the same list across the night,
  40 rows then "Show all"), `#big` (Big games, below, with the game dropdown; its Soft spots switch since 2026-11-11), `#firstbasket` and `#sources` (Data sources). The game dropdown shows on `#matchups` too since 2026-11-11 (one picked game, listed alone and open).
  The Best plays board, Boards, Cheat sheet and Shuffle tabs are off the page (their components and routes stay; an old
  `#board` / `#shuffle` link opens Games). `__tests__/nba-games.test.jsx` (`MOCK_OUT` writes `games-nba-<theme>.html`). **The NFL page is eight
  plain tabs drawn as pills** (Vincent, 2026-11-01: "way too complicated … Remove the edge, implies, juice, etc… I just need
  a simple list of games and per game, players listed with their ladders", then a sportsbook's games page as the form and
  "where are the passing yards?"; `TabBar`'s `pills`): `#matchups` (Games, the default: the week's games as a sportsbook
  lists them — the matchup, the kickoff in ET, a row a team with its logo, spread and the total, the line alone with no
  price; `GameRow` in `NflBoards.jsx`, press a game for its players), `#tds`, `#passing`, `#receiving`, `#rushing` (the
  projection lists, below), `#te` (Tight Ends, Vincent, 2026-11-03: "the books price these nicely": `NflTightEnds`, the
  tight ends alone off the same rows, Receiving Yards · TDs; a tight-end fit beat nothing, `docs/audits/2026-11-03-nfl-engines.md`), `#big` (Big games, below) and `#sources` (Data sources: the drop zone, the pulls); the Best plays board
  (EV, juice, the floors, the scorecard) and the shuffle are off the NFL page — `NflBoard` / `NflShuffle` and their routes
  stay, an old `#board` / `#shuffle` link opens Games. The NHL app has nine (below).
- The NHL app is unchanged apart from its path: hash tabs, routes, storage, model math.
- **Player search on the NFL and NBA pages** (Vincent, 2026-11-01: "I should be able to search on players for both nba
  and nfl"): a box in each page's head (`components/picks/PlayerSearch.jsx`, the matcher in `lib/picks/player-search.js`:
  every word of the query starts a word of his name or is his team's code — "cun", "det jalen" —, accents ignored, the
  surname first, a player out last; arrows, Enter, Escape). The NBA's list is every side player of the slate
  (`nbaSearchList`, his projected PTS / REB / AST on the line), a pick opening the player card (`components/nba/NbaSearch.jsx`);
  the NFL's is the week's projection rows (`nflSearchList`, his main yards projection and TD chance), a pick opening
  `components/nfl/NflPlayer.jsx`: his TD chances (anytime, 1st half, first TD, 2+), each yards market's projection,
  floor–ceiling, the book's line, the strong / lean / thin marks, the matchup at his spot and the factor on his rate, and
  his big-game chances, graded once the game is in; hidden until the week has projections. `__tests__/picks-player-search.test.jsx`.
- **No cheat sheets since 2026-11-04** (Vincent: "I will not get the cheat sheet anymore"): the pages no longer ask for one — the
  NFL / NBA heads drop "no cheat sheet" (a date that stored sheets still counts them), the footers name ESPN and PropFinder only,
  the legends and the Proj hovers read "PropFinder's defense table" / "what the defense gives up to all positions, PropFinder",
  the ✓ / ✗ note above PropFinder's tables shows only when a cell carries a tile, the start screen and the landing page describe
  the boards off PropFinder's logs, lines and defense tables, and Data sources has no drop zone. The sheet parsers, the store
  routes and the board's reads stay (a sheet uploaded through the API still counts), so the sheets can come back without code.
- **"Lineup confirmed" beside each team on the NBA Games tab** (Vincent, 2026-11-04: "a 'lineups confirmed' message next to the
  teams when the lineups are confirmed from rotowire / espn"): `LineupTag` in `components/nba/NbaGames.jsx` under the team's name
  in each game row — "✓ Lineup confirmed" (the `--ok-*` tokens) once RotoWire confirms the starting five, a muted "Expected
  lineup" before, the five and who may not play on the hover; nothing once the game is final. Off `board.lineups` (below and in
  `picks-core.md`). `__tests__/nba-lineups.test.jsx`, the mock in `nba-games.test.jsx` (`MOCK_OUT`).
- **The NBA cheat sheet** (`#guide`, "Cheat sheet" before Data sources; `components/nba/NbaGuide.jsx`, `GUIDE`; Vincent,
  2026-11-04: "Can we have this simplified in a cheat sheet somewhere on the site for nba"): static, three columns (one under the
  other under 900 px) — Rebounds, Assists, Threes — each "Look at" (his rate a minute and its memory, his recent minutes, the
  opponent figure that predicts it and where it sits on the Games tab, teammates out) and "Ignore" (head to head, home / away …),
  from `docs/audits/2026-11-03-nba-stat-drivers.md`. Keep it in step with the recipe (`RECIPE` in `lib/nba/picks.js`) when that
  changes. `__tests__/nba-guide.test.jsx` (`MOCK_OUT` writes `guide-nba-<theme>.html`).
- **The model's expected score under each NBA game row** (`modelScore` in `components/nba/NbaGames.jsx`; Vincent, 2026-11-05:
  "show the expected score in grey"): "Model: ATL 116 – WSH 113 · total 229" in muted grey under the spread and total boxes,
  each side's `teamProj.pts` (its own points a game through what the opponent allows), until the game is final. **Grey, never
  green on the boxes**: replayed against DraftKings' lines (ESPN's pickcenter) over 2025-26's 978 priced games its side of the
  spread was right 48.3% and of the total 49.3% (52.4% breaks even at -110); home court (+1.5 to +3.5), the undamped opponent
  factor and only the 5+ point disagreements did no better (≤ 51%); this season's 92 games read 56–60% on spreads, noise. The
  hover says so.


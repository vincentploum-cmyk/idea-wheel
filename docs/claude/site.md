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
  pick in a line ("DEN gives up 7.2 ast a game to PGs · #3 of 30 · L10 · league 5.9", tinted by third), the opposing
  team's players at that position, then who is out on that team — each player with his projection and the
  strong / lean / thin marks, 70 / 55 / 40% as the Boards tab read them: round marks off the shuffle's payload per stat,
  `useNbaShuffles` / `tierRows` over `tierBoard`, the book's rungs (`ladderBoard`) until they load, the highest projection
  first, a name opening the card), `#pts`, `#reb`, `#ast`, `#tpm`, `#pra` (`NbaStatList`: the same list across the night,
  40 rows then "Show all"), `#big` (Big games, below, with the game dropdown), `#firstbasket` and `#sources` (Data sources).
  The Best plays board, Boards, Cheat sheet and Shuffle tabs are off the page (their components and routes stay; an old
  `#board` / `#shuffle` link opens Games). `__tests__/nba-games.test.jsx` (`MOCK_OUT` writes `games-nba-<theme>.html`). **The NFL page is seven
  plain tabs drawn as pills** (Vincent, 2026-11-01: "way too complicated … Remove the edge, implies, juice, etc… I just need
  a simple list of games and per game, players listed with their ladders", then a sportsbook's games page as the form and
  "where are the passing yards?"; `TabBar`'s `pills`): `#matchups` (Games, the default: the week's games as a sportsbook
  lists them — the matchup, the kickoff in ET, a row a team with its logo, spread and the total, the line alone with no
  price; `GameRow` in `NflBoards.jsx`, press a game for its players), `#tds`, `#passing`, `#receiving`, `#rushing` (the
  projection lists, below), `#big` (Big games, below) and `#sources` (Data sources: the drop zone, the pulls); the Best plays board
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


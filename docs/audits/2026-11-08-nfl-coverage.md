# The NFL's matchup pages, backtested on last season

Vincent, 2026-11-08: "we need to use all these cheat sheets to determine matchups", then "can't we backtest with last
season's data?". The pages the pull keeps (`pages` in `lib/nfl/propfinder-nfl.js`) are season totals: a season's own games
cannot be graded on them (the totals hold the games). PropFinder serves 2025's for the coverage and rushing pages
(`coverageTeamsPrior`, `coverageReceiverSplitsPrior`, `rushingSlateBoardPrior`, `{priorSeason}` in the route), so 2025's
profiles were graded on 2026's games (weeks 1–8, PropFinder's own logs on the latest pull): leak-free.
`tools/audit/nfl_coverage.py` on the audit export (`nfl-pf-export.yml`).

**Nothing shipped**: no matchup page beat a player's own average. The pages stay kept every week, to grade again on 2026's
own snapshots at mid-season and at the end.

## Coverage (receivers)

His 2025 yards per route by coverage (Cover 0 / 1 / 2 / 3 / 4 / 6, 2 Man …; shrunk toward his overall at 40 routes),
weighted by his 2026 opponent's 2025 coverage mix (`topSchemes` play shares) → a factor on his decayed average
(half-life 4 games, from 15 yards). 968 receiver-games; the factor 0.93–1.12 (5th–95th percentile).

| Coverage fit | n | got ÷ his average | doubled it (and + 40) |
|---|---|---|---|
| worst fifth | 194 | 0.95 | 7.2% |
| 2 | 193 | 0.94 | 7.3% |
| 3 | 194 | 1.02 | 12.9% |
| 4 | 193 | 0.94 | 6.2% |
| best fifth | 194 | 0.97 | 9.3% |

Mean miss 23.89 yards without it, 24.19 × the factor (24.02 at half of it). Per target instead of per route (shrunk at 10
or 25 targets), or per route at 15: no order by fifth, the miss 24.0–24.3. A weight fitted on weeks 1–4 came out negative
(−1) and read weeks 5–8 0.3 yards better: a better coverage fit worth fewer yards is noise, not a signal.

## Rushing (backs)

His 2025 run direction (left / middle / right, adjusted) against his opponent's 2025 yards a game through each gap (the
teams on the export's slate), over the league's. 250 back-games: got ÷ average by fifth (stingy → soft) 0.91, 1.06, 0.94,
1.15, 0.95; the miss 27.75 → 28.59 with the fit. The opponent's gap yards alone: 0.93, 0.89, 1.20, 1.05, 0.95; 27.75 → 27.85.

## Reading it

As every matchup read measured this week (the NFL's big games, the NBA's ceiling and outliers, PropFinder's own note on
WR vs CB: "a lean rather than an edge … about a percent of game-to-game variance"): the role moves a player's number
(his target share: `TGT_SHARE`, the same day, `docs/audits/2026-11-08-nfl-sources.md`), how the defense lines up does not
measurably. Limits: 2025's coverage mixes for 2026's defenses (coordinators change), eight weeks of games.

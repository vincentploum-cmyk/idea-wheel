# The NBA: a star out, and who takes his production

Vincent, 2026-11-09: "yesterday Reaves had 40+ points. I could have known that since Doncic was out and Reaves had a good
match up. However, our model was still way too conservative. I want our model to look at these things. So, based on the
injury report, adjust the game script, including our projection for assists, points, rebounds, etc."

## What the board read for Reaves on 2026-11-08 (LAL at DET)

The site's board replayed on the night (`nba-audit.mjs --cocktail beforeStarOut`): **19.4 points** (he scored 43), 4.2
assists, 4.0 rebounds. His rate × minutes was 23.0; DET's defense took 4% off; then **the team ceiling cut 12%**. Nobody
was lifted for Doncic, because **Doncic was not on ESPN's injury report** (the night's report lists Grimes and Reaves for
LAL, nothing for Doncic, who had scored 45 a game over his last four). LeBron James was not on it either. The board counted
Doncic as playing, so the Lakers' rates added up to more than their expected total, and the ceiling cut everyone,
Reaves included.

## Shipped (`COCKTAIL` in `lib/nba/picks.js`; the board before it is `COCKTAIL_BEFORE_STAR_OUT`)

1. **Who sits, from RotoWire's lineups as well as the report** (`lineupOuts`, `applyLineupOuts` in
   `lib/picks/injuries.js`). A player under RotoWire's "MAY NOT PLAY" marked OUT / OFS / SUSP or at a 0% chance to play,
   and a regular starter (8 of his last 10 starts this season) missing from a **confirmed** five, are marked
   `injury: 'Out'`, `injuryFrom: 'lineup'`. The teammates-out read, the team ceiling and his own plays then treat him as out.
   A five with a name the pull does not know sits nobody, so a spelling mismatch cannot bench a starter who plays. The
   stored box score overrides all of this once the game is in.
2. **Every out player of this season counts, by his share of each teammate's memory** (`recipe.outRule: 'overlap'`).
   Until now only a player who had played 3 of the team's last 5 games counted. From his third missed game nobody was
   lifted, even though a teammate's rate (half-life 15 games) still held mostly games beside him. Now every out player at
   20+ minutes a game this season (3+ games) counts. His production is × the share of the teammate's decayed memory he
   took part in, player by player (`outRead.byKey`). A long absence fades as the games without him fill the memory, and a
   teammate who never played with him gets nothing.
3. **The ceiling sums the lifted rates** (`ceilingOut`). Before, a star flagged out dropped the side's sum under the
   team's total. The ceiling's cut (about 0.9 on a typical side, holding down rates that run high) went away, and the lift
   came on top. Out nights then ran high: +0.93 points of bias on the moved rows this season, with 1 and 2 alone.
4. **Smaller exponents for rebounds, assists and threes** (`STAR_OUT`: points 0.7, rebounds 0.3, assists 0.55, threes
   0.4, PRA 0.62, else 0.45; were 0.53 / 0.77 / 0.64 / 0.68 / 0.6). A bench player promoted to the five already gets the
   lineup's minutes model. At the old exponents, rebounds and threes ran high once the lineup absences came in.

Reaves on 2026-11-08 now reads **26.0 points**, 5.5 assists and 4.3 rebounds, with a ×1.13 environment where it was
×0.84.

## Replayed (the site's board, `nba-audit.mjs`, the same player-games)

| | 2025-26 before | after | this season before | after |
| --- | --- | --- | --- | --- |
| Points: MAE / bias | 4.88 / −0.64 | **4.84 / −0.12** | 4.82 / +0.48 | **4.79** / +0.48 |
| Rebounds | 1.96 / −0.14 | 1.96 / −0.01 | 1.91 | 1.91 |
| Assists | 1.44 / −0.16 | **1.43** / −0.08 | 1.43 | **1.42** |
| Threes | 1.01 | 1.01 | 0.99 | 0.99 |
| PRA | 6.30 / −0.99 | **6.22 / −0.21** | 6.27 | **6.20** |
| Rung Brier: points / reb / ast / threes / PRA | .1702 / .1552 / .1359 / .1108 / .1692 | .1686 / .1537 / .1346 / .1104 / .1677 | .1623 / .1500 / .1308 / .1095 / .1653 | .1614 / .1498 / .1303 / .1092 / .1639 |

On 2025-26, the nights a teammate was out ran **0.73 points low** on the board before (the "too conservative" Vincent saw).
After the change they run +0.09. Steals and blocks are unchanged. The replay's 2025-26 injury report is ESPN's block as
fetched now (end-of-season statuses), so the lineup read (the box score's starters stand in for RotoWire's confirmed
five) carries most of the absences there. On the site the report and RotoWire carry them together.

Each part alone (MAE, points, this season / 2025-26): the overlap rule 4.799 / 4.870; with the ceiling on the lifts
4.792 / 4.869; the lineup outs on the old rule 4.842 / 4.871 (the lift on top of a vanished cut); all three 4.792 / 4.840.

## What the box scores say about who takes the production (`tools/audit/nba_star_out.py`)

Rotation player-games of 2024-25 (the fit), 2025-26 and this season (the checks). Each is a Poisson fit with his own read
(rate a minute decayed at 15–20 games × minutes this season decayed at 3) as the offset. Tables:
`2026-11-09-nba-star-out-tables.md`.

- **The overlap rule beats the last-five rule** on every stat over 2025-26, and on points, assists and threes this
  season. On points, the deviance gain over no read is −41.5 against −32.4 (2025-26) and −70.8 against −38.5 (this
  season).
- **The second option does not take more than his share. He takes less.** Vincent's read was that the star's usage goes
  to the next creator. The data say the lift is largest for the players with the smallest share, through their extra
  minutes. On points, the interaction of the absence with his share is −0.55 (z −13). With a fifth of the team's points
  out, a player at 4% of the team's points gets about ×1.25, one at 25% about ×1.07. Over 2025-26 and this season, the
  biggest share-holders on a star's night off (absence ≥ 20% of the team, his share ≥ 18%; 351 player-games) scored 25.1
  against a read of 24.9. The flat lift had them at 27.1. Reaves's 43 was a night far over any read: the night Doncic sat
  on 2026-10-28 he scored 16. The interaction was not shipped. It would have read Reaves lower, and its gain on the
  checks is small next to the absences the board was missing.
- **The opponent's absences** (their production of the stat, or their minutes, out) add nothing on points, assists or
  threes (z 0–1). On rebounds they add a little (+0.09, z 2.8, a big man out on the other side), below the bar.
- **Game script.** The book's total and spread were measured on 2026-10-28 and added nothing per player. Pace and the
  opponent's misses added nothing once the opponent's table was in (`2026-11-03-nba-stat-drivers.md`). What moves the
  script is the absences, and that is what this change reads.

## Rerun

```bash
node tools/audit/nba-box-fetch.mjs --from 2024-10-22 --to 2025-04-13 --out .nhl-data/audit/nba-box   # and 2025-26, this season
python3 -I tools/audit/nba_star_out.py --box .nhl-data/audit/nba-box --out docs/audits/2026-11-09-nba-star-out-tables.md
# the board: this season, then 2025-26 (NODE_OPTIONS=--max-old-space-size=6500 for the season)
for ck in beforeStarOut site; do node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --date 2026-11-08 --from 2026-10-20 --raw .nhl-data/audit/nba --out .nhl-data/audit/ab --prior .nhl-data/audit/nba/prior/games --cocktail $ck --tag -$ck; done
python3 -I tools/audit/nba_ab.py .nhl-data/audit/ab/nba-2026-11-08-beforeStarOut-summary.json .nhl-data/audit/ab/nba-2026-11-08-site-summary.json "2026-27"
```

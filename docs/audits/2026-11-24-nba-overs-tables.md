# Why players beat their projection by a lot (tables)

Written by `tools/audit/nba_overs.py` on the site's boards rebuilt from the store. A big night: pts +10 and 1.5× the projection, reb +4 and 1.5× the projection, ast +4 and 1.5× the projection, tpm +3 and 2.0× the projection. Every player-night with a box score and a projection.

## How many

| stat | player-nights | big nights | share | of them starters |
| --- | ---: | ---: | ---: | ---: |
| pts | 4867 | 284 | 5.8% | 74% |
| reb | 4867 | 302 | 6.2% | 67% |
| ast | 4835 | 140 | 2.9% | 80% |
| tpm | 4478 | 129 | 2.9% | 70% |

## What happened on the big nights (share of big nights against every other night)

moreMin: 6+ minutes over the board's minutes; moreShots: shots a minute 1.25× his usual; moreThrees: 3+ more threes tried than usual; moreFT: 5+ more free throws tried; hotFG: 12+ points over his usual field-goal %; hot3: 15+ over his usual three %; moreRebRate / moreAstRate: 1.35× his usual a minute; lateScratch: a teammate who usually plays 20+ was not in the box score and not listed out before the game; otGame: overtime; close: final margin 8 or less.

| why | pts big | pts rest | reb big | reb rest | ast big | ast rest | tpm big | tpm rest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| moreMin | 33% | 11% | 37% | 10% | 26% | 11% | 30% | 11% |
| moreShots | 57% | 20% | 24% | 22% | 17% | 22% | 50% | 21% |
| moreThrees | 38% | 7% | 11% | 9% | 11% | 9% | 73% | 8% |
| moreFT | 18% | 3% | 7% | 3% | 6% | 3% | 7% | 3% |
| hotFG | 56% | 7% | 14% | 10% | 23% | 10% | 50% | 10% |
| hot3 | 46% | 9% | 14% | 11% | 16% | 11% | 78% | 10% |
| moreRebRate | 26% | 25% | 83% | 21% | 31% | 24% | 26% | 25% |
| moreAstRate | 25% | 30% | 36% | 29% | 96% | 27% | 26% | 29% |
| lateScratch | 4% | 3% | 5% | 3% | 1% | 3% | 5% | 3% |
| otGame | 10% | 5% | 8% | 5% | 6% | 5% | 9% | 5% |
| close | 48% | 40% | 50% | 40% | 46% | 40% | 43% | 41% |

## The surplus split: minutes against rate a minute

Surplus = got − projected. The minutes part = projected ÷ projected minutes × (minutes played − projected minutes); the rest is the rate.

| stat | big nights | surplus | from minutes | from the rate |
| --- | ---: | ---: | ---: | ---: |
| pts | 284 | +14.3 | +1.9 | +12.4 |
| reb | 302 | +5.8 | +1.1 | +4.8 |
| ast | 140 | +5.5 | +0.4 | +5.0 |
| tpm | 129 | +3.9 | +0.3 | +3.7 |

## Before tip: which reads made a big night more likely

Big-night share by quintile of the read (Q1 low … Q5 high), each stat. A read worth using rises or falls across the quintiles where the projection does not explain it (projOverAvg: the board's figure over his last-ten average; ceilGap: his best of the last ten less the projection; cv10: his last ten's spread over their mean; minRise: last-five minutes less his season's; fgaRise: last-five shots over his season's; matchup / env: the board's factors; lateOut is not known before tip and is left out).

### projOverAvg

| stat | Q1 | Q2 | Q3 | Q4 | Q5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| pts | 7.2% | 4.9% | 7.3% | 5.9% | 3.9% |
| reb | 5.2% | 5.9% | 6.4% | 7.5% | 6.1% |
| ast | 2.9% | 3.8% | 3.5% | 2.6% | 1.7% |
| tpm | 2.3% | 3.0% | 3.6% | 3.1% | 2.3% |

### ceilGap

| stat | Q1 | Q2 | Q3 | Q4 | Q5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| pts | 4.0% | 4.2% | 5.8% | 6.5% | 8.7% |
| reb | 6.8% | 5.0% | 6.2% | 6.7% | 6.4% |
| ast | 1.7% | 1.9% | 1.9% | 3.9% | 5.2% |
| tpm | 2.1% | 1.7% | 2.8% | 3.8% | 4.0% |

### cv10

| stat | Q1 | Q2 | Q3 | Q4 | Q5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| pts | 5.5% | 7.1% | 7.1% | 6.5% | 3.0% |
| reb | 7.9% | 6.2% | 6.7% | 6.1% | 4.2% |
| ast | 2.8% | 6.0% | 2.9% | 2.3% | 0.5% |
| tpm | 2.6% | 4.1% | 3.6% | 2.7% | 1.5% |

### minRise

| stat | Q1 | Q2 | Q3 | Q4 | Q5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| pts | 5.1% | 6.1% | 4.9% | 6.9% | 6.2% |
| reb | 6.0% | 7.3% | 4.8% | 6.0% | 7.0% |
| ast | 2.6% | 3.0% | 2.7% | 3.6% | 2.6% |
| tpm | 2.5% | 3.4% | 2.3% | 4.0% | 2.2% |

### fgaRise

| stat | Q1 | Q2 | Q3 | Q4 | Q5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| pts | 4.2% | 6.0% | 5.2% | 6.8% | 7.0% |
| reb | 7.1% | 6.0% | 5.5% | 5.3% | 7.1% |
| ast | 2.6% | 3.8% | 2.6% | 3.2% | 2.3% |
| tpm | 3.1% | 3.4% | 2.7% | 3.1% | 2.1% |

### matchup

| stat | Q1 | Q2 | Q3 | Q4 | Q5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| pts | 5.3% | 5.2% | 6.7% | 7.3% | 4.6% |
| reb | 5.5% | 5.9% | 7.3% | 6.6% | 5.7% |
| ast | 2.1% | 4.0% | 2.7% | 2.8% | 2.9% |
| tpm | 3.8% | 3.2% | 2.8% | 2.8% | 1.8% |

### env

| stat | Q1 | Q2 | Q3 | Q4 | Q5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| pts | 7.4% | 5.1% | 5.1% | 6.0% | 5.5% |
| reb | 6.9% | 6.2% | 5.7% | 5.9% | 6.5% |
| ast | 2.7% | 2.9% | 3.6% | 2.6% | 2.7% |
| tpm | 2.3% | 3.0% | 3.7% | 2.8% | 2.6% |

### model

| stat | Q1 | Q2 | Q3 | Q4 | Q5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| pts | 5.8% | 5.1% | 6.1% | 5.9% | 5.8% |
| reb | 8.0% | 6.3% | 5.6% | 6.2% | 5.0% |
| ast | 2.5% | 3.5% | 3.0% | 3.3% | 1.9% |
| tpm | 1.8% | 1.9% | 3.4% | 3.0% | 3.9% |

### sideOut

| stat | Q1 | Q2 | Q3 | Q4 | Q5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| pts | 6.5% | 4.8% | 5.7% | 5.1% | 7.1% |
| reb | 7.8% | 5.3% | 5.4% | 5.9% | 6.6% |
| ast | 3.6% | 2.6% | 2.2% | 2.9% | 3.2% |
| tpm | 2.2% | 2.6% | 3.3% | 2.8% | 3.5% |

### u_usg

| stat | Q1 | Q2 | Q3 | Q4 | Q5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| pts | 3.2% | 6.3% | 4.1% | 7.9% | 7.7% |
| reb | 6.5% | 5.7% | 6.5% | 6.3% | 6.2% |
| ast | 1.3% | 2.8% | 2.1% | 3.5% | 4.8% |
| tpm | 2.2% | 2.2% | 1.9% | 4.8% | 3.2% |

## The biggest nights

| date | player | stat | projected | got | minutes (board) | shots (usual) | threes tried (usual) | free throws (usual) | why |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |
| 2026-11-22 | josh giddey (CHI vs DEN) | ast | 8.9 | 22 | 41 (33) | 17 (9.1) | 5 (3.7) | 2 (1.9) | moreMin, moreShots, hotFG, moreRebRate, moreAstRate, otGame |
| 2026-10-24 | jalen johnson (ATL vs HOU) | ast | 5.8 | 16 | 38 (28) | 19 (16.6) | 7 (5.0) | 10 (4.3) | moreMin, moreFT, moreAstRate |
| 2026-11-07 | dayron sharpe (BKN vs ATL) | ast | 3.0 | 13 | 32 (26) | 8 (5.2) | 2 (1.0) | 4 (2.4) | moreMin, moreAstRate |
| 2026-11-02 | braden smith (IND vs ATL) | ast | 0.7 | 10 | 42 (6) | 13 (0.8) | 3 (0.5) | 2 (0.5) | moreMin, moreShots, hotFG, moreRebRate, moreAstRate |
| 2026-11-05 | franz wagner (ORL vs PHX) | ast | 6.1 | 15 | 38 (38) | 13 (17.7) | 1 (5.0) | 4 (5.6) | moreAstRate |
| 2026-11-22 | bam adebayo (MIA vs OKC) | ast | 3.4 | 12 | 37 (37) | 11 (12.3) | 0 (3.3) | 9 (6.9) | hotFG, moreRebRate, moreAstRate |
| 2026-10-31 | dean wade (PHI vs CHA) | ast | 1.5 | 10 | 30 (30) | 5 (4.1) | 3 (2.6) | 0 (0.3) | moreAstRate |
| 2026-11-13 | davion mitchell (MIA vs CLE) | ast | 9.0 | 17 | 39 (38) | 14 (12.5) | 7 (5.6) | 6 (2.6) | moreRebRate, moreAstRate |
| 2026-11-17 | quentin grimes (LAL vs CHA) | pts | 13.3 | 47 | 42 (33) | 24 (6.2) | 14 (3.2) | 6 (3.2) | moreMin, moreShots, moreThrees, hotFG, hot3, moreRebRate, otGame |
| 2026-11-20 | james harden (CLE vs IND) | pts | 17.5 | 51 | 40 (37) | 26 (11.9) | 11 (6.9) | 14 (5.1) | moreShots, moreThrees, moreFT, hotFG, hot3 |
| 2026-11-21 | tyler herro (MIL vs PHI) | pts | 17.8 | 50 | 40 (31) | 23 (15.8) | 12 (7.3) | 13 (4.1) | moreMin, moreThrees, moreFT, hotFG, hot3, moreRebRate |
| 2026-11-22 | svi mykhailiuk (UTAH vs DAL) | pts | 7.9 | 39 | 32 (23) | 23 (5.0) | 15 (3.5) | 5 (0.4) | moreMin, moreShots, moreThrees, hotFG, hot3 |
| 2026-11-06 | luka doncic (LAL vs POR) | pts | 23.3 | 53 | 38 (37) | 33 (23.5) | 15 (13.6) | 18 (10.5) | moreShots, moreFT |
| 2026-11-12 | cade cunningham (DET vs WSH) | pts | 22.9 | 52 | 48 (34) | 25 (17.3) | 5 (6.5) | 18 (5.5) | moreMin, moreFT, hotFG, hot3, otGame |
| 2026-11-17 | brice sensabaugh (UTAH vs LAC) | pts | 12.8 | 40 | 35 (23) | 21 (7.4) | 11 (3.9) | 1 (1.2) | moreMin, moreShots, moreThrees, hotFG, hot3, moreRebRate, moreAstRate |
| 2026-10-21 | ty jerome (MEM vs UTAH) | pts | 17.9 | 45 | 32 (23) | 25 (13.8) | 10 (6.2) | 7 (3.2) | moreMin, moreShots, moreThrees, hotFG, moreRebRate |
| 2026-11-06 | morez johnson (DAL vs UTAH) | reb | 3.1 | 17 | 24 (17) | 8 (5.1) | 2 (0.8) | 2 (2.2) | moreMin, moreRebRate |
| 2026-11-04 | victor wembanyama (SA vs DAL) | reb | 11.5 | 24 | 34 (32) | 28 (21.0) | 8 (6.0) | 23 (6.0) | moreFT, moreRebRate |
| 2026-11-04 | ausar thompson (DET vs PHI) | reb | 6.5 | 17 | 34 (27) | 10 (7.2) | 0 (0.5) | 4 (2.5) | moreMin, moreRebRate |
| 2026-10-23 | yaxel lendeborg (GS vs MEM) | reb | 3.0 | 13 | 37 (29) | 11 (11.0) | 3 (4.0) | 12 (3.0) | moreMin, moreFT, moreRebRate, moreAstRate |
| 2026-10-25 | adem bona (PHI vs DET) | reb | 3.0 | 13 | 25 (11) | 5 (3.5) | 0 (0.1) | 0 (1.5) | moreMin, moreRebRate |
| 2026-11-13 | taylor hendricks (MEM vs NO) | reb | 2.1 | 12 | 19 (8) | 5 (2.2) | 3 (1.3) | 3 (1.0) | moreMin, moreRebRate, moreAstRate |
| 2026-10-26 | moussa diabate (CHA vs WSH) | reb | 7.5 | 17 | 35 (26) | 6 (4.7) | 0 (0.0) | 4 (1.6) | moreMin, moreRebRate |
| 2026-11-04 | dyson daniels (ATL vs WSH) | reb | 6.7 | 16 | 34 (33) | 13 (9.1) | 4 (1.2) | 0 (2.0) | moreRebRate, moreAstRate |
| 2026-11-22 | svi mykhailiuk (UTAH vs DAL) | tpm | 1.6 | 10 | 32 (23) | 23 (5.0) | 15 (3.5) | 5 (0.4) | moreMin, moreShots, moreThrees, hotFG, hot3 |
| 2026-11-17 | quentin grimes (LAL vs CHA) | tpm | 1.6 | 10 | 42 (33) | 24 (6.2) | 14 (3.2) | 6 (3.2) | moreMin, moreShots, moreThrees, hotFG, hot3, moreRebRate, otGame |
| 2026-11-08 | daniss jenkins (DET vs LAL) | tpm | 1.2 | 8 | 32 (25) | 17 (7.5) | 15 (3.5) | 5 (1.6) | moreMin, moreShots, moreThrees |
| 2026-10-31 | darius acuff (SAC vs MEM) | tpm | 2.4 | 9 | 37 (36) | 25 (23.8) | 14 (9.0) | 5 (4.8) | moreThrees, hot3, moreRebRate |
| 2026-10-21 | anthony edwards (MIN vs MIA) | tpm | 2.7 | 9 | 33 (32) | 29 (19.2) | 17 (8.5) | 5 (6.8) | moreShots, moreThrees, moreRebRate |
| 2026-11-17 | brice sensabaugh (UTAH vs LAC) | tpm | 1.8 | 8 | 35 (23) | 21 (7.4) | 11 (3.9) | 1 (1.2) | moreMin, moreShots, moreThrees, hotFG, hot3, moreRebRate, moreAstRate |
| 2026-10-27 | julian champagnie (SA vs SAC) | tpm | 2.1 | 8 | 25 (28) | 14 (8.4) | 13 (5.8) | 0 (0.8) | moreShots, moreThrees, hotFG, hot3, moreAstRate |
| 2026-10-31 | marcus smart (HOU vs OKC) | tpm | 1.1 | 7 | 36 (23) | 10 (7.0) | 10 (4.5) | 3 (1.6) | moreMin, moreThrees, hotFG, hot3, moreRebRate |

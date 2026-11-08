# What predicts a goalie's saves: the tables (2026-11-08)

5784 starts: 2024-25 2624, 2025-26 2624, 2026-27 536. Every read from games dated before the start.

## 1. The night as it lands

| season | starts | saves | sd | shots | team_sog | pulled | ot | p25 | p28 | p30 |
|---|---|---|---|---|---|---|---|---|---|---|
| 2024.000 | 2624.000 | 24.678 | 7.042 | 27.413 | 28.274 | 0.043 | 0.207 | 0.500 | 0.332 | 0.234 |
| 2025.000 | 2624.000 | 24.162 | 7.096 | 26.961 | 27.832 | 0.048 | 0.248 | 0.472 | 0.314 | 0.222 |
| 2026.000 | 536.000 | 23.651 | 6.765 | 26.575 | 27.382 | 0.052 | 0.220 | 0.444 | 0.263 | 0.190 |

Saves against shots faced (starts he finished): r = 0.973; the save % that night: r = 0.459. Saves = shots × save %: the variance of saves is 41.5; shots alone at the league's .900 leaves 2.4.

Pulled (left a regulation game before 50 minutes): 4.6% of starts, 11.1 saves on average against 25.0. Overtime: +1.7 saves.

Home 23.91 / away 24.79 saves; home 26.59 / away 27.67 shots.

## 2. Each read alone (rows where both teams have 10+ games this season)

| read | n | rho_saves | rho_shots |
|---|---|---|---|
| opponent × team ÷ league (blended) | 4774 | 0.251 | 0.268 |
| geometric mean (blended) | 4774 | 0.249 | 0.265 |
| site shape: opponent shots × shrunk save % | 4774 | 0.203 | 0.206 |
| opponent shots, blended | 4774 | 0.198 | 0.203 |
| opponent shots a game, season | 4774 | 0.193 | 0.199 |
| opponent attempts a game | 4774 | 0.190 | 0.196 |
| opponent shots, last 20 | 4774 | 0.188 | 0.195 |
| opponent unblocked attempts | 4774 | 0.181 | 0.189 |
| opponent shots at tonight's venue | 4774 | 0.181 | 0.188 |
| team allowed, blended | 4774 | 0.165 | 0.181 |
| opponent shots, last 10 | 4774 | 0.161 | 0.170 |
| his team shots allowed, season | 4774 | 0.160 | 0.177 |
| team shots allowed, last 20 | 4774 | 0.157 | 0.172 |
| team shots allowed at the venue | 4774 | 0.150 | 0.166 |
| team shots allowed, last 10 | 4774 | 0.141 | 0.156 |
| team unblocked allowed | 4774 | 0.141 | 0.162 |
| opponent chances | 4774 | 0.134 | 0.148 |
| opponent shots, last 5 | 4774 | 0.133 | 0.144 |
| team attempts allowed | 4774 | 0.132 | 0.151 |
| team shots allowed, last 5 | 4774 | 0.124 | 0.141 |
| his shots faced a start | 4713 | 0.119 | 0.127 |
| opponent goal diff − team goal diff | 4774 | 0.118 | 0.138 |
| his saves a start | 4713 | 0.117 | 0.123 |
| his saves, last 10 | 4713 | 0.110 | 0.118 |
| his saves, last 5 | 4713 | 0.101 | 0.108 |
| opponent shots, last season | 4774 | 0.095 | 0.099 |
| opponent goal diff a game | 4774 | 0.095 | 0.105 |
| team chances allowed | 4774 | 0.092 | 0.119 |
| team shots allowed, last season | 4774 | 0.090 | 0.090 |
| opponent high-danger chances | 4774 | 0.085 | 0.096 |
| team goal diff a game | 4774 | -0.082 | -0.101 |
| rink's recorded-shots index | 4774 | 0.069 | 0.071 |
| home | 4774 | -0.046 | -0.061 |
| his save %, shrunk (site) | 4774 | 0.041 | 0.030 |
| his team on a back to back | 4774 | 0.040 | 0.046 |
| his save %, raw | 4713 | 0.040 | 0.030 |
| his team's days of rest | 4774 | -0.040 | -0.048 |
| opponent's days of rest | 4774 | 0.037 | 0.042 |
| opponent on a back to back | 4774 | -0.028 | -0.035 |
| his save %, last season | 2344 | -0.027 | -0.039 |
| penalties the opponent draws (PIM a game) | 4774 | -0.009 | -0.009 |
| his pulled rate this season | 4713 | 0.008 | 0.013 |
| his team's PIM a game | 4774 | -0.006 | -0.003 |

## 3. Formulas fitted on 2024-25, checked on the seasons after

**2025-26** (2624 starts; the base rate's Brier at 25+ is 0.2492)

| formula | mae | rmse | r2 | bias | brier22 | brier25 | brier28 | brier30 |
|---|---|---|---|---|---|---|---|---|
| site shape (as shipped) | 5.4896 | 7.0251 | 0.0435 | -1.0962 | 0.2343 | 0.2466 | 0.2087 | 0.1661 |
| his saves a start (bettor) | 5.5478 | 7.0554 | 0.0138 | -0.3661 | 0.2272 | 0.2471 | 0.2133 | 0.1715 |
| opponent shots, blended | 5.4306 | 6.9431 | 0.0425 | -0.0925 | 0.2241 | 0.2406 | 0.2075 | 0.1663 |
| team allowed, blended | 5.4759 | 6.9757 | 0.0340 | -0.1838 | 0.2240 | 0.2432 | 0.2095 | 0.1696 |
| opponent + team (blended) | 5.3243 | 6.8252 | 0.0754 | 0.1944 | 0.2187 | 0.2345 | 0.2021 | 0.1635 |
| log5 (blended) | 5.3160 | 6.8188 | 0.0769 | -0.1663 | 0.2184 | 0.2346 | 0.2017 | 0.1635 |
| + save % shrunk | 5.3240 | 6.8258 | 0.0757 | 0.2506 | 0.2186 | 0.2344 | 0.2021 | 0.1635 |
| + home, arena | 5.3162 | 6.8059 | 0.0812 | 0.2665 | 0.2180 | 0.2336 | 0.2015 | 0.1631 |
| + goal diff | 5.3174 | 6.8067 | 0.0810 | 0.2705 | 0.2181 | 0.2336 | 0.2016 | 0.1631 |
| + last 10 windows | 5.3215 | 6.8148 | 0.0780 | 0.1645 | 0.2185 | 0.2343 | 0.2022 | 0.1633 |
| + attempts | 5.3143 | 6.8003 | 0.0823 | 0.2147 | 0.2178 | 0.2335 | 0.2015 | 0.1630 |
| + his saves a start | 5.3173 | 6.8068 | 0.0810 | 0.2701 | 0.2181 | 0.2336 | 0.2016 | 0.1631 |
| + rest, penalties | 5.3118 | 6.8024 | 0.0837 | 0.3823 | 0.2173 | 0.2336 | 0.2015 | 0.1630 |

**2026-27** (536 starts; the base rate's Brier at 25+ is 0.2469)

| formula | mae | rmse | r2 | bias | brier22 | brier25 | brier28 | brier30 |
|---|---|---|---|---|---|---|---|---|
| site shape (as shipped) | 5.2067 | 6.7786 | 0.0237 | -1.1634 | 0.2318 | 0.2491 | 0.1915 | 0.1493 |
| his saves a start (bettor) | 5.2656 | 6.8155 | -0.0045 | -0.7521 | 0.2291 | 0.2495 | 0.2008 | 0.1574 |
| opponent shots, blended | 5.1149 | 6.6360 | 0.0372 | -0.2415 | 0.2238 | 0.2396 | 0.1875 | 0.1477 |
| team allowed, blended | 5.1701 | 6.6963 | 0.0218 | -0.3956 | 0.2262 | 0.2440 | 0.1931 | 0.1521 |
| opponent + team (blended) | 5.0620 | 6.5858 | 0.0525 | 0.3039 | 0.2218 | 0.2366 | 0.1838 | 0.1452 |
| log5 (blended) | 5.0669 | 6.6233 | 0.0479 | -0.6160 | 0.2208 | 0.2389 | 0.1879 | 0.1469 |
| + save % shrunk | 5.0759 | 6.5969 | 0.0503 | 0.3733 | 0.2226 | 0.2372 | 0.1838 | 0.1455 |
| + home, arena | 5.0582 | 6.5780 | 0.0559 | 0.3797 | 0.2209 | 0.2352 | 0.1832 | 0.1451 |
| + goal diff | 5.0545 | 6.5781 | 0.0560 | 0.3895 | 0.2209 | 0.2350 | 0.1830 | 0.1451 |
| + last 10 windows | 5.0343 | 6.5646 | 0.0582 | 0.2709 | 0.2201 | 0.2349 | 0.1838 | 0.1455 |
| + attempts | 5.0021 | 6.5371 | 0.0671 | 0.3445 | 0.2187 | 0.2323 | 0.1816 | 0.1440 |
| + his saves a start | 5.0546 | 6.5785 | 0.0559 | 0.3891 | 0.2209 | 0.2350 | 0.1830 | 0.1451 |
| + rest, penalties | 5.0827 | 6.6236 | 0.0501 | 0.6931 | 0.2212 | 0.2361 | 0.1839 | 0.1457 |

Coefficients of "+ goal diff" on 2024-25: const -38.464, o_sf_bl +0.727, t_sa_bl +0.541, g_pct_shr +18.507, home -0.677, arena_idx +10.552, gd_diff -0.036; residual SD 6.89.

Refitted on 2024-25 + 2025-26: const -34.370, o_sf_bl +0.710, t_sa_bl +0.621, g_pct_shr +14.474, home -0.899, arena_idx +8.537, gd_diff +0.060; residual SD 6.84.

### Shots first, then the save %

| season | save_pct | mae | rmse | bias |
|---|---|---|---|---|
| 2025 | league .900 | 5.3125 | 6.7999 | 0.2093 |
| 2025 | his shrunk (site, k=150) | 5.3139 | 6.8016 | 0.2304 |
| 2025 | his shrunk toward last season | 5.3153 | 6.8026 | 0.2228 |
| 2025 | his raw this season | 5.3221 | 6.8109 | 0.2469 |
| 2026 | league .900 | 5.0355 | 6.5593 | 0.3113 |
| 2026 | his shrunk (site, k=150) | 5.0541 | 6.5707 | 0.3530 |
| 2026 | his shrunk toward last season | 5.0659 | 6.5771 | 0.3919 |
| 2026 | his raw this season | 5.0807 | 6.6136 | 0.3741 |

## 4. The spread around the projection

| band | n | lam | saves | sd | sd_finished | pulled |
|---|---|---|---|---|---|---|
| (0, 22] | 556 | 21.05 | 20.99 | 5.83 | 5.24 | 0.05 |
| (22, 24] | 1203 | 23.07 | 23.46 | 6.76 | 5.99 | 0.05 |
| (24, 26] | 1011 | 24.91 | 25.13 | 6.96 | 6.34 | 0.04 |
| (26, 28] | 342 | 26.73 | 27.54 | 7.16 | 6.51 | 0.05 |
| (28, 40] | 48 | 28.82 | 28.33 | 9.22 | 6.44 | 0.15 |

The residual's SD 6.76 (the site uses 6 × save % ≈ 5.4); skew -0.16; finished starts only 6.05.

| mark | read | said | landed | brier | top_said | top_landed | top_n |
|---|---|---|---|---|---|---|---|
| 22+ | site shape, SD 5.4 | 0.741 | 0.643 | 0.234 | 0.760 | 0.656 | 2859 |
| 22+ | fitted, normal SD 6.9 | 0.625 | 0.643 | 0.219 | 0.690 | 0.710 | 1909 |
| 22+ | fitted, empirical residuals | 0.634 | 0.643 | 0.218 | 0.701 | 0.709 | 2007 |
| 25+ | site shape, SD 5.4 | 0.547 | 0.467 | 0.247 | 0.682 | 0.568 | 1061 |
| 25+ | fitted, normal SD 6.9 | 0.460 | 0.467 | 0.234 | 0.652 | 0.693 | 309 |
| 25+ | fitted, empirical residuals | 0.453 | 0.467 | 0.234 | 0.657 | 0.683 | 366 |
| 28+ | site shape, SD 5.4 | 0.341 | 0.305 | 0.206 | 0.655 | 0.548 | 166 |
| 28+ | fitted, normal SD 6.9 | 0.301 | 0.305 | 0.198 | 0.623 | 0.900 | 10 |
| 28+ | fitted, empirical residuals | 0.290 | 0.305 | 0.199 | 0.631 | 0.833 | 12 |
| 30+ | site shape, SD 5.4 | 0.224 | 0.216 | 0.163 | 0.607 | 0.667 | 3 |
| 30+ | fitted, normal SD 6.9 | 0.212 | 0.216 | 0.160 | nan | nan | 0 |
| 30+ | fitted, empirical residuals | 0.202 | 0.216 | 0.160 | 0.607 | 1.000 | 1 |

The calls at 60%+ by band of the said chance (fitted, empirical residuals), every mark from 20 to 32 pooled:

| band | n | said | landed |
|---|---|---|---|
| (0.0, 0.3] | 15272 | 0.185 | 0.188 |
| (0.3, 0.4] | 6185 | 0.350 | 0.375 |
| (0.4, 0.5] | 4901 | 0.452 | 0.481 |
| (0.5, 0.6] | 4526 | 0.551 | 0.572 |
| (0.6, 0.7] | 4802 | 0.650 | 0.661 |
| (0.7, 0.8] | 3700 | 0.744 | 0.755 |
| (0.8, 1.0] | 1694 | 0.844 | 0.844 |

## 5. Against a line at his own saves a start (a stand-in for the book)

Books had no saves lines on record here before 2026-10-31; the usual line sits near the goalie's average, so the stand-in is his saves a start this season (3+ starts) rounded to the half below, o24.5 for 24.9. The over hit rate by how far the formula sat from that line:

| gapb | n | gap | over | saves | line |
|---|---|---|---|---|---|
| (-20, -3] | 283 | -4.290 | 0.304 | 23.887 | 27.443 |
| (-3, -2] | 277 | -2.458 | 0.339 | 23.177 | 25.493 |
| (-2, -1] | 404 | -1.488 | 0.426 | 23.371 | 24.827 |
| (-1, 0] | 478 | -0.492 | 0.481 | 23.925 | 24.054 |
| (0, 1] | 467 | 0.476 | 0.540 | 24.137 | 23.613 |
| (1, 2] | 336 | 1.480 | 0.601 | 24.301 | 22.583 |
| (2, 3] | 224 | 2.453 | 0.661 | 24.795 | 21.987 |
| (3, 20] | 218 | 4.375 | 0.775 | 25.908 | 20.784 |

Every start: the over at his own average landed 50.4% (2687 starts). The under is helped by the pulled starts (5.1%).

### Which side drives it: the opponent's shots or the team's shots allowed

- 2025-26: opponent's shots ρ 0.222, team's allowed ρ 0.201 with the shots he faced
- 2026-27: opponent's shots ρ 0.167, team's allowed ρ 0.089 with the shots he faced

### The extreme matchups (top / bottom fifth of the fitted projection)

| q | n | lam | saves | p25 | p28 | p30 | pulled |
|---|---|---|---|---|---|---|---|
| lowest | 632 | 21.174 | 21.112 | 0.263 | 0.136 | 0.081 | 0.046 |
| 2 | 632 | 22.755 | 23.275 | 0.415 | 0.253 | 0.179 | 0.052 |
| 3 | 632 | 23.728 | 24.097 | 0.503 | 0.304 | 0.198 | 0.047 |
| 4 | 632 | 24.781 | 25.024 | 0.533 | 0.362 | 0.253 | 0.047 |
| highest | 632 | 26.485 | 26.867 | 0.622 | 0.470 | 0.372 | 0.052 |

## 6. The rinks: shots credited at home against the same teams on the road

The index as of each rink's last game in the rows (last season and this, shrunk at 20 home games): 1.03 = the two sides were credited 3% more shots there than the same teams on the road. Highest and lowest five:

| arena | as of | index |
|---|---|---|
| COL | 2026-11-07 | 1.041 |
| MIN | 2026-11-07 | 1.030 |
| TOR | 2026-11-07 | 1.022 |
| BUF | 2026-11-06 | 1.020 |
| CGY | 2026-11-06 | 1.018 |
| CAR | 2026-11-07 | 0.965 |
| NYR | 2026-11-05 | 0.955 |
| CHI | 2026-11-02 | 0.944 |
| PHI | 2026-11-03 | 0.936 |
| DAL | 2026-11-07 | 0.924 |


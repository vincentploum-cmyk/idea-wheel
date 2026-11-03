# Tables: what predicts each NBA stat (2026-11-03)

Rows: rotation players (his last ten at 15+ minutes, 5+ games behind him) who played. Fit = 2024-25, checks = 2025-26, 2026-27 (unchanged). Player-games: 2024-25 19,949, 2025-26 20,577, 2026-27 1,617.

## 1. His own record: how far back to look

Average miss (MAE, the stat's units) of each read on its own. EWk = a decayed average whose weights halve every k games (his whole history across seasons); PM = the same per minute × his minutes (decayed at 5 games); "× this season's minutes" = his minutes decayed at 3 games over this season's games alone from his first game, last season's average before it; the board = this season 0.65 · its last ten 0.35.

### Points

| Read | 2024-25 | 2025-26 | 2026-27 |
| --- | --- | --- | --- |
| Last game | 6.597 | 6.587 | 6.720 |
| L3 | 5.551 | 5.495 | 5.674 |
| L5 | 5.319 | 5.285 | 5.634 |
| L10 | 5.166 | 5.126 | 5.517 |
| L20 | 5.120 | 5.107 | 5.478 |
| L40 | 5.139 | 5.153 | 5.301 |
| Last 82 | 5.178 | 5.261 | 5.243 |
| The board's windows | 5.091 | 5.051 | 5.368 |
| EW1 | 5.498 | 5.463 | 5.605 |
| EW2 | 5.216 | 5.182 | 5.448 |
| EW3 | 5.124 | 5.094 | 5.413 |
| EW5 | 5.066 | 5.042 | 5.379 |
| EW7 | 5.054 | 5.035 | 5.354 |
| EW10 | 5.056 | 5.046 | 5.325 |
| EW15 | 5.071 | 5.076 | 5.286 |
| EW20 | 5.086 | 5.107 | 5.260 |
| EW30 | 5.111 | 5.159 | 5.235 |
| EW50 | 5.140 | 5.226 | 5.225 |
| EW100 | 5.169 | 5.300 | 5.243 |
| PM3 | 5.118 | 5.095 | 5.439 |
| PM5 | 5.066 | 5.042 | 5.379 |
| PM10 | 5.040 | 5.018 | 5.308 |
| PM15 | 5.038 | 5.019 | 5.273 |
| PM20 | 5.041 | 5.024 | 5.254 |
| PM30 | 5.048 | 5.037 | 5.232 |
| PM50 | 5.058 | 5.057 | 5.224 |
| Rate EW10 × this season's minutes | 5.009 | 4.976 | 5.013 |
| Rate EW15 × this season's minutes ← best on the fit | **5.006** | **4.976** | 4.989 |
| Rate EW20 × this season's minutes | 5.009 | 4.981 | 4.976 |
| Rate EW30 × this season's minutes | 5.016 | 4.993 | **4.967** |

His rate a minute (decayed, half-life in rows) × his minutes (decayed, half-life in columns), MAE on 2024-25:

| Rate \ minutes | EW1 | EW2 | EW3 | EW5 | EW10 |
| --- | --- | --- | --- | --- | --- |
| EW5 | 5.116 | 5.078 | 5.069 | 5.066 | 5.077 |
| EW10 | 5.075 | 5.041 | 5.035 | 5.040 | 5.056 |
| EW15 | 5.068 | 5.036 | **5.032** | 5.038 | 5.057 |
| EW20 | 5.069 | 5.037 | 5.034 | 5.041 | 5.061 |
| EW30 | 5.074 | 5.043 | 5.040 | 5.048 | 5.070 |
| EW50 | 5.083 | 5.053 | 5.050 | 5.058 | 5.082 |

His rate a minute (decayed, half-life in rows) × his minutes (decayed, half-life in columns), MAE on 2025-26:

| Rate \ minutes | EW1 | EW2 | EW3 | EW5 | EW10 |
| --- | --- | --- | --- | --- | --- |
| EW5 | 5.073 | 5.040 | 5.037 | 5.042 | 5.063 |
| EW10 | 5.035 | 5.009 | 5.008 | 5.018 | 5.046 |
| EW15 | 5.031 | **5.007** | 5.007 | 5.019 | 5.051 |
| EW20 | 5.035 | 5.011 | 5.011 | 5.024 | 5.059 |
| EW30 | 5.045 | 5.022 | 5.023 | 5.037 | 5.074 |
| EW50 | 5.062 | 5.039 | 5.041 | 5.057 | 5.095 |

Best on the fit season: **Rate EW15 × this season's minutes**.

### Rebounds

| Read | 2024-25 | 2025-26 | 2026-27 |
| --- | --- | --- | --- |
| Last game | 2.660 | 2.614 | 2.539 |
| L3 | 2.227 | 2.197 | 2.222 |
| L5 | 2.136 | 2.108 | 2.129 |
| L10 | 2.072 | 2.048 | 2.105 |
| L20 | 2.055 | 2.022 | 2.080 |
| L40 | 2.050 | 2.022 | 2.037 |
| Last 82 | 2.052 | 2.042 | 2.018 |
| The board's windows | 2.040 | 2.008 | 2.122 |
| EW1 | 2.213 | 2.185 | 2.170 |
| EW2 | 2.100 | 2.073 | 2.085 |
| EW3 | 2.063 | 2.037 | 2.061 |
| EW5 | 2.037 | 2.010 | 2.047 |
| EW7 | 2.030 | 2.001 | 2.040 |
| EW10 | 2.027 | 1.998 | 2.033 |
| EW15 | 2.027 | 2.001 | 2.025 |
| EW20 | 2.029 | 2.006 | 2.020 |
| EW30 | 2.034 | 2.016 | 2.015 |
| EW50 | 2.041 | 2.028 | 2.010 |
| EW100 | 2.048 | 2.042 | 2.013 |
| PM3 | 2.064 | 2.038 | 2.073 |
| PM5 | 2.037 | 2.010 | 2.047 |
| PM10 | 2.022 | 1.991 | 2.031 |
| PM15 | 2.018 | 1.988 | 2.029 |
| PM20 | 2.017 | 1.988 | 2.029 |
| PM30 | 2.018 | 1.990 | 2.029 |
| PM50 | 2.019 | 1.994 | 2.030 |
| Rate EW10 × this season's minutes | 2.008 | 1.978 | 1.930 |
| Rate EW15 × this season's minutes | 2.005 | 1.974 | 1.925 |
| Rate EW20 × this season's minutes ← best on the fit | **2.004** | **1.974** | 1.923 |
| Rate EW30 × this season's minutes | 2.004 | 1.976 | **1.923** |

His rate a minute (decayed, half-life in rows) × his minutes (decayed, half-life in columns), MAE on 2024-25:

| Rate \ minutes | EW1 | EW2 | EW3 | EW5 | EW10 |
| --- | --- | --- | --- | --- | --- |
| EW5 | 2.053 | 2.039 | 2.037 | 2.037 | 2.042 |
| EW10 | 2.037 | 2.022 | 2.020 | 2.022 | 2.027 |
| EW15 | 2.033 | 2.019 | 2.017 | 2.018 | 2.023 |
| EW20 | 2.032 | 2.018 | **2.016** | 2.017 | 2.022 |
| EW30 | 2.032 | 2.019 | 2.016 | 2.018 | 2.022 |
| EW50 | 2.034 | 2.020 | 2.018 | 2.019 | 2.024 |

His rate a minute (decayed, half-life in rows) × his minutes (decayed, half-life in columns), MAE on 2025-26:

| Rate \ minutes | EW1 | EW2 | EW3 | EW5 | EW10 |
| --- | --- | --- | --- | --- | --- |
| EW5 | 2.026 | 2.011 | 2.009 | 2.010 | 2.017 |
| EW10 | 2.006 | 1.993 | 1.990 | 1.991 | 1.998 |
| EW15 | 2.002 | 1.989 | 1.987 | 1.988 | 1.995 |
| EW20 | 2.001 | 1.988 | **1.987** | 1.988 | 1.994 |
| EW30 | 2.003 | 1.990 | 1.988 | 1.990 | 1.996 |
| EW50 | 2.006 | 1.994 | 1.992 | 1.994 | 2.001 |

Best on the fit season: **Rate EW20 × this season's minutes**.

### Assists

| Read | 2024-25 | 2025-26 | 2026-27 |
| --- | --- | --- | --- |
| Last game | 1.916 | 1.894 | 1.865 |
| L3 | 1.627 | 1.615 | 1.651 |
| L5 | 1.561 | 1.551 | 1.596 |
| L10 | 1.521 | 1.515 | 1.537 |
| L20 | 1.504 | 1.503 | 1.539 |
| L40 | 1.504 | 1.510 | 1.496 |
| Last 82 | 1.513 | 1.537 | 1.489 |
| The board's windows | 1.487 | 1.492 | 1.567 |
| EW1 | 1.620 | 1.606 | 1.623 |
| EW2 | 1.536 | 1.528 | 1.550 |
| EW3 | 1.510 | 1.503 | 1.525 |
| EW5 | 1.492 | 1.489 | 1.508 |
| EW7 | 1.487 | 1.486 | 1.501 |
| EW10 | 1.485 | 1.487 | 1.496 |
| EW15 | 1.486 | 1.493 | 1.490 |
| EW20 | 1.490 | 1.500 | 1.486 |
| EW30 | 1.495 | 1.512 | 1.484 |
| EW50 | 1.503 | 1.529 | 1.483 |
| EW100 | 1.510 | 1.546 | 1.484 |
| PM3 | 1.511 | 1.506 | 1.530 |
| PM5 | 1.492 | 1.489 | 1.508 |
| PM10 | 1.480 | 1.480 | 1.493 |
| PM15 | 1.479 | 1.480 | 1.487 |
| PM20 | 1.479 | 1.482 | 1.483 |
| PM30 | 1.481 | 1.486 | 1.478 |
| PM50 | 1.484 | 1.493 | 1.473 |
| Rate EW10 × this season's minutes | 1.469 | **1.471** | 1.454 |
| Rate EW15 × this season's minutes ← best on the fit | **1.468** | 1.471 | 1.452 |
| Rate EW20 × this season's minutes | 1.468 | 1.473 | 1.450 |
| Rate EW30 × this season's minutes | 1.470 | 1.478 | **1.447** |

His rate a minute (decayed, half-life in rows) × his minutes (decayed, half-life in columns), MAE on 2024-25:

| Rate \ minutes | EW1 | EW2 | EW3 | EW5 | EW10 |
| --- | --- | --- | --- | --- | --- |
| EW5 | 1.493 | 1.489 | 1.490 | 1.492 | 1.496 |
| EW10 | 1.481 | 1.477 | 1.478 | 1.480 | 1.485 |
| EW15 | 1.480 | **1.476** | 1.477 | 1.479 | 1.483 |
| EW20 | 1.480 | 1.476 | 1.477 | 1.479 | 1.484 |
| EW30 | 1.481 | 1.478 | 1.478 | 1.481 | 1.486 |
| EW50 | 1.484 | 1.480 | 1.481 | 1.484 | 1.489 |

His rate a minute (decayed, half-life in rows) × his minutes (decayed, half-life in columns), MAE on 2025-26:

| Rate \ minutes | EW1 | EW2 | EW3 | EW5 | EW10 |
| --- | --- | --- | --- | --- | --- |
| EW5 | 1.486 | 1.484 | 1.485 | 1.489 | 1.495 |
| EW10 | 1.477 | 1.474 | 1.476 | 1.480 | 1.487 |
| EW15 | 1.477 | **1.474** | 1.476 | 1.480 | 1.487 |
| EW20 | 1.479 | 1.476 | 1.478 | 1.482 | 1.489 |
| EW30 | 1.484 | 1.480 | 1.482 | 1.486 | 1.494 |
| EW50 | 1.490 | 1.487 | 1.488 | 1.493 | 1.501 |

Best on the fit season: **Rate EW15 × this season's minutes**.

### Threes

| Read | 2024-25 | 2025-26 | 2026-27 |
| --- | --- | --- | --- |
| Last game | 1.274 | 1.239 | 1.190 |
| L3 | 1.094 | 1.066 | 1.061 |
| L5 | 1.050 | 1.031 | 1.034 |
| L10 | 1.012 | 0.997 | 1.029 |
| L20 | 1.000 | 0.986 | 1.021 |
| L40 | 0.993 | 0.983 | 1.006 |
| Last 82 | 0.994 | 0.988 | 0.994 |
| The board's windows | 0.996 | 0.983 | 1.035 |
| EW1 | 1.089 | 1.064 | 1.046 |
| EW2 | 1.034 | 1.013 | 1.018 |
| EW3 | 1.014 | 0.996 | 1.011 |
| EW5 | 0.999 | 0.983 | 1.009 |
| EW7 | 0.993 | 0.978 | 1.007 |
| EW10 | 0.989 | 0.976 | 1.005 |
| EW15 | 0.988 | 0.976 | 1.001 |
| EW20 | 0.988 | 0.977 | 0.998 |
| EW30 | 0.989 | 0.980 | 0.994 |
| EW50 | 0.992 | 0.984 | 0.990 |
| EW100 | 0.994 | 0.989 | 0.987 |
| PM3 | 1.012 | 0.995 | 1.016 |
| PM5 | 0.999 | 0.983 | 1.009 |
| PM10 | 0.990 | 0.975 | 1.002 |
| PM15 | 0.988 | 0.974 | 0.998 |
| PM20 | 0.987 | 0.974 | 0.995 |
| PM30 | 0.988 | 0.974 | 0.991 |
| PM50 | 0.989 | 0.974 | 0.988 |
| Rate EW10 × this season's minutes | 0.987 | 0.972 | 0.972 |
| Rate EW15 × this season's minutes | 0.985 | 0.970 | 0.969 |
| Rate EW20 × this season's minutes ← best on the fit | **0.984** | 0.970 | 0.967 |
| Rate EW30 × this season's minutes | 0.984 | **0.970** | **0.965** |
| 3PA EW5 × his % | 0.993 | 0.978 | 1.002 |
| 3PA EW10 × his % | 0.991 | 0.977 | 1.004 |
| 3PA EW15 × his % | 0.991 | 0.979 | 1.002 |
| 3PA EW20 × his % | 0.991 | 0.981 | 0.999 |
| 3PA EW30 × his % | 0.993 | 0.983 | 0.995 |

His rate a minute (decayed, half-life in rows) × his minutes (decayed, half-life in columns), MAE on 2024-25:

| Rate \ minutes | EW1 | EW2 | EW3 | EW5 | EW10 |
| --- | --- | --- | --- | --- | --- |
| EW5 | 1.005 | 1.001 | 1.000 | 0.999 | 0.998 |
| EW10 | 0.995 | 0.991 | 0.991 | 0.990 | 0.989 |
| EW15 | 0.992 | 0.989 | 0.988 | 0.988 | 0.988 |
| EW20 | 0.991 | 0.988 | 0.988 | **0.987** | 0.987 |
| EW30 | 0.991 | 0.988 | 0.988 | 0.988 | 0.988 |
| EW50 | 0.992 | 0.989 | 0.989 | 0.989 | 0.990 |

His rate a minute (decayed, half-life in rows) × his minutes (decayed, half-life in columns), MAE on 2025-26:

| Rate \ minutes | EW1 | EW2 | EW3 | EW5 | EW10 |
| --- | --- | --- | --- | --- | --- |
| EW5 | 0.986 | 0.984 | 0.983 | 0.983 | 0.983 |
| EW10 | 0.978 | 0.976 | 0.975 | 0.975 | 0.976 |
| EW15 | 0.976 | 0.974 | 0.974 | 0.974 | 0.975 |
| EW20 | 0.975 | 0.973 | 0.973 | 0.974 | 0.975 |
| EW30 | 0.974 | **0.973** | 0.973 | 0.974 | 0.975 |
| EW50 | 0.974 | 0.973 | 0.973 | 0.974 | 0.976 |

Best on the fit season: **Rate EW20 × this season's minutes**.

## 2. On top of his own record: what moves tonight's figure

Each read added alone to his best own read (a Poisson fit, his own read as the offset). **Elasticity**: × (factor)^b, so b 0.5 means a matchup 10% above the league adds about 5% to his figure; z its standard error away from 0 (on the fit season, overdispersion in). **Deviance gain** on each check season, scored unchanged: the share of the own read's Poisson deviance the read takes away (‰ = per thousand); a negative figure means the read made the check worse.

### Points (own read: Rate EW15 × this season's minutes)

| Read | Elasticity b | z | Gain 2025-26 | Gain 2026-27 |
| --- | --- | --- | --- | --- |
| Teammates out: their production a game | +0.70 | +20.8 | +18.7‰ | +21.2‰ |
| Teammates out: their minutes | +0.76 | +19.7 | +18.2‰ | +22.7‰ |
| The opponent, all positions, season | +0.96 | +7.6 | +4.5‰ | +1.6‰ |
| The opponent, all positions, last ten | +0.91 | +7.9 | +4.1‰ | +3.4‰ |
| Opponent's points allowed per 100 | +1.02 | +6.5 | +2.8‰ | +1.9‰ |
| Opponent's FG% allowed | +0.90 | +5.1 | +2.4‰ | +1.3‰ |
| Pace (the two teams' possessions) | +1.15 | +3.3 | +1.6‰ | -0.7‰ |
| The opponent at his position, season | +0.33 | +5.4 | +1.3‰ | -1.1‰ |
| Offensive boards the opponent allows | +0.24 | +3.4 | +1.2‰ | -0.2‰ |
| His team's points per 100 | -0.24 | -1.8 | +0.7‰ | -0.3‰ |
| His team on a back-to-back | +0.02 | +2.1 | +0.5‰ | +1.4‰ |
| The opponent at his position, last ten | +0.15 | +3.8 | +0.5‰ | -0.6‰ |
| His head to head (last 4 meetings, 2 years) | +0.03 | +2.5 | +0.4‰ | -0.2‰ |
| His team's FG% | -0.12 | -1.0 | +0.3‰ | -0.2‰ |
| Rebounds on offer (both teams' misses) | +0.12 | +0.8 | +0.3‰ | -0.0‰ |
| Opponent's offensive-rebound rate | -0.02 | -0.5 | +0.2‰ | +0.3‰ |
| Home | +0.01 | +1.4 | +0.2‰ | -0.2‰ |
| Opponent on a back-to-back | +0.02 | +1.8 | +0.1‰ | +1.0‰ |
| Opponent's misses a game | +0.03 | +0.2 | +0.1‰ | +0.0‰ |
| His own split at tonight's venue | +0.04 | +0.6 | +0.0‰ | -0.0‰ |
| His minutes: last 3 over his decayed | -0.01 | -0.2 | -0.1‰ | -0.1‰ |
| His position over the opponent's all (the split alone) | +0.14 | +2.0 | -0.1‰ | -0.6‰ |
| Opponent's 3P% allowed | +0.27 | +1.9 | -0.5‰ | +1.2‰ |
| Opponent's 3PA allowed | +0.48 | +5.3 | -0.9‰ | +1.2‰ |

Selected on the fit season (forward, each new read at |z| ≥ 3): Teammates out: their production a game b +0.70 (z +20.8), The opponent, all positions, season b +0.94 (z +7.6).

| Season | Own read MAE | With the selected reads | Deviance gain | The board's windows MAE |
| --- | --- | --- | --- | --- |
| 2024-25 | 5.010 | 4.959 | +22.0‰ | 5.091 |
| 2025-26 | 4.979 | 4.930 | +22.8‰ | 5.051 |
| 2026-27 | 5.001 | 4.930 | +22.9‰ | 5.368 |

| Group of reads | Gain 2025-26 | Gain 2026-27 |
| --- | --- | --- |
| Matchup (opponent tables) | +4.8‰ | +2.1‰ |
| Game environment (pace, misses, team) | +2.8‰ | -1.1‰ |
| Teammates out | +18.3‰ | +20.4‰ |
| Schedule (home, rest) | +0.7‰ | +1.8‰ |
| His venue split | +0.0‰ | -0.0‰ |
| Head to head | +0.4‰ | -0.2‰ |
| Minutes trend | -0.1‰ | -0.1‰ |

### Rebounds (own read: Rate EW20 × this season's minutes)

| Read | Elasticity b | z | Gain 2025-26 | Gain 2026-27 |
| --- | --- | --- | --- | --- |
| Teammates out: their production a game | +0.52 | +13.4 | +7.0‰ | +9.3‰ |
| Teammates out: their minutes | +0.50 | +12.1 | +6.8‰ | +8.0‰ |
| The opponent, all positions, season | +0.73 | +5.6 | +5.3‰ | -0.1‰ |
| The opponent, all positions, last ten | +0.64 | +6.6 | +4.5‰ | -0.6‰ |
| Opponent's offensive-rebound rate | -0.12 | -2.5 | +1.6‰ | +1.0‰ |
| The opponent at his position, season | +0.15 | +2.4 | +1.6‰ | -0.4‰ |
| Offensive boards the opponent allows | +0.27 | +3.6 | +1.1‰ | -1.2‰ |
| The opponent at his position, last ten | +0.09 | +2.6 | +0.9‰ | -0.4‰ |
| Pace (the two teams' possessions) | +0.65 | +1.8 | +0.8‰ | -0.0‰ |
| Opponent's misses a game | +0.27 | +2.4 | +0.7‰ | -0.3‰ |
| Opponent's points allowed per 100 | +0.47 | +2.8 | +0.7‰ | -0.5‰ |
| Opponent's FG% allowed | +0.30 | +1.6 | +0.5‰ | -0.4‰ |
| Rebounds on offer (both teams' misses) | +0.20 | +1.2 | +0.3‰ | -0.2‰ |
| His team on a back-to-back | +0.02 | +1.9 | +0.2‰ | +0.7‰ |
| Opponent's 3P% allowed | -0.08 | -0.5 | +0.1‰ | -0.1‰ |
| Opponent's 3PA allowed | +0.23 | +2.4 | +0.1‰ | +0.1‰ |
| His own split at tonight's venue | +0.03 | +0.5 | +0.0‰ | -0.1‰ |
| Home | +0.00 | +0.5 | +0.0‰ | -0.1‰ |
| His team's points per 100 | -0.02 | -0.1 | -0.0‰ | +0.0‰ |
| His team's FG% | +0.11 | +0.8 | -0.0‰ | +0.1‰ |
| His head to head (last 4 meetings, 2 years) | +0.04 | +2.8 | -0.0‰ | +1.4‰ |
| His position over the opponent's all (the split alone) | -0.01 | -0.2 | -0.0‰ | +0.0‰ |
| His minutes: last 3 over his decayed | -0.07 | -2.8 | -0.1‰ | -0.1‰ |
| Opponent on a back-to-back | +0.02 | +2.4 | -0.1‰ | +1.6‰ |

Selected on the fit season (forward, each new read at |z| ≥ 3): Teammates out: their production a game b +0.53 (z +13.8), The opponent, all positions, last ten b +0.65 (z +6.8), His minutes: last 3 over his decayed b -0.10 (z -3.9).

| Season | Own read MAE | With the selected reads | Deviance gain | The board's windows MAE |
| --- | --- | --- | --- | --- |
| 2024-25 | 2.004 | 1.992 | +11.2‰ | 2.040 |
| 2025-26 | 1.973 | 1.963 | +11.4‰ | 2.008 |
| 2026-27 | 1.922 | 1.909 | +9.2‰ | 2.122 |

| Group of reads | Gain 2025-26 | Gain 2026-27 |
| --- | --- | --- |
| Matchup (opponent tables) | +5.7‰ | -0.9‰ |
| Game environment (pace, misses, team) | +4.1‰ | +1.3‰ |
| Teammates out | +6.7‰ | +9.4‰ |
| Schedule (home, rest) | +0.0‰ | +1.8‰ |
| His venue split | +0.0‰ | -0.1‰ |
| Head to head | -0.0‰ | +1.4‰ |
| Minutes trend | -0.1‰ | -0.1‰ |

### Assists (own read: Rate EW15 × this season's minutes)

| Read | Elasticity b | z | Gain 2025-26 | Gain 2026-27 |
| --- | --- | --- | --- | --- |
| Teammates out: their production a game | +0.77 | +18.4 | +10.9‰ | +13.6‰ |
| Teammates out: their minutes | +0.78 | +15.9 | +8.1‰ | +14.8‰ |
| The opponent, all positions, season | +1.04 | +11.0 | +5.3‰ | -0.4‰ |
| The opponent, all positions, last ten | +0.86 | +10.5 | +4.5‰ | +0.7‰ |
| Opponent's points allowed per 100 | +1.60 | +8.0 | +3.7‰ | +0.8‰ |
| Opponent's FG% allowed | +1.36 | +6.1 | +2.9‰ | +0.4‰ |
| The opponent at his position, season | +0.58 | +9.4 | +2.6‰ | -2.7‰ |
| Offensive boards the opponent allows | +0.41 | +4.5 | +1.2‰ | +0.3‰ |
| Opponent's offensive-rebound rate | -0.10 | -1.7 | +1.0‰ | +0.7‰ |
| Pace (the two teams' possessions) | +1.20 | +2.9 | +1.0‰ | +0.1‰ |
| The opponent at his position, last ten | +0.32 | +8.0 | +0.7‰ | -1.9‰ |
| His team's points per 100 | -0.45 | -2.6 | +0.5‰ | +0.1‰ |
| His team's FG% | -0.44 | -2.9 | +0.4‰ | -0.5‰ |
| His minutes: last 3 over his decayed | +0.05 | +1.5 | +0.4‰ | -0.6‰ |
| His head to head (last 4 meetings, 2 years) | +0.01 | +0.7 | +0.2‰ | -0.2‰ |
| Home | +0.02 | +2.1 | +0.2‰ | +0.4‰ |
| Rebounds on offer (both teams' misses) | +0.20 | +1.0 | +0.1‰ | +0.1‰ |
| His own split at tonight's venue | +0.10 | +1.3 | +0.1‰ | -0.0‰ |
| His position over the opponent's all (the split alone) | +0.24 | +3.0 | +0.1‰ | -0.8‰ |
| His team on a back-to-back | +0.01 | +0.6 | +0.1‰ | +0.6‰ |
| Opponent's 3P% allowed | -0.02 | -0.1 | -0.0‰ | -0.0‰ |
| Opponent on a back-to-back | +0.02 | +1.9 | -0.0‰ | +1.4‰ |
| Opponent's misses a game | -0.07 | -0.5 | -0.1‰ | -0.1‰ |
| Opponent's 3PA allowed | +1.14 | +9.7 | -1.6‰ | +1.1‰ |

Selected on the fit season (forward, each new read at |z| ≥ 3): Teammates out: their production a game b +0.77 (z +18.5), The opponent, all positions, season b +0.62 (z +5.1), The opponent at his position, last ten b +0.18 (z +4.3), Opponent's 3PA allowed b +0.51 (z +3.5).

| Season | Own read MAE | With the selected reads | Deviance gain | The board's windows MAE |
| --- | --- | --- | --- | --- |
| 2024-25 | 1.468 | 1.452 | +22.4‰ | 1.487 |
| 2025-26 | 1.472 | 1.460 | +14.8‰ | 1.492 |
| 2026-27 | 1.453 | 1.431 | +12.5‰ | 1.567 |

| Group of reads | Gain 2025-26 | Gain 2026-27 |
| --- | --- | --- |
| Matchup (opponent tables) | +5.2‰ | -0.9‰ |
| Game environment (pace, misses, team) | +3.0‰ | -0.0‰ |
| Teammates out | +11.1‰ | +12.3‰ |
| Schedule (home, rest) | +0.2‰ | +2.0‰ |
| His venue split | +0.1‰ | -0.0‰ |
| Head to head | +0.2‰ | -0.2‰ |
| Minutes trend | +0.4‰ | -0.6‰ |

### Threes (own read: Rate EW20 × this season's minutes)

| Read | Elasticity b | z | Gain 2025-26 | Gain 2026-27 |
| --- | --- | --- | --- | --- |
| Opponent's 3PA allowed | +1.11 | +7.1 | +2.8‰ | +1.0‰ |
| Teammates out: their production a game | +0.64 | +10.9 | +2.5‰ | +9.6‰ |
| Teammates out: their minutes | +0.72 | +11.0 | +2.5‰ | +8.3‰ |
| The opponent, all positions, season | +0.72 | +5.3 | +2.0‰ | +1.3‰ |
| The opponent, all positions, last ten | +0.41 | +4.4 | +1.2‰ | +1.2‰ |
| The opponent at his position, season | +0.28 | +3.8 | +1.0‰ | -0.7‰ |
| The opponent at his position, last ten | +0.14 | +3.1 | +0.7‰ | -0.6‰ |
| His team's points per 100 | -0.35 | -1.5 | +0.4‰ | +0.0‰ |
| Opponent's points allowed per 100 | +0.89 | +3.4 | +0.3‰ | +0.4‰ |
| Pace (the two teams' possessions) | +1.43 | +2.7 | +0.3‰ | -0.5‰ |
| Home | +0.03 | +2.4 | +0.3‰ | -0.4‰ |
| Opponent's offensive-rebound rate | -0.08 | -1.0 | +0.2‰ | +0.3‰ |
| His team's FG% | -0.17 | -0.8 | +0.2‰ | +0.0‰ |
| Rebounds on offer (both teams' misses) | +0.29 | +1.1 | +0.1‰ | +0.0‰ |
| Opponent on a back-to-back | +0.01 | +0.6 | +0.1‰ | +0.3‰ |
| His own split at tonight's venue | +0.06 | +0.8 | +0.1‰ | -0.2‰ |
| His position over the opponent's all (the split alone) | +0.09 | +1.0 | +0.0‰ | -0.4‰ |
| Opponent's misses a game | +0.15 | +0.8 | -0.0‰ | +0.0‰ |
| Offensive boards the opponent allows | +0.37 | +3.1 | -0.0‰ | +0.4‰ |
| His team on a back-to-back | -0.00 | -0.2 | -0.1‰ | -0.1‰ |
| His head to head (last 4 meetings, 2 years) | +0.02 | +1.6 | -0.1‰ | -0.3‰ |
| His minutes: last 3 over his decayed | -0.06 | -1.3 | -0.1‰ | -0.4‰ |
| Opponent's FG% allowed | +0.32 | +1.1 | -0.1‰ | -0.0‰ |
| Opponent's 3P% allowed | -0.44 | -1.9 | -0.1‰ | -0.5‰ |

Selected on the fit season (forward, each new read at |z| ≥ 3): Teammates out: their minutes b +0.72 (z +11.0), Opponent's 3PA allowed b +1.12 (z +7.2).

| Season | Own read MAE | With the selected reads | Deviance gain | The board's windows MAE |
| --- | --- | --- | --- | --- |
| 2024-25 | 0.991 | 0.986 | +8.3‰ | 0.996 |
| 2025-26 | 0.976 | 0.972 | +5.5‰ | 0.983 |
| 2026-27 | 0.975 | 0.963 | +9.1‰ | 1.035 |

| Group of reads | Gain 2025-26 | Gain 2026-27 |
| --- | --- | --- |
| Matchup (opponent tables) | +3.0‰ | +0.4‰ |
| Game environment (pace, misses, team) | +0.8‰ | +0.0‰ |
| Teammates out | +2.6‰ | +9.2‰ |
| Schedule (home, rest) | +0.3‰ | -0.1‰ |
| His venue split | +0.1‰ | -0.2‰ |
| Head to head | -0.1‰ | -0.3‰ |
| Minutes trend | -0.1‰ | -0.4‰ |

## 3. In the stat's units: his figure against his own read, by third of each read

On 2025-26: the average of (what he did − his own read) in the bottom, middle and top third of each read, and the top third minus the bottom. A read that carries signal climbs from left to right.

### Points

| Read | Bottom third | Middle | Top third | Top − bottom | As % of his read |
| --- | --- | --- | --- | --- | --- |
| The opponent at his position, season | -0.05 | -0.20 | +0.41 | **+0.46** | +3.8% |
| The opponent at his position, last ten | +0.02 | -0.06 | +0.19 | **+0.17** | +1.9% |
| The opponent, all positions, season | -0.38 | -0.11 | +0.65 | **+1.03** | +9.2% |
| Pace (the two teams' possessions) | -0.15 | -0.19 | +0.49 | **+0.64** | +6.6% |
| Rebounds on offer (both teams' misses) | -0.11 | -0.11 | +0.38 | **+0.49** | +5.3% |
| Offensive boards the opponent allows | -0.09 | -0.17 | +0.42 | **+0.51** | +5.2% |
| Opponent's 3PA allowed | +0.11 | -0.15 | +0.20 | **+0.09** | +2.3% |
| Opponent's 3P% allowed | +0.24 | -0.18 | +0.09 | **-0.15** | -0.0% |
| Opponent's points allowed per 100 | -0.22 | -0.16 | +0.54 | **+0.77** | +7.4% |
| Teammates out: their production a game | -0.55 | -0.46 | +1.16 | **+1.71** | +17.5% |
| His own split at tonight's venue | +0.05 | +0.02 | +0.08 | **+0.03** | +0.2% |
| Head to head (2+ meetings, 17,001 rows) | -0.08 | +0.11 | +0.22 | **+0.30** | +2.8% |

### Rebounds

| Read | Bottom third | Middle | Top third | Top − bottom | As % of his read |
| --- | --- | --- | --- | --- | --- |
| The opponent at his position, season | -0.23 | -0.07 | +0.12 | **+0.35** | +8.0% |
| The opponent at his position, last ten | -0.16 | -0.07 | +0.05 | **+0.21** | +5.1% |
| The opponent, all positions, season | -0.25 | -0.10 | +0.17 | **+0.42** | +9.6% |
| Pace (the two teams' possessions) | -0.15 | -0.10 | +0.07 | **+0.22** | +4.8% |
| Rebounds on offer (both teams' misses) | -0.12 | -0.07 | +0.01 | **+0.12** | +2.6% |
| Offensive boards the opponent allows | -0.12 | -0.12 | +0.05 | **+0.17** | +3.8% |
| Opponent's 3PA allowed | -0.01 | -0.19 | +0.02 | **+0.03** | +0.1% |
| Opponent's 3P% allowed | +0.04 | -0.14 | -0.08 | **-0.11** | -1.9% |
| Opponent's points allowed per 100 | -0.10 | -0.12 | +0.04 | **+0.14** | +4.0% |
| Teammates out: their production a game | -0.21 | -0.18 | +0.20 | **+0.42** | +10.3% |
| His own split at tonight's venue | -0.08 | -0.10 | -0.00 | **+0.07** | +1.6% |
| Head to head (2+ meetings, 17,001 rows) | -0.06 | -0.07 | -0.04 | **+0.02** | -0.2% |

### Assists

| Read | Bottom third | Middle | Top third | Top − bottom | As % of his read |
| --- | --- | --- | --- | --- | --- |
| The opponent at his position, season | -0.10 | +0.01 | +0.18 | **+0.28** | +11.1% |
| The opponent at his position, last ten | -0.05 | +0.00 | +0.13 | **+0.18** | +7.5% |
| The opponent, all positions, season | -0.14 | +0.03 | +0.20 | **+0.33** | +12.4% |
| Pace (the two teams' possessions) | -0.01 | -0.05 | +0.15 | **+0.16** | +7.5% |
| Rebounds on offer (both teams' misses) | +0.01 | -0.02 | +0.10 | **+0.08** | +5.1% |
| Offensive boards the opponent allows | -0.01 | -0.02 | +0.11 | **+0.12** | +5.7% |
| Opponent's 3PA allowed | +0.01 | -0.03 | +0.11 | **+0.10** | +2.2% |
| Opponent's 3P% allowed | +0.05 | -0.05 | +0.08 | **+0.03** | +0.3% |
| Opponent's points allowed per 100 | -0.08 | -0.04 | +0.20 | **+0.28** | +10.4% |
| Teammates out: their production a game | -0.09 | -0.09 | +0.26 | **+0.35** | +17.4% |
| His own split at tonight's venue | +0.02 | -0.00 | +0.07 | **+0.05** | +2.9% |
| Head to head (2+ meetings, 17,001 rows) | -0.02 | +0.04 | +0.09 | **+0.11** | +3.5% |

### Threes

| Read | Bottom third | Middle | Top third | Top − bottom | As % of his read |
| --- | --- | --- | --- | --- | --- |
| The opponent at his position, season | -0.04 | -0.04 | +0.07 | **+0.11** | +8.6% |
| The opponent at his position, last ten | -0.02 | -0.05 | +0.06 | **+0.08** | +6.7% |
| The opponent, all positions, season | -0.06 | -0.03 | +0.08 | **+0.14** | +9.8% |
| Pace (the two teams' possessions) | -0.02 | -0.02 | +0.03 | **+0.06** | +5.1% |
| Rebounds on offer (both teams' misses) | -0.01 | -0.02 | +0.03 | **+0.04** | +5.2% |
| Offensive boards the opponent allows | +0.00 | -0.04 | +0.03 | **+0.02** | +1.0% |
| Opponent's 3PA allowed | -0.09 | -0.01 | +0.09 | **+0.17** | +11.3% |
| Opponent's 3P% allowed | -0.00 | -0.03 | +0.02 | **+0.02** | +2.8% |
| Opponent's points allowed per 100 | -0.03 | -0.02 | +0.04 | **+0.07** | +1.9% |
| Teammates out: their production a game | -0.05 | -0.04 | +0.08 | **+0.13** | +10.2% |
| His own split at tonight's venue | -0.01 | -0.01 | +0.02 | **+0.03** | +2.3% |
| Head to head (2+ meetings, 17,001 rows) | -0.04 | +0.02 | +0.01 | **+0.05** | +3.4% |

## 4. The head to head against a control

His miss in past meetings with tonight's opponent (what he did − his decayed average at the time, last four meetings within two years) against tonight's miss, beside the same for his games at the same distance in time against other teams (the control). If the opponent itself carried information, the head to head would beat the control. Correlations; rotation players, all seasons after the first.

| Stat | Meetings | Rows | r (head to head) | r (control) | Slope (head to head) | His h2h average as a read, MAE | His own read, same rows |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Points | 1 | 5,037 | +0.026 | +0.008 | +0.027 | 6.649 | 4.682 |
| Points | 2 | 7,889 | +0.020 | -0.006 | +0.028 | 6.266 | 4.930 |
| Points | 3–4 | 26,085 | +0.017 | -0.006 | +0.032 | 5.908 | 5.066 |
| Rebounds | 1 | 5,037 | +0.027 | -0.027 | +0.028 | 2.728 | 1.933 |
| Rebounds | 2 | 7,889 | +0.003 | -0.016 | +0.004 | 2.451 | 1.969 |
| Rebounds | 3–4 | 26,085 | +0.010 | -0.003 | +0.019 | 2.299 | 1.997 |
| Assists | 1 | 5,037 | +0.029 | +0.019 | +0.030 | 1.873 | 1.361 |
| Assists | 2 | 7,889 | -0.016 | -0.008 | -0.023 | 1.818 | 1.464 |
| Assists | 3–4 | 26,085 | +0.027 | -0.009 | +0.052 | 1.727 | 1.496 |
| Threes | 1 | 5,037 | -0.011 | -0.006 | -0.012 | 1.167 | 0.890 |
| Threes | 2 | 7,889 | +0.015 | +0.002 | +0.022 | 1.136 | 0.961 |
| Threes | 3–4 | 26,085 | +0.007 | +0.002 | +0.013 | 1.133 | 1.009 |

## 5. Variance explained: how much of a night is predictable at all

On 2025-26: the share of the night-to-night variance (R²) his own read explains, and with the selected reads; the miss had he known his minutes (his per-minute decayed rate × the minutes he played) as the ceiling the minutes put on it.

| Stat | Own read R² | With selected reads R² | MAE own | MAE had the minutes been known | Typical figure |
| --- | --- | --- | --- | --- | --- |
| Points | 0.441 | 0.453 | 4.976 | 4.126 | 12.6 |
| Rebounds | 0.408 | 0.416 | 1.974 | 1.729 | 4.6 |
| Assists | 0.453 | 0.460 | 1.471 | 1.343 | 2.9 |
| Threes | 0.282 | 0.284 | 0.970 | 0.904 | 1.4 |

## 6. Against the site's whole board, on the same player-games

The site's board replayed night by night by `tools/audit/nba-audit.mjs --cocktail site` (the windows, the matchup, the minutes, the teammates-out lifts and splits, the role pull, the team ceiling, the ceiling read), joined to the rows above by player and date. Average miss, and the bias (projection − actual).

| Season | Stat | Rows | The board | Bias | His own read | Own + the selected reads | Bias |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-26 | Points | 17,762 | 5.082 | -1.37 | 5.001 | **4.960** | -0.08 |
| 2025-26 | Rebounds | 17,763 | 2.014 | -0.39 | 1.987 | **1.978** | +0.04 |
| 2025-26 | Assists | 17,760 | 1.502 | -0.37 | 1.484 | **1.475** | -0.06 |
| 2025-26 | Threes | 16,897 | 1.035 | -0.14 | 1.031 | **1.031** | +0.01 |
| 2026-27 | Points | 1,521 | 5.045 | -0.11 | 5.048 | **4.990** | +0.91 |
| 2026-27 | Rebounds | 1,521 | 2.005 | -0.03 | 1.943 | **1.931** | +0.08 |
| 2026-27 | Assists | 1,520 | 1.513 | -0.10 | 1.470 | **1.448** | +0.16 |
| 2026-27 | Threes | 1,438 | 1.031 | -0.10 | 1.030 | **1.024** | +0.07 |


## 1. The opponent as a team beside its position cell

Skater-games five games into the season, where the formula reads this season's rates: 2024-25 42892, 2025-26 42815, 2026-27 7505. Over the shipped λ: (team ratio)^team × (cell ratio)^cell. "cell" is what comes off or goes onto the shipped 0.687. Correlation of the two reads 0.65.

Deviance per skater-game ×1000 against the shipped formula on the season after the fit (negative = better), 95% interval over dates

| fitted_on | k | team | z_team | cell | z_cell | read on 2025-26 | read on 2026-27 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2024-25 + 2025-26 | 0 | 0.496 | 9.690 | -0.516 | -15.339 |  | -9.0 (-13.8 … -4.7) |
| 2024-25 + 2025-26 | 3 | 0.588 | 10.228 | -0.526 | -15.696 |  | -9.7 (-14.8 … -5.1) |
| 2024-25 + 2025-26 | 5 | 0.633 | 10.403 | -0.527 | -15.810 |  | -9.9 (-14.6 … -5.1) |
| 2024-25 + 2025-26 | 10 | 0.725 | 10.629 | -0.527 | -15.951 |  | -10.3 (-15.7 … -5.6) |
| 2024-25 | 0 | 0.505 | 6.920 | -0.541 | -11.431 | -2.0 (-3.1 … -1.1) | -9.3 (-14.8 … -5.1) |
| 2024-25 | 3 | 0.590 | 7.207 | -0.548 | -11.623 | -2.1 (-3.3 … -1.1) | -10.0 (-15.0 … -5.4) |
| 2024-25 | 5 | 0.631 | 7.278 | -0.548 | -11.669 | -2.2 (-3.4 … -1.0) | -10.2 (-15.7 … -5.5) |
| 2024-25 | 10 | 0.713 | 7.339 | -0.545 | -11.708 | -2.3 (-3.6 … -1.1) | -10.6 (-16.1 … -6.0) |
| 2025-26 | 0 | 0.481 | 6.655 | -0.487 | -10.005 |  | -8.6 (-12.8 … -4.1) |
| 2025-26 | 3 | 0.581 | 7.135 | -0.500 | -10.327 |  | -9.3 (-14.5 … -5.4) |
| 2025-26 | 5 | 0.630 | 7.313 | -0.504 | -10.444 |  | -9.6 (-14.2 … -5.2) |
| 2025-26 | 10 | 0.731 | 7.575 | -0.506 | -10.609 |  | -10.0 (-14.9 … -5.7) |

**Shipped: team 0.63, cell -0.53, k = 5** (`TEAM_SHOTS_FIT`), on 2026-27

Shots over what the formula said, by fifth of the opponent's shots allowed as a team

| fifth | n | as it was | with the team |
| --- | --- | --- | --- |
| tightest fifth | 1515.000 | 1.091 | 1.060 |
| 2 | 1489.000 | 1.108 | 1.088 |
| 3 | 1506.000 | 1.086 | 1.074 |
| 4 | 1504.000 | 1.000 | 0.995 |
| loosest fifth | 1491.000 | 0.998 | 0.999 |

Shots over what the formula said, by fifth of the opponent's position cell

| fifth | n | as it was | with the team |
| --- | --- | --- | --- |
| tightest fifth | 1514.000 | 1.182 | 1.075 |
| 2 | 1488.000 | 1.091 | 1.043 |
| 3 | 1510.000 | 1.060 | 1.052 |
| 4 | 1494.000 | 1.018 | 1.029 |
| loosest fifth | 1499.000 | 0.959 | 1.015 |

3+ SOG calls at 50%+: as it was 565, said 61.4%, landed 58.2%; with the team 587, said 60.6%, landed 58.8%. Brier of 3+ 0.1514 → 0.1508. Best 3 a night 62.9% → 63.8%, best 10 59.1% → 59.4%. The formula's level: shots / said 1.054 → 1.041.

The team read simply added, the cell left at 0.687: exponent 0.006 (z 0.1) — nothing. The cell already carries the team at too heavy a weight; the gain is in moving the weight, not adding to it.

## 2. Shots and the minutes the posted line projects

7044 skater-games of 2026-27 with a posted line and 5+ games (88% from that game's own tweet, the rest the last lines carried). "His usual line" = the line whose mean minutes are nearest his last five; "moved" = the posted line against it. The read is the plain-rate formula with its level set right (it ran 1.042× low for forwards, 1.091× for defensemen), so "shots / read" is 1.00 for a skater on his usual line.

| who | moved | n | last5 | projected | at_usual | played | projected / at usual | played / at usual | shots / read |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| defensemen | down 2+ | 23 | 21.776 | 19.901 | 21.961 | 19.240 | 0.906 | 0.876 | 0.945 |
| defensemen | down 1 | 402 | 21.260 | 20.393 | 21.374 | 20.657 | 0.954 | 0.966 | 0.946 |
| defensemen | his usual line | 1442 | 19.633 | 19.520 | 19.520 | 19.536 | 1.000 | 1.001 | 1.004 |
| defensemen | up 1 | 382 | 18.335 | 19.199 | 18.228 | 19.142 | 1.053 | 1.050 | 1.049 |
| defensemen | up 2+ | 30 | 16.569 | 18.230 | 16.170 | 18.782 | 1.127 | 1.162 | 1.086 |
| forwards | down 2+ | 165 | 17.817 | 16.489 | 17.689 | 16.719 | 0.932 | 0.945 | 0.952 |
| forwards | down 1 | 996 | 16.929 | 16.276 | 16.873 | 16.421 | 0.965 | 0.973 | 0.977 |
| forwards | his usual line | 2520 | 15.537 | 15.443 | 15.443 | 15.513 | 1.000 | 1.005 | 0.997 |
| forwards | up 1 | 841 | 14.362 | 14.957 | 14.345 | 14.784 | 1.043 | 1.031 | 1.039 |
| forwards | up 2+ | 243 | 13.161 | 14.327 | 13.059 | 14.392 | 1.097 | 1.102 | 1.048 |

The exponent on (projected at the posted line / at his usual line), fitted over the formula: 1 = shots move in step with the projected minutes

| who | n | exponent | low | high | z |
| --- | --- | --- | --- | --- | --- |
| everyone | 7044 | 0.699 | 0.163 | 1.236 | 2.556 |
| forwards | 4765 | 0.668 | 0.045 | 1.291 | 2.102 |
| defensemen | 2279 | 0.836 | -0.220 | 1.892 | 1.551 |

The minutes he then played follow the same ratio at 0.81; shots follow the minutes played at 0.99 (the drivers study): 0.8 together, the exponent shipped (`TOI_MOVE_EXP`).

Each rule on the same read, its level set right (1496 moved up, 1586 down, 3962 on their usual line)

| rule | deviance ×1000 against none | moved up: shots / said | moved down | usual line | defensemen up | defensemen down |
| --- | --- | --- | --- | --- | --- | --- |
| no line term | +0.00 (+0.00 … +0.00) | 1.043 | 0.968 | 0.999 | 1.052 | 0.946 |
| the step it replaces: +6% a line, upward only, forwards' cuts for everyone | -0.81 (-2.31 … +0.70) | 1.005 | 0.977 | 1.008 | 1.046 | 0.948 |
| the same with defensemen on their own cuts | -0.54 (-2.66 … +1.77) | 0.988 | 0.981 | 1.013 | 0.998 | 0.955 |
| ±4% a line, both ways | -0.86 (-3.01 … +1.30) | 0.994 | 1.011 | 0.997 | 1.007 | 0.986 |
| ±6% a line, both ways | -0.12 (-3.12 … +3.11) | 0.972 | 1.034 | 0.996 | 0.986 | 1.007 |
| the minutes ratio ^0.7 | -0.95 (-2.69 … +1.02) | 1.006 | 0.996 | 0.999 | 1.011 | 0.979 |
| the minutes ratio ^0.8 (shipped) | -0.94 (-3.01 … +1.05) | 1.001 | 1.000 | 0.999 | 1.005 | 0.984 |
| the minutes ratio ^1.0 | -0.80 (-3.24 … +1.70) | 0.991 | 1.009 | 1.000 | 0.994 | 0.994 |


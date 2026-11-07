# The NBA's outlier nights: the tables

83,447 board projections replayed (the site's `buildBoard` on ESPN's logs, `nba-audit.mjs --cocktail site`), joined to the box scores. Fit season 2025-26; checked unchanged on this season. A mark "+d" is his centre rounded up plus d (a 4.4 projection: +3 = 8+ rebounds); "spike" is double his projection and at least 4 rebounds / 2 threes / 10 points / 4 assists over it.

## Rebounds

The variance factor on the board's spread that fits 2025-26's marks best (negative binomial, log loss): **×1.0** (the spread × 1.00).

### 2025-26: said against landed at each mark

| mark | n | landed | normal tail | NB tail | NB ×1.0 | board (normal) | board (NB ×1.0) | log loss board | log loss NB ×1.0 |
|---|---|---|---|---|---|---|---|---|---|
| +2 | 18,858 | 21.2% | 21.8% | 19.8% | 19.8% | 21.7% | 20.1% | 0.507 | 0.505 |
| +3 | 18,858 | 13.0% | 12.6% | 12.6% | 12.6% | 12.7% | 12.7% | 0.378 | 0.375 |
| +4 | 18,858 | 7.6% | 6.9% | 7.9% | 7.9% | 7.0% | 7.8% | 0.263 | 0.259 |
| +5 | 18,858 | 4.4% | 3.6% | 4.9% | 4.9% | 3.8% | 4.8% | 0.179 | 0.174 |
| +6 | 18,858 | 2.5% | 1.9% | 3.1% | 3.1% | 2.0% | 2.9% | 0.115 | 0.111 |
| +8 | 18,858 | 0.8% | 0.5% | 1.2% | 1.2% | 0.5% | 1.1% | 0.048 | 0.046 |
| spike | 18,858 | 4.6% | 3.6% | 5.0% | 5.0% | 3.8% | 4.9% | 0.187 | 0.183 |

The spike by the size of the projection (2025-26):

| projected | n | landed | board said | NB ×1.0 said | his figure when it landed |
|---|---|---|---|---|---|
| [0.0, 3.0) | 4,991 | 4.2% | 3.1% | 4.4% | 7.6 |
| [3.0, 4.5) | 5,897 | 6.5% | 5.2% | 6.3% | 9.3 |
| [4.5, 6.0) | 4,052 | 4.7% | 4.3% | 5.4% | 11.6 |
| [6.0, 8.0) | 2,448 | 2.9% | 2.5% | 3.5% | 15.6 |
| [8.0, 99.0) | 1,470 | 1.4% | 1.1% | 1.8% | 19.7 |

### this season: said against landed at each mark

| mark | n | landed | normal tail | NB tail | NB ×1.0 | board (normal) | board (NB ×1.0) | log loss board | log loss NB ×1.0 |
|---|---|---|---|---|---|---|---|---|---|
| +2 | 2,288 | 18.5% | 22.9% | 20.2% | 20.2% | 22.5% | 20.0% | 0.483 | 0.470 |
| +3 | 2,288 | 11.3% | 13.9% | 13.4% | 13.4% | 13.6% | 13.1% | 0.358 | 0.349 |
| +4 | 2,288 | 6.4% | 8.0% | 8.8% | 8.8% | 7.9% | 8.6% | 0.240 | 0.237 |
| +5 | 2,288 | 3.7% | 4.5% | 5.8% | 5.8% | 4.5% | 5.6% | 0.156 | 0.156 |
| +6 | 2,288 | 2.1% | 2.5% | 3.8% | 3.8% | 2.5% | 3.7% | 0.103 | 0.103 |
| +8 | 2,288 | 0.7% | 0.7% | 1.7% | 1.7% | 0.7% | 1.6% | 0.042 | 0.044 |
| spike | 2,288 | 3.8% | 4.5% | 5.8% | 5.8% | 4.4% | 5.6% | 0.166 | 0.164 |

The spike by the size of the projection (this season):

| projected | n | landed | board said | NB ×1.0 said | his figure when it landed |
|---|---|---|---|---|---|
| [0.0, 3.0) | 682 | 2.9% | 3.7% | 4.9% | 7.3 |
| [3.0, 4.5) | 693 | 4.8% | 6.2% | 7.2% | 9.1 |
| [4.5, 6.0) | 411 | 6.1% | 5.2% | 6.3% | 11.5 |
| [6.0, 8.0) | 309 | 1.9% | 3.2% | 4.4% | 14.8 |
| [8.0, 99.0) | 193 | 1.0% | 1.2% | 2.1% | 20.5 |

### What sees a rebounds spike coming, on top of the board's chance (NB ×1.0)

Each read alone, then all of them, in σ(a + b · logit(board) + w · read), fitted on the fit season's marks (all of them), scored unchanged. Δ log loss against the board's chance recalibrated alone (a + b · logit); negative = better. "top 2%" = how often the night's top 2% by chance of the spike landed.

| read | this season Δ ll ×1000 | top 2% landed | 2025-26 Δ ll ×1000 | top 2% landed | weight (sd units) |
|---|---|---|---|---|---|
| (recalibrated board) | +0.00 | 4.4% | +0.00 | 10.3% | a -0.01 b 1.00 |
| reb_spike40 | -0.37 | 2.2% | -0.32 | 9.3% | -0.09 |
| reb_upMinRatio | +0.03 | 4.4% | -0.00 | 9.8% | +0.01 |
| minUpside | +0.13 | 4.4% | -0.03 | 9.5% | +0.03 |
| promoted | +0.26 | 8.9% | -1.71 | 16.7% | +0.20 |
| starterTonight | -1.69 | 13.3% | -1.14 | 12.2% | +0.19 |
| reb_vac | -1.44 | 4.4% | -0.65 | 10.3% | +0.14 |
| min_vac | -1.30 | 2.2% | -0.65 | 11.4% | +0.14 |
| f_oppMiss | +0.07 | 4.4% | -0.05 | 9.3% | +0.04 |
| f_oppOrebAllowed | -0.05 | 4.4% | -0.01 | 9.3% | +0.02 |
| reb_oppAll | -0.08 | 4.4% | -0.05 | 9.8% | +0.04 |
| reb_oppAllL10 | -0.05 | 4.4% | -0.03 | 9.8% | +0.03 |
| f_pace | -0.04 | 4.4% | -0.05 | 10.6% | +0.04 |
| reb_cv | -0.01 | 4.4% | -0.04 | 10.3% | -0.04 |
| oreb_share | +0.00 | 4.4% | -0.00 | 10.3% | -0.00 |
| isC | +0.22 | 4.4% | -0.08 | 9.5% | +0.04 |
| reb_max20Ratio | -0.20 | 4.4% | -0.11 | 9.0% | -0.06 |
| all | -2.67 | 8.9% | -3.47 | 19.4% | … |

All reads at once, the weights (per standard deviation of the read):

| read | weight | mean | sd |
|---|---|---|---|
| reb_spike40 | -0.110 | 0.041 | 0.043 |
| reb_upMinRatio | +0.154 | 0.262 | 0.196 |
| minUpside | +0.026 | 0.233 | 0.144 |
| promoted | +0.142 | 0.072 | 0.258 |
| starterTonight | +0.197 | 0.594 | 0.491 |
| reb_vac | +0.068 | 0.074 | 0.099 |
| min_vac | +0.028 | 0.073 | 0.092 |
| f_oppMiss | +0.017 | 0.000 | 0.035 |
| f_oppOrebAllowed | -0.004 | -0.006 | 0.048 |
| reb_oppAll | +0.032 | -0.001 | 0.041 |
| reb_oppAllL10 | +0.015 | -0.003 | 0.046 |
| f_pace | +0.018 | 0.001 | 0.011 |
| reb_cv | +0.057 | 0.622 | 0.202 |
| oreb_share | +0.002 | 0.250 | 0.094 |
| isC | +0.025 | 0.156 | 0.363 |
| reb_max20Ratio | -0.082 | 0.762 | 0.256 |

The night's five likeliest rebounds spikes by each read, this season:

| read | picks | said | landed |
|---|---|---|---|
| board (normal) | 85 | 14.8% | 4.7% |
| board (NB ×1.0) | 85 | 12.7% | 4.7% |
| board + context | 85 | 13.9% | 7.1% |
| every row | 2,288 | — | 3.8% |

Every rebounds spike that landed this season (86 of 2,288): what each read said, by the size of its chance.

| chance band | board (normal) | NB ×1.0 | board + context |
|---|---|---|---|
| 0–2% | 13 | 6 | 5 |
| 2–5% | 31 | 22 | 31 |
| 5–10% | 28 | 44 | 38 |
| 10–20% | 14 | 14 | 9 |
| 20–101% | 0 | 0 | 3 |

The last night (2026-11-06):

| player | team | projected | spread | got | mark | board said | NB ×1.0 | + context |
|---|---|---|---|---|---|---|---|---|
| Trey Lyles | MIN | 3.6 | 2.42 | 13 | 8+ | 4.4% | 5.7% | 5.3% |
| Jake LaRavia | LAL | 3.7 | 2.61 | 8 | 8+ | 8.2% | 9.3% | 9.0% |
| Deandre Ayton | WSH | 4.6 | 4.04 | 11 | 10+ | 9.8% | 10.0% | 24.8% |
| Peyton Watson | CLE | 4.5 | 2.79 | 9 | 9+ | 6.4% | 7.5% | 9.8% |
| Emanuel Sharp | SAC | 1.0 | 1.00 | 5 | 5+ | 0.0% | 0.3% | 0.3% |

## Threes

The variance factor on the board's spread that fits 2025-26's marks best (negative binomial, log loss): **×1.0** (the spread × 1.00).

### 2025-26: said against landed at each mark

| mark | n | landed | normal tail | NB tail | NB ×1.0 | board (normal) | board (NB ×1.0) | log loss board | log loss NB ×1.0 |
|---|---|---|---|---|---|---|---|---|---|
| +1 | 17,845 | 21.0% | 22.5% | 19.4% | 19.4% | 22.2% | 19.7% | 0.497 | 0.492 |
| +2 | 17,845 | 8.8% | 7.7% | 8.7% | 8.7% | 7.8% | 8.6% | 0.295 | 0.286 |
| +3 | 17,845 | 3.5% | 2.2% | 3.8% | 3.8% | 2.4% | 3.7% | 0.155 | 0.145 |
| +4 | 17,845 | 1.2% | 0.6% | 1.6% | 1.6% | 0.7% | 1.5% | 0.070 | 0.064 |
| spike | 17,845 | 7.9% | 6.6% | 7.7% | 7.7% | 6.8% | 7.7% | 0.274 | 0.266 |

The spike by the size of the projection (2025-26):

| projected | n | landed | board said | NB ×1.0 said | his figure when it landed |
|---|---|---|---|---|---|
| [0.0, 1.0) | 5,353 | 4.6% | 3.2% | 4.3% | 3.5 |
| [1.0, 1.75) | 6,668 | 8.1% | 7.1% | 8.1% | 4.3 |
| [1.75, 2.5) | 3,483 | 13.5% | 11.7% | 12.0% | 5.1 |
| [2.5, 99.0) | 2,341 | 6.7% | 6.6% | 7.7% | 6.7 |

### this season: said against landed at each mark

| mark | n | landed | normal tail | NB tail | NB ×1.0 | board (normal) | board (NB ×1.0) | log loss board | log loss NB ×1.0 |
|---|---|---|---|---|---|---|---|---|---|
| +1 | 2,167 | 19.8% | 24.2% | 19.2% | 19.2% | 23.7% | 19.2% | 0.486 | 0.476 |
| +2 | 2,167 | 8.6% | 9.5% | 9.7% | 9.7% | 9.2% | 9.4% | 0.287 | 0.280 |
| +3 | 2,167 | 2.6% | 3.2% | 4.8% | 4.8% | 3.1% | 4.6% | 0.125 | 0.125 |
| +4 | 2,167 | 1.2% | 1.0% | 2.4% | 2.4% | 1.0% | 2.3% | 0.068 | 0.069 |
| spike | 2,167 | 7.6% | 8.4% | 8.8% | 8.8% | 8.2% | 8.6% | 0.264 | 0.258 |

The spike by the size of the projection (this season):

| projected | n | landed | board said | NB ×1.0 said | his figure when it landed |
|---|---|---|---|---|---|
| [0.0, 1.0) | 655 | 4.3% | 4.0% | 4.7% | 3.4 |
| [1.0, 1.75) | 840 | 8.1% | 8.6% | 9.1% | 4.3 |
| [1.75, 2.5) | 429 | 13.3% | 14.0% | 13.3% | 4.8 |
| [2.5, 99.0) | 243 | 4.5% | 8.0% | 8.9% | 7.7 |

### What sees a threes spike coming, on top of the board's chance (NB ×1.0)

Each read alone, then all of them, in σ(a + b · logit(board) + w · read), fitted on the fit season's marks (all of them), scored unchanged. Δ log loss against the board's chance recalibrated alone (a + b · logit); negative = better. "top 2%" = how often the night's top 2% by chance of the spike landed.

| read | this season Δ ll ×1000 | top 2% landed | 2025-26 Δ ll ×1000 | top 2% landed | weight (sd units) |
|---|---|---|---|---|---|
| (recalibrated board) | +0.00 | 7.0% | +0.00 | 21.6% | a +0.01 b 0.99 |
| tpm_spike40 | -0.60 | 4.7% | -0.26 | 20.2% | -0.09 |
| tpm_upMinRatio | +0.18 | 7.0% | -0.02 | 23.0% | +0.02 |
| minUpside | +0.09 | 7.0% | -0.02 | 23.0% | +0.02 |
| promoted | -0.13 | 9.3% | -1.14 | 18.5% | +0.16 |
| starterTonight | -1.46 | 9.3% | -0.64 | 21.1% | +0.14 |
| tpm_vac | -0.70 | 11.6% | -0.20 | 21.1% | +0.08 |
| min_vac | -0.72 | 14.0% | -0.26 | 20.8% | +0.08 |
| f_opp3paAllowed | -0.21 | 7.0% | -0.04 | 22.5% | -0.03 |
| tpm_oppAll | -0.34 | 7.0% | -0.08 | 21.3% | -0.05 |
| f_pace | -0.03 | 7.0% | -0.01 | 22.5% | -0.01 |
| tpa_l5Ratio | -0.30 | 7.0% | -0.10 | 20.8% | +0.06 |
| tpaVolume | -0.01 | 7.0% | -0.00 | 21.6% | -0.00 |
| tp_pct | -0.28 | 9.3% | -0.11 | 19.7% | -0.06 |
| tpm_cv | -0.00 | 7.0% | -0.00 | 21.6% | -0.00 |
| tpm_max20Ratio | -0.04 | 7.0% | -0.00 | 21.3% | -0.01 |
| all | -2.66 | 16.3% | -2.36 | 22.5% | … |

All reads at once, the weights (per standard deviation of the read):

| read | weight | mean | sd |
|---|---|---|---|
| tpm_spike40 | -0.099 | 0.070 | 0.055 |
| tpm_upMinRatio | +0.092 | 0.193 | 0.195 |
| minUpside | +0.039 | 0.232 | 0.143 |
| promoted | +0.127 | 0.072 | 0.258 |
| starterTonight | +0.136 | 0.599 | 0.490 |
| tpm_vac | -0.026 | 0.073 | 0.103 |
| min_vac | +0.072 | 0.074 | 0.092 |
| f_opp3paAllowed | +0.071 | -0.001 | 0.045 |
| tpm_oppAll | -0.082 | -0.002 | 0.055 |
| f_pace | -0.027 | 0.001 | 0.011 |
| tpa_l5Ratio | +0.050 | -0.017 | 0.180 |
| tpaVolume | +0.046 | 1.397 | 0.606 |
| tp_pct | -0.074 | 0.357 | 0.028 |
| tpm_cv | +0.010 | 0.944 | 0.302 |
| tpm_max20Ratio | -0.026 | 0.899 | 0.293 |

The night's five likeliest threes spikes by each read, this season:

| read | picks | said | landed |
|---|---|---|---|
| board (normal) | 85 | 20.5% | 11.8% |
| board (NB ×1.0) | 85 | 17.4% | 9.4% |
| board + context | 85 | 19.3% | 11.8% |
| every row | 2,167 | — | 7.6% |

Every threes spike that landed this season (164 of 2,167): what each read said, by the size of its chance.

| chance band | board (normal) | NB ×1.0 | board + context |
|---|---|---|---|
| 0–2% | 7 | 3 | 2 |
| 2–5% | 17 | 6 | 7 |
| 5–10% | 50 | 60 | 56 |
| 10–20% | 86 | 95 | 94 |
| 20–101% | 4 | 0 | 5 |

The last night (2026-11-06):

| player | team | projected | spread | got | mark | board said | NB ×1.0 | + context |
|---|---|---|---|---|---|---|---|---|
| Alijah Martin | TOR | 0.4 | 0.54 | 6 | 3+ | 0.0% | 0.7% | 0.8% |
| Victor Wembanyama | SA | 1.8 | 1.86 | 4 | 4+ | 17.1% | 15.1% | 13.7% |
| Devin Vassell | SA | 1.8 | 1.86 | 5 | 4+ | 17.1% | 15.1% | 14.6% |
| P.J. Washington | DAL | 1.8 | 1.31 | 6 | 4+ | 10.2% | 11.2% | 13.1% |
| Lauri Markkanen | UTAH | 2.3 | 1.63 | 8 | 5+ | 11.8% | 12.6% | 17.2% |
| Ajay Mitchell | OKC | 0.9 | 0.96 | 4 | 3+ | 4.0% | 5.4% | 7.2% |
| Derrick White | BOS | 2.0 | 1.87 | 4 | 4+ | 17.5% | 15.0% | 15.8% |
| Evan Mobley | CLE | 0.9 | 1.36 | 3 | 3+ | 16.0% | 15.2% | 18.1% |
| Luguentz Dort | ATL | 2.1 | 1.41 | 5 | 5+ | 3.6% | 5.1% | 9.7% |
| Tre Johnson | WSH | 1.1 | 1.55 | 5 | 4+ | 7.0% | 8.4% | 7.4% |
| Kyshawn George | WSH | 1.7 | 1.67 | 5 | 4+ | 15.9% | 15.4% | 20.3% |
| Jayson Tatum | BOS | 2.2 | 1.34 | 5 | 5+ | 3.6% | 6.1% | 7.1% |
| Leaky Black | SAC | 0.9 | 1.55 | 4 | 3+ | 16.1% | 13.0% | 16.6% |
| Ayo Dosunmu | MIN | 1.9 | 1.36 | 4 | 4+ | 9.8% | 10.3% | 10.6% |
| Emanuel Sharp | SAC | 1.0 | 1.07 | 3 | 3+ | 8.9% | 9.9% | 9.2% |

## Points

The variance factor on the board's spread that fits 2025-26's marks best (negative binomial, log loss): **×1.05** (the spread × 1.05).

### 2025-26: said against landed at each mark

| mark | n | landed | normal tail | NB tail | NB ×1.05 | board (normal) | board (NB ×1.05) | log loss board | log loss NB ×1.05 |
|---|---|---|---|---|---|---|---|---|---|
| +5 | 18,858 | 22.7% | 21.3% | 19.0% | 19.6% | 21.5% | 20.2% | 0.528 | 0.527 |
| +8 | 18,858 | 12.5% | 10.7% | 11.1% | 11.9% | 11.0% | 11.9% | 0.372 | 0.367 |
| +10 | 18,858 | 8.0% | 6.4% | 7.7% | 8.4% | 6.6% | 8.3% | 0.275 | 0.270 |
| +15 | 18,858 | 2.5% | 1.5% | 3.0% | 3.5% | 1.7% | 3.3% | 0.119 | 0.114 |
| spike | 18,858 | 4.3% | 3.0% | 4.6% | 5.1% | 3.2% | 4.9% | 0.179 | 0.173 |

The spike by the size of the projection (2025-26):

| projected | n | landed | board said | NB ×1.05 said | his figure when it landed |
|---|---|---|---|---|---|
| [0, 8) | 5,411 | 4.2% | 3.1% | 5.1% | 19.6 |
| [8, 12) | 5,530 | 6.8% | 5.1% | 6.9% | 24.0 |
| [12, 18) | 4,930 | 3.7% | 2.6% | 4.3% | 31.6 |
| [18, 25) | 2,321 | 1.2% | 0.8% | 2.0% | 45.3 |
| [25, 99) | 666 | 0.2% | 0.3% | 0.9% | 83.0 |

### this season: said against landed at each mark

| mark | n | landed | normal tail | NB tail | NB ×1.05 | board (normal) | board (NB ×1.05) | log loss board | log loss NB ×1.05 |
|---|---|---|---|---|---|---|---|---|---|
| +5 | 2,288 | 17.3% | 23.3% | 20.0% | 20.5% | 22.8% | 20.2% | 0.471 | 0.458 |
| +8 | 2,288 | 8.7% | 12.8% | 12.5% | 13.2% | 12.4% | 12.8% | 0.300 | 0.298 |
| +10 | 2,288 | 5.3% | 8.2% | 9.1% | 9.8% | 7.9% | 9.4% | 0.211 | 0.214 |
| +15 | 2,288 | 1.7% | 2.3% | 4.0% | 4.6% | 2.3% | 4.3% | 0.089 | 0.097 |
| spike | 2,288 | 2.4% | 4.1% | 5.5% | 6.1% | 4.0% | 5.8% | 0.121 | 0.126 |

The spike by the size of the projection (this season):

| projected | n | landed | board said | NB ×1.05 said | his figure when it landed |
|---|---|---|---|---|---|
| [0, 8) | 664 | 2.6% | 4.3% | 6.1% | 19.4 |
| [8, 12) | 597 | 3.9% | 6.5% | 8.3% | 22.8 |
| [12, 18) | 610 | 1.6% | 3.2% | 5.3% | 32.5 |
| [18, 25) | 340 | 1.2% | 1.2% | 2.6% | 41.8 |
| [25, 99) | 77 | 1.3% | 0.3% | 1.1% | 52.0 |

### What sees a points spike coming, on top of the board's chance (NB ×1.05)

Each read alone, then all of them, in σ(a + b · logit(board) + w · read), fitted on the fit season's marks (all of them), scored unchanged. Δ log loss against the board's chance recalibrated alone (a + b · logit); negative = better. "top 2%" = how often the night's top 2% by chance of the spike landed.

| read | this season Δ ll ×1000 | top 2% landed | 2025-26 Δ ll ×1000 | top 2% landed | weight (sd units) |
|---|---|---|---|---|---|
| (recalibrated board) | +0.00 | 2.2% | +0.00 | 10.6% | a +0.22 b 1.10 |
| pts_spike40 | -0.22 | 4.4% | -0.09 | 9.5% | -0.04 |
| pts_upMinRatio | -0.16 | 2.2% | -0.00 | 10.6% | -0.01 |
| minUpside | +0.05 | 2.2% | -0.00 | 10.6% | +0.00 |
| promoted | -0.78 | 11.1% | -2.82 | 15.1% | +0.23 |
| starterTonight | -3.04 | 6.7% | -2.08 | 13.0% | +0.24 |
| pts_vac | -3.61 | 6.7% | -2.03 | 14.9% | +0.21 |
| min_vac | -3.78 | 6.7% | -1.88 | 12.7% | +0.21 |
| f_pace | +0.01 | 2.2% | -0.00 | 10.6% | +0.00 |
| pts_cv | -0.02 | 2.2% | -0.00 | 10.6% | -0.01 |
| pts_max20Ratio | -0.53 | 2.2% | -0.05 | 10.6% | -0.04 |
| all | -5.67 | 6.7% | -5.62 | 15.6% | … |

All reads at once, the weights (per standard deviation of the read):

| read | weight | mean | sd |
|---|---|---|---|
| pts_spike40 | -0.070 | 0.037 | 0.043 |
| pts_upMinRatio | +0.137 | 0.290 | 0.208 |
| minUpside | -0.011 | 0.233 | 0.144 |
| promoted | +0.153 | 0.072 | 0.258 |
| starterTonight | +0.229 | 0.594 | 0.491 |
| pts_vac | +0.230 | 0.079 | 0.104 |
| min_vac | -0.061 | 0.073 | 0.092 |
| f_pace | +0.007 | 0.001 | 0.011 |
| pts_cv | +0.069 | 0.606 | 0.228 |
| pts_max20Ratio | -0.045 | 0.781 | 0.280 |

The night's five likeliest points spikes by each read, this season:

| read | picks | said | landed |
|---|---|---|---|
| board (normal) | 85 | 12.2% | 2.4% |
| board (NB ×1.05) | 85 | 12.1% | 4.7% |
| board + context | 85 | 13.7% | 4.7% |
| every row | 2,288 | — | 2.4% |

Every points spike that landed this season (55 of 2,288): what each read said, by the size of its chance.

| chance band | board (normal) | NB ×1.05 | board + context |
|---|---|---|---|
| 0–2% | 11 | 3 | 5 |
| 2–5% | 18 | 11 | 12 |
| 5–10% | 22 | 30 | 32 |
| 10–20% | 4 | 11 | 5 |
| 20–101% | 0 | 0 | 1 |

The last night (2026-11-06):

| player | team | projected | spread | got | mark | board said | NB ×1.05 | + context |
|---|---|---|---|---|---|---|---|---|
| Luguentz Dort | ATL | 9.8 | 4.81 | 25 | 20+ | 1.8% | 3.7% | 7.0% |
| Ajay Mitchell | OKC | 15.5 | 6.26 | 35 | 31+ | 0.7% | 2.0% | 1.5% |
| Kyshawn George | WSH | 15.9 | 7.45 | 33 | 32+ | 1.5% | 3.4% | 3.8% |
| Tre Johnson | WSH | 7.8 | 5.55 | 23 | 18+ | 5.2% | 7.6% | 6.3% |
| Alijah Martin | TOR | 4.1 | 2.97 | 27 | 15+ | 0.0% | 0.6% | 0.5% |

## Assists

The variance factor on the board's spread that fits 2025-26's marks best (negative binomial, log loss): **×1.05** (the spread × 1.05).

### 2025-26: said against landed at each mark

| mark | n | landed | normal tail | NB tail | NB ×1.05 | board (normal) | board (NB ×1.05) | log loss board | log loss NB ×1.05 |
|---|---|---|---|---|---|---|---|---|---|
| +2 | 18,856 | 15.7% | 14.0% | 13.8% | 14.3% | 14.2% | 14.4% | 0.421 | 0.414 |
| +3 | 18,856 | 8.1% | 6.4% | 7.5% | 8.1% | 6.6% | 8.0% | 0.274 | 0.263 |
| +4 | 18,856 | 4.1% | 2.8% | 4.1% | 4.6% | 3.0% | 4.4% | 0.163 | 0.156 |
| +6 | 18,856 | 1.2% | 0.5% | 1.3% | 1.5% | 0.6% | 1.4% | 0.063 | 0.059 |
| spike | 18,856 | 3.0% | 1.9% | 3.2% | 3.7% | 2.1% | 3.5% | 0.138 | 0.130 |

The spike by the size of the projection (2025-26):

| projected | n | landed | board said | NB ×1.05 said | his figure when it landed |
|---|---|---|---|---|---|
| [0.0, 2.0) | 8,173 | 1.3% | 0.6% | 1.8% | 6.4 |
| [2.0, 3.5) | 5,469 | 3.7% | 2.6% | 4.3% | 8.0 |
| [3.5, 5.0) | 2,802 | 5.9% | 5.0% | 6.7% | 9.8 |
| [5.0, 99.0) | 2,412 | 4.1% | 2.4% | 3.8% | 13.0 |

### this season: said against landed at each mark

| mark | n | landed | normal tail | NB tail | NB ×1.05 | board (normal) | board (NB ×1.05) | log loss board | log loss NB ×1.05 |
|---|---|---|---|---|---|---|---|---|---|
| +2 | 2,287 | 12.7% | 16.0% | 14.9% | 15.3% | 15.6% | 15.0% | 0.381 | 0.369 |
| +3 | 2,287 | 6.1% | 8.0% | 8.8% | 9.4% | 7.8% | 9.0% | 0.231 | 0.225 |
| +4 | 2,287 | 3.2% | 3.9% | 5.2% | 5.8% | 3.8% | 5.5% | 0.142 | 0.141 |
| +6 | 2,287 | 1.0% | 0.9% | 1.9% | 2.3% | 0.9% | 2.1% | 0.058 | 0.058 |
| spike | 2,287 | 2.3% | 2.6% | 4.1% | 4.6% | 2.6% | 4.4% | 0.116 | 0.116 |

The spike by the size of the projection (this season):

| projected | n | landed | board said | NB ×1.05 said | his figure when it landed |
|---|---|---|---|---|---|
| [0.0, 2.0) | 1,023 | 1.2% | 1.0% | 2.8% | 6.6 |
| [2.0, 3.5) | 627 | 2.7% | 3.2% | 5.1% | 8.4 |
| [3.5, 5.0) | 307 | 5.9% | 5.9% | 7.7% | 9.9 |
| [5.0, 99.0) | 330 | 1.8% | 3.1% | 4.9% | 13.5 |

### What sees a assists spike coming, on top of the board's chance (NB ×1.05)

Each read alone, then all of them, in σ(a + b · logit(board) + w · read), fitted on the fit season's marks (all of them), scored unchanged. Δ log loss against the board's chance recalibrated alone (a + b · logit); negative = better. "top 2%" = how often the night's top 2% by chance of the spike landed.

| read | this season Δ ll ×1000 | top 2% landed | 2025-26 Δ ll ×1000 | top 2% landed | weight (sd units) |
|---|---|---|---|---|---|
| (recalibrated board) | +0.00 | 8.9% | +0.00 | 7.7% | a +0.06 b 1.02 |
| ast_spike40 | -0.06 | 8.9% | -0.13 | 7.4% | -0.06 |
| ast_upMinRatio | -0.39 | 6.7% | -0.03 | 8.0% | -0.03 |
| minUpside | -0.12 | 6.7% | -0.03 | 7.2% | -0.04 |
| promoted | -0.42 | 6.7% | -1.28 | 11.9% | +0.20 |
| starterTonight | -2.65 | 6.7% | -1.28 | 8.8% | +0.24 |
| ast_vac | -1.77 | 2.2% | -1.49 | 11.9% | +0.22 |
| min_vac | -1.96 | 6.7% | -1.13 | 10.9% | +0.20 |
| f_pace | +0.00 | 8.9% | -0.00 | 7.7% | -0.00 |
| ast_cv | -0.02 | 8.9% | -0.01 | 8.2% | -0.02 |
| ast_max20Ratio | -0.67 | 11.1% | -0.16 | 8.8% | -0.08 |
| all | -3.74 | 8.9% | -3.49 | 14.6% | … |

All reads at once, the weights (per standard deviation of the read):

| read | weight | mean | sd |
|---|---|---|---|
| ast_spike40 | -0.067 | 0.026 | 0.035 |
| ast_upMinRatio | +0.140 | 0.239 | 0.188 |
| minUpside | -0.042 | 0.233 | 0.144 |
| promoted | +0.120 | 0.072 | 0.258 |
| starterTonight | +0.218 | 0.594 | 0.491 |
| ast_vac | +0.277 | 0.077 | 0.107 |
| min_vac | -0.093 | 0.073 | 0.092 |
| f_pace | -0.001 | 0.001 | 0.011 |
| ast_cv | +0.080 | 0.803 | 0.287 |
| ast_max20Ratio | -0.099 | 0.848 | 0.272 |

The night's five likeliest assists spikes by each read, this season:

| read | picks | said | landed |
|---|---|---|---|
| board (normal) | 85 | 11.4% | 4.7% |
| board (NB ×1.05) | 85 | 11.8% | 5.9% |
| board + context | 85 | 12.0% | 5.9% |
| every row | 2,287 | — | 2.3% |

Every assists spike that landed this season (53 of 2,287): what each read said, by the size of its chance.

| chance band | board (normal) | NB ×1.05 | board + context |
|---|---|---|---|
| 0–2% | 21 | 7 | 5 |
| 2–5% | 16 | 18 | 22 |
| 5–10% | 12 | 22 | 20 |
| 10–20% | 4 | 6 | 6 |
| 20–101% | 0 | 0 | 0 |

The last night (2026-11-06):

| player | team | projected | spread | got | mark | board said | NB ×1.05 | + context |
|---|---|---|---|---|---|---|---|---|
| Tyler Herro | MIL | 4.2 | 2.39 | 10 | 9+ | 4.8% | 6.7% | 6.6% |
| Isaiah Hartenstein | OKC | 2.7 | 2.77 | 7 | 7+ | 7.0% | 8.4% | 7.5% |
| Jamal Shead | TOR | 7.3 | 2.96 | 16 | 15+ | 0.6% | 1.7% | 3.8% |
| Keldon Johnson | SA | 1.2 | 1.38 | 6 | 6+ | 0.1% | 1.4% | 0.9% |


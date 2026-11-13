# The NBA: a model trained on everything the box scores know, against the board

## 2025-26 (trained on 2023-24, 2024-25: 49242 player-games)

| | player-games | the board: miss / bias | the model: miss / bias | his last ten | his season | gain on the board |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Points | 18662 | 4.862 / -0.08 | 4.777 / +0.07 | 5.065 | 5.053 | +1.8% |
| Rebounds | 18662 | 1.955 / +0.01 | 1.945 / +0.06 | 2.040 | 2.013 | +0.5% |
| Assists | 18660 | 1.441 / -0.07 | 1.432 / +0.01 | 1.497 | 1.482 | +0.6% |
| Threes | 17676 | 1.012 / -0.00 | 1.012 / +0.04 | 1.041 | 1.033 | +0.0% |

Points, the model's gain by feature: l10_fga 26%, l10_pts 26%, s_pts 14%, minRole 8%, l3_fga 4%, s_fga 3%, starter 2%, last_min 1%, pm20_pts 1%, out_pts 1%, out_fga 1%, pm50_pts 1%

| Points, by cut | n | the board | the model |
| --- | ---: | ---: | ---: |
| projected 20+ by the board | 2457 | 6.440 / +0.04 | 6.279 / -0.23 |
| … a teammate out (lift 3%+) | 1339 | 6.265 / +0.98 | 6.101 / -0.03 |
| … nobody out | 720 | 6.630 / -1.06 | 6.450 / -0.38 |
| … soft third | 992 | 6.266 / +0.83 | 6.159 / +0.08 |
| … ceiling cut 8%+ | 729 | 6.655 / -1.90 | 6.406 / -0.31 |
| a teammate back (back_pts 5%+) | 16388 | 4.819 / -0.04 | 4.736 / +0.06 |
| a teammate out (out_pts 10%+) | 10822 | 4.985 / -0.20 | 4.885 / +0.03 |
| starts, under half of his last ten started | 1344 | 5.227 / -0.36 | 5.007 / -0.34 |
| his team favoured by 10+ | 2279 | 4.784 / +0.36 | 4.700 / +0.21 |
| his team an underdog by 10+ | 1772 | 4.962 / -0.33 | 4.900 / +0.26 |

| Without … (the model's miss) | Points | Rebounds | Assists | Threes |
| --- | ---: | ---: | ---: | ---: |
| nothing (the whole model) | 4.777 | 1.945 | 1.432 | 1.012 |
| who is out and who is back (teammates) | 4.842 (+0.065) | 1.957 (+0.012) | 1.444 (+0.011) | 1.015 (+0.003) |
| who is back alone | 4.804 (+0.028) | 1.952 (+0.007) | 1.438 (+0.005) | 1.013 (+0.002) |
| tonight's start and his minutes in that role | 4.806 (+0.029) | 1.953 (+0.008) | 1.440 (+0.007) | 1.014 (+0.002) |
| the opponent (allowed, all / last ten / his position) | 4.791 (+0.015) | 1.948 (+0.003) | 1.438 (+0.005) | 1.013 (+0.002) |
| pace | 4.774 (-0.002) | 1.944 (-0.001) | 1.434 (+0.001) | 1.011 (-0.001) |
| the book's spread and total | 4.776 (-0.001) | 1.944 (-0.001) | 1.434 (+0.001) | 1.011 (-0.001) |
| rest and home | 4.776 (-0.001) | 1.943 (-0.001) | 1.433 (+0.001) | 1.011 (-0.001) |
| his shot volume (attempts a minute) | 4.783 (+0.007) | 1.944 (-0.001) | 1.433 (+0.001) | 1.013 (+0.001) |

## 2026-27 (trained on 2023-24, 2024-25, 2025-26: 75334 player-games)

| | player-games | the board: miss / bias | the model: miss / bias | his last ten | his season | gain on the board |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Points | 2983 | 4.774 / +0.52 | 4.724 / +0.65 | 5.211 | 5.142 | +1.1% |
| Rebounds | 2983 | 1.900 / +0.08 | 1.906 / +0.09 | 2.054 | 2.058 | -0.3% |
| Assists | 2982 | 1.408 / +0.05 | 1.410 / +0.12 | 1.509 | 1.530 | -0.2% |
| Threes | 2824 | 0.987 / -0.00 | 0.983 / -0.01 | 1.028 | 1.043 | +0.4% |

Points, the model's gain by feature: l10_pts 40%, l10_fga 17%, s_pts 10%, minRole 6%, l3_fga 4%, s_fga 4%, starter 2%, last_min 1%, pm50_pts 1%, out_fga 1%, out_pts 1%, pm20_pts 1%

| Points, by cut | n | the board | the model |
| --- | ---: | ---: | ---: |
| projected 20+ by the board | 398 | 6.242 / +0.21 | 6.329 / +0.21 |
| … a teammate out (lift 3%+) | 97 | 6.378 / +0.81 | 6.310 / +0.32 |
| … nobody out | 277 | 6.193 / -0.08 | 6.320 / +0.07 |
| … soft third | 146 | 6.133 / +0.62 | 6.222 / +0.04 |
| … ceiling cut 8%+ | 123 | 6.115 / -0.75 | 6.404 / +0.56 |
| a teammate back (back_pts 5%+) | 2026 | 4.776 / +0.50 | 4.660 / +0.40 |
| a teammate out (out_pts 10%+) | 677 | 4.969 / -0.03 | 4.888 / +0.40 |
| starts, under half of his last ten started | 178 | 4.739 / -0.20 | 4.560 / +0.42 |
| his team favoured by 10+ | 288 | 4.689 / +0.12 | 4.618 / +0.24 |
| his team an underdog by 10+ | 242 | 4.998 / +1.50 | 4.760 / +1.08 |

| Without … (the model's miss) | Points | Rebounds | Assists | Threes |
| --- | ---: | ---: | ---: | ---: |
| nothing (the whole model) | 4.724 | 1.906 | 1.410 | 0.983 |
| who is out and who is back (teammates) | 4.790 (+0.067) | 1.920 (+0.015) | 1.417 (+0.007) | 0.988 (+0.005) |
| who is back alone | 4.706 (-0.017) | 1.900 (-0.005) | 1.401 (-0.009) | 0.980 (-0.003) |
| tonight's start and his minutes in that role | 4.794 (+0.070) | 1.931 (+0.025) | 1.424 (+0.014) | 0.987 (+0.004) |
| the opponent (allowed, all / last ten / his position) | 4.712 (-0.012) | 1.906 (+0.000) | 1.398 (-0.012) | 0.983 (-0.000) |
| pace | 4.718 (-0.006) | 1.902 (-0.003) | 1.406 (-0.004) | 0.985 (+0.002) |
| the book's spread and total | 4.726 (+0.002) | 1.907 (+0.002) | 1.409 (-0.001) | 0.985 (+0.002) |
| rest and home | 4.717 (-0.007) | 1.906 (+0.000) | 1.407 (-0.003) | 0.983 (+0.000) |
| his shot volume (attempts a minute) | 4.731 (+0.007) | 1.908 (+0.002) | 1.405 (-0.005) | 0.989 (+0.006) |


"""Derived pre-game reads shared by angles.py, replay.py and explain.py: the blends of this
season into last season's base, the opponent reads blended across the season boundary, logs.
Everything is computed from the leak-free columns build_rows.py writes."""
import numpy as np, pandas as pd

PRIOR = dict(sog=18, g=40, toi=5)      # this season earns weight n / (n + k)
OPP_PRIOR = dict(sog=15, g=40)         # the opponent's season-to-date table earns weight n / (n + k) over last season's
GK_PRIOR = 8                           # a goalie's save % this season, shrunk to .900 over 8 starts

def lg(v):
    return np.log(np.clip(np.asarray(v, dtype=float), 0.05, None))

def derive(d):
    """Add the derived columns in place and return the frame."""
    n = d.n_prior.fillna(0)
    w, wg, wt = n / (n + PRIOR['sog']), n / (n + PRIOR['g']), n / (n + PRIOR['toi'])
    has_ls = d.ls_sog_pg.notna()
    d['bl_sog'] = np.where(has_ls, w * d.p_sog_avg.fillna(0) + (1 - w) * d.ls_sog_pg, d.p_sog_avg)
    d['bl_icf'] = np.where(has_ls, w * d.p_icf_avg.fillna(0) + (1 - w) * d.ls_icf_pg, d.p_icf_avg)
    d['bl_iff'] = np.where(has_ls, w * d.p_iff_avg.fillna(0) + (1 - w) * d.ls_iff_pg, d.p_iff_avg)
    d['bl_g'] = np.where(has_ls, wg * d.p_g_avg.fillna(0) + (1 - wg) * d.ls_g_pg, d.p_g_avg)
    # MoneyPuck's high-danger shots run at ~0.45 of our iSCF count; the blend keeps the scale of this season's rows
    d['bl_iscf'] = np.where(has_ls, wg * d.p_iscf_avg.fillna(0) + (1 - wg) * d.ls_hd_pg * 2.2, d.p_iscf_avg)
    d['bl_toi'] = np.where(has_ls, wt * d.p_toi_avg.fillna(0) + (1 - wt) * d.ls_toi_pg, d.p_toi_avg)
    d['toi_l5_or_bl'] = d.p_toi_l5.where(d.p_toi_l5.notna(), d.bl_toi)
    if 'ls2_sog_pg' in d:
        g1, g2 = d.ls_gp.fillna(0), d.ls2_gp.fillna(0)
        both = d.ls2_sog_pg.notna() & has_ls
        d['ls12_sog_pg'] = np.where(both, (2 * g1 * d.ls_sog_pg.fillna(0) + g2 * d.ls2_sog_pg.fillna(0)) / (2 * g1 + g2).replace(0, np.nan), d.ls_sog_pg)
        d['ls12_g_pg'] = np.where(both, (2 * g1 * d.ls_g_pg.fillna(0) + g2 * d.ls2_g_pg.fillna(0)) / (2 * g1 + g2).replace(0, np.nan), d.ls_g_pg)
        d['bl12_sog'] = np.where(has_ls, w * d.p_sog_avg.fillna(0) + (1 - w) * d.ls12_sog_pg, d.p_sog_avg)
        d['bl12_g'] = np.where(has_ls, wg * d.p_g_avg.fillna(0) + (1 - wg) * d.ls12_g_pg, d.p_g_avg)
    if 'pls_sog_same_venue' in d:
        hv = d.pls_gp.fillna(0) / 2
        d['pls_venue_ratio'] = (d.pls_sog_same_venue / d.pls_sog_pg).clip(0.5, 2)
        d['pls_venue_ratio_shr'] = 1 + (d['pls_venue_ratio'] - 1) * hv / (hv + 20)
    # the opponent's tables blended across the season boundary: this season at n / (n + 15) for shots, n / (n + 40) for goals
    no = d.opp_n_prior.fillna(0)
    ws, wgo = no / (no + OPP_PRIOR['sog']), no / (no + OPP_PRIOR['g'])
    d['opp_sa_blend'] = np.where(d.opp_ls_sa_pg.notna(), ws * d.opp_sa_pg.fillna(0) + (1 - ws) * d.opp_ls_sa_pg, d.opp_sa_pg)
    d['opp_ca_blend'] = np.where(d.opp_ls_ca_pg.notna(), ws * (d.opp_sa_pg.fillna(0) * 1.85) + (1 - ws) * d.opp_ls_ca_pg, d.opp_sa_pg * 1.85)
    if 'opp_pls_pos_sog_pg' in d:
        d['opp_pos_sog_blend'] = np.where(d.opp_pls_pos_sog_pg.notna(), ws * d.opp_pos_sog_pg.fillna(0) + (1 - ws) * d.opp_pls_pos_sog_pg, d.opp_pos_sog_pg)
        d['opp_pos_g_blend'] = np.where(d.opp_pls_pos_g_pg.notna(), wgo * d.opp_pos_g_pg.fillna(0) + (1 - wgo) * d.opp_pls_pos_g_pg, d.opp_pos_g_pg)
    if 'opp_pls_pos_sog_per' in d:
        d['opp_pos_sog_per_blend'] = np.where(d.opp_pls_pos_sog_per.notna(), ws * d.opp_pos_sog_per.fillna(0) + (1 - ws) * d.opp_pls_pos_sog_per, d.opp_pos_sog_per)
        d['opp_pos_g_per_blend'] = np.where(d.opp_pls_pos_g_per.notna(), wgo * d.opp_pos_g_per.fillna(0) + (1 - wgo) * d.opp_pls_pos_g_per, d.opp_pos_g_per)
        d['opp_slot_g_blend'] = np.where(d.opp_pls_slot_g_pg.notna(), wgo * d.opp_slot_g_pg.fillna(0) + (1 - wgo) * d.opp_pls_slot_g_pg, d.opp_slot_g_pg)
        d['opp_slot_sog_blend'] = np.where(d.opp_pls_slot_sog_pg.notna(), ws * d.opp_slot_sog_pg.fillna(0) + (1 - ws) * d.opp_pls_slot_sog_pg, d.opp_slot_sog_pg)
    d['opp_ga_blend'] = np.where(d.opp_ls_ga_pg.notna(), wgo * d.opp_ga_pg.fillna(0) + (1 - wgo) * d.opp_ls_ga_pg, d.opp_ga_pg)
    if 'gk_std_svpct' in d:
        gn = d.gk_n.fillna(0)
        d['gk_std_svpct_shr'] = np.where(gn > 0, (d.gk_std_svpct.fillna(0.9) * gn + 0.9 * GK_PRIOR) / (gn + GK_PRIOR), np.nan)
        # the starter's save % carried from last season into this one at starts / (starts + 20); .905 for a goalie without a record
        d['gk_svpct_blend'] = np.where(d.gk_ls_svpct.notna(), (gn * d.gk_std_svpct.fillna(0.9) + 20 * d.gk_ls_svpct) / (gn + 20),
                                       np.where(gn > 0, d['gk_std_svpct_shr'], 0.905))
    # the site's own construction (lib/nhl-data/picks-pure.js blendRates): last season = the stored box-score rows
    # (10+ games), this season at n / (n + 18) for shots and attempts, n / (n + 40) for goals and chances; five games
    # this season stand alone without a base. Rows the site would not rate carry NaN.
    if 'pls_iscf_pg' in d:
        base_ok = d.pls_gp.fillna(0) >= 10
        alone = ~base_ok & (n >= 5)
        def site_blend(cur, prev, k):
            ww = n / (n + k)
            v = np.where(base_ok, ww * cur.fillna(0) + (1 - ww) * prev, np.where(alone, cur, np.nan))
            return v
        d['site_sog'] = site_blend(d.p_sog_avg, d.pls_sog_pg, PRIOR['sog']); d['site_icf'] = site_blend(d.p_icf_avg, d.pls_icf_pg, PRIOR['sog'])
        d['site_g'] = site_blend(d.p_g_avg, d.pls_g_pg, PRIOR['g']); d['site_iscf'] = site_blend(d.p_iscf_avg, d.pls_iscf_pg, PRIOR['g'])
        d['site_toi'] = site_blend(d.p_toi_avg, d.pls_toi_pg, PRIOR['toi'])
        d['site_toi_l5'] = d.p_toi_l5.where(d.p_toi_l5.notna(), d.site_toi)
        d['log_site_sog'] = lg(d.site_sog); d['log_site_icf'] = lg(d.site_icf); d['log_site_iscf'] = lg(d.site_iscf); d['log_site_toi_l5'] = lg(d.site_toi_l5)
        d['log_site_g'] = np.log(d.site_g.clip(0, None) + 0.05)
    d['slot_l1'] = d.p_slot_l1.round().clip(1, 4)
    d['isD'] = (d.pos == 'D').astype(int)
    d['log_bl_sog'] = lg(d.bl_sog); d['log_bl_icf'] = lg(d.bl_icf); d['log_bl_iff'] = lg(d.bl_iff)
    d['log_bl_g'] = np.log(d.bl_g.clip(0, None) + 0.05); d['log_bl_iscf'] = lg(d.bl_iscf)
    for c in ['opp_sa_pg', 'opp_pos_sog_pg', 'opp_pos_sog_per', 'opp_slot_sog_pg', 'opp_pls_pos_sog_pg', 'opp_ls_sa_pg', 'opp_ls_ca_pg', 'opp_sa_pg_venue', 'opp_pos_sog_venue',
              'opp_sa_l5', 'opp_sa_l10', 'opp_sa_l15', 'opp_pos_sog_l5', 'opp_pos_sog_l10', 'opp_pos_sog_l15', 'opp_pls_pos_sog_venue', 'opp_pls_slot_sog_pg',
              'pace_game_std', 'pace_game_ls', 'pace_opp_std', 'pace_team_std', 'p_toi_l5', 'p_toi_l1', 'bl_toi', 'toi_l5_or_bl', 'ls_toi_pg', 'team_sf_pg', 'team_ls_sf_pg', 'opp_sf_pg',
              'opp_sa_blend', 'opp_ca_blend', 'opp_pos_sog_blend', 'opp_pos_sog_per_blend', 'opp_pls_pos_sog_per', 'opp_slot_sog_blend']:
        if c in d: d['log_' + c] = lg(d[c])
    for c in ['opp_ga_pg', 'opp_pos_g_pg', 'opp_pos_g_per', 'opp_slot_g_pg', 'opp_pls_pos_g_pg', 'opp_ls_ga_pg', 'opp_ls_xga_pg', 'opp_ga_pg_venue', 'opp_pos_g_venue',
              'opp_ga_l5', 'opp_ga_l10', 'opp_ga_l15', 'opp_pos_g_l5', 'opp_pos_g_l10', 'opp_pos_g_l15', 'opp_pls_pos_g_venue', 'opp_pls_slot_g_pg', 'opp_pos_g_blend', 'opp_ga_blend', 'opp_pos_g_per_blend', 'opp_pls_pos_g_per', 'opp_slot_g_blend']:
        if c in d: d['log_' + c] = np.log(d[c].clip(0, None) + 0.1)
    if 'gk_ls_svpct' in d:
        d['gk_ls_svpct_f'] = d.gk_ls_svpct; d['gk_ls_gsax60_f'] = d.gk_ls_gsax60
    return d

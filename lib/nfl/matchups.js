// PropFinder's matchup pages in the numbers (Vincent, 2026-11-08: "we need them to feed our numbers"; asked how, he chose
// "into the projection, hand-set": the pages move the projection, the ladders and the touchdown chances directly, at weights
// set by hand in the expected direction — a soft defense up, a tough one down — capped). Measured before the choice
// (docs/audits/2026-11-08-nfl-sources.md, docs/audits/2026-11-08-nfl-coverage.md): no page earned a weight in the backtests
// and at full strength the coverage fit and the run gaps read the yards a little worse; the weights below are not fitted,
// and the cap (CAP) keeps the pages to a nudge. Pure: `digestPages` reads the stored pages once into a compact digest
// (lib/picks/store.js keeps it beside the pull), `matchupFactor` is the factor on one player's market.
//
//   Receiving (WR / TE / RB yards; receptions at half): the coverage fit — his yards a route by coverage shell this season
//     (Receiver coverage splits; each shell pulled toward his overall at COVER.K routes, last season's added at half while
//     this season holds fewer than COVER.minRoutes) weighted by the opponent's shell mix this season (Coverage Matrix
//     `topSchemes`), over his overall — and WR vs CB's advantage score (PropFinder's pairing of him with the corners he
//     lines up against; "limited" pairings at half, "unavailable" none).
//   Rushing (a back): the run fit — his direction share (adjusted) through the opponent's yards a game at each gap over the
//     league's at that gap (Rushing Matchups) — and the opponent's EPA a rush allowed over the league's. A quarterback's
//     rushing: the EPA alone, at half.
//   Passing (a quarterback): the opponent's EPA a pass allowed over the league's (Coverage Matrix).
//   Touchdowns (λ): the opponent's touchdowns allowed a game at his position over the league's (TD Matchups, at
//     gp / (gp + 16), the ratio within 0.6–1.4) and its red-zone touchdown rate allowed over the league's (Coverage Matrix,
//     at gp / (gp + 8)).
// Role Matchups is the opponent's table by slot the board reads already (the projection's matchup): not counted twice.

/** Each page's weight: the share of its ratio's distance from 1 that reaches the factor (hand-set, 2026-11-08). */
export const WEIGHTS = {
  coverage: 0.5,          // his coverage fit (a ratio)
  wrcb: 0.5,              // × the advantage score (−0.13 … +0.26 on the first slate; a 0.1 edge = +5%)
  runFit: 0.5,            // his run fit (a ratio)
  rushEpa: 0.8,           // × the EPA a rush allowed over the league's (a 0.1 EPA softer = +8%)
  passEpa: 0.6,           // × the EPA a pass allowed over the league's (0.1 = +6%)
  tdPos: 0.5,             // touchdowns allowed at his position (a ratio)
  rzTd: 0.5,              // the red-zone touchdown rate allowed (a ratio)
};
/** The product of a market's factors stays within ±CAP. */
export const CAP = 0.12;
/** The coverage fit: each shell pulled toward his overall at K routes; last season at half while this one holds fewer than minRoutes. */
export const COVER = { K: 40, minRoutes: 150, priorWeight: 0.5, minTotal: 40 };
/** Touchdowns allowed by position are a handful a season (a tight end's: half a game): counted at gp / (gp + K), the ratio bounded. */
export const TD_SHRINK = { K: 16, ratio: [0.6, 1.4] };
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const clampCap = (f, cap = CAP) => Math.min(1 + cap, Math.max(1 - cap, f));

/** id → ABBR from any page that names the teams (Coverage Matrix first, then the games of TD / WR vs CB). */
function teamCodes(pages) {
  const out = {};
  for (const t of pages?.coverageTeams?.teams || pages?.coverageTeamsPrior?.teams || []) if (t.teamId && t.code) out[t.teamId] = t.code;
  for (const g of pages?.tdMatchups?.games || []) for (const t of [g.homeTeam, g.visitorTeam]) if (t?.id && t?.code) out[t.id] = t.code;
  for (const g of pages?.wrCbMatchups?.games || []) { if (g.homeTeamId && g.homeTeam) out[g.homeTeamId] = g.homeTeam; if (g.awayTeamId && g.awayTeam) out[g.awayTeamId] = g.awayTeam; }
  return out;
}

/** His routes and yards by coverage shell from a splits page ({ players, baselines }): { total: { routes, yards }, shells: { name: { routes, yards } } }. */
function splitsOf(page) {
  const out = {};
  for (const b of page?.baselines || []) {
    if (b.coverage !== 'All' || !b.playerId) continue;
    (out[b.playerId] = out[b.playerId] || { shells: {} }).total = { routes: num(b.routesRun) || 0, yards: num(b.yardsSb) || 0 };
  }
  for (const p of page?.players || []) {
    if (!p.playerId || !p.coverage || /^(man|zone|all)$/i.test(p.coverage)) continue;
    (out[p.playerId] = out[p.playerId] || { shells: {} }).shells[p.coverage] = { routes: num(p.routesRun) || 0, yards: num(p.yardsSb) || 0 };
  }
  return out;
}

/**
 * The pages (lib/nfl/propfinder-nfl.js `pages`, as stored) → the digest the board reads: per team (ABBR) its shell mix, EPA a
 * pass and a rush allowed, red-zone touchdown rate allowed, touchdowns allowed a game by position; the league's of each; per
 * receiver (PropFinder id) his routes and yards by shell (this season, last season) and his WR vs CB score; per rusher his
 * run fit. Missing pages leave their parts out. null without any page.
 */
export function digestPages(pages, { at = null } = {}) {
  if (!pages || typeof pages !== 'object' || !Object.keys(pages).length) return null;
  const codes = teamCodes(pages);
  const teams = {};
  const T = (abbr) => (teams[abbr] = teams[abbr] || {});
  for (const t of pages.coverageTeams?.teams || []) {
    if (!t.code) continue;
    const x = T(t.code);
    const mix = {};
    for (const s of t.topSchemes || []) if (s.category && num(s.playPerc) != null) mix[s.category] = s.playPerc / 100;
    x.shells = mix; x.gp = num(t.gamesIncluded);
    x.epaPass = num(t.epaPerPass); x.epaRushTeam = num(t.epaPerRush); x.rzTdDef = num(t.redZoneTdRateDef);
  }
  // Touchdowns allowed a game by position (TD Matchups: the Opponent rows, the season's window).
  for (const r of pages.tdMatchups?.leagueTeamStats || []) {
    if (r.type !== 'Opponent' || r.lastNGames !== 0 || !['RB', 'WR', 'TE', 'QB'].includes(r.position)) continue;
    const abbr = codes[r.teamId];
    const gp = num(r.gamesPlayed);
    if (!abbr || !gp) continue;
    const td = r.position === 'QB' ? (num(r.rushingTouchdowns) || 0) : (num(r.rushingTouchdowns) || 0) + (num(r.receivingTouchdowns) || 0);
    const x = T(abbr); (x.td = x.td || {})[r.position] = td / gp; x.tdGp = gp;
  }
  // Rushing Matchups: the opponent's EPA a rush allowed and its gaps (a row per rusher; the opponent's figures repeat).
  const runners = {};
  const gapsBy = {};
  for (const r of pages.rushingSlateBoard?.rows || []) {
    const opp = r.opponentCode;
    if (opp && num(r.defEpaPerRushAllowed) != null) T(opp).epaRush = r.defEpaPerRushAllowed;
    if (opp && num(r.gapLeftYardsPerGame) != null) gapsBy[opp] = { L: r.gapLeftYardsPerGame, M: r.gapCenterYardsPerGame, R: r.gapRightYardsPerGame };
    if (!r.playerId) continue;
    const share = [num(r.shareLeftAdjPct) ?? num(r.shareLeftPct), num(r.shareMiddleAdjPct) ?? num(r.shareMiddlePct), num(r.shareRightAdjPct) ?? num(r.shareRightPct)];
    runners[r.playerId] = { opp, pos: r.position, attempts: num(r.totalAttempts), share: share.every((v) => v != null) ? share.map((v) => v / 100) : null };
  }
  for (const [abbr, g] of Object.entries(gapsBy)) T(abbr).gaps = g;
  const gapLeague = Object.keys(gapsBy).length ? { L: mean(Object.values(gapsBy).map((g) => g.L)), M: mean(Object.values(gapsBy).map((g) => g.M)), R: mean(Object.values(gapsBy).map((g) => g.R)) } : null;
  for (const x of Object.values(runners)) {
    const g = x.opp ? gapsBy[x.opp] : null;
    x.fit = g && gapLeague && x.share ? r3(x.share[0] * (g.L / gapLeague.L) + x.share[1] * (g.M / gapLeague.M) + x.share[2] * (g.R / gapLeague.R)) : null;
  }
  // The league's figures: the mean over the teams that carry each.
  const vals = (k) => Object.values(teams).map((t) => t[k]).filter((v) => v != null);
  const league = { epaPass: mean(vals('epaPass')), epaRush: mean(vals('epaRush')), rzTdDef: mean(vals('rzTdDef')), td: {} };
  for (const pos of ['RB', 'WR', 'TE', 'QB']) { const xs = Object.values(teams).map((t) => t.td?.[pos]).filter((v) => v != null); league.td[pos] = mean(xs); }
  // Receivers: his shells this season and last, his WR vs CB score.
  const now = splitsOf(pages.coverageReceiverSplits);
  const prior = splitsOf(pages.coverageReceiverSplitsPrior);
  const receivers = {};
  for (const id of new Set([...Object.keys(now), ...Object.keys(prior)])) receivers[id] = { now: now[id] || null, prior: prior[id] || null };
  for (const g of pages.wrCbMatchups?.games || []) {
    for (const r of g.receivers || []) {
      if (!r.playerId || num(r.advantageScore) == null || r.confidence === 'unavailable') continue;
      // The defense he faces in this game: the receiver's opponent id, else the game's other side.
      const opp = codes[r.opponentTeamId] || (r.teamId && r.teamId === g.homeTeamId ? g.awayTeam : r.teamId && r.teamId === g.awayTeamId ? g.homeTeam : null) || null;
      (receivers[r.playerId] = receivers[r.playerId] || {}).wrcb = { adv: r.advantageScore, score: num(r.matchupScore), confidence: r.confidence, sample: num(r.matchupSample), opp, vs: (r.defenders || []).slice(0, 2).map((d) => d.name).filter(Boolean) };
    }
  }
  const advs = Object.values(receivers).map((r) => r.wrcb?.adv).filter((v) => v != null).sort((a, b) => a - b);
  league.wrcbAdv = advs.length ? (advs.length % 2 ? advs[(advs.length - 1) / 2] : (advs[advs.length / 2 - 1] + advs[advs.length / 2]) / 2) : null;
  return { at, teams, league, receivers, runners, gapLeague };
}

/** His coverage fit against the opponent: Σ the opponent's shell share × his yards a route in it (pulled to his overall) ÷ his overall. */
export function coverageFit(rec, shellsMix, C = COVER) {
  if (!rec || !shellsMix) return null;
  const add = (a, b, w) => ({ routes: (a?.routes || 0) + w * (b?.routes || 0), yards: (a?.yards || 0) + w * (b?.yards || 0) });
  const wPrior = (rec.now?.total?.routes || 0) < C.minRoutes ? C.priorWeight : 0;
  const total = add(rec.now?.total, rec.prior?.total, wPrior);
  if (!(total.routes >= C.minTotal) || !(total.yards > 0)) return null;
  const overall = total.yards / total.routes;
  let got = 0; let share = 0;
  for (const [shell, p] of Object.entries(shellsMix)) {
    const s = add(rec.now?.shells?.[shell], rec.prior?.shells?.[shell], wPrior);
    const yprr = (s.yards + C.K * overall) / (s.routes + C.K);
    got += p * yprr; share += p;
  }
  if (!(share > 0.5)) return null;
  return r3(got / share / overall);
}

const part = (page, ratio, weight, why) => ({ page, ratio: r3(ratio), factor: r3(1 + weight * (ratio - 1)), why });

/**
 * The pages' factor on one player's market tonight: { factor, parts: [{ page, ratio, factor, why }] } or null (no page reads
 * him). market: 'rec_yds' | 'receptions' | 'rush_yds' | 'pass_yds' | 'td'; id his PropFinder id; opp the defense's ABBR.
 */
export function matchupFactor(digest, { market, pos, id, opp }, W = WEIGHTS, cap = CAP) {
  if (!digest || !opp) return null;
  const def = digest.teams?.[opp] || null;
  const L = digest.league || {};
  const parts = [];
  if (market === 'rec_yds' || market === 'receptions') {
    if (!['WR', 'TE', 'RB'].includes(pos)) return null;
    const rec = id ? digest.receivers?.[id] : null;
    const fit = def?.shells ? coverageFit(rec, def.shells) : null;
    if (fit != null) parts.push(part('Coverage', fit, W.coverage, `his yards a route against ${opp}'s coverage mix: ${Math.round(fit * 100)}% of his usual`));
    const w = rec?.wrcb && (!rec.wrcb.opp || rec.wrcb.opp === opp) ? rec.wrcb : null;
    if (w && L.wrcbAdv != null) {
      const k = w.confidence === 'limited' ? W.wrcb / 2 : W.wrcb;
      parts.push({ page: 'WR vs CB', ratio: null, factor: r3(1 + k * (w.adv - L.wrcbAdv)), why: `advantage ${w.adv >= 0 ? '+' : ''}${w.adv.toFixed(3)} against ${w.vs?.length ? w.vs.join(', ') : 'the corners he lines up on'} (slate median ${L.wrcbAdv.toFixed(3)}${w.confidence === 'limited' ? ', limited sample' : ''})` });
    }
  } else if (market === 'rush_yds') {
    if (pos === 'RB') {
      const run = id ? digest.runners?.[id] : null;
      if (run?.fit != null && (!run.opp || run.opp === opp)) parts.push(part('Rushing', run.fit, W.runFit, `his run direction through ${opp}'s gaps: ${Math.round(run.fit * 100)}% of the league's`));
    }
    if (def?.epaRush != null && L.epaRush != null && ['RB', 'QB'].includes(pos)) {
      const k = pos === 'QB' ? W.rushEpa / 2 : W.rushEpa;
      parts.push({ page: 'Rushing', ratio: null, factor: r3(1 + k * (def.epaRush - L.epaRush)), why: `${opp} allows ${def.epaRush.toFixed(3)} EPA a rush (league ${L.epaRush.toFixed(3)})` });
    }
  } else if (market === 'pass_yds') {
    if (pos !== 'QB') return null;
    if (def?.epaPass != null && L.epaPass != null) parts.push({ page: 'Coverage Matrix', ratio: null, factor: r3(1 + W.passEpa * (def.epaPass - L.epaPass)), why: `${opp} allows ${def.epaPass.toFixed(3)} EPA a pass (league ${L.epaPass.toFixed(3)})` });
  } else if (market === 'td') {
    const t = def?.td?.[pos]; const lt = L.td?.[pos];
    if (t != null && lt > 0) {
      const gp = def.tdGp || 0; const ratio = Math.min(TD_SHRINK.ratio[1], Math.max(TD_SHRINK.ratio[0], 1 + (t / lt - 1) * (gp / (gp + TD_SHRINK.K))));
      parts.push(part('TD Matchups', ratio, W.tdPos, `${opp} allows ${t.toFixed(2)} touchdowns a game to ${pos}s (league ${lt.toFixed(2)})`));
    }
    if (def?.rzTdDef != null && L.rzTdDef > 0) {
      // A rate over a few trips a game: counted at gp / (gp + 8) of itself, as the touchdowns allowed are.
      const gp = def.gp || def.tdGp || 0; const ratio = 1 + (def.rzTdDef / L.rzTdDef - 1) * (gp / (gp + 8));
      parts.push(part('Coverage Matrix', ratio, W.rzTd, `${opp} allows a touchdown on ${Math.round(def.rzTdDef * 100)}% of red-zone trips (league ${Math.round(L.rzTdDef * 100)}%)`));
    }
  }
  if (!parts.length) return null;
  let f = parts.reduce((a, p) => a * p.factor, 1);
  if (market === 'receptions') f = 1 + (f - 1) / 2;
  return { factor: r3(clampCap(f, cap)), parts };
}

/** The factor in words, for the hovers: "Pages ×1.06: Coverage ×1.04 (…) · WR vs CB ×1.02 (…)". */
export function matchupText(m) {
  if (!m) return '';
  return `PropFinder's matchup pages ×${m.factor.toFixed(2)}: ${m.parts.map((p) => `${p.page} ×${p.factor.toFixed(2)} (${p.why})`).join(' · ')}`;
}

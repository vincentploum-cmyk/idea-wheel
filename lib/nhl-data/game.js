// Turns NHL API box score + play-by-play into one compact game record with
// per-skater rows (box stats + individual shot-attempt metrics).
//
// iCF  = individual shot attempts (goals + shots + missed + blocked)
// iFF  = unblocked attempts (goals + shots + missed)
// iSF  = shots on goal (goals + shots)
// iSCF / iHDCF = scoring / high-danger chances. Natural Stat Trick-style
// approximation from shot location: slot value 3 (high) / 2 (mid) / 1 (low),
// +1 rebound (same-team attempt within 3s), +1 rush (prior event in the
// neutral zone within 4s), -1 if blocked. >=2 counts as a scoring chance,
// >=3 as high danger. Zone sizes were fitted against Natural Stat Trick's
// 2025-26 per-game iSCF/iHDCF for 119 skaters (981 games): mean error ~6%
// (the first-guess zones were ~28% high).

const POS = { C: 'C', L: 'LW', R: 'RW', D: 'D', G: 'G' };
const ATTEMPTS = new Set(['shot-on-goal', 'missed-shot', 'blocked-shot', 'goal']);

export function toiMinutes(toi) {
  const m = String(toi || '').match(/^(\d+):(\d{2})$/);
  return m ? +(Number(m[1]) + Number(m[2]) / 60).toFixed(2) : 0;
}

function seconds(period, timeInPeriod) {
  const m = String(timeInPeriod || '').match(/^(\d+):(\d{2})$/);
  const t = m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  return (Number(period || 1) - 1) * 1200 + t;
}

export function locationValue(x, y) {
  if (x == null || y == null) return 1;
  const dx = 89 - Math.abs(Number(x)); // feet out from the goal line of the nearer net
  const dy = Math.abs(Number(y));
  if (dx < -10) return 1; // behind the net
  if (dx <= 15 && dy <= 7) return 3; // crease + inner slot
  if (dx <= 40 && dy <= 18) return 2; // home-plate area inside the dots
  return 1;
}

/** Map shooterId → { icf, iff, isf, iscf, ihdcf } from play-by-play plays. */
export function shotMetrics(plays, teamOf = {}) {
  const out = {};
  const bump = (id, k) => {
    if (!id) return;
    out[id] = out[id] || { icf: 0, iff: 0, isf: 0, iscf: 0, ihdcf: 0 };
    out[id][k] += 1;
  };
  let prev = null;
  let lastAttemptByTeam = {};
  const ordered = [...(plays || [])].sort((a, b) => (a.sortOrder ?? a.eventId ?? 0) - (b.sortOrder ?? b.eventId ?? 0));
  for (const p of ordered) {
    const type = p.typeDescKey;
    const d = p.details || {};
    const t = seconds(p.periodDescriptor?.number, p.timeInPeriod);
    if (ATTEMPTS.has(type)) {
      const shooter = d.shootingPlayerId || d.scoringPlayerId;
      // For blocked shots the event owner is the blocking team, so use the shooter's team.
      const team = String(teamOf[shooter] ?? (type === 'blocked-shot' ? `vs-${d.eventOwnerTeamId}` : d.eventOwnerTeamId));
      bump(shooter, 'icf');
      if (type !== 'blocked-shot') bump(shooter, 'iff');
      if (type === 'shot-on-goal' || type === 'goal') bump(shooter, 'isf');

      let v = locationValue(d.xCoord, d.yCoord);
      const last = lastAttemptByTeam[team];
      if (last != null && t - last <= 3 && t >= last) v += 1; // rebound
      if (prev && t - prev.t <= 4 && t >= prev.t && prev.x != null && Math.abs(prev.x) < 25) v += 1; // rush
      if (type === 'blocked-shot') v -= 1;
      if (v >= 2) bump(shooter, 'iscf');
      if (v >= 3) bump(shooter, 'ihdcf');
      lastAttemptByTeam[team] = t;
    }
    if (type !== 'stoppage' && type !== 'period-start' && type !== 'period-end') {
      prev = { t, x: d.xCoord ?? null };
    }
    if (type === 'period-start') {
      prev = null;
      lastAttemptByTeam = {};
    }
  }
  return out;
}

/** The game's first goal from the plays (shootout excluded): { playerId, period, time } or null. */
export function firstGoalOf(plays) {
  const ordered = [...(plays || [])].sort((a, b) => (a.sortOrder ?? a.eventId ?? 0) - (b.sortOrder ?? b.eventId ?? 0));
  const g = ordered.find((p) => p.typeDescKey === 'goal' && p.periodDescriptor?.periodType !== 'SO' && p.details?.scoringPlayerId);
  return g ? { playerId: g.details.scoringPlayerId, period: Number(g.periodDescriptor?.number) || null, time: g.timeInPeriod || null } : null;
}

/**
 * Stamp the first goal on a game record: `firstGoal` ({ playerId, name, team, period, time },
 * null when the game had none) and `fg: 1` on the scorer's row (0 on every other skater).
 * The scorer's team comes from his own row, so a stored record needs only the plays.
 */
export function stampFirstGoal(game, plays) {
  const fg = firstGoalOf(plays);
  const scorer = fg ? game.skaters.find((s) => s.id === fg.playerId) : null;
  for (const s of game.skaters) s.fg = scorer && s === scorer ? 1 : 0;
  game.firstGoal = fg ? { ...fg, name: scorer?.name || null, team: scorer?.team || null } : null;
  return game.firstGoal;
}

/**
 * Shots on goal (goals included) per shooter in each regulation period: { [playerId]: [p1, p2, p3] }.
 * Overtime and the shootout are left out, so the three periods compare like for like.
 */
export function periodShotsOf(plays) {
  const out = {};
  for (const p of plays || []) {
    if (p.typeDescKey !== 'shot-on-goal' && p.typeDescKey !== 'goal') continue;
    const per = p.periodDescriptor || {};
    const n = Number(per.number);
    if ((per.periodType && per.periodType !== 'REG') || !(n >= 1 && n <= 3)) continue;
    const id = p.details?.shootingPlayerId || p.details?.scoringPlayerId;
    if (!id) continue;
    (out[id] = out[id] || [0, 0, 0])[n - 1] += 1;
  }
  return out;
}

/**
 * Stamp each skater's shots by period on a game record: `sp` = [p1, p2, p3] ([0, 0, 0] for a skater
 * without one). A stored record needs only the plays (the backfill's `firstgoals` mode stamps both).
 */
export function stampPeriodShots(game, plays) {
  const by = periodShotsOf(plays);
  for (const s of game.skaters) s.sp = by[s.id] ? [...by[s.id]] : [0, 0, 0];
  return game;
}

/**
 * Power-play shots on goal (goals included) per shooter: the play's situationCode (away goalie, away skaters,
 * home skaters, home goalie: "1451" = the home side on a 5-on-4) has the shooter's side with more skaters and the
 * defending goalie in net. The shootout is left out. `homeOf` = { [playerId]: true when he plays at home }.
 * The Defense tab reads them per position to say which kills give their power-play shots to the defensemen
 * (Vincent, 2026-11-12: "add D share of PP shots to the Defense tab"; tools/predictors/pp_shots.py).
 */
export function ppShotsOf(plays, homeOf) { return ppCountsOf(plays, homeOf).sog; }

/** Power-play goals per scorer, the same read as ppShotsOf (the rink's PP badge under Goals, 2026-11-14). */
export function ppGoalsOf(plays, homeOf) { return ppCountsOf(plays, homeOf).g; }

function ppCountsOf(plays, homeOf) {
  const sog = {}; const g = {};
  for (const p of plays || []) {
    if (p.typeDescKey !== 'shot-on-goal' && p.typeDescKey !== 'goal') continue;
    if (p.periodDescriptor?.periodType === 'SO') continue;
    const id = p.details?.shootingPlayerId || p.details?.scoringPlayerId;
    if (!id || homeOf[id] == null) continue;
    const code = String(p.situationCode ?? '').padStart(4, '0');
    if (!/^\d{4}$/.test(code)) continue;
    const [awayG, awayK, homeK, homeG] = code.split('').map(Number);
    const home = homeOf[id];
    const own = home ? homeK : awayK; const opp = home ? awayK : homeK;
    if ((home ? awayG : homeG) === 0 || !(own > opp)) continue;
    sog[id] = (sog[id] || 0) + 1;
    if (p.typeDescKey === 'goal') g[id] = (g[id] || 0) + 1;
  }
  return { sog, g };
}

/** Stamp each skater's power-play shots on goal and goals on a game record: `ppSog`, `ppG` (0 for a skater without one). */
export function stampPpShots(game, plays) {
  const homeOf = Object.fromEntries(game.skaters.map((s) => [s.id, s.venue === 'H']));
  const by = ppCountsOf(plays, homeOf);
  for (const s of game.skaters) { s.ppSog = by.sog[s.id] || 0; s.ppG = by.g[s.id] || 0; }
  return game;
}

/** Normalised game record, or null if the game isn't final. */
export function buildGameRecord(box, pbp) {
  if (!box || !(box.gameState === 'OFF' || box.gameState === 'FINAL')) return null;
  const names = {};
  const teamOf = {};
  for (const r of pbp?.rosterSpots || []) {
    names[r.playerId] = `${r.firstName?.default || ''} ${r.lastName?.default || ''}`.trim();
    teamOf[r.playerId] = r.teamId;
  }
  const metrics = shotMetrics(pbp?.plays || [], teamOf);
  const away = box.awayTeam;
  const home = box.homeTeam;
  const winner = away.score > home.score ? away.abbrev : home.abbrev;

  const side = (key, team, opp, venue) => {
    const t = box.playerByGameStats?.[key] || {};
    const skaters = [...(t.forwards || []), ...(t.defense || [])].map((p) => {
      const m = metrics[p.playerId] || { icf: 0, iff: 0, isf: 0, iscf: 0, ihdcf: 0 };
      return {
        id: p.playerId,
        name: names[p.playerId] || p.name?.default || String(p.playerId),
        team: team.abbrev,
        opp: opp.abbrev,
        venue,
        pos: POS[p.position] || p.position,
        toi: toiMinutes(p.toi),
        g: p.goals || 0,
        a: p.assists || 0,
        pm: p.plusMinus || 0,
        sog: p.sog || 0,
        hits: p.hits || 0,
        blk: p.blockedShots || 0,
        pim: p.pim || 0,
        shifts: p.shifts || 0,
        gv: p.giveaways || 0,
        tk: p.takeaways || 0,
        icf: m.icf,
        iff: m.iff,
        isf: Math.max(m.isf, p.sog || 0),
        iscf: m.iscf,
        ihdcf: m.ihdcf,
        result: team.abbrev === winner ? 'W' : 'L',
      };
    });
    const goalies = (t.goalies || []).map((g) => ({
      id: g.playerId,
      name: names[g.playerId] || g.name?.default,
      team: team.abbrev,
      venue,
      toi: toiMinutes(g.toi),
      sa: g.shotsAgainst || 0,
      ga: g.goalsAgainst || 0,
      sv: g.saves || 0,
      starter: !!g.starter,
      decision: g.decision || null,
    }));
    return { skaters, goalies };
  };

  const a = side('awayTeam', away, home, 'A');
  const h = side('homeTeam', home, away, 'H');
  const game = {
    id: box.id,
    season: box.season,
    gameType: box.gameType,
    date: box.gameDate,
    away: { abbrev: away.abbrev, score: away.score, sog: away.sog },
    home: { abbrev: home.abbrev, score: home.score, sog: home.sog },
    lastPeriodType: box.gameOutcome?.lastPeriodType || null,
    skaters: [...a.skaters, ...h.skaters],
    goalies: [...a.goalies, ...h.goalies],
  };
  // Who scored first (and so which position / line the other team gave the first goal to).
  stampFirstGoal(game, pbp?.plays || []);
  // Shots by period (the rink's 1 · 2 · 3 badges); a game without plays stays unstamped.
  if (pbp?.plays?.length) { stampPeriodShots(game, pbp.plays); stampPpShots(game, pbp.plays); }
  return game;
}

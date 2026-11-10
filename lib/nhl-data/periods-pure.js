// The rink's 1 · 2 · 3 badges: for each regulation period, how a skater's matchup reads from what
// tonight's opponent gives up in that period and what the skater himself produces in it.
// Pure: built from the stored rows (`sp1` / `sp2` / `sp3` = his shots on goal in each period, stamped
// from the play-by-play by `stampPeriodShots` in game.js), this season's alone (the opponent's table
// in any number is this season's). Colour only: no number on the board moves with it.

import { seasonYearOf } from './picks-pure';

export const PERIODS = [1, 2, 3];
/** Games a team needs in the period table before its rank counts. */
export const MIN_TEAM_GAMES = 3;
/** Games a skater needs with shots by period before his own rate counts. */
export const MIN_SKATER_GAMES = 5;

const r2 = (v) => Math.round(v * 100) / 100;
const groupOf = (pos) => (pos === 'D' ? 'D' : 'F');
const hasPeriods = (r) => r.sp1 != null && r.sp2 != null && r.sp3 != null;

/** Thirds of a list ranked 1 = the most: +1 top third, -1 bottom third, 0 between (and no rank). */
export function thirdOf(rank, of) {
  if (!rank || !of) return 0;
  const third = Math.ceil(of / 3);
  if (rank <= third) return 1;
  if (rank > of - third) return -1;
  return 0;
}

/** Rank of `v` among `vals` (1 = the most, ties shared). */
function rankAmong(v, vals) {
  return 1 + vals.filter((x) => x > v).length;
}

/**
 * Every team's shots allowed a game in each period and every skater's shots a game in each, this
 * season's stored rows (those carrying shots by period) before the slate.
 * { teams: { ABBR: { gp, allowed: [p1, p2, p3], rank: [..], of } }, league: [p1, p2, p3],
 *   skaters: { id: { gp, rate: [..], rank: [..], of, group } } }
 */
export function periodBook(rows, season) {
  const teamGames = {};
  const teamShots = {};
  const sk = {};
  for (const r of rows || []) {
    if (!hasPeriods(r) || (season != null && seasonYearOf(r.date) !== season)) continue;
    const sp = [r.sp1, r.sp2, r.sp3];
    if (r.opp) {
      (teamGames[r.opp] = teamGames[r.opp] || new Set()).add(r.gameId);
      const t = (teamShots[r.opp] = teamShots[r.opp] || [0, 0, 0]);
      sp.forEach((v, i) => { t[i] += v || 0; });
    }
    if (r.playerId != null) {
      const s = (sk[r.playerId] = sk[r.playerId] || { gp: 0, shots: [0, 0, 0], group: groupOf(r.pos) });
      s.gp += 1;
      s.group = groupOf(r.pos);
      sp.forEach((v, i) => { s.shots[i] += v || 0; });
    }
  }

  const teams = {};
  for (const [abbr, games] of Object.entries(teamGames)) {
    const gp = games.size;
    teams[abbr] = { gp, allowed: teamShots[abbr].map((v) => r2(v / gp)) };
  }
  const ranked = Object.values(teams).filter((t) => t.gp >= MIN_TEAM_GAMES);
  const totalGp = Object.values(teams).reduce((n, t) => n + t.gp, 0);
  const league = PERIODS.map((_, i) => (totalGp ? r2(Object.values(teams).reduce((n, t) => n + t.allowed[i] * t.gp, 0) / totalGp) : null));
  for (const t of Object.values(teams)) {
    t.of = ranked.length;
    t.rank = t.gp >= MIN_TEAM_GAMES ? PERIODS.map((_, i) => rankAmong(t.allowed[i], ranked.map((x) => x.allowed[i]))) : [null, null, null];
  }

  const skaters = {};
  for (const [id, s] of Object.entries(sk)) skaters[id] = { gp: s.gp, group: s.group, rate: s.shots.map((v) => r2(v / s.gp)) };
  // Each skater ranked against his position group (forwards / defence) with enough games.
  for (const group of ['F', 'D']) {
    const pool = Object.values(skaters).filter((s) => s.group === group && s.gp >= MIN_SKATER_GAMES);
    for (const s of Object.values(skaters)) {
      if (s.group !== group) continue;
      s.of = pool.length;
      s.rank = s.gp >= MIN_SKATER_GAMES ? PERIODS.map((_, i) => rankAmong(s.rate[i], pool.map((x) => x.rate[i]))) : [null, null, null];
    }
  }
  return { teams, league, skaters };
}

const ORD = ['1st', '2nd', '3rd'];

/**
 * The three badges for one skater against `opp`: per period the opponent's third (+1 allows among
 * the most, -1 among the fewest) plus the skater's own third among his position group; the sum
 * reads green (`soft`, +1 or more), amber (`mid`, 0) or red (`tough`, -1 or less). A side without
 * enough games counts 0 and is named in the hover. Null while neither side has enough games to rank.
 */
export function periodRead(book, id, opp) {
  const t = book?.teams?.[opp] || null;
  const s = id != null ? book?.skaters?.[id] || null : null;
  if (!t?.rank?.[0] && !s?.rank?.[0]) return null;
  const groupName = s?.group === 'D' ? 'defencemen' : 'forwards';
  return PERIODS.map((p, i) => {
    const oppTier = t ? thirdOf(t.rank[i], t.of) : 0;
    const ownTier = s ? thirdOf(s.rank?.[i], s.of) : 0;
    const score = oppTier + ownTier;
    const tone = score >= 1 ? 'soft' : score <= -1 ? 'tough' : 'mid';
    const oppText = t?.rank?.[i]
      ? `${opp} allow ${t.allowed[i].toFixed(1)} shots in the ${ORD[i]}, #${t.rank[i]} of ${t.of} (the league ${book.league[i]?.toFixed(1)})`
      : `${opp}: under ${MIN_TEAM_GAMES} games with shots by period`;
    const ownText = s?.rank?.[i]
      ? `he takes ${s.rate[i].toFixed(2)} a game in the ${ORD[i]}, #${s.rank[i]} of ${s.of} ${groupName}`
      : s ? `he has ${s.gp} game${s.gp === 1 ? '' : 's'} with shots by period (${MIN_SKATER_GAMES} count)` : 'no games of his with shots by period';
    return { period: p, tone, oppTier, ownTier, text: `Period ${p}: ${oppText} · ${ownText} · this season` };
  });
}

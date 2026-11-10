// The court chips' Q1 badge (Vincent, 2026-11-10, after the NHL rink's 1 · 2 · 3: "build the court headline verdict plus
// a Q1 badge"): for the stat the court shows, how a player's 1st quarter reads from what tonight's opponent gives up in
// the 1st quarter and what the player himself gets in it. Built from the stored ESPN box scores of the season (every
// game of the league; `q1Pts` / `q1Reb` / `q1Ast` / `q1Tpm` per player, `periodLines` in espn.js), the nights before the
// slate. Pure; colour only, no number on the board moves with it.
import { normName } from '../nhl-data/names';

export const Q1_STATS = { pts: 'q1Pts', reb: 'q1Reb', ast: 'q1Ast', tpm: 'q1Tpm' };
const NOUN = { pts: 'points', reb: 'rebounds', ast: 'assists', tpm: 'threes' };
/** Games a team needs before its rank counts. */
export const Q1_MIN_TEAM_GAMES = 3;
/** Games a player needs before his own rate counts. */
export const Q1_MIN_PLAYER_GAMES = 5;

const r2 = (v) => Math.round(v * 100) / 100;
/** ESPN's position → the group a player is ranked in: guards, forwards, centres. */
export function groupOf(pos) {
  const p = String(pos || '').toUpperCase();
  if (p === 'C') return 'C';
  if (p.includes('F')) return 'F';
  return 'G';
}
const GROUP_WORD = { G: 'guards', F: 'forwards', C: 'centers' };

/** Thirds of a list ranked 1 = the most: +1 top third, -1 bottom third, 0 between (and no rank). */
export function thirdOf(rank, of) {
  if (!rank || !of) return 0;
  const third = Math.ceil(of / 3);
  if (rank <= third) return 1;
  if (rank > of - third) return -1;
  return 0;
}
const rankAmong = (v, vals) => 1 + vals.filter((x) => x > v).length;

/**
 * Every team's 1st-quarter points / rebounds / assists / threes allowed a game and every player's own a game, over the
 * final results dated before `through` whose players carry the quarter's lines.
 * { teams: { ABBR: { gp, allowed: { pts, … }, rank: { pts, … }, of } }, league: { pts, … },
 *   players: { [espnId | 'n:' + normName]: { gp, group, rate: { … }, rank: { … }, of } } }
 */
export function q1Book(results, { through = null } = {}) {
  const teams = {};
  const players = {};
  for (const r of results || []) {
    if (!r?.final || (through && !(String(r.date) < through))) continue;
    const list = (r.players || []).filter((p) => p.played !== false && p.q1Pts != null);
    if (!list.length) continue;
    for (const team of [r.away, r.home]) {
      const opp = team === r.away ? r.home : r.away;
      const mine = list.filter((p) => p.team === team);
      if (!mine.length || !opp) continue;
      const t = (teams[opp] ||= { gp: 0, sum: { pts: 0, reb: 0, ast: 0, tpm: 0 } });
      t.gp += 1;
      for (const [k, f] of Object.entries(Q1_STATS)) t.sum[k] += mine.reduce((s, p) => s + (Number(p[f]) || 0), 0);
    }
    for (const p of list) {
      if (!(Number(p.min) > 0)) continue;
      const id = p.espnId ? String(p.espnId) : `n:${normName(p.name)}`;
      const s = (players[id] ||= { gp: 0, group: groupOf(p.pos), sum: { pts: 0, reb: 0, ast: 0, tpm: 0 } });
      s.gp += 1;
      for (const [k, f] of Object.entries(Q1_STATS)) s.sum[k] += Number(p[f]) || 0;
      if (p.espnId && p.name) players[`n:${normName(p.name)}`] = s;   // the name finds him too
    }
  }
  const stats = Object.keys(Q1_STATS);
  const outTeams = {};
  for (const [abbr, t] of Object.entries(teams)) outTeams[abbr] = { gp: t.gp, allowed: Object.fromEntries(stats.map((k) => [k, r2(t.sum[k] / t.gp)])) };
  const ranked = Object.values(outTeams).filter((t) => t.gp >= Q1_MIN_TEAM_GAMES);
  const totalGp = Object.values(outTeams).reduce((n, t) => n + t.gp, 0);
  const league = Object.fromEntries(stats.map((k) => [k, totalGp ? r2(Object.values(outTeams).reduce((n, t) => n + t.allowed[k] * t.gp, 0) / totalGp) : null]));
  for (const t of Object.values(outTeams)) {
    t.of = ranked.length;
    t.rank = Object.fromEntries(stats.map((k) => [k, t.gp >= Q1_MIN_TEAM_GAMES ? rankAmong(t.allowed[k], ranked.map((x) => x.allowed[k])) : null]));
  }
  // Players: one object per player (the id and name keys share it), ranked within his group.
  const outPlayers = {};
  const unique = new Map();
  for (const [key, s] of Object.entries(players)) {
    if (!unique.has(s)) unique.set(s, { gp: s.gp, group: s.group, rate: Object.fromEntries(stats.map((k) => [k, r2(s.sum[k] / s.gp)])) });
    outPlayers[key] = unique.get(s);
  }
  const all = [...unique.values()];
  for (const group of ['G', 'F', 'C']) {
    const pool = all.filter((s) => s.group === group && s.gp >= Q1_MIN_PLAYER_GAMES);
    for (const s of all) {
      if (s.group !== group) continue;
      s.of = pool.length;
      s.rank = Object.fromEntries(stats.map((k) => [k, s.gp >= Q1_MIN_PLAYER_GAMES ? rankAmong(s.rate[k], pool.map((x) => x.rate[k])) : null]));
    }
  }
  return { teams: outTeams, league, players: outPlayers };
}

/**
 * One player's Q1 read against `opp`, per stat: the opponent's third (+1 allows among the most in the 1st quarter, -1
 * among the fewest) plus his own third among his group; the sum reads green (`soft`, +1 or more), amber (`mid`, 0) or
 * red (`tough`, -1 or less). { pts: { tone, text }, … }, a stat left out while neither side ranks; null without any.
 */
export function q1Read(book, { espnId = null, name = null } = {}, opp) {
  const t = book?.teams?.[opp] || null;
  const s = (espnId != null && book?.players?.[String(espnId)]) || (name ? book?.players?.[`n:${normName(name)}`] : null) || null;
  const out = {};
  for (const k of Object.keys(Q1_STATS)) {
    const tr = t?.rank?.[k] ?? null;
    const sr = s?.rank?.[k] ?? null;
    if (!tr && !sr) continue;
    const score = thirdOf(tr, t?.of) + thirdOf(sr, s?.of);
    const tone = score >= 1 ? 'soft' : score <= -1 ? 'tough' : 'mid';
    const oppText = tr ? `${opp} allow ${t.allowed[k].toFixed(1)} ${NOUN[k]} in the 1st quarter, #${tr} of ${t.of} (the league ${book.league[k]?.toFixed(1)})` : `${opp}: under ${Q1_MIN_TEAM_GAMES} games with 1st-quarter lines`;
    const ownText = sr ? `he gets ${s.rate[k].toFixed(1)} in the 1st, #${sr} of ${s.of} ${GROUP_WORD[s.group]}` : s ? `he has ${s.gp} game${s.gp === 1 ? '' : 's'} with 1st-quarter lines (${Q1_MIN_PLAYER_GAMES} count)` : 'no 1st-quarter lines of his';
    out[k] = { tone, text: `1st quarter ${NOUN[k]}: ${oppText} · ${ownText} · this season` };
  }
  return Object.keys(out).length ? out : null;
}

/** The board with every side player's Q1 read (`q1`) against his opponent; a new board, the input untouched. */
export function withQ1Reads(board, book) {
  if (!board?.games?.length || !book) return board;
  const games = board.games.map((g) => {
    if (!g.sides) return g;
    const sides = Object.fromEntries(Object.entries(g.sides).map(([abbr, side]) => [abbr, side ? {
      ...side,
      players: (side.players || []).map((p) => ({ ...p, q1: q1Read(book, { espnId: p.espnId, name: p.player }, side.opp) })),
    } : side]));
    return { ...g, sides };
  });
  return { ...board, games };
}

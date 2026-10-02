// First-goal candidates for a slate: who scores a game's first goal tonight. A
// descriptive view over what the slate already carries (each skater's line slot,
// the opponent's first goals given up per position and slot at tonight's venue,
// the head-to-head record, the model's 1+ goal odds) plus each player's own
// first-goal record from the stored rows. The model's math is untouched.
import { buildSlate } from './slate';
import { loadRows } from './build';
import { slotLabel } from './positions';

const r2 = (v) => +v.toFixed(2);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// About one skater in 36 scores a game's first goal: the prior a thin record shrinks toward.
export const LEAGUE_FG_RATE = 0.028;
const SHRINK_GAMES = 20;

/**
 * Each player's first-goal record over his last `window` stored games that carry the
 * flag: { [playerId]: { gp, fg, rate, rateAdj } }. rateAdj shrinks a thin record toward
 * the league rate (20 games' worth of prior), so three games with one first goal do not
 * outrank a season of them.
 */
export function firstGoalRecord(rows, { window = 100 } = {}) {
  const byPlayer = {};
  for (const r of rows) {
    if (r.fg == null || r.playerId == null) continue;
    (byPlayer[r.playerId] = byPlayer[r.playerId] || []).push(r);
  }
  const out = {};
  for (const [id, list] of Object.entries(byPlayer)) {
    const recent = list.slice(-window);
    const fg = recent.filter((r) => Number(r.fg) === 1).length;
    const gp = recent.length;
    out[id] = { gp, fg, rate: gp ? r2(fg / gp) : 0, rateAdj: r2((fg + LEAGUE_FG_RATE * SHRINK_GAMES) / (gp + SHRINK_GAMES)) };
  }
  return out;
}

/**
 * The combined read, 0–100. The model's 1+ goal odds and the player's own first-goal
 * rate carry most of it; the opponent's leak to his position (its share against the
 * league's) and his head-to-head goals per game move it up or down. Without a model
 * number the own rate and the leak take its weight.
 */
export function firstGoalScore({ p1g = null, rateAdj = 0, leakRatio = 1, h2hGpg = 0 }) {
  const own = clamp(rateAdj / 0.15, 0, 1);
  const leak = clamp(leakRatio, 0, 2) / 2;
  const h2h = clamp(h2hGpg, 0, 1);
  const score = p1g != null
    ? 0.45 * clamp(p1g / 0.45, 0, 1) + 0.30 * own + 0.15 * leak + 0.10 * h2h
    : 0.55 * own + 0.30 * leak + 0.15 * h2h;
  return Math.round(clamp(score, 0, 1) * 100);
}

/** One slate skater → a candidate row, or null when he is not dressed. */
export function candidate(p, side, record) {
  if (!p.inLineup) return null;
  const own = (p.id != null && record[p.id]) || { gp: 0, fg: 0, rate: 0, rateAdj: LEAGUE_FG_RATE };
  const d = side.defense?.[p.pos] || null;
  const fg = d?.firstGoal || null;
  const slot = slotLabel(p.pos, p.line);
  const leakRatio = fg?.games && fg.league ? r2(fg.share / fg.league) : 1;
  const p1g = p.model?.p1g ?? (p.projG != null ? r2(1 - Math.exp(-p.projG)) : null);
  const score = firstGoalScore({ p1g, rateAdj: own.rateAdj, leakRatio, h2hGpg: p.h2h?.gpg || 0 });
  return {
    id: p.id, number: p.number ?? null, name: p.name, team: p.team, opp: p.opp, venue: p.venue, pos: p.pos, line: p.line, slot,
    own: { gp: own.gp, fg: own.fg, rate: own.rate },
    leak: fg?.games ? { games: fg.games, allowed: fg.allowed, share: fg.share, league: fg.league, rank: fg.rank, teamCount: fg.teamCount, slot: slot ? fg.bySlot?.[slot] || 0 : null, ratio: leakRatio } : null,
    h2h: p.h2h || null,
    model: p.model ? { p1g: p.model.p1g ?? null, g: p.model.g ?? null, fire: !!p.model.fire } : null,
    p1g, modelled: p.model?.p1g != null,
    score,
  };
}

/** The board for a date: every game's candidates, the whole slate ranked, and what actually happened. */
export async function buildFirstGoalBoard(date) {
  const [slate, rows] = await Promise.all([buildSlate(date), loadRows(date)]);
  const record = firstGoalRecord(rows);
  const games = slate.games.map((g) => {
    const candidates = g.sides.flatMap((side) => side.skaters.map((p) => candidate(p, side, record)).filter(Boolean)).sort((a, b) => b.score - a.score);
    // How often each team gives up the first goal at tonight's venue: the other side's defense object describes it.
    const leakOf = (team) => g.sides.find((s) => s.opp === team)?.defense?.All?.firstGoal || null;
    return {
      id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC, final: !!g.log?.score, score: g.log?.score || null,
      actual: g.log?.firstGoal || null,
      leaks: { [g.away]: leakOf(g.away), [g.home]: leakOf(g.home) },
      candidates,
    };
  });
  const all = games.flatMap((g) => g.candidates).sort((a, b) => b.score - a.score);
  return {
    date, games, top: all.slice(0, 40), count: all.length,
    modelRun: slate.modelRun, gamesStored: slate.gamesStored,
    recorded: Object.values(record).reduce((s, r) => s + r.fg, 0),
  };
}

// The pre-game projected scores, stored so the History tab can grade them against the finals
// (lib/nhl-data/score.js builds them; Vincent, 2026-10-31: "that way I can test whether our predictions
// for goals make sense or not"). `stampScores(date)` writes data/scores/<date>.json after every lineup
// read and model run: for each game that has not started, the board's projection as it stands (the
// last one before puck drop is the one that stays); a game under way or final keeps its stored entry.
// The picks board shows the stored projection beside the live one once a game is final, and the
// scorecard grades every stored projection in its range.
import { readJson, writeJson } from '../nhl-store';

export const scoresPath = (date) => `data/scores/${date}.json`;

/** A game has started when its start time has passed (a game without one on a past date too). */
export function started(game, date, now = Date.now(), today = null) {
  const t = Date.parse(game?.startTimeUTC || '');
  if (Number.isFinite(t)) return now >= t;
  return today ? date < today : false;
}

/**
 * Store the projections of the games on `date` that have not started. `board` is buildPicks(date)'s result
 * (its games carry `projected`). Returns { date, stored: n, kept: n, skipped: n } and writes nothing when no
 * game changes.
 */
export async function stampScores(date, board, { now = Date.now(), today = null } = {}) {
  const prev = (await readJson(scoresPath(date)).catch(() => null)) || { date, games: {} };
  const games = { ...(prev.games || {}) };
  let stored = 0; let kept = 0; let skipped = 0;
  for (const g of board?.games || []) {
    const p = g.projected;
    if (!p) { skipped += 1; continue; }
    if (started(g, date, now, today) || g.final) { if (games[g.id]) kept += 1; else skipped += 1; continue; }
    games[g.id] = { at: new Date(now).toISOString(), startTimeUTC: g.startTimeUTC || null, away: g.away, home: g.home, exp: p.exp, total: p.total, win: p.win, headline: p.headline, title: p.title, parts: p.parts };
    stored += 1;
  }
  if (stored) await writeJson(scoresPath(date), { date, updatedAt: new Date(now).toISOString(), games });
  return { date, stored, kept, skipped };
}

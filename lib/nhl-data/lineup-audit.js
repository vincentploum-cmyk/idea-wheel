// Which stored games still owe a post-game lineup read? Every stored box score is graded against
// the position snapshot it was stamped from: per team, where its positions came from (a tweet
// from the warm-up window or the game itself: the writers' final word; an earlier tweet; NHL.com's
// projected lineup; PropFinder's depth chart or the roster; or no snapshot at all), how many of its
// skaters carry a lineup slot, and what a re-stamp would change now (stored rows behind the
// snapshot). Descriptive only: `GET /api/nhl/data/lineups/audit?from&to` reads it, the post-game
// hop of nhl-lineups.yml (or its `backfill_from` input for past dates) does the updating.
import { snapshotSlot } from './positions';
import { VERDICT, lineupVerdict } from './lineup-read';

export { VERDICT };
/** The verdicts a post-game read could still improve on. */
export const OWED = new Set([VERDICT.early, VERDICT.preview, VERDICT.none, VERDICT.missing]);
const posGroup = (pos) => (pos === 'D' ? 'D' : 'F');

/**
 * One stored game (`data/games/<date>.json` entry) against the date's position snapshot:
 * { id, date, away, home, startTimeUTC, teams: { ABBR: { source, verdict, tweetMinutes (the tweet's
 * time from puck drop, negative before it), handle, carried, skaters, fromLineup, withLine, pendingRestamp } } }.
 */
export function auditGame(game, snapshot) {
  const snap = snapshot?.games?.[game.id] || null;
  const startIso = snap?.startTimeUTC || game.startTimeUTC || null;
  const teams = {};
  for (const abbr of [game.away?.abbrev, game.home?.abbrev]) {
    if (!abbr) continue;
    const t = snap?.teams?.[abbr] || null;
    const skaters = (game.skaters || []).filter((s) => s.team === abbr);
    let pending = 0;
    for (const s of skaters) {
      // The same rule as applyPositions: the snapshot's slot, unless it contradicts the box score's position group.
      const read = snap ? snapshotSlot(snapshot, game.id, abbr, s.name) : null;
      const slot = read && posGroup(read.pos) === posGroup(s.boxPos ?? s.pos) ? read : null;
      const pos = slot ? slot.pos : (s.boxPos ?? s.pos);
      const line = slot ? slot.line : null;
      const src = slot ? 'lineup' : 'box';
      if (pos !== s.pos || (line ?? null) !== (s.line ?? null) || src !== (s.posSource || 'box')) pending += 1;
    }
    // The rink's pill reads the same rule (`lineupVerdict`): the writers' final word, an earlier tweet, the preview, or a guess.
    const { verdict, tweetMinutes: minutes } = lineupVerdict(t, startIso);
    teams[abbr] = {
      source: t?.source || null, verdict, tweetMinutes: minutes, handle: t?.meta?.handle || null, tweetDate: t?.meta?.gdtDate || null,
      carried: t?.carried?.count || 0, skaters: skaters.length, fromLineup: skaters.filter((s) => s.posSource === 'lineup').length,
      withLine: skaters.filter((s) => s.line != null).length, pendingRestamp: pending,
    };
  }
  return { id: game.id, date: game.date, away: game.away?.abbrev || null, home: game.home?.abbrev || null, startTimeUTC: startIso, teams };
}

/** Every stored game of a date: the audits and a summary ({ games, sides, byVerdict, owed, pendingRestamp, skaters, fromLineup }). */
export function auditDate(date, gamesFile, snapshot) {
  const games = (gamesFile?.games || []).map((g) => auditGame(g, snapshot));
  const summary = { date, games: games.length, sides: 0, byVerdict: {}, owed: 0, pendingRestamp: 0, skaters: 0, fromLineup: 0 };
  for (const g of games) {
    for (const t of Object.values(g.teams)) {
      summary.sides += 1;
      summary.byVerdict[t.verdict] = (summary.byVerdict[t.verdict] || 0) + 1;
      if (OWED.has(t.verdict)) summary.owed += 1;
      summary.pendingRestamp += t.pendingRestamp;
      summary.skaters += t.skaters;
      summary.fromLineup += t.fromLineup;
    }
  }
  return { date, games, summary };
}

/** The sides across dates that a post-game read could still improve, oldest first. */
export function owedSides(dates) {
  const out = [];
  for (const d of dates || []) {
    for (const g of d.games || []) {
      for (const [abbr, t] of Object.entries(g.teams || {})) {
        if (OWED.has(t.verdict) || t.pendingRestamp) out.push({ date: d.date, gameId: g.id, game: `${g.away}@${g.home}`, team: abbr, verdict: t.verdict, source: t.source, tweetMinutes: t.tweetMinutes, pendingRestamp: t.pendingRestamp, fromLineup: t.fromLineup, skaters: t.skaters });
      }
    }
  }
  return out;
}

// The book's lines on the skaters from PropFinder's pull: each skater's shots-on-goal ladder with its main line and
// his anytime-goal price, read off the same odds-only players call the pull makes (the goalies' saves lines come
// from it the same way, goalie-props.js; the items' shapes in prop-lines.js). Vincent, 2026-10-31: "run that edge
// audit for shots and goals" — no skater price had been stored before this, so nothing could be graded against the
// book. Stored per slate at data/propfinder/skater-props/<date>.json ({ at, date, source, skaters: [{ pfId, name, key,
// team, pos, sog, goal }], withSog, withGoal, sample }: `sog` the ladder's main line { line, odds, underOdds, book, books,
// isMain, implied, lines }, `goal` the anytime price { line: 0.5, odds, … }); the slate puts them on each skater as
// `prop`, the board reads the edge at them (lib/nhl-data/edge-pure.js) and the scorecard grades it night by night.
// A spelling that reads nothing can be fixed from `sample`, the first priced skater's items as sent, never guessed.
import { normName } from './model-key';
import { propLinesOf, words, nameOf, catOf, NOT_GAME, lists } from './prop-lines';

export const skaterPropsPath = (date) => `data/propfinder/skater-props/${date}.json`;

const isGoalie = (p) => p?.positionGroup === 'G' || String(p?.positionAbbreviation || p?.position || '').toUpperCase() === 'G';
// "Player Shots on Goal", "Shots On Goal", "SOG", "Shots" — not blocked shots, shot attempts, a period's shots.
const SOG = /\bshots?( on goal)?\b|\bsog\b/;
const NOT_SOG = /\bblock|\battempt|\bmissed\b|\bpower.?play\b|\bhits?\b/;
// "Anytime Goal Scorer", "Anytime Goalscorer", "To Score", "Player Goals" at 0.5 — not the first / last goal, not 2+.
const GOAL = /\banytime\b|\bgoal ?scorer\b|\bto score\b|\bgoals?\b/;
const NOT_GOAL = /\bfirst\b|\blast\b|\b1st\b|\bpower.?play\b|\bshort.?handed\b|\bgame.?winning\b|\bhat.?trick\b|\bassist|\bpoint/;
const isSogItem = (o) => { const n = words(nameOf(o)); const c = words(catOf(o)); return (SOG.test(n) || SOG.test(c)) && !NOT_SOG.test(n) && !NOT_SOG.test(c) && !NOT_GAME.test(n) && !NOT_GAME.test(c); };
const isGoalItem = (o) => { const n = words(nameOf(o)); const c = words(catOf(o)); if (!(GOAL.test(n) || GOAL.test(c)) || SOG.test(n)) return false; return !NOT_GOAL.test(n) && !NOT_GOAL.test(c) && !NOT_GAME.test(n) && !NOT_GAME.test(c); };

/** One skater's shots ladder and main line (prop-lines.js), or null. */
export function sogLinesOf(p) { return propLinesOf(p, isSogItem); }

/** One skater's anytime-goal price: the yes / over at 0.5 (a "goals" market at 0.5 is the same bet; a 1.5 line is 2+, left on the ladder). */
export function goalLineOf(p) {
  const all = propLinesOf(p, isGoalItem, { defaultLine: 0.5 });
  if (!all) return null;
  const any = all.lines.find((l) => l.line === 0.5 && l.odds != null);
  if (!any) return null;
  const books = all.lines.filter((l) => l.line === 0.5).reduce((s, l) => s + (l.books || 0), 0);
  return { line: 0.5, odds: any.odds, underOdds: any.underOdds ?? null, book: all.line === 0.5 ? all.book : null, books, isMain: true, implied: Math.round((any.odds > 0 ? 100 / (any.odds + 100) : -any.odds / (-any.odds + 100)) * 1000) / 1000, lines: all.lines };
}

/**
 * The pull's skaters with their lines: { skaters: [{ pfId, name, key, team, pos, sog, goal }], withSog, withGoal, sample }.
 * `teamOf(p)` names the team's abbreviation; `sample` is the first priced skater's first items as sent.
 */
export function skaterPropsOf(players, { teamOf = (p) => p?.team?.abbreviation || p?.team?.code || p?.team || null } = {}) {
  const skaters = [];
  let sample = null;
  for (const p of players || []) {
    if (isGoalie(p) || !p?.name) continue;
    const items = lists(p).flat();
    const sog = sogLinesOf(p); const goal = goalLineOf(p);
    if (!sample && items.length) sample = { name: p.name, keys: Object.keys(p), items: items.slice(0, 8) };
    if (!sog && !goal) continue;
    skaters.push({ pfId: p.id ?? p.playerId ?? null, name: p.name, key: normName(p.name), team: teamOf(p) || null, pos: p.positionAbbreviation || p.position || null, sog, goal });
  }
  return { skaters, withSog: skaters.filter((s) => s.sog).length, withGoal: skaters.filter((s) => s.goal).length, sample };
}

/**
 * The stored lines of a skater: his name matched whole (the NHL spelling against PropFinder's through normName), else
 * by surname on the team when it names one skater. { sog, goal, name } or null.
 */
export function skaterPropFor(props, name, team) {
  if (!props?.skaters?.length || !name) return null;
  const key = normName(name);
  let hit = props.skaters.find((s) => s.key === key && (!team || !s.team || s.team === team)) || null;
  if (!hit) {
    const last = key.split(' ').slice(-1)[0];
    const same = props.skaters.filter((s) => s.team === team && s.key.split(' ').slice(-1)[0] === last);
    hit = same.length === 1 ? same[0] : null;
  }
  if (!hit) return null;
  return { sog: hit.sog || null, goal: hit.goal || null, name: hit.name };
}

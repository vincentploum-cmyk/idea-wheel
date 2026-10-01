// Player-name matching between NHL API names and the names in PropFinder files
// (the model joins every input on player name, so they must agree).
import { readJson, memoizeByInputs } from '../nhl-store';
import { loadPlayers } from './rosters';

export const SOURCE_NAMES_PATH = 'data/reference/source-names.json';

/** Same normalisation as the model's normalizePlayerName(). */
export function normName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(?:C|LW|RW|D)\b$/i, '')
    .replace(/\b(?:JR|SR|III|II|IV)\b/gi, '')
    .replace(/[-]/g, ' ')
    .replace(/[.,'’‘`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const split = (n) => {
  const parts = normName(n).split(' ');
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
};

/**
 * Map NHL player ids → the spelling PropFinder uses, plus the PropFinder
 * names nobody could be matched to.
 */
export function matchNames(players, sourceNames) {
  const resolve = nameResolver(players);
  const display = {};
  const unmatched = [];
  for (const [src, info] of Object.entries(sourceNames || {})) {
    const hit = resolve(src, info);
    if (hit) {
      if (normName(hit.name) !== normName(src)) display[hit.id] = src;
    } else {
      unmatched.push({ name: src, ...info });
    }
  }
  return { display, unmatched };
}

/**
 * (name, { team }) → the NHL player it names, or null. Exact normalised match
 * first, then same last name + a first name that starts alike, the team
 * breaking ties.
 */
const resolvers = new WeakMap(); // players object → resolver (loadPlayers hands back the same object while unchanged)
export function nameResolver(players) {
  if (players && typeof players === 'object') {
    if (!resolvers.has(players)) resolvers.set(players, buildResolver(players));
    return resolvers.get(players);
  }
  return buildResolver(players);
}

function buildResolver(players) {
  const byNorm = {};
  const byLast = {};
  for (const p of Object.values(players || {})) {
    byNorm[normName(p.name)] = p;
    const { last } = split(p.name);
    (byLast[last] = byLast[last] || []).push(p);
  }
  return (src, info = {}) => {
    const hit = byNorm[normName(src)];
    if (hit) return hit;
    const { first, last } = split(src);
    const cands = (byLast[last] || []).filter((p) => {
      const f = split(p.name).first;
      return f.slice(0, 3) === first.slice(0, 3) || f[0] === first[0];
    });
    const sameTeam = cands.filter((p) => info.team && p.team === info.team);
    return sameTeam.length === 1 ? sameTeam[0] : cands.length === 1 ? cands[0] : null;
  };
}

/**
 * id → name to print in generated workbooks (override > PropFinder spelling > NHL).
 * The workbook builders run several at once over the same reference files, so the
 * match is reused while those files are unchanged. Shared result: read-only.
 */
export const loadDisplayNames = memoizeByInputs(
  () => Promise.all([loadPlayers(), readJson(SOURCE_NAMES_PATH)]),
  (ref, source) => {
    const { display, unmatched } = matchNames(ref.players, source?.names || {});
    for (const p of Object.values(ref.players)) if (p.overridden && p.name) display[p.id] = p.name;
    return { display, unmatched, players: ref.players };
  },
);

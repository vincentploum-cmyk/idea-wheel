// Player-name matching between NHL API names and the names in PropFinder files
// (the model joins every input on player name, so they must agree).
import { readJson } from '../nhl-store';
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
  const byNorm = {};
  const byLast = {};
  for (const p of Object.values(players)) {
    byNorm[normName(p.name)] = p;
    const { last } = split(p.name);
    (byLast[last] = byLast[last] || []).push(p);
  }
  const display = {};
  const unmatched = [];
  for (const [src, info] of Object.entries(sourceNames || {})) {
    const n = normName(src);
    let hit = byNorm[n];
    if (!hit) {
      const { first, last } = split(src);
      const cands = (byLast[last] || []).filter((p) => {
        const f = split(p.name).first;
        return f.slice(0, 3) === first.slice(0, 3) || f[0] === first[0];
      });
      const sameTeam = cands.filter((p) => info.team && p.team === info.team);
      hit = sameTeam.length === 1 ? sameTeam[0] : cands.length === 1 ? cands[0] : null;
    }
    if (hit) {
      if (normName(hit.name) !== n) display[hit.id] = src;
    } else {
      unmatched.push({ name: src, ...info });
    }
  }
  return { display, unmatched };
}

/** id → name to print in generated workbooks (override > PropFinder spelling > NHL). */
export async function loadDisplayNames() {
  const [ref, source] = await Promise.all([loadPlayers(), readJson(SOURCE_NAMES_PATH)]);
  const { display, unmatched } = matchNames(ref.players, source?.names || {});
  for (const p of Object.values(ref.players)) if (p.overridden && p.name) display[p.id] = p.name;
  return { display, unmatched, players: ref.players };
}

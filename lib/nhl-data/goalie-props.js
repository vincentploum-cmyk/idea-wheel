// The book's saves lines on the goalies, from PropFinder's NHL players payload (the same
// `/NHL/players?…&withOddsOnly=true` call the pull makes for the skaters; a goalie's prop items are
// his saves lines). Vincent, 2026-10-31: "pull the goalie saves lines from PropFinder and show the
// edge... I just need over x saves with a %". The items are read with the spellings the NBA / NFL
// reader knows (lib/picks/propfinder.js `playerProps`, checked on the NBA pull of 2026-10-20: { market,
// categoryMapping, sportsbook, selectionLine over | under, price (American), points (the line), isMain })
// and the older { market, line, overOdds, underOdds } shape; the main line is the one priced nearest a
// coin flip. No NHL goalie item had been seen when this was written: the pull stores a raw `sample` of
// the first goalie's items beside the lines, so a spelling that reads nothing can be fixed from it,
// never guessed. Server-side (names.js reaches the store): the panel reads the rows the slate builds.
import { normName } from './names';
import { propLinesOf, words, nameOf, catOf, NOT_GAME, lists } from './prop-lines';

export const PF_GOALIE_PROPS_PATH = 'data/propfinder/goalie-props.json';

const isGoalie = (p) => p?.positionGroup === 'G' || String(p?.positionAbbreviation || p?.position || '').toUpperCase() === 'G';
const SAVES = /\bsaves?\b/;
const isSavesItem = (o) => {
  const n = words(nameOf(o)); const c = words(catOf(o));
  if (!SAVES.test(n) && !SAVES.test(c)) return false;
  return !NOT_GAME.test(n) && !NOT_GAME.test(c);
};

/**
 * One goalie's saves lines: every line the books price ({ line, odds, underOdds, book, books, main }) and the
 * main one — of the lines flagged main the one priced nearest a coin flip, then the one priced both ways by
 * the most books; the median line on a tie — or null when he has none (lib/nhl-data/prop-lines.js).
 */
export function savesLinesOf(p) {
  return propLinesOf(p, isSavesItem);
}

/**
 * The pull's goalies with their saves lines: { goalies: [{ pfId, name, key, team, status, ...line }], sample }.
 * `teamOf(p)` names the team's abbreviation; `sample` is the first goalie's first items as sent (keys and
 * values), stored for the spelling check under Data sources.
 */
export function goalieSavesProps(players, { teamOf = (p) => p?.team?.abbreviation || p?.team?.code || p?.team || null } = {}) {
  const goalies = [];
  let sample = null;
  for (const p of players || []) {
    if (!isGoalie(p) || !p.name) continue;
    const items = lists(p).flat();
    if (!sample && items.length) sample = { name: p.name, keys: Object.keys(p), items: items.slice(0, 6) };
    const prop = savesLinesOf(p);
    goalies.push({ pfId: p.id ?? p.playerId ?? null, name: p.name, key: normName(p.name), team: teamOf(p) || null, status: p.status || null, ...(prop || { line: null, odds: null, underOdds: null, book: null, books: 0, isMain: false, implied: null, lines: [] }) });
  }
  return { goalies, withLines: goalies.filter((g) => g.line != null).length, sample };
}

/**
 * The saves line of a team's goalie in the stored file (`goalies` as `goalieSavesProps` builds them): his name
 * matched whole (NHL spelling against PropFinder's through normName), else by surname on the team when it names
 * one goalie. Null without a line.
 */
export function savesLineFor(props, goalie, team) {
  if (!props?.goalies?.length || !goalie?.name) return null;
  const key = normName(goalie.name);
  let hit = props.goalies.find((g) => g.key === key && (!team || !g.team || g.team === team)) || null;
  if (!hit) {
    const last = key.split(' ').slice(-1)[0];
    const same = props.goalies.filter((g) => g.team === team && g.key.split(' ').slice(-1)[0] === last);
    hit = same.length === 1 ? same[0] : null;
  }
  if (!hit || hit.line == null) return null;
  const { line, odds, underOdds, book, books, isMain, implied, lines } = hit;
  return { line, odds, underOdds, book, books, isMain, implied, lines, name: hit.name };
}

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
import { parseOdds, parseNumber, impliedProb } from '../nfl/odds';
import { normName } from './names';

export const PF_GOALIE_PROPS_PATH = 'data/propfinder/goalie-props.json';

const isGoalie = (p) => p?.positionGroup === 'G' || String(p?.positionAbbreviation || p?.position || '').toUpperCase() === 'G';
const words = (s) => String(s || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
const SAVES = /\bsaves?\b/;
// A period's or a window's saves ("1st Period Saves", "saves in the first 10 minutes") is no game line.
const NOT_GAME = /\b(1st|2nd|3rd|first|second|third)\b|\bperiod\b|\bp[1-3]\b|\bminutes?\b|\bmins?\b|\bovertime\b|\bshootout\b/;
const nameOf = (o) => String(o.market || o.marketName || o.statType || o.propType || o.name || o.type || o.stat || o.key || o.label || '');
const catOf = (o) => String(o.categoryMapping || o.category || '');
const isSavesItem = (o) => {
  const n = words(nameOf(o)); const c = words(catOf(o));
  if (!SAVES.test(n) && !SAVES.test(c)) return false;
  return !NOT_GAME.test(n) && !NOT_GAME.test(c);
};
const sideOf = (o) => { const s = String(o.selectionLine ?? o.side ?? o.selection ?? '').toLowerCase(); return /under|^no$|^u$/.test(s) ? 'under' : 'over'; };
const lists = (p) => [p.odds, p.props, p.markets, p.playerProps, p.lines, p.propOdds].filter(Array.isArray);
const r3 = (v) => (v == null ? null : +Number(v).toFixed(3));

/** The over's implied probability with the vig split when both sides are priced; how far it sits from a toss-up. */
const overProb = (x) => { const o = x.odds != null ? impliedProb(x.odds) : null; const u = x.underOdds != null ? 1 - impliedProb(x.underOdds) : null; return o != null && u != null ? (o + u) / 2 : o ?? u; };
const balance = (x) => { const p = overProb(x); return p == null ? 1 : Math.round(Math.abs(p - 0.5) * 100) / 100; };

/**
 * One goalie's saves lines: every line the books price ({ line, odds, underOdds, book, books, main }) and the
 * main one — of the lines flagged main the one priced nearest a coin flip, then the one priced both ways by
 * the most books; the median line on a tie — or null when he has none.
 */
export function savesLinesOf(p) {
  const grouped = new Map();
  const legacy = [];
  for (const list of lists(p)) for (const o of list) {
    if (!o || typeof o !== 'object' || !isSavesItem(o)) continue;
    if (o.points != null || o.selectionLine != null || o.sportsbook != null) {
      const line = parseNumber(o.points ?? o.line ?? o.value ?? o.threshold ?? o.handicap);
      if (line == null) continue;
      const g = grouped.get(line) || { line, over: [], under: [], main: false };
      g[sideOf(o)].push({ price: parseOdds(o.price ?? o.odds ?? o.americanOdds), book: o.sportsbook || o.book || o.bookmaker || o.provider || null });
      if (o.isMain) g.main = true;
      grouped.set(line, g);
    } else {
      const line = parseNumber(o.line ?? o.value ?? o.threshold ?? o.point ?? o.handicap ?? o.total);
      if (line == null) continue;
      legacy.push({ line, odds: parseOdds(o.overOdds ?? o.over ?? o.overPrice ?? o.odds ?? o.price ?? o.americanOdds), underOdds: parseOdds(o.underOdds ?? o.under ?? o.underPrice), book: o.book || o.sportsbook || o.bookmaker || o.provider || null, books: 1, main: true });
    }
  }
  const best = (sides) => sides.filter((x) => x.price != null).sort((a, b) => b.price - a.price)[0] || null;
  const rows = [...legacy];
  for (const g of grouped.values()) {
    const over = best(g.over); const under = best(g.under);
    if (!over && !under) continue;
    rows.push({ line: g.line, odds: over?.price ?? null, underOdds: under?.price ?? null, book: over?.book || under?.book || null, books: new Set([...g.over, ...g.under].map((x) => x.book).filter(Boolean)).size, main: g.main });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => a.line - b.line);
  const mains = rows.filter((x) => x.main);
  const pool = mains.length ? mains : rows;
  const sides = (x) => (x.odds != null ? 1 : 0) + (x.underOdds != null ? 1 : 0);
  const mid = pool[Math.floor((pool.length - 1) / 2)].line;
  const pick = [...pool].sort((a, b) => balance(a) - balance(b) || sides(b) - sides(a) || b.books - a.books || Math.abs(a.line - mid) - Math.abs(b.line - mid) || a.line - b.line)[0];
  const { main, ...rest } = pick;
  return { ...rest, isMain: main, implied: r3(pick.odds != null ? impliedProb(pick.odds) : null), lines: rows.map(({ line, odds, underOdds, books, main: m }) => ({ line, odds, underOdds, books, main: m })) };
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

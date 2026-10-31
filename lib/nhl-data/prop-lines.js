// A player's lines for one market off PropFinder's prop items (the odds-only players call: one item per book and side
// in the NBA pull's shape — { market, categoryMapping, sportsbook, selectionLine over | under | yes | no, price
// (American), points (the line), isMain } — or the older { market, line, overOdds, underOdds } shape), shared by the
// goalies' saves lines (goalie-props.js) and the skaters' shots and anytime-goal lines (skater-props.js). The ladder
// is every line the books price with the best price a side, and the main line is of the lines flagged main the one
// priced nearest a coin flip, then the one priced both ways by the most books, the median on a tie. Pure.
import { parseOdds, parseNumber, impliedProb } from '../nfl/odds';

export const words = (s) => String(s || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
export const nameOf = (o) => String(o.market || o.marketName || o.statType || o.propType || o.name || o.type || o.stat || o.key || o.label || '');
export const catOf = (o) => String(o.categoryMapping || o.category || '');
// A period's or a window's line ("1st Period Shots", "saves in the first 10 minutes") is no game line.
export const NOT_GAME = /\b(1st|2nd|3rd|first|second|third)\b|\bperiod\b|\bp[1-3]\b|\bminutes?\b|\bmins?\b|\bovertime\b|\bshootout\b/;
const sideOf = (o) => { const s = String(o.selectionLine ?? o.side ?? o.selection ?? '').toLowerCase(); return /under|^no$|^u$/.test(s) ? 'under' : 'over'; };
export const lists = (p) => [p?.odds, p?.props, p?.markets, p?.playerProps, p?.lines, p?.propOdds].filter(Array.isArray);
const r3 = (v) => (v == null ? null : +Number(v).toFixed(3));

/** The over's implied probability with the vig split when both sides are priced; how far it sits from a toss-up. */
const overProb = (x) => { const o = x.odds != null ? impliedProb(x.odds) : null; const u = x.underOdds != null ? 1 - impliedProb(x.underOdds) : null; return o != null && u != null ? (o + u) / 2 : o ?? u; };
const balance = (x) => { const p = overProb(x); return p == null ? 1 : Math.round(Math.abs(p - 0.5) * 100) / 100; };

/**
 * The lines of one market on a player: `isItem(o)` says which items belong to it; `defaultLine` stands in for an item
 * without a line (an anytime-goal item is a yes / no at 0.5). { line, odds, underOdds, book, books, isMain, implied,
 * lines: [{ line, odds, underOdds, books, main }] } or null when he has none.
 */
export function propLinesOf(p, isItem, { defaultLine = null } = {}) {
  const grouped = new Map();
  const legacy = [];
  for (const list of lists(p)) for (const o of list) {
    if (!o || typeof o !== 'object' || !isItem(o)) continue;
    if (o.points != null || o.selectionLine != null || o.sportsbook != null) {
      const line = parseNumber(o.points ?? o.line ?? o.value ?? o.threshold ?? o.handicap) ?? defaultLine;
      if (line == null) continue;
      const g = grouped.get(line) || { line, over: [], under: [], main: false };
      g[sideOf(o)].push({ price: parseOdds(o.price ?? o.odds ?? o.americanOdds), book: o.sportsbook || o.book || o.bookmaker || o.provider || null });
      if (o.isMain) g.main = true;
      grouped.set(line, g);
    } else {
      const line = parseNumber(o.line ?? o.value ?? o.threshold ?? o.point ?? o.handicap ?? o.total) ?? defaultLine;
      if (line == null) continue;
      legacy.push({ line, odds: parseOdds(o.overOdds ?? o.over ?? o.overPrice ?? o.yes ?? o.odds ?? o.price ?? o.americanOdds), underOdds: parseOdds(o.underOdds ?? o.under ?? o.underPrice ?? o.no), book: o.book || o.sportsbook || o.bookmaker || o.provider || null, books: 1, main: true });
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

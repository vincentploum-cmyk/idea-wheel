// The with / without glance (board.js withoutSplit; Vincent, 2026-11-23, of Grimes with Reaves out: "I need to quickly see
// this"): the chip's badge and the card's line for a player whose teammate is out tonight. Pure, client-safe.

const LABEL = { min: 'min', pts: 'pts', reb: 'reb', ast: 'ast', tpm: '3pm', pra: 'pra' };
const num = (v) => (v == null ? '–' : Number.isInteger(v) ? String(v) : v.toFixed(1));
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${num(Math.abs(v))}`;
const who = (s) => (s?.names || []).join(' + ');

/**
 * The chip's badge: "w/o Reaves +11 min" (the minutes when they move 4+, else the points), green up, red down; null unless
 * the split is `big`. { text, tone: 'soft' | 'tough', title }.
 */
export function woBadge(split) {
  if (!split?.big) return null;
  const m = split.stats.min; const p = split.stats.pts;
  const lead = m && Math.abs(m.gap) >= Math.abs(p?.gap ?? 0) / 2 && Math.abs(m.gap) >= 4 ? ['min', m] : p ? ['pts', p] : ['min', m];
  const [k, s] = lead;
  return { text: `w/o ${who(split)} ${signed(s.gap)} ${LABEL[k]}`, tone: s.gap >= 0 ? 'soft' : 'tough', title: woLine(split) };
}

/** The card's line: "Without Reaves (4 games this season): 37 min · 25.5 pts · 6.0 reb … — with him (11): 26 · 8.0 · 2.5 …". */
export function woLine(split) {
  if (!split?.stats) return '';
  const keys = ['min', 'pts', 'reb', 'ast', 'tpm', 'pra'].filter((k) => split.stats[k]);
  const part = (side) => keys.map((k) => `${num(split.stats[k][side])} ${LABEL[k]}`).join(' · ');
  const gaps = keys.map((k) => `${signed(split.stats[k].gap)} ${LABEL[k]}`).join(' · ');
  const plural = (n) => `${n} game${n === 1 ? '' : 's'}`;
  const line = `Without ${who(split)} (${plural(split.gpWithout)} this season): ${part('without')}. With (${plural(split.gpWith)}): ${part('with')}. Gap: ${gaps}.`;
  // Tested on 2024-25 to now (docs/audits/2026-11-23-nba-own-without.md): splits of +8 points or more landed about 15 points
  // where the split said 18-22 and the board's read said 16; the board's projection is the better guide.
  return split.big ? `${line} Splits this big have landed near the board's projection, not this average.` : line;
}

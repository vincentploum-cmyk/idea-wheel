// Ordering for the 1st goal tab's table (pure; safe in the browser).
// What each sortable column orders by; numbers descend, names ascend, "no data" last.
const SORT_KEYS = {
  score: (c) => c.score,
  player: (c) => c.name,
  tonight: (c) => `${c.opp}|${c.venue}`,
  own: (c) => (c.own.gp ? c.own.rate * 1000 + c.own.fg : null),
  leak: (c) => (c.leak ? c.leak.share * 1000 + (c.leak.slot || 0) : null),
  h2h: (c) => (c.h2h ? c.h2h.gpg * 1000 + c.h2h.g : null),
  h2hsog: (c) => (c.h2h ? c.h2h.spg * 1000 + c.h2h.sog : null),
  p1g: (c) => c.p1g,
};
const TEXT_SORT = new Set(['player', 'tonight']);

export function sortCandidates(list, sort) {
  const key = SORT_KEYS[sort] || SORT_KEYS.score;
  const text = TEXT_SORT.has(sort);
  return [...list].sort((a, b) => {
    const va = key(a); const vb = key(b);
    if (va == null && vb == null) return b.score - a.score;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (text) return String(va).localeCompare(String(vb)) || b.score - a.score;
    return vb - va || b.score - a.score;
  });
}


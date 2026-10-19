// Prices and rates as cheat sheets print them.

/** "+120", "-110", "−115", "1.91" (decimal), 120 → American odds as a number, or null. */
export function parseOdds(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    if (Math.abs(v) >= 100) return Math.round(v);
    if (v > 1 && v < 100) return decimalToAmerican(v);
    return null;
  }
  const s = String(v).trim().replace(/[−–]/g, '-').replace(/\s+/g, '');
  if (!s || /^(n\/?a|—|-)$/i.test(s)) return null;
  const m = s.match(/^([+-]?)(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const n = Number(m[2]);
  if (m[1] === '+' || m[1] === '-') return Math.abs(n) >= 100 ? Math.round(Number(`${m[1]}${n}`)) : null;
  if (n >= 100) return Math.round(n);
  if (n > 1) return decimalToAmerican(n);
  return null;
}

export function decimalToAmerican(d) {
  if (!(d > 1)) return null;
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
}

/** The probability an American price implies (vig included). */
export function impliedProb(odds) {
  if (odds == null || !Number.isFinite(odds) || odds === 0) return null;
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}

/** The break-even American price of a probability: "-150", "+120", or "—". */
export function fairOdds(p) {
  if (!(p > 0) || p >= 1) return '—';
  return p >= 0.5 ? `-${Math.round((100 * p) / (1 - p))}` : `+${Math.round((100 * (1 - p)) / p)}`;
}

export const fmtOdds = (o) => (o == null ? '—' : o > 0 ? `+${o}` : String(o));

/**
 * A hit rate as a cheat sheet prints it: "7/10", "70%", "0.7", 70, "7 of 10" → { rate, n }
 * (n = the games behind it when the text says so, else null); null when it isn't one.
 */
export function parseRate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    if (v >= 0 && v <= 1) return { rate: v, n: null };
    if (v > 1 && v <= 100) return { rate: v / 100, n: null };
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d+)\s*(?:\/|of|-)\s*(\d+)$/i);
  if (m) { const n = Number(m[2]); return n > 0 ? { rate: Number(m[1]) / n, n } : null; }
  m = s.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (m) return { rate: Number(m[1]) / 100, n: null };
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return parseRate(Number(m[1]));
  // "70% (7/10)"
  m = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) { const n = Number(m[2]); return n > 0 ? { rate: Number(m[1]) / n, n } : null; }
  return null;
}

/** A number in a cell ("245.5", "245,5", "245.5 yds", "o245.5"), or null. */
export function parseNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

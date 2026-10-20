// Layout helpers shared by the OCR cheat-sheet parsers (lib/nfl/cheatsheet-detailed.js,
// lib/nba/cheatsheet-ocr.js): the reader's words grouped into rows, name fragments matched
// against a roster, and the text-only rows a layout wraps around a player's numbers claimed by
// the nearest numeric row.
import { normName } from '../nhl-data/names';

const ROW_TOL = 7;            // words within this many pixels of a baseline share a row

export const NUM_RE = /^[-−–]?\d[\d.,:]*%?$/;
export const isNumeric = (w) => NUM_RE.test(w.text.replace(/[,]/g, ''));

/** The words grouped by baseline: [{ y, words (left to right) }]. */
export function rowsOf(words) {
  const sorted = [...words].filter((w) => w.text && w.text.trim()).sort((a, b) => a.y1 - b.y1 || a.x - b.x);
  const rows = [];
  for (const w of sorted) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(r.y - w.y1) <= ROW_TOL) r.words.push(w);
    else rows.push({ y: w.y1, words: [w] });
  }
  for (const r of rows) r.words.sort((a, b) => a.x - b.x);
  return rows;
}

export const textOf = (r) => r.words.map((w) => w.text).join(' ');

/** Each fragment row goes to the nearest numeric row within `gap` pixels: Map(numericRow → [rows]). */
export function claimFragments(numeric, fragments, gap) {
  const claimed = new Map();
  for (const f of fragments) {
    let best = null;
    for (const n of numeric) { const d = Math.abs(f.y - n.y); if (d <= gap && (!best || d < best.d)) best = { n, d }; }
    if (best) { if (!claimed.has(best.n)) claimed.set(best.n, []); claimed.get(best.n).push(f); }
  }
  return claimed;
}

/** OCR name fragments cleaned: letters, dots, apostrophes and hyphens, single capitals kept ("AJ"). */
export const cleanFragments = (list) => list.map((t) => t.replace(/[^A-Za-z.'’-]/g, '')).filter((t) => t.length > 1 || /^[A-Z]$/.test(t));

/** A roster name match for OCR fragments: the roster player (of the team, when given) whose name is nearest. */
export function resolveName(fragments, roster, team) {
  const raw = fragments.join(' ').replace(/-\s+/g, '-').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const pool = (roster || []).filter((p) => !team || !p.team || p.team === team);
  if (!pool.length) return { name: raw, matched: false };
  const want = normName(raw).split(' ').filter(Boolean);
  let best = null;
  for (const p of pool) {
    const have = normName(p.name).split(' ').filter(Boolean);
    const last = have[have.length - 1];
    // Score: the last name's closeness, then the first name's.
    let score = 0;
    for (const w of want) {
      if (w.length < 2) continue;
      const sim = Math.max(...have.map((h) => similarity(w, h)));
      score += sim >= 0.85 ? 2 : sim >= 0.6 ? 1 : 0;
      if (w === last) score += 1;
    }
    if (!best || score > best.score) best = { p, score };
  }
  if (!best || best.score < 2) return { name: raw, matched: false };
  return { name: best.p.name, matched: true, pos: best.p.pos || null, team: best.p.team || null };
}

/** 1 - edit distance / length, on two lowercase tokens. */
export function similarity(a, b) {
  if (a === b) return 1;
  const m = a.length; const n = b.length;
  if (!m || !n) return 0;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}

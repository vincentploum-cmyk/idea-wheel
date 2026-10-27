// The NBA cheat sheet (nba_<date>.pdf): one page a game, one team a column, the team's logo on
// top (no text to read: the players name the team through the slate's roster), then twenty
// rank tiles ("23rd / PG Points Rank": five rows PG · SG · SF · PF · C, four columns points ·
// rebounds · assists · threes, read as what the column's opponent gives up to the position,
// rank 1 = the most) and the player table (Name · POS · MIN · PTS · REB · AST · 3PM, season
// averages). The pages are pictures, so the words come from OCR (lib/picks/ocr.js) with their
// boxes. No lines, prices or hit rates: each player is a "mention" (market null) that the board
// takes as the sheet's confirmation of his PropFinder plays, with his averages and position, and
// the tiles stand in for PropFinder's defense ranks when the slate has no pull. OCR drops the
// decimal point and the colon ("38" for 3.8, "2744" for 27:44); they are put back.
import { normName } from '../nhl-data/names';
import { rowsOf, textOf, isNumeric, claimFragments, cleanFragments, resolveName } from '../picks/ocr-layout';

const POS_ROWS = ['PG', 'SG', 'SF', 'PF', 'C'];
const STAT_COLS = ['pts', 'reb', 'ast', 'tpm'];
const TABLE_COLS = ['pos', 'min', 'pts', 'reb', 'ast', 'tpm'];
const NAME_GAP = 45;          // a name fragment row sits within this many pixels of its numbers row
const POS_RE = /^(PG|SG|SF|PF|C|G|F)$/i;

/** "23rd" → 23, "(2nd)" → 2, "d0th" / "qth" (a misread 10th) → 10, anything else → null. */
export function fixRank(raw) {
  const s = String(raw || '').replace(/[^\dA-Za-z]/g, '');
  const m = s.match(/^(\d{1,2})(st|nd|rd|th)$/i);
  if (m) { const v = Number(m[1]); return v >= 1 && v <= 30 ? v : null; }
  if (/^[dqo][0o]?th$/i.test(s)) return 10;   // "10th" with its 1 read as a d or q
  // "1st" on a bright tile, its 1 read as a d, i, l or a bracket ("dst", "IST", "[St", "{ists"; 2026-10-26's sheet had five on one column).
  if (/^[dil]{0,2}sts?$/i.test(s)) return 1;
  // "3rd" / "23rd" with the r read as a 1 ("31d").
  const rd = s.match(/^(\d{1,2})1d$/);
  if (rd) { const v = Number(rd[1]); return v >= 1 && v <= 30 ? v : null; }
  return null;
}

/** A season average: "16.3" → 16.3, "38" → 3.8 (the decimal point OCR dropped), "04" → 0.4, "1156" (a point read as a digit) → 11.5. */
export function fixAvg(raw) {
  let s = String(raw || '').replace(/[^\d.]/g, '');
  if (!s || s === '.') return null;
  if (!s.includes('.') && s.length === 4) s = s.slice(0, 3);
  const v = s.includes('.') ? Number(s) : Number(`${s.slice(0, -1) || '0'}.${s.slice(-1)}`);
  return Number.isFinite(v) && v < 100 ? Math.round(v * 10) / 10 : null;
}

/** Minutes a game: "31:18" → 31.3, "2744" (the colon dropped) → 27.7, "12.46" → 12.8. */
export function fixMinutes(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length < 3 || d.length > 4) return null;
  const mm = Number(d.slice(0, -2)); const ss = Number(d.slice(-2));
  if (ss >= 60 || mm > 48) return null;
  return Math.round((mm + ss / 60) * 10) / 10;
}

/** Values clustered along one axis: groups whose members sit within `gap` of the group's first. */
function clusters(values, gap) {
  const out = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    const g = out[out.length - 1];
    if (g && v - g[0] <= gap) g.push(v); else out.push([v]);
  }
  return out.map((g) => g.reduce((s, x) => s + x, 0) / g.length);
}

/** The rank tiles above the table: { PG: { pts: 23, reb: 23, ast: 16, tpm: 12 }, … } by grid position. */
export function parseTiles(words, { below }) {
  const ranks = words.filter((w) => w.y1 < below && /^\(?[\dA-Za-z]{1,2}(st|nd|rd|th)\)?$/i.test(w.text.replace(/[^\dA-Za-z()]/g, '')));
  if (ranks.length < 4) return {};
  const rowsY = clusters(ranks.map((w) => w.y1), 40);
  const colsX = clusters(ranks.map((w) => w.x), 60);
  if (rowsY.length !== POS_ROWS.length || colsX.length !== STAT_COLS.length) return {};
  const out = {};
  for (const w of ranks) {
    const ri = rowsY.findIndex((y) => Math.abs(y - w.y1) <= 40);
    const ci = colsX.findIndex((x) => Math.abs(x - w.x) <= 60);
    if (ri < 0 || ci < 0) continue;
    const v = fixRank(w.text);
    if (v == null) continue;
    (out[POS_ROWS[ri]] = out[POS_ROWS[ri]] || {})[STAT_COLS[ci]] = v;
  }
  return out;
}

/**
 * One team column's words → the players ({ player, matched, pos, avg: { min, pts, reb, ast, tpm } })
 * and the tiles. `roster` = [{ name, team, pos }]; `team` narrows the match when known.
 */
export function parseColumn(words, { roster = [], team = null } = {}) {
  const rows = rowsOf(words);
  const header = rows.find((r) => r.words.some((w) => /^name$/i.test(w.text)) && r.words.some((w) => /^(pos|pts|min)$/i.test(w.text)));
  if (!header) return { players: [], tiles: parseTiles(words, { below: Infinity }), header: false };
  const cols = {};
  for (const w of header.words) {
    const t = w.text.replace(/[^A-Za-z3]/g, '').toLowerCase();
    const key = t === 'pos' ? 'pos' : t === 'min' ? 'min' : t === 'pts' ? 'pts' : t === 'reb' ? 'reb' : t === 'ast' ? 'ast' : t === '3pm' ? 'tpm' : null;
    if (key && cols[key] == null) cols[key] = w.x + (w.x1 - w.x) / 2;
  }
  // Columns the reader missed take their place by order between the ones it read.
  const known = TABLE_COLS.filter((k) => cols[k] != null);
  if (known.length < 3) return { players: [], tiles: parseTiles(words, { below: header.y }), header: false };
  const nameLimit = (cols.pos ?? cols[known[0]]) - 40;
  const colOf = (w) => { const cx = w.x + (w.x1 - w.x) / 2; let best = null; for (const k of known) { const d = Math.abs(cols[k] - cx); if (!best || d < best.d) best = { k, d }; } return best && best.d <= 70 ? best.k : null; };
  const body = rows.filter((r) => r.y > header.y);
  const numericRow = (r) => r.words.filter((w) => w.x > nameLimit && isNumeric(w)).length >= 3;
  const fragmentRow = (r) => !numericRow(r) && r.words.some((w) => w.x <= nameLimit && !isNumeric(w)) && r.words.every((w) => w.x <= nameLimit || !/[A-Za-z0-9]/.test(w.text));
  const numeric = body.filter(numericRow);
  const claimed = claimFragments(numeric, body.filter(fragmentRow), NAME_GAP);
  const players = [];
  for (const r of numeric) {
    const parts = [...(claimed.get(r) || []), r].sort((a, b) => a.y - b.y);
    // The POS cell ("SF", "Unknown") reaches into the name column when it is wider than its header.
    const fragments = cleanFragments(parts.flatMap((q) => q.words.filter((w) => w.x <= nameLimit && !isNumeric(w) && !/^unknown$/i.test(w.text) && !POS_RE.test(w.text)).map((w) => w.text)));
    const who = resolveName(fragments, roster, team);
    if (!who) continue;
    const cells = {};
    for (const w of r.words) { if (w.x <= nameLimit) continue; const k = colOf(w); if (k && cells[k] == null) cells[k] = w.text; }
    const posText = (cells.pos || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    const pos = POS_RE.test(posText) ? posText : null;
    players.push({ player: who.name, matched: who.matched, team: who.team || null, pos: who.pos || pos, sheetPos: pos, avg: { min: fixMinutes(cells.min), pts: fixAvg(cells.pts), reb: fixAvg(cells.reb), ast: fixAvg(cells.ast), tpm: fixAvg(cells.tpm) } });
  }
  return { players, tiles: parseTiles(words, { below: header.y }), header: true };
}

/** The team most of a column's matched players belong to. */
function teamOfPlayers(players) {
  const count = {};
  for (const p of players) if (p.matched && p.team) count[p.team] = (count[p.team] || 0) + 1;
  const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

/**
 * Every page's two columns → the sheet's rows (mentions: market null, with avg and pos), the
 * games the pages pair, the tiles per team (`meta.oppRanks[team][pos][stat]`, what the team's
 * opponent gives up) and warnings. `schedule` = the slate's [{ away, home }].
 */
export function parseNbaPages(pages, { roster = [], schedule = [] } = {}) {
  const rows = []; const games = []; const warnings = []; const oppRanks = {};
  const otherOf = (team) => { const g = schedule.find((x) => x.away === team || x.home === team); return g ? (g.away === team ? g.home : g.away) : null; };
  for (const p of pages) {
    // First pass names the teams through the roster; the second matches within the team.
    let l = parseColumn(p.left, { roster }); let r = parseColumn(p.right, { roster });
    let left = teamOfPlayers(l.players); let right = teamOfPlayers(r.players);
    if (left && (!right || right === left)) right = otherOf(left);
    else if (right && !left) left = otherOf(right);
    if (left) l = parseColumn(p.left, { roster, team: left });
    if (right) r = parseColumn(p.right, { roster, team: right });
    if (!l.header && !r.header) warnings.push(`Page ${p.page}: no player table read`);
    if (!left && !right) warnings.push(`Page ${p.page}: no team named (no roster player matched)`);
    games.push({ page: p.page, teams: [left, right] });
    for (const [team, col] of [[left, l], [right, r]]) {
      for (const x of col.players) rows.push({ player: x.player, matched: x.matched, team, pos: x.pos, market: null, group: 'players', line: null, side: null, odds: null, underOdds: null, hit: {}, avg: x.avg, mention: true });
      if (team && Object.keys(col.tiles).length) oppRanks[team] = col.tiles;
    }
  }
  const unmatched = [...new Set(rows.filter((x) => !x.matched).map((x) => x.player))];
  if (unmatched.length) warnings.push(`Names not on the roster (kept as read): ${unmatched.slice(0, 12).join(', ')}${unmatched.length > 12 ? '…' : ''}`);
  const seen = new Set();
  const deduped = rows.filter((x) => { const k = `${normName(x.player)}|${x.team}`; if (seen.has(k)) return false; seen.add(k); return true; }).map(({ matched, ...x }) => x);
  const preview = pages.length ? rowsOf(pages[0].left).map(textOf).slice(0, 40) : [];
  return { rows: deduped, games, warnings, preview, meta: { oppRanks } };
}

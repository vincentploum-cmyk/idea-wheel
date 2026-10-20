// The "detailed" NFL cheat sheet (NFL_<season>_W<week>_detailed.pdf): one page a game, one team a
// column, a defense snapshot on top and the player tables under it (Quarterbacks: Line
// (Pass/Rush) and ATD; Running Backs — Standard: Lines (Rush/Rec) and ATD; WR / TE — Standard:
// Rec Line and ATD; then coverage-adjusted, direction and red-zone tables without lines). The
// pages are pictures, so the words come from OCR (lib/picks/ocr.js) with their boxes; this file
// turns one column's words into prop rows: the team from the column's head, each table's
// header giving the line and ATD columns, each player's name from the fragments the layout
// wraps around his numbers, resolved against the slate's roster (OCR misreads "Barner" as
// "Bammer"; the roster says who plays). Book lines always end in .5, so a decimal point OCR
// dropped ("665/95") is put back.
import { teamAbbrFromText, TEAMS } from './teams';
import { normName } from '../nhl-data/names';
import { rowsOf, textOf as text, isNumeric, claimFragments, cleanFragments, resolveName, similarity } from '../picks/ocr-layout';

export { rowsOf, resolveName, similarity };

const NAME_GAP = 26;          // a name fragment sits within this many pixels of its numbers row
const NAME_COL = 0.17;        // the player column is the left sixth of a team column
const SECTION = [
  ['qb', /^quarterbacks?/i],
  ['rb', /^running\s*backs?\s*[—–-]+\s*standard/i],
  ['wr', /^wr\s*\/?\s*te\s*[—–-]+\s*standard/i],
  ['other', /^(running\s*backs?|wr\s*\/?\s*te)\s*[—–-]+/i],
  ['other', /^(players|defense|coverage)/i],
];
const sectionOf = (r) => { const t = text(r); for (const [key, re] of SECTION) if (re.test(t)) return key; return null; };

const codeOf = (word, { direct = false } = {}) => {
  const t = word.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (t.length < 2 || t.length > 4) return null;
  if (TEAMS[t]) return t;
  if (direct) return null;
  const a = teamAbbrFromText(t);
  return a && t !== 'ACT' ? a : null;
};
/** The first team code among a row's words: a current code anywhere on the row before an old alias ("SD" beside "SF"). */
const codeOnRow = (r) => { for (const w of r.words) { const c = codeOf(w.text, { direct: true }); if (c) return c; } for (const w of r.words) { const c = codeOf(w.text); if (c) return c; } return null; };

/**
 * What a column's head says: the team ("SEA 63 players ACT 63") and the defense snapshot's
 * line ("DEN Defense Snapshot (use for evaluating SEA's offensive players)"), which names the
 * opponent first and the team again after "evaluating". The head's code is taken unless it is
 * the opponent's (a misread); otherwise the snapshot's "evaluating" code.
 */
export function headOf(rows) {
  let head = null; let opp = null; let evaluating = null;
  for (const r of rows.slice(0, 8)) {
    const t = text(r);
    if (/snapshot|evaluating/i.test(t)) {
      opp = opp || codeOf(r.words[0]?.text || '');
      const m = t.match(/evaluating\s+([A-Za-z]+)/i);
      if (m) evaluating = evaluating || codeOf(m[1].replace(/s$/, '')) || codeOf(m[1]);
      continue;
    }
    if (!head) head = codeOnRow(r);
  }
  const team = head && head !== opp ? head : evaluating && evaluating !== opp ? evaluating : head || evaluating || null;
  return { team, opp };
}

/** The team a column's head names. */
export function teamOf(rows) {
  return headOf(rows).team;
}

/** "665/95" → [66.5, 9.5]; "202.5/13.5" → [202.5, 13.5]; "—" → [null]; a lone "95" → [9.5]. */
export function parseLines(tokens, ranges) {
  const joined = tokens.map((t) => t.text).join('').replace(/[−–]/g, '-').replace(/\s+/g, '');
  if (!joined || /^[-—_~.:;,]+$/.test(joined)) return ranges.map(() => null);
  const parts = joined.split('/').map((p) => p.replace(/[^\d.]/g, ''));
  return ranges.map((range, i) => fixLine(parts[i], range));
}

/** A book line from an OCR token: the decimal restored (lines end in .5), a stray digit dropped when the value is out of range. */
export function fixLine(raw, [lo, hi]) {
  if (!raw) return null;
  let s = String(raw);
  if (/^\d+\.\d$/.test(s)) { const v = Number(s); return v >= lo && v <= hi ? v : null; }
  s = s.replace(/\./g, '');
  if (!/^\d+$/.test(s)) return null;
  const candidates = [];
  if (s.endsWith('5')) candidates.push(Number(`${s.slice(0, -1) || '0'}.5`));
  candidates.push(Number(s));
  // A digit OCR added in front ("7135" for 13.5): try without the first one, then the first two.
  if (s.length > 2 && s.endsWith('5')) candidates.push(Number(`${s.slice(1, -1) || '0'}.5`));
  if (s.length > 3 && s.endsWith('5')) candidates.push(Number(`${s.slice(2, -1) || '0'}.5`));
  for (const v of candidates) if (Number.isFinite(v) && v >= lo && v <= hi) return v;
  return null;
}

/** An American price from an OCR token: "110" → 110, "-205" → -205, "2200" → 2200; nothing readable → null. */
export function fixPrice(raw) {
  const s = String(raw || '').replace(/[−–]/g, '-').replace(/[^\d-]/g, '');
  if (!/^-?\d{3,4}$/.test(s)) return null;
  const v = Number(s);
  return Math.abs(v) >= 100 ? v : null;
}

const LINE_RANGES = { qb: [[100, 420], [1, 120]], rb: [[5, 200], [1, 90]], wr: [[2, 160]] };
const LINE_MARKETS = { qb: ['pass_yds', 'rush_yds'], rb: ['rush_yds', 'rec_yds'], wr: ['rec_yds'] };

/**
 * One team column's words → prop rows ({ player, team, pos, market, line, side, odds, …} as the
 * cheat-sheet parser makes them) and the team. `roster` = [{ name, team, pos }] for the slate.
 */
export function parseColumn(words, { roster = [], width = 594, team: given = null } = {}) {
  const rows = rowsOf(words);
  const head = headOf(rows);
  const team = given || head.team;
  const nameX = width * NAME_COL;
  const out = [];
  let section = null; let cols = null;
  const numericRow = (r) => r.words.filter((w) => w.x > nameX && isNumeric(w)).length >= 2;
  const hasGlyph = (w) => /[A-Za-z0-9]/.test(w.text);
  // A row of name fragments: nothing numeric, every readable word in the player column.
  const fragmentRow = (r) => !numericRow(r) && !sectionOf(r) && r.words.some((w) => w.x <= nameX * 1.4 && hasGlyph(w) && !isNumeric(w)) && r.words.every((w) => w.x <= nameX * 1.4 || !hasGlyph(w));
  const fragmentsOf = (r) => r.words.filter((w) => w.x <= nameX * 1.4 && !isNumeric(w)).map((w) => w.text);
  // Each table in turn: its header row, then its numeric rows; every fragment row between them
  // belongs to the nearest numeric row (the layout wraps a name around its numbers, so
  // "Wilson" under Emanuel's row and "G" above George's must not be shared).
  let table = null;
  const flush = () => {
    if (!table) return;
    const { cols, numeric, fragments } = table;
    const claimed = claimFragments(numeric, fragments, NAME_GAP * 2);
    for (const r of numeric) {
      const parts = [...(claimed.get(r) || []), { y: r.y, own: true, words: r.words }].sort((a, b) => a.y - b.y);
      const fragments = cleanFragments(parts.flatMap((q) => fragmentsOf(q)));
      const who = resolveName(fragments, roster, team);
      if (!who) continue;
      const lineTokens = cols.line != null ? r.words.filter((w) => w.x >= cols.line && (cols.atd == null || w.x < cols.atd)) : [];
      const atdTokens = cols.atd != null ? r.words.filter((w) => w.x >= cols.atd) : [];
      const lines = parseLines(lineTokens, LINE_RANGES[table.section]);
      const markets = LINE_MARKETS[table.section];
      const pos = who.pos || (table.section === 'qb' ? 'QB' : table.section === 'rb' ? 'RB' : null);
      lines.forEach((line, k) => {
        if (line == null) return;
        out.push({ player: who.name, matched: who.matched, team, pos, market: markets[k], group: markets[k] === 'pass_yds' ? 'passing' : markets[k] === 'rush_yds' ? 'rushing' : 'receiving', line, side: 'over', odds: null, underOdds: null, hit: {}, avg: {}, section: table.section });
      });
      const price = fixPrice(atdTokens.map((w) => w.text).join(''));
      if (price != null) out.push({ player: who.name, matched: who.matched, team, pos, market: 'anytime_td', group: 'touchdowns', line: 0.5, side: 'yes', odds: price, underOdds: null, hit: {}, avg: {}, section: table.section });
    }
    table = null;
  };
  for (const r of rows) {
    const sec = sectionOf(r);
    if (sec) { flush(); section = sec; cols = null; continue; }
    if (!section || section === 'other') continue;
    // The table's header: where the line and ATD columns start.
    if (/^player/i.test(r.words[0]?.text || '') || r.words.some((w) => /^atd$/i.test(w.text))) {
      flush();
      const atd = r.words.find((w) => /^atd$/i.test(w.text));
      const lineWord = r.words.find((w) => /^(line|lines|recline)$/i.test(w.text.replace(/[^a-z]/gi, '')) && (!atd || w.x < atd.x));
      cols = { line: lineWord ? lineWord.x - 12 : null, atd: atd ? atd.x - 12 : null };
      table = { section, cols, numeric: [], fragments: [] };
      continue;
    }
    if (!table) continue;
    if (numericRow(r)) table.numeric.push(r);
    else if (fragmentRow(r)) table.fragments.push(r);
  }
  flush();
  // One row per player and market (the QB's rush line also shows in the RB table).
  const seen = new Set();
  return { team, opp: head.opp, rows: out.filter((x) => { const k = `${normName(x.player)}|${x.market}`; if (seen.has(k)) return false; seen.add(k); return true; }) };
}

/**
 * The two columns' teams: each column's snapshot names the other's team when a head misread,
 * and the slate's games (`[{ away, home }]`) settle a pair one side of which is on the schedule.
 */
export function pairTeams(l, r, games = []) {
  let left = l.team; let right = r.team;
  if ((!left || left === right) && r.opp && r.opp !== right) left = r.opp;
  if ((!right || right === left) && l.opp && l.opp !== left) right = l.opp;
  const otherOf = (team) => { const g = games.find((x) => x.away === team || x.home === team); return g ? (g.away === team ? g.home : g.away) : null; };
  const paired = games.some((g) => (g.away === left && g.home === right) || (g.away === right && g.home === left));
  if (!paired && games.length) {
    // The column whose head and snapshot agree is the one to trust.
    const leftSure = left && left === r.opp; const rightSure = right && right === l.opp;
    if (leftSure && otherOf(left)) right = otherOf(left);
    else if (rightSure && otherOf(right)) left = otherOf(right);
    else if (otherOf(left)) right = otherOf(left);
    else if (otherOf(right)) left = otherOf(right);
  }
  return [left, right];
}

/** Every page's two columns → the sheet's rows, with the games the pages pair (`schedule` = the slate's [{ away, home }]). */
export function parseDetailedPages(pages, { roster = [], schedule = [] } = {}) {
  const rows = []; const games = []; const warnings = [];
  for (const p of pages) {
    let l = parseColumn(p.left, { roster, width: p.half });
    let r = parseColumn(p.right, { roster, width: p.width - p.half });
    const [left, right] = pairTeams(l, r, schedule);
    if (left !== l.team) l = parseColumn(p.left, { roster, width: p.half, team: left });
    if (right !== r.team) r = parseColumn(p.right, { roster, width: p.width - p.half, team: right });
    if (!left && !right) warnings.push(`Page ${p.page}: no team head read`);
    games.push({ page: p.page, teams: [left, right] });
    rows.push(...l.rows, ...r.rows);
  }
  const unmatched = [...new Set(rows.filter((x) => !x.matched).map((x) => x.player))];
  if (unmatched.length) warnings.push(`Names not on the roster (kept as read): ${unmatched.slice(0, 12).join(', ')}${unmatched.length > 12 ? '…' : ''}`);
  // The first page's left column as text lines, so the read can be checked under Data sources.
  const preview = pages.length ? rowsOf(pages[0].left).map(text).slice(0, 40) : [];
  return { rows: rows.map(({ matched, section, ...x }) => x), games, warnings, preview };
}

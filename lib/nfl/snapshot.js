// The detailed cheat sheet's defense snapshot (Vincent, 2026-11-01: "the cheat sheet should be used to identify
// weaknesses in defenses"). Each team column of NFL_<season>_W<week>_detailed.pdf opens with the opponent's defense
// ("DEN Defense Snapshot (use for evaluating SEA's offensive players)"): its coverage shells (Man% / Zone%, Cover 3 /
// 1 / 4 / 2 / 6 / 0 / 2-Man, each a share of its snaps) and ranked tiles (Pass Yds/G, Rush Yds/G, Rush Y/Play, and the
// passing field in six zones, Short L / M / R over Long L / M / R, each "#N" of 32). This file reads them from the
// column's OCR words (`parseSnapshot`) and turns them into what the board reads (`sheetDefense`): the tiles in the
// site's own convention (1 = gives up the most), placed on the positions and depth-chart slots of the defense's
// opponent (`meta.oppRanks`, which lib/picks/board.js puts beside PropFinder's cells and blends into every yards
// projection, matchupOf), and the defense's weak and strong spots in words.
//
// Which way the sheet ranks is not printed. A defense ranks #1 in a stat when it allows the fewest ("the 31st pass
// defense" is a bad one) by the usual NFL reading, and that is the default (`SHEET_RANK_DEFAULT`); when PropFinder's
// tables are in the pull the board checks it: the sheet's pass and rush yards ranks against PropFinder's (rank 1 = the
// most allowed) across the slate's defenses, a clear negative correlation confirming "fewest", a clear positive one
// flipping to "most" (`rankDirection`).
import { rowsOf, textOf } from '../picks/ocr-layout';

export const TEAMS_N = 32;
export const SHEET_RANK_DEFAULT = 'fewest';   // the sheet's #1 = the defense allowing the fewest
export const DIRECTION_MIN = 6;               // defenses with both ranks before the slate's own read decides
export const DIRECTION_RHO = 0.2;             // |correlation| it takes to decide
export const WEAK_THIRD = Math.ceil(TEAMS_N / 3);   // 1–11 after conversion: among the most allowed

const pctOf = (raw) => {
  // The sheet prints one decimal ("35.8%"); OCR drops the point ("145%" = 14.5%, "13%" = 1.3%).
  const s = String(raw || '').replace(/[^\d.]/g, '');
  if (!s) return null;
  if (s.includes('.')) { const v = Number(s); return Number.isFinite(v) && v <= 100 ? v : null; }
  const v = Number(`${s.slice(0, -1) || '0'}.${s.slice(-1)}`);
  return Number.isFinite(v) && v <= 100 ? v : null;
};
const rankOf = (raw) => { const m = String(raw || '').match(/#\s*(\d{1,2})/); const v = m ? Number(m[1]) : null; return v >= 1 && v <= TEAMS_N ? v : null; };
const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** A coverage label as OCR reads it ("COVER 3", "COVERO", "COVERG6", "2MAN", "Man%", "Zone%") → its key, or null. */
export function shellOf(label) {
  const s = squash(label);
  if (!s) return null;
  if (/^man$/.test(s)) return 'man';
  if (/^zone$/.test(s)) return 'zone';
  if (/^2?man$/.test(s) || /^2man/.test(s)) return 'twoMan';
  const m = s.match(/^cover[a-z]*([0-9o])$/);
  if (m) return `c${m[1] === 'o' ? 0 : m[1]}`;
  return null;
}

/** A ranked tile's label → 'passYds' | 'rushYds' | 'rushYpp' | 'short' | 'long' (with a side l / m / r when it reads), or null. */
export function tileOf(label) {
  const s = squash(label);
  if (!s) return null;
  if (s.includes('pass')) return { key: 'passYds' };
  if (s.includes('rush') && /play|ypp|yp$/.test(s)) return { key: 'rushYpp' };
  if (s.includes('rush')) return { key: 'rushYds' };
  const zone = /^sh/.test(s) ? 'short' : /^lo/.test(s) ? 'long' : null;
  if (!zone) return null;
  const rest = s.slice(zone === 'short' ? 3 : 2);
  const side = /m/.test(rest) ? 'm' : /l$/.test(rest) ? 'l' : /r$/.test(rest) ? 'r' : null;
  return { key: zone, side };
}

/**
 * The snapshot from a column's OCR words ([{ text, x, x1, y, y1 }], page pixels): { of (the defense's code as the head
 * reads it), coverage: { man, zone, c0 … c6, twoMan, sum }, ranks: { passYds, rushYds, rushYpp, short: { l, m, r },
 * long: { l, m, r } } as printed (the sheet's #N), tiles (how many ranks read) } or null when the column has none.
 */
export function parseSnapshot(words, { codeOf = () => null } = {}) {
  const rows = rowsOf(words || []);
  const start = rows.findIndex((r) => /snapshot|evaluating/i.test(textOf(r)));
  if (start < 0) return null;
  let end = rows.findIndex((r, i) => i > start && /^(players|quarterbacks?)\b/i.test(textOf(r).trim()));
  if (end < 0) end = Math.min(rows.length, start + 30);
  const of = codeOf(rows[start].words[0]?.text || '');
  const block = rows.slice(start + 1, end);
  // Coverage: each row's label words then a percentage; a row can carry two pairs (Man% 30.3% COVER 3 35.8%).
  const coverage = {};
  for (const r of block) {
    let label = [];
    for (const w of r.words) {
      const t = w.text.trim();
      if (/^\d[\d.]*%$/.test(t)) {
        const key = shellOf(label.join(''));
        const v = pctOf(t);
        if (key && v != null && coverage[key] == null) coverage[key] = v;
        label = [];
      } else if (/%$/.test(t) && shellOf(t.replace(/%$/, ''))) {
        label = [t.replace(/%$/, '')];
      } else label.push(t);
    }
  }
  const shells = ['c0', 'c1', 'c2', 'c3', 'c4', 'c6', 'twoMan'].filter((k) => coverage[k] != null);
  const sumOf = () => Math.round(shells.reduce((s, k) => s + coverage[k], 0) * 10) / 10;
  if (shells.length) {
    coverage.sum = sumOf();
    // The shells add up to 100%: one OCR read a digit too many on ("438%" for 4.8% or 4.38) when a tenth of it closes the gap.
    if (shells.length >= 5 && Math.abs(coverage.sum - 100) > 3) {
      const fix = shells.find((k) => Math.abs(coverage.sum - coverage[k] * 0.9 - 100) <= 3);
      if (fix) { coverage[fix] = Math.round(coverage[fix]) / 10; coverage.sum = sumOf(); coverage.repaired = fix; }
    }
  }
  // The ranked tiles: every "#N" with the words just left of it on its row (or a row a few pixels off) as its label.
  const tokens = block.flatMap((r) => r.words.map((w) => ({ ...w, row: r.y })));
  const marks = tokens.filter((w) => rankOf(w.text) != null && /#/.test(w.text));
  const ranks = { passYds: null, rushYds: null, rushYpp: null, short: { l: null, m: null, r: null }, long: { l: null, m: null, r: null } };
  const zones = [];
  for (const m of marks) {
    const near = tokens.filter((w) => w !== m && Math.abs(w.row - m.row) <= 14 && w.x1 <= m.x + 4 && !/#/.test(w.text));
    const prev = marks.filter((x) => x !== m && Math.abs(x.row - m.row) <= 14 && x.x1 <= m.x).sort((a, b) => b.x1 - a.x1)[0];
    const label = near.filter((w) => !prev || w.x >= prev.x1).sort((a, b) => a.x - b.x).map((w) => w.text).join('');
    const tile = tileOf(label);
    const v = rankOf(m.text);
    if (!tile) { zones.push({ m, v, side: null, zone: null }); continue; }
    if (tile.key === 'short' || tile.key === 'long') zones.push({ m, v, side: tile.side, zone: tile.key });
    else if (ranks[tile.key] == null) ranks[tile.key] = v;
  }
  // The field's six zones by place where a label misread: two rows (short above long), left to right.
  const fieldRows = [];
  for (const z of zones) {
    const r = fieldRows.find((x) => Math.abs(x.y - z.m.row) <= 14);
    if (r) r.items.push(z); else fieldRows.push({ y: z.m.row, items: [z] });
  }
  fieldRows.sort((a, b) => a.y - b.y);
  fieldRows.forEach((fr, i) => {
    const zone = fr.items.find((x) => x.zone)?.zone || (i === 0 ? 'short' : i === 1 ? 'long' : null);
    if (!zone) return;
    const items = fr.items.sort((a, b) => a.m.x - b.m.x);
    items.forEach((z, j) => {
      const side = z.side || (items.length === 3 ? ['l', 'm', 'r'][j] : null);
      if (side && ranks[zone][side] == null) ranks[zone][side] = z.v;
    });
  });
  const tiles = ['passYds', 'rushYds', 'rushYpp'].filter((k) => ranks[k] != null).length + ['short', 'long'].reduce((s, z) => s + Object.values(ranks[z]).filter((v) => v != null).length, 0);
  if (!tiles && !shells.length && coverage.man == null) return null;
  return { of, coverage, ranks, tiles };
}

/** Spearman's correlation of two equal-length lists. */
function spearman(a, b) {
  const rank = (xs) => { const order = xs.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = []; order.forEach(([, i], k) => { r[i] = k + 1; }); return r; };
  const ra = rank(a); const rb = rank(b); const n = a.length;
  const d2 = ra.reduce((s, x, i) => s + (x - rb[i]) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

/**
 * Which way the slate's sheets rank: { convention: 'fewest' | 'most', from: 'propfinder' | 'default', rho, n } —
 * the sheets' pass and rush yards ranks against PropFinder's (rank 1 = the most allowed: the QBs' pass yards, the backs'
 * rush yards) over the defenses that have both.
 */
export function rankDirection(snapshots, pfDefense) {
  const a = []; const b = [];
  for (const s of snapshots) {
    const pfr = pfDefense?.ranks?.[s.of];
    if (!pfr) continue;
    if (s.ranks.passYds != null && pfr.QB?.passYds != null) { a.push(s.ranks.passYds); b.push(pfr.QB.passYds); }
    if (s.ranks.rushYds != null && pfr.RB?.rushYds != null) { a.push(s.ranks.rushYds); b.push(pfr.RB.rushYds); }
  }
  if (a.length >= DIRECTION_MIN) {
    const rho = Math.round(spearman(a, b) * 100) / 100;
    if (rho <= -DIRECTION_RHO) return { convention: 'fewest', from: 'propfinder', rho, n: a.length };
    if (rho >= DIRECTION_RHO) return { convention: 'most', from: 'propfinder', rho, n: a.length };
    return { convention: SHEET_RANK_DEFAULT, from: 'default', rho, n: a.length };
  }
  return { convention: SHEET_RANK_DEFAULT, from: 'default', rho: null, n: a.length };
}

const mean = (xs) => { const v = xs.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const round = (v) => (v == null ? null : Math.min(TEAMS_N, Math.max(1, Math.round(v))));

/** The snapshot's ranks in the site's convention (1 = gives up the most): { passYds, rushYds, rushYpp, short, long, run, outside, middle }. */
export function convertRanks(ranks, convention = SHEET_RANK_DEFAULT) {
  const c = (v) => (v == null ? null : convention === 'fewest' ? TEAMS_N + 1 - v : v);
  const short = { l: c(ranks.short.l), m: c(ranks.short.m), r: c(ranks.short.r) };
  const long = { l: c(ranks.long.l), m: c(ranks.long.m), r: c(ranks.long.r) };
  return {
    passYds: c(ranks.passYds), rushYds: c(ranks.rushYds), rushYpp: c(ranks.rushYpp), short, long,
    run: round(mean([c(ranks.rushYds), c(ranks.rushYpp)])),
    outside: round(mean([short.l, short.r, long.l, long.r])),
    middle: round(mean([short.m, long.m])),
    underneath: round(mean([short.l, short.m, short.r])),
  };
}

/**
 * The tiles placed on the positions and depth-chart slots of the offense facing the defense (the board's allowed-table
 * keys: passYds, rushYds, recYds): the quarterback on the pass and the run, the backs on the run (their catches on the
 * short zones), the receivers on the pass with the outside zones for WR1 / WR2, the middle for the slot (WR3) and the
 * tight end. A zone read blends half and half with the pass rank.
 */
export function oppRanksOf(conv) {
  const blend = (a, b) => (a == null ? b : b == null ? a : round((a + b) / 2));
  const P = conv.passYds; const R = conv.run;
  const out = {
    QB: { passYds: P, rushYds: R },
    RB: { rushYds: R, recYds: blend(P, conv.underneath) }, RB1: { rushYds: R, recYds: blend(P, conv.underneath) }, RB2: { rushYds: R, recYds: blend(P, conv.underneath) },
    WR: { recYds: P }, WR1: { recYds: blend(P, conv.outside) }, WR2: { recYds: blend(P, conv.outside) }, WR3: { recYds: blend(P, conv.middle) },
    TE: { recYds: blend(P, conv.middle) }, TE1: { recYds: blend(P, conv.middle) },
  };
  for (const [pos, cells] of Object.entries(out)) { for (const k of Object.keys(cells)) if (cells[k] == null) delete cells[k]; if (!Object.keys(cells).length) delete out[pos]; }
  return out;
}

const ZONE_WORD = { l: 'left', m: 'middle', r: 'right' };
/**
 * A defense's weak and strong spots in words, from its converted ranks: [{ key, word, rank }] for the ranks in the third
 * that gives up the most (`weak`) and the third that gives up the least (`strong`), the weakest first; and its coverage
 * in words (man- or zone-heavy, its main shell).
 */
export function spotsOf(conv, coverage = {}) {
  const items = [
    ['passYds', 'the pass', conv.passYds], ['rushYds', 'the run', conv.rushYds], ['rushYpp', 'yards per carry', conv.rushYpp],
    ...['l', 'm', 'r'].map((s) => [`short${s.toUpperCase()}`, `short ${ZONE_WORD[s]}`, conv.short[s]]),
    ...['l', 'm', 'r'].map((s) => [`long${s.toUpperCase()}`, `deep ${ZONE_WORD[s]}`, conv.long[s]]),
  ].filter(([, , r]) => r != null).map(([key, word, rank]) => ({ key, word, rank }));
  const weak = items.filter((x) => x.rank <= WEAK_THIRD).sort((a, b) => a.rank - b.rank);
  const strong = items.filter((x) => x.rank > TEAMS_N - WEAK_THIRD).sort((a, b) => b.rank - a.rank);
  const shells = ['c0', 'c1', 'c2', 'c3', 'c4', 'c6', 'twoMan'].filter((k) => coverage[k] != null).sort((a, b) => coverage[b] - coverage[a]);
  const SHELL_WORD = { c0: 'Cover 0', c1: 'Cover 1', c2: 'Cover 2', c3: 'Cover 3', c4: 'Cover 4', c6: 'Cover 6', twoMan: '2-Man' };
  const style = [];
  if (coverage.man != null && coverage.man >= 35) style.push(`man-heavy (${coverage.man}% man)`);
  else if (coverage.zone != null && coverage.zone >= 75) style.push(`zone-heavy (${coverage.zone}% zone)`);
  if (shells.length) style.push(`${SHELL_WORD[shells[0]]} ${coverage[shells[0]]}%`);
  return { weak, strong, style };
}

/**
 * The slate's sheets read for the board: every detailed sheet's snapshots (`meta.defense`, keyed by the offense's team,
 * each naming the defense as `of`) converted and placed (`meta.oppRanks`, `meta.oppCount`), and the defenses in words.
 * → { sheets (each with the board's meta), defense: { direction, teams: { DEF: { for, file, weak, strong, style, ranks,
 * printed, coverage } } } }; sheets without a snapshot pass through unchanged.
 */
export function sheetDefense(sheets, pfDefense = null) {
  const snaps = [];
  for (const s of sheets || []) for (const [team, snap] of Object.entries(s.meta?.defense || {})) if (snap) snaps.push({ ...snap, for: team, file: s.fileName || null });
  if (!snaps.length) return { sheets: sheets || [], defense: null };
  const direction = rankDirection(snaps, pfDefense);
  const teams = {};
  for (const s of snaps) {
    if (!s.of || teams[s.of]) continue;
    const conv = convertRanks(s.ranks, direction.convention);
    teams[s.of] = { of: s.of, for: s.for, file: s.file, ranks: conv, printed: s.ranks, coverage: s.coverage || {}, ...spotsOf(conv, s.coverage || {}) };
  }
  const out = (sheets || []).map((s) => {
    const def = s.meta?.defense;
    if (!def) return s;
    const oppRanks = { ...(s.meta.oppRanks || {}) };
    for (const [team, snap] of Object.entries(def)) if (snap?.ranks) oppRanks[team] = oppRanksOf(convertRanks(snap.ranks, direction.convention));
    return { ...s, meta: { ...s.meta, oppRanks, oppCount: TEAMS_N } };
  });
  return { sheets: out, defense: { direction, teams } };
}

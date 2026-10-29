// The cheat sheets Vincent uploads by hand (CSV, TSV or Excel; any column order), read into one
// row per prop: { player, team, opp, venue, pos, market, group, line, side, odds, underOdds, book,
// hit: { l5, l10, l15, l20, season, h2h, all }, avg: { l5, l10, season }, proj, edge, rating }.
// Pure parsing only; the store keeps the result.
//
// Two layouts are read. Long: one row per prop with a market / prop / stat column ("Receiving
// Yards", "Points"), the line, the side and the price. Wide: one row per player with a column per
// market holding the line ("Rec Yds", "PTS"), optional "<market> odds" and "<market> hit %"
// columns beside it. A sheet (or file) named after a market supplies the market for rows that
// carry none. Each sport binds its markets, positions and team spellings.
//
// A wide market column that does not hold book lines holds his averages: a line ends in .5 (the
// NFL detailed sheet's `fixLine` rests on the same rule), an average reads 3.4 or 5. Such a column
// makes no play (2026-10-29: an NBA sheet's Name · POS · MIN · PTS · REB · AST · 3PM table of season
// averages read as lines put "Watson o3.4 Points" on the board); the row becomes a mention (market
// null, group `players`, `avg` keyed by stat, `mention: true`, the OCR sheets' shape), which the
// board reads for the player's season average, his minutes and the confirmation tick.
import * as XLSX from 'xlsx';
import { splitCsvLine } from '../nhl-data/propfinder-csv';
import { parseOdds, parseRate, parseNumber } from '../nfl/odds';

// Column roles, by header text. Order matters where a header could read two ways.
const ROLES = [
  ['player', /^(player|player ?name|name|athlete|skater|who)$/i],
  ['team', /^(team|tm|club)$/i],
  ['opp', /^(opp|opponent|vs|versus|against|opp\.?|matchup|match ?up|game|opponent team)$/i],
  ['pos', /^(pos|position|pos\.)$/i],
  ['market', /^(market|markets|prop|props|stat|stats|bet|bet ?type|prop ?type|market ?name|category|type|stat ?type|wager)$/i],
  ['line', /^(line|number|o\/u|ou|total|handicap|threshold|prop ?line|line ?value|value|strike)$/i],
  ['side', /^(side|pick|bet ?side|over\/under|o\/u ?pick|selection|direction|position ?side|ou ?side|play)$/i],
  ['underOdds', /^(under ?odds|under ?price|under ?juice|u ?odds|under)$/i],
  ['odds', /^(odds|price|over ?odds|over ?price|american|american ?odds|juice|best ?odds|over|o ?odds|current ?odds|book ?odds|dk ?odds|fd ?odds|implied ?odds)$/i],
  ['book', /^(book|sportsbook|bookmaker|site|source)$/i],
  ['proj', /^(proj|projection|projected|model|expected|predicted|mean|avg ?proj|proj\.?)$/i],
  ['edge', /^(edge|ev|value|diff|delta|edge ?%|expected ?value)$/i],
  ['rating', /^(rating|grade|confidence|conf|stars|tier|rank|score|units|strength)$/i],
  ['home', /^(home|home\/away|venue|h\/a|site)$/i],
  ['kickoff', /^(kickoff|tipoff|tip ?off|time|date|game ?time|start)$/i],
  ['streak', /^(streak|current ?streak|run)$/i],
  ['minutes', /^(min|mins|minutes|mpg|avg ?min|min\/g)$/i],
];

const WINDOWS = [
  ['l5', /\b(l ?5|last ?5|last ?five|5 ?g)\b/i],
  ['l10', /\b(l ?10|last ?10|last ?ten|10 ?g)\b/i],
  ['l15', /\b(l ?15|last ?15)\b/i],
  ['l20', /\b(l ?20|last ?20)\b/i],
  ['h2h', /\b(h ?2 ?h|head ?to ?head|vs ?opp|vs ?opponent)\b/i],
  ['season', /\b(season|szn|ytd|this ?year|year|20\d{2}|'?\d{2}-'?\d{2}|full)\b/i],
];

const clean = (h) => String(h ?? '').replace(/[ ]/g, ' ').replace(/\s+/g, ' ').trim();
const isRateHeader = (h) => /\b(hit|rate|%|pct|cover|over ?rate|win|hr)\b/i.test(h) || /%/.test(h);
const isAvgHeader = (h) => /\b(avg|average|mean|per ?game|ppg|ypg)\b/i.test(h);
const windowOf = (h) => { for (const [w, re] of WINDOWS) if (re.test(h)) return w; return null; };

/** "over" / "o" / "yes" / "under" / "u" / "no" → 'over' | 'under' | 'yes' | 'no' | null. */
export function parseSide(v) {
  const s = clean(v).toLowerCase();
  if (!s) return null;
  if (/^(o|over|ov|more|\+)$/.test(s) || /^o\s*\d/.test(s)) return 'over';
  if (/^(u|under|un|less|-)$/.test(s) || /^u\s*\d/.test(s)) return 'under';
  if (/^(y|yes|to score|scorer|to record)$/.test(s)) return 'yes';
  if (/^(n|no)$/.test(s)) return 'no';
  return null;
}

/** The rows of every table in a file: CSV / TSV text or an Excel workbook → [{ sheet, rows: [[…]] }]. */
export function tablesOf({ buffer, text, fileName }) {
  const name = String(fileName || '');
  if (/\.xlsx?$|\.xlsm$/i.test(name) || (buffer && buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    return wb.SheetNames.map((sheet) => ({ sheet, rows: XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: '' }) }));
  }
  const src = text != null ? String(text) : Buffer.from(buffer || []).toString('utf8');
  const lines = src.replace(/^﻿/, '').replace(/\r/g, '').split('\n');
  const tab = lines.slice(0, 5).some((l) => l.includes('\t'));
  const rows = lines.map((l) => (tab ? l.split('\t').map((c) => c.trim()) : splitCsvLine(l)));
  return [{ sheet: null, rows }];
}

/** Rows by group, for a sheet's index entry. */
export function countByGroup(rows) {
  const out = {};
  for (const r of rows) out[r.group] = (out[r.group] || 0) + 1;
  return out;
}

const num = (v) => parseNumber(v);

/**
 * The parser for one sport: { markets (makeMarkets), positions (a Set of position codes a player
 * cell may end with), teamAbbrFromText, parseMatchup, nameNoise (a regex of file-name words that
 * are not a market) }.
 */
export function makeCheatSheetParser({ markets, positions, teamAbbrFromText, parseMatchup, nameNoise = /cheat ?sheet|sheet|props?|wk ?\d+|week ?\d+|20\d{2}[-_]?\d{2}[-_]?\d{2}/gi }) {
  const { marketFromText, groupOf, MARKETS, defaultLine, defenseKey } = markets;
  /** A book's line for an over / under market ends in .5; anything else in a market column is an average. */
  const isLine = (v) => v != null && Math.abs(v % 1) === 0.5;

  /** What a header cell means: { role } for a plain column, { role: 'hit', window }, { role: 'avg', window }, { role: 'wide', market, part }. */
  function classifyHeader(raw) {
    const h = clean(raw);
    if (!h) return null;
    for (const [role, re] of ROLES) if (re.test(h)) return { role };
    const w = windowOf(h);
    const market = marketFromText(h);
    if (!market) {
      if (w && (isRateHeader(h) || /^(l ?5|l ?10|l ?15|l ?20|h ?2 ?h|last ?\d+)$/i.test(h))) return { role: 'hit', window: w };
      if (w && isAvgHeader(h)) return { role: 'avg', window: w };
      if (isRateHeader(h)) return { role: 'hit', window: 'all' };
    }
    if (market) {
      if (/\b(odds|price|juice)\b/i.test(h)) return { role: 'wide', market, part: /under/i.test(h) ? 'underOdds' : 'odds' };
      if (isRateHeader(h)) return { role: 'wide', market, part: 'hit', window: w || 'all' };
      if (isAvgHeader(h)) return { role: 'wide', market, part: 'avg', window: w || 'season' };
      return { role: 'wide', market, part: 'line' };
    }
    if (w) return { role: 'hit', window: w };
    return null;
  }

  /** "Josh Allen QB", "Josh Allen (BUF)", "Josh Allen - BUF - QB" → { name, pos, team }. */
  function parsePlayerCell(cell) {
    let s = clean(cell);
    let pos = null; let team = null;
    const paren = s.match(/\(([^)]+)\)\s*$/);
    if (paren) {
      const inner = paren[1].split(/[\s,/-]+/).filter(Boolean);
      for (const tok of inner) { const t = tok.toUpperCase(); if (positions.has(t)) pos = t; else if (teamAbbrFromText(t)) team = teamAbbrFromText(t); }
      s = s.slice(0, paren.index).trim();
    }
    const parts = s.split(/\s*[|,]\s*|\s+[-–]\s+|\s+/).filter(Boolean);
    while (parts.length > 1) {
      const t = parts[parts.length - 1].toUpperCase();
      if (positions.has(t)) { pos = pos || t; parts.pop(); continue; }
      if (/^[A-Z]{2,4}$/.test(t) && teamAbbrFromText(t) && parts.length > 2) { team = team || teamAbbrFromText(t); parts.pop(); continue; }
      break;
    }
    return { name: parts.join(' ').replace(/\s+/g, ' ').trim(), pos, team };
  }

  /** The header row of a table: the first row with a player column and at least one other known column. */
  function findHeader(rows) {
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const cells = (rows[i] || []).map(classifyHeader);
      const roles = cells.filter(Boolean);
      if (roles.some((c) => c.role === 'player') && roles.length >= 2) return i;
    }
    return -1;
  }

  /**
   * Every prop row in a cheat sheet: { rows, warnings, sheets: [{ name, rows, market, layout }] }.
   * `tables` (from a PDF's pages) stand in for the file; a page without a header row of its own
   * reads under the last page's header, the way a printed table runs on.
   */
  function parseCheatSheet({ buffer, text, fileName, tables = null }, defaults = {}) {
    const fileMarket = marketFromText(String(fileName || '').replace(/\.[a-z]+$/i, '').replace(nameNoise, ' ')) || defaults.market || null;
    const out = []; const warnings = []; const sheets = [];
    let carried = null; // the previous page's header row, for a PDF whose table runs on
    for (const { sheet, rows: pageRows } of tables || tablesOf({ buffer, text, fileName })) {
      let rows = pageRows;
      let h = findHeader(rows);
      // A page whose header is missing or sits below rows that run on from the page before reads under that header.
      if (h !== 0 && carried && tables) { rows = [carried, ...pageRows]; h = 0; }
      if (h < 0) { if (rows.some((r) => r.some((c) => clean(c)))) warnings.push(`${sheet ? `Sheet "${sheet}"` : 'The file'}: no header row with a Player column`); continue; }
      if (tables) carried = rows[h];
      const sheetMarket = (sheet && !/^page \d+$/i.test(sheet) && marketFromText(sheet)) || fileMarket;
      const head = rows[h].map(classifyHeader);
      const col = (role) => head.findIndex((c) => c && c.role === role);
      const cols = { player: col('player'), team: col('team'), opp: col('opp'), pos: col('pos'), market: col('market'), line: col('line'), side: col('side'), odds: col('odds'), underOdds: col('underOdds'), book: col('book'), proj: col('proj'), edge: col('edge'), rating: col('rating'), home: col('home'), streak: col('streak'), minutes: col('minutes') };
      const hitCols = head.map((c, i) => (c && c.role === 'hit' ? [c.window, i] : null)).filter(Boolean);
      const avgCols = head.map((c, i) => (c && c.role === 'avg' ? [c.window, i] : null)).filter(Boolean);
      const wide = {};
      head.forEach((c, i) => { if (c && c.role === 'wide') { wide[c.market] = wide[c.market] || {}; if (c.part === 'hit') (wide[c.market].hit = wide[c.market].hit || {})[c.window] = i; else if (c.part === 'avg') (wide[c.market].avg = wide[c.market].avg || {})[c.window] = i; else wide[c.market][c.part] = i; } });
      // A market column whose numbers are not lines holds his averages for the stat: a column of lines is .5
      // throughout, a column of averages lands on a .5 one time in ten; under 60% on the .5 reads as averages.
      const avgMarkets = [];
      for (const k of Object.keys(wide)) {
        if (wide[k].line == null || MARKETS[k].yesNo) continue;
        const vals = rows.slice(h + 1).map((r) => num(r?.[wide[k].line])).filter((v) => v != null);
        if (vals.length && vals.filter(isLine).length < vals.length * 0.6) { avgMarkets.push(k); (wide[k].avg = wide[k].avg || {}).season = wide[k].line; delete wide[k].line; }
      }
      const wideMarkets = Object.keys(wide).filter((k) => wide[k].line != null);
      // Long: a market column, or a line column (the market from the sheet / file name), or a sheet named after a market with no market-named columns.
      const isLong = cols.market >= 0 || (cols.line >= 0 && (sheetMarket || (wideMarkets.length === 0 && avgMarkets.length === 0))) || (!!sheetMarket && wideMarkets.length === 0 && avgMarkets.length === 0);
      if (!isLong && !wideMarkets.length && !avgMarkets.length) { warnings.push(`${sheet ? `Sheet "${sheet}"` : 'The file'}: no market column, no line column and no market-named columns`); continue; }
      if (avgMarkets.length) warnings.push(`${sheet ? `Sheet "${sheet}"` : 'The file'}: ${avgMarkets.map((k) => MARKETS[k].label).join(', ')} read as season averages, not lines (the numbers do not end in .5)`);
      let count = 0;
      for (let r = h + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const cell = (i) => (i >= 0 && i < row.length ? row[i] : '');
        const who = parsePlayerCell(cell(cols.player));
        if (!who.name || /^(total|avg|average|player|name)$/i.test(who.name)) continue;
        const base = {
          player: who.name,
          team: teamAbbrFromText(cell(cols.team)) || who.team || null,
          pos: (clean(cell(cols.pos)).toUpperCase() || who.pos || null) || null,
          proj: num(cell(cols.proj)), edge: num(cell(cols.edge)), rating: clean(cell(cols.rating)) || null, book: clean(cell(cols.book)) || null,
          streak: clean(cell(cols.streak)) || null, sheet: sheet || null, file: fileName || null,
        };
        if (base.pos && !positions.has(base.pos)) base.pos = base.pos.split(/[\s/,-]/)[0].slice(0, 2) || null;
        // The opponent and the venue: "@ KC" / "vs KC" / "DAL @ PHI", or a home / away column.
        const oppCell = clean(cell(cols.opp));
        const mu = parseMatchup(oppCell, base.team);
        if (mu) { base.opp = mu.away === base.team ? mu.home : mu.away; base.venue = mu.home === base.team ? 'H' : 'A'; if (!base.team) { base.opp = mu.home; base.venue = null; } }
        else { base.opp = teamAbbrFromText(oppCell) || null; base.venue = null; }
        const homeCell = clean(cell(cols.home)).toLowerCase();
        if (!base.venue && homeCell) base.venue = /^(h|home|vs)/.test(homeCell) ? 'H' : /^(a|away|@|at|road)/.test(homeCell) ? 'A' : null;
        const hit = {}; for (const [w, i] of hitCols) { const p = parseRate(cell(i)); if (p) { hit[w] = p.rate; if (p.n) hit[`${w}N`] = p.n; } }
        const avg = {}; for (const [w, i] of avgCols) { const v = num(cell(i)); if (v != null) avg[w] = v; }
        if (isLong) {
          const marketText = cols.market >= 0 ? clean(cell(cols.market)) : '';
          const market = marketFromText(marketText) || sheetMarket;
          let side = parseSide(cell(cols.side)) || parseSide(marketText.split(/\s+/)[0]) || null;
          if (!market) { warnings.push(`${sheet ? `Sheet "${sheet}" row ${r + 1}` : `Row ${r + 1}`}: unknown market "${marketText}"`); continue; }
          // "Over 245.5 Passing Yards" in the market cell carries the line too.
          let line = num(cell(cols.line));
          if (line == null) { const m = marketText.match(/(?:^|\s)[ou]?\s*(\d+(?:\.\d+)?)/i); if (m) line = Number(m[1]); }
          const yesNo = !!MARKETS[market].yesNo;
          if (line == null && yesNo) line = defaultLine(market);
          if (line == null) { warnings.push(`${sheet ? `Sheet "${sheet}" row ${r + 1}` : `Row ${r + 1}`}: ${who.name} ${MARKETS[market].label} has no line`); continue; }
          if (!side) side = yesNo ? 'yes' : 'over';
          if (yesNo && side === 'over') side = 'yes';
          out.push({ ...base, market, group: groupOf(market), line, side, odds: parseOdds(cell(cols.odds)), underOdds: parseOdds(cell(cols.underOdds)), hit, avg });
          count++;
        } else {
          // His averages from the sheet (a market column of averages, a MIN column): a mention row, the OCR sheets' shape.
          const mentionAvg = {};
          const minutes = num(cell(cols.minutes));
          if (minutes != null) mentionAvg.min = minutes;
          for (const market of avgMarkets) { const v = num(cell(wide[market].avg.season)); const stat = defenseKey(market); if (v != null && stat) mentionAvg[stat] = v; }
          if (Object.keys(mentionAvg).length) { out.push({ ...base, market: null, group: 'players', line: null, side: null, odds: null, underOdds: null, hit: {}, avg: mentionAvg, mention: true }); count++; }
          for (const market of wideMarkets) {
            const w = wide[market];
            const line = num(cell(w.line));
            if (line == null) continue;
            const yesNo = !!MARKETS[market].yesNo;
            const mh = { ...hit }; for (const [win, i] of Object.entries(w.hit || {})) { const p = parseRate(cell(i)); if (p) mh[win] = p.rate; }
            const ma = { ...avg }; for (const [win, i] of Object.entries(w.avg || {})) { const v = num(cell(i)); if (v != null) ma[win] = v; }
            out.push({ ...base, market, group: groupOf(market), line, side: yesNo ? 'yes' : 'over', odds: parseOdds(cell(w.odds)), underOdds: parseOdds(cell(w.underOdds)), hit: mh, avg: ma });
            count++;
          }
        }
      }
      sheets.push({ name: sheet, rows: count, market: sheetMarket, layout: isLong ? 'long' : 'wide' });
    }
    if (!out.length && !warnings.length) warnings.push('No prop rows found');
    return { rows: out, warnings, sheets };
  }

  return { parseCheatSheet, classifyHeader, parsePlayerCell, parseSide, tablesOf, findHeader, countByGroup };
}

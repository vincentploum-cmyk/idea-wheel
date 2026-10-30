#!/usr/bin/env node
// Compare PropFinder's "Defensive Matchups" CSV export against the board's allowed table for the
// same night: node tools/check-defensive-matchups.mjs <export.csv> <picks.json>
//   export.csv  the page's export (TEAM, POS, OPPOSING PLAYER, LINE, …, POINTS "39.7 #1", …)
//   picks.json  GET /api/nba/picks?date=YYYY-MM-DD saved to a file
// Each export row is what TEAM allows to POS; on the board that is the opponent's side's
// `allowed.rows[POS]` (the table the court, the Tonight table and the projections read).
import fs from 'node:fs';
import { teamAbbrFromText } from '../lib/nba/teams.js';

const [csvPath, jsonPath] = process.argv.slice(2);
if (!csvPath || !jsonPath) { console.error('usage: node tools/check-defensive-matchups.mjs <export.csv> <picks.json>'); process.exit(2); }

const STATS = { POINTS: 'pts', REBOUNDS: 'reb', ASSISTS: 'ast', '3PTM': 'tpm', STEALS: 'stl', BLOCKS: 'blk' };
const splitCsv = (line) => { const out = []; let cur = ''; let q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((s) => s.trim()); };

const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter((l) => l.trim());
const hi = lines.findIndex((l) => /^TEAM,POS,/i.test(l));
if (hi < 0) { console.error('no TEAM,POS header in the export'); process.exit(2); }
const head = splitCsv(lines[hi]).map((h) => h.toUpperCase());
const window = (lines.find((l) => /^Window,/i.test(l)) || '').split(',')[1] || '';
const rows = lines.slice(hi + 1).map(splitCsv).filter((c) => c.length >= head.length - 1).map((c) => {
  const r = { team: teamAbbrFromText(c[head.indexOf('TEAM')]), teamText: c[head.indexOf('TEAM')], pos: c[head.indexOf('POS')].toUpperCase(), player: c[head.indexOf('OPPOSING PLAYER')], stats: {} };
  for (const [col, key] of Object.entries(STATS)) {
    const i = head.indexOf(col); if (i < 0) continue;
    const m = String(c[i] || '').match(/(-?\d+(?:\.\d+)?)\s*#?(\d+)?/);
    if (m) r.stats[key] = { value: Number(m[1]), rank: m[2] ? Number(m[2]) : null };
  }
  return r;
});

const board = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const games = board.games || board.board?.games || [];
// what each team allows = the table on its opponent's side
const allowedBy = {}; const meta = {};
for (const g of games) {
  const sides = g.sides || {};
  for (const [team, side] of Object.entries(sides)) {
    const opp = team === g.home ? g.away : g.home;
    if (side?.allowed?.rows) { allowedBy[opp] = side.allowed.rows; meta[opp] = { from: side.allowed.from, count: side.allowed.count }; }
  }
}
console.log(`export: ${rows.length} rows, window "${window}"; board: ${board.date || board.slate || ''}, ${games.length} games, ${Object.keys(allowedBy).length} teams with an allowed table${board.pulledAt || board.pf?.at ? `, pull ${board.pulledAt || board.pf?.at}` : ''}`);
let same = 0, valueOff = 0, rankOff = 0, missing = 0;
const out = [];
for (const r of rows) {
  const table = allowedBy[r.team];
  if (!table) { missing++; out.push(`${r.teamText} (${r.team || '?'}) ${r.pos}: not on tonight's board`); continue; }
  const posRow = table[r.pos] || null;
  if (!posRow) { missing++; out.push(`${r.team} ${r.pos}: the board has no ${r.pos} row (${Object.keys(table).filter((k) => k !== 'gp').join(', ')})`); continue; }
  const diffs = [];
  for (const [key, ex] of Object.entries(r.stats)) {
    const cell = posRow[key]; if (!cell) { diffs.push(`${key}: no cell`); continue; }
    const dv = cell.value != null ? Math.abs(cell.value - ex.value) : null;
    const rankDiff = ex.rank != null && cell.rank != null && cell.rank !== ex.rank;
    if (dv == null || dv > 0.051) { valueOff++; diffs.push(`${key} ${ex.value} #${ex.rank ?? '–'} vs board ${cell.value ?? '–'} #${cell.rank ?? '–'}`); }
    else if (rankDiff) { rankOff++; diffs.push(`${key} ${ex.value}: rank #${ex.rank} vs board #${cell.rank}`); }
    else same++;
  }
  const gp = posRow.gp != null ? ` gp ${posRow.gp}${posRow.held ? ' (last season held)' : ''}` : '';
  out.push(`${r.team} ${r.pos} (vs ${r.player})${gp}: ${diffs.length ? diffs.join('; ') : 'matches'}`);
}
console.log(out.join('\n'));
console.log(`\ncells: ${same} match, ${valueOff} values differ, ${rankOff} ranks differ (same value), ${missing} rows without a board table` + (Object.values(meta)[0] ? `; board table from ${Object.values(meta)[0].from}, ${Object.values(meta)[0].count} teams ranked` : ''));

// PropFinder CSV exports (the Export button on its Skater Stats and Team Stats pages):
//   nhl-skater-stats-<Position>-<Strength>-<Split>-<season>-<YYYY-MM-DD>.csv
//   nhl-team-stats-Team-<season>-<YYYY-MM-DD>.csv
// A few "Key,Value" preamble lines, a blank line, then one header row and the table.
// Pure parsing only (no storage); lib/nhl-data/propfinder.js stores the result.
import { teamAbbrFromText } from './teams';

export const POSITIONS = ['C', 'LW', 'RW', 'D', 'G'];
// Status tags PropFinder appends after the position ("Mackie Samoskevich RW IR").
export const STATUS = new Set(['IR', 'IR-LT', 'IR-NR', 'LTIR', 'O', 'OUT', 'DTD', 'GTD', 'SUSP', 'NA', 'DNP', 'SCR']);

/** Season start year for a date (2025 = the 2025-26 season). */
export function seasonYear(now = new Date()) {
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

export const seasonLabel = (year) => (year ? `${year}-${String(year + 1).slice(2)}` : '');

// Skater columns the model reads (same order as its "Player stats" workbook).
export const SKATER_COLS = [
  ['gp', 'GP', 0], ['toi', 'TOI/G', 2], ['g', 'G/G', 2], ['a', 'A/G', 2], ['pts', 'PTS/G', 2], ['sog', 'SOG/G', 2],
  ['isf', 'ISF/G', 2], ['icf', 'ICF/G', 2], ['iff', 'IFF/G', 2], ['iscf', 'ISCF/G', 2], ['ihdcf', 'IHDCF/G', 2],
];

// Team columns: [key, label, decimals, direction]. PropFinder ranks every column
// 1 = highest value; "low" marks the one where a high value is bad for the team.
// In the "Opponent" export the same columns are what the team allowed, so rank 1
// there is the softest defense.
export const TEAM_COLS = [
  ['g', 'G/G', 2, 'high'], ['a', 'A/G', 2, 'high'], ['pts', 'PTS/G', 2, 'high'], ['sog', 'SOG/G', 2, 'high'], ['shPct', 'SH%', 1, 'high'],
  ['hit', 'HIT/G', 2, 'high'], ['blk', 'BLK/G', 2, 'high'], ['tk', 'TK/G', 2, 'high'], ['gv', 'GV/G', 2, 'low'],
  ['foPct', 'FO%', 1, 'high'], ['ppPct', 'PP%', 1, 'high'], ['pkPct', 'PK%', 1, 'high'],
  ['sc', 'SC/G', 2, 'high'], ['hdc', 'HDC/G', 2, 'high'], ['hdg', 'HDG/G', 2, 'high'],
];

export function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** "TOI/G" → toi, "SH%" → shPct, "ISCF/G" → iscf, "GP" → gp. */
export function statKey(header) {
  const h = String(header || '').trim().replace(/\/G$/i, '');
  if (/%$/.test(h)) return h.slice(0, -1).toLowerCase() + 'Pct';
  return h.toLowerCase();
}

/** Preamble "Key,Value" lines, then the header row and the table. */
export function parseStatsCsv(text) {
  const lines = String(text || '').replace(/^﻿/, '').replace(/\r/g, '').split('\n');
  const meta = {};
  let i = 0;
  // Preamble runs until the first blank line; a file without one starts at the header.
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { i++; break; }
    const cells = splitCsvLine(line);
    if (cells.length === 2 && !/^(PLAYER|TEAM)$/i.test(cells[0])) meta[cells[0]] = cells[1];
    else break;
  }
  while (i < lines.length && !lines[i].trim()) i++;
  const head = i < lines.length ? splitCsvLine(lines[i]) : [];
  const rows = lines.slice(i + 1).filter((l) => l.trim()).map(splitCsvLine);
  return { meta, head, rows };
}

/** "Nathan MacKinnon C" → { name, pos, status }; "Mackie Samoskevich RW IR" carries the tag. */
export function parsePlayerCell(cell) {
  const parts = String(cell || '').trim().split(/\s+/).filter(Boolean);
  let status = null;
  while (parts.length > 2 && STATUS.has(parts[parts.length - 1].toUpperCase())) status = parts.pop().toUpperCase();
  let pos = null;
  if (parts.length > 1 && POSITIONS.includes(parts[parts.length - 1].toUpperCase())) pos = parts.pop().toUpperCase();
  return { name: parts.join(' '), pos, status };
}

/** "3.63 #1" → { value: 3.63, rank: 1 }; "10.8% #19" → { value: 10.8, rank: 19 }; "82" → { value: 82, rank: null }. */
export function parseRanked(cell) {
  const s = String(cell ?? '').trim();
  const m = s.match(/^(-?[\d.]+)%?\s*(?:#\s*(\d+))?$/);
  if (!m) return { value: null, rank: null };
  return { value: Number(m[1]), rank: m[2] ? Number(m[2]) : null };
}

const num = (v) => { const n = Number.parseFloat(String(v ?? '').replace('%', '')); return Number.isFinite(n) ? n : null; };

/** Tokens of a file name after its export date ("…-2026-09-30_D_L10.csv" → ["d", "l10"]). */
function nameTail(fileName) {
  const s = String(fileName || '').replace(/\.csv$/i, '');
  const m = s.match(/20\d{2}-\d{2}-\d{2}/);
  if (!m) return [];
  return s.slice(m.index + m[0].length).split(/[-_ ]+/).map((t) => t.toLowerCase()).filter(Boolean);
}

/** Position tag in a team-stats file name: LW, C, RW, D or All ("…-lw.csv", "…_D_L10.csv", "…_all.csv"). */
export function positionFromName(fileName) {
  const tag = nameTail(fileName).find((t) => ['lw', 'rw', 'c', 'd', 'all'].includes(t));
  return !tag || tag === 'all' ? 'All' : tag.toUpperCase();
}

/** A window tag in the file name ("…_D_L10.csv" → 10), when the export's own Window line is missing. */
export function windowFromName(fileName) {
  const tag = nameTail(fileName).find((t) => /^l\d+$/.test(t));
  return tag ? Number(tag.slice(1)) : null;
}

/** Slate date and season start year from PropFinder's file name. */
export function fileInfo(fileName) {
  const s = String(fileName || '');
  const d = s.match(/(20\d{2}-\d{2}-\d{2})/);
  const date = d ? d[1] : null;
  // The season is the 4-digit year token before the date ("…-2025-2026-09-30…", "…-2025-L10-2026-09-30…").
  const before = d ? s.slice(0, d.index) : s;
  const y = before.match(/(?:^|[-_ ])(20\d{2})(?=[-_ ]|$)/g);
  const season = y ? Number(y[y.length - 1].replace(/[^0-9]/g, '')) : null;
  return { season, date };
}

/**
 * Read one PropFinder CSV. Returns { kind: 'skaters' | 'teams' | null, season, date,
 * meta, players | teams, error } — an error is set when the file is a PropFinder
 * export the site should not store (a 5-on-5 or home-only skater table would
 * silently mix with the all-situations season rates).
 */
export function inspectPropfinderCsv(text, fileName = '') {
  const { meta, head, rows } = parseStatsCsv(text);
  const info = fileInfo(fileName);
  const first = (head[0] || '').toUpperCase();
  const base = { meta, date: info.date, season: null, file: fileName };

  if (first === 'PLAYER') {
    // "Count Window" is a season (2025) or a number of recent games (5 = last five).
    const window = num(meta['Count Window']);
    const windowGames = window && window < 2000 ? window : null;
    const season = window && window >= 2000 ? window : info.season || (info.date ? seasonYear(new Date(`${info.date}T12:00:00Z`)) : null);
    const problems = [];
    if (meta.Rate && !/per game/i.test(meta.Rate)) problems.push(`Rate is "${meta.Rate}" (export Per Game)`);
    if (meta.Strength && !/^all$/i.test(meta.Strength)) problems.push(`Strength is "${meta.Strength}" (export All)`);
    // Split: All, or a venue split (Home / Away) kept as its own table.
    const split = /^home$/i.test(meta.Split || '') ? 'H' : /^away$/i.test(meta.Split || '') ? 'A' : null;
    if (meta.Split && !split && !/^all$/i.test(meta.Split)) problems.push(`Split is "${meta.Split}" (export All, Home or Away)`);
    if (!season) problems.push('no season in the file or its name');
    const keys = head.map(statKey);
    const players = rows.map((r) => {
      const p = parsePlayerCell(r[0]);
      const stats = {};
      for (let c = 1; c < head.length; c++) {
        const v = num(r[c]);
        if (v != null) stats[keys[c]] = v;
      }
      return { ...p, ...stats };
    }).filter((p) => p.name && p.gp != null);
    return { ...base, kind: 'skaters', season, windowGames, split, players, error: problems.length ? problems.join('; ') : null };
  }

  if (first === 'TEAM') {
    const season = num(meta.Season) || info.season;
    const keys = head.map(statKey);
    const teams = [];
    const unknown = [];
    for (const r of rows) {
      const abbr = teamAbbrFromText(r[0]);
      if (!abbr) { unknown.push(r[0]); continue; }
      const t = { abbr, name: r[0], gp: num(r[1]), values: {}, ranks: {} };
      for (let c = 2; c < head.length; c++) {
        const { value, rank } = parseRanked(r[c]);
        if (value == null) continue;
        t.values[keys[c]] = value;
        if (rank) t.ranks[keys[c]] = rank;
      }
      teams.push(t);
    }
    const problems = [];
    if (!season) problems.push('no season in the file or its name');
    if (unknown.length) problems.push(`unknown team${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`);
    // "Stats Type,Team" is what the team produced; "Stats Type,Opponent" is what it allowed.
    const statsType = /opponent|against/i.test(meta['Stats Type'] || '') || /-Opponent-/i.test(fileName) ? 'opponent' : 'team';
    // PropFinder names a per-position export exactly like the all-positions one, so the
    // position rides on the file name: "…-2026-09-30-lw.csv" / "…09-30d.csv" / "…_all.csv".
    const position = positionFromName(fileName);
    // "Window,Full Season" or a recent-games window ("Last 10 Games", "L10", "10").
    const wm = String(meta.Window || '').match(/(?:last|l)\s*(\d+)|^(\d+)$/i);
    const windowGames = wm ? Number(wm[1] || wm[2]) : (/full/i.test(meta.Window || '') ? null : windowFromName(fileName));
    const split = /^home$/i.test(meta.Split || '') ? 'H' : /^away$/i.test(meta.Split || '') ? 'A' : null;
    return { ...base, kind: 'teams', statsType, position, split, season, window: meta.Window || null, windowGames, teams, error: problems.length ? problems.join('; ') : null };
  }

  return { ...base, kind: null, error: 'not a PropFinder stats export (expected a PLAYER or TEAM header row)' };
}

// ── Defense-table tabs as the rink reads them (pure; this module is safe in the browser) ──
/** The tab a defense table opens on: last 10 games, else the latest season, else the first. */
export function defaultDefenseTab(tabs) {
  const list = tabs || [];
  return list.find((t) => t.key === 'l10') || [...list].reverse().find((t) => t.kind === 'season') || list[0] || null;
}

/** Plain words for a tab's window: "the 2025 season", "the last 10 games", "the last 5 home games". */
export function defenseTabText(tab) {
  if (!tab) return '';
  return tab.kind === 'season' ? `the ${tab.label} season` : `the last ${tab.windowGames}${tab.split === 'H' ? ' home' : tab.split === 'A' ? ' away' : ''} games`;
}

/**
 * One position of a PropFinder defense tab in the shape the rink's bands read (the same
 * as a slate defense window): { season: { gp, sog, g }, rank: { sog, g }, source, seasonLabel,
 * window, teamCount }, or null when the tab has no row for the position.
 */
export function defenseBandFromTab(tab, pos) {
  const row = tab?.rows?.[pos];
  if (!row || row.sog == null) return null;
  return {
    season: { gp: row.gp ?? 0, sog: row.sog, g: row.g ?? null, iscf: row.iscf ?? null },
    rank: { sog: row.ranks?.sog ?? null, g: row.ranks?.g ?? null, iscf: row.ranks?.iscf ?? null },
    source: 'propfinder', seasonLabel: tab.label, window: defenseTabText(tab), teamCount: tab.count || 32,
  };
}


// Builds the model's optional input workbooks from the stored NHL data, in the
// exact layouts the model's existing parsers already read. The model itself
// is unchanged: these files simply replace the hand-made uploads.
import * as XLSX from 'xlsx';
import { readJson } from '../nhl-store';
import { gamesPath, lineupsPath, rowsPath, rowObj } from './ingest';
import { teamName, teamFull } from './teams';
import { loadDisplayNames } from './names';

const round = (v, d = 2) => (Number.isFinite(v) ? +v.toFixed(d) : 0);
const avg = (arr, k) => (arr.length ? arr.reduce((s, r) => s + (Number(r[k]) || 0), 0) / arr.length : 0);

function book(sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name.slice(0, 31));
  }
  return wb;
}

export function toBuffer(wb) {
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function seasonsFor(date) {
  // NHL seasons run Oct→Jun; the season id is e.g. 20252026.
  const d = new Date(`${date}T12:00:00Z`);
  const y = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return [`${y}${y + 1}`, `${y - 1}${y}`];
}

// Converting ~50k rows to objects is the slow part; keep the result for the
// same season files (identity from the read cache) and asOf.
const rowsMemo = new Map();
const ROWS_MEMO_MAX = 8;

/** Skater-game rows strictly before `asOf` (no look-ahead), newest seasons first. */
export async function loadRows(asOf) {
  const [cur, prev] = seasonsFor(asOf);
  const files = await Promise.all([readJson(rowsPath(cur)), readJson(rowsPath(prev))]);
  const key = `${asOf}|${files.map((f) => f?.updatedAt || '-').join('|')}`;
  const hit = rowsMemo.get(key);
  if (hit && hit.files[0] === files[0] && hit.files[1] === files[1]) return hit.rows;
  const rows = files.flatMap((f) => (f?.rows || [])).filter((r) => r[0] < asOf).map(rowObj);
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (rowsMemo.size >= ROWS_MEMO_MAX) rowsMemo.delete(rowsMemo.keys().next().value);
  rowsMemo.set(key, { files, rows });
  return rows;
}

// ── Box scores (per-game sheets, same layout as "Box Scores <date>.xlsx") ──
export async function buildBoxScores(date) {
  const [file, names] = await Promise.all([readJson(gamesPath(date)), loadDisplayNames()]);
  const games = file?.games || [];
  if (!games.length) return null;
  const nm = (s) => names.display[s.id] || s.name;
  const header = (label) => [label, 'G', 'A', '+/-', 'S', 'SM', 'BS', 'PN', 'PIM', 'HT', 'TK', 'GV', 'SHFT', 'TOI', 'PPTOI', 'SHTOI'];
  const line = (s) => [nm(s), s.g, s.a, s.pm, s.sog, Math.max(0, s.iff - s.isf), s.blk, s.pim ? 1 : 0, s.pim, s.hits, s.tk, s.gv, s.shifts, s.toi, '', ''];
  const sheets = games.map((g) => {
    const rows = [];
    for (const abbr of [g.away.abbrev, g.home.abbrev]) {
      const sk = g.skaters.filter((s) => s.team === abbr);
      rows.push([teamFull(abbr)], ['Time On Ice', 'Faceoffs']);
      rows.push(header('forwards'), ...sk.filter((s) => s.pos !== 'D').map(line));
      rows.push(header('defensemen'), ...sk.filter((s) => s.pos === 'D').map(line));
      rows.push([], ['goalies']);
      for (const gk of g.goalies.filter((x) => x.team === abbr && x.toi > 0)) {
        rows.push([gk.name], ['SA', 'GA'], [gk.sa, gk.ga]);
      }
      rows.push([]);
    }
    return [`${g.away.abbrev} @ ${g.home.abbrev}`, rows];
  });
  return { wb: book(sheets), games: games.length, name: `Box Scores ${date}.xlsx` };
}

// ── Lineups (single sheet of preview text rows) ─────────────────────────────
export async function buildLineups(date) {
  const file = await readJson(lineupsPath(date));
  const games = (file?.games || []).filter((g) => g.rows?.length);
  if (!games.length) return null;
  const rows = games.flatMap((g) => g.rows.map((r) => [r]));
  return { wb: book([['Sheet1', rows]]), games: games.length, name: `Lineups ${date}.xlsx`, fetchedAt: file.fetchedAt };
}

// ── Historical profiles: every skater game vs each opponent, by position ───
export async function buildHistorical(asOf, { days = 365 } = {}) {
  const since = new Date(`${asOf}T12:00:00Z`);
  since.setUTCDate(since.getUTCDate() - days);
  const from = since.toISOString().slice(0, 10);
  const [all, names] = await Promise.all([loadRows(asOf), loadDisplayNames()]);
  const rows = all.filter((r) => r.date >= from);
  if (!rows.length) return null;
  const groups = {};
  for (const r of rows) {
    const key = `${r.pos} ${teamName(r.opp)}`;
    (groups[key] = groups[key] || []).push(r);
  }
  const head = ['Date', 'W/L', 'H/A', 'Player', 'Line', 'totalTimeOnIce', 'goals', 'AST', 'PTS', 'shots', 'hits', 'blockedShots'];
  const sheets = Object.keys(groups).sort().map((key) => {
    const list = groups[key].sort((a, b) => (a.date < b.date ? 1 : -1));
    const body = list.flatMap((r) => [
      [r.date, r.result, r.venue, names.display[r.playerId] || r.name, 'N/A', r.toi, r.g, r.a, r.g + r.a, r.sog, r.hits, r.blk],
      [null, null, null, r.pos, null, null, null, null, null, null, null, null],
    ]);
    return [key, [head, ...body]];
  });
  return { wb: book(sheets), games: new Set(rows.map((r) => r.gameId)).size, name: `Historical Profiles ${asOf}.xlsx`, from };
}

// ── Player home/away stats (73 columns, same layout as "Player stats *.xlsx") ─
function split(games) {
  const n = games.length;
  return {
    gp: n,
    toi: round(avg(games, 'toi')),
    g: round(avg(games, 'g')),
    sog: round(avg(games, 'sog')),
    isf: round(avg(games, 'isf')),
    icf: round(avg(games, 'icf')),
    iff: round(avg(games, 'iff')),
    iscf: round(avg(games, 'iscf')),
    ihdcf: round(avg(games, 'ihdcf')),
  };
}

function form(base, l5) {
  const delta = round(l5.sog - base.sog);
  const capped = Math.max(-1, Math.min(1, delta));
  const apply = l5.gp >= 3 ? 1 : 0;
  const adjust = round(capped * apply);
  return { delta, capped: round(capped), apply, adjust, basePlus: round(base.sog + adjust) };
}

export async function buildPlayerStats(asOf, { window = 82, minGames = 5 } = {}) {
  const [rows, names] = await Promise.all([loadRows(asOf), loadDisplayNames()]);
  const ref = { players: names.players };
  if (!rows.length) return null;
  const byPlayer = {};
  for (const r of rows) (byPlayer[r.playerId] = byPlayer[r.playerId] || []).push(r);

  const groupRow = [null, null, null, null, null, null, null,
    ...Array(9).fill('All (home+away)'), ...Array(9).fill('All away'), ...Array(9).fill('All Home'),
    ...Array(14).fill('Home L5'), ...Array(14).fill('Away L5'), ...Array(11).fill('Home + Away L5')];
  const statHead = ['GP', 'TOI/G', 'G/G', 'SOG/G', 'ISF/G', 'ICF/G', 'IFF/G', 'ISCF/G', 'IHDCF/G'];
  const headRow = ['PLAYER', 'Position', 'col_2', 'col_3', 'Team', 'Base_Shots_Home', 'Base_Shots_Away',
    ...statHead, ...statHead, ...statHead,
    'GP', 'TOI/G', 'G/G', 'SOG/G', 'Form_Delta_Home', 'Form_Delta_Home_Capped', 'Form_Apply_Home', 'Form_Adjust_Home', 'BasePlusForm_Home', 'ISF/G', 'ICF/G', 'IFF/G', 'ISCF/G', 'IHDCF/G',
    'GP', 'TOI/G', 'G/G', 'SOG/G', 'Form_Delta_Away', 'Form_Delta_Away_Capped', 'Form_Apply_Away', 'Form_Adjust_Away', 'BasePlusForm_Away', 'ISF/G', 'ICF/G', 'IFF/G', 'ISCF/G', 'IHDCF/G',
    ...statHead, 'Base_Shots_Home_L5', 'Base_Shots_Away_L5'];
  const stats = (s) => [s.gp, s.toi, s.g, s.sog, s.isf, s.icf, s.iff, s.iscf, s.ihdcf];

  const out = [];
  for (const list of Object.values(byPlayer)) {
    const recent = list.slice(-window);
    if (recent.length < minGames) continue;
    const info = ref.players[recent[0].playerId];
    if (info?.excluded) continue;
    // Current team/position/name from the roster database (handles trades and overrides).
    const last = { ...recent[recent.length - 1], ...(info?.team ? { team: info.team } : {}), ...(info?.pos && info.pos !== 'G' ? { pos: info.pos } : {}), ...(names.display[recent[0].playerId] ? { name: names.display[recent[0].playerId] } : {}) };
    const home = recent.filter((r) => r.venue === 'H');
    const away = recent.filter((r) => r.venue === 'A');
    const all = split(recent);
    const h = split(home);
    const a = split(away);
    const h5 = split(home.slice(-5));
    const a5 = split(away.slice(-5));
    const l5 = split(recent.slice(-5));
    const fh = form(h, h5);
    const fa = form(a, a5);
    out.push({
      sog: all.sog,
      row: [
        `${last.name} ${last.pos}`, last.pos.length === 1 ? ` ${last.pos}` : last.pos, `${last.name} `, last.name, teamName(last.team),
        h.sog, a.sog,
        ...stats(all), ...stats(a), ...stats(h),
        h5.gp, h5.toi, h5.g, h5.sog, fh.delta, fh.capped, fh.apply, fh.adjust, fh.basePlus, h5.isf, h5.icf, h5.iff, h5.iscf, h5.ihdcf,
        a5.gp, a5.toi, a5.g, a5.sog, fa.delta, fa.capped, fa.apply, fa.adjust, fa.basePlus, a5.isf, a5.icf, a5.iff, a5.iscf, a5.ihdcf,
        ...stats(l5), h5.sog, a5.sog,
      ],
    });
  }
  out.sort((x, y) => y.sog - x.sog);
  return { wb: book([['Sheet1', [groupRow, headRow, ...out.map((o) => o.row)]]]), players: out.length, name: `Player stats ${asOf}.xlsx` };
}

// ── Defense rankings from the latest PropFinder defense blocks per team ────
const RANK_TABS = ['All', 'RW', 'LW', 'C', 'D'];
const RANK_KEYS = ['Goals/G', 'Assists/G', 'Shots/G', 'iCF/G', 'iFF/G', 'iSCF/G'];

export async function buildRankings() {
  const file = await readJson('data/defense/latest.json');
  const teams = file?.teams || {};
  const abbrs = Object.keys(teams);
  if (abbrs.length < 2) return null;
  const sheets = RANK_TABS.map((tab) => {
    const list = abbrs
      .map((abbr) => ({ abbr, v: teams[abbr].rows?.[tab] }))
      .filter((t) => Array.isArray(t.v));
    const ranks = RANK_KEYS.map((_, k) => {
      const sorted = [...list].sort((x, y) => (y.v[k] || 0) - (x.v[k] || 0));
      const r = {};
      sorted.forEach((t, i) => {
        const firstEqual = sorted.findIndex((s) => (s.v[k] || 0) === (t.v[k] || 0));
        r[t.abbr] = firstEqual + 1 || i + 1;
      });
      return r;
    });
    const ordered = [...list].sort((x, y) => (y.v[2] || 0) - (x.v[2] || 0));
    const rows = [
      [`NHL Defense Rankings — ${tab} (built from PropFinder last-10 blocks, ${file.updatedAt?.slice(0, 10) || ''})`],
      [null, null, '← Stats Allowed per Game →', null, null, null, null, null, '← Rank (1 = Most Permissive) →'],
      ['Rank', 'Team', ...RANK_KEYS, ...RANK_KEYS.map((k) => `${k} Rank`)],
      ...ordered.map((t, i) => [i + 1, teamFull(t.abbr), ...t.v.map((x) => round(x, 3)), ...ranks.map((r) => r[t.abbr])]),
    ];
    return [tab, rows];
  });
  return { wb: book(sheets), teams: abbrs.length, name: 'NHL-Defense-Rankings.xlsx', updatedAt: file.updatedAt };
}

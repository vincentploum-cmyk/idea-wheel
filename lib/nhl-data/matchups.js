// PropFinder matchup workbooks ("NHL-Goal-Matchups-YYYY-MM-DD*.xlsx"):
// detect season vs L5, the slate date, and pull out the per-team
// "Defense (Last 10 Games)" blocks that feed the defense rankings.
import * as XLSX from 'xlsx';
import { readJson, writeJson, writeBlob, readBlob } from '../nhl-store';
import { teamAbbrFromText } from './teams';
import { SOURCE_NAMES_PATH } from './names';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const slatePath = (date, kind) => `data/slates/${date}/${kind}.xlsx`;
export const slateMetaPath = (date) => `data/slates/${date}/meta.json`;

export function inspectMatchups(buffer, fileName = '') {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  let kind = null;
  const defense = {};
  const names = {};
  for (const sn of wb.SheetNames) {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
    for (let i = 0; i < raw.length; i++) {
      const cell = String(raw[i]?.[0] ?? '').trim();
      const sk = cell.match(/Skaters\s*\(([^)]*)\)/i);
      if (sk && !kind) kind = /last\s*\d+/i.test(sk[1]) ? 'l5' : 'season';
      if (sk) {
        const team = teamAbbrFromText(cell.replace(/\s*Skaters.*$/i, ''));
        for (let r = i + 2; r < raw.length; r++) {
          const nm = String(raw[r]?.[0] ?? '').trim();
          if (!nm || /Defense|Skaters/i.test(nm)) break;
          const pos = String(raw[r]?.[1] ?? '').trim();
          if (pos && pos !== 'G') names[nm] = { team, pos };
        }
      }
      const df = cell.match(/^(.*?)\s+Defense\s*\(Last\s*\d+/i);
      if (df) {
        const abbr = teamAbbrFromText(df[1]);
        if (!abbr) continue;
        const rows = {};
        for (let r = i + 2; r < raw.length; r++) {
          const pos = String(raw[r]?.[0] ?? '').trim();
          if (!pos) break;
          if (!['All', 'LW', 'RW', 'C', 'D'].includes(pos)) break;
          rows[pos] = raw[r].slice(1, 7).map((v) => Number.parseFloat(v) || 0);
        }
        if (Object.keys(rows).length) defense[abbr] = rows;
      }
    }
  }
  const m = String(fileName).match(/(20\d{2})-(\d{2})-(\d{2})/);
  return { kind, date: m ? `${m[1]}-${m[2]}-${m[3]}` : null, defense, names, games: wb.SheetNames.length };
}

/** Store a PropFinder file as today's slate input and refresh the defense table. */
export async function ingestMatchupFile({ buffer, fileName, date: dateHint, source = 'upload' }) {
  const info = inspectMatchups(buffer, fileName);
  const date = dateHint || info.date;
  if (!info.kind) throw new Error(`${fileName}: not a PropFinder matchup workbook (no "Skaters (...)" block found)`);
  if (!date) throw new Error(`${fileName}: couldn't tell the slate date; name it NHL-Goal-Matchups-YYYY-MM-DD.xlsx`);

  const meta = (await readJson(slateMetaPath(date))) || { date, files: {} };
  const current = meta.files[info.kind];
  // Bulk imports of old folders often hold several variants of a file
  // ("_with_expected", "v2", ...): keep the cleanest name for the slate.
  const keepExisting = source === 'import' && current && nameScore(current.name) <= nameScore(fileName);
  if (!keepExisting) {
    await writeBlob(slatePath(date, info.kind), new Blob([buffer], { type: XLSX_TYPE }), XLSX_TYPE);
    meta.files[info.kind] = { name: fileName, receivedAt: new Date().toISOString(), source, games: info.games };
    await writeJson(slateMetaPath(date), meta);
  }

  if (Object.keys(info.names).length) {
    const src = (await readJson(SOURCE_NAMES_PATH)) || { names: {} };
    for (const [nm, v] of Object.entries(info.names)) {
      const prev = src.names[nm];
      if (!prev || (prev.lastSeen || '') <= date) src.names[nm] = { ...v, lastSeen: date };
    }
    src.updatedAt = new Date().toISOString();
    await writeJson(SOURCE_NAMES_PATH, src);
  }

  if (Object.keys(info.defense).length) {
    const latest = (await readJson('data/defense/latest.json')) || { teams: {} };
    for (const [abbr, rows] of Object.entries(info.defense)) {
      const prev = latest.teams[abbr];
      if (!prev || prev.date <= date) latest.teams[abbr] = { date, rows };
    }
    latest.updatedAt = new Date().toISOString();
    await writeJson('data/defense/latest.json', latest);
  }
  return { date, kind: info.kind, games: info.games, stored: !keepExisting, defenseTeams: Object.keys(info.defense).length, players: Object.keys(info.names).length };
}

export function nameScore(name) {
  const n = String(name || '').toLowerCase();
  let s = n.length / 100;
  if (/expected|with|teams|_\d|v\d|\(l5, /.test(n)) s += 10;
  return s;
}

export async function readSlateFile(date, kind) {
  return readBlob(slatePath(date, kind));
}

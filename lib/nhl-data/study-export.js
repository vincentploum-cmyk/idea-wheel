// The matchup study's export (Vincent, 2026-11-24: "do the study for this season since you have pre game
// PropFinder data for all games"): every stored slate's pre-game PropFinder reads in one JSON, so the study
// can run off the site's own numbers instead of a reconstruction. Per date:
//   defense  — PropFinder's opponent table per team in the slate's matchup workbook (data/slates/<date>/season.xlsx),
//              by position (All / C / LW / RW / D): per-game goals, assists, SOG, iCF, iFF, iSCF and their ranks,
//              as it stood before puck drop, with the block's label (the window it covers);
//   skaters  — every skater in that workbook with PropFinder's position label and his rates for the block's window
//              (season and last five, from season.xlsx and l5.xlsx);
//   props    — the book's shots ladders and anytime-goal prices stored for the slate (data/propfinder/skater-props/<date>.json).
// The L10 defense table is one file per season (overwritten each pull), so it is not here; the study rebuilds it from
// the box scores with PropFinder's position labels.
import * as XLSX from 'xlsx';
import { teamAbbrFromText } from './teams';

const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const DEF_KEYS = { G: 'g', A: 'a', SOG: 'sog', ICF: 'icf', IFF: 'iff', ISCF: 'iscf', 'G rank': 'gRank', 'A rank': 'aRank', 'SOG rank': 'sogRank', 'ICF rank': 'icfRank', 'IFF rank': 'iffRank', 'ISCF rank': 'iscfRank' };
const SKATER_KEYS = { GP: 'gp', 'TOI/G': 'toi', 'G/G': 'g', 'A/G': 'a', 'SOG/G': 'sog', 'ICF/G': 'icf', 'IFF/G': 'iff', 'ISCF/G': 'iscf' };

/**
 * One matchup workbook (any number of game sheets) → { defense: [...], skaters: [...] }.
 * A block starts at a one-cell title row "<Team> Skaters (<window>)" or "<Team> Defense (<window>)", then its header
 * row, then rows until a blank one; columns are read by header name, so a manual PropFinder upload reads the same.
 */
export function parseMatchupWorkbook(wb) {
  const defense = [];
  const skaters = [];
  for (const sheetName of wb?.SheetNames || []) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: true, defval: '' });
    for (let i = 0; i < rows.length; i++) {
      const title = String(rows[i]?.[0] || '').trim();
      const m = title.match(/^(.*?)\s+(Skaters|Defense)\s*\(([^)]*)\)\s*$/i);
      if (!m || rows[i].slice(1).some((c) => String(c).trim())) continue;
      const team = teamAbbrFromText(m[1]);
      const kind = m[2].toLowerCase();
      const window = m[3].trim();
      const head = (rows[i + 1] || []).map((h) => String(h).trim());
      let j = i + 2;
      for (; j < rows.length; j++) {
        const r = rows[j] || [];
        if (!r.some((c) => String(c).trim())) break;
        const cell = (name) => r[head.indexOf(name)];
        if (kind === 'defense') {
          const out = { team, window, pos: String(cell('Pos') || '').trim() };
          for (const [h, k] of Object.entries(DEF_KEYS)) if (head.includes(h)) out[k] = num(cell(h));
          defense.push(out);
        } else {
          const out = { team, window, name: String(cell('Player') || '').trim(), pos: String(cell('Pos') || '').trim() || null };
          for (const [h, k] of Object.entries(SKATER_KEYS)) if (head.includes(h)) out[k] = num(cell(h));
          if (out.name) skaters.push(out);
        }
      }
      i = j;
    }
  }
  return { defense, skaters };
}

/** One slate date's export from its stored blobs / JSON (any may be null). */
export function slateExport(date, { seasonBook = null, l5Book = null, props = null } = {}) {
  const season = seasonBook ? parseMatchupWorkbook(seasonBook) : { defense: [], skaters: [] };
  const l5 = l5Book ? parseMatchupWorkbook(l5Book) : { defense: [], skaters: [] };
  // Both workbooks carry the same defense block; keep each window once.
  const seen = new Set();
  const defense = [...season.defense, ...l5.defense].filter((d) => {
    const k = `${d.team}|${d.window}|${d.pos}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    date,
    defense,
    skaters: [...season.skaters, ...l5.skaters],
    props: props?.skaters ? { at: props.at || null, skaters: props.skaters.map((s) => ({ name: s.name, team: s.team, pos: s.pos, sog: s.sog || null, goal: s.goal || null })) } : null,
  };
}

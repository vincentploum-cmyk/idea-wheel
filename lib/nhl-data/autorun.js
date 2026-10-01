// Runs the model on the server for a slate date, with exactly the inputs the
// Model tab would use, and saves the run like the browser does:
//   season + L5 matchups  → the PropFinder workbooks stored for the date
//   lineups               → the position snapshot (NHL.com + beat writers, newest wins)
//   historical profiles   → stored skater games (last 365 days)
//   home/away stats       → stored skater games (last 82)
// It is called after every lineup capture and every matchup-file import, and
// skips when nothing changed since the last automatic run (autoKey) or when a
// required input is missing. The model's math is the same code the browser runs.
import * as XLSX from 'xlsx';
import { createHash } from 'node:crypto';
import { readJson, createRun, listRuns } from '../nhl-store';
import { readSlateFile, slateMetaPath } from './matchups';
import { positionsPath } from './positions';
import { buildLineups, buildHistorical, buildPlayerStats, toBuffer } from './build';
import { parseMatchups, parsePlayerHomeAway, parseLineups, parseHistoricalProfiles, buildProjections, summarizeRun } from '../../components/nhl/model-core';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const AUTO_USER = { email: 'automation@ideareels.io' };

/** Teams on the slate whose lines came from a lineup source (not the bare roster). */
export function coveredTeams(snapshot) {
  const out = [];
  for (const g of Object.values(snapshot?.games || {})) {
    for (const abbr of [g.away, g.home]) {
      const t = g.teams?.[abbr];
      if (t && t.source !== 'roster') out.push({ abbr, source: t.source, players: Object.values(t.players || {}).filter((p) => p.inLineup !== false && p.line).map((p) => `${p.name}|${p.pos}|${p.line}`).sort() });
    }
  }
  return out;
}

/** Fingerprint of everything the run depends on; equal keys mean "nothing to re-run". */
export function autoRunKey(date, meta, covered) {
  const h = createHash('sha1');
  h.update(JSON.stringify([date, meta?.files?.season?.receivedAt || null, meta?.files?.l5?.receivedAt || null, covered.map((t) => [t.abbr, t.players])]));
  return `auto:${h.digest('hex').slice(0, 32)}`;
}

const binary = (wb) => XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
const file = (buf, name) => new File([buf], name, { type: XLSX_TYPE });

/**
 * Run and save the model for `date` when its inputs are in place and changed.
 * Returns { ran, runId?, players?, games?, skipped? }.
 */
export async function autoRunModel(date, { force = false } = {}) {
  const [meta, snap] = await Promise.all([readJson(slateMetaPath(date)), readJson(positionsPath(date))]);
  if (!meta?.files?.season || !meta?.files?.l5) return { ran: false, skipped: 'no PropFinder matchup files (season + L5) stored for this date' };
  const covered = coveredTeams(snap);
  if (!covered.length) return { ran: false, skipped: 'no lineups captured yet' };
  const autoKey = autoRunKey(date, meta, covered);
  if (!force) {
    const runs = await listRuns(80);
    const same = runs.find((r) => r.slateDate === date && r.autoKey === autoKey);
    if (same) return { ran: false, skipped: 'inputs unchanged since the last automatic run', runId: same.id };
  }

  const [seasonBlob, l5Blob, lu, hist, ps] = await Promise.all([
    readSlateFile(date, 'season'), readSlateFile(date, 'l5'), buildLineups(date), buildHistorical(date).catch(() => null), buildPlayerStats(date).catch(() => null),
  ]);
  if (!seasonBlob || !l5Blob) return { ran: false, skipped: 'matchup workbook missing from storage' };
  if (!lu) return { ran: false, skipped: 'no lineup rows to build' };
  const seasonBuf = Buffer.from(await seasonBlob.arrayBuffer());
  const l5Buf = Buffer.from(await l5Blob.arrayBuffer());

  // The same pipeline as NhlModel.run(), minus the browser's FileReader.
  const wbS = XLSX.read(seasonBuf, { type: 'buffer' });
  const wbL = XLSX.read(l5Buf, { type: 'buffer' });
  const games = parseMatchups(wbS, wbL);
  if (!games.length) return { ran: false, skipped: 'no games parsed from the matchup workbooks' };
  const playerHomeAway = ps ? parsePlayerHomeAway(binary(ps.wb)) : null;
  const lineupData = parseLineups(binary(lu.wb));
  let histProfiles = null;
  if (hist) {
    try { histProfiles = parseHistoricalProfiles(hist.wb, playerHomeAway); } catch (err) { console.warn('[autorun] history parse failed:', err?.message || err); }
  }
  const projected = buildProjections(games, histProfiles, playerHomeAway, lineupData, null);

  const names = { season: { name: meta.files.season.name }, l5: { name: meta.files.l5.name } };
  const summary = {
    ...summarizeRun(names, projected, games),
    slateDate: date, source: 'auto', autoKey,
  };
  summary.label = `Auto · ${summary.label || date}`.slice(0, 120);
  const files = {
    season: file(seasonBuf, meta.files.season.name), l5: file(l5Buf, meta.files.l5.name),
    lineups: file(toBuffer(lu.wb), lu.name),
    ...(hist ? { hist: file(toBuffer(hist.wb), hist.name) } : {}),
    ...(ps ? { playerStats: file(toBuffer(ps.wb), ps.name) } : {}),
  };
  const run = await createRun({ files, summary, results: projected, user: AUTO_USER });
  return { ran: true, runId: run.id, players: projected.length, games: games.length, teamsWithLines: covered.length };
}

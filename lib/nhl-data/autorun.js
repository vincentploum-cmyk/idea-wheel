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
import { readJson, writeJson, createRun, listRuns } from '../nhl-store';
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

const file = (buf, name) => new File([buf], name, { type: XLSX_TYPE });
export const attemptPath = (date) => `data/meta/autorun/${date}.json`;
const ATTEMPT_TTL_MS = 24 * 3600 * 1000;
const BUILD = (process.env.RENDER_GIT_COMMIT || '').slice(0, 12) || null; // the deploy an attempt ran on

/**
 * An earlier attempt for the same inputs that never finished (the process died
 * mid-run, e.g. out of memory) blocks a retry for a day: the hourly lineup reads
 * must not take the site down every hour. `force` overrides.
 */
export function attemptBlocks(prev, autoKey, now = Date.now(), build = BUILD) {
  if (!prev || prev.autoKey !== autoKey || prev.finishedAt) return false;
  // A new deploy may carry the fix for what killed the run: it gets one fresh attempt.
  if (build && prev.build && prev.build !== build) return false;
  const started = Date.parse(prev.startedAt || '');
  return Number.isFinite(started) && now - started < ATTEMPT_TTL_MS;
}

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
    const prev = await readJson(attemptPath(date));
    if (attemptBlocks(prev, autoKey)) return { ran: false, skipped: `an earlier attempt with these inputs did not finish (${prev.startedAt}); not retried for a day`, attempt: prev };
  }
  const attempt = { date, autoKey, startedAt: new Date().toISOString(), build: BUILD, stages: [] };
  await writeJson(attemptPath(date), attempt);
  const finish = async (extra) => { await writeJson(attemptPath(date), { ...attempt, finishedAt: new Date().toISOString(), ...extra }).catch(() => {}); };
  // Each stage is written as it completes, with the process memory, so a run the
  // process did not survive still says how far it got (shown on the Model tab).
  const stage = async (name) => {
    const m = process.memoryUsage();
    attempt.stages.push({ name, at: new Date().toISOString(), rssMb: Math.round(m.rss / 1e6), heapMb: Math.round(m.heapUsed / 1e6) });
    await writeJson(attemptPath(date), attempt).catch(() => {});
  };

  try {
    // Inputs are built one at a time and turned into their file bytes as soon as they
    // are parsed, so only one workbook object is alive at a time (the history workbook
    // alone is a full season of skater games; the server has 512 MB).
    const [seasonBlob, l5Blob] = await Promise.all([readSlateFile(date, 'season'), readSlateFile(date, 'l5')]);
    if (!seasonBlob || !l5Blob) { await finish({ skipped: 'matchup workbook missing' }); return { ran: false, skipped: 'matchup workbook missing from storage' }; }
    const seasonBuf = Buffer.from(await seasonBlob.arrayBuffer());
    const l5Buf = Buffer.from(await l5Blob.arrayBuffer());
    await stage('matchup files read');
    const lu = await buildLineups(date);
    if (!lu) { await finish({ skipped: 'no lineup rows' }); return { ran: false, skipped: 'no lineup rows to build' }; }

    // The same pipeline as NhlModel.run(), minus the browser's FileReader.
    const games = parseMatchups(XLSX.read(seasonBuf, { type: 'buffer' }), XLSX.read(l5Buf, { type: 'buffer' }));
    if (!games.length) { await finish({ skipped: 'no games parsed' }); return { ran: false, skipped: 'no games parsed from the matchup workbooks' }; }
    await stage('matchups parsed');
    const lineupsBuf = toBuffer(lu.wb);
    const lineupData = parseLineups(lineupsBuf.toString('binary'));

    await stage('lineups built');
    let ps = await buildPlayerStats(date).catch(() => null);
    const playerStatsBuf = ps ? toBuffer(ps.wb) : null;
    const playerHomeAway = playerStatsBuf ? parsePlayerHomeAway(playerStatsBuf.toString('binary')) : null;
    const playerStatsName = ps?.name;
    ps = null;

    await stage('home/away stats built and parsed');
    let hist = await buildHistorical(date).catch(() => null);
    await stage('history workbook built');
    const histBuf = hist ? toBuffer(hist.wb) : null;
    await stage('history workbook written');
    const histName = hist?.name;
    let histProfiles = null;
    if (hist) {
      try { histProfiles = parseHistoricalProfiles(hist.wb, playerHomeAway); } catch (err) { console.warn('[autorun] history parse failed:', err?.message || err); }
    }
    hist = null;
    await stage('history parsed');

    const projected = buildProjections(games, histProfiles, playerHomeAway, lineupData, null);

    await stage('projections built');
    const names = { season: { name: meta.files.season.name }, l5: { name: meta.files.l5.name } };
    const summary = {
      ...summarizeRun(names, projected, games),
      slateDate: date, source: 'auto', autoKey,
    };
    summary.label = `Auto · ${summary.label || date}`.slice(0, 120);
    const files = {
      season: file(seasonBuf, meta.files.season.name), l5: file(l5Buf, meta.files.l5.name),
      lineups: file(lineupsBuf, lu.name),
      ...(histBuf ? { hist: file(histBuf, histName) } : {}),
      ...(playerStatsBuf ? { playerStats: file(playerStatsBuf, playerStatsName) } : {}),
    };
    const run = await createRun({ files, summary, results: projected, user: AUTO_USER });
    await finish({ runId: run.id, players: projected.length });
    return { ran: true, runId: run.id, players: projected.length, games: games.length, teamsWithLines: covered.length };
  } catch (err) {
    await finish({ error: String(err?.message || err) });
    throw err;
  }
}

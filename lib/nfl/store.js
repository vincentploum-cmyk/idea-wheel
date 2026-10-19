// Storage for the NFL board, in the same private bucket as the NHL model:
//   nfl/calendar/<season>.json                ESPN's week calendar
//   nfl/<season>/<wk>/schedule.json           the week's games and scores (ESPN)
//   nfl/<season>/<wk>/sheets/<id>.json        a parsed cheat sheet (rows + meta)
//   nfl/<season>/<wk>/sheets-index.json       the week's sheets
//   nfl/<season>/<wk>/propfinder.json         the week's PropFinder pull (players, lines, defenses)
//   nfl/<season>/<wk>/results/<gameId>.json   a finished game's box score (ESPN)
//   nfl/meta/*.json                           last refresh / pull outcomes
// <wk> is w07 for a regular-season week, p1 … p4 for the postseason.
import crypto from 'crypto';
import { readJson, writeJson, listNames } from '../nhl-store';
import { todayET, weekForDate, weekByRule, shiftWeek, weekFromFileName, seasonOfDate } from './week';
import { fetchWeek, fetchSummary } from './espn';
import { parseCheatSheet, countByGroup } from './cheatsheet';
import { pullWeek, propfinderConfigured } from './propfinder-nfl';
import { buildBoard } from './picks';

export const weekKey = ({ week, type }) => (type === 3 ? `p${week}` : `w${String(week).padStart(2, '0')}`);
export const CALENDAR = (season) => `nfl/calendar/${season}.json`;
export const SCHEDULE = (season, wk) => `nfl/${season}/${weekKey(wk)}/schedule.json`;
export const SHEETS_INDEX = (season, wk) => `nfl/${season}/${weekKey(wk)}/sheets-index.json`;
export const SHEET = (season, wk, id) => `nfl/${season}/${weekKey(wk)}/sheets/${id}.json`;
export const PROPFINDER = (season, wk) => `nfl/${season}/${weekKey(wk)}/propfinder.json`;
export const RESULT = (season, wk, gameId) => `nfl/${season}/${weekKey(wk)}/results/${gameId}.json`;
export const REFRESH_META = 'nfl/meta/refresh.json';
export const PF_META = 'nfl/meta/propfinder-pull.json';

const SCHEDULE_FRESH_MS = 6 * 3600 * 1000;      // a quiet week's schedule
const SCHEDULE_LIVE_MS = 10 * 60 * 1000;        // while a game is on or just finished

/** The week to show for a date: the stored calendar when fetched, else the kickoff rule. */
export async function resolveWeek({ date = todayET(), season = null, week = null, type = null } = {}) {
  if (week) {
    const s = Number(season) || seasonOfDate(date);
    return { season: s, week: Number(week), type: Number(type) || 2 };
  }
  const s = seasonOfDate(date);
  const cal = await readJson(CALENDAR(s));
  const w = weekForDate(date, cal?.windows || null);
  // Before kickoff the board opens on week 1; after the Super Bowl it stays on the last week.
  if (w.type === 1) return { season: s, week: 1, type: 2, label: w.label };
  return { season: w.season, week: w.week, type: w.type, label: w.label };
}

export { shiftWeek, weekByRule };

/** The week's schedule, fetched when missing, stale, or live; finished games' box scores stored alongside. */
export async function ensureSchedule(wk, { force = false, results = true } = {}) {
  const path = SCHEDULE(wk.season, wk);
  let sched = await readJson(path);
  const now = Date.now();
  const live = sched?.games?.some((g) => g.state === 'in' || (!g.final && Date.parse(g.date) < now && now - Date.parse(g.date) < 5 * 3600 * 1000));
  const stale = !sched?.fetchedAt || now - Date.parse(sched.fetchedAt) > (live ? SCHEDULE_LIVE_MS : SCHEDULE_FRESH_MS);
  let fetched = false;
  if (force || stale) {
    try {
      const got = await fetchWeek(wk.season, wk.week, wk.type);
      if (got) {
        sched = { season: wk.season, week: wk.week, type: wk.type, games: got.games, byes: got.byes, fetchedAt: got.fetchedAt };
        await writeJson(path, sched);
        if (got.calendar?.length) await writeJson(CALENDAR(wk.season), { season: wk.season, fetchedAt: got.fetchedAt, windows: got.calendar });
        fetched = true;
      }
    } catch (err) {
      console.error('[nfl] schedule fetch failed:', err?.message || err);
      if (!sched) throw err;
    }
  }
  let stored = 0;
  if (results && sched?.games) {
    for (const g of sched.games) {
      if (!g.final) continue;
      if (await readJson(RESULT(wk.season, wk, g.id))) continue;
      try {
        const sum = await fetchSummary(g.id);
        if (sum?.final && sum.players?.length) { await writeJson(RESULT(wk.season, wk, g.id), { ...sum, storedAt: new Date().toISOString() }); stored++; }
      } catch (err) { console.error('[nfl] summary fetch failed:', g.id, err?.message || err); }
    }
  }
  if (fetched || stored) await writeJson(REFRESH_META, { at: new Date().toISOString(), season: wk.season, week: wk.week, type: wk.type, games: sched?.games?.length || 0, finals: (sched?.games || []).filter((g) => g.final).length, resultsStored: stored });
  return { schedule: sched, fetched, resultsStored: stored };
}

export async function loadResults(wk, games) {
  const out = {};
  await Promise.all((games || []).filter((g) => g.final).map(async (g) => { const r = await readJson(RESULT(wk.season, wk, g.id)); if (r) out[g.id] = r; }));
  return out;
}

export async function listSheets(wk) {
  const idx = await readJson(SHEETS_INDEX(wk.season, wk));
  return idx?.sheets || [];
}

/**
 * Store a cheat sheet for the week its name says (wk7 / week-7 / a date), or the one given, or
 * this week. A file with the name of one already stored replaces it.
 */
export async function ingestCheatSheet({ buffer, text, fileName, week = null, season = null, type = null, source = 'upload' }) {
  const hint = weekFromFileName(fileName);
  const wk = week ? await resolveWeek({ season, week, type }) : hint.week ? await resolveWeek({ season: hint.season || (hint.date ? seasonOfDate(hint.date) : null), week: hint.week }) : await resolveWeek({ date: hint.date || todayET() });
  const parsed = parseCheatSheet({ buffer, text, fileName });
  if (!parsed.rows.length) return { ok: false, fileName, week: wk, warnings: parsed.warnings, rows: 0 };
  const at = new Date().toISOString();
  const idx = (await readJson(SHEETS_INDEX(wk.season, wk))) || { sheets: [] };
  const existing = idx.sheets.find((s) => s.fileName === fileName);
  const id = existing?.id || `${at.slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex')}`;
  await writeJson(SHEET(wk.season, wk, id), { id, fileName, at, source, week: wk, rows: parsed.rows, sheets: parsed.sheets, warnings: parsed.warnings });
  const entry = { id, fileName, at, source, rows: parsed.rows.length, groups: countByGroup(parsed.rows), layouts: parsed.sheets.map((s) => s.layout), warnings: parsed.warnings.slice(0, 20), players: new Set(parsed.rows.map((r) => r.player)).size, teams: [...new Set(parsed.rows.map((r) => r.team).filter(Boolean))].sort() };
  idx.sheets = [...idx.sheets.filter((s) => s.id !== id), entry].sort((a, b) => a.at.localeCompare(b.at));
  await writeJson(SHEETS_INDEX(wk.season, wk), idx);
  return { ok: true, replaced: !!existing, ...entry, week: wk };
}

export async function deleteSheet(wk, id) {
  const idx = (await readJson(SHEETS_INDEX(wk.season, wk))) || { sheets: [] };
  const hit = idx.sheets.find((s) => s.id === id);
  if (!hit) return false;
  idx.sheets = idx.sheets.filter((s) => s.id !== id);
  await writeJson(SHEETS_INDEX(wk.season, wk), idx);
  await writeJson(SHEET(wk.season, wk, id), { id, deleted: true, rows: [] });
  return true;
}

async function loadSheets(wk) {
  const idx = await listSheets(wk);
  const files = await Promise.all(idx.map((s) => readJson(SHEET(wk.season, wk, s.id))));
  return files.filter((f) => f && !f.deleted);
}

/** Pull PropFinder for the week's teams and store it; the outcome goes to nfl/meta/propfinder-pull.json. */
export async function pullPropfinderWeek(wk, { force = false } = {}) {
  const at = new Date().toISOString();
  const done = async (r) => { await writeJson(PF_META, { at, season: wk.season, week: wk.week, type: wk.type, ...r }); return { at, week: wk, ...r }; };
  if (!propfinderConfigured()) return done({ ok: false, skipped: 'PropFinder credentials are not configured (PROPFINDER_EMAIL / PROPFINDER_PASSWORD)' });
  const { schedule } = await ensureSchedule(wk, { results: false });
  if (!schedule?.games?.length) return done({ ok: false, skipped: 'no games in the week' });
  if (!force) {
    const last = await readJson(PF_META);
    if (last?.ok && last.week === wk.week && last.season === wk.season && last.at && Date.now() - Date.parse(last.at) < 30 * 60 * 1000) return { at: last.at, week: wk, ok: true, skipped: 'pulled in the last 30 minutes' };
  }
  try {
    const pulled = await pullWeek({ season: wk.season, games: schedule.games, at });
    if (!pulled.ok) return done(pulled);
    const { data, ...meta } = pulled;
    await writeJson(PROPFINDER(wk.season, wk), { ...meta, week: wk, data });
    return done(meta);
  } catch (err) {
    console.error('[nfl] PropFinder pull failed:', err);
    return done({ ok: false, error: String(err?.message || err) });
  }
}

/** The board for a week: schedule (refreshed when stale), the sheets, the PropFinder file and the finished games. */
export async function boardFor(wk, { refresh = true } = {}) {
  let schedule = await readJson(SCHEDULE(wk.season, wk));
  if (refresh || !schedule) {
    try { ({ schedule } = await ensureSchedule(wk)); } catch (err) { if (!schedule) return { season: wk.season, week: wk.week, type: wk.type, games: [], plays: 0, notes: [`The week's schedule could not be fetched: ${err.message}`], sources: { sheets: [], propfinder: null, results: 0 }, error: err.message }; }
  }
  const games = schedule?.games || [];
  const [sheets, pf, results] = await Promise.all([loadSheets(wk), readJson(PROPFINDER(wk.season, wk)), loadResults(wk, games)]);
  const board = buildBoard({ season: wk.season, week: wk.week, type: wk.type, games, sheets, pf, results });
  return { ...board, label: wk.label || null, byes: schedule?.byes || [], scheduleAt: schedule?.fetchedAt || null };
}

/** Where the week's data stands, for the Data sources panel and the start screen. */
export async function statusFor(wk) {
  const [schedule, sheets, pf, pfMeta, refresh] = await Promise.all([readJson(SCHEDULE(wk.season, wk)), listSheets(wk), readJson(PROPFINDER(wk.season, wk)), readJson(PF_META), readJson(REFRESH_META)]);
  const games = schedule?.games || [];
  const finals = games.filter((g) => g.final);
  const results = (await Promise.all(finals.map((g) => readJson(RESULT(wk.season, wk, g.id))))).filter(Boolean).length;
  return {
    week: wk,
    schedule: schedule ? { games: games.length, finals: finals.length, fetchedAt: schedule.fetchedAt, nextKickoff: games.filter((g) => !g.final).map((g) => g.date).sort()[0] || null } : null,
    results, sheets,
    propfinder: { configured: propfinderConfigured(), file: pf ? { at: pf.at, players: pf.players, withProps: pf.withProps, withGames: pf.withGames, defenseTeams: pf.defenseTeams, missingTeams: pf.missingTeams || [], fieldsSeen: pf.fieldsSeen || null } : null, last: pfMeta || null },
    refresh: refresh || null,
  };
}

/** Which seasons / weeks hold stored data (for the week picker's dots). */
export async function weeksWithData(season) {
  const names = await listNames(`nfl/${season}`).catch(() => []);
  return names.filter((n) => /^(w\d{2}|p\d)$/.test(n)).sort();
}

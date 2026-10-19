// Storage for a sport's board, in the same private bucket as the NHL model:
//   <sport>/<slate>/schedule.json           the slate's games and scores (ESPN)
//   <sport>/<slate>/sheets/<id>.json        a parsed cheat sheet (rows + meta)
//   <sport>/<slate>/sheets-index.json       the slate's sheets
//   <sport>/<slate>/propfinder.json         the slate's PropFinder pull (players, lines, defenses)
//   <sport>/<slate>/results/<gameId>.json   a finished game's box score (ESPN)
//   <sport>/meta/*.json                     last refresh / pull outcomes
// A slate is an NFL week ({ season, week, type }) or an NBA date ({ date }); the sport's config
// says how it keys, resolves and fetches.
import crypto from 'crypto';
import { readJson, writeJson } from '../nhl-store';

const SCHEDULE_FRESH_MS = 6 * 3600 * 1000;      // a quiet slate's schedule
const SCHEDULE_LIVE_MS = 10 * 60 * 1000;        // while a game is on or just finished

/**
 * { sport ('nfl' | 'nba'), slateKey(slate) → path segment, seasonOf(slate) → the logs' season,
 *   resolveSlate(params) → slate (async), slateFromFileName(name, resolveSlate) → slate (async),
 *   fetchSchedule(slate) → { games, extra }, fetchSummary(gameId), parseCheatSheet, countByGroup,
 *   pullSlate, buildBoard, propfinderConfigured, slateLabel(slate), sameSlate(a, b) }
 */
export function makeStore(cfg) {
  const { sport, slateKey } = cfg;
  const P = {
    schedule: (s) => `${sport}/${slateKey(s)}/schedule.json`,
    index: (s) => `${sport}/${slateKey(s)}/sheets-index.json`,
    sheet: (s, id) => `${sport}/${slateKey(s)}/sheets/${id}.json`,
    propfinder: (s) => `${sport}/${slateKey(s)}/propfinder.json`,
    result: (s, gameId) => `${sport}/${slateKey(s)}/results/${gameId}.json`,
    refreshMeta: `${sport}/meta/refresh.json`,
    pfMeta: `${sport}/meta/propfinder-pull.json`,
    publicMarker: `${sport}/meta/public-refresh.json`,
  };

  /** The slate's schedule, fetched when missing, stale, or live; finished games' box scores stored alongside. */
  async function ensureSchedule(slate, { force = false, results = true } = {}) {
    const path = P.schedule(slate);
    let sched = await readJson(path);
    const now = Date.now();
    const live = sched?.games?.some((g) => g.state === 'in' || (!g.final && Date.parse(g.date) < now && now - Date.parse(g.date) < 5 * 3600 * 1000));
    const stale = !sched?.fetchedAt || now - Date.parse(sched.fetchedAt) > (live ? SCHEDULE_LIVE_MS : SCHEDULE_FRESH_MS);
    let fetched = false;
    if (force || stale) {
      try {
        const got = await cfg.fetchSchedule(slate);
        if (got) {
          sched = { slate, games: got.games, ...(got.extra || {}), fetchedAt: got.fetchedAt || new Date().toISOString() };
          await writeJson(path, sched);
          fetched = true;
        }
      } catch (err) {
        console.error(`[${sport}] schedule fetch failed:`, err?.message || err);
        if (!sched) throw err;
      }
    }
    let stored = 0;
    if (results && sched?.games) {
      for (const g of sched.games) {
        if (!g.final) continue;
        if (await readJson(P.result(slate, g.id))) continue;
        try {
          const sum = await cfg.fetchSummary(g.id);
          if (sum?.final && sum.players?.length) { await writeJson(P.result(slate, g.id), { ...sum, storedAt: new Date().toISOString() }); stored++; }
        } catch (err) { console.error(`[${sport}] summary fetch failed:`, g.id, err?.message || err); }
      }
    }
    if (fetched || stored) await writeJson(P.refreshMeta, { at: new Date().toISOString(), slate, games: sched?.games?.length || 0, finals: (sched?.games || []).filter((g) => g.final).length, resultsStored: stored });
    return { schedule: sched, fetched, resultsStored: stored };
  }

  async function loadResults(slate, games) {
    const out = {};
    await Promise.all((games || []).filter((g) => g.final).map(async (g) => { const r = await readJson(P.result(slate, g.id)); if (r) out[g.id] = r; }));
    return out;
  }

  async function listSheets(slate) {
    const idx = await readJson(P.index(slate));
    return idx?.sheets || [];
  }

  /**
   * Store a cheat sheet for the slate its name says, or the one given, or today's. A file with
   * the name of one already stored replaces it.
   */
  async function ingestCheatSheet({ buffer, text, fileName, slate = null, source = 'upload' }) {
    const s = slate || await cfg.slateFromFileName(fileName);
    const parsed = cfg.parseCheatSheet({ buffer, text, fileName });
    if (!parsed.rows.length) return { ok: false, fileName, slate: s, warnings: parsed.warnings, rows: 0 };
    const at = new Date().toISOString();
    const idx = (await readJson(P.index(s))) || { sheets: [] };
    const existing = idx.sheets.find((x) => x.fileName === fileName);
    const id = existing?.id || `${at.slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex')}`;
    await writeJson(P.sheet(s, id), { id, fileName, at, source, slate: s, rows: parsed.rows, sheets: parsed.sheets, warnings: parsed.warnings });
    const entry = { id, fileName, at, source, rows: parsed.rows.length, groups: cfg.countByGroup(parsed.rows), layouts: parsed.sheets.map((x) => x.layout), warnings: parsed.warnings.slice(0, 20), players: new Set(parsed.rows.map((r) => r.player)).size, teams: [...new Set(parsed.rows.map((r) => r.team).filter(Boolean))].sort() };
    idx.sheets = [...idx.sheets.filter((x) => x.id !== id), entry].sort((a, b) => a.at.localeCompare(b.at));
    await writeJson(P.index(s), idx);
    return { ok: true, replaced: !!existing, ...entry, slate: s };
  }

  async function deleteSheet(slate, id) {
    const idx = (await readJson(P.index(slate))) || { sheets: [] };
    if (!idx.sheets.find((x) => x.id === id)) return false;
    idx.sheets = idx.sheets.filter((x) => x.id !== id);
    await writeJson(P.index(slate), idx);
    await writeJson(P.sheet(slate, id), { id, deleted: true, rows: [] });
    return true;
  }

  async function loadSheets(slate) {
    const idx = await listSheets(slate);
    const files = await Promise.all(idx.map((x) => readJson(P.sheet(slate, x.id))));
    return files.filter((f) => f && !f.deleted);
  }

  /** Pull PropFinder for the slate's teams and store it; the outcome goes to <sport>/meta/propfinder-pull.json. */
  async function pullPropfinder(slate, { force = false } = {}) {
    const at = new Date().toISOString();
    const done = async (r) => { await writeJson(P.pfMeta, { at, slate, ...r }); return { at, slate, ...r }; };
    if (!cfg.propfinderConfigured()) return done({ ok: false, skipped: 'PropFinder credentials are not configured (PROPFINDER_EMAIL / PROPFINDER_PASSWORD)' });
    const { schedule } = await ensureSchedule(slate, { results: false });
    if (!schedule?.games?.length) return done({ ok: false, skipped: 'no games in the slate' });
    if (!force) {
      const last = await readJson(P.pfMeta);
      if (last?.ok && cfg.sameSlate(last.slate, slate) && last.at && Date.now() - Date.parse(last.at) < 30 * 60 * 1000) return { at: last.at, slate, ok: true, skipped: 'pulled in the last 30 minutes' };
    }
    try {
      const pulled = await cfg.pullSlate({ season: cfg.seasonOf(slate), games: schedule.games, at });
      if (!pulled.ok) return done(pulled);
      const { data, ...meta } = pulled;
      await writeJson(P.propfinder(slate), { ...meta, slate, data });
      return done(meta);
    } catch (err) {
      console.error(`[${sport}] PropFinder pull failed:`, err);
      return done({ ok: false, error: String(err?.message || err) });
    }
  }

  /** The board for a slate: schedule (refreshed when stale), the sheets, the PropFinder file and the finished games. */
  async function boardFor(slate, { refresh = true } = {}) {
    let schedule = await readJson(P.schedule(slate));
    if (refresh || !schedule) {
      try { ({ schedule } = await ensureSchedule(slate)); } catch (err) { if (!schedule) return { ...slate, games: [], plays: 0, notes: [`The slate's schedule could not be fetched: ${err.message}`], sources: { sheets: [], propfinder: null, results: 0 }, error: err.message }; }
    }
    const games = schedule?.games || [];
    const [sheets, pf, results] = await Promise.all([loadSheets(slate), readJson(P.propfinder(slate)), loadResults(slate, games)]);
    const board = cfg.buildBoard({ ...slate, season: cfg.seasonOf(slate), games, sheets, pf, results });
    const { games: _g, fetchedAt, slate: _s, ...extra } = schedule || {};
    return { ...board, ...extra, label: cfg.slateLabel(slate), scheduleAt: fetchedAt || null };
  }

  /** Where the slate's data stands, for the Data sources panel and the start screen. */
  async function statusFor(slate) {
    const [schedule, sheets, pf, pfMeta, refresh] = await Promise.all([readJson(P.schedule(slate)), listSheets(slate), readJson(P.propfinder(slate)), readJson(P.pfMeta), readJson(P.refreshMeta)]);
    const games = schedule?.games || [];
    const finals = games.filter((g) => g.final);
    const results = (await Promise.all(finals.map((g) => readJson(P.result(slate, g.id))))).filter(Boolean).length;
    return {
      slate, label: cfg.slateLabel(slate),
      schedule: schedule ? { games: games.length, finals: finals.length, fetchedAt: schedule.fetchedAt, nextStart: games.filter((g) => !g.final).map((g) => g.date).sort()[0] || null } : null,
      results, sheets,
      propfinder: { configured: cfg.propfinderConfigured(), file: pf ? { at: pf.at, players: pf.players, withProps: pf.withProps, withGames: pf.withGames, defenseTeams: pf.defenseTeams, missingTeams: pf.missingTeams || [], fieldsSeen: pf.fieldsSeen || null } : null, last: pfMeta || null },
      refresh: refresh || null,
    };
  }

  /** The anonymous-refresh throttle marker: true when a public call may run now. */
  async function publicRefreshAllowed(minGapMs) {
    const last = await readJson(P.publicMarker);
    if (last?.at && Date.now() - Date.parse(last.at) < minGapMs) return { ok: false, lastRun: last.at };
    await writeJson(P.publicMarker, { at: new Date().toISOString() });
    return { ok: true };
  }

  return { P, ensureSchedule, loadResults, listSheets, ingestCheatSheet, deleteSheet, loadSheets, pullPropfinder, boardFor, statusFor, publicRefreshAllowed, resolveSlate: cfg.resolveSlate, slateLabel: cfg.slateLabel };
}

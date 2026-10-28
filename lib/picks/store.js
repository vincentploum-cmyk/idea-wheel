// Storage for a sport's board, in the same private bucket as the NHL model:
//   <sport>/<slate>/schedule.json           the slate's games and scores (ESPN)
//   <sport>/<slate>/sheets/<id>.json        a parsed cheat sheet (rows + meta)
//   <sport>/<slate>/sheets/<id>.pdf         an image PDF kept for OCR (and a re-read)
//   <sport>/<slate>/sheets/<id>.ocr.json    the OCR words per page (a re-parse needs no new read)
//   <sport>/<slate>/sheets-index.json       the slate's sheets
//   <sport>/<slate>/propfinder.json         the slate's PropFinder pull (players, lines, defenses)
//   <sport>/<slate>/results/<gameId>.json   a finished game's box score (ESPN)
//   <sport>/meta/*.json                     last refresh / pull outcomes
// A slate is an NFL week ({ season, week, type }) or an NBA date ({ date }); the sport's config
// says how it keys, resolves and fetches.
import crypto from 'crypto';
import { readJson, writeJson, writeBlob, readBlob } from '../nhl-store';
import { inputsMemo } from '../memo';
import { pdfTables } from './pdf';
import { pdfImages, ocrPdf } from './ocr';
import { absentByTeam, withoutOf, shortNames, withoutWeight, applyOverrides, teammateSplits, statusOf } from './injuries';
import { asOf, gradeBoard, gradePredictors, summarize } from './scorecard';

const SCORE_MEMO_MS = 10 * 60 * 1000;      // a graded slate is kept this long

const PREVIEW_ROWS = 40;
const OCR_MAX_PAGES = 40;
const ocrJobs = new Map();   // running OCR jobs by sheet path, one at a time per sheet

const SCHEDULE_FRESH_MS = 6 * 3600 * 1000;      // a quiet slate's schedule
const SCHEDULE_LIVE_MS = 10 * 60 * 1000;        // while a game is on or just finished

/**
 * { sport ('nfl' | 'nba'), slateKey(slate) → path segment, seasonOf(slate) → the logs' season,
 *   resolveSlate(params) → slate (async), slateFromFileName(name, resolveSlate) → slate (async),
 *   fetchSchedule(slate) → { games, extra }, fetchSummary(gameId), parseCheatSheet, countByGroup,
 *   parseOcrPages(pages, { roster, schedule }) → { rows, games, warnings, preview } for an image PDF (optional),
 *   nearSlates(slate) → the slates whose PropFinder pull may stand in as the roster (optional),
 *   pullSlate, buildBoard, propfinderConfigured, slateLabel(slate), sameSlate(a, b),
 *   shuffleOf (lib/picks/shuffle.js, optional), actualFor, statOf, marketKeys (the scorecard's market order) }
 */
export function makeStore(cfg) {
  const { sport, slateKey } = cfg;
  const scoreMemo = new Map();   // slate key → { at, value }: a finished slate's grading
  // The board and the shuffle are pure over the slate's stored files (the same objects between
  // requests until one is written): the picks, the shuffle, the status and the start screen
  // read the same board instead of each building it.
  const boardMemo = inputsMemo({ max: 4 });
  const shuffleMemo = inputsMemo({ max: 8 });
  const pfMemo = inputsMemo({ max: 4 });

  /** The slate's pull with the admin's injury overrides applied (lib/picks/injuries.js applyOverrides), the same object while both files are. */
  async function pfFor(slate) {
    const [pf, overrides] = await Promise.all([readJson(P.propfinder(slate)), readJson(P.overrides(slate))]);   // a write through setOverride drops the cached copy
    if (!pf) return null;
    const o = overrides?.players || null;
    return o && Object.keys(o).length ? pfMemo.get([pf, overrides], () => applyOverrides(pf, o)) : pf;
  }

  /** The slate's injury overrides as stored: { players: { "<TEAM>|<key>": { status, detail, name, at } } }. */
  async function loadOverrides(slate) { return (await readJson(P.overrides(slate))) || { players: {} }; }

  /**
   * The admin's word over the report for one player on the slate: status 'Active' (he plays) or
   * 'Out', with a detail; null clears it. The board, the shuffle and the card read the pull
   * through it at once (`pfFor`).
   */
  async function setOverride(slate, { team, key, status, detail = null, name = null }) {
    if (!team || !key) throw new Error('team and key are required');
    const cur = await loadOverrides(slate);
    const players = { ...(cur.players || {}) };
    const k = `${team}|${key}`;
    if (!status) delete players[k];
    else players[k] = { status: statusOf(status), detail: detail || null, name: name || null, at: new Date().toISOString() };
    const next = { ...cur, players, updatedAt: new Date().toISOString() };
    await writeJson(P.overrides(slate), next);
    return next;
  }
  const P = {
    schedule: (s) => `${sport}/${slateKey(s)}/schedule.json`,
    index: (s) => `${sport}/${slateKey(s)}/sheets-index.json`,
    sheet: (s, id) => `${sport}/${slateKey(s)}/sheets/${id}.json`,
    sheetPdf: (s, id) => `${sport}/${slateKey(s)}/sheets/${id}.pdf`,
    sheetOcr: (s, id) => `${sport}/${slateKey(s)}/sheets/${id}.ocr.json`,
    propfinder: (s) => `${sport}/${slateKey(s)}/propfinder.json`,
    overrides: (s) => `${sport}/${slateKey(s)}/injury-overrides.json`,
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

  // The sheets index is read past the cache: an OCR job writes it page by page from another
  // route's module instance, and the panel polls it.
  const readIndex = (s) => readJson(P.index(s), { fresh: true });

  async function listSheets(slate) {
    const idx = await readIndex(slate);
    return idx?.sheets || [];
  }

  const newId = (at) => `${at.slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex')}`;
  const entryOf = ({ id, fileName, at, source, rows, sheets = [], warnings = [], pages = null, preview = null, ocr = null }) => ({
    id, fileName, at, source, rows: rows.length, groups: cfg.countByGroup(rows), layouts: [...new Set(sheets.map((x) => x.layout))], warnings: warnings.slice(0, 20),
    players: new Set(rows.map((r) => r.player)).size, teams: [...new Set(rows.map((r) => r.team).filter(Boolean))].sort(), pages, preview: preview ? preview.slice(0, 12) : null, ...(ocr ? { ocr } : {}),
  });
  async function putEntry(s, entry) {
    const idx = (await readIndex(s)) || { sheets: [] };
    idx.sheets = [...idx.sheets.filter((x) => x.id !== entry.id), entry].sort((a, b) => a.at.localeCompare(b.at));
    await writeJson(P.index(s), idx);
  }
  async function patchEntry(s, id, patch) {
    const idx = (await readIndex(s)) || { sheets: [] };
    const cur = idx.sheets.find((x) => x.id === id);
    if (!cur) return null;
    const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch };
    idx.sheets = idx.sheets.map((x) => (x.id === id ? next : x));
    await writeJson(P.index(s), idx);
    return next;
  }

  /**
   * Store a cheat sheet for the slate its name says, or the one given, or today's. A file with
   * the name of one already stored replaces it. A PDF made of pictures (no text to parse) is
   * read by OCR in the background when the sport knows the layout (`cfg.parseOcrPages`): the
   * sheet is registered at once with `ocr.status` pending and its rows land when the read is done.
   */
  async function ingestCheatSheet({ buffer, text, fileName, slate = null, source = 'upload' }) {
    const s = slate || await cfg.slateFromFileName(fileName);
    // A PDF's pages become tables first; the first rows read are kept with the sheet so the
    // layout can be checked on the site when nothing parses.
    let tables = null;
    if (/\.pdf$/i.test(fileName || '')) {
      try { tables = await pdfTables(buffer); }
      catch (err) { return { ok: false, fileName, slate: s, warnings: [`Could not read the PDF: ${err.message}`], rows: 0 }; }
    }
    const parsed = cfg.parseCheatSheet({ buffer, text, fileName, tables });
    const preview = tables ? tables.flatMap((t) => t.rows.filter((r) => r.some((c) => String(c).trim())).map((r) => r.join(' | '))).slice(0, PREVIEW_ROWS) : null;
    const pages = tables ? tables.length : null;
    const at = new Date().toISOString();
    const idx = (await readIndex(s)) || { sheets: [] };
    const existing = idx.sheets.find((x) => x.fileName === fileName);
    const id = existing?.id || newId(at);
    if (!parsed.rows.length) {
      // Pictures of tables: read them with OCR when the sport has a layout for it.
      const images = tables ? pdfImages(buffer) : [];
      if (images.length && images.length >= (pages || 1) && cfg.parseOcrPages) {
        await writeBlob(P.sheetPdf(s, id), new Blob([buffer], { type: 'application/pdf' }), 'application/pdf');
        const ocr = { status: 'pending', page: 0, pages: Math.min(images.length, OCR_MAX_PAGES), startedAt: at };
        const entry = entryOf({ id, fileName, at, source, rows: [], pages: images.length, ocr });
        await putEntry(s, entry);
        await writeJson(P.sheet(s, id), { id, fileName, at, source, slate: s, rows: [], sheets: [], warnings: [], preview: null, pages: images.length, ocr });
        startOcrJob(s, id, buffer);
        return { ok: true, pending: true, replaced: !!existing, ...entry, slate: s };
      }
      return { ok: false, fileName, slate: s, warnings: parsed.warnings, rows: 0, preview, pages };
    }
    await writeJson(P.sheet(s, id), { id, fileName, at, source, slate: s, rows: parsed.rows, sheets: parsed.sheets, warnings: parsed.warnings, preview, pages });
    const entry = entryOf({ id, fileName, at, source, rows: parsed.rows, sheets: parsed.sheets, warnings: parsed.warnings, pages, preview });
    await putEntry(s, entry);
    return { ok: true, replaced: !!existing, ...entry, slate: s };
  }

  /**
   * The PropFinder players as a roster for name matching: [{ name, team, pos }], from the
   * slate's pull, else the nearest slate's (`cfg.nearSlates`; rosters barely move week to week).
   */
  async function rosterFor(s) {
    for (const slate of [s, ...(cfg.nearSlates ? cfg.nearSlates(s) : [])]) {
      const pf = await readJson(P.propfinder(slate));
      const roster = (pf?.data?.players || []).map((p) => ({ name: p.name, team: p.team || null, pos: p.pos || null })).filter((p) => p.name);
      if (roster.length) return roster;
    }
    return [];
  }

  /** Start the OCR read of a stored image PDF in the background (one job per sheet at a time). */
  function startOcrJob(s, id, buffer) {
    const key = P.sheet(s, id);
    if (ocrJobs.has(key)) return ocrJobs.get(key);
    const job = runOcrJob(s, id, buffer).catch((err) => console.error(`[${sport}] OCR job failed:`, err)).finally(() => ocrJobs.delete(key));
    ocrJobs.set(key, job);
    return job;
  }

  async function runOcrJob(s, id, buffer) {
    let pages;
    try {
      pages = await ocrPdf(buffer, {
        maxPages: OCR_MAX_PAGES,
        onPage: async (n, total) => { await patchEntry(s, id, (cur) => ({ ...cur, ocr: { ...(cur.ocr || {}), status: 'pending', page: n, pages: total } })).catch(() => {}); },
      });
      await writeJson(P.sheetOcr(s, id), { id, at: new Date().toISOString(), pages });
    } catch (err) {
      console.error(`[${sport}] OCR read failed:`, err);
      await patchEntry(s, id, (cur) => ({ ...cur, ocr: { ...(cur.ocr || {}), status: 'failed', error: String(err?.message || err), finishedAt: new Date().toISOString() } }));
      return;
    }
    await parseOcrSheet(s, id, pages);
  }

  /** Turn a sheet's OCR words into its rows and store them (the read's outcome on the index entry). */
  async function parseOcrSheet(s, id, pages) {
    const cur = await readJson(P.sheet(s, id));
    if (!cur || cur.deleted) return null;
    const finishedAt = new Date().toISOString();
    try {
      const roster = await rosterFor(s);
      const schedule = (await readJson(P.schedule(s)))?.games || [];
      const parsed = cfg.parseOcrPages(pages, { roster, schedule: schedule.map((g) => ({ away: g.away, home: g.home })) });
      const warnings = [...(parsed.warnings || [])];
      if (!roster.length) warnings.unshift('No PropFinder pull for this slate yet: names were kept as the OCR read them. Pull PropFinder, then "Read again" to match them.');
      const ocr = { status: parsed.rows.length ? 'done' : 'failed', page: pages.length, pages: pages.length, startedAt: cur.ocr?.startedAt || cur.at, finishedAt, games: parsed.games || [], roster: roster.length, ...(parsed.rows.length ? {} : { error: 'No prop rows read from the pages' }) };
      const preview = parsed.preview || null;
      const sheet = { ...cur, rows: parsed.rows, sheets: [{ name: 'ocr', layout: 'ocr', rows: parsed.rows.length }], warnings, preview, pages: pages.length, ocr, meta: parsed.meta || null };
      await writeJson(P.sheet(s, id), sheet);
      const entry = entryOf({ id, fileName: cur.fileName, at: cur.at, source: cur.source, rows: parsed.rows, sheets: sheet.sheets, warnings, pages: pages.length, preview, ocr });
      await putEntry(s, entry);
      return entry;
    } catch (err) {
      console.error(`[${sport}] OCR parse failed:`, err);
      return patchEntry(s, id, (c) => ({ ...c, ocr: { ...(c.ocr || {}), status: 'failed', error: String(err?.message || err), finishedAt } }));
    }
  }

  /**
   * Read a stored image PDF again: from its stored OCR words (a re-parse, seconds) unless
   * `full`, which runs OCR over the stored PDF once more. Returns the index entry, or null.
   */
  async function rereadSheet(s, id, { full = false } = {}) {
    const idx = (await readIndex(s)) || { sheets: [] };
    const cur = idx.sheets.find((x) => x.id === id);
    if (!cur) return null;
    if (ocrJobs.has(P.sheet(s, id))) return { ...cur, running: true };
    if (!full) {
      const words = await readJson(P.sheetOcr(s, id));
      if (words?.pages?.length) return parseOcrSheet(s, id, words.pages);
    }
    const blob = await readBlob(P.sheetPdf(s, id));
    if (!blob) return { ...cur, error: 'The PDF is not stored for this sheet' };
    const buffer = Buffer.from(await blob.arrayBuffer());
    const entry = await patchEntry(s, id, (c) => ({ ...c, ocr: { ...(c.ocr || {}), status: 'pending', page: 0, startedAt: new Date().toISOString(), error: undefined } }));
    startOcrJob(s, id, buffer);
    return { ...entry, pending: true };
  }

  async function deleteSheet(slate, id) {
    const idx = (await readIndex(slate)) || { sheets: [] };
    if (!idx.sheets.find((x) => x.id === id)) return false;
    idx.sheets = idx.sheets.filter((x) => x.id !== id);
    await writeJson(P.index(slate), idx);
    await writeJson(P.sheet(slate, id), { id, deleted: true, rows: [] });
    return true;
  }

  async function loadSheets(slate) {
    const idx = await listSheets(slate);
    // A sheet an OCR job is filling is read past the cache, so its rows reach the board at once;
    // once the index says the read is done (or failed) the stored file no longer changes, so it
    // is read through the cache like any other, unless the cached copy is still the pending one.
    const files = await Promise.all(idx.map(async (x) => {
      const pending = x.ocr?.status === 'pending';
      let file = await readJson(P.sheet(slate, x.id), { fresh: pending });
      if (!pending && x.ocr && file?.ocr?.status !== x.ocr.status) file = await readJson(P.sheet(slate, x.id), { fresh: true });
      return file;
    }));
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
    const [sheets, pf, results] = await Promise.all([loadSheets(slate), pfFor(slate), loadResults(slate, games)]);
    const board = boardMemo.get([schedule, pf, ...sheets, ...games.map((g) => results[g.id] || null)], () => cfg.buildBoard({ ...slate, season: cfg.seasonOf(slate), games, sheets, pf, results }));
    const { games: _g, fetchedAt, slate: _s, ...extra } = schedule || {};
    return { ...board, ...extra, label: cfg.slateLabel(slate), scheduleAt: fetchedAt || null };
  }

  /**
   * One player's card data from the slate's PropFinder pull: his logs (newest first), his lines,
   * the game he plays and what the opponent gives up at his position (rows + ranks, the league's
   * average per position beside them and the last-N windows), or null. `board` is his entry on the
   * slate's board (sidesOf in board.js: the spot his environment is read at, the side's scale, his
   * ranges and ladders per market, his plays), so the card shows the board's projection and ladder
   * whichever view opened it; null when the board has no row for him.
   */
  async function playerFor(slate, key) {
    const [pf, schedule] = await Promise.all([pfFor(slate), readJson(P.schedule(slate))]);
    const players = pf?.data?.players || [];
    const p = players.find((x) => x.key === key) || null;
    if (!p) return null;
    let board = null;
    try {
      const built = await boardFor(slate, { refresh: false });
      const bg = (built.games || []).find((x) => x.away === p.team || x.home === p.team) || null;
      const side = bg?.sides?.[p.team] || null;
      const bp = side?.players?.find((x) => x.key === key) || null;
      if (bp) board = { k: side.allowed?.k ?? null, envPos: bp.envPos || null, slot: bp.slot || null, depth: bp.depth || null, scale: bp.scale || {}, teamProj: side.teamProj || {}, share: side.share ?? null, ranges: bp.ranges || {}, ladders: bp.ladders || {}, plays: bp.plays || [] };
    } catch (err) {
      console.warn(`[${sport}] player card: the board could not be built:`, err.message);
    }
    const g = (schedule?.games || []).find((x) => x.away === p.team || x.home === p.team) || null;
    const opp = g ? (g.away === p.team ? g.home : g.away) : null;
    const defense = pf?.data?.defense || null;
    const META = ['gp', 'season', 'prior', 'priorSeason', 'lastN', 'held'];
    const tableOf = (d) => (opp && d?.teams?.[opp] ? Object.fromEntries(Object.entries(d.teams[opp]).map(([pos, row]) => [pos, Object.fromEntries(Object.entries(row).map(([k, v]) => [k, META.includes(k) ? v : { value: v, rank: d.ranks?.[opp]?.[pos]?.[k] ?? null }]))])) : null);
    const allowed = tableOf(defense);
    const windows = {};
    for (const [k, w] of Object.entries(defense?.windows || {})) { const t = tableOf(w); if (t) windows[k] = { rows: t, league: w.league || null, count: w.count || null, lastN: w.lastN, season: w.season || null }; }
    // Last season's full table, the tab the card compares the season table against.
    const priorRows = defense?.prior ? tableOf(defense.prior) : null;
    const prior = priorRows ? { rows: priorRows, league: defense.prior.league || null, count: defense.prior.count || null, season: defense.prior.season || null } : null;
    const games = [...(p.games || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    // His games without the key teammates out tonight (the card's "w/o" split) and his team's report.
    const wo = withoutOf({ ...p, games }, absentByTeam(pf)[p.team]);
    const injuries = (pf?.data?.injuries?.rows || []).filter((r) => r.team === p.team);
    // With and without each regular teammate (PropFinder's Lineup Lab as far as the logs reach).
    const teammates = teammateSplits({ ...p, games }, players.filter((x) => x.team === p.team), { season: cfg.seasonOf(slate) });
    return {
      player: { id: p.id, name: p.name, key: p.key, team: p.team, pos: p.pos, status: p.status, injury: p.injury, injuryDetail: p.injuryDetail || null, injuryFrom: p.injuryFrom || null, injuryRaw: p.injuryRaw || null, injuryDate: p.injuryDate || null, injuryStale: p.injuryStale || null, override: p.injuryOverride || null },
      without: wo ? { absent: wo.absent, names: shortNames(wo.absent), n: wo.n, weight: withoutWeight(wo.n), gameIds: wo.games.map((x) => x.gameId) } : null,
      injuries, teammates,
      games, props: p.props || [], game: g ? { id: g.id, date: g.date, away: g.away, home: g.home, final: !!g.final } : null,
      opp, venue: g ? (g.home === p.team ? 'H' : 'A') : null, allowed, league: defense?.league || null, windows, prior, count: defense?.count || null, pulledAt: pf?.at || null, season: cfg.seasonOf(slate),
      board,
    };
  }

  /** The shuffle for a slate and market: every player read at every height of the bar (lib/picks/shuffle.js). */
  async function shuffleFor(slate, market) {
    if (!cfg.shuffleOf) return null;
    const board = await boardFor(slate, { refresh: false });
    const [pf, results] = await Promise.all([pfFor(slate), loadResults(slate, board.games || [])]);
    const games = board.games || [];
    return shuffleMemo.get([market, board.games, pf, ...games.map((g) => results[g.id] || null)], () => cfg.shuffleOf({ market, board, pf, season: cfg.seasonOf(slate), results }));
  }

  /**
   * One slate replayed from its stored files and graded (lib/picks/scorecard.js), each player's
   * PropFinder log cut before his game so a later pull cannot leak the game into its own read.
   * A slate whose games have all finished is kept for ten minutes.
   */
  async function gradeSlate(slate) {
    const key = slateKey(slate);
    const hit = scoreMemo.get(key);
    if (hit && Date.now() - hit.at < SCORE_MEMO_MS) return hit.value;
    const schedule = await readJson(P.schedule(slate));
    const games = schedule?.games || [];
    const label = cfg.slateLabel(slate);
    let value;
    if (!games.some((g) => g.final)) value = { key, label, games: games.length, finals: 0, graded: 0, plays: [], rungs: [] };
    else {
      const [sheets, pf, results] = await Promise.all([loadSheets(slate), readJson(P.propfinder(slate)), loadResults(slate, games)]);
      const cut = asOf(pf, games);
      const season = cfg.seasonOf(slate);
      const board = cfg.buildBoard({ ...slate, season, games, sheets, pf: cut, results });
      const actualOf = cfg.actualFor && cfg.statOf
        ? (g, p, market) => { const line = cfg.actualFor(results[g.id], p); return line === undefined ? undefined : line && line.played !== false ? cfg.statOf(line, market) : null; }
        : null;
      value = gradeBoard(board, { key, label, actualOf });
      // The windows of each player's own results as predictors of his figure, beside the board's read.
      if (actualOf && cfg.ownWindows) value.pred = gradePredictors(board, cut, { key, season, actualOf, ownWindows: cfg.ownWindows });
    }
    if (games.length && games.every((g) => g.final)) scoreMemo.set(key, { at: Date.now(), value });
    return value;
  }

  /** The scorecard over the slates given: every finished game's plays and ladders graded, summarised. */
  async function scorecardFor(slates, range = {}) {
    const graded = [];
    for (const s of slates) graded.push(await gradeSlate(s));   // one slate at a time: each reads several files
    return summarize(graded.filter((g) => g.finals), { ...range, markets: cfg.marketKeys || null, labels: cfg.marketLabels || null });
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
      propfinder: { configured: cfg.propfinderConfigured(), file: pf ? { at: pf.at, players: pf.players, withProps: pf.withProps, withGames: pf.withGames, defenseTeams: pf.defenseTeams, depthCharts: pf.depthCharts ?? null, injuries: pf.injuries || null, missingTeams: pf.missingTeams || [], fieldsSeen: pf.fieldsSeen || null } : null, last: pfMeta || null },
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

  return { P, ensureSchedule, loadResults, listSheets, ingestCheatSheet, rereadSheet, deleteSheet, playerFor, loadSheets, pullPropfinder, pfFor, loadOverrides, setOverride, boardFor, shuffleFor, gradeSlate, scorecardFor, statusFor, publicRefreshAllowed, resolveSlate: cfg.resolveSlate, slateLabel: cfg.slateLabel };
}

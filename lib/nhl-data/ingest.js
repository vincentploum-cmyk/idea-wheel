// Pulls finished games and projected lineups from the NHL API into Supabase
// Storage (bucket nhl-model, prefix data/).
import { fetchSchedule, fetchBoxscore, fetchPlayByPlay, fetchPreview, isFinal } from './api';
import { buildGameRecord } from './game';
import { lineupRows } from './lineups';
import { fetchTeamLines, latestTeamLines, parseLinesPage } from './gamedaytweets';
import { TEAMS } from './teams';
import { addDays, todayET } from './util';
import { autoRunModel } from './autorun';
import { pullPropfinder, ensurePropfinderSlate, propfinderConfigured, PF_PULL_META } from './propfinder-api';
import { readJson, writeJson } from '../nhl-store';
import { updateRosters, loadPlayers } from './rosters';
import { ingestPreseason } from './preseason';
import { snapshotPositions, applyFrozenPositions, snapshotFromPreview, positionsPath } from './positions';
import { refreshLeague } from './league';
import { syncMedia } from './media';
import { refreshMoneyPuck } from './moneypuck';

// Trailing columns (added last, so older rows still parse): posSrc 'lineup' = frozen pre-game
// position, 'box' = box-score roster code; boxPos = the box score's code; line = the frozen
// line slot (forward line 1-4, defense pair 1-3; null when the position came from the box
// score), so a box score is logged per line: LW1, LW2, LW3 … rather than one LW bucket.
export const ROW_FIELDS = ['date', 'gameId', 'playerId', 'name', 'team', 'opp', 'venue', 'pos', 'toi', 'g', 'a', 'sog', 'hits', 'blk', 'icf', 'iff', 'isf', 'iscf', 'ihdcf', 'result', 'posSrc', 'boxPos', 'line'];

export const gamesPath = (date) => `data/games/${date}.json`;
export const lineupsPath = (date) => `data/lineups/${date}.json`;
export const rowsPath = (season) => `data/rows/${season}.json`;
export const SEEN_PATH = 'data/reference/seen-players.json';

export function toRow(game, s) {
  return [game.date, game.id, s.id, s.name, s.team, s.opp, s.venue, s.pos, s.toi, s.g, s.a, s.sog, s.hits, s.blk, s.icf, s.iff, s.isf, s.iscf, s.ihdcf, s.result, s.posSource || 'box', s.boxPos ?? s.pos, s.line ?? null];
}

export function rowObj(r) {
  const o = {};
  ROW_FIELDS.forEach((k, i) => { o[k] = r[i]; });
  return o;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Ingest every finished game on `date`. Re-running is safe (idempotent). */
export async function ingestGames(date, { force = false } = {}) {
  const schedule = await fetchSchedule(date);
  const existing = (await readJson(gamesPath(date))) || { date, games: [] };
  const have = new Set(existing.games.map((g) => g.id));
  const todo = schedule.filter((g) => isFinal(g.state) && (force || !have.has(g.id)));
  const pending = schedule.filter((g) => !isFinal(g.state)).map((g) => g.id);

  const fetched = await mapLimit(todo, 4, async (g) => {
    const [box, pbp] = await Promise.all([fetchBoxscore(g.id), fetchPlayByPlay(g.id)]);
    return buildGameRecord(box, pbp);
  });
  const fresh = fetched.filter(Boolean);
  // Skaters keep the position they were frozen at before the game. Games the
  // snapshot never covered get their projected lineup from the NHL.com preview.
  let positions = { lineup: 0, preview: 0, box: 0 };
  if (fresh.length) {
    const snap = await readJson(positionsPath(date));
    const covered = fresh.filter((g) => snap?.games?.[g.id]);
    positions.lineup = applyFrozenPositions(covered, snap, 'lineup');
    const uncovered = fresh.filter((g) => !snap?.games?.[g.id]);
    const previews = await mapLimit(uncovered, 4, (g) => snapshotFromPreview(g));
    uncovered.forEach((g, i) => { if (previews[i]) positions.preview += applyFrozenPositions([g], previews[i], 'lineup'); });
    positions.box = fresh.reduce((n, g) => n + g.skaters.filter((s) => (s.posSource || 'box') === 'box').length, 0);
    positions.slotted = fresh.reduce((n, g) => n + g.skaters.filter((s) => s.line).length, 0);
    for (const g of fresh) for (const s of g.skaters) { if (!s.posSource) s.posSource = 'box'; if (s.line === undefined) s.line = null; }
  }
  if (!fresh.length && !force) {
    return { date, scheduled: schedule.length, ingested: 0, total: existing.games.length, pending };
  }

  const byId = new Map(existing.games.map((g) => [g.id, g]));
  for (const g of fresh) byId.set(g.id, g);
  const games = [...byId.values()].sort((a, b) => a.id - b.id);
  await writeJson(gamesPath(date), { date, fetchedAt: new Date().toISOString(), games });

  // Update the per-season row index used by the aggregate workbooks.
  const bySeason = {};
  for (const g of games) (bySeason[g.season] = bySeason[g.season] || []).push(g);
  for (const [season, list] of Object.entries(bySeason)) {
    const file = (await readJson(rowsPath(season))) || { season: Number(season), fields: ROW_FIELDS, rows: [] };
    const ids = new Set(list.map((g) => g.id));
    const kept = file.rows.filter((r) => !ids.has(r[1]));
    const added = list.flatMap((g) => g.skaters.map((s) => toRow(g, s)));
    const rows = [...kept, ...added].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
    await writeJson(rowsPath(season), { season: Number(season), fields: ROW_FIELDS, updatedAt: new Date().toISOString(), rows });
  }

  // Every skater who has played gets a row in the player database, even if
  // they're no longer on a current roster.
  const seen = (await readJson(SEEN_PATH)) || { players: {} };
  for (const g of fresh) {
    for (const sk of [...g.skaters, ...g.goalies.map((x) => ({ ...x, pos: 'G' }))]) {
      const prev = seen.players[sk.id];
      if (!prev || prev.lastGame <= g.date) seen.players[sk.id] = { id: sk.id, name: sk.name, team: sk.team, pos: sk.pos, lastGame: g.date };
    }
  }
  seen.updatedAt = new Date().toISOString();
  await writeJson(SEEN_PATH, seen);

  return { date, scheduled: schedule.length, ingested: fresh.length, total: games.length, pending, positions };
}

/** Games that start within the next `withinMin` minutes (and have not started). */
export function dueGames(schedule, withinMin, now = Date.now()) {
  return (schedule || []).filter((g) => {
    const t = Date.parse(g.startTimeUTC || '');
    return Number.isFinite(t) && t > now && t - now <= withinMin * 60 * 1000;
  });
}

/**
 * Pull NHL.com projected lineups and the beat writers' lines for the games on
 * `date`. With `dueWithinMin`, only games starting within that many minutes are
 * re-read (the hourly pre-game run); the other games keep what the stored file has.
 */
export async function ingestLineups(date, { dueWithinMin = null } = {}) {
  const schedule = await fetchSchedule(date);
  const prev = dueWithinMin ? await readJson(lineupsPath(date)) : null;
  const targets = dueWithinMin ? dueGames(schedule, dueWithinMin) : schedule;
  const fetchedAt = new Date().toISOString();
  const fresh = await mapLimit(targets, 4, async (g) => {
    try {
      const p = await fetchPreview(g.id);
      return { gameId: g.id, away: g.away, home: g.home, slug: p?.slug || null, updated: p?.updated || null, fetchedAt, rows: p ? lineupRows(p.markdown) : [] };
    } catch (err) {
      return { gameId: g.id, away: g.away, home: g.home, error: String(err.message || err), fetchedAt, rows: [] };
    }
  });
  // Merge into the stored file: re-read games replace their entry, the rest stay.
  const byId = Object.fromEntries((prev?.games || []).map((g) => [g.gameId, g]));
  for (const g of fresh) byId[g.gameId] = g;
  const games = schedule.map((g) => byId[g.id] || { gameId: g.id, away: g.away, home: g.home, rows: [] });
  const found = games.filter((g) => g.rows.length).length;
  const gdt = mergeGdt(prev?.gdt, await fetchGdtLines(date, targets, fetchedAt));
  const lineups = { date, fetchedAt, games, gdt };
  if (schedule.length) await writeJson(lineupsPath(date), lineups);
  // The snapshot runs for every game so those that have started get frozen.
  const positions = schedule.length ? await snapshotPositions(date, schedule, lineups) : null;
  // The slate's PropFinder files, pulled from its API when they are still missing (credentials in the env).
  const propfinder = schedule.length ? await ensurePropfinderSlate(date).catch((err) => ({ ok: false, error: String(err?.message || err) })) : null;
  if (propfinder) collect();
  // Then the model, when the slate's PropFinder files are in and the lines changed.
  const model = schedule.length ? await autoRunModel(date).catch((err) => ({ ran: false, error: String(err?.message || err) })) : null;
  return {
    date, scheduled: schedule.length, refreshed: targets.length, due: dueWithinMin ? targets.map((g) => `${g.away}@${g.home}`) : null,
    withLineups: found, gamedaytweets: Object.values(gdt).filter((v) => v?.players).length, gdt: gdtSummary(gdt), positions, propfinder, model,
  };
}

/**
 * GameDayTweets lines for every team on the slate. Fetched even when NHL.com has
 * a projected lineup: a game-day tweet (morning skate, warm-ups) is newer than
 * the preview and wins in the position snapshot.
 */
async function fetchGdtLines(date, schedule, fetchedAt = new Date().toISOString()) {
  const teams = [...new Set(schedule.flatMap((g) => [g.away, g.home]))];
  if (!teams.length) return {};
  const ref = await loadPlayers();
  const since = addDays(date, -1); // practice lines from the day before still count
  const out = {};
  // One team at a time with a gap: parallel reads get the server refused (403).
  for (const abbr of teams) {
    if (Object.keys(out).length) await new Promise((r) => setTimeout(r, 700));
    const roster = Object.values(ref.players).filter((p) => p.team === abbr && !p.excluded);
    try {
      const lines = await fetchTeamLines(abbr, roster, { since });
      // A team without a usable tweet is recorded too, so the read can say why it has no lines.
      out[abbr] = lines ? { ...lines, meta: { ...lines.meta, fetchedAt } } : { none: true, since, roster: roster.length, fetchedAt };
    } catch (err) {
      out[abbr] = { error: String(err.message || err), fetchedAt };
    }
  }
  return out;
}

/** Re-read teams replace their entry; a read that found no tweet never erases lines found earlier. */
export function mergeGdt(prev, fresh) {
  const gdt = { ...(prev || {}) };
  for (const [abbr, v] of Object.entries(fresh || {})) if (v?.players || !gdt[abbr]?.players) gdt[abbr] = v;
  return gdt;
}

/**
 * GameDayTweets pages fetched elsewhere (the GitHub Actions runner; the site refuses
 * this server), posted as { ABBR: html }. Parsed here against the stored rosters
 * exactly like a direct read, merged into the day's lineups, then the position
 * snapshot and the model run.
 */
export async function ingestGdtPages(date, pages, { fetchedAt = new Date().toISOString(), via = 'github' } = {}) {
  const [schedule, prev, ref] = await Promise.all([fetchSchedule(date), readJson(lineupsPath(date)), loadPlayers()]);
  const slate = new Set(schedule.flatMap((g) => [g.away, g.home]));
  const since = addDays(date, -1);
  const fresh = {};
  for (const [abbr, html] of Object.entries(pages || {})) {
    if (!TEAMS[abbr] || typeof html !== 'string') continue;
    const roster = Object.values(ref.players).filter((p) => p.team === abbr && !p.excluded);
    try {
      const lines = latestTeamLines(html, roster, { since });
      if (lines) fresh[abbr] = { ...lines, meta: { ...lines.meta, fetchedAt, via } };
      else {
        // Say what the page held, so a page that renders differently from a plain request shows up.
        const tweets = parseLinesPage(html);
        fresh[abbr] = { none: true, since, roster: roster.length, fetchedAt, via, tweets: tweets.length, newest: tweets[0] ? `${tweets[0].date} @${tweets[0].handle}` : null, bytes: html.length };
      }
    } catch (err) {
      fresh[abbr] = { error: String(err.message || err), fetchedAt, via };
    }
  }
  const gdt = mergeGdt(prev?.gdt, fresh);
  const games = prev?.games?.length ? prev.games : schedule.map((g) => ({ gameId: g.id, away: g.away, home: g.home, rows: [] }));
  const lineups = { date, fetchedAt: prev?.fetchedAt || fetchedAt, games, gdt };
  if (schedule.length) await writeJson(lineupsPath(date), lineups);
  const positions = schedule.length ? await snapshotPositions(date, schedule, lineups) : null;
  const model = schedule.length ? await autoRunModel(date).catch((err) => ({ ran: false, error: String(err?.message || err) })) : null;
  return {
    date, scheduled: schedule.length, pages: Object.keys(fresh).length, offSlate: Object.keys(fresh).filter((a) => !slate.has(a)),
    gamedaytweets: Object.values(gdt).filter((v) => v?.players).length, gdt: gdtSummary(gdt), positions, model,
  };
}

/** One line per slate team on what the GameDayTweets read found, for the refresh response and logs. */
export function gdtSummary(gdt) {
  return Object.fromEntries(Object.entries(gdt || {}).map(([abbr, v]) => [abbr,
    v?.players ? `${v.matched} matched · ${v.forwards}F/${v.pairs}D · ${v.meta?.date} @${v.meta?.handle}`
      : v?.error ? `error: ${v.error}`
        : v?.none ? `no lines tweet since ${v.since} (roster ${v.roster}${v.tweets != null ? `; page: ${v.tweets} tweets, newest ${v.newest || 'none'}, ${v.bytes} bytes` : ''})`
          : 'no read']));
}

/** Between heavy phases: hand the previous phase's garbage back before the next one allocates (512 MB instance). */
const collect = () => { if (typeof globalThis.gc === 'function') globalThis.gc(); };

/** Everything the daily job does: yesterday's results + today's lineups. */
export async function dailyRefresh(today) {
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  // Sequential on purpose: both calls rewrite the same season index file.
  const games = await ingestGames(yesterday);
  const gamesToday = await ingestGames(today);
  collect();
  // PropFinder's tables and today's matchup workbooks, fresh after last night's games
  // (only for today or a coming slate, and only when the account is configured).
  let propfinder = null;
  if (propfinderConfigured() && today >= todayET()) {
    // Skipped when a pull for this date finished in the last 30 minutes (the schedule pulls first, as its own request).
    const last = await readJson(PF_PULL_META);
    if (last?.ok && last.date === today && Date.now() - Date.parse(last.at) < 30 * 60 * 1000) propfinder = { ok: true, skipped: `pulled ${last.at}` };
    else {
      try { propfinder = await pullPropfinder(today); } catch (err) { propfinder = { ok: false, error: err.message }; }
      collect();
    }
  }
  const lineups = await ingestLineups(today);
  collect();
  // Preseason games (September/early October) show who is actually dressing.
  let preseason = null;
  try { preseason = [await ingestPreseason(yesterday), await ingestPreseason(today)]; } catch (err) { preseason = { error: err.message }; }
  // Rosters change slowly: refresh them at most once every 20 hours.
  let rosters = null;
  const lastRoster = await readJson('data/meta/last-roster-update.json');
  if (!lastRoster?.at || Date.now() - Date.parse(lastRoster.at) > 20 * 3600 * 1000) {
    try { rosters = await updateRosters(); } catch (err) { rosters = { error: err.message }; }
  }
  // League tables and any logos / headshots still missing.
  let league = null;
  try { league = await refreshLeague(); } catch (err) { league = { error: err.message }; }
  let media = null;
  try { media = await syncMedia({ limit: 200 }); } catch (err) { media = { error: err.message }; }
  // MoneyPuck: the season summary every day, the 32 game logs (home/away splits) once a week.
  let moneypuck = null;
  try { moneypuck = await refreshMoneyPuck({ games: new Date().getUTCDay() === 0 }); } catch (err) { moneypuck = { error: err.message }; }
  const summary = { ranAt: new Date().toISOString(), today, yesterday: games, todayGames: gamesToday, propfinder, lineups, preseason, rosters, league, media, moneypuck };
  await writeJson('data/meta/last-refresh.json', summary);
  return summary;
}

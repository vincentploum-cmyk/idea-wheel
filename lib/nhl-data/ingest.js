// Pulls finished games and projected lineups from the NHL API into Supabase
// Storage (bucket nhl-model, prefix data/).
import { fetchSchedule, fetchBoxscore, fetchPlayByPlay, fetchPreview, isFinal } from './api';
import { buildGameRecord, stampFirstGoal } from './game';
import { lineupRows } from './lineups';
import { fetchTeamLines, latestTeamLines, parseLinesPage } from './gamedaytweets';
import { TEAMS } from './teams';
import { addDays, todayET } from './util';
import { autoRunModel } from './autorun';
import { pullPropfinder, ensurePropfinderSlate, propfinderConfigured, PF_PULL_META } from './propfinder-api';
import { readJson, writeJson } from '../nhl-store';
import { updateRosters, loadPlayers } from './rosters';
import { ingestPreseason } from './preseason';
import { snapshotPositions, applyPositions, snapshotFromPreview, positionsPath } from './positions';
import { refreshLeague } from './league';
import { syncMedia } from './media';
import { refreshMoneyPuck } from './moneypuck';

// Trailing columns (added last, so older rows still parse): posSrc 'lineup' = position from the
// lineup read for the game, 'box' = box-score roster code; boxPos = the box score's code; line =
// the line slot (forward line 1-4, defense pair 1-3; null when the position came from the box
// score), so a box score is logged per line: LW1, LW2, LW3 … rather than one LW bucket. Rows are
// rewritten whenever a later lineup read changes a game's positions (restampPositions).
// fg = 1 on the skater who scored the game's first goal (so a defense's first goals allowed
// can be read per position and line); undefined on rows stored before the column existed.
export const ROW_FIELDS = ['date', 'gameId', 'playerId', 'name', 'team', 'opp', 'venue', 'pos', 'toi', 'g', 'a', 'sog', 'hits', 'blk', 'icf', 'iff', 'isf', 'iscf', 'ihdcf', 'result', 'posSrc', 'boxPos', 'line', 'fg'];

export const gamesPath = (date) => `data/games/${date}.json`;
export const lineupsPath = (date) => `data/lineups/${date}.json`;
export const rowsPath = (season) => `data/rows/${season}.json`;
export const SEEN_PATH = 'data/reference/seen-players.json';

export function toRow(game, s) {
  return [game.date, game.id, s.id, s.name, s.team, s.opp, s.venue, s.pos, s.toi, s.g, s.a, s.sog, s.hits, s.blk, s.icf, s.iff, s.isf, s.iscf, s.ihdcf, s.result, s.posSource || 'box', s.boxPos ?? s.pos, s.line ?? null, s.fg == null ? null : s.fg ? 1 : 0];
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

// Lines tweeted up to this long after puck drop (warm-ups, a late scratch) still describe that
// game; anything later is about the next one.
const GDT_AFTER_START_MS = 4 * 3600 * 1000;

/** Per team on `schedule`: the instant after which a lines tweet is about a later game (null without a start time). */
export function gdtCutoffs(schedule) {
  const out = {};
  for (const g of schedule || []) {
    const t = Date.parse(g.startTimeUTC || '');
    const until = Number.isFinite(t) ? new Date(t + GDT_AFTER_START_MS).toISOString() : null;
    for (const abbr of [g.away, g.home]) if (abbr) out[abbr] = until;
  }
  return out;
}

/** Rewrite the per-season row index for these games (one date's worth): their rows replace the stored ones. */
async function writeSeasonRows(games) {
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
}

/**
 * Re-stamp the stored box scores for `date` from the current position snapshot: a
 * lineup read that arrives after the game (a warm-up tweet, the preview's last update)
 * corrects the positions and line slots of games already logged. Rewrites the day's
 * game file and the season rows only when something changed. Null without stored games.
 */
export async function restampPositions(date) {
  const file = await readJson(gamesPath(date));
  if (!file?.games?.length) return null;
  const snap = await readJson(positionsPath(date));
  const covered = file.games.filter((g) => snap?.games?.[g.id]);
  const { applied, changed } = applyPositions(covered, snap, 'lineup');
  for (const g of file.games) for (const s of g.skaters) { if (!s.posSource) s.posSource = 'box'; if (s.line === undefined) s.line = null; }
  const out = { date, games: file.games.length, covered: covered.length, applied, changed };
  if (!changed) return out;
  await writeJson(gamesPath(date), { ...file, restampedAt: new Date().toISOString() });
  await writeSeasonRows(file.games);
  return out;
}

/**
 * Stored games on `date` logged before the first goal was captured get it now, from
 * the play-by-play alone (no box score re-fetch): `firstGoal` on the game, `fg` on the
 * scorer's row, then the season rows. Null without stored games; `stamped` = games done.
 */
export async function stampFirstGoals(date) {
  const file = await readJson(gamesPath(date));
  if (!file?.games?.length) return null;
  const todo = file.games.filter((g) => g.firstGoal === undefined);
  if (!todo.length) return { date, games: file.games.length, stamped: 0 };
  const plays = await mapLimit(todo, 4, (g) => fetchPlayByPlay(g.id).then((pbp) => pbp?.plays || null).catch(() => null));
  let stamped = 0;
  todo.forEach((g, i) => { if (plays[i]) { stampFirstGoal(g, plays[i]); stamped += 1; } });
  if (!stamped) return { date, games: file.games.length, stamped: 0, failed: todo.length };
  await writeJson(gamesPath(date), { ...file, firstGoalsAt: new Date().toISOString() });
  await writeSeasonRows(file.games);
  return { date, games: file.games.length, stamped, failed: todo.length - stamped };
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
  // Skaters take the position and line the lineup read for the game holds (re-stamped
  // later if a newer read changes it). Games the snapshot never covered get their
  // projected lineup from the NHL.com preview.
  let positions = { lineup: 0, preview: 0, box: 0 };
  if (fresh.length) {
    const snap = await readJson(positionsPath(date));
    const covered = fresh.filter((g) => snap?.games?.[g.id]);
    positions.lineup = applyPositions(covered, snap, 'lineup').applied;
    const uncovered = fresh.filter((g) => !snap?.games?.[g.id]);
    const previews = await mapLimit(uncovered, 4, (g) => snapshotFromPreview(g));
    uncovered.forEach((g, i) => { if (previews[i]) positions.preview += applyPositions([g], previews[i], 'lineup').applied; });
    positions.box = fresh.reduce((n, g) => n + g.skaters.filter((s) => (s.posSource || 'box') === 'box').length, 0);
    positions.slotted = fresh.reduce((n, g) => n + g.skaters.filter((s) => s.line).length, 0);
    for (const g of fresh) for (const s of g.skaters) { if (!s.posSource) s.posSource = 'box'; if (s.line === undefined) s.line = null; }
  }
  if (!fresh.length && !force) {
    // Nothing new to fetch: the stored games still follow the latest lineup read, and games
    // logged before first goals were captured get theirs (so a backfill walk fills them in).
    const firstGoals = await stampFirstGoals(date).catch((err) => ({ error: String(err?.message || err) }));
    const restamp = await restampPositions(date);
    return { date, scheduled: schedule.length, ingested: 0, total: existing.games.length, pending, firstGoals, restamp };
  }

  const byId = new Map(existing.games.map((g) => [g.id, g]));
  for (const g of fresh) byId.set(g.id, g);
  const games = [...byId.values()].sort((a, b) => a.id - b.id);
  await writeJson(gamesPath(date), { date, fetchedAt: new Date().toISOString(), games });

  // Update the per-season row index used by the aggregate workbooks.
  await writeSeasonRows(games);

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
 * With `settle` (a date whose games are played), the previews are re-read for their
 * last update, the stored tweets kept, the snapshot re-captured and the stored box
 * scores re-stamped; no PropFinder pull or model run.
 */
export async function ingestLineups(date, { dueWithinMin = null, settle = false } = {}) {
  const schedule = await fetchSchedule(date);
  const prev = dueWithinMin || settle ? await readJson(lineupsPath(date)) : null;
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
  // Settling a played date keeps the tweets already stored (the pages are posted, with the
  // previous day's games settled from them, by the GameDayTweets route).
  const gdt = mergeGdt(prev?.gdt, settle ? {} : await fetchGdtLines(date, targets, fetchedAt, gdtCutoffs(schedule)));
  const lineups = { date, fetchedAt, games, gdt };
  if (schedule.length) await writeJson(lineupsPath(date), lineups);
  // The snapshot re-captures every game from the newest lineup dated at or before it.
  const positions = schedule.length ? await snapshotPositions(date, schedule, lineups) : null;
  // Games already logged for the date follow the new snapshot.
  const restamp = schedule.length ? await restampPositions(date).catch((err) => ({ error: String(err?.message || err) })) : null;
  if (settle) {
    return { date, settled: true, scheduled: schedule.length, refreshed: targets.length, withLineups: found, gamedaytweets: Object.values(gdt).filter((v) => v?.players).length, gdt: gdtSummary(gdt), positions, restamp };
  }
  // The slate's PropFinder files, pulled from its API when they are still missing (credentials in the env).
  const propfinder = schedule.length ? await ensurePropfinderSlate(date).catch((err) => ({ ok: false, error: String(err?.message || err) })) : null;
  if (propfinder) collect();
  // Then the model, when the slate's PropFinder files are in and the lines changed.
  const model = schedule.length ? await autoRunModel(date).catch((err) => ({ ran: false, error: String(err?.message || err) })) : null;
  return {
    date, scheduled: schedule.length, refreshed: targets.length, due: dueWithinMin ? targets.map((g) => `${g.away}@${g.home}`) : null,
    withLineups: found, gamedaytweets: Object.values(gdt).filter((v) => v?.players).length, gdt: gdtSummary(gdt), positions, restamp, propfinder, model,
  };
}

/**
 * GameDayTweets lines for every team on the slate. Fetched even when NHL.com has
 * a projected lineup: a game-day tweet (morning skate, warm-ups) is newer than
 * the preview and wins in the position snapshot. `cutoffs` (team → instant) keeps
 * tweets posted after the team's game out, so a read after the game still answers
 * for that game.
 */
async function fetchGdtLines(date, schedule, fetchedAt = new Date().toISOString(), cutoffs = {}) {
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
      const lines = await fetchTeamLines(abbr, roster, { since, until: cutoffs[abbr] || null });
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
 * snapshot and the model run. The same pages also settle the previous day's games
 * (a team's page still shows yesterday's warm-up lines): see settleGdtPages.
 */
export async function ingestGdtPages(date, pages, { fetchedAt = new Date().toISOString(), via = 'github' } = {}) {
  const [schedule, prev, ref] = await Promise.all([fetchSchedule(date), readJson(lineupsPath(date)), loadPlayers()]);
  const slate = new Set(schedule.flatMap((g) => [g.away, g.home]));
  const since = addDays(date, -1);
  const cutoffs = gdtCutoffs(schedule);
  const fresh = {};
  for (const [abbr, html] of Object.entries(pages || {})) {
    if (!TEAMS[abbr] || typeof html !== 'string') continue;
    const roster = Object.values(ref.players).filter((p) => p.team === abbr && !p.excluded);
    try {
      const lines = latestTeamLines(html, roster, { since, until: cutoffs[abbr] || null });
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
  const restamp = schedule.length ? await restampPositions(date).catch((err) => ({ error: String(err?.message || err) })) : null;
  const model = schedule.length ? await autoRunModel(date).catch((err) => ({ ran: false, error: String(err?.message || err) })) : null;
  // Yesterday's games, from the same pages: the lines posted up to and during those games.
  const settled = await settleGdtPages(addDays(date, -1), pages, ref, { fetchedAt, via }).catch((err) => ({ error: String(err?.message || err) }));
  return {
    date, scheduled: schedule.length, pages: Object.keys(fresh).length, offSlate: Object.keys(fresh).filter((a) => !slate.has(a)),
    gamedaytweets: Object.values(gdt).filter((v) => v?.players).length, gdt: gdtSummary(gdt), positions, restamp, model, settled,
  };
}

/**
 * The previous day's games from today's posted pages: for each team that played on
 * `date`, the newest lines tweet posted no later than its game (plus the warm-up
 * window), merged into that day's stored lineups when it finds one, then the
 * snapshot and the re-stamp of that day's box scores. Null when no team on the
 * pages played that day.
 */
export async function settleGdtPages(date, pages, ref, { fetchedAt = new Date().toISOString(), via = 'github' } = {}) {
  const schedule = await fetchSchedule(date);
  if (!schedule.length) return null;
  const cutoffs = gdtCutoffs(schedule);
  const teams = Object.keys(pages || {}).filter((abbr) => cutoffs[abbr] !== undefined && TEAMS[abbr] && typeof pages[abbr] === 'string');
  if (!teams.length) return null;
  const since = addDays(date, -1);
  const fresh = {};
  for (const abbr of teams) {
    const roster = Object.values(ref.players).filter((p) => p.team === abbr && !p.excluded);
    try {
      const lines = latestTeamLines(pages[abbr], roster, { since, until: cutoffs[abbr] || null });
      if (lines) fresh[abbr] = { ...lines, meta: { ...lines.meta, fetchedAt, via, settled: true } };
    } catch (err) {
      fresh[abbr] = { error: String(err.message || err), fetchedAt, via };
    }
  }
  const prev = await readJson(lineupsPath(date));
  const gdt = mergeGdt(prev?.gdt, fresh);
  const games = prev?.games?.length ? prev.games : schedule.map((g) => ({ gameId: g.id, away: g.away, home: g.home, rows: [] }));
  await writeJson(lineupsPath(date), { date, fetchedAt: prev?.fetchedAt || fetchedAt, games, gdt });
  const positions = await snapshotPositions(date, schedule, { date, games, gdt });
  const restamp = await restampPositions(date);
  return { date, teams: teams.length, gamedaytweets: Object.keys(fresh).filter((a) => fresh[a].players).length, gdt: gdtSummary(Object.fromEntries(teams.map((a) => [a, gdt[a]]))), positions, restamp };
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
  // Yesterday's lineups one last time (the previews' final update), so the results are
  // logged at the lines the teams actually dressed; then the games themselves.
  let settled = null;
  try { settled = await ingestLineups(yesterday, { settle: true }); } catch (err) { settled = { error: err.message }; }
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
  const summary = { ranAt: new Date().toISOString(), today, yesterday: games, yesterdayLineups: settled, todayGames: gamesToday, propfinder, lineups, preseason, rosters, league, media, moneypuck };
  await writeJson('data/meta/last-refresh.json', summary);
  return summary;
}

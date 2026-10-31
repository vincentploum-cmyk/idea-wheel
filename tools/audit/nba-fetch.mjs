// Fetches the NBA replay's raw feeds from ESPN into --raw (the files tools/audit/nba-audit.mjs reads):
//   days/<YYYYMMDD>.json      the scoreboard of each date from --from to --to
//   games/<eventId>.json      the summary (box score) of every completed regular-season game on those days
//   gamelogs/<espnId>.json    every listed player's game log for --season (ESPN's label: 2026 = 2025-26)
// Resumable: a file on disk is not fetched again. Usage:
//   node tools/audit/nba-fetch.mjs --from 2026-10-20 --to 2026-10-30 --raw .nhl-data/audit/nba --season 2026
//   node tools/audit/nba-fetch.mjs --from 2025-10-21 --to 2026-04-12 --raw .nhl-data/audit/nba/prior --season 2025 --no-logs
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FROM = arg('--from'); const TO = arg('--to'); const RAW = arg('--raw', '.nhl-data/audit/nba'); const SEASON = arg('--season', '2026');
const LOGS = !process.argv.includes('--no-logs');
const PAR = Number(arg('--par', '4'));
if (!FROM || !TO) { console.error('--from and --to (YYYY-MM-DD) are required'); process.exit(1); }
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const LOG = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
for (const d of ['days', 'games', 'gamelogs']) fs.mkdirSync(path.join(RAW, d), { recursive: true });

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.json();
    } catch (e) { if (i === tries - 1) throw e; await new Promise((res) => setTimeout(res, 1500 * (i + 1))); }
  }
  return null;
}
async function pool(items, fn, n = PAR) { let i = 0; const run = async () => { while (i < items.length) { const it = items[i++]; await fn(it); } }; await Promise.all(Array.from({ length: n }, run)); }
const dates = []; for (let d = new Date(`${FROM}T12:00:00Z`); d <= new Date(`${TO}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));

// 1. the scoreboards
const events = [];
let fetchedDays = 0;
await pool(dates, async (date) => {
  const f = path.join(RAW, 'days', `${date.replace(/-/g, '')}.json`);
  let j;
  if (fs.existsSync(f)) j = JSON.parse(fs.readFileSync(f));
  else { j = await getJson(`${SITE}/scoreboard?dates=${date.replace(/-/g, '')}&limit=50`); if (!j) return; fs.writeFileSync(f, JSON.stringify(j)); fetchedDays++; }
  for (const e of j.events || []) if (e.status?.type?.completed && e.season?.type === 2) events.push(String(e.id));
}, 3);
console.log(`days: ${dates.length} (${fetchedDays} fetched) · completed regular-season games: ${events.length}`);

// 2. the box scores
let fetchedGames = 0; const ids = new Set();
await pool(events, async (id) => {
  const f = path.join(RAW, 'games', `${id}.json`);
  let j;
  if (fs.existsSync(f)) j = JSON.parse(fs.readFileSync(f));
  else { j = await getJson(`${SITE}/summary?event=${id}`); if (!j) return; fs.writeFileSync(f, JSON.stringify(j)); fetchedGames++; if (fetchedGames % 50 === 0) console.log(`  games fetched: ${fetchedGames}`); }
  for (const t of j.boxscore?.players || []) for (const s of t.statistics || []) for (const a of s.athletes || []) if (a.athlete?.id) ids.add(String(a.athlete.id));
});
console.log(`games: ${events.length} (${fetchedGames} fetched) · players seen: ${ids.size}`);

// 3. the players' game logs for the season
if (LOGS) {
  let fetchedLogs = 0; let missing = 0;
  await pool([...ids], async (id) => {
    const f = path.join(RAW, 'gamelogs', `${id}.json`);
    if (fs.existsSync(f)) return;
    const j = await getJson(`${LOG}/${id}/gamelog?season=${SEASON}`).catch(() => null);
    if (!j) { missing++; return; }
    fs.writeFileSync(f, JSON.stringify(j)); fetchedLogs++;
    if (fetchedLogs % 100 === 0) console.log(`  logs fetched: ${fetchedLogs}`);
  });
  console.log(`gamelogs: ${fetchedLogs} fetched, ${missing} missing`);
}

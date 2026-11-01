// Fetches the NFL replay's raw feeds from ESPN into --raw (the files tools/audit/nfl-audit.mjs reads):
//   <season>/weeks/w<NN>.json   the scoreboard of each regular-season week
//   <season>/games/<id>.json    the summary of every completed game (box score, scoring plays, pickcenter: the line;
//                               `coreOdds` from ESPN's core odds when the summary dropped it)
//   rosters/<ABBR>.json         each team's roster now (the players' positions)
//   athletes/<id>.json          a player with a passing, rushing or receiving line no roster lists (his position)
// Resumable: a file on disk is not fetched again (a week's scoreboard is fetched again while it has games to play).
//   node tools/audit/nfl-fetch.mjs --season 2025 --weeks 1-18 --raw .nhl-data/audit/nfl   (the season by ESPN's `dates`)
//   node tools/audit/nfl-fetch.mjs --season 2026 --weeks 1-9 --raw .nhl-data/audit/nfl
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SEASON = Number(arg('--season', '2026'));
const [W0, W1] = String(arg('--weeks', '1-18')).split('-').map(Number);
const RAW = arg('--raw', '.nhl-data/audit/nfl');
const PAR = Number(arg('--par', '4'));
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const ATHLETE = 'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const dir = (...p) => { const d = path.join(RAW, ...p); fs.mkdirSync(d, { recursive: true }); return d; };

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.json();
    } catch (e) { if (i === tries - 1) throw e; await new Promise((res) => setTimeout(res, 1500 * (i + 1))); }
  }
  return null;
}
async function pool(items, fn, n = PAR) { let i = 0; const run = async () => { while (i < items.length) { const it = items[i++]; await fn(it); } }; await Promise.all(Array.from({ length: n }, run)); }
const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const write = (f, j) => fs.writeFileSync(f, JSON.stringify(j));

// 1. The weeks' scoreboards.
const weeksDir = dir(String(SEASON), 'weeks');
const events = [];
for (let w = W0; w <= W1; w++) {
  const f = path.join(weeksDir, `w${String(w).padStart(2, '0')}.json`);
  let j = read(f);
  const open = j && (j.events || []).some((e) => !e.competitions?.[0]?.status?.type?.completed);
  if (!j || open) { j = await getJson(`${SITE}/scoreboard?dates=${SEASON}&week=${w}&seasontype=2&limit=100`); if (j) write(f, j); }
  for (const e of j?.events || []) if (e.competitions?.[0]?.status?.type?.completed) events.push(e.id);
}
console.log(`${SEASON} weeks ${W0}–${W1}: ${events.length} completed games`);

// 2. The summaries.
const gamesDir = dir(String(SEASON), 'games');
let fetched = 0;
await pool(events, async (id) => {
  const f = path.join(gamesDir, `${id}.json`);
  if (fs.existsSync(f)) return;
  const j = await getJson(`${SITE}/summary?event=${id}`);
  if (j) { write(f, { header: j.header, boxscore: j.boxscore, scoringPlays: j.scoringPlays, pickcenter: j.pickcenter }); fetched++; }
});
console.log(`summaries: ${fetched} fetched, ${events.length - fetched} on disk`);

// 2b. The line for a game whose summary dropped it (most of a past season's): ESPN's core odds, kept as `coreOdds`.
const CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events';
let lines = 0;
await pool(events, async (id) => {
  const f = path.join(gamesDir, `${id}.json`);
  const j = read(f);
  if (!j || j.coreOdds !== undefined || (j.pickcenter || []).some((p) => p.overUnder != null && p.details)) return;
  const o = await getJson(`${CORE}/${id}/competitions/${id}/odds`).catch(() => null);
  const item = (o?.items || []).find((x) => x.overUnder != null && x.details) || null;
  j.coreOdds = item ? { details: item.details, overUnder: item.overUnder, spread: item.spread ?? null, provider: item.provider?.name || null } : null;
  write(f, j);
  if (item) lines++;
});
console.log(`lines from the core odds: ${lines}`);

// 3. The rosters (once): every team's players with their positions.
const rosterDir = dir('rosters');
const teams = (await getJson(`${SITE}/teams`))?.sports?.[0]?.leagues?.[0]?.teams?.map((t) => t.team) || [];
await pool(teams, async (t) => {
  const f = path.join(rosterDir, `${t.abbreviation}.json`);
  if (fs.existsSync(f)) return;
  const j = await getJson(`${SITE}/teams/${t.id}/roster`);
  if (j) write(f, { team: t.abbreviation, athletes: (j.athletes || []).flatMap((g) => g.items || []).map((a) => ({ id: String(a.id), name: a.displayName, pos: a.position?.abbreviation || null })) });
});
const known = new Set();
for (const f of fs.readdirSync(rosterDir)) for (const a of read(path.join(rosterDir, f)).athletes) known.add(a.id);

// 4. The players with an offensive line no roster lists: their own page.
const athDir = dir('athletes');
const want = new Set();
for (const f of fs.readdirSync(gamesDir)) {
  const j = read(path.join(gamesDir, f));
  for (const t of j?.boxscore?.players || []) for (const s of t.statistics || []) {
    if (!['passing', 'rushing', 'receiving'].includes(s.name)) continue;
    for (const a of s.athletes || []) { const id = String(a.athlete?.id || ''); if (id && !known.has(id) && !fs.existsSync(path.join(athDir, `${id}.json`))) want.add(id); }
  }
}
let found = 0;
await pool([...want], async (id) => {
  const j = await getJson(`${ATHLETE}/${id}`).catch(() => null);
  const a = j?.athlete;
  write(path.join(athDir, `${id}.json`), { id, name: a?.displayName || null, pos: a?.position?.abbreviation || null });
  if (a?.position?.abbreviation) found++;
});
console.log(`positions: ${known.size} on rosters, ${want.size} read one by one (${found} with a position)`);

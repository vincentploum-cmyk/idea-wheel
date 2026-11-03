// Fetches ESPN's NBA box scores for a date range, trimmed to what the stat-by-stat study reads
// (header, boxscore, pickcenter): <out>/<season label>/<eventId>.json. Resumable.
//   node tools/audit/nba-box-fetch.mjs --from 2024-10-22 --to 2025-04-13 --out .nhl-data/audit/nba-box
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FROM = arg('--from'); const TO = arg('--to'); const OUT = arg('--out', '.nhl-data/audit/nba-box');
const PAR = Number(arg('--par', '6'));
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.json();
    } catch (e) { if (i === tries - 1) throw e; await new Promise((res) => setTimeout(res, 2000 * (i + 1))); }
  }
  return null;
}
async function pool(items, fn, n = PAR) { let i = 0; const run = async () => { while (i < items.length) { const it = items[i++]; await fn(it); } }; await Promise.all(Array.from({ length: n }, run)); }
const dates = []; for (let d = new Date(`${FROM}T12:00:00Z`); d <= new Date(`${TO}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));
fs.mkdirSync(path.join(OUT, 'days'), { recursive: true });
const events = [];
await pool(dates, async (date) => {
  const f = path.join(OUT, 'days', `${date.replace(/-/g, '')}.json`);
  let j;
  if (fs.existsSync(f)) j = JSON.parse(fs.readFileSync(f));
  else {
    const raw = await getJson(`${SITE}/scoreboard?dates=${date.replace(/-/g, '')}&limit=50`); if (!raw) return;
    j = { date, events: (raw.events || []).map((e) => ({ id: String(e.id), season: e.season, completed: !!e.status?.type?.completed })) };
    fs.writeFileSync(f, JSON.stringify(j));
  }
  for (const e of j.events) if (e.completed && e.season?.type === 2) events.push({ id: e.id, date, year: e.season.year });
}, 4);
console.log(`days ${dates.length} · completed regular-season games ${events.length}`);
let fetched = 0; let failed = 0;
await pool(events, async ({ id, date, year }) => {
  const dir = path.join(OUT, String(year)); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${id}.json`);
  if (fs.existsSync(f)) return;
  const j = await getJson(`${SITE}/summary?event=${id}`).catch(() => null);
  if (!j) { failed++; return; }
  fs.writeFileSync(f, JSON.stringify({ date, header: j.header, boxscore: j.boxscore, pickcenter: j.pickcenter || [] }));
  fetched++; if (fetched % 100 === 0) console.log(`  ${fetched} fetched`);
});
console.log(`fetched ${fetched}, failed ${failed}`);

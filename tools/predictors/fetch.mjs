// Pull every final regular-season game between two dates straight from the NHL API,
// through the repo's own record builder (lib/nhl-data/game.js), one JSON file per date.
// Usage: node tools/predictors/fetch.mjs <from> <to> <out dir>   (dates YYYY-MM-DD)
import fs from 'node:fs';
import path from 'node:path';
import { buildGameRecord } from '../../lib/nhl-data/game.js';

const [from, to, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const WEB = 'https://api-web.nhle.com/v1';
const UA = { 'User-Agent': 'Mozilla/5.0 (nhl-model; +https://ideareels.io)', Accept: 'application/json' };
async function getJson(url, tries = 4) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) { err = e; await new Promise((s) => setTimeout(s, 500 * (i + 1))); }
  }
  throw err;
}
const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}
let d = from, total = 0;
while (d <= to) {
  const file = path.join(outDir, `${d}.json`);
  if (fs.existsSync(file)) { total += JSON.parse(fs.readFileSync(file)).games.length; d = addDays(d, 1); continue; }
  const week = await getJson(`${WEB}/schedule/${d}`);
  const day = (week?.gameWeek || []).find((w) => w.date === d);
  const games = (day?.games || []).filter((g) => g.gameType === 2 && (g.gameState === 'OFF' || g.gameState === 'FINAL'));
  const recs = await mapLimit(games, 6, async (g) => {
    const [box, pbp] = await Promise.all([getJson(`${WEB}/gamecenter/${g.id}/boxscore`), getJson(`${WEB}/gamecenter/${g.id}/play-by-play`)]);
    const rec = buildGameRecord(box, pbp);
    if (rec) rec.startTimeUTC = g.startTimeUTC;
    return rec;
  });
  const ok = recs.filter(Boolean);
  fs.writeFileSync(file, JSON.stringify({ date: d, games: ok }));
  total += ok.length;
  console.log(d, ok.length, 'games', 'total', total);
  d = addDays(d, 1);
}

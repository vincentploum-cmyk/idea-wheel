// Decide whether the pre-game lineups workflow should hand itself on (lib/nhl-data/lines-chain.js).
//   node tools/lines-chain.mjs <date> <hops left> [refresh response JSON]
// The response (the site's answer to only=lineups) carries `result.gdtAt`, team → newest lines
// tweet instant, so a game whose warm-up lines are in is left alone. Prints
// "sleep=<seconds> hops=<n> why=<…>" when a hop is due, else "none: <reason>".
import fs from 'node:fs';
import { nextHop } from '../lib/nhl-data/lines-chain.js';

const [date, hopsArg, respPath] = process.argv.slice(2);
if (!date) { console.error('usage: lines-chain.mjs <date> <hops left> [resp.json]'); process.exit(2); }
let gdtAt = {};
if (respPath && fs.existsSync(respPath)) {
  try { gdtAt = JSON.parse(fs.readFileSync(respPath, 'utf8'))?.result?.gdtAt || {}; } catch { gdtAt = {}; }
}
const res = await fetch(`https://api-web.nhle.com/v1/schedule/${date}`, { headers: { 'User-Agent': 'Mozilla/5.0 (nhl-model; +https://ideareels.io)' } });
const week = res.ok ? await res.json() : null;
const games = ((week?.gameWeek || []).find((w) => w.date === date)?.games || []).filter((g) => g.gameType === 2 || g.gameType === 3);
const r = nextHop(games.map((g) => ({ startTimeUTC: g.startTimeUTC, away: g.awayTeam?.abbrev, home: g.homeTeam?.abbrev })), Date.now(), Number(hopsArg) || 0, gdtAt);
console.log(r.hop ? `sleep=${r.sleepSec} hops=${r.hopsLeft} why=${r.why}` : `none: ${r.reason}`);

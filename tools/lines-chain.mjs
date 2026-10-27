// Decide whether the lineups workflow should hand itself on (lib/nhl-data/lines-chain.js).
//   node tools/lines-chain.mjs <date> <hops left> [refresh response JSON] [--settle] [--settled id,id]
// The response (the site's answer to only=lineups) carries `result.gdtAt`, team → newest lines
// tweet instant, so a game whose warm-up lines are in is left alone. `--settle` says this run was a
// post-game read, `--settled` lists the games already settled by earlier hops. Prints
// "sleep=<seconds> hops=<n> settle=<0|1> settled=<id,id> why=<…>" when a hop is due, else
// "none: <reason> settled=<id,id>".
import fs from 'node:fs';
import { nextHop } from '../lib/nhl-data/lines-chain.js';

const args = process.argv.slice(2);
const settleHop = args.includes('--settle');
const settledIdx = args.indexOf('--settled');
const settled = settledIdx >= 0 ? String(args[settledIdx + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : [];
const positional = args.filter((a, i) => !a.startsWith('--') && !(settledIdx >= 0 && i === settledIdx + 1));
const [date, hopsArg, respPath] = positional;
if (!date) { console.error('usage: lines-chain.mjs <date> <hops left> [resp.json] [--settle] [--settled id,id]'); process.exit(2); }
let gdtAt = {};
if (respPath && fs.existsSync(respPath)) {
  try { gdtAt = JSON.parse(fs.readFileSync(respPath, 'utf8'))?.result?.gdtAt || {}; } catch { gdtAt = {}; }
}
const res = await fetch(`https://api-web.nhle.com/v1/schedule/${date}`, { headers: { 'User-Agent': 'Mozilla/5.0 (nhl-model; +https://ideareels.io)' } });
const week = res.ok ? await res.json() : null;
const games = ((week?.gameWeek || []).find((w) => w.date === date)?.games || []).filter((g) => g.gameType === 2 || g.gameType === 3);
const r = nextHop(games.map((g) => ({ id: g.id, startTimeUTC: g.startTimeUTC, away: g.awayTeam?.abbrev, home: g.homeTeam?.abbrev, state: g.gameState || null })), Date.now(), Number(hopsArg) || 0, gdtAt, { settled, settleHop });
console.log(r.hop ? `sleep=${r.sleepSec} hops=${r.hopsLeft} settle=${r.settle ? 1 : 0} settled=${r.settled.join(',')} why=${r.why}` : `none: ${r.reason} settled=${r.settled.join(',')}`);

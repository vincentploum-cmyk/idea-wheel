// Decide whether the pre-game lineups workflow should hand itself on (see lib/nhl-data/lines-chain.js).
//   node tools/lines-chain.mjs <date> <hops left>
// Prints "sleep=<seconds> hops=<n> game=<a@h start>" when a hop is due, else "none: <reason>".
import { nextHop } from '../lib/nhl-data/lines-chain.js';

const [date, hopsArg] = process.argv.slice(2);
if (!date) { console.error('usage: lines-chain.mjs <date> <hops left>'); process.exit(2); }
const res = await fetch(`https://api-web.nhle.com/v1/schedule/${date}`, { headers: { 'User-Agent': 'Mozilla/5.0 (nhl-model; +https://ideareels.io)' } });
const week = res.ok ? await res.json() : null;
const games = (week?.gameWeek || []).find((w) => w.date === date)?.games?.filter((g) => g.gameType === 2 || g.gameType === 3) || [];
const r = nextHop(games.map((g) => ({ startTimeUTC: g.startTimeUTC, away: g.awayTeam?.abbrev, home: g.homeTeam?.abbrev })), Date.now(), Number(hopsArg) || 0);
console.log(r.hop ? `sleep=${r.sleepSec} hops=${r.hopsLeft} game=${r.game}` : `none: ${r.reason}`);

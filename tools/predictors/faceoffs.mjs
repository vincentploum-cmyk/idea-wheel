// Faceoffs taken per skater per game, from the NHL play-by-play, for the games already
// pulled by fetch.mjs: the box score lists registered positions (six to eight "C" a team),
// so the forwards who actually took the draws are the night's centres and the rest wingers.
// Usage: node tools/predictors/faceoffs.mjs <games dir> <out json>   → { gameId: { playerId: taken } }
import fs from 'node:fs';
import path from 'node:path';

const [gamesDir, outFile] = process.argv.slice(2);
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
const out = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile)) : {};
const ids = [];
for (const f of fs.readdirSync(gamesDir).sort()) for (const g of JSON.parse(fs.readFileSync(path.join(gamesDir, f))).games) if (!out[g.id]) ids.push(g.id);
let done = 0, i = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (i < ids.length) {
    const id = ids[i++];
    const pbp = await getJson(`${WEB}/gamecenter/${id}/play-by-play`);
    const fo = {};
    for (const p of pbp?.plays || []) {
      if (p.typeDescKey !== 'faceoff') continue;
      for (const k of ['winningPlayerId', 'losingPlayerId']) if (p.details?.[k]) fo[p.details[k]] = (fo[p.details[k]] || 0) + 1;
    }
    out[id] = fo;
    if (++done % 100 === 0) { fs.writeFileSync(outFile, JSON.stringify(out)); console.log(done, '/', ids.length); }
  }
}));
fs.writeFileSync(outFile, JSON.stringify(out));
console.log('faceoffs for', Object.keys(out).length, 'games');

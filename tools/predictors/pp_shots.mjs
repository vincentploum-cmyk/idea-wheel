// Power-play shots allowed by position: every shot attempt in the NHL play-by-play with its strength read
// off the play's situationCode (away goalie, away skaters, home skaters, home goalie: "1451" = the home side
// on a 5-on-4), credited to the shooter's position that night (the relabelled games, relabel.py: the four
// forwards who took the draws are the centres) and to the defending team. One CSV row per attempt.
//   node tools/predictors/pp_shots.mjs <games-pos dir> <out.csv>
// strength: pp = the shooter's side has more skaters and the defending goalie is in net; sh = fewer;
// ev = even; en = the defending net is empty. type: sog (shot on goal or goal), miss, block.
import fs from 'node:fs';
import path from 'node:path';

const [gamesDir, outFile] = process.argv.slice(2);
const WEB = 'https://api-web.nhle.com/v1';
const UA = { 'User-Agent': 'Mozilla/5.0 (nhl-model study)', Accept: 'application/json' };
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

const TYPES = { 'shot-on-goal': 'sog', goal: 'sog', 'missed-shot': 'miss', 'blocked-shot': 'block' };
const games = [];
for (const f of fs.readdirSync(gamesDir).filter((x) => x.endsWith('.json')).sort()) {
  for (const g of JSON.parse(fs.readFileSync(path.join(gamesDir, f), 'utf8')).games) if (g.gameType === 2) games.push(g);
}
const out = ['date,gameId,shooterId,pos,team,opp,strength,type,period'];
let done = 0;
const queue = [...games];
async function worker() {
  while (queue.length) {
    const g = queue.shift();
    const pbp = await getJson(`${WEB}/gamecenter/${g.id}/play-by-play`);
    done++;
    if (!pbp) continue;
    const pos = Object.fromEntries(g.skaters.map((s) => [s.id, s]));
    const homeId = pbp.homeTeam?.id;
    for (const p of pbp.plays || []) {
      const type = TYPES[p.typeDescKey];
      if (!type || (p.periodDescriptor?.periodType === 'SO')) continue;
      const d = p.details || {};
      const shooter = d.shootingPlayerId || d.scoringPlayerId;
      const s = pos[shooter];
      if (!s) continue;
      const code = String(p.situationCode || '').padStart(4, '0');
      if (!/^\d{4}$/.test(code)) continue;
      const [awayG, awayK, homeK, homeG] = code.split('').map(Number);
      const shooterHome = s.venue === 'H';
      const own = shooterHome ? homeK : awayK; const opp = shooterHome ? awayK : homeK;
      const oppGoalie = shooterHome ? awayG : homeG;
      const strength = oppGoalie === 0 ? 'en' : own > opp ? 'pp' : own < opp ? 'sh' : 'ev';
      out.push([g.date, g.id, shooter, s.pos, s.team, s.opp, strength, type, p.periodDescriptor?.number ?? ''].join(','));
    }
    if (done % 100 === 0) process.stderr.write(`${done} / ${games.length}\n`);
    void homeId;
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
fs.writeFileSync(outFile, out.join('\n') + '\n');
console.log(`${out.length - 1} attempts from ${games.length} games → ${outFile}`);

// What the box score does not keep but the first goal turns on: per game, from the NHL
// play-by-play and shift charts, for every game fetch.mjs pulled. One JSON per date, resumable.
//   node tools/predictors/firstgoal_extras.mjs <games dir> <out dir> [faceoffs.json]
// Per game: the first goal (scorer, period, time, seconds from the opening draw, strength from the
// situation code), the home side's first-goal flag, and per skater: first-period goals / shots /
// attempts, power-play and even-strength goals, whether he was on the ice for the opening faceoff,
// his ice time in the first 5 and 10 minutes and in the first period, and his first shift's start.
// The faceoffs taken per skater (relabel.py's input) are written too when a path is given, so a
// season needs no second pass through the play-by-play.
import fs from 'node:fs';
import path from 'node:path';

const [gamesDir, outDir, faceoffsOut] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const WEB = 'https://api-web.nhle.com/v1';
const STATS = 'https://api.nhle.com/stats/rest/en';
const UA = { 'User-Agent': 'Mozilla/5.0 (nhl-model; +https://ideareels.io)', Accept: 'application/json' };
async function getJson(url, tries = 4) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(25000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) { err = e; await new Promise((s) => setTimeout(s, 700 * (i + 1))); }
  }
  throw err;
}
const secs = (t) => { const m = String(t || '').match(/^(\d+):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const ATTEMPTS = new Set(['shot-on-goal', 'missed-shot', 'blocked-shot', 'goal']);

/** Strength of a goal from the situation code (away goalie, away skaters, home skaters, home goalie) and the scoring side. */
function strengthOf(code, homeScored) {
  if (!code || code.length !== 4) return null;
  const [ag, as, hs, hg] = code.split('').map(Number);
  const own = homeScored ? hs : as; const other = homeScored ? as : hs;
  const otherGoalie = homeScored ? ag : hg;
  if (!otherGoalie) return 'EN';
  if (own > other) return 'PP';
  if (own < other) return 'SH';
  return 'EV';
}

function extras(game, pbp, shifts) {
  const plays = [...(pbp?.plays || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const homeId = pbp?.homeTeam?.id; const awayId = pbp?.awayTeam?.id;
  const players = {};
  const P = (id) => (players[id] = players[id] || { p1G: 0, p1Sog: 0, p1Icf: 0, ppG: 0, shG: 0, evG: 0, enG: 0, g: 0, start: 0, toi5: 0, toi10: 0, toiP1: 0, firstShift: null });
  const faceoffs = {};
  let firstGoal = null;
  for (const p of plays) {
    const d = p.details || {}; const type = p.typeDescKey; const period = Number(p.periodDescriptor?.number) || 0;
    if (type === 'faceoff') { for (const k of ['winningPlayerId', 'losingPlayerId']) if (d[k]) faceoffs[d[k]] = (faceoffs[d[k]] || 0) + 1; }
    if (!ATTEMPTS.has(type)) continue;
    const shooter = d.shootingPlayerId || d.scoringPlayerId;
    if (!shooter) continue;
    const s = P(shooter);
    if (period === 1) { s.p1Icf += 1; if (type === 'shot-on-goal' || type === 'goal') s.p1Sog += 1; if (type === 'goal') s.p1G += 1; }
    if (type === 'goal' && p.periodDescriptor?.periodType !== 'SO') {
      const homeScored = d.eventOwnerTeamId === homeId;
      const st = strengthOf(p.situationCode, homeScored);
      s.g += 1; if (st === 'PP') s.ppG += 1; else if (st === 'SH') s.shG += 1; else if (st === 'EN') s.enG += 1; else s.evG += 1;
      if (!firstGoal) firstGoal = { playerId: shooter, period, time: p.timeInPeriod, secs: (period - 1) * 1200 + (secs(p.timeInPeriod) ?? 0), strength: st, home: homeScored, team: homeScored ? pbp.homeTeam?.abbrev : pbp.awayTeam?.abbrev };
    }
  }
  for (const r of shifts || []) {
    if (r.typeCode !== 517 || r.period !== 1 || !r.playerId) continue;
    const a = secs(r.startTime); const b = secs(r.endTime);
    if (a == null || b == null || b < a) continue;
    const s = P(r.playerId);
    if (a === 0) s.start = 1;
    s.toiP1 += b - a;
    s.toi5 += Math.max(0, Math.min(b, 300) - Math.min(a, 300));
    s.toi10 += Math.max(0, Math.min(b, 600) - Math.min(a, 600));
    if (s.firstShift == null || a < s.firstShift) s.firstShift = a;
  }
  const out = { id: game.id, date: game.date, home: game.home.abbrev, away: game.away.abbrev, homeId, awayId, firstGoal, shiftsRead: (shifts || []).filter((r) => r.typeCode === 517).length, players };
  return { out, faceoffs };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

const fo = faceoffsOut && fs.existsSync(faceoffsOut) ? JSON.parse(fs.readFileSync(faceoffsOut)) : {};
let total = 0;
for (const f of fs.readdirSync(gamesDir).sort()) {
  const file = path.join(outDir, f);
  const games = JSON.parse(fs.readFileSync(path.join(gamesDir, f))).games;
  if (fs.existsSync(file)) { total += games.length; continue; }
  const recs = await mapLimit(games, 6, async (g) => {
    const [pbp, sc] = await Promise.all([getJson(`${WEB}/gamecenter/${g.id}/play-by-play`), getJson(`${STATS}/shiftcharts?cayenneExp=gameId=${g.id}`)]);
    const { out, faceoffs } = extras(g, pbp, sc?.data || []);
    if (faceoffsOut) fo[g.id] = faceoffs;
    return out;
  });
  fs.writeFileSync(file, JSON.stringify({ date: f.replace('.json', ''), games: recs }));
  if (faceoffsOut) fs.writeFileSync(faceoffsOut, JSON.stringify(fo));
  total += recs.length;
  console.log(f.replace('.json', ''), recs.length, 'games', 'total', total);
}
console.log('done', total, 'games');

// The NHL API right-rail team game stats (SOG, power plays as goals/opportunities, PIM) and the score for a run of
// regular-season game ids, one JSON file a game, resumable. Usage: node tools/audit/nhl-pp-fetch.mjs <season> <from> <to> <out dir>
import fs from 'node:fs'; import path from 'node:path';
const [season, fromN, toN, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const ids = []; for (let n = Number(fromN); n <= Number(toN); n++) ids.push(`${season}02${String(n).padStart(4, '0')}`);
let misses = 0; let done = 0;
async function one(id) {
  const f = path.join(out, `${id}.json`); if (fs.existsSync(f)) { done++; return; }
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`https://api-web.nhle.com/v1/gamecenter/${id}/right-rail`, { signal: AbortSignal.timeout(20000) });
      if (r.status === 404) { misses++; return; }
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const ls = d.linescore?.totals; const gi = d.gameInfo;
      const stats = Object.fromEntries((d.teamGameStats || []).map((s) => [s.category, { away: s.awayValue, home: s.homeValue }]));
      if (!d.teamGameStats || !ls) { misses++; return; }
      const sched = await (await fetch(`https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`, { signal: AbortSignal.timeout(20000) })).json();
      if (!(sched.gameState === 'OFF' || sched.gameState === 'FINAL')) { misses++; return; }
      fs.writeFileSync(f, JSON.stringify({ id, date: sched.gameDate, away: sched.awayTeam.abbrev, home: sched.homeTeam.abbrev, score: { away: sched.awayTeam.score, home: sched.homeTeam.score }, last: sched.gameOutcome?.lastPeriodType || null, stats }));
      done++; return;
    } catch (e) { await new Promise((r) => setTimeout(r, 1000 * (t + 1))); }
  }
  misses++;
}
const q = [...ids]; const workers = Array.from({ length: 6 }, async () => { while (q.length) await one(q.shift()); });
await Promise.all(workers);
console.log(`${out}: ${done} stored, ${misses} missed`);

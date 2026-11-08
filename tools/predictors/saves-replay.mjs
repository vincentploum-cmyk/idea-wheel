// The Saves table's projection replayed with the site's own functions (lib/nhl-data/goalies-pure.js) over the games
// fetch.mjs pulled: every start from `from`, read leak-free from the games before its date — the shots the team is
// expected to allow (teamShotBook / shotsAgainst), the starter's shrunk save % (goalieBook), the saves (savesFrom) and
// the chance of each mark (savesChance) — graded against his box-score line: the miss, the bias, the Brier of 22+ /
// 25+ / 28+, and said against landed by band. The real starter is graded (the likely-starter read is its own question).
// Usage: node --import ./tools/audit/register.mjs tools/predictors/saves-replay.mjs <from YYYY-MM-DD> <games dir> [<games dir> ...]
import fs from 'node:fs';
import path from 'node:path';
import { teamShotBook, shotsAgainst, goalieBook, goalieRowsOf, goalieRowObj, savesFrom, savesChance, LEAGUE_SV, SAVES_LEAD, SAVES_FLOOR } from '../../lib/nhl-data/goalies-pure.js';
import { seasonYearOf } from '../../lib/nhl-data/picks-pure.js';

const [from, ...dirs] = process.argv.slice(2);
const games = [];
for (const d of dirs) for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json')).sort()) games.push(...JSON.parse(fs.readFileSync(path.join(d, f))).games.filter((g) => g.gameType === 2));
games.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
const dates = [...new Set(games.map((g) => g.date))].filter((d) => d >= from);
const MARKS = [...new Set([22, 25, 28, SAVES_LEAD])].sort((a, b) => a - b);
const out = [];
let skRows = []; let gkRows = []; let gi = 0;
for (const date of dates) {
  while (gi < games.length && games[gi].date < date) {
    const g = games[gi++];
    for (const s of g.skaters) skRows.push({ date: g.date, gameId: g.id, team: s.team, opp: s.opp, sog: s.sog });
    gkRows.push(...goalieRowsOf(g).map(goalieRowObj));
  }
  const season = seasonYearOf(date);
  // Last season and this only (loadRows' window).
  const rows = skRows.filter((r) => seasonYearOf(r.date) >= season - 1);
  const shotBook = teamShotBook(rows, season);
  const book = goalieBook(gkRows, season, { through: date });
  for (const g of games.filter((x) => x.date === date)) {
    for (const [team, opp, venue] of [[g.away.abbrev, g.home.abbrev, 'A'], [g.home.abbrev, g.away.abbrev, 'H']]) {
      const st = g.goalies.find((k) => k.team === team && k.starter);
      if (!st) continue;
      const gk = book.teams?.[team]?.goalies?.find((k) => k.id === st.id);
      const svPct = gk?.svPct ?? book.league?.pct ?? LEAGUE_SV;
      const sa = shotsAgainst(shotBook, team, opp, venue);
      const lam = savesFrom(sa.shots, svPct);
      out.push({ date, season, lam, sv: st.sv, p: Object.fromEntries(MARKS.map((k) => [k, savesChance(lam, k)])) });
    }
  }
}
const f2 = (v) => v.toFixed(2); const f3 = (v) => v.toFixed(3); const pc = (v) => `${(v * 100).toFixed(1)}%`;
for (const season of [...new Set(out.map((r) => r.season))]) {
  const rs = out.filter((r) => r.season === season);
  const mean = (fn) => rs.reduce((s, r) => s + fn(r), 0) / rs.length;
  const lamMean = mean((r) => r.lam); const svMean = mean((r) => r.sv);
  const ssTot = mean((r) => (r.sv - svMean) ** 2); const ssRes = mean((r) => (r.sv - r.lam) ** 2);
  console.log(`\n${season}-${String(season + 1).slice(2)}: ${rs.length} starts · projected ${f2(lamMean)}, made ${f2(svMean)} · miss ${f2(mean((r) => Math.abs(r.sv - r.lam)))} · R² ${f3(1 - ssRes / ssTot)}`);
  for (const k of MARKS) {
    const base = mean((r) => (r.sv >= k ? 1 : 0));
    console.log(`  ${k}+: said ${pc(mean((r) => r.p[k]))}, landed ${pc(base)} · Brier ${f3(mean((r) => (r.p[k] - (r.sv >= k ? 1 : 0)) ** 2))} (base rate ${f3(base * (1 - base))})`);
  }
  // The no-line fallback: a play on SAVES_LEAD saves at SAVES_FLOOR.
  const calls = rs.filter((r) => r.p[SAVES_LEAD] >= SAVES_FLOOR);
  if (calls.length) console.log(`  the fallback (${SAVES_LEAD}+ at ${pc(SAVES_FLOOR)}): ${calls.length} calls (${pc(calls.length / rs.length)} of starts), said ${pc(calls.reduce((s, r) => s + r.p[SAVES_LEAD], 0) / calls.length)}, landed ${pc(calls.filter((r) => r.sv >= SAVES_LEAD).length / calls.length)}`);
  const bands = [[0, 0.3], [0.3, 0.4], [0.4, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 1.01]];
  const cells = rs.flatMap((r) => MARKS.map((k) => ({ p: r.p[k], hit: r.sv >= k ? 1 : 0 })));
  console.log('  said → landed (every mark): ' + bands.map(([a, b]) => { const c = cells.filter((x) => x.p >= a && x.p < b); return c.length ? `${pc(c.reduce((s, x) => s + x.p, 0) / c.length)} → ${pc(c.reduce((s, x) => s + x.hit, 0) / c.length)} (${c.length})` : null; }).filter(Boolean).join(' · '));
}

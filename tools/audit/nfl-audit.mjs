// The NFL projections replayed and tuned (Vincent, 2026-11-01: "yes do the backtest and optimize it"): every week rebuilt
// from what was known that morning — each player's logs from the games before it (ESPN's box scores, both seasons), each
// defense's table by position from this season's games before it (last season's in week 1), the book's line on the game
// (ESPN's pickcenter, else its core odds) — and run through the site's own board and projections (lib/nfl/picks.js,
// lib/nfl/projections.js), then graded against the week's box scores. The constants are searched on last season (2025
// weeks 4–18; weeks 1–3 have no log behind them) and checked, unchanged, on this season's finished weeks.
//
//   node tools/audit/nfl-fetch.mjs --season 2025 --weeks 1-18 && node tools/audit/nfl-fetch.mjs --season 2026 --weeks 1-9
//   node --max-old-space-size=6144 --import ./tools/audit/register.mjs tools/audit/nfl-audit.mjs [--raw .nhl-data/audit/nfl] [--out .nhl-data/audit/out]
//
// Writes <out>/nfl-backtest.json (every figure of the report) and prints the report as markdown.
// What ESPN's box score cannot say: a player who played and recorded nothing has no line, so a receiver's zero is not in
// his logs nor graded (both here and in the real board's PropFinder logs a zero is a game; here it is missing).
import fs from 'node:fs';
import path from 'node:path';
import { parseSummary } from '../../lib/nfl/espn.js';
import { teamAbbrFromText } from '../../lib/nfl/teams.js';
import { nflBoard, makeBuild, reproject, COCKTAIL } from '../../lib/nfl/picks.js';
import { PARAMS } from '../../lib/nfl/projections.js';
import { normName } from '../../lib/nhl-data/model-key.js';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RAW = arg('--raw', '.nhl-data/audit/nfl');
const OUT = arg('--out', '.nhl-data/audit/out');
const TUNE = { season: 2025, weeks: [4, 18] };
const CHECK = { season: 2026, weeks: [1, 7] };
const SKILL = ['QB', 'RB', 'WR', 'TE'];
const STATS = ['passCmp', 'passAtt', 'passYds', 'passTd', 'passInt', 'rushAtt', 'rushYds', 'rushTd', 'rec', 'recYds', 'recTd', 'tgt', 'td'];
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const r1 = (v) => Math.round(v * 10) / 10; const r3 = (v) => Math.round(v * 1000) / 1000; const r4 = (v) => Math.round(v * 10000) / 10000;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Positions: the rosters, then the players read one by one, then the stats.
const posById = new Map();
for (const f of fs.readdirSync(path.join(RAW, 'rosters'))) for (const a of read(path.join(RAW, 'rosters', f)).athletes) posById.set(a.id, a.pos);
if (fs.existsSync(path.join(RAW, 'athletes'))) for (const f of fs.readdirSync(path.join(RAW, 'athletes'))) { const a = read(path.join(RAW, 'athletes', f)); if (a.pos) posById.set(a.id, a.pos); }
const POS = { HB: 'RB', FB: 'RB' };
const posOf = (id, tot) => {
  const p = posById.get(id); const q = POS[p] || p;
  if (SKILL.includes(q)) return q;
  if (p) return null;   // a defender or a kicker with a return or a fake
  return tot.passAtt >= 5 ? 'QB' : tot.rushAtt > tot.rec ? 'RB' : 'WR';
};

// Every game of a season: the week, the date, the teams, the line, the box score.
function loadSeason(season) {
  const weekOf = new Map();
  for (const f of fs.readdirSync(path.join(RAW, String(season), 'weeks'))) { const j = read(path.join(RAW, String(season), 'weeks', f)); for (const e of j.events || []) weekOf.set(String(e.id), j.week?.number ?? Number(f.slice(1, 3))); }
  const games = [];
  for (const f of fs.readdirSync(path.join(RAW, String(season), 'games'))) {
    const j = read(path.join(RAW, String(season), 'games', f));
    const s = parseSummary(j);
    if (!s.final || !s.away || !s.home) continue;
    const pc = (j.pickcenter || []).find((p) => p.overUnder != null && p.details) || j.coreOdds || null;
    games.push({ id: s.id, season, week: weekOf.get(s.id), date: j.header?.competitions?.[0]?.date, away: s.away, home: s.home, odds: pc ? { spread: pc.details, total: pc.overUnder } : null, box: s });
  }
  return games.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
const seasons = { 2025: loadSeason(2025), 2026: loadSeason(2026) };

// Every player's logs (the board's game-row shape) and the position he plays.
const players = new Map();   // espnId → { id, name, key, pos, games: [] }
const totals = new Map();
for (const s of [2025, 2026]) for (const g of seasons[s]) for (const p of g.box.players) {
  if (!p.espnId) continue;
  const t = totals.get(p.espnId) || { passAtt: 0, rushAtt: 0, rec: 0 }; t.passAtt += p.passAtt; t.rushAtt += p.rushAtt; t.rec += p.rec; totals.set(p.espnId, t);
}
for (const s of [2025, 2026]) for (const g of seasons[s]) for (const p of g.box.players) {
  if (!p.espnId) continue;
  const pos = posOf(p.espnId, totals.get(p.espnId));
  if (!pos) continue;
  const pl = players.get(p.espnId) || { id: p.espnId, name: p.name, key: normName(p.name), pos, games: [] };
  const opp = p.team === g.home ? g.away : g.home;
  const row = { date: String(g.date).slice(0, 10), gameId: g.id, season: s, type: 'REG', week: g.week, home: p.team === g.home, opp, team: p.team, passLong: 0 };
  for (const k of STATS) row[k] = Number(p[k]) || 0;
  row.td = row.rushTd + row.recTd + (Number(p.retTd) || 0); row.retTd = Number(p.retTd) || 0;
  row.rushRecYds = row.rushYds + row.recYds; row.passRushYds = row.passYds + row.rushYds; row.h1Td = (Number(p.h1RushTd) || 0) + (Number(p.h1RecTd) || 0);
  pl.games.push(row);
  players.set(p.espnId, pl);
}
for (const pl of players.values()) pl.games.sort((a, b) => b.date.localeCompare(a.date));

// A defense's table by position from a season's games before a date: per game what the opposing players at each
// position did (the board's allowed-table shape, rank 1 = the most), the teams' own and allowed touchdowns.
function defenseOf(season, before) {
  const per = {}; const gp = {}; const forTd = {}; const forGp = {};
  for (const g of seasons[season]) {
    if (!(g.date < before)) continue;
    for (const [team, opp] of [[g.away, g.home], [g.home, g.away]]) {
      gp[opp] = (gp[opp] || 0) + 1; forGp[team] = (forGp[team] || 0) + 1;
      let td = 0;
      const byPos = {};
      for (const p of g.box.players) {
        if (p.team !== team) continue;
        const pl = players.get(p.espnId); if (!pl) continue;
        const b = byPos[pl.pos] || (byPos[pl.pos] = Object.fromEntries(STATS.map((k) => [k, 0])));
        for (const k of STATS) if (k !== 'td') b[k] += Number(p[k]) || 0;
        b.td += (p.rushTd || 0) + (p.recTd || 0);
        td += (p.rushTd || 0) + (p.recTd || 0);
      }
      forTd[team] = (forTd[team] || 0) + td;
      per[opp] = per[opp] || {};
      for (const pos of SKILL) { const b = byPos[pos] || {}; const t = per[opp][pos] || (per[opp][pos] = Object.fromEntries(STATS.map((k) => [k, 0]))); for (const k of STATS) t[k] += b[k] || 0; }
      per[opp].ALL_TD = (per[opp].ALL_TD || 0) + td;
    }
  }
  const teams = {}; const tot = {};
  for (const [d, byPos] of Object.entries(per)) {
    teams[d] = {};
    for (const pos of SKILL) { teams[d][pos] = { gp: gp[d] }; for (const k of STATS) teams[d][pos][k] = r3(byPos[pos][k] / gp[d]); }
    tot[d] = { for: { td: forGp[d] ? r3(forTd[d] / forGp[d]) : null }, against: { td: r3(byPos.ALL_TD / gp[d]) } };
  }
  for (const t of Object.keys(forTd)) { tot[t] = tot[t] || { for: {}, against: {} }; tot[t].for.td = r3(forTd[t] / forGp[t]); }
  const ranks = {}; const league = {};
  const ts = Object.keys(teams);
  for (const pos of SKILL) {
    league[pos] = {};
    for (const k of STATS) {
      const vals = ts.map((t) => [t, teams[t][pos][k]]).sort((a, b) => b[1] - a[1]);
      vals.forEach(([t], i) => { ranks[t] = ranks[t] || {}; ranks[t][pos] = ranks[t][pos] || {}; ranks[t][pos][k] = i + 1; });
      league[pos][k] = r3(mean(vals.map((v) => v[1])));
    }
  }
  return { teams, ranks, league, count: ts.length, totals: tot, leagueFor: { td: r3(mean(Object.values(tot).map((t) => t.for?.td).filter((v) => v != null))) } };
}

// The pull for a week: every skill player of the week's teams with his logs before the week's first game, the defense
// tables of this season before it (last season's when the season has not started).
function weekInputs(season, week) {
  const games = seasons[season].filter((g) => g.week === week);
  if (!games.length) return null;
  const start = games.map((g) => String(g.date)).sort()[0];
  const day = start.slice(0, 10);
  const teamsOn = new Set(games.flatMap((g) => [g.away, g.home]));
  const pfPlayers = [];
  const played = new Map();   // key|team → his box line this week
  for (const g of games) for (const p of g.box.players) { const pl = players.get(p.espnId); if (pl) played.set(`${pl.key}|${p.team}`, { ...p, h1Td: (p.h1RushTd || 0) + (p.h1RecTd || 0) }); }
  for (const pl of players.values()) {
    const before = pl.games.filter((x) => x.date < day);
    if (!before.length) continue;
    const thisWeek = pl.games.find((x) => x.season === season && x.week === week);
    const team = thisWeek?.team || before[0].team;
    if (!teamsOn.has(team)) continue;
    pfPlayers.push({ id: pl.id, name: pl.name, key: pl.key, team, pos: pl.pos, status: null, injury: null, games: before, props: [] });
  }
  const thisSeason = seasons[season].some((g) => g.date < start);
  const defense = thisSeason ? defenseOf(season, start) : defenseOf(season - 1, '9999');
  const slate = games.map((g) => ({ id: g.id, date: g.date, away: g.away, home: g.home, final: false, state: 'pre', odds: g.odds }));
  return { args: { season, week, type: 2, games: slate, sheets: [], pf: { at: start, data: { players: pfPlayers, defense, depth: {} } }, results: {} }, played };
}

// The graded rows of one week's projections.
const YARD_MARKETS = ['rec_yds', 'rush_yds', 'pass_yds', 'receptions'];
const STAT = { rec_yds: 'recYds', rush_yds: 'rushYds', pass_yds: 'passYds', receptions: 'rec' };
const LIST = { rec_yds: (r) => ['WR', 'TE', 'RB'].includes(r.pos) && r.yards.rec_yds?.proj >= 10, rush_yds: (r) => ['RB', 'QB'].includes(r.pos) && r.yards.rush_yds?.proj >= 10, pass_yds: (r) => r.pos === 'QB' && r.yards.pass_yds?.proj >= 100, receptions: (r) => ['WR', 'TE', 'RB'].includes(r.pos) && r.yards.receptions?.proj >= 1 };
function gradeWeek(pj, played, tag) {
  const yards = []; const tds = [];
  for (const r of Object.values(pj.rows)) {
    const line = played.get(`${r.key}|${r.team}`);
    if (!line) continue;   // he did not play (or recorded nothing)
    for (const m of YARD_MARKETS) {
      const y = r.yards[m];
      if (!y || !LIST[m](r)) continue;
      yards.push({ tag, m, pos: r.pos, proj: y.proj, exp: y.exp, floor: y.floor, ceiling: y.ceiling, sd: y.sd, script: y.script, actual: Number(line[STAT[m]]) || 0 });
    }
    if (r.td) tds.push({ tag, pos: r.pos, p: r.td.p, raw: r.td.raw, p1h: r.td.p1h, lambda: r.td.lambda, td: (line.rushTd || 0) + (line.recTd || 0) + (line.retTd || 0) > 0 ? 1 : 0, td1h: line.h1Td > 0 ? 1 : 0 });
  }
  return { yards, tds };
}

// The weeks built once a cocktail (the board, the slow part); the projections run again per constant set.
const BUILT = new Map();
let builtFor = null;   // the cocktail the cache holds (one at a time: a season of boards is a gigabyte)
function weeks(range) { const out = []; for (let w = range.weeks[0]; w <= range.weeks[1]; w++) out.push([range.season, w]); return out; }
function built(cocktail, season, week) {
  const ck = JSON.stringify(cocktail);
  if (ck !== builtFor) { BUILT.clear(); builtFor = ck; }
  const k = `${ck}|${season}|${week}`;
  if (BUILT.has(k)) return BUILT.get(k);
  const inp = weekInputs(season, week);
  if (!inp) { BUILT.set(k, null); return null; }
  const b0 = nflBoard(cocktail);
  const b = makeBuild(b0)(inp.args);
  const v = { b, b0, inp };
  BUILT.set(k, v);
  return v;
}
function run(range, { cocktail = COCKTAIL, params = null } = {}) {
  const yards = []; const tds = [];
  for (const [s, w] of weeks(range)) {
    const v = built(cocktail, s, w);
    if (!v) continue;
    const pj = params ? reproject(v.b, v.inp.args, { ...PARAMS, ...params }, v.b0) : v.b.projections;
    const g = gradeWeek(pj, v.inp.played, `${s}w${w}`);
    yards.push(...g.yards); tds.push(...g.tds);
  }
  return { yards, tds };
}

// The scores.
const yardScore = (rows) => {
  const out = {};
  for (const m of YARD_MARKETS) {
    const xs = rows.filter((r) => r.m === m);
    if (!xs.length) continue;
    out[m] = { n: xs.length, mae: r1(mean(xs.map((r) => Math.abs(r.actual - r.proj)))), bias: r1(mean(xs.map((r) => r.actual - r.proj))), under: r3(mean(xs.map((r) => (r.actual < r.floor ? 1 : 0)))), over: r3(mean(xs.map((r) => (r.actual > r.ceiling ? 1 : 0)))) };
  }
  return out;
};
// The pooled yards miss, each market over its own mean miss under the shipped read, so receptions count as yards do.
const pooled = (rows, base) => mean(YARD_MARKETS.filter((m) => base[m]).map((m) => mean(rows.filter((r) => r.m === m).map((r) => Math.abs(r.actual - r.proj))) / base[m].mae));
const brier = (rows, k = 'p', y = 'td') => r4(mean(rows.map((r) => (r[k] - r[y]) ** 2)));
const logloss = (rows, k = 'p', y = 'td') => r4(mean(rows.map((r) => { const p = Math.min(0.999, Math.max(0.001, r[k])); return -(r[y] ? Math.log(p) : Math.log(1 - p)); })));
const BINS = [[0, 0.1], [0.1, 0.2], [0.2, 0.3], [0.3, 0.45], [0.45, 1.01]];
const calib = (rows, k = 'p', y = 'td') => BINS.map(([a, b]) => { const xs = rows.filter((r) => r[k] >= a && r[k] < b); return { band: `${Math.round(a * 100)}–${Math.min(100, Math.round(b * 100))}%`, n: xs.length, said: xs.length ? r3(mean(xs.map((r) => r[k]))) : null, landed: xs.length ? r3(mean(xs.map((r) => r[y]))) : null }; });
const tdScore = (rows) => ({ n: rows.length, brier: brier(rows), logloss: logloss(rows), said: r3(mean(rows.map((r) => r.p))), landed: r3(mean(rows.map((r) => r.td))), calib: calib(rows), h1: { brier: brier(rows, 'p1h', 'td1h'), said: r3(mean(rows.map((r) => r.p1h))), landed: r3(mean(rows.map((r) => r.td1h))), calib: calib(rows, 'p1h', 'td1h') } });

const t0 = Date.now();
if (process.argv.includes('--smoke')) {
  const a = Date.now(); const v = built(null, 2026, 5); const b = Date.now();
  for (let i = 0; i < 5; i++) reproject(v.b, v.inp.args, PARAMS, v.b0);
  const c = Date.now();
  const g = gradeWeek(v.b.projections, v.inp.played, 'smoke');
  console.log(`build ${b - a} ms, reproject ${(c - b) / 5} ms, players ${v.inp.args.pf.data.players.length}, rows ${Object.keys(v.b.projections.rows).length}, graded yards ${g.yards.length}, tds ${g.tds.length}`);
  console.log(JSON.stringify(yardScore(g.yards)), JSON.stringify(tdScore(g.tds)).slice(0, 300));
  const ex = Object.values(v.b.projections.rows).filter((r) => r.yards.rec_yds).sort((x, y) => y.yards.rec_yds.proj - x.yards.rec_yds.proj).slice(0, 5).map((r) => `${r.player} ${r.yards.rec_yds.floor}/${r.yards.rec_yds.proj}/${r.yards.rec_yds.ceiling} got ${v.inp.played.get(`${r.key}|${r.team}`)?.recYds ?? '—'}`);
  console.log(ex.join('\n'));
  process.exit(0);
}
const report = { at: new Date().toISOString(), tune: TUNE, check: CHECK, shipped: PARAMS };
const say = (...a) => console.error(`[${Math.round((Date.now() - t0) / 1000)}s]`, ...a);

// 0. As shipped.
const base = { tune: run(TUNE), check: run(CHECK) };
report.shipped_scores = { tune: { yards: yardScore(base.tune.yards), td: tdScore(base.tune.tds) }, check: { yards: yardScore(base.check.yards), td: tdScore(base.check.tds) } };
say('shipped', JSON.stringify(report.shipped_scores.check.yards));
const baseMae = report.shipped_scores.tune.yards;

// 1. The yards core: the board's cocktail (the windows behind his rate, the matchup's damping), rebuilt per variant.
const COCKTAILS = {
  shipped: COCKTAIL,
  'the board as it was (no damping)': null,
  'matchup damped k=4': { matchupK: 4 },
  'matchup damped k=8': { matchupK: 8 },
  'matchup damped k=16': { matchupK: 16 },
  'last 5 · 10 · season': { windows: { l5: 0.3, l10: 0.3, season: 0.4 } },
  'last 5 · 10 · season, k=8': { windows: { l5: 0.3, l10: 0.3, season: 0.4 }, matchupK: 8 },
  'season 0.8 · last 10 0.2, k=8': { windows: { l10: 0.2, season: 0.8 }, matchupK: 8 },
  'this season only, k=8': { scope: 'season', matchupK: 8 },
};
report.cocktails = {};
for (const [name, ck] of Object.entries(COCKTAILS)) {
  const t = run(TUNE, { cocktail: ck }); const c = run(CHECK, { cocktail: ck });
  report.cocktails[name] = { cocktail: ck, tune: { pooled: r4(pooled(t.yards, baseMae)), yards: yardScore(t.yards) }, check: { pooled: r4(pooled(c.yards, report.shipped_scores.check.yards)), yards: yardScore(c.yards) } };
  say('cocktail', name, report.cocktails[name].tune.pooled, report.cocktails[name].check.pooled);
}
const bestCk = Object.entries(report.cocktails).sort((a, b) => a[1].tune.pooled - b[1].tune.pooled)[0];
// A cocktail moves only on a clear gain on the tuning season (half a percent of the pooled miss), else the board stays.
const cocktail = bestCk[1].tune.pooled <= 0.995 ? bestCk[1].cocktail : COCKTAIL;
report.cocktail = { chosen: cocktail, name: bestCk[1].tune.pooled <= 0.995 ? bestCk[0] : 'shipped' };

// 2. The game script on the yards: the volume, the run and the pass, searched on the tuning season.
const grid = [];
for (const volume of [0, 0.25, 0.5, 0.75, 1]) for (const rush of [0, 0.006, 0.012, 0.018, 0.024]) for (const pass of [0, 0.004, 0.008, 0.012, 0.016]) grid.push({ volume, rush, pass });
const scriptRows = [];
for (const sc of grid) {
  const S = { ...PARAMS.SCRIPT, ...sc, volumeClamp: [0.7, 1.3], splitClamp: [0.8, 1.2] };
  const t = run(TUNE, { cocktail, params: { SCRIPT: S } });
  scriptRows.push({ ...sc, tune: r4(pooled(t.yards, baseMae)) });
}
scriptRows.sort((a, b) => a.tune - b.tune);
// The simpler read wins a near-tie: no script unless one beats it by a tenth of a percent.
const noneRow = scriptRows.find((r) => r.volume === 0 && r.rush === 0 && r.pass === 0);
const bestScript = scriptRows[0].tune < noneRow.tune - 0.001 ? scriptRows[0] : noneRow;
const S1 = { ...PARAMS.SCRIPT, volume: bestScript.volume, rush: bestScript.rush, pass: bestScript.pass, volumeClamp: [0.7, 1.3], splitClamp: [0.8, 1.2] };
const noScript = { ...PARAMS.SCRIPT, volume: 0, rush: 0, pass: 0 };
report.script = { top: scriptRows.slice(0, 8), none: scriptRows.find((r) => r.volume === 0 && r.rush === 0 && r.pass === 0), shippedLike: scriptRows.find((r) => r.volume === 0.5 && r.rush === 0.012 && r.pass === 0.008), chosen: S1,
  check: { none: r4(pooled(run(CHECK, { cocktail, params: { SCRIPT: noScript } }).yards, report.shipped_scores.check.yards)), shipped: r4(pooled(run(CHECK, { cocktail }).yards, report.shipped_scores.check.yards)), chosen: r4(pooled(run(CHECK, { cocktail, params: { SCRIPT: S1 } }).yards, report.shipped_scores.check.yards)) } };
say('script', JSON.stringify(bestScript), JSON.stringify(report.script.check));

// 3. The floor and the ceiling: per market the distances (in his spreads) that put a fifth of the tuning season's games
// under the floor and a fifth over the ceiling, then checked.
const tuned = run(TUNE, { cocktail, params: { SCRIPT: S1 } });
const quant = (xs, q) => { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const RANGE = {};
for (const m of YARD_MARKETS) {
  const z = tuned.yards.filter((r) => r.m === m && r.sd > 0).map((r) => (r.actual - r.proj) / r.sd);
  if (z.length < 50) { RANGE[m] = PARAMS.RANGE[m]; continue; }
  RANGE[m] = [r3(-quant(z, 0.2)), r3(quant(z, 0.8))];
}
report.range = RANGE;

// 4. Touchdowns: the team read's line weight and points-to-touchdowns rate, his rate's weights and shrink, the position
// clamp, searched on the tuning season by log loss.
const tdGrid = [];
for (const LINE_WEIGHT of [0, 0.25, 0.5, 0.75, 1]) for (const TD_PER_POINT of [0.095, 0.105, 0.115]) for (const RATE_K of [2, 4, 8, 16]) for (const RATE_WEIGHTS of [{ season: 1 }, { season: 0.6, l5: 0.4 }, { season: 0.8, l5: 0.2 }]) for (const POS_CLAMP of [[1, 1], [0.85, 1.15], [0.7, 1.4]]) tdGrid.push({ LINE_WEIGHT, TD_PER_POINT, RATE_K, RATE_WEIGHTS, POS_CLAMP });
const tdRows = [];
for (const prm of tdGrid) {
  const t = run(TUNE, { cocktail, params: { SCRIPT: S1, RANGE, ...prm, TD_CAL: { a: 0, b: 1 } } });
  tdRows.push({ ...prm, logloss: logloss(t.tds), brier: brier(t.tds) });
}
tdRows.sort((a, b) => a.logloss - b.logloss);
const bestTd = tdRows[0];
say('td', JSON.stringify(bestTd));
const { logloss: _l, brier: _b, ...TD1 } = bestTd;
// The calibration on top: landed = σ(a + b · logit(stated)) by maximum likelihood on the tuning season (Newton's method).
function fitCal(rows) {
  let a = 0; let b = 1;
  const xs = rows.map((r) => { const p = Math.min(0.999, Math.max(0.001, r.p)); return [Math.log(p / (1 - p)), r.td]; });
  for (let it = 0; it < 50; it++) {
    let ga = 0; let gb = 0; let haa = 0; let hab = 0; let hbb = 0;
    for (const [x, y] of xs) { const q = 1 / (1 + Math.exp(-(a + b * x))); const w = q * (1 - q); ga += y - q; gb += (y - q) * x; haa += w; hab += w * x; hbb += w * x * x; }
    const det = haa * hbb - hab * hab; if (!(Math.abs(det) > 1e-12)) break;
    const da = (hbb * ga - hab * gb) / det; const db = (haa * gb - hab * ga) / det;
    a += da; b += db; if (Math.abs(da) + Math.abs(db) < 1e-9) break;
  }
  return { a: r4(a), b: r4(b) };
}
const TD_CAL = fitCal(run(TUNE, { cocktail, params: { SCRIPT: S1, RANGE, ...TD1, TD_CAL: { a: 0, b: 1 } } }).tds);
// The first half's share of his expected touchdowns, searched on the tuning season with the calibration in.
const h1Rows = [];
for (const H1_SHARE of [0.4, 0.42, 0.44, 0.46, 0.48, 0.5, 0.52, 0.54]) { const t = run(TUNE, { cocktail, params: { SCRIPT: S1, RANGE, ...TD1, TD_CAL, H1_SHARE } }).tds; h1Rows.push({ H1_SHARE, logloss: logloss(t, 'p1h', 'td1h'), said: r3(mean(t.map((r) => r.p1h))), landed: r3(mean(t.map((r) => r.td1h))) }); }
h1Rows.sort((a, b) => a.logloss - b.logloss);
const H1 = h1Rows[0].H1_SHARE;
report.td = { top: tdRows.slice(0, 8), shippedLike: tdRows.find((r) => r.LINE_WEIGHT === 0.5 && r.TD_PER_POINT === 0.105 && r.RATE_K === 4 && r.RATE_WEIGHTS.l5 === 0.4 && r.POS_CLAMP[0] === 0.7), chosen: TD1, cal: TD_CAL, h1: h1Rows };

// 5. The chosen set, checked on this season unchanged.
const CHOSEN = { SCRIPT: S1, RANGE, ...TD1, TD_CAL, H1_SHARE: H1 };
const fin = { tune: run(TUNE, { cocktail, params: CHOSEN }), check: run(CHECK, { cocktail, params: CHOSEN }) };
report.chosen = { cocktail, params: CHOSEN, tune: { yards: yardScore(fin.tune.yards), td: tdScore(fin.tune.tds) }, check: { yards: yardScore(fin.check.yards), td: tdScore(fin.check.tds) } };
report.byWeek = {};
for (const [s, w] of weeks(CHECK)) {
  const tag = `${s}w${w}`;
  const a = base.check.yards.filter((r) => r.tag === tag); const b = fin.check.yards.filter((r) => r.tag === tag);
  report.byWeek[tag] = { shipped: yardScore(a), chosen: yardScore(b), tdShipped: brier(base.check.tds.filter((r) => r.tag === tag)), tdChosen: brier(fin.check.tds.filter((r) => r.tag === tag)) };
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'nfl-backtest.json'), JSON.stringify(report, null, 1));
say('done');
console.log(JSON.stringify({ cocktail: report.cocktail, script: { chosen: bestScript, check: report.script.check }, range: RANGE, td: report.td.chosen, cal: TD_CAL, h1: H1 }));

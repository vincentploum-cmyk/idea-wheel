// The NFL projections replayed on PropFinder's own data (Vincent, 2026-11-01: "Backtest it with the real PropFinder
// data"). The site's stored pulls (tools/audit's export: GET /api/nfl/propfinder?export=1, the nfl-pf-export workflow)
// carry every rostered player's PropFinder game logs back to 2024, a zero-stat game included, and PropFinder's defense
// tables and the books' lines as they stood when each pull ran. So:
//
//   1. Every week of 2025 (tune, weeks 4–18) and 2026 (check, weeks 1–7) rebuilt from PropFinder's logs cut before the
//      week, each defense's table rebuilt from the same logs (this season's games before the week, by position), the
//      game's line from ESPN as the site reads it; graded on PropFinder's own row for the game (zeros in).
//   2. The rebuilt tables checked against the tables PropFinder published (the pulls of Oct 21 and Nov 1).
//   3. Week 7 on the tables PropFinder published going into it (the pull of Oct 21, the Wednesday before), beside the
//      rebuilt ones, and every projection against the books' main line priced that day (and the anytime TD prices).
//   4. The constants tuned again on these data where they move (the matchup's damping, the floor / ceiling, the
//      touchdowns' read), checked unchanged on 2026.
//
//   node --max-old-space-size=8192 --import ./tools/audit/register.mjs tools/audit/nfl-pf-audit.mjs [--pf .nhl-data/audit/nfl-pf] [--raw .nhl-data/audit/nfl] [--out .nhl-data/audit/out]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parseSummary } from '../../lib/nfl/espn.js';
import { nflBoard, makeBuild, reproject, COCKTAIL } from '../../lib/nfl/picks.js';
import { PARAMS, chanceAtMark } from '../../lib/nfl/projections.js';
import { digestPages } from '../../lib/nfl/matchups.js';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PF = arg('--pf', '.nhl-data/audit/nfl-pf');
const RAW = arg('--raw', '.nhl-data/audit/nfl');
const OUT = arg('--out', '.nhl-data/audit/out');
const TUNE = { season: 2025, weeks: [4, 18] };
// --check-to: the last 2026 week graded (7 when this was written; the export of 2026-11-08 carries week 8's games).
const CHECK = { season: 2026, weeks: [1, Number(arg('--check-to', '7'))] };
const SKILL = ['QB', 'RB', 'WR', 'TE'];
const STATS = ['passCmp', 'passAtt', 'passYds', 'passTd', 'passInt', 'rushAtt', 'rushYds', 'rushTd', 'rec', 'recYds', 'recTd', 'tgt', 'td'];
const read = (f) => JSON.parse(f.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(f)).toString('utf8') : fs.readFileSync(f, 'utf8'));
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10); const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000); const r4 = (v) => (v == null ? null : Math.round(v * 10000) / 10000);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const t0 = Date.now();
const say = (...a) => console.error(`[${Math.round((Date.now() - t0) / 1000)}s]`, ...a);
// --pages-prior <export week file>: last season's matchup pages (coverage, receiver splits, rushing: PropFinder serves 2025's)
// digested and attached to every 2026 week, so the pages' hand-set factors (lib/nfl/matchups.js) are graded leak-free.
const PAGES_PRIOR = (() => {
  const f = arg('--pages-prior');
  if (!f) return null;
  const pg = read(f).pages || {};
  return digestPages({ coverageTeams: pg.coverageTeamsPrior, coverageReceiverSplits: pg.coverageReceiverSplitsPrior, rushingSlateBoard: pg.rushingSlateBoardPrior }, { at: 'prior' });
})();

// ESPN's schedule and lines (what the site's board reads for the games), every finished regular-season game.
function loadSeason(season) {
  const weekOf = new Map();
  for (const f of fs.readdirSync(path.join(RAW, String(season), 'weeks'))) { const j = read(path.join(RAW, String(season), 'weeks', f)); for (const e of j.events || []) weekOf.set(String(e.id), j.week?.number ?? Number(f.slice(1, 3))); }
  const games = [];
  for (const f of fs.readdirSync(path.join(RAW, String(season), 'games'))) {
    const j = read(path.join(RAW, String(season), 'games', f));
    const s = parseSummary(j);
    if (!s.final || !s.away || !s.home) continue;
    const pc = (j.pickcenter || []).find((p) => p.overUnder != null && p.details) || j.coreOdds || null;
    games.push({ id: s.id, season, week: weekOf.get(s.id), date: j.header?.competitions?.[0]?.date, away: s.away, home: s.home, odds: pc ? { spread: pc.details, total: pc.overUnder } : null });
  }
  return games.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
// 2024 too when its ESPN files are fetched (the big-game study's extra season: --dump replays its weeks 6–18).
const SEASONS = [2024, 2025, 2026].filter((y) => fs.existsSync(path.join(RAW, String(y), 'games')));
const seasons = Object.fromEntries(SEASONS.map((y) => [y, loadSeason(y)]));
// PropFinder dates a game by its UTC day (the Thursday opener of Sept 10 ET is 2026-09-11).
const gameAt = new Map();   // `${utcDay}|${team}` → { g, opp }
const gameById = new Map();
for (const s of SEASONS) for (const g of seasons[s]) { const d = String(g.date).slice(0, 10); gameAt.set(`${d}|${g.away}`, { g, opp: g.home }); gameAt.set(`${d}|${g.home}`, { g, opp: g.away }); gameById.set(g.id, g); }

// The pulls, newest last; every player once, his logs from the newest pull that has him (with the older pulls' rows a
// newer one lacks), each REG row of 2025–26 placed on its ESPN game (his team that day = the opponent's opponent).
const PULLS = fs.readdirSync(PF).filter((f) => /^w\d\d\.json(\.gz)?$/.test(f)).sort().filter((f, i, a) => !(f.endsWith('.gz') && a.includes(f.slice(0, -3)))).map((f) => ({ file: f, ...read(path.join(PF, f)) }));
say('pulls', PULLS.map((p) => `${p.file} ${p.pull?.at}`).join(' · '));
const players = new Map();
let placed = 0; let unplaced = 0;
for (const pull of PULLS) for (const p of pull.pull?.data?.players || []) {
  if (!SKILL.includes(p.pos) || !(p.games || []).length) continue;
  const cur = players.get(p.id) || { id: p.id, name: p.name, key: p.key, pos: p.pos, team: p.team, rows: new Map() };
  cur.name = p.name; cur.key = p.key; cur.pos = p.pos; cur.team = p.team;
  // The period fields are sparse (kept when not 0): a row from a pull that carries them reads a missing one as 0.
  const periods = (p.games || []).some((g) => Object.keys(g).some((k) => /^h1/.test(k)));
  for (const g of p.games) cur.rows.set(`${g.date}|${g.opp}`, { ...g, h1Known: periods });
  players.set(p.id, cur);
}
for (const pl of players.values()) {
  pl.games = [...pl.rows.values()].map((g) => {
    const row = { ...g };
    for (const k of STATS) row[k] = Number(row[k]) || 0;
    row.td = row.rushTd + row.recTd + (Number(row.retTd) || 0);
    row.rushRecYds = row.rushYds + row.recYds; row.passRushYds = row.passYds + row.rushYds;
    if (row.type === 'REG' && SEASONS.includes(row.season)) {
      const at = gameAt.get(`${row.date}|${row.opp}`);
      if (at) { row.espnId = at.g.id; row.team = at.opp; row.week = at.g.week; row.home = at.g.home === row.team; placed++; } else unplaced++;
    }
    return row;
  }).sort((a, b) => b.date.localeCompare(a.date));
  delete pl.rows;
}
say('players', players.size, 'REG rows placed on a game', placed, 'not placed', unplaced);

// A defense's table by position from the season's PropFinder rows before a date: per game what the opposing players at
// each position did (the board's allowed-table shape, rank 1 = the most), the teams' own and allowed touchdowns.
const ACTIVE = (g) => g.rec || g.tgt || g.rushAtt || g.passAtt || g.recYds || g.rushYds || g.passYds || g.td;
function defenseOf(season, before) {
  const gp = {}; for (const g of seasons[season]) if (g.date < before) { gp[g.away] = (gp[g.away] || 0) + 1; gp[g.home] = (gp[g.home] || 0) + 1; }
  const sum = {}; const forTd = {}; const agTd = {};
  for (const pl of players.values()) for (const g of pl.games) {
    if (g.season !== season || !g.espnId) continue;
    const espn = gameById.get(g.espnId);
    if (!(espn.date < before)) continue;
    const d = g.opp; const b = ((sum[d] = sum[d] || {})[pl.pos] = sum[d]?.[pl.pos] || Object.fromEntries(STATS.map((k) => [k, 0])));
    for (const k of STATS) if (k !== 'td') b[k] += g[k];
    b.td += g.rushTd + g.recTd;
    forTd[g.team] = (forTd[g.team] || 0) + g.rushTd + g.recTd; agTd[d] = (agTd[d] || 0) + g.rushTd + g.recTd;
  }
  const teams = {}; const totals = {};
  for (const [d, byPos] of Object.entries(sum)) {
    teams[d] = {};
    for (const pos of SKILL) { teams[d][pos] = { gp: gp[d], season }; for (const k of STATS) teams[d][pos][k] = r3((byPos[pos]?.[k] || 0) / gp[d]); }
  }
  for (const t of Object.keys(gp)) totals[t] = { for: { td: r3((forTd[t] || 0) / gp[t]) }, against: { td: r3((agTd[t] || 0) / gp[t]) } };
  const ranks = {}; const league = {};
  const ts = Object.keys(teams);
  for (const pos of SKILL) {
    league[pos] = {};
    for (const k of STATS) {
      const vals = ts.map((t) => [t, teams[t][pos][k]]).sort((a, b) => b[1] - a[1]);
      vals.forEach(([t], i) => { ((ranks[t] = ranks[t] || {})[pos] = ranks[t][pos] || {})[k] = i + 1; });
      league[pos][k] = r3(mean(vals.map((v) => v[1])));
    }
  }
  return { teams, ranks, league, count: ts.length, totals, leagueFor: { td: r3(mean(Object.values(totals).map((t) => t.for.td))) } };
}

// The week's inputs. `defense`: 'rebuilt' (from the logs), or a published table object; `noFor`: the teams' own
// touchdowns left out (as the real pulls carry them: no Team row, `totals[ABBR].for` null, `leagueFor` empty).
function weekInputs(season, week, { defense = 'rebuilt', noFor = false, depth = null, props = null } = {}) {
  const games = seasons[season].filter((g) => g.week === week);
  if (!games.length) return null;
  const start = games.map((g) => String(g.date)).sort()[0];
  const day = start.slice(0, 10);
  const ids = new Set(games.map((g) => g.id));
  const teamsOn = new Set(games.flatMap((g) => [g.away, g.home]));
  const pfPlayers = []; const played = new Map();
  for (const pl of players.values()) {
    const before = pl.games.filter((x) => x.date < day);
    const now = pl.games.find((x) => ids.has(x.espnId));
    if (!before.length && !now) continue;
    const team = now?.team || before.find((x) => x.team)?.team || pl.team;
    if (!teamsOn.has(team)) continue;
    if (now) played.set(`${pl.key}|${team}`, now);
    if (!before.length) continue;
    pfPlayers.push({ id: pl.id, name: pl.name, key: pl.key, team, pos: pl.pos, status: null, injury: null, games: before, props: props?.get(pl.id) || [] });
  }
  let def = defense === 'rebuilt' ? (seasons[season].some((g) => g.date < start) || !seasons[season - 1] ? defenseOf(season, start) : defenseOf(season - 1, '9999')) : defense;
  if (noFor && def) def = { ...def, totals: Object.fromEntries(Object.entries(def.totals || {}).map(([t, v]) => [t, { ...v, for: null }])), leagueFor: {} };
  const slate = games.map((g) => ({ id: g.id, date: g.date, away: g.away, home: g.home, final: false, state: 'pre', odds: g.odds }));
  return { args: { season, week, type: 2, games: slate, sheets: [], pf: { at: start, data: { players: pfPlayers, defense: def, depth: depth || {} }, ...(PAGES_PRIOR && season === 2026 ? { matchups: PAGES_PRIOR } : {}) }, results: {} }, played };
}

// The graded rows of one week's projections (his PropFinder row for the game; a zero is a game).
const YARD_MARKETS = ['rec_yds', 'rush_yds', 'pass_yds', 'receptions'];
const STAT = { rec_yds: 'recYds', rush_yds: 'rushYds', pass_yds: 'passYds', receptions: 'rec' };
const LIST = { rec_yds: (r) => ['WR', 'TE', 'RB'].includes(r.pos) && r.yards.rec_yds?.proj >= 10, rush_yds: (r) => ['RB', 'QB'].includes(r.pos) && r.yards.rush_yds?.proj >= 10, pass_yds: (r) => r.pos === 'QB' && r.yards.pass_yds?.proj >= 100, receptions: (r) => ['WR', 'TE', 'RB'].includes(r.pos) && r.yards.receptions?.proj >= 1 };
function gradeWeek(pj, played, tag, lines = null) {
  const yards = []; const tds = []; const rungs = []; const bigs = [];
  for (const r of Object.values(pj.rows)) {
    const line = played.get(`${r.key}|${r.team}`);
    if (!line) continue;
    const book = lines?.get(`${r.key}|${r.team}`) || null;
    for (const m of YARD_MARKETS) {
      const y = r.yards[m];
      if (!y || (!DUMP && !LIST[m](r))) continue;
      const bl = book?.[m] || null;
      for (const [tier, t] of Object.entries(y.tiers || {})) if (t) rungs.push({ tag, m, tier, p: t.p, hit: line[STAT[m]] >= t.mark ? 1 : 0 });
      yards.push({ tag, m, pos: r.pos, key: r.key, team: r.team, opp: r.opp, matchup: y.matchup, proj: y.proj, exp: y.exp, floor: y.floor, ceiling: y.ceiling, sd: y.sd, tiers: y.tiers, actual: line[STAT[m]], att: Number(line.passAtt) || 0, rushAtt: Number(line.rushAtt) || 0, tgt: Number(line.tgt) || 0, active: !!ACTIVE(line), line: bl?.line ?? null, odds: bl?.odds ?? null, underOdds: bl?.underOdds ?? null });
    }
    for (const [m, b] of Object.entries(r.big || {})) for (const mk of b.marks) if (b.p[mk] != null) bigs.push({ tag, m, mark: mk, first: mk === b.marks[0], p: b.p[mk], hit: line[STAT[m]] >= mk ? 1 : 0, player: r.player, share: b.ctx.tgtShare, proj: b.proj });
    if (r.td) tds.push({ tag, key: r.key, team: r.team, pos: r.pos, p: r.td.p, raw: r.td.raw, p1h: r.td.p1h, td: line.rushTd + line.recTd + (line.retTd || 0) > 0 ? 1 : 0, td1h: (Number(line.h1RushTd) || 0) + (Number(line.h1RecTd) || 0) > 0 ? 1 : 0, h1Known: !!line.h1Known, active: !!ACTIVE(line), odds: book?.anytime_td?.odds ?? null, p2: r.td.p2, two: line.rushTd + line.recTd + (line.retTd || 0) >= 2 ? 1 : 0, pFirst: r.td.pFirst, first: Number(line.firstTd) > 0 ? 1 : 0 });
  }
  return { yards, tds, rungs, bigs };
}

const DUMP = process.argv.includes('--dump');
const BUILT = new Map(); let builtFor = null;
const weeks = (range) => { const out = []; for (let w = range.weeks[0]; w <= range.weeks[1]; w++) out.push([range.season, w]); return out; };
function built(cocktail, season, week, opts = {}) {
  const ck = JSON.stringify(cocktail) + JSON.stringify({ ...opts, defense: typeof opts.defense === 'object' ? 'published' : opts.defense, props: !!opts.props, depth: !!opts.depth });
  if (ck !== builtFor) { BUILT.clear(); builtFor = ck; }
  const k = `${season}|${week}`;
  if (BUILT.has(k)) return BUILT.get(k);
  const inp = weekInputs(season, week, opts);
  if (!inp) { BUILT.set(k, null); return null; }
  const b0 = nflBoard(cocktail);
  const v = { b: makeBuild(b0)(inp.args), b0, inp };
  BUILT.set(k, v);
  return v;
}
function run(range, { cocktail = COCKTAIL, params = null, lines = null, ...opts } = {}) {
  const yards = []; const tds = []; const rungs = []; const bigs = [];
  for (const [s, w] of weeks(range)) {
    const v = built(cocktail, s, w, opts);
    if (!v) continue;
    const pj = params ? reproject(v.b, v.inp.args, { ...PARAMS, ...params }, v.b0) : v.b.projections;
    const g = gradeWeek(pj, v.inp.played, `${s}w${w}`, lines);
    yards.push(...g.yards); tds.push(...g.tds); rungs.push(...g.rungs); bigs.push(...g.bigs);
  }
  return { yards, tds, rungs, bigs };
}

const yardScore = (rows) => {
  const out = {};
  for (const m of YARD_MARKETS) {
    const xs = rows.filter((r) => r.m === m);
    if (!xs.length) continue;
    out[m] = { n: xs.length, mae: r1(mean(xs.map((r) => Math.abs(r.actual - r.proj)))), bias: r1(mean(xs.map((r) => r.actual - r.proj))), under: r3(mean(xs.map((r) => (r.actual < r.floor ? 1 : 0)))), over: r3(mean(xs.map((r) => (r.actual > r.ceiling ? 1 : 0)))) };
  }
  return out;
};
const pooled = (rows, base) => mean(YARD_MARKETS.filter((m) => base[m]).map((m) => mean(rows.filter((r) => r.m === m).map((r) => Math.abs(r.actual - r.proj))) / base[m].mae));
const brier = (rows, k = 'p', y = 'td') => r4(mean(rows.map((r) => (r[k] - r[y]) ** 2)));
const logloss = (rows, k = 'p', y = 'td') => r4(mean(rows.map((r) => { const p = Math.min(0.999, Math.max(0.001, r[k])); return -(r[y] ? Math.log(p) : Math.log(1 - p)); })));
const BINS = [[0, 0.1], [0.1, 0.2], [0.2, 0.3], [0.3, 0.45], [0.45, 1.01]];
const calib = (rows, k = 'p', y = 'td') => BINS.map(([a, b]) => { const xs = rows.filter((r) => r[k] >= a && r[k] < b); return { band: `${Math.round(a * 100)}–${Math.min(100, Math.round(b * 100))}%`, n: xs.length, said: xs.length ? r3(mean(xs.map((r) => r[k]))) : null, landed: xs.length ? r3(mean(xs.map((r) => r[y]))) : null }; });
const tdScore = (rows) => { const h = rows.filter((r) => r.h1Known); return { n: rows.length, brier: brier(rows), logloss: logloss(rows), said: r3(mean(rows.map((r) => r.p))), landed: r3(mean(rows.map((r) => r.td))), calib: calib(rows), h1: h.length ? { n: h.length, brier: brier(h, 'p1h', 'td1h'), said: r3(mean(h.map((r) => r.p1h))), landed: r3(mean(h.map((r) => r.td1h))) } : null }; };
const implied = (o) => (o == null ? null : o > 0 ? 100 / (o + 100) : -o / (-o + 100));

const report = { at: new Date().toISOString(), pulls: PULLS.map((p) => ({ file: p.file, at: p.pull?.at, week: p.week, players: p.pull?.data?.players?.length, sheets: (p.sheets || []).map((s) => ({ fileName: s.fileName, rows: s.rows?.length, ocr: s.ocr?.status || null })) })), placed, unplaced, shipped: PARAMS, cocktail: COCKTAIL };

// 1. The rebuilt tables against PropFinder's published ones, at each pull (the season table, this season's games before it).
report.tables = {};
for (const pull of PULLS) {
  const pub = pull.pull?.data?.defense; if (!pub?.teams) continue;
  const at = pull.pull.at;
  const reb = defenseOf(2026, at);
  const cells = {};
  for (const [pos, k] of [['WR', 'recYds'], ['TE', 'recYds'], ['RB', 'rushYds'], ['RB', 'recYds'], ['QB', 'passYds'], ['WR', 'rec'], ['RB', 'td'], ['WR', 'td']]) {
    const pairs = Object.keys(pub.teams).filter((t) => pub.teams[t]?.[pos]?.[k] != null && reb.teams[t]?.[pos]?.[k] != null).map((t) => [pub.teams[t][pos][k], reb.teams[t][pos][k], pub.teams[t][pos].gp, reb.teams[t][pos].gp]);
    if (pairs.length < 10) continue;
    const mx = mean(pairs.map((p) => p[0])); const my = mean(pairs.map((p) => p[1]));
    const cov = mean(pairs.map((p) => (p[0] - mx) * (p[1] - my))); const sx = Math.sqrt(mean(pairs.map((p) => (p[0] - mx) ** 2))); const sy = Math.sqrt(mean(pairs.map((p) => (p[1] - my) ** 2)));
    cells[`${pos} ${k}`] = { teams: pairs.length, published: r1(mx), rebuilt: r1(my), corr: r3(cov / (sx * sy)), meanAbsDiff: r1(mean(pairs.map((p) => Math.abs(p[0] - p[1])))), gpSame: r3(mean(pairs.map((p) => (p[2] === p[3] ? 1 : 0)))) };
  }
  report.tables[pull.file] = { at, blended: Object.values(pub.teams).some((t) => Object.values(t).some((r) => r?.prior)), forRows: Object.values(pub.totals || {}).filter((t) => t?.for).length, cells };
}
say('tables', JSON.stringify(report.tables));

// The books' lines a pull carried (the main line per market) by PropFinder id, for the week the pull ran before.
function linesOf(pull) {
  const out = new Map();
  for (const p of pull.pull?.data?.players || []) {
    const m = {};
    for (const x of p.props || []) if (x.isMain !== false && ['rec_yds', 'rush_yds', 'pass_yds', 'receptions', 'anytime_td'].includes(x.market) && !m[x.market]) m[x.market] = { line: x.line, odds: x.odds, underOdds: x.underOdds ?? null };
    if (Object.keys(m).length) out.set(`${p.key}|${p.team}`, m);
  }
  return out;
}
const propsOf = (pull) => new Map((pull.pull?.data?.players || []).filter((p) => p.props?.length).map((p) => [p.id, p.props]));

// 2. As shipped, on PropFinder's logs: the teams' own touchdowns in (as the backtest assumed) and out (as the pulls are).
const base = { tune: run(TUNE), check: run(CHECK) };
const baseMae = yardScore(base.tune.yards); const baseCheck = yardScore(base.check.yards);
report.shipped = { tune: { yards: baseMae, td: tdScore(base.tune.tds) }, check: { yards: baseCheck, td: tdScore(base.check.tds) } };
// --dump: every graded player-game's board read, for the big-game study (tools/audit/nfl_big.py).
if (DUMP) {
  fs.mkdirSync(OUT, { recursive: true });
  const extra = seasons[2024] ? run({ season: 2024, weeks: [6, 18] }).yards : [];
  const rows = [...extra, ...base.tune.yards, ...base.check.yards].map((r) => ({ tag: r.tag, m: r.m, pos: r.pos, key: r.key, team: r.team, opp: r.opp, proj: r.proj, sd: r.sd, tiers: r.tiers, floor: r.floor, ceiling: r.ceiling, matchup: r.matchup, actual: r.actual, att: r.att, rushAtt: r.rushAtt, tgt: r.tgt, active: r.active, exp: r.exp }));
  fs.writeFileSync(path.join(OUT, 'nfl-board-rows.json'), JSON.stringify(rows));
  // the touchdown reads beside them (the TD engine study, tools/audit/nfl_engines.py)
  const tdRows = [...base.tune.tds, ...base.check.tds].map((r) => ({ tag: r.tag, key: r.key, team: r.team, pos: r.pos, p: r.p, td: r.td, active: r.active }));
  fs.writeFileSync(path.join(OUT, 'nfl-board-tds.json'), JSON.stringify(tdRows));
  say('dumped', rows.length); process.exit(0);
}
// The ladders' tiers and the other touchdown reads, said against landed.
const ladderScore = (rows) => Object.fromEntries(['strong', 'lean', 'thin'].map((tier) => { const xs = rows.filter((r) => r.tier === tier); return [tier, { n: xs.length, said: r3(mean(xs.map((r) => r.p))), landed: r3(mean(xs.map((r) => r.hit))), byMarket: Object.fromEntries(YARD_MARKETS.map((m) => { const ys = xs.filter((r) => r.m === m); return [m, ys.length ? [ys.length, r3(mean(ys.map((r) => r.p))), r3(mean(ys.map((r) => r.hit)))] : null]; })) }]; }));
const otherTd = (rows) => { const f = rows.filter((r) => r.h1Known && r.pFirst != null); return { two: { n: rows.length, brier: brier(rows, 'p2', 'two'), said: r3(mean(rows.map((r) => r.p2))), landed: r3(mean(rows.map((r) => r.two))), calib: calib(rows, 'p2', 'two') }, first: { n: f.length, brier: brier(f, 'pFirst', 'first'), said: r3(mean(f.map((r) => r.pFirst))), landed: r3(mean(f.map((r) => r.first))), calib: calib(f, 'pFirst', 'first') } }; };
report.ladders = { tune: ladderScore(base.tune.rungs), check: ladderScore(base.check.rungs) };
// Each market's residuals in his spreads ((got − projection) / spread) on the tuning season, at 5% steps: the ladder's curve.
const qOf = (xs, q) => { const s2 = [...xs].sort((a, b) => a - b); const i = (s2.length - 1) * q; const lo = Math.floor(i); return s2[lo] + (s2[Math.ceil(i)] - s2[lo]) * (i - lo); };
report.resid = Object.fromEntries(YARD_MARKETS.map((m) => { const z = base.tune.yards.filter((r) => r.m === m && r.sd > 0).map((r) => (r.actual - r.proj) / r.sd); return [m, Array.from({ length: 19 }, (_, i) => r3(qOf(z, (i + 1) * 0.05)))]; }));
say('resid', JSON.stringify(report.resid));
report.otherTd = { tune: otherTd(base.tune.tds), check: otherTd(base.check.tds) };
say('ladders', JSON.stringify(report.ladders.check), 'other td', JSON.stringify(report.otherTd.check));
// The big games (Vincent, 2026-11-01: "how can I find the super matchups that result in the big wins … today's matchup can
// lead up to 150 rushing yards"): the chance of a big mark, said against landed, overall and by the matchup's third.
const BIG = { rush_yds: [75, 100, 125, 150], rec_yds: [75, 100, 125, 150], pass_yds: [250, 300, 350], receptions: [6, 8, 10] };
function bigScore(rows) {
  const out = {};
  for (const [m, marks] of Object.entries(BIG)) {
    const xs = rows.filter((r) => r.m === m && r.sd > 0);
    out[m] = {};
    for (const mark of marks) {
      const all = xs.map((r) => ({ p: chanceAtMark(r, mark, m), hit: r.actual >= mark ? 1 : 0, mu: r.matchup ?? 1, proj: r.proj }));
      const band = (lo, hi) => { const b = all.filter((x) => x.p >= lo && x.p < hi); return b.length ? [b.length, r3(mean(b.map((x) => x.p))), r3(mean(b.map((x) => x.hit)))] : null; };
      const sorted = [...all].sort((a, b) => a.mu - b.mu); const n3 = Math.floor(sorted.length / 3);
      const third = (arr) => { const b = arr.filter((x) => x.p >= 0.05); return b.length ? [b.length, r3(mean(b.map((x) => x.p))), r3(mean(b.map((x) => x.hit)))] : null; };
      out[m][mark] = { n: all.length, bands: { '5–15%': band(0.05, 0.15), '15–30%': band(0.15, 0.3), '30–50%': band(0.3, 0.5), '50%+': band(0.5, 1.01) }, byMatchup: { tough: third(sorted.slice(0, n3)), middle: third(sorted.slice(n3, 2 * n3)), soft: third(sorted.slice(2 * n3)) } };
    }
  }
  // At the same projection, does a soft matchup bring the big game more often? Pairs of projection band × matchup third.
  return out;
}
report.big = { tune: bigScore(base.tune.yards), check: bigScore(base.check.yards) };
// The top of the week: per week the 5 likeliest to reach the big mark, how many did.
function topOfWeek(rows, m, mark, k = 5) {
  const weeks2 = [...new Set(rows.map((r) => r.tag))]; let n = 0; let hit = 0; let said = 0;
  for (const w of weeks2) { const xs = rows.filter((r) => r.tag === w && r.m === m && r.sd > 0).map((r) => ({ p: chanceAtMark(r, mark, m), hit: r.actual >= mark })).sort((a, b) => b.p - a.p).slice(0, k); n += xs.length; hit += xs.filter((x) => x.hit).length; said += xs.reduce((s2, x) => s2 + x.p, 0); }
  return { n, said: r3(said / n), landed: r3(hit / n) };
}
report.bigTop = Object.fromEntries(['tune', 'check'].map((k) => [k, { rush100: topOfWeek(base[k].yards, 'rush_yds', 100), rush150: topOfWeek(base[k].yards, 'rush_yds', 150), rec100: topOfWeek(base[k].yards, 'rec_yds', 100), rec150: topOfWeek(base[k].yards, 'rec_yds', 150), pass300: topOfWeek(base[k].yards, 'pass_yds', 300) }]));
// The site's big-game chances (lib/nfl/projections.js BIG), as the board prints them: said against landed, the week's top 5.
const bigSite = (rows) => Object.fromEntries(['rush_yds|100', 'rush_yds|150', 'rec_yds|100', 'rec_yds|150', 'pass_yds|300', 'pass_yds|350'].map((k) => {
  const [m, mk] = k.split('|'); const xs = rows.filter((r) => r.m === m && r.mark === Number(mk));
  const top = [...new Set(xs.map((r) => r.tag))].flatMap((t) => xs.filter((r) => r.tag === t).sort((a, b) => b.p - a.p).slice(0, 5));
  return [k, { n: xs.length, said: r3(mean(xs.map((r) => r.p))), landed: r3(mean(xs.map((r) => r.hit))), brier: brier(xs, 'p', 'hit'), top5: { said: r3(mean(top.map((r) => r.p))), landed: r3(mean(top.map((r) => r.hit))) } }];
}));
report.bigSite = { tune: bigSite(base.tune.bigs), check: bigSite(base.check.bigs) };
if (process.argv.includes('--debug-share')) { console.log(JSON.stringify(base.check.bigs.filter((r) => r.m === 'rec_yds' && r.mark === 100 && r.tag === '2026w5').sort((a, b) => b.p - a.p).slice(0, 12))); process.exit(0); }
if (process.argv.includes('--big')) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'nfl-pf-big.json'), JSON.stringify({ big: report.big, top: report.bigTop, site: report.bigSite }, null, 1)); process.exit(0); }
if (process.argv.includes('--ladders')) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'nfl-pf-ladders.json'), JSON.stringify({ ladders: report.ladders, otherTd: report.otherTd }, null, 1)); process.exit(0); }
say('shipped', JSON.stringify(baseCheck), JSON.stringify(report.shipped.check.td).slice(0, 200));
const asLive = { tune: run(TUNE, { noFor: true }), check: run(CHECK, { noFor: true }) };
report.asLive = { note: 'the pulls carry no team row: totals.for null, leagueFor empty', tune: { td: tdScore(asLive.tune.tds) }, check: { td: tdScore(asLive.check.tds) } };
say('as live (no team own TDs)', JSON.stringify(report.asLive.check.td).slice(0, 200));
// The active games alone (a line with a figure), the population ESPN's box score grades, beside it.
report.shipped.checkActive = { yards: yardScore(base.check.yards.filter((r) => r.active)), td: tdScore(base.check.tds.filter((r) => r.active)) };

// 3. Week 7 on what PropFinder published going into it (the pull of the Wednesday before) and the books' lines that day.
const pre7 = PULLS.find((p) => p.pull?.at && seasons[2026].filter((g) => g.week === 7).every((g) => p.pull.at < g.date) && seasons[2026].filter((g) => g.week === 6).every((g) => p.pull.at > g.date));
if (pre7) {
  const W7 = { season: 2026, weeks: [7, 7] };
  const lines = linesOf(pre7);
  const pub = pre7.pull.data.defense;
  const variants = {
    'rebuilt table': run(W7, { lines }),
    'PropFinder table as published': run(W7, { lines, defense: pub }),
    'PropFinder table, no team row (as live)': run(W7, { lines, defense: pub, noFor: true }),
    'rebuilt, the books’ props on the board': run(W7, { lines, props: propsOf(pre7) }),
  };
  const latest = PULLS[PULLS.length - 1];
  if (latest?.pull?.data?.depth && Object.keys(latest.pull.data.depth).length) variants['PropFinder table, slots from the Nov 1 depth chart'] = run(W7, { lines, defense: pub, depth: latest.pull.data.depth });
  report.week7 = { pull: pre7.file, at: pre7.pull.at, variants: {} };
  for (const [name, v] of Object.entries(variants)) report.week7.variants[name] = { yards: yardScore(v.yards), td: tdScore(v.tds) };
  // The projection against the book's main line on the same rows: whose number lands nearer, and the over / under read.
  const v = variants['PropFinder table as published'];
  const vsLine = {};
  for (const m of YARD_MARKETS) {
    const xs = v.yards.filter((r) => r.m === m && r.line != null);
    if (!xs.length) continue;
    const lean = xs.filter((r) => Math.abs(r.proj - r.line) >= 0.1 * r.line);
    const hitLean = lean.filter((r) => (r.proj > r.line ? r.actual > r.line : r.actual < r.line)).length;
    vsLine[m] = { n: xs.length, maeProj: r1(mean(xs.map((r) => Math.abs(r.actual - r.proj)))), maeLine: r1(mean(xs.map((r) => Math.abs(r.actual - r.line)))), maeHalf: r1(mean(xs.map((r) => Math.abs(r.actual - (r.proj + r.line) / 2)))), projAboveLine: r3(mean(xs.map((r) => (r.proj > r.line ? 1 : 0)))), overHit: r3(mean(xs.map((r) => (r.actual > r.line ? 1 : 0)))), lean10: { n: lean.length, hit: lean.length ? r3(hitLean / lean.length) : null } };
  }
  report.week7.vsLine = vsLine;
  const priced = v.tds.filter((r) => r.odds != null);
  report.week7.tdVsBook = { n: priced.length, brierModel: brier(priced), brierBook: brier(priced.map((r) => ({ ...r, p: implied(r.odds) }))), saidModel: r3(mean(priced.map((r) => r.p))), saidBook: r3(mean(priced.map((r) => implied(r.odds)))), landed: r3(mean(priced.map((r) => r.td))) };
  say('week 7', JSON.stringify(report.week7.vsLine), JSON.stringify(report.week7.tdVsBook));
}

// 4. Tuned again on PropFinder's logs: the matchup's damping (the board rebuilt per value), the floor / ceiling, the touchdowns.
report.matchupK = {};
for (const k of [0, 4, 8, 16, 32]) {
  const ck = { ...COCKTAIL, matchupK: k };
  const t = run(TUNE, { cocktail: ck }); const c = run(CHECK, { cocktail: ck });
  report.matchupK[k] = { tune: r4(pooled(t.yards, baseMae)), check: r4(pooled(c.yards, baseCheck)), checkYards: yardScore(c.yards) };
  say('matchupK', k, report.matchupK[k].tune, report.matchupK[k].check);
}
const bestK = Object.entries(report.matchupK).sort((a, b) => a[1].tune - b[1].tune)[0];
const cocktail = bestK[1].tune <= 0.995 && Number(bestK[0]) !== COCKTAIL.matchupK ? { ...COCKTAIL, matchupK: Number(bestK[0]) } : COCKTAIL;
report.chosenCocktail = cocktail;

const tuned = run(TUNE, { cocktail });
const quant = (xs, q) => { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const RANGE = {};
for (const m of YARD_MARKETS) { const z = tuned.yards.filter((r) => r.m === m && r.sd > 0).map((r) => (r.actual - r.proj) / r.sd); RANGE[m] = z.length >= 50 ? [r3(-quant(z, 0.2)), r3(quant(z, 0.8))] : PARAMS.RANGE[m]; }
report.range = RANGE;

const tdGrid = [];
for (const LINE_WEIGHT of [0, 0.25, 0.5]) for (const TD_PER_POINT of [0.095, 0.105, 0.115]) for (const RATE_K of [4, 8, 16, 32]) for (const RATE_WEIGHTS of [{ season: 0.6, l5: 0.4 }, { season: 0.8, l5: 0.2 }, { season: 1 }]) tdGrid.push({ LINE_WEIGHT, TD_PER_POINT, RATE_K, RATE_WEIGHTS, POS_CLAMP: [1, 1] });
const tdRows = [];
for (const prm of tdGrid) { const t = run(TUNE, { cocktail, params: { RANGE, ...prm, TD_CAL: { a: 0, b: 1 } } }); tdRows.push({ ...prm, logloss: logloss(t.tds), brier: brier(t.tds) }); }
tdRows.sort((a, b) => a.logloss - b.logloss);
const { logloss: _l, brier: _b, ...TD1 } = tdRows[0];
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
const TD_CAL = fitCal(run(TUNE, { cocktail, params: { RANGE, ...TD1, TD_CAL: { a: 0, b: 1 } } }).tds);
report.td = { top: tdRows.slice(0, 6), chosen: TD1, cal: TD_CAL };
say('td', JSON.stringify(TD1), JSON.stringify(TD_CAL));

const CHOSEN = { RANGE, ...TD1, TD_CAL };
const fin = { tune: run(TUNE, { cocktail, params: CHOSEN }), check: run(CHECK, { cocktail, params: CHOSEN }) };
report.chosen = { cocktail, params: CHOSEN, tune: { yards: yardScore(fin.tune.yards), td: tdScore(fin.tune.tds) }, check: { yards: yardScore(fin.check.yards), td: tdScore(fin.check.tds) }, checkPooled: r4(pooled(fin.check.yards, baseCheck)) };
report.byWeek = {};
for (const [s, w] of weeks(CHECK)) { const tag = `${s}w${w}`; report.byWeek[tag] = { shipped: yardScore(base.check.yards.filter((r) => r.tag === tag)), chosen: yardScore(fin.check.yards.filter((r) => r.tag === tag)), tdShipped: brier(base.check.tds.filter((r) => r.tag === tag)), tdChosen: brier(fin.check.tds.filter((r) => r.tag === tag)) }; }
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'nfl-pf-backtest.json'), JSON.stringify(report, null, 1));
say('done');
console.log(JSON.stringify({ shipped: report.shipped.check, asLive: report.asLive.check, week7: report.week7, matchupK: Object.fromEntries(Object.entries(report.matchupK).map(([k, v]) => [k, [v.tune, v.check]])), chosen: { cocktail, range: RANGE, td: TD1, cal: TD_CAL, check: report.chosen.check, pooled: report.chosen.checkPooled } }, null, 1));

// The NBA board rebuilt from ESPN's public box scores and graded with the site's own scorecard,
// slate by slate from the season's second night to --date, and one slate laid out game by game.
// The board is the site's (lib/nba/picks.js buildBoard on a PropFinder-shaped pull: every player's
// logs this season and last, the opponent's per-position table rebuilt the way PropFinder publishes
// it, the injury report ESPN attaches to each game), graded by lib/picks/scorecard.js the way the
// store's gradeSlate does. What ESPN cannot give: the book's lines (a pseudo line stands in — his
// last-ten average floored plus a half, the rung the board itself falls back to — so the chance is
// graded at a median line without a price), PropFinder's depth chart (the position is ESPN's), and
// last season's defense tables (a team without a game this season reads no matchup).
//
//   node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --date 2026-10-27 \
//     --raw .nhl-data/audit/nba --out .nhl-data/audit/out
//
// --raw holds days/<YYYYMMDD>.json (ESPN scoreboards), games/<eventId>.json (summaries) and
// gamelogs/<espnId>.json (last season's game logs); --from the first slate graded (default: the
// season's second night, when a table exists).
import fs from 'node:fs';
import path from 'node:path';
import { parseSummary, parseScoreboard, derived } from '../../lib/nba/espn.js';
import { teamAbbrFromText } from '../../lib/nba/teams.js';
import { defenseAllowed } from '../../lib/nba/propfinder-nba.js';
import { nbaBoard, COCKTAIL, LADDER_MARKETS } from '../../lib/nba/picks.js';
import { gradeBoard, gradePredictors, summarize, asOf, etDate, PREDICTORS } from '../../lib/picks/scorecard.js';
import { normName } from '../../lib/nhl-data/names.js';
import { OWN_WEIGHTS, ENV_WEIGHT, upperTail } from '../../lib/picks/projection.js';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DATE = arg('--date'); const RAW = arg('--raw', '.nhl-data/audit/nba'); const OUT = arg('--out', '.nhl-data/audit/out'); const FROM = arg('--from', null);
// The pull's population: PropFinder's odds-only call lists the players the books price, about ten a team (77 for
// eight teams on 2026-10-27), plus the players out read one by one. --top is that count, by minutes over his last
// ten games before the slate; 0 keeps everyone who ever dressed (every bench player then weighs on the team scale).
const TOP = Number(arg('--top', '10'));
const PRIOR = arg('--prior', null);   // last season's box scores (prior/games), for the prior defense table
if (!DATE) { console.error('usage: --date YYYY-MM-DD [--raw dir] [--out dir] [--from YYYY-MM-DD]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const SEASON = Number(arg('--season', '2026'));
// The board's cocktail: the site's (`site`, lib/nba/picks.js COCKTAIL), the board as it was before it (`old`), or a JSON object.
const CK_ARG = arg('--cocktail', 'site');
const CK = CK_ARG === 'site' ? COCKTAIL : CK_ARG === 'old' ? {} : JSON.parse(CK_ARG);
const { buildBoard, ownWindows, statOf, actualFor } = nbaBoard(CK);
// The folders: this season's scoreboards and box scores, last season's game logs (defaults under --raw).
const DAYS = arg('--days', path.join(RAW, 'days')); const GAMES = arg('--games', path.join(RAW, 'games')); const LOGS = arg('--gamelogs', path.join(RAW, 'gamelogs'));
const TAG = arg('--tag', '');
const STATS = ['pts', 'reb', 'ast', 'tpm', 'pra'];
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
const r4 = (v) => (v == null ? null : Math.round(v * 10000) / 10000);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const f1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
const f2 = (v) => (v == null ? '—' : Number(v).toFixed(2));
const readJson = (f) => JSON.parse(fs.readFileSync(f));

// ---- the raw feeds ----
const schedule = [];   // every game of the season with its ET slate date
for (const f of fs.readdirSync(DAYS).sort()) for (const g of parseScoreboard(readJson(path.join(DAYS, f))).games) if (!g.preseason) schedule.push({ ...g, slate: etDate(g.date) });
const results = {}; const reports = {};   // parsed box scores and ESPN's injury block per game
for (const f of fs.readdirSync(GAMES)) {
  const j = readJson(path.join(GAMES, f));
  const r = parseSummary(j);
  if (!r.final) continue;
  results[r.id] = r;
  reports[r.id] = (j.injuries || []).flatMap((t) => (t.injuries || []).map((x) => ({ team: teamAbbrFromText(t.team?.abbreviation), id: x.athlete?.id ? String(x.athlete.id) : null, name: x.athlete?.displayName || '', key: normName(x.athlete?.displayName), pos: x.athlete?.position?.abbreviation || null, status: x.status || null, detail: [x.details?.type, x.details?.detail].filter(Boolean).join(' ') || null, date: x.date || null })));
}
const slates = [...new Set(schedule.filter((g) => results[g.id]).map((g) => g.slate))].sort().filter((d) => d <= DATE);
const from = FROM || slates[1] || slates[0];

// ---- every player's logs: this season from the box scores, last season from his game log ----
const players = new Map();   // espnId → { id, key, name, team, pos, games: [] }
const playerOf = (p, team) => { let x = players.get(p.espnId); if (!x) { x = { id: p.espnId, key: normName(p.name), name: p.name, team, pos: p.pos, games: [] }; players.set(p.espnId, x); } return x; };
for (const g of schedule) {
  const r = results[g.id]; if (!r) continue;
  for (const p of r.players) {
    if (!p.espnId) continue;
    const x = playerOf(p, p.team);
    if (g.slate >= (x.latest || '')) { x.team = p.team; x.pos = p.pos || x.pos; x.latest = g.slate; }
    if (!p.played) continue;
    x.games.push({ date: g.slate, gameId: g.id, season: SEASON, type: 'REG', home: p.team === r.home, opp: p.team === r.home ? r.away : r.home, min: p.min, pts: p.pts, reb: p.reb, ast: p.ast, tpm: p.tpm, tpa: p.tpa, fgm: p.fgm, fga: p.fga, ftm: p.ftm, fta: p.fta, stl: p.stl, blk: p.blk, tov: p.tov, oreb: p.oreb, dreb: p.dreb, pf: p.pf, pra: p.pra, pr: p.pr, pa: p.pa, ra: p.ra, stlBlk: p.stlBlk, dd: p.dd, td3: p.td3 });
  }
}
let withLast = 0;
const dash = (v, i) => { const x = Number(String(v ?? '').split('-')[i]); return Number.isFinite(x) ? x : 0; };
for (const x of players.values()) {
  const f = path.join(LOGS, `${x.id}.json`);
  if (!fs.existsSync(f)) continue;
  let gl; try { gl = readJson(f); } catch { continue; }
  const names = gl.names || []; const at = (stats, key) => stats[names.indexOf(key)];
  let any = false;
  for (const st of gl.seasonTypes || []) {
    const type = /post/i.test(st.displayName || '') ? 'PST' : 'REG';
    for (const c of st.categories || []) for (const e of c.events || []) {
      const ev = gl.events?.[e.eventId]; if (!ev || !e.stats) continue;
      const s = e.stats;
      const row = { date: etDate(ev.gameDate), gameId: String(e.eventId), season: SEASON - 1, type, home: ev.atVs !== '@', opp: teamAbbrFromText(ev.opponent?.abbreviation) || null, min: Number(at(s, 'minutes')) || 0, pts: Number(at(s, 'points')) || 0, reb: Number(at(s, 'totalRebounds')) || 0, ast: Number(at(s, 'assists')) || 0, tpm: dash(at(s, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted'), 0), tpa: dash(at(s, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted'), 1), fgm: dash(at(s, 'fieldGoalsMade-fieldGoalsAttempted'), 0), fga: dash(at(s, 'fieldGoalsMade-fieldGoalsAttempted'), 1), ftm: dash(at(s, 'freeThrowsMade-freeThrowsAttempted'), 0), fta: dash(at(s, 'freeThrowsMade-freeThrowsAttempted'), 1), stl: Number(at(s, 'steals')) || 0, blk: Number(at(s, 'blocks')) || 0, tov: Number(at(s, 'turnovers')) || 0, oreb: 0, dreb: 0, pf: Number(at(s, 'fouls')) || 0 };
      x.games.push(derived(row)); any = true;
    }
  }
  if (any) withLast++;
}
for (const x of players.values()) x.games.sort((a, b) => b.date.localeCompare(a.date));   // newest first, as the pull's logs

// ---- the opponent's table before a slate, in PropFinder's team-row shape, through the site's defenseAllowed ----
const POSW = { PG: { PG: 1 }, SG: { SG: 1 }, SF: { SF: 1 }, PF: { PF: 1 }, C: { C: 1 }, G: { PG: 0.5, SG: 0.5 }, F: { SF: 0.5, PF: 0.5 } };
const KEYS = { pts: 'points', reb: 'rebounds', ast: 'assists', tpm: 'threePointsMade', stl: 'steals', blk: 'blocks', tov: 'turnovers', ftm: 'freeThrowsMade' };
let priorRows = null;   // ABBR → the team's rows for last season (built once)
function priorTable() {
  if (priorRows || !PRIOR || !fs.existsSync(PRIOR)) return priorRows;
  const perTeam = {};
  for (const f of fs.readdirSync(PRIOR)) {
    let r; try { r = parseSummary(readJson(path.join(PRIOR, f))); } catch { continue; }
    if (!r.final) continue;
    for (const team of [r.away, r.home]) {
      const opp = team === r.away ? r.home : r.away;
      const against = { All: {} }; const own = {};
      for (const p of r.players) {
        if (!p.played) continue;
        for (const k of Object.keys(KEYS)) {
          if (p.team === team) own[k] = (own[k] || 0) + (p[k] || 0);
          if (p.team !== opp) continue;
          against.All[k] = (against.All[k] || 0) + (p[k] || 0);
          for (const [pos, w] of Object.entries(POSW[p.pos] || {})) { against[pos] ||= {}; against[pos][k] = (against[pos][k] || 0) + w * (p[k] || 0); }
        }
      }
      (perTeam[team] ||= []).push({ against, for: own });
    }
  }
  priorRows = {};
  for (const [abbr, games] of Object.entries(perTeam)) {
    const rows = [];
    const row = (pick, type, position) => { const r = { type, position, seasonYear: SEASON - 1, seasonType: 'REG', gamesPlayed: games.length, lastNGames: 0, lastUpdated: '2026-04-13' }; for (const [k, name] of Object.entries(KEYS)) r[name] = r2(mean(games.map((x) => pick(x)?.[k] || 0))); return r; };
    for (const pos of ['PG', 'SG', 'SF', 'PF', 'C', 'All']) rows.push(row((x) => x.against[pos], 'Opponent', pos));
    rows.push(row((x) => x.for, 'Team', 'All'));
    priorRows[abbr] = rows;
  }
  return priorRows;
}
function defenseBefore(slate) {
  const prior = priorTable();
  const perTeam = {};   // ABBR → [{ against: { PG: {pts…}, … , All }, for: {…} }] one entry a game, oldest first
  for (const g of schedule.filter((x) => x.slate < slate && results[x.id]).sort((a, b) => a.slate.localeCompare(b.slate))) {
    const r = results[g.id];
    for (const team of [r.away, r.home]) {
      const opp = team === r.away ? r.home : r.away;
      const against = { All: {} }; const own = {};
      for (const p of r.players) {
        if (!p.played) continue;
        const target = p.team === opp ? against : null;
        for (const [k] of Object.entries(KEYS)) {
          if (p.team === team) own[k] = (own[k] || 0) + (p[k] || 0);
          if (!target) continue;
          target.All[k] = (target.All[k] || 0) + (p[k] || 0);
          for (const [pos, w] of Object.entries(POSW[p.pos] || {})) { target[pos] ||= {}; target[pos][k] = (target[pos][k] || 0) + w * (p[k] || 0); }
        }
      }
      (perTeam[team] ||= []).push({ against, for: own });
    }
  }
  const teams = [];
  for (const abbr of new Set([...Object.keys(perTeam), ...Object.keys(prior || {})])) {
    const games = perTeam[abbr] || [];
    const stats = [...(prior?.[abbr] || [])];
    if (!games.length) { teams.push({ code: abbr, stats }); continue; }
    const row = (list, pick, type, position, lastN = null) => {
      const r = { type, position, seasonYear: SEASON, seasonType: 'REG', gamesPlayed: list.length, lastNGames: lastN || 0, lastUpdated: slate };
      for (const [k, name] of Object.entries(KEYS)) r[name] = r2(mean(list.map((x) => pick(x)?.[k] || 0)));
      return r;
    };
    for (const pos of ['PG', 'SG', 'SF', 'PF', 'C', 'All']) stats.push(row(games, (x) => x.against[pos], 'Opponent', pos));
    stats.push(row(games, (x) => x.for, 'Team', 'All'));
    for (const n of [5, 10]) if (games.length >= n) { const last = games.slice(-n); for (const pos of ['PG', 'SG', 'SF', 'PF', 'C', 'All']) stats.push(row(last, (x) => x.against[pos], 'Opponent', pos, n)); stats.push(row(last, (x) => x.for, 'Team', 'All', n)); }
    teams.push({ code: abbr, stats });
  }
  return defenseAllowed(teams, { season: SEASON });
}

// ---- the pull for a slate: the teams' players with their logs, pseudo lines, the table, the report ----
function pullFor(slate) {
  const games = schedule.filter((g) => g.slate === slate);
  const teams = new Set(games.flatMap((g) => [g.away, g.home]));
  const rows = games.flatMap((g) => reports[g.id] || []).filter((r) => teams.has(r.team));
  const list = [];
  for (const x of players.values()) {
    if (!teams.has(x.team)) continue;
    const before = x.games.filter((g) => g.date < slate);
    const props = [];
    if (before.length) for (const market of LADDER_MARKETS) {
      const vals = before.slice(0, 10).map((g) => statOf(g, market)).filter((v) => v != null);
      if (!vals.length || !vals.some((v) => v > 0)) continue;
      props.push({ market, line: Math.floor(mean(vals)) + 0.5, odds: null, underOdds: null, book: null, books: 0, isMain: true, lines: [] });
    }
    const rep = rows.find((r) => (r.id && r.id === x.id) || (r.team === x.team && r.key === x.key)) || null;
    list.push({ id: x.id, key: x.key, name: x.name, team: x.team, pos: { G: 'SG', F: 'SF' }[x.pos] || x.pos, espnPos: x.pos, status: 'ACT', injury: rep?.status || null, injuryDetail: rep?.detail || null, injuryFrom: rep ? 'report' : null, games: x.games, props });
  }
  let kept = list;
  if (TOP > 0) {
    kept = [];
    for (const team of teams) {
      const mine = list.filter((p) => p.team === team);
      const minutes = (p) => { const before = p.games.filter((g) => g.date < slate).slice(0, 10); return before.length ? mean(before.map((g) => g.min)) : -1; };
      const out = mine.filter((p) => p.injury && /^(out|doubtful)/i.test(p.injury) && p.games.some((g) => g.date < slate));
      const priced = mine.filter((p) => !out.includes(p) && p.games.some((g) => g.date < slate)).sort((a, b) => minutes(b) - minutes(a)).slice(0, TOP);
      kept.push(...priced, ...out);
    }
  }
  return { at: `${slate}T12:00:00Z`, season: SEASON, source: 'espn-audit', data: { players: kept, defense: defenseBefore(slate), depth: null, injuries: { source: 'espn-summary', rows, count: rows.length } } };
}

const actualOf = (g, p, market) => { const line = actualFor(results[g.id], p); return line === undefined ? undefined : line && line.played !== false ? statOf(line, market) : null; };

// ---- every slate graded the way the store grades it ----
const graded = []; const boards = {}; const extra = []; const rungs = [];   // extra: per player-market rows with the projection's parts
for (const slate of slates.filter((d) => d >= from)) {
  const games = schedule.filter((g) => g.slate === slate).map(({ slate: _s, ...g }) => g);
  const pf = pullFor(slate);
  const cut = asOf(pf, games);
  const board = buildBoard({ season: SEASON, date: slate, games, sheets: [], pf: cut, results });
  boards[slate] = board;
  const g = gradeBoard(board, { key: slate, label: slate, actualOf });
  g.pred = gradePredictors(board, cut, { key: slate, season: SEASON, actualOf, ownWindows });
  graded.push(g);
  for (const bg of board.games) for (const side of Object.values(bg.sides || {})) for (const p of side.players || []) for (const [market, r] of Object.entries(p.ranges || {})) {
    const actual = actualOf(bg, p, market); if (actual == null) continue;
    const line = results[bg.id]?.players.find((x) => normName(x.name) === p.key && x.team === side.team) || null;
    const stat = market === 'pra' ? 'pra' : market;
    const pr = side.allowed?.prior?.rows?.[p.envPos]?.[stat]; const prL = side.allowed?.prior?.league?.[p.envPos]?.[stat];
    const matchupPrior = pr?.value != null && prL > 0 ? r3(1 + ENV_WEIGHT * (pr.value / prL - 1)) : null;
    const gp = side.allowed?.rows?.[p.envPos]?.gp ?? null;
    for (const rung of p.ladders?.[market] || []) rungs.push({ slate, market, line: rung.line, model: rung.model, emp: rung.emp, p: rung.p, proj: rung.proj, sd: rung.sd, n: rung.rates?.n ?? 0, main: !!rung.main, hit: actual > rung.line ? 1 : 0 });
    extra.push({ slate, game: bg.id, team: side.team, opp: side.opp, key: p.key, player: p.player, pos: p.pos, envPos: p.envPos, market, matchupPrior, gp, exp: r.exp, rate: r.rate, matchup: r.matchup, teamScale: r.team, env: r.env, floor: r.floor, ceiling: r.ceiling, sd: p.ladders?.[market]?.[0]?.sd ?? null, lift: r.lift || 0, liftFrom: r.liftFrom || null, minFactor: r.minutes || null, minutes: p.minutes || null, out: !!p.out, actual, actualMin: line?.min ?? null, withoutN: p.without?.n || 0, withoutW: p.without?.weight || 0 });
  }
}
const sum = summarize(graded, {});
const md = []; const line = (s = '') => md.push(s);
const table = (head, rows) => { line(`| ${head.join(' | ')} |`); line(`| ${head.map(() => '---').join(' | ')} |`); for (const r of rows) line(`| ${r.join(' | ')} |`); line(); };
const sc = (s) => (s?.n ? [s.n, pct(s.said), pct(s.hit), pct(s.diff), s.brier] : [0, '—', '—', '—', '—']);

line(`# NBA board rebuilt from the box scores: ${from} → ${DATE}`);
line();
line(`${Object.keys(results).length} box scores this season, ${players.size} players with logs (${withLast} with last season's game log), ${graded.length} slates graded from ${from}: ${sum.plays} chance reads at the pseudo line (his last-ten average floored + ½, no price), ${graded.reduce((s, g) => s + g.rungs.length, 0)} ladder rungs, ${graded.reduce((s, g) => s + (g.pred || []).length, 0)} projections against a figure.`);
line();
line('## The chance read, season to date (at the pseudo line; the price is not in it)');
line();
table(['Rows', 'n', 'said', 'hit', 'hit − said', 'Brier'], [['Every play', ...sc(sum.all)], ['On the board (the tables)', ...sc(sum.board)]]);
line('### By chance bucket');
line();
table(['Bucket', 'n', 'said', 'hit', 'hit − said', 'Brier', 'on the board n', 'said', 'hit'], sum.buckets.map((b) => [b.label, ...sc(b.all), b.board.n, pct(b.board.said), pct(b.board.hit)]));
line('### By market');
line();
table(['Market', 'n', 'said', 'hit', 'hit − said', 'Brier'], sum.markets.map((m) => [m.label, ...sc(m.all)]));
line('### By the opponent’s third at his position, and by form');
line();
table(['Cut', 'n', 'said', 'hit', 'hit − said', 'Brier'], [...sum.thirds, ...sum.forms].map((t) => [t.label, ...sc(t.all)]));

line('## The ladders: the model half (his distribution) against the hit-rate half and the blend');
line();
table(['Market', 'rungs', 'model said', 'model hit', 'model Brier', 'hit-rate said', 'hit-rate Brier', 'blend said', 'blend Brier', 'main rung said / hit / Brier', 'ceiling rungs (20–35%) said / hit'], sum.ladders.map((l) => [l.label, l.common, pct(l.model.said), pct(l.model.hit), l.model.brier, pct(l.emp.said), l.emp.brier, pct(l.blend.said), l.blend.brier, `${pct(l.main.said)} / ${pct(l.main.hit)} / ${l.main.brier}`, `${pct(l.ceiling.said)} / ${pct(l.ceiling.hit)} (${l.ceiling.n})`]));
line('### Rung calibration by bucket (the blend the board shows)');
line();
for (const l of sum.ladders) { line(`**${l.label}**`); line(); table(['Bucket', 'n', 'said', 'hit', 'hit − said'], l.buckets.filter((b) => b.n).map((b) => [b.label, b.n, pct(b.said), pct(b.hit), pct(b.diff)])); }

line('## The predictors: his windows, the board’s blend, the projection, each against his figure');
line();
for (const p of sum.predictors) {
  line(`### ${p.label}`);
  line();
  table(['Read', 'n', 'avg said', 'avg actual', 'bias', 'MAE', 'RMSE', 'over the pseudo line: said', 'hit', 'Brier'], (p.predictors || p.each || []).filter((x) => x.n).map((x) => [x.label, x.n, f1(x.avg), f1(x.actual), f2(x.bias), f2(x.mae), f2(x.rmse), pct(x.said), pct(x.hit), x.brier ?? '—']));
}

// ---- the experiments on the projection's parts ----
line('## Experiments on the projection (season to date, every player-market with a figure)');
line();
const pred = graded.flatMap((g) => g.pred || []);
const mae = (rows, f) => { const e = rows.map((r) => f(r)).filter((v) => v != null).map((v, i) => v); return e.length ? r2(mean(e.map(Math.abs))) : null; };
const bias = (rows, f) => { const e = rows.map((r) => f(r)).filter((v) => v != null); return e.length ? r2(mean(e)) : null; };
line('### The blend of his season with his last ten (OWN_WEIGHTS: last ten 0.35, season 0.65)');
line();
const both = pred.filter((r) => r.own10 != null && r.ownSeason != null);
table(['Last-ten weight', 'n', 'MAE', 'bias'], [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1].map((w) => [w, both.length, mae(both, (r) => w * r.own10 + (1 - w) * r.ownSeason - r.actual), bias(both, (r) => w * r.own10 + (1 - w) * r.ownSeason - r.actual)]));
const w20 = pred.filter((r) => r.own20 != null && r.ownSeason != null && r.own10 != null);
table(['Window as the rate', 'n', 'MAE', 'bias'], [['Last 3', 'own3'], ['Last 5', 'own5'], ['Last 10', 'own10'], ['Last 20', 'own20'], ['Season to date', 'ownSeason'], ['The board’s blend', 'blend'], ['Projection (blend × matchup × team)', 'proj']].map(([label, k]) => [label, w20.filter((r) => r[k] != null).length, mae(w20, (r) => (r[k] == null ? null : r[k] - r.actual)), bias(w20, (r) => (r[k] == null ? null : r[k] - r.actual))]));
line('### The matchup’s weight (ENV_WEIGHT = 0.6 on the opponent’s deviation from the league at his spot)');
line();
const withEnv = extra.filter((r) => r.matchup != null && r.rate != null);
const atWeight = (r, e) => r.rate * (1 + (e / ENV_WEIGHT) * (r.matchup - 1)) * (r.teamScale ?? 1);
table(['Weight', 'n', 'MAE', 'bias'], [0, 0.3, 0.6, 1.0, 1.5].map((e) => [e, withEnv.length, mae(withEnv, (r) => atWeight(r, e) - r.actual), bias(withEnv, (r) => atWeight(r, e) - r.actual)]));
line('### This season’s table shrunk toward the league at games / (games + K) (the rows with a matchup and the team’s games)');
line();
{
  const rows = extra.filter((r) => r.matchup != null && r.rate != null && r.gp != null);
  const at = (r, K) => { const w = K === 0 ? 1 : r.gp / (r.gp + K); return r.rate * (1 + w * (r.matchup - 1)) * (r.teamScale ?? 1); };
  table(['K', 'n', 'MAE', 'bias'], [0, 3, 5, 10, 20, 40].map((K) => [K === 0 ? '0 (the board)' : K, rows.length, mae(rows, (r) => at(r, K) - r.actual), bias(rows, (r) => at(r, K) - r.actual)]));
}
line('### His spread widened: the model half at sd × k (every rung)');
line();
{
  const rows = rungs.filter((r) => r.sd > 0 && r.proj != null);
  const brier = (f) => r4(mean(rows.map((r) => (f(r) - r.hit) ** 2)));
  const band = (f, lo, hi) => { const list = rows.filter((r) => f(r) >= lo && f(r) < hi); return list.length ? `${list.length} · ${pct(mean(list.map(f)))} → ${pct(mean(list.map((r) => r.hit)))}` : '—'; };
  table(['k', 'rungs', 'model Brier', 'blend Brier', 'blend 60–70%: n · said → hit', '70–80%', '80%+', 'blend under 20%'], [1, 1.2, 1.4, 1.6].map((k) => { const m = (r) => upperTail((r.line - r.proj) / (r.sd * k)); const b = (r) => (r.emp == null ? m(r) : 0.5 * m(r) + 0.5 * r.emp); return [k, rows.length, brier(m), brier(b), band(b, 0.6, 0.7), band(b, 0.7, 0.8), band(b, 0.8, 1.01), band(b, 0, 0.2)]; }));
}
line('### A straight recalibration of the blend (logit slope and intercept fitted on the slates before the last two, scored on the last two)');
line();
{
  const logit = (p) => Math.log(Math.max(p, 1e-4) / Math.max(1 - p, 1e-4)); const sig = (x) => 1 / (1 + Math.exp(-x));
  const cutAt = slates[slates.length - 2];
  const fit = rungs.filter((r) => r.slate < cutAt); const test = rungs.filter((r) => r.slate >= cutAt);
  let a = 0; let b = 1;
  for (let it = 0; it < 400; it++) { let ga = 0; let gb = 0; for (const r of fit) { const x = logit(r.p); const q = sig(a + b * x); ga += q - r.hit; gb += (q - r.hit) * x; } a -= 0.5 * ga / fit.length; b -= 0.5 * gb / fit.length; }
  const brier = (rows, f) => r4(mean(rows.map((r) => (f(r) - r.hit) ** 2)));
  const band = (rows, f, lo, hi) => { const list = rows.filter((r) => f(r) >= lo && f(r) < hi); return list.length ? `${list.length} · ${pct(mean(list.map(f)))} → ${pct(mean(list.map((r) => r.hit)))}` : '—'; };
  line(`Fitted on ${fit.length} rungs: slope ${f2(b)}, intercept ${f2(a)} (a slope under 1 pulls every chance toward 50%).`);
  line();
  table(['Chance on the last two slates', 'rungs', 'Brier', '60–70%: n · said → hit', '70–80%', '80%+'], [['As shipped', (r) => r.p], ['Recalibrated', (r) => sig(a + b * logit(r.p))]].map(([label, f]) => [label, test.length, brier(test, f), band(test, f, 0.6, 0.7), band(test, f, 0.7, 0.8), band(test, f, 0.8, 1.01)]));
}
if (extra.some((r) => r.matchupPrior != null)) {
  line('### The matchup from last season’s full table in place of this season’s (the rows with both)');
  line();
  const both = extra.filter((r) => r.matchupPrior != null && r.matchup != null && r.rate != null);
  table(['Read', 'n', 'MAE', 'bias'], [['His rate alone (× team)', (r) => r.rate * (r.teamScale ?? 1)], ['× this season’s table (the board)', (r) => r.rate * r.matchup * (r.teamScale ?? 1)], ['× last season’s table', (r) => r.rate * r.matchupPrior * (r.teamScale ?? 1)], ['× the two tables’ mean', (r) => r.rate * ((r.matchup + r.matchupPrior) / 2) * (r.teamScale ?? 1)]].map(([label, f]) => [label, both.length, mae(both, (r) => f(r) - r.actual), bias(both, (r) => f(r) - r.actual)]));
}
line('### The ladder’s chance recalibrated: the hit-rate half shrunk, or weighed less (every rung with a figure)');
line();
{
  const K = 6;
  const variants = [
    ['As shipped: ½ model + ½ hit rate', (r) => r.p],
    ['Model half alone', (r) => r.model],
    ['Hit rate alone', (r) => r.emp ?? r.model],
    ['Hit rate shrunk to ½ at n / (n + 6), then ½ + ½', (r) => (r.emp == null ? r.model : 0.5 * r.model + 0.5 * ((r.n * r.emp + K * 0.5) / (r.n + K)))],
    ['Hit rate shrunk to the model at n / (n + 6), then ½ + ½', (r) => (r.emp == null ? r.model : 0.5 * r.model + 0.5 * ((r.n * r.emp + K * r.model) / (r.n + K)))],
    ['0.6 model + 0.4 hit rate', (r) => (r.emp == null ? r.model : 0.6 * r.model + 0.4 * r.emp)],
    ['0.7 model + 0.3 hit rate', (r) => (r.emp == null ? r.model : 0.7 * r.model + 0.3 * r.emp)],
  ];
  const brier = (rows, f) => r4(mean(rows.map((r) => (f(r) - r.hit) ** 2)));
  const band = (rows, f, lo, hi) => { const list = rows.filter((r) => f(r) >= lo && f(r) < hi); return list.length ? `${list.length} · ${pct(mean(list.map(f)))} → ${pct(mean(list.map((r) => r.hit)))}` : '—'; };
  table(['Chance', 'rungs', 'Brier', 'main rung Brier', '50–60%: n · said → hit', '60–70%', '70–80%', '80%+'], variants.map(([label, f]) => [label, rungs.length, brier(rungs, f), brier(rungs.filter((r) => r.main), f), band(rungs, f, 0.5, 0.6), band(rungs, f, 0.6, 0.7), band(rungs, f, 0.7, 0.8), band(rungs, f, 0.8, 1.01)]));
}
line('### By slate: the chance read and the projection');
line();
table(['Slate', 'plays', 'said', 'hit', 'on the board', 'said', 'hit', 'projections', 'bias (pts)', 'MAE (pts)'], sum.bySlate.map((b) => { const rows = pred.filter((r) => r.slate === b.key && r.market === 'pts'); return [b.key, b.plays, pct(b.all.said), pct(b.all.hit), b.board.n, pct(b.board.said), pct(b.board.hit), rows.length, bias(rows, (r) => r.proj - r.actual), mae(rows, (r) => r.proj - r.actual)]; }));
line('### His spread: where his figure landed against the floor–ceiling (the quartiles: half the nights between them by construction)');
line();
const withSd = extra.filter((r) => r.sd > 0);
const z = (r) => (r.actual - r.exp) / r.sd;
table(['Market', 'n', 'within floor–ceiling', 'under the floor', 'over the ceiling', 'beyond ±1 sd', 'beyond ±2 sd', 'mean z', 'sd of z'], STATS.map((m) => { const rows = withSd.filter((r) => r.market === m); const zs = rows.map(z); const sdz = zs.length > 1 ? Math.sqrt(mean(zs.map((v) => (v - mean(zs)) ** 2))) : null; return [m, rows.length, pct(mean(zs.map((v) => (Math.abs(v) <= 0.6745 ? 1 : 0)))), pct(mean(zs.map((v) => (v < -0.6745 ? 1 : 0)))), pct(mean(zs.map((v) => (v > 0.6745 ? 1 : 0)))), pct(mean(zs.map((v) => (Math.abs(v) > 1 ? 1 : 0)))), pct(mean(zs.map((v) => (Math.abs(v) > 2 ? 1 : 0)))), f2(mean(zs)), f2(sdz)]; }));
line('### The reads that moved a figure: the vacated lifts, the minutes factor, the without split, the team scale');
line();
const lifted = extra.filter((r) => r.lift > 0); const minned = extra.filter((r) => r.minFactor && r.minFactor !== 1); const wo = extra.filter((r) => r.withoutN > 0); const scaled = extra.filter((r) => r.teamScale != null && r.teamScale < 1);
table(['Rows', 'n', 'bias with the read', 'bias without it', 'MAE with', 'MAE without'], [
  ['With a vacated lift', lifted, (r) => r.exp - r.actual, (r) => r.exp - r.lift * (r.env ?? 1) - r.actual],
  ['With a minutes factor', minned, (r) => r.exp - r.actual, (r) => r.exp / r.minFactor - r.actual],
  ['With a team scale under 1', scaled, (r) => r.exp - r.actual, (r) => r.exp / r.teamScale - r.actual],
].map(([label, rows, a, b]) => [label, rows.length, bias(rows, a), bias(rows, b), mae(rows, a), mae(rows, b)]));
if (wo.length) { const s = wo.filter((r) => r.market === 'pts'); line(`${wo.length} player-markets carried a without-teammate split (${s.length} on points: bias ${bias(s, (r) => r.exp - r.actual)}, MAE ${mae(s, (r) => r.exp - r.actual)}).`); line(); }
line('### The minutes factor by its size (points rows): the minutes it read against the minutes he played');
line();
{
  const rows = extra.filter((r) => r.market === 'pts' && r.minutes && r.actualMin != null);
  const cuts = [['under 0.9', 0, 0.9], ['0.9–1.1', 0.9, 1.1], ['1.1–1.2', 1.1, 1.2], ['1.2–1.3', 1.2, 1.3], ['1.3 (the cap)', 1.3, 9]];
  table(['Factor', 'n', 'minutes read', 'minutes behind the rate', 'minutes played', 'did not play', 'bias (pts)', 'MAE', 'bias without the factor'], cuts.map(([label, lo, hi]) => { const list = rows.filter((r) => r.minutes.factor >= lo && r.minutes.factor < hi); return [label, list.length, f1(mean(list.map((r) => r.minutes.tonight))), f1(mean(list.map((r) => r.minutes.base))), f1(mean(list.map((r) => r.actualMin))), list.filter((r) => r.actualMin === 0).length, bias(list, (r) => r.exp - r.actual), mae(list, (r) => r.exp - r.actual), bias(list, (r) => r.exp / (r.minFactor || 1) - r.actual)]; }));
}
line('### By position (the projection against the figure, points; a G reads at SG, an F at SF)');
line();
table(['Position', 'n', 'bias', 'MAE'], ['PG', 'SG', 'SF', 'PF', 'C'].map((pos) => { const rows = extra.filter((r) => r.market === 'pts' && r.envPos === pos); return [pos, rows.length, bias(rows, (r) => r.exp - r.actual), mae(rows, (r) => r.exp - r.actual)]; }).filter((r) => r[1]));
line('### By minutes actually played (points): the projection cannot know a short night');
line();
table(['Minutes', 'n', 'avg projected', 'avg actual', 'bias', 'MAE'], [['under 15', 0, 15], ['15–24', 15, 25], ['25–31', 25, 32], ['32+', 32, 99]].map(([label, lo, hi]) => { const rows = extra.filter((r) => r.market === 'pts' && r.actualMin != null && r.actualMin >= lo && r.actualMin < hi); return [label, rows.length, f1(mean(rows.map((r) => r.exp))), f1(mean(rows.map((r) => r.actual))), bias(rows, (r) => r.exp - r.actual), mae(rows, (r) => r.exp - r.actual)]; }));

// ---- the slate ----
line(`# The slate of ${DATE}`);
line();
const board = boards[DATE];
if (!board) line(`No graded board for ${DATE}.`);
else {
  for (const g of board.games) {
    const r = results[g.id];
    line(`## ${g.away} ${r?.awayScore ?? ''} @ ${g.home} ${r?.homeScore ?? ''}${g.tally ? ` · plays over the floor ${g.tally.hit} / ${g.tally.of}` : ''}`);
    line();
    for (const side of [g.sides[g.away], g.sides[g.home]].filter(Boolean)) {
      const out = side.out?.length ? side.out.map((o) => `${o.name} (${o.status}${o.detail ? `, ${o.detail}` : ''})`).join('; ') : 'nobody';
      const totals = {}; for (const p of r.players.filter((x) => x.team === side.team && x.played)) for (const k of ['pts', 'reb', 'ast', 'tpm']) totals[k] = (totals[k] || 0) + p[k];
      line(`### ${side.team} (${side.venue === 'H' ? 'home' : 'away'}) · out: ${out}`);
      line();
      line(`Team tonight: expected ${Object.entries(side.teamProj || {}).filter(([k]) => ['pts', 'reb', 'ast', 'tpm'].includes(k)).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}; got pts ${totals.pts}, reb ${totals.reb}, ast ${totals.ast}, tpm ${totals.tpm}${Object.keys(side.scale || {}).length ? `; the side scaled down on ${Object.entries(side.scale).map(([k, v]) => `${k} × ${v}`).join(', ')}` : ''}.`);
      line();
      if (side.picks?.length) { line(`Best plays (the strip): ${side.picks.map((p) => `${p.player} ${p.side} ${p.line} ${p.label} at ${pct(p.p)} → ${p.actual ?? 'DNP'} ${p.hit == null ? '' : p.hit ? '✓' : '✗'}`).join('; ')}.`); line(); }
      const rows = side.players.filter((p) => p.ranges && Object.keys(p.ranges).length).map((p) => { const line = r.players.find((x) => normName(x.name) === p.key && x.team === side.team) || null; return { p, line }; }).sort((a, b) => (b.line?.min ?? -1) - (a.line?.min ?? -1));
      table(['Player', 'min (tonight)', ...STATS.flatMap((m) => [`${m} exp (floor–ceil)`, 'got']), 'moved by'], rows.map(({ p, line: l }) => {
        const cells = STATS.flatMap((m) => { const x = p.ranges[m]; const got = l && l.played !== false ? statOf(l, m) : null; const mark = got == null ? 'DNP' : x ? (got < x.floor ? `**${got}** ↓` : got > x.ceiling ? `**${got}** ↑` : `${got}`) : `${got}`; return [x ? `${x.exp} (${x.floor}–${x.ceiling})` : '—', mark]; });
        const moved = [];
        if (p.minutes && p.minutes.factor !== 1) moved.push(`min ${p.minutes.tonight} vs ${p.minutes.base} behind the rate × ${p.minutes.factor}`);
        for (const m of STATS) { const x = p.ranges[m]; if (x?.lift) moved.push(`${m} +${x.lift} (${(x.liftFrom || []).join(', ')} out)`); }
        if (p.without) moved.push(`w/o ${p.without.names.join(' + ')} ${p.without.n} g × ${p.without.weight}`);
        const mu = p.ranges.pts?.matchup; if (mu != null && mu !== 1) moved.push(`matchup × ${mu} at ${p.envPos}`);
        return [`${p.player} (${p.pos}${p.out ? ', out' : ''})`, `${p.minutes?.tonight ?? '—'} (${l?.min ?? 'DNP'})`, ...cells, moved.join('; ') || '—'];
      }));
    }
  }
  line('### The slate’s biggest surprises (his figure against his range, in his own spread)');
  line();
  const day = extra.filter((r) => r.slate === DATE && r.sd > 0).sort((a, b) => Math.abs(z(b)) - Math.abs(z(a)));
  table(['Player', 'market', 'projected (floor–ceiling)', 'got', 'z', 'minutes', 'rate', 'matchup', 'team', 'lift'], day.slice(0, 20).map((r) => [`${r.player} (${r.team} ${r.pos} vs ${r.opp})`, r.market, `${r.exp} (${r.floor}–${r.ceiling})`, r.actual, f2(z(r)), r.actualMin, r.rate, r.matchup ?? '—', r.teamScale ?? '—', r.lift || '—']));
  const dayPred = pred.filter((r) => r.slate === DATE);
  line(`On the slate: ${dayPred.length} projections, bias ${bias(dayPred, (r) => r.proj - r.actual)}, MAE ${mae(dayPred, (r) => r.proj - r.actual)}; the season window alone bias ${bias(dayPred, (r) => (r.ownSeason == null ? null : r.ownSeason - r.actual))}, MAE ${mae(dayPred, (r) => (r.ownSeason == null ? null : r.ownSeason - r.actual))}; last ten alone MAE ${mae(dayPred, (r) => (r.own10 == null ? null : r.own10 - r.actual))}.`);
  line();
  const dayPlays = graded.find((g) => g.key === DATE);
  if (dayPlays) { const s = sum.bySlate.find((x) => x.key === DATE); line(`The chance read on the slate: ${s.plays} plays, said ${pct(s.all.said)}, hit ${pct(s.all.hit)} (Brier ${s.all.brier}); on the board ${s.board.n}, said ${pct(s.board.said)}, hit ${pct(s.board.hit)}.`); line(); }
}

fs.writeFileSync(path.join(OUT, `nba-${DATE}${TAG}.md`), md.join('\n'));
fs.writeFileSync(path.join(OUT, `nba-${DATE}${TAG}-summary.json`), JSON.stringify(sum, null, 1));
const cols = Object.keys(extra[0] || {}).filter((k) => k !== 'minutes');
fs.writeFileSync(path.join(OUT, `nba-${DATE}${TAG}-rows.csv`), [cols.join(','), ...extra.map((r) => cols.map((c) => JSON.stringify(Array.isArray(r[c]) ? r[c].join('+') : r[c] ?? '')).join(','))].join('\n'));
console.log(md.join('\n'));
console.error(`written ${OUT}/nba-${DATE}.md, -summary.json and -rows.csv`);

// The NHL board's plain-rate read (lib/nhl-data/picks-pure.js: the goals read the board carries
// since 2026-10-27, and the shots read that stands in for the model's λ) replayed leak-free over
// the season from the public box scores, and one slate laid out the way the Best bets list shows
// it, graded against what happened. Every number comes from the site's own functions
// (blendRates, project, positionAllowed, pickGame, formOf) on rows built the way the store builds
// them; the variants beside the shipped read (the study's blends into last season, the goal-rate
// shrink at other strengths, last season's table, no table) are the questions the audit asks.
//
//   node --import ./tools/audit/register.mjs tools/audit/nhl-audit.mjs --date 2026-10-27 \
//     --cur .nhl-data/predictors/2026/games-pos --prev .nhl-data/predictors/2025/games-pos --out .nhl-data/audit/out
//
// The games dirs are tools/predictors/fetch.mjs output relabelled by relabel.py (the centres are
// the faceoff takers, as the lineup slots the store carries read). Lineup = who dressed, so a
// scratch the board listed is not here and a call-up it did not list is.
import fs from 'node:fs';
import path from 'node:path';
import { blendRates, project, positionAllowed, isBackToBack, pickGame, poissonAtLeast, fairOdds, formOf, SHOTS_FIT, GOALS_FIT, LEAGUE_POS, GOAL_RATE_SHRINK, SHOTS_FLOOR, GOALS_FLOOR } from '../../lib/nhl-data/picks-pure.js';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DATE = arg('--date');
const CUR = arg('--cur'); const PREV = arg('--prev'); const OUT = arg('--out', '.nhl-data/audit/out');
if (!DATE || !CUR || !PREV) { console.error('usage: --date YYYY-MM-DD --cur <games-pos> --prev <games-pos> [--out dir]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const POS = ['C', 'LW', 'RW', 'D'];
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
const r4 = (v) => (v == null ? null : Math.round(v * 10000) / 10000);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const meanOf = (rows, k) => (rows.length ? rows.reduce((s, r) => s + (Number(r[k]) || 0), 0) / rows.length : 0);
const lg = (v) => Math.log(Math.max(v, 0.05));
const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const f2 = (v) => (v == null ? '—' : Number(v).toFixed(2));
const f1 = (v) => (v == null ? '—' : Number(v).toFixed(1));

/** The games of a dir as stored rows (the store's shape: date, gameId, playerId, team, opp, venue, pos, toi, g, sog, icf, iscf …). */
function loadRows(dir) {
  const rows = []; const games = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const day = JSON.parse(fs.readFileSync(path.join(dir, f)));
    for (const g of day.games) {
      games.push({ id: g.id, date: g.date, away: g.away.abbrev, home: g.home.abbrev, awayScore: g.away.score, homeScore: g.home.score, startTimeUTC: g.startTimeUTC, firstGoal: g.firstGoal || null });
      for (const s of g.skaters) {
        if (!POS.includes(s.pos) || s.id == null) continue;
        rows.push({ date: g.date, gameId: g.id, playerId: s.id, name: s.name, team: s.team, opp: s.opp, venue: s.venue, pos: s.pos, toi: s.toi, g: s.g, a: s.a, sog: s.sog, icf: s.icf, iff: s.iff, isf: s.isf, iscf: s.iscf, ihdcf: s.ihdcf, fg: s.fg || 0 });
      }
    }
  }
  return { rows, games };
}

const cur = loadRows(CUR); const prev = loadRows(PREV);
const prevBy = {}; for (const r of prev.rows) (prevBy[r.playerId] ||= []).push(r);
const dates = [...new Set(cur.games.map((g) => g.date))].sort().filter((d) => d <= DATE);

// The formula as shipped, with the goal-rate shrink as a parameter (project() carries GOAL_RATE_SHRINK = 8).
function lambdas(rates, { home, oppPos, pos, b2b, toi = 'l5' }, k = GOAL_RATE_SHRINK) {
  const league = LEAGUE_POS[pos] || LEAGUE_POS.C;
  const posSog = oppPos?.sog ?? league.sog; const posG = oppPos?.g ?? league.g;
  const h = home ? 1 : 0; const b = b2b ? 1 : 0;
  const n = rates.n ?? 0; const wG = rates.held || !(n > 0) || !(k > 0) ? 1 : n / (n + k);
  const gRate = wG * Math.max(rates.g, 0) + (1 - wG) * league.g;
  const toiRead = toi === 'l5' ? rates.toiL5 ?? rates.toi : rates.toi;
  const lamS = Math.exp(SHOTS_FIT.const + SHOTS_FIT.sog * lg(rates.sog) + SHOTS_FIT.icf * lg(rates.icf) + SHOTS_FIT.toi * lg(toiRead) + SHOTS_FIT.home * h + SHOTS_FIT.pos * lg(posSog) + SHOTS_FIT.b2b * b);
  const lamG = Math.exp(GOALS_FIT.const + GOALS_FIT.g * Math.log(gRate + 0.05) + GOALS_FIT.iscf * lg(rates.iscf) + GOALS_FIT.sog * lg(rates.sog) + GOALS_FIT.home * h + GOALS_FIT.pos * Math.log(Math.max(posG, 0) + 0.1) + GOALS_FIT.b2b * b);
  return { lamS, lamG };
}
const odds = ({ lamS, lamG }) => ({ lamS: r3(lamS), lamG: r3(lamG), p2: r3(poissonAtLeast(lamS, 2)), p3: r3(poissonAtLeast(lamS, 3)), p4: r3(poissonAtLeast(lamS, 4)), p5: r3(poissonAtLeast(lamS, 5)), p1g: r3(1 - Math.exp(-lamG)), p2g: r3(poissonAtLeast(lamG, 2)) });

/** The study's rates: this season blended into last at n / (n + 18) for shots and attempts, n / (n + 40) for goals and chances, n / (n + 5) for TOI (docs section 3). */
function studyRates(c, p) {
  const n = c.length; const base = p.length >= 10;
  if (!base && n < 5) return null;
  const bl = (k, K) => { const w = base ? n / (n + K) : 1; return w * (n ? meanOf(c, k) : 0) + (1 - w) * (base ? meanOf(p, k) : 0); };
  const toi = bl('toi', 5);
  return { n, base: base ? p.length : 0, held: false, sog: bl('sog', 18), icf: bl('icf', 18), g: bl('g', 40), iscf: bl('iscf', 40), toi, toiL5: n ? meanOf(c.slice(-5), 'toi') : toi };
}
/** The opponent's row blended across the season boundary at games / (games + 15) for shots and games / (games + 40) for goals. */
function blendedOpp(cell) {
  if (!cell) return null;
  const g = cell.games || 0;
  const bl = (c, p, K) => (c == null ? p : p == null ? c : (g / (g + K)) * c + (K / (g + K)) * p);
  return { sog: bl(cell.curSog, cell.prevSog, 15), g: bl(cell.curG, cell.prevG, 40) };
}

/** This season's cell shrunk toward the league's average per skater at the position at games / (games + K): the table stays this season's, its noise at ten games does not. */
function shrunkOpp(cell, pos, posAllowed, kS = 15, kG = 40) {
  if (!cell || cell.held) return cell ? { sog: cell.sog, g: cell.g } : null;
  const peers = Object.values(posAllowed.teams).map((t) => t[pos]).filter((c) => c && !c.held);
  const lgS = mean(peers.map((c) => c.sog)); const lgG = mean(peers.map((c) => c.g));
  const g = cell.games || 0;
  return { sog: lgS + (g / (g + kS)) * (cell.sog - lgS), g: lgG + (g / (g + kG)) * (cell.g - lgG) };
}
const VARIANTS = [
  ['site', 'As shipped: this season’s rate from his fifth game, this season’s table, goal rate shrunk at n / (n + 8)'],
  ['k0', 'Shipped, goal rate not shrunk'],
  ['k16', 'Shipped, goal rate shrunk at n / (n + 16)'],
  ['k40', 'Shipped, goal rate shrunk at n / (n + 40)'],
  ['study', 'The formula as fitted: rates and table blended into last season (study section 3 / 9), no shrink'],
  ['studyK8', 'The study’s blends with the shrink at 8'],
  ['tablePrev', 'Shipped rates, last season’s table'],
  ['tableBlend', 'Shipped rates, the table blended across the boundary'],
  ['tableNone', 'Shipped rates, no opponent table (the league figure at his position)'],
  ['tableShrunk', 'Shipped rates, this season’s table shrunk toward the league at games / (games + 15) for shots, + 40 for goals'],
  ['tableShrunk30', 'The same at games / (games + 30) and + 80'],
  ['toiSeason', 'Shipped, his season TOI in place of his last five'],
];

const graded = [];   // one row per skater-game, every variant's figures on it
const byPlayer = {}; const lastGame = {};
let seen = 0;
for (const date of dates) {
  const before = cur.rows.filter((r) => r.date < date);   // every row dated before the slate: the store's loadRows(asOf) cut
  const posAllowed = positionAllowed(before, prev.rows);
  const slate = cur.games.filter((g) => g.date === date);
  const today = cur.rows.filter((r) => r.date === date);
  for (const g of slate) {
    for (const r of today.filter((x) => x.gameId === g.id)) {
      const c = byPlayer[r.playerId] || []; const p = prevBy[r.playerId] || [];
      const rates = blendRates(c, p);
      if (!rates) continue;
      const home = r.venue === 'H'; const b2b = isBackToBack(lastGame, r.team, date);
      const cell = posAllowed.read(r.opp, r.pos);
      const ctx = { home, oppPos: cell ? { sog: cell.sog, g: cell.g } : null, pos: r.pos, b2b };
      const site = project(rates, ctx);
      const mine = lambdas(rates, ctx);
      if (Math.abs(mine.lamS - site.lamS) > 0.006 || Math.abs(mine.lamG - site.lamG) > 0.006) throw new Error(`replica drift ${r.name}: ${JSON.stringify(site)} vs ${JSON.stringify(mine)}`);
      const sr = studyRates(c, p);
      const prevCell = cell && cell.prevSog != null ? { sog: cell.prevSog, g: cell.prevG } : ctx.oppPos;
      const blendCell = blendedOpp(cell);
      const v = {
        site: odds(mine),
        k0: odds(lambdas(rates, ctx, 0)), k16: odds(lambdas(rates, ctx, 16)), k40: odds(lambdas(rates, ctx, 40)),
        study: sr ? odds(lambdas(sr, { ...ctx, oppPos: blendCell }, 0)) : null,
        studyK8: sr ? odds(lambdas(sr, { ...ctx, oppPos: blendCell }, 8)) : null,
        tablePrev: odds(lambdas(rates, { ...ctx, oppPos: prevCell })),
        tableBlend: odds(lambdas(rates, { ...ctx, oppPos: blendCell })),
        tableNone: odds(lambdas(rates, { ...ctx, oppPos: null })),
        tableShrunk: odds(lambdas(rates, { ...ctx, oppPos: shrunkOpp(cell, r.pos, posAllowed) })),
        tableShrunk30: odds(lambdas(rates, { ...ctx, oppPos: shrunkOpp(cell, r.pos, posAllowed, 30, 80) })),
        toiSeason: odds(lambdas(rates, { ...ctx, toi: 'season' })),
      };
      // The plain windows of his own results as predictors: the mean over the window as a Poisson rate.
      const hist = [...p, ...c];
      const win = (n) => (hist.length >= n ? hist.slice(-n) : null);
      const own = {};
      for (const [k, list] of [['own5', win(5)], ['own10', win(10)], ['ownSeason', c.length >= 3 ? c : null]]) {
        if (!list) { own[k] = null; continue; }
        const lamS = meanOf(list, 'sog'); const lamG = meanOf(list, 'g');
        own[k] = { lamS: r3(lamS), lamG: r3(lamG), p3: r3(poissonAtLeast(lamS, 3)), p1g: r3(1 - Math.exp(-lamG)) };
      }
      const heat = formOf(c, p, rates);
      graded.push({
        date, gameId: g.id, game: `${g.away} @ ${g.home}`, id: r.playerId, name: r.name, team: r.team, opp: r.opp, venue: r.venue, pos: r.pos, home, b2b,
        n: rates.n, held: rates.held, base: rates.base, rateSog: r2(rates.sog), rateG: r3(rates.g), rateIcf: r2(rates.icf), rateIscf: r2(rates.iscf), toiL5: r2(rates.toiL5),
        oppSog: cell?.sog ?? null, oppG: cell?.g ?? null, oppGames: cell?.games ?? 0, oppHeld: !!cell?.held, rankSog: cell?.rankSog ?? null, rankG: cell?.rankG ?? null, teams: posAllowed.teamCount,
        hotS: !!heat?.hotS, coldS: !!heat?.coldS, hotG: !!heat?.hotG, coldG: !!heat?.coldG,
        sog: r.sog, g: r.g, toi: r.toi, ...v, ...own,
      });
      seen++;
    }
  }
  for (const r of today) { (byPlayer[r.playerId] ||= []).push(r); if (!lastGame[r.team] || date > lastGame[r.team]) lastGame[r.team] = date; }
}

// ---- scoring ----
const score = (rows, pOf, hitOf) => {
  const list = rows.map((r) => [pOf(r), hitOf(r)]).filter(([p]) => p != null);
  if (!list.length) return { n: 0 };
  const said = mean(list.map(([p]) => p)); const hit = mean(list.map(([, h]) => h));
  const brier = mean(list.map(([p, h]) => (p - h) ** 2));
  const ll = mean(list.map(([p, h]) => -(h ? Math.log(Math.max(p, 1e-6)) : Math.log(Math.max(1 - p, 1e-6)))));
  return { n: list.length, said: r3(said), hit: r3(hit), diff: r3(hit - said), brier: r4(brier), logloss: r4(ll) };
};
const MARKETS = [['p2', 'sog', 2, '2+ SOG'], ['p3', 'sog', 3, '3+ SOG'], ['p4', 'sog', 4, '4+ SOG'], ['p5', 'sog', 5, '5+ SOG'], ['p1g', 'g', 1, '1+ goal'], ['p2g', 'g', 2, '2+ goals']];
const on = (variant, key) => (r) => r[variant]?.[key] ?? null;
const hit = (stat, min) => (r) => (r[stat] >= min ? 1 : 0);
const BUCKETS = [[0, 0.2], [0.2, 0.3], [0.3, 0.4], [0.4, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 1.01]];

const season = graded;
const yday = graded.filter((r) => r.date === DATE);
const md = [];
const line = (s = '') => md.push(s);
const table = (head, rows) => { line(`| ${head.join(' | ')} |`); line(`| ${head.map(() => '---').join(' | ')} |`); for (const r of rows) line(`| ${r.join(' | ')} |`); line(); };

line(`# NHL plain-rate read replayed: ${dates[0]} → ${DATE}`);
line();
line(`${season.length} skater-games over ${dates.length} slates (${cur.games.filter((g) => g.date <= DATE).length} games), rated before each game from the public box scores; ${yday.length} on ${DATE}. Skaters with no base (under five games this season and under ten last season) are not rated, as on the board.`);
line();

line('## The shipped read, every market, season to date');
line();
table(['Market', 'n', 'said', 'hit', 'hit − said', 'Brier', 'log loss'], MARKETS.map(([k, stat, min, label]) => { const s = score(season, on('site', k), hit(stat, min)); return [label, s.n, pct(s.said), pct(s.hit), pct(s.diff), s.brier, s.logloss]; }));

line('## Calibration of the shipped read by band');
line();
for (const [k, stat, min, label] of [['p3', 'sog', 3, '3+ SOG'], ['p1g', 'g', 1, '1+ goal']]) {
  line(`### ${label}`);
  line();
  table(['Band', 'n', 'said', 'hit', 'hit − said'], BUCKETS.map(([lo, hi]) => { const s = score(season.filter((r) => r.site[k] >= lo && r.site[k] < hi), on('site', k), hit(stat, min)); return [`${Math.round(lo * 100)}–${Math.round(Math.min(hi, 1) * 100)}%`, s.n, pct(s.said), pct(s.hit), pct(s.diff)]; }));
}

line('## The variants on the same rows (3+ SOG and 1+ goal; lower Brier is better)');
line();
const common = season.filter((r) => VARIANTS.every(([v]) => r[v]));
line(`${common.length} skater-games every variant rates.`);
line();
table(['Variant', '3+ said', '3+ hit', '3+ Brier', '3+ log loss', '1+ G said', '1+ G hit', '1+ G Brier', '1+ G log loss', 'What it is'], VARIANTS.map(([v, what]) => { const s = score(common, on(v, 'p3'), hit('sog', 3)); const g = score(common, on(v, 'p1g'), hit('g', 1)); return [v, pct(s.said), pct(s.hit), s.brier, s.logloss, pct(g.said), pct(g.hit), g.brier, g.logloss, what]; }));

line('## The windows of his own results beside the formula (the rows every read covers)');
line();
const winRows = season.filter((r) => r.own5 && r.own10 && r.ownSeason);
line(`${winRows.length} skater-games with a full last 5, last 10 and three games this season.`);
line();
table(['Read', '3+ said', '3+ hit', '3+ Brier', '1+ G said', '1+ G hit', '1+ G Brier'], [['site', 'Shipped'], ['study', 'Study blends'], ['own5', 'Own last 5'], ['own10', 'Own last 10'], ['ownSeason', 'Own season']].map(([v, label]) => { const s = score(winRows, on(v, 'p3'), hit('sog', 3)); const g = score(winRows, on(v, 'p1g'), hit('g', 1)); return [label, pct(s.said), pct(s.hit), s.brier, pct(g.said), pct(g.hit), g.brier]; }));

line('## The top of the board by variant: where the plays come from');
line();
line('The rows the Best bets rule lists are the ones said 50%+ for 3+ SOG and 35%+ for 1+ goal, so calibration there is what the board is worth.');
line();
const topBands = (v, k, stat, min, cutsAt) => cutsAt.map(([lo, hi], i) => { const s = score(season.filter((r) => r[v] && r[v][k] >= lo && r[v][k] < hi), on(v, k), hit(stat, min)); return `${s.n} · ${pct(s.said)} → ${pct(s.hit)}`; });
table(['Variant', '3+ SOG said 50–60%: n · said → hit', '60–70%', '70%+', '1+ goal 30–40%', '40%+'], ['site', 'study', 'tableBlend', 'tablePrev', 'tableNone', 'tableShrunk', 'tableShrunk30'].map((v) => [v, ...topBands(v, 'p3', 'sog', 3, [[0.5, 0.6], [0.6, 0.7], [0.7, 1.01]]), ...topBands(v, 'p1g', 'g', 1, [[0.3, 0.4], [0.4, 1.01]])]));
const ruleBy = (v) => {
  const rows = { shots: [], goals: [] };
  for (const date of dates) { const day = season.filter((r) => r.date === date && r[v]); for (const gid of new Set(day.map((r) => r.gameId))) { const pk = pickGame(day.filter((r) => r.gameId === gid).map((r) => ({ ...r, p3: r[v].p3, lamS: r[v].lamS, p1g: r[v].p1g, lamG: r[v].lamG }))); rows.shots.push(...pk.shots.filter((x) => !x.under)); rows.goals.push(...pk.goals.filter((x) => !x.under)); } }
  const s = score(rows.shots, on(v, 'p3'), hit('sog', 3)); const g = score(rows.goals, on(v, 'p1g'), hit('g', 1));
  return [v, s.n, pct(s.said), pct(s.hit), pct(s.diff), s.brier, g.n, pct(g.said), pct(g.hit), pct(g.diff), g.brier];
};
table(['Variant', 'shots rows over the floor', 'said', 'hit', 'hit − said', 'Brier', 'goals rows over the floor', 'said', 'hit', 'hit − said', 'Brier'], ['site', 'study', 'tableBlend', 'tablePrev', 'tableNone', 'tableShrunk', 'tableShrunk30'].map(ruleBy));
line('### The opponent’s table: how wide it reads this season against last season, and how much of last season it carries');
line();
{
  const pa = positionAllowed(cur.rows.filter((r) => r.date < DATE), prev.rows);
  const sdOf = (xs) => { const m = mean(xs); return xs.length > 1 ? Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) : null; };
  const corr = (a, b) => { const ma = mean(a); const mb = mean(b); const num = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0); const den = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0)); return den ? num / den : null; };
  table(['Position', 'teams', 'games a team (this season)', 'sd of log shots allowed, this season', 'sd last season', 'ratio', 'correlation this vs last season', 'sd of log goals allowed, this season', 'sd last season', 'correlation'], POS.map((pos) => {
    const cells = Object.values(pa.teams).map((t) => t[pos]).filter((c) => c && c.curSog != null && c.prevSog != null);
    const cs = cells.map((c) => Math.log(c.curSog)); const ps = cells.map((c) => Math.log(c.prevSog));
    const cg = cells.map((c) => Math.log(Math.max(c.curG, 0.02))); const pg = cells.map((c) => Math.log(Math.max(c.prevG, 0.02)));
    return [pos, cells.length, f1(mean(cells.map((c) => c.games))), f2(sdOf(cs)), f2(sdOf(ps)), f2(sdOf(cs) / sdOf(ps)), f2(corr(cs, ps)), f2(sdOf(cg)), f2(sdOf(pg)), f2(corr(cg, pg))];
  }));
  line('The shots coefficient on the table (0.6869) was fitted on the blended table; a table this season alone reads wider than last season’s full one, so the same coefficient moves the λ further than the fit allowed for.');
  line();
}
line('## Where the shipped read runs high or low (season to date)');
line();
const cuts = [
  ['Position', (r) => r.pos],
  ['Games this season', (r) => (r.held ? 'last season stands in (< 5)' : r.n < 10 ? '5–9' : '10+')],
  ['Venue', (r) => (r.home ? 'home' : 'away')],
  ['Back to back', (r) => (r.b2b ? 'yes' : 'no')],
  ['Opponent’s rank at his position (shots)', (r) => (r.rankSog == null ? 'no table' : r.rankSog <= Math.ceil(r.teams / 3) ? 'soft third' : r.rankSog > r.teams - Math.ceil(r.teams / 3) ? 'stingy third' : 'middle')],
  ['Shot form (flame / snowflake)', (r) => (r.hotS ? 'hot' : r.coldS ? 'cold' : 'neither')],
  ['Goal form', (r) => (r.hotG ? 'hot' : r.coldG ? 'cold' : 'neither')],
  ['His shots rate', (r) => (r.rateSog >= 3 ? '3.0+ a game' : r.rateSog >= 2 ? '2.0–2.9' : r.rateSog >= 1.5 ? '1.5–1.9' : 'under 1.5')],
  ['His goal rate', (r) => (r.rateG >= 0.5 ? '0.5+ a game' : r.rateG >= 0.3 ? '0.3–0.49' : r.rateG >= 0.15 ? '0.15–0.29' : 'under 0.15')],
];
line('### Shot form by how many games stand behind his rate (shipped read)');
line();
table(['Form', 'games this season', 'n', '3+ said', '3+ hit', 'diff'], ['hot', 'cold', 'neither'].flatMap((k) => ['last season stands in (< 5)', '5–9', '10+'].map((tier) => { const rows = season.filter((r) => (r.hotS ? 'hot' : r.coldS ? 'cold' : 'neither') === k && (r.held ? 'last season stands in (< 5)' : r.n < 10 ? '5–9' : '10+') === tier); const s = score(rows, on('site', 'p3'), hit('sog', 3)); return [k, tier, s.n, pct(s.said), pct(s.hit), pct(s.diff)]; })));
line('### Shot form under the study’s blends (hot = his last five at 1.4× his blended rate)');
line();
table(['Cut', 'n', '3+ said (study)', '3+ hit', 'diff', '3+ said (shipped)', 'diff'], ['hot', 'cold', 'neither'].map((k) => { const rows = season.filter((r) => (r.hotS ? 'hot' : r.coldS ? 'cold' : 'neither') === k && r.study); const s = score(rows, on('study', 'p3'), hit('sog', 3)); const t = score(rows, on('site', 'p3'), hit('sog', 3)); return [k, s.n, pct(s.said), pct(s.hit), pct(s.diff), pct(t.said), pct(t.diff)]; }));
for (const [label, keyOf] of cuts) {
  line(`### ${label}`);
  line();
  const keys = [...new Set(season.map(keyOf))];
  table(['Cut', 'n', '3+ said', '3+ hit', 'diff', '3+ Brier', '1+ G said', '1+ G hit', 'diff', '1+ G Brier'], keys.map((k) => { const rows = season.filter((r) => keyOf(r) === k); const s = score(rows, on('site', 'p3'), hit('sog', 3)); const g = score(rows, on('site', 'p1g'), hit('g', 1)); return [k, s.n, pct(s.said), pct(s.hit), pct(s.diff), s.brier, pct(g.said), pct(g.hit), pct(g.diff), g.brier]; }));
}

// The board rule replayed: pickGame per game on the shipped read.
line('## The Best bets rule replayed (three to four a table, the floor at 50% for 3+ SOG and 35% for 1+ goal)');
line();
const boardRows = { shots: [], goals: [], shotsNext: [], goalsNext: [] };
const top = { s10: [], s20: [], g10: [], g20: [] };
for (const date of dates) {
  const day = season.filter((r) => r.date === date);
  for (const gid of new Set(day.map((r) => r.gameId))) {
    const cands = day.filter((r) => r.gameId === gid).map((r) => ({ ...r, p3: r.site.p3, lamS: r.site.lamS, p1g: r.site.p1g, lamG: r.site.lamG }));
    const pk = pickGame(cands);
    boardRows.shots.push(...pk.shots); boardRows.goals.push(...pk.goals); boardRows.shotsNext.push(...pk.nextShots); boardRows.goalsNext.push(...pk.nextGoals);
  }
  const byS = [...day].sort((a, b) => b.site.p3 - a.site.p3); const byG = [...day].sort((a, b) => b.site.p1g - a.site.p1g);
  top.s10.push(...byS.slice(0, 10)); top.s20.push(...byS.slice(0, 20)); top.g10.push(...byG.slice(0, 10)); top.g20.push(...byG.slice(0, 20));
}
const be = (p) => (p == null ? '—' : fairOdds(p));
table(['Rows', 'n', 'said', 'hit', 'hit − said', 'break-even of the said', 'Brier'], [
  ['Shots table, over the floor', boardRows.shots.filter((r) => !r.under)], ['Shots table, fill-ins under the floor', boardRows.shots.filter((r) => r.under)], ['Shots “next” line', boardRows.shotsNext],
  ['Goals table, over the floor', boardRows.goals.filter((r) => !r.under)], ['Goals table, fill-ins under the floor', boardRows.goals.filter((r) => r.under)], ['Goals “next” line', boardRows.goalsNext],
].map(([label, rows]) => { const k = label.startsWith('Shots') ? 'p3' : 'p1g'; const s = score(rows, on('site', k), label.startsWith('Shots') ? hit('sog', 3) : hit('g', 1)); return [label, s.n, pct(s.said), pct(s.hit), pct(s.diff), be(s.said), s.brier]; }));
table(['The slate’s top', 'n', 'said', 'hit', 'hit − said'], [['10 by P(3+ SOG)', top.s10, 'p3', hit('sog', 3)], ['20 by P(3+ SOG)', top.s20, 'p3', hit('sog', 3)], ['10 by P(1+ goal)', top.g10, 'p1g', hit('g', 1)], ['20 by P(1+ goal)', top.g20, 'p1g', hit('g', 1)]].map(([label, rows, k, h]) => { const s = score(rows, on('site', k), h); return [label, s.n, pct(s.said), pct(s.hit), pct(s.diff)]; }));

// ---- the slate ----
line(`# The slate of ${DATE}`);
line();
const slateGames = cur.games.filter((g) => g.date === DATE);
const rankS = [...yday].sort((a, b) => b.site.p3 - a.site.p3).map((r) => r.id); const rankG = [...yday].sort((a, b) => b.site.p1g - a.site.p1g).map((r) => r.id);
let tallyS = { hit: 0, of: 0 }; let tallyG = { hit: 0, of: 0 };
for (const g of slateGames) {
  const rows = yday.filter((r) => r.gameId === g.id);
  const cands = rows.map((r) => ({ ...r, p3: r.site.p3, lamS: r.site.lamS, p1g: r.site.p1g, lamG: r.site.lamG }));
  const pk = pickGame(cands);
  const fg = g.firstGoal ? `${g.firstGoal.name} (${g.firstGoal.team}, P${g.firstGoal.period} ${g.firstGoal.time})` : 'none';
  line(`## ${g.away} ${g.awayScore} @ ${g.home} ${g.homeScore}  · first goal ${fg}`);
  line();
  const srow = (r) => [`${r.name} (${r.team} ${r.pos}${r.b2b ? ', B2B' : ''})${r.under ? ' · fill-in' : ''}`, f2(r.site.lamS), pct(r.site.p2), pct(r.site.p3), fairOdds(r.site.p3), pct(r.site.p4), `${f2(r.rateSog)} in ${r.n}${r.held ? ' (last season)' : ''}`, `${r.opp} #${r.rankSog ?? '—'} (${f2(r.oppSog)}/${r.pos}${r.oppHeld ? ', last season' : ''})`, r.sog, r.sog >= 3 ? '✓' : '✗'];
  line('**Shots** (the table the board would list; Got = his SOG)');
  line();
  table(['Skater', 'λ', '2+', '3+', 'break-even', '4+', 'his rate', 'opponent to his position', 'Got', '3+'], pk.shots.map(srow));
  if (pk.nextShots.length) line(`Next: ${pk.nextShots.map((r) => `${r.name} ${pct(r.site.p3)} → ${r.sog}`).join('; ')}.`);
  line();
  const grow = (r) => [`${r.name} (${r.team} ${r.pos})${r.under ? ' · fill-in' : ''}`, f2(r.site.lamG), pct(r.site.p1g), fairOdds(r.site.p1g), pct(r.site.p2g), `${f2(r.rateG)} in ${r.n}${r.held ? ' (last season)' : ''}`, `${r.opp} #${r.rankG ?? '—'} (${r.oppG == null ? '—' : Number(r.oppG).toFixed(3)}/${r.pos})`, r.g, r.g >= 1 ? '✓' : '✗'];
  line('**Goals**');
  line();
  table(['Skater', 'λ', '1+', 'break-even', '2+', 'his rate', 'opponent to his position', 'Got', '1+'], pk.goals.map(grow));
  if (pk.nextGoals.length) line(`Next: ${pk.nextGoals.map((r) => `${r.name} ${pct(r.site.p1g)} → ${r.g}`).join('; ')}.`);
  line();
  const st = pickGame(rows.filter((r) => r.study).map((r) => ({ ...r, p3: r.study.p3, lamS: r.study.lamS, p1g: r.study.p1g, lamG: r.study.lamG })));
  line(`With the study’s blends the shots table reads ${st.shots.map((r) => `${r.name} ${pct(r.study.p3)}${r.under ? ' (fill-in)' : ''} → ${r.sog}`).join('; ')}; goals ${st.goals.map((r) => `${r.name} ${pct(r.study.p1g)}${r.under ? ' (fill-in)' : ''} → ${r.g}`).join('; ')}.`);
  line();
  for (const r of pk.shots.filter((x) => !x.under)) { tallyS.of++; if (r.sog >= 3) tallyS.hit++; }
  for (const r of pk.goals.filter((x) => !x.under)) { tallyG.of++; if (r.g >= 1) tallyG.hit++; }
  const big = rows.filter((r) => r.sog >= 5 || r.g >= 2).sort((a, b) => b.sog - a.sog);
  if (big.length) line(`Big nights: ${big.map((r) => `${r.name} ${r.sog} SOG / ${r.g} G (P(3+) ${pct(r.site.p3)}, #${rankS.indexOf(r.id) + 1} of ${rankS.length} on the slate; P(1+ G) ${pct(r.site.p1g)}, #${rankG.indexOf(r.id) + 1})`).join('; ')}.`);
  line();
}
line(`**Tally over the floor:** shots ${tallyS.hit} / ${tallyS.of}, goals ${tallyG.hit} / ${tallyG.of}.`);
line();
const ys = score(yday, on('site', 'p3'), hit('sog', 3)); const yg = score(yday, on('site', 'p1g'), hit('g', 1));
line(`Every rated skater on the slate: 3+ SOG said ${pct(ys.said)}, hit ${pct(ys.hit)} (Brier ${ys.brier}); 1+ goal said ${pct(yg.said)}, hit ${pct(yg.hit)} (Brier ${yg.brier}).`);
line();
line('### The slate’s biggest misses, both ways');
line();
const surprise = (r) => (r.sog >= 3 ? 1 - r.site.p3 : -r.site.p3);
const sorted = [...yday].sort((a, b) => Math.abs(surprise(b)) - Math.abs(surprise(a)));
table(['Skater', 'P(3+)', 'Got', 'P(1+ G)', 'Goals', 'his rate', 'games', 'opponent to his position'], sorted.slice(0, 14).map((r) => [`${r.name} (${r.team} ${r.pos} ${r.venue === 'H' ? 'vs' : 'at'} ${r.opp})`, pct(r.site.p3), r.sog, pct(r.site.p1g), r.g, f2(r.rateSog), `${r.n}${r.held ? ' (last season)' : ''}`, `#${r.rankSog ?? '—'} (${f2(r.oppSog)})`]));
line('### Every 5+ SOG and 2+ goal night on the slate, and where the read had him');
line();
const bigAll = yday.filter((r) => r.sog >= 5 || r.g >= 2).sort((a, b) => b.sog - a.sog || b.g - a.g);
table(['Skater', 'SOG', 'G', 'P(3+)', 'rank on the slate (3+)', 'P(1+ G)', 'rank (1+ G)', 'P(that many SOG)', 'P(that many G)'], bigAll.map((r) => [`${r.name} (${r.team} ${r.pos})`, r.sog, r.g, pct(r.site.p3), `#${rankS.indexOf(r.id) + 1} / ${rankS.length}`, pct(r.site.p1g), `#${rankG.indexOf(r.id) + 1}`, pct(poissonAtLeast(r.site.lamS, r.sog)), r.g ? pct(poissonAtLeast(r.site.lamG, r.g)) : '—']));

fs.writeFileSync(path.join(OUT, `nhl-${DATE}.md`), md.join('\n'));
// Every rated skater-game as CSV, the shipped read and the variants.
const cols = ['date', 'gameId', 'game', 'id', 'name', 'team', 'opp', 'venue', 'pos', 'home', 'b2b', 'n', 'held', 'base', 'rateSog', 'rateG', 'rateIcf', 'rateIscf', 'toiL5', 'oppSog', 'oppG', 'oppGames', 'oppHeld', 'rankSog', 'rankG', 'teams', 'hotS', 'coldS', 'hotG', 'coldG', 'sog', 'g', 'toi'];
const vcols = VARIANTS.flatMap(([v]) => ['lamS', 'lamG', 'p3', 'p1g'].map((k) => `${v}.${k}`)).concat(['own5', 'own10', 'ownSeason'].flatMap((v) => ['lamS', 'lamG', 'p3', 'p1g'].map((k) => `${v}.${k}`)));
const csv = [cols.concat(vcols).join(',')];
for (const r of graded) csv.push(cols.map((c) => JSON.stringify(r[c] ?? '')).concat(vcols.map((c) => { const [v, k] = c.split('.'); return r[v]?.[k] ?? ''; })).join(','));
fs.writeFileSync(path.join(OUT, `nhl-${DATE}-rows.csv`), csv.join('\n'));
console.log(md.join('\n'));
console.error(`written ${OUT}/nhl-${DATE}.md and ${OUT}/nhl-${DATE}-rows.csv (${graded.length} rows)`);

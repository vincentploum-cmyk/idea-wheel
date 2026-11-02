// The week's projections (Vincent, 2026-11-01: "I don't care about edge. I want us to write a script based on the data
// from propfinder and the cheat sheet. That is how we can come to the projected yards / TD candidates per game"): per
// game and per player, what the board expects him to gain and how likely he is to score — no price, no edge. Pure: the
// NFL binding runs it on every built board (lib/nfl/picks.js `projections`), `tools/nfl-projections.mjs` prints it.
//
// Yards (passing, rushing, receiving): the board's projection — his rate from PropFinder's logs (the season blended with
// his last ten, the without-teammate split and the vacated lift in) × the opponent's table at his depth-chart slot (the
// cheat sheet's tile beside PropFinder's when the sheet has one) — `ranges[market]` on the side player, with the quartiles
// × tonight's game script (`scriptOf`: the book's total against the team's usual scoring, the spread's lean to the run or
// the pass), read as a floor, a projection and a ceiling (his 20th and 80th percentile tonight, his own spread scaled with
// the script). The book's main line and the cheat sheet's line ride beside it, never into it.
//
// Touchdowns, from the team down:
//   1. the team's touchdowns tonight (`teamTd`): its own touchdowns a game this season (PropFinder's team row) through the
//      opponent's touchdowns allowed (the league's average as the base, damped as every matchup is, envFactor), and the
//      book's game total and spread (ESPN's line: the team's implied points × TD_PER_POINT), the two averaged when both
//      exist; `teamFactor` = that over its own touchdowns a game (TEAM_CLAMP);
//   2. his own scoring rate: his touchdowns a game (rushing + receiving + returns; season 0.6, last five 0.4), pulled
//      toward his volume — his projected carries + targets tonight × his position's touchdowns per touch across the pull —
//      at n / (n + RATE_K) on his games this season, so a touchdown-heavy start on little volume reads short of its rate
//      and a role that grew tonight (an out teammate's carries) reads in;
//   3. where the defense gives them up (`posShift`): the opponent's touchdowns allowed at his spot over what it allows in
//      all (POS_CLAMP), so a run defense leaking to backs moves the backs, not the team twice.
//   λ = rate × teamFactor × posShift; P(anytime) = 1 − e^(−λ); P(first half) = 1 − e^(−H1_SHARE · λ).
// A player out tonight is left off; "if active" / "if role confirmed" ride beside a name (roleOf).
import { matchupOf, envFactor } from '../picks/projection';

// The constants below were searched on 2025's weeks 4–18 and checked unchanged on 2026's weeks 1–7 (tools/audit/nfl-audit.mjs,
// docs/audits/2026-11-01-nfl-backtest.md; Vincent, 2026-11-01: "yes do the backtest and optimize it").
export const TD_PER_POINT = 0.105;   // offensive touchdowns per point scored (NFL: about 2.4 a team-game on 23 points)
export const H1_SHARE = 0.48;        // the share of his expected touchdowns before the half (searched: 0.48, 1H Brier 0.0865 → 0.0852)
export const RATE_K = 16;            // his games this season before his own touchdown rate counts half (4 before: his volume knows more)
export const RATE_WEIGHTS = { season: 0.6, l5: 0.4 };
export const TEAM_CLAMP = [0.6, 1.6];
// Where the defense gives its touchdowns up (the position against its overall) read nothing on top of the team's figure:
// off ([1, 1]; [0.7, 1.4] before).
export const POS_CLAMP = [1, 1];
export const SKILL = ['QB', 'RB', 'WR', 'TE'];
/** The weak spots a side's card names, with the players each opens up. */
export const ATTACK_MAX = 4;

const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const surname = (name) => String(name || '').trim().split(/\s+/).slice(-1)[0] || String(name || '');

/** "100+" for o99.5, "o100" for a whole line. */
export const markOf = (line) => (line == null ? '—' : Number.isInteger(line) ? `o${line}` : `${Math.ceil(line)}+`);

/** The spread's favourite and points as ESPN writes it ("KC -2.5", "EVEN", "PK"): { team, pts } or null. */
export function spreadOf(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  if (/^(even|pk|pick)/i.test(s)) return { team: null, pts: 0 };
  const m = s.match(/^([A-Z]{2,4})\s*([+-]?\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const pts = Math.abs(Number(m[2]));
  return Number.isFinite(pts) ? { team: m[1].toUpperCase(), pts } : null;
}

/** A team's implied points from the game total and the spread (the favourite total/2 + spread/2), null without a total. */
export function impliedPoints(odds, team) {
  const total = Number(odds?.total);
  if (!(total > 0)) return null;
  const sp = spreadOf(odds?.spread);
  if (!sp) return r1(total / 2);
  if (!sp.team) return r1(total / 2);
  return r1(total / 2 + (sp.team === team ? 1 : -1) * (sp.pts / 2));
}

/**
 * The words beside a name: [{ kind: 'active' | 'role', word, why }]. 'active' when he is a game-time decision; 'role'
 * when his read leans on a teammate out — his without-teammate split, else the production the out players left him
 * (`own[stat].lift`).
 */
/**
 * A position's group for the role word: a quarterback's role moves when a quarterback is out, a back's when a back is,
 * a receiver's or a tight end's when one of them is (Vincent, 2026-11-01: every Raven read "if role confirmed" because a
 * rookie receiver was inactive).
 */
export const ROLE_GROUP = { QB: 'QB', RB: 'RB', FB: 'RB', WR: 'REC', TE: 'REC' };
const nameOf = (n) => (typeof n === 'string' ? n : n?.name || '');

/** A name for matching across feeds: accents, punctuation and suffixes off, lower case ("Odell Beckham Jr." = "odell beckham"). */
export function normPlayer(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(?:jr|sr|ii|iii|iv|v)\b\.?/gi, '')
    .replace(/[-]/g, ' ').replace(/[.,'’‘`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function roleOf(sp, stats = [], posOf = null) {
  const out = [];
  if (sp?.health === 'DTD') out.push({ kind: 'active', word: 'if active', why: `${sp.injury || 'Listed'}${sp.injuryDetail ? `: ${sp.injuryDetail}` : ''} — a game-time decision` });
  // Only a teammate out at his own position group counts (posOf(name) → his position; a name it does not know counts).
  const group = ROLE_GROUP[sp?.pos] || null;
  const mine = (names) => (names || []).filter((n) => { if (!posOf || !group) return true; const pos = posOf(nameOf(n)); return !pos || ROLE_GROUP[pos] === group; });
  const wo = sp?.without || null;
  const woNames = mine(wo?.names);
  if (woNames.length) {
    out.push({ kind: 'role', word: 'if role confirmed', why: `${woNames.join(', ')} out: his read leans on his ${wo.n} game${wo.n === 1 ? '' : 's'} without ${woNames.length > 1 ? 'them' : 'him'} (${Math.round((wo.weight || 0) * 100)}% of the way)` });
    return out;
  }
  for (const stat of stats) {
    const lift = sp?.own?.[stat]?.lift;
    if (!(lift > 0)) continue;
    const from = sp.own[stat].liftFrom || [];
    const who = mine(from);
    if (from.length && !who.length) continue;
    out.push({ kind: 'role', word: 'if role confirmed', why: `${who.map((n) => surname(nameOf(n))).join(', ') || 'A teammate'} out: the production left behind lifts his rate (+${r1(lift)} ${stat} a game)` });
    break;
  }
  return out;
}

/**
 * The quarterbacks of a side in ESPN's depth-chart order (`chart` = [{ id, name }], starter first; lib/nfl/espn.js
 * parseDepthChart): each row gets `slot: 'QB'` and `depth` = his place on the chart, the first on the chart among the
 * rows (the ones out are not rows) is the starter and every other quarterback `backup: true`, off every list. Without a
 * chart, or with none of the rows on it, the rows stand as they were. Mutates the rows; returns the starter's id.
 */
export function markQuarterbacks(rows, chart, active = null) {
  const qbs = rows.filter((r) => r.pos === 'QB');
  if (!qbs.length || !chart?.length) return null;
  const at = new Map();
  chart.forEach((a, i) => { if (a.id) at.set(`id:${a.id}`, i); const n = normPlayer(a.name); if (n && !at.has(`n:${n}`)) at.set(`n:${n}`, i); });
  const placeOf = (x) => (x.espnId && at.has(`id:${x.espnId}`) ? at.get(`id:${x.espnId}`) : at.get(`n:${normPlayer(x.player)}`) ?? null);
  const placed = new Map();
  for (const r of qbs) { const i = placeOf(r); if (i != null) { r.slot = 'QB'; r.depth = i + 1; placed.set(r, i); } }
  // The starter: the highest on the chart among the quarterbacks who play (`active`: the side's players not out, so a
  // starter without a log yet — no row — still makes the others backups), else among the rows.
  const places = (active?.length ? active : qbs).map(placeOf).filter((i) => i != null);
  if (!places.length) return null;
  const top = Math.min(...places);
  let starter = null;
  for (const r of qbs) if (!starter && placed.get(r) === top) starter = r; else r.backup = true;
  return starter?.id || null;
}

/** A touchdown chance's word (Vincent, 2026-11-01): strong from 45%, lean from 30%, thin under that. */
export const TD_TIERS = { strong: 0.45, lean: 0.3 };
export const tdTier = (p) => (p == null ? null : p >= TD_TIERS.strong ? 'strong' : p >= TD_TIERS.lean ? 'lean' : 'thin');
/** A touchdown chance under this is no candidate on the lists. */
export const LIST_TD_MIN = 0.05;

/**
 * Tonight's game script on a side's yards (Vincent, 2026-11-01: "based on today's matchup and the player's skill, and
 * today's script, this is the floor and this is the ceiling"), from the book's total and spread as ESPN carries them:
 *   volume — the points the book expects of the team over its own scoring this season (its touchdowns a game over
 *            TD_PER_POINT), at `volume` = half the way (yards follow points less than one for one), 0.85–1.15;
 *   run / pass — the favourite leans on the run as the game goes, the underdog throws: + `rush` a point of spread on the
 *            run and − `pass` on the pass for the favourite, the other way for the underdog, 0.9–1.1.
 * Set by hand, not measured (no NFL season has been replayed here); the hovers spell each factor out.
 */
// Measured: on top of his rate and the matchup the book's total and spread move no yards projection for the better (2025:
// the pooled miss 0.9825 of the shipped read with no script, 0.9916 at the first cut's 0.5 / 0.012 / 0.008; 2026 weeks
// 1–7: 0.9626 against 0.9739), so the script carries no weight on the yards; the line still feeds the touchdowns.
export const SCRIPT = { volume: 0, rush: 0, pass: 0, volumeClamp: [0.85, 1.15], splitClamp: [0.9, 1.1] };
export function scriptOf(odds, team, ownTd, { SCRIPT: S = SCRIPT, TD_PER_POINT: TPP = TD_PER_POINT } = {}) {
  const pts = impliedPoints(odds, team);
  const sp = spreadOf(odds?.spread);
  const signed = sp ? (sp.team == null ? 0 : sp.team === team ? sp.pts : -sp.pts) : null;
  const usual = ownTd > 0 ? ownTd / TPP : null;
  const volume = pts != null && usual ? r3(clamp(1 + S.volume * (pts / usual - 1), S.volumeClamp)) : 1;
  const rush = signed != null ? r3(clamp(1 + S.rush * signed, S.splitClamp)) : 1;
  const pass = signed != null ? r3(clamp(1 - S.pass * signed, S.splitClamp)) : 1;
  const words = [];
  if (pts != null) words.push(`${r1(pts)} points implied${usual ? ` against its usual ${r1(usual)}` : ''}`);
  if (signed) words.push(signed > 0 ? `favoured by ${Math.abs(signed)}` : `${Math.abs(signed)}-point underdog`);
  return { points: pts, usual: usual ? r1(usual) : null, spread: signed, volume, rush, pass, from: pts != null || signed != null ? 'line' : null, words };
}

/** The script's factor on a market: the volume, then the run or the pass (receptions and receiving yards ride the pass). */
export const scriptFactor = (script, market) => (script ? r3(script.volume * (market === 'rush_yds' ? script.rush : script.pass)) : 1);

/** The floor and the ceiling read off his distribution tonight: his 20th and 80th percentile (a bad day, a good day). */
export const RANGE_Z = 0.8416;
/** Per market the floor's and the ceiling's distance from the projection in his spreads ([below, above]). */
// Fitted: the distances that put a fifth of 2025's games under the floor and a fifth over the ceiling (a game's yards run
// longer above the projection than below it, so the floor sits further down than the ceiling sits up).
export const RANGE = { pass_yds: [0.828, 0.746], rush_yds: [0.942, 0.927], rec_yds: [0.998, 0.896], receptions: [1.076, 0.909] };

/**
 * The ladder (Vincent, 2026-11-01: "per game, players listed with their ladders: strong - 50+ yards (60%), lean - 60+ yards,
 * thin 70+ yards"): his chance of reaching each round mark tonight, and per tier the highest mark he reaches at that
 * chance — strong from 60%, lean from 45%, thin from 30%; a mark two tiers share is listed once, at the stronger.
 * The chance is read off how far games actually land from the projection (`RESID`: (got − projection) / his spread at
 * 5% steps, per market, on 2025's games with PropFinder's logs, a zero included): a game's yards run skewed — the middle
 * game lands a third of a spread under the projection, the good ones run long — so a symmetric curve said 67% where the
 * strong rungs landed 59% (docs/audits/2026-11-01-nfl-propfinder-backtest.md).
 */
export const LADDER_TIERS = [['strong', 0.6], ['lean', 0.45], ['thin', 0.3]];
export const LADDER_STEP = { rec_yds: 10, rush_yds: 10, pass_yds: 25, receptions: 1 };
/** Yards projected under this climb by 5 (15+, 20+, 25+), so a short-yardage player's rungs do not jump 10 to 20. */
export const SMALL_YDS = 40;
export const RESID = {
  rec_yds: [-1.413, -1.174, -1.052, -0.947, -0.834, -0.729, -0.633, -0.53, -0.426, -0.312, -0.184, -0.039, 0.1, 0.284, 0.484, 0.735, 1.051, 1.446, 2.149],
  rush_yds: [-1.535, -1.234, -0.996, -0.866, -0.75, -0.648, -0.552, -0.424, -0.312, -0.208, -0.093, 0.066, 0.221, 0.371, 0.56, 0.829, 1.164, 1.63, 2.325],
  // The quarterbacks' (PASS below): the starters of 2025's weeks 4–18 against the passing read, in its flat spread.
  pass_yds: [-1.428, -1.167, -0.957, -0.828, -0.715, -0.563, -0.415, -0.235, -0.111, -0.008, 0.088, 0.22, 0.335, 0.414, 0.557, 0.746, 1.009, 1.236, 1.584],
  receptions: [-1.61, -1.327, -1.151, -1.007, -0.867, -0.741, -0.605, -0.486, -0.342, -0.218, -0.111, 0, 0.183, 0.357, 0.536, 0.742, 1.021, 1.348, 2.024],
};
/** The share of games landing under z spreads from the projection (the market's RESID, linear between the 5% steps). */
function residCdf(q, z) {
  if (z <= q[0]) return Math.max(0.01, 0.05 - (0.05 * (q[0] - z)) / Math.max(1e-6, q[1] - q[0]));
  if (z >= q[18]) return Math.min(0.99, 0.95 + (0.05 * (z - q[18])) / Math.max(1e-6, q[18] - q[17]));
  for (let i = 0; i < 18; i++) if (z <= q[i + 1]) return 0.05 * (i + 1) + (0.05 * (z - q[i])) / Math.max(1e-6, q[i + 1] - q[i]);
  return 0.95;
}
/** His chance of reaching `mark` (a whole figure: 50+ yards = more than 49.5) off a yards read { proj, sd }. */
export function chanceAtMark(y, mark, market, resid = RESID) {
  const q = resid[market];
  if (y?.proj == null || !(y.sd > 0) || !q) return null;
  return r3(1 - residCdf(q, (mark - 0.5 - y.proj) / y.sd));
}
/**
 * The big games (Vincent, 2026-11-01: "how can I find the super matchups that result in the big wins … 150 rushing yards",
 * then "find out what the best cocktail is … by looking for patterns in the box scores of players that reached these";
 * docs/audits/2026-11-01-nfl-big-games.md, tools/audit/nfl_big.py): his chance of 100+ / 150+ rushing or receiving yards and
 * 300+ / 350+ passing = σ(a + b · logit(the board's chance at the mark) + the one context that held up on both checks):
 * rushing his team's points implied by the line (the favourite expected to score runs the ball), receiving his share of
 * the team's targets over his last five (the board's rate reads yards; the share says who the ball goes to), passing the
 * game's total (shootouts). Fitted on 2024 (weeks 6–18), 2025 (4–18) and 2026 (1–7) after checking each on the season after
 * the fit; the opponent's defense table and his own past big games were tried and added nothing.
 */
export const BIG = {
  rush_yds: { pos: ['RB', 'QB'], min: 15, marks: { 100: { a: -1.4451, b: 0.8667, w: { points: 0.046 } }, 150: { a: -2.0436, b: 1.1422, w: { points: 0.0712 } } } },
  rec_yds: { pos: ['WR', 'TE', 'RB'], min: 15, marks: { 100: { a: -3.3473, b: 0.4203, w: { tgtShare: 8.9235 } }, 150: { a: -5.8955, b: 0.415, w: { tgtShare: 12.9588 } } } },
  // Passing reads the ladder's own chance (a 0, b 1): the passing read carries the total already, and on 2026's weeks 1–8
  // a refit on top of it (logit + total) scored the same Brier as the chance alone (300+ 0.1349 / 0.1349, 350+ 0.0558 / 0.0560).
  pass_yds: { pos: ['QB'], min: 100, marks: { 300: { a: 0, b: 1, w: {} }, 350: { a: 0, b: 1, w: {} } } },
};

/**
 * The passing read (Vincent, 2026-11-02, after week 8: "we need to work on the passing yards … our predictions are not even
 * close to the actual"; docs/audits/2026-11-02-nfl-passing.md). The board's generic read averaged every game in a
 * quarterback's log — the games he sat as the backup, a two-throw relief, an early exit — so a starter read 15–18 yards
 * under what starters throw (2025: 206 said, 224 thrown; 2026: 216 / 230) and missed by more than the league's average
 * would (64.6 against 59.4 a start on 2026's weeks 1–8). The read for a quarterback:
 *   own   = his passing yards a start over his last `starts` games of `minAtt` attempts or more (any season, playoffs in),
 *           pulled toward `league` at n / (n + K);
 *   total = the book's game total over `totalFill`; fav = his team's implied points over half the total (the favourite's
 *           half spread, + for the favourite); def = the opponent's passing yards allowed to quarterbacks a game over the
 *           league's (PropFinder's season table, at gp / (gp + defK), from `defMin` games, last season's table never);
 *   proj  = c + own · b.own + total · b.total + fav · b.fav + def · b.def, the spread flat at `sd` (his own game-to-game
 *           spread read no better: log loss 0.5200 against 0.5121 at the rungs).
 * Fitted by least squares on 2025's weeks 4–18 (430 starts, att ≥ 15), checked unchanged on 2026's weeks 1–8 (233): the
 * miss 55.8 (64.6 as it was), the strong / lean / thin rungs said 65 / 53 / 38% and landed 67 / 51 / 42%. The line and the
 * defense are small on their own (−1.3 and −0.4 yards on the check, both inside the noise of one season, both the same way
 * on 2025); the starts are the fix (−7.2, 95% interval −12.0 to −2.4).
 */
export const PASS = {
  starts: 17, minAtt: 10, league: 225, K: 6, totalFill: 44.5, defK: 8, defMin: 3, sd: 70,
  b: { c: 131.44, own: 0.4064, total: 3.9336, fav: 3.6077, def: 0.4828 },
};
/**
 * A quarterback's rushing read (2026-11-02, with the passing read; docs/audits/2026-11-02-nfl-rushing.md): his rushing yards a
 * start over the same last 17 starts, pulled toward `league` at n / (n + K) — fitted on every 2025 start (10+ attempts; a
 * first fit on the rushing list alone, the board's 10+, chose 15 / 10 and read worse on every start than the board). On
 * 2026's weeks 1–7: every start 11.46 → 11.16 (the gain's 95% interval −1.0 to +0.4), the listed ones 14.39 → 13.35 (−2.1 to
 * 0.0); the rungs land closer (strong said 66% landed 65%, the board's 67 → 59; log loss 0.3823 → 0.3672, 2025 0.4627 →
 * 0.4468). The line and the defense added nothing. The spread stays the ladder's (his own), the curve RESID.rush_yds.
 */
export const QB_RUSH = { starts: 17, minAtt: 10, league: 8, K: 3 };
export function qbRushRead(logs, { before = null } = {}, P = QB_RUSH) {
  const day = before ? String(before).slice(0, 10) : null;
  const newest = [...(logs || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const ys = [];
  for (const g of newest) {
    if (day && g.date && String(g.date).slice(0, 10) >= day) continue;
    if ((Number(g.passAtt) || 0) >= P.minAtt) ys.push(Number(g.rushYds) || 0);
    if (ys.length >= P.starts) break;
  }
  if (!ys.length) return null;
  const avg = ys.reduce((a, b) => a + b, 0) / ys.length;
  return { proj: r1((ys.length * avg + P.K * P.league) / (ys.length + P.K)), n: ys.length, avg: r1(avg) };
}
/** The passing read in words, for the hovers: "His last 17 starts: 298 a start (279 pulled toward the league) · total 45.5 · …". */
export function passText(pass) {
  if (!pass) return '';
  const parts = [`His last ${pass.n} start${pass.n === 1 ? '' : 's'}: ${Math.round(pass.avg)} yards a start (${Math.round(pass.own)} pulled toward the league's ${PASS.league})`];
  parts.push(pass.total != null ? `game total ${pass.total}` : 'no line yet (the league\'s usual total)');
  if (pass.fav) parts.push(`${pass.fav > 0 ? 'favourite' : 'underdog'} by ${Math.abs(pass.fav * 2)}`);
  if (pass.allowed != null && pass.league != null) parts.push(`the defense allows ${Math.round(pass.allowed)} to quarterbacks (league ${Math.round(pass.league)}${pass.def ? '' : ', too few games to count'})`);
  return parts.join(' · ');
}
/**
 * A quarterback's passing read tonight, or null when his log holds no start (a backup who never started keeps the board's
 * read). `logs` his PropFinder rows (newest first), `before` the game's date (rows on or after it are left out), `odds`
 * the game's line as ESPN carries it, `cell` / `league` / `gp` / `held` PropFinder's QB passing-yards cell for the opponent.
 */
export function passRead(logs, { before = null, odds = null, team = null, cell = null, league = null, gp = null, held = false } = {}, P = PASS) {
  const day = before ? String(before).slice(0, 10) : null;
  const starts = [];
  const newest = [...(logs || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  for (const g of newest) {
    if (day && g.date && String(g.date).slice(0, 10) >= day) continue;
    if ((Number(g.passAtt) || 0) >= P.minAtt) starts.push(Number(g.passYds) || 0);
    if (starts.length >= P.starts) break;
  }
  if (!starts.length) return null;
  const n = starts.length;
  const avg = starts.reduce((a, b) => a + b, 0) / n;
  const own = (n * avg + P.K * P.league) / (n + P.K);
  const lineTotal = Number(odds?.total) > 0 ? Number(odds.total) : null;
  const total = lineTotal ?? P.totalFill;
  // His team's implied points over half the total: half the spread, + for the favourite (impliedPoints, unrounded).
  const sp = lineTotal != null ? spreadOf(odds?.spread) : null;
  const fav = sp?.team && team ? (sp.team === team ? 1 : -1) * (sp.pts / 2) : 0;
  const allowed = cell?.value ?? null;
  const def = !held && allowed != null && league > 0 && gp >= P.defMin ? (allowed - league) * (gp / (gp + P.defK)) : 0;
  const base = P.b.c + P.b.own * own + P.b.total * (total - P.totalFill) + P.b.fav * fav;
  const proj = Math.max(0, base + P.b.def * def);
  return {
    proj: r1(proj), sd: P.sd, own: r1(own), avg: r1(avg), n, total: lineTotal, fav: r1(fav), def: r1(def), allowed, league: league ?? null, gp: gp ?? null,
    // The defense as a factor on the read without it, for the matchup cell ("×1.04").
    matchup: base > 0 ? r3(proj / base) : null,
  };
}
/** A game counts toward a receiver's target share when the pull holds 20+ targets of his side's (a team throws 30–40). */
export const SIDE_TGT_MIN = 20;
/** The context a model reads when the game has none (no line yet): the league's usual. */
export const BIG_FILL = { points: 22, total: 44.5, tgtShare: 0 };
/** His chance of the big mark tonight (null without a read or under the market's projection floor). */
export function bigChance(y, market, mark, ctx = {}) {
  const spec = BIG[market]?.marks?.[mark];
  if (!spec || y?.proj == null || y.proj < BIG[market].min) return null;
  const p0 = chanceAtMark(y, mark, market);
  if (p0 == null) return null;
  const q = Math.min(1 - 1e-4, Math.max(1e-4, p0));
  let z = spec.a + spec.b * Math.log(q / (1 - q));
  for (const [k, w] of Object.entries(spec.w)) z += w * (ctx[k] ?? BIG_FILL[k]);
  return r3(1 / (1 + Math.exp(-z)));
}

/** { strong, lean, thin } = { mark, p } | null for a yards read; the round marks are the market's step. */
export function ladderTiers(y, market, resid = RESID) {
  if (y?.proj == null || !(y.sd > 0)) return { strong: null, lean: null, thin: null };
  const step = (market === 'rec_yds' || market === 'rush_yds') && y.proj < SMALL_YDS ? 5 : LADDER_STEP[market] || 10;
  const marks = [];
  for (let m = step; m <= y.proj + 3 * y.sd; m += step) marks.push({ mark: m, p: chanceAtMark(y, m, market, resid) });
  const out = {}; const used = new Set();
  for (const [tier, at] of LADDER_TIERS) {
    const best = marks.filter((x) => x.p >= at).pop() || null;
    out[tier] = best && !used.has(best.mark) ? best : null;
    if (best) used.add(best.mark);
  }
  return out;
}
/** The book's implied points' share in the team's touchdowns tonight (the rest its own rate through the defense; 0.5 before). */
export const LINE_WEIGHT = 0.25;
/** The touchdown chance recalibrated to what the same stated chance landed: σ(a + b · logit(p)); identity by default. */
// Fitted on 2025 (the stated chance ran high at the top, low at the bottom): 45%+ said 54%, landed 45% before.
export const TD_CAL = { a: -0.1671, b: 0.8573 };
const logit = (p) => Math.log(p / (1 - p));
export const tdCalibrated = (p, cal = TD_CAL) => (p == null || !cal || (cal.a === 0 && cal.b === 1) ? p : 1 / (1 + Math.exp(-(cal.a + cal.b * logit(Math.min(0.999, Math.max(0.001, p)))))));
/** Every constant `nflProjections` reads; the audit (tools/audit/nfl-audit.mjs) passes others as `params`. */
/** The share of a game's touchdowns no listed player scores (defense, returns): the first touchdown's denominator. */
export const FIRST_OTHER = 0.06;
export const PARAMS = { TD_PER_POINT, H1_SHARE, RATE_K, RATE_WEIGHTS, TEAM_CLAMP, POS_CLAMP, SCRIPT, RANGE, LINE_WEIGHT, TD_CAL, FIRST_OTHER, RESID };

/**
 * The projections for a built board.
 *   board: lib/picks/board.js buildBoard's output (games with `sides`, `odds`)
 *   pf: the slate's PropFinder file ({ data: { players, defense } }), results: the stored box scores by game id
 *   helpers: { logAverages, actualFor, statOf } from the NFL binding (board.js stays out of this file: it reaches the store)
 * → { rows (by id), games: [{ …, teams: { ABBR: { teamTd, defense } }, lists }], lists: { td, receiving, rushing }, perTouch,
 *     sheetDirection, constants }
 */
export function nflProjections(board, { pf = null, results = {}, season, sheetDefense = null, helpers, params = null }) {
  const P = { ...PARAMS, ...(params || {}) };
  const { logAverages, actualFor, statOf } = helpers;
  const players = pf?.data?.players || [];
  const defense = pf?.data?.defense || null;
  const byKey = new Map();
  for (const p of players) { const list = byKey.get(p.key) || []; list.push(p); byKey.set(p.key, list); }
  const pfpOf = (key, team) => { const list = byKey.get(key) || []; return list.find((p) => p.team === team) || list[0] || null; };
  const thisSeason = (g) => g.season === season && (g.type === 'REG' || !g.type);
  // Each side's targets a game across the pull, for a receiver's share of them: keyed by the game and the opponent the side
  // faced, so a player's games with his former team count among that team's targets (keyed by his team now, a traded
  // receiver read as 80% of his new team's targets in the games he played elsewhere).
  const sideTgt = new Map();
  for (const p of players) for (const g of p.games || []) if (g.gameId && g.opp) { const k = `${g.gameId}|${g.opp}`; sideTgt.set(k, (sideTgt.get(k) || 0) + (Number(g.tgt) || 0)); }
  const tgtShareOf = (pfp) => {
    const xs = [];
    for (const g of pfp?.games || []) {
      if (!g.gameId || !g.opp) continue;
      const tot = sideTgt.get(`${g.gameId}|${g.opp}`);
      // A side whose targets the pull does not cover (its other receivers since gone from every roster) is no share.
      if (tot >= SIDE_TGT_MIN) xs.push((Number(g.tgt) || 0) / tot);
      if (xs.length === 5) break;
    }
    return xs.length ? r3(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  };

  // Touchdowns per touch by position across the pull's skill players this season: the volume prior behind every rate.
  const perTouch = {};
  for (const pos of SKILL) {
    let td = 0; let touches = 0;
    for (const p of players) {
      if (p.pos !== pos) continue;
      for (const g of p.games || []) if (thisSeason(g)) { td += Number(g.td) || 0; touches += (Number(g.rushAtt) || 0) + (pos === 'QB' ? 0 : Number(g.tgt) || 0); }
    }
    perTouch[pos] = touches >= 50 ? r3(td / touches) : null;
  }

  const leagueTd = defense?.leagueFor?.td ?? null;
  const teamTdOf = (g, team, opp) => {
    const own = defense?.totals?.[team]?.for?.td ?? null;
    const oppAgainst = defense?.totals?.[opp]?.against?.td ?? null;
    const fromTable = own != null ? r2(own * (envFactor(oppAgainst, leagueTd) ?? 1)) : null;
    const pts = impliedPoints(g.odds, team);
    const fromLine = pts != null ? r2(pts * P.TD_PER_POINT) : null;
    const tonight = fromTable != null && fromLine != null ? r2((1 - P.LINE_WEIGHT) * fromTable + P.LINE_WEIGHT * fromLine) : fromTable ?? fromLine;
    const factor = own > 0 && tonight != null ? r3(clamp(tonight / own, P.TEAM_CLAMP)) : 1;
    return { tonight, own, oppAgainst, fromTable, fromLine, points: pts, factor, from: fromTable != null && fromLine != null ? 'both' : fromTable != null ? 'propfinder' : fromLine != null ? 'line' : null };
  };

  const games = [];
  const all = [];
  for (const g of board?.games || []) {
    const result = results?.[g.id] || null;
    const teams = {};
    for (const team of [g.away, g.home]) {
      const side = g.sides?.[team];
      if (!side) continue;
      const opp = side.opp;
      const teamTd = teamTdOf(g, team, opp);
      const script = scriptOf(g.odds, team, teamTd.own, P);
      const allowed = side.allowed || null;
      // The opponent's touchdowns allowed in all as a factor: what posShift divides by.
      const allFactor = envFactor(teamTd.oppAgainst, leagueTd);
      const rows = [];
      // His teammates' positions by name (the out ones too), so the role word reads only an absence at his own spot.
      const posBy = new Map();
      for (const x of [...(side.players || []), ...(side.out || [])]) if (x?.pos && (x.player || x.name)) posBy.set(normPlayer(x.player || x.name), x.pos);
      const posOf = (name) => posBy.get(normPlayer(name)) || null;
      // The backups on ESPN's chart before the rows are built (the same rule markQuarterbacks applies to them after), so a
      // backup's passing yards stay the board's read and only the starter's take the passing read.
      const qbActive = (side.players || []).filter((x) => x.pos === 'QB' && !x.out).map((x) => ({ pos: 'QB', key: x.key, espnId: x.espnId || null, player: x.player }));
      markQuarterbacks(qbActive, pf?.espnDepth?.[team]?.qb || null, qbActive);
      const qbBackups = new Set(qbActive.filter((x) => x.backup).map((x) => x.key));
      // No chart: the quarterback whose latest start (PASS.minAtt attempts) is the most recent is the starter for the read,
      // so a backup with a start somewhere in his log is not projected a starter's yards (the replay without a chart had
      // every such backup read ~200 and throw nothing: a −21-yard bias on 2026's weeks 1–7).
      if (!qbBackups.size && qbActive.length > 1) {
        const day = g.date ? String(g.date).slice(0, 10) : '9999';
        const lastStart = (x) => (pfpOf(x.key, team)?.games || []).filter((r) => (Number(r.passAtt) || 0) >= PASS.minAtt && String(r.date || '') < day).map((r) => String(r.date)).sort().pop() || '';
        const ranked = qbActive.map((x) => [x.key, lastStart(x)]).sort((a, b) => b[1].localeCompare(a[1]));
        for (const [k] of ranked.slice(1)) qbBackups.add(k);
      }
      for (const sp of side.players || []) {
        if (sp.out || !SKILL.includes(sp.pos)) continue;
        const pfp = pfpOf(sp.key, team);
        const logs = pfp?.games || [];
        if (!logs.length) continue;
        const got = result ? actualFor(result, { key: sp.key, player: sp.player, team }) : undefined;
        const gotOf = (market) => (got === undefined ? undefined : got && got.played !== false ? statOf(got, market) : null);
        // Touchdowns.
        const tdAvg = logAverages(logs, { season, field: 'td' });
        const parts = Object.entries(P.RATE_WEIGHTS).filter(([w]) => tdAvg[w] != null);
        const rate = parts.length ? parts.reduce((s, [w, x]) => s + tdAvg[w] * x, 0) / parts.reduce((s, [, x]) => s + x, 0) : null;
        const n = logs.filter(thisSeason).length;
        const carries = sp.ranges?.rush_att?.exp ?? logAverages(logs, { season, field: 'rushAtt' }).season ?? 0;
        const targets = sp.pos === 'QB' ? 0 : sp.ranges?.targets?.exp ?? logAverages(logs, { season, field: 'tgt' }).season ?? 0;
        const touches = r1((carries || 0) + (targets || 0));
        const prior = perTouch[sp.pos] != null ? perTouch[sp.pos] * touches : null;
        const own = rate == null ? prior : prior == null ? rate : (n * rate + P.RATE_K * prior) / (n + P.RATE_K);
        const cellPos = sp.envPos && allowed?.rows?.[sp.envPos]?.td ? sp.envPos : allowed?.rows?.[sp.pos]?.td ? sp.pos : null;
        const cell = cellPos ? allowed.rows[cellPos].td : null;
        const mf = cell ? matchupOf(cell, allowed?.league?.[cellPos]?.td ?? null, allowed?.count || 32).factor : null;
        const shiftRaw = mf != null ? (allFactor ? mf / allFactor : mf) : null;
        const posShift = shiftRaw != null ? r3(clamp(shiftRaw, P.POS_CLAMP)) : 1;
        const stated = own != null ? own * teamTd.factor * posShift : null;
        // The chance through the touchdown calibration, the expected touchdowns read back off it, the first half's share of them.
        const pTd = stated != null ? r3(tdCalibrated(1 - Math.exp(-stated), P.TD_CAL)) : null;
        const lambda = pTd != null ? r3(-Math.log(1 - Math.min(0.999, pTd))) : null;
        const td = lambda != null && (touches > 0 || rate > 0) ? {
          lambda, p: pTd, p1h: r3(1 - Math.exp(-P.H1_SHARE * lambda)), p2: r3(1 - Math.exp(-lambda) * (1 + lambda)), pFirst: null, tier: tdTier(pTd), raw: r3(1 - Math.exp(-stated)),
          rate: r3(rate), l5: tdAvg.l5, season: tdAvg.season, n, touches, carries: r1(carries), targets: r1(targets), prior: r3(prior), own: r3(own),
          teamFactor: teamTd.factor, posShift, shiftRaw: r3(shiftRaw), spot: cell ? { pos: cellPos, rank: cell.rankBlend ?? cell.rank ?? null, value: cell.value ?? null, count: allowed?.count || null } : null,
          actual: gotOf('anytime_td'), actual1h: gotOf('h1_anytime_td'), actualFirst: gotOf('first_td'),
        } : null;
        // Yards.
        const yards = {};
        for (const market of ['pass_yds', 'rush_yds', 'rec_yds', 'receptions']) {
          const range = sp.ranges?.[market];
          if (range?.exp == null || !(range.exp > 0)) continue;
          const stat = { pass_yds: 'passYds', rush_yds: 'rushYds', rec_yds: 'recYds', receptions: 'rec' }[market];
          const c = sp.envPos ? allowed?.rows?.[sp.envPos]?.[stat] : null;
          const sheet = (sp.plays || []).find((x) => x.market === market && x.onSheet) || null;
          const actual = gotOf(market);
          // Tonight: his skill × the matchup (the board's projection) × the game script, his spread scaled with it.
          // A starting quarterback's passing yards: the passing read (PASS), his starts with the line and the defense; a
          // backup on ESPN's chart, or a quarterback without a start in his log, keeps the board's read.
          const pr = market === 'pass_yds' && sp.pos === 'QB' && !qbBackups.has(sp.key)
            ? passRead(logs, { before: g.date, odds: g.odds, team, cell: allowed?.rows?.QB?.passYds || null, league: allowed?.league?.QB?.passYds ?? null, gp: allowed?.rows?.QB?.gp ?? null, held: !!allowed?.rows?.QB?.held }) : null;
          // A starting quarterback's rushing yards: his starts' rushing, pulled toward the league (QB_RUSH), on his own spread.
          const qr = market === 'rush_yds' && sp.pos === 'QB' && !qbBackups.has(sp.key) ? qbRushRead(logs, { before: g.date }) : null;
          const f = pr || qr ? 1 : scriptFactor(script, market);
          const sd = pr ? pr.sd : sp.ladders?.[market]?.[0]?.sd ?? null;
          const proj = pr ? pr.proj : qr ? qr.proj : r1(range.exp * f);
          const sdRaw = sd;
          const spread = sd != null ? sd * f : null;
          const dec = market === 'receptions' ? 1 : 0;
          const round = (v) => (dec ? r1(v) : Math.round(v));
          const [zLo, zHi] = P.RANGE[market] || [RANGE_Z, RANGE_Z];
          const floor = spread != null ? round(Math.max(0, proj - zLo * spread)) : null;
          const ceiling = spread != null ? round(proj + zHi * spread) : null;
          const tiers = ladderTiers({ proj, sd: spread }, market, P.RESID);
          yards[market] = {
            proj, floor, ceiling, tiers,
            hits: actual == null ? null : Object.fromEntries(Object.entries(tiers).filter(([, t]) => t).map(([k, t]) => [k, actual >= t.mark])), sd: sdRaw != null ? r2(sdRaw * f) : null, exp: range.exp, script: f, rate: range.rate ?? null, matchup: pr ? pr.matchup : range.matchup ?? null, matchupFrom: pr ? (pr.def ? 'propfinder' : null) : range.matchupFrom?.from || null,
            qbRush: qr ? { n: qr.n, avg: qr.avg } : null,
            pass: pr ? { own: pr.own, avg: pr.avg, n: pr.n, total: pr.total, fav: pr.fav, def: pr.def, allowed: pr.allowed, league: pr.league, gp: pr.gp } : null,
            line: range.line ?? null, sheetLine: sheet?.line ?? null, actual,
            grade: actual == null || floor == null ? null : actual < floor ? 'under' : actual > ceiling ? 'over' : 'inside',
            spot: c ? { pos: sp.envPos, rank: c.rankBlend ?? c.rank ?? null, value: c.value ?? null, count: allowed?.count || null } : null,
          };
        }
        if (!td && !Object.keys(yards).length) continue;
        // The big games: his chance of 100+ / 150+ (300+ / 350+ passing) with the context each model reads.
        const ctx = { points: impliedPoints(g.odds, team), total: Number(g.odds?.total) > 0 ? Number(g.odds.total) : null, tgtShare: tgtShareOf(pfp) };
        const big = {};
        for (const [market, spec] of Object.entries(BIG)) {
          const y = yards[market];
          if (!y || !spec.pos.includes(sp.pos)) continue;
          const marks = Object.keys(spec.marks).map(Number);
          const ps = Object.fromEntries(marks.map((mk) => [mk, bigChance(y, market, mk, ctx)]));
          if (ps[marks[0]] == null) continue;
          big[market] = { marks, p: ps, proj: y.proj, ctx: { points: ctx.points, total: ctx.total, tgtShare: ctx.tgtShare }, actual: y.actual ?? null, hits: y.actual == null ? null : Object.fromEntries(marks.map((mk) => [mk, y.actual >= mk])) };
        }
        const row = {
          id: `${sp.key}|${team}`, player: sp.player, key: sp.key, espnId: sp.espnId || got?.espnId || null, team, opp, venue: side.venue, pos: sp.pos, slot: sp.slot || null, depth: sp.depth || null,
          game: g.id, start: g.date || null, final: !!g.final, health: sp.health || null, injury: sp.injury || null,
          onSheet: (sp.plays || []).some((x) => x.onSheet), role: roleOf(sp, ['rushAtt', 'tgt', 'recYds', 'rushYds'], posOf), td, yards, big,
        };
        rows.push(row); all.push(row);
      }
      // One quarterback a team: the starter on ESPN's depth chart (the feed's `depth`, read with the injuries); the rest are backups, off the lists.
      markQuarterbacks(rows, pf?.espnDepth?.[team]?.qb || null, (side.players || []).filter((x) => x.pos === 'QB' && !x.out));
      // The defense's weak spots (the cheat sheet's snapshot) with the players they open up on this side: the pass → the
      // quarterback, the run → the lead back, the outside zones → WR1 / WR2, the middle → the tight end and the slot.
      const def = sheetDefense?.teams?.[opp] || null;
      const attack = def ? def.weak.slice(0, ATTACK_MAX).map((w) => {
        const recBy = (ok) => rows.filter((r) => r.yards.rec_yds && ok(r)).sort((a, b) => b.yards.rec_yds.proj - a.yards.rec_yds.proj);
        const outside = (r) => r.pos === 'WR' && (!r.slot || /^WR[12]$/.test(r.slot));
        const middle = (r) => r.pos === 'TE' || r.slot === 'WR3';
        const list = w.key === 'passYds' ? rows.filter((r) => r.yards.pass_yds && !r.backup).sort((a, b) => b.yards.pass_yds.proj - a.yards.pass_yds.proj).slice(0, 1)
          : w.key === 'rushYds' || w.key === 'rushYpp' ? rows.filter((r) => r.yards.rush_yds && r.pos === 'RB').sort((a, b) => b.yards.rush_yds.proj - a.yards.rush_yds.proj).slice(0, 1)
            : /M$/.test(w.key) ? recBy(middle).slice(0, 2)
              : w.key.startsWith('short') ? recBy((r) => outside(r) || r.pos === 'RB').slice(0, 2) : recBy(outside).slice(0, 2);
        return { ...w, ids: list.map((r) => r.id) };
      }) : [];
      teams[team] = {
        team, opp, venue: side.venue, teamTd, script,
        // The defense it faces as the cheat sheet's snapshot reads it (lib/nfl/snapshot.js): its weak and strong spots.
        defense: def ? { of: opp, weak: def.weak, strong: def.strong, style: def.style, coverage: def.coverage, printed: def.printed, attack } : null,
      };
    }
    const mine = all.filter((r) => r.game === g.id);
    // The first touchdown of the game: his expected touchdowns over the game's (the book's total × TD_PER_POINT, the
    // defenses' and the return units' FIRST_OTHER on top; the listed players' own sum without a total), × the chance the
    // game has one. The listed players' sum runs high: it counts every backup with a log, and they do not all play.
    const sumLambda = mine.reduce((s, r) => s + (r.backup ? 0 : r.td?.lambda || 0), 0);
    const total = Number(g.odds?.total);
    const gameLambda = (total > 0 ? total * P.TD_PER_POINT : sumLambda) / (1 - P.FIRST_OTHER);
    for (const r of mine) if (r.td && gameLambda > 0) r.td.pFirst = r3((r.td.lambda / gameLambda) * (1 - Math.exp(-gameLambda)));
    games.push({ id: g.id, away: g.away, home: g.home, date: g.date || null, final: !!g.final, state: g.state || null, awayScore: g.awayScore ?? null, homeScore: g.homeScore ?? null, odds: g.odds || null, teams, lists: listsOf(mine) });
  }
  const lists = listsOf(all);
  return {
    rows: Object.fromEntries(all.map((r) => [r.id, r])),
    games,
    lists,
    perTouch,
    sheetDirection: sheetDefense?.direction || null,
    constants: { ...P, TD_TIERS },
  };
}

/** A minimum projection before a player is on the yards lists (a fullback's 4 yards is noise). */
export const LIST_YDS_MIN = 10;
export const LIST_PASS_MIN = 100;
/** A big-game chance under this is no candidate on the Big games tab. */
export const BIG_LIST_MIN = 0.05;
/**
 * The three lists of the Matchups tab and the slate tabs (Vincent, 2026-11-01): touchdowns (every skill player from
 * LIST_TD_MIN, the likeliest first), receiving (receivers, tight ends and backs, the projected yards first) and rushing
 * (backs and quarterbacks, the projected yards first), passing (quarterbacks). { td, receiving, rushing, passing } of row ids.
 */
export function listsOf(all) {
  // A backup quarterback (markQuarterbacks: not the starter on ESPN's depth chart) is on no list; his card stays searchable.
  const rows = all.filter((r) => !r.backup);
  const ids = (list) => list.map((r) => r.id);
  const by = (market) => (a, b) => b.yards[market].proj - a.yards[market].proj || a.player.localeCompare(b.player);
  return {
    td: ids(rows.filter((r) => r.td && r.td.p >= LIST_TD_MIN).sort((a, b) => b.td.p - a.td.p || a.player.localeCompare(b.player))),
    receiving: ids(rows.filter((r) => ['WR', 'TE', 'RB'].includes(r.pos) && r.yards.rec_yds?.proj >= LIST_YDS_MIN).sort(by('rec_yds'))),
    rushing: ids(rows.filter((r) => ['RB', 'QB'].includes(r.pos) && r.yards.rush_yds?.proj >= LIST_YDS_MIN).sort(by('rush_yds'))),
    // Quarterbacks projected LIST_PASS_MIN passing yards and up (a backup's garbage-time 40 is no list).
    passing: ids(rows.filter((r) => r.pos === 'QB' && r.yards.pass_yds?.proj >= LIST_PASS_MIN).sort(by('pass_yds'))),
    // The big games: every read from BIG_LIST_MIN at the first mark, the likeliest first.
    big: Object.fromEntries(Object.keys(BIG).map((market) => {
      const first = (r) => r.big?.[market]?.p?.[r.big[market].marks[0]] ?? 0;
      return [market, ids(rows.filter((r) => first(r) >= BIG_LIST_MIN).sort((a, b) => first(b) - first(a) || a.player.localeCompare(b.player)))];
    })),
  };
}

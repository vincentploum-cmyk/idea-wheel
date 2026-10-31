// The pure half of tonight's picks (lib/nhl-data/picks.js): the fitted rates, the blend, the
// projection, the game-level selection and the notes. No storage imports, so the panel can
// use the odds helper in the browser.
import { memoByRows } from '../memo';

// Poisson log-rates on log features, fitted on 2024-25 + 2025-26 (92,490 skater-games,
// tools/predictors/replay.py, docs/shots-goals-predictors.md section 13). Shots: the skater's
// rate and attempts, his TOI (last five games), home ice, what the opponent allows per skater at
// his position, back-to-back. Goals: his goals, chances and shots, home ice, the opponent's goals
// allowed per skater at his position, back-to-back. The fit read his rates and the opponent's
// table through the study's blends into last season; since 2026-10-27 (Vincent's call, twice over)
// the board reads this season's rate (`blendRates`, from his fifth game) and this season's table
// (`positionAllowed`); the blends stay in the study doc and in no number.
export const SHOTS_FIT = { const: -1.4391, sog: 0.3923, icf: 0.4484, toi: 0.297, home: 0.0341, pos: 0.6869, b2b: -0.026 };
export const GOALS_FIT = { const: -1.0539, g: 0.3735, iscf: 0.4356, sog: 0.4007, home: 0.0682, pos: 0.4448, b2b: -0.0677 };
export const SHOTS_FLOOR = 0.5;   // list every skater at or above P(3+ SOG) = 50%
export const GOALS_FLOOR = 0.35;  // and P(1+ goal) = 35%
export const MIN_ROWS = 3;        // never fewer than three a table (the fill-ins are marked as under the floor)
export const MAX_ROWS = 4;        // and never more than four: the rest go to the "next" line
const BASE_MIN_GAMES = 10;        // last season's regular season stands in from this many games, until his fifth this season
const ALONE_MIN_GAMES = 5;        // this season's rate alone from this many games
const POS = ['C', 'LW', 'RW', 'D'];
// League figures per skater-game by position (2025-26), the read for an opponent with no record at all.
export const LEAGUE_POS = { C: { sog: 1.73, g: 0.23 }, LW: { sog: 1.63, g: 0.21 }, RW: { sog: 1.69, g: 0.215 }, D: { sog: 1.27, g: 0.077 } };

const r2 = (v) => +v.toFixed(2);
const r3 = (v) => +v.toFixed(3);
const lg = (v) => Math.log(Math.max(v, 0.05));
const mean = (xs, k) => (xs.length ? xs.reduce((s, r) => s + (Number(r[k]) || 0), 0) / xs.length : 0);

/** The season (start year) a date belongs to: seasons run July to June. */
export function seasonYearOf(date) {
  const y = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 7 ? y : y - 1;
}

/** P(X >= k) for a Poisson rate. */
export function poissonAtLeast(lambda, k) {
  let term = Math.exp(-lambda);
  let below = 0;
  for (let i = 0; i < k; i++) { below += term; term *= lambda / (i + 1); }
  return Math.max(0, Math.min(1, 1 - below));
}

/** The break-even price for a probability, as American odds ("-212", "+134"). */
export function fairOdds(p) {
  if (!(p > 0) || p >= 1) return '—';
  return p >= 0.5 ? `-${Math.round((100 * p) / (1 - p))}` : `+${Math.round((100 * (1 - p)) / p)}`;
}

/**
 * A skater's rates (the name kept for the callers): `cur` = his stored games this season (date
 * order), `prev` = last season's regular season. This season's alone from his fifth game
 * (`ALONE_MIN_GAMES`; Vincent's call, 2026-10-27: this season's rate, no blend — the study's
 * n / (n + 18), n / (n + 40) shrinkage stays in docs/shots-goals-predictors.md section 3 and in no
 * number); under five games last season's stands in when it has 10+ (`held: true`); null without
 * either. `toiL5` is his last five games this season (his rate's TOI before he has one).
 */
export function blendRates(cur, prev) {
  const n = cur.length;
  const hasBase = prev.length >= BASE_MIN_GAMES;
  if (!hasBase && n < ALONE_MIN_GAMES) return null;
  const held = n < ALONE_MIN_GAMES;
  const read = (k) => mean(held ? prev : cur, k);
  const toi = read('toi');
  return {
    n, base: hasBase ? prev.length : 0, held,
    sog: read('sog'), icf: read('icf'), g: read('g'), iscf: read('iscf'),
    toi, toiL5: n ? mean(cur.slice(-5), 'toi') : toi,
    curSog: n ? mean(cur, 'sog') : null, curG: n ? mean(cur, 'g') : null,
    baseSog: hasBase ? mean(prev, 'sog') : null, baseG: hasBase ? mean(prev, 'g') : null,
  };
}

// A hot start regresses within the season: his goal rate goes into the goals read shrunk toward the
// league's at his position at n / (n + 8), this season's games only (never last season's; a rate
// standing in from last season, `held`, is not shrunk). Replay of 2026-10-27 (tools/predictors
// rows, the formula on raw this-season rates): skaters at 0.6+ goals a game going in were said
// .395 and hit .311 over 2025-26 (.394 / .345 this season); at k = 8 said .366 / .349, and the
// Brier improves on both seasons; up to 40% the raw read was already what happened.
export const GOAL_RATE_SHRINK = 8;

/**
 * The projection for one skater: Poisson rates and the market probabilities. `oppPos` is what
 * the opponent allows per skater at his position (`positionAllowed(...).read(opp, pos)`: `sog`
 * and `g`, this season's table); without one the league figure for the position stands in.
 */
export function project(rates, { home, oppPos = null, pos = 'C', b2b = false }) {
  const league = LEAGUE_POS[pos] || LEAGUE_POS.C;
  const posSog = oppPos?.sog ?? league.sog; const posG = oppPos?.g ?? league.g;
  const h = home ? 1 : 0; const b = b2b ? 1 : 0;
  const n = rates.n ?? 0; const wG = rates.held || !(n > 0) ? 1 : n / (n + GOAL_RATE_SHRINK);
  const gRate = wG * Math.max(rates.g, 0) + (1 - wG) * league.g;
  const lamS = Math.exp(SHOTS_FIT.const + SHOTS_FIT.sog * lg(rates.sog) + SHOTS_FIT.icf * lg(rates.icf) + SHOTS_FIT.toi * lg(rates.toiL5 ?? rates.toi) + SHOTS_FIT.home * h + SHOTS_FIT.pos * lg(posSog) + SHOTS_FIT.b2b * b);
  const lamG = Math.exp(GOALS_FIT.const + GOALS_FIT.g * Math.log(gRate + 0.05) + GOALS_FIT.iscf * lg(rates.iscf) + GOALS_FIT.sog * lg(rates.sog) + GOALS_FIT.home * h + GOALS_FIT.pos * Math.log(Math.max(posG, 0) + 0.1) + GOALS_FIT.b2b * b);
  return {
    lamS: r2(lamS), lamG: r2(lamG),
    p2: r2(poissonAtLeast(lamS, 2)), p3: r2(poissonAtLeast(lamS, 3)), p4: r2(poissonAtLeast(lamS, 4)),
    p1g: r2(1 - Math.exp(-lamG)),
  };
}

/**
 * The market numbers from the model's saved run for a skater (`m` is the slate's model row:
 * λ shots / goals and its 2+ / 3+ / 4+ SOG and 1+ goal probabilities), with the study's
 * projection kept beside it as `study`. Null when the run has no shots rate for him. A
 * probability the run did not carry is read off its λ. The λ keep the run's three decimals, so
 * the shuffle's Poisson tail at 1+ is the run's own 1+ G figure (rounded to two, a 0.564 λ goals
 * read 42.9% against the Model tab's 43.1%). `lamGOpp` is the run's goal λ with the opponent in
 * it (`goalOpportunityLambda`, `gOpp` on the slate's model row); no board number reads it — the
 * shuffle's "Model · matchup" read and the scorecard grade it against `lamG`.
 */
export function fromModel(m, study = null) {
  if (!m || !(m.sog > 0)) return null;
  const lamS = m.sog; const lamG = m.g > 0 ? m.g : 0;
  // The run's 3+ and 4+ when they hang together (3+ ≥ 4+); an inverted pair is read off the λ.
  // The run carries no 2+ figure: it is read off the λ and never shown below the 3+.
  const p3r = m.p3s == null ? null : Number(m.p3s); const p4r = m.p4s == null ? null : Number(m.p4s);
  const sound = Number.isFinite(p3r) && Number.isFinite(p4r) && p3r >= p4r;
  const [p3, p4] = sound ? [p3r, p4r] : [3, 4].map((k) => poissonAtLeast(lamS, k));
  const p2 = Math.max(p3, m.p2s != null && Number.isFinite(Number(m.p2s)) ? Number(m.p2s) : poissonAtLeast(lamS, 2));
  return {
    lamS: r3(lamS), lamG: r3(lamG),
    p2: r2(p2), p3: r2(p3), p4: r2(p4), ladder: sound ? 'run' : 'lambda',
    p1g: r2(m.p1g ?? (1 - Math.exp(-lamG))),
    lamGOpp: m.gOpp > 0 ? r3(m.gOpp) : null,
    study: study ? { lamS: study.lamS, p3: study.p3, p4: study.p4, p1g: study.p1g } : null,
  };
}

/**
 * Form going into the game, for the board's flame / snowflake (colour only: the study found no
 * carry-over from a streak once the rate is in, so nothing here touches a number). `cur` / `prev`
 * are his stored games this season and last (date order); the last five run across the season
 * boundary. Shots: his last five against his blended rate (hot at 1.4×, cold at 0.7×, five games
 * needed). Goals: hot at 3+ in his last five; cold = no goal in his last ten when his rate says he
 * should have one and a half (a 0.07 defenseman is never "cold"). Null without games or rates.
 */
export const FORM = { hotShots: 1.4, coldShots: 0.7, hotGoals: 3, coldGoalsGames: 10, coldGoalsExpected: 1.5 };
export function formOf(cur, prev, rates) {
  const hist = [...(prev || []), ...(cur || [])];
  if (!hist.length || !rates) return null;
  const l5 = hist.slice(-5); const l10 = hist.slice(-FORM.coldGoalsGames);
  const sogL5 = mean(l5, 'sog'); const gL5 = l5.reduce((t, r) => t + (Number(r.g) || 0), 0); const gL10 = l10.reduce((t, r) => t + (Number(r.g) || 0), 0);
  const ratio = l5.length >= 5 && rates.sog > 0 ? sogL5 / rates.sog : null;
  const tenGames = l10.length >= FORM.coldGoalsGames;
  return {
    games: l5.length, sogL5: r2(sogL5), sogRatio: ratio == null ? null : r2(ratio), gL5, gL10: tenGames ? gL10 : null,
    hotS: ratio != null && ratio >= FORM.hotShots, coldS: ratio != null && ratio <= FORM.coldShots,
    hotG: gL5 >= FORM.hotGoals, coldG: tenGames && gL10 === 0 && rates.g * FORM.coldGoalsGames >= FORM.coldGoalsExpected,
  };
}

/** The soft third of a ranked table (rank 1 = allows the most): the Defense tab's green. */
export function isSoftThird(rank, teams) {
  return !!rank && !!teams && rank <= Math.ceil(teams / 3);
}

/**
 * The study's share in the board's shots as the server env sets it: `NHL_PICKS_STUDY_WEIGHT` (0 < w ≤ 1; 0.5 = half
 * model λ, half study λ), 0 when unset. Since 2026-10-31 the board no longer waits for this: the share is learned from
 * the graded nights (`learnWeights` in board-weights-pure.js, `boardWeightsOf` reads the env over the verdict); this
 * stays as the override's reader.
 */
export function studyWeight(env = process.env) {
  const w = Number(env.NHL_PICKS_STUDY_WEIGHT);
  return Number.isFinite(w) && w > 0 ? Math.min(1, w) : 0;
}

/**
 * The study's share in the board's goals as the server env sets it: `NHL_PICKS_STUDY_WEIGHT_GOALS` (0 … 1, 0 = the
 * run's goal λ back), else 1. Since 2026-10-27 the goals read the study's λ — his goal rate, chances and shots this
 * season, home ice, the opponent's row at his position — because the run's published goal λ is built from his points
 * rate: Connor on nine goals in eleven games read 28%, Reinhart fell from 28% to 21% on the same goal rate as his
 * assists dropped (Vincent's call). Since 2026-10-31 the share is learned from the graded nights (board-weights-pure.js),
 * the env over it when set; this stays as the override's reader.
 */
export function studyWeightGoals(env = process.env) {
  const w = Number(env.NHL_PICKS_STUDY_WEIGHT_GOALS);
  return Number.isFinite(w) && w >= 0 ? Math.min(1, w) : 1;
}

/**
 * The model's projection blended with the study's: λ shots = (1 − w) × model + w × study, λ goals
 * the same at `wG` (the study's share per market, 0 … 1; `wG` defaults to `w`). A market at share 0
 * keeps the run's λ and odds; one over 0 takes the Poisson tails of the blended λ. Since 2026-10-27
 * the board's goals read the study's λ alone (`studyWeightGoals` in picks.js; Vincent's call: the
 * run's published goal λ is built from his points rate, so Connor on nine goals in eleven games
 * read 28% and Reinhart fell with his assists). The run's row back when there is nothing to blend.
 * The model's and the study's own figures ride along as `model` and `study`. Returns `proj`
 * unchanged when either side is missing or `w` is 0.
 */
export function blendProjection(proj, study, w, wG = w) {
  const kS = Math.min(1, Math.max(0, Number(w) || 0));
  const kG = Math.min(1, Math.max(0, Number(wG) || 0));
  if (!proj || !study || !(proj.lamS > 0) || !(study.lamS > 0) || (!(kS > 0) && !(kG > 0))) return proj;
  const lamS = (1 - kS) * proj.lamS + kS * study.lamS;
  const lamG = (1 - kG) * (proj.lamG || 0) + kG * (study.lamG || 0);
  const shots = kS > 0 ? { lamS: r2(lamS), p2: r2(poissonAtLeast(lamS, 2)), p3: r2(poissonAtLeast(lamS, 3)), p4: r2(poissonAtLeast(lamS, 4)), ladder: 'blend' } : {};
  const goals = kG > 0 ? { lamG: r3(lamG), p1g: r2(1 - Math.exp(-lamG)) } : {};
  return {
    ...proj, ...shots, ...goals,
    blend: kS, blendG: kG,
    model: { lamS: proj.lamS, lamG: proj.lamG, p3: proj.p3, p4: proj.p4, p1g: proj.p1g },
    study: { lamS: study.lamS, lamG: study.lamG, p3: study.p3, p4: study.p4, p1g: study.p1g },
  };
}

/**
 * What each team allows per skater at each position, this season (Vincent's call, 2026-10-27: the
 * teams on the ice are this season's; the blend into last season's table the study fitted,
 * games / (games + 15) for shots and games / (games + 40) for goals, stays on record in
 * docs/shots-goals-predictors.md sections 13 and 15 and in no number). Last season's regular season
 * stands in only for a team with no game yet this season (`held: true`). `read(opp, pos)` gives
 * { sog, g, games, prevGames, curSog, curG, prevSog, prevG, held, rankSog, rankG } (rank 1 = allows
 * the most to that position, among the teams with a figure), or null for a team with no record at all.
 */
export function positionAllowed(cur, prev) {
  const tally = (rows) => {
    const t = {};
    for (const r of rows) {
      if (!r.opp || !POS.includes(r.pos) || !r.gameId) continue;
      const k = (t[r.opp] = t[r.opp] || {}); const p = (k[r.pos] = k[r.pos] || { sog: 0, g: 0, n: 0, games: new Set() });
      p.sog += Number(r.sog) || 0; p.g += Number(r.g) || 0; p.n += 1; p.games.add(r.gameId);
    }
    return t;
  };
  const tc = tally(cur); const tp = tally(prev);
  const teams = {};
  for (const abbr of new Set([...Object.keys(tc), ...Object.keys(tp)])) {
    teams[abbr] = {};
    for (const pos of POS) {
      const c = tc[abbr]?.[pos]; const p = tp[abbr]?.[pos];
      const games = c ? c.games.size : 0; const prevGames = p ? p.games.size : 0;
      const curSog = c && c.n ? c.sog / c.n : null; const curG = c && c.n ? c.g / c.n : null;
      const prevSog = p && p.n && prevGames >= BASE_MIN_GAMES ? p.sog / p.n : null; const prevG = p && p.n && prevGames >= BASE_MIN_GAMES ? p.g / p.n : null;
      if (curSog == null && prevSog == null) continue;
      const held = curSog == null;   // no game yet this season: last season's regular season stands in
      teams[abbr][pos] = { games, prevGames, curSog: curSog == null ? null : r2(curSog), curG: curG == null ? null : r2(curG), prevSog: prevSog == null ? null : r2(prevSog), prevG: prevG == null ? null : r2(prevG), held,
        sog: r2(held ? prevSog : curSog), g: +(held ? prevG : curG).toFixed(3) };
    }
  }
  for (const pos of POS) {
    const list = Object.keys(teams).filter((a) => teams[a][pos]);
    list.sort((a, b) => teams[b][pos].sog - teams[a][pos].sog).forEach((a, i) => { teams[a][pos].rankSog = i + 1; });
    list.sort((a, b) => teams[b][pos].g - teams[a][pos].g).forEach((a, i) => { teams[a][pos].rankG = i + 1; });
  }
  return { teams, teamCount: Object.keys(teams).length, read: (opp, pos) => teams[opp]?.[pos] || null };
}

/**
 * The rows split by season for the boards' reads: this season's and last season's games per
 * player (`cur` / `prev`: skaters with an id at the four positions), the same as flat lists,
 * each team's latest stored game date this season (the back-to-back read) and the two tables
 * over them (shotsAllowed, positionAllowed). Kept per rows array: the slate, the picks and
 * the first-goal board read it off the same loadRows() result, so it is built once a store state.
 */
export function seasonSplit(rows, season) {
  return memoByRows(rows, `split|${season}`, () => {
    const cur = {}; const prev = {}; const curRows = []; const prevRows = []; const lastGame = {};
    for (const r of rows) {
      if (r.playerId == null || !POS.includes(r.pos)) continue;
      const thisSeason = seasonYearOf(r.date) === season;
      ((thisSeason ? cur : prev)[r.playerId] ||= []).push(r);
      (thisSeason ? curRows : prevRows).push(r);
      if (thisSeason && r.team && (!lastGame[r.team] || r.date > lastGame[r.team])) lastGame[r.team] = r.date;
    }
    return { cur, prev, curRows, prevRows, lastGame, allowed: shotsAllowed(curRows), posAllowed: positionAllowed(curRows, prevRows) };
  });
}

/** The teams playing their second game in two days on `date`: `lastGame` maps team → its latest stored game date before `date`. */
export function isBackToBack(lastGame, team, date) {
  const last = lastGame[team];
  if (!last) return false;
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1);
  return last === d.toISOString().slice(0, 10);
}

/** What each team has allowed a game this season: { ABBR: { games, sog } } and ranks (1 = allows the most). */
export function shotsAllowed(rows) {
  const perGame = {};
  for (const r of rows) {
    if (!r.opp || !r.gameId) continue;
    const t = (perGame[r.opp] = perGame[r.opp] || {});
    t[r.gameId] = (t[r.gameId] || 0) + (Number(r.sog) || 0);
  }
  const teams = {};
  for (const [abbr, games] of Object.entries(perGame)) {
    const list = Object.values(games);
    teams[abbr] = { games: list.length, sog: r2(list.reduce((s, v) => s + v, 0) / list.length) };
  }
  const sorted = Object.keys(teams).sort((a, b) => teams[b].sog - teams[a].sog);
  sorted.forEach((abbr, i) => { teams[abbr].rank = i + 1; });
  const league = sorted.length ? r2(sorted.reduce((s, a) => s + teams[a].sog, 0) / sorted.length) : null;
  return { teams, league, teamCount: sorted.length };
}

/**
 * The picks for one game from its projected skaters: everyone over the floor up to four,
 * filled to at least three with the next best (marked `under`), then the next three after those.
 * `shotsFallback` / `goalsFallback` say nobody cleared the floor.
 */
export function pickGame(cands) {
  const byShots = [...cands].sort((a, b) => b.p3 - a.p3 || b.lamS - a.lamS);
  const byGoals = [...cands].sort((a, b) => b.p1g - a.p1g || b.lamG - a.lamG);
  const over = (list, key, floor) => list.filter((c) => c[key] >= floor).length;
  const take = (list, key, floor) => list.slice(0, Math.min(MAX_ROWS, Math.max(MIN_ROWS, over(list, key, floor)))).map((c) => ({ ...c, under: c[key] < floor }));
  const shots = take(byShots, 'p3', SHOTS_FLOOR);
  const goals = take(byGoals, 'p1g', GOALS_FLOOR);
  return {
    shots, shotsFallback: !over(byShots, 'p3', SHOTS_FLOOR), nextShots: byShots.slice(shots.length, shots.length + 3),
    goals, goalsFallback: !over(byGoals, 'p1g', GOALS_FLOOR), nextGoals: byGoals.slice(goals.length, goals.length + 3),
  };
}

const last = (name) => String(name || '').split(' ').slice(-1)[0];
const join = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
const pct = (v) => `${Math.round(v * 100)}%`;

/** The notes under the list, written from the picks themselves. */
export function notesFor(games, allowed, lineups) {
  const notes = [];
  const n = allowed.teamCount || 32;
  // The softest spots: the three opponents allowing the most shots a game (rank 1 = the most, as every
  // table on the site ranks), and who gets them. `allowed.source` names the table (PropFinder's All row
  // on the tab the rink opens on, or the stored team totals).
  const soft = [];
  const from = allowed.source === 'propfinder' ? ', PropFinder’s table' : '';
  for (const g of games) {
    for (const abbr of [g.away, g.home]) {
      const t = allowed.teams[abbr];
      if (!t || !(t.rank >= 1 && t.rank <= 3)) continue;
      const beneficiaries = g.shots.filter((c) => c.opp === abbr).map((c) => last(c.name));
      soft.push(`${abbr} has allowed ${t.rank === 1 ? 'the most shots in the league' : `the ${t.rank === 2 ? 'second' : 'third'} most shots`} so far (${t.sog} a game, #${t.rank} of ${n}${from})${beneficiaries.length ? `: ${join(beneficiaries)} get${beneficiaries.length === 1 ? 's' : ''} that matchup` : ''}.`);
    }
  }
  if (soft.length) notes.push({ kind: 'soft', text: `${soft.length === 1 ? 'The softest spot on the board' : 'The softest spots on the board'}. ${soft.join(' ')}` });
  // The richest game: most shooters over 55% and scorers over 40%.
  const rich = games.map((g) => ({ g, k: g.shots.filter((c) => c.p3 >= 0.55).length + g.goals.filter((c) => c.p1g >= 0.4).length })).sort((a, b) => b.k - a.k)[0];
  if (rich && rich.k >= 4) {
    const s = rich.g.shots.filter((c) => c.p3 >= 0.55).length; const go = rich.g.goals.filter((c) => c.p1g >= 0.4).length;
    notes.push({ kind: 'rich', text: `${rich.g.away} @ ${rich.g.home} is the richest game: ${s} shooter${s === 1 ? '' : 's'} over 55% for 3+ and ${go} scorer${go === 1 ? '' : 's'} over 40%.` });
  }
  // Environment plays: a modest shooter who clears the floor because the opponent leaks.
  for (const g of games) {
    const env = g.shots.filter((c) => !c.under && c.rates && c.rates.sog < 2.75 && c.oppRank <= 5);
    if (env.length) notes.push({ kind: 'env', text: `${join(env.map((c) => last(c.name)))} ${env.length === 1 ? 'is an environment play' : 'are environment plays'}: ${env[0].opp} allows the ${env[0].oppRank === 1 ? 'most' : `#${env[0].oppRank} most`} shots in the league, and ${env.length === 1 ? 'he is' : 'each is'} about a coin flip at 3+ with that lift, not a volume shooter.` });
  }
  // Near-ties: take the better price.
  const ties = [];
  for (const g of games) {
    for (const [all, key] of [[g.shots, 'p3'], [g.goals, 'p1g']]) {
      const list = all.filter((c) => !c.under);
      for (let i = 0; i + 1 < list.length; i++) if (list[i][key] - list[i + 1][key] <= 0.02) ties.push(`${last(list[i].name)} and ${last(list[i + 1].name)} (${key === 'p3' ? '3+ shots' : '1+ goal'})`);
    }
  }
  if (ties.length) notes.push({ kind: 'tie', text: `Near-ties, take whichever price is better: ${join(ties)}.` });
  // Games with nothing over either floor.
  const thin = games.filter((g) => g.shotsFallback && g.goalsFallback);
  if (thin.length) notes.push({ kind: 'thin', text: `${join(thin.map((g) => `${g.away} @ ${g.home}`))} ${thin.length === 1 ? 'has' : 'have'} no real pick either way: nobody is over ${pct(SHOTS_FLOOR)} for 3+ shots or ${pct(GOALS_FLOOR)} for a goal, so the rows there are the best available.` });
  // Where the lineups came from.
  if (lineups) {
    const parts = [];
    if (lineups.gamedaytweets) parts.push(`beat writers' lines for ${lineups.gamedaytweets}`);
    if (lineups.lineup) parts.push(`NHL.com for ${lineups.lineup}`);
    if (lineups.propfinder) parts.push(`PropFinder's depth chart for ${lineups.propfinder}`);
    if (lineups.roster) parts.push(`the roster for ${lineups.roster}`);
    notes.push({ kind: 'lineups', text: `Lineups: ${parts.join(', ')} of ${lineups.total} teams${lineups.carried ? `, with ${lineups.carried} slot${lineups.carried === 1 ? '' : 's'} carried from an earlier game` : ''}. Check scratches before puck drop.` });
  }
  return notes;
}


/**
 * Finished game: each candidate gets his box-score shots and goals (`actual`, matched by player
 * id on the game's stored skater rows), or `actual: null` when he has no row (did not play).
 * Before the game `actual` is left undefined, so the board can tell "not graded" from "DNP".
 */
export function withActuals(cands, logSkaters) {
  if (!Array.isArray(logSkaters)) return cands;
  const by = {};
  for (const s of logSkaters) if (s.id != null) by[s.id] = { sog: Number(s.sog) || 0, g: Number(s.g) || 0 };
  return cands.map((c) => ({ ...c, actual: by[c.id] || null }));
}

/** true / false once the box score is in (hit when the skater reached `min` of `stat`), null before it or without a row. */
export function hitOf(c, stat, min) {
  return c?.actual ? (c.actual[stat] ?? 0) >= min : null;
}

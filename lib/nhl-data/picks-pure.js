// The pure half of tonight's picks (lib/nhl-data/picks.js): the fitted rates, the blend, the
// projection, the game-level selection and the notes. No storage imports, so the panel can
// use the odds helper in the browser.

// Poisson log-rates on log features, fitted on 2024-25 + 2025-26 (92,490 skater-games,
// tools/predictors/replay.py, docs/shots-goals-predictors.md section 13). Shots: the skater's
// blended rate and attempts, his TOI (last five games), home ice, what the opponent allows
// per skater at his position (this season blended into last season's), back-to-back. Goals:
// his blended goals, chances and shots, home ice, the opponent's goals allowed per skater at
// his position (blended), back-to-back.
export const SHOTS_FIT = { const: -1.4391, sog: 0.3923, icf: 0.4484, toi: 0.297, home: 0.0341, pos: 0.6869, b2b: -0.026 };
export const GOALS_FIT = { const: -1.0539, g: 0.3735, iscf: 0.4356, sog: 0.4007, home: 0.0682, pos: 0.4448, b2b: -0.0677 };
export const SHOTS_FLOOR = 0.5;   // list every skater at or above P(3+ SOG) = 50%
export const GOALS_FLOOR = 0.35;  // and P(1+ goal) = 35%
export const MIN_ROWS = 3;        // never fewer than three a table (the fill-ins are marked as under the floor)
export const MAX_ROWS = 4;        // and never more than four: the rest go to the "next" line
const PRIOR_GAMES = { sog: 18, g: 40, toi: 5 };   // this season earns weight n / (n + k) over last season's base
const OPP_PRIOR = { sog: 15, g: 40 };            // the opponent's season-to-date table likewise, over last season's
const BASE_MIN_GAMES = 10;        // last season counts as a base from this many games
const ALONE_MIN_GAMES = 5;        // without one, this season alone from this many
const POS = ['C', 'LW', 'RW', 'D'];
// League figures per skater-game by position (2025-26), the read for an opponent with no record at all.
export const LEAGUE_POS = { C: { sog: 1.73, g: 0.23 }, LW: { sog: 1.63, g: 0.21 }, RW: { sog: 1.69, g: 0.215 }, D: { sog: 1.27, g: 0.077 } };

const r2 = (v) => +v.toFixed(2);
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
 * A skater's blended rates: `cur` = his stored games this season (date order), `prev` = last
 * season's. Null when he has no base (under 10 games last season and under 5 this season).
 * `toi` blends at n / (n + 5); `toiL5` is his last five games this season (the blend before he has one).
 */
export function blendRates(cur, prev) {
  const n = cur.length;
  const hasBase = prev.length >= BASE_MIN_GAMES;
  if (!hasBase && n < ALONE_MIN_GAMES) return null;
  const blend = (k, prior) => {
    const w = hasBase ? n / (n + prior) : 1;
    return w * mean(cur, k) + (1 - w) * (hasBase ? mean(prev, k) : 0);
  };
  const toi = blend('toi', PRIOR_GAMES.toi);
  return {
    n, base: hasBase ? prev.length : 0,
    sog: blend('sog', PRIOR_GAMES.sog), icf: blend('icf', PRIOR_GAMES.sog),
    g: blend('g', PRIOR_GAMES.g), iscf: blend('iscf', PRIOR_GAMES.g),
    toi, toiL5: n ? mean(cur.slice(-5), 'toi') : toi,
    curSog: n ? mean(cur, 'sog') : null, curG: n ? mean(cur, 'g') : null,
    baseSog: hasBase ? mean(prev, 'sog') : null, baseG: hasBase ? mean(prev, 'g') : null,
  };
}

/**
 * The projection for one skater: Poisson rates and the market probabilities. `oppPos` is what
 * the opponent allows per skater at his position (`positionAllowed(...).read(opp, pos)`: `sog`
 * and `g`, blended across the seasons); without one the league figure for the position stands in.
 */
export function project(rates, { home, oppPos = null, pos = 'C', b2b = false }) {
  const league = LEAGUE_POS[pos] || LEAGUE_POS.C;
  const posSog = oppPos?.sog ?? league.sog; const posG = oppPos?.g ?? league.g;
  const h = home ? 1 : 0; const b = b2b ? 1 : 0;
  const lamS = Math.exp(SHOTS_FIT.const + SHOTS_FIT.sog * lg(rates.sog) + SHOTS_FIT.icf * lg(rates.icf) + SHOTS_FIT.toi * lg(rates.toiL5 ?? rates.toi) + SHOTS_FIT.home * h + SHOTS_FIT.pos * lg(posSog) + SHOTS_FIT.b2b * b);
  const lamG = Math.exp(GOALS_FIT.const + GOALS_FIT.g * Math.log(Math.max(rates.g, 0) + 0.05) + GOALS_FIT.iscf * lg(rates.iscf) + GOALS_FIT.sog * lg(rates.sog) + GOALS_FIT.home * h + GOALS_FIT.pos * Math.log(Math.max(posG, 0) + 0.1) + GOALS_FIT.b2b * b);
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
 * probability the run did not carry is read off its λ.
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
    lamS: r2(lamS), lamG: r2(lamG),
    p2: r2(p2), p3: r2(p3), p4: r2(p4), ladder: sound ? 'run' : 'lambda',
    p1g: r2(m.p1g ?? (1 - Math.exp(-lamG))),
    study: study ? { lamS: study.lamS, p3: study.p3, p4: study.p4, p1g: study.p1g } : null,
  };
}

/**
 * The model's projection blended with the study's: λ = (1 - w) × model + w × study for shots and
 * goals (`w` = the study's share, 0 < w ≤ 1), the market odds the Poisson tails of the blended λ.
 * The model's and the study's own figures ride along as `model` and `study`. Returns `proj`
 * unchanged when either side is missing or `w` is 0.
 */
export function blendProjection(proj, study, w) {
  const share = Number(w);
  if (!proj || !study || !(share > 0) || !(proj.lamS > 0) || !(study.lamS > 0)) return proj;
  const k = Math.min(1, share);
  const lamS = (1 - k) * proj.lamS + k * study.lamS;
  const lamG = (1 - k) * (proj.lamG || 0) + k * (study.lamG || 0);
  return {
    ...proj,
    lamS: r2(lamS), lamG: r2(lamG),
    p2: r2(poissonAtLeast(lamS, 2)), p3: r2(poissonAtLeast(lamS, 3)), p4: r2(poissonAtLeast(lamS, 4)), ladder: 'blend',
    p1g: r2(1 - Math.exp(-lamG)),
    blend: k,
    model: { lamS: proj.lamS, lamG: proj.lamG, p3: proj.p3, p4: proj.p4, p1g: proj.p1g },
    study: { lamS: study.lamS, lamG: study.lamG, p3: study.p3, p4: study.p4, p1g: study.p1g },
  };
}

/**
 * What each team allows per skater at each position: this season's stored rows blended into last
 * season's at games / (games + 15) for shots and games / (games + 40) for goals (the study's
 * environment read, docs/shots-goals-predictors.md section 13). `read(opp, pos)` gives
 * { sog, g, games, prevGames, curSog, curG, prevSog, prevG, rankSog, rankG } (rank 1 = allows the
 * most to that position, among the teams with a figure), or null for a team with no record at all.
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
      const blend = (curV, prevV, prior) => (prevV == null ? curV : curV == null ? prevV : (games / (games + prior)) * curV + (prior / (games + prior)) * prevV);
      teams[abbr][pos] = { games, prevGames, curSog: curSog == null ? null : r2(curSog), curG: curG == null ? null : r2(curG), prevSog: prevSog == null ? null : r2(prevSog), prevG: prevG == null ? null : r2(prevG),
        sog: r2(blend(curSog, prevSog, OPP_PRIOR.sog)), g: +blend(curG, prevG, OPP_PRIOR.g).toFixed(3) };
    }
  }
  for (const pos of POS) {
    const list = Object.keys(teams).filter((a) => teams[a][pos]);
    list.sort((a, b) => teams[b][pos].sog - teams[a][pos].sog).forEach((a, i) => { teams[a][pos].rankSog = i + 1; });
    list.sort((a, b) => teams[b][pos].g - teams[a][pos].g).forEach((a, i) => { teams[a][pos].rankG = i + 1; });
  }
  return { teams, teamCount: Object.keys(teams).length, read: (opp, pos) => teams[opp]?.[pos] || null };
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
  // The softest spots: opponents in the bottom three for shots allowed, and who gets them.
  const soft = [];
  for (const g of games) {
    for (const abbr of [g.away, g.home]) {
      const t = allowed.teams[abbr];
      if (!t || t.rank < n - 2) continue;
      const beneficiaries = g.shots.filter((c) => c.opp === abbr).map((c) => last(c.name));
      soft.push(`${abbr} has allowed ${t.rank === n ? 'the most shots in the league' : `the ${t.rank === n - 1 ? 'second' : 'third'} most shots`} so far (${t.sog} a game, #${t.rank} of ${n})${beneficiaries.length ? `: ${join(beneficiaries)} get${beneficiaries.length === 1 ? 's' : ''} that matchup` : ''}.`);
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

// The pure half of tonight's picks (lib/nhl-data/picks.js): the fitted rates, the blend, the
// projection, the game-level selection and the notes. No storage imports, so the panel can
// use the odds helper in the browser.

// Poisson log-rates on log features. Shots: own rate, attempts, home, the opponent's shots
// allowed a game this season. Goals: own rate, scoring chances, own shot rate, home.
export const SHOTS_FIT = { const: -1.932, sog: 0.8231, icf: 0.1601, home: 0.0392, team: 0.5366 };
export const GOALS_FIT = { const: -1.2315, g: 0.5818, iscf: 0.5498, sog: 0.155, home: 0.0467 };
export const SHOTS_FLOOR = 0.5;   // list every skater at or above P(3+ SOG) = 50%
export const GOALS_FLOOR = 0.35;  // and P(1+ goal) = 35%; else the best one, marked
const PRIOR_GAMES = { sog: 18, g: 40 };
const BASE_MIN_GAMES = 10;        // last season counts as a base from this many games
const ALONE_MIN_GAMES = 5;        // without one, this season alone from this many
const POS = ['C', 'LW', 'RW', 'D'];

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
 * A skater's blended rates: `cur` = his stored games this season, `prev` = last season's.
 * Null when he has no base (under 10 games last season and under 5 this season).
 */
export function blendRates(cur, prev) {
  const n = cur.length;
  const hasBase = prev.length >= BASE_MIN_GAMES;
  if (!hasBase && n < ALONE_MIN_GAMES) return null;
  const blend = (k, prior) => {
    const w = hasBase ? n / (n + prior) : 1;
    return w * mean(cur, k) + (1 - w) * (hasBase ? mean(prev, k) : 0);
  };
  return {
    n, base: hasBase ? prev.length : 0,
    sog: blend('sog', PRIOR_GAMES.sog), icf: blend('icf', PRIOR_GAMES.sog),
    g: blend('g', PRIOR_GAMES.g), iscf: blend('iscf', PRIOR_GAMES.g),
    curSog: n ? mean(cur, 'sog') : null, curG: n ? mean(cur, 'g') : null,
    baseSog: hasBase ? mean(prev, 'sog') : null, baseG: hasBase ? mean(prev, 'g') : null,
  };
}

/** The projection for one skater: Poisson rates and the market probabilities. */
export function project(rates, { home, oppShotsAllowed }) {
  const lamS = Math.exp(SHOTS_FIT.const + SHOTS_FIT.sog * lg(rates.sog) + SHOTS_FIT.icf * lg(rates.icf) + SHOTS_FIT.home * (home ? 1 : 0) + SHOTS_FIT.team * lg(oppShotsAllowed));
  const lamG = Math.exp(GOALS_FIT.const + GOALS_FIT.g * Math.log(rates.g + 0.05) + GOALS_FIT.iscf * lg(rates.iscf) + GOALS_FIT.sog * lg(rates.sog) + GOALS_FIT.home * (home ? 1 : 0));
  return {
    lamS: r2(lamS), lamG: r2(lamG),
    p2: r2(poissonAtLeast(lamS, 2)), p3: r2(poissonAtLeast(lamS, 3)), p4: r2(poissonAtLeast(lamS, 4)),
    p1g: r2(1 - Math.exp(-lamG)),
  };
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

/** The picks for one game from its projected skaters: everyone over the floor, else the best, plus the next three. */
export function pickGame(cands) {
  const byShots = [...cands].sort((a, b) => b.p3 - a.p3 || b.lamS - a.lamS);
  const byGoals = [...cands].sort((a, b) => b.p1g - a.p1g || b.lamG - a.lamG);
  const shots = byShots.filter((c) => c.p3 >= SHOTS_FLOOR);
  const goals = byGoals.filter((c) => c.p1g >= GOALS_FLOOR);
  return {
    shots: shots.length ? shots : byShots.slice(0, 1),
    shotsFallback: !shots.length,
    nextShots: byShots.slice(shots.length || 1, (shots.length || 1) + 3),
    goals: goals.length ? goals : byGoals.slice(0, 1),
    goalsFallback: !goals.length,
    nextGoals: byGoals.slice(goals.length || 1, (goals.length || 1) + 3),
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
    const env = g.shots.filter((c) => !g.shotsFallback && c.rates.sog < 2.75 && c.oppRank <= 5);
    if (env.length) notes.push({ kind: 'env', text: `${join(env.map((c) => last(c.name)))} ${env.length === 1 ? 'is an environment play' : 'are environment plays'}: ${env[0].opp} allows the ${env[0].oppRank === 1 ? 'most' : `#${env[0].oppRank} most`} shots in the league, and ${env.length === 1 ? 'he is' : 'each is'} about a coin flip at 3+ with that lift, not a volume shooter.` });
  }
  // Near-ties: take the better price.
  const ties = [];
  for (const g of games) {
    for (const [list, key] of [[g.shots, 'p3'], [g.goals, 'p1g']]) {
      for (let i = 0; i + 1 < list.length; i++) if (list[i][key] - list[i + 1][key] <= 0.02) ties.push(`${last(list[i].name)} and ${last(list[i + 1].name)} (${key === 'p3' ? '3+ shots' : '1+ goal'})`);
    }
  }
  if (ties.length) notes.push({ kind: 'tie', text: `Near-ties, take whichever price is better: ${join(ties)}.` });
  // Games with nothing over either floor.
  const thin = games.filter((g) => g.shotsFallback && g.goalsFallback);
  if (thin.length) notes.push({ kind: 'thin', text: `${join(thin.map((g) => `${g.away} @ ${g.home}`))} ${thin.length === 1 ? 'has' : 'have'} no real pick either way: ${join(thin.map((g) => last(g.shots[0]?.name)).filter(Boolean))} ${thin.length === 1 ? 'is' : 'are'} listed because something has to be (under ${pct(SHOTS_FLOOR)} for 3+ shots and under ${pct(GOALS_FLOOR)} for a goal).` });
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


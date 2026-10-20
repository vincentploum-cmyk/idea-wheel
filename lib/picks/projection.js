// What a player can reach tonight, read from his own stats and the environment: his rate for
// the stat (this season's average blended with his last ten games) scaled by what the opponent
// gives up to his position against the league's average for the window picked. The opponent's
// deviation counts at ENV_WEIGHT (a defense 20% over the league moves the read 12%): the NHL
// study found the per-position environment real but smaller than the raw ratio. Colour and a
// figure only; the chance stays the hit-rate read.
export const ENV_WEIGHT = 0.6;
export const OWN_WEIGHTS = { l10: 0.35, season: 0.65 };

const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The opponent's factor at a position for a stat: allowed per game over the league's average, damped. */
export function envFactor(allowed, league) {
  if (allowed == null || league == null || !(league > 0)) return null;
  return r3(1 + ENV_WEIGHT * (allowed / league - 1));
}

/** His own rate for a stat from his windows ({ l5, l10, season }): the season blended with his last ten. */
export function ownRate(own) {
  if (!own) return null;
  if (own.l10 != null && own.season != null) return r1(OWN_WEIGHTS.l10 * own.l10 + OWN_WEIGHTS.season * own.season);
  return own.season ?? own.l10 ?? own.l5 ?? null;
}

/** The projection: his rate × the environment (1 without a table). */
export function projectionOf(own, factor) {
  const rate = typeof own === 'number' ? own : ownRate(own);
  if (rate == null) return null;
  return r1(rate * (factor ?? 1));
}

/** Both at once for a player, position and stat against a side's allowed table ({ rows, league }). */
export function projectFor(own, allowed, pos, stat) {
  const cell = allowed?.rows?.[pos]?.[stat];
  const league = allowed?.league?.[pos]?.[stat];
  const factor = envFactor(cell?.value, league);
  const rate = ownRate(own);
  return { rate, factor, value: projectionOf(rate, factor), allowed: cell?.value ?? null, league: league ?? null, rank: cell?.rank ?? null };
}

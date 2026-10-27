// The rotation: how many minutes each player is expected to play tonight, and the factor that
// puts on his per-game rate. A player's rate is per game, so a role that just changed (a new
// starter, a man back on a limit, a rookie's minutes growing) is read on old minutes; and the
// minutes a player out tonight leaves go to the ones who play. Pure: the board hands in each
// player's minute windows from his logs ({ l5, l10, season }, logAverages on the sport's
// coverage field) and the out players with the games they took part in; the module says what
// everyone plays tonight and why. Vincent, 2026-10-27: PropFinder's Rotations page is the ask;
// its data (minutes a game) is in the pull's logs already, the page's own route rides in as a
// sample when PROPFINDER_<LEAGUE>_ROTATIONS_PATH names it (lib/picks/propfinder.js).
import { ownRate } from './projection';
import { playedShare } from './injuries';

/** Tonight's minutes before the vacated ones: his last five and his base (the season blended with his last ten) half and half. */
export const RECENT_WEIGHT = 0.5;
/** The factor on a rate stays within this band: a projection is never a quarter down or a third up on minutes alone. */
export const FACTOR_MIN = 0.75;
export const FACTOR_MAX = 1.3;

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const r3 = (v) => Math.round(v * 1000) / 1000;

/**
 * Minutes tonight per active player: { base (the minutes behind his per-game rate), recent (his
 * last five blended in), vacated (the out players' minutes handed to him), tonight, factor
 * (tonight over base, clamped), from (the out players whose minutes he takes) }, keyed by player.
 * `active`: [{ key, games, minutes: { l5, l10, season } }]; `absent`: [{ key, name, played: Set,
 * minutes }]. The out players' minutes go to the active players by their own minutes, `share` of
 * them (the priced players' share of the game, the bench takes the rest), for the share of each
 * teammate's window the out player was part of (`playedShare`: a season-long absence hands over
 * nothing), and the vacated minutes take nobody past `cap` a night.
 */
export function minutesTonight(active, absent, { season = null, seasonMin = 1, share = 0.6, cap = 38 } = {}) {
  const out = {};
  const rows = (active || []).map((p) => {
    const base = ownRate(p.minutes);
    if (base == null || !(base > 0)) return null;
    const recent = p.minutes?.l5 != null ? r1(RECENT_WEIGHT * p.minutes.l5 + (1 - RECENT_WEIGHT) * base) : base;
    return { key: p.key, games: p.games || [], base, recent };
  }).filter(Boolean);
  if (!rows.length) return out;
  const outs = (absent || []).filter((a) => a?.played instanceof Set && a.played.size && ownRate(a.minutes) > 0);
  const total = rows.reduce((s, r) => s + r.recent, 0);
  for (const r of rows) {
    let vacated = 0; const from = [];
    for (const a of outs) {
      if (a.key === r.key) continue;
      const f = playedShare(r.games, a.played, { season, seasonMin });
      if (!(f > 0)) continue;
      vacated += ownRate(a.minutes) * f * share * (r.recent / total);
      if (!from.includes(a.name)) from.push(a.name);
    }
    // The cap holds the vacated minutes, not the minutes he already plays.
    const tonight = r1(Math.min(Math.max(cap, r.recent), r.recent + vacated));
    const factor = r3(Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, tonight / r.base)));
    out[r.key] = { base: r.base, recent: r.recent, vacated: r1(Math.max(0, tonight - r.recent)), tonight, factor, from };
  }
  return out;
}

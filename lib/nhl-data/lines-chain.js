// When should the pre-game lineups run re-dispatch itself? The beat writers post warm-up
// lines 15 to 30 minutes before puck drop, and GitHub's cron cannot be relied on to be
// awake then, so a run that finds a game inside the warm-up window hands itself on: sleep
// a few minutes, dispatch again, until no game is in the window or the hop budget is spent.
export const WINDOW_BEFORE_MIN = 75; // a game starting within this many minutes keeps the chain going
export const WINDOW_AFTER_MIN = 15;  // and one that started this recently (the last tweet lands at the start)
export const HOP_MIN = 7;            // minutes between hops

/**
 * `games`: [{ startTimeUTC, state }] for the date; `now`: ms epoch; `hops`: hops left.
 * Returns { hop: true, sleepSec, game, hopsLeft } or { hop: false, reason }.
 */
export function nextHop(games, now = Date.now(), hops = 0) {
  if (!(hops > 0)) return { hop: false, reason: 'no hops left' };
  const inWindow = (games || []).filter((g) => {
    const t = Date.parse(g.startTimeUTC || '');
    if (!Number.isFinite(t)) return false;
    const min = (t - now) / 60000;
    return min <= WINDOW_BEFORE_MIN && min >= -WINDOW_AFTER_MIN;
  }).sort((a, b) => Date.parse(a.startTimeUTC) - Date.parse(b.startTimeUTC));
  if (!inWindow.length) return { hop: false, reason: `no game starts within ${WINDOW_BEFORE_MIN} min (or started within the last ${WINDOW_AFTER_MIN})` };
  const g = inWindow[0];
  return { hop: true, sleepSec: HOP_MIN * 60, game: `${g.away?.abbrev || g.away || '?'}@${g.home?.abbrev || g.home || '?'} ${g.startTimeUTC}`, hopsLeft: hops - 1 };
}

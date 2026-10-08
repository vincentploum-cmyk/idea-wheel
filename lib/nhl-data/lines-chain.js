// When should the pre-game lineups run hand itself on? The rule: from 60 minutes before
// puck drop, read the lines every 15 minutes until the game's lineups are found (both teams
// have a GameDayTweets post from the two hours before the start: the warm-up or line-rush
// tweet), or the game is ten minutes old (a late warm-up tweet). GitHub's cron cannot be
// relied on to be awake at T-60, so a run earlier in the day waits for the first window
// (sleeping, in hops of at most MAX_SLEEP_SEC), and a run inside a window sleeps 15 minutes
// and dispatches the next hop. The post-game settle (yesterday's pages, the morning run) is
// a separate path and unchanged.
export const WINDOW_BEFORE_MIN = 60;  // reads start this long before puck drop
export const WINDOW_AFTER_MIN = 10;   // and go on this long after it, for a late warm-up tweet
export const HOP_MIN = 15;            // minutes between reads inside the window
export const FOUND_WITHIN_MIN = 120;  // a team's lines count as found when its newest tweet is at most this old at puck drop
export const MAX_SLEEP_SEC = 5 * 3600 + 40 * 60; // a GitHub job may run six hours; a wait longer than this is split

const parse = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? t : null; };

/** Both teams of `g` have a tweet posted within FOUND_WITHIN_MIN of puck drop (`gdtAt`: team → ISO instant of its newest lines tweet). */
export function linesFound(g, gdtAt = {}) {
  const start = parse(g.startTimeUTC);
  if (start == null) return false;
  return [g.away, g.home].every((abbr) => {
    const at = parse(gdtAt?.[abbr]);
    return at != null && at >= start - FOUND_WITHIN_MIN * 60000 && at <= start + 4 * 3600000;
  });
}

/**
 * `games`: [{ startTimeUTC, away, home }] for the date (abbrevs); `now`: ms epoch; `hops`: hops
 * left; `gdtAt`: team → newest lines tweet instant, as the site reports after a read.
 * Returns { hop: true, sleepSec, why, hopsLeft } or { hop: false, reason }.
 */
export function nextHop(games, now = Date.now(), hops = 0, gdtAt = {}) {
  if (!(hops > 0)) return { hop: false, reason: 'no hops left' };
  const open = (games || [])
    .map((g) => ({ ...g, start: parse(g.startTimeUTC) }))
    .filter((g) => g.start != null && now <= g.start + WINDOW_AFTER_MIN * 60000 && !linesFound(g, gdtAt))
    .sort((a, b) => a.start - b.start);
  if (!open.length) return { hop: false, reason: 'every game on the date is past its window or has its lineups' };
  const label = (g) => `${g.away}@${g.home} ${g.startTimeUTC}`;
  const inWindow = open.filter((g) => now >= g.start - WINDOW_BEFORE_MIN * 60000);
  if (inWindow.length) {
    // Inside a window: the next read in 15 minutes, or sooner if another game's window opens first.
    const nextOpen = open.filter((g) => now < g.start - WINDOW_BEFORE_MIN * 60000).map((g) => g.start - WINDOW_BEFORE_MIN * 60000 - now);
    const sleepMs = Math.max(60000, Math.min(HOP_MIN * 60000, ...nextOpen));
    return { hop: true, sleepSec: Math.round(sleepMs / 1000), why: `${label(inWindow[0])} is inside its window without lineups`, hopsLeft: hops - 1 };
  }
  // Before the first window: wait for it (a long wait is split into hops of at most MAX_SLEEP_SEC).
  const until = open[0].start - WINDOW_BEFORE_MIN * 60000 - now;
  const sleepMs = Math.max(60000, Math.min(until, MAX_SLEEP_SEC * 1000));
  return { hop: true, sleepSec: Math.round(sleepMs / 1000), why: `waiting for the window of ${label(open[0])} (opens in ${Math.round(until / 60000)} min)`, hopsLeft: hops - 1 };
}

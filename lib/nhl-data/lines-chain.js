// When should the lineups run hand itself on? Two rules. Before the game: from 60 minutes
// before puck drop, read the lines every 15 minutes until the game's lineups are found (both teams
// have a GameDayTweets post from the 45 minutes before the start: the warm-up or line-rush
// tweet; a projected-lines tweet from the afternoon is not it, the warm-up can still differ),
// or the game is ten minutes old (a late warm-up tweet). After the game: one post-game read per
// game, 3 h 30 after puck drop (about an hour after a regulation final) once the game is final,
// tried again every 20 minutes while it is still on, until the 4-hour tweet cutoff (gdtCutoffs);
// the read takes the lines the writers posted at or during the game (a late scratch, a swap at
// warm-up, the pairs as they skated) and the preview's final update, re-captures the snapshot and
// re-stamps the stored box score, so a skater's position and line slot for the game are the ones
// he actually played. GitHub's cron cannot be relied on to be awake at T-60, so a run earlier in
// the day waits for the first window (sleeping, in hops of at most MAX_SLEEP_SEC), and a run
// inside a window sleeps 15 minutes and dispatches the next hop; the post-game reads ride the
// same chain, each hop carrying the games already settled. The morning run (yesterday's pages
// for every team that played) is the backstop for a chain that broke.
export const WINDOW_BEFORE_MIN = 60;  // reads start this long before puck drop
export const WINDOW_AFTER_MIN = 10;   // and go on this long after it, for a late warm-up tweet
export const HOP_MIN = 15;            // minutes between reads inside the window
export const FOUND_WITHIN_MIN = 45;   // a team's lines count as found when its newest tweet is at most this old at puck drop (the warm-up window)
export const SETTLE_AFTER_START_MIN = 210; // the post-game read: 3 h 30 after puck drop, about an hour after a regulation final
export const SETTLE_RETRY_MIN = 20;        // a game still on at that time is read again this much later
export const SETTLE_UNTIL_MIN = 4 * 60;    // the tweet cutoff (gdtCutoffs): past it the morning run settles the game
export const MAX_SLEEP_SEC = 5 * 3600 + 40 * 60; // a GitHub job may run six hours; a wait longer than this is split

const parse = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? t : null; };
const FINAL = new Set(['OFF', 'FINAL']);
/** The key a game is tracked by across hops: its id, else the matchup. */
export const gameKey = (g) => String(g?.id ?? `${g?.away}@${g?.home}`);

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
 * `games`: [{ id?, startTimeUTC, away, home, state? }] for the date (abbrevs; `state` = the NHL
 * schedule's gameState, OFF / FINAL when final); `now`: ms epoch; `hops`: hops left; `gdtAt`:
 * team → newest lines tweet instant, as the site reports after a read; `settled`: the keys of the
 * games whose post-game read is done (carried from hop to hop); `settleHop`: this run was
 * dispatched as a post-game read, so a game it finds final past its instant is settled by it.
 * Returns { hop: true, sleepSec, why, hopsLeft, settle (the next hop is a post-game read), settled }
 * or { hop: false, reason, settled }.
 */
export function nextHop(games, now = Date.now(), hops = 0, gdtAt = {}, { settled = [], settleHop = false } = {}) {
  const list = (games || []).map((g) => ({ ...g, start: parse(g.startTimeUTC), key: gameKey(g) })).filter((g) => g.start != null);
  const done = new Set((settled || []).map(String).filter(Boolean));
  // A post-game read that found the game final past its instant has settled it.
  if (settleHop) for (const g of list) if (!done.has(g.key) && now >= g.start + SETTLE_AFTER_START_MIN * 60000 && FINAL.has(g.state)) done.add(g.key);
  const settledAll = [...done];
  if (!(hops > 0)) return { hop: false, reason: 'no hops left', settled: settledAll };
  const label = (g) => `${g.away}@${g.home} ${g.startTimeUTC}`;
  const open = list.filter((g) => now <= g.start + WINDOW_AFTER_MIN * 60000 && !linesFound(g, gdtAt)).sort((a, b) => a.start - b.start);
  const owed = list.filter((g) => !done.has(g.key) && now <= g.start + SETTLE_UNTIL_MIN * 60000).sort((a, b) => a.start - b.start);
  if (!open.length && !owed.length) return { hop: false, reason: 'every game on the date is past its window or has its lineups, and has had its post-game read', settled: settledAll };
  const events = [];
  const inWindow = open.filter((g) => now >= g.start - WINDOW_BEFORE_MIN * 60000);
  if (inWindow.length) {
    // Inside a window: the next read in 15 minutes, or sooner if another game's window opens first.
    const nextOpen = open.filter((g) => now < g.start - WINDOW_BEFORE_MIN * 60000).map((g) => g.start - WINDOW_BEFORE_MIN * 60000 - now);
    events.push({ at: now + Math.min(HOP_MIN * 60000, ...nextOpen), why: `${label(inWindow[0])} is inside its window without lineups`, settle: false });
  } else if (open.length) {
    const until = open[0].start - WINDOW_BEFORE_MIN * 60000 - now;
    events.push({ at: now + until, why: `waiting for the window of ${label(open[0])} (opens in ${Math.round(until / 60000)} min)`, settle: false });
  }
  for (const g of owed) {
    const at = g.start + SETTLE_AFTER_START_MIN * 60000;
    if (now < at) events.push({ at, why: `the post-game read of ${label(g)} (${Math.round((at - now) / 60000)} min from now)`, settle: true });
    else if (FINAL.has(g.state)) events.push({ at: now, why: `the post-game read of ${label(g)} is due now`, settle: true });
    else events.push({ at: now + SETTLE_RETRY_MIN * 60000, why: `${label(g)} is not final yet: the post-game read again in ${SETTLE_RETRY_MIN} min`, settle: true });
  }
  events.sort((a, b) => a.at - b.at);
  const first = events[0];
  const sleepMs = Math.max(60000, Math.min(first.at - now, MAX_SLEEP_SEC * 1000));
  // A hop that lands on a post-game instant (or within its minute) is a post-game read as well.
  const settle = events.some((e) => e.settle && e.at <= first.at + 60000);
  return { hop: true, sleepSec: Math.round(sleepMs / 1000), why: first.why, hopsLeft: hops - 1, settle, settled: settledAll };
}

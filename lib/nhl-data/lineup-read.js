// Where a rink's lines came from, in one word: the beat writers' tweet from the warm-up window or
// the game itself (the final word), an earlier tweet (projected lines), NHL.com's projected
// lineup, or a guess (PropFinder's depth chart, the roster, the last known lineup). The slate puts
// `lineupRead` on every side as `lineup` and the rink draws it as a pill under the team; the
// lineup audit's verdicts (`lineup-audit.js`) read the same rule. Pure: the client bundles it.

/** A tweet this close to puck drop (minutes), or during the game, is the writers' final word. */
export const GDT_FINAL_WORD_MIN = 90;
/** A tweet posted this long after puck drop (minutes) still belongs to the game; later it is the next game's. */
export const TWEET_AFTER_MAX_MIN = 4 * 60;

export const VERDICT = {
  settled: 'settled',          // positions from a tweet posted 90 min before puck drop to 4 h after it
  early: 'early-tweet',        // a tweet from earlier on game day or the day before: projected lines
  preview: 'preview',          // NHL.com's projected lineup, no tweet
  none: 'no-lineup',           // PropFinder's depth chart or the roster
  missing: 'no-snapshot',      // the game was never snapshotted
};

/**
 * The verdict for a snapshot team ({ source, meta: { gdtAt } }) against the game's start:
 * { verdict, tweetMinutes (the tweet's time from puck drop, negative before it), finalWord }.
 */
export function lineupVerdict(team, startTimeUTC) {
  const start = Date.parse(startTimeUTC || '');
  const gdtAt = Date.parse(team?.meta?.gdtAt || team?.meta?.at || '');
  const minutes = Number.isFinite(gdtAt) && Number.isFinite(start) ? Math.round((gdtAt - start) / 60000) : null;
  const finalWord = team?.source === 'gamedaytweets' && minutes != null && minutes >= -GDT_FINAL_WORD_MIN && minutes <= TWEET_AFTER_MAX_MIN;
  const verdict = !team ? VERDICT.missing : finalWord ? VERDICT.settled : team.source === 'gamedaytweets' ? VERDICT.early : team.source === 'lineup' ? VERDICT.preview : VERDICT.none;
  return { verdict, tweetMinutes: minutes, finalWord };
}

const et = (iso) => (iso ? `${new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET` : null);

/** "18 min before puck drop", "4 h 50 before puck drop", "35 min into the game", "3 h after puck drop". */
export function minutesWord(minutes) {
  if (minutes == null) return null;
  const abs = Math.abs(minutes);
  const span = abs >= 60 ? `${Math.floor(abs / 60)} h${abs % 60 ? ` ${String(abs % 60).padStart(2, '0')}` : ''}` : `${abs} min`;
  if (minutes <= 0) return `${span} before puck drop`;
  return minutes <= TWEET_AFTER_MAX_MIN ? `${span} into the game` : `${span} after puck drop`;
}

/**
 * A slate side ({ source, sourceMeta, carried }) → what the rink says about its lines:
 * { verdict, tone ('ok' | 'warn' | 'bad'), label (the pill), note (beside it), title (the hover),
 *   tweetMinutes, finalWord, handle, at, url, date, confirmed, changed, carried }.
 */
export function lineupRead(side, startTimeUTC) {
  const m = side?.sourceMeta || {};
  const team = side ? { source: side.source || 'roster', meta: m } : null;
  const { verdict, tweetMinutes, finalWord } = lineupVerdict(team, startTimeUTC);
  const handle = m.handle ? `@${m.handle}` : null;
  const at = m.gdtAt || m.at || null;
  const when = minutesWord(tweetMinutes);
  const carried = side?.carried?.count ? `${side.carried.count} slot${side.carried.count === 1 ? '' : 's'} carried from the last known lineup${side.carried.date ? ` (${side.carried.date})` : ''}` : null;
  const confirmed = !!m.gdtConfirmed;
  const changed = m.gdtChanged || 0;
  let tone; let label; let note; let title;
  if (verdict === VERDICT.settled) {
    tone = 'ok';
    label = `GameDayTweets ${handle || ''}`.trim();
    note = [et(at), when].filter(Boolean).join(' · ');
    title = `Lines from the beat writers via GameDayTweets${handle ? ` (${handle})` : ''}, posted ${et(at)}, ${when}: the warm-up or game lines${confirmed ? ' ("same lineup", the lines of the tweet before it)' : changed ? ` (a line-change tweet applied onto the lines before it, ${changed} change${changed === 1 ? '' : 's'})` : ''}.`;
  } else if (verdict === VERDICT.early) {
    tone = 'warn';
    label = `GameDayTweets ${handle || ''}`.trim();
    note = [at ? et(at) : m.date || null, when ? `${when} · projected` : 'projected'].filter(Boolean).join(' · ');
    title = `Lines from an earlier GameDayTweets post${handle ? ` (${handle})` : ''}${at ? `, ${et(at)}, ${when}` : m.date ? `, ${m.date}` : ''}: projected lines, not the warm-up's. The read runs again every 15 minutes from an hour before puck drop.`;
  } else if (verdict === VERDICT.preview) {
    tone = 'warn';
    label = 'NHL.com projected';
    note = [m.nhlUpdated ? `updated ${et(m.nhlUpdated)}` : null, handle ? `older tweet ${handle}${at ? ` ${et(at)}` : ''}` : null].filter(Boolean).join(' · ');
    title = `Lines from NHL.com's projected lineup${m.nhlUpdated ? ` (updated ${et(m.nhlUpdated)})` : ''}; no beat-writer tweet from the warm-up window yet${handle ? ` (an older tweet from ${handle}${at ? `, ${et(at)}` : ''})` : ''}.`;
  } else {
    tone = 'bad';
    label = 'A guess';
    note = side?.source === 'propfinder' ? `PropFinder’s depth chart${m.pfAt ? `, pulled ${et(m.pfAt)}` : ''}`
      : carried ? `the last known lineup${side.carried.date ? ` (${side.carried.date})` : ''}`
        : 'the roster, by projected shots';
    title = `No lines yet: ${note}. No beat-writer tweet and no NHL.com projected lineup${m.capturedAt ? `; last checked ${et(m.capturedAt)}` : ''}.`;
  }
  if (carried && verdict !== VERDICT.none) { note = note ? `${note} · ${carried}` : carried; title += ` ${carried[0].toUpperCase()}${carried.slice(1)}.`; }
  return { verdict, tone, label, note: note || null, title, tweetMinutes, finalWord, handle, at, url: m.url || null, date: m.date || m.gdtDate || null, confirmed, changed, carried: side?.carried || null };
}

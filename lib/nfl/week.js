// NFL weeks. The season's calendar comes from ESPN (regular-season weeks run Wednesday
// 03:00 ET to the next Wednesday, so a Thursday / Sunday / Monday slate and the Tuesday after
// share one week); without a stored calendar the weeks are computed from the kickoff rule
// (the Thursday after Labor Day) so the week picker works before the first fetch.
// Self-contained (no store imports): the client's week picker imports this file too.

/** Today's date on the US East Coast (NFL weeks are dated in ET). */
export function todayET(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The season an ET date belongs to: 2026 from March 2026 through February 2027. */
export function seasonOfDate(date) {
  const [y, m] = String(date).split('-').map(Number);
  return m >= 3 ? y : y - 1;
}

/** Labor Day (the first Monday of September) of a year, as YYYY-MM-DD. */
export function laborDay(year) {
  const d = new Date(Date.UTC(year, 8, 1));
  const dow = d.getUTCDay(); // 0 Sunday … 1 Monday
  const day = 1 + ((8 - dow) % 7);
  return `${year}-09-${String(day).padStart(2, '0')}`;
}

/** Week 1's first day (the Wednesday before the Thursday kickoff) by the kickoff rule. */
export function week1Start(year) {
  return addDays(laborDay(year), 2);
}

/**
 * The week an ET date falls in by the kickoff rule: { season, week, type } with type 2 for the
 * 18 regular-season weeks, 3 for the four postseason weeks (1 = wild card … 4 = Super Bowl, with
 * the bye week before it folded into week 4), 1 before kickoff (preseason / off-season).
 */
export function weekByRule(date) {
  const season = seasonOfDate(date);
  const start = week1Start(season);
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000);
  if (days < 0) return { season, week: 1, type: 1, start, end: addDays(start, -1) };
  const n = Math.floor(days / 7) + 1;
  if (n <= 18) return { season, week: n, type: 2, start: addDays(start, (n - 1) * 7), end: addDays(start, n * 7 - 1) };
  const post = Math.min(n - 18, 4);
  return { season, week: post, type: 3, start: addDays(start, (17 + post) * 7), end: post === 4 ? addDays(start, 22 * 7 - 1) : addDays(start, (18 + post) * 7 - 1) };
}

/**
 * ESPN's calendar (the scoreboard's leagues[0].calendar) as a flat list of windows:
 * [{ season, type, week, label, start, end }] with start / end as ET dates.
 */
export function calendarWindows(calendar, season) {
  const out = [];
  const toDate = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  for (const block of calendar || []) {
    const type = /pre/i.test(block.label) ? 1 : /post/i.test(block.label) ? 3 : /regular/i.test(block.label) ? 2 : 0;
    if (!type) continue;
    for (const e of block.entries || []) {
      if (!e.startDate || !e.endDate) continue;
      out.push({ season, type, week: Number(e.value), label: e.label, start: toDate(e.startDate), end: toDate(new Date(Date.parse(e.endDate) - 1000).toISOString()) });
    }
  }
  return out;
}

/** The week of an ET date from stored calendar windows, or by the kickoff rule. */
export function weekForDate(date, windows = null) {
  const hit = (windows || []).find((w) => date >= w.start && date <= w.end);
  if (hit) return { season: hit.season, week: hit.week, type: hit.type, start: hit.start, end: hit.end, label: hit.label };
  return weekByRule(date);
}

export const weekLabel = ({ week, type }) => (type === 3 ? ['Wild card', 'Divisional', 'Conference', 'Super Bowl'][week - 1] || `Playoff week ${week}` : type === 1 ? 'Preseason' : `Week ${week}`);

/** The week before / after one, within the 18 + 4 the season plays. */
export function shiftWeek({ season, week, type }, n) {
  let w = type === 3 ? 18 + week : week;
  w += n;
  if (w < 1) w = 1;
  if (w > 22) w = 22;
  return w > 18 ? { season, week: w - 18, type: 3 } : { season, week: w, type: 2 };
}

/** "wk7", "week-7", "W7", "Week 7", "2026-10-19" in a file name → { season?, week?, date? }. */
export function weekFromFileName(name) {
  const s = String(name || '');
  const out = {};
  const d = s.match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/);
  if (d) out.date = `${d[1]}-${d[2]}-${d[3]}`;
  const w = s.match(/\b(?:wk|week|w)[\s_-]?(\d{1,2})\b/i);
  if (w) out.week = Number(w[1]);
  const y = s.match(/\b(20\d{2})\b/);
  if (y && !out.date) out.season = Number(y[1]);
  return out;
}

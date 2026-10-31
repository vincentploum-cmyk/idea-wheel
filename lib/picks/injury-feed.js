// ESPN's league injury feed, parsed (site.api.espn.com/apis/site/v2/sports/<sport>/<league>/injuries; free, no login,
// served to the server where the leagues' own reports are not). One dated entry a listed player with the word for the
// coming game in `details.fantasyStatus` (RotoWire's), the injury, the expected return and the comment. Pure and
// client-safe (the sports' espn.js modules are bundled by the client for `headshotUrl`): the name key is put on by the
// store (lib/picks/injuries.js applyEspnInjuries). Each sport names its fantasy-status spellings (`fantasy`) and its
// team-code reader (`teamAbbr`); a fantasy status not named reads as the feed's own status word.
// Vincent, 2026-10-31: "Can't we just find another source for the confirmed NBA lineups?", then "do the same for the NFL".

/**
 * [{ espnId, name, team, pos, status, raw, fantasy, detail, date, returnDate, comment }] sorted by team then name,
 * with the feed's own timestamp as `at` and the read's time as `fetchedAt`; `source: 'espn'`.
 */
export function parseInjuryFeed(j, { teamAbbr = (x) => x || null, fantasy = {} } = {}) {
  const rows = [];
  for (const tm of j?.injuries || []) {
    for (const e of tm?.injuries || []) {
      const a = e?.athlete || {};
      const name = a.displayName || a.shortName || null;
      if (!name) continue;
      const team = teamAbbr(a.team?.abbreviation || a.team?.displayName || tm.displayName || '') || null;
      const d = e.details || {};
      const fs = d.fantasyStatus?.abbreviation || null;
      const status = (fs && fantasy[fs]) || String(e.status || '').trim() || null;
      const detail = [d.type, d.detail].filter((x) => x && x !== 'None' && x !== 'Not Specified').join(' ') || d.type || null;
      rows.push({ espnId: a.id != null ? String(a.id) : null, name, team, pos: a.position?.abbreviation || null, status, raw: e.status || null, fantasy: fs, detail, date: e.date || null, returnDate: d.returnDate || null, comment: e.shortComment || null });
    }
  }
  rows.sort((x, y) => String(x.team).localeCompare(String(y.team)) || x.name.localeCompare(y.name));
  return { at: j?.timestamp || new Date().toISOString(), fetchedAt: new Date().toISOString(), rows, source: 'espn' };
}

/** The NBA feed's fantasy statuses: OUT / OFS (out for the season) = Out; GTD = a game-time decision, not out. */
export const NBA_FANTASY = { OUT: 'Out', OFS: 'Out', GTD: 'GTD' };

/**
 * The NFL feed's: OUT and INACTIVE = Out; IR and IR-R (designated to return) = IR; PUP-R = PUP; NFI-R = NFI; RESERVE-SUS =
 * Suspended; DOUBTFUL / QUESTIONABLE as they read. The feed also lists players Active (a practice report: he cleared),
 * which stands as listed and reads as In.
 */
export const NFL_FANTASY = { OUT: 'Out', INACTIVE: 'Out', IR: 'IR', 'IR-R': 'IR', 'PUP-R': 'PUP', 'NFI-R': 'NFI', 'RESERVE-SUS': 'Suspended', DOUBTFUL: 'Doubtful', QUESTIONABLE: 'Questionable' };

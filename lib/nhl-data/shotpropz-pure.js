// The ShotPropz snapshot's readers the matchup profile runs on (lib/nhl-data/shotpropz.js pulls
// and stores it). Pure, no store import: the profile builder is bundled by the client.

/**
 * One team's read of a stat for the profile: its figure, rank and games on the board for `location`
 * (home / away / all) and span, or null when the board or the team is not there.
 */
export function spzCell(spz, board, stat, team, { location = 'all', span = 'ytd' } = {}) {
  const table = spz?.boards?.[board]?.[location]?.[span]?.[stat];
  const t = table?.teams?.[team];
  if (!t) return null;
  return { value: t.value, rank: t.rank, gp: t.gp, n: table.count, location, span };
}

/** A team needs this many games at the venue before the venue board leads its read; the all-games board stands in until then. */
export const SPZ_MIN_VENUE_GAMES = 4;

/**
 * Everything the profile reads for one team at tonight's venue (`venue` 'H' | 'A'): per stat
 * { venue, all, l10 } cells, `lead` = the venue cell from SPZ_MIN_VENUE_GAMES games there, else the
 * all-games cell, and the board's words. Null without a snapshot.
 */
export function spzTeamRead(spz, team, venue) {
  if (!spz?.boards) return null;
  const location = venue === 'H' ? 'home' : venue === 'A' ? 'away' : 'all';
  const read = (board, stat) => {
    const at = spzCell(spz, board, stat, team, { location });
    const all = spzCell(spz, board, stat, team, { location: 'all' });
    const l10 = spzCell(spz, board, stat, team, { location: 'all', span: 'l10' });
    if (!at && !all && !l10) return null;
    const lead = at && at.gp >= SPZ_MIN_VENUE_GAMES ? at : all || at;
    return { venue: at, all, l10, lead, leadAt: lead === at && at ? location : 'all' };
  };
  const out = {};
  for (const [board, stats] of [['offense', ['gf', 'sf', 'ppo', 'ppPct']], ['defense', ['ga', 'sa', 'ppoa', 'pkPct']]]) {
    for (const k of stats) { const r = read(board, k); if (r) out[k] = r; }
  }
  return Object.keys(out).length ? { team, location, updated: spz.pageUpdated || null, year: spz.year, ...out } : null;
}

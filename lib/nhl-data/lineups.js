// NHL.com game previews → the plain-text rows the model's lineup parser reads
// (same layout as the "Lineups <date>.xlsx" files built by hand).
import { teamAbbrFromText } from './teams';

export function markdownToRows(md) {
  return String(md || '')
    .replace(/<forge-entity[^>]*>([\s\S]*?)<\/forge-entity>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .split(/\r?\n/)
    .map((l) => l
      .replace(/^#+\s*/, '')
      .replace(/\*+/g, '')
      .replace(/\\-/g, '-')
      .replace(/ /g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim())
    .filter(Boolean);
}

/** Keep only the lineup section of a preview (header through status report). */
export function lineupRows(md) {
  const rows = markdownToRows(md);
  const start = rows.findIndex((r) => /\(\d+-\d+-\d+\)\s+at\s+/i.test(r) || / at [A-Z .]+\(/.test(r));
  const from = start >= 0 ? start : rows.findIndex((r) => /projected lineup/i.test(r));
  if (from < 0) return [];
  return rows.slice(from);
}

/**
 * How many teams a preview's markdown names a projected lineup for ("Oilers projected lineup"). A club site's own
 * preview tagged with the game ("game-preview-islanders-vs-oilers-…", one "PROJECTED LINEUP" heading over its own
 * lines alone) names none: the position parser reads no team from it.
 */
export function previewLineupTeams(md) {
  const teams = new Set();
  for (const row of markdownToRows(md)) {
    if (!/projected lineup/i.test(row)) continue;
    const abbr = teamAbbrFromText(row.replace(/projected lineup/i, ''));
    if (abbr) teams.add(abbr);
  }
  return teams.size;
}

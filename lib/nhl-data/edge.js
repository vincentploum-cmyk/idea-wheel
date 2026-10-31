// The edge audit, stored: the season's scorecard grades every priced skater-game against the book (lib/nhl-data/edge-pure.js)
// and the report is written here whenever the season's scorecard is built (the History tab's first grade, the morning
// refresh), so the board's head can say from which chance the shots and goal plays have paid without grading again.
import { readJson, writeJson } from '../nhl-store';

export const EDGE_PATH = 'data/scorecard/edge.json';

/** The stored audit, or null. */
export async function loadEdge() {
  return (await readJson(EDGE_PATH).catch(() => null)) || null;
}

const same = (a, b) => !!a && !!b && JSON.stringify({ sog: a.sog, g: a.g, from: a.from, to: a.to }) === JSON.stringify({ sog: b.sog, g: b.g, from: b.from, to: b.to });

/** Store the audit a season's scorecard gives (the stored one comes back untouched when it says the same). */
export async function saveEdge(report, { from = null, to = null, at = new Date().toISOString() } = {}) {
  if (!report) return null;
  const next = { at, from, to, ...report };
  const cur = await loadEdge();
  if (same(cur, next)) return cur;
  await writeJson(EDGE_PATH, next);
  return next;
}

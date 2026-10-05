// The model's own projections for a slate: the newest saved run whose slate
// date matches, indexed by team + player so the rink can show what the model
// said (λ shots, λ goals, 3+/4+ shot and 1+ goal probabilities). Runs are
// saved by the Model tab (NhlApp → /api/nhl/runs); this only reads them.
import { findRun, getRunResults, runsRevision } from '../nhl-store';
import { isOnFire } from '../../components/nhl/model-core';
import { teamAbbrFromText } from './teams';
import { normName } from './names';

const MEMO_MS = 60 * 1000;
const memo = new Map(); // date → { at, rev, value }
// A run's results never change once saved, so its index is kept per run id: the
// results file (the biggest read on the slate's path) is downloaded once, not every minute.
const INDEX_MAX = 4;
const indexes = new Map(); // run id → players index, least recently used first

async function runIndex(id) {
  const hit = indexes.get(id);
  if (hit) { indexes.delete(id); indexes.set(id, hit); return hit; }
  const rows = await getRunResults(id);
  const players = indexModelRows(Array.isArray(rows) ? rows : []);
  // A failed download is not kept: the next lookup tries again.
  if (Array.isArray(rows)) {
    if (indexes.size >= INDEX_MAX) indexes.delete(indexes.keys().next().value);
    indexes.set(id, players);
  }
  return players;
}

export const modelKey = (team, name) => `${teamAbbrFromText(team) || String(team || '').toUpperCase()}|${normName(name)}`;

/** Result rows → { key → compact projection }. */
export function indexModelRows(rows) {
  const out = {};
  for (const r of rows || []) {
    if (!r?.name) continue;
    out[modelKey(r.team, r.name)] = {
      sog: r.lambdaS ?? null, g: r.lambdaG ?? null, pts: r.lambdaP ?? null,
      p2s: r.p2s ?? null, p3s: r.p3s ?? null, p4s: r.p4s ?? null, p1g: r.p1g ?? null,
      gateOpen: r.gateOpen ?? null, line: r.todayLine ?? null, signal: r.signalScore ?? null, pos: r.pos || null,
      // The model's flame (1+ point ≥ 50%, 2.0+ iSCF/G, 16+ min), so the rink can show it.
      p1p: r.p1p ?? null, fire: isOnFire(r),
    };
  }
  return out;
}

/** Newest saved run with results for `date`, or null. */
export async function latestModelRun(date) {
  // Fresh for a minute, and dropped at once when a run is saved or deleted on this server.
  const hit = memo.get(date);
  if (hit && hit.rev === runsRevision() && Date.now() - hit.at < MEMO_MS) return hit.value;
  let value = null;
  try {
    // Run ids are creation-stamped, so the first match newest-first is the latest run for the date.
    const run = await findRun((m) => m.slateDate === date && m.hasResults, { limit: 80 });
    if (run) {
      const players = await runIndex(run.id);
      value = { id: run.id, createdAt: run.createdAt, label: run.label || null, source: run.source || null, players, count: Object.keys(players).length };
    }
  } catch (err) {
    console.error('[nhl-data] model run lookup failed:', err?.message || err);
  }
  memo.set(date, { at: Date.now(), rev: runsRevision(), value });
  return value;
}

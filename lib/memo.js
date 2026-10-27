// In-process memoisation shared by the data layers. Render runs one instance, every
// stored file is handed back by readJson() as the same object until it is written or
// expires, and loadRows() hands back the same array while the season files are
// unchanged: so derived values can be kept by the identity of what they were made from.
// Every memoised value is shared between requests: callers must treat it as read-only.
// Pure (no store import): the client bundles that share lib/nhl-data helpers stay free of
// the server's dependencies.

/**
 * A value derived from an array of rows, kept per array (a WeakMap: the entry goes with the
 * array). `key` tells apart the readings of the same rows (a window, a season, a pair of
 * teams). Another array with the same content is a new computation, never a stale hit.
 */
const byRows = new WeakMap(); // rows → Map(key → value)
export function memoByRows(rows, key, compute) {
  if (!Array.isArray(rows)) return compute();
  let table = byRows.get(rows);
  if (!table) byRows.set(rows, (table = new Map()));
  if (!table.has(key)) table.set(key, compute());
  return table.get(key);
}

/** A stable id per object (null and primitives read as themselves), so a set of inputs makes a key. */
const ids = new WeakMap();
let nextId = 1;
export function identityOf(value) {
  if (value === null || typeof value !== 'object') return String(value);
  let id = ids.get(value);
  if (!id) ids.set(value, (id = nextId++));
  return `#${id}`;
}

export const identityKey = (inputs) => inputs.map(identityOf).join('|');

/**
 * A synchronous memo on the identity of its inputs: `get(inputs, compute)` returns the value
 * computed for the same objects last time (up to `max` input sets, least recently used first).
 * Built for the boards: the slate's files are the same objects between requests until one is
 * written, so the board built from them is too.
 */
export function inputsMemo({ max = 4 } = {}) {
  const entries = new Map(); // identity key → value
  return {
    get(inputs, compute) {
      const key = identityKey(inputs);
      if (entries.has(key)) {
        const value = entries.get(key);
        entries.delete(key);
        entries.set(key, value);
        return value;
      }
      const value = compute();
      if (entries.size >= max) entries.delete(entries.keys().next().value);
      entries.set(key, value);
      return value;
    },
    clear() { entries.clear(); },
    get size() { return entries.size; },
  };
}

/**
 * An async memo for the builders a page load waits on (the slate, the picks, the defense
 * tables): `memo(key, loadInputs, compute)` returns the value built for `key` while
 *   - `revision()` reads the same (the store's dataRevision: nothing written on this server since),
 *   - the inputs `loadInputs()` hands back are the same objects (a run saved through another
 *     module instance, a file re-read after its cache expired: both change an identity),
 *   - and it is younger than `ttl`.
 * A build in flight is shared: a second request for the same key joins it instead of starting
 * another. A build that throws is forgotten, so the next request tries again.
 */
export function asyncMemo({ ttl = 15 * 60 * 1000, max = 8, revision = () => 0 } = {}) {
  const entries = new Map(); // key → { at, rev, ids, promise }
  async function memo(key, loadInputs, compute) {
    const inputs = loadInputs ? await loadInputs() : [];
    const idKey = identityKey(inputs);
    const rev = revision();
    const hit = entries.get(key);
    if (hit && hit.rev === rev && hit.ids === idKey && Date.now() - hit.at < ttl) {
      entries.delete(key);
      entries.set(key, hit);
      return hit.promise;
    }
    const entry = { at: Date.now(), rev, ids: idKey, promise: null };
    entry.promise = Promise.resolve().then(() => compute(...inputs)).catch((err) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw err;
    });
    entries.delete(key);
    if (entries.size >= max) entries.delete(entries.keys().next().value);
    entries.set(key, entry);
    return entry.promise;
  }
  memo.clear = () => entries.clear();
  memo.has = (key) => entries.has(key);
  return memo;
}

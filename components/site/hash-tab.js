'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** The tab a URL hash names (`#shuffle`; `#teams/BUF` is the Teams tab with a team picked), else the fallback. */
export function tabOf(hash, keys, fallback) {
  const key = String(hash || '').replace(/^#/, '').split('/')[0];
  return keys.includes(key) ? key : fallback;
}

function subscribe(cb) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

// The tabs visited this page load, per page: a visited panel stays mounted (hidden) so it keeps its
// state when you switch away (the model its loaded files, the shuffle its bars). Read as one string
// so the snapshot compares by value.
const visited = new Map();
function markVisited(path, tab) {
  const set = visited.get(path) || visited.set(path, new Set()).get(path);
  set.add(tab);
  return [...set].sort().join(',');
}

/**
 * The URL hash as the tab state, so tabs deep-link and back / forward work. Returns `[tab, mounted]`:
 * `mounted(key)` is true for the open tab and every tab visited this page load. `keys` must be a
 * stable array.
 */
export function useHashTab(keys, fallback) {
  const read = useCallback(() => tabOf(window.location.hash, keys, fallback), [keys, fallback]);
  const tab = useSyncExternalStore(subscribe, read, () => fallback);
  const seen = useSyncExternalStore(subscribe, () => markVisited(window.location.pathname, read()), () => '');
  const mounted = useCallback((key) => key === tab || seen.split(',').includes(key), [tab, seen]);
  return [tab, mounted];
}

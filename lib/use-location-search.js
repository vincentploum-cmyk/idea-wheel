'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const read = () => window.location.search;
const serverSnapshot = () => null;

/**
 * The page URL's query string: `null` while server-rendering / hydrating,
 * the real `window.location.search` once React is running in the browser.
 */
export function useLocationSearch() {
  return useSyncExternalStore(subscribe, read, serverSnapshot);
}

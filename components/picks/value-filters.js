'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { DEFAULTS } from '@/lib/picks/value';

// The user's own value floors, kept per sport in localStorage (the brief of 2026-10-31, "Controls, persisted per
// user"): the minimum EV, the juice ceiling, the optional chance floor, the market filter, the sort and whether the
// marginal rows show. The server builds the board at lib/picks/value.js DEFAULTS; these re-read it in the browser.
// Read through useSyncExternalStore so the server render and the first client render agree (the defaults), the
// stored copy taking over on the client.

const KEY = (sport) => `ir:value:${sport}`;
const EMPTY = { ...DEFAULTS, group: 'all' };
const listeners = new Set();
const notify = () => { for (const l of listeners) l(); };
const subscribe = (l) => { listeners.add(l); window.addEventListener('storage', l); return () => { listeners.delete(l); window.removeEventListener('storage', l); }; };
const snapshot = (sport) => () => { try { return window.localStorage.getItem(KEY(sport)) || ''; } catch { return ''; } };
const serverSnapshot = () => '';

function parse(raw) {
  if (!raw) return EMPTY;
  try { const j = JSON.parse(raw); return { ...EMPTY, ...(j && typeof j === 'object' ? j : {}) }; } catch { return EMPTY; }
}

/** [filters, set(partial), reset()] for a sport; the defaults until the stored copy is read on the client. */
export function useValueFilters(sport) {
  const raw = useSyncExternalStore(subscribe, useMemo(() => snapshot(sport), [sport]), serverSnapshot);
  const filters = useMemo(() => parse(raw), [raw]);
  const set = useCallback((patch) => {
    const prev = parse(snapshot(sport)());
    const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
    try { window.localStorage.setItem(KEY(sport), JSON.stringify(next)); } catch { /* storage off */ }
    notify();
  }, [sport]);
  const reset = useCallback(() => { try { window.localStorage.removeItem(KEY(sport)); } catch { /* storage off */ } notify(); }, [sport]);
  return [filters, set, reset];
}

export const isDefault = (f) => f.minEv === DEFAULTS.minEv && f.maxJuice === DEFAULTS.maxJuice && f.minChance === DEFAULTS.minChance && f.sort === DEFAULTS.sort && !f.marginal && (f.group || 'all') === 'all';

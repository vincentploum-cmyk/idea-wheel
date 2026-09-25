'use client';

import { useSyncExternalStore } from 'react';

// Theme lives on <html data-theme>; the inline script in layout.js sets it before paint.
const KEY = 'nhlx-theme';
const listeners = new Set();
const read = () => (typeof document === 'undefined' ? 'dark' : document.documentElement.dataset.theme || 'dark');
const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };

export function setTheme(next) {
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(KEY, next); } catch {}
  listeners.forEach((cb) => cb());
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => 'dark');
  const dark = theme === 'dark';
  return (
    <button type="button" className="nhlx-theme" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>
      {dark ? '☀︎' : '☾'}
    </button>
  );
}

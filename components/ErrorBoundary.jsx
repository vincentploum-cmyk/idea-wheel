'use client';

import React from 'react';

/**
 * Contain a render failure to one section of a page.
 *
 * Without a boundary in between, a throw inside any component travels to the
 * nearest route `error.js` and, failing that, to `app/global-error.js` — which
 * replaces the whole application with "Something broke.". For a paid deliverable
 * that is the worst possible outcome: the founder loses the page, the site
 * chrome, and any sight of the work they were charged for.
 *
 * This keeps the blast radius at the subtree. Everything outside it — the
 * progress bar, the download buttons, the rest of the screen — carries on.
 *
 * Props:
 *   fallback  what to render instead of the failed subtree
 *   scope     label recorded on the error report, e.g. "blueprint-render"
 *   resetKey  change it to give the subtree another attempt (see below)
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, resetKey: props.resetKey };
    this.reported = null;
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // A changed resetKey means new data arrived, so the thing that threw may well
  // be gone. Retry rather than leaving the fallback up for the rest of the
  // session: one blueprint stage failing to render should not hide the three
  // that land after it. If the new data throws too, this just catches again —
  // one wasted render per key change, never a loop.
  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { failed: false, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error, info) {
    const message = error?.message || 'Unknown render error';
    // Each resetKey change retries the subtree, so the same bad data throws
    // again on every arriving stage. Report the fault once, not once per retry.
    if (this.reported === message) return;
    this.reported = message;
    try {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          message,
          stack: error?.stack || null,
          route: typeof window !== 'undefined' ? window.location.pathname : null,
          meta: {
            kind: this.props.scope || 'section-error',
            componentStack: String(info?.componentStack || '').slice(0, 2000),
          },
        }),
      }).catch(() => {});
    } catch {
      // the reporter must never become the thing that throws
    }
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}

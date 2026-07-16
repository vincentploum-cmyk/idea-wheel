'use client';

import { useEffect } from 'react';

/**
 * Root-level error boundary — Next.js renders this when a fatal error
 * escapes every other boundary (SSR error, client crash before hydration,
 * etc.). We POST the details to /api/errors so they land in error_events.
 *
 * `error.digest` is set by Next when the error came from a server component;
 * the full stack lives in server logs, but the digest lets us correlate.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    try {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          message: error?.message || 'Unknown client error',
          stack: error?.stack || null,
          route: typeof window !== 'undefined' ? window.location.pathname : null,
          meta: { digest: error?.digest || null, kind: 'global-error' },
        }),
      }).catch(() => {});
    } catch {
      // never let the reporter itself throw
    }
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, padding: '48px 24px', background: '#FFE000', color: '#111', fontFamily: 'Nunito, system-ui, sans-serif', minHeight: '100vh' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', border: '3px solid #111', background: '#fff', boxShadow: '6px 6px 0 #111', padding: '32px 28px' }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 900 }}>Something broke.</h1>
          <p style={{ margin: '0 0 20px', lineHeight: 1.5 }}>
            The error has been logged. You can try again, or go back to the homepage.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => reset()}
              style={{ background: '#FFE000', color: '#111', border: '2px solid #111', boxShadow: '3px 3px 0 #111', padding: '10px 20px', fontWeight: 900, cursor: 'pointer' }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{ background: '#111', color: '#FFE000', border: '2px solid #111', boxShadow: '3px 3px 0 #111', padding: '10px 20px', fontWeight: 900, textDecoration: 'none' }}
            >
              Home
            </a>
          </div>
          {error?.digest && (
            <p style={{ marginTop: 20, fontSize: 12, opacity: 0.6, fontFamily: 'monospace' }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}

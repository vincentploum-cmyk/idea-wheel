'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route-level boundary for /wheel — the screen where credits get spent.
 *
 * Without this, anything that throws here goes straight to app/global-error.js,
 * which replaces the entire application with a bare "Something broke." page:
 * no navigation, and no word on what happened to the blueprint the founder just
 * paid for. This keeps the site around them and says what to do next.
 *
 * It is a backstop, not a fix. Blueprint stages are normalized on both sides
 * (lib/blueprint-shape.js) so a drifting model cannot get here in the first
 * place; if this screen is being seen, something new is wrong and the report
 * below is how it gets found.
 */
export default function WheelError({ error, reset }) {
  useEffect(() => {
    try {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          message: error?.message || 'Unknown client error',
          stack: error?.stack || null,
          route: '/wheel',
          meta: { digest: error?.digest || null, kind: 'wheel-error' },
        }),
      }).catch(() => {});
    } catch {
      // never let the reporter itself throw
    }
  }, [error]);

  const btn = {
    display: 'inline-block',
    border: '2px solid #111',
    boxShadow: '3px 3px 0 #111',
    padding: '11px 20px',
    fontWeight: 900,
    fontSize: 14,
    fontFamily: 'inherit',
    textDecoration: 'none',
    cursor: 'pointer',
  };

  // Deliberately self-contained: no PopitoShell, no shared components. Whatever
  // threw is somewhere in this route's tree, and a fallback that re-renders the
  // same parts risks throwing again and escalating to the app-wide screen. Plain
  // markup and inline styles always draw.
  return (
    <div style={{ minHeight: '70vh', background: '#FFE000', fontFamily: 'Nunito, system-ui, sans-serif', color: '#111' }}>
      <div style={{ borderBottom: '3px solid #111', padding: '18px 24px' }}>
        <Link href="/" style={{ fontWeight: 900, fontSize: 20, color: '#111', textDecoration: 'none', letterSpacing: '-0.01em' }}>
          Idea ★ Reels
        </Link>
      </div>
      <div style={{ padding: '56px 24px' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', border: '3px solid #111', background: '#fff', boxShadow: '6px 6px 0 #111', padding: '32px 28px' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 26, fontWeight: 900 }}>This screen hit a snag.</h1>
        <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
          The error has been logged and we can see it. Nothing you have already
          paid for is lost.
        </p>
        <p style={{ margin: '0 0 22px', lineHeight: 1.6 }}>
          Every blueprint step that finished is saved to your idea as it
          completes. Open the idea from your profile to see what is there and
          carry on from the step it reached.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => reset()} style={{ ...btn, background: '#FFE000', color: '#111' }}>
            Try again
          </button>
          <Link href="/profile" style={{ ...btn, background: '#111', color: '#FFE000' }}>
            My ideas
          </Link>
          <Link href="/" style={{ ...btn, background: '#fff', color: '#111' }}>
            Home
          </Link>
        </div>
        {error?.digest && (
          <p style={{ marginTop: 22, fontSize: 12, opacity: 0.6, fontFamily: 'monospace' }}>
            Reference: {error.digest}
          </p>
        )}
      </div>
      </div>
    </div>
  );
}

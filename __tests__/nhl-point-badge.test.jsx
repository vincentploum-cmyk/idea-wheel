/**
 * The model's points flag on a rink chip (Vincent, 2026-11-27, of a cold Rantanen wearing the old 🔥: "how can there be
 * a flame for this player?"): a "1P 55%" badge, never a flame, so the flame / snowflake mean his form alone.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PointBadge } from '@/components/nhl/flags';

test('PointBadge: "1P" with his 1+ point chance when the model flags him, nothing otherwise', () => {
  const html = renderToStaticMarkup(<PointBadge m={{ fire: true, p1p: 0.554 }} />);
  expect(html).toContain('>1P 55%<');
  expect(html).toContain('is-info');
  expect(html).not.toContain('🔥');
  expect(renderToStaticMarkup(<PointBadge m={{ fire: true, p1p: null }} />)).toContain('>1P<');
  expect(renderToStaticMarkup(<PointBadge m={{ fire: false, p1p: 0.7 }} />)).toBe('');
  expect(renderToStaticMarkup(<PointBadge m={null} />)).toBe('');
});

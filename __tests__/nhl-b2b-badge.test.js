/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { playedLastNight, dayBefore } from '../lib/nhl-data/goalies-pure';
import { B2bBadge } from '../components/nhl/flags';

// Vincent, 2026-11-23: "Can we add a b2b badge next to the team name for nhl?"
describe('the NHL back-to-back badge', () => {
  const book = { teams: { TOR: { lastGame: '2026-11-22' }, MTL: { lastGame: '2026-11-20' }, BOS: {} } };
  test('a team that played the night before is on a back-to-back', () => {
    expect(dayBefore('2026-11-23')).toBe('2026-11-22');
    expect(playedLastNight(book, 'TOR', '2026-11-23')).toBe(true);
    expect(playedLastNight(book, 'MTL', '2026-11-23')).toBe(false);
    expect(playedLastNight(book, 'BOS', '2026-11-23')).toBe(false);
    expect(playedLastNight(book, 'NYR', '2026-11-23')).toBe(false);
    expect(playedLastNight(null, 'TOR', '2026-11-23')).toBe(false);
  });
  test('the badge reads B2B with what it is worth on the hover; nothing for a rested team', () => {
    const road = renderToStaticMarkup(React.createElement(B2bBadge, { team: 'TOR', b2b: true, venue: 'A' }));
    expect(road).toContain('>B2B<');
    expect(road).toContain('TOR played last night');
    expect(road).toContain('3.7% more');
    expect(renderToStaticMarkup(React.createElement(B2bBadge, { team: 'TOR', b2b: true, venue: 'H' }))).toContain('at home');
    expect(renderToStaticMarkup(React.createElement(B2bBadge, { team: 'TOR', b2b: false }))).toBe('');
  });
});

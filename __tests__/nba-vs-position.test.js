import { describe, expect, test } from '@jest/globals';
import { parseSummary } from '../lib/nba/espn';
import { positionBook, vsPositionRows, atPosition, vsPositionSummary, POS_TABS } from '../lib/nba/vs-position';
import summary from './fixtures/espn-nba-summary.json';

// What other players at his position did against the opponent (Vincent, 2026-10-31), from the stored box scores:
// MIA at ORL (the fixture), the card for an ORL opponent tonight.
const game = { date: '2026-10-26', ...parseSummary(summary) };

describe('players at a position against the opponent', () => {
  test('the position book: the depth chart slot first, then PropFinder’s roster position, G → SG and F → SF', () => {
    const pulls = [
      { data: { players: [{ key: 'klay thompson', pos: 'SG' }, { key: 'andrew wiggins', pos: 'F' }, { key: 'davion mitchell', pos: 'G' }], depth: { MIA: { PG: [{ key: 'davion mitchell', depth: 1 }], SG: [{ key: 'davion mitchell', depth: 2 }] } } } },
      { data: { players: [{ key: 'klay thompson', pos: 'PG' }] } },   // an older pull never overrides the first word
    ];
    const book = positionBook(pulls);
    expect(book['klay thompson']).toEqual({ pos: 'SG', from: 'propfinder' });
    expect(book['andrew wiggins']).toEqual({ pos: 'SF', from: 'propfinder' });
    expect(book['davion mitchell']).toEqual({ pos: 'PG', from: 'depth', depth: 1 });   // the first slot on the chart wins
    expect(positionBook(null)).toEqual({});
  });
  test('every MIA player who played against ORL, placed by the book, ESPN’s group for the rest; tonight’s own game left out', () => {
    const book = positionBook([{ data: { players: [{ key: 'klay thompson', pos: 'SG' }, { key: 'davion mitchell', pos: 'G' }] } }]);
    const rows = vsPositionRows([game], { opp: 'ORL', through: '2026-10-31', book, mine: { key: 'klay thompson' } });
    expect(rows.every((r) => r.team === 'MIA' && r.venue === 'A' && r.result === 'L' && r.score === '115–136')).toBe(true);
    expect(rows.find((r) => r.name === 'Pelle Larsson')).toBeUndefined();   // did not play
    const klay = rows.find((r) => r.name === 'Klay Thompson');
    expect(klay).toMatchObject({ pos: 'SG', posFrom: 'propfinder', mine: true, starter: true });
    expect(klay.pts).toBe(game.players.find((p) => p.name === 'Klay Thompson').pts);
    expect(rows.find((r) => r.name === 'Davion Mitchell')).toMatchObject({ pos: 'SG', posFrom: 'propfinder', mine: false });   // PropFinder's G reads at SG, as the board's envPosFor does
    expect(rows.find((r) => r.name === 'Andrew Wiggins')).toMatchObject({ pos: 'F', posFrom: 'espn' });
    // The most minutes first inside the game.
    for (let i = 1; i < rows.length; i++) expect(rows[i].min).toBeLessThanOrEqual(rows[i - 1].min);
    // The game of the night itself, or a later one, is not on the list; another opponent's game neither.
    expect(vsPositionRows([game], { opp: 'ORL', through: '2026-10-26', book })).toEqual([]);
    expect(vsPositionRows([game], { opp: 'BOS', through: '2026-10-31', book })).toEqual([]);
    expect(vsPositionRows([{ ...game, final: false }], { opp: 'ORL', through: '2026-10-31', book })).toEqual([]);
  });
  test('a position tab: the players placed there, and the unplaced whose ESPN group covers it', () => {
    const book = positionBook([{ data: { players: [{ key: 'klay thompson', pos: 'SG' }, { key: 'davion mitchell', pos: 'PG' }] } }]);
    const rows = vsPositionRows([game], { opp: 'ORL', through: '2026-10-31', book });
    expect(atPosition(rows, 'SG').map((r) => r.name)).toEqual(['Klay Thompson']);
    expect(atPosition(rows, 'PG').map((r) => r.name)).toEqual(['Davion Mitchell']);
    const forwards = atPosition(rows, 'SF').map((r) => r.name).sort();
    expect(forwards).toEqual(['Andrew Wiggins', 'Bobby Portis', 'Nikola Jovic']);   // ESPN's F reads at SF and PF alike
    expect(atPosition(rows, 'PF').map((r) => r.name).sort()).toEqual(forwards);
    expect(atPosition(rows, 'C')).toEqual([]);
    expect(POS_TABS).toEqual(['PG', 'SG', 'SF', 'PF', 'C']);
  });
  test('the summary at a position for a market and line', () => {
    const rows = vsPositionRows([game], { opp: 'ORL', through: '2026-10-31', book: {} });
    const guards = atPosition(rows, 'SG');
    const s = vsPositionSummary(guards, (r) => r.pts, 14.5);
    expect(s.n).toBe(guards.length);
    expect(s.games).toBe(1);
    expect(s.avg).toBeCloseTo(guards.reduce((a, r) => a + r.pts, 0) / guards.length, 1);
    expect(s.cleared).toBe(guards.filter((r) => r.pts > 14.5).length);
    expect(s.perGame).toBeCloseTo(guards.reduce((a, r) => a + r.pts, 0), 1);
    expect(vsPositionSummary([], (r) => r.pts)).toEqual({ n: 0, games: 0, avg: null, cleared: null, perGame: null });
  });
});

describe('the card’s table', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { VsPosition } = require('../components/nba/NbaPlayerCard');
  const book = positionBook([{ data: { players: [{ key: 'klay thompson', pos: 'SG' }, { key: 'davion mitchell', pos: 'PG' }] } }]);
  const rows = vsPositionRows([game], { opp: 'ORL', through: '2026-10-31', book, mine: { key: 'klay thompson' } });
  const data = { opp: 'ORL', through: '2026-10-31', games: 1, rows, positions: POS_TABS };
  test('opens on his position, reads the market column against the line, names PropFinder’s table figure', () => {
    const html = renderToStaticMarkup(React.createElement(VsPosition, { data, opp: 'ORL', myPos: 'SG', market: 'pts', line: 14.5, allowed: { SG: { pts: { value: 22.1, rank: 3 } } } }));
    expect(html).toContain('What SGs did against ORL');
    expect(html).toContain('Klay Thompson');
    expect(html).not.toContain('Davion Mitchell');   // a PG on the SG tab: no
    expect(html).toContain('1 stored game this season before tonight');
    expect(html).toContain('PropFinder&#x27;s table: 22.1');
    expect(html).toMatch(/is-on(?: is-(?:soft|tough))?/);
    expect(html).toContain('· him');   // his own game against them
    expect(html).toContain('aria-selected="true"');
  });
  test('without a stored game of theirs the table says so', () => {
    const html = renderToStaticMarkup(React.createElement(VsPosition, { data: { opp: 'BOS', games: 0, rows: [], positions: POS_TABS }, opp: 'BOS', myPos: 'C', market: 'reb', line: 9.5, allowed: null }));
    expect(html).toContain('No stored game of BOS this season yet');
    expect(html).toContain('What Cs did against BOS');
  });
});

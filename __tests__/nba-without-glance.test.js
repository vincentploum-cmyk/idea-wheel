/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NbaOutBoosts, { sortBoosts } from '../components/nba/NbaOutBoosts';
import { woBadge, woLine } from '../lib/picks/without-glance';
import { buildBoard } from '../lib/nba/picks';
import { OUT_BOOST } from '../lib/picks/out-boosts';

// Vincent, 2026-11-23, of Grimes with Reaves out (26 → 37 minutes, 8.0 → 25.5 points over 4 games): "I need to quickly see this".
describe('the with / without glance', () => {
  const grimes = { names: ['Reaves'], gpWith: 11, gpWithout: 4, big: true, stats: { min: { with: 26, without: 37.3, gap: 11.3 }, pts: { with: 8, without: 25.5, gap: 17.5 }, reb: { with: 2.5, without: 6, gap: 3.5 } } };

  test('the badge leads with the minutes when they move, green up, the whole split on the hover', () => {
    const b = woBadge(grimes);
    expect(b.text).toBe('w/o Reaves +11.3 min');
    expect(b.tone).toBe('soft');
    expect(b.title).toContain('Without Reaves (4 games this season): 37.3 min · 25.5 pts · 6 reb');
    expect(b.title).toContain('With (11 games): 26 min · 8 pts · 2.5 reb');
    expect(b.title).toContain('Gap: +11.3 min · +17.5 pts · +3.5 reb.');
    expect(b.title).toContain('landed near the board');
  });

  test('points lead when the minutes hardly move; a drop is red; a small split has no badge', () => {
    expect(woBadge({ ...grimes, stats: { min: { with: 30, without: 31, gap: 1 }, pts: { with: 12, without: 18, gap: 6 } } }).text).toBe('w/o Reaves +6 pts');
    expect(woBadge({ ...grimes, stats: { min: { with: 32, without: 24, gap: -8 }, pts: { with: 16, without: 6, gap: -10 } } })).toMatchObject({ text: 'w/o Reaves −8 min', tone: 'tough' });
    expect(woBadge({ ...grimes, big: false })).toBeNull();
    expect(woLine(null)).toBe('');
  });

  test('on the board: the player whose teammate is out carries the split, `big` past WO_GLANCE', () => {
    const games = [{ id: 'g1', date: '2026-11-23T00:30Z', away: 'LAL', home: 'DAL', final: false, state: 'pre' }];
    const log = (i, min, pts) => ({ gameId: `x${i}`, date: `2026-11-${String(20 - i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', min, pts, reb: 3, ast: 3, tpm: 1, stl: 1, blk: 0, tov: 1, pra: pts + 6 });
    // Grimes: games 0-3 without Reaves (37 min, 25 pts), 4-14 with him (26 min, 8 pts); Reaves played only 4-14.
    const grimesLogs = Array.from({ length: 15 }, (_, i) => (i < 4 ? log(i, 37, 25) : log(i, 26, 8)));
    const reavesLogs = Array.from({ length: 15 }, (_, i) => i).filter((i) => i >= 4).map((i) => log(i, 34, 24));
    const pf = { at: '2026-11-22T14:00:00Z', data: {
      players: [
        { id: 'p1', name: 'Quentin Grimes', key: 'quentin grimes', team: 'LAL', pos: 'SG', games: grimesLogs, props: [{ market: 'pts', line: 12.5, odds: -115 }] },
        { id: 'p2', name: 'Austin Reaves', key: 'austin reaves', team: 'LAL', pos: 'SG', injury: 'Out', games: reavesLogs, props: [] },
      ],
      injuries: { rows: [{ name: 'Austin Reaves', key: 'austin reaves', team: 'LAL', pos: 'SG', status: 'Out' }] },
      defense: null,
    } };
    const b = buildBoard({ date: '2026-11-22', season: 2026, games, sheets: [], pf, results: {} });
    const p = b.games[0].sides.LAL.players.find((x) => x.key === 'quentin grimes');
    expect(p.woSplit).toMatchObject({ names: ['Reaves'], gpWithout: 4, gpWith: 11, big: true });
    expect(p.woSplit.stats.min).toEqual({ with: 26, without: 37, gap: 11 });
    expect(p.woSplit.stats.pts).toEqual({ with: 8, without: 25, gap: 17 });
    expect(OUT_BOOST.big.games).toBe(2);
    const row = b.outBoosts.find((x) => x.key === 'quentin grimes');
    expect(row).toMatchObject({ team: 'LAL', out: { name: 'Austin Reaves', status: 'Out' }, gpWith: 11, gpWithout: 4, big: true });
    expect(row.stats.pts).toEqual({ with: 8, without: 25, gap: 17 });
    expect(row.proj.pts.line).toBe(12.5);
    // The Teammates out tab lists him, the gain first, with the figures the card shows.
    const html = renderToStaticMarkup(React.createElement(NbaOutBoosts, { board: b }));
    expect(html).toContain('Quentin Grimes');
    expect(html).toContain('Austin Reaves');
    expect(html).toContain('26 → <b>37</b>');
    expect(html).toContain('8 → <b>25</b>');
    expect(html).toContain('+11');
  });
});

// Vincent, 2026-11-24: "in the missing players view, make sure I can sort".
describe('the Teammates out tab sorts by every column', () => {
  const row = (player, out, gpWithout, min, pts, exp) => ({ player, out: { name: out }, gpWith: 10, gpWithout, stats: { min: { with: 20, without: 20 + min, gap: min }, pts: { with: 10, without: 10 + pts, gap: pts } }, proj: { pts: { exp } } });
  const rows = [row('Bronny James', 'Austin Reaves', 9, 10, 4.2, 7.9), row('Quentin Grimes', 'Austin Reaves', 4, 11.3, 17.5, 14.8), row('Ace Bailey', 'Lauri Markkanen', 2, 3, null, null)];
  const names = (list) => list.map((r) => r.player);
  test('a stat sorts by the gain, or by the average without him; nulls last whichever way', () => {
    expect(names(sortBoosts(rows, { key: 'min', dir: 'desc' }))).toEqual(['Quentin Grimes', 'Bronny James', 'Ace Bailey']);
    expect(names(sortBoosts(rows, { key: 'min', dir: 'asc' }))).toEqual(['Ace Bailey', 'Bronny James', 'Quentin Grimes']);
    rows[2].stats.pts = null;
    expect(names(sortBoosts(rows, { key: 'pts', dir: 'asc' }))).toEqual(['Bronny James', 'Quentin Grimes', 'Ace Bailey']);
    expect(names(sortBoosts(rows, { key: 'pts', dir: 'desc', by: 'without' }))).toEqual(['Quentin Grimes', 'Bronny James', 'Ace Bailey']);
  });
  test('the player, the out teammate, the games without and tonight\'s projection sort too', () => {
    expect(names(sortBoosts(rows, { key: 'player', dir: 'asc' }))).toEqual(['Ace Bailey', 'Bronny James', 'Quentin Grimes']);
    expect(names(sortBoosts(rows, { key: 'out', dir: 'asc' }))[0]).toBe('Bronny James');
    expect(names(sortBoosts(rows, { key: 'gp', dir: 'desc' }))).toEqual(['Bronny James', 'Quentin Grimes', 'Ace Bailey']);
    expect(names(sortBoosts(rows, { key: 'tonight', dir: 'desc' }))).toEqual(['Quentin Grimes', 'Bronny James', 'Ace Bailey']);
  });
  test('the headers are buttons with the sort arrow on the sorted one', () => {
    const html = renderToStaticMarkup(React.createElement(NbaOutBoosts, { board: { date: '2026-11-24', games: [{ id: 'g1', sides: {} }], outBoosts: rows.slice(0, 2).map((r) => ({ ...r, game: 'g1', team: 'LAL', opp: 'DAL', key: r.player })) } }));
    for (const l of ['Player', 'Out', 'GP w/o', 'MIN', 'PTS', 'Tonight']) expect(html).toContain(`<button type="button">${l}`);
    expect(html).toContain('aria-sort="descending"');
  });
});

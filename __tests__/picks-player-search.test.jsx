/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { matchScore, searchPlayers, nbaSearchList, nflSearchList } from '../lib/picks/player-search';
import PlayerSearch from '../components/picks/PlayerSearch';
import NflPlayer from '../components/nfl/NflPlayer';
import { buildBoard } from '../lib/nba/picks';

// The player search (Vincent, 2026-11-01: "I should be able to search on players for both nba and nfl").
const P = (name, team, extra = {}) => ({ id: `${name}|${team}`, name, team, opp: 'NY', ...extra });
const list = [P('Cade Cunningham', 'DET'), P('Jalen Duren', 'DET'), P('Jalen Brunson', 'NY', { opp: 'DET' }), P('Luka Dončić', 'LAL', { opp: 'GS' }), P('Jalen Green', 'HOU', { out: true, opp: 'SA' })];

describe('the player search', () => {
  test('a word starts his name or is his team, accents ignored, the surname first', () => {
    expect(searchPlayers(list, 'cade').map((p) => p.name)).toEqual(['Cade Cunningham']);
    expect(searchPlayers(list, 'cun').map((p) => p.name)).toEqual(['Cade Cunningham']);
    expect(searchPlayers(list, 'doncic').map((p) => p.name)).toEqual(['Luka Dončić']);
    expect(searchPlayers(list, 'det jalen').map((p) => p.name)).toEqual(['Jalen Duren']);
    // "Jalen": the ones who play first, the out player last.
    expect(searchPlayers(list, 'jalen').map((p) => p.name)).toEqual(['Jalen Brunson', 'Jalen Duren', 'Jalen Green']);
    expect(searchPlayers(list, 'zzz')).toEqual([]);
    expect(searchPlayers(list, '   ')).toEqual([]);
    expect(matchScore(list[0], 'cunningham')).toBeGreaterThan(matchScore(list[0], 'cade'));
  });
  test('the NBA slate and the NFL week as search lists', () => {
    const games = [{ id: 'g1', date: '2026-11-02T00:00Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }];
    const logs = Array.from({ length: 8 }, (_, i) => ({ date: `2026-10-${String(30 - i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', min: 34, pts: 22, reb: 6, ast: 5, tpm: 2, stl: 1, blk: 0, tov: 2 }));
    const pf = { at: '2026-11-01T14:00:00Z', data: { players: [{ id: 'p1', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SF', games: logs, props: [{ market: 'pts', line: 21.5, odds: -110, underOdds: -110, isMain: true }] }], defense: null } };
    const board = buildBoard({ date: '2026-11-01', season: 2026, games, sheets: [], pf, results: {} });
    const nba = nbaSearchList(board);
    expect(nba).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'jaylen brown', name: 'Jaylen Brown', team: 'BOS', opp: 'NY', venue: 'A', game: 'g1' })]));
    expect(nba.find((p) => p.key === 'jaylen brown').sub).toMatch(/PTS/);
    expect(nbaSearchList(null)).toEqual([]);
    const nflBoard = { projections: { rows: { 'puka nacua|LAR': { id: 'puka nacua|LAR', key: 'puka nacua', player: 'Puka Nacua', team: 'LAR', opp: 'SEA', venue: 'H', pos: 'WR', slot: 'WR', depth: 1, game: 'n1', td: { p: 0.42 }, yards: { rec_yds: { proj: 88 } } } } } };
    const nfl = nflSearchList(nflBoard);
    expect(nfl[0]).toMatchObject({ name: 'Puka Nacua', team: 'LAR', pos: 'WR1', sub: '88 rec yds · TD 42%' });
    expect(nflSearchList({})).toEqual([]);
  });
  test('the box and the NFL panel render', () => {
    expect(renderToStaticMarkup(<PlayerSearch players={list} onPick={() => {}} teamLogo={(t) => `/l/${t}.png`} />)).toContain('Search a player');
    const row = { id: 'x', player: 'Puka Nacua', team: 'LAR', opp: 'SEA', venue: 'H', pos: 'WR', slot: 'WR', depth: 1, final: false,
      td: { lambda: 0.55, p: 0.42, p1h: 0.24, pFirst: 0.09, p2: 0.11, spot: { pos: 'WR', rank: 3, count: 32 } },
      yards: { rec_yds: { proj: 88, floor: 55, ceiling: 120, line: 84.5, matchup: 1.05, spot: { pos: 'WR1', rank: 3, count: 32 }, tiers: { strong: { mark: 70, p: 0.66 }, lean: { mark: 90, p: 0.48 }, thin: { mark: 110, p: 0.31 } } } },
      big: { rec_yds: { marks: [100, 150], p: { 100: 0.36, 150: 0.08 } } } };
    const html = renderToStaticMarkup(<NflPlayer row={row} onClose={() => {}} />);
    for (const s of ['Puka Nacua', 'Anytime', '42%', 'Receiving yards', '70+ yds', 'lean 48%', 'WR1 #3', '×1.05', 'Big games', '100+']) expect(html).toContain(s);
  });
});

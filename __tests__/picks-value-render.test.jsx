/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SlateOverview, { MatchupCards } from '../components/picks/SlateOverview';
import SlateList from '../components/picks/SlateList';
import Ladder from '../components/picks/Ladder';
import { GroupTable, GameSummary } from '../components/picks/Board';
import { topPlays, DEFAULTS } from '../lib/picks/value';
import { buildBoard } from '../lib/nba/picks';
import { GROUPS } from '../lib/nba/markets';

// The overview, the Top Plays table, the ladder and a group table as the server first paints them (the restructure of
// 2026-10-31), on a board built from a synthetic pull: no runtime error, EV the headline, the marginal rows named.
const games = [{ id: 'g1', date: '2026-11-02T00:00Z', away: 'BOS', home: 'NY', final: false, state: 'pre', odds: { spread: 'BOS -12', total: 228.5 } }];
const logs = (f) => Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${String(31 - i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', min: 34, pts: 20, reb: 6, ast: 4, tpm: 1, stl: 1, blk: 0, tov: 2, ...f(i) }));
const player = (id, name, team, pos, f, props, min = 34) => ({ id, name, key: name.toLowerCase(), team, pos, games: logs((i) => ({ min, ...f(i) })), props });
const pf = { at: '2026-11-01T14:00:00Z', data: { players: [
  player('p1', 'Big Glass', 'BOS', 'C', (i) => ({ reb: 11 + (i % 3) }), [{ market: 'reb', line: 6.5, odds: -110, underOdds: -110, isMain: true, lines: [{ line: 4.5, odds: -300, underOdds: 220 }, { line: 6.5, odds: -110, underOdds: -110, main: true }, { line: 8.5, odds: 160, underOdds: -200 }] }]),
  player('p2', 'Steady Hands', 'BOS', 'PG', (i) => ({ ast: 5 + (i % 3) }), [{ market: 'ast', line: 5.5, odds: -110, underOdds: -110, isMain: true }]),
  player('p3', 'Bench Guy', 'NY', 'SG', (i) => ({ tpm: 2 + (i % 2) }), [{ market: 'tpm', line: 1.5, odds: -110, underOdds: -110, isMain: true }], 12),
], defense: null } };
const sport = { groups: GROUPS, teamLogo: (t) => `/logo/${t}.png`, teamName: (t) => t, headshotUrl: (id) => `/head/${id}.png`, totalStat: 'pts', totalUnit: 'points' };

describe('the value layer rendered', () => {
  const board = buildBoard({ date: '2026-11-01', season: 2026, games, sheets: [], pf, results: {} });
  const filters = { ...DEFAULTS, group: 'all' };
  test('the overview: the controls, the cards and the list, EV first', () => {
    const html = renderToStaticMarkup(<SlateOverview board={board} sport={sport} filters={filters} onFilters={() => {}} onGame={() => {}} />);
    expect(html).toContain('Min EV');
    expect(html).toContain('Top matchups');
    expect(html).toContain('BOS');
    expect(html).toContain('blowout risk');   // the 12-point spread on the NBA board
    expect(html).toContain('ir-sl-ev');
    const top = topPlays(board, filters);
    expect(top.length).toBeGreaterThan(0);
    expect(html).toContain(top[0].player);
    expect(html).not.toContain('Bench Guy');   // thin minutes: marginal, off the list at the defaults
    const withMarginal = renderToStaticMarkup(<SlateOverview board={board} sport={sport} filters={{ ...filters, marginal: true }} onFilters={() => {}} />);
    expect(withMarginal).toContain('Bench Guy');
    expect(withMarginal).toContain('thin minutes');
  });
  test('the cards alone and the game summary', () => {
    const cards = renderToStaticMarkup(<MatchupCards board={board} sport={sport} filters={filters} />);
    expect(cards).toContain('+EV play');
    const summary = renderToStaticMarkup(<div><GameSummary g={board.games[0]} /></div>);
    expect(summary).toContain('+EV');
    expect(summary).toContain('Top:');
  });
  test('the list with a given order and the ladder', () => {
    const rows = topPlays(board, { ...filters, sort: 'chance' });
    const html = renderToStaticMarkup(<SlateList board={board} sport={sport} rows={rows} filters={{ ...filters, sort: 'chance' }} />);
    expect(html).toContain('the likeliest first');
    expect(html).toContain('ladder');
    const rungs = board.games[0].sides.BOS.players.find((p) => p.key === 'big glass').ladders.reb;
    const ladder = renderToStaticMarkup(<Ladder rungs={rungs} side="over" unit="reb" label="Rebounds" />);
    expect(ladder).toContain('is-best');
    expect(ladder).toContain('is-main');
    expect(ladder).toContain('best value');
  });
  test('a group table: EV · Price · Chance, the marginal rows behind the switch', () => {
    const t = board.games[0].tables.threes;
    const closed = renderToStaticMarkup(<GroupTable label="Threes" t={t} final={false} sport={sport} filters={filters} marginal={false} />);
    expect(closed).toContain('>EV<');
    expect(closed).toContain('Marginal:');
    expect(closed).not.toContain('nhlx-db-player');   // the only threes play is thin: no row shows
    const open = renderToStaticMarkup(<GroupTable label="Threes" t={t} final={false} sport={sport} filters={filters} marginal />);
    expect(open).toContain('Bench Guy');
    expect(open).toContain('thin minutes');
    const own = renderToStaticMarkup(<GroupTable label="Threes" t={t} final={false} sport={sport} filters={filters} />);
    expect(own).toContain('Show marginal (1)');
    // Without filters the server's table stands as built: the fill-in to three, marked under.
    expect(renderToStaticMarkup(<GroupTable label="Threes" t={t} final={false} sport={sport} />)).toContain('is-under');
  });
});

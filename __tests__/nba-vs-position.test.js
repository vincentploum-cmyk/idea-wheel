import { describe, expect, test } from '@jest/globals';
import { parseSummary } from '../lib/nba/espn';
import { positionBook, vsPositionRows, atPosition, vsPositionSummary, POS_TABS, seasonProfiles, likeHim, similarLine } from '../lib/nba/vs-position';
import { LIKE_MIN_GAMES, profileText } from '../lib/nba/vs-position-pure';
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

describe('players like the card’s own, marked purple (Vincent, 2026-10-31)', () => {
  const line = (name, team, min, pts, reb, ast, tpm) => ({ name, team, played: true, min, pts, reb, ast, tpm });
  const night = (date, players, away = 'MIA', home = 'ORL') => ({ date, id: date, final: true, away, home, players });
  test('the bands: every figure inside his, from three games', () => {
    const me = { n: 6, min: 32, pts: 18, reb: 5, ast: 4, tpm: 2 };
    expect(similarLine(me, { n: 4, min: 30, pts: 15, reb: 6.2, ast: 3, tpm: 1.4 })).toBe(true);
    expect(similarLine(me, { n: 4, min: 30, pts: 12, reb: 6.2, ast: 3, tpm: 1.4 })).toBe(false);   // points 6 off: past 25% of 18
    expect(similarLine(me, { n: 2, min: 32, pts: 18, reb: 5, ast: 4, tpm: 2 })).toBe(false);       // two games: too few
    expect(similarLine({ n: 3, min: 12, pts: 4, reb: 2, ast: 0.5, tpm: 0.3 }, { n: 3, min: 15, pts: 6.5, reb: 3.3, ast: 1.8, tpm: 1 })).toBe(true);   // the floors hold a bench line
    expect(similarLine(me, null)).toBe(false);
    expect(LIKE_MIN_GAMES).toBe(3);
  });
  test('season profiles from the stored box scores before tonight; the card’s player and the look-alikes at his spot', () => {
    const results = [
      night('2026-10-22', [line('Jay Guard', 'MIA', 32, 18, 5, 4, 2), line('Lee Wing', 'MIA', 30, 16, 6, 3, 2), line('Big Man', 'MIA', 28, 10, 11, 1, 0)]),
      night('2026-10-24', [line('Jay Guard', 'MIA', 34, 20, 4, 5, 3), line('Lee Wing', 'MIA', 29, 14, 5, 4, 1), line('Big Man', 'MIA', 27, 12, 12, 2, 0)]),
      night('2026-10-26', [line('Jay Guard', 'MIA', 31, 16, 6, 4, 2), line('Lee Wing', 'MIA', 31, 17, 6, 3, 2), line('Big Man', 'MIA', 30, 9, 10, 1, 0)]),
      night('2026-10-31', [line('Jay Guard', 'MIA', 40, 40, 9, 9, 8)]),   // tonight: never in the profile
    ];
    const profiles = seasonProfiles(results, { through: '2026-10-31' });
    expect(profiles['jay guard']).toMatchObject({ n: 3, min: 97 / 3, pts: 18, reb: 5, ast: 13 / 3 });
    const rows = vsPositionRows(results, { opp: 'ORL', through: '2026-10-31', book: {}, mine: { key: 'jay guard' } });
    const like = likeHim(rows, profiles, profiles['jay guard']);
    expect(Object.keys(like.alike)).toEqual(['lee wing']);   // the big man's rebounds and points sit outside
    expect(likeHim(rows, profiles, null)).toBeNull();
    expect(profileText(profiles['lee wing'])).toBe('30 min · 15.7 PTS · 5.7 REB · 3.3 AST · 1.7 3PM a game over 3 games');
    // The card: his look-alikes' rows washed purple with a line naming how many, the market cell keeping its colour.
    const React = require('react');
    const { renderToStaticMarkup } = require('react-dom/server');
    const { VsPosition } = require('../components/nba/NbaPlayerCard');
    const placed = rows.map((r) => ({ ...r, pos: 'SG', posFrom: 'propfinder' }));
    const html = renderToStaticMarkup(React.createElement(VsPosition, { data: { opp: 'ORL', games: 3, rows: placed, positions: POS_TABS, like }, opp: 'ORL', myPos: 'SG', market: 'pts', line: 14.5, allowed: null }));
    expect(html).toContain('1 player at SG like him');
    expect((html.match(/class="is-like"/g) || []).length).toBe(3);   // Lee Wing's three games
    expect(html).toContain('· like him');
    expect(html).toContain('his line: 32 min · 18.0 PTS');
    expect(html).not.toMatch(/is-active is-like/);   // his own games are never purple
  });
});

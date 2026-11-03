import { describe, expect, test } from '@jest/globals';

// The player card's bars carry the attempts behind a made count: 3PA behind threes, FGA behind points
// (Vincent, 2026-11-03: "I need attempts in this view as well").
describe('the card\'s attempts outline', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { Bars, ATTEMPTS } = require('../components/nba/NbaPlayerCard');
  const games = [
    { date: '2026-11-01', opp: 'BKN', home: true, tpm: 3, tpa: 7, pts: 18, fgm: 7, fga: 14 },
    { date: '2026-10-31', opp: 'MIA', home: false, tpm: 2, tpa: 5, pts: 12, fgm: 5, fga: 11 },
    { date: '2026-10-28', opp: 'PHI', home: true, tpm: 0, tpa: 4, pts: 6, fgm: 3, fga: 9 },
  ];

  test('threes draw made / attempted over an outline', () => {
    expect(ATTEMPTS.tpm).toBe('tpa');
    const html = renderToStaticMarkup(React.createElement(Bars, { games, market: 'tpm', line: 1.5, unit: '3PM', showAtt: true }));
    expect((html.match(/nhlx-hist-total/g) || []).length).toBe(3);
    expect(html).toContain('3/7');
    expect(html).toContain('0/4');
  });

  test('off, or on a market without attempts, no outline', () => {
    expect(renderToStaticMarkup(React.createElement(Bars, { games, market: 'tpm', line: 1.5, unit: '3PM', showAtt: false }))).not.toContain('nhlx-hist-total');
    expect(renderToStaticMarkup(React.createElement(Bars, { games, market: 'reb', line: 4.5, unit: 'REB', showAtt: true }))).not.toContain('nhlx-hist-total');
  });

  test('a game without attempts draws its bar alone', () => {
    const html = renderToStaticMarkup(React.createElement(Bars, { games: [{ date: '2026-11-01', opp: 'BKN', tpm: 2 }], market: 'tpm', line: 1.5, unit: '3PM', showAtt: true }));
    expect(html).not.toContain('nhlx-hist-total');
  });
});

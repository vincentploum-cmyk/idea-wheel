import { describe, expect, test } from '@jest/globals';
import { parseSummary, parseScoreboard, tdScorer } from '../lib/nfl/espn';
import summary from './fixtures/espn-nfl-summary.json';

describe('ESPN NFL feeds', () => {
  test('a finished game’s box score: lines per player, touchdowns summed, the first scorer', () => {
    const g = parseSummary(summary);
    expect(g).toMatchObject({ id: '401872995', away: 'SEA', home: 'DEN', final: true, awayScore: 14, homeScore: 17 });
    const darnold = g.players.find((p) => p.name === 'Sam Darnold');
    expect(darnold).toMatchObject({ team: 'SEA', passCmp: 27, passAtt: 51, passYds: 278, passTd: 0, passInt: 2, espnId: '3912547' });
    const jsn = g.players.find((p) => p.name === 'Jaxon Smith-Njigba');
    expect(jsn).toMatchObject({ rec: 12, recYds: 134, recTd: 0, tgt: 16, recLong: 32, td: 0, rushRecYds: 134 });
    expect(g.firstTd).toEqual({ name: 'J.K. Dobbins', team: 'DEN' });
    const dobbins = g.players.find((p) => p.name === 'J.K. Dobbins');
    expect(dobbins).toMatchObject({ rushTd: 1, td: 1, firstTd: 1 });
    expect(g.players.filter((p) => p.td > 0).map((p) => p.name).sort()).toEqual(['George Holani', 'J.K. Dobbins', 'RJ Harvey']);
  });
  test('scoring-play text', () => {
    expect(tdScorer('J.K. Dobbins 4 Yd Rush (Wil Lutz Kick)')).toBe('J.K. Dobbins');
    expect(tdScorer('Jaxon Smith-Njigba 12 Yd pass from Sam Darnold (Jason Myers Kick)')).toBe('Jaxon Smith-Njigba');
    expect(tdScorer('')).toBeNull();
  });
  test('the scoreboard: games with venue, state and odds', () => {
    const j = { season: { year: 2026, type: 2 }, week: { number: 7, teamsOnBye: [{ abbreviation: 'CIN' }] }, events: [
      { id: '1', date: '2026-10-25T17:00Z', status: { type: { state: 'pre', completed: false, shortDetail: '10/25 - 1:00 PM EDT' } }, competitions: [{ competitors: [{ homeAway: 'home', team: { abbreviation: 'KC' }, score: '0' }, { homeAway: 'away', team: { abbreviation: 'BUF' }, score: '0' }], odds: [{ details: 'KC -2.5', overUnder: 48.5 }] }] },
      { id: '2', date: '2026-10-23T00:15Z', status: { type: { state: 'post', completed: true, shortDetail: 'Final' } }, competitions: [{ competitors: [{ homeAway: 'home', team: { abbreviation: 'WSH' }, score: '21' }, { homeAway: 'away', team: { abbreviation: 'DAL' }, score: '24' }] }] },
    ] };
    const s = parseScoreboard(j);
    expect(s).toMatchObject({ season: 2026, week: 7, byes: ['CIN'] });
    expect(s.games.map((g) => g.id)).toEqual(['2', '1']);
    expect(s.games[1]).toMatchObject({ away: 'BUF', home: 'KC', state: 'pre', final: false, awayScore: null, odds: { spread: 'KC -2.5', total: 48.5 } });
    expect(s.games[0]).toMatchObject({ away: 'DAL', home: 'WSH', final: true, awayScore: 24, homeScore: 21 });
  });
});

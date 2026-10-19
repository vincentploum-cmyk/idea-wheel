import { describe, expect, test } from '@jest/globals';
import { gameRow, playerProps, mapPlayers, defenseAllowed, fieldsSeen, pickRow } from '../lib/nfl/propfinder-nfl';

const GAME = { gameDate: '2026-10-12T17:00:00Z', season: 2026, seasonType: 'REG', isHomeGame: true, opponent: { code: 'KC' }, passingYards: 301, passingTouchdowns: 2, completions: 24, passingAttempts: 33, interceptions: 1, rushingAttempts: 5, rushingYards: 22, rushingTouchdowns: 1, weirdStat: 3 };
const PLAYER = { id: 'p1', name: 'Josh Allen', positionAbbreviation: 'QB', status: 'ACT', team: { code: 'BUF' }, stats: [GAME, { ...GAME, gameDate: '2026-10-05T17:00:00Z', passingYards: 210 }], odds: [{ market: 'Passing Yards', line: 245.5, overOdds: -115, underOdds: -105, book: 'DK' }, { marketName: 'Anytime Touchdown Scorer', value: 0.5, odds: '+150' }, { market: 'Nothing known', line: 1 }] };

describe('PropFinder NFL mapping', () => {
  test('a game row through the field spellings; absent fields read as 0', () => {
    const g = gameRow(GAME);
    expect(g).toMatchObject({ date: '2026-10-12', season: 2026, type: 'REG', home: true, opp: 'KC', passYds: 301, passTd: 2, passCmp: 24, passAtt: 33, passInt: 1, rushAtt: 5, rushYds: 22, rushTd: 1, rec: 0, recYds: 0, td: 1, passRushYds: 323, rushRecYds: 22 });
    expect(gameRow({ gameDate: '2026-10-12', receivingYards: 80, receptions: 6, targets: 9, kickReturnTouchdowns: 1, opponentTeam: { code: 'WAS' } })).toMatchObject({ recYds: 80, rec: 6, tgt: 9, retTd: 1, td: 1, opp: 'WSH' });
  });
  test('prop lines on a player, unknown markets dropped', () => {
    expect(playerProps(PLAYER)).toEqual([
      { market: 'pass_yds', line: 245.5, odds: -115, underOdds: -105, book: 'DK' },
      { market: 'anytime_td', line: 0.5, odds: 150, underOdds: null, book: null },
    ]);
    const players = mapPlayers([PLAYER, { name: '' }]);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ id: 'p1', name: 'Josh Allen', key: 'josh allen', team: 'BUF', pos: 'QB' });
    expect(players[0].games.map((g) => g.date)).toEqual(['2026-10-12', '2026-10-05']); // newest first
  });
  test('the keys the API used, with the ones this file does not read', () => {
    const seen = fieldsSeen([PLAYER], []);
    expect(seen.game).toContain('passingYards');
    expect(seen.unread).toEqual(['weirdStat']);
    expect(seen.prop).toContain('overOdds');
  });
  test('what each defense allows per position, ranked 1 = most', () => {
    const row = (code, pos, recYds, gp = 6) => ({ type: 'Opponent', position: pos, seasonYear: 2026, gamesPlayed: gp, receivingYards: recYds, receptions: gp * 5, receivingTouchdowns: 2 });
    const teams = [
      { code: 'KC', stats: [row('KC', 'WR', 900), row('KC', 'TE', 300), { type: 'Team', position: 'WR', seasonYear: 2026, gamesPlayed: 6, receivingYards: 5 }] },
      { code: 'BUF', stats: [row('BUF', 'WR', 600), row('BUF', 'TE', 420)] },
      { code: 'DAL', stats: [row('DAL', 'WR', 1200), { ...row('DAL', 'TE', 240), seasonYear: 2025, gamesPlayed: 17 }] },
    ];
    const d = defenseAllowed(teams, { season: 2026 });
    expect(d.count).toBe(3);
    expect(d.teams.KC.WR).toMatchObject({ gp: 6, recYds: 150, rec: 5, recTd: 0.33, td: 0.33 });
    expect(d.ranks.DAL.WR.recYds).toBe(1);
    expect(d.ranks.KC.WR.recYds).toBe(2);
    expect(d.ranks.BUF.WR.recYds).toBe(3);
    // DAL has no TE row this season: last season's stands in.
    expect(d.teams.DAL.TE).toMatchObject({ season: 2025, recYds: 14.12 });
    expect(pickRow(teams[0].stats, { season: 2026, position: 'WR' }).receivingYards).toBe(900);
    expect(pickRow(teams[0].stats, { season: 2026, position: 'WR', lastN: 5 })).toBeNull();
  });
});

/**
 * The D share of power-play shots on the Defense tab (Vincent, 2026-11-12): each skater's power-play shots on goal
 * from the play-by-play's situationCode (`ppSog` on the stored rows), summed per defending team and position, and the
 * overview's share of them that defensemen took.
 */
import { ppShotsOf, ppGoalsOf, stampPpShots } from '../lib/nhl-data/game';
import { ROW_FIELDS, toRow, rowObj } from '../lib/nhl-data/ingest';
import { defenseByPosition } from '../lib/nhl-data/defense';
import { overviewRows, OVERVIEW_COLS, PP_SHARE_MIN } from '../lib/nhl-data/defense-board';

// situationCode: away goalie, away skaters, home skaters, home goalie.
const shot = (id, code, type = 'shot-on-goal', periodType = 'REG') => ({ typeDescKey: type, situationCode: code, periodDescriptor: { number: 2, periodType }, details: { shootingPlayerId: id } });

describe('power-play shots from the play-by-play', () => {
  const homeOf = { 1: true, 2: false };
  test('the shooter\'s side has more skaters and the other goalie is in net', () => {
    const plays = [
      shot(1, '1451'),                      // home on a 5-on-4: PP
      shot(1, '1551'),                      // even: no
      shot(2, '1541'),                      // away on a 5-on-4: PP
      shot(2, '1451'),                      // away short-handed: no
      shot(1, '0651'),                      // the away net empty: no
      { ...shot(1, '1351'), typeDescKey: 'goal', details: { scoringPlayerId: 1 } },   // a power-play goal counts
      shot(1, '1451', 'missed-shot'),       // a miss is not a shot on goal
      shot(1, '1451', 'shot-on-goal', 'SO'), // the shootout is out
      shot(9, '1451'),                      // not in the game's skaters
    ];
    expect(ppShotsOf(plays, homeOf)).toEqual({ 1: 2, 2: 1 });
    expect(ppShotsOf([{ ...shot(1, 1451) }], homeOf)).toEqual({ 1: 1 });   // a numeric code reads the same
  });
  test('stamped on every skater (0 without one) and carried on the stored row as the last column', () => {
    const game = { date: '2026-11-10', id: 2026020200, skaters: [{ id: 1, venue: 'H' }, { id: 2, venue: 'A' }, { id: 3, venue: 'A' }] };
    stampPpShots(game, [shot(1, '1451'), shot(2, '1541'), shot(2, '1541')]);
    expect(game.skaters.map((s) => s.ppSog)).toEqual([1, 2, 0]);
    expect(ROW_FIELDS.slice(-2)).toEqual(['ppSog', 'ppG']);   // ppG: his power-play goals, the last column since 2026-11-14
    expect(rowObj(toRow(game, game.skaters[1])).ppSog).toBe(2);
    expect(rowObj(toRow(game, { id: 4 })).ppSog).toBeNull();   // a game stamped before the column
    expect(game.skaters.map((s) => s.ppG)).toEqual([0, 0, 0]);
    const g2 = { date: '2026-11-10', id: 2026020201, skaters: [{ id: 1, venue: 'H' }, { id: 2, venue: 'A' }] };
    stampPpShots(g2, [{ ...shot(1, '1451'), typeDescKey: 'goal', details: { scoringPlayerId: 1 } }, shot(1, '1451'), { ...shot(2, '1551'), typeDescKey: 'goal', details: { scoringPlayerId: 2 } }]);
    expect(g2.skaters.map((s) => [s.ppSog, s.ppG])).toEqual([[2, 1], [0, 0]]);   // an even-strength goal is not one
    expect(ppGoalsOf([{ ...shot(1, '1451'), typeDescKey: 'goal', details: { scoringPlayerId: 1 } }], { 1: true })).toEqual({ 1: 1 });
    expect(rowObj(toRow(g2, g2.skaters[0])).ppG).toBe(1);
    expect(rowObj(toRow(g2, { id: 4 })).ppG).toBeNull();
  });
});

describe('the overview\'s D share', () => {
  // BOS defends in each game: MTL shooters at C / D, ppSog per row.
  const row = (gameId, date, pos, ppSog, opp = 'BOS', team = 'MTL') => ({ date, gameId, team, opp, venue: 'A', pos, g: 0, a: 0, sog: ppSog + 2, icf: 4, iff: 3, iscf: 1, ihdcf: 0, ppSog });
  const games = [1, 2, 3, 4].map((i) => [row(i, `2026-11-0${i}`, 'C', 2), row(i, `2026-11-0${i}`, 'LW', 1), row(i, `2026-11-0${i}`, 'D', 1)]).flat();
  test('the share of the power-play shots on goal allowed that defensemen took, with the counts and the league\'s', () => {
    const rows = overviewRows(defenseByPosition(games), {}, { venue: 'ALL' });
    const bos = rows.find((r) => r.abbr === 'BOS');
    expect(bos).toMatchObject({ pp: 16, ppToD: 4, ppD: 0.25, ppLeague: 0.25 });
    expect(bos.rank.ppD).toBe(1);
    expect(OVERVIEW_COLS.find((c) => c.key === 'ppD')).toMatchObject({ pct: true });
  });
  test('no share under the floor, nor for games stored before the column', () => {
    const few = games.filter((r) => r.gameId === 1);   // 4 power-play shots
    expect(overviewRows(defenseByPosition(few), {}).find((r) => r.abbr === 'BOS')).toMatchObject({ pp: 4, ppD: null });
    expect(PP_SHARE_MIN).toBe(10);
    const old = games.map(({ ppSog, ...r }) => r);
    expect(overviewRows(defenseByPosition(old), {}).find((r) => r.abbr === 'BOS')).toMatchObject({ pp: 0, ppD: null });
  });
});

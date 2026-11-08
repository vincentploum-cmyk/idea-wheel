import { describe, expect, test } from '@jest/globals';
import { startersCheck } from '../lib/nba/starters-check';

// Vincent, 2026-11-08: "compare their starters against ours" — PropFinder's starters (the Defensive Matchups answer, per
// side and position: the starter the side's defense faces) against RotoWire's five and the board's spot per player.
const rows = [
  // IND's defense faces DET's starters; DET's faces IND's.
  { team: 'IND', opp: 'DET', pos: 'PG', starters: [{ name: 'Cade Cunningham', team: 'DET', position: 'PG', lineupStatus: 'confirmed' }] },
  { team: 'IND', opp: 'DET', pos: 'SG', starters: [{ name: 'Jaden Ivey', team: 'DET', position: 'SG' }] },
  { team: 'IND', opp: 'DET', pos: 'C', starters: [{ name: 'Jalen Duren', team: 'DET', position: 'C' }] },
  { team: 'DET', opp: 'IND', pos: 'PG', starters: [{ name: 'Andrew Nembhard', team: 'IND', position: 'SG' }] },
  { team: 'DET', opp: 'IND', pos: 'SG', starters: [{ name: 'Ben Sheppard', team: 'IND', position: 'SG' }] },
];
const lineups = { teams: {
  DET: { status: 'expected', starters: [{ pos: 'PG', name: 'Cade Cunningham' }, { pos: 'SG', name: 'Jaden Ivey' }, { pos: 'C', name: 'Jalen Duren' }] },
  IND: { status: 'confirmed', starters: [{ pos: 'PG', name: 'Andrew Nembhard' }, { pos: 'SG', name: 'Bennedict Mathurin' }] },
} };
const board = { games: [{ sides: {
  DET: { players: [{ key: 'cade cunningham', player: 'Cade Cunningham', envPos: 'PG' }, { key: 'jaden ivey', player: 'Jaden Ivey', envPos: 'SG' }, { key: 'jalen duren', player: 'Jalen Duren', envPos: 'C' }] },
  IND: { players: [
    { key: 'andrew nembhard', player: 'Andrew Nembhard', envPos: 'SG', lineup: { role: 'starter', share: 1 } },
    { key: 'ben sheppard', player: 'Ben Sheppard', envPos: 'SG', lineup: { role: 'bench', share: 0.2 } },
    { key: 'bennedict mathurin', player: 'Bennedict Mathurin', envPos: 'SG', lineup: { role: 'starter', share: 0.9 } },
  ] },
} }] };

describe('PropFinder starters against ours', () => {
  test('the same five, a different one with the role it would mean on the board, and the slots three ways', () => {
    const { teams, summary } = startersCheck({ rows, lineups, board });
    const det = teams.find((t) => t.team === 'DET');
    expect(det).toMatchObject({ opp: 'IND', rotowireStatus: 'expected', sameFive: true, onlyTheirs: [], onlyOurs: [] });
    expect(det.slots).toEqual([
      { name: 'Cade Cunningham', theirs: 'PG', rotowire: 'PG', board: 'PG' },
      { name: 'Jaden Ivey', theirs: 'SG', rotowire: 'SG', board: 'SG' },
      { name: 'Jalen Duren', theirs: 'C', rotowire: 'C', board: 'C' },
    ]);
    const ind = teams.find((t) => t.team === 'IND');
    expect(ind.sameFive).toBe(false);
    // Sheppard (2 starts in 10) in PropFinder's five alone: a promotion the board does not make; Mathurin the other way.
    expect(ind.onlyTheirs).toEqual([{ name: 'Ben Sheppard', slot: 'SG', role: 'bench', share: 0.2 }]);
    expect(ind.onlyOurs).toEqual([{ name: 'Bennedict Mathurin', pos: 'SG', role: 'starter', share: 0.9 }]);
    // Nembhard: PropFinder's PG slot, RotoWire's PG, the board reads him at SG.
    expect(ind.slots).toEqual([{ name: 'Andrew Nembhard', theirs: 'PG', rotowire: 'PG', board: 'SG' }]);
    expect(summary).toEqual({
      teams: 2, compared: 2, sameFive: 1, inBoth: 4, onlyTheirs: 1, onlyOurs: 1,
      slotVsRotowire: { same: 4, of: 4, share: 1 }, slotVsBoard: { same: 3, of: 4, share: 0.75 },
      theirPromotions: 1, theirDemotions: 1,
    });
  });

  test('a team with no five on one side is listed, not compared', () => {
    const { teams, summary } = startersCheck({ rows: rows.slice(0, 3), lineups: { teams: { IND: lineups.teams.IND } }, board });
    expect(teams.map((t) => [t.team, t.sameFive])).toEqual([['DET', null], ['IND', null]]);
    expect(summary).toMatchObject({ teams: 2, compared: 0, sameFive: 0 });
  });
});

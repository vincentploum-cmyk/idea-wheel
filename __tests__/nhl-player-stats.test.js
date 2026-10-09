import { describe, expect, test, jest } from '@jest/globals';

const mockStored = new Map();
jest.mock('../lib/nhl-store', () => ({
  readJson: async (path) => mockStored.get(path) ?? null,
  writeJson: async (path, value) => { mockStored.set(path, value); },
  memoizeByInputs: (load, compute) => async (...args) => compute(...(await load(...args))),
}));

const { buildPlayerStats, toBuffer } = require('../lib/nhl-data/build');
const { rowsPath, ROW_FIELDS } = require('../lib/nhl-data/ingest');
const { PLAYERS_PATH } = require('../lib/nhl-data/rosters');
const { parsePlayerHomeAway } = require('../components/nhl/model-core');

// One stored skater-game row in the stored (array) layout.
const row = ({ date, gameId, id, name, team, opp, venue, pos, toi, g, a, sog, icf, iff, iscf }) => {
  const o = { date, gameId, playerId: id, name, team, opp, venue, pos, toi, g, a, sog, hits: 0, blk: 0, icf, iff, isf: sog, iscf, ihdcf: 0, result: 'W', posSrc: 'lineup', boxPos: pos, line: 1, fg: 0 };
  return ROW_FIELDS.map((k) => o[k]);
};

describe('the home / away workbook the auto run builds', () => {
  test('parses through the model’s own parser with every field in its place', async () => {
    const games = [];
    // A depth defenseman: 0.2 shots a game, nothing in his last five away games.
    const smits = { id: 1, name: 'Alberts Smits', team: 'NYR', pos: 'D' };
    const dates = ['2026-09-29', '2026-10-01', '2026-10-03', '2026-10-05', '2026-10-07', '2026-10-08'];
    dates.forEach((date, i) => games.push(row({ date, gameId: 100 + i, ...smits, opp: 'PHI', venue: i % 2 ? 'H' : 'A', toi: 14, g: 0, a: 0, sog: i === 1 ? 1 : 0, icf: 1, iff: 1, iscf: 0 })));
    // A top winger: 3.5 shots at home, 2.5 away, 0.5 goals a game.
    const star = { id: 2, name: 'Artemi Panarin', team: 'NYR', pos: 'LW' };
    dates.forEach((date, i) => games.push(row({ date, gameId: 100 + i, ...star, opp: 'PHI', venue: i % 2 ? 'H' : 'A', toi: 20, g: i % 2 ? 1 : 0, a: 1, sog: i % 2 ? 3.5 : 2.5, icf: 6, iff: 5, iscf: 2 })));
    mockStored.set(rowsPath('20262027'), { updatedAt: 'x', rows: games });
    mockStored.set(PLAYERS_PATH, { players: { 1: { ...smits }, 2: { ...star } } });

    const built = await buildPlayerStats('2026-10-09');
    expect(built.players).toBe(2);
    const parsed = parsePlayerHomeAway(toBuffer(built.wb).toString('binary'));

    const p = parsed['artemi panarin'];
    expect(p.team).toBe('Rangers');
    expect(p.pos).toBe('LW');
    expect(p.sog_home).toBe(3.5);
    expect(p.sog_away).toBe(2.5);
    expect(p.base_shots_home).toBe(3.5);
    expect(p.base_shots_away).toBe(2.5);
    expect(p.g_home).toBe(1);
    expect(p.g_away).toBe(0);
    expect(p.toi_home).toBe(20);
    expect(p.sog_l5_home).toBe(3.5);
    expect(p.sog_l5_away).toBe(2.5);
    expect(p.base_plus_form_home).toBe(3.5);
    expect(p.base_plus_form_away).toBe(2.5);
    expect(p.iff_home).toBe(5);
    expect(p.iscf_away).toBe(2);

    // The depth defenseman keeps his own tiny base (his one shot came at home): the away base is
    // zero, not his games-played count, and nothing reads shots as goals.
    const d = parsed['alberts smits'];
    expect(d.base_shots_home).toBeCloseTo(0.33, 2);
    expect(d.base_shots_away).toBe(0);
    expect(d.base_plus_form_away).toBe(0);
    expect(d.sog_l5_away).toBe(0);
    expect(d.g_home).toBe(0);
    expect(d.g_away).toBe(0);
    expect(d.toi_away).toBe(14);
  });
});

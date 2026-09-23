import { describe, expect, test } from '@jest/globals';
import { buildGameRecord, shotMetrics, locationValue, toiMinutes } from '../lib/nhl-data/game';
import { lineupRows } from '../lib/nhl-data/lineups';
import { teamAbbrFromText } from '../lib/nhl-data/teams';
import { boxscore, playByPlay, PREVIEW_MD } from './fixtures/nhl';

describe('game records', () => {
  const g = buildGameRecord(boxscore(), playByPlay());
  const by = Object.fromEntries(g.skaters.map((s) => [s.name, s]));

  test('full names, positions, venue and result', () => {
    expect(by['Brady Tkachuk']).toMatchObject({ team: 'OTT', opp: 'ANA', venue: 'H', pos: 'LW', result: 'W', g: 2 });
    expect(by['Leo Carlsson']).toMatchObject({ team: 'ANA', opp: 'OTT', venue: 'A', pos: 'C', result: 'L' });
    expect(by['Tim Stützle'].toi).toBeCloseTo(15.5, 5);
    expect(g.skaters).toHaveLength(8);
    expect(g.goalies.find((x) => x.name === 'Linus Ullmark')).toMatchObject({ sa: 24, ga: 1, decision: 'W' });
  });

  test('shot attempt metrics', () => {
    // Tkachuk: SOG + goal + miss + block
    expect(by['Brady Tkachuk']).toMatchObject({ icf: 4, iff: 3, iscf: 2, ihdcf: 2 });
    // Stützle rush shot from the mid slot counts as a high-danger chance (2 + rush)
    expect(by['Tim Stützle']).toMatchObject({ icf: 1, iff: 1, iscf: 1, ihdcf: 1 });
    // Gauthier: mid-slot goal is a chance, far miss is not
    expect(by['Cutter Gauthier']).toMatchObject({ icf: 2, iff: 2, iscf: 1, ihdcf: 0 });
  });

  test('non-final games are skipped', () => {
    expect(buildGameRecord({ ...boxscore(), gameState: 'LIVE' }, playByPlay())).toBeNull();
  });

  test('helpers', () => {
    expect(toiMinutes('19:33')).toBeCloseTo(19.55, 2);
    expect(toiMinutes('')).toBe(0);
    expect(locationValue(85, 0)).toBe(3);
    expect(locationValue(-50, 18)).toBe(2);
    expect(locationValue(20, 30)).toBe(1);
    expect(Object.keys(shotMetrics([]))).toHaveLength(0);
  });
});

describe('lineups', () => {
  test('preview markdown becomes the lineup rows the model reads', () => {
    const rows = lineupRows(PREVIEW_MD);
    expect(rows[0]).toBe('DUCKS (36-26-3) at SENATORS (32-23-9)');
    expect(rows).toContain('Ducks projected lineup');
    expect(rows).toContain('Chris Kreider -- Leo Carlsson -- Cutter Gauthier');
    expect(rows).toContain('Scratched: Frank Vatrano, Ross Johnston');
    expect(rows).toContain('Senators projected lineup');
    expect(rows.at(-1)).toBe('Carlsson is likely to play. Read more');
    expect(rows.join(' ')).not.toMatch(/forge-entity|\*\*/);
  });
});

describe('team names', () => {
  test('PropFinder block titles resolve to abbreviations', () => {
    expect(teamAbbrFromText('Ducks')).toBe('ANA');
    expect(teamAbbrFromText('Maple Leafs')).toBe('TOR');
    expect(teamAbbrFromText('Blue Jackets')).toBe('CBJ');
    expect(teamAbbrFromText('Golden Knights')).toBe('VGK');
    expect(teamAbbrFromText('Mammoth')).toBe('UTA');
    expect(teamAbbrFromText('Wild')).toBe('MIN');
    expect(teamAbbrFromText('nonsense')).toBeNull();
  });
});

import { diffPlayers, applyOverrides } from '../lib/nhl-data/rosters';

describe('roster database', () => {
  const prev = {
    1: { id: 1, name: 'A One', team: 'TOR', pos: 'C', number: 11 },
    2: { id: 2, name: 'B Two', team: 'MTL', pos: 'D', number: 2 },
    3: { id: 3, name: 'C Three', team: 'BOS', pos: 'LW', number: 33 },
  };
  const next = {
    1: { id: 1, name: 'A One', team: 'TOR', pos: 'RW', number: 11 },
    2: { id: 2, name: 'B Two', team: 'NYR', pos: 'D', number: 2 },
    4: { id: 4, name: 'D Four', team: 'SEA', pos: 'C', number: 44 },
  };

  test('logs trades, position changes, additions and removals', () => {
    const c = diffPlayers(prev, next, 'now');
    expect(c).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 1, type: 'pos-changed', from: 'C', to: 'RW' }),
      expect.objectContaining({ id: 2, type: 'moved', from: 'MTL', to: 'NYR' }),
      expect.objectContaining({ id: 4, type: 'added', to: 'SEA' }),
      expect.objectContaining({ id: 3, type: 'removed', from: 'BOS' }),
    ]));
    expect(c).toHaveLength(4);
  });

  test('overrides win and can add unknown players', () => {
    const out = applyOverrides(next, { 2: { team: 'MTL', note: 'trade not official yet' }, 99: { name: 'New Guy', team: 'UTA', pos: 'C' } });
    expect(out[2]).toMatchObject({ team: 'MTL', note: 'trade not official yet', overridden: true });
    expect(out[99]).toMatchObject({ name: 'New Guy', team: 'UTA', pos: 'C', overridden: true });
    expect(out[1].overridden).toBeUndefined();
  });
});

import { matchNames, normName } from '../lib/nhl-data/names';

describe('name matching', () => {
  const players = {
    1: { id: 1, name: 'Tim Stützle', team: 'OTT' },
    2: { id: 2, name: 'Matthew Tkachuk', team: 'FLA' },
    3: { id: 3, name: 'Brady Tkachuk', team: 'OTT' },
    4: { id: 4, name: 'Mitchell Marner', team: 'VGK' },
  };
  test('diacritics match silently, nicknames map to the PropFinder spelling', () => {
    const { display, unmatched } = matchNames(players, {
      'Tim Stutzle': { team: 'OTT' },
      'Matt Tkachuk': { team: 'FLA' },
      'Brady Tkachuk': { team: 'OTT' },
      'Mitch Marner': { team: 'VGK' },
      'Nobody Here': { team: 'TOR' },
    });
    expect(display).toEqual({ 2: 'Matt Tkachuk', 4: 'Mitch Marner' });
    expect(unmatched.map((u) => u.name)).toEqual(['Nobody Here']);
    expect(normName('J.T. Miller C')).toBe('jt miller');
  });
});

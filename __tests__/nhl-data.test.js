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

import { describe, expect, test } from '@jest/globals';
import { summarizeRun, TEAM_LOGO_ABBR, normTeam } from '../components/nhl/model-core';

describe('model-core run summary (used by the browser and the server auto run)', () => {
  test('summarizeRun names the slate, its games and the top picks without the UI module', () => {
    const files = { season: { name: 'NHL-Goal-Matchups-2026-10-01.xlsx' }, l5: { name: 'NHL-Goal-Matchups-2026-10-01-L5.xlsx' } };
    const games = [{ label: 'Penguins @ Flyers' }, { label: 'Maple Leafs @ Golden Knights' }, { label: 'Sheet3' }];
    const results = [
      { name: 'A', team: 'PIT', gateOpen: true, p4s: 0.4, p1g: 0.3 },
      { name: 'B', team: 'PHI', gateOpen: false, p4s: 0.9, p1g: 0.1 },
      { name: 'C', team: 'TOR', gateOpen: true, p4s: 0.2, p1g: 0.5 },
    ];
    const s = summarizeRun(files, results, games);
    expect(s.slateDate).toBe('2026-10-01');
    expect(s.games).toEqual([
      { label: 'Penguins @ Flyers', away: 'PIT', home: 'PHI' },
      { label: 'Maple Leafs @ Golden Knights', away: 'TOR', home: 'VGK' },
      { label: 'Sheet3', away: '', home: '' },
    ]);
    expect(s.playerCount).toBe(3);
    expect(s.label).toBe('Penguins @ Flyers · Maple Leafs @ Golden Knights · Sheet3');
    // Shots picks need an open gate; goals picks do not.
    expect(s.topPicks.map((p) => `${p.name} ${p.market}`)).toEqual(['A 4+ SOG', 'C 4+ SOG', 'C 1+ G', 'A 1+ G', 'B 1+ G']);
    expect(TEAM_LOGO_ABBR[normTeam('Toronto Maple Leafs')]).toBe('TOR');
  });
});

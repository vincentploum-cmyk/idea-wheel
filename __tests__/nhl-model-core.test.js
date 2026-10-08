import { describe, expect, test } from '@jest/globals';
import { summarizeRun, TEAM_LOGO_ABBR, normTeam, boardPlays, playMarket, playTier } from '../components/nhl/model-core';

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

describe('the Best bets boards’ rule (boardPlays), shared by the Model tab, the scorecard and the rinks', () => {
  const rows = [
    { name: 'Gate closed', gateOpen: false, p4s: 0.9, p3s: 0.95, p5s: 0.5, p1g: 0.1, attackScore: 90 },
    { name: 'Four-plus', gateOpen: true, p4s: 0.52, p3s: 0.74, p5s: 0.3, p1g: 0.38, p2g: 0.08, attackScore: 80 },
    { name: 'Three-plus', gateOpen: true, p4s: 0.35, p3s: 0.64, p5s: 0.1, p1g: 0.1, attackScore: 60 },
    { name: 'Below both floors', gateOpen: true, p4s: 0.39, p3s: 0.59, p1g: 0.17, attackScore: 99 },
    { name: 'Scorer', gateOpen: true, p4s: 0.2, p3s: 0.4, p1g: 0.31, p2g: 0.05, attackScore: 75 },
    { name: 'Lotto', gateOpen: true, p4s: 0.1, p3s: 0.3, p1g: 0.18, p2g: 0.01, attackScore: 40 },
    null,
  ];
  test('shots plays need the gate open and 4+ at 40% or 3+ at 60%; goal plays 1+ G at 18%; ranked and capped', () => {
    const all = boardPlays(rows, 5);
    expect(all.shots.map((r) => r.name)).toEqual(['Four-plus', 'Three-plus']);
    expect(all.goals.map((r) => r.name)).toEqual(['Four-plus', 'Scorer', 'Lotto']);
    const two = boardPlays(rows, 2);
    expect(two.goals.map((r) => r.name)).toEqual(['Four-plus', 'Scorer']);
    expect(boardPlays([], 2)).toEqual({ shots: [], goals: [] });
  });
  test('a 5+ ceiling and attack score break shots ties; attack weighs less on goals', () => {
    const a = { gateOpen: true, p4s: 0.45, p5s: 0.30, attackScore: 50, p1g: 0.2, p2g: 0.0 };
    const b = { gateOpen: true, p4s: 0.45, p5s: 0.10, attackScore: 60, p1g: 0.2, p2g: 0.05 };
    expect(boardPlays([a, b]).shots[0]).toBe(a); // 0.30·60 = 18 beats 10 more attack
    expect(boardPlays([a, b]).goals[0]).toBe(b); // 0.05·70 = 3.5 beats 10·0.35
  });
  test('the market a play is called on is the floor it cleared, and the tier follows the attack score', () => {
    expect(playMarket({ p4s: 0.52, p3s: 0.74 }, 'shots')).toMatchObject({ label: '4+ SOG', prob: 0.52, stat: 'sog', min: 4 });
    expect(playMarket({ p4s: 0.35, p3s: 0.64 }, 'shots')).toMatchObject({ label: '3+ SOG', prob: 0.64, min: 3 });
    expect(playMarket({ p1g: 0.31 }, 'goals')).toMatchObject({ label: '1+ G', prob: 0.31, stat: 'g', min: 1 });
    expect([85, 72, 58, 57, null].map(playTier)).toEqual(['Auto', 'Strong', 'Lean', 'Thin', 'Thin']);
  });
});

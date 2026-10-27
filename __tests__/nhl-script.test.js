import { describe, expect, test } from '@jest/globals';
import { gameScript, shotsSentence, joinAnd } from '../lib/nhl-data/script';
import { teamVerdict, h2hTotals, gameTotalRead } from '../lib/nhl-data/verdict';
import { rowObj } from '../lib/nhl-data/ingest';

// CBJ @ PHI as the Matchups tab read it on 2026-10-27: PHI tight at home (#27 SOG allowed) but
// loosening, CBJ average away, leaking to centres and defensemen; PHI fast and low-volume, CBJ
// slow; three stored meetings at 5.0 goals a game, MoneyPuck's 5.8 expected.
const pos = (rank) => ({ season: { gp: 20, sog: 7, g: 0.8 }, rank: { sog: rank, g: rank }, teamCount: 32 });
const fg = (games, allowed, rank) => ({ games, allowed, share: +(allowed / games).toFixed(2), rank, teamCount: 32, league: 0.5, bySlot: {} });
// What PHI allows at home (the away side's defense object) and what CBJ allows away (the home side's).
const phiDef = { All: { season: { gp: 53, sog: 25.9, g: 2.79 }, rank: { sog: 27, g: 24 }, teamCount: 32, l10: { gp: 10, sog: 28.7 }, l10Rank: { sog: 9 }, source: 'games', firstGoal: fg(13, 5, 20) }, LW: pos(24), C: pos(25), RW: pos(22), D: pos(25) };
const cbjDef = { All: { season: { gp: 40, sog: 28.8, g: 3.12 }, rank: { sog: 14, g: 18 }, teamCount: 32, l10: { gp: 10, sog: 26.7 }, l10Rank: { sog: 20 }, source: 'games', firstGoal: fg(12, 7, 4) }, LW: pos(27), C: pos(11), RW: pos(15), D: pos(11) };
// Ten filler teams put the league's expected goals at 6.0 a game.
const filler = Object.fromEntries(['NYR', 'NJD', 'BOS', 'PIT', 'TOR', 'MTL', 'OTT', 'BUF', 'DET', 'FLA'].map((t) => [t, { sf60: 28, xgf60: 3.16, xga60: 3.0, pace60: 108 }]));
const mp = {
  teams: 32,
  situations: { all: { ...filler, PHI: { sf60: 21.4, xgf60: 1.67, xga60: 4.23, pace60: 119.1 }, CBJ: { sf60: 23.0, xgf60: 2.75, xga60: 2.91, pace60: 95.0 } } },
  ranks: { all: { PHI: { sf60: 22, xgf60: 24, xga60: 25, pace60: 5 }, CBJ: { sf60: 19, xgf60: 16, xga60: 15, pace60: 24 } } },
};
const row = (date, gameId, pid, team, opp, venue, g) => rowObj([date, gameId, pid, `P${pid}`, team, opp, venue, 'C', 15, g, 0, 2, 0, 0, 2, 2, 2, 1, 0, 'W']);
const rows = [
  row('2025-11-20', 1, 1, 'CBJ', 'PHI', 'H', 5), row('2025-11-20', 1, 2, 'PHI', 'CBJ', 'A', 3),
  row('2026-01-10', 2, 1, 'CBJ', 'PHI', 'A', 1), row('2026-01-10', 2, 2, 'PHI', 'CBJ', 'H', 1),
  row('2026-03-24', 3, 1, 'CBJ', 'PHI', 'A', 3), row('2026-03-24', 3, 2, 'PHI', 'CBJ', 'H', 2),
];
const play = (name, market, prob, stat, min, extra = {}) => ({ id: null, name, pos: 'RW', kind: stat === 'g' ? 'goals' : 'shots', market, prob, stat, min, tier: 'Lean', ...extra });
const verdicts = { PHI: teamVerdict({ team: 'PHI', venue: 'H', defense: phiDef, teamCount: 32, mp }), CBJ: teamVerdict({ team: 'CBJ', venue: 'A', defense: cbjDef, teamCount: 32, mp }) };
const total = gameTotalRead({ away: 'CBJ', home: 'PHI', h2h: h2hTotals(rows, 'CBJ', 'PHI'), mp });
const sides = [
  { team: 'CBJ', opp: 'PHI', venue: 'A', defense: phiDef, skaters: [], plays: { shots: [], goals: [] } },
  { team: 'PHI', opp: 'CBJ', venue: 'H', defense: cbjDef, skaters: [], plays: { shots: [play('Travis Konecny', '3+ SOG', 0.61, 'sog', 3, { heat: { hotS: true }, oppPos: { softSog: true } })], goals: [play('Matvei Michkov', '1+ G', 0.34, 'g', 1)] } },
];
const game = { away: 'CBJ', home: 'PHI', total, verdicts, sides, log: null };
const byKey = (s) => Object.fromEntries(s.parts.map((p) => [p.key, p]));

describe('the game script', () => {
  test('the verdict carries its reads as data', () => {
    expect(verdicts.PHI).toMatchObject({ tier: 'tight', rank: 27, season: { gp: 53, sog: 25.9, g: 2.79, rankSog: 27, rankG: 24 }, leaks: [], trend: { rank: 9, trend: 'loosening' }, offense: { sf60Rank: 22, tier: 'tight' }, pace: { value: 119.1, rank: 5, tier: 'fast' } });
    expect(verdicts.PHI.holds).toEqual([{ pos: 'C', rank: 25 }, { pos: 'D', rank: 25 }, { pos: 'LW', rank: 24 }, { pos: 'RW', rank: 22 }]);
    expect(verdicts.CBJ).toMatchObject({ tier: 'average', leaks: [{ pos: 'C', rank: 11 }, { pos: 'D', rank: 11 }], holds: [{ pos: 'LW', rank: 27 }], trend: { rank: 20, trend: 'tightening' }, offense: { tier: 'average' }, pace: { tier: 'slow' } });
  });
  test('reads the total, the edge, both sides’ shooters, the nets and the plays in order', () => {
    const s = gameScript(game);
    expect(s.headline).toBe('Average scoring · CBJ has the edge');
    expect(s.lean).toBe('CBJ');
    expect(s.parts.map((p) => p.key)).toEqual(['total', 'edge', 'shots', 'goals', 'plays']);
    const p = byKey(s);
    expect(p.total.text).toBe("An average total is likely, 5.6 goals against the league's 6.0: the two have averaged 5.0 over 3 meetings and MoneyPuck makes it 5.8. PHI pushes the pace (#5), CBJ slows it (#24).");
    expect(p.edge.text).toBe('CBJ has the edge on paper, 3.5 expected goals to 2.3. PHI shoots little (#22 in SF/60).');
    expect(p.shots.text).toBe("CBJ's shooters: PHI is tight at home (#27 SOG allowed), holding every position, but it has loosened over its last ten (#9). PHI's shooters: CBJ is average away (#14 SOG allowed), softest to centres (#11) and defensemen (#11), tight on left wings (#27); it has tightened over its last ten (#20).");
    expect(p.goals.text).toBe("The softer net is CBJ's, 3.12 goals a game allowed away (#18) against PHI's 2.79 at home (#24). First goal: PHI has conceded it in 5 of 13 home games (#20), CBJ in 7 of 12 road games (#4), so the lean is PHI to score first.");
    expect(p.plays.text).toBe('CBJ: nothing clears the floor; PHI: Konecny (hot, soft spot) 3+ SOG 61%, Michkov 1+ G 34%.');
    expect(p.total.tone).toBe('');
    // No part carries the lean it was computed with; the script does.
    expect(p.edge.lean).toBeUndefined();
  });
  test('a high total is marked, an even game reads even, and both sides on a leaky defense tone the shots', () => {
    const even = { ...game, total: { ...total, tier: 'high', projected: 6.9, expected: { ...total.expected, home: 3.4, away: 3.5 } } };
    const s = gameScript(even);
    expect(s.headline).toBe('High-scoring · even on paper');
    expect(s.tone).toBe('is-soft');
    const p = byKey(s);
    expect(p.total.text).toMatch(/^A high-scoring game is likely, 6\.9 goals/);
    expect(p.total.tone).toBe('is-soft');
    expect(p.edge.text).toBe("Even on paper, PHI 3.4 expected goals to CBJ's 3.5. PHI shoots little (#22 in SF/60).");
    const leaky = { ...game, verdicts: { PHI: { ...verdicts.PHI, tier: 'leaky', rank: 3, holds: [], leaks: [{ pos: 'LW', rank: 2 }], trend: null }, CBJ: { ...verdicts.CBJ, tier: 'leaky', rank: 5, holds: [], leaks: [], trend: { ...verdicts.CBJ.trend, trend: 'tightening' } } } };
    const l = byKey(gameScript(leaky));
    expect(l.shots.tone).toBe('is-soft');
    expect(l.shots.text).toBe("CBJ's shooters: PHI is leaky at home (#3 SOG allowed), softest to left wings (#2). PHI's shooters: CBJ is leaky away (#5 SOG allowed), but it has tightened over its last ten (#20).");
  });
  test('without a run the plays line names the matchup read’s volume shooters', () => {
    const skaters = (list) => list.map(([name, projSog, shotScore]) => ({ name, projSog, shotScore, gp: 12, inLineup: true }));
    const noRun = { ...game, sides: [
      { ...sides[0], plays: null, skaters: skaters([['Zach Werenski', 3.6, 3.7], ['Kirill Marchenko', 2.9, 3.0], ['Sean Monahan', 2.1, 2.2]]) },
      { ...sides[1], plays: null, skaters: skaters([['Travis Konecny', 3.9, 4.1], ['Matvei Michkov', 3.2, 3.3]]) },
    ] };
    expect(byKey(gameScript(noRun)).plays.text).toBe('No model run for this slate yet; by the matchup read the volume shooters are CBJ: Werenski 3.6 SOG, Marchenko 2.9 SOG; PHI: Konecny 3.9 SOG, Michkov 3.2 SOG.');
    // Two plays sharing a last name are named in full.
    const twins = { ...game, sides: [sides[0], { ...sides[1], plays: { shots: [play('Jack Hughes', '3+ SOG', 0.7, 'sog', 3), play('Luke Hughes', '3+ SOG', 0.55, 'sog', 3)], goals: [] } }] };
    expect(byKey(gameScript(twins)).plays.text).toBe('CBJ: nothing clears the floor; PHI: Jack Hughes 3+ SOG 70%, Luke Hughes 3+ SOG 55%.');
  });
  test('a stored game adds the result against the read, the first goal and the plays’ record', () => {
    const log = { score: { away: 2, home: 3 }, firstGoal: { team: 'PHI', name: 'Matvei Michkov' }, skaters: [{ id: 1, name: 'Travis Konecny', team: 'PHI', sog: 4, g: 0 }, { id: 2, name: 'Matvei Michkov', team: 'PHI', sog: 2, g: 0 }] };
    const s = gameScript({ ...game, log });
    expect(s.parts.map((p) => p.key)).toEqual(['total', 'edge', 'shots', 'goals', 'plays', 'result']);
    expect(byKey(s).result.text).toBe('Final CBJ 2–3 PHI, 5 goals, under the 5.6 read; first goal PHI (Matvei Michkov); the plays went 1 of 2.');
  });
  test('parts the slate cannot feed are left out; nothing at all gives no script', () => {
    const bare = { away: 'CBJ', home: 'PHI', total: null, verdicts: {}, sides: [{ team: 'CBJ', opp: 'PHI', venue: 'A', defense: {}, skaters: [], plays: null }, { team: 'PHI', opp: 'CBJ', venue: 'H', defense: {}, skaters: [], plays: null }], log: null };
    expect(gameScript(bare)).toBeNull();
    expect(gameScript(null)).toBeNull();
    // Head to head alone: a total with no MoneyPuck, no edge, no pace sentence.
    const h2hOnly = gameScript({ ...bare, total: gameTotalRead({ away: 'CBJ', home: 'PHI', h2h: h2hTotals(rows, 'CBJ', 'PHI'), mp: null }) });
    expect(h2hOnly.headline).toBe('Low-scoring');
    expect(h2hOnly.parts.map((p) => p.key)).toEqual(['total']);
    expect(h2hOnly.parts[0].text).toBe("A low-scoring game is likely, 5.0 goals against the league's 6.1: the two have averaged 5.0 over 3 meetings.");
    // One meeting reads as such; one net alone still reads.
    const one = gameScript({ ...bare, total: gameTotalRead({ away: 'CBJ', home: 'PHI', h2h: h2hTotals(rows, 'CBJ', 'PHI').slice(0, 1), mp: null }), sides: [{ ...bare.sides[0], defense: phiDef }, bare.sides[1]] });
    expect(byKey(one).total.text).toBe("A high-scoring game is likely, 8.0 goals against the league's 6.1: their one stored meeting had 8.0 goals.");
    expect(byKey(one).goals.text).toBe('PHI gives up 2.79 goals a game at home (#24). First goal: PHI has conceded it in 5 of 13 home games (#20).');
  });
  test('shotsSentence and joinAnd', () => {
    expect(shotsSentence({ team: 'A', opp: 'B' }, null)).toBeNull();
    expect(shotsSentence({ team: 'A', opp: 'B' }, { season: { gp: 9 }, tier: 'average', venue: 'A', rank: 16, leaks: [], holds: [], trend: { trend: 'steady', rank: 15 } })).toBe("A's shooters: B is average away (#16 SOG allowed).");
    expect(joinAnd(['a'])).toBe('a');
    expect(joinAnd(['a', 'b'])).toBe('a and b');
    expect(joinAnd(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

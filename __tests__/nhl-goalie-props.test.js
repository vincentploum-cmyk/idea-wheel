import { describe, expect, test } from '@jest/globals';
import { savesLinesOf, goalieSavesProps, savesLineFor } from '../lib/nhl-data/goalie-props';
import { savesRow, pickSaves, savesHit, savesChance, isSavesPlay } from '../lib/nhl-data/goalies-pure';

// PropFinder's prop items in the shape the NBA pull sends (one item per book and side; checked 2026-10-20) and the
// older { market, line, overOdds, underOdds } shape, on a goalie.
const item = (market, points, side, price, sportsbook = 'DraftKings', extra = {}) => ({ market, categoryMapping: 'Goalie', sportsbook, selectionLine: side, points, price, ...extra });
const hill = {
  id: 'pf-1', name: 'Adin Hill', positionGroup: 'G', positionAbbreviation: 'G', team: { abbreviation: 'VGK' },
  odds: [
    item('Player Saves', 27.5, 'over', -115, 'DraftKings', { isMain: true }), item('Player Saves', 27.5, 'under', -105, 'DraftKings', { isMain: true }),
    item('Player Saves', 27.5, 'over', -110, 'FanDuel', { isMain: true }),
    item('Player Saves', 24.5, 'over', -260, 'DraftKings', { isMain: true }), item('Player Saves', 24.5, 'under', +200, 'DraftKings', { isMain: true }),
    item('Player Saves', 30.5, 'over', +150, 'DraftKings'),
    item('1st Period Saves', 8.5, 'over', -120, 'DraftKings', { isMain: true }),
    item('Player Shots on Goal', 2.5, 'over', -120, 'DraftKings', { isMain: true }),
  ],
};
const legacy = { id: 'pf-2', name: 'Connor Hellebuyck', position: 'G', team: { code: 'WPG' }, props: [{ market: 'Saves', line: 25.5, overOdds: -120, underOdds: +100, book: 'BetMGM' }] };
const noLine = { id: 'pf-3', name: 'Carter Hart', positionGroup: 'G', team: { abbreviation: 'VGK' }, odds: [] };
const skater = { id: 'pf-4', name: 'Jack Eichel', positionGroup: 'F', positionAbbreviation: 'C', team: { abbreviation: 'VGK' }, odds: [item('Player Saves', 27.5, 'over', -115)] };

describe('goalie props: the saves lines off PropFinder’s players', () => {
  test('savesLinesOf: the main line nearest a coin flip, the best price a side, every line on the ladder; a period’s saves and other markets left out', () => {
    const l = savesLinesOf(hill);
    expect(l).toMatchObject({ line: 27.5, odds: -110, underOdds: -105, book: 'FanDuel', books: 2, isMain: true, implied: 0.524 });
    expect(l.lines).toEqual([{ line: 24.5, odds: -260, underOdds: 200, books: 1, main: true }, { line: 27.5, odds: -110, underOdds: -105, books: 2, main: true }, { line: 30.5, odds: 150, underOdds: null, books: 1, main: false }]);
    expect(savesLinesOf(legacy)).toMatchObject({ line: 25.5, odds: -120, underOdds: 100, book: 'BetMGM', implied: 0.545, lines: [{ line: 25.5, odds: -120, underOdds: 100 }] });
    expect(savesLinesOf(noLine)).toBeNull();
    expect(savesLinesOf({ name: 'x', odds: [item('1st Period Saves', 8.5, 'over', -120), item('Saves in First 10 Minutes', 3.5, 'over', -120)] })).toBeNull();
  });
  test('goalieSavesProps: the goalies alone, with their team and the line, a raw sample of the first goalie’s items', () => {
    const got = goalieSavesProps([skater, hill, legacy, noLine], { teamOf: (p) => p.team?.abbreviation || p.team?.code });
    expect(got.goalies.map((g) => [g.name, g.key, g.team, g.line, g.odds])).toEqual([['Adin Hill', 'adin hill', 'VGK', 27.5, -110], ['Connor Hellebuyck', 'connor hellebuyck', 'WPG', 25.5, -120], ['Carter Hart', 'carter hart', 'VGK', null, null]]);
    expect(got.withLines).toBe(2);
    expect(got.sample).toMatchObject({ name: 'Adin Hill' });
    expect(got.sample.items).toHaveLength(6);
    expect(got.sample.keys).toContain('odds');
  });
  test('savesLineFor: the stored goalie by name, the NHL spelling against PropFinder’s; the surname on the team as the fallback', () => {
    const props = goalieSavesProps([hill, legacy, noLine], { teamOf: (p) => p.team?.abbreviation || p.team?.code });
    expect(savesLineFor(props, { id: 1, name: 'Adin Hill' }, 'VGK')).toMatchObject({ line: 27.5, odds: -110, underOdds: -105, implied: 0.524, name: 'Adin Hill' });
    expect(savesLineFor(props, { id: 2, name: 'C. Hellebuyck' }, 'WPG')).toMatchObject({ line: 25.5 });
    expect(savesLineFor(props, { id: 3, name: 'Carter Hart' }, 'VGK')).toBeNull();
    expect(savesLineFor(props, { id: 4, name: 'Logan Thompson' }, 'WSH')).toBeNull();
    expect(savesLineFor(null, { id: 1, name: 'Adin Hill' }, 'VGK')).toBeNull();
  });
});

describe('goalie props: the Saves row against the book', () => {
  const starter = { goalie: { id: 2, name: 'Adin Hill', team: 'VGK', starts: 7, gp: 7, pct: 0.929, svPct: 0.916, savesPerStart: 26 }, reason: "7 of the team's last 10 starts", b2b: false, other: null, held: false };
  test('savesRow with a line: the mark over it, the chance, the price, the edge; the play on a positive edge', () => {
    const row = savesRow({ team: 'VGK', opp: 'NJD', venue: 'H', starter, shots: 32.6, shotsFrom: 'x', prop: { line: 27.5, odds: -110, underOdds: -105, book: 'FanDuel', books: 2, lines: [{ line: 27.5 }] } });
    expect(row).toMatchObject({ lam: 29.9, line: 27.5, mark: 28, odds: -110, underOdds: -105, implied: 0.524, book: 'FanDuel', books: 2 });
    expect(row.pLine).toBeCloseTo(savesChance(29.9, 28, 0.916), 6);
    expect(row.edge).toBeCloseTo(row.pLine - 0.524, 3);
    expect(row.edge).toBeGreaterThan(0);
    expect(isSavesPlay(row)).toBe(true);
    // The same goalie against a line over his projection: no edge, no play; without a price the 50% floor on the line decides.
    const steep = savesRow({ team: 'VGK', opp: 'NJD', venue: 'H', starter, shots: 32.6, shotsFrom: 'x', prop: { line: 31.5, odds: -110 } });
    expect(steep.edge).toBeLessThan(0); expect(isSavesPlay(steep)).toBe(false);
    const unpriced = savesRow({ team: 'VGK', opp: 'NJD', venue: 'H', starter, shots: 32.6, shotsFrom: 'x', prop: { line: 27.5 } });
    expect(unpriced).toMatchObject({ odds: null, implied: null, edge: null });
    expect(isSavesPlay(unpriced)).toBe(unpriced.pLine >= 0.5);
    // Without a line the 30-save mark stands as it was.
    const plain = savesRow({ team: 'VGK', opp: 'NJD', venue: 'H', starter, shots: 32.6, shotsFrom: 'x' });
    expect(plain).toMatchObject({ line: null, pLine: null, edge: null });
    expect(isSavesPlay(plain)).toBe(plain.p30 >= 0.5);
  });
  test('pickSaves orders by the edge and marks the rows that are no play; savesHit grades on the line', () => {
    const a = savesRow({ team: 'VGK', opp: 'NJD', venue: 'H', starter, shots: 32.6, shotsFrom: 'x', prop: { line: 27.5, odds: -110 } });
    const b = savesRow({ team: 'NJD', opp: 'VGK', venue: 'A', starter: { goalie: { id: 9, name: 'Jake Allen', starts: 5, gp: 5, svPct: 0.905 }, reason: 'y' }, shots: 26, shotsFrom: 'x', prop: { line: 25.5, odds: -130 } });
    const table = pickSaves([b, a]);
    expect(table.map((r) => r.name)).toEqual(['Adin Hill', 'Jake Allen']);
    expect(table[0].under).toBe(false);
    expect(table[1].under).toBe(b.edge <= 0);
    expect(savesHit({ ...a, actual: { sv: 28, sa: 30 } })).toBe(true);
    expect(savesHit({ ...a, actual: { sv: 27, sa: 29 } })).toBe(false);
    expect(savesHit({ ...a, actual: { sv: 27, sa: 29 } }, 25)).toBe(true);
    expect(savesHit({ ...a, actual: { sv: 31, sa: 33 }, played: false })).toBe(false);
    expect(savesHit(a)).toBeNull();
  });
});

import { describe, expect, test } from '@jest/globals';
import { parseSnapshot, shellOf, tileOf, rankDirection, convertRanks, oppRanksOf, spotsOf, sheetDefense, TEAMS_N } from '../lib/nfl/snapshot';
import { parseDetailedPages } from '../lib/nfl/cheatsheet-detailed';
import page1 from './fixtures/ocr-nfl-detailed-page1.json';

// The detailed cheat sheet's defense snapshot (Vincent, 2026-11-01: "the cheat sheet should be used to identify
// weaknesses in defenses"), read off page 1's real OCR words (SEA · DEN): the coverage shells and the ranked tiles.

const code = (w) => (/^[A-Z]{2,4}$/.test(String(w).replace(/[^A-Z]/g, '')) ? String(w).replace(/[^A-Z]/g, '') : null);

describe('the snapshot read off the page', () => {
  test('the right column: SEA’s defense, every tile and the coverage shells', () => {
    const s = parseSnapshot(page1.right, { codeOf: code });
    expect(s.of).toBe('SEA');
    expect(s.ranks).toEqual({ passYds: 31, rushYds: 22, rushYpp: 25, short: { l: 22, m: 30, r: 31 }, long: { l: 27, m: 21, r: 26 } });
    expect(s.tiles).toBe(9);
    expect(s.coverage).toMatchObject({ man: 11.1, zone: 88.9, c3: 33.3, c6: 24.8, c4: 17, c2: 13.7, c1: 9.2, c0: 1.3, twoMan: 0.7, sum: 100 });
  });
  test('the left column: DEN’s coverage read (a dropped decimal put back by the shells’ sum), its tiles lost to OCR', () => {
    const s = parseSnapshot(page1.left, { codeOf: code });
    expect(s.of).toBe('DEN');
    expect(s.tiles).toBe(0);
    expect(s.coverage).toMatchObject({ man: 30.3, zone: 69.7, c3: 35.8, c1: 19.4, c4: 14.5, c2: 10.9, c6: 8.5, c0: 6.1, twoMan: 4.4, repaired: 'twoMan' });
  });
  test('the labels as OCR spells them', () => {
    expect(['COVER 3', 'COVERO', 'COVERG6', 'COVER1', '2MAN', '2 MAN', 'Man', 'Zone'].map(shellOf)).toEqual(['c3', 'c0', 'c6', 'c1', 'twoMan', 'twoMan', 'man', 'zone']);
    expect(shellOf('High-Level')).toBeNull();
    expect(['PassYds/G', 'RushYd&/6', 'Rush Y/Play', 'Shoctl.', 'ShortM', 'Short R', 'longL', 'LoGgMl', ' LongR'].map(tileOf)).toEqual([
      { key: 'passYds' }, { key: 'rushYds' }, { key: 'rushYpp' }, { key: 'short', side: 'l' }, { key: 'short', side: 'm' }, { key: 'short', side: 'r' }, { key: 'long', side: 'l' }, { key: 'long', side: 'm' }, { key: 'long', side: 'r' },
    ]);
    expect(tileOf('Players')).toBeNull();
  });
  test('the page parser keeps each snapshot under the offense it is for, and says when a column’s tiles did not read', () => {
    const { meta, warnings } = parseDetailedPages([page1], { roster: [] });
    expect(meta.defense.DEN).toMatchObject({ of: 'SEA', tiles: 9, ranks: { passYds: 31 } });
    expect(meta.defense.SEA).toMatchObject({ of: 'DEN', tiles: 0 });
    expect(warnings.join(' ')).toMatch(/DEN defense snapshot for SEA: no rank tile read/);
  });
});

describe('the snapshot on the board', () => {
  const printed = { passYds: 31, rushYds: 22, rushYpp: 25, short: { l: 22, m: 30, r: 31 }, long: { l: 27, m: 21, r: 26 } };
  test('the ranks in the site’s convention (1 = gives up the most), by default the sheet’s #1 being the stingiest', () => {
    const c = convertRanks(printed);
    expect(c).toMatchObject({ passYds: 2, rushYds: 11, rushYpp: 8, short: { l: 11, m: 3, r: 2 }, long: { l: 6, m: 12, r: 7 }, run: 10, middle: 8, outside: 7, underneath: 5 });
    expect(convertRanks(printed, 'most')).toMatchObject({ passYds: 31, rushYds: 22 });
  });
  test('placed on the offense’s positions and slots: the outside for WR1 / WR2, the middle for the slot and the tight end', () => {
    const o = oppRanksOf(convertRanks(printed));
    expect(o.QB).toEqual({ passYds: 2, rushYds: 10 });
    expect(o.WR).toEqual({ recYds: 2 });
    expect(o.WR1).toEqual({ recYds: Math.round((2 + 7) / 2) });
    expect(o.WR3).toEqual({ recYds: 5 });
    expect(o.TE1).toEqual({ recYds: 5 });
    expect(o.RB1).toEqual({ rushYds: 10, recYds: 4 });
  });
  test('the weak and strong spots in words, the leakiest first, and the coverage', () => {
    const { weak, strong, style } = spotsOf(convertRanks(printed), { man: 11.1, zone: 88.9, c3: 33.3, c6: 24.8 });
    expect(weak.slice(0, 3).map((w) => `${w.word} #${w.rank}`)).toEqual(['the pass #2', 'short right #2', 'short middle #3']);
    expect(strong).toEqual([]);
    expect(style).toEqual(['zone-heavy (88.9% zone)', 'Cover 3 33.3%']);
    expect(spotsOf(convertRanks({ ...printed, passYds: 2 }), {}).strong[0]).toEqual({ key: 'passYds', word: 'the pass', rank: 31 });
  });
  test('the direction checked against PropFinder: agreeing ranks flip it, opposing ones confirm the default', () => {
    const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const snaps = teams.map((t, i) => ({ of: t, ranks: { passYds: i + 1, rushYds: i + 1 } }));
    const pf = (f) => ({ ranks: Object.fromEntries(teams.map((t, i) => [t, { QB: { passYds: f(i) }, RB: { rushYds: f(i) } }])) });
    const d = rankDirection(snaps, pf((i) => 8 - i));
    expect(d).toMatchObject({ convention: 'fewest', from: 'propfinder', n: 16 });
    expect(d.rho).toBeLessThan(-0.9);
    expect(rankDirection(snaps, pf((i) => i + 1))).toMatchObject({ convention: 'most', from: 'propfinder', rho: 1 });
    expect(rankDirection(snaps.slice(0, 2), pf((i) => i + 1))).toMatchObject({ convention: 'fewest', from: 'default' });
    expect(rankDirection(snaps, null)).toMatchObject({ convention: 'fewest', from: 'default', n: 0 });
  });
  test('the sheets read for the board: the tiles placed as `oppRanks` on 32 teams, the defenses in words', () => {
    const sheets = [{ id: 's', fileName: 'NFL_2026_W9_detailed.pdf', rows: [], meta: { defense: { DEN: { of: 'SEA', ranks: printed, coverage: { zone: 88.9 }, tiles: 9 } } } }, { id: 't', rows: [] }];
    const out = sheetDefense(sheets, null);
    expect(out.sheets[0].meta.oppRanks.DEN.QB).toEqual({ passYds: 2, rushYds: 10 });
    expect(out.sheets[0].meta.oppCount).toBe(TEAMS_N);
    expect(out.sheets[1]).toBe(sheets[1]);
    expect(out.defense.teams.SEA).toMatchObject({ of: 'SEA', for: 'DEN', file: 'NFL_2026_W9_detailed.pdf', weak: expect.arrayContaining([{ key: 'passYds', word: 'the pass', rank: 2 }]) });
    expect(out.defense.direction).toMatchObject({ convention: 'fewest', from: 'default' });
    expect(sheetDefense([], null)).toEqual({ sheets: [], defense: null });
  });
});

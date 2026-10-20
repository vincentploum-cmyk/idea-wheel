import { describe, expect, test } from '@jest/globals';
import { fixRank, fixAvg, fixMinutes, parseTiles, parseColumn, parseNbaPages } from '../lib/nba/cheatsheet-ocr';
import { rowsOf, claimFragments, resolveName } from '../lib/picks/ocr-layout';
import { pdfImages, scaleFor } from '../lib/picks/ocr';
import { buildBoard } from '../lib/nba/picks';
import page1 from './fixtures/ocr-nba-page1.json';
import zlib from 'zlib';

const ROSTER = ['Payton Pritchard|BOS|PG', 'Neemias Queta|BOS|C', 'Sam Hauser|BOS|SF', 'Baylor Scheierman|BOS|SG', 'Devin Carter|BOS|G', 'Jaylen Brown|BOS|SF', 'Cade Cunningham|DET|PG', 'Duncan Robinson|DET|SF', 'Ausar Thompson|DET|SF', 'Taurean Prince|DET|PF', 'Jalen Duren|DET|C', 'Jalen Brunson|NY|PG']
  .map((s) => { const [name, team, pos] = s.split('|'); return { name, team, pos }; });

describe('NBA cheat sheet (OCR)', () => {
  test('ranks, averages and minutes get their punctuation back', () => {
    expect(fixRank('23rd')).toBe(23); expect(fixRank('(2nd)')).toBe(2); expect(fixRank('d0th')).toBe(10); expect(fixRank('qth')).toBe(10); expect(fixRank('Xin')).toBeNull(); expect(fixRank('99th')).toBeNull();
    expect(fixAvg('16.3')).toBe(16.3); expect(fixAvg('38')).toBe(3.8); expect(fixAvg('04')).toBe(0.4); expect(fixAvg('249')).toBe(24.9); expect(fixAvg('1156')).toBe(11.5); expect(fixAvg('0.0')).toBe(0); expect(fixAvg('')).toBeNull();
    expect(fixMinutes('31:18')).toBe(31.3); expect(fixMinutes('2744')).toBe(27.7); expect(fixMinutes('12.46')).toBe(12.8); expect(fixMinutes('7:27')).toBe(7.5); expect(fixMinutes('5')).toBeNull();
    expect(scaleFor(594)).toBe(3); expect(scaleFor(1040)).toBe(2); expect(scaleFor(4000)).toBe(1);
  });
  test('the tiles read by grid position, the players by the header columns, the team by the roster', () => {
    const left = parseColumn(page1.left, { roster: ROSTER });
    expect(left.header).toBe(true);
    expect(left.tiles).toEqual({ PG: { pts: 23, reb: 23, ast: 16, tpm: 12 }, SG: { pts: 29, reb: 10, ast: 13, tpm: 19 }, SF: { pts: 27, reb: 10, ast: 28, tpm: 8 }, PF: { pts: 24, reb: 28, ast: 30, tpm: 2 }, C: { pts: 25, reb: 25, ast: 14, tpm: 3 } });
    expect(left.players.map((p) => p.player)).toEqual(['Payton Pritchard', 'Neemias Queta', 'Sam Hauser', 'Baylor Scheierman', 'Devin Carter']);
    expect(left.players[0]).toMatchObject({ team: 'BOS', pos: 'PG', sheetPos: 'PG', avg: { min: 31.3, pts: 16.3, reb: 3.8, ast: 5, tpm: 2.6 } });
    expect(left.players[3]).toMatchObject({ pos: 'SG', sheetPos: null });  // "Unknown" on the sheet, the roster's position
    const { rows, games, warnings, meta, preview } = parseNbaPages([page1], { roster: ROSTER, schedule: [{ away: 'BOS', home: 'DET' }] });
    expect(games).toEqual([{ page: 1, teams: ['BOS', 'DET'] }]);
    expect(rows).toHaveLength(9);
    expect(rows.find((r) => r.player === 'Cade Cunningham')).toMatchObject({ team: 'DET', pos: 'PG', market: null, line: null, group: 'players', mention: true, avg: { min: 27.7, pts: 19.8, reb: 4.5, ast: 7.7, tpm: 1.6 } });
    expect(rows.find((r) => r.player === 'Duncan Robinson').avg.pts).toBe(11.5);
    expect(meta.oppRanks.DET.PF).toEqual({ pts: 28, reb: 29, ast: 26, tpm: 6 });
    expect(warnings).toEqual([]);
    expect(preview.some((l) => /Name POS MIN PTS REB AST 3PM/.test(l))).toBe(true);
    // No roster: names as read, the team unknown and the page flagged.
    const bare = parseNbaPages([page1], { roster: [] });
    expect(bare.games).toEqual([{ page: 1, teams: [null, null] }]);
    expect(bare.warnings.some((w) => /no team named/.test(w))).toBe(true);
    expect(bare.rows.map((r) => r.player)).toEqual(expect.arrayContaining(['Payton Pritchard', 'Baylor Scheierman', 'Devin Carter']));
  });
  test('fragments split over rows join the nearest numbers row', () => {
    const w = (text, x, y) => ({ text, x, x1: x + 40, y: y - 10, y1: y });
    const words = [w('Name', 100, 100), w('POS', 400, 100), w('MIN', 520, 100), w('PTS', 620, 100), w('REB', 720, 100), w('AST', 820, 100), w('3PM', 920, 100),
      w('Shai', 100, 160), w('Gilgeous-', 100, 178), w('PG', 400, 190), w('2753', 520, 190), w('261', 620, 190), w('35', 720, 190), w('56', 820, 190), w('14', 920, 190), w('Alexander', 100, 208)];
    const rows = rowsOf(words);
    expect(claimFragments(rows.filter((r) => r.words.length > 3), rows.filter((r) => r.words.length === 1), 45).size).toBe(1);
    const col = parseColumn(words, { roster: [{ name: 'Shai Gilgeous-Alexander', team: 'OKC', pos: 'PG' }] });
    expect(col.players).toEqual([{ player: 'Shai Gilgeous-Alexander', matched: true, team: 'OKC', pos: 'PG', sheetPos: 'PG', avg: { min: 27.9, pts: 26.1, reb: 3.5, ast: 5.6, tpm: 1.4 } }]);
    expect(resolveName(['Cade', 'Cunningham'], ROSTER, null)).toMatchObject({ name: 'Cade Cunningham', team: 'DET' });
  });
  test('on the board a mention confirms the PropFinder play and the tiles stand in for the defense ranks', () => {
    const games = [{ id: 'g1', date: '2026-10-20T23:00Z', away: 'BOS', home: 'DET', state: 'pre', final: false }];
    const logs = Array.from({ length: 10 }, (_, i) => ({ date: `2026-01-${String(10 + i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', pts: 18 + (i % 3), reb: 4, ast: 5, tpm: 2 }));
    const pf = { at: '2026-10-20T14:00:00Z', data: { players: [
      { id: 'p1', name: 'Payton Pritchard', key: 'payton pritchard', team: 'BOS', pos: 'PG', games: logs, props: [{ market: 'pts', line: 15.5, odds: -110, underOdds: -110 }] },
      { id: 'p2', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SF', games: logs, props: [{ market: 'pts', line: 15.5, odds: -110, underOdds: -110 }] },
    ], defense: null } };
    const sheet = parseNbaPages([page1], { roster: ROSTER, schedule: games });
    const sheets = [{ id: 's1', fileName: 'nba_20261020.pdf', at: '2026-10-20T15:00:00Z', rows: sheet.rows, meta: sheet.meta }];
    const b = buildBoard({ date: '2026-10-20', season: 2026, games, sheets, pf, results: {} });
    const plays = b.games[0].tables.points.rows;
    const pritchard = plays.find((r) => r.player === 'Payton Pritchard');
    const brown = plays.find((r) => r.player === 'Jaylen Brown');
    expect(pritchard).toMatchObject({ confirmed: true, pfBacked: true, onSheet: true, sheetFiles: ['nba_20261020.pdf'] });
    expect(brown).toMatchObject({ confirmed: false, pfBacked: true, onSheet: false });
    // DET gives up the 23rd most points to point guards (BOS's tile), 29th to point guards' … no: the soft spot is by rank third.
    expect(pritchard.spot).toMatchObject({ rank: 23, teams: 30, soft: false, tough: true });
    expect(b.sources.sheets[0].rows).toBe(9);
    // The matchup view's sides: every player with a play, PropFinder's others, and what the opponent gives up.
    const bos = b.games[0].sides.BOS;
    expect(bos).toMatchObject({ team: 'BOS', opp: 'DET', venue: 'A' });
    expect(bos.players.map((p) => p.player).sort()).toEqual(['Jaylen Brown', 'Payton Pritchard']);
    const prit = bos.players.find((p) => p.player === 'Payton Pritchard');
    expect(prit.plays[0]).toMatchObject({ market: 'pts', line: 15.5, side: 'over', confirmed: true });
    expect(prit.avg.pts).toBe(19);
    expect(bos.allowed).toMatchObject({ from: 'sheet', count: 30 });
    expect(bos.allowed.rows.PG.pts).toEqual({ value: null, rank: 23 });
    expect(b.games[0].sides.DET.allowed.rows.PF.tpm.rank).toBe(6);
    // A mention alone is not a play.
    expect(plays.find((r) => r.player === 'Neemias Queta')).toBeUndefined();
  });
  test('Flate-compressed page images come out of the PDF as raw pixels, soft masks left out', () => {
    const px = Buffer.alloc(2 * 2 * 3, 7); const mask = Buffer.alloc(2 * 2, 255);
    const img = zlib.deflateSync(px); const msk = zlib.deflateSync(mask);
    const parts = ['%PDF-1.3\n', `5 0 obj\n<</BitsPerComponent 8/ColorSpace/DeviceRGB/Filter/FlateDecode/Height 2/Length ${img.length}/SMask 6 0 R /Subtype/Image/Type/XObject/Width 2>>stream\n`];
    const head = Buffer.from(parts.join(''), 'latin1');
    const mid = Buffer.from(`\nendstream\nendobj\n6 0 obj\n<</BitsPerComponent 8/ColorSpace/DeviceGray/Filter/FlateDecode/Height 2/Length ${msk.length}/Subtype/Image/Type/XObject/Width 2>>stream\n`, 'latin1');
    const tail = Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1');
    const images = pdfImages(Buffer.concat([head, img, mid, msk, tail]));
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ width: 2, height: 2, raw: { width: 2, height: 2, channels: 3 } });
    expect(images[0].data.equals(px)).toBe(true);
  });
});

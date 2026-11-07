import { describe, expect, test } from '@jest/globals';
import { parseLineupImage, playersInImage, imageCandidates, lineupImageLines, syndicationToken, IMAGE_CACHE_PATH } from '../lib/nhl-data/lineup-image';
import { latestTeamLines, linesToPlayers } from '../lib/nhl-data/gamedaytweets';
import { SEA_PAGE } from './fixtures/gamedaytweets-sea';
import WORDS_1107 from './fixtures/ocr-sea-lineup-2026-11-07.json';
import WORDS_1104 from './fixtures/ocr-sea-lineup-2026-11-04.json';

const P = (id, name, pos) => ({ id, name, pos, team: 'SEA' });
const SEA = [
  P(1, 'Bobby McMann', 'LW'), P(2, 'Matty Beniers', 'C'), P(3, 'Jordan Eberle', 'RW'),
  P(4, 'Kaapo Kakko', 'RW'), P(5, 'Berkly Catton', 'C'), P(6, 'Mackie Samoskevich', 'RW'),
  P(7, 'Matthew Wood', 'RW'), P(8, 'Frederick Gaudreau', 'C'), P(9, 'Chandler Stephenson', 'C'),
  P(10, 'Jani Nyman', 'RW'), P(11, 'Ben Meyers', 'C'), P(12, 'Ryan Winterton', 'C'),
  P(13, 'Jagger Firkus', 'RW'), P(14, 'Jared McCann', 'C'), P(15, 'Jacob Melanson', 'RW'), P(16, 'Curtis Douglas', 'C'),
  P(20, 'Vince Dunn', 'D'), P(21, 'Adam Larsson', 'D'), P(22, 'Ryker Evans', 'D'), P(23, 'Brandon Montour', 'D'),
  P(24, 'Josh Mahura', 'D'), P(25, 'Ville Ottavainen', 'D'), P(26, 'Cale Fleury', 'D'), P(27, 'Ryan Lindgren', 'D'),
  P(30, 'Joey Daccord', 'G'), P(31, 'Philipp Grubauer', 'G'),
];
const names = (rows) => rows.map((r) => r.map((p) => p.name.split(' ').slice(1).join(' ')).join('-'));

describe('lineup graphic', () => {
  test("@sound_hockey's SEA vs NYR card (2026-11-07) reads as four lines and three pairs", () => {
    const lines = parseLineupImage(WORDS_1107, SEA);
    // OCR misreads on the card: KRKKO, SAMOSKEVIGH, WooD, DAGGORD; the roster still knows them.
    expect(names(lines.forwards)).toEqual(['McMann-Beniers-Eberle', 'Kakko-Catton-Samoskevich', 'Wood-Gaudreau-Stephenson', 'Nyman-Meyers-Winterton']);
    expect(names(lines.defense)).toEqual(['Dunn-Larsson', 'Evans-Montour', 'Mahura-Ottavainen']);
    // The extras (Fleury, Firkus), the injured (McCann, Melanson, Lindgren, Douglas) and the goalies stay out.
    const ids = [...lines.forwards.flat(), ...lines.defense.flat()].map((p) => p.id);
    for (const out of [13, 14, 15, 16, 26, 27, 30, 31]) expect(ids).not.toContain(out);
    expect(linesToPlayers(lines)['berkly catton']).toMatchObject({ pos: 'C', line: 2 });
  });
  test('the SEA vs CGY card (2026-11-04) has the Wood line second', () => {
    const lines = parseLineupImage(WORDS_1104, SEA);
    expect(names(lines.forwards)).toEqual(['McMann-Beniers-Eberle', 'Wood-Gaudreau-Stephenson', 'Kakko-Catton-Samoskevich', 'Nyman-Meyers-Winterton']);
    expect(names(lines.defense)).toEqual(['Dunn-Larsson', 'Evans-Montour', 'Mahura-Ottavainen']);
  });
  test('a first name over its surname is not a player of its own', () => {
    // "RYAN" over "WINTERTON" (and over "LINDGREN"): with a Ryan Johansen-style surname on the roster it must not count.
    const roster = [...SEA, P(40, 'Kyle Ryan', 'C')];
    const found = playersInImage(WORDS_1107, roster).map((h) => h.p.id);
    expect(found).not.toContain(40);
    expect(found).toContain(12);
  });
  test('a picture with too few roster names is no lineup', () => {
    expect(parseLineupImage(WORDS_1107.slice(0, 8), SEA)).toBeNull();
    expect(parseLineupImage([], SEA)).toBeNull();
  });
  test('a card with a column a line reads its columns', () => {
    // Four columns (one a line, LW over C over RW), then three columns of pairs, one surname a tile.
    const word = (text, col, row, x0 = 0) => ({ text, x: x0 + col * 220, x1: x0 + col * 220 + 120, y: 80 + row * 60, y1: 80 + row * 60 + 32 });
    const F = [['McMann', 'Beniers', 'Eberle'], ['Kakko', 'Catton', 'Samoskevich'], ['Wood', 'Gaudreau', 'Stephenson'], ['Nyman', 'Meyers', 'Winterton']];
    const D = [['Dunn', 'Larsson'], ['Evans', 'Montour'], ['Mahura', 'Ottavainen']];
    const words = [
      { text: 'FORWARDS', x: 0, x1: 140, y: 20, y1: 50 },
      ...F.flatMap((line, c) => line.map((n, r) => word(n, c, r))),
      { text: 'DEFENSE', x: 900, x1: 1040, y: 20, y1: 50 },
      ...D.flatMap((pair, c) => pair.map((n, r) => word(n, c, r, 900))),
    ];
    const lines = parseLineupImage(words, SEA);
    expect(names(lines.forwards)).toEqual(F.map((l) => l.join('-')));
    expect(names(lines.defense)).toEqual(D.map((l) => l.join('-')));
  });
});

describe('lines page with a lineup graphic', () => {
  const until = '2026-11-08T07:00:00.000Z';
  test('the card tweet is the one worth reading, newer than the text lines', () => {
    const c = imageCandidates(SEA_PAGE, SEA, { since: '2026-11-06', until });
    expect(c.map((t) => [t.handle, t.id])).toEqual([['sound_hockey', '2119183832863945049']]);
  });
  test('without its picture the read falls back to the practice lines; with it the card wins', () => {
    expect(latestTeamLines(SEA_PAGE, SEA, { since: '2026-11-06', until }).meta.handle).toBe('Benton_Mike');
    const lines = parseLineupImage(WORDS_1107, SEA);
    const read = latestTeamLines(SEA_PAGE, SEA, { since: '2026-11-06', until, images: { '2119183832863945049': { lines, image: 'https://pbs.twimg.com/media/HWjaNjobgAAqDJV.jpg?name=large' } } });
    expect(read.meta).toMatchObject({ handle: 'sound_hockey', image: 'https://pbs.twimg.com/media/HWjaNjobgAAqDJV.jpg?name=large' });
    expect(read.players['berkly catton']).toMatchObject({ line: 2, pos: 'C' });
    expect(read.players['matthew wood']).toMatchObject({ line: 3 });
    expect(read).toMatchObject({ forwards: 4, pairs: 3, matched: 18 });
  });
  test('the token the embed endpoint asks for', () => {
    expect(syndicationToken('2119183832863945049')).toMatch(/^[0-9a-z]+$/);
  });
  test('pictures are fetched and read once, then laid out from the stored words', async () => {
    const store = {};
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      if (url.includes('syndication')) return { ok: true, json: async () => ({ photos: [{ url: 'https://pbs.twimg.com/media/X.jpg' }] }) };
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
    };
    let readerReads = 0;
    const deps = {
      readJson: async (p) => store[p] || null,
      writeJson: async (p, v) => { store[p] = JSON.parse(JSON.stringify(v)); },
      fetchImpl,
      createReader: async () => ({ read: async () => { readerReads += 1; return WORDS_1107; }, close: async () => {} }),
      // The real one runs sharp on the bytes first; here the reader hands the card's words straight back.
      readImageWords: async (buf, reader) => reader.read(),
    };
    const teams = { SEA: { html: SEA_PAGE, roster: SEA } };
    const now = Date.parse('2026-11-08T00:00:00Z');
    const first = await lineupImageLines(teams, { since: '2026-11-06', cutoffs: { SEA: until }, now, deps });
    expect(first.reads).toBe(1);
    expect(Object.keys(first.images.SEA)).toEqual(['2119183832863945049']);
    expect(store[IMAGE_CACHE_PATH]['2119183832863945049'].photos[0].url).toBe('https://pbs.twimg.com/media/X.jpg?name=large');
    const again = await lineupImageLines(teams, { since: '2026-11-06', cutoffs: { SEA: until }, now, deps });
    expect(again.reads).toBe(0);
    expect(again.images.SEA['2119183832863945049'].lines.forwards).toHaveLength(4);
    expect(readerReads).toBe(1);
  });
});

import { describe, expect, test, jest, beforeAll } from '@jest/globals';

// A small two-season store behind the in-process bucket mock: the slate, the picks, the
// first-goal board and the NBA board are built once per store state and shared.
const files = new Map(); // path → JSON string
const calls = { download: 0 };
const store = {
  async list(prefix) {
    const names = new Set();
    for (const p of files.keys()) if (p.startsWith(`${prefix}/`)) names.add(p.slice(prefix.length + 1).split('/')[0]);
    return { data: [...names].map((name) => ({ name })), error: null };
  },
  async download(path) {
    calls.download += 1;
    if (!files.has(path)) return { data: null, error: new Error('not found') };
    const text = files.get(path);
    return { data: { text: async () => String(text), arrayBuffer: async () => { const b = Buffer.isBuffer(text) ? text : Buffer.from(text); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }, size: text.length }, error: null };
  },
  async upload(path, body) { files.set(path, body.type === 'application/gzip' ? Buffer.from(await body.arrayBuffer()) : await body.text()); return { data: { path }, error: null }; },
  async remove(paths) { for (const p of paths) files.delete(p); return { data: null, error: null }; },
};
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
jest.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));
jest.mock('@supabase/ssr', () => ({ createServerClient: () => ({}) }));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { getBucket: async () => ({ data: { name: 'nhl-model' } }), from: () => store } }) }));

const { ROW_FIELDS, rowsPath, gamesPath } = require('../lib/nhl-data/ingest');
const { positionsPath } = require('../lib/nhl-data/positions');
const { PLAYERS_PATH } = require('../lib/nhl-data/rosters');
const nhlStore = require('../lib/nhl-store');

const DATE = '2026-01-15';
const TEAMS = ['NJD', 'PHI', 'BOS', 'NYR'];
const SLOTS = [...[1, 2, 3, 4].flatMap((line) => ['LW', 'C', 'RW'].map((pos) => [pos, line])), ...[1, 2, 3].flatMap((pair) => [['D', pair], ['D', pair]])];
const players = {}; const rosters = {};
let pid = 8470000;
for (const abbr of TEAMS) rosters[abbr] = SLOTS.map(([pos, line], i) => { const id = pid++; const name = `${pos}${line} Player${i} ${abbr}`; players[id] = { id, name, team: abbr, pos, number: i + 1 }; return { id, name, pos, line }; });

function seasonRows(year, games) {
  const rows = []; let seq = 1;
  for (let d = 0; d < games; d++) {
    const date = new Date(Date.UTC(year, 9, 7 + d)).toISOString().slice(0, 10);
    const [away, home] = d % 2 ? ['NJD', 'PHI'] : ['BOS', 'NYR'];
    const [a2, h2] = d % 2 ? ['BOS', 'NYR'] : ['NJD', 'PHI'];
    for (const [aw, hm] of [[away, home], [a2, h2]]) {
      const gameId = Number(`${year}02${String(seq++).padStart(4, '0')}`);
      for (const [team, opp, venue] of [[aw, hm, 'A'], [hm, aw, 'H']]) {
        rosters[team].forEach((p, i) => {
          const sog = 1 + ((i + d) % 4);
          rows.push([date, gameId, p.id, p.name, team, opp, venue, p.pos, 15, i === d % 18 ? 1 : 0, 0, sog, 0, 0, sog + 1, sog, sog, 1, 0, 'W', 'lineup', p.pos, p.line, i === d % 18 && p.pos !== 'D' ? 1 : 0]);
        });
      }
    }
  }
  return rows;
}

function snapshot() {
  const games = {};
  let id = 2025021500;
  for (const [away, home] of [['NJD', 'PHI'], ['BOS', 'NYR']]) {
    const teams = {};
    for (const abbr of [away, home]) {
      const ps = {};
      for (const p of rosters[abbr]) ps[p.name.toLowerCase()] = { name: p.name, id: p.id, pos: p.pos, line: p.line, team: abbr, inLineup: true };
      teams[abbr] = { source: 'lineup', players: ps, carried: null, meta: {} };
    }
    games[id++] = { away, home, startTimeUTC: `${DATE}T00:00:00Z`, capturedAt: `${DATE}T15:00:00Z`, teams };
  }
  return { date: DATE, updatedAt: `${DATE}T15:00:00Z`, games };
}

beforeAll(() => {
  files.set(rowsPath('20252026'), JSON.stringify({ season: 20252026, fields: ROW_FIELDS, updatedAt: '2026-01-15T10:00:00Z', rows: seasonRows(2025, 40) }));
  files.set(rowsPath('20242025'), JSON.stringify({ season: 20242025, fields: ROW_FIELDS, updatedAt: '2025-06-01T10:00:00Z', rows: seasonRows(2024, 60) }));
  files.set(positionsPath(DATE), JSON.stringify(snapshot()));
  files.set(PLAYERS_PATH, JSON.stringify({ updatedAt: '2026-01-15', players }));
});

describe('the NHL builders are kept per store state', () => {
  test('the slate, the picks and the first-goal board come back as the same objects until a write', async () => {
    const { buildSlate } = require('../lib/nhl-data/slate');
    const { buildPicks, buildShuffle } = require('../lib/nhl-data/picks');
    const { buildFirstGoalBoard } = require('../lib/nhl-data/firstgoal');
    // Two requests at once share one build.
    const [s1, s2] = await Promise.all([buildSlate(DATE), buildSlate(DATE)]);
    expect(s1).toBe(s2);
    expect(s1.games).toHaveLength(2);
    expect(s1.games[0].sides[0].skaters.length).toBe(18);
    // The soft-spot flag's read on every skater: PropFinder's table above the rink, on the tab it opens on, at his position.
    const { defaultDefenseTab } = require('../lib/nhl-data/propfinder-csv');
    const side0 = s1.games[0].sides[0]; const sk0 = side0.skaters[0]; const tab0 = defaultDefenseTab(side0.propfinder.tabs);
    expect(sk0.spot).toMatchObject({ source: 'propfinder', pos: sk0.pos, teams: tab0.count, tab: { key: tab0.key } });
    expect(sk0.spot.rankSog).toBe(tab0.rows[sk0.pos].ranks.sog);
    expect(sk0.spot.softSog).toBe(sk0.spot.rankSog <= Math.ceil(tab0.count / 3));
    expect(sk0.oppPos).not.toBeNull();   // the study's own environment stays beside it
    // The skater table's Opp S/G, the edges and the matchup read sit on the same table: PropFinder's per-position season table first.
    expect(sk0.vs.sog).toMatchObject({ source: 'propfinder', rank: expect.any(Number) });
    expect(sk0.vs.sog.allowed).toBe(side0.propfinder.tabs.find((t) => t.kind === 'season' && t.season === sk0.vs.sog.seasonLabel.slice(0, 4) * 1).rows[sk0.pos].sog);
    expect(sk0.projSog).toBeCloseTo(sk0.sog * sk0.vs.sog.ratio, 1);
    const downloads = calls.download;
    expect(await buildSlate(DATE)).toBe(s1);
    expect(calls.download).toBe(downloads);        // nothing read again for a hit
    const p1 = await buildPicks(DATE);
    expect(await buildPicks(DATE)).toBe(p1);
    expect(p1.games[0].shots.length).toBeGreaterThan(0);
    // The picks carry the same read (the top shooter may be on either side: his own opponent's tab), and the notes' team table is PropFinder's All row.
    const c0 = p1.games[0].shots[0]; const tabOf = defaultDefenseTab(s1.games[0].sides.find((s) => s.team === c0.team).propfinder.tabs);
    expect(c0.spot).toMatchObject({ source: 'propfinder', pos: c0.pos, tab: { key: tabOf.key } });
    expect(c0.oppRank).toBe(tabOf.rows.All.ranks.sog);
    expect(c0.oppSog).toBe(tabOf.rows.All.sog);
    expect(p1.allowed.notesFrom).toBe('propfinder');
    const sh = await buildShuffle(DATE);
    expect((await buildShuffle(DATE)).games[0].skaters).toBe(sh.games[0].skaters);   // reshaped over the kept board
    expect(sh.games[0].skaters.length).toBeGreaterThan(0);
    // Each opponent's PropFinder table rides on the shuffle for its Matchup column, keyed by the defending team, the same tabs as above the rink.
    expect(Object.keys(sh.defense).sort()).toEqual(['BOS', 'NJD', 'NYR', 'PHI']);
    expect(sh.defense.PHI).toEqual(expect.objectContaining({ tabs: expect.any(Array) }));
    expect(sh.defense.PHI.tabs.map((t) => t.key)).toEqual(s1.games[0].sides[0].propfinder.tabs.map((t) => t.key));
    const f1 = await buildFirstGoalBoard(DATE);
    expect(await buildFirstGoalBoard(DATE)).toBe(f1);
    // Another date is its own entry.
    const other = await buildSlate('2026-01-16');
    expect(other).not.toBe(s1);
    expect(await buildSlate(DATE)).toBe(s1);
    // A write through the store (a lineup read, a stored game, a pull) drops every build.
    await nhlStore.writeJson(gamesPath(DATE), { date: DATE, games: [] });
    const s3 = await buildSlate(DATE);
    expect(s3).not.toBe(s1);
    expect(s3.games).toHaveLength(2);
    expect(await buildPicks(DATE)).not.toBe(p1);
    expect(await buildFirstGoalBoard(DATE)).not.toBe(f1);
    expect(await buildSlate(DATE)).toBe(s3);
  });

  test('the defense tables of a rows array are built from one aggregate and kept', async () => {
    const { loadRows } = require('../lib/nhl-data/build');
    const { defenseByPosition, defenseBySlot, seasonDefense } = require('../lib/nhl-data/defense');
    const { gradeDefenseReads } = require('../lib/nhl-data/defense-grade');
    const { storedWindowTables, withStoredWindows } = require('../lib/nhl-data/propfinder');
    const rows = await loadRows(DATE);
    expect(await loadRows(DATE)).toBe(rows);
    expect(defenseByPosition(rows)).toBe(defenseByPosition(rows));
    expect(defenseByPosition(rows, { lastN: 5 })).toBe(defenseByPosition(rows, { lastN: 5 }));
    expect(defenseBySlot(rows).teams.PHI.ALL.LW1.gp).toBeGreaterThan(0);
    expect(seasonDefense(rows, DATE)).toBe(seasonDefense(rows, DATE));
    expect(seasonDefense(rows, DATE).season).toBe(2025);
    expect(seasonDefense(rows, DATE).teams.PHI.ALL.LW.per.sog).toBeGreaterThan(0);
    const win = storedWindowTables(rows, 'l5', { season: 2025 });
    expect(storedWindowTables(rows, 'l5', { season: 2025 })).toBe(win);
    expect(win.LW.teams.PHI.gp).toBe(5);
    // The slate's thirty-two sides read the windows off the same tables.
    const pf = { opponents: { season: 2025 }, opponentsByPos: {}, opponentsByWindow: {}, opponentsByPosWindow: {} };
    expect(withStoredWindows(pf, rows).opponentsByWindow.l5).toBe(withStoredWindows(pf, rows).opponentsByWindow.l5);
    const grade = gradeDefenseReads(rows, { season: 2025, to: DATE });
    expect(gradeDefenseReads(rows, { season: 2025, to: DATE })).toBe(grade);
    expect(grade.skaterGames).toBeGreaterThan(0);
  });

  test('small blobs stay within a byte budget, least recently used dropped first', async () => {
    const { readBlob, blobCacheStats } = nhlStore;
    files.set('data/media/logos/A.svg', 'a'.repeat(1000));
    files.set('data/media/logos/B.svg', 'b'.repeat(1000));
    const before = calls.download;
    const a = await readBlob('data/media/logos/A.svg', { cache: true });
    expect(await readBlob('data/media/logos/A.svg', { cache: true })).toBe(a);
    expect(calls.download).toBe(before + 1);
    await readBlob('data/media/logos/B.svg', { cache: true });
    expect(blobCacheStats()).toEqual({ entries: 2, bytes: 2000 });
    nhlStore.invalidate('data/media/logos/A.svg');
    expect(blobCacheStats()).toEqual({ entries: 1, bytes: 1000 });
    expect(await readBlob('data/media/logos/A.svg', { cache: true })).not.toBe(a);
    expect(calls.download).toBe(before + 3);
  });
});

describe('the NBA board is kept per slate files', () => {
  test('boardFor and shuffleFor build once for the same stored files; a finished OCR sheet reads through the cache', async () => {
    const nba = require('../lib/nba/store');
    const slate = { date: '2026-10-20' };
    const sched = { slate, games: [{ id: '401', date: '2026-10-21T00:00:00Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }], fetchedAt: new Date().toISOString() };
    files.set('nba/2026-10-20/schedule.json', JSON.stringify(sched));
    const game = (n, pts) => ({ date: `2026-10-${String(n).padStart(2, '0')}`, season: 2026, type: 'REG', gameId: `g${n}`, opp: 'NY', pts, reb: 5, ast: 3, tpm: 1, min: 30 });
    const pf = { at: new Date().toISOString(), data: { players: [{ key: 'jayson tatum', name: 'Jayson Tatum', team: 'BOS', pos: 'SF', games: Array.from({ length: 12 }, (_, i) => game(i + 1, 25 + (i % 5))), props: [{ market: 'pts', line: 24.5, over: -110, under: -110 }] }], defense: null, injuries: { rows: [] } } };
    files.set('nba/2026-10-20/propfinder.json', JSON.stringify(pf));
    const sheet = { id: 's1', fileName: 'nba_2026-10-20.pdf', at: '2026-10-20T10:00:00Z', source: 'upload', slate, rows: [{ player: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', market: null, group: 'players' }], sheets: [], warnings: [], ocr: { status: 'done' } };
    files.set('nba/2026-10-20/sheets-index.json', JSON.stringify({ sheets: [{ id: 's1', fileName: sheet.fileName, at: sheet.at, source: 'upload', rows: 1, ocr: { status: 'done' } }] }));
    files.set('nba/2026-10-20/sheets/s1.json', JSON.stringify(sheet));
    const b1 = await nba.boardFor(slate, { refresh: false });
    const downloads = calls.download;
    const b2 = await nba.boardFor(slate, { refresh: false });
    expect(b2.games).toBe(b1.games);                 // the same board
    expect(calls.download).toBe(downloads + 1);      // the sheets index is read fresh (an OCR job's progress); the finished sheet was not
    const sh1 = await nba.shuffleFor(slate, 'pts');
    expect(await nba.shuffleFor(slate, 'pts')).toBe(sh1);
    expect(await nba.shuffleFor(slate, 'reb')).not.toBe(sh1);
    // A new pull is a new board.
    await nhlStore.writeJson('nba/2026-10-20/propfinder.json', pf);
    const b3 = await nba.boardFor(slate, { refresh: false });
    expect(b3.games).not.toBe(b1.games);
    expect(b3.calibration).toBeNull();
    // A calibration the season's scorecard stored: a new board, its rungs printed through it, the stated chance beside.
    const fit = { a: -0.4, b: 0.6, n: 2000, hits: 900, check: { from: '2026-10-18', n: 500, stated: 0.25, calibrated: 0.24 }, use: true };
    await nhlStore.writeJson('nba/meta/calibration.json', { at: '2026-10-20T09:00:00Z', from: '2026-10-08', to: '2026-10-19', nights: 12, plays: 4000, rungs: 30000, reads: { plays: {}, rungs: { pts: fit } } });
    const b4 = await nba.boardFor(slate, { refresh: false });
    expect(b4.games).not.toBe(b3.games);
    expect(b4.calibration).toMatchObject({ nights: 12, rungs: ['pts'] });
    const rung = b4.games[0].sides.BOS.players[0].ladders.pts.find((r) => r.main);
    expect(rung.raw).toBeGreaterThan(rung.p);
    expect((await nba.shuffleFor(slate, 'pts')).calibrated).toMatchObject({ a: -0.4, b: 0.6 });
    await nhlStore.writeJson('nba/meta/calibration.json', {});
    expect((await nba.boardFor(slate, { refresh: false })).calibration).toBeNull();
  });
  test('the admin’s injury override reaches the board, the shuffle and the card through the stored pull', async () => {
    const nba = require('../lib/nba/store');
    const slate = { date: '2026-10-22' };
    files.set('nba/2026-10-22/schedule.json', JSON.stringify({ slate, games: [{ id: '402', date: '2026-10-23T00:00:00Z', away: 'LAL', home: 'NY', final: false, state: 'pre' }], fetchedAt: new Date().toISOString() }));
    const game = (n, pts) => ({ date: `2026-10-${String(n).padStart(2, '0')}`, season: 2026, type: 'REG', gameId: `g${n}`, opp: 'NY', pts, reb: 5, ast: 8, tpm: 2, min: 34 });
    const logs = Array.from({ length: 6 }, (_, i) => game(i + 1, 30));
    const pf = { at: new Date().toISOString(), data: { players: [
      { id: 'p1', key: 'luka doncic', name: 'Luka Doncic', team: 'LAL', pos: 'PG', games: logs, props: [{ market: 'pts', line: 29.5, over: -110, under: -110 }], injury: 'Out', injuryDetail: 'calf', injuryFrom: 'report' },
      { id: 'p2', key: 'austin reaves', name: 'Austin Reaves', team: 'LAL', pos: 'SG', games: logs.map((g) => ({ ...g, pts: 20, ast: 5 })), props: [{ market: 'pts', line: 19.5, over: -110, under: -110 }] },
    ], defense: null, injuries: { rows: [{ id: 'p1', name: 'Luka Doncic', key: 'luka doncic', team: 'LAL', pos: 'PG', status: 'Out', detail: 'calf', raw: 'out', date: null }] } } };
    files.set('nba/2026-10-22/propfinder.json', JSON.stringify(pf));
    const before = await nba.boardFor(slate, { refresh: false });
    expect(before.games[0].out).toBe(1);
    expect(before.games[0].sides.LAL.players.find((p) => p.key === 'austin reaves').own.pts.lift).toBeGreaterThan(0);   // Luka's points handed over
    // Marked playing by hand: his rows come back, nothing is handed over, the card says who marked him.
    await nba.setOverride(slate, { team: 'LAL', key: 'luka doncic', status: 'Active', detail: 'set by hand', name: 'Luka Doncic' });
    expect((await nba.loadOverrides(slate)).players['LAL|luka doncic']).toMatchObject({ status: 'Active', detail: 'set by hand' });
    const after = await nba.boardFor(slate, { refresh: false });
    expect(after.games).not.toBe(before.games);
    expect(after.games[0].out).toBe(0);
    expect(after.games[0].sides.LAL.players.find((p) => p.key === 'luka doncic')).toMatchObject({ injury: 'Active', injuryFrom: 'override', out: false, health: 'In' });
    expect(after.games[0].sides.LAL.players.find((p) => p.key === 'austin reaves').own.pts.lift).toBeUndefined();
    expect((await nba.shuffleFor(slate, 'pts')).players.find((p) => p.key === 'luka doncic')).toMatchObject({ health: 'In', injuryFrom: 'override' });
    const card = await nba.playerFor(slate, 'luka doncic');
    expect(card.player).toMatchObject({ injury: 'Active', injuryFrom: 'override', override: { status: 'Active' } });
    expect(card.teammates.map((t) => t.key)).toEqual(['austin reaves']);
    // Cleared: the report's word again. The same board object while nothing changes.
    await nba.setOverride(slate, { team: 'LAL', key: 'luka doncic', status: null });
    expect((await nba.boardFor(slate, { refresh: false })).games[0].out).toBe(1);
    const same = await nba.boardFor(slate, { refresh: false });
    expect((await nba.boardFor(slate, { refresh: false })).games).toBe(same.games);
  });
});

describe('a big file is stored gzipped', () => {
  test('writeJson with gzip stores gzip bytes and readJson reads them back as JSON', async () => {
    const value = { ok: true, data: { players: Array.from({ length: 200 }, (_, i) => ({ id: i, games: Array.from({ length: 20 }, (__, g) => ({ g, pts: g * 2 })) })) } };
    await nhlStore.writeJson('nfl/2026/8/propfinder.json', value, { gzip: true });
    const stored = files.get('nfl/2026/8/propfinder.json');
    expect(Buffer.isBuffer(stored)).toBe(true);
    expect([stored[0], stored[1]]).toEqual([0x1f, 0x8b]);
    expect(stored.length).toBeLessThan(JSON.stringify(value).length / 5);
    expect(await nhlStore.readJson('nfl/2026/8/propfinder.json')).toEqual(value);            // the copy cached on write
    expect(await nhlStore.readJson('nfl/2026/8/propfinder.json', { fresh: true })).toEqual(value);   // read back from the bytes
    await nhlStore.writeJson('nfl/2026/8/schedule.json', { games: [] });
    expect(typeof files.get('nfl/2026/8/schedule.json')).toBe('string');
    expect(await nhlStore.readJson('nfl/2026/8/schedule.json', { fresh: true })).toEqual({ games: [] });
  });
});

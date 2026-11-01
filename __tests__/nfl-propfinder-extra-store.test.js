import { describe, expect, test, jest } from '@jest/globals';

// The pull's extra through the store, behind the in-process bucket mock: one gzipped file a team plus an index, the
// board's file without it, and the reader the /api/nfl/propfinder route answers from.
const files = new Map();
const bucket = {
  async list(prefix) { const names = new Set(); for (const p of files.keys()) if (p.startsWith(`${prefix}/`)) names.add(p.slice(prefix.length + 1).split('/')[0]); return { data: [...names].map((name) => ({ name })), error: null }; },
  async download(path) {
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
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { getBucket: async () => ({ data: { name: 'nhl-model' } }), from: () => bucket } }) }));

const { makeStore } = require('../lib/picks/store');
const { extraOf } = require('../lib/nfl/propfinder-nfl');
const { readJson } = require('../lib/nhl-store');

const RAW = [
  { id: 'p1', name: 'CeeDee Lamb', fullPosition: 'WR1', team: { code: 'DAL' }, stats: [{ gameId: 'g1', gameDate: '2026-10-26', q2ReceivingYards: 31, receivingYards: 74 }], odds: [{ market: 'Player Fantasy Score', categoryMapping: 'fantasyPoints', points: 14.5, price: -110, selectionLine: 'over', sportsbook: 'DK' }] },
  { id: 'p2', name: 'A.J. Brown', fullPosition: 'WR1', team: { code: 'PHI' }, stats: [{ gameId: 'g1', gameDate: '2026-10-26', q3ReceivingYards: 12 }] },
];
const TEAMS = [{ id: 't1', code: 'DAL', stats: [{ type: 'Opponent', position: 'WR1', year: 2026, lastNGames: 3, gamesPlayed: 3, receivingYards: 240, receivingYardsRank: 4 }] }, { id: 't2', code: 'PHI', stats: [] }];

describe('the pull kept whole, a team a file', () => {
  const store = makeStore({
    sport: 'nfl', slateKey: (s) => `${s.season}/w${s.week}`,
    fetchSchedule: async () => ({ games: [{ id: 'g1', away: 'DAL', home: 'PHI', date: '2026-10-26T17:00:00Z' }] }),
    propfinderConfigured: () => true, seasonOf: () => 2026, sameSlate: () => false,
    pullSlate: async () => ({ ok: true, players: 2, data: { players: [], defense: {}, extra: { abbrs: ['DAL', 'PHI'], of: (a) => extraOf(RAW.filter((p) => p.team.code === a), TEAMS.filter((t) => t.code === a)) } } }),
  });
  const wk = { season: 2026, week: 8, type: 2 };
  test('stored and read back', async () => {
    const r = await store.pullPropfinder(wk, { force: true });
    expect(r.extra).toEqual({ players: 2, games: 2, otherProps: 1, teams: 2, teamRows: 1 });
    const board = await readJson('nfl/2026/w8/propfinder.json');
    expect(board.data.extra).toBeUndefined();
    expect(board.extra).toEqual(r.extra);
    expect(Buffer.isBuffer(files.get('nfl/2026/w8/propfinder-extra/DAL.json'))).toBe(true); // gzipped
    const lamb = await store.extraFor(wk, { player: 'Ceedee Lamb' });
    expect(lamb.players.p1).toMatchObject({ name: 'CeeDee Lamb', team: 'DAL', info: { id: 'p1', fullPosition: 'WR1' }, games: { g1: { q2ReceivingYards: 31 } } });
    expect(Object.keys(lamb.players.p1.otherProps)).toEqual(['Player Fantasy Score [fantasyPoints]']);
    const dal = await store.extraFor(wk, { team: 'dal' });
    expect(dal.teams.DAL.rows[0]).toMatchObject({ position: 'WR1', lastNGames: 3, receivingYardsRank: 4 });
    const all = await store.extraFor(wk);
    expect(all.players).toEqual([{ id: 'p1', name: 'CeeDee Lamb', team: 'DAL' }, { id: 'p2', name: 'A.J. Brown', team: 'PHI' }]);
    expect(await store.extraFor({ season: 2026, week: 9, type: 2 })).toBeNull();
  });
});

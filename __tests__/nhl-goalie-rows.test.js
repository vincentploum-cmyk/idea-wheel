import { expect, test, jest } from '@jest/globals';
// The goalie rows file the nightly ingest writes is the one the site reads (Vincent, 2026-11-25: "the goalkeepers for
// nhl are not updated": the ingest filed rows under the game record's season, 20262027, and the reader read 2026).
const files = new Map();
const store = {
  async list(prefix) { const names = new Set(); for (const p of files.keys()) if (p.startsWith(`${prefix}/`)) names.add(p.slice(prefix.length + 1).split('/')[0]); return { data: [...names].map((name) => ({ name })), error: null }; },
  async download(path) { if (!files.has(path)) return { data: null, error: new Error('not found') }; const text = files.get(path); return { data: { text: async () => String(text), size: text.length }, error: null }; },
  async upload(path, body) { files.set(path, await body.text()); return { data: { path }, error: null }; },
  async remove(paths) { for (const p of paths) files.delete(p); return { data: null, error: null }; },
};
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
jest.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));
jest.mock('@supabase/ssr', () => ({ createServerClient: () => ({}) }));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { getBucket: async () => ({ data: { name: 'nhl-model' } }), from: () => store } }) }));

const { writeGoalieRows, loadGoalieRows, legacyGoalieRowsPath } = require('../lib/nhl-data/goalies');
const { goalieRowsPath, GOALIE_ROW_FIELDS, goalieRowsOf } = require('../lib/nhl-data/goalies-pure');

const game = (id, date, starter = 'Oettinger') => ({
  id, date, season: 20262027, away: { abbrev: 'NSH' }, home: { abbrev: 'DAL' },
  goalies: [{ id: 1, name: starter, team: 'DAL', venue: 'H', toi: 60, sa: 30, ga: 2, sv: 28, starter: true, decision: 'W' }],
});

test('the nightly ingest writes the start-year file the reader reads, folding in the misfiled rows', async () => {
  // As stored on 2026-11-25: the Oct 31 rebuild under 2026, the ingests since under 20262027.
  files.set(goalieRowsPath(2026), JSON.stringify({ season: 2026, fields: GOALIE_ROW_FIELDS, rows: goalieRowsOf(game(1, '2026-10-20')) }));
  files.set(legacyGoalieRowsPath(2026), JSON.stringify({ season: 20262027, fields: GOALIE_ROW_FIELDS, rows: goalieRowsOf(game(2, '2026-11-10')) }));
  expect(legacyGoalieRowsPath(2026)).toBe('data/goalie-rows/20262027.json');

  // The reader sees both before any new ingest.
  const before = await loadGoalieRows('2026-11-25');
  expect(before.map((r) => r.gameId)).toEqual([1, 2]);

  // Tonight's ingest lands in 2026.json with the misfiled rows folded in, a game written twice kept once.
  await writeGoalieRows([game(3, '2026-11-24', 'Bishop'), game(2, '2026-11-10')]);
  const file = JSON.parse(files.get(goalieRowsPath(2026)));
  expect(file.season).toBe(2026);
  expect(file.rows.map((r) => r[1])).toEqual([1, 2, 3]);
  const after = await loadGoalieRows('2026-11-25');
  expect(after.map((r) => [r.gameId, r.name])).toEqual([[1, 'Oettinger'], [2, 'Oettinger'], [3, 'Bishop']]);
});

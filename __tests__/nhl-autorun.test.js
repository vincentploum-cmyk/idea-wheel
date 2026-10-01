import { describe, expect, test } from '@jest/globals';
import { lineupRowsFromSnapshot } from '../lib/nhl-data/positions';
import { coveredTeams, autoRunKey, attemptBlocks } from '../lib/nhl-data/autorun';

const team = {
  source: 'gamedaytweets',
  players: {
    'a': { id: 1, name: 'Artemi Panarin', pos: 'LW', line: 1 }, 'b': { id: 2, name: 'Vincent Trocheck', pos: 'C', line: 1 }, 'c': { id: 3, name: 'Mika Zibanejad', pos: 'RW', line: 1 },
    'd': { id: 4, name: 'Adam Fox', pos: 'D', line: 1 }, 'e': { id: 5, name: 'Vladislav Gavrikov', pos: 'D', line: 1 },
    'f': { id: 6, name: 'Spare Guy', pos: 'C', line: null, inLineup: false },
  },
};

describe('automatic model run inputs', () => {
  test('a snapshot team becomes the lineup rows the model reads, with PropFinder spellings', () => {
    const rows = lineupRowsFromSnapshot('NYR', team, { 3: 'Mika Zibanejad ' });
    expect(rows[0]).toBe('Rangers projected lineup');
    expect(rows[1]).toBe('Artemi Panarin -- Vincent Trocheck -- Mika Zibanejad ');
    expect(rows[2]).toBe('Adam Fox -- Vladislav Gavrikov');
    expect(rows).toHaveLength(3);
    expect(lineupRowsFromSnapshot('NYR', { players: {} })).toEqual([]);
  });
  test('only teams with real lines count, and the key changes when lines or files change', () => {
    const snap = { games: { 1: { away: 'NYR', home: 'FLA', teams: { NYR: team, FLA: { source: 'roster', players: {} } } } } };
    const covered = coveredTeams(snap);
    expect(covered.map((t) => t.abbr)).toEqual(['NYR']);
    const meta = { files: { season: { receivedAt: '2026-10-01T15:00:00Z' }, l5: { receivedAt: '2026-10-01T15:00:00Z' } } };
    const k1 = autoRunKey('2026-10-01', meta, covered);
    expect(k1).toMatch(/^auto:[0-9a-f]{32}$/);
    expect(autoRunKey('2026-10-01', meta, covered)).toBe(k1);
    expect(autoRunKey('2026-10-01', { files: { season: { receivedAt: '2026-10-01T16:00:00Z' }, l5: meta.files.l5 } }, covered)).not.toBe(k1);
    const moved = JSON.parse(JSON.stringify(snap)); moved.games[1].teams.NYR.players.a.line = 2;
    expect(autoRunKey('2026-10-01', meta, coveredTeams(moved))).not.toBe(k1);
  });
  test('an unfinished attempt with the same inputs blocks a retry for a day', () => {
    const now = Date.parse('2026-10-01T05:00:00Z');
    const open = { date: '2026-10-01', autoKey: 'auto:abc', startedAt: '2026-10-01T04:12:00Z' };
    expect(attemptBlocks(open, 'auto:abc', now)).toBe(true);
    // A different deploy gets a fresh attempt; the same deploy does not.
    expect(attemptBlocks({ ...open, build: 'aaa111' }, 'auto:abc', now, 'bbb222')).toBe(false);
    expect(attemptBlocks({ ...open, build: 'aaa111' }, 'auto:abc', now, 'aaa111')).toBe(true);
    expect(attemptBlocks({ ...open, build: 'aaa111' }, 'auto:abc', now, null)).toBe(true);
    expect(attemptBlocks(open, 'auto:other', now)).toBe(false); // the lines or files changed
    expect(attemptBlocks({ ...open, finishedAt: '2026-10-01T04:13:00Z', error: 'x' }, 'auto:abc', now)).toBe(false);
    expect(attemptBlocks(open, 'auto:abc', now + 25 * 3600 * 1000)).toBe(false);
    expect(attemptBlocks(null, 'auto:abc', now)).toBe(false);
  });
});

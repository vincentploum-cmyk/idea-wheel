import { describe, expect, test } from '@jest/globals';
import * as XLSX from 'xlsx';
import { defenseBlocks, matchupWorkbooks } from '../lib/nhl-data/propfinder-api';
import { parseMatchupWorkbook, slateExport } from '../lib/nhl-data/study-export';
import { TEAMS, PLAYERS } from './fixtures/propfinder-api';

// The study export reads back the matchup workbooks the daily pull stores (built here the same way).
const books = matchupWorkbooks([{ away: 'PIT', home: 'PHI' }], TEAMS, PLAYERS, { season: 2025, date: '2026-09-30' });
const reread = (wb) => XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });

describe('study export', () => {
  test('the defense table by position, with its ranks and window, as the pull stored it', () => {
    const { defense } = parseMatchupWorkbook(reread(books.season.wb));
    const def = defenseBlocks(TEAMS, { season: 2025 });
    const phiD = defense.find((d) => d.team === 'PHI' && d.pos === 'D');
    expect(phiD).toMatchObject({ window: 'Season', g: def.teams.PHI.D.g, sog: def.teams.PHI.D.sog, sogRank: def.ranks.PHI.D.sog, gRank: def.ranks.PHI.D.g });
    expect(defense.filter((d) => d.team === 'PIT').map((d) => d.pos)).toEqual(['All', 'LW', 'C', 'RW', 'D']);
  });
  test('the skaters with PropFinder position labels, season and L5', () => {
    const out = slateExport('2026-09-30', { seasonBook: reread(books.season.wb), l5Book: reread(books.l5.wb), props: { at: 'x', skaters: [{ name: 'Sidney Crosby', team: 'PIT', pos: 'C', sog: { lines: [] }, goal: null, key: 'sidney crosby' }] } });
    expect(out.skaters.find((s) => s.name === 'Sidney Crosby' && s.window === 'Season')).toMatchObject({ team: 'PIT', pos: 'C', gp: 68, sog: 2.34 });
    expect(out.skaters.find((s) => s.name === 'Sidney Crosby' && s.window === 'Last 5 Games')).toMatchObject({ sog: 3 });
    // The two workbooks carry the same defense block once.
    expect(out.defense.filter((d) => d.team === 'PHI' && d.pos === 'D')).toHaveLength(1);
    expect(out.props.skaters[0]).toEqual({ name: 'Sidney Crosby', team: 'PIT', pos: 'C', sog: { lines: [] }, goal: null });
  });
  test('missing files give an empty date, not an error', () => {
    expect(slateExport('2026-10-01', {})).toEqual({ date: '2026-10-01', defense: [], skaters: [], props: null });
  });
});

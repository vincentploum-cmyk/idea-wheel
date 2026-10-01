import { describe, expect, test } from '@jest/globals';
import * as XLSX from 'xlsx';
import { toiMinutes, gameRates, teamAbbr, activeSeason, skaterWindows, skaterTables, pickRow, teamRow, teamTables, defenseBlocks, matchupWorkbooks, tokenFromLogin, tokenExpiry } from '../lib/nhl-data/propfinder-api';
import { mergeSkaters, mergeTeams } from '../lib/nhl-data/propfinder';
import { inspectMatchups } from '../lib/nhl-data/matchups';
import { parseMatchups } from '../components/nhl/model-core';
import { TEAMS, PLAYERS } from './fixtures/propfinder-api';

const DATE = '2026-09-30';
const crosby = PLAYERS.find((p) => p.name === 'Sidney Crosby');
const pit = TEAMS.find((t) => t.code === 'PIT');

describe('PropFinder API → skater tables', () => {
  test('time on ice and sparse game rows', () => {
    expect(toiMinutes('20:59')).toBeCloseTo(20.98, 2);
    expect(toiMinutes('1:02:03')).toBeCloseTo(62.05, 2);
    expect(toiMinutes('')).toBe(0);
    // Zero fields are omitted by the API; iCF / iFF fall back to their parts.
    expect(gameRates([{ shots: 2, missedShots: 4, blockedAtt: 1, totalTimeOnIce: '20:00' }])).toMatchObject({ gp: 1, sog: 2, isf: 2, icf: 7, iff: 6, g: 0, a: 0, toi: 20 });
    expect(gameRates([])).toBeNull();
  });
  test('the season picks the current year once it has regular-season games', () => {
    // 2026-27 has not started: a few teams already carry a one-game 2026 row, no player has a game.
    expect(TEAMS.some((t) => t.stats.some((r) => r.seasonYear === 2026))).toBe(true);
    expect(activeSeason(PLAYERS, '2026-09-30')).toBe(2025);
    expect(activeSeason(PLAYERS, '2026-03-01')).toBe(2025);
    const started = [{ ...crosby, stats: [{ gameDate: '2026-10-08T23:00:00Z', season: 2026, seasonType: 'REG', shots: 1, totalTimeOnIce: '18:00' }] }];
    expect(activeSeason(started, '2026-10-09')).toBe(2026);
    // Until a player has a game in the new season his season window is last season's (marked).
    const w = skaterWindows(crosby, 2026);
    expect(w.seasonOf).toBe(2025);
    expect(w.season).toHaveLength(68);
    expect(skaterTables(PLAYERS, { season: 2026, date: '2026-10-07' }).skaters.players.find((p) => p.name === 'Sidney Crosby')).toMatchObject({ gp: 68, seasonOf: 2025 });
    expect(skaterTables(PLAYERS, { season: 2025, date: DATE }).skaters.players.find((p) => p.name === 'Sidney Crosby').seasonOf).toBeUndefined();
  });
  test('season rates reproduce the Skater Stats CSV row (Sidney Crosby C, 68 GP)', () => {
    // nhl-skater-stats-All-All-All-2025-2026-09-30.csv: 68,19.24,0.43,2.34,2.34,4.26,3.49,2.66,1.26
    const w = skaterWindows(crosby, 2025);
    const r = gameRates(w.season);
    expect(r.gp).toBe(68);
    expect(r.toi).toBeCloseTo(19.24, 1);
    expect(r).toMatchObject({ g: 0.43, sog: 2.34, isf: 2.34, icf: 4.26, iff: 3.49, iscf: 2.66, ihdcf: 1.26 });
    // Playoff games are not season rates, but they are "last 5" games.
    expect(w.season.every((g) => g.seasonType === 'REG')).toBe(true);
    expect(w.l5.map((g) => g.seasonType)).toEqual(['PST', 'PST', 'PST', 'PST', 'PST']);
  });
  test('last-5 rates reproduce the Count Window 5 exports, all venues and home only', () => {
    // nhl-skater-stats-All-All-All-5-2026-09-30.csv: Sidney Crosby C,5,21.22,0.20,3.00,3.00,5.20,4.40,1.40,0.60
    expect(gameRates(skaterWindows(crosby, 2025).l5)).toMatchObject({ gp: 5, toi: 21.22, g: 0.2, sog: 3, icf: 5.2, iff: 4.4, iscf: 1.4, ihdcf: 0.6 });
    // …-Home-5-…csv: Sidney Crosby C,5,19.16,0.20,2.20,2.20,3.40,3.20,1.40,0.80
    expect(gameRates(skaterWindows(crosby, 2025).l5Home)).toMatchObject({ gp: 5, g: 0.2, sog: 2.2, icf: 3.4, iff: 3.2, iscf: 1.4, ihdcf: 0.8 });
    expect(gameRates(skaterWindows(crosby, 2025).l5Home).toi).toBeCloseTo(19.16, 1);
  });
  test('the four tables carry skaters only, with position, team and status tags', () => {
    const t = skaterTables(PLAYERS, { season: 2025, date: DATE });
    expect(Object.keys(t).sort()).toEqual(['skaters', 'skatersL5', 'skatersL5Away', 'skatersL5Home']);
    expect(t.skaters).toMatchObject({ kind: 'skaters', season: 2025, windowGames: null, split: null, date: DATE });
    expect(t.skatersL5Home).toMatchObject({ windowGames: 5, split: 'H' });
    const names = t.skaters.players.map((p) => p.name);
    expect(names).toContain('Sidney Crosby');
    expect(names).not.toContain('Arturs Silovs'); // goalie
    expect(names).not.toContain('Ryan Miller'); // no games
    expect(t.skaters.players.find((p) => p.name === 'Sidney Crosby')).toMatchObject({ pos: 'C', team: 'PIT', status: null, gp: 68 });
    expect(t.skaters.players.find((p) => p.name === 'Rodrigo Abols')).toMatchObject({ team: 'PHI', status: 'IR' });
    // Stores through the same merge as a CSV import.
    const { file } = mergeSkaters(null, t.skaters, { fileName: 'api', source: 'propfinder-api', at: '2026-09-30T12:00:00Z' });
    expect(file.players['sidney crosby']).toMatchObject({ sog: 2.34, asOf: DATE });
    expect(file.windowGames).toBeNull();
  });
});

describe('PropFinder API → team tables', () => {
  test('team codes map to the site abbreviations', () => {
    expect(teamAbbr({ code: 'PIT' })).toBe('PIT');
    expect(teamAbbr({ code: 'LA', fullName: 'Los Angeles Kings' })).toBe('LAK');
    expect(teamAbbr({ code: 'NJ' })).toBe('NJD');
    expect(teamAbbr({ code: 'SJ' })).toBe('SJS');
    expect(teamAbbr({ code: 'TB' })).toBe('TBL');
    expect(teamAbbr({ code: 'XX', fullName: 'Nowhere' })).toBeNull();
  });
  test('the full-season row is the season-only one; windows by lastNGames', () => {
    expect(pickRow(pit.stats, { season: 2025, type: 'Team', position: 'All' })).toMatchObject({ seasonType: '', gamesPlayed: 82 });
    expect(pickRow(pit.stats, { season: 2025, type: 'Opponent', position: 'D' })).toMatchObject({ gamesPlayed: 88 });
    expect(pickRow(pit.stats, { season: 2025, type: 'Opponent', position: 'D', lastN: 10 })).toMatchObject({ lastNGames: 10, gamesPlayed: 10 });
    expect(pickRow(pit.stats, { season: 2026, type: 'Team', position: 'All' })).toBeNull();
  });
  test('team row reproduces the Team Stats CSV (Penguins, 2025, Full Season)', () => {
    // Penguins,82,3.54 #3,6.02 #3,9.56 #3,28.57 #10,12.4% #3,17.61 #30,14.68 #11,4.95 #7,16.35 #5,48.2% #24,24.1% #7,81.4% #6,10.82 #12,4.40 #16,0.46 #24
    const r = teamRow('PIT', pickRow(pit.stats, { season: 2025, type: 'Team', position: 'All' }));
    expect(r.name).toBe('Penguins');
    expect(r.gp).toBe(82);
    expect(r.values).toEqual({ g: 3.54, a: 6.02, pts: 9.56, sog: 28.57, shPct: 12.4, hit: 17.61, blk: 14.68, tk: 4.95, gv: 16.35, foPct: 48.2, ppPct: 24.1, pkPct: 81.4, sc: 10.82, hdc: 4.4, hdg: 0.46 });
    // PropFinder's own ranks, as the export prints them…
    expect(r.ranks).toEqual({ g: 3, a: 3, pts: 3, sog: 10, shPct: 3, hit: 30, blk: 11, tk: 7, foPct: 24, ppPct: 7, pkPct: 6, sc: 12, hdc: 16, hdg: 24 });
    // …except giveaways, which the export ranks by value 1 = most (the API's rank runs the other way).
    const table = teamTables(TEAMS, { season: 2025, date: DATE }).find((t) => t.statsType === 'team');
    const byGv = [...table.teams].sort((a, b) => b.values.gv - a.values.gv);
    expect(byGv.map((t) => t.ranks.gv)).toEqual([1, 2, 3, 4]);
    expect(table.teams.find((t) => t.abbr === 'PIT').ranks).toMatchObject({ g: 3, gv: 1 + table.teams.filter((t) => t.values.gv > 16.35).length });
  });
  test('opponent tables reproduce the Opponent CSVs (Canucks vs C, Maple Leafs last 10)', () => {
    const tables = teamTables(TEAMS, { season: 2025, date: DATE });
    const vsC = tables.find((t) => t.statsType === 'opponent' && t.position === 'C' && !t.windowGames);
    // nhl-team-stats-Opponent-2025-2026-09-30c.csv: Canucks,82,1.15 #1,1.70 #1,2.84 #1,7.51 #3,15.3% #2,3.82 #27,2.26 #22,1.06 #21,3.34 #6,51.2% #8,…,8.41 #4,3.74 #13,0.48 #10
    const van = vsC.teams.find((t) => t.abbr === 'VAN');
    expect(van.values).toMatchObject({ g: 1.15, a: 1.7, pts: 2.84, sog: 7.51, shPct: 15.3, hit: 3.82, blk: 2.26, tk: 1.06, gv: 3.34, foPct: 51.2, sc: 8.41, hdc: 3.74, hdg: 0.48 });
    expect(van.ranks).toMatchObject({ g: 1, sog: 3, sc: 4, hit: 27 });
    expect(van.values.ppPct).toBeUndefined(); // not reported per position
    expect(vsC).toMatchObject({ window: 'Full Season', windowGames: null, split: null, season: 2025 });
    // …-Opponent-2025-L10-2026-09-30_all_l10.csv: Maple Leafs,10,4.70 #1,8.10 #1,12.80 #1,33.70 #1,13.9% #6,…,31.10 #3,10.70 #23,1.40 #15
    const l10 = tables.find((t) => t.statsType === 'opponent' && t.position === 'All' && t.windowGames === 10);
    expect(l10.window).toBe('Last 10');
    expect(l10.teams.find((t) => t.abbr === 'TOR')).toMatchObject({ gp: 10, values: { g: 4.7, a: 8.1, pts: 12.8, sog: 33.7, shPct: 13.9, sc: 31.1, hdc: 10.7, hdg: 1.4 }, ranks: { g: 1, sog: 1, shPct: 6, sc: 3 } });
    // 1 team + 3 windows + 4 positions × 3 windows = 16 tables, each storable through mergeTeams.
    expect(tables).toHaveLength(16);
    const { file } = mergeTeams(null, l10, { fileName: 'api', source: 'propfinder-api', at: '2026-09-30T12:00:00Z' });
    expect(file).toMatchObject({ statsType: 'opponent', position: 'All', windowGames: 10, count: 4 });
    expect(file.ranks.TOR.g).toBe(1);
  });
  test('defense blocks: per-game allowed per position over the last 10, ranked 1 = most', () => {
    const d = defenseBlocks(TEAMS, { season: 2025 });
    expect(d.label).toBe('Defense (Last 10 Games)');
    expect(d.teams.PIT.D).toMatchObject({ gp: 10, g: 0.8, a: 1.7, sog: 7.8, icf: 17.1, iff: 11.8, iscf: 4.4 });
    expect(d.teams.TOR.All.sog).toBe(33.7);
    expect(d.ranks.TOR.All.sog).toBe(1);
    expect(Object.values(d.ranks).map((r) => r.All.sog).sort()).toEqual([1, 2, 3, 4]);
    // A season without last-10 rows falls back to the season totals and says so.
    expect(defenseBlocks(TEAMS, { season: 2024 }).label).toBe('Defense (Season)');
  });
});

describe('PropFinder API → matchup workbooks', () => {
  const slate = [{ away: 'PIT', home: 'PHI' }];
  const books = matchupWorkbooks(slate, TEAMS, PLAYERS, { season: 2025, date: DATE });
  const bin = (wb) => XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  test('the site recognises them as the season and L5 PropFinder files', () => {
    expect(books.season.name).toBe('NHL-Goal-Matchups-2026-09-30.xlsx');
    expect(books.l5.name).toBe('NHL-Goal-Matchups-2026-09-30-L5.xlsx');
    expect(books.season.wb.SheetNames).toEqual(['Penguins @ Flyers']);
    const s = inspectMatchups(bin(books.season.wb), books.season.name);
    expect(s).toMatchObject({ kind: 'season', date: DATE, games: 1 });
    expect(s.names['Sidney Crosby']).toEqual({ team: 'PIT', pos: 'C' });
    expect(s.defense.PHI.D).toHaveLength(6);
    expect(inspectMatchups(bin(books.l5.wb), books.l5.name).kind).toBe('l5');
  });
  test('the model parses them like PropFinder exports', () => {
    const games = parseMatchups(XLSX.read(bin(books.season.wb), { type: 'buffer' }), XLSX.read(bin(books.l5.wb), { type: 'buffer' }));
    expect(games).toHaveLength(1);
    expect(games[0].label).toBe('Penguins @ Flyers');
    const pit = games[0].skaterBlocks.find((b) => b.team === 'Penguins');
    const sid = pit.players.find((p) => p.name === 'Sidney Crosby');
    expect(sid).toMatchObject({ pos: 'C', gp: 68, shotsSeason: 2.34, icfSeason: 4.26, iffSeason: 3.49, iscfSeason: 2.66, shotsL5: 3, icfL5: 5.2, gpL5: 5 });
    expect(sid.toiSeason).toBeCloseTo(19.24, 1);
    expect(pit.oppDef.team).toBe('Flyers');
    expect(pit.oppDef.posStats.C).toMatchObject({ shotsAllowed: expect.any(Number), ranks: { shots: expect.any(Number) } });
    expect(Object.keys(pit.oppDef.posStats).sort()).toEqual(['ALL', 'C', 'D', 'LW', 'RW']);
    expect(pit.players.map((p) => p.name)).not.toContain('Arturs Silovs');
  });
});

describe('PropFinder sign-in response', () => {
  test('the access token comes from the JSON body or the cookie', () => {
    expect(tokenFromLogin({ accessToken: 'a'.repeat(30) })).toBe('a'.repeat(30));
    expect(tokenFromLogin({ data: { tokens: { access_token: 'b'.repeat(30) } } })).toBe('b'.repeat(30));
    expect(tokenFromLogin(null, 'refreshToken=zzz; Path=/, accessToken=c%2Bd; HttpOnly')).toBe('c+d');
    expect(tokenFromLogin({ ok: true }, '')).toBeNull();
    const payload = Buffer.from(JSON.stringify({ exp: 1791077329 })).toString('base64url');
    expect(tokenExpiry(`x.${payload}.y`)).toBe(1791077329000);
    expect(tokenExpiry('nope')).toBeNull();
  });
});

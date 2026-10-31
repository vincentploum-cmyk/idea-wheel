import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { parseOverview, overviewUrl, spzSeasonKey, spzCell, spzTeamRead, STATS, SPZ_MIN_VENUE_GAMES } from '../lib/nhl-data/shotpropz';

// The two boards as served on 2026-10-30 (the tables and the filters, trimmed from the pages).
const offense = fs.readFileSync(path.join(__dirname, 'fixtures/shotpropz-offense.html'), 'utf8');
const defense = fs.readFileSync(path.join(__dirname, 'fixtures/shotpropz-defense.html'), 'utf8');

describe('shotpropz', () => {
  test('the offense board: four tables, 32 teams each, the sort values (not the rounded text), the ranks with ties, the page stamp', () => {
    const p = parseOverview(offense);
    expect(Object.keys(p.stats)).toEqual(['gf', 'sf', 'ppo', 'ppPct']);
    for (const k of Object.keys(p.stats)) expect(p.stats[k].count).toBe(32);
    expect(p.stats.gf.teams.EDM).toEqual({ gp: 13, value: 4.23, rank: 1 });
    expect(p.stats.gf.teams.CAR.rank).toBe(3); expect(p.stats.gf.teams.TOR.rank).toBe(3); expect(p.stats.gf.teams.SEA.rank).toBe(5);
    expect(p.stats.gf.heat).toEqual({ min: 1.93, mid: 3.13, max: 4.23 });
    expect(p.stats.ppPct.teams.MTL.value).toBeGreaterThan(0);
    expect(p.updated).toBe('Oct 30, 2026');
    expect(p).toMatchObject({ season: '26_27', span: 'YTD', location: 'All' });
  });
  test('the defense board: goals and shots against, power plays given, PK%; rank 1 = the softest', () => {
    const p = parseOverview(defense);
    expect(Object.keys(p.stats)).toEqual(['ga', 'sa', 'ppoa', 'pkPct']);
    expect(p.stats.ga.teams.VAN).toEqual({ gp: 15, value: 4.53, rank: 1 });
    expect(p.stats.ga.teams.ANA.rank).toBe(2);
    // The softest kill ranks first: the lowest PK% carries rank 1.
    const pk = Object.values(p.stats.pkPct.teams);
    const first = pk.find((t) => t.rank === 1);
    expect(Math.min(...pk.map((t) => t.value))).toBe(first.value);
    expect(STATS['Penalty Kill %']).toBe('pkPct');
  });
  test('a page without the tables is refused', () => {
    expect(() => parseOverview('<html><body>Just a moment…</body></html>')).toThrow(/no overview tables/);
  });
  test('the URL carries the page’s own filters', () => {
    expect(spzSeasonKey(2026)).toBe('26_27');
    expect(overviewUrl('offense', { year: 2026 })).toBe('https://shotpropz.com/nhl/team-offensive-stat-overview/?season=26_27&span=YTD&location=All');
    expect(overviewUrl('defense', { year: 2025, span: 'l10', location: 'home' })).toBe('https://shotpropz.com/nhl/team-defensive-stat-overview/?season=25_26&span=recent&location=Home');
  });
  test('a team’s read for the profile: the venue board leads from four games there, the all-games board until then, the last ten beside', () => {
    const o = parseOverview(offense).stats;
    const d = parseOverview(defense).stats;
    const home = (stats, gp) => Object.fromEntries(Object.entries(stats).map(([k, t]) => [k, { ...t, teams: Object.fromEntries(Object.entries(t.teams).map(([a, v]) => [a, { ...v, gp, value: +(v.value * 1.1).toFixed(2) }])) }]));
    const spz = { year: 2026, pageUpdated: 'Oct 30, 2026', boards: { offense: { all: { ytd: o, l10: o }, home: { ytd: home(o, 7) }, away: { ytd: home(o, 3) } }, defense: { all: { ytd: d, l10: d }, home: { ytd: home(d, 7) }, away: { ytd: home(d, 3) } } } };
    expect(spzCell(spz, 'offense', 'gf', 'EDM')).toEqual({ value: 4.23, rank: 1, gp: 13, n: 32, location: 'all', span: 'ytd' });
    expect(spzCell(spz, 'offense', 'gf', 'XXX')).toBeNull();
    const h = spzTeamRead(spz, 'EDM', 'H');
    expect(h.location).toBe('home');
    expect(h.gf.lead).toMatchObject({ value: 4.65, gp: 7, location: 'home' });
    expect(h.gf.leadAt).toBe('home');
    expect(h.gf.l10.span).toBe('l10');
    expect(h.pkPct.venue.location).toBe('home');
    // Three away games: the all-games board leads.
    const a = spzTeamRead(spz, 'EDM', 'A');
    expect(a.gf.lead).toMatchObject({ value: 4.23, location: 'all' });
    expect(a.gf.leadAt).toBe('all');
    expect(a.gf.venue.gp).toBe(3);
    expect(SPZ_MIN_VENUE_GAMES).toBe(4);
    expect(spzTeamRead(null, 'EDM', 'H')).toBeNull();
    expect(Object.keys(h)).toEqual(expect.arrayContaining(['gf', 'sf', 'ppo', 'ppPct', 'ga', 'sa', 'ppoa', 'pkPct']));
  });
});

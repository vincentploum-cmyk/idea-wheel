/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseLineups, pageDate, statusOf } from '../lib/nba/rotowire';
import { NbaGames, LineupTag } from '../components/nba/NbaGames';

// RotoWire's NBA lineups page (Vincent, 2026-11-04: "a 'lineups confirmed' message next to the teams when the lineups are
// confirmed from rotowire / espn"): the page of 2026-11-04 as served, trimmed to its head and the first two games.
const html = fs.readFileSync(path.join(__dirname, 'fixtures/rotowire-nba-lineups.html'), 'utf8');

describe('RotoWire’s lineups page', () => {
  test('the night, the games, each team’s status, five starters and who may not play, in the site’s codes', () => {
    const r = parseLineups(html);
    expect(r.date).toBe('2026-11-04');
    expect(r.games).toEqual([{ time: '7:00 PM ET', away: 'PHI', home: 'DET' }, { time: '7:00 PM ET', away: 'ATL', home: 'WSH' }]);   // WAS → WSH
    expect(r.teams.PHI).toMatchObject({ status: 'expected', opp: 'DET', home: false });
    expect(r.teams.PHI.starters.map((p) => `${p.pos} ${p.name}`)).toEqual(['PG Tyrese Maxey', 'SG VJ Edgecombe', 'SF Jaylen Brown', 'PF LeBron James', 'C Joel Embiid']);
    expect(r.teams.PHI.mayNotPlay).toEqual([{ pos: 'C', name: 'Ariel Hukporti', status: 'OFS', play: 0 }, { pos: 'C', name: 'Dominick Barlow', status: 'Out', play: 0 }]);
    expect(r.teams.DET.starters).toHaveLength(5);
    expect(Object.keys(r.teams).sort()).toEqual(['ATL', 'DET', 'PHI', 'WSH']);
  });
  test('a confirmed lineup reads off the class or the words', () => {
    // The first team's status line (PHI) as RotoWire would draw it confirmed: the class alone, or the words alone.
    const confirmed = html.replace(/lineup__status is-expected("[\s\S]*?)Expected Lineup/, 'lineup__status is-confirmed$1Confirmed Lineup');
    const once = html.indexOf('lineup__status is-expected');
    const words = html.slice(0, once) + html.slice(once).replace(/(lineup__status) is-expected([\s\S]*?)Expected Lineup/, '$1 is-final$2Confirmed Lineup');
    expect(parseLineups(words).teams.PHI.status).toBe('confirmed');
    expect(parseLineups(words).teams.DET.status).toBe('expected');
    expect(statusOf('is-confirmed', '')).toBe('confirmed');
    expect(statusOf('', 'Expected Lineup')).toBe('expected');
    expect(statusOf('', '')).toBeNull();
    // (the exact markup of the first confirmed lineup is unseen: either spelling reads)
    expect(parseLineups(confirmed).teams.PHI.status).toBe('confirmed');
    expect(parseLineups(confirmed).teams.DET.status).toBe('expected');
  });
  test('the page’s date; a page without games reads none', () => {
    expect(pageDate('Starting lineups for November 4, 2026')).toBe('2026-11-04');
    expect(pageDate('<p>nothing</p>')).toBeNull();
    expect(parseLineups('<html></html>')).toEqual({ date: null, games: [], teams: {} });
  });
});

describe('the tag beside a team on the Games tab', () => {
  const lineups = { at: '2026-11-04T23:20:00Z', source: 'rotowire', teams: {
    PHI: { status: 'confirmed', starters: [{ pos: 'PG', name: 'Tyrese Maxey' }, { pos: 'C', name: 'Joel Embiid' }], mayNotPlay: [{ name: 'Dominick Barlow', status: 'Out' }] },
    DET: { status: 'expected', starters: [], mayNotPlay: [] },
  } };
  const game = (final) => ({ id: 'g1', away: 'PHI', home: 'DET', date: '2026-11-05T00:00:00Z', final, state: final ? 'post' : 'pre', ...(final ? { awayScore: 110, homeScore: 104 } : {}), odds: { spread: 'DET -2.5', total: 224.5 }, sides: {} });
  test('“Lineup confirmed” once RotoWire confirms, “Expected lineup” before, the five on the hover; nothing once final', () => {
    const out = renderToStaticMarkup(<NbaGames board={{ date: '2026-11-04', season: 2026, games: [game(false)], lineups }} shuffles={{}} />);
    expect(out).toContain('✓ Lineup confirmed');
    expect(out).toContain('Expected lineup');
    expect(out).toContain('RotoWire, read 6:20 PM ET: confirmed starting five · PG Tyrese Maxey, C Joel Embiid · may not play: Dominick Barlow (Out)');
    const done = renderToStaticMarkup(<NbaGames board={{ date: '2026-11-04', season: 2026, games: [game(true)], lineups }} shuffles={{}} />);
    expect(done).not.toContain('Lineup confirmed');
    expect(renderToStaticMarkup(<LineupTag lineup={null} />)).toBe('');
  });
});

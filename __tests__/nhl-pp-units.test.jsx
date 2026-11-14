/**
 * The rink's PP badge (Vincent, 2026-11-08: "we need to find out who is on the powerplay so we know which players will
 * most likely get more minutes ... a small PP symbol next to the players on the rink that are predicted to get a lot of
 * powerplay minutes"): RotoWire's power-play units (lib/nhl-data/rotowire.js, the page as served on 2026-11-08,
 * fixtures/rotowire-nhl-lineups.html) × the power plays ShotPropz's boards give the team tonight (lib/nhl-data/pp-units.js).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseNhlLineups, pageDate } from '@/lib/nhl-data/rotowire';
import { ppRead, ppUnitOf, PP_SHOW, PP_LOT, ppAllowedBook, ppAllowedAt, ppTone, PP_ALLOWED_MIN_GAMES } from '@/lib/nhl-data/pp-units';
import { PpBadge } from '@/components/nhl/Rink';

const html = fs.readFileSync(path.join(__dirname, 'fixtures/rotowire-nhl-lineups.html'), 'utf8');
const read = parseNhlLineups(html);

test('the page: its date, six games, twelve teams with two five-man units, the goalie and his word', () => {
  expect(pageDate(html)).toBe('2026-11-08');
  expect(read.date).toBe('2026-11-08');
  expect(read.games).toHaveLength(6);
  expect(read.games[0]).toEqual({ time: '1:00 PM ET', away: 'FLA', home: 'BOS' });
  expect(Object.keys(read.teams).sort()).toEqual(['ANA', 'BOS', 'BUF', 'CGY', 'FLA', 'NJD', 'PHI', 'PIT', 'TBL', 'TOR', 'VGK', 'WPG']);
  for (const t of Object.values(read.teams)) { expect(t.pp1).toHaveLength(5); expect(t.pp2).toHaveLength(5); }
  const fla = read.teams.FLA;
  expect(fla).toMatchObject({ opp: 'BOS', home: false, goalie: { name: 'Jacob Markstrom', status: 'confirmed' } });
  expect(fla.pp1.map((p) => p.name)).toEqual(['Sam Reinhart', 'Brady Tkachuk', 'Matthew Tkachuk', 'Carter Verhaeghe', 'Seth Jones']);
  expect(fla.pp1[3]).toEqual({ pos: 'LD', name: 'Carter Verhaeghe' });
  expect(fla.pp2.map((p) => p.name)).toContain('Aaron Ekblad');
  expect(fla.injuries[0]).toEqual({ pos: 'C', name: 'Anton Lundell', status: 'DTD' });
  expect(read.teams.BOS.goalie.status).toBe('expected');
  expect(read.teams.BOS.pp1.map((p) => p.name)).toContain('David Pastrnak');
});

test('his unit: by full name, then last name and first initial', () => {
  const fla = read.teams.FLA;
  expect(ppUnitOf(fla, 'Sam Reinhart')).toBe(1);
  expect(ppUnitOf(fla, 'Aaron Ekblad')).toBe(2);
  expect(ppUnitOf(fla, 'Matt Tkachuk')).toBe(1);
  expect(ppUnitOf(fla, 'Sam Bennett')).toBe(2);
  expect(ppUnitOf(fla, 'Aleksander Barkov')).toBeNull();
});

const st = (expected) => ({ ppFor: { expected, league: 3.19, own: { value: 5.1 }, oppGives: { value: 3.5 } } });

test('minutes: the power plays tonight × a unit skater\'s share of each; shown from PP_SHOW, "a lot" from PP_LOT', () => {
  const rw = { fetchedAt: '2026-11-08T15:00:00Z', teams: { FLA: read.teams.FLA } };
  // A first-unit forward on a 3.6-power-play night: 3.5 minutes, a lot.
  const reinhart = ppRead({ rw, team: 'FLA', opp: 'BOS', name: 'Sam Reinhart', pos: 'C', st: st(3.6) });
  expect(reinhart).toMatchObject({ unit: 1, minutes: 3.5, ppTonight: 3.6, show: true, lot: true });
  expect(reinhart.text).toContain('FLA should get ≈ 3.6 power plays');
  expect(reinhart.text).toContain('BOS gives 3.5');
  // The same forward on a quiet night: shown, not green.
  expect(ppRead({ rw, team: 'FLA', opp: 'BOS', name: 'Sam Reinhart', pos: 'C', st: st(2.8) })).toMatchObject({ minutes: 2.7, show: true, lot: false });
  // A second-unit defenseman: under PP_SHOW unless the night is rich in power plays.
  expect(ppRead({ rw, team: 'FLA', opp: 'BOS', name: 'Aaron Ekblad', pos: 'D', st: st(3.6) })).toMatchObject({ unit: 2, minutes: 1.6, show: false });
  expect(ppRead({ rw, team: 'FLA', opp: 'BOS', name: 'Aaron Ekblad', pos: 'D', st: st(4.6) }).show).toBe(true);
  // Without ShotPropz the league's rate stands in; off both units, or without RotoWire's team, nothing.
  expect(ppRead({ rw, team: 'FLA', opp: 'BOS', name: 'Sam Reinhart', pos: 'C' })).toMatchObject({ ppTonight: 3.2, minutes: 3.1, show: true, lot: false });
  expect(ppRead({ rw, team: 'FLA', opp: 'BOS', name: 'Aleksander Barkov', pos: 'C', st: st(3.6) })).toBeNull();
  expect(ppRead({ rw, team: 'BOS', opp: 'FLA', name: 'David Pastrnak', pos: 'RW', st: st(3.6) })).toBeNull();
  expect(PP_SHOW).toBeLessThan(PP_LOT);
});

test('the badge: PP for the first unit, PP2 for the second, coloured by the opponent, nothing under PP_SHOW', () => {
  expect(renderToStaticMarkup(<PpBadge pp={{ unit: 1, show: true, lot: true, tone: 'soft', text: 'x' }} />)).toBe('<i class="nhlx-rk-pp is-soft" title="x">PP</i>');
  expect(renderToStaticMarkup(<PpBadge pp={{ unit: 2, show: true, lot: false, tone: 'tough', text: 'y' }} />)).toBe('<i class="nhlx-rk-pp is-tough" title="y">PP2</i>');
  expect(renderToStaticMarkup(<PpBadge pp={{ unit: 1, show: true, lot: true, tone: null, text: 'w' }} />)).toBe('<i class="nhlx-rk-pp" title="w">PP</i>');   // no ranked read: grey
  expect(renderToStaticMarkup(<PpBadge pp={{ unit: 2, show: false, lot: false, text: 'z' }} />)).toBe('');
  expect(renderToStaticMarkup(<PpBadge pp={null} />)).toBe('');
});

describe('the colour: the opponent\'s power-play shots allowed a game to his position (Vincent, 2026-11-13)', () => {
  // Six teams, 10 games each; per game in all and to each position (defenseByPosition's season table shape).
  const cell = (ppSog) => ({ gp: 10, ppSog });
  const team = (all, C, LW, RW, D, gp = 10) => ({ ALL: { All: { gp, ppSog: all }, C: cell(C), LW: cell(LW), RW: cell(RW), D: cell(D) } });
  const season = { teams: {
    MTL: team(6.6, 1.6, 2.2, 2.0, 0.8), FLA: team(6.3, 1.7, 1.9, 1.4, 1.3), BOS: team(5.1, 1.6, 1.8, 1.2, 0.5),
    NJD: team(3.6, 0.7, 0.7, 1.7, 0.5), COL: team(3.9, 1.7, 0.8, 0.8, 0.6), NEW: team(5.0, 1.5, 1.5, 1.5, 0.5, 3),
  } };
  const book = ppAllowedBook(season);
  test('each position\'s per-game figure and share, ranked among the teams with enough games', () => {
    expect(book.teams.MTL).toMatchObject({ gp: 10, all: 6.6, rankAll: 1, of: 5 });
    expect(book.teams.MTL.pos.LW).toMatchObject({ perGame: 2.2, share: 0.333, rank: 1 });
    expect(book.teams.MTL.pos.LW.g).toEqual({ perGame: 0, share: null, rank: null });   // no power-play goals on these rows: no goals read
    expect(book.teams.FLA.pos.D.rank).toBe(1);
    expect(book.teams.NEW.of).toBe(0);   // under PP_ALLOWED_MIN_GAMES: shown nowhere
    expect(PP_ALLOWED_MIN_GAMES).toBe(5);
    expect(book.league.all).toBeCloseTo((6.6 + 6.3 + 5.1 + 3.6 + 3.9) / 5, 2);
  });
  test('green / amber / red by thirds of the rank at his position, with the read in words', () => {
    expect(ppTone(1, 32)).toBe('soft'); expect(ppTone(11, 32)).toBe('soft'); expect(ppTone(12, 32)).toBe('mid');
    expect(ppTone(21, 32)).toBe('mid'); expect(ppTone(22, 32)).toBe('tough');   // the rink's thirds: 1-11, 12-21, 22-32 expect(ppTone(null, 32)).toBeNull();
    const lw = ppAllowedAt(book, 'MTL', 'LW');
    expect(lw).toMatchObject({ perGame: 2.2, rank: 1, of: 5, tone: 'soft', lead: 'LW' });
    expect(lw.text).toMatch(/^MTL gives a lot of power-play shots to LW: 2\.20 a game, #1 of 5 · 6\.60 power-play shots on goal allowed a game in all \(#1/);
    expect(ppAllowedAt(book, 'NJD', 'LW')).toMatchObject({ rank: 5, tone: 'tough' });
    expect(ppAllowedAt(book, 'NJD', 'RW')).toMatchObject({ rank: 2, tone: 'soft', lead: 'RW' });   // NJD gives the fewest in all, yet #2 to RW
    expect(ppAllowedAt(book, 'NEW', 'C')).toBeNull();
  });
  test('the read carries it on the PP badge and its hover', () => {
    const rw = { teams: { CHI: { pp1: [{ name: 'Tyler Bertuzzi' }], pp2: [] } } };
    const r = ppRead({ rw, team: 'CHI', opp: 'MTL', name: 'Tyler Bertuzzi', pos: 'LW', allowed: book });
    expect(r).toMatchObject({ unit: 1, tone: 'soft' });
    expect(r.text).toMatch(/^MTL gives a lot of power-play shots to LW/);
    expect(ppRead({ rw, team: 'CHI', opp: 'MTL', name: 'Tyler Bertuzzi', pos: 'LW' }).tone).toBeNull();
  });
});

// Vincent, 2026-11-14: "the pp should color based on the toggle shots/ goals".
describe('the PP badge under Goals: the opponent\'s power-play goals allowed to his position', () => {
  const cell = (ppSog, ppG) => ({ gp: 10, ppSog, ppG });
  const team = (sog, g) => ({ ALL: { All: { gp: 10, ppSog: sog.reduce((a, b) => a + b, 0), ppG: g.reduce((a, b) => a + b, 0) }, C: cell(sog[0], g[0]), LW: cell(sog[1], g[1]), RW: cell(sog[2], g[2]), D: cell(sog[3], g[3]) } });
  // AAA gives its power-play shots to C but its power-play goals to D; CCC the other way round
  const season = { teams: { AAA: team([3, 1, 1, 1], [0.1, 0.1, 0.1, 0.6]), BBB: team([2, 1, 1, 1], [0.2, 0.2, 0.2, 0.2]), CCC: team([1, 1, 1, 3], [0.5, 0.1, 0.1, 0.05]) } };
  const book = ppAllowedBook(season);

  test('shots and goals rank apart', () => {
    expect(ppAllowedAt(book, 'AAA', 'C').tone).toBe('soft');
    expect(ppAllowedAt(book, 'AAA', 'C', 'g').tone).toBe('tough');
    expect(ppAllowedAt(book, 'AAA', 'D', 'g')).toMatchObject({ tone: 'soft', rank: 1, perGame: 0.6, lead: 'D' });
    expect(ppAllowedAt(book, 'AAA', 'D', 'g').text).toMatch(/^AAA gives a lot of power-play goals to D: 0\.60 a game, #1 of 3/);
    expect(ppAllowedAt(book, 'AAA', 'D').text).toMatch(/power-play shots to D/);
  });

  test('rows stored before ppG: no goals read, the shots read untouched', () => {
    const old = ppAllowedBook({ teams: { AAA: team([3, 1, 1, 1], [0, 0, 0, 0]), BBB: team([2, 1, 1, 1], [0, 0, 0, 0]), CCC: team([1, 1, 1, 3], [0, 0, 0, 0]) } });
    expect(ppAllowedAt(old, 'AAA', 'C', 'g')).toBeNull();
    expect(ppAllowedAt(old, 'AAA', 'C').tone).toBe('soft');
  });

  test('the badge follows the switch; grey without a goals read', () => {
    const pp = { show: true, unit: 1, tone: 'soft', toneG: 'tough', text: 'shots read', textG: 'goals read' };
    expect(renderToStaticMarkup(<PpBadge pp={pp} />)).toBe('<i class="nhlx-rk-pp is-soft" title="shots read">PP</i>');
    expect(renderToStaticMarkup(<PpBadge pp={pp} metric="g" />)).toBe('<i class="nhlx-rk-pp is-tough" title="goals read">PP</i>');
    expect(renderToStaticMarkup(<PpBadge pp={{ ...pp, toneG: null }} metric="g" />)).toBe('<i class="nhlx-rk-pp" title="goals read">PP</i>');
  });
});

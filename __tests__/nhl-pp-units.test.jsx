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
import { ppRead, ppUnitOf, PP_SHOW, PP_LOT } from '@/lib/nhl-data/pp-units';
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

test('the badge: PP for the first unit, PP2 for the second, green when a lot, nothing under PP_SHOW', () => {
  expect(renderToStaticMarkup(<PpBadge pp={{ unit: 1, show: true, lot: true, text: 'x' }} />)).toBe('<i class="nhlx-rk-pp is-lot" title="x">PP</i>');
  expect(renderToStaticMarkup(<PpBadge pp={{ unit: 2, show: true, lot: false, text: 'y' }} />)).toBe('<i class="nhlx-rk-pp" title="y">PP2</i>');
  expect(renderToStaticMarkup(<PpBadge pp={{ unit: 2, show: false, lot: false, text: 'z' }} />)).toBe('');
  expect(renderToStaticMarkup(<PpBadge pp={null} />)).toBe('');
});

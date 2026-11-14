import { describe, expect, test } from '@jest/globals';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { opposingGoalie, goalieRanks, namedStarter, GOALIE_MIN_STARTS } from '@/lib/nhl-data/goalie-alert';
import { goalieBook } from '@/lib/nhl-data/goalies-pure';
import { GoalieAlert } from '@/components/nhl/Rink';

// Vincent, 2026-11-14: "can we have a weak goalie alert added to the rink?"
// Twelve teams, each a starter with eight starts; team T00's lets in the most, T11's the fewest. T00 also has a backup.
const rows = [];
const add = (team, id, name, n, sa, ga, from = 1) => { for (let i = 0; i < n; i++) rows.push({ date: `2026-10-${String(from + i).padStart(2, '0')}`, gameId: `${team}-${from + i}`, playerId: id, name, team, opp: 'XXX', venue: 'H', toi: 60, sa, ga, sv: sa - ga, starter: 1, decision: 'W' }); };
for (let t = 0; t < 12; t++) add(`T${String(t).padStart(2, '0')}`, 100 + t, `Starter ${String.fromCharCode(65 + t)}son`, 8, 30, 5 - Math.floor(t / 3));
add('T00', 900, 'Backup Benchley', 2, 30, 2, 20);
const book = goalieBook(rows, 2026, { through: '2026-11-14' });

describe('the goalie in the other net', () => {
  test('ranked among the goalies with enough starts, the weakest first', () => {
    const r = goalieRanks(book);
    expect(r.of).toBe(12);                       // the backup's two starts do not rank
    expect(r.rankOf[100]).toBe(1);
    expect(r.rankOf[111]).toBeGreaterThan(9);
    expect(GOALIE_MIN_STARTS).toBe(4);
  });
  test('RotoWire names him (confirmed or expected); without it the likely starter from the box scores', () => {
    const rw = { teams: { T00: { goalie: { name: 'Starter Ason', status: 'Confirmed' } }, T11: { goalie: { name: 'S. Lson', status: 'Expected' } } } };
    expect(namedStarter(book, rw, 'T00')).toMatchObject({ status: 'confirmed', goalie: { id: 100 } });
    expect(namedStarter(book, rw, 'T11')).toMatchObject({ status: 'expected', goalie: { id: 111 } });   // the last name with the first initial
    expect(opposingGoalie({ book, rw: null, opp: 'T00', date: '2026-11-14' })).toMatchObject({ name: 'Starter Ason', status: 'likely', weak: true, rank: 1, of: 12, backup: false });
  });
  test('weak: the bottom quarter by save % this season; a strong goalie draws nothing', () => {
    const weak = opposingGoalie({ book, rw: { teams: { T00: { goalie: { name: 'Starter Ason', status: 'Confirmed' } } } }, opp: 'T00', date: '2026-11-14' });
    expect(weak).toMatchObject({ weak: true, status: 'confirmed', rank: 1 });
    expect(weak.text).toMatch(/weakest of 12/);
    expect(weak.text).toMatch(/an alert only/);
    const strong = opposingGoalie({ book, rw: null, opp: 'T11', date: '2026-11-14' });
    expect(strong.weak).toBe(false);
    expect(renderToStaticMarkup(<GoalieAlert g={strong} opp="T11" />)).toBe('');
    expect(renderToStaticMarkup(<GoalieAlert g={null} opp="T11" />)).toBe('');
    const html = renderToStaticMarkup(<GoalieAlert g={weak} opp="T00" />);
    expect(html).toContain('<i class="nhlx-rk-verdict is-soft">weak goalie</i>');
    expect(html).toContain('Starter Ason');
    expect(html).toContain('confirmed');
  });
  test('the backup named for the usual starter is said so; a goalie not on record is named without a verdict', () => {
    const b = opposingGoalie({ book, rw: { teams: { T00: { goalie: { name: 'Backup Benchley', status: 'Expected' } } } }, opp: 'T00', date: '2026-11-14' });
    expect(b).toMatchObject({ name: 'Backup Benchley', backup: true, usual: 'Starter Ason', rank: null, weak: false });   // two starts: not ranked, so no verdict
    expect(b.text).toMatch(/the backup \(Starter Ason is the usual starter\)/);
    const unknown = opposingGoalie({ book, rw: { teams: { T05: { goalie: { name: 'Call Upson', status: 'Expected' } } } }, opp: 'T05', date: '2026-11-14' });
    expect(unknown).toMatchObject({ name: 'Call Upson', id: null, weak: false });
    expect(opposingGoalie({ book, rw: null, opp: 'ZZZ', date: '2026-11-14' })).toBeNull();
  });
  test('cold over his last five starts while under the league on the season', () => {
    const r2 = [...rows]; for (let i = 0; i < 5; i++) r2.push({ date: `2026-11-0${i + 1}`, gameId: `T06-n${i}`, playerId: 106, name: 'Starter Gson', team: 'T06', opp: 'XXX', venue: 'H', toi: 60, sa: 30, ga: 5, sv: 25, starter: 1, decision: 'L' });
    const g = opposingGoalie({ book: goalieBook(r2, 2026, { through: '2026-11-14' }), rw: null, opp: 'T06', date: '2026-11-14' });
    expect(g.cold).toBe(true); expect(g.weak).toBe(true);
    expect(g.reasons.join(' ')).toMatch(/over his last 5 starts/);
  });
});

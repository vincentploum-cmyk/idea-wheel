import { describe, expect, test } from '@jest/globals';
import { buildBoard, BEST_MARKETS } from '../lib/nba/picks';
import { impliedProb } from '../lib/nfl/odds';

// The NBA's best bets by edge (Vincent, 2026-10-31: "the best bets per game should be the ones with the biggest edge
// compared to the lines known … projected to get 30 points and his line is 15 … that is where I can beat the books"):
// the book's main line read on each player's ladder, the board's chance against the price, the biggest edge first.
const games = (final = false) => [{ id: 'g1', date: '2026-10-31T23:30Z', away: 'BOS', home: 'NY', final, state: final ? 'post' : 'pre' }];
const logs = (f) => Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${String(30 - i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', min: 34, pts: 20, reb: 6, ast: 4, tpm: 1, stl: 1, blk: 0, tov: 2, ...f(i) }));
const player = (id, name, team, pos, f, props) => ({ id, name, key: name.toLowerCase(), team, pos, games: logs(f), props });
const pf = { at: '2026-10-31T14:00:00Z', data: { players: [
  // 12 rebounds a night against a 6.5 line: the board's over far past the book's coin flip.
  player('p1', 'Big Glass', 'BOS', 'C', (i) => ({ reb: 11 + (i % 3) }), [{ market: 'reb', line: 6.5, odds: -110, underOdds: -110, isMain: true }]),
  // Six assists a night against 5.5: an over the board likes, a smaller edge.
  player('p2', 'Steady Hands', 'BOS', 'PG', (i) => ({ ast: 5 + (i % 3) }), [{ market: 'ast', line: 5.5, odds: -110, underOdds: -110, isMain: true }]),
  // One three a night against 3.5: the under is the play, its price (-150) leaving a smaller edge than the glass's.
  player('p3', 'Cold Shooter', 'NY', 'SG', (i) => ({ tpm: i % 3 }), [{ market: 'tpm', line: 3.5, odds: 120, underOdds: -150, isMain: true }]),
  // Ten rebounds against 2.5 priced at -2000: past the steep cut, no play; a points line is no best-bets market.
  player('p4', 'Steep Board', 'NY', 'PF', () => ({ reb: 10, pts: 30 }), [{ market: 'reb', line: 2.5, odds: -2000, underOdds: 1000, isMain: true }, { market: 'pts', line: 15.5, odds: -110, underOdds: -110, isMain: true }]),
  // No price on the line: no edge to read.
  player('p5', 'No Price', 'NY', 'SF', () => ({ ast: 8 }), [{ market: 'ast', line: 4.5, odds: null, underOdds: null, isMain: true }]),
], defense: null } };

describe('the NBA best bets by edge', () => {
  test('the main line on his ladder, the side the board likes, the biggest edge over the price first', () => {
    const b = buildBoard({ date: '2026-10-31', season: 2026, games: games(), sheets: [], pf, results: {} });
    expect(b.bestBy).toBe('edge');
    const ids = b.best.map((r) => r.id);
    expect(ids[0]).toBe('big glass|reb|6.5|over');
    expect(ids).toContain('cold shooter|tpm|3.5|under');
    for (const id of ids) expect(BEST_MARKETS).toContain(id.split('|')[1]);
    expect(ids.some((id) => id.startsWith('steep board'))).toBe(false);   // past -400, and points are no best-bets market
    expect(ids.some((id) => id.startsWith('no price'))).toBe(false);
    for (let i = 1; i < b.best.length; i++) expect(b.best[i].edge).toBeLessThanOrEqual(b.best[i - 1].edge);
    for (const r of b.best) {
      expect(r.p).toBeGreaterThanOrEqual(0.5);
      expect(r.edge).toBeCloseTo(r.p - impliedProb(r.odds), 2);
      expect(r.edge).toBeGreaterThan(0);
    }
    const big = b.best[0];
    // The board's projection against the line: about twelve rebounds on a 6.5 line.
    expect(big.gap).toBeGreaterThan(4);
    expect(big.proj.exp - big.line).toBeCloseTo(big.gap, 1);
    expect(big).toMatchObject({ team: 'BOS', opp: 'NY', market: 'reb', side: 'over', odds: -110, implied: 0.524, hit: null });
    const under = b.best.find((r) => r.side === 'under');
    expect(under.gap).toBeLessThan(0);
    // Each side's strip carries its best bets by edge, one a player.
    expect(b.games[0].sides.BOS.picks[0]).toMatchObject({ key: 'big glass', market: 'reb', side: 'over' });
    expect(b.games[0].sides.NY.picks.map((x) => x.key)).toEqual(['cold shooter']);
  });
  test('graded on the box score once final', () => {
    const results = { g1: { id: 'g1', final: true, players: [{ name: 'Big Glass', team: 'BOS', played: true, reb: 5 }, { name: 'Cold Shooter', team: 'NY', played: true, tpm: 1 }] } };
    const b = buildBoard({ date: '2026-10-31', season: 2026, games: games(true), sheets: [], pf, results });
    expect(b.best.find((r) => r.key === 'big glass')).toMatchObject({ actual: 5, hit: false });
    expect(b.best.find((r) => r.key === 'cold shooter')).toMatchObject({ actual: 1, hit: true });
  });
});

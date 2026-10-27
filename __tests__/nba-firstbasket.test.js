import { describe, expect, test } from '@jest/globals';
import { parseSummary, parseOpening } from '../lib/nba/espn';
import { firstBasketRecord, startersOf, gameCandidates, buildFirstBasketBoard, FIRST_POSSESSION_EDGE } from '../lib/nba/firstbasket';
import { mapPlayers } from '../lib/nba/propfinder-nba';
import summary from './fixtures/espn-nba-summary-plays.json';

describe('the opening plays', () => {
  test('the tip, the first basket, the first points and each team’s first shot from ESPN’s plays', () => {
    const o = parseOpening(summary);
    // DAL at MIA, 2026-10-26: "Gafford vs. Adebayo", Antetokounmpo (MIA) gains possession — ESPN lists the home jumper
    // first in the participants whatever the text says, so the names come from the box score by id; P.J. Washington's
    // free throws are the first points, Davion Mitchell's layup the first basket; Klay Thompson took MIA's first shot, Kyrie Irving DAL's.
    expect(o.tip).toMatchObject({ team: 'MIA', jumpers: [{ espnId: '4066261', name: 'Bam Adebayo' }, { espnId: '4278049', name: 'Daniel Gafford' }], possession: { espnId: '3032977', name: 'Giannis Antetokounmpo' } });
    expect(o.firstPoints).toMatchObject({ espnId: '4278078', name: 'P.J. Washington', team: 'DAL', kind: 'FT', clock: '11:07' });
    expect(o.firstBasket).toMatchObject({ espnId: '4278053', name: 'Davion Mitchell', team: 'MIA', kind: '2', assist: '3032977', clock: '10:37' });
    expect(o.firstShot.MIA).toMatchObject({ espnId: '6475', name: 'Klay Thompson', made: false });
    expect(o.firstShot.DAL).toMatchObject({ espnId: '6442', name: 'Kyrie Irving', made: false });
    // The parsed summary carries it; a summary without plays carries null.
    expect(parseSummary(summary).opening.firstBasket.name).toBe('Davion Mitchell');
    expect(parseOpening({ header: summary.header })).toBeNull();
    expect(parseSummary({ header: summary.header, boxscore: summary.boxscore }).opening).toBeNull();
  });
});

describe('the first-basket record and the board', () => {
  const r = parseSummary(summary);
  const results = [r, { ...r, id: '2', opening: { ...r.opening, firstBasket: { espnId: '6442', name: 'Kyrie Irving', team: 'DAL', kind: '3' }, tip: { ...r.opening.tip, team: 'DAL' } } }, { ...r, id: '3', final: false }];
  test('the record: starts, first baskets, first shots and jumps per player, tips and first baskets per team', () => {
    const rec = firstBasketRecord(results);
    expect(rec.games).toBe(2);
    expect(rec.players['4278053']).toMatchObject({ name: 'Davion Mitchell', team: 'MIA', fb: 1, fp: 0 });
    expect(rec.players['4278078']).toMatchObject({ name: 'P.J. Washington', fp: 2, fb: 0 });
    expect(rec.players['6442']).toMatchObject({ name: 'Kyrie Irving', fb: 1, firstShots: 2 });
    expect(rec.players['4066261']).toMatchObject({ name: 'Bam Adebayo', jumps: 2, jumpsWon: 1 });   // MIA's tip in game 1, DAL's in game 2
    expect(rec.players['4278049']).toMatchObject({ name: 'Daniel Gafford', jumps: 2, jumpsWon: 1 });
    expect(rec.teams.MIA).toMatchObject({ games: 2, tips: 2, tipsWon: 1, fb: 1, fbConceded: 1 });
    expect(rec.teams.DAL).toMatchObject({ games: 2, tips: 2, tipsWon: 1, fb: 1, fbConceded: 1, fp: 2 });
    expect(rec.possessionEdge).toEqual({ games: 2, share: 1 });   // both first baskets by the team with the tip
    expect(firstBasketRecord([])).toMatchObject({ games: 0, possessionEdge: null });
  });
  test('the starters from the depth chart, the five most-played without one, the out left aside; the chances add up to one a game', () => {
    const g = (i, fga, fgm, min) => ({ gameId: `g${i}`, date: `2026-10-${10 + i}`, season: 2026, type: 'REG', min, fga, fgm, pts: fgm * 2 });
    const mk = (name, team, pos, fga, fgm, min, extra = {}) => ({ id: name, name, key: name.toLowerCase(), team, pos, games: [0, 1, 2, 3, 4].map((i) => g(i, fga, fgm, min)), props: [], ...extra });
    const players = [
      mk('Bam Adebayo', 'MIA', 'C', 14, 7, 34), mk('Tyler Herro', 'MIA', 'SG', 18, 8, 33), mk('Davion Mitchell', 'MIA', 'PG', 8, 4, 30, { firstBasket: { odds: 1200, book: 'dk', books: 2 } }),
      mk('Andrew Wiggins', 'MIA', 'SF', 12, 5, 31), mk('Klay Thompson', 'MIA', 'SF', 11, 4, 28), mk('Pelle Larsson', 'MIA', 'G', 6, 3, 18), mk('Kel Ware', 'MIA', 'C', 7, 4, 22, { injury: 'Out' }),
      mk('Kyrie Irving', 'DAL', 'PG', 17, 8, 35), mk('Daniel Gafford', 'DAL', 'C', 8, 5, 26), mk('P.J. Washington', 'DAL', 'PF', 12, 5, 32), mk('Cooper Flagg', 'DAL', 'SF', 15, 6, 34), mk('Max Christie', 'DAL', 'SG', 9, 4, 30), mk('Naji Marshall', 'DAL', 'SF', 8, 4, 20),
    ];
    const depth = { MIA: { PG: [{ key: 'davion mitchell', depth: 1, starter: true }], SG: [{ key: 'tyler herro', depth: 1, starter: true }], SF: [{ key: 'andrew wiggins', depth: 1, starter: true }, { key: 'klay thompson', depth: 2 }], PF: [{ key: 'klay thompson', depth: 1 }], C: [{ key: 'kel ware', depth: 1, starter: true }, { key: 'bam adebayo', depth: 2 }] } };
    const mia = startersOf('MIA', players, depth);
    // Ware is out: the four flagged starters, then Thompson at depth 1 at PF, then Adebayo by minutes fills the fifth.
    expect(mia.map((x) => [x.p.name, x.slot, x.source])).toEqual([['Davion Mitchell', 'PG', 'depth'], ['Tyler Herro', 'SG', 'depth'], ['Andrew Wiggins', 'SF', 'depth'], ['Klay Thompson', 'PF', 'depth'], ['Bam Adebayo', null, 'minutes']]);
    const dal = startersOf('DAL', players, null);
    expect(dal.map((x) => x.p.name)).toEqual(['Kyrie Irving', 'Cooper Flagg', 'P.J. Washington', 'Max Christie', 'Daniel Gafford']);
    const game = { id: '401909871', date: '2026-10-26T23:30Z', away: 'DAL', home: 'MIA', final: true };
    const rec = firstBasketRecord(results);
    const out = gameCandidates(game, { pfPlayers: players, depth, record: rec, result: r });
    const sum = (team) => out.candidates.filter((c) => c.team === team).reduce((s, c) => s + c.modelP, 0);
    expect(sum('MIA') + sum('DAL')).toBeCloseTo(1, 2);
    const mitchell = out.candidates.find((c) => c.name === 'Davion Mitchell');
    const herro = out.candidates.find((c) => c.name === 'Tyler Herro');
    // MIA's tip: no C slot filled, so the starter listed at C by position (Adebayo, 1 of 2 jumps) carries it: (1 + 2) / (2 + 4).
    expect(out.sides.find((s) => s.team === 'MIA')).toMatchObject({ pTip: 0.5, tipFrom: 'centre', lineup: 'depth' });
    expect(out.sides.find((s) => s.team === 'DAL')).toMatchObject({ tipFrom: 'centre' });   // Gafford, 1 of 2
    // Under 40 games on record the league's edge stands: P(team) = 0.5 × 0.57 + 0.5 × 0.43.
    expect(mitchell.pTeam).toBeCloseTo(0.5 * FIRST_POSSESSION_EDGE + 0.5 * (1 - FIRST_POSSESSION_EDGE), 3);
    expect(herro.share).toBeGreaterThan(mitchell.attShare);   // Herro takes the most shots
    expect(mitchell.own).toMatchObject({ starts: 2, fb: 1, rate: 0.5 });
    expect(mitchell.p).toBeGreaterThan(mitchell.modelP);   // his 1-of-2 record lifts him
    expect(mitchell).toMatchObject({ odds: 1200, book: 'dk', books: 2, hit: true });
    expect(mitchell.edge).toBeCloseTo(mitchell.p - 100 / 1300, 3);
    expect(herro.hit).toBe(false);
    expect(out.actual.firstBasket.name).toBe('Davion Mitchell');
    // The slate.
    const board = buildFirstBasketBoard({ slate: { date: '2026-10-26' }, games: [game], pf: { at: 'x', data: { players, depth } }, results: { [game.id]: r }, record: rec });
    expect(board).toMatchObject({ date: '2026-10-26', count: 10, recorded: 2, priced: 1, edgeUsed: FIRST_POSSESSION_EDGE });
    expect(board.games[0].candidates[0].p).toBeGreaterThanOrEqual(board.games[0].candidates[1].p);
  });
  test('the pull keeps the book’s first-basket price on a player, never as a market', () => {
    const p = { id: 1, name: 'Davion Mitchell', team: { code: 'MIA' }, positionAbbreviation: 'PG', stats: [], odds: [
      { market: 'First Basket', sportsbook: 'dk', price: 1200 }, { market: 'First Basket Scorer', sportsbook: 'fd', price: 1100 }, { market: 'Team First Basket', sportsbook: 'dk', price: -110 },
      { market: 'Player First Basket', categoryMapping: 'Points', sportsbook: 'mgm', price: 1000, selectionLine: 'no' }, { market: 'Points', sportsbook: 'dk', points: 10.5, price: -110, selectionLine: 'over' },
    ] };
    const [m] = mapPlayers([p]);
    expect(m.firstBasket).toEqual({ odds: 1200, book: 'dk', books: 2 });
    expect(m.props.map((x) => x.market)).toEqual(['pts']);
    expect(mapPlayers([{ ...p, odds: [] }])[0].firstBasket).toBeUndefined();
  });
});

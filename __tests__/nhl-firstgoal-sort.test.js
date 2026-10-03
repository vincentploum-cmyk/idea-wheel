import { describe, expect, test } from '@jest/globals';
import { sortCandidates } from '../lib/nhl-data/firstgoal-sort';

const c = (name, score, extra = {}) => ({ name, team: 'NJD', opp: 'PHI', venue: 'H', score, own: { gp: 0, fg: 0, rate: 0 }, leak: null, h2h: null, p1g: null, ...extra });
const list = [
  c('Bratt', 60, { own: { gp: 80, fg: 4, rate: 0.05 }, p1g: 0.3, h2h: { gp: 2, g: 1, gpg: 0.5 }, leak: { share: 0.3, slot: 1 } }),
  c('Hughes', 86, { own: { gp: 82, fg: 11, rate: 0.13 }, p1g: 0.41, h2h: { gp: 3, g: 5, gpg: 1.67 }, leak: { share: 0.42, slot: 3 } }),
  c('Adams', 20),
];

describe('1st goal table sorting', () => {
  test('score is the default and the tie-break; names sort ascending', () => {
    expect(sortCandidates(list, 'score').map((x) => x.name)).toEqual(['Hughes', 'Bratt', 'Adams']);
    expect(sortCandidates(list, 'nonsense').map((x) => x.name)).toEqual(['Hughes', 'Bratt', 'Adams']);
    expect(sortCandidates(list, 'player').map((x) => x.name)).toEqual(['Adams', 'Bratt', 'Hughes']);
  });
  test('numeric columns sort descending with missing values last', () => {
    expect(sortCandidates(list, 'own').map((x) => x.name)).toEqual(['Hughes', 'Bratt', 'Adams']);
    expect(sortCandidates(list, 'p1g').map((x) => x.name)).toEqual(['Hughes', 'Bratt', 'Adams']);
    expect(sortCandidates(list, 'h2h').map((x) => x.name)).toEqual(['Hughes', 'Bratt', 'Adams']);
    expect(sortCandidates(list, 'leak').map((x) => x.name)).toEqual(['Hughes', 'Bratt', 'Adams']);
    // The input order is untouched.
    expect(list.map((x) => x.name)).toEqual(['Bratt', 'Hughes', 'Adams']);
  });
});

// The badge every characteristics card wears (NHL, NBA, NFL): a rank's level over the league,
// rank 1 = the best for the team. The top quarter is strong (the top `VERY` very), the bottom
// quarter weak (the bottom `VERY` very), the middle half nothing (thirds and a top four read too
// loosely on 2026-10-27: a bad team wore a dozen badges).

export const LEVEL_TEXT = { very: 'Very strong', strong: 'Strong', weak: 'Weak', veryWeak: 'Very weak' };
export const STRENGTHS = ['very', 'strong'];
export const WEAKNESSES = ['weak', 'veryWeak'];
/** The ranks at the top and bottom of the league that read "Very". */
export const VERY = 3;
/** The share of the league that carries a badge at each end: a quarter. */
export const SHARE = 4;
/** How many lines of each list a card shows before "View more". */
export const SHOWN = 3;

export function levelOf(rank, n = 32) {
  if (!rank || !n) return null;
  const edge = Math.ceil(n / SHARE);
  if (rank <= VERY) return 'very';
  if (rank <= edge) return 'strong';
  if (rank > n - VERY) return 'veryWeak';
  if (rank > n - edge) return 'weak';
  return null;
}

/** "a, b and c" */
export function joinAnd(items) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** Strengths most extreme first, weaknesses the same, by the rank's place in its own league (`n` on each trait). */
export function splitTraits(traits, teamCount = 32) {
  const list = traits.filter(Boolean);
  const place = (x) => x.rank / (x.n || teamCount);
  return {
    strengths: list.filter((x) => STRENGTHS.includes(x.level)).sort((a, b) => place(a) - place(b)),
    weaknesses: list.filter((x) => WEAKNESSES.includes(x.level)).sort((a, b) => place(b) - place(a)),
  };
}

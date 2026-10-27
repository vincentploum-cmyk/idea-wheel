// The badge every characteristics card wears (NHL, NBA, NFL): a rank's level over the league,
// rank 1 = the best for the team. The top third is strong (the top `VERY` very), the bottom third
// weak (the bottom `VERY` very), the middle nothing.

export const LEVEL_TEXT = { very: 'Very strong', strong: 'Strong', weak: 'Weak', veryWeak: 'Very weak' };
export const STRENGTHS = ['very', 'strong'];
export const WEAKNESSES = ['weak', 'veryWeak'];
/** The ranks at the top and bottom of the league that read "Very". */
export const VERY = 4;

export function levelOf(rank, n = 32) {
  if (!rank || !n) return null;
  const third = Math.ceil(n / 3);
  if (rank <= VERY) return 'very';
  if (rank <= third) return 'strong';
  if (rank > n - VERY) return 'veryWeak';
  if (rank > n - third) return 'weak';
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

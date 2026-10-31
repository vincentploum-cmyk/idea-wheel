// The words and helpers every matchup profile shares (the NHL's and the NBA's): a rank's level over the
// league, the words per kind of read, the tone each carries, and a cell's line as parts with the rank
// phrases toned. Pure, no store import: the builders are bundled by the client.

/** The ranks at either end of the league that read Elite / Poor. */
export const VERY = 3;
/** The share of the league at each end that carries a word other than Average: a quarter. */
export const SHARE = 4;

// The words per kind of read, by level (rank 1 = the best for the team on that read), and the tone
// each carries. Green means more shots and goals likely in the game from that side's angle (a strong
// attack, a leaky defense), red fewer — the rink's one colour rule, never the team's quality: a tight
// defense and a strong kill are red because the opponents' shooters face them.
export const WORDS = {
  attack: { elite: 'Elite', strong: 'Strong', average: 'Average', weak: 'Weak', poor: 'Poor' },
  defense: { elite: 'Elite', strong: 'Tight', average: 'Average', weak: 'Leaky', poor: 'Very leaky' },
};
export const TONES = {
  attack: { elite: 'is-soft', strong: 'is-soft', average: '', weak: 'is-tough', poor: 'is-tough' },
  defense: { elite: 'is-tough', strong: 'is-tough', average: '', weak: 'is-soft', poor: 'is-soft' },
};
/** The badge's strength: the ends of the league are drawn bolder. */
export const VERY_LEVELS = ['elite', 'poor'];

/** A rank's level over n teams, rank 1 = the best for the team on the read; null without a rank. */
export function levelOf(rank, n = 32) {
  if (!rank || !n) return null;
  const edge = Math.ceil(n / SHARE);
  if (rank <= VERY) return 'elite';
  if (rank <= edge) return 'strong';
  if (rank > n - VERY) return 'poor';
  if (rank > n - edge) return 'weak';
  return 'average';
}

/** "1st", "2nd", "3rd", "11th", "22nd". */
export function ordinal(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  const s = { 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th';
  return `${v}${s}`;
}

/** A defense rank (1 = allows the most) turned round, so 1 = the best for the team. */
export const bestOf = (rank, n) => (rank && n ? n + 1 - rank : null);

/** The word, tone and level for a rank of a kind: { word, level, tone }, or nulls without a rank. */
export function badgeOf(kind, rank, n) {
  const level = levelOf(rank, n);
  return { level, word: level ? WORDS[kind][level] : null, tone: level ? TONES[kind][level] : '' };
}

/**
 * A cell: the badge, the source, the hover and the line as parts — plain text and rank phrases, each
 * rank with the tone of its level (green = more shots and goals likely, red = fewer) so the card can
 * colour "14th of 32 most" by what it means. `text` is the parts joined, for the tests and the hover.
 */
export function cellOf(badge, source, title, parts) {
  const list = parts.filter((x) => x && x.t);
  return { ...badge, source, title, parts: list, text: list.map((x) => x.t).join('') };
}
/** A rank phrase as a part: "3rd of 32 in shots" with the tone of its level for the kind. */
export const rankPart = (kind, rank, n, suffix = '') => ({ t: `${ordinal(rank)} of ${n}${suffix}`, tone: badgeOf(kind, kind === 'defense' ? bestOf(rank, n) : rank, n).tone });



// Images for the signed-in app come from our own store (admin-only route that
// falls back to the NHL's CDN until a file has been copied).
export const headshotUrl = (id) => (id ? `/api/nhl/data/media?kind=headshot&id=${id}` : '');
export const logoUrl = (abbr) => (abbr ? `/api/nhl/data/media?kind=logo&id=${abbr}` : '');

export function Headshot({ id, size = 32, className = '' }) {
  if (!id) return <span className={`nhlx-db-avatar ${className}`} style={{ width: size, height: size }} />;
  return <img src={headshotUrl(id)} alt="" width={size} height={size} loading="lazy" className={className} style={{ borderRadius: '50%', objectFit: 'cover', background: 'var(--bg-soft)' }} />;
}

export function TeamLogo({ abbr, size = 24 }) {
  return <img src={logoUrl(abbr)} alt="" width={size} height={size} loading="lazy" />;
}

/** 1–32 rank → colour class: green = most permissive third, red = stingiest. */
export function rankClass(rank, teams = 32) {
  if (!rank) return '';
  if (rank <= Math.ceil(teams / 3)) return 'is-soft';
  if (rank > teams - Math.ceil(teams / 3)) return 'is-tough';
  return '';
}

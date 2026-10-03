'use client';

import { TeamLogo } from './media';

// Deep links to a team's page: the Teams tab with that team picked is `#teams/BUF`.
export const teamHref = (abbr) => `#teams/${abbr}`;

/** The team an `#teams/XXX` hash names, or '' (also '' for any other tab). */
export function teamFromHash(hash = typeof window === 'undefined' ? '' : window.location.hash) {
  const m = /^#teams\/([A-Za-z]{3})$/.exec(hash || '');
  return m ? m[1].toUpperCase() : '';
}

/** Wraps a team's logo / name so clicking it opens that team's page. */
export function TeamLink({ abbr, logo = 0, children, className = '', title }) {
  if (!abbr) return children ?? null;
  return (
    <a href={teamHref(abbr)} className={`nhlx-teamlink ${className}`} title={title || `Open the ${abbr} team page`}>
      {logo ? <TeamLogo abbr={abbr} size={logo} /> : null}
      {children}
    </a>
  );
}

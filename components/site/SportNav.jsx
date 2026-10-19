'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const SPORTS = [
  ['nfl', 'NFL'],
  ['nba', 'NBA'],
  ['nhl', 'NHL'],
];

/** The three sports in the header; the open one is marked. */
export default function SportNav() {
  const path = usePathname() || '';
  return (
    <nav className="ir-sportnav" aria-label="Sports">
      {SPORTS.map(([key, label]) => {
        const active = path === `/${key}` || path.startsWith(`/${key}/`);
        return <Link key={key} href={`/${key}`} className={`ir-sportnav-link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>{label}</Link>;
      })}
    </nav>
  );
}

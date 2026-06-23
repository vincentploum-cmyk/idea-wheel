'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/wheel',   label: 'Spin' },
  { href: '/ideas',   label: 'Ideas' },
  { href: '/example', label: 'Example' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog',    label: 'Blog' },
  { href: '/faq',     label: 'FAQ' },
];

export default function NavLinks({ mobile = false }) {
  const pathname = usePathname();

  const items = NAV_LINKS.map(({ href, label }) => {
    const active = pathname === href || (href !== '/' && pathname.startsWith(href));
    return (
      <li key={href}>
        <Link href={href} className={active ? 'nav-active' : undefined}>
          <span>
            <span>{label}</span>
            <span className="suffix">//</span>
          </span>
        </Link>
      </li>
    );
  });

  if (mobile) {
    return <>{items}</>;
  }
  return <>{items}</>;
}

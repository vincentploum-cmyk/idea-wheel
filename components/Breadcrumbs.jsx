'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

// Segments that need special casing beyond title-case-from-kebab.
// Only add here what the auto-transform would get wrong.
const LABEL_MAP = {
  faq: 'FAQ',
  b2b: 'B2B',
  vs: 'vs',
  versus: 'Compare',
  offer: 'Special offer',
  goodbye: 'Goodbye',
  tools: 'Tools',
  admin: 'Admin',
  auth: 'Auth',
  status: 'System status',
};

// Paths where breadcrumbs would add friction, not value.
const HIDE_ON = [
  /^\/$/,
  /^\/wheel(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/auth(\/|$)/,
  /^\/profile$/,
];

// Convert a URL slug into a human label:
//   'rate-my-startup-idea' -> 'Rate My Startup Idea'
//   'ideareels-vs-dimeadozen' -> 'IdeaReels vs Dimeadozen'
// (brand casings kept via LABEL_MAP where they matter)
function humanise(slug) {
  if (!slug) return '';
  if (LABEL_MAP[slug]) return LABEL_MAP[slug];
  return slug
    .split('-')
    .map((word) => {
      if (LABEL_MAP[word]) return LABEL_MAP[word];
      if (!word) return word;
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  if (!pathname) return null;
  if (HIDE_ON.some((rx) => rx.test(pathname))) return null;

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = [{ label: 'Home', href: '/' }];
  let acc = '';
  for (const seg of segments) {
    acc += `/${seg}`;
    crumbs.push({ label: humanise(seg), href: acc });
  }

  // BreadcrumbList JSON-LD for Google search-result breadcrumbs. Every entry
  // includes an `item` URL per current schema.org guidance.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: `https://ideareels.io${c.href}`,
    })),
  };

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '16px 20px 0',
        fontSize: 13,
        lineHeight: 1.5,
        color: '#111',
      }}
    >
      <ol
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          margin: 0,
          padding: 0,
          listStyle: 'none',
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={c.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && (
                <span aria-hidden="true" style={{ opacity: 0.45, userSelect: 'none' }}>
                  ›
                </span>
              )}
              {isLast ? (
                <span aria-current="page" style={{ fontWeight: 700, opacity: 0.85 }}>
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  style={{
                    color: '#111',
                    textDecoration: 'underline',
                    textDecorationColor: '#FFE000',
                    textDecorationThickness: 2,
                    textUnderlineOffset: 3,
                    opacity: 0.7,
                  }}
                >
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </nav>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BREADCRUMB_TITLES_BY_PATH } from '@/lib/breadcrumb-titles';

// Segments that need special casing beyond title-case-from-kebab.
// Includes brand casings so /versus/ideareels-vs-dimeadozen renders as
// 'IdeaReels vs DimeADozen' rather than 'Ideareels Vs Dimeadozen'.
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
  // Brand names — case-preserved for both native and competitor products.
  ideareels: 'IdeaReels',
  dimeadozen: 'DimeADozen',
  ideabrowser: 'IdeaBrowser',
  validatorai: 'ValidatorAI',
};

// Word map used ONLY inside the split-and-join path for slugs like
// 'validatorai-alternatives' — keeps the tail lowercase so the phrase reads
// as "ValidatorAI alternatives" rather than "ValidatorAI Alternatives".
// The standalone /alternatives segment still takes the LABEL_MAP fallback
// which title-cases it.
const IN_PHRASE_LOWERCASE = new Set(['alternatives', 'vs']);

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
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    acc += `/${seg}`;
    // Prefer an explicit full-path label (blog post titles, tool titles) when
    // we have one — it's the most human-readable version. Falls back to the
    // per-segment brand + auto-titlecase map otherwise. Some entries in the
    // ALTERNATIVES/VERSUS routes end in '-alternatives' where the leading
    // brand segment carries the whole meaning; join the parts so
    // 'validatorai-alternatives' becomes 'ValidatorAI alternatives'.
    const fullPathTitle = BREADCRUMB_TITLES_BY_PATH[acc];
    let label;
    if (fullPathTitle) {
      label = fullPathTitle;
    } else if (seg.endsWith('-alternatives') || seg.includes('-vs-')) {
      label = seg
        .split('-')
        .map((w) => {
          if (LABEL_MAP[w]) return LABEL_MAP[w];
          if (IN_PHRASE_LOWERCASE.has(w)) return w;
          return w ? w[0].toUpperCase() + w.slice(1) : '';
        })
        .join(' ');
    } else {
      label = humanise(seg);
    }
    crumbs.push({ label, href: acc });
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

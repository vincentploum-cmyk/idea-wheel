import './globals.css';
import dynamic from 'next/dynamic';

const CookieBanner = dynamic(() => import('@/components/CookieBanner'), { ssr: false });
const WebVitals = dynamic(() => import('@/components/WebVitals'), { ssr: false });

export const metadata = {
  metadataBase: new URL('https://ideareels.io'),
  title: {
    default: 'IdeaReels — AI Startup Idea Validation & MVP Blueprint',
    template: '%s | IdeaReels',
  },
  description: 'Stop building the wrong thing. IdeaReels validates your startup idea with AI market research and produces a full technical MVP blueprint in minutes, not weeks. From $3.99.',
  keywords: [
    'startup idea generator',
    'startup idea generator for solo founders',
    'startup idea generator with market research',
    'AI startup idea generator',
    'AI MVP blueprint generator',
    'how to validate a startup idea fast',
    'startup idea generator no subscription',
    'indie hacker business idea generator',
    'micro-SaaS idea generator',
    'vibe coding startup ideas',
    'random startup idea generator with validation',
    'slot machine startup idea generator',
    'pay per use startup idea tool',
    'startup idea validator',
    'startup market research tool',
  ],
  authors: [{ name: 'IdeaReels', url: 'https://ideareels.io' }],
  creator: 'IdeaReels',
  publisher: 'IdeaReels',
  openGraph: {
    title: 'IdeaReels — AI Startup Idea Validation & MVP Blueprints from $3.99',
    description: 'Validate your startup idea with AI market research and get a full technical MVP blueprint in minutes, not weeks. Built for vibe coders and solo founders.',
    type: 'website',
    url: 'https://ideareels.io',
    siteName: 'IdeaReels',
    locale: 'en_US',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630, alt: 'IdeaReels — AI Startup Idea Validation & MVP Blueprints' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ideareels',
    title: 'IdeaReels — Validate Your Startup Idea with AI Market Research',
    description: 'Stop building the wrong thing. AI market research + MVP blueprint in minutes, not weeks, from $3.99.',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630, alt: 'IdeaReels — AI Startup Idea Validation & MVP Blueprints' }],
  },
  // robots.txt is handled exclusively by app/robots.js — no meta robots tag here
  verification: { google: '7-zPuvRs0wD-bV9Mr_dDdu4vcjW2o3XrZzVGJuqDyd0' },
  alternates: { canonical: 'https://ideareels.io' },
  other: { 'theme-color': '#FFE000' },
  icons: {
    apple: '/apple-touch-icon.png',
  },
};

// WebSite schema with SearchAction for Google Sitelinks searchbox
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'IdeaReels',
  url: 'https://ideareels.io',
  description: 'AI-powered startup idea validation, market research, and technical MVP blueprint tool for solo founders and vibe coders.',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: 'https://ideareels.io/blog?q={search_term_string}' },
    'query-input': 'required name=search_term_string',
  },
};

// Organization schema for brand knowledge graph
const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'IdeaReels',
  url: 'https://ideareels.io',
  logo: 'https://ideareels.io/ideareels-logo.svg',
  description: 'AI startup-idea generator and validator. Spin an idea, get an AI market verdict, unlock a full MVP blueprint.',
  foundingDate: '2026',
  // Populate this array with real social profile URLs (X/Twitter, LinkedIn,
  // GitHub org, Product Hunt maker) as they go live. Google uses sameAs to
  // connect the brand to its accounts in the knowledge panel; wrong URLs are
  // worse than none.
  sameAs: (process.env.NEXT_PUBLIC_ORG_SAMEAS || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s)),
  contactPoint: [
    { '@type': 'ContactPoint', contactType: 'customer support', email: 'hello@ideareels.io', url: 'https://ideareels.io/contact', availableLanguage: ['English'] },
  ],
};

export default function RootLayout({ children }) {
  // Derive the Supabase origin from env so the prefetch can't go stale after a
  // project migration (a hardcoded ref previously pointed at an old project).
  const supabaseOrigin = (() => {
    try { return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null; }
    catch { return null; }
  })();

  return (
    <html lang="en">
      <head>
        {/* CWV: Preconnect to critical third-party origins */}
        <link rel="dns-prefetch" href="https://js.stripe.com" />
        {supabaseOrigin && <link rel="dns-prefetch" href={supabaseOrigin} />}

        {/* Fonts are self-hosted (see @font-face in globals.css).
            Preload the two files needed for above-the-fold text. */}
        <link rel="preload" as="font" type="font/woff2" href="/fonts/nunito-var-latin.woff2" crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href="/fonts/roboto-var-latin.woff2" crossOrigin="anonymous" />

        {/* Template CSS. NOTE: string onLoad handlers are silently dropped by
            React server components — a media="print" async-load trick does NOT
            work here and left these stylesheets permanently disabled in prod.
            style.css (core) + responsive.css (mobile breakpoints) load normally;
            base.css and plugins.css targeted markup this app never renders. */}
        <link rel="stylesheet" href="/popito-assets/css/style.css" />
        <link rel="stylesheet" href="/popito-assets/css/responsive.css" />

        {/* Global schema: WebSite + Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body>
        {children}
        <CookieBanner />
        <WebVitals />
        {/* The template's jQuery stack (jquery.js + init.js + plugins.js) is
            fully retired: sticky nav → StickyChrome, mobile menu → MobileNav,
            fn__svg inlining → components/popito/icons.jsx; everything else
            targeted markup this app never renders. */}
      </body>
    </html>
  );
}

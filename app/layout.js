import './globals.css';
import Script from 'next/script';
import dynamic from 'next/dynamic';

const CookieBanner = dynamic(() => import('@/components/CookieBanner'), { ssr: false });
const WebVitals = dynamic(() => import('@/components/WebVitals'), { ssr: false });

export const metadata = {
  metadataBase: new URL('https://ideareels.io'),
  title: {
    default: 'IdeaReels — AI Startup Idea Validation & MVP Blueprint',
    template: '%s | IdeaReels',
  },
  description: 'Stop building the wrong thing. IdeaReels validates your startup idea with AI market research and produces a full technical MVP blueprint in under 5 minutes. From $3.99.',
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
    description: 'Validate your startup idea with AI market research and get a full technical MVP blueprint in under 5 minutes. Built for vibe coders and solo founders.',
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
    description: 'Stop building the wrong thing. AI market research + MVP blueprint in under 5 minutes, from $3.99.',
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
  sameAs: [],
  contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', url: 'https://ideareels.io/faq' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* CWV: Preconnect to critical third-party origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />
        <link rel="dns-prefetch" href="https://ywroiurslbnnqecwmkbs.supabase.co" />

        {/* Preload Nunito so the brand font lands before LCP element paints */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Roboto:wght@400;700&display=swap"
        />
        {/* Load only the weights we actually use: Nunito 700/800/900, Roboto 400/700 */}
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Roboto:wght@400;700&display=swap"
          rel="stylesheet"
        />

        {/* Critical template CSS — blocking so above-fold content renders correctly */}
        <link rel="preload" as="style" href="/popito-assets/css/style.css" />
        <link rel="stylesheet" href="/popito-assets/css/style.css" />
        {/* Non-critical template CSS — loaded after paint to cut render-blocking time */}
        <link rel="stylesheet" href="/popito-assets/css/base.css" media="print" onLoad="this.media='all'" />
        <link rel="stylesheet" href="/popito-assets/css/plugins.css" media="print" onLoad="this.media='all'" />
        <link rel="stylesheet" href="/popito-assets/css/responsive.css" media="print" onLoad="this.media='all'" />

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
        <Script src="/popito-assets/js/jquery.js" strategy="afterInteractive" />
        <Script src="/popito-assets/js/plugins.js" strategy="afterInteractive" />
        <Script src="/popito-assets/js/init.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}

import './globals.css';
import Script from 'next/script';
import dynamic from 'next/dynamic';

const CookieBanner = dynamic(() => import('@/components/CookieBanner'), { ssr: false });
const WebVitals = dynamic(() => import('@/components/WebVitals'), { ssr: false });

export const metadata = {
  metadataBase: new URL('https://ideareels.io'),
  title: {
    default: 'IdeaReels — #1 AI Startup Idea Validation & MVP Blueprint Tool',
    template: '%s | IdeaReels',
  },
  description: 'Stop building the wrong thing. IdeaReels validates your startup idea with AI market research and produces a full technical MVP blueprint in under 5 minutes. From $3.99.',
  keywords: [
    'startup idea validation tool',
    'AI market research for startups',
    'MVP blueprint generator',
    'startup idea validator',
    'how to validate a startup idea',
    'business idea validator online',
    'technical MVP blueprint tool',
    'indie hacker tools 2025',
    'vibe coder startup tools',
    'solo founder market research',
    'AI startup research tool',
    'validate startup idea fast',
    'startup market research tool',
    'MVP planning tool',
  ],
  authors: [{ name: 'IdeaReels', url: 'https://ideareels.io' }],
  creator: 'IdeaReels',
  publisher: 'IdeaReels',
  openGraph: {
    title: 'IdeaReels — AI Startup Idea Validation & MVP Blueprints from $3.99',
    description: 'Validate your startup idea with AI market research and get a full technical MVP blueprint in under 5 minutes. Built for vibe coders, indie hackers, and solo founders.',
    type: 'website',
    url: 'https://ideareels.io',
    siteName: 'IdeaReels',
    locale: 'en_US',
    images: [{ width: 1200, height: 630, alt: 'IdeaReels — AI Startup Idea Validation & MVP Blueprints' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ideareels',
    title: 'IdeaReels — Validate Your Startup Idea with AI Market Research',
    description: 'Stop building the wrong thing. AI market research + MVP blueprint in under 5 minutes, from $3.99.',
    images: [{ width: 1200, height: 630 }],
  },
  // robots.txt is handled exclusively by app/robots.js — no meta robots tag here
  verification: { google: '7-zPuvRs0wD-bV9Mr_dDdu4vcjW2o3XrZzVGJuqDyd0' },
  alternates: { canonical: 'https://ideareels.io' },
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

        {/* CWV: font-display=swap prevents invisible text during font load (reduces CLS/INP) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap"
          rel="stylesheet"
        />

        {/* CWV: Preload critical stylesheet for faster LCP */}
        <link rel="preload" as="style" href="/popito-assets/css/style.css" />
        <link rel="stylesheet" href="/popito-assets/css/base.css" />
        <link rel="stylesheet" href="/popito-assets/css/plugins.css" />
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
        {/* CWV: jQuery must be beforeInteractive (plugins depend on it); others deferred */}
        <Script src="/popito-assets/js/jquery.js" strategy="beforeInteractive" />
        <Script src="/popito-assets/js/plugins.js" strategy="afterInteractive" />
        <Script src="/popito-assets/js/init.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}

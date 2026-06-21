import './globals.css';
import Script from 'next/script';
import CookieBanner from '@/components/CookieBanner';

export const metadata = {
  metadataBase: new URL('https://ideareels.io'),
  title: {
    default: 'IdeaReels — AI Market Research & MVP Blueprints for Solo Builders',
    template: '%s | IdeaReels',
  },
  description: 'Stop building the wrong thing. IdeaReels gives you AI-powered market research and a full technical MVP blueprint in minutes — before you write a single line of code.',
  keywords: [
    'startup idea validator',
    'AI market research tool',
    'MVP blueprint generator',
    'startup idea validation',
    'technical MVP blueprint',
    'indie hacker tools',
    'vibe coder tools',
    'solo founder tools',
    'business idea validator',
    'AI startup research',
    'market validation tool',
  ],
  authors: [{ name: 'IdeaReels' }],
  creator: 'IdeaReels',
  openGraph: {
    title: 'IdeaReels — AI Market Research & MVP Blueprints for Solo Builders',
    description: 'Stop building the wrong thing. Get AI-powered market research and a technical MVP blueprint in minutes — for vibe coders, indie hackers, and solo founders.',
    type: 'website',
    url: 'https://ideareels.io',
    siteName: 'IdeaReels',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'IdeaReels — AI Market Research and MVP Blueprints' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IdeaReels — AI Market Research & MVP Blueprints for Solo Builders',
    description: 'Stop building the wrong thing. Get AI market research and a technical MVP blueprint in minutes, before you commit to build.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 } },
  verification: { google: '7-zPuvRs0wD-bV9Mr_dDdu4vcjW2o3XrZzVGJuqDyd0' },
  alternates: { canonical: 'https://ideareels.io' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,700;0,800;0,900;1,700&family=Roboto:wght@0,400;0,700&display=swap" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/popito-assets/css/base.css" />
        <link rel="stylesheet" href="/popito-assets/css/plugins.css" />
        <link rel="stylesheet" href="/popito-assets/css/style.css" />
        <link rel="stylesheet" href="/popito-assets/css/responsive.css" />
      </head>
      <body>
        {children}
        <CookieBanner />
        <Script src="/popito-assets/js/jquery.js" strategy="beforeInteractive" />
        <Script src="/popito-assets/js/plugins.js" strategy="afterInteractive" />
        <Script src="/popito-assets/js/init.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}

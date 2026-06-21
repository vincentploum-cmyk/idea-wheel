import './globals.css';
import Script from 'next/script';
import CookieBanner from '@/components/CookieBanner';

export const metadata = {
  metadataBase: new URL('https://ideareels.io'),
  title: {
    default: 'IdeaReels — spin up your next weekend build',
    template: '%s | IdeaReels',
  },
  description: 'IdeaReels helps builders get from concept to market research to technical MVP blueprint fast, so they can walk in with the kind of prep they would want before Shark Tank.',
  keywords: ['startup market research tool', 'mvp blueprint tool', 'business idea validator', 'technical blueprint for founders', 'indie hacker tools', 'vibe coder startup research'],
  authors: [{ name: 'IdeaReels' }],
  creator: 'IdeaReels',
  openGraph: {
    title: 'IdeaReels — spin up your next weekend build',
    description: 'For vibe coders, indie hackers, and solo builders. Go from concept to market research to technical MVP blueprint fast.',
    type: 'website',
    url: 'https://ideareels.io',
    siteName: 'IdeaReels',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'IdeaReels — spin up your next weekend build' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IdeaReels — spin up your next weekend build',
    description: 'Get the market research and technical MVP blueprint you want before committing to build.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  verification: { google: '7-zPuvRs0wD-bV9Mr_dDdu4vcjW2o3XrZzVGJuqDyd0' },
  alternates: { canonical: 'https://ideareels.io' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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

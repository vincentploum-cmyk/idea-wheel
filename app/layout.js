import './globals.css';
import Script from 'next/script';
import CookieBanner from '@/components/CookieBanner';

export const metadata = {
  metadataBase: new URL('https://ideareels.io'),
  title: {
    default: 'IdeaReels — Find a Startup Idea Worth Building',
    template: '%s | IdeaReels',
  },
  description: 'IdeaReels generates startup ideas from real market signals, validates them instantly with competitor analysis and market size data, and unlocks a build-ready blueprint — product, GTM, infrastructure, and prototype — only when the idea clears the bar.',
  keywords: ['startup idea generator', 'business idea validator', 'startup blueprint', 'AI startup tool', 'idea validation', 'market validation tool', 'startup ideas', 'business ideas'],
  authors: [{ name: 'IdeaReels' }],
  creator: 'IdeaReels',
  openGraph: {
    title: 'IdeaReels — Find a Startup Idea Worth Building',
    description: 'Generate startup ideas from real market signals, validate them instantly, and unlock a full blueprint — product, GTM, infrastructure, and prototype.',
    type: 'website',
    url: 'https://ideareels.io',
    siteName: 'IdeaReels',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'IdeaReels — Startup Idea Generator' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IdeaReels — Find a Startup Idea Worth Building',
    description: 'Generate startup ideas from real market signals, validate them instantly, and unlock a full blueprint.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
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

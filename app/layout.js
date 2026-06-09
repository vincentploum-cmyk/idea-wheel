import { IBM_Plex_Mono, Manrope } from 'next/font/google';

import './globals.css';
import CookieBanner from '@/components/CookieBanner';
import CloudBackground from '@/components/CloudBackground';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://ideareels.io'),
  title: {
    default: 'IdeaReels — Spin an idea. Ship a company.',
    template: '%s | IdeaReels',
  },
  description: 'Spin three reels to land on a startup idea. Get free market validation, then unlock a full blueprint: product, go-to-market, architecture, and prototype.',
  openGraph: {
    title: 'IdeaReels — Spin an idea. Ship a company.',
    description: 'Spin three reels to land on a startup idea. Get free market validation, then unlock a full blueprint.',
    type: 'website',
    url: 'https://ideareels.io',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IdeaReels — Spin an idea. Ship a company.',
    description: 'Spin three reels to land on a startup idea. Get free market validation, then unlock a full blueprint.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${ibmPlexMono.variable}`}>
        <CloudBackground />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}

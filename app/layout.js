import './globals.css';
import CookieBanner from '@/components/CookieBanner';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'IdeaWheel',
    template: '%s | IdeaWheel',
  },
  description: 'Generate a business idea, validate the market for free, and unlock a full product, GTM, infrastructure, and prototype blueprint.',
  openGraph: {
    title: 'IdeaWheel',
    description: 'Generate a business idea, validate the market for free, and unlock a full product, GTM, infrastructure, and prototype blueprint.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IdeaWheel',
    description: 'Generate a business idea, validate the market for free, and unlock a full product, GTM, infrastructure, and prototype blueprint.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}

import './globals.css';
import Script from 'next/script';
import CookieBanner from '@/components/CookieBanner';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://ideareels.io'),
  title: {
    default: 'IdeaReels — Find a startup idea worth building.',
    template: '%s | IdeaReels',
  },
  description: 'Generate sharper business ideas in seconds, run a quick market check, and unlock a build-ready blueprint only when one is worth pursuing.',
  openGraph: {
    title: 'IdeaReels — Find a startup idea worth building.',
    description: 'Generate sharper business ideas in seconds, run a quick market check, and unlock a build-ready blueprint only when one is worth pursuing.',
    type: 'website',
    url: 'https://ideareels.io',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IdeaReels — Find a startup idea worth building.',
    description: 'Generate sharper business ideas in seconds, run a quick market check, and unlock a build-ready blueprint only when one is worth pursuing.',
  },
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

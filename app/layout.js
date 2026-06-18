import './globals.css';
import '@/styles/zubaz/bootstrap.min.css';
import '@/styles/zubaz/app.css';
import '@/styles/zubaz/main.css';
import '@/styles/zubaz/react-adjustment.css';
import Script from 'next/script';
import CookieBanner from '@/components/CookieBanner';
import CloudBackground from '@/components/CloudBackground';

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/intellio-css/bootstrap.min.css" />
        <link rel="stylesheet" href="/intellio-css/fontawesome.css" />
        <link rel="stylesheet" href="/intellio-css/fontawesome-free.css" />
        <link rel="stylesheet" href="/intellio-css/animate.css" />
        <link rel="stylesheet" href="/intellio-css/magnific.css" />
        <link rel="stylesheet" href="/intellio-css/meanmenu.min.css" />
        <link rel="stylesheet" href="/intellio-css/nice-select.css" />
        <link rel="stylesheet" href="/intellio-css/swiper.min.css" />
        <link rel="stylesheet" href="/intellio-css/style-dark.css" />
        <link rel="stylesheet" href="/intellio-css/responsive.css" />
      </head>
      <body>
        <CloudBackground />
        {children}
        <CookieBanner />
        <Script src="/intellio-js/jquery.js" strategy="afterInteractive" />
        <Script src="/intellio-js/bootstrap.min.js" strategy="afterInteractive" />
        <Script src="/intellio-js/jquery.meanmenu.js" strategy="afterInteractive" />
        <Script src="/intellio-js/wow.js" strategy="afterInteractive" />
        <Script src="/intellio-js/appear.js" strategy="afterInteractive" />
        <Script src="/intellio-js/swiper.min.js" strategy="afterInteractive" />
        <Script src="/intellio-js/ScrollTrigger.min.js" strategy="afterInteractive" />
        <Script src="/intellio-js/ScrollToPlugin.min.js" strategy="afterInteractive" />
        <Script src="/intellio-js/ScrollSmoother.min.js" strategy="afterInteractive" />
        <Script src="/intellio-js/SplitText.js" strategy="afterInteractive" />
        <Script src="/intellio-js/main.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}

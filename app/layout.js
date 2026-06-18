import './globals.css';
import '@/styles/zubaz/bootstrap.min.css';
import '@/styles/zubaz/app.css';
import '@/styles/zubaz/main.css';
import '@/styles/zubaz/react-adjustment.css';
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
        <link rel="stylesheet" href="/boostly/assets/css/bootstrap.min.css" />
        <link rel="stylesheet" href="/boostly/assets/css/all.min.css" />
        <link rel="stylesheet" href="/boostly/assets/css/animate.css" />
        <link rel="stylesheet" href="/boostly/assets/css/magnific-popup.css" />
        <link rel="stylesheet" href="/boostly/assets/css/meanmenu.css" />
        <link rel="stylesheet" href="/boostly/assets/css/swiper-bundle.min.css" />
        <link rel="stylesheet" href="/boostly/assets/css/nice-select.css" />
        <link rel="stylesheet" href="/boostly/assets/css/flaticon.css" />
        <link rel="stylesheet" href="/boostly/assets/css/main.css" />
      </head>
      <body>
        <CloudBackground />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}

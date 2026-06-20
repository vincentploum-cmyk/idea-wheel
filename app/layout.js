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
    default: 'IdeaReels — spin up your next weekend build',
    template: '%s | IdeaReels',
  },
  description: 'IdeaReels helps vibe coders spin into buildable ideas, sanity-check them fast, and unlock a blueprint when a project feels real.',
  openGraph: {
    title: 'IdeaReels — spin up your next weekend build',
    description: 'Spin the wheel, get a fast market sanity check, and unlock a build-ready blueprint.',
    type: 'website',
    url: 'https://ideareels.io',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IdeaReels — spin up your next weekend build',
    description: 'Spin the wheel, get a fast market sanity check, and unlock a build-ready blueprint.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <CloudBackground />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}

import '@fontsource-variable/outfit';
import '@fontsource-variable/inter';
import './globals.css';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://ideareels.io'),
  title: {
    default: 'NHL Model 3.0 · Shot Supply Engine',
    template: '%s · NHL Model 3.0',
  },
  description: 'Private NHL player prop probability model: shots, goals, points and goalie saves ladders built from nightly matchup files.',
  // Private tool: keep it out of search indexes.
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }] },
};

export const viewport = {
  themeColor: '#fbfcfd',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

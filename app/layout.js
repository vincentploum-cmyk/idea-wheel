import '@fontsource-variable/schibsted-grotesk';
import '@fontsource-variable/source-sans-3';
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
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f9fafc' }, { media: '(prefers-color-scheme: dark)', color: '#14161f' }],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint (dark by default). */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('nhlx-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

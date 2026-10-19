import '@fontsource-variable/schibsted-grotesk';
import '@fontsource-variable/source-sans-3';
import './globals.css';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://ideareels.io'),
  title: {
    default: 'ideareels · NFL, NHL and NBA picks',
    template: '%s · ideareels',
  },
  description: 'Private picks site: the NFL week’s best plays per game (touchdowns, passing, rushing, receiving), the NHL Model 3.0 shots and goals board, and the NBA slot.',
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

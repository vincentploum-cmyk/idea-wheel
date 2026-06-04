import './globals.css';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Idea Generator',
    template: '%s | Idea Generator',
  },
  description: 'Spin an idea, validate the market for free, and generate a full blueprint with product, GTM, infrastructure, and prototype output.',
  openGraph: {
    title: 'Idea Generator',
    description: 'Spin an idea, validate the market for free, and generate a full blueprint with product, GTM, infrastructure, and prototype output.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Idea Generator',
    description: 'Spin an idea, validate the market for free, and generate a full blueprint with product, GTM, infrastructure, and prototype output.',
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
      <body>{children}</body>
    </html>
  );
}

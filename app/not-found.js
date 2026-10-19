import Link from 'next/link';
import SiteHeader from '@/components/nhl/SiteHeader';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="nhlx-center nhlx-glow">
        <div className="nhlx-panel">
          <span className="nhlx-eyebrow">404</span>
          <h1>Out of bounds</h1>
          <p>That page doesn&apos;t exist. The picks start from the home page: NFL, NBA and NHL.</p>
          <Link href="/" className="nhlx-btn" style={{ marginTop: 26 }}>Back to the start screen</Link>
        </div>
      </main>
    </>
  );
}

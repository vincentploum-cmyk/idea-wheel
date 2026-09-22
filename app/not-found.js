import Link from 'next/link';
import SiteHeader from '@/components/nhl/SiteHeader';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="nhlx-center nhlx-glow">
        <div className="nhlx-panel">
          <span className="nhlx-eyebrow">404</span>
          <h1 style={{ marginTop: 14 }}>Off the ice</h1>
          <p>That page doesn&apos;t exist. The model lives on the home page.</p>
          <Link href="/" className="nhlx-btn" style={{ marginTop: 26 }}>Back to the model</Link>
        </div>
      </main>
    </>
  );
}

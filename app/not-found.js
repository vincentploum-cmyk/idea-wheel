import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', background: '#faf7ff', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, padding: 24, textAlign: 'center' }}>
      <div style={{ fontFamily: '"Sora", system-ui', fontSize: 'clamp(80px,15vw,140px)', fontWeight: 800, lineHeight: 1, background: 'linear-gradient(120deg,#7c3aed,#c026d3,#ff4d8d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>404</div>
      <h1 style={{ fontFamily: '"Sora", system-ui', fontSize: 24, fontWeight: 700, margin: 0, color: '#18112b' }}>This page doesn't exist</h1>
      <p style={{ fontSize: 15, color: '#7a7191', margin: 0, maxWidth: 360, lineHeight: 1.6 }}>Looks like you spun into the wrong frontier. Let's get you back on track.</p>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', background: 'linear-gradient(120deg,#7c3aed,#c026d3,#ff4d8d)', color: '#fff', borderRadius: 14, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
        ✦ Back to IdeaReels
      </Link>
    </main>
  );
}

import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        fontFamily: 'var(--font-body)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 20,
        padding: 24,
        textAlign: 'center',
        color: 'var(--ink)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(72px,12vw,128px)',
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          color: 'var(--accent)',
        }}
      >
        404
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 700,
          margin: 0,
          color: 'var(--ink)',
          letterSpacing: '-0.02em',
        }}
      >
        This route spun into the void
      </h1>
      <p
        style={{
          fontSize: 15,
          color: 'var(--muted)',
          margin: 0,
          maxWidth: 420,
          lineHeight: 1.6,
        }}
      >
        The page you wanted is gone, but the wheel is still here and ready when you are.
      </p>
      <Link
        href="/wheel"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 24px',
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: 999,
          fontWeight: 600,
          fontSize: 14,
          textDecoration: 'none',
        }}
      >
        Back to the wheel
      </Link>
    </main>
  );
}

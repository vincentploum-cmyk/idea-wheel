'use client';

export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0b0e13', color: '#ababab', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 28, margin: 0 }}>Something broke</h1>
            <p style={{ marginTop: 12 }}>The page hit an unexpected error.</p>
            <button
              type="button"
              onClick={() => reset()}
              style={{ marginTop: 20, height: 48, padding: '0 24px', border: 0, background: '#cbfe1c', color: '#0b0e13', fontWeight: 700, cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}

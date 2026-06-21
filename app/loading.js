export default function Loading() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--ink)',
        fontFamily: 'var(--font-body)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 28,
          boxShadow: 'var(--sh-sm)',
          padding: '28px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 999,
            background: 'var(--accent-light)',
            color: 'var(--accent)',
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          …
        </div>
        <h1
          style={{
            margin: '0 0 10px',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 5vw, 36px)',
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
          }}
        >
          Loading IdeaReels
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--muted)',
          }}
        >
          Preparing your market research and MVP blueprint workflow.
        </p>
      </div>
    </main>
  );
}

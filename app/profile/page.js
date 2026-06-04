export const metadata = {
  title: 'Profile',
  description: 'Your Idea Generator profile and credits.',
};

export default function ProfilePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F5F7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, -apple-system, sans-serif',
      padding: '40px 20px',
    }}>
      <div style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.09)',
        borderRadius: 20,
        padding: '40px 36px',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>👤</div>
        <h1 style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 20, fontWeight: 900, margin: '0 0 8px', color: '#1D1D1F' }}>Profile</h1>
        <p style={{ fontSize: 14, color: '#6E6E73', margin: '0 0 28px', lineHeight: 1.6 }}>
          Sign in to save your ideas, track credits, and access your blueprint history.
        </p>
        <a href="/" style={{
          display: 'inline-block',
          fontSize: 13,
          fontWeight: 600,
          color: '#6E6E73',
          textDecoration: 'none',
          padding: '8px 16px',
          border: '1px solid rgba(0,0,0,0.09)',
          borderRadius: 8,
        }}>← Back to Idea Generator</a>
      </div>
    </div>
  );
}

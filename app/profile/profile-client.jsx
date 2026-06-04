'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function ProfileClient({ user, error }) {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(error === 'auth' ? 'Sign-in link expired or invalid. Try again.' : '');

  const sendMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true); setErr('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) { setErr(error.message); setLoading(false); }
    else { setSent(true); setLoading(false); }
  };

  const signInWithOAuth = async (provider) => {
    setErr('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setErr(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    location.reload();
  };

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <a href="/" style={styles.back}>← Idea Generator</a>

        {user ? (
          <>
            <div style={styles.avatar}>{user.email?.[0]?.toUpperCase() ?? '?'}</div>
            <h1 style={styles.title}>Your Profile</h1>
            <p style={styles.email}>{user.email}</p>
            <div style={styles.section}>
              <span style={styles.seclabel}>CREDITS</span>
              <span style={styles.credval}>—</span>
              <span style={styles.crednote}>Credits are currently stored locally. Account-linked credits coming soon.</span>
            </div>
            <button onClick={signOut} style={styles.signoutBtn}>Sign out</button>
          </>
        ) : sent ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 14 }}>✉️</div>
            <h1 style={styles.title}>Check your email</h1>
            <p style={styles.sub}>We sent a sign-in link to <strong>{email}</strong>. Click it to continue.</p>
            <button onClick={() => setSent(false)} style={styles.ghostBtn}>Use a different email</button>
          </>
        ) : (
          <>
            <h1 style={styles.title}>Sign in</h1>
            <p style={styles.sub}>Save your ideas and credits to your account.</p>

            {err && <p style={styles.errBox}>{err}</p>}

            <button onClick={() => signInWithOAuth('google')} style={styles.oauthBtn}>
              <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>

            <button onClick={() => signInWithOAuth('github')} style={styles.oauthBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Continue with GitHub
            </button>

            <div style={styles.divider}><span>or</span></div>

            <form onSubmit={sendMagicLink} style={styles.form}>
              <input
                type="email" required placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                style={styles.input}
              />
              <button type="submit" disabled={loading} style={styles.submitBtn}>
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          </>
        )}
      </div>
      <div style={{ maxWidth: 400, margin: '24px auto 0', padding: '0 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#aaa1bd', lineHeight: 1.7, margin: 0 }}>
          Idea Generator is an AI-powered research and ideation tool. All market analysis, competitor data, build scores, and recommendations are generated by AI and provided for informational purposes only. They do not constitute professional business, legal, or financial advice. AI-generated research may be incomplete, inaccurate, or outdated — market conditions change rapidly. We make no guarantees about the commercial viability of any idea or the accuracy of competitive intelligence. You are solely responsible for any business decisions you make based on this tool.
        </p>
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: '100vh', background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', fontFamily: 'Inter, -apple-system, sans-serif' },
  card: { background: '#fff', border: '1px solid rgba(0,0,0,0.09)', borderRadius: 24, padding: '36px 32px', maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 },
  back: { alignSelf: 'flex-start', fontSize: 13, color: '#6E6E73', textDecoration: 'none', marginBottom: 24 },
  avatar: { width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #5240C0, #1A9492)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, marginBottom: 16 },
  title: { fontFamily: 'Unbounded, sans-serif', fontSize: 20, fontWeight: 900, margin: '0 0 8px', color: '#1D1D1F', textAlign: 'center' },
  email: { fontSize: 14, color: '#6E6E73', margin: '0 0 24px' },
  sub: { fontSize: 14, color: '#6E6E73', margin: '0 0 24px', textAlign: 'center', lineHeight: 1.6 },
  section: { width: '100%', padding: '16px', background: '#FAFAFA', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 4 },
  seclabel: { fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73' },
  credval: { fontSize: 22, fontWeight: 900, fontFamily: 'Unbounded, sans-serif', color: '#1D1D1F' },
  crednote: { fontSize: 11.5, color: '#6E6E73', lineHeight: 1.5 },
  errBox: { width: '100%', padding: '10px 14px', background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 10, color: '#c0392b', fontSize: 13, margin: '0 0 16px', textAlign: 'center' },
  oauthBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 16px', background: '#fff', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#1D1D1F', cursor: 'pointer', marginBottom: 8, transition: 'all .15s' },
  divider: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0', color: '#6E6E73', fontSize: 12 },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 },
  input: { width: '100%', padding: '12px 14px', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 12, fontSize: 14, fontFamily: 'Inter, -apple-system, sans-serif', outline: 'none', boxSizing: 'border-box' },
  submitBtn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #5240C0, #1A9492)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  ghostBtn: { marginTop: 16, background: 'none', border: 'none', color: '#6E6E73', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' },
  signoutBtn: { width: '100%', padding: '11px', background: 'transparent', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#6E6E73', cursor: 'pointer' },
};

'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function ProfileClient({ user, error }) {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(error === 'auth' ? 'Sign-in link expired or invalid. Try again.' : '');
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/credits/balance')
      .then(r => r.json())
      .then(d => { setBalance(d.balance ?? 0); setTransactions(d.transactions || []); })
      .catch(() => setBalance(0));
  }, [user]);

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
    <div style={s.page}>
      <style>{`@keyframes blobdrift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.12)}}`}</style>
      <div style={s.blob1} />
      <div style={s.blob2} />

      <div style={s.center}>
        <div style={s.card}>
          <a href="/" style={s.back}>← IdeaReels</a>

          {user ? (
            <>
              <div style={s.avatar}>{user.email?.[0]?.toUpperCase() ?? '?'}</div>
              <h1 style={s.title}>Your Profile</h1>
              <p style={s.email}>{user.email}</p>

              <div style={s.section}>
                <span style={s.seclabel}>CREDITS</span>
                <span style={s.credval}>{balance === null ? '…' : balance}</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <a href="/pricing" style={{ ...s.submitBtn, textDecoration: 'none', textAlign: 'center', padding: '10px', fontSize: 13 }}>
                    Buy credits
                  </a>
                </div>
              </div>

              {transactions.length > 0 && (
                <div style={{ width: '100%', marginBottom: 20 }}>
                  <div style={s.seclabel}>RECENT ACTIVITY</div>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {transactions.map((t, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7a7191', padding: '6px 0', borderBottom: '1px solid #f3edff' }}>
                        <span style={{ textTransform: 'capitalize' }}>{t.reason}</span>
                        <span style={{ fontWeight: 700, color: t.amount > 0 ? '#16a34a' : '#7c3aed' }}>
                          {t.amount > 0 ? `+${t.amount}` : t.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={signOut} style={s.signoutBtn}>Sign out</button>
            </>
          ) : sent ? (
            <>
              <div style={{ fontSize: 36, marginBottom: 14 }}>✉️</div>
              <h1 style={s.title}>Check your email</h1>
              <p style={s.sub}>We sent a sign-in link to <strong>{email}</strong>. Click it to continue.</p>
              <button onClick={() => setSent(false)} style={s.ghostBtn}>Use a different email</button>
            </>
          ) : (
            <>
              <h1 style={s.title}>Sign in to IdeaReels</h1>
              <p style={s.sub}>Save your ideas and credits to your account.</p>
              {err && <p style={s.errBox}>{err}</p>}
              <button onClick={() => signInWithOAuth('google')} style={s.oauthBtn}>
                <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>
              <button onClick={() => signInWithOAuth('github')} style={s.oauthBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                Continue with GitHub
              </button>
              <div style={s.divider}><span>or</span></div>
              <form onSubmit={sendMagicLink} style={s.form}>
                <input type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} style={s.input}/>
                <button type="submit" disabled={loading} style={s.submitBtn}>{loading ? 'Sending…' : 'Send magic link'}</button>
              </form>
            </>
          )}
        </div>
      </div>

      <div style={s.disclaimer}>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 8 }}>
          <a href="/privacy" style={{ fontSize: 12, color: '#7a7191', textDecoration: 'none' }}>Privacy</a>
          <a href="/terms" style={{ fontSize: 12, color: '#7a7191', textDecoration: 'none' }}>Terms</a>
          <a href="/faq" style={{ fontSize: 12, color: '#7a7191', textDecoration: 'none' }}>FAQ</a>
        </div>
        <p style={s.disclaimerText}>© {new Date().getFullYear()} IdeaReels. All rights reserved.</p>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#faf7ff', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', color: '#18112b', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' },
  blob1: { position: 'fixed', width: 480, height: 480, top: '-8%', left: '-6%', borderRadius: '50%', background: '#7c3aed', filter: 'blur(70px)', opacity: .32, pointerEvents: 'none', zIndex: 0, animation: 'blobdrift 22s ease-in-out infinite' },
  blob2: { position: 'fixed', width: 420, height: 420, bottom: '-12%', right: '-6%', borderRadius: '50%', background: '#ff4d8d', filter: 'blur(70px)', opacity: .28, pointerEvents: 'none', zIndex: 0, animation: 'blobdrift 22s ease-in-out infinite', animationDelay: '-7s' },
  center: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px 24px', position: 'relative', zIndex: 1 },
  card: { background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', border: '1px solid #ece6f5', borderRadius: 24, padding: '36px 32px', maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 10px 40px -12px rgba(80,30,120,0.2)' },
  back: { alignSelf: 'flex-start', fontSize: 13, color: '#7a7191', textDecoration: 'none', marginBottom: 24 },
  avatar: { width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(120deg,#7c3aed,#c026d3,#ff4d8d)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, marginBottom: 16 },
  title: { fontFamily: '"Sora", system-ui', fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#18112b', textAlign: 'center', letterSpacing: '-0.02em' },
  email: { fontSize: 14, color: '#7a7191', margin: '0 0 24px' },
  sub: { fontSize: 14, color: '#7a7191', margin: '0 0 24px', textAlign: 'center', lineHeight: 1.6 },
  section: { width: '100%', padding: '16px', background: '#f3edff', border: '1px solid #ece6f5', borderRadius: 12, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 4 },
  seclabel: { fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7a7191' },
  credval: { fontSize: 32, fontWeight: 900, fontFamily: '"Sora", system-ui', color: '#18112b', lineHeight: 1 },
  errBox: { width: '100%', padding: '10px 14px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, color: '#dc2626', fontSize: 13, margin: '0 0 16px', textAlign: 'center' },
  oauthBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 16px', background: '#fff', border: '1.5px solid #ece6f5', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#18112b', cursor: 'pointer', marginBottom: 8 },
  divider: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0', color: '#aaa1bd', fontSize: 12 },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 },
  input: { width: '100%', padding: '12px 14px', border: '1.5px solid #ece6f5', borderRadius: 12, fontSize: 14, fontFamily: '"Plus Jakarta Sans", system-ui', outline: 'none', boxSizing: 'border-box', background: '#faf7ff' },
  submitBtn: { width: '100%', padding: '12px', background: 'linear-gradient(120deg,#7c3aed,#c026d3,#ff4d8d)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui', display: 'block' },
  ghostBtn: { marginTop: 16, background: 'none', border: 'none', color: '#7a7191', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' },
  signoutBtn: { width: '100%', padding: '11px', background: 'transparent', border: '1.5px solid #ece6f5', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#7a7191', cursor: 'pointer' },
  disclaimer: { position: 'relative', zIndex: 1, padding: '16px 24px 24px', borderTop: '1px solid #ece6f5', textAlign: 'center', maxWidth: 600, margin: '0 auto', width: '100%' },
  disclaimerText: { fontSize: 11, color: '#aaa1bd', lineHeight: 1.7, margin: 0 },
};

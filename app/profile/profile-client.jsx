'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function ProfileClient({ user, error }) {
  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ideareels.io';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(error === 'auth' ? 'Sign-in link expired or invalid. Try again.' : '');
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [blueprints, setBlueprints] = useState([]);
  const [bpLoading, setBpLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch('/api/credits/balance')
      .then(r => r.json())
      .then(d => { setBalance(d.balance ?? 0); setTransactions(d.transactions || []); })
      .catch(() => setBalance(0));

    setBpLoading(true);
    fetch('/api/blueprints')
      .then(r => r.json())
      .then(d => setBlueprints(d.blueprints || []))
      .catch(() => {})
      .finally(() => setBpLoading(false));
  }, [user]);

  const sendMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true); setErr('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });
    if (error) { setErr(error.message); setLoading(false); }
    else { setSent(true); setLoading(false); }
  };

  const signInWithOAuth = async (provider) => {
    setErr('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${siteUrl}/auth/callback` },
    });
    if (error) setErr(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    location.reload();
  };

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div style={s.page}>
      <style>{`@keyframes blobdrift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.12)}}`}</style>
      <div style={s.blob1} />
      <div style={s.blob2} />

      <div style={s.wrap}>
        <div style={s.topbar}>
          <a href="/" style={s.back}>← IdeaReels</a>
        </div>

        {user ? (
          <>
            {/* ── Header ── */}
            <div style={s.header}>
              <div>
                <h1 style={s.title}>Your Profile</h1>
                <p style={s.emailTxt}>{user.email}</p>
              </div>
              <button onClick={signOut} style={s.signoutBtn}>Sign out</button>
            </div>

            {/* ── Stats row ── */}
            <div style={s.statsRow}>
              <div style={s.statCard}>
                <div style={s.statLabel}>CREDITS</div>
                <div style={s.statVal}>{balance === null ? '…' : balance}</div>
                <a href="/pricing" style={s.buyBtn}>Buy more</a>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>BLUEPRINTS</div>
                <div style={s.statVal}>{bpLoading ? '…' : blueprints.length}</div>
                <div style={{ fontSize: 11, color: '#aaa1bd', marginTop: 4 }}>generated</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>CREDITS SPENT</div>
                <div style={s.statVal}>{bpLoading ? '…' : blueprints.length * 5}</div>
                <div style={{ fontSize: 11, color: '#aaa1bd', marginTop: 4 }}>on blueprints</div>
              </div>
            </div>

            {/* ── Blueprints history ── */}
            <div style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.seclabel}>YOUR BLUEPRINTS</span>
              </div>
              {bpLoading ? (
                <div style={s.empty}>Loading…</div>
              ) : blueprints.length === 0 ? (
                <div style={s.empty}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✦</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>No blueprints yet</div>
                  <div style={{ fontSize: 13, color: '#aaa1bd', marginBottom: 16 }}>Spin an idea and generate your first blueprint</div>
                  <a href="/" style={s.buyBtn}>Spin an idea →</a>
                </div>
              ) : (
                <div style={s.bpList}>
                  {blueprints.map((bp) => (
                    <div key={bp.id} style={s.bpCard}>
                      <div style={s.bpTop}>
                        <div style={s.bpTitle}>{bp.idea_title || bp.combo_label || 'Blueprint'}</div>
                        <div style={s.bpDate}>{fmtDate(bp.created_at)}</div>
                      </div>
                      {bp.idea_tagline && (
                        <div style={s.bpTagline}>{bp.idea_tagline}</div>
                      )}
                      <div style={s.bpTags}>
                        {[bp.reel_1, bp.reel_2, bp.reel_3].filter(Boolean).map((tag, i) => (
                          <span key={i} style={s.bpTag}>{tag}</span>
                        ))}
                        <span style={{ ...s.bpTag, background: '#f3edff', color: '#7c3aed' }}>5 credits</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Recent activity ── */}
            {transactions.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionHead}>
                  <span style={s.seclabel}>RECENT ACTIVITY</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {transactions.map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#7a7191', padding: '10px 0', borderBottom: '1px solid #f3edff' }}>
                      <span style={{ textTransform: 'capitalize' }}>{t.reason.replace(/_/g, ' ')}</span>
                      <span style={{ fontWeight: 700, color: t.amount > 0 ? '#16a34a' : '#7c3aed' }}>
                        {t.amount > 0 ? `+${t.amount}` : t.amount} credits
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : sent ? (
          <div style={s.card}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>✉️</div>
            <h1 style={s.title}>Check your email</h1>
            <p style={s.sub}>We sent a sign-in link to <strong>{email}</strong>. Click it to continue.</p>
            <button onClick={() => setSent(false)} style={s.ghostBtn}>Use a different email</button>
          </div>
        ) : (
          <div style={s.card}>
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
          </div>
        )}
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
  wrap: { flex: 1, maxWidth: 680, margin: '0 auto', width: '100%', padding: '32px 20px 40px', position: 'relative', zIndex: 1 },
  topbar: { marginBottom: 32 },
  back: { fontSize: 13, fontWeight: 600, color: '#7a7191', textDecoration: 'none', padding: '8px 16px', border: '1px solid #ece6f5', borderRadius: 999, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  title: { fontFamily: '"Sora", system-ui', fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: '#18112b', letterSpacing: '-0.02em' },
  emailTxt: { fontSize: 14, color: '#7a7191', margin: 0 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 },
  statCard: { background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', border: '1px solid #ece6f5', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  statLabel: { fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#aaa1bd', marginBottom: 4 },
  statVal: { fontSize: 28, fontWeight: 900, fontFamily: '"Sora", system-ui', color: '#18112b', lineHeight: 1, marginBottom: 4 },
  buyBtn: { fontSize: 11, fontWeight: 700, color: '#7c3aed', textDecoration: 'none', marginTop: 2 },
  section: { background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', border: '1px solid #ece6f5', borderRadius: 16, padding: '20px', marginBottom: 16 },
  sectionHead: { marginBottom: 16 },
  seclabel: { fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#aaa1bd' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px 0', color: '#7a7191', fontSize: 14 },
  bpList: { display: 'flex', flexDirection: 'column', gap: 12 },
  bpCard: { padding: '14px', background: '#faf7ff', border: '1px solid #ece6f5', borderRadius: 12 },
  bpTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  bpTitle: { fontWeight: 700, fontSize: 14, color: '#18112b', lineHeight: 1.3 },
  bpDate: { fontSize: 11, color: '#aaa1bd', flexShrink: 0 },
  bpTagline: { fontSize: 12, color: '#7a7191', marginBottom: 8, lineHeight: 1.4 },
  bpTags: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  bpTag: { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#f3edff', color: '#463a5f', textTransform: 'capitalize' },
  card: { background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', border: '1px solid #ece6f5', borderRadius: 24, padding: '36px 32px', maxWidth: 400, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 10px 40px -12px rgba(80,30,120,0.2)' },
  sub: { fontSize: 14, color: '#7a7191', margin: '0 0 24px', textAlign: 'center', lineHeight: 1.6 },
  errBox: { width: '100%', padding: '10px 14px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, color: '#dc2626', fontSize: 13, margin: '0 0 16px', textAlign: 'center' },
  oauthBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 16px', background: '#fff', border: '1.5px solid #ece6f5', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#18112b', cursor: 'pointer', marginBottom: 8 },
  divider: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0', color: '#aaa1bd', fontSize: 12 },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 },
  input: { width: '100%', padding: '12px 14px', border: '1.5px solid #ece6f5', borderRadius: 12, fontSize: 14, fontFamily: '"Plus Jakarta Sans", system-ui', outline: 'none', boxSizing: 'border-box', background: '#faf7ff' },
  submitBtn: { width: '100%', padding: '12px', background: 'linear-gradient(120deg,#7c3aed,#c026d3,#ff4d8d)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui', display: 'block' },
  ghostBtn: { marginTop: 16, background: 'none', border: 'none', color: '#7a7191', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' },
  signoutBtn: { padding: '8px 16px', background: 'transparent', border: '1.5px solid #ece6f5', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#7a7191', cursor: 'pointer', flexShrink: 0 },
  disclaimer: { position: 'relative', zIndex: 1, padding: '16px 24px 24px', borderTop: '1px solid #ece6f5', textAlign: 'center', maxWidth: 600, margin: '0 auto', width: '100%' },
  disclaimerText: { fontSize: 11, color: '#aaa1bd', lineHeight: 1.7, margin: 0 },
};

'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';
import ZubazShell from '@/components/zubaz/ZubazShell';

export default function ProfileClient({ user, error }) {
  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ideareels.io';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(error === 'auth' ? 'Sign-in link expired or invalid. Try again.' : '');
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [ideasLoading, setIdeasLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch('/api/credits/balance')
      .then(r => r.json())
      .then(d => { setBalance(d.balance ?? 0); setTransactions(d.transactions || []); })
      .catch(() => setBalance(0));

    setIdeasLoading(true);
    fetch('/api/ideas')
      .then(r => r.json())
      .then(d => setIdeas(d.ideas || []))
      .catch(() => {})
      .finally(() => setIdeasLoading(false));
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

  const blueprintCount = ideas.filter((i) => i.blueprint_status === 'complete').length;
  const creditsSpent = ideas.reduce((sum, i) => sum + Number(i.credits_spent || 0), 0);
  const demandTone = (level = '') => /strong/i.test(level) ? '#15803D' : /weak/i.test(level) ? '#B91C1C' : '#B45309';

  return (
    <ZubazShell>
      <div className="section zubuz-section-padding3">
        <div className="container">
        <div style={s.wrap}>

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
                <div style={s.statLabel}>IDEAS</div>
                <div style={s.statVal}>{ideasLoading ? '…' : ideas.length}</div>
                <div style={s.statMeta}>researched</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>BLUEPRINTS</div>
                <div style={s.statVal}>{ideasLoading ? '…' : blueprintCount}</div>
                <div style={s.statMeta}>generated</div>
              </div>
            </div>

            {/* ── Saved ideas (those that reached paid extended research) ── */}
            <div style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.seclabel}>YOUR IDEAS</span>
              </div>
              {ideasLoading ? (
                <div style={s.empty}>Loading…</div>
              ) : ideas.length === 0 ? (
                <div style={s.empty}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✦</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>No saved ideas yet</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Spin the wheel, save a promising idea, and it will show up here.</div>
                  <a href="/?wheel=1" style={s.buyBtn}>Try the wheel →</a>
                </div>
              ) : (
                <div style={s.bpList}>
                  {ideas.map((idea) => {
                    const research = idea.research || {};
                    const signals = (research.demandSignals || []).slice(0, 2);
                    const hasBlueprint = idea.blueprint_status === 'complete';
                    const blueprintInProgress = idea.blueprint_status === 'generating';
                    return (
                      <div key={idea.id} style={s.ideaCard}>
                        <div style={s.bpTop}>
                          <div style={s.bpTitle}>{idea.title || idea.tagline || 'Idea'}</div>
                          <div style={s.bpDate}>{fmtDate(idea.created_at)}</div>
                        </div>

                        {/* Extended research outcome */}
                        <div style={s.ideaResearch}>
                          <div style={s.ideaResearchHead}>
                            <span style={s.seclabelSm}>Extended research</span>
                            {research.demandLevel && (
                              <span style={{ ...s.demandTag, color: demandTone(research.demandLevel) }}>
                                {research.demandLevel} demand
                              </span>
                            )}
                          </div>
                          {(research.plainSummary || idea.summary) && (
                            <p style={s.ideaSummary}>{research.plainSummary || idea.summary}</p>
                          )}
                          {signals.length > 0 && (
                            <ul style={s.ideaSignals}>
                              {signals.map((sig, i) => <li key={i}>{sig}</li>)}
                            </ul>
                          )}
                        </div>

                        {/* Blueprint: ready → view, in progress → resume, else → create */}
                        {hasBlueprint ? (
                          <div style={s.bpReadyRow}>
                            <span style={s.bpReadyTag}>✦ Blueprint ready</span>
                            <a href={`/?idea=${idea.id}&view=1`} style={s.viewBtn}>View blueprint</a>
                          </div>
                        ) : blueprintInProgress ? (
                          <div style={s.bpReadyRow}>
                            <span style={s.bpProgressTag}>⏳ Blueprint in progress</span>
                            <a href={`/?idea=${idea.id}`} style={s.createBtn}>Resume blueprint</a>
                          </div>
                        ) : (
                          <div style={s.bpReadyRow}>
                            <span style={s.bpPendingTag}>No blueprint yet</span>
                            <a href={`/?idea=${idea.id}`} style={s.createBtn}>Create blueprint · 2 credits</a>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--ink-2)', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                      <span style={{ textTransform: 'capitalize' }}>{t.reason.replace(/_/g, ' ')}</span>
                      <span style={{ fontWeight: 700, color: t.amount > 0 ? '#15803D' : 'var(--accent)' }}>
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
            <p style={s.sub}>We sent a sign-in link to <strong>{email}</strong>. Your free credits will be waiting when you get back.</p>
            <button onClick={() => setSent(false)} style={s.ghostBtn}>Use a different email</button>
          </div>
        ) : (
          <div style={s.card}>
            <h1 style={s.title}>Sign in and claim your 3 free credits</h1>
            <p style={s.sub}>Save your ideas, keep your research, and buy more credits only when a spin feels worth chasing.</p>
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
            <p style={s.reassure}>No password to remember. We only use your email for sign-in links, receipts, and keeping your work attached to your account.</p>
          </div>
        )}
        </div>
        </div>
      </div>
    </ZubazShell>
  );
}

const glassSoft = 'rgba(255,255,255,0.36)';
const glassStrong = 'rgba(255,255,255,0.5)';
const softLine = 'rgba(236,230,245,0.92)';

const s = {
  wrap: { maxWidth: 760, margin: '0 auto', width: '100%' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  title: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, margin: '0 0 6px', color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1.05 },
  emailTxt: { fontSize: 14, color: 'var(--muted)', margin: 0 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 },
  statCard: { background: glassSoft, backdropFilter: 'blur(14px)', border: `1px solid ${softLine}`, borderRadius: 18, padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxShadow: '0 16px 34px -30px rgba(124,58,237,0.24)' },
  statLabel: { fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 },
  statVal: { fontSize: 30, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--ink)', lineHeight: 1, marginBottom: 4 },
  statMeta: { fontSize: 11, color: 'var(--muted)', marginTop: 4 },
  buyBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 34, padding: '0 12px', fontSize: 12, fontWeight: 700, color: '#fff', textDecoration: 'none', marginTop: 6, borderRadius: 999, background: 'var(--accent)' },
  section: { background: glassSoft, backdropFilter: 'blur(14px)', border: `1px solid ${softLine}`, borderRadius: 20, padding: '22px', marginBottom: 16, boxShadow: '0 18px 36px -30px rgba(124,58,237,0.22)' },
  sectionHead: { marginBottom: 16 },
  seclabel: { fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '28px 0', color: 'var(--muted)', fontSize: 14 },
  bpList: { display: 'flex', flexDirection: 'column', gap: 12 },
  bpCard: { padding: '16px', background: 'rgba(255,255,255,0.26)', border: `1px solid ${softLine}`, borderRadius: 18, backdropFilter: 'blur(10px)' },
  bpTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  bpTitle: { fontWeight: 700, fontSize: 14, color: 'var(--ink)', lineHeight: 1.35 },
  bpDate: { fontSize: 11, color: 'var(--muted)', flexShrink: 0 },
  bpTagline: { fontSize: 13, color: 'var(--ink-2)', marginBottom: 10, lineHeight: 1.5 },
  bpTags: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  bpTag: { fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 999, background: 'var(--accent-light)', color: 'var(--ink-2)', textTransform: 'capitalize' },
  ideaCard: { padding: '16px', background: 'rgba(255,255,255,0.26)', border: `1px solid ${softLine}`, borderRadius: 18, backdropFilter: 'blur(10px)' },
  ideaResearch: { marginTop: 4, padding: '12px', background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.14)', borderRadius: 12 },
  ideaResearchHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  seclabelSm: { fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)' },
  demandTag: { fontSize: 11, fontWeight: 800, textTransform: 'capitalize' },
  ideaSummary: { margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--ink)' },
  ideaSignals: { margin: '8px 0 0', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 },
  bpReadyRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 12 },
  bpReadyTag: { fontSize: 12, fontWeight: 700, color: '#15803D' },
  bpProgressTag: { fontSize: 12, fontWeight: 700, color: 'var(--accent)' },
  bpPendingTag: { fontSize: 12, fontWeight: 600, color: 'var(--muted)' },
  viewBtn: { display: 'inline-flex', alignItems: 'center', minHeight: 34, padding: '0 14px', fontSize: 12, fontWeight: 700, color: 'var(--ink)', textDecoration: 'none', borderRadius: 999, background: glassStrong, border: `1px solid ${softLine}` },
  createBtn: { display: 'inline-flex', alignItems: 'center', minHeight: 34, padding: '0 14px', fontSize: 12, fontWeight: 700, color: '#fff', textDecoration: 'none', borderRadius: 999, background: 'var(--accent)' },
  card: { background: glassSoft, backdropFilter: 'blur(16px)', border: `1px solid ${softLine}`, borderRadius: 24, padding: '32px 28px', maxWidth: 440, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 22px 42px -30px rgba(124,58,237,0.26)' },
  sub: { fontSize: 14, color: 'var(--muted)', margin: '0 0 24px', textAlign: 'center', lineHeight: 1.6, maxWidth: 320 },
  errBox: { width: '100%', padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 12, color: '#B91C1C', fontSize: 13, margin: '0 0 16px', textAlign: 'center' },
  oauthBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 16px', background: glassStrong, border: `1px solid ${softLine}`, borderRadius: 999, fontSize: 14, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', marginBottom: 8, backdropFilter: 'blur(10px)' },
  divider: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0', color: 'var(--muted)', fontSize: 12 },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 },
  input: { width: '100%', minHeight: 46, padding: '12px 14px', border: `1px solid ${softLine}`, borderRadius: 999, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box', background: 'rgba(255,255,255,0.46)', color: 'var(--ink)', backdropFilter: 'blur(10px)' },
  submitBtn: { width: '100%', minHeight: 46, padding: '12px', background: 'var(--grad-brand)', color: '#fff', border: '1px solid transparent', borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'block', boxShadow: '0 12px 24px -18px rgba(192,38,211,0.5)' },
  reassure: { margin: '12px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--muted)', textAlign: 'center', maxWidth: 320 },
  ghostBtn: { marginTop: 16, background: 'none', border: 'none', color: 'var(--ink-2)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' },
  signoutBtn: { padding: '10px 16px', background: glassStrong, backdropFilter: 'blur(8px)', border: `1px solid ${softLine}`, borderRadius: 999, fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer', flexShrink: 0 },
};

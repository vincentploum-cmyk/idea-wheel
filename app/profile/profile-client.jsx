'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
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

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const blueprintCount = ideas.filter(i => i.blueprint_status === 'complete').length;
  const demandTone = (level = '') => /strong/i.test(level) ? '#15803D' : /weak/i.test(level) ? '#B91C1C' : '#B45309';

  if (!user) {
    return (
      <div className="popito_fn_account_page">
        <div className="container">
          <div className="fn__account_details fn__bold_item">
            <div className="details_item">
              {sent ? (
                <>
                  <div className="details_subtitle"><h3 className="title">Check your email</h3></div>
                  <div className="details_content">
                    <div className="details_left">
                      <p>We sent a sign-in link to <strong>{email}</strong>.</p>
                      <button onClick={() => setSent(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 12 }}>
                        Use a different email
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="details_subtitle"><h3 className="title">Sign in to IdeaReels</h3></div>
                  <div className="details_content">
                    <div className="details_left" style={{ maxWidth: 400 }}>
                      {err && <p style={{ color: '#c00', marginBottom: 16, fontSize: 14 }}>{err}</p>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                        <button onClick={() => signInWithOAuth('google')} className="fn__btn medium" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                          <span>Continue with Google</span>
                        </button>
                        <button onClick={() => signInWithOAuth('github')} className="fn__btn medium" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                          <span>Continue with GitHub</span>
                        </button>
                      </div>
                      <form onSubmit={sendMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input type="email" required placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '12px 16px', border: '1px solid #e5e5e5', borderRadius: 6, fontSize: 14 }} />
                        <button type="submit" className="fn__btn" disabled={loading} style={{ display: 'flex', justifyContent: 'center' }}>
                          <span>{loading ? 'Sending…' : 'Send magic link'}</span>
                        </button>
                      </form>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="popito_fn_account_page">
      <div className="container">

        {/* Account Details */}
        <div className="fn__account_details fn__bold_item">
          <div className="details_item">
            <div className="details_subtitle">
              <h3 className="title">Account Details</h3>
            </div>
            <div className="details_content">
              <div className="details_left">
                <ul>
                  <li>
                    <p className="label">Email address</p>
                    <p className="value">{user.email}</p>
                  </li>
                  <li>
                    <p className="label">Credits remaining</p>
                    <p className="value">{balance === null ? '…' : balance}</p>
                  </li>
                  <li>
                    <p className="label">Ideas researched</p>
                    <p className="value">{ideasLoading ? '…' : ideas.length}</p>
                  </li>
                  <li>
                    <p className="label">Blueprints generated</p>
                    <p className="value">{ideasLoading ? '…' : blueprintCount}</p>
                  </li>
                </ul>
              </div>
              <div className="details_right">
                <button onClick={signOut} className="fn__btn"><span>Sign Out</span></button>
              </div>
            </div>
            <div className="details_footer">
              <ul>
                <li><Link href="/pricing" className="fn__creative_link">Buy Credits<span className="suffix">//</span></Link></li>
                <li><Link href="/wheel" className="fn__creative_link">Spin an Idea<span className="suffix">//</span></Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Saved Ideas */}
        {(ideas.length > 0 || ideasLoading) && (
          <div className="fn__account_details fn__bold_item" style={{ marginTop: 32 }}>
            <div className="details_item">
              <div className="details_subtitle">
                <h3 className="title">Your Ideas</h3>
              </div>
              {ideasLoading ? (
                <p style={{ opacity: 0.5, padding: '20px 0' }}>Loading…</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
                  {ideas.map((idea) => {
                    const research = idea.research || {};
                    const signals = (research.demandSignals || []).slice(0, 2);
                    const hasBlueprint = idea.blueprint_status === 'complete';
                    const blueprintInProgress = idea.blueprint_status === 'generating';
                    return (
                      <div key={idea.id} style={{ padding: '20px', border: '1px solid #e8e8e8', borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                          <h4 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 15, margin: 0 }}>
                            {idea.title || idea.tagline || 'Idea'}
                          </h4>
                          <span style={{ fontSize: 12, opacity: 0.5, flexShrink: 0 }}>{fmtDate(idea.created_at)}</span>
                        </div>

                        {research.demandLevel && (
                          <p style={{ fontSize: 12, fontWeight: 700, color: demandTone(research.demandLevel), marginBottom: 6 }}>
                            {research.demandLevel} demand
                          </p>
                        )}
                        {(research.plainSummary || idea.summary) && (
                          <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.55, marginBottom: 8 }}>
                            {research.plainSummary || idea.summary}
                          </p>
                        )}
                        {signals.length > 0 && (
                          <ul style={{ paddingLeft: 16, margin: '0 0 12px', fontSize: 13, opacity: 0.65 }}>
                            {signals.map((sig, i) => <li key={i}>{sig}</li>)}
                          </ul>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          {hasBlueprint ? (
                            <>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>✦ Blueprint ready</span>
                              <a href={`/?idea=${idea.id}&view=1`} className="fn__btn medium"><span>View blueprint</span></a>
                            </>
                          ) : blueprintInProgress ? (
                            <>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>⏳ Blueprint in progress</span>
                              <a href={`/?idea=${idea.id}`} className="fn__btn medium"><span>Resume</span></a>
                            </>
                          ) : (
                            <>
                              <span style={{ fontSize: 12, opacity: 0.5 }}>No blueprint yet</span>
                              <a href={`/?idea=${idea.id}`} className="fn__btn medium"><span>Create blueprint · 2 credits</span></a>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {transactions.length > 0 && (
          <div className="fn__account_details fn__bold_item" style={{ marginTop: 32 }}>
            <div className="details_item">
              <div className="details_subtitle">
                <h3 className="title">Recent Activity</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {transactions.map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ textTransform: 'capitalize', opacity: 0.7 }}>{t.reason.replace(/_/g, ' ')}</span>
                    <span style={{ fontWeight: 700, color: t.amount > 0 ? '#15803D' : '#c00' }}>
                      {t.amount > 0 ? `+${t.amount}` : t.amount} credits
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

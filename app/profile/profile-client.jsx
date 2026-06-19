'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

const SCORE_COLOR = (s) => s >= 80 ? '#15803D' : s >= 61 ? '#B45309' : '#B91C1C';

function StatusBadge({ idea }) {
  if (idea.blueprint_status === 'complete') {
    return <span style={{ fontSize: 11, fontWeight: 700, color: '#15803D', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 7px' }}>Blueprint ready</span>;
  }
  if (idea.blueprint_status === 'generating') {
    return <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 4, padding: '2px 7px' }}>Blueprint in progress</span>;
  }
  if (idea.research && Object.keys(idea.research).length > 0) {
    return <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 7px' }}>Research done</span>;
  }
  return <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 7px' }}>Validated</span>;
}

function IdeaCard({ idea, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const research = idea.research || {};
  const hasResearch = research && Object.keys(research).length > 0;
  const hasBlueprint = idea.blueprint_status === 'complete';
  const blueprintInProgress = idea.blueprint_status === 'generating';

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await fetch(`/api/ideas/${idea.id}`, { method: 'DELETE' });
      onDelete(idea.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div style={{ border: '2px solid #111', borderRadius: 10, padding: '20px 24px', background: '#fff', boxShadow: '3px 3px 0 #111', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <StatusBadge idea={idea} />
            {idea.score != null && (
              <span style={{ fontSize: 11, fontWeight: 700, color: SCORE_COLOR(idea.score), background: '#fff', border: `1px solid ${SCORE_COLOR(idea.score)}`, borderRadius: 4, padding: '2px 7px' }}>
                Score {idea.score}
              </span>
            )}
          </div>
          <h4 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15, margin: 0, lineHeight: 1.3 }}>
            {idea.title || 'Untitled idea'}
          </h4>
          {(idea.action || idea.workflow || idea.industry) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {[idea.action, idea.workflow, idea.industry].filter(Boolean).map((t, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: '#FFE000', color: '#111',
                  border: '2px solid #111', borderRadius: '6px 999px 999px 6px',
                  padding: '3px 12px 3px 8px',
                  fontFamily: 'Nunito, sans-serif', fontWeight: 900,
                  fontSize: 11, letterSpacing: '0.02em',
                  boxShadow: '2px 2px 0 #111', whiteSpace: 'nowrap',
                }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, opacity: 0.4, flexShrink: 0, paddingTop: 2 }}>{fmtDate(idea.created_at)}</span>
      </div>

      {/* Summary */}
      {(research.plainSummary || idea.summary) && (
        <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.6, margin: 0 }}>
          {research.plainSummary || idea.summary}
        </p>
      )}

      {/* Demand signal */}
      {research.demandLevel && (
        <p style={{ fontSize: 12, fontWeight: 700, margin: 0, color: /strong/i.test(research.demandLevel) ? '#15803D' : /weak/i.test(research.demandLevel) ? '#B91C1C' : '#B45309' }}>
          {research.demandLevel} demand
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4, borderTop: '1px solid #f0f0f0', marginTop: 4 }}>
        {hasBlueprint ? (
          <a href={`/wheel?idea=${idea.id}&view=1`} className="fn__btn medium" style={{ fontSize: 13 }}><span>View blueprint</span></a>
        ) : blueprintInProgress ? (
          <a href={`/wheel?idea=${idea.id}`} className="fn__btn medium" style={{ fontSize: 13 }}><span>Resume blueprint</span></a>
        ) : (
          <>
            {!hasResearch && (
              <a href={`/wheel?idea=${idea.id}`} className="fn__btn medium" style={{ fontSize: 13 }}><span>Deep research · 1 credit</span></a>
            )}
            <a href={`/wheel?idea=${idea.id}&generate=1`} style={{ fontSize: 12, color: '#111', textDecoration: 'underline', textUnderlineOffset: 3, opacity: 0.6 }}>
              {hasResearch ? 'Build blueprint · 2 credits' : 'Skip to blueprint · 2 credits'}
            </a>
          </>
        )}

        <div style={{ marginLeft: 'auto' }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, opacity: 0.6 }}>Delete this idea?</span>
              <button onClick={handleDelete} disabled={deleting} style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', textDecoration: 'underline' }}>
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, padding: '2px 4px' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={handleDelete} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.35, padding: '2px 4px' }} title="Delete idea">
              ✕ Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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

  const handleDelete = (id) => setIdeas(prev => prev.filter(i => i.id !== id));

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const blueprintCount = ideas.filter(i => i.blueprint_status === 'complete').length;

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
                    <p className="label">Credits remaining</p>
                    <p className="value">{balance === null ? '…' : balance}</p>
                  </li>
                  <li>
                    <p className="label">Ideas saved</p>
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
                <li><Link href="/wheel" className="fn__creative_link">Generate an Idea<span className="suffix">//</span></Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Saved Ideas */}
        <div className="fn__account_details fn__bold_item" style={{ marginTop: 32 }}>
          <div className="details_item">
            <div className="details_subtitle">
              <h3 className="title">Your Ideas</h3>
            </div>
            {ideasLoading ? (
              <p style={{ opacity: 0.5, padding: '20px 0' }}>Loading…</p>
            ) : ideas.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <p style={{ opacity: 0.5, fontSize: 14, marginBottom: 16 }}>No ideas saved yet. Generate one and save it to your profile.</p>
                <Link href="/wheel" className="fn__btn medium"><span>Generate an idea</span></Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>
                {ideas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        </div>

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

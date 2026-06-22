'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient as createBrowserClient } from '@/lib/supabase-browser';

const inputStyle = {
  width: '100%',
  border: '2.5px solid #111',
  borderRadius: 4,
  padding: '11px 14px',
  fontFamily: 'Nunito, sans-serif',
  fontWeight: 700,
  fontSize: 14,
  color: '#111',
  background: '#fff',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontFamily: 'Nunito, sans-serif',
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 6,
  color: '#111',
};

export default function ReviewForm() {
  const [form, setForm] = useState({ name: '', role: '', quote: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [creditsGranted, setCreditsGranted] = useState(0);
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    const sb = createBrowserClient();
    sb.auth.getSession().then(({ data }) => setSession(data.session ?? null));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.quote.trim().length < 20) return;
    setStatus('sending');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        setCreditsGranted(data.creditsGranted ?? 0);
        setStatus('sent');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="fn__bold_item" style={{ padding: '32px 28px', textAlign: 'center', maxWidth: 540, margin: '0 auto' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
        <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 20, marginBottom: 8 }}>
          Review received — thank you!
        </h3>
        {creditsGranted > 0 && (
          <p style={{
            display: 'inline-block',
            background: '#FFE000', border: '2px solid #111', borderRadius: 4,
            padding: '4px 14px', fontFamily: 'Nunito, sans-serif', fontWeight: 900,
            fontSize: 14, color: '#111', margin: '0 0 12px',
          }}>
            +{creditsGranted} credits added to your account
          </p>
        )}
        <p style={{ opacity: 0.65, fontSize: 14, margin: creditsGranted > 0 ? '12px 0 0' : 0 }}>
          We review every submission before publishing.
        </p>
      </div>
    );
  }

  // Not-yet-loaded state — render nothing to avoid layout shift
  if (session === undefined) return null;

  // Unauthenticated — gate with sign-in prompt
  if (session === null) {
    return (
      <div className="fn__bold_item" style={{ padding: '32px 28px', textAlign: 'center', maxWidth: 540, margin: '0 auto' }}>
        <div style={{
          display: 'inline-block',
          background: '#FFE000', border: '2px solid #111', borderRadius: 4,
          padding: '4px 14px', fontFamily: 'Nunito, sans-serif', fontWeight: 900,
          fontSize: 13, color: '#111', marginBottom: 14,
        }}>
          +3 credits for leaving a review
        </div>
        <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 20, marginBottom: 8 }}>
          Sign in to leave a review
        </h3>
        <p style={{ opacity: 0.65, fontSize: 14, marginBottom: 20 }}>
          Share your experience and earn 3 free credits — enough to run a full deep research spin.
        </p>
        <Link href="/auth/login" className="fn__btn"><span>Sign in →</span></Link>
      </div>
    );
  }

  return (
    <form className="fn__bold_item" style={{ padding: '32px 28px', maxWidth: 540, margin: '0 auto' }} onSubmit={handleSubmit}>
      <div style={{
        display: 'inline-block',
        background: '#FFE000', border: '2px solid #111', borderRadius: 4,
        padding: '4px 14px', fontFamily: 'Nunito, sans-serif', fontWeight: 900,
        fontSize: 13, color: '#111', marginBottom: 14,
      }}>
        +3 credits for leaving a review
      </div>
      <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 20, marginBottom: 4 }}>
        Leave a review
      </h3>
      <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 20 }}>
        Used IdeaReels? Tell future founders what it was like.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="review-name">First name</label>
          <input
            id="review-name"
            type="text"
            required
            placeholder="Alex…"
            name="name"
            autoComplete="name"
            maxLength={80}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="review-role">Role (optional)</label>
          <input
            id="review-role"
            type="text"
            placeholder="Solo founder…"
            name="role"
            autoComplete="organization-title"
            maxLength={80}
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle} htmlFor="review-quote">Your experience</label>
        <textarea
          id="review-quote"
          required
          rows={4}
          minLength={20}
          maxLength={800}
          name="review"
          placeholder="What did IdeaReels help you figure out? What did you build?"
          value={form.quote}
          onChange={e => setForm(f => ({ ...f, quote: e.target.value }))}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
        />
        <p style={{ fontSize: 12, opacity: 0.45, margin: '4px 0 0', fontFamily: 'Nunito, sans-serif' }}>
          {form.quote.length}/800 · min 20 characters
        </p>
      </div>

      <div aria-live="polite">
        {status === 'error' && (
          <p style={{ color: '#B91C1C', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
            Something went wrong. Try again.
          </p>
        )}
      </div>

      <button
        type="submit"
        className="fn__btn"
        disabled={status === 'sending' || form.quote.trim().length < 20}
        style={{ opacity: (status === 'sending' || form.quote.trim().length < 20) ? 0.5 : 1 }}
      >
        <span>{status === 'sending' ? 'Submitting…' : 'Submit review →'}</span>
      </button>
    </form>
  );
}

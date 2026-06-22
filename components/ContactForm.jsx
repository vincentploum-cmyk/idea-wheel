'use client';
import { useState } from 'react';
import Link from 'next/link';

const inputStyle = {
  width: '100%',
  border: '2.5px solid #111',
  borderRadius: 4,
  padding: '12px 14px',
  fontFamily: 'Nunito, sans-serif',
  fontWeight: 700,
  fontSize: 15,
  color: '#111',
  background: '#fff',
  boxSizing: 'border-box',
  transition: 'box-shadow 0.12s',
};

const labelStyle = {
  display: 'block',
  fontFamily: 'Nunito, sans-serif',
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: 6,
  color: '#111',
};

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle');

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="fn__bold_item" style={{ padding: '48px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 24, marginBottom: 10 }}>Message received</h2>
        <p style={{ opacity: 0.65, fontSize: 15, lineHeight: 1.65, marginBottom: 24 }}>We'll get back to you within 1–2 business days.</p>
        <Link href="/" className="fn__btn"><span>Back to home</span></Link>
      </div>
    );
  }

  return (
    <form className="fn__bold_item" style={{ padding: '40px 36px' }} onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gap: 20 }}>
        <div>
          <label style={labelStyle} htmlFor="contact-name">Your name</label>
          <input
            id="contact-name"
            type="text"
            required
            placeholder="Alex…"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="contact-email">Email address</label>
          <input
            id="contact-email"
            type="email"
            required
            placeholder="alex@example.com…"
            name="email"
            autoComplete="email"
            spellCheck={false}
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="contact-message">Message</label>
          <textarea
            id="contact-message"
            required
            rows={6}
            placeholder="What’s on your mind…"
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
          />
        </div>
        <div aria-live="polite">
          {status === 'error' && (
            <p style={{ color: '#B91C1C', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, margin: 0 }}>
              Something went wrong. Try again or email us at <a href="mailto:hello@ideareels.io" style={{ color: '#B91C1C' }}>hello@ideareels.io</a>
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={status === 'sending'}
          className="fn__btn"
          style={{ alignSelf: 'flex-start', opacity: status === 'sending' ? 0.6 : 1, cursor: status === 'sending' ? 'not-allowed' : 'pointer' }}
        >
          <span>{status === 'sending' ? 'Sending…' : 'Send message →'}</span>
        </button>
      </div>
    </form>
  );
}

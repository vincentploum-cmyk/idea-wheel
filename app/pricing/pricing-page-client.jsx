"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CREDIT_PACKAGES, CREDIT_PACKAGE_BY_KEY } from '../../lib/pricing';

const shell = {
  minHeight: '100vh',
  background: '#0d0d10',
  color: '#f5f7fb',
  padding: '48px 20px 80px',
  fontFamily: 'system-ui, sans-serif',
};

const card = {
  background: '#15171d',
  border: '1px solid #2a2d37',
  borderRadius: 18,
  padding: 22,
};

export default function PricingPageClient({ searchParams }) {
  const [loadingKey, setLoadingKey] = useState(null);
  const [error, setError] = useState('');
  const success = searchParams?.success === '1';
  const canceled = searchParams?.canceled === '1';
  const packageKey = searchParams?.package || '';
  const sessionId = searchParams?.session_id || '';
  const packageConfig = CREDIT_PACKAGE_BY_KEY[packageKey] || null;

  useEffect(() => {
    if (!success || !packageConfig || !sessionId) return;
    try {
      const grantKey = `ideaWheelStripeGrant:${sessionId}`;
      if (window.localStorage.getItem(grantKey)) return;
      const existing = Number(window.localStorage.getItem('ideaWheelCredits') || '3');
      const base = Number.isFinite(existing) ? existing : 3;
      window.localStorage.setItem('ideaWheelCredits', String(base + packageConfig.credits));
      window.localStorage.setItem(grantKey, '1');
    } catch {}
  }, [success, packageConfig, sessionId]);

  const statusMessage = useMemo(() => {
    if (success && packageConfig) {
      return {
        tone: '#8de1d2',
        bg: 'rgba(141,225,210,0.08)',
        border: 'rgba(141,225,210,0.24)',
        title: `${packageConfig.credits} credits added`,
        text: 'Credits were applied to this browser so you can keep going immediately.',
      };
    }
    if (canceled) {
      return {
        tone: '#f4be4f',
        bg: 'rgba(244,190,79,0.08)',
        border: 'rgba(244,190,79,0.24)',
        title: 'Checkout canceled',
        text: 'Nothing was charged. Pick up where you left off whenever you want.',
      };
    }
    return null;
  }, [success, canceled, packageConfig]);

  async function startCheckout(pkg) {
    setLoadingKey(pkg.key);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageKey: pkg.key }),
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.url) {
        throw new Error(data.error || 'Unable to start checkout');
      }
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message || 'Unable to start checkout');
      setLoadingKey(null);
    }
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: '#8de1d2', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>IdeaWheel</p>
            <h1 style={{ fontSize: 'clamp(36px, 6vw, 68px)', lineHeight: 1, margin: 0 }}>Buy Blueprint credits</h1>
            <p style={{ maxWidth: 720, color: '#b7bcc8', fontSize: 18, lineHeight: 1.6, marginTop: 16 }}>
              One credit unlocks the full pipeline, market scout, skeptic, judge, product design, GTM, infrastructure, and live prototype.
            </p>
          </div>
          <Link href="/" style={{ color: '#f5f7fb', textDecoration: 'none', border: '1px solid #2a2d37', borderRadius: 999, padding: '10px 16px', alignSelf: 'center' }}>
            Back to app
          </Link>
        </div>

        {statusMessage ? (
          <section style={{ ...card, marginTop: 24, background: statusMessage.bg, borderColor: statusMessage.border }}>
            <strong style={{ display: 'block', color: statusMessage.tone, fontSize: 18 }}>{statusMessage.title}</strong>
            <p style={{ margin: '8px 0 0', color: '#d5dae4', lineHeight: 1.6 }}>{statusMessage.text}</p>
          </section>
        ) : null}

        {error ? (
          <section style={{ ...card, marginTop: 24, background: 'rgba(255,107,107,0.08)', borderColor: 'rgba(255,107,107,0.24)' }}>
            <strong style={{ display: 'block', color: '#ff8f8f', fontSize: 17 }}>Checkout isn’t configured yet</strong>
            <p style={{ margin: '8px 0 0', color: '#d5dae4', lineHeight: 1.6 }}>{error}</p>
          </section>
        ) : null}

        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 32 }}>
          {CREDIT_PACKAGES.map((pkg) => (
            <section
              key={pkg.key}
              style={{
                ...card,
                background: pkg.highlight ? 'linear-gradient(180deg, #1f2330 0%, #15171d 100%)' : '#15171d',
                border: pkg.highlight ? '1.5px solid #f4be4f' : '1px solid #2a2d37',
                boxShadow: pkg.highlight ? '0 20px 60px rgba(244,190,79,0.12)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <strong style={{ fontSize: 20 }}>{pkg.label}</strong>
                {pkg.highlight ? <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#f4be4f' }}>Most popular</span> : null}
              </div>
              <div style={{ marginTop: 20, fontSize: 40, fontWeight: 700 }}>{pkg.price}</div>
              <div style={{ color: '#b7bcc8', marginTop: 4 }}>{pkg.credits} credits</div>
              <div style={{ color: '#8de1d2', marginTop: 10 }}>{pkg.per} / credit</div>
              <p style={{ color: '#9ca3af', lineHeight: 1.6, marginTop: 18, minHeight: 72 }}>
                {pkg.highlight
                  ? 'Best for founders actively validating and refining multiple wedges in one sitting.'
                  : pkg.key === 'starter'
                    ? 'Good for a first pass when you want a few serious concepts instead of vague ideation.'
                    : pkg.key === 'studio'
                      ? 'For teams or operators who want enough credits for repeated exploration and iteration.'
                      : 'For agencies, venture studios, or heavy internal use with room for many full blueprint runs.'}
              </p>
              <button
                onClick={() => startCheckout(pkg)}
                disabled={loadingKey !== null}
                style={{
                  marginTop: 24,
                  width: '100%',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px 16px',
                  background: pkg.highlight ? '#f4be4f' : '#7c72ff',
                  color: pkg.highlight ? '#1b1305' : '#fff',
                  fontWeight: 700,
                  cursor: loadingKey !== null ? 'wait' : 'pointer',
                  opacity: loadingKey && loadingKey !== pkg.key ? 0.55 : 1,
                }}
              >
                {loadingKey === pkg.key ? 'Redirecting…' : 'Checkout'}
              </button>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

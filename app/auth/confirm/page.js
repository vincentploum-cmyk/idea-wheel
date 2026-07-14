'use client';

import { useEffect, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';

// Outlook/Hotmail (and some other mail providers) automatically "visit" links
// inside incoming emails to scan them for phishing/malware before the user
// ever clicks. Our magic-link code is single-use, so that automated visit
// burns it — the real click then fails with "expired or invalid".
// This page requires an actual user click (a real <a> navigation) before the
// code is redeemed at /auth/callback, so scanner pre-fetches of THIS page
// can't consume the code.
export default function ConfirmSignInPage() {
  const [href, setHref] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const next = params.get('next') || '';
    if (!code) { setHref('/auth/login'); return; }
    const qs = new URLSearchParams({ code });
    if (next) qs.set('next', next);
    setHref(`/auth/callback?${qs.toString()}`);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '32px 16px', gap: 20,
    }}>
      <BrandLogo size={30} />
      <div style={{
        width: 72, height: 72,
        background: '#FFE000',
        border: '3px solid #111',
        borderRadius: 16,
        boxShadow: '4px 4px 0 #111',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <h1 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(24px,5vw,32px)', letterSpacing: '-0.02em', color: '#111', margin: 0, lineHeight: 1.1 }}>
        Confirm it&apos;s you
      </h1>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: 15, color: '#444', lineHeight: 1.65, margin: 0, maxWidth: 340 }}>
        For your security, click below to finish signing in. (Some email providers scan links automatically, so we need one real click from you.)
      </p>
      <a
        href={href || '#'}
        aria-disabled={!href}
        className="fn__main_button"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', minWidth: 220, opacity: href ? 1 : 0.6, pointerEvents: href ? 'auto' : 'none' }}
      >
        Continue to IdeaReels →
      </a>
    </div>
  );
}

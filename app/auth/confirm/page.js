'use client';

import { useEffect, useState } from 'react';
import SiteHeader from '@/components/nhl/SiteHeader';

// Mail providers (Outlook/Hotmail especially) prefetch links to scan them,
// which would burn the single-use magic-link code. This page needs one real
// click before the code is redeemed at /auth/callback.
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
    <>
      <SiteHeader />
      <main className="nhlx-center nhlx-glow">
        <div className="nhlx-panel">
          <span className="nhlx-eyebrow">One more click</span>
          <h1 style={{ marginTop: 14 }}>Confirm it&apos;s you</h1>
          <p>Some email providers scan links automatically, so the model needs one real click to finish signing you in.</p>
          <a href={href || '#'} className="nhlx-btn" style={{ marginTop: 26, width: '100%' }} aria-disabled={!href}>
            Finish signing in
          </a>
        </div>
      </main>
    </>
  );
}

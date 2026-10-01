'use client';

import SiteHeader from '@/components/nhl/SiteHeader';
import { useLocationSearch } from '@/lib/use-location-search';

// Mail providers (Outlook/Hotmail especially) prefetch links to scan them,
// which would burn the single-use magic-link code. This page needs one real
// click before the code is redeemed at /auth/callback.
function callbackHref(params) {
  const code = params.get('code');
  const next = params.get('next') || '';
  if (!code) return '/auth/login';
  const qs = new URLSearchParams({ code });
  if (next) qs.set('next', next);
  return `/auth/callback?${qs.toString()}`;
}

export default function ConfirmSignInPage() {
  // The link stays disabled until the browser has the query string; it is
  // never part of the server-rendered HTML, so link scanners can't follow it.
  const search = useLocationSearch();
  const href = search === null ? null : callbackHref(new URLSearchParams(search));

  return (
    <>
      <SiteHeader />
      <main className="nhlx-center nhlx-glow">
        <div className="nhlx-panel">
          <span className="nhlx-eyebrow">One more click</span>
          <h1>Confirm it&apos;s you</h1>
          <p>Some email providers scan links automatically, so the model needs one real click to finish signing you in.</p>
          <a href={href || '#'} className="nhlx-btn" style={{ marginTop: 26, width: '100%' }} aria-disabled={!href}>
            Finish signing in
          </a>
        </div>
      </main>
    </>
  );
}

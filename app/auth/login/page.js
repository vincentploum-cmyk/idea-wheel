'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { safeNextPath } from '@/lib/safe-next';
import SiteHeader from '@/components/nhl/SiteHeader';

export default function LoginPage() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ideareels.io';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [nextPath, setNextPath] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(safeNextPath(params.get('next') || ''));
    if (params.get('error')) setErr('That sign-in link expired or was already used. Request a new one.');
  }, []);

  const nextQS = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
  // Magic links route through /auth/confirm so mail scanners that prefetch
  // links can't burn the single-use code before the real click.
  const magicLinkRedirect = `${siteUrl}/auth/confirm${nextQS}`;
  const callbackUrl = `${siteUrl}/auth/callback${nextQS}`;

  const sendMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: magicLinkRedirect },
    });
    setLoading(false);
    if (error) {
      console.error('magic link send failed:', error.message);
      setErr("Couldn't send the link just now. Try Google or GitHub, or try again in a minute.");
    } else {
      setSent(true);
    }
  };

  const oauth = async (provider) => {
    setErr('');
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    });
    if (error) setErr(error.message);
  };

  return (
    <>
      <SiteHeader />
      <main className="nhlx-center nhlx-glow">
        <div className="nhlx-panel">
          <span className="nhlx-eyebrow">Sign in</span>
          <h1>Open the model</h1>
          <p>Access is limited to the model owner. Use the email on the access list.</p>

          {sent ? (
            <p className="nhlx-note nhlx-note-ok" role="status" style={{ marginTop: 24 }}>
              Check {email} for your sign-in link. You can close this tab.
            </p>
          ) : (
            <form onSubmit={sendMagicLink}>
              <div className="nhlx-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="nhlx-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <button type="submit" className="nhlx-btn" disabled={loading} style={{ width: '100%', marginTop: 16 }}>
                {loading ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>
          )}

          <div className="nhlx-or">or</div>
          <div className="nhlx-oauth">
            <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => oauth('google')}>Google</button>
            <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => oauth('github')}>GitHub</button>
          </div>
          {err && <p className="nhlx-note nhlx-note-err" role="alert">{err}</p>}
        </div>
      </main>
    </>
  );
}

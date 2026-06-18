'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function AuthPanel({ mode = 'login', user, error }) {
  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ideareels.io';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(error === 'auth' ? 'Sign-in link expired or invalid. Try again.' : '');

  const isRegister = mode === 'register';

  const sendMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });
    if (authError) setErr(authError.message);
    else setSent(true);
    setLoading(false);
  };

  const signInWithOAuth = async (provider) => {
    setErr('');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${siteUrl}/auth/callback` },
    });
    if (authError) setErr(authError.message);
  };

  return (
    <section className="contact-page-section fix section-padding intellio-auth-section">
      <div className="auto-container">
        <div className="row justify-content-center">
          <div className="col-xl-6 col-lg-8">
            <div className="contact-page-single-box intellio-auth-card">
              {user ? (
                <div className="intellio-auth-copy text-center">
                  <h3>You&apos;re already signed in</h3>
                  <p>Signed in as {user.email}. Jump back into your ideas or manage credits from your profile.</p>
                  <div className="banner-btn d-flex justify-content-center gap-3 flex-wrap">
                    <Link href="/profile" className="primary">Go to profile</Link>
                    <Link href="/wheel" className="border-btn">Open idea wheel</Link>
                  </div>
                </div>
              ) : sent ? (
                <div className="intellio-auth-copy text-center">
                  <h3>Check your email</h3>
                  <p>We sent a sign-in link to <strong>{email}</strong>. Open it to continue.</p>
                  <button className="primary intellio-button-reset" type="button" onClick={() => setSent(false)}>Use another email</button>
                </div>
              ) : (
                <>
                  <div className="intellio-auth-copy text-center">
                    <h3>{isRegister ? 'Create your account' : 'Sign in to IdeaReels'}</h3>
                    <p>Use Google, GitHub, or a magic link. Your auth flow stays the same, only the wrapper changed.</p>
                  </div>
                  <div className="intellio-oauth-stack">
                    <button type="button" onClick={() => signInWithOAuth('google')} className="intellio-social-btn">
                      <img src="/intellio-images/demo-img/google.png" alt="Google" /> Continue with Google
                    </button>
                    <button type="button" onClick={() => signInWithOAuth('github')} className="intellio-social-btn">
                      <i className="fa-brands fa-github" /> Continue with GitHub
                    </button>
                  </div>
                  <div className="intellio-divider"><span>or use email</span></div>
                  {err ? <p className="text-danger mb-3">{err}</p> : null}
                  <form onSubmit={sendMagicLink}>
                    <div className="contact-page-form">
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
                      <button className="primary intellio-button-reset w-100" type="submit">
                        {loading ? 'Sending...' : isRegister ? 'Create account with magic link' : 'Send magic link'}
                      </button>
                    </div>
                  </form>
                  <p className="intellio-auth-switch">
                    {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
                    <Link href={isRegister ? '/auth/login' : '/auth/register'}>{isRegister ? 'Sign in' : 'Register'}</Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

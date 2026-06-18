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
    <section className="gt-login-section section-padding">
      <div className="container">
        <div className="gt-account-box">
          {user ? (
            <>
              <h4>You&apos;re already signed in</h4>
              <p className="mb-4">Signed in as {user.email}. Jump back into your ideas or manage credits from your profile.</p>
              <div className="gt-cta-btn justify-content-center">
                <Link href="/profile" className="gt-theme-btn">go to profile</Link>
                <Link href="/wheel" className="gt-theme-btn style-3 bg-border">open idea wheel</Link>
              </div>
            </>
          ) : sent ? (
            <>
              <h4>Check your email</h4>
              <p className="mb-4">We sent a sign-in link to <strong>{email}</strong>. Open it to continue.</p>
              <button className="gt-theme-btn" type="button" onClick={() => setSent(false)}>use another email</button>
            </>
          ) : (
            <>
              <div className="google-box">
                <button type="button" onClick={() => signInWithOAuth('google')} className="google-text border-0 bg-transparent w-100 text-start">
                  <img src="/boostly/assets/img/google.png" alt="" />Continue with Google
                </button>
                <button type="button" onClick={() => signInWithOAuth('github')} className="google-text border-0 bg-transparent w-100 text-start mt-3">
                  <i className="fa-brands fa-github me-2" />Continue with GitHub
                </button>
                <p className="text">Or</p>
              </div>
              <h4>{isRegister ? 'create your account' : 'log in to IdeaReels'}</h4>
              {err ? <p className="text-danger mb-3">{err}</p> : null}
              <form onSubmit={sendMagicLink}>
                <div className="row">
                  <div className="col-lg-12">
                    <div className="form-clt">
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email address" />
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <button className="gt-theme-btn" type="submit">
                      {loading ? 'sending...' : isRegister ? 'create account with magic link' : 'send magic link'}
                    </button>
                  </div>
                </div>
              </form>
              <p className="login-text">
                {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
                <Link href={isRegister ? '/auth/login' : '/auth/register'}>{isRegister ? 'Log in' : 'Register'}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

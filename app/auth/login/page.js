'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import BrandLogo from '@/components/BrandLogo';

export default function LoginPage() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ideareels.io';
  const getClient = () => createClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const sendMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true); setErr('');
    const { error } = await getClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });
    if (error) { setErr(error.message); setLoading(false); }
    else { setSent(true); setLoading(false); }
  };

  const signInWithOAuth = async (provider) => {
    setErr('');
    const { error } = await getClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${siteUrl}/auth/callback` },
    });
    if (error) setErr(error.message);
  };

  return (
    <div className="popito-fn-wrapper" data-bg-decor="enable">
      <header id="popito_fn_header">
        <div className="popito_fn_header">
          <div className="header_top">
            <div className="logo">
              <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: 0 }}>
                <BrandLogo size={26} />
              </Link>
            </div>
            <div className="right__trigger">
              <Link href="/auth/register">Create account</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="popito_fn_content">
        <div className="popito_fn_sign_in_page">
          <div className="container">
            <div className="fn__contact_form fn__bold_item">
              <div className="contact_item">
                <div className="contact_left fn__img_icon">
                  <div className="img" style={{
                    background: '#FFE000',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 24, padding: 40, textAlign: 'center',
                  }}>
                    <BrandLogo size={30} />
                    <p style={{
                      fontFamily: 'Nunito, sans-serif', fontWeight: 900,
                      fontSize: 'clamp(24px,4vw,36px)', lineHeight: 1.1,
                      color: '#111', margin: 0, letterSpacing: '-0.02em',
                    }}>
                      Clarify the concept.<br />Validate the market.<br />Build the MVP faster.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 260 }}>
                      {['1. Define the concept', '2. Research the market', '3. Build from the blueprint'].map(item => (
                        <div key={item} style={{
                          background: '#fff', border: '3px solid #111',
                          borderRadius: 10, padding: '10px 16px',
                          fontFamily: 'Nunito, sans-serif', fontWeight: 800,
                          fontSize: 14, color: '#111', textAlign: 'left',
                          boxShadow: '3px 3px 0 #111',
                        }}>{item}</div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="contact_right">
                  <div className="contact_right_in">
                    {sent ? (
                      <>
                        <h3 className="fn__title">Check your email</h3>
                        <p className="fn__desc">We sent a sign-in link to <strong>{email}</strong>. Click it to continue.</p>
                        <button onClick={() => setSent(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                          Use a different email
                        </button>
                      </>
                    ) : (
                      <>
                        <h1 className="fn__title">Welcome Back!</h1>
                        <p className="fn__desc">
                          Don&apos;t have an account? <Link className="fn__creative_link" href="/auth/register">Sign Up</Link>
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                          <button onClick={() => signInWithOAuth('google')} className="fn__main_button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                            </svg>
                            Continue with Google
                          </button>
                          <button onClick={() => signInWithOAuth('github')} className="fn__main_button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                            </svg>
                            Continue with GitHub
                          </button>
                        </div>

                        <p style={{ textAlign: 'center', opacity: 0.5, fontSize: 12, marginBottom: 16 }}>— or use email —</p>

                        <form onSubmit={sendMagicLink}>
                          <div className="fields">
                            <section className="input_section">
                              <label htmlFor="login-email" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>Email address</label>
                              <input
                                id="login-email"
                                type="email"
                                required
                                placeholder="Email *"
                                className="email"
                                name="email"
                                autoComplete="email"
                                spellCheck={false}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                              />
                              <div aria-live="polite">
                                {err && <p style={{ color: '#c00', marginTop: 8, fontSize: 14 }}>{err}</p>}
                              </div>
                            </section>
                            <section className="input_section">
                              <button type="submit" className="fn__main_button" disabled={loading}>
                                {loading ? 'Sending…' : 'Send Login Link'}
                              </button>
                            </section>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

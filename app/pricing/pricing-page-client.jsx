'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CREDIT_PACKAGES, CREDIT_PACKAGE_BY_KEY } from '@/lib/pricing';

const PACK_DESCRIPTIONS = {
  starter: 'For trying your first full blueprint end-to-end.',
  pro:     'Best for founders validating several ideas back-to-back.',
  power:   'For builders running deep exploration across markets.',
};

export default function PricingPageClient({ searchParams }) {
  const [loadingKey, setLoadingKey] = useState(null);
  const [error, setError] = useState('');
  // Support both the legacy `success=1&package=…` flow and the new `credits=success&pack=…` redirect
  const success = searchParams?.success === '1' || searchParams?.credits === 'success';
  const canceled = searchParams?.canceled === '1' || searchParams?.credits === 'cancelled';
  const packageKey = searchParams?.package || searchParams?.pack || '';
  const packageConfig = CREDIT_PACKAGE_BY_KEY[packageKey] || null;

  // Credits are granted server-side by the Stripe webhook. No client mutation needed.

  const statusMessage = useMemo(() => {
    if (success && packageConfig) return {
      tone: 'success',
      title: `${packageConfig.credits} credits added`,
      text: 'Credits were applied to this browser so you can keep going immediately.',
    };
    if (canceled) return {
      tone: 'neutral',
      title: 'Checkout canceled',
      text: 'Nothing was charged. Pick up where you left off whenever you want.',
    };
    return null;
  }, [success, canceled, packageConfig]);

  async function startCheckout(pkg) {
    setLoadingKey(pkg.key); setError('');
    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pkg.key }),
      });
      const data = await res.json();
      if (data.code === 'AUTH_REQUIRED') {
        window.location.href = '/profile?message=sign-in-to-purchase';
        return;
      }
      if (!res.ok || data.error || !data.url) throw new Error(data.error || 'Unable to start checkout');
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message || 'Unable to start checkout'); setLoadingKey(null);
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <main className="pr-page">
        <nav className="pr-nav">
          <Link href="/" className="pr-brand">IdeaReels</Link>
          <Link href="/" className="pr-back">← Back</Link>
        </nav>

        <section className="pr-hero">
          <div className="pr-eyebrow">Credits</div>
          <h1 className="pr-title">Buy credits when you&apos;re ready</h1>
          <p className="pr-subtitle">
            Validation stays free. Use credits only when you want the full blueprint, launch plan, and prototype package.
          </p>
        </section>

        {statusMessage && (
          <div className={`pr-status pr-status--${statusMessage.tone}`}>
            <strong>{statusMessage.title}</strong>
            <p>{statusMessage.text}</p>
          </div>
        )}

        {error && (
          <div className="pr-status pr-status--error" role="alert">
            <p>{error}</p>
          </div>
        )}

        <section className="pr-grid">
          {CREDIT_PACKAGES.map((pkg) => (
            <article key={pkg.key} className={`pr-card${pkg.highlight ? ' pr-card--hl' : ''}`}>
              <header className="pr-card-head">
                <span className="pr-card-label">{pkg.label}</span>
                {pkg.highlight && <span className="pr-card-tag">Most popular</span>}
              </header>
              <div className="pr-card-price">
                <span className="pr-card-price-num">{pkg.price}</span>
                <span className="pr-card-price-meta">{pkg.credits} credits · {pkg.per} each</span>
              </div>
              <div className="pr-card-tagline">~ {pkg.tagline}</div>
              <p className="pr-card-desc">{PACK_DESCRIPTIONS[pkg.key]}</p>
              <button
                onClick={() => startCheckout(pkg)}
                disabled={loadingKey !== null}
                className={`pr-card-btn${pkg.highlight ? ' pr-card-btn--primary' : ''}`}
              >
                {loadingKey === pkg.key ? 'Redirecting…' : 'Continue to checkout'}
              </button>
            </article>
          ))}
        </section>

        <section className="pr-tldr">
          <ul>
            <li>Validation is always free — no credit needed.</li>
            <li>Credits never expire. Use them whenever you want.</li>
            <li>Stripe checkout. Cancel anytime, no subscription.</li>
          </ul>
        </section>

        <footer className="pr-footer">
          <div className="pr-footer-links">
            <Link href="/faq">FAQ</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/">IdeaReels</Link>
          </div>
          <p>© {new Date().getFullYear()} IdeaReels · AI-generated content is for informational purposes only.</p>
        </footer>
      </main>
    </>
  );
}

const CSS = `
.pr-page {
  min-height:100vh;
  max-width:980px; margin:0 auto;
  padding:0 24px 64px;
  font-family:var(--font-body);
  color:var(--ink);
  background:var(--bg);
}
.pr-nav {
  display:flex; align-items:center; justify-content:space-between;
  padding:20px 0 0;
}
.pr-brand {
  font-family:var(--font-display); font-size:17px; font-weight:800;
  color:var(--ink); letter-spacing:-.02em; text-decoration:none;
}
.pr-back {
  font-size:13.5px; font-weight:500; color:var(--ink-2);
  text-decoration:none; padding:8px 14px; border-radius:var(--r-pill);
  border:1px solid var(--line); background:var(--surface);
  transition:border-color .15s, color .15s;
}
.pr-back:hover { border-color:var(--line-2); color:var(--ink); }

.pr-hero { text-align:center; max-width:620px; margin:64px auto 32px; }
.pr-eyebrow {
  font-size:12px; font-weight:600; letter-spacing:.14em; text-transform:uppercase;
  color:var(--accent-mid); margin-bottom:14px;
}
.pr-title {
  font-family:var(--font-display);
  font-size:clamp(32px,5vw,48px); font-weight:700;
  letter-spacing:-.025em; line-height:1.08;
  margin:0 0 18px; color:var(--ink);
}
.pr-subtitle {
  font-size:16px; color:var(--muted);
  margin:0 auto; line-height:1.6; max-width:560px;
}

.pr-status {
  max-width:620px; margin:0 auto 24px;
  padding:14px 18px; border-radius:var(--r-md);
  background:var(--surface); border:1px solid var(--line);
}
.pr-status strong { display:block; font-size:14px; color:var(--ink); margin-bottom:4px; }
.pr-status p { font-size:13.5px; color:var(--muted); margin:0; line-height:1.55; }
.pr-status--success { background:var(--accent-light); border-color:var(--accent-border); }
.pr-status--success strong { color:var(--accent); }
.pr-status--error { background:rgba(185,28,28,0.04); border-color:rgba(185,28,28,0.18); }
.pr-status--error p { color:var(--bad); }

.pr-grid {
  display:grid; gap:14px;
  grid-template-columns:repeat(3, 1fr);
  margin:0 auto 40px;
}
@media (max-width:760px) {
  .pr-grid { grid-template-columns:1fr; }
}

.pr-card {
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:var(--r-xl);
  padding:24px;
  display:flex; flex-direction:column;
  transition:border-color .15s, transform .2s var(--ease-out), box-shadow .2s;
}
.pr-card:hover { border-color:var(--line-2); transform:translateY(-2px); box-shadow:var(--sh-sm); }
.pr-card--hl {
  border-color:var(--accent);
  box-shadow:0 0 0 1px var(--accent), var(--sh-md);
}
.pr-card--hl:hover { box-shadow:0 0 0 1px var(--accent), var(--sh-lg); }

.pr-card-head {
  display:flex; justify-content:space-between; align-items:center;
  margin-bottom:16px; min-height:24px;
}
.pr-card-label {
  font-family:var(--font-display);
  font-size:14px; font-weight:700; color:var(--ink);
  letter-spacing:-.01em;
}
.pr-card-tag {
  font-size:10.5px; font-weight:700;
  letter-spacing:.1em; text-transform:uppercase;
  color:var(--accent);
  padding:3px 10px; border-radius:99px;
  background:var(--accent-light);
  border:1px solid var(--accent-border);
}

.pr-card-price { margin-bottom:14px; }
.pr-card-price-num {
  display:block;
  font-family:var(--font-display);
  font-size:40px; font-weight:700;
  letter-spacing:-.03em; line-height:1;
  color:var(--ink);
}
.pr-card-price-meta {
  display:block; margin-top:6px;
  font-size:12.5px; color:var(--muted);
}
.pr-card-tagline {
  font-size:12px; font-weight:600; letter-spacing:.04em;
  color:var(--accent-mid);
  margin:0 0 14px;
}
.pr-card-desc {
  font-size:13.5px; color:var(--muted); line-height:1.55;
  margin:0 0 20px; flex:1;
}

.pr-card-btn {
  width:100%; padding:11px 0; border-radius:var(--r-pill);
  font-family:var(--font-body); font-size:13.5px; font-weight:600;
  cursor:pointer; transition:background .15s, border-color .15s, color .15s, box-shadow .2s;
  background:var(--surface); color:var(--ink);
  border:1px solid var(--line-2);
}
.pr-card-btn:hover { border-color:var(--accent); color:var(--accent); }
.pr-card-btn--primary {
  background:var(--accent); color:#fff;
  border-color:var(--accent);
  box-shadow:0 1px 0 rgba(255,255,255,0.16) inset, 0 12px 24px -16px rgba(91,33,182,0.55);
}
.pr-card-btn--primary:hover { background:#4C1D95; border-color:#4C1D95; color:#fff; }
.pr-card-btn:disabled { opacity:.55; cursor:wait; }

.pr-tldr {
  max-width:620px; margin:0 auto 40px;
  padding:20px 24px;
  background:var(--bg-2); border:1px solid var(--line);
  border-radius:var(--r-lg);
}
.pr-tldr ul { margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:8px; }
.pr-tldr li {
  font-size:13.5px; color:var(--ink-2);
  padding-left:18px; position:relative;
}
.pr-tldr li::before {
  content:""; position:absolute; left:2px; top:8px;
  width:6px; height:6px; border-radius:50%;
  background:var(--accent-mid);
}

.pr-footer { margin-top:48px; padding-top:24px; border-top:1px solid var(--line); text-align:center; }
.pr-footer-links { display:flex; justify-content:center; gap:24px; flex-wrap:wrap; margin-bottom:12px; }
.pr-footer-links a {
  font-size:13px; color:var(--ink-2); text-decoration:none; font-weight:500;
  transition:color .15s;
}
.pr-footer-links a:hover { color:var(--accent); }
.pr-footer p { font-size:11.5px; color:var(--faint); line-height:1.7; margin:0; }

@media (max-width:640px) {
  .pr-page { padding:0 16px 48px; }
  .pr-hero { margin:36px auto 28px; }
  .pr-title { font-size:clamp(30px, 9vw, 40px); margin-bottom:14px; }
  .pr-subtitle { font-size:15.5px; max-width:unset; }
  .pr-card { padding:22px; }
}
`;

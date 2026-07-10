'use client';

import { useEffect, useMemo, useState } from 'react';
import { CREDIT_PACKAGES, CREDIT_PACKAGE_BY_KEY } from '@/lib/pricing';
import { CheckIcon } from '@/components/popito/icons';

const PACK_DESCRIPTIONS = {
  starter: '5 credits to spin, score, and go deeper on your own ideas.',
  pro: '10 credits — more room to explore, validate, and get blueprints.',
  power: '25 credits — best value for builders who want to move fast.',
};

const PACK_FEATURES = {
  starter: [
    '5 credits to spin and score ideas',
    'Spinning is free — credits go toward deeper work',
    '1 credit for deep market research',
    '2 credits for the full MVP blueprint',
  ],
  pro: [
    '10 credits to spin and score ideas',
    '1 credit for deep market research',
    '2 credits for the full MVP blueprint',
    'Best for builders who want to go deeper',
  ],
  power: [
    '25 credits to spin and score ideas',
    '1 credit for deep market research',
    '2 credits for the full MVP blueprint',
    'Best value — explore, validate, and build',
  ],
};

export default function PricingPageClient({ searchParams }) {
  const [loadingKey, setLoadingKey] = useState(null);
  const [error, setError] = useState('');
  const success = searchParams?.success === '1' || searchParams?.credits === 'success';
  const canceled = searchParams?.canceled === '1' || searchParams?.credits === 'canceled';
  const packageKey = searchParams?.package || searchParams?.pack || '';
  const packageConfig = CREDIT_PACKAGE_BY_KEY[packageKey] || null;
  const sessionId = typeof searchParams?.session_id === 'string' ? searchParams.session_id : '';

  // With a session_id we verify payment server-side instead of trusting the URL:
  // 'confirming' → 'confirmed' | 'unpaid' | 'failed'
  const [confirmState, setConfirmState] = useState(sessionId ? 'confirming' : null);
  const [confirmData, setConfirmData] = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/credits/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.code === 'AUTH_REQUIRED') { window.location.href = '/auth/login'; return; }
        if (res.ok && data.ok) { setConfirmData(data); setConfirmState('confirmed'); }
        else if (res.ok && data.ok === false) setConfirmState('unpaid');
        else setConfirmState('failed');
      } catch {
        if (!cancelled) setConfirmState('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const statusMessage = useMemo(() => {
    if (confirmState === 'confirming') return {
      tone: 'neutral',
      title: 'Finalizing your purchase…',
      text: 'Confirming your payment with Stripe. This only takes a moment.',
    };
    if (confirmState === 'confirmed') {
      const isIdea = confirmData?.type === 'idea';
      return {
        tone: 'success',
        title: `${confirmData?.credits} ${isIdea ? `idea unlock${confirmData?.credits === 1 ? '' : 's'}` : 'credits'} added`,
        text: isIdea
          ? 'Head to the Ideas library when you want to unlock one.'
          : `Your balance is now ${confirmData?.balance} credit${confirmData?.balance === 1 ? '' : 's'} — ready for the next concept you want to evaluate.`,
      };
    }
    if (confirmState === 'unpaid') return {
      tone: 'neutral',
      title: 'Payment not completed',
      text: 'This checkout was not paid, so nothing was charged. Pick a pack whenever you are ready.',
    };
    if (confirmState === 'failed') return {
      tone: 'neutral',
      title: 'Confirming your payment…',
      text: 'We could not verify your payment yet. If you were charged, your credits will appear within a few minutes — refresh this page or contact support if they do not.',
    };
    if (success && packageConfig) {
      return {
        tone: 'success',
        title: `${packageConfig.unitLabel} added`,
        text: packageConfig.type === 'idea'
          ? 'Head to the Ideas library when you want to unlock one.'
          : 'Your credits are ready for the next concept you want to evaluate.',
      };
    }
    if (canceled) return {
      tone: 'neutral',
      title: 'Checkout canceled',
      text: 'Nothing was charged. Come back when you want to continue the analysis.',
    };
    return null;
  }, [confirmState, confirmData, success, canceled, packageConfig]);

  async function startCheckout(pkg) {
    setLoadingKey(pkg.key);
    setError('');
    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pkg.key }),
      });
      const data = await res.json();
      if (data.code === 'AUTH_REQUIRED') { window.location.href = '/auth/login'; return; }
      if (!res.ok || data.error || !data.url) throw new Error(data.error || 'Unable to start checkout');
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message || 'Unable to start checkout');
      setLoadingKey(null);
    }
  }

  return (
    <div className="popito_fn_membership_page">
      <section id="price">
        <div className="container">
          <div style={{ maxWidth: 760, margin: '0 auto 32px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, opacity: 0.75, margin: 0 }}>Sign in to save your work, then buy credits only when you want deeper research or the full blueprint.</p>
          </div>

          {statusMessage && (
            <div aria-live="polite" style={{
              padding: '16px 20px',
              marginBottom: 32,
              borderRadius: 8,
              background: statusMessage.tone === 'success' ? '#f0fdf4' : '#f8f8f8',
              border: `1px solid ${statusMessage.tone === 'success' ? '#86efac' : '#e5e5e5'}`,
            }}>
              <strong>{statusMessage.title}</strong><br />
              <span style={{ fontSize: 14, opacity: 0.75 }}>{statusMessage.text}</span>
            </div>
          )}
          {error && (
            <div aria-live="polite" style={{ padding: '16px 20px', marginBottom: 32, borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14 }}>
              {error}
            </div>
          )}

          <div className="fn__pricing_tables">
            <div className="pt_content">
              <ul className="pt_list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 32, listStyle: 'none', padding: 0, margin: 0 }}>
                {CREDIT_PACKAGES.map((pkg) => {
                  const features = PACK_FEATURES[pkg.key] || [];
                  return (
                    <li key={pkg.key} className="pt_list_item" style={{ display: 'block', width: 'auto', padding: 0 }}>
                      <div className={`fn__pricing_table_item fn__bold_item${pkg.highlight ? ' active' : ''}`}>
                        <div className="item_header">
                          <div className="plan"><span>{pkg.label}</span></div>
                          <div className="pricing" style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                            <h3 className="price" style={{ fontSize: 36, whiteSpace: 'nowrap' }}>{pkg.price}</h3>
                            <span className="price_text" style={{ whiteSpace: 'nowrap' }}>/ {pkg.unitLabel}</span>
                          </div>
                          <div className="desc">
                            <p>{PACK_DESCRIPTIONS[pkg.key]}</p>
                          </div>
                        </div>
                        <div className="item_content">
                          <ul>
                            {features.map((f) => (
                              <li key={f}>
                                <CheckIcon width={16} height={16} />
                                <span className="text">{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="item_footer">
                          <button
                            className="fn__btn medium"
                            disabled={loadingKey !== null}
                            onClick={() => startCheckout(pkg)}
                            style={{ cursor: loadingKey ? 'wait' : 'pointer' }}
                          >
                            <span>{loadingKey === pkg.key ? 'Redirecting…' : pkg.type === 'spin' ? 'Get credits' : 'Buy shortcut pack'}</span>
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: '40px auto 0', maxWidth: 520, textAlign: 'center', fontSize: 13, opacity: 0.65, lineHeight: 1.8 }}>
            <li>Buy credits only when you want deeper research and planning.</li>
            <li>Credits never expire.</li>
            <li>Secure checkout via Stripe.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

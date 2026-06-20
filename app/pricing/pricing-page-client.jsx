'use client';

import { useMemo, useState } from 'react';
import { CREDIT_PACKAGES, CREDIT_PACKAGE_BY_KEY } from '@/lib/pricing';

const PACK_DESCRIPTIONS = {
  starter: 'Spin the wheel and generate custom blueprints for your own ideas.',
  pro:     'Unlock one IdeaReels-curated idea with full deep research and blueprint.',
  power:   'Unlock two curated ideas — get the full package for each.',
};

const PACK_FEATURES = {
  starter: [
    '5 spin credits',
    'Free market validation on every spin',
    'Generate custom blueprints for your ideas',
    '$0.80 per credit',
  ],
  pro: [
    'Unlock 1 curated idea',
    'Full deep research report',
    'Complete product blueprint',
    'GTM plan + Cursor prompt included',
  ],
  power: [
    'Unlock 2 curated ideas',
    'Full deep research for each',
    'Complete blueprint for each idea',
    'GTM plan + Cursor prompt included',
  ],
};

export default function PricingPageClient({ searchParams }) {
  const [loadingKey, setLoadingKey] = useState(null);
  const [error, setError] = useState('');
  const success = searchParams?.success === '1' || searchParams?.credits === 'success';
  const canceled = searchParams?.canceled === '1' || searchParams?.credits === 'cancelled';
  const packageKey = searchParams?.package || searchParams?.pack || '';
  const packageConfig = CREDIT_PACKAGE_BY_KEY[packageKey] || null;

  const statusMessage = useMemo(() => {
    if (success && packageConfig) {
      const isIdea = packageConfig.key === 'pro' || packageConfig.key === 'power';
      return {
        tone: 'success',
        title: isIdea
          ? `${packageConfig.key === 'power' ? '2 idea unlocks' : '1 idea unlock'} added`
          : `${packageConfig.credits} credits added`,
        text: isIdea
          ? 'Head to the Ideas page and unlock the idea of your choice.'
          : 'Credits applied — ready for your next blueprint.',
      };
    }
    if (canceled) return {
      tone: 'neutral',
      title: 'Checkout canceled',
      text: 'Nothing was charged. Come back whenever you are ready.',
    };
    return null;
  }, [success, canceled, packageConfig]);

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
          {statusMessage && (
            <div style={{
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
            <div style={{ padding: '16px 20px', marginBottom: 32, borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14 }}>
              {error}
            </div>
          )}

          <div className="fn__pricing_tables">
            <div className="pt_content">
              <ul className="pt_list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 32, listStyle: 'none', padding: 0, margin: 0 }}>
                {CREDIT_PACKAGES.map((pkg) => {
                  const isIdea = pkg.key === 'pro' || pkg.key === 'power';
                  const features = PACK_FEATURES[pkg.key] || [];
                  return (
                    <li key={pkg.key} className="pt_list_item" style={{ display: 'block', width: 'auto', padding: 0 }}>
                      <div className={`fn__pricing_table_item fn__bold_item${pkg.highlight ? ' active' : ''}`}>
                        <div className="item_header">
                          <div className="plan"><span>{pkg.label}</span></div>
                          <div className="pricing" style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'nowrap' }}>
                            <h3 className="price" style={{ fontSize: 36, whiteSpace: 'nowrap' }}>{pkg.price}</h3>
                            <span className="price_text" style={{ whiteSpace: 'nowrap' }}>
                              {isIdea
                                ? (pkg.key === 'power' ? '/ 2 ideas' : '/ 1 idea')
                                : `/ ${pkg.credits} credits`}
                            </span>
                          </div>
                          <div className="desc">
                            <p>{PACK_DESCRIPTIONS[pkg.key]}</p>
                          </div>
                        </div>
                        <div className="item_content">
                          <ul>
                            {features.map((f, i) => (
                              <li key={i}>
                                <img src="/popito-assets/svg/check.svg" alt="" className="fn__svg" />
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
                            style={{ background: 'none', border: 'none', padding: 0, cursor: loadingKey ? 'wait' : 'pointer' }}
                          >
                            <span>{loadingKey === pkg.key ? 'Redirecting…' : 'Buy now'}</span>
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 40, opacity: 0.55, fontSize: 13 }}>
            Credits never expire · Secure checkout via Stripe
          </p>
        </div>
      </section>
    </div>
  );
}

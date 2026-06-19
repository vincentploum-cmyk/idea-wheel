'use client';

import { useMemo, useState } from 'react';
import { CREDIT_PACKAGES } from '@/lib/pricing';

const PACK_DESCRIPTIONS = {
  starter: 'Run your first full blueprint from start to finish.',
  pro: 'Ideal for founders working through several ideas at once.',
  power: 'Built for founders who want to go deep across multiple markets.',
};

// 50% off Pro and Power, Starter stays full price
const OFFER_OVERRIDES = {
  pro:   { discount: '50% OFF', originalPrice: '$9.99',  price: '$4.99',  price_cents: 499  },
  power: { discount: '50% OFF', originalPrice: '$19.99', price: '$9.99',  price_cents: 999  },
};

export default function OfferPricingClient({ searchParams }) {
  const [loadingKey, setLoadingKey] = useState(null);
  const [error, setError] = useState('');

  async function startCheckout(pkg) {
    const override = OFFER_OVERRIDES[pkg.key];
    setLoadingKey(pkg.key);
    setError('');
    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pkg.key, offer: !!override }),
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
          {error && (
            <div style={{ padding: '16px 20px', marginBottom: 32, borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14 }}>
              {error}
            </div>
          )}

          <div className="fn__pricing_tables">
            <div className="pt_content">
              <ul className="pt_list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 32, listStyle: 'none', padding: 0, margin: 0 }}>
                {CREDIT_PACKAGES.map((pkg) => {
                  const offer = OFFER_OVERRIDES[pkg.key];
                  return (
                    <li key={pkg.key} className="pt_list_item" style={{ display: 'block', width: 'auto', padding: 0 }}>
                      <div className={`fn__pricing_table_item fn__bold_item${pkg.highlight ? ' active' : ''}`} style={{ position: 'relative' }}>
                        {offer && (
                          <div style={{
                            position: 'absolute', top: -14, right: 16,
                            background: '#FFE000', border: '2px solid #111',
                            borderRadius: '6px 999px 999px 6px',
                            padding: '4px 14px 4px 10px',
                            fontFamily: 'Nunito, sans-serif', fontWeight: 900,
                            fontSize: 12, letterSpacing: '0.08em', color: '#111',
                            textTransform: 'uppercase',
                          }}>
                            {offer.discount}
                          </div>
                        )}
                        <div className="item_header">
                          <div className="plan"><span>{pkg.label}</span></div>
                          <div className="pricing" style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'nowrap' }}>
                            {offer ? (
                              <>
                                <h3 className="price" style={{ fontSize: 36, whiteSpace: 'nowrap' }}>{offer.price}</h3>
                                <span style={{ textDecoration: 'line-through', opacity: 0.45, fontSize: 18, whiteSpace: 'nowrap' }}>{offer.originalPrice}</span>
                              </>
                            ) : (
                              <h3 className="price" style={{ fontSize: 36, whiteSpace: 'nowrap' }}>{pkg.price}</h3>
                            )}
                            <span className="price_text" style={{ whiteSpace: 'nowrap' }}>/ {pkg.credits} credits</span>
                          </div>
                          <div className="desc">
                            <p>{PACK_DESCRIPTIONS[pkg.key]}</p>
                          </div>
                        </div>
                        <div className="item_content">
                          <ul>
                            <li>
                              <img src="/popito-assets/svg/check.svg" alt="" className="fn__svg" />
                              <span className="text">{pkg.credits} credits included</span>
                            </li>
                            <li>
                              <img src="/popito-assets/svg/check.svg" alt="" className="fn__svg" />
                              <span className="text">Free market validation</span>
                            </li>
                            <li>
                              <img src="/popito-assets/svg/check.svg" alt="" className="fn__svg" />
                              <span className="text">1 credit → deep research</span>
                            </li>
                            <li>
                              <img src="/popito-assets/svg/check.svg" alt="" className="fn__svg" />
                              <span className="text">2 credits → full blueprint</span>
                            </li>
                          </ul>
                        </div>
                        <div className="item_footer">
                          <button
                            className="fn__btn medium"
                            disabled={loadingKey !== null}
                            onClick={() => startCheckout(pkg)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: loadingKey ? 'wait' : 'pointer' }}
                          >
                            <span>{loadingKey === pkg.key ? 'Redirecting…' : offer ? 'Claim offer' : 'Buy now'}</span>
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
            Credits never expire · Secure checkout via Stripe · Offer available for a limited time
          </p>
        </div>
      </section>
    </div>
  );
}

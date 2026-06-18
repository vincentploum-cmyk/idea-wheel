'use client';

import { useMemo, useState } from 'react';
import { CREDIT_PACKAGES, CREDIT_PACKAGE_BY_KEY } from '@/lib/pricing';
import PublicShell from '@/components/boostly/PublicShell';

const PACK_DESCRIPTIONS = {
  starter: 'For trying your first full blueprint end-to-end.',
  pro: 'Best for founders validating several ideas back-to-back.',
  power: 'For builders running deep exploration across markets.',
};

export default function PricingPageClient({ searchParams }) {
  const [loadingKey, setLoadingKey] = useState(null);
  const [error, setError] = useState('');
  const success = searchParams?.success === '1' || searchParams?.credits === 'success';
  const canceled = searchParams?.canceled === '1' || searchParams?.credits === 'cancelled';
  const packageKey = searchParams?.package || searchParams?.pack || '';
  const packageConfig = CREDIT_PACKAGE_BY_KEY[packageKey] || null;

  const statusMessage = useMemo(() => {
    if (success && packageConfig) return {
      tone: 'success',
      title: `${packageConfig.credits} credits added`,
      text: 'Credits were applied and your account is ready for the next blueprint.',
    };
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
      if (data.code === 'AUTH_REQUIRED') {
        window.location.href = '/auth/login';
        return;
      }
      if (!res.ok || data.error || !data.url) throw new Error(data.error || 'Unable to start checkout');
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message || 'Unable to start checkout');
      setLoadingKey(null);
    }
  }

  return (
    <PublicShell title="Pricing">
      <section className="gt-pricing-section fix section-padding section-bg-4">
        <div className="pricing-right-shape"><img src="/boostly/assets/img/home-1/pricing-right.png" alt="" /></div>
        <div className="container">
          <div className="gt-section-title text-center style-3">
            <h6 className="tt-capitalize">pricing plan</h6>
            <h2 className="inner-font fw-700 fz-50 text-header-color">Buy credits only when an idea is worth <span>pursuing</span></h2>
            <p className="mt-3">Validation stays free. Credits are only for deeper research and blueprint generation.</p>
          </div>
          {statusMessage ? (
            <div className={`alert ${statusMessage.tone === 'success' ? 'alert-success' : 'alert-light'} mb-4`}>
              <strong>{statusMessage.title}</strong><br />{statusMessage.text}
            </div>
          ) : null}
          {error ? <div className="alert alert-danger mb-4">{error}</div> : null}
          <div className="row">
            {CREDIT_PACKAGES.map((pkg, index) => (
              <div key={pkg.key} className="col-xl-4 col-lg-6 col-md-6 mb-4">
                <div className={`gt-pricing-box-items style-2 h-100 ${pkg.highlight ? 'active-2 top_view' : index === 0 ? 'left_view' : 'right_view'}`}>
                  <div className="gt-pricing-header">
                    <h2>{pkg.price}</h2>
                    <span className="sub-texts">{pkg.label}</span>
                  </div>
                  <button className="gt-theme-btn border-0" disabled={loadingKey !== null} onClick={() => startCheckout(pkg)}>
                    {loadingKey === pkg.key ? 'redirecting...' : 'continue to checkout'}
                  </button>
                  <ul className="gt-pricing-list">
                    <li><i className="fa-solid fa-circle-check" />{pkg.credits} credits included</li>
                    <li><i className="fa-solid fa-circle-check" />{pkg.per} per credit</li>
                    <li><i className="fa-solid fa-circle-check" />Free market validation on every idea</li>
                    <li><i className="fa-solid fa-circle-check" />1 credit for extended deep research</li>
                    <li><i className="fa-solid fa-circle-check" />2 credits for full AI blueprint</li>
                    <li><i className="fa-solid fa-circle-check" />{PACK_DESCRIPTIONS[pkg.key]}</li>
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { CREDIT_PACKAGES, CREDIT_PACKAGE_BY_KEY } from '@/lib/pricing';
import PublicShell from '@/components/intellio/PublicShell';

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
    <PublicShell title="Pricing Plans" subtitle="Pricing Plan">
      <section className="pricing-section section-padding">
        <div className="auto-container">
          <div className="section-title text-center style-two">
            <h5>Buy credits only when an idea is worth pursuing</h5>
            <h2>Validation stays free. Credits unlock the <span>deeper layers</span></h2>
            <p>Deep research uses 1 credit. The full 4-agent blueprint uses 2 credits.</p>
          </div>
          {statusMessage ? (
            <div className={`alert ${statusMessage.tone === 'success' ? 'alert-success' : 'alert-light'} mb-4`}>
              <strong>{statusMessage.title}</strong><br />{statusMessage.text}
            </div>
          ) : null}
          {error ? <div className="alert alert-danger mb-4">{error}</div> : null}
          <div className="row">
            {CREDIT_PACKAGES.map((pkg) => (
              <div key={pkg.key} className="col-xl-4 col-lg-6 col-md-6">
                <div className={`pricing-single-item intellio-price-card ${pkg.highlight ? 'active' : ''}`}>
                  {pkg.highlight ? <h5 className="pricing-tag"><span>POPULAR</span></h5> : null}
                  <h3 className="pricing-plan">{pkg.label}</h3>
                  <div className="pricing-money"><h3>{pkg.price}</h3></div>
                  <div className="pricing-desc"><p>{PACK_DESCRIPTIONS[pkg.key]}</p></div>
                  <div className="pricing-btn">
                    <button className="intellio-button-reset" disabled={loadingKey !== null} onClick={() => startCheckout(pkg)}>
                      {loadingKey === pkg.key ? 'Redirecting...' : 'Continue to checkout'}<i className="fa-light fa-arrow-right" />
                    </button>
                  </div>
                  <div className="pricing-body">
                    <div className="pricing-title"><h4>Key features</h4></div>
                    <div className="pricing-feature">
                      <ul>
                        <li><span><img src="/intellio-images/demo-img/check.png" alt="check" /></span>{pkg.credits} credits included</li>
                        <li><span><img src="/intellio-images/demo-img/check.png" alt="check" /></span>{pkg.per} per credit</li>
                        <li><span><img src="/intellio-images/demo-img/check.png" alt="check" /></span>Free market validation on every idea</li>
                        <li><span><img src="/intellio-images/demo-img/check.png" alt="check" /></span>1 credit for extended deep research</li>
                        <li><span><img src="/intellio-images/demo-img/check.png" alt="check" /></span>2 credits for a full AI blueprint</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

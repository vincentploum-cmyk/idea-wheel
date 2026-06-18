import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import { LANDING_STEPS, FAQS } from '@/lib/content';
import { CREDIT_PACKAGES } from '@/lib/pricing';

export const metadata = {
  title: 'IdeaReels — Find a startup idea worth building.',
  description: 'Generate sharper business ideas in seconds, run a quick market check, and unlock a build-ready blueprint only when one is worth pursuing.',
};

export default function LandingPage() {
  return (
    <PopitoShell>

      {/* Hero */}
      <div className="popito_fn_pagetitle" style={{ minHeight: 480, display: 'flex', alignItems: 'center' }}>
        <div className="container">
          <div className="pagetitle" style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
            <h3 className="fn__title" style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', lineHeight: 1.15 }}>
              Find a startup idea<br />worth building.
            </h3>
            <p className="fn__desc" style={{ maxWidth: 520, margin: '0 auto 2rem' }}>
              Spin three reels to land on a concrete idea. Get a free market verdict in seconds. Unlock a full build blueprint only when the signal says it deserves it.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/wheel" className="fn__btn"><span>Spin a free idea</span></Link>
              <Link href="/pricing" className="fn__btn medium"><span>See pricing</span></Link>
            </div>
            <p style={{ marginTop: 20, opacity: 0.6, fontSize: 13 }}>3 free credits on signup · No credit card required</p>
            <span className="wings" />
            <span className="raleway">
              <span /><span /><span /><span /><span />
            </span>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="popito_fn_membership_page">
        <section id="how-it-works" style={{ padding: '80px 0' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                How it works
              </h2>
              <p style={{ opacity: 0.65, marginTop: 8 }}>From raw idea to build-ready blueprint in three steps.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 28 }}>
              {LANDING_STEPS.map((step) => (
                <div key={step.number} className="fn__bold_item" style={{ padding: '32px 28px' }}>
                  <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 42, opacity: 0.12, marginBottom: 12, lineHeight: 1 }}>
                    {step.number}
                  </p>
                  <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 18, marginBottom: 10 }}>
                    {step.title}
                  </h3>
                  <p style={{ opacity: 0.65, lineHeight: 1.65, fontSize: 14 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing preview */}
        <section id="price" style={{ padding: '0 0 80px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                Simple pricing
              </h2>
              <p style={{ opacity: 0.65, marginTop: 8 }}>Market validation is always free. Credits unlock the deeper layers.</p>
            </div>
            <div className="fn__pricing_tables">
              <div className="pt_content">
                <ul className="pt_list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 32, listStyle: 'none', padding: 0, margin: 0 }}>
                  {CREDIT_PACKAGES.map((pkg) => (
                    <li key={pkg.key} className="pt_list_item" style={{ display: 'block', width: 'auto', padding: 0 }}>
                      <div className={`fn__pricing_table_item fn__bold_item${pkg.highlight ? ' active' : ''}`}>
                        <div className="item_header">
                          <div className="plan"><span>{pkg.label}</span></div>
                          <div className="pricing">
                            <h3 className="price">{pkg.price}</h3>
                            <span className="price_text">/ {pkg.credits} credits</span>
                          </div>
                          <div className="desc"><p>{pkg.tagline}</p></div>
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
                          <Link href="/pricing" className="fn__btn medium"><span>Get started</span></Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ teaser */}
        <section style={{ padding: '0 0 100px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                Common questions
              </h2>
            </div>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
              {FAQS.slice(0, 4).map((faq) => (
                <div key={faq.q} className="fn__bold_item" style={{ marginBottom: 16, padding: '20px 24px' }}>
                  <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{faq.q}</h3>
                  <p style={{ opacity: 0.65, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{faq.a}</p>
                </div>
              ))}
              <div style={{ textAlign: 'center', marginTop: 28 }}>
                <Link href="/faq" className="fn__creative_link">See all questions<span className="suffix">//</span></Link>
              </div>
            </div>
          </div>
        </section>
      </div>

    </PopitoShell>
  );
}

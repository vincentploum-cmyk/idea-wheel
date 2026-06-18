import Link from 'next/link';
import PublicShell from '@/components/boostly/PublicShell';
import { FAQS, LANDING_STEPS, LANDING_TESTIMONIALS } from '@/components/boostly/data';
import FaqAccordion from '@/components/boostly/FaqAccordion';
import { CREDIT_PACKAGES } from '@/lib/pricing';

export const metadata = {
  title: 'IdeaReels — Find a startup idea worth building.',
  description: 'Generate sharper business ideas in seconds, run a quick market check, and unlock a build-ready blueprint only when one is worth pursuing.',
};

export default function LandingPage() {
  return (
    <PublicShell>
      <section className="gt-hero-section gt-hero-1 ideareels-hero fix">
        <div className="top-shape"><img src="/boostly/assets/img/home-1/hero/top-shape.png" alt="" /></div>
        <div className="left-shape"><img src="/boostly/assets/img/home-1/hero/left-shape.png" alt="" /></div>
        <div className="right-shape"><img src="/boostly/assets/img/home-1/hero/right-shape.png" alt="" /></div>
        <div className="robot-shape"><img src="/boostly/assets/img/home-1/hero/robot-shape.png" alt="" /></div>
        <div className="container">
          <div className="gt-hero-items ideareels-hero-panel">
            <div className="box-shape"><img src="/boostly/assets/img/home-1/hero/box-shape.png" alt="" /></div>
            <div className="ideareels-hero-glow ideareels-hero-glow-1" />
            <div className="ideareels-hero-glow ideareels-hero-glow-2" />
            <div className="row">
              <div className="col-lg-12">
                <div className="gt-hero-content ideareels-hero-content">
                  <p className="ideareels-kicker">Idea validation, before the busywork</p>
                  <h1>Find a startup idea <b>worth</b> <span>building.</span></h1>
                  <p className="ideareels-subheadline mt-4">
                    Generate sharper business ideas in seconds, run a quick market check, and unlock a build-ready blueprint only when one is worth pursuing.
                  </p>
                  <div className="gt-cta-btn justify-content-center mt-4">
                    <Link href="/wheel" className="gt-theme-btn">get started free</Link>
                    <Link href="/#how-it-works" className="gt-theme-btn style-3 bg-border">see how it works</Link>
                  </div>
                  <ul className="mt-4 d-flex justify-content-center gap-4 flex-wrap list-unstyled text-white">
                    <li><i className="fa-regular fa-circle-check me-2" />3 free credits on signup</li>
                    <li><i className="fa-regular fa-circle-check me-2" />No credit card required</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="gt-feature-section fix section-padding">
        <div className="container">
          <div className="gt-section-title-area border-bottom-add">
            <div className="gt-section-title">
              <h6>How it works</h6>
              <h2>Go from raw idea to clear verdict, then to a <span>build-ready blueprint</span></h2>
              <p className="title-text mt-2 font-weight-500">IdeaReels gives founders the fast answer first: should you build this or walk away?</p>
            </div>
            <div className="gt-section-info d-flex align-items-center gap-3">
              <div className="client-image">
                <img src="/boostly/assets/img/new-add/c1.png" alt="" />
                <img src="/boostly/assets/img/new-add/c2.png" alt="" />
                <img src="/boostly/assets/img/new-add/c3.png" alt="" />
                <i className="fa-solid fa-plus icon" />
              </div>
              <p>3 free credits <br /> on every new account</p>
            </div>
          </div>
          <div className="row">
            {LANDING_STEPS.map((item) => (
              <div key={item.number} className="col-xl-4 col-lg-6 col-md-6">
                <div className="gt-feature-box-items">
                  <div className="gt-number-box"><span>{item.number}</span><div className="bg-border-style" /></div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                  <div className="hover-lines" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="gt-brand-section section-padding pt-0">
        <div className="container">
          <div className="gt-brand-wrapper">
            <h2 className="seco-tool-text">
              Validate ideas in <span className="color-1">under 30 seconds</span>, spend credits only on the strongest opportunities, and hand the winners to <span className="color-3">four AI specialists</span> for execution.
            </h2>
            <h5>Built for founders who want signal before commitment</h5>
            <div className="row g-4 mt-4">
              {[['3', 'Free credits on signup'], ['4', 'AI specialists per blueprint'], ['<30s', 'Time to first market check']].map(([value, label]) => (
                <div key={label} className="col-md-4">
                  <div className="gt-pricing-box-items style-2 text-center h-100 ideareels-stat-card">
                    <div className="gt-pricing-header">
                      <h2>{value}</h2>
                      <span className="sub-texts">{label}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="gt-testimonial-section section-padding section-bg-4">
        <div className="container">
          <div className="gt-section-title text-center style-3">
            <h6>Testimonials</h6>
            <h2>What founders are <span>saying</span></h2>
          </div>
          <div className="row mt-4">
            {LANDING_TESTIMONIALS.map((item) => (
              <div key={item.name} className="col-lg-4 col-md-6 mb-4">
                <div className="gt-pricing-box-items style-2 h-100">
                  <div className="mb-3" style={{ color: '#ffb11a' }}>★★★★★</div>
                  <p>{item.text}</p>
                  <div className="mt-4">
                    <h5 className="mb-1">{item.name}</h5>
                    <span className="sub-texts">{item.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="gt-pricing-section fix section-padding bg-cover" style={{ backgroundImage: "url('/boostly/assets/img/home-1/pricing-bg.jpg')" }}>
        <div className="pricing-bg-shape"><img src="/boostly/assets/img/new-add/pricing-bg-shape.png" alt="" /></div>
        <div className="pricing-right-shape"><img src="/boostly/assets/img/home-1/pricing-right.png" alt="" /></div>
        <div className="container">
          <div className="gt-section-title text-center">
            <h6>Pricing</h6>
            <h2>Simple, transparent pricing for <span>serious idea hunters</span></h2>
            <p className="mt-3">Start free. Pay only when you want deeper research or a full blueprint.</p>
          </div>
          <div className="row">
            {CREDIT_PACKAGES.map((pkg) => (
              <div key={pkg.key} className="col-xl-4 col-lg-6 col-md-6 mb-4">
                <div className={`gt-pricing-box-items style-2 h-100 ${pkg.highlight ? 'active-2' : ''}`}>
                  <div className="gt-pricing-header">
                    <h2>{pkg.price}</h2>
                    <span className="sub-texts">{pkg.label}</span>
                  </div>
                  <Link href="/pricing" className="gt-theme-btn">{pkg.highlight ? 'buy most popular pack' : 'view pricing details'}</Link>
                  <ul className="gt-pricing-list">
                    <li><i className="fa-solid fa-circle-check" />{pkg.credits} credits included</li>
                    <li><i className="fa-solid fa-circle-check" />Free validation on every idea</li>
                    <li><i className="fa-solid fa-circle-check" />1 credit for extended research</li>
                    <li><i className="fa-solid fa-circle-check" />2 credits for full blueprint</li>
                    <li><i className="fa-solid fa-circle-check" />{pkg.tagline}</li>
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="gt-faq-section fix section-padding pb-0">
        <div className="faq-left-shape"><img src="/boostly/assets/img/home-1/faq-left-shape.png" alt="" /></div>
        <div className="right-shape"><img src="/boostly/assets/img/home-1/pricing-right-shape.png" alt="" /></div>
        <div className="container">
          <div className="gt-section-title text-center">
            <h6>FAQ</h6>
            <h2><span>Frequently</span> Asked Questions</h2>
            <p className="mt-3">Everything you need to know before you spin your next idea.</p>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="gt-faq-wrapper">
                <FaqAccordion items={FAQS.slice(0, 5)} id="landing-faq" />
              </div>
            </div>
          </div>
        </div>
        <div className="gt-cta-section section-padding">
          <div className="container">
            <div className="cta-box-items zoom-effect-style bg-cover" style={{ backgroundImage: "url('/boostly/assets/img/home-1/cta-bg.jpg')" }}>
              <div className="cta-content">
                <div className="gt-section-title mb-0 text-center">
                  <h6>Blueprint CTA</h6>
                  <h2>Take your startup idea to the next level</h2>
                  <p className="mt-3">Spin an idea, validate it instantly, and unlock the full plan only when the verdict says it deserves more time.</p>
                  <Link href="/wheel" className="gt-theme-btn">start for free</Link>
                </div>
                <ul>
                  <li>3 free credits on signup</li>
                  <li>No credit card required</li>
                  <li>Keep only the winners</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

    </PublicShell>
  );
}

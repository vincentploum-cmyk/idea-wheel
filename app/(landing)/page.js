import Link from 'next/link';
import PublicShell from '@/components/intellio/PublicShell';
import FaqAccordion from '@/components/intellio/FaqAccordion';
import { FAQS, LANDING_STEPS, LANDING_TESTIMONIALS } from '@/components/intellio/data';
import { CREDIT_PACKAGES } from '@/lib/pricing';

export const metadata = {
  title: 'IdeaReels — Find a startup idea worth building.',
  description: 'Generate sharper business ideas in seconds, run a quick market check, and unlock a build-ready blueprint only when one is worth pursuing.',
};

const benefits = [
  'Generate business ideas from concrete market wedges, not vague prompts.',
  'Get a fast validation verdict before you spend time building the wrong thing.',
  'Unlock a 4-agent blueprint only when the signal says the idea deserves it.',
];

const stats = [
  ['3 free credits', 'On signup'],
  ['4 AI specialists', 'In every full blueprint'],
  ['<30s', 'To reach a market verdict'],
];

export default function LandingPage() {
  return (
    <PublicShell>
      <section className="startup-banner-section" style={{ backgroundImage: "url('/intellio-images/demo-img/banner-bg2.png')" }}>
        <div className="auto-container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="startup-banner-content intellio-hero-copy">
                <h5>Idea validation, before the busywork</h5>
                <h1>Find a startup idea <span>worth building.</span></h1>
                <p>Generate sharper business ideas in seconds, run a quick market check, and unlock a build-ready blueprint only when one is worth pursuing.</p>
                <div className="banner-btn">
                  <Link href="/wheel" className="primary">Get started free</Link>
                  <Link href="/#how-it-works" className="border-btn">See how it works</Link>
                </div>
                <ul className="intellio-trust-list">
                  <li><i className="fa-regular fa-circle-check" />3 free credits on signup</li>
                  <li><i className="fa-regular fa-circle-check" />No credit card required</li>
                </ul>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="startup-banner-thumb intellio-hero-visual">
                <img src="/intellio-images/demo-img/banner-thumb21.png" alt="IdeaReels dashboard preview" />
                <div className="intellio-floating-card intellio-floating-card-one">
                  <strong>Build</strong>
                  <span>Free market check clears the idea first.</span>
                </div>
                <div className="intellio-floating-card intellio-floating-card-two">
                  <strong>Blueprint ready</strong>
                  <span>Product, GTM, infra, prototype.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="feature-section-three section-padding">
        <div className="auto-container">
          <div className="row align-items-end mb-5">
            <div className="col-lg-7">
              <div className="section-title style-two">
                <h5>How it works</h5>
                <h2>Go from raw idea to clear verdict, then to a <span>build-ready blueprint</span></h2>
              </div>
            </div>
            <div className="col-lg-5">
              <p className="intellio-section-copy">IdeaReels gives founders the fast answer first: should you build this or walk away?</p>
            </div>
          </div>
          <div className="row">
            {LANDING_STEPS.map((item) => (
              <div key={item.number} className="col-xl-4 col-lg-6 col-md-6">
                <div className="feature-single-box style-three intellio-step-card">
                  <div className="feature-icon">
                    <span>{item.number}</span>
                  </div>
                  <div className="feature-content">
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section-five section-padding pt-0">
        <div className="auto-container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="about-thumb intellio-about-thumb">
                <img src="/intellio-images/demo-img/feature-thumb31.png" alt="IdeaReels research workflow" />
              </div>
            </div>
            <div className="col-lg-6">
              <div className="section-title style-two">
                <h5>Why founders use it</h5>
                <h2>Signal first, deeper work <span>only when earned</span></h2>
              </div>
              <ul className="intellio-benefit-list">
                {benefits.map((benefit) => (
                  <li key={benefit}><i className="fa-solid fa-check" />{benefit}</li>
                ))}
              </ul>
              <div className="row intellio-stat-grid">
                {stats.map(([value, label]) => (
                  <div key={label} className="col-sm-4">
                    <div className="counter-single-box">
                      <h2>{value}</h2>
                      <p>{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="testimonial-section-three section-padding">
        <div className="auto-container">
          <div className="section-title text-center style-two">
            <h5>Testimonials</h5>
            <h2>What founders are <span>saying</span></h2>
          </div>
          <div className="row">
            {LANDING_TESTIMONIALS.map((item) => (
              <div key={item.name} className="col-lg-4 col-md-6">
                <div className="testimonial-single-box style-three intellio-testimonial-card">
                  <div className="testimonial-content">
                    <div className="intellio-stars">★★★★★</div>
                    <p>{item.text}</p>
                    <h4>{item.name}</h4>
                    <span>{item.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pricing-section section-padding">
        <div className="auto-container">
          <div className="section-title text-center style-two">
            <h5>Pricing</h5>
            <h2>Simple, transparent pricing for <span>serious idea hunters</span></h2>
            <p>Start free. Pay only when you want deeper research or a full blueprint.</p>
          </div>
          <div className="row">
            {CREDIT_PACKAGES.map((pkg) => (
              <div key={pkg.key} className="col-xl-4 col-lg-6 col-md-6">
                <div className={`pricing-single-item intellio-price-card ${pkg.highlight ? 'active' : ''}`}>
                  <h3 className="pricing-plan">{pkg.label}</h3>
                  <div className="pricing-money"><h3>{pkg.price}</h3></div>
                  <div className="pricing-desc"><p>{pkg.tagline}</p></div>
                  <div className="pricing-btn">
                    <Link href="/pricing">{pkg.highlight ? 'Buy most popular pack' : 'View pricing details'}<i className="fa-light fa-arrow-right" /></Link>
                  </div>
                  <div className="pricing-body">
                    <div className="pricing-title"><h4>What you get</h4></div>
                    <div className="pricing-feature">
                      <ul>
                        <li><span><img src="/intellio-images/demo-img/check.png" alt="check" /></span>{pkg.credits} credits included</li>
                        <li><span><img src="/intellio-images/demo-img/check.png" alt="check" /></span>Free validation on every idea</li>
                        <li><span><img src="/intellio-images/demo-img/check.png" alt="check" /></span>1 credit for extended research</li>
                        <li><span><img src="/intellio-images/demo-img/check.png" alt="check" /></span>2 credits for the full blueprint</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="accordion-page-title section-padding pt-0" style={{ backgroundImage: "url('/intellio-images/inner-img/faq-bg.jpg')" }}>
        <div className="auto-container">
          <div className="section-title text-center style-two">
            <h5>FAQ</h5>
            <h2>Everything you need to know <span>before you build</span></h2>
          </div>
          <div className="row justify-content-center">
            <div className="col-xl-8 col-lg-10">
              <FaqAccordion items={FAQS} id="landing-faq" />
            </div>
          </div>
        </div>
      </section>

      <section className="call-to-action-four">
        <div className="auto-container">
          <div className="call-do-action-content intellio-final-cta" style={{ backgroundImage: "url('/intellio-images/demo-img/call-to-bg.png')" }}>
            <h2>Take your startup idea to the next level</h2>
            <p>Spin an idea, validate it instantly, and unlock the full plan only when the verdict says it deserves more time.</p>
            <div className="banner-btn justify-content-center">
              <Link href="/wheel" className="primary">Start for free</Link>
              <Link href="/pricing" className="border-btn">See pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

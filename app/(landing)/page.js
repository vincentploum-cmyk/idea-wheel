import Link from "next/link";
import IdeaReelsHeader from "@/components/zubaz/Common/Header/IdeaReelsHeader";
import StateSection from "@/components/zubaz/Home3/State/State";
import IntegrationTwo from "@/components/zubaz/Common/Integration-2/IntegrationTwo";

export const metadata = {
  title: "IdeaReels — Spin an idea. Ship a company.",
  description:
    "Generate sharper business ideas in seconds, run a quick market check, and unlock a build-ready blueprint only when one is worth pursuing.",
};

export default function LandingPage() {
  return (
    <>
      <IdeaReelsHeader />

      {/* Hero */}
      <div className="zubuz-hero-section">
        <div className="container">
          <div className="zubuz-hero-content center">
            <h1>
              Find a startup idea{" "}
              <span className="zubuz-title-shape">
                worth building.
                <img src="/zubaz/images/v3/shape-v3-01.png" alt="" />
              </span>
            </h1>
            <p>
              Generate sharper business ideas in seconds, run a quick market
              check, and unlock a build-ready blueprint only when one is worth
              pursuing.
            </p>
            <div className="zubuz-extara-mt">
              <div className="zubuz-subscribe-three">
                <div className="zubuz-hero-btn-wrap" style={{ justifyContent: "center", display: "flex", gap: "1rem" }}>
                  <Link href="/wheel" className="zubuz-default-btn zubuz-subscription-btn three">
                    <span>Get started free</span>
                  </Link>
                  <Link href="#how-it-works" className="zubuz-login-btn">
                    See how it works
                  </Link>
                </div>
              </div>
              <div className="zubuz-icon-list">
                <ul>
                  <li>
                    <img src="/zubaz/images/v3/check.png" alt="" /> 3 free
                    credits on signup
                  </li>
                  <li>
                    <img src="/zubaz/images/v3/check.png" alt="" /> No credit
                    card required
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="zubuz-border-btoom">
            <div className="zubuz-hero-thumb3">
              <img src="/zubaz/images/v3/thumb-v3-01.png" alt="" />
              <div className="zubuz-hero-thumb-card1">
                <img src="/zubaz/images/v3/card-v3-1.png" alt="" />
              </div>
              <div className="zubuz-hero-thumb-card2">
                <img src="/zubaz/images/v3/card-v3-2.png" alt="" />
              </div>
              <div className="zubuz-hero-thumb-card3">
                <img src="/zubaz/images/v3/card-v3-3.png" alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="section zubuz-section-padding3">
        <div className="container">
          <div className="zubuz-section-title zubuz-two-column-title">
            <div className="row">
              <div className="col-lg-7">
                <h2>How IdeaReels works</h2>
              </div>
              <div className="col-lg-5 d-flex align-items-center">
                <div className="zubuz-title-btn">
                  <Link className="zubuz-default-btn pill" href="/wheel">
                    <span>Try it now</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            {[
              {
                icon: "/zubaz/images/icon/feature5.svg",
                title: "Generate a business idea worth chasing",
                desc: "Combine proven actions, real workflows, and target industries to uncover concrete startup concepts — not vague inspiration.",
              },
              {
                icon: "/zubaz/images/icon/feature6.svg",
                title: "Know if it's worth building before you commit",
                desc: "Every idea gets a free market check with competitor analysis, market size, and demand signals — build, caution, or avoid.",
              },
              {
                icon: "/zubaz/images/icon/feature7.svg",
                title: "Turn the winner into a build-ready plan",
                desc: "Unlock a full blueprint: product design, launch strategy, infrastructure, and prototype generation across four AI specialists.",
              },
            ].map((item, i) => (
              <div key={i} className="col-lg-4 col-md-6">
                <div className="zubuz-iconbox-wrap-two">
                  <div className="zubuz-iconbox-icon">
                    <img src={item.icon} alt="" />
                  </div>
                  <div className="zubuz-iconbox-data">
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content Block 1 — Market Validation */}
      <div className="section zubuz-section-padding3">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="zubuz-thumb">
                <img src="/zubaz/images/v3/thumb-v3-02.png" alt="" />
              </div>
            </div>
            <div className="col-lg-6">
              <div className="zubuz-content-area">
                <div className="zubuz-section-title">
                  <h2>Agility to validate ideas before you waste time</h2>
                </div>
                <div className="zubuz-iconbox-wrap">
                  <div className="zubuz-iconbox-icon">
                    <img src="/zubaz/images/icon/check-circle.svg" alt="" />
                  </div>
                  <div className="zubuz-iconbox-data">
                    <h5>Instant market check</h5>
                    <p>
                      Competitor analysis, market size, and demand signals
                      surface within seconds so you know where to focus.
                    </p>
                  </div>
                </div>
                <div className="zubuz-iconbox-wrap">
                  <div className="zubuz-iconbox-icon">
                    <img src="/zubaz/images/icon/check-circle.svg" alt="" />
                  </div>
                  <div className="zubuz-iconbox-data">
                    <h5>Clear build/avoid verdict</h5>
                    <p>
                      Every idea returns a plain-language build, caution, or
                      avoid verdict — no ambiguity, no wasted commitment.
                    </p>
                  </div>
                </div>
                <div className="zubuz-iconbox-wrap">
                  <div className="zubuz-iconbox-icon">
                    <img src="/zubaz/images/icon/check-circle.svg" alt="" />
                  </div>
                  <div className="zubuz-iconbox-data">
                    <h5>Blueprint unlocked only when it's worth it</h5>
                    <p>
                      Extended deep research and the full plan cost 1–2 credits
                      — you spend only on ideas that clear the bar.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Block 2 — Blueprint */}
      <div className="section zubuz-section-padding3">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6 order-lg-2">
              <div className="zubuz-thumb">
                <img src="/zubaz/images/v3/thumb-v3-03.png" alt="" />
              </div>
            </div>
            <div className="col-lg-6 order-lg-1">
              <div className="zubuz-content-area">
                <div className="zubuz-section-title">
                  <h2>Cost-effective and simple — from idea to blueprint</h2>
                </div>
                <p>
                  Every new account starts with 3 free credits. The full
                  blueprint unlocks four AI specialists — product design,
                  go-to-market, infrastructure, and prototype — in one click.
                </p>
                <div className="zubuz-counter-wrap3" style={{ marginTop: "2rem" }}>
                  <div className="zubuz-counter-data">
                    <h2>3</h2>
                    <p>Free credits on signup</p>
                  </div>
                  <div className="zubuz-counter-data">
                    <h2>4</h2>
                    <p>AI specialists per blueprint</p>
                  </div>
                  <div className="zubuz-counter-data">
                    <h2>&lt;30s</h2>
                    <p>Time to first market check</p>
                  </div>
                </div>
                <Link href="/wheel" className="zubuz-default-btn pill" style={{ marginTop: "2rem", display: "inline-block" }}>
                  <span>Start for free</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <StateSection />

      {/* Pricing */}
      <div className="section zubuz-section-padding3">
        <div className="container">
          <div className="zubuz-section-title center">
            <h2>Simple, transparent pricing</h2>
            <p>Start free. Pay only for ideas worth pursuing.</p>
          </div>
          <div className="row justify-content-center">
            {[
              {
                name: "Starter",
                price: "Free",
                desc: "3 credits on signup. Perfect for exploring.",
                features: [
                  "3 idea generations",
                  "Free market check per idea",
                  "Build / caution / avoid verdict",
                  "No credit card required",
                ],
                active: false,
                cta: "Get started free",
                href: "/wheel",
              },
              {
                name: "Explorer",
                price: "$9",
                desc: "10 credits. For serious idea hunters.",
                features: [
                  "10 credits",
                  "Market check on every idea",
                  "1 credit = extended deep research",
                  "2 credits = full AI blueprint",
                ],
                active: true,
                cta: "Buy Explorer pack",
                href: "/pricing",
              },
              {
                name: "Builder",
                price: "$19",
                desc: "25 credits. For founders moving fast.",
                features: [
                  "25 credits",
                  "Everything in Explorer",
                  "Priority generation queue",
                  "Email support",
                ],
                active: false,
                cta: "Buy Builder pack",
                href: "/pricing",
              },
            ].map((plan, i) => (
              <div key={i} className="col-xl-4 col-md-6">
                <div className={`zubuz-pricing-wrap${plan.active ? " active" : ""}`}>
                  <div className="zubuz-pricing-header">
                    <h5>{plan.name}</h5>
                  </div>
                  <div className="zubuz-pricing-price">
                    <h2>{plan.price}</h2>
                  </div>
                  <div className="zubuz-pricing-description">
                    <p>{plan.desc}</p>
                  </div>
                  <div className="zubuz-pricing-body">
                    <ul>
                      {plan.features.map((f, j) => (
                        <li key={j}>
                          <img src="/zubaz/images/v3/check.png" alt="" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link
                    className={`zubuz-pricing-btn${plan.active ? " active" : ""}`}
                    href={plan.href}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="section zubuz-section-padding3">
        <div className="container">
          <div className="zubuz-section-title center">
            <h2>Find all the answers to your questions</h2>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-8">
              {[
                {
                  q: "How does the market check work?",
                  a: "When you generate an idea, IdeaReels immediately runs a free market check — pulling competitor data, market size signals, and demand indicators. You get a build, caution, or avoid verdict before spending any credits.",
                },
                {
                  q: "What does a blueprint include?",
                  a: "A full blueprint (2 credits) runs four AI specialists in parallel: product design, go-to-market strategy, infrastructure plan, and a prototype spec. Each specialist writes a detailed, actionable section.",
                },
                {
                  q: "Do credits expire?",
                  a: "No — credits never expire. Buy a pack when you need it and use them at your own pace.",
                },
                {
                  q: "Can I generate my own idea instead of using the wheel?",
                  a: "Yes. You can spin the wheel for a random concept or type in your own idea and run it through the market check and blueprint pipeline.",
                },
                {
                  q: "Is IdeaReels suitable for non-technical founders?",
                  a: "Absolutely. The market check and blueprint are written in plain language with no jargon. The infrastructure section explains what you'd need without requiring you to be an engineer.",
                },
              ].map((item, i) => (
                <div key={i} className="zubuz-accordion-wrap">
                  <div className="accordion" id={`faq-${i}`}>
                    <div className="accordion-item">
                      <h2 className="accordion-header">
                        <button
                          className="accordion-button collapsed"
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target={`#collapse-${i}`}
                        >
                          {item.q}
                        </button>
                      </h2>
                      <div
                        id={`collapse-${i}`}
                        className="accordion-collapse collapse"
                        data-bs-parent={`#faq-${i}`}
                      >
                        <div className="accordion-body">
                          <p>{item.a}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA + Footer */}
      <footer className="zubuz-footer-section dark-bg">
        <div className="container">
          <div className="zubuz-footer-extra-top">
            <div className="row">
              <div className="col-lg-7">
                <div className="zubuz-footer-extra-title">
                  <h2>Take your startup idea to the next level</h2>
                </div>
              </div>
              <div className="col-lg-5 d-flex align-items-center">
                <div className="zubuz-footer-btn">
                  <Link className="zubuz-default-btn pill" href="/wheel">
                    <span>Get started now</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="zubuz-footer-top">
            <div className="row">
              <div className="col-xl-4 col-lg-12">
                <div className="zubuz-footer-textarea light">
                  <Link href="/">
                    <strong style={{ color: "white", fontSize: "1.25rem" }}>IdeaReels</strong>
                  </Link>
                  <p>
                    Spin an idea. Validate it instantly. Ship a company.
                  </p>
                </div>
              </div>
              <div className="col-xl-2 col-lg-3 col-md-6">
                <div className="zubuz-footer-menu light">
                  <h6>Product</h6>
                  <ul>
                    <li><Link href="/wheel">Idea Generator</Link></li>
                    <li><Link href="/pricing">Pricing</Link></li>
                    <li><Link href="/faq">FAQ</Link></li>
                  </ul>
                </div>
              </div>
              <div className="col-xl-2 col-lg-3 col-md-6">
                <div className="zubuz-footer-menu light">
                  <h6>Legal</h6>
                  <ul>
                    <li><Link href="/privacy">Privacy Policy</Link></li>
                    <li><Link href="/terms">Terms of Service</Link></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="zubuz-footer-bottom light">
            <p>© {new Date().getFullYear()} IdeaReels. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

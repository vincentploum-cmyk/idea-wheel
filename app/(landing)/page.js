import Link from "next/link";
import IdeaReelsHeader from "@/components/zubaz/Common/Header/IdeaReelsHeader";
import StateSection from "@/components/zubaz/Home3/State/State";
import { CREDIT_PACKAGES } from "@/lib/pricing";

export const metadata = {
  title: "IdeaReels — Spin up your next weekend build",
  description:
    "For vibe coders, indie hackers, and solo builders. Spin the wheel, get a market sanity check, and unlock a build-ready blueprint when an idea feels real.",
};

const PLAN_COPY = {
  starter: {
    desc: "Good for your first real IdeaReels session.",
    features: [
      "5 credits",
      "Enough to explore a few strong angles",
      "Great first paid pack",
      "No subscription",
    ],
    cta: "Buy Starter",
  },
  pro: {
    desc: "Best for a focused night of spinning, researching, and picking a winner.",
    features: [
      "10 credits",
      "Best value for most builders",
      "Plenty for multiple deep dives",
      "No subscription",
    ],
    cta: "Buy Pro",
  },
  power: {
    desc: "For builders testing multiple niches or shipping more than one project.",
    features: [
      "25 credits",
      "Built for multi-idea exploration",
      "Keep momentum across projects",
      "No subscription",
    ],
    cta: "Buy Power",
  },
};

const FAQ_ITEMS = [
  {
    q: "Who is IdeaReels for?",
    a: "Vibe coders, indie hackers, solo builders, and curious founders who want something more concrete than a blank Cursor prompt.",
  },
  {
    q: "What happens after I spin the wheel?",
    a: "You get a niche, pain point, and angle, then a fast market verdict. If it still feels real, you can spend credits on deeper research or the full blueprint.",
  },
  {
    q: "Do I need an account?",
    a: "Yes, before you spin for real. Sign-in unlocks your 3 free credits and lets IdeaReels save your research and blueprints to your profile.",
  },
  {
    q: "What does the blueprint give me?",
    a: "A build-ready package: product scope, go-to-market angle, infrastructure plan, prototype direction, and a first prompt for Cursor, Claude, or Codex.",
  },
  {
    q: "What if the verdict says avoid?",
    a: "That is a win. IdeaReels is supposed to save you from wasting a weekend on weak ideas, not push every spin into a purchase.",
  },
];

export default function LandingPage() {
  const plans = [
    {
      key: "free",
      name: "Free",
      price: "$0",
      desc: "Sign in and get 3 free credits to try the flow properly.",
      features: [
        "3 free credits after sign-in",
        "Spin the wheel and save ideas",
        "Get the fast market verdict",
        "Perfect for your first session",
      ],
      active: false,
      cta: "Try the wheel",
      href: "/wheel",
    },
    ...CREDIT_PACKAGES.map((pkg) => ({
      key: pkg.key,
      name: pkg.label,
      price: pkg.price,
      desc: PLAN_COPY[pkg.key]?.desc || pkg.tagline,
      features: PLAN_COPY[pkg.key]?.features || [`${pkg.credits} credits`, pkg.tagline],
      active: pkg.highlight,
      cta: PLAN_COPY[pkg.key]?.cta || "Buy credits",
      href: "/pricing",
    })),
  ];

  return (
    <>
      <IdeaReelsHeader />

      <div className="zubuz-hero-section">
        <div className="container">
          <div className="zubuz-hero-content center">
            <h1>Spin up an idea worth building tonight.</h1>
            <p>
              Spin into a niche, pain point, and build angle. Get a fast market
              verdict. Go deeper only when the idea earns it.
            </p>
            <div className="zubuz-extara-mt">
              <div className="zubuz-subscribe-three">
                <div className="zubuz-hero-btn-wrap" style={{ justifyContent: "center", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <Link href="/wheel" className="zubuz-default-btn zubuz-subscription-btn three">
                    <span>Try the wheel</span>
                  </Link>
                  <Link href="/pricing" className="zubuz-login-btn">
                    See credit packs
                  </Link>
                </div>
              </div>
              <div className="zubuz-icon-list">
                <ul>
                  <li>
                    <img src="/zubaz/images/v3/check.png" alt="" /> 3 free
                    credits after sign-in
                  </li>
                  <li>
                    <img src="/zubaz/images/v3/check.png" alt="" /> Cursor-ready
                    blueprint when a spin hits
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

      <div id="how-it-works" className="section zubuz-section-padding3">
        <div className="container">
          <div className="zubuz-section-title zubuz-two-column-title">
            <div className="row">
              <div className="col-lg-7">
                <h2>How IdeaReels fits the way vibe coders work</h2>
              </div>
              <div className="col-lg-5 d-flex align-items-center">
                <div className="zubuz-title-btn">
                  <Link className="zubuz-default-btn pill" href="/wheel">
                    <span>Start spinning</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            {[
              {
                icon: "/zubaz/images/icon/feature5.svg",
                title: "Land on a concrete starting point",
                desc: "Instead of staring at a blank prompt, you start with a specific niche, workflow, and buyer angle you can picture building this weekend.",
              },
              {
                icon: "/zubaz/images/icon/feature6.svg",
                title: "Pressure-test it before you overcommit",
                desc: "IdeaReels gives you a quick market verdict so you can tell the difference between fun nonsense and something with plausible pull.",
              },
              {
                icon: "/zubaz/images/icon/feature7.svg",
                title: "Go deeper only when the spin feels real",
                desc: "Credits unlock deeper research and the full build blueprint, so you pay for momentum, not for filler.",
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
                  <h2>Built for weekend builders, not pitch-deck theater</h2>
                </div>
                <div className="zubuz-iconbox-wrap">
                  <div className="zubuz-iconbox-icon">
                    <img src="/zubaz/images/icon/check-circle.svg" alt="" />
                  </div>
                  <div className="zubuz-iconbox-data">
                    <h5>Start from something plausible</h5>
                    <p>
                      The wheel is playful, but the combinations are curated so you
                      land on ideas that feel buildable instead of random.
                    </p>
                  </div>
                </div>
                <div className="zubuz-iconbox-wrap">
                  <div className="zubuz-iconbox-icon">
                    <img src="/zubaz/images/icon/check-circle.svg" alt="" />
                  </div>
                  <div className="zubuz-iconbox-data">
                    <h5>Kill weak ideas fast</h5>
                    <p>
                      The fast verdict exists to save your time. A clear avoid is as
                      useful as a promising green light.
                    </p>
                  </div>
                </div>
                <div className="zubuz-iconbox-wrap">
                  <div className="zubuz-iconbox-icon">
                    <img src="/zubaz/images/icon/check-circle.svg" alt="" />
                  </div>
                  <div className="zubuz-iconbox-data">
                    <h5>Keep the builder momentum alive</h5>
                    <p>
                      When you do buy credits, they turn curiosity into next steps,
                      not generic advice.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                  <h2>When a spin hits, you get the next moves fast</h2>
                </div>
                <p>
                  Deep research pulls in demand language and sharper signal. The full
                  blueprint turns that idea into product scope, launch angle,
                  infrastructure, and a first prompt you can paste straight into your
                  coding stack.
                </p>
                <div className="zubuz-counter-wrap3" style={{ marginTop: "2rem" }}>
                  <div className="zubuz-counter-data">
                    <h2>3</h2>
                    <p>Free credits after sign-in</p>
                  </div>
                  <div className="zubuz-counter-data">
                    <h2>1</h2>
                    <p>Credit for deeper research</p>
                  </div>
                  <div className="zubuz-counter-data">
                    <h2>2</h2>
                    <p>Credits for the blueprint</p>
                  </div>
                </div>
                <Link href="/wheel" className="zubuz-default-btn pill" style={{ marginTop: "2rem", display: "inline-block" }}>
                  <span>See the wheel</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <StateSection />

      <div className="section zubuz-section-padding3">
        <div className="container">
          <div className="zubuz-section-title center">
            <h2>Start free. Top up only when you want more signal.</h2>
            <p>IdeaReels is built for low-friction curiosity first, paid depth second.</p>
          </div>
          <div className="row justify-content-center">
            {plans.map((plan) => (
              <div key={plan.key} className="col-xl-3 col-md-6">
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
                      {plan.features.map((feature, j) => (
                        <li key={j}>
                          <img src="/zubaz/images/v3/check.png" alt="" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link className={`zubuz-pricing-btn${plan.active ? " active" : ""}`} href={plan.href}>
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section zubuz-section-padding3">
        <div className="container">
          <div className="zubuz-section-title center">
            <h2>Questions a buyer asks before topping up</h2>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-8">
              {FAQ_ITEMS.map((item, i) => (
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

      <footer className="zubuz-footer-section dark-bg">
        <div className="container">
          <div className="zubuz-footer-extra-top">
            <div className="row">
              <div className="col-lg-7">
                <div className="zubuz-footer-extra-title">
                  <h2>Ready to find the next thing you&apos;ll actually ship?</h2>
                </div>
              </div>
              <div className="col-lg-5 d-flex align-items-center">
                <div className="zubuz-footer-btn">
                  <Link className="zubuz-default-btn pill" href="/wheel">
                    <span>Try the wheel</span>
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
                    Spin into a buildable idea, sanity-check it fast, then go deep
                    only when it deserves your time.
                  </p>
                </div>
              </div>
              <div className="col-xl-2 col-lg-3 col-md-6">
                <div className="zubuz-footer-menu light">
                  <h6>Product</h6>
                  <ul>
                    <li><Link href="/wheel">Wheel</Link></li>
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

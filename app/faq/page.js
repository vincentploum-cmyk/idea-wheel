"use client";
import { useState } from "react";
import ZubazShell from "@/components/zubaz/ZubazShell";

const FAQS = [
  {
    q: "What is IdeaReels?",
    a: "IdeaReels is an AI-powered startup ideation tool. Spin three reels to land on a business concept, get a free market validation, then unlock a full blueprint: product design, go-to-market plan, infrastructure, and a clickable prototype.",
  },
  {
    q: "Is the market validation really free?",
    a: "Yes, completely. You can spin ideas and run the market check as many times as you want at no cost. You only spend a credit when you decide the opportunity is strong enough to build a full blueprint.",
  },
  {
    q: "What does a credit unlock?",
    a: "Deep market research costs 1 credit — it digs through Reddit, forums and communities for real demand signals. The full blueprint costs 2 credits and runs a 4-agent AI pipeline: a product designer names your product and specs the features, a launch strategist writes your first-customer plan and 30-day roadmap, an infrastructure architect details every service you need to sign up for, and a prototype builder ships a clickable HTML demo you can test immediately. Every new account starts with 3 free credits.",
  },
  {
    q: "How many free spins do I get?",
    a: "New visitors get 3 free spins to try the wheel and market validation — no account needed. Once you sign up, you can keep spinning and validating for free. Credits are only spent on blueprints.",
  },
  {
    q: "Can two users get the same idea?",
    a: "Unlikely. There are thousands of unique combinations across B2B and consumer modes — and the AI validation layer adds another dimension of specificity. Even if two users land on the same base combination, the competitor landscape, gap analysis, and blueprint output are generated fresh each time.",
  },
  {
    q: "How does the AI validation work?",
    a: "When you hit 'Validate', a Claude-powered scout agent runs a live web search to find real competitors in that space, maps the market size, scores demand, and identifies the gap you could exploit. You get a plain-English build, caution, or avoid verdict — not a generic summary.",
  },
  {
    q: "How accurate is the market data?",
    a: "The AI pulls from publicly available information via real-time web search, so it reflects current market conditions. That said, AI-generated research can be incomplete or outdated. Always treat it as a starting point for your own due diligence, not as professional business advice.",
  },
  {
    q: "What's in the blueprint?",
    a: "The full blueprint includes: a product spec (name, tagline, differentiator, core features), a launch plan (target customer, first 5 customers, pricing rationale, 30-day action plan), an infrastructure breakdown (services to sign up for, env template, DB schema, deploy steps, monthly cost estimate), and a clickable prototype.",
  },
  {
    q: "Do credits expire?",
    a: "No. Credits are linked to your account and never expire. Buy when you need them, use them at your own pace.",
  },
  {
    q: "What if the market check says 'avoid'?",
    a: "No credit is spent. The avoid verdict means the market is too crowded or the demand signal is too weak to justify the blueprint investment. Spin a new idea and validate again — it's free every time.",
  },
  {
    q: "How do I get a refund?",
    a: "If you experience a technical issue that prevents a blueprint from generating, we'll refund the credit automatically. For billing issues, contact us at support@ideareels.io and we'll sort it within 24 hours.",
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="accordion-item">
      <h2 className="accordion-header">
        <button
          className={`accordion-button${open ? "" : " collapsed"}`}
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{ background: "none", boxShadow: "none", fontWeight: 600 }}
        >
          {q}
        </button>
      </h2>
      {open && (
        <div className="accordion-collapse">
          <div className="accordion-body" style={{ color: "#463a5f", lineHeight: 1.75 }}>
            {a}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  return (
    <ZubazShell>
      <section className="section zubuz-section-padding3">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="zubuz-section-title center" style={{ textAlign: "center", marginBottom: "2rem" }}>
                <h2>Frequently asked questions</h2>
                <p>Everything you need to know about IdeaReels.</p>
              </div>
              <div className="accordion zubuz-accordion-wrap">
                {FAQS.map((f, i) => <FaqItem key={i} {...f} />)}
              </div>
              <div style={{ marginTop: "3rem", textAlign: "center", padding: "2rem", border: "1px solid #ece6f5", borderRadius: "1rem" }}>
                <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Still have questions?</p>
                <a href="mailto:support@ideareels.io" className="zubuz-default-btn pill" style={{ display: "inline-block", marginTop: "0.5rem" }}>
                  <span>support@ideareels.io</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </ZubazShell>
  );
}

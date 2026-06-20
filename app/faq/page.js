"use client";
import { useState } from "react";
import ZubazShell from "@/components/zubaz/ZubazShell";

const FAQS = [
  {
    q: "What is IdeaReels?",
    a: "IdeaReels is a startup idea wheel for vibe coders. It gives you a niche, pain point, and angle, then helps you decide whether that idea is worth building further.",
  },
  {
    q: "Who is this built for?",
    a: "Indie hackers, solo builders, curiosity-driven founders, and anyone who likes shipping fast with Cursor, Claude, Codex, or similar tools.",
  },
  {
    q: "Do I need an account before I use it?",
    a: "Yes. Sign-in unlocks your 3 free credits and makes sure your ideas, research, and blueprints are saved to your profile instead of disappearing.",
  },
  {
    q: "What is free and what costs credits?",
    a: "You get 3 free credits after sign-in. Deeper market research costs 1 credit. The full blueprint costs 2 credits. Credit packs are there for the moments when a spin feels worth chasing.",
  },
  {
    q: "What does the blueprint include?",
    a: "A product concept, positioning, launch angle, infrastructure plan, prototype direction, and a first prompt you can drop into Cursor, Claude, or Codex to keep building.",
  },
  {
    q: "What if the verdict says avoid?",
    a: "That is still a useful outcome. IdeaReels exists to help you kill weak ideas quickly so you can keep your time and energy for better ones.",
  },
  {
    q: "Can two people get similar ideas?",
    a: "Sometimes the same market themes can appear, but the combinations, validation output, and blueprint direction are still tailored to the specific angle you spin or enter.",
  },
  {
    q: "Is this only for technical people?",
    a: "No, but technical builders get the most immediate value because they can turn the blueprint into a prototype quickly. Non-technical founders can still use it to sharpen direction and messaging.",
  },
  {
    q: "Do credits expire?",
    a: "No. Credits stay on your account until you use them.",
  },
  {
    q: "What if a paid step fails?",
    a: "If a technical issue prevents the research or blueprint from completing, we will make it right. For billing issues, email support@ideareels.io and we will sort it out fast.",
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
          onClick={() => setOpen((o) => !o)}
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
                <h2>Questions people ask before they buy credits</h2>
                <p>Everything you need to know before you spin, research, or build.</p>
              </div>
              <div className="accordion zubuz-accordion-wrap">
                {FAQS.map((f, i) => <FaqItem key={i} {...f} />)}
              </div>
              <div style={{ marginTop: "3rem", textAlign: "center", padding: "2rem", border: "1px solid #ece6f5", borderRadius: "1rem" }}>
                <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Still have questions?</p>
                <a href="mailto:support@ideareels.io" className="zubuz-default-btn pill" style={{ display: "inline-block", marginTop: "0.5rem" }}>
                  <span>Email support</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </ZubazShell>
  );
}

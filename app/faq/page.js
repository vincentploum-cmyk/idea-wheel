"use client";
import { useState } from "react";
import Link from "next/link";

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
    a: "Blueprints typically cost 1 to 3 credits depending on the signal strength. Each blueprint runs a 4-agent AI pipeline: a product designer names your product and specs the features, a launch strategist writes your first-customer plan and 30-day roadmap, an infrastructure architect details every service you need to sign up for, and a prototype builder ships a clickable HTML demo you can test immediately.",
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
    <div style={s.item} onClick={() => setOpen(o => !o)}>
      <div style={s.question}>
        <span>{q}</span>
        <span style={{ ...s.chevron, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </span>
      </div>
      {open && <p style={s.answer}>{a}</p>}
    </div>
  );
}

export default function FaqPage() {
  return (
    <main style={s.page}>
      <style>{`@keyframes blobdrift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.12)}}`}</style>
      <div style={s.blob1}/><div style={s.blob2}/>
      <div style={s.wrap}>
        <div style={s.topbar}>
          <Link href="/" style={s.back}>← IdeaReels</Link>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/pricing" style={s.back}>Pricing</Link>
            <Link href="/profile" style={s.back}>Sign in</Link>
          </div>
        </div>
        <h1 style={s.h1}>Frequently asked questions</h1>
        <p style={s.sub}>Everything you need to know about IdeaReels.</p>
        <div style={s.list}>
          {FAQS.map((f, i) => <FaqItem key={i} {...f} />)}
        </div>
        <div style={s.cta}>
          <p style={s.ctaText}>Still have questions?</p>
          <a href="mailto:support@ideareels.io" style={s.ctaLink}>support@ideareels.io →</a>
        </div>
        <div style={s.disclaimer}>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 12 }}>
            <Link href="/privacy" style={s.footerLink}>Privacy Policy</Link>
            <Link href="/terms" style={s.footerLink}>Terms of Service</Link>
          </div>
          <p style={{ ...s.disclaimerText, marginBottom: 6 }}>© {new Date().getFullYear()} IdeaReels. All rights reserved.</p>
          <p style={s.disclaimerText}>IdeaReels is an AI-powered research and ideation tool. All market analysis, competitor data, and recommendations are generated by AI for informational purposes only. Not professional business, legal, or financial advice.</p>
        </div>
      </div>
    </main>
  );
}

const s = {
  page: { minHeight:"100vh", background:"#faf7ff", fontFamily:'"Plus Jakarta Sans",system-ui,sans-serif', color:"#18112b", position:"relative", overflow:"hidden" },
  blob1: { position:"fixed", width:480, height:480, top:"-8%", left:"-6%", borderRadius:"50%", background:"#7c3aed", filter:"blur(70px)", opacity:.28, pointerEvents:"none", zIndex:0, animation:"blobdrift 22s ease-in-out infinite" },
  blob2: { position:"fixed", width:420, height:420, bottom:"-12%", right:"-6%", borderRadius:"50%", background:"#ff4d8d", filter:"blur(70px)", opacity:.22, pointerEvents:"none", zIndex:0, animation:"blobdrift 22s ease-in-out infinite", animationDelay:"-7s" },
  wrap: { position:"relative", zIndex:1, maxWidth:720, margin:"0 auto", padding:"32px 20px 80px" },
  topbar: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:40 },
  back: { fontSize:13, fontWeight:600, color:"#7a7191", textDecoration:"none", padding:"8px 16px", border:"1px solid #ece6f5", borderRadius:999, background:"rgba(255,255,255,0.7)", backdropFilter:"blur(8px)" },
  h1: { fontFamily:'"Sora",system-ui', fontSize:"clamp(28px,5vw,48px)", fontWeight:700, letterSpacing:"-0.03em", margin:"0 0 12px", color:"#18112b" },
  sub: { fontSize:16, color:"#7a7191", margin:"0 0 20px", lineHeight:1.6 },
  list: { display:"flex", flexDirection:"column", gap:0 },
  item: { padding:"20px 0", borderBottom:"1px solid #ece6f5", cursor:"pointer", userSelect:"none" },
  question: { display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, fontWeight:700, fontSize:16, color:"#18112b", lineHeight:1.4 },
  chevron: { flexShrink:0, color:"#7a7191", transition:"transform .2s ease" },
  answer: { margin:"14px 0 0", fontSize:14, color:"#463a5f", lineHeight:1.75 },
  cta: { marginTop:48, textAlign:"center", padding:"32px", background:"rgba(255,255,255,0.68)", backdropFilter:"blur(12px)", border:"1px solid #ece6f5", borderRadius:20 },
  ctaText: { margin:"0 0 8px", fontWeight:600, fontSize:16, color:"#18112b" },
  ctaLink: { fontSize:14, fontWeight:700, color:"#7c3aed", textDecoration:"none" },
  disclaimer: { marginTop:40, paddingTop:24, borderTop:"1px solid #ece6f5", textAlign:"center" },
  disclaimerText: { fontSize:11, color:"#aaa1bd", lineHeight:1.7, margin:0 },
  footerLink: { fontSize:12, color:"#7a7191", textDecoration:"none", fontWeight:500 },
};

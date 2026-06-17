import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How IdeaReels collects and uses your data.',
};

export default function PrivacyPage() {
  return (
    <main style={s.page}>
      <div style={{ ...s.wrap, position: 'relative', zIndex: 1 }}>
        <div style={s.topbar}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} aria-label="IdeaReels — home"><BrandLogo /></Link>
        </div>
        <h1 style={s.h1}>Privacy Policy</h1>
        <p style={s.meta}>Last updated: June 2026</p>

        {[
          {
            title: "1. Information we collect",
            body: "When you create an account, we collect your email address and, if you sign in via OAuth, your name and profile picture from GitHub or Google. We also collect usage data such as spin history, validation requests, and blueprint generations to improve the product. Payment information is handled entirely by Stripe — we never store card numbers.",
          },
          {
            title: "2. How we use your information",
            body: "We use your email to authenticate your account and send transactional emails (receipt confirmations, password resets). We use usage data to improve AI outputs and detect abuse. We do not sell your personal data to third parties.",
          },
          {
            title: "3. Cookies",
            body: "We use cookies to keep you signed in (via Supabase Auth) and to remember your preferences. You can decline non-essential cookies via the banner on first visit. Declining cookies may prevent you from staying signed in.",
          },
          {
            title: "4. Third-party services",
            body: "We use Supabase (database and authentication), Stripe (payments), Anthropic (AI generation), and Render (hosting). Each service has its own privacy policy. AI-generated content is processed by Anthropic's API — please review their data handling policy at anthropic.com.",
          },
          {
            title: "5. Data retention",
            body: "We retain your account data for as long as your account is active. You can request deletion by emailing support@ideareels.io. Credits are non-transferable and are forfeited upon account deletion.",
          },
          {
            title: "6. Security",
            body: "All data is transmitted over HTTPS. Passwords are never stored — we use magic links and OAuth only. Database access is controlled via row-level security policies. We take reasonable measures to protect your data but cannot guarantee absolute security.",
          },
          {
            title: "7. Contact",
            body: "For privacy questions or data deletion requests, contact us at support@ideareels.io.",
          },
        ].map((section, i) => (
          <div key={i} style={s.section}>
            <h2 style={s.h2}>{section.title}</h2>
            <p style={s.body}>{section.body}</p>
          </div>
        ))}

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #ece6f5', display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/privacy" style={s.footerLink}>Privacy Policy</a>
          <a href="/terms" style={s.footerLink}>Terms of Service</a>
          <a href="/faq" style={s.footerLink}>FAQ</a>
          <a href="/pricing" style={s.footerLink}>Pricing</a>
          <a href="/" style={s.footerLink}>IdeaReels</a>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#aaa1bd', marginTop: 12 }}>© {new Date().getFullYear()} IdeaReels. All rights reserved.</p>
      </div>
    </main>
  );
}

const s = {
  page: { minHeight: '100vh', background: 'transparent', fontFamily: 'var(--font-body)', color: '#18112b', position: 'relative' },
  wrap: { maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' },
  topbar: { marginBottom: 40 },
  back: { fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', color: '#7a7191', textDecoration: 'none', padding: '8px 16px', border: '1px solid #ece6f5', borderRadius: 999, background: 'var(--glass)', backdropFilter: 'blur(8px)' },
  h1: { fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,42px)', fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 8px', color: '#18112b' },
  meta: { fontSize: 13, color: '#aaa1bd', margin: '0 0 40px' },
  section: { marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #ece6f5' },
  h2: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, margin: '0 0 10px', color: '#18112b' },
  body: { fontSize: 14, color: '#463a5f', lineHeight: 1.8, margin: 0 },
  footer: { marginTop: 40, display: 'flex', gap: 20, justifyContent: 'center' },
  footerLink: { fontSize: 13, color: '#7a7191', textDecoration: 'none', fontWeight: 500 },
};

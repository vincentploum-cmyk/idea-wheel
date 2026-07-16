import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';

export const metadata = {
  title: 'Account deleted',
  description: 'Your IdeaReels account has been deleted.',
  robots: 'noindex,nofollow',
};

export default function GoodbyePage() {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">See you around.</h1>
            <p className="fn__desc">Your account and its data have been removed.</p>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px 80px', lineHeight: 1.6 }}>
        <p>
          Your ideas, research, and blueprints have been permanently deleted. Payment records
          are retained for up to 7 years to meet tax and accounting requirements, anonymized
          from your identity — as described in our <Link href="/privacy">Privacy Policy</Link>.
        </p>
        <p>
          If you deleted by mistake or want to come back later, you can sign up again with the
          same or a different email. It’s a fresh account — the old one can’t be restored.
        </p>
        <p>
          Questions? <a href="mailto:hello@ideareels.io">hello@ideareels.io</a>.
        </p>
        <p style={{ marginTop: 24 }}>
          <Link href="/" style={{ fontWeight: 900, textDecoration: 'underline' }}>← Back to homepage</Link>
        </p>
      </div>
    </PopitoShell>
  );
}

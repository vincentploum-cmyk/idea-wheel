import PopitoShell from '@/components/popito/PopitoShell';
import { LEGAL_PRIVACY } from '@/lib/content';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How IdeaReels collects, uses, and protects your data.',
  alternates: { canonical: 'https://ideareels.io/privacy' },
};

export default function PrivacyPage() {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">Privacy Policy</h1>
            <p className="fn__desc">Last updated: June 2026</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <div className="popito_fn_membership_page">
        <div className="container" style={{ padding: '60px 20px 100px', maxWidth: 720, margin: '0 auto' }}>
          {LEGAL_PRIVACY.map((section) => (
            <div key={section.title} className="fn__bold_item" style={{ marginBottom: 16, padding: '22px 26px' }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>{section.title}</h2>
              <p style={{ opacity: 0.65, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </PopitoShell>
  );
}

import PopitoShell from '@/components/popito/PopitoShell';
import { LEGAL_PRIVACY, LEGAL_LAST_UPDATED, LEGAL_COUNSEL_REVIEWED } from '@/lib/content';

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
            <p className="fn__desc">Last updated: {LEGAL_LAST_UPDATED}</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <div className="popito_fn_membership_page">
        <div className="container" style={{ padding: '60px 20px 100px', maxWidth: 720, margin: '0 auto' }}>
          {!LEGAL_COUNSEL_REVIEWED && (
            <div role="note" style={{ marginBottom: 24, padding: '16px 20px', border: '2px solid #111', background: '#FFF8CC', boxShadow: '3px 3px 0 #111', fontSize: 13, lineHeight: 1.6 }}>
              <strong>Beta notice:</strong> this policy is a plain-language draft prepared by the operator and has not yet been reviewed by counsel. Its substance describes real practice; the wording may be refined by a lawyer before general availability. Questions? <a href="mailto:hello@ideareels.io" style={{ color: '#111', fontWeight: 700, textDecoration: 'underline' }}>hello@ideareels.io</a>.
            </div>
          )}
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

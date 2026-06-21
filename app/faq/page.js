import PopitoShell from '@/components/popito/PopitoShell';
import { FAQS } from '@/lib/content';

export const metadata = {
  title: 'FAQ — IdeaReels',
  description: 'Common questions about IdeaReels, including free credits, deep research, blueprint pricing, and shortcut packs.',
  alternates: { canonical: 'https://ideareels.io/faq' },
};

export default function FaqPage() {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h3 className="fn__title">Frequently Asked Questions</h3>
            <p className="fn__desc">Everything you need to know before you burn a night or weekend on the wrong idea.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <div className="popito_fn_membership_page">
        <div className="container" style={{ padding: '60px 20px 100px', maxWidth: 720, margin: '0 auto' }}>
          {FAQS.map((faq) => (
            <div key={faq.q} className="fn__bold_item" style={{ marginBottom: 16, padding: '22px 26px' }}>
              <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>{faq.q}</h3>
              <p style={{ opacity: 0.65, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </PopitoShell>
  );
}

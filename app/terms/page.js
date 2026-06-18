import PublicShell from '@/components/intellio/PublicShell';
import { LEGAL_TERMS } from '@/components/intellio/data';

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms governing your use of IdeaReels.',
};

export default function TermsPage() {
  return (
    <PublicShell title="Terms of Service" subtitle="Legal">
      <section className="service-details-section section-padding">
        <div className="auto-container">
          <div className="row justify-content-center">
            <div className="col-lg-9">
              <div className="service-details-content intellio-legal-copy">
                <div className="section-title style-two mb-4">
                  <h5>Last updated: June 2026</h5>
                  <h2>The rules for using <span>IdeaReels</span></h2>
                </div>
                {LEGAL_TERMS.map((section) => (
                  <div key={section.title} className="mb-5">
                    <h3>{section.title}</h3>
                    <p>{section.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

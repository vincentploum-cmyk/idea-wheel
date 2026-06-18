import PublicShell from '@/components/boostly/PublicShell';
import { LEGAL_PRIVACY } from '@/components/boostly/data';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How IdeaReels collects and uses your data.',
};

export default function PrivacyPage() {
  return (
    <PublicShell title="Privacy Policy">
      <section className="gt-service-details-wrapper section-padding">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-9">
              <div className="gt-service-details-content">
                <div className="gt-section-title style-3 mb-4">
                  <h6>Last updated: June 2026</h6>
                  <h2>How IdeaReels handles your <span>data</span></h2>
                </div>
                {LEGAL_PRIVACY.map((section) => (
                  <div key={section.title} className="mb-5">
                    <h3 className="mb-3">{section.title}</h3>
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

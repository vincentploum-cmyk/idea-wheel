import PublicShell from '@/components/boostly/PublicShell';
import FaqAccordion from '@/components/boostly/FaqAccordion';
import { FAQS } from '@/components/boostly/data';

export const metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about IdeaReels.',
};

export default function FaqPage() {
  return (
    <PublicShell title="FAQ">
      <section className="gt-faq-section fix section-padding section-bg-4">
        <div className="container">
          <div className="gt-section-title text-center style-3">
            <h6>Common questions</h6>
            <h2 className="inner-font fw-700 fz-50 text-header-color">Everything you need to know <span>before you build</span></h2>
            <p className="mt-3">IdeaReels helps you generate, validate, and blueprint startup ideas without wasting credits on weak ones.</p>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="gt-faq-wrapper">
                <FaqAccordion items={FAQS} id="faq-page" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

import PublicShell from '@/components/intellio/PublicShell';
import FaqAccordion from '@/components/intellio/FaqAccordion';
import { FAQS } from '@/components/intellio/data';

export const metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about IdeaReels.',
};

export default function FaqPage() {
  return (
    <PublicShell title="Frequently asked Question" subtitle="Faq’s">
      <section className="accordion-page-title section-padding">
        <div className="auto-container">
          <div className="row justify-content-center">
            <div className="col-xl-8 col-lg-10">
              <FaqAccordion items={FAQS} id="faq-page" />
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

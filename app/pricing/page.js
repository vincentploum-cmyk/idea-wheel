import PopitoShell from '@/components/popito/PopitoShell';
import PricingPageClient from './pricing-page-client';

export const metadata = {
  title: 'Pricing — IdeaReels: AI Market Research Starting at $3.99',
  description: 'Get AI-powered market research and a technical MVP blueprint before you commit to building. Credits start at $3.99, never expire, and cover 1 deep research + 1 full blueprint.',
  alternates: { canonical: 'https://ideareels.io/pricing' },
};

export default function PricingPage({ searchParams }) {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h3 className="fn__title">Pricing that matches how builders buy</h3>
            <p className="fn__desc">Pay only when you want the deeper market research and technical MVP blueprint that tell you whether to build, and how to execute.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <PricingPageClient searchParams={searchParams} />
    </PopitoShell>
  );
}

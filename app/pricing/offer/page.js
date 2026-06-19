import PopitoShell from '@/components/popito/PopitoShell';
import OfferPricingClient from './offer-pricing-client';

export const metadata = {
  title: 'Limited Time Offer — 50% Off Pro & Power | IdeaReels',
  description: 'Sign up and get 50% off the Pro and Power credit packages for a limited time.',
};

export default function OfferPricingPage({ searchParams }) {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle" style={{ minHeight: 0, padding: '40px 0 20px', textAlign: 'center' }}>
        <div className="container">
          <div className="pagetitle">
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
              Limited time only
            </p>
            <h1 className="fn__title" style={{ fontSize: 'clamp(2rem,4vw,3rem)', lineHeight: 1.15, marginBottom: 12 }}>
              50% off Pro &amp; Power
            </h1>
            <p className="fn__desc" style={{ maxWidth: 480, margin: '0 auto' }}>
              Sign up free and spin your first idea — then grab credits at half price while this offer lasts.
            </p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <OfferPricingClient searchParams={searchParams} />
    </PopitoShell>
  );
}

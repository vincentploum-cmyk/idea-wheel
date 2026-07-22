import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import { ALTERNATIVES_PAGES } from '@/lib/alternatives-data';

export const metadata = {
  title: 'Startup Validation Tool Comparisons & Alternatives',
  description:
    'Honest, price-checked comparisons of AI startup idea validation tools (ValidatorAI, DimeADozen, IdeaBrowser and more) with the best alternatives for indie budgets.',
  alternates: { canonical: 'https://ideareels.io/alternatives' },
};

export default function AlternativesIndexPage() {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">Validation tool comparisons.</h1>
            <p className="fn__desc">
              Honest, price-checked looks at the popular AI idea-validation tools: what each does well, where it falls
              short, and which alternative fits an indie budget. IdeaReels is our product; we say so on every page.
            </p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page">
        <section style={{ padding: '24px 0 64px' }}>
          <div className="container" style={{ maxWidth: 820 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {ALTERNATIVES_PAGES.map((p) => (
                <Link key={p.slug} href={`/alternatives/${p.slug}`} className="fn__bold_item" style={{ padding: '24px 26px', textDecoration: 'none', color: '#111', display: 'block' }}>
                  <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 18, margin: '0 0 6px' }}>{p.title}</p>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.75, margin: 0 }}>{p.metaDescription}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PopitoShell>
  );
}

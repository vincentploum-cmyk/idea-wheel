import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';

export default function NotFound() {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle" style={{ minHeight: 400, display: 'flex', alignItems: 'center' }}>
        <div className="container">
          <div className="pagetitle" style={{ textAlign: 'center' }}>
            <h3 className="fn__title" style={{ fontSize: '5rem', opacity: 0.15 }}>404</h3>
            <h3 className="fn__title">This page doesn&apos;t exist</h3>
            <p className="fn__desc">This page does not exist. Head back to the home page or start generating ideas.</p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
              <Link href="/" className="fn__btn"><span>Back to home</span></Link>
              <Link href="/wheel" className="fn__btn medium"><span>Generate an idea</span></Link>
            </div>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
    </PopitoShell>
  );
}

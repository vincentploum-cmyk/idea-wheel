import Link from 'next/link';
import PublicShell from '@/components/boostly/PublicShell';

export default function NotFound() {
  return (
    <PublicShell title="404 Error">
      <section className="gt-error-section section-padding fix">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="gt-error-items">
                <div className="gt-error-image">
                  <img src="/boostly/assets/img/inner/404.png" alt="404" />
                </div>
                <h2>Oops, this page doesn&apos;t exist</h2>
                <p>Looks like you took a wrong turn. Head back to the homepage or jump straight into the idea wheel.</p>
                <div className="gt-cta-btn justify-content-center">
                  <Link href="/" className="gt-theme-btn">back to home</Link>
                  <Link href="/wheel" className="gt-theme-btn style-3 bg-border">open idea wheel</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

import Link from 'next/link';
import PublicShell from '@/components/intellio/PublicShell';

export default function NotFound() {
  return (
    <PublicShell title="404 Error" subtitle="Page Not Found">
      <section className="contact-page-section fix section-padding">
        <div className="auto-container">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="contact-page-single-box text-center intellio-not-found-card">
                <img src="/intellio-images/demo-img/about-thumb31.png" alt="404 illustration" className="intellio-not-found-image" />
                <h2>Oops, this page doesn&apos;t exist</h2>
                <p>Looks like you took a wrong turn. Head back to the homepage or jump straight into the idea wheel.</p>
                <div className="banner-btn justify-content-center">
                  <Link href="/" className="primary">Back to home</Link>
                  <Link href="/wheel" className="border-btn">Open idea wheel</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

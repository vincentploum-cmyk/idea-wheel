import Link from 'next/link';

const navItems = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/auth/login', label: 'Sign In' },
];

export function PublicHeader() {
  return (
    <>
      <div className="intellio-header-area header-statup" id="sticky-header">
        <div className="auto-container">
          <div className="row align-items-center">
            <div className="col-6 col-lg-2">
              <div className="header-logo">
                <Link className="intellio-wordmark" href="/">IdeaReels</Link>
              </div>
            </div>
            <div className="col-lg-7 d-none d-lg-block">
              <div className="header-menu">
                <ul className="nav_scroll">
                  {navItems.map((item) => (
                    <li key={item.href}><Link href={item.href}>{item.label}</Link></li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="header-right-wrapper">
                <div className="header-sidebar justify-content-end">
                  <div className="header-btn d-none d-md-block">
                    <Link href="/wheel">Get Started Free<i className="fa-solid fa-arrow-down-to-line" /></Link>
                  </div>
                  <details className="intellio-mobile-menu d-lg-none">
                    <summary aria-label="Open navigation">
                      <span />
                      <span />
                      <span />
                    </summary>
                    <div className="intellio-mobile-panel">
                      <ul>
                        {navItems.map((item) => (
                          <li key={item.href}><Link href={item.href}>{item.label}</Link></li>
                        ))}
                        <li><Link href="/wheel" className="intellio-mobile-cta">Get Started Free</Link></li>
                      </ul>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function PublicBreadcrumb({ title, subtitle = 'IdeaReels' }) {
  return (
    <section className="pricing-page-title intellio-page-title" style={{ backgroundImage: "url('/intellio-images/inner-img/pricing-bg.jpg')" }}>
      <div className="auto-container">
        <div className="row">
          <div className="title-content">
            <h5 className="page-sub-title">{subtitle}</h5>
            <h1 className="page-title">{title}</h1>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PublicFooter() {
  return (
    <footer className="footer-section-two intellio-footer" style={{ backgroundImage: "url('/intellio-images/demo-img/footer-bg2.png')" }}>
      <div className="auto-container">
        <div className="intellio-footer-cta">
          <div>
            <h2>Find the idea, test it fast, build only the winners</h2>
            <p>Generate a sharper idea, run a free market check, then unlock the blueprint only when it clears the bar.</p>
          </div>
          <div className="header-btn">
            <Link href="/pricing">View Pricing<i className="fa-light fa-arrow-right" /></Link>
          </div>
        </div>
        <div className="row">
          <div className="col-lg-4 col-md-6">
            <div className="footer-widget">
              <h3>IdeaReels</h3>
              <p>Find a startup idea worth building. Validate it instantly. Unlock a build-ready blueprint only when one is worth pursuing.</p>
            </div>
          </div>
          <div className="col-lg-2 col-md-6">
            <div className="footer-widget">
              <h3>Product</h3>
              <ul>
                <li><Link href="/wheel">Idea generator</Link></li>
                <li><Link href="/pricing">Pricing</Link></li>
                <li><Link href="/faq">FAQ</Link></li>
              </ul>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="footer-widget">
              <h3>Company</h3>
              <ul>
                <li><Link href="/auth/login">Sign In</Link></li>
                <li><Link href="/profile">Profile</Link></li>
                <li><a href="mailto:support@ideareels.io">support@ideareels.io</a></li>
              </ul>
            </div>
          </div>
          <div className="col-lg-3 col-md-6">
            <div className="footer-widget">
              <h3>Legal</h3>
              <ul>
                <li><Link href="/privacy">Privacy</Link></li>
                <li><Link href="/terms">Terms</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} IdeaReels. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default function PublicShell({ children, title, subtitle }) {
  return (
    <div className="page-wrapper intellio-public-shell">
      <PublicHeader />
      {title ? <PublicBreadcrumb title={title} subtitle={subtitle} /> : null}
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}

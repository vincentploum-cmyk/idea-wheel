import Link from 'next/link';

const navItems = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/auth/login', label: 'Sign in' },
];

export function PublicHeader() {
  return (
    <>
      <div className="header-top-3">
        <div className="container">
          <p>
            Find sharper startup ideas faster <Link href="/wheel">start with 3 free credits</Link>
          </p>
        </div>
      </div>
      <header id="header-sticky" className="header-3">
        <div className="container">
          <div className="mega-menu-wrapper">
            <div className="header-main">
              <div className="logo">
                <Link href="/" className="header-logo" style={{ color: '#111827', fontWeight: 800, fontSize: 28 }}>
                  IdeaReels
                </Link>
              </div>
              <div className="mean__menu-wrapper">
                <div className="main-menu">
                  <nav>
                    <ul>
                      {navItems.map((item) => (
                        <li key={item.href}>
                          <Link href={item.href}>{item.label}</Link>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              </div>
              <div className="header-right d-flex justify-content-end align-items-center">
                <div className="header-button">
                  <Link href="/auth/login" className="gt-theme-btn style-3 bg-border">
                    sign in
                  </Link>
                  <Link href="/wheel" className="gt-theme-btn style-bg">
                    get started free
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export function PublicBreadcrumb({ title }) {
  return (
    <div className="gt-breadcrumb-wrapper bg-cover" style={{ backgroundImage: "url('/boostly/assets/img/breadcrumb-bg.jpg')" }}>
      <div className="container">
        <div className="gt-page-heading">
          <div className="gt-breadcrumb-sub-title">
            <h1>{title}</h1>
          </div>
          <ul className="gt-breadcrumb-items">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <i className="fa-solid fa-chevron-right" />
            </li>
            <li>{title}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function PublicFooter({ compact = false }) {
  return (
    <section className="gt-footer-section-3 footer-3">
      <div className="footer-dot">
        <img src="/boostly/assets/img/new-add/footer-dot.png" alt="" />
      </div>
      <div className="gt-cta-section-3 before-white">
        <div className="container">
          <div className="gt-cta-wrapper-3 bg-cover" style={{ backgroundImage: "url('/boostly/assets/img/home-3/cta-bg.jpg')" }}>
            <div className="gt-section-title style-3 mb-0">
              <h6 className="tt-capitalize">IdeaReels</h6>
              <h2>Find the idea, test it fast, build only the winners</h2>
            </div>
            <p>Generate a sharper idea, run a free market check, then unlock the blueprint only when it clears the bar.</p>
            <div className="gt-cta-btn">
              <Link href="/pricing" className="gt-theme-btn style-3 bg-header">view pricing</Link>
              <Link href="/wheel" className="gt-theme-btn style-3">get started free</Link>
            </div>
            <ul>
              <li><i className="fa-regular fa-circle-check" />3 free credits on signup</li>
              <li><i className="fa-regular fa-circle-check" />No credit card required</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="container">
        <div className="gt-footer-widget-wrapper style-2 style-3">
          <div className="row justify-content-between">
            <div className="col-xxl-4 col-xl-6 col-lg-6 col-md-8 col-sm-12">
              <div className="gt-footer-widget-items">
                <div className="gt-widget-head"><h3>about IdeaReels</h3></div>
                <div className="gt-footer-content">
                  <p>Find a startup idea worth building. Validate it instantly. Unlock a build-ready blueprint only when one is worth pursuing.</p>
                </div>
              </div>
            </div>
            <div className="col-xxl-2 col-xl-3 col-lg-3 col-md-4 col-sm-6">
              <div className="gt-footer-widget-items">
                <div className="gt-widget-head"><h3>product</h3></div>
                <ul className="gt-list-items">
                  <li><Link href="/wheel">Idea generator</Link></li>
                  <li><Link href="/pricing">Pricing</Link></li>
                  <li><Link href="/faq">FAQ</Link></li>
                </ul>
              </div>
            </div>
            <div className="col-xxl-2 col-xl-3 col-lg-3 col-md-4 col-sm-6">
              <div className="gt-footer-widget-items">
                <div className="gt-widget-head"><h3>company</h3></div>
                <ul className="gt-list-items">
                  <li><Link href="/auth/login">Sign in</Link></li>
                  <li><Link href="/profile">Profile</Link></li>
                  <li><a href="mailto:support@ideareels.io">support@ideareels.io</a></li>
                </ul>
              </div>
            </div>
            <div className="col-xxl-2 col-xl-3 col-lg-3 col-md-4 col-sm-6">
              <div className="gt-footer-widget-items">
                <div className="gt-widget-head"><h3>legal</h3></div>
                <ul className="gt-list-items">
                  <li><Link href="/privacy">Privacy</Link></li>
                  <li><Link href="/terms">Terms</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="gt-footer-bottom">
            <p>© {new Date().getFullYear()} IdeaReels. All rights reserved.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PublicShell({ children, title }) {
  return (
    <>
      <PublicHeader />
      {title ? <PublicBreadcrumb title={title} /> : null}
      {children}
      <PublicFooter compact={!title} />
    </>
  );
}

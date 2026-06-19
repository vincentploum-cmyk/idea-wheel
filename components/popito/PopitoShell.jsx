import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import PromoBanner from '@/components/PromoBanner';

const NAV_LINKS = [
  { href: '/wheel', label: 'Spin Ideas' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
];

function NavItem({ href, label }) {
  return (
    <li>
      <Link href={href}>
        <span>
          <span>{label}</span>
          <span className="suffix">//</span>
        </span>
      </Link>
    </li>
  );
}

export default async function PopitoShell({ children, yellowBg, noFooterCta }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div
      className="popito-fn-wrapper"
      data-bg-decor={yellowBg ? undefined : 'enable'}
      style={yellowBg ? { background: '#FFE000' } : undefined}
    >

      <PromoBanner
        text="Generate your first startup idea for free."
        linkLabel="Sign up — no credit card needed"
        linkHref="/auth/register"
      />

      {/* Search Popup */}
      <div className="popito_fn_searchbox">
        <div className="search_content">
          <div className="searchbox">
            <input type="text" placeholder="Search…" />
            <img src="/popito-assets/svg/search.svg" alt="" className="fn__svg" />
          </div>
          <div className="search_result"><ul /></div>
        </div>
      </div>

      {/* Header */}
      <header id="popito_fn_header">
        <div className="popito_fn_header">
          <div className="header_top">
            <div className="logo">
              <Link href="/" style={{ textDecoration: 'none' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: '#FFE000',
                  border: '2.5px solid #111',
                  borderRadius: '6px 999px 999px 6px',
                  padding: '5px 18px 5px 12px',
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: 900,
                  fontSize: 17,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#111',
                  lineHeight: 1,
                }}>
                  IdeaReels
                </span>
              </Link>
            </div>
            <div className="popito_fn_nav main_nav">
              <div className="menu">
                <div className="menu-main-container">
                  <ul role="menu" className="popito_fn_main_nav">
                    {NAV_LINKS.map(l => <NavItem key={l.href} {...l} />)}
                  </ul>
                </div>
              </div>
            </div>
            <div className="right__trigger">
              {user
                ? <Link href="/profile">My Account</Link>
                : <Link href="/auth/login">Sign in / Register</Link>}
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Navigation */}
      <div className="popito_fn_stickynav">
        <div className="transform_hedaer">
          <div className="sticky_header">
            <div className="popito_fn_nav sticky_nav">
              <div className="menu">
                <div className="menu-main-container">
                  <ul role="menu" className="popito_fn_main_nav">
                    {NAV_LINKS.map(l => <NavItem key={l.href} {...l} />)}
                  </ul>
                </div>
              </div>
            </div>
            <div className="right__trigger">
              {user
                ? <Link href="/profile">My Account</Link>
                : <Link href="/auth/login">Sign in / Register</Link>}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="popito_fn_mobnav">
        <div className="mob_top">
          <div className="logo">
            <div className="fn_logo">
              <Link href="/">
                <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: 'inherit' }}>
                  IdeaReels
                </span>
              </Link>
            </div>
          </div>
          <div className="right__trigger">
            <a href="#">
              <span className="hamb"><span /></span>
            </a>
          </div>
        </div>
        <div className="mob_bot">
          <ul role="menu" className="mobile_menu">
            {NAV_LINKS.map(l => (
              <li key={l.href}>
                <Link href={l.href}>
                  <span><span>{l.label}</span><span className="suffix">//</span></span>
                </Link>
              </li>
            ))}
            <li>
              {user
                ? <Link href="/profile"><span><span>My Account</span><span className="suffix">//</span></span></Link>
                : <Link href="/auth/login"><span><span>Sign In</span><span className="suffix">//</span></span></Link>}
            </li>
          </ul>
        </div>
      </div>

      {/* Page Content */}
      <main className="popito_fn_content">
        {children}
      </main>

      {/* Footer */}
      <footer id="popito_fn_footer">
        <div className="popito_fn_footer">
          <div className="footer_middle">
            <div className="middle_left">
              <div className="menu">
                <ul className="footer_nav">
                  <li className="menu-item">
                    <Link href="/privacy"><span className="text">Privacy Policy</span><span className="suffix">//</span></Link>
                  </li>
                  <li className="menu-item">
                    <Link href="/terms"><span className="text">Terms of Use</span><span className="suffix">//</span></Link>
                  </li>
                  <li className="menu-item">
                    <Link href="/faq"><span className="text">FAQ</span><span className="suffix">//</span></Link>
                  </li>
                </ul>
              </div>
            </div>
            {!noFooterCta && (
            <div className="middle_right">
              <div className="footer_subscribe">
                <div className="subscribe_title">
                  <h3>Ready to spin an idea?</h3>
                </div>
                <div className="subscribe_form">
                  <div className="form">
                    <Link href="/wheel" className="fn__btn medium"><span>Start for free</span></Link>
                  </div>
                  <div className="icon">
                    <img src="/popito-assets/svg/arrow-curly.svg" alt="" className="fn__svg" />
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
          <div className="footer_bottom">
            <div className="copyright">
              <p>© {new Date().getFullYear()} IdeaReels. Find a startup idea worth building. · AI-generated content is for informational purposes only, not professional advice.</p>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

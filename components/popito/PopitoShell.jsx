import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import PromoBanner from '@/components/PromoBanner';

function LogoMark({ height = 44 }) {
  const fontSize = Math.round(height * 0.52);
  const pad = Math.round(height * 0.18);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      background: '#FFE000',
      border: '2.5px solid #141414',
      borderRadius: height,
      padding: `${pad}px ${Math.round(height * 0.45)}px`,
      boxShadow: '2px 2px 0 #141414',
      lineHeight: 1,
      height,
      boxSizing: 'border-box',
    }}>
      <span style={{
        fontFamily: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
        fontWeight: 900,
        fontSize,
        color: '#141414',
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}>
        Idea ★ Reels
      </span>
    </span>
  );
}

const NAV_LINKS = [
  { href: '/wheel', label: 'Spin' },
  { href: '/ideas', label: 'Ideas' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
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
        text="Start free with 3 credits. Buy only when a spin feels worth chasing."
        linkLabel="See pricing"
        linkHref="/pricing"
      />

      <div className="popito_fn_searchbox">
        <div className="search_content">
          <div className="searchbox">
            <input type="text" placeholder="Search…" />
            <img src="/popito-assets/svg/search.svg" alt="" className="fn__svg" />
          </div>
          <div className="search_result"><ul /></div>
        </div>
      </div>

      <header id="popito_fn_header">
        <div className="popito_fn_header">
          <div className="header_top">
            <div className="logo">
              <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: 0 }}>
                <LogoMark height={44} />
              </Link>
            </div>
            <div className="popito_fn_nav main_nav">
              <div className="menu">
                <div className="menu-main-container">
                  <ul role="menu" className="popito_fn_main_nav">
                    {NAV_LINKS.map((l) => <NavItem key={l.href} {...l} />)}
                  </ul>
                </div>
              </div>
            </div>
            <div className="right__trigger">
              {user
                ? <Link href="/profile">My Account</Link>
                : <Link href="/auth/login">Claim 3 free credits</Link>}
            </div>
          </div>
        </div>
      </header>

      <div className="popito_fn_stickynav">
        <div className="transform_hedaer">
          <div className="sticky_header">
            <div className="popito_fn_nav sticky_nav">
              <div className="menu">
                <div className="menu-main-container">
                  <ul role="menu" className="popito_fn_main_nav">
                    {NAV_LINKS.map((l) => <NavItem key={l.href} {...l} />)}
                  </ul>
                </div>
              </div>
            </div>
            <div className="right__trigger">
              {user
                ? <Link href="/profile">My Account</Link>
                : <Link href="/auth/login">Claim 3 free credits</Link>}
            </div>
          </div>
        </div>
      </div>

      <div className="popito_fn_mobnav">
        <div className="mob_top">
          <div className="logo">
            <div className="fn_logo">
              <Link href="/" style={{ display: 'inline-block', lineHeight: 0 }}>
                <LogoMark height={38} />
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
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>
                  <span><span>{l.label}</span><span className="suffix">//</span></span>
                </Link>
              </li>
            ))}
            <li>
              {user
                ? <Link href="/profile"><span><span>My Account</span><span className="suffix">//</span></span></Link>
                : <Link href="/auth/login"><span><span>Claim 3 free credits</span><span className="suffix">//</span></span></Link>}
            </li>
          </ul>
        </div>
      </div>

      <main className="popito_fn_content">
        {children}
      </main>

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
                    <h3>Ready to find a buildable idea?</h3>
                  </div>
                  <div className="subscribe_form">
                    <div className="form">
                      <Link href={user ? '/wheel' : '/auth/login'} className="fn__btn medium"><span>{user ? 'Spin now' : 'Claim 3 free credits'}</span></Link>
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
              <p>© {new Date().getFullYear()} IdeaReels. Built for vibe coders, indie hackers, and solo builders. · AI-generated content is informational, not professional advice.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import PromoBanner from '@/components/PromoBanner';
import NavLinks from './NavLinks';
import MobileNav from './MobileNav';
import StickyChrome from './StickyChrome';
import { ArrowCurlyIcon } from './icons';
import Breadcrumbs from '@/components/Breadcrumbs';

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
        fontFamily: "'Nunito', sans-serif",
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


export default async function PopitoShell({ children, yellowBg, noFooterCta, noBanner }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div
      className="popito-fn-wrapper"
      data-bg-decor={yellowBg ? undefined : 'enable'}
      style={yellowBg ? { background: '#FFE000' } : undefined}
    >
      {!noBanner && <PromoBanner
        text="Score your idea for free. Unlock deep research and a technical blueprint only when the signal is strong."
        linkLabel="Try it free →"
        linkHref={user ? '/wheel' : '/auth/register'}
      />}

      {/* Search overlay removed: the template's search had no trigger in this
          port's header and its engine grepped static template HTML files that
          don't exist in this app — it was unreachable and non-functional. */}
      <StickyChrome />

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
                  <ul className="popito_fn_main_nav">
                    <NavLinks />
                  </ul>
                </div>
              </div>
            </div>
            <div className="right__trigger" style={{ width: 140, flexShrink: 0, overflow: 'visible' }}>
              {user
                ? <Link href="/profile" style={{ width: '100%', justifyContent: 'center' }}>Account</Link>
                : <Link href="/auth/login" style={{ width: '100%', justifyContent: 'center' }}>Sign in</Link>}
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
                  <ul className="popito_fn_main_nav">
                    <NavLinks />
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

      <MobileNav
        logo={
          <Link href="/" style={{ display: 'inline-block', lineHeight: 0 }}>
            <LogoMark height={38} />
          </Link>
        }
        menu={
          <ul className="mobile_menu">
            <NavLinks mobile />
            <li>
              {user
                ? <Link href="/profile"><span><span>My Account</span><span className="suffix">//</span></span></Link>
                : <Link href="/auth/login"><span><span>Sign In</span><span className="suffix">//</span></span></Link>}
            </li>
          </ul>
        }
      />

      <a href="#main-content" className="skip-to-content">Skip to main content</a>
      <Breadcrumbs />
      <main id="main-content" className="popito_fn_content" tabIndex={-1}>
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
                  <li className="menu-item">
                    <Link href="/contact"><span className="text">Contact</span><span className="suffix">//</span></Link>
                  </li>
                  <li className="menu-item">
                    <Link href="/status"><span className="text">System status</span><span className="suffix">//</span></Link>
                  </li>
                </ul>
              </div>
            </div>
            {!noFooterCta && (
              <div className="middle_right">
                <div className="footer_subscribe">
                  <div className="subscribe_title">
                    <h3>Your ideas stay private.</h3>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '6px 0 0', lineHeight: 1.55, maxWidth: 320 }}>
                      Your ideas are private to your account. We save the ideas you generate, research, and blueprint so you get history and can pick up where you left off — and we never sell them or make them public without your say-so.
                    </p>
                  </div>
                  <div className="subscribe_form">
                    <div className="form">
                      <Link href={user ? '/wheel' : '/auth/register'} className="fn__btn medium"><span>Spin / Score your idea!</span></Link>
                    </div>
                    <div className="icon">
                      <ArrowCurlyIcon />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="footer_bottom">
            <div className="copyright">
              <p>© {new Date().getFullYear()} IdeaReels. All rights reserved.</p>
              <p style={{ marginTop: 6, fontSize: 11, opacity: 0.45, lineHeight: 1.6, maxWidth: 860 }}>
                AI-generated content is provided for informational purposes only and does not constitute financial, legal, or business advice. Market signals and research outputs are generated by AI and may not reflect current or accurate market conditions. IdeaReels is not responsible for decisions made based on this content. Ideas you generate, research, and blueprint are stored privately in your account so you can resume work and access your history — they are not sold or made public without your direction. All product names, trademarks, and third-party data referenced are the property of their respective owners.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

function IdeaReelsHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`site-header site-header--menu-center zubuz-header-section bg-white${scrolled ? " sticky-menu" : ""}`}
      id="sticky-menu"
    >
      <div className="container">
        <nav className="navbar site-navbar">
          <div className="brand-logo">
            <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.25rem", fontWeight: "700", color: "#111", letterSpacing: "-0.02em" }}>
                IdeaReels
              </span>
            </Link>
          </div>

          <div className="menu-block-wrapper">
            <div className={`menu-overlay${menuOpen ? " active" : ""}`} onClick={() => setMenuOpen(false)} />
            <nav className={`menu-block${menuOpen ? " active" : ""}`}>
              <div className="mobile-menu-head">
                <div className="current-menu-title" />
                <div className="mobile-menu-close" onClick={() => setMenuOpen(false)}>&times;</div>
              </div>
              <ul className="site-menu-main">
                <li className="nav-item">
                  <Link href="/pricing" className="nav-link-item">Pricing</Link>
                </li>
                <li className="nav-item">
                  <Link href="/faq" className="nav-link-item">FAQ</Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="header-btn header-btn-l1 ms-auto d-none d-xs-inline-flex">
            <div className="zubuz-header-btn-wrap">
              <Link className="zubuz-login-btn" href="/profile">Sign in</Link>
            </div>
            <Link className="zubuz-default-btn zubuz-header-btn pill" href="/wheel">
              <span>Try the wheel</span>
            </Link>
          </div>

          <div className="mobile-menu-trigger light" onClick={() => setMenuOpen(!menuOpen)}>
            <span />
          </div>
        </nav>
      </div>
    </header>
  );
}

function IdeaReelsFooter() {
  return (
    <footer className="zubuz-footer-section dark-bg" style={{ marginTop: "auto" }}>
      <div className="container">
        <div className="zubuz-footer-top">
          <div className="row">
            <div className="col-xl-4 col-lg-12">
              <div className="zubuz-footer-textarea light">
                <Link href="/" style={{ textDecoration: "none" }}>
                  <strong style={{ color: "white", fontSize: "1.25rem" }}>IdeaReels</strong>
                </Link>
                <p>Spin into a buildable idea, sanity-check it fast, then go deeper only when it deserves your time.</p>
              </div>
            </div>
            <div className="col-xl-2 col-lg-3 col-md-6">
              <div className="zubuz-footer-menu light">
                <h6>Product</h6>
                <ul>
                  <li><Link href="/wheel">Wheel</Link></li>
                  <li><Link href="/pricing">Pricing</Link></li>
                  <li><Link href="/faq">FAQ</Link></li>
                </ul>
              </div>
            </div>
            <div className="col-xl-2 col-lg-3 col-md-6">
              <div className="zubuz-footer-menu light">
                <h6>Legal</h6>
                <ul>
                  <li><Link href="/privacy">Privacy Policy</Link></li>
                  <li><Link href="/terms">Terms of Service</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="zubuz-footer-bottom light">
          <p>© {new Date().getFullYear()} IdeaReels. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default function ZubazShell({ children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <IdeaReelsHeader />
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <IdeaReelsFooter />
    </div>
  );
}

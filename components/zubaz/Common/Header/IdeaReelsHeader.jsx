"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const IdeaReelsHeader = () => {
  const [scrollClassName, setScrollClassName] = useState("");
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrollClassName(window.scrollY > 100 ? "sticky-menu" : "");
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`site-header site-header--menu-center zubuz-header-section bg-white ${scrollClassName}`}
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
            <div className={`menu-overlay ${isActive ? "active" : ""}`} onClick={() => setIsActive(false)}></div>
            <nav className={`menu-block ${isActive ? "active" : ""}`}>
              <div className="mobile-menu-head">
                <div className="current-menu-title"></div>
                <div className="mobile-menu-close" onClick={() => setIsActive(false)}>&times;</div>
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
              <Link className="zubuz-login-btn" href="/profile">Login</Link>
            </div>
            <Link className="zubuz-default-btn zubuz-header-btn pill" href="/wheel">
              <span>Get Started</span>
            </Link>
          </div>

          <div className="mobile-menu-trigger light" onClick={() => setIsActive(!isActive)}>
            <span></span>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default IdeaReelsHeader;

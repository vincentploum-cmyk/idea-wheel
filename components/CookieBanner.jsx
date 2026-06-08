"use client";
import { useState, useEffect, useRef } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const barRef = useRef(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem("cookieConsent")) setVisible(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!visible) {
      document.documentElement.style.setProperty("--cookie-banner-space", "0px");
      return;
    }

    const syncSpace = () => {
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const height = barRef.current?.offsetHeight || 0;
      document.documentElement.style.setProperty("--cookie-banner-space", isMobile ? "0px" : `${height + 28}px`);
    };

    const frame = requestAnimationFrame(syncSpace);
    window.addEventListener("resize", syncSpace);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncSpace);
      document.documentElement.style.setProperty("--cookie-banner-space", "0px");
    };
  }, [visible]);

  const respond = (choice) => {
    try { localStorage.setItem("cookieConsent", choice); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <style>{CSS}</style>
      <div ref={barRef} className="cb-bar" role="dialog" aria-label="Cookie preferences">
        <p className="cb-text">
          We use cookies to keep your session secure and remember your preferences.{" "}
          <a href="/privacy" className="cb-link">Privacy</a>
          {" · "}
          <a href="/terms" className="cb-link">Terms</a>
        </p>
        <div className="cb-btns">
          <button className="cb-btn cb-btn--ghost" onClick={() => respond("declined")}>Decline</button>
          <button className="cb-btn cb-btn--primary" onClick={() => respond("accepted")}>Accept</button>
        </div>
      </div>
    </>
  );
}

const CSS = `
.cb-bar {
  position:fixed; bottom:12px; left:12px; right:12px;
  z-index:1000;
  max-width:640px; margin:0 auto;
  display:flex; align-items:center; justify-content:space-between;
  flex-wrap:wrap; gap:10px 14px;
  padding:12px 14px;
  background:rgba(255,255,255,0.96);
  border:1px solid var(--line);
  border-radius:18px;
  box-shadow:0 18px 36px -24px rgba(15, 23, 42, 0.32);
  font-family:var(--font-body);
}
.cb-text {
  margin:0; flex:1; min-width:220px;
  font-size:12.5px; line-height:1.5;
  color:var(--ink-2);
}
.cb-link {
  color:var(--accent); text-decoration:none; font-weight:600;
  transition:color .15s;
}
.cb-link:hover { color:var(--accent-mid); text-decoration:underline; }
.cb-btns { display:flex; gap:8px; flex-shrink:0; }
.cb-btn {
  min-height:36px;
  padding:8px 14px; border-radius:var(--r-pill);
  font-family:inherit; font-size:12.5px; font-weight:700;
  cursor:pointer;
  transition:background .15s, border-color .15s, color .15s, transform .15s ease;
}
.cb-btn:hover { transform:translateY(-1px); }
.cb-btn--ghost {
  background:#fff;
  border:1px solid var(--line-2);
  color:var(--ink-2);
}
.cb-btn--ghost:hover { border-color:var(--ink-2); color:var(--ink); }
.cb-btn--primary {
  background:var(--grad-brand); color:#fff;
  border:1px solid transparent;
  box-shadow:0 10px 18px -12px rgba(192,38,211,0.5);
}
.cb-btn--primary:hover { filter:brightness(1.06); }
@media (max-width: 640px) {
  .cb-bar {
    position:static;
    left:auto; right:auto; bottom:auto;
    max-width:none;
    margin:0 10px 12px;
    align-items:flex-start;
    padding:12px;
  }
  .cb-btns {
    width:100%;
  }
  .cb-btn {
    flex:1;
  }
}
`;

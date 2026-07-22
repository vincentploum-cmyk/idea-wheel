"use client";
import { useState, useEffect, useRef } from "react";

/**
 * Cookies notice — NOT a consent gate.
 *
 * IdeaReels uses only strictly-necessary first-party cookies (a Supabase auth
 * session, a rate-limit token) and no advertising or cross-site tracking, so
 * under GDPR/ePrivacy we don't require consent. The prior version pretended to
 * ask for "marketing" consent and did nothing with the answer — that was both
 * dishonest and legally risky. This is an honest, dismissible notice pointing
 * to the Privacy Policy. Dismiss stores a flag so it stays gone.
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const dismissRef = useRef(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem("cookieNoticeDismissed")) setVisible(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (visible) dismissRef.current?.focus();
  }, [visible]);

  const dismiss = () => {
    try { localStorage.setItem("cookieNoticeDismissed", "1"); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div role="note" aria-label="Cookies notice" style={{
      position: 'fixed', bottom: 12, left: 12, right: 12, zIndex: 9999,
      maxWidth: 720, margin: '0 auto',
      background: '#fff', border: '3px solid #141414',
      boxShadow: '4px 4px 0 #141414', borderRadius: 8,
      padding: '16px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap',
    }}>
      <p style={{
        margin: 0, flex: 1, minWidth: 220,
        fontFamily: 'inherit', fontSize: 13, color: '#141414', lineHeight: 1.55,
      }}>
        We use only the cookies IdeaReels needs to work: a sign-in session and rate limits.
        No advertising, no cross-site trackers. See our <a href="/privacy" style={{ color: '#141414', fontWeight: 700, textDecoration: 'underline' }}>Privacy Policy</a>.
      </p>
      <button
        ref={dismissRef}
        onClick={dismiss}
        style={{
          background: '#FFE000', border: '2.5px solid #141414', borderRadius: 6,
          padding: '8px 18px', fontFamily: 'inherit', fontWeight: 900,
          fontSize: 13, color: '#141414', cursor: 'pointer',
          boxShadow: '2px 2px 0 #141414', touchAction: 'manipulation',
          flexShrink: 0,
        }}
      >
        Got it
      </button>
    </div>
  );
}

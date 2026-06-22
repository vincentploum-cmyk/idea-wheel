"use client";
import { useState, useEffect, useRef } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const declineRef = useRef(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem("cookieConsent")) setVisible(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (visible) {
      declineRef.current?.focus();
    }
  }, [visible]);

  const respond = (choice) => {
    try { localStorage.setItem("cookieConsent", choice); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Cookie consent" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#fff', borderTop: '3px solid #141414',
      boxShadow: '0 -4px 0 #141414',
      padding: '20px 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 24, flexWrap: 'wrap',
    }}>
      <p style={{
        margin: 0, flex: 1, minWidth: 260,
        fontFamily: 'inherit', fontSize: 14, color: '#141414', lineHeight: 1.6,
      }}>
        By clicking <strong>"Accept All Cookies"</strong>, you agree to the storing of cookies on your device to enhance site navigation, analyze site usage, and assist in our marketing efforts.
      </p>
      <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
        <button
          ref={declineRef}
          onClick={() => respond('declined')}
          style={{
            background: '#fff', border: '2.5px solid #141414', borderRadius: 8,
            padding: '10px 20px', fontFamily: 'inherit', fontWeight: 700,
            fontSize: 14, color: '#141414', cursor: 'pointer',
            boxShadow: '2px 2px 0 #141414', touchAction: 'manipulation',
          }}
        >
          Decline
        </button>
        <button
          onClick={() => respond('accepted')}
          style={{
            background: '#FFE000', border: '2.5px solid #141414', borderRadius: 8,
            padding: '10px 20px', fontFamily: 'inherit', fontWeight: 900,
            fontSize: 14, color: '#141414', cursor: 'pointer',
            boxShadow: '2px 2px 0 #141414', touchAction: 'manipulation',
          }}
        >
          Accept All Cookies
        </button>
      </div>
    </div>
  );
}

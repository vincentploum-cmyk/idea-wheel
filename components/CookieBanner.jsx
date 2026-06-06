"use client";
import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("cookieConsent")) setVisible(true);
    } catch {}
  }, []);

  const respond = (choice) => {
    try { localStorage.setItem("cookieConsent", choice); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={s.bar}>
      <p style={s.text}>
        We use cookies to keep you signed in and remember your preferences.{" "}
        <a href="/privacy" style={s.link}>Privacy Policy</a>
        {" · "}
        <a href="/terms" style={s.link}>Terms</a>
      </p>
      <div style={s.btns}>
        <button style={s.decline} onClick={() => respond("declined")}>Decline</button>
        <button style={s.accept} onClick={() => respond("accepted")}>Accept</button>
      </div>
    </div>
  );
}

const s = {
  bar: { position:"fixed", bottom:0, left:0, right:0, zIndex:1000, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16, padding:"16px 28px", background:"rgba(24,17,43,0.92)", backdropFilter:"blur(14px)", borderTop:"1px solid rgba(255,255,255,0.08)", boxShadow:"0 -4px 30px rgba(80,20,120,0.25)" },
  text: { margin:0, flex:1, minWidth:240, fontSize:13, lineHeight:1.6, color:"rgba(255,255,255,0.78)", fontFamily:'"Plus Jakarta Sans", system-ui, sans-serif' },
  link: { color:"rgba(200,160,255,0.9)", textDecoration:"none", fontWeight:600 },
  btns: { display:"flex", gap:10, flexShrink:0 },
  decline: { padding:"9px 18px", borderRadius:10, cursor:"pointer", background:"transparent", border:"1px solid rgba(255,255,255,0.18)", color:"rgba(255,255,255,0.6)", fontSize:13, fontWeight:600, fontFamily:'"Plus Jakarta Sans", system-ui, sans-serif' },
  accept: { padding:"9px 20px", borderRadius:10, cursor:"pointer", background:"linear-gradient(120deg,#7c3aed,#c026d3,#ff4d8d)", border:"none", color:"#fff", fontSize:13, fontWeight:700, fontFamily:'"Plus Jakarta Sans", system-ui, sans-serif' },
};

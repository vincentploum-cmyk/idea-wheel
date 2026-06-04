"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CREDIT_PACKAGES, CREDIT_PACKAGE_BY_KEY } from '../../lib/pricing';

export default function PricingPageClient({ searchParams }) {
  const [loadingKey, setLoadingKey] = useState(null);
  const [error, setError] = useState('');
  const success = searchParams?.success === '1';
  const canceled = searchParams?.canceled === '1';
  const packageKey = searchParams?.package || '';
  const sessionId = searchParams?.session_id || '';
  const packageConfig = CREDIT_PACKAGE_BY_KEY[packageKey] || null;

  useEffect(() => {
    if (!success || !packageConfig || !sessionId) return;
    try {
      const grantKey = `ideaWheelStripeGrant:${sessionId}`;
      if (window.localStorage.getItem(grantKey)) return;
      const existing = Number(window.localStorage.getItem('ideaWheelCredits') || '3');
      const base = Number.isFinite(existing) ? existing : 3;
      window.localStorage.setItem('ideaWheelCredits', String(base + packageConfig.credits));
      window.localStorage.setItem(grantKey, '1');
    } catch {}
  }, [success, packageConfig, sessionId]);

  const statusMessage = useMemo(() => {
    if (success && packageConfig) return {
      tone: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.24)',
      title: `${packageConfig.credits} credits added`,
      text: 'Credits were applied to this browser so you can keep going immediately.',
    };
    if (canceled) return {
      tone: '#c026d3', bg: 'rgba(192,38,211,0.08)', border: 'rgba(192,38,211,0.24)',
      title: 'Checkout canceled',
      text: 'Nothing was charged. Pick up where you left off whenever you want.',
    };
    return null;
  }, [success, canceled, packageConfig]);

  async function startCheckout(pkg) {
    setLoadingKey(pkg.key); setError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageKey: pkg.key }),
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.url) throw new Error(data.error || 'Unable to start checkout');
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message || 'Unable to start checkout'); setLoadingKey(null);
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#faf7ff',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      color: '#18112b',
      padding: '48px 20px 80px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`@keyframes blobdrift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.12)}}`}</style>
      {/* blobs */}
      <div style={{ position:'fixed', width:480, height:480, top:'-8%', left:'-6%', borderRadius:'50%', background:'#7c3aed', filter:'blur(70px)', opacity:.32, pointerEvents:'none', zIndex:0, animation:'blobdrift 22s ease-in-out infinite' }}/>
      <div style={{ position:'fixed', width:420, height:420, bottom:'-12%', right:'-6%', borderRadius:'50%', background:'#ff4d8d', filter:'blur(70px)', opacity:.28, pointerEvents:'none', zIndex:0, animation:'blobdrift 22s ease-in-out infinite', animationDelay:'-7s' }}/>

      <div style={{ position:'relative', zIndex:1, maxWidth: 900, margin: '0 auto' }}>
        {/* back link */}
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom: 32 }}>
          <Link href="/" style={{
            fontSize: 13, fontWeight: 600, color: '#7a7191',
            textDecoration: 'none', padding: '8px 16px',
            border: '1px solid #ece6f5', borderRadius: 999,
            background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)',
          }}>← Back</Link>
        </div>

        <h1 style={{
          fontFamily: '"Sora", system-ui, sans-serif',
          fontSize: 'clamp(32px,5vw,54px)', fontWeight: 700,
          letterSpacing: '-0.03em', lineHeight: 1,
          margin: '0 0 12px', color: '#18112b',
        }}>Get blueprint credits</h1>
        <p style={{ fontSize: 16, color: '#7a7191', margin: '0 0 40px', lineHeight: 1.65, maxWidth: 520 }}>
          One credit runs the full 4-agent pipeline — market scout, product design, GTM playbook, infrastructure plan, and a live prototype.
        </p>

        {statusMessage && (
          <div style={{ padding: '16px 20px', borderRadius: 16, background: statusMessage.bg, border: `1.5px solid ${statusMessage.border}`, marginBottom: 24 }}>
            <strong style={{ color: statusMessage.tone, fontSize: 15, display:'block', marginBottom:6 }}>{statusMessage.title}</strong>
            <p style={{ margin: 0, color: '#463a5f', lineHeight: 1.6, fontSize: 14 }}>{statusMessage.text}</p>
          </div>
        )}

        {error && (
          <div style={{ padding: '14px 18px', borderRadius: 14, background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', marginBottom: 20 }}>
            <p style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {CREDIT_PACKAGES.map((pkg) => (
            <div key={pkg.key} style={{
              background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(10px)',
              border: pkg.highlight ? '2px solid #7c3aed' : '1px solid #ece6f5',
              borderRadius: 24, padding: '24px 22px',
              boxShadow: pkg.highlight ? '0 20px 50px -16px rgba(124,58,237,0.28)' : '0 10px 30px -10px rgba(80,30,120,0.1)',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <strong style={{ fontFamily:'"Sora",system-ui', fontSize:16, fontWeight:700, color:'#18112b' }}>{pkg.label}</strong>
                {pkg.highlight && <span style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.12em', color:'#7c3aed', fontWeight:700 }}>Popular</span>}
              </div>
              <div style={{ fontSize: 38, fontWeight: 800, fontFamily:'"Sora",system-ui', letterSpacing:'-0.03em', color:'#18112b', lineHeight:1, marginBottom:4 }}>{pkg.price}</div>
              <div style={{ fontSize:13, color:'#7a7191', marginBottom:4 }}>{pkg.credits} credits</div>
              <div style={{ fontSize:12, color:'#c026d3', fontWeight:600, marginBottom:18 }}>{pkg.per} / credit</div>
              <p style={{ color:'#7a7191', fontSize:13, lineHeight:1.6, margin:'0 0 20px', minHeight:60 }}>
                {pkg.highlight
                  ? 'Best for founders validating multiple ideas in one sitting.'
                  : pkg.key === 'starter'
                    ? 'Good for a first pass on a few serious concepts.'
                    : pkg.key === 'studio'
                      ? 'For teams doing repeated exploration and iteration.'
                      : 'For agencies and studios with heavy blueprint usage.'}
              </p>
              <button onClick={() => startCheckout(pkg)} disabled={loadingKey !== null} style={{
                width: '100%', border: 'none', borderRadius: 12, padding: '12px 0',
                background: pkg.highlight ? 'linear-gradient(120deg,#7c3aed,#c026d3,#ff4d8d)' : '#f3edff',
                color: pkg.highlight ? '#fff' : '#7c3aed',
                fontWeight: 700, fontSize: 14,
                fontFamily: '"Plus Jakarta Sans",system-ui',
                cursor: loadingKey ? 'wait' : 'pointer',
                opacity: loadingKey && loadingKey !== pkg.key ? 0.5 : 1,
              }}>
                {loadingKey === pkg.key ? 'Redirecting…' : 'Checkout'}
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #ece6f5', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#aaa1bd', lineHeight: 1.7, margin: 0 }}>
            IdeaWheel is an AI-powered research and ideation tool. All market analysis, competitor data, build scores, and recommendations are generated by AI and provided for informational purposes only. They do not constitute professional business, legal, or financial advice. AI-generated research may be incomplete, inaccurate, or outdated, and market conditions change rapidly. We make no guarantees about the commercial viability of any idea or the accuracy of competitive intelligence. You are solely responsible for any business decisions you make based on this tool. Always conduct your own research and consult qualified professionals before investing time or money into any venture.
          </p>
        </div>
      </div>
    </main>
  );
}

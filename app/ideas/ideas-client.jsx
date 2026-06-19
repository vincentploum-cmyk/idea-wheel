'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IDEA_EXAMPLES } from '@/lib/idea-examples';

const SCORE_COLOR = (s) => s >= 80 ? '#15803D' : s >= 65 ? '#B45309' : '#B91C1C';
const SCORE_BG    = (s) => s >= 80 ? '#f0fdf4' : s >= 65 ? '#fffbeb' : '#fef2f2';
const PREMIUM_SCORE = 80;

function IdeaCard({ item, index, locked }) {
  return (
    <div style={{
      background: '#FFE000',
      border: '2px solid #111',
      borderRadius: 12,
      boxShadow: '4px 4px 0 #111',
      padding: '32px 28px',
      display: 'grid',
      gridTemplateColumns: '48px 1fr',
      gap: '0 24px',
      alignItems: 'start',
      position: 'relative',
      overflow: locked ? 'hidden' : 'visible',
    }}>
      {/* Number */}
      <div style={{
        width: 48, height: 48,
        background: '#111',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Nunito, sans-serif', fontWeight: 900,
        fontSize: 15, color: '#FFE000', flexShrink: 0,
        marginTop: 2,
        filter: locked ? 'blur(3px)' : 'none',
      }}>
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Content */}
      <div style={{ filter: locked ? 'blur(4px)' : 'none', userSelect: locked ? 'none' : 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', opacity: 0.55 }}>{item.tag}</span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: SCORE_COLOR(item.score),
            background: '#fff',
            border: `1px solid ${SCORE_COLOR(item.score)}`,
            borderRadius: 4, padding: '2px 8px',
          }}>Score {item.score}</span>
        </div>
        <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(22px, 3vw, 28px)', margin: '0 0 10px', color: '#111', lineHeight: 1.2 }}>
          {item.title}
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: '#111', opacity: 0.75, margin: '0 0 18px' }}>
          {item.description}
        </p>
        <blockquote style={{
          margin: '0 0 20px', padding: '10px 14px',
          borderLeft: '3px solid #111',
          fontSize: 13, fontStyle: 'italic',
          color: '#111', opacity: 0.6, lineHeight: 1.65,
          background: 'rgba(0,0,0,0.04)', borderRadius: '0 4px 4px 0',
        }}>{item.quote}</blockquote>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[item.action, item.workflow, item.industry].filter(Boolean).map((t) => (
            <span key={t} style={{
              fontSize: 12, fontWeight: 700,
              background: '#111', color: '#fff',
              borderRadius: 4, padding: '3px 10px',
              fontFamily: 'Nunito, sans-serif',
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Lock overlay */}
      {locked && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,224,0,0.55)',
          backdropFilter: 'blur(2px)',
          borderRadius: 10,
          gap: 8,
        }}>
          <span style={{ fontSize: 28 }}>🔒</span>
          <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, color: '#111', margin: 0 }}>
            Score {item.score} · Premium idea
          </p>
        </div>
      )}
    </div>
  );
}

export default function IdeasClient({ user, unlocked: initialUnlocked }) {
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const freeIdeas    = IDEA_EXAMPLES.filter(i => i.score < PREMIUM_SCORE);
  const premiumIdeas = IDEA_EXAMPLES.filter(i => i.score >= PREMIUM_SCORE);

  const handleUnlock = async () => {
    if (!user) { window.location.href = '/auth/login?next=/ideas'; return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/ideas-unlock', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'insufficient_credits') {
          setError('Not enough credits. Purchase a pack to unlock premium ideas.');
        } else {
          setError(data.error || 'Something went wrong.');
        }
        return;
      }
      setUnlocked(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="popito_fn_membership_page">
      <section style={{ padding: '0 0 80px' }}>
        <div className="container">
          <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Free ideas */}
            {freeIdeas.map((item) => (
              <IdeaCard
                key={item.title}
                item={item}
                index={IDEA_EXAMPLES.indexOf(item)}
                locked={false}
              />
            ))}

            {/* Premium unlock gate */}
            {!unlocked && (
              <div style={{
                border: '2px dashed #111',
                borderRadius: 12,
                padding: '40px 32px',
                textAlign: 'center',
                background: '#fffbe6',
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
                <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 22, margin: '0 0 8px', color: '#111' }}>
                  {premiumIdeas.length} premium ideas locked
                </h3>
                <p style={{ fontSize: 14, opacity: 0.65, margin: '0 0 24px', lineHeight: 1.65 }}>
                  These ideas scored {PREMIUM_SCORE}+ — strong demand signal, low competition, real market evidence. Unlock them all permanently for 1 credit.
                </p>
                {error && (
                  <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
                    {error}{' '}
                    {error.includes('credits') && <Link href="/pricing" style={{ color: '#b91c1c', fontWeight: 700 }}>Buy credits →</Link>}
                  </p>
                )}
                {user ? (
                  <button
                    onClick={handleUnlock}
                    disabled={loading}
                    style={{
                      background: '#FFE000', border: '2px solid #111',
                      borderRadius: 8, boxShadow: '3px 3px 0 #111',
                      padding: '12px 28px',
                      fontFamily: 'Nunito, sans-serif', fontWeight: 900,
                      fontSize: 15, color: '#111', cursor: loading ? 'wait' : 'pointer',
                    }}
                  >
                    {loading ? 'Unlocking…' : `Unlock ${premiumIdeas.length} premium ideas · 1 credit`}
                  </button>
                ) : (
                  <Link href="/auth/register" style={{
                    display: 'inline-block',
                    background: '#FFE000', border: '2px solid #111',
                    borderRadius: 8, boxShadow: '3px 3px 0 #111',
                    padding: '12px 28px',
                    fontFamily: 'Nunito, sans-serif', fontWeight: 900,
                    fontSize: 15, color: '#111', textDecoration: 'none',
                  }}>
                    Sign up to unlock
                  </Link>
                )}
              </div>
            )}

            {/* Premium ideas — shown only when unlocked */}
            {unlocked && premiumIdeas.map((item) => (
              <IdeaCard
                key={item.title}
                item={item}
                index={IDEA_EXAMPLES.indexOf(item)}
                locked={false}
              />
            ))}

            {/* Bottom CTA */}
            <div style={{
              marginTop: 8,
              padding: '40px 36px',
              background: '#111', border: '2px solid #111',
              borderRadius: 12, boxShadow: '4px 4px 0 #FFE000',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexWrap: 'wrap', gap: 20,
            }}>
              <div>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 20, margin: '0 0 4px', color: '#FFE000' }}>
                  Find your own idea.
                </p>
                <p style={{ fontSize: 14, opacity: 0.6, margin: 0, color: '#fff' }}>
                  Spin three reels, get a free market verdict in seconds.
                </p>
              </div>
              <Link href={user ? '/wheel' : '/auth/register'} className="fn__btn">
                <span>{user ? 'Spin now' : 'Get started free'}</span>
              </Link>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}

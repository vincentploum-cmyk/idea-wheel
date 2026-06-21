'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IDEA_EXAMPLES } from '@/lib/idea-examples';

const SCORE_COLOR = (s) => s >= 80 ? '#15803D' : s >= 65 ? '#B45309' : '#B91C1C';
const PREMIUM_SCORE = 80;

// ── Small components ────────────────────────────────────────────────────────

function Tag({ children, dark }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 700,
      background: dark ? '#111' : 'rgba(0,0,0,0.08)',
      color: dark ? '#FFE000' : '#111',
      borderRadius: 4, padding: '3px 10px',
      fontFamily: 'Nunito, sans-serif',
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 900, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: '#111', opacity: 0.4,
      margin: '0 0 10px', fontFamily: 'Nunito, sans-serif',
    }}>{children}</p>
  );
}

function Divider() {
  return <div style={{ borderTop: '2px solid rgba(0,0,0,0.1)', margin: '20px 0' }} />;
}

// ── Research + Blueprint panels (shown when idea is unlocked) ────────────────

function ResearchPanel({ research }) {
  const [expanded, setExpanded] = useState(false);
  if (!research) return null;

  return (
    <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: '18px 20px', marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <SectionLabel>Deep research</SectionLabel>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, color: '#111', opacity: 0.55,
            padding: 0, fontFamily: 'Nunito, sans-serif',
          }}
        >
          {expanded ? 'Collapse ↑' : 'Expand ↓'}
        </button>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.7, color: '#111', margin: '0 0 6px', fontWeight: 600 }}>
        {research.teaserLine}
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: '#111', opacity: 0.7, margin: 0 }}>
        {research.marketSize}
      </p>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          <Divider />

          <SectionLabel>Market landscape</SectionLabel>
          <p style={{ fontSize: 13, lineHeight: 1.75, color: '#111', opacity: 0.8, margin: '0 0 16px' }}>
            {research.landscape}
          </p>

          {Array.isArray(research.players) && research.players.length > 0 && (
            <>
              <SectionLabel>Existing players</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {research.players.map((p, i) => (
                  <div key={i} style={{
                    background: 'rgba(0,0,0,0.05)', borderRadius: 6, padding: '10px 14px',
                    border: '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: '#111', fontFamily: 'Nunito, sans-serif' }}>{p.name}</span>
                      {p.pricing && <span style={{ fontSize: 12, color: '#111', opacity: 0.55 }}>{p.pricing}</span>}
                    </div>
                    <p style={{ fontSize: 12, color: '#111', opacity: 0.7, margin: '0 0 3px', lineHeight: 1.6 }}>{p.coverage}</p>
                    {p.weakness && (
                      <p style={{ fontSize: 12, color: '#B45309', margin: 0, lineHeight: 1.5 }}>
                        Gap: {p.weakness}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <SectionLabel>The opening</SectionLabel>
          <p style={{ fontSize: 13, lineHeight: 1.75, color: '#111', opacity: 0.85, margin: '0 0 16px', fontWeight: 600 }}>
            {research.gap}
          </p>

          <SectionLabel>Market signals</SectionLabel>
          <ul style={{ margin: '0 0 16px', paddingLeft: 18 }}>
            {(research.signals || []).map((s, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: '#111', opacity: 0.8, marginBottom: 4 }}>{s}</li>
            ))}
          </ul>

          <SectionLabel>Risks to watch</SectionLabel>
          <ul style={{ margin: '0 0 16px', paddingLeft: 18 }}>
            {(research.risks || []).map((r, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: '#B91C1C', marginBottom: 4 }}>{r}</li>
            ))}
          </ul>

          <p style={{ fontSize: 13, lineHeight: 1.75, color: '#111', opacity: 0.8, margin: 0 }}>
            {research.opportunity}
          </p>
        </div>
      )}
    </div>
  );
}

function BlueprintContent({ blueprint }) {
  const [show, setShow] = useState(false);
  if (!blueprint) return null;
  const { design, gtm, infra } = blueprint;

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setShow(s => !s)}
        style={{
          background: '#111', color: '#FFE000',
          border: '2px solid #111', borderRadius: 8,
          padding: '10px 20px',
          fontFamily: 'Nunito, sans-serif', fontWeight: 900,
          fontSize: 13, cursor: 'pointer',
        }}
      >
        {show ? 'Hide blueprint ↑' : 'View full blueprint ↓'}
      </button>

      {show && (
        <div style={{ marginTop: 16 }}>
          {design && (
            <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '16px 18px', marginBottom: 12 }}>
              <SectionLabel>Product design</SectionLabel>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16, margin: '0 0 4px', color: '#111' }}>
                {design.name}
              </p>
              <p style={{ fontSize: 13, margin: '0 0 12px', color: '#111', opacity: 0.7, fontStyle: 'italic' }}>
                {design.tagline}
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#111', opacity: 0.85, margin: '0 0 12px' }}>
                <strong>What makes it different:</strong> {design.differentiator}
              </p>
              {Array.isArray(design.coreFeatures) && (
                <>
                  <SectionLabel>Core features</SectionLabel>
                  <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
                    {design.coreFeatures.map((f, i) => (
                      <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: '#111', opacity: 0.8, marginBottom: 3 }}>{f}</li>
                    ))}
                  </ul>
                </>
              )}
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#111', opacity: 0.8, margin: '0 0 8px' }}>
                <strong>User flow:</strong> {design.userFlow}
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#15803D', margin: '0 0 8px' }}>
                <strong>Wow moment:</strong> {design.wowMoment}
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#111', opacity: 0.7, margin: 0 }}>
                <strong>Data moat:</strong> {design.dataMoat}
              </p>
            </div>
          )}

          {gtm && (
            <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '16px 18px', marginBottom: 12 }}>
              <SectionLabel>Go-to-market plan</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.45, margin: '0 0 4px' }}>Revenue goal</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: 0 }}>{gtm.revenueGoal}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.45, margin: '0 0 4px' }}>Price</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: 0 }}>{gtm.pricing?.price}</p>
                </div>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#111', opacity: 0.8, margin: '0 0 12px' }}>
                <strong>First customer:</strong> {gtm.persona}
              </p>
              {Array.isArray(gtm.firstFiveCustomers) && (
                <>
                  <SectionLabel>First 5 customers</SectionLabel>
                  <ol style={{ margin: '0 0 12px', paddingLeft: 20 }}>
                    {gtm.firstFiveCustomers.map((t, i) => (
                      <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: '#111', opacity: 0.8, marginBottom: 4 }}>{t}</li>
                    ))}
                  </ol>
                </>
              )}
              {Array.isArray(gtm.communities) && (
                <>
                  <SectionLabel>Where to find them</SectionLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {gtm.communities.map((c, i) => <Tag key={i}>{c}</Tag>)}
                  </div>
                </>
              )}
              {gtm.whyNow && (
                <p style={{ fontSize: 13, lineHeight: 1.7, color: '#111', opacity: 0.7, margin: 0 }}>
                  <strong>Why now:</strong> {gtm.whyNow}
                </p>
              )}
            </div>
          )}

          {infra && (
            <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '16px 18px' }}>
              <SectionLabel>Build it</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {(infra.stack || []).map((s, i) => <Tag key={i} dark>{s}</Tag>)}
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#111', opacity: 0.8, margin: '0 0 12px' }}>
                <strong>Build time:</strong> {infra.buildTime} &nbsp;·&nbsp;
                <strong>MVP cost:</strong> {infra.monthlyCost?.dev || '$0'} / mo dev, {infra.monthlyCost?.at100users} at 100 users
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#111', opacity: 0.8, margin: '0 0 12px' }}>
                <strong>Build order:</strong> {infra.buildOrder}
              </p>
              {infra.cursorPrompt && (
                <>
                  <SectionLabel>Cursor / Claude prompt to start</SectionLabel>
                  <div style={{
                    background: '#111', color: '#e5e7eb',
                    borderRadius: 6, padding: '12px 14px',
                    fontSize: 12, lineHeight: 1.7,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {infra.cursorPrompt}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Per-idea unlock CTA ───────────────────────────────────────────────────────

function IdeaUnlockCTA({ slug, ideaCreditBalance, user, onUnlocked }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = async () => {
    if (!user) { window.location.href = `/auth/login?next=/ideas`; return; }
    if (ideaCreditBalance < 1) { window.location.href = '/pricing'; return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/catalog-idea-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'insufficient_idea_credits') {
          window.location.href = '/pricing';
        } else {
          setError(data.error || 'Something went wrong.');
        }
        return;
      }
      onUnlocked(slug);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasCredits = ideaCreditBalance > 0;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={handleUnlock}
          disabled={loading}
          style={{
            background: hasCredits ? '#FFE000' : '#111',
            color: hasCredits ? '#111' : '#FFE000',
            border: '2px solid #111', borderRadius: 8,
            boxShadow: '3px 3px 0 #111',
            padding: '12px 24px',
            fontFamily: 'Nunito, sans-serif', fontWeight: 900,
            fontSize: 14, cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading
            ? 'Unlocking…'
            : !user
              ? 'Sign in to unlock'
              : !hasCredits
                ? 'Get Pro to unlock →'
                : `Unlock this idea · 1 credit`}
        </button>
        {hasCredits && (
          <span style={{ fontSize: 12, color: '#111', opacity: 0.5 }}>
            {ideaCreditBalance} idea credit{ideaCreditBalance !== 1 ? 's' : ''} remaining
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: '#111', opacity: 0.45, margin: '8px 0 0', lineHeight: 1.5 }}>
        Includes deep research + full blueprint: product design, GTM plan, tech setup & Cursor prompt
      </p>
      {error && (
        <p style={{ fontSize: 12, color: '#b91c1c', margin: '8px 0 0' }}>{error}</p>
      )}
    </div>
  );
}

// ── Idea card ────────────────────────────────────────────────────────────────

function IdeaCard({ item, index, catalogEntry, isUnlocked, ideaCreditBalance, unlockCount, user, onUnlocked }) {
  const isPremium = item.score >= PREMIUM_SCORE;
  const research = catalogEntry?.research || null;
  const blueprint = catalogEntry?.blueprint || null;

  return (
    <div style={{
      background: '#FFE000',
      border: '2px solid #111',
      borderRadius: 12,
      boxShadow: '4px 4px 0 #111',
      padding: '32px 28px',
      position: 'relative',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '48px 1fr',
        gap: '0 24px',
        alignItems: 'start',
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
        }}>
          {String(index + 1).padStart(2, '0')}
        </div>

        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', opacity: 0.55 }}>{item.tag}</span>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: SCORE_COLOR(item.score),
              background: '#fff',
              border: `1px solid ${SCORE_COLOR(item.score)}`,
              borderRadius: 4, padding: '2px 8px',
            }}>Score {item.score}</span>
            {isPremium && !isUnlocked && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: '#111', color: '#FFE000',
                borderRadius: 4, padding: '2px 8px',
              }}>Premium</span>
            )}
            {isUnlocked && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: '#15803D', color: '#fff',
                borderRadius: 4, padding: '2px 8px',
              }}>Unlocked</span>
            )}
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
              <Tag key={t} dark>{t}</Tag>
            ))}
          </div>

          {/* Teaser (always visible for premium, even locked) */}
          {isPremium && !isUnlocked && research?.teaserLine && (
            <div style={{ marginTop: 20, background: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: '14px 16px' }}>
              <SectionLabel>Market signal</SectionLabel>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#111', opacity: 0.85, margin: 0, fontWeight: 600 }}>
                {research.teaserLine}
              </p>
              {unlockCount > 0 && (
                <p style={{ fontSize: 11, color: '#111', opacity: 0.4, margin: '8px 0 0' }}>
                  {unlockCount} founder{unlockCount !== 1 ? 's' : ''} {unlockCount === 1 ? 'has' : 'have'} unlocked this idea
                </p>
              )}
            </div>
          )}

          {/* Full research + blueprint when unlocked */}
          {isUnlocked && (
            <>
              <ResearchPanel research={research} />
              <Divider />
              <BlueprintContent blueprint={blueprint} />
            </>
          )}

          {/* Unlock CTA for premium ideas */}
          {isPremium && !isUnlocked && (
            <IdeaUnlockCTA
              slug={item.slug}
              ideaCreditBalance={ideaCreditBalance}
              user={user}
              onUnlocked={onUnlocked}
            />
          )}

          {/* Free ideas CTA */}
          {!isPremium && (
            <div style={{ marginTop: 16 }}>
              <Link href="/wheel" style={{
                display: 'inline-block',
                background: '#111', color: '#FFE000',
                border: '2px solid #111', borderRadius: 8,
                padding: '10px 20px',
                fontFamily: 'Nunito, sans-serif', fontWeight: 900,
                fontSize: 13, textDecoration: 'none',
              }}>
                Spin your own variation →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Root client component ────────────────────────────────────────────────────

export default function IdeasClient({ user, catalogData = {}, ideaUnlocks: initialUnlocks = {}, ideaCreditBalance: initialBalance = 0, unlockCounts = {} }) {
  const [ideaUnlocks, setIdeaUnlocks] = useState(initialUnlocks);
  const [ideaCreditBalance, setIdeaCreditBalance] = useState(initialBalance);

  const freeIdeas    = IDEA_EXAMPLES.filter(i => i.score < PREMIUM_SCORE);
  const premiumIdeas = IDEA_EXAMPLES.filter(i => i.score >= PREMIUM_SCORE);

  const handleUnlocked = (slug) => {
    setIdeaUnlocks(prev => ({ ...prev, [slug]: true }));
    setIdeaCreditBalance(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="popito_fn_membership_page">
      <section style={{ padding: '0 0 80px' }}>
        <div className="container">
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Free ideas */}
            {freeIdeas.map((item) => (
              <IdeaCard
                key={item.slug}
                item={item}
                index={IDEA_EXAMPLES.indexOf(item)}
                catalogEntry={catalogData[item.slug]}
                isUnlocked={false}
                ideaCreditBalance={ideaCreditBalance}
                unlockCount={0}
                user={user}
                onUnlocked={handleUnlocked}
              />
            ))}

            {/* Premium ideas — each unlocked individually */}
            {premiumIdeas.map((item) => (
              <IdeaCard
                key={item.slug}
                item={item}
                index={IDEA_EXAMPLES.indexOf(item)}
                catalogEntry={catalogData[item.slug]}
                isUnlocked={!!ideaUnlocks[item.slug]}
                ideaCreditBalance={ideaCreditBalance}
                unlockCount={unlockCounts[item.slug] ?? 0}
                user={user}
                onUnlocked={handleUnlocked}
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
                  Evaluate your next build.
                </p>
                <p style={{ fontSize: 14, opacity: 0.6, margin: 0, color: '#fff' }}>
                  Review the market and define the MVP before you commit.
                </p>
              </div>
              <Link href={user ? '/wheel' : '/auth/register'} className="fn__btn">
                <span>{user ? 'Spin now' : 'Get started'}</span>
              </Link>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}

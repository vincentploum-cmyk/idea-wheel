import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import { IDEA_EXAMPLES } from '@/lib/idea-examples';

export const metadata = {
  title: 'Ideas From the Engine — IdeaReels',
  description: 'Real startup ideas surfaced by IdeaReels — specific, validated, and built around genuine market pain.',
  alternates: { canonical: 'https://ideareels.io/ideas' },
};

const SCORE_COLOR = (s) => s >= 80 ? '#15803D' : s >= 65 ? '#B45309' : '#B91C1C';
const SCORE_BG    = (s) => s >= 80 ? '#f0fdf4' : s >= 65 ? '#fffbeb' : '#fef2f2';

export default function IdeasPage() {
  return (
    <PopitoShell>
      {/* Page header */}
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <div className="fn__author_info">
              <div className="right_part">
                <h1 className="title">Ideas from the engine</h1>
                <p className="desc">Real concepts surfaced by IdeaReels — specific problems, real market pain, and a clear angle for each one.</p>
              </div>
            </div>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page">
        <section style={{ padding: '0 0 80px' }}>
          <div className="container">

            {/* Idea list */}
            <div style={{ maxWidth: 780, margin: '0 auto' }}>
              {IDEA_EXAMPLES.map((item, i) => (
                <div key={item.title} style={{
                  padding: '48px 0',
                  borderBottom: i < IDEA_EXAMPLES.length - 1 ? '1px solid rgba(0,0,0,0.08)' : 'none',
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr',
                  gap: '0 28px',
                  alignItems: 'start',
                }}>
                  {/* Number */}
                  <div style={{
                    width: 48, height: 48,
                    background: '#FFE000', border: '2px solid #111',
                    borderRadius: '50%', boxShadow: '2px 2px 0 #111',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Nunito, sans-serif', fontWeight: 900,
                    fontSize: 15, color: '#111', flexShrink: 0,
                    marginTop: 4,
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>

                  {/* Content */}
                  <div>
                    {/* Tag row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.09em',
                        textTransform: 'uppercase', opacity: 0.45,
                      }}>{item.tag}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: SCORE_COLOR(item.score),
                        background: SCORE_BG(item.score),
                        border: `1px solid ${SCORE_COLOR(item.score)}`,
                        borderRadius: 4, padding: '2px 8px',
                      }}>Score {item.score}</span>
                    </div>

                    {/* Title */}
                    <h2 style={{
                      fontFamily: 'Nunito, sans-serif', fontWeight: 900,
                      fontSize: 'clamp(22px, 3vw, 30px)', margin: '0 0 12px', color: '#111',
                      lineHeight: 1.2,
                    }}>{item.title}</h2>

                    {/* Description */}
                    <p style={{
                      fontSize: 15, lineHeight: 1.75, opacity: 0.72,
                      margin: '0 0 20px', maxWidth: 600,
                    }}>{item.description}</p>

                    {/* Quote */}
                    <blockquote style={{
                      margin: '0 0 24px',
                      padding: '12px 16px',
                      borderLeft: '3px solid #FFE000',
                      fontSize: 14, fontStyle: 'italic',
                      opacity: 0.6, lineHeight: 1.65,
                      background: 'rgba(255,224,0,0.05)',
                      borderRadius: '0 4px 4px 0',
                    }}>{item.quote}</blockquote>

                    {/* Reel values */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {[item.action, item.workflow, item.industry].filter(Boolean).map((t) => (
                        <span key={t} style={{
                          fontSize: 12, fontWeight: 700,
                          background: '#111', color: '#fff',
                          borderRadius: 4, padding: '3px 10px',
                          fontFamily: 'Nunito, sans-serif',
                          letterSpacing: '0.01em',
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{
              maxWidth: 780, margin: '48px auto 0',
              padding: '40px 36px',
              background: '#FFE000', border: '2px solid #111',
              borderRadius: 12, boxShadow: '4px 4px 0 #111',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexWrap: 'wrap', gap: 20,
            }}>
              <div>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 20, margin: '0 0 4px', color: '#111' }}>
                  Find your own idea.
                </p>
                <p style={{ fontSize: 14, opacity: 0.65, margin: 0, color: '#111' }}>
                  Spin three reels, get a free market verdict in seconds.
                </p>
              </div>
              <Link href="/auth/register" className="fn__btn"><span>Get started free</span></Link>
            </div>

          </div>
        </section>
      </div>
    </PopitoShell>
  );
}

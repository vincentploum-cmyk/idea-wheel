'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function PromoBanner({ text, linkLabel, linkHref }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <div style={{
      background: '#FFE000',
      borderBottom: '2px solid #111',
      padding: '12px 48px',
      textAlign: 'center',
      position: 'relative',
      fontFamily: 'Nunito, sans-serif',
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#111',
    }}>
      {text}{' '}
      {linkLabel && linkHref && (
        <Link href={linkHref} style={{ color: '#111', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          {linkLabel}
        </Link>
      )}
      <button
        onClick={() => setClosed(true)}
        aria-label="Dismiss"
        style={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, lineHeight: 1, color: '#111', padding: '4px 6px',
        }}
      >
        ×
      </button>
    </div>
  );
}

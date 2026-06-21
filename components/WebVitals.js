'use client';

import { useEffect } from 'react';
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

// CWV thresholds per Google's targets (https://web.dev/vitals/)
const THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  LCP: { good: 2500, poor: 4000 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

function rate(name, value) {
  const t = THRESHOLDS[name];
  if (!t) return 'unknown';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

function report(metric) {
  const label = rate(metric.name, metric.value);
  // Log to console in development for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[CWV] ${metric.name}: ${Math.round(metric.value)}${metric.name === 'CLS' ? '' : 'ms'} (${label})`);
  }

  // Send to analytics endpoint — non-blocking, best-effort
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: label,
      id: metric.id,
      delta: metric.delta,
      navigationType: metric.navigationType,
      page: window.location.pathname,
    });
    navigator.sendBeacon('/api/vitals', body);
  }
}

export default function WebVitals() {
  useEffect(() => {
    onCLS(report);
    onINP(report);
    onLCP(report);
    onFCP(report);
    onTTFB(report);
  }, []);

  return null;
}

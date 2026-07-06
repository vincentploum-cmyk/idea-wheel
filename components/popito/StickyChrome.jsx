'use client';
import { useEffect } from 'react';

// Replaces init.js stickyHeader() + stickyTopBar(): show the sticky nav
// (body.sticky-active, styled by style.css) when scrolling UP past 400px,
// and mirror the .hover class the template CSS expects on the bar itself.
// Living in React means the behavior re-binds after client-side navigation,
// which the one-shot jQuery init never did.
export default function StickyChrome() {
  useEffect(() => {
    let last = 0;
    const onScroll = () => {
      const st = window.scrollY;
      if (st < last && st > 400) {
        document.body.classList.add('sticky-active');
      } else {
        document.body.classList.remove('sticky-active');
      }
      last = st;
    };

    const nav = document.querySelector('.popito_fn_stickynav');
    const enter = () => nav.classList.add('hover');
    const leave = () => nav.classList.remove('hover');

    window.addEventListener('scroll', onScroll, { passive: true });
    nav?.addEventListener('mouseenter', enter);
    nav?.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('scroll', onScroll);
      nav?.removeEventListener('mouseenter', enter);
      nav?.removeEventListener('mouseleave', leave);
      document.body.classList.remove('sticky-active');
    };
  }, []);

  return null;
}

'use client';
import { useState } from 'react';

// The template wired this menu through jQuery (init.js mobile__Menu), which
// bound to `.right__trigger a` — an element this React port never renders —
// and whose handlers die after client-side navigation anyway. React state
// owns the toggle instead; the `menu_opened` class still drives the
// hamburger icon animation from style.css.
export default function MobileNav({ logo, menu }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`popito_fn_mobnav${open ? ' menu_opened' : ''}`}>
      <div className="mob_top">
        <div className="logo">
          <div className="fn_logo">{logo}</div>
        </div>
        <div className="right__trigger">
          <button
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="hamb"><span /></span>
          </button>
        </div>
      </div>
      <div className="mob_bot" style={{ display: open ? 'block' : 'none' }}>
        {menu}
      </div>
    </div>
  );
}

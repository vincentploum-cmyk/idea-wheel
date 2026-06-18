'use client';

import { useState } from 'react';

export default function FaqAccordion({ items, id = 'faq' }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="tab_container" id={id}>
      <div className="tab_content" style={{ display: 'block' }}>
        <ul className="accordion intellio-faq-list">
          {items.map((item, index) => {
            const isOpen = open === index;
            return (
              <li key={item.q} className={isOpen ? 'active' : ''}>
                <button type="button" className="intellio-faq-trigger" onClick={() => setOpen(isOpen ? -1 : index)}>
                  <span />
                  {item.q}
                </button>
                <div className="intellio-faq-panel" style={{ display: isOpen ? 'block' : 'none' }}>
                  <p>{item.a}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

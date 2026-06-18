'use client';

import { useState } from 'react';

export default function FaqAccordion({ items, id = 'faq' }) {
  const [open, setOpen] = useState(1);

  return (
    <div className="accordion" id={id}>
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.q} className={`accordion-item ${isOpen ? 'active' : ''}`}>
            <h2 className="accordion-header">
              <button
                className={`accordion-button${isOpen ? '' : ' collapsed'}`}
                type="button"
                onClick={() => setOpen(isOpen ? -1 : index)}
              >
                {item.q}
              </button>
            </h2>
            <div className={`accordion-collapse collapse${isOpen ? ' show' : ''}`}>
              <div className="accordion-body">
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

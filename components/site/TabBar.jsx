'use client';

/** The page's tab bar: one link a tab (`#key`), the open one marked. `tabs` = [[key, label]]. */
export default function TabBar({ tabs, tab, label = 'Sections' }) {
  return (
    <div className="nhlx-wrap nhlx-tabbar">
      <div className="nhlx-tabs" role="tablist" aria-label={label}>
        {tabs.map(([key, text]) => (
          <a key={key} href={`#${key}`} role="tab" id={`tab-${key}`} aria-selected={tab === key} aria-controls={key} className={`nhlx-tab${tab === key ? ' is-active' : ''}`}>
            {text}
          </a>
        ))}
      </div>
    </div>
  );
}

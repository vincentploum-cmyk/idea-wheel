import Link from 'next/link';

const SUB = {
  NHL: 'NHL Model 3.0 · Shot Supply Engine',
  NFL: 'NFL picks · touchdowns, passing, rushing, receiving',
  NBA: 'NBA picks',
};

/** The site mark: the sport's code when a sport is open, the site's own on the start screen. */
export function Logo({ sport = null }) {
  return (
    <Link href="/" className="nhlx-logo" aria-label="ideareels home">
      <span className="nhlx-logo-mark">{sport || 'IR'}</span>
      <span className="nhlx-logo-text">
        <span className="nhlx-logo-word">IDEAREELS</span>
        <span className="nhlx-logo-sub">{SUB[sport] || 'NFL · NBA · NHL picks'}</span>
      </span>
    </Link>
  );
}

export default function SiteHeader({ nav = null, right = null, dark = false, sport = null }) {
  return (
    <header className={`nhlx-header${dark ? ' nhlx-header-dark' : ''}`}>
      <div className="nhlx-header-inner">
        <Logo sport={sport} />
        {nav && <nav className="nhlx-nav" aria-label="Primary">{nav}</nav>}
        <div className="nhlx-header-right">{right}</div>
      </div>
    </header>
  );
}

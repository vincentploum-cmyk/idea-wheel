import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="nhlx-logo" aria-label="NHL Model 3.0 home">
      <span className="nhlx-logo-mark">3.0</span>
      <span className="nhlx-logo-text">
        <span className="nhlx-logo-word">NHL MODEL</span>
        <span className="nhlx-logo-sub">Shot Supply Engine</span>
      </span>
    </Link>
  );
}

export default function SiteHeader({ nav = null, right = null }) {
  return (
    <header className="nhlx-header">
      <div className="nhlx-header-inner">
        <Logo />
        {nav && <nav className="nhlx-nav" aria-label="Primary">{nav}</nav>}
        <div className="nhlx-header-right">{right}</div>
      </div>
    </header>
  );
}

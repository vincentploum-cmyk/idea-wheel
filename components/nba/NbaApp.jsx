import SiteHeader from '@/components/nhl/SiteHeader';
import SignOutButton from '@/components/nhl/SignOutButton';
import ThemeToggle from '@/components/nhl/ThemeToggle';
import SportNav from '@/components/site/SportNav';

/** The NBA page: in place, not wired. The data path follows the NFL's once it is. */
export default function NbaApp({ email }) {
  return (
    <>
      <SiteHeader sport="NBA" nav={<SportNav />} right={<><span className="nhlx-user">{email}</span><ThemeToggle /><SignOutButton /></>} />
      <main>
        <section className="nhlx-section">
          <div className="nhlx-wrap">
            <span className="nhlx-eyebrow">NBA</span>
            <h2 className="nhlx-h2">NBA <span>picks</span></h2>
            <p className="nhlx-lede">Not wired yet. The page holds the slot; the board will follow the NFL’s shape: the night’s games, the best plays per market, graded against the box score.</p>
            <div className="nhlx-empty">No NBA data yet. The PropFinder pull and the cheat-sheet drop will mirror the NFL page.</div>
          </div>
        </section>
      </main>
      <footer className="nhlx-footer">
        <div className="nhlx-wrap"><span>ideareels · NBA picks</span><span>Private tool · access by invitation</span></div>
      </footer>
    </>
  );
}

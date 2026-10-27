import Link from 'next/link';
import SiteHeader from './SiteHeader';
import { LEAGUES, leagueLogo, leagueName } from '@/lib/site/leagues';

const SPORTS = [
  {
    code: 'NFL', title: 'NFL picks',
    body: 'The week’s best plays per game in four tables: touchdowns, passing, rushing and receiving. The two cheat sheets you upload plus PropFinder’s game logs and lines, every row with the chance of the hit, its break-even price and the book’s price, graded against the box score.',
  },
  {
    code: 'NBA', title: 'NBA picks',
    body: 'Tonight’s best plays per game in five tables: points, rebounds, assists, threes and the combos, from the cheat sheets and PropFinder’s logs and lines, graded against the box score.',
  },
  {
    code: 'NHL', title: 'NHL picks',
    body: 'Model 3.0: tonight’s best shots and goal plays, the matchups by position, what every defense gives up, first-goal candidates and a scorecard of every call against the box scores.',
  },
];

function Preview() {
  return (
    <div className="nhlx-hero-shot" aria-label="Example of the boards’ output format">
      <div className="nhlx-hero-shot-inner">
        <div className="nhlx-preview-grid">
          <div className="nhlx-matchcard">
            <div className="nhlx-matchcard-title">NFL · one game, four tables</div>
            <div className="nhlx-matchcard-sub">Touchdowns, passing, rushing, receiving</div>
            <div className="nhlx-ladder">
              {[['Any TD', 0.61], ['Pass yds', 0.66], ['Rush yds', 0.64], ['Rec', 0.58]].map(([k, p]) => (
                <div className="nhlx-ladder-row" key={k}>
                  <span>{k}</span>
                  <span className="nhlx-ladder-bar"><i style={{ width: `${p * 100}%` }} /></span>
                  <b>{Math.round(p * 100)}%</b>
                </div>
              ))}
            </div>
            <p className="nhlx-example-note">Example output format</p>
          </div>
          <div className="nhlx-matchcard">
            <div className="nhlx-matchcard-title">NHL · shots on goal ladder</div>
            <div className="nhlx-matchcard-sub">Probability of each line, per player</div>
            <div className="nhlx-ladder">
              {[['2+ SOG', 0.86], ['3+ SOG', 0.64], ['4+ SOG', 0.41], ['5+ SOG', 0.22]].map(([k, p]) => (
                <div className="nhlx-ladder-row" key={k}>
                  <span>{k}</span>
                  <span className="nhlx-ladder-bar"><i style={{ width: `${p * 100}%` }} /></span>
                  <b>{Math.round(p * 100)}%</b>
                </div>
              ))}
            </div>
            <p className="nhlx-example-note">Example output format</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <>
      <SiteHeader
        dark
        nav={(
          <>
            <a href="#sports">Sports</a>
          </>
        )}
        right={<Link href="/auth/login" className="nhlx-btn nhlx-btn-sm">Sign in</Link>}
      />

      <main>
        <section className="nhlx-hero">
          <div className="nhlx-wrap">
            <div className="ir-league-row" aria-label="NFL, NBA and NHL">
              {LEAGUES.map((l) => <img key={l} src={leagueLogo(l)} alt={leagueName(l)} width="56" height="56" />)}
            </div>
            <h1>
              The best plays in every game, <span className="is-accent">graded against the box score</span>
            </h1>
            <p className="nhlx-hero-copy">
              One start screen, three sports: NFL picks by touchdowns, passing, rushing and receiving; NBA picks by points, rebounds, assists and threes; the NHL shots and goals model.
            </p>
            <div className="nhlx-hero-cta">
              <Link href="/auth/login" className="nhlx-btn">Open the picks <span className="nhlx-arrow">→</span></Link>
              <a href="#sports" className="nhlx-btn nhlx-btn-ghost">What’s inside</a>
            </div>
            <Preview />
          </div>
        </section>

        <section className="nhlx-section" id="sports">
          <div className="nhlx-wrap nhlx-center-text">
            <span className="nhlx-eyebrow">What’s inside</span>
            <h2 className="nhlx-h2">Three boards, <span>one standard</span></h2>
            <p className="nhlx-lede">Every row is a chance, a break-even price and the book’s price; every finished game grades its rows.</p>
            <div className="nhlx-cards" style={{ textAlign: 'left' }}>
              {SPORTS.map((s) => (
                <div className="nhlx-card" key={s.code}>
                  <img className="nhlx-card-logo" src={leagueLogo(s.code)} alt={s.code} width="64" height="64" />
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
            <div className="nhlx-hero-cta">
              <Link href="/auth/login" className="nhlx-btn">Sign in</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="nhlx-footer">
        <div className="nhlx-wrap">
          <span>ideareels · NFL, NBA and NHL picks</span>
          <span>Private tool · access by invitation</span>
        </div>
      </footer>
    </>
  );
}

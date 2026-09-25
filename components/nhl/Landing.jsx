import Link from 'next/link';
import SiteHeader from './SiteHeader';
import { teamLogo as logo } from '@/lib/nhl-data/teams';

const TEAMS = [
  ['BOS', 'Bruins'], ['BUF', 'Sabres'], ['DET', 'Red Wings'], ['FLA', 'Panthers'], ['MTL', 'Canadiens'],
  ['OTT', 'Senators'], ['TBL', 'Lightning'], ['TOR', 'Maple Leafs'], ['CAR', 'Hurricanes'], ['CBJ', 'Blue Jackets'],
  ['NJD', 'Devils'], ['NYI', 'Islanders'], ['NYR', 'Rangers'], ['PHI', 'Flyers'], ['PIT', 'Penguins'],
  ['WSH', 'Capitals'], ['CHI', 'Blackhawks'], ['COL', 'Avalanche'], ['DAL', 'Stars'], ['MIN', 'Wild'],
  ['NSH', 'Predators'], ['STL', 'Blues'], ['UTA', 'Mammoth'], ['WPG', 'Jets'], ['ANA', 'Ducks'],
  ['CGY', 'Flames'], ['EDM', 'Oilers'], ['LAK', 'Kings'], ['SJS', 'Sharks'], ['SEA', 'Kraken'],
  ['VAN', 'Canucks'], ['VGK', 'Golden Knights'],
];

const STEPS = [
  {
    title: 'Load the slate',
    body: 'Drop in tonight’s season and L5 matchup files. Add history, home/away splits, lineups, pace and defense rankings when you have them.',
  },
  {
    title: 'Run the engine',
    body: 'Shot supply, role and defense context feed Poisson ladders for shots on goal, goals, points and goalie saves, player by player.',
  },
  {
    title: 'Save and audit',
    body: 'Every run is stored with its input files. Reopen any slate later, attach the box scores and grade the calls in Audit View.',
  },
];

function TeamStrip() {
  const row = [...TEAMS, ...TEAMS];
  return (
    <div className="nhlx-marquee" aria-hidden>
      <div className="nhlx-marquee-track">
        {row.map(([abbr, name], i) => (
          <span className="nhlx-marquee-item" key={`${abbr}-${i}`}>
            <img src={logo(abbr)} alt="" width="30" height="30" loading="lazy" />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function Preview() {
  return (
    <div className="nhlx-hero-shot" aria-label="Example of the model's output format">
      <div className="nhlx-hero-shot-inner">
        <div className="nhlx-preview-grid">
          <div className="nhlx-matchcard">
            <div className="nhlx-matchcard-title">Tonight&apos;s matchup</div>
            <div className="nhlx-matchcard-sub">Every game on the slate gets its own board</div>
            <div className="nhlx-vs">
              <div className="nhlx-vs-team"><img src={logo('MTL')} alt="" width="64" height="64" />Away</div>
              <div className="nhlx-vs-mark">VS</div>
              <div className="nhlx-vs-team"><img src={logo('TOR')} alt="" width="64" height="64" />Home</div>
            </div>
          </div>
          <div className="nhlx-matchcard">
            <div className="nhlx-matchcard-title">Shots on goal ladder</div>
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
            <a href="#how">How it works</a>
            <a href="#teams">Coverage</a>
          </>
        )}
        right={<Link href="/auth/login" className="nhlx-btn nhlx-btn-sm">Sign in</Link>}
      />

      <main>
        <section className="nhlx-hero">
          <div className="nhlx-wrap">
            <span className="nhlx-eyebrow">NHL player prop model · v3.0</span>
            <h1>
              Nightly prop probabilities, <span className="is-accent">built from shot supply</span>
            </h1>
            <p className="nhlx-hero-copy">
              Upload the night&apos;s matchup files and get ranked ladders for shots, goals, points and saves,
              with every run saved for later audit.
            </p>
            <div className="nhlx-hero-cta">
              <Link href="/auth/login" className="nhlx-btn">Open the model <span className="nhlx-arrow">→</span></Link>
              <a href="#how" className="nhlx-btn nhlx-btn-ghost">How it works</a>
            </div>
            <Preview />
          </div>
        </section>

        <div id="teams"><TeamStrip /></div>

        <section className="nhlx-section" id="how">
          <div className="nhlx-wrap nhlx-center-text">
            <span className="nhlx-eyebrow">How it works</span>
            <h2 className="nhlx-h2">From matchup files to <span>ranked props</span></h2>
            <p className="nhlx-lede">Four markets, eight input feeds, all 32 teams. The model runs in your browser; the results and files are stored in your account.</p>
            <div className="nhlx-cards" style={{ textAlign: 'left' }}>
              {STEPS.map((s, i) => (
                <div className="nhlx-card" key={s.title}>
                  <div className="nhlx-card-num">0{i + 1}</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
            <div className="nhlx-hero-cta">
              <Link href="/auth/login" className="nhlx-btn">Sign in to run tonight&apos;s slate</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="nhlx-footer">
        <div className="nhlx-wrap">
          <span>NHL Model 3.0 · Shot Supply Engine</span>
          <span>Private tool · access by invitation</span>
        </div>
      </footer>
    </>
  );
}

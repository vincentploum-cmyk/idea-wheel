import Link from 'next/link';
import SiteHeader from './SiteHeader';

const TEAMS = [
  'Bruins', 'Sabres', 'Red Wings', 'Panthers', 'Canadiens', 'Senators', 'Lightning', 'Maple Leafs',
  'Hurricanes', 'Blue Jackets', 'Devils', 'Islanders', 'Rangers', 'Flyers', 'Penguins', 'Capitals',
  'Blackhawks', 'Avalanche', 'Stars', 'Wild', 'Predators', 'Blues', 'Mammoth', 'Jets',
  'Ducks', 'Flames', 'Oilers', 'Kings', 'Sharks', 'Kraken', 'Canucks', 'Golden Knights',
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

function Marquee() {
  const row = [...TEAMS, ...TEAMS];
  return (
    <div className="nhlx-marquee" aria-hidden>
      <div className="nhlx-marquee-track">
        {row.map((t, i) => (
          <span className="nhlx-marquee-item" key={`${t}-${i}`}>
            {t}
            <span className="nhlx-marquee-star">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const signIn = (
    <Link href="/auth/login" className="nhlx-btn nhlx-btn-sm">Sign in</Link>
  );
  return (
    <>
      <SiteHeader
        nav={(
          <>
            <a href="#how">How it works</a>
            <a href="#markets">Markets</a>
          </>
        )}
        right={signIn}
      />

      <main>
        <section className="nhlx-hero nhlx-glow">
          <div className="nhlx-wrap nhlx-hero-grid">
            <div>
              <span className="nhlx-eyebrow">NHL player prop model</span>
              <h1 style={{ marginTop: 22 }}>
                Shot<br />supply <span className="is-lime">engine</span>
              </h1>
              <p className="nhlx-hero-copy">
                A private probability model for NHL player props. Upload the night&apos;s matchup files and get
                ranked ladders for shots, goals, points and saves, with every run saved for later audit.
              </p>
              <div className="nhlx-hero-cta">
                <Link href="/auth/login" className="nhlx-btn">Open the model</Link>
                <a href="#how" className="nhlx-btn nhlx-btn-ghost">How it works</a>
              </div>
              <div className="nhlx-counters" id="markets">
                <div className="nhlx-counter"><b>4</b><span>Prop markets</span></div>
                <div className="nhlx-counter"><b>8</b><span>Input feeds</span></div>
                <div className="nhlx-counter"><b>32</b><span>Teams covered</span></div>
              </div>
            </div>

            <div className="nhlx-matchcard" aria-label="Example of the model's output format">
              <div className="nhlx-vs">
                <div className="nhlx-vs-team">
                  <img src="https://assets.nhle.com/logos/nhl/svg/TOR_dark.svg" alt="" width="120" height="80" />
                  Home
                </div>
                <div className="nhlx-vs-mark">VS</div>
                <div className="nhlx-vs-team">
                  <img src="https://assets.nhle.com/logos/nhl/svg/MTL_dark.svg" alt="" width="120" height="80" />
                  Away
                </div>
              </div>
              <div className="nhlx-matchcard-title">Shots on goal ladder</div>
              <div className="nhlx-ladder">
                {[['2+ SOG', 0.86], ['3+ SOG', 0.64], ['4+ SOG', 0.41], ['5+ SOG', 0.22]].map(([k, p]) => (
                  <div className="nhlx-ladder-row" key={k}>
                    <span>{k}</span>
                    <span className="nhlx-ladder-bar"><i style={{ width: `${p * 100}%` }} /></span>
                    <b>{Math.round(p * 100)}%</b>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 14, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Example output format
              </p>
            </div>
          </div>
        </section>

        <Marquee />

        <section className="nhlx-section nhlx-glow nhlx-glow-left" id="how">
          <div className="nhlx-wrap">
            <span className="nhlx-eyebrow">How it works</span>
            <h2 className="nhlx-h2">From matchup files to <span>ranked props</span></h2>
            <div className="nhlx-cards">
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

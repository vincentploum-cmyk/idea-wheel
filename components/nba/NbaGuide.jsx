// The NBA cheat sheet (#guide; Vincent, 2026-11-04: "Can we have this simplified in a cheat sheet somewhere on the site for
// nba"): what to look at for rebounds, assists and threes, and what to ignore, from the stat-by-stat study of 2026-11-03
// (docs/audits/2026-11-03-nba-stat-drivers.md, three seasons of box scores), with where each read sits on the Games tab.
// Static: no data, no request.

export const GUIDE = [
  {
    key: 'reb',
    title: 'Rebounds',
    look: [
      ['His rebounds per minute, last ~20 games.', 'A steady skill: one big night means little.'],
      ['His minutes in his last 2–3 games.', 'More minutes, more rebounds.'],
      ['The opponent’s rebounds allowed, all positions, last 10 games.', 'Games tab → Rebounds → the tag “gives up X reb a game in all” (hover it for the last 10). Soft third against tough third: about +0.4 rebounds, ~10%.'],
      ['A teammate just ruled out, above all a big man.', 'His rebounds get shared out.'],
    ],
    ignore: 'Head to head, home / away, pace, how many shots the opponent misses.',
  },
  {
    key: 'ast',
    title: 'Assists',
    look: [
      ['His assists per minute, last ~15 games, × his recent minutes.', null],
      ['The opponent’s assists allowed this season, all positions.', 'Assists move most with the matchup: about +13% from the toughest third to the softest. Its 3PA allowed helps a little (more threes, more assisted shots).'],
      ['Teammates out: the biggest lever.', 'A missing playmaker’s assists go to whoever runs the offense next: about +17% when a lot of production is missing.'],
    ],
    ignore: 'Head to head, home / away.',
  },
  {
    key: 'tpm',
    title: 'Threes',
    look: [
      ['His threes per minute, last 20–30 games.', 'The longest memory of the three: a hot week is mostly luck.'],
      ['The opponent’s 3-point attempts allowed.', 'Not its 3PM or 3P% allowed. Games tab → Threes → “3PA allowed · X to PGs · Y in all”. A team that lets opponents shoot a lot lifts every shooter ~10%.'],
      ['Teammates out: a medium effect.', 'Another shooter gets the shots.'],
      ['Expect noise.', 'The least predictable stat (about 28% of the night-to-night swing): be careful with thin edges.'],
    ],
    ignore: 'Head to head (about 1% of it carries into tonight), the opponent’s 3P% allowed.',
  },
];

export default function NbaGuide() {
  return (
    <div className="ir-guide">
      <p className="nhlx-auto-meta ir-guide-lede">What predicts each stat, from three seasons of box scores. The board’s projections already use all of it: the strong / lean / thin marks on the Games tab are where to look first.</p>
      <div className="ir-guide-grid">
        {GUIDE.map((g) => (
          <section key={g.key} className="ir-guide-col" aria-label={g.title}>
            <h3>{g.title}</h3>
            <div className="ir-guide-label">Look at</div>
            <ol>
              {g.look.map(([head, more]) => <li key={head}><b>{head}</b>{more ? <span> {more}</span> : null}</li>)}
            </ol>
            <div className="ir-guide-label is-ignore">Ignore</div>
            <p>{g.ignore}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

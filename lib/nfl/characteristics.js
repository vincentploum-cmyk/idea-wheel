// The NFL's characteristics: what PropFinder's team rows carry per game (the team's own row and
// what it gives up in all), ranked over the league, and the positions its defense leaks yards to.
import { makeCharacteristics, shareTrait } from '../picks/characteristics';

export const POS_WORD = { QB: 'quarterbacks', RB: 'running backs', WR: 'wide receivers', TE: 'tight ends' };
const POS_STAT = { QB: 'passYds', RB: 'rushYds', WR: 'recYds', TE: 'recYds' };

export const characteristics = makeCharacteristics({
  teamCount: 32,
  attack: [
    { key: 'passing', stat: 'passYds', text: 'Passing game', unit: 'passing yards' },
    { key: 'running', stat: 'rushYds', text: 'Running game', unit: 'rushing yards' },
    { key: 'scoring', stat: 'td', text: 'Finding the end zone', unit: 'touchdowns' },
    { key: 'security', stat: 'passInt', text: 'Ball security', unit: 'interceptions thrown', low: true },
  ],
  defense: [
    { key: 'passDefense', stat: 'passYds', text: 'Pass defense', unit: 'passing yards' },
    { key: 'runDefense', stat: 'rushYds', text: 'Run defense', unit: 'rushing yards' },
    { key: 'redZone', stat: 'td', text: 'Keeping teams out of the end zone', unit: 'touchdowns' },
    { key: 'takeaways', stat: 'passInt', text: 'Taking the ball away', unit: 'interceptions', low: true },
  ],
  positions: { stat: (pos) => POS_STAT[pos] || 'recYds', only: ['QB', 'RB', 'WR', 'TE'], word: POS_WORD, noun: 'yards', unit: () => 'yards' },
  headline: 'td',
  style: ({ own, against, league, leagueAgainst, pct }) => {
    if (!own) return [];
    const out = [];
    const share = (a, b) => (a != null && b > 0 ? a / b : null);
    const pass = share(own.passYds, (own.passYds || 0) + (own.rushYds || 0)); const lgPass = share(league.passYds, (league.passYds || 0) + (league.rushYds || 0));
    out.push(shareTrait({ key: 'balance', value: pass, league: lgPass, edge: 0.08, up: 'Pass-heavy', down: 'Run-heavy', detail: pass != null && lgPass != null ? `${pct(pass)} of its yards through the air, league ${pct(lgPass)} · PropFinder` : null }));
    const depth = share(own.passYds, own.passCmp); const lgDepth = share(league.passYds, league.passCmp);
    out.push(shareTrait({ key: 'downfield', value: depth, league: lgDepth, edge: 0.08, up: 'Pushes the ball downfield', down: 'Short passing game', detail: depth != null && lgDepth != null ? `${depth.toFixed(1)} yards a completion, league ${lgDepth.toFixed(1)} · PropFinder` : null }));
    if (against?.td != null && own.td != null && league.td > 0 && leagueAgainst.td > 0) {
      const tempo = own.td + against.td; const lgTempo = league.td + leagueAgainst.td;
      out.push(shareTrait({ key: 'tempo', kind: 'tempo', value: tempo, league: lgTempo, edge: 0.1, up: 'Plays in shootouts', down: 'Plays low-scoring games', detail: `${tempo.toFixed(1)} touchdowns a game both ways, league ${lgTempo.toFixed(1)} · PropFinder` }));
    }
    return out;
  },
});

export const { teamCharacteristics, gameCharacteristics } = characteristics;

// The NBA's characteristics: what PropFinder's team rows carry per game (the team's own row and
// what it gives up in all), ranked over the league, and the positions its defense leaks points to.
import { makeCharacteristics, shareTrait } from '../picks/characteristics';

export const POS_WORD = { PG: 'point guards', SG: 'shooting guards', SF: 'small forwards', PF: 'power forwards', C: 'centres', G: 'guards', F: 'forwards' };

export const characteristics = makeCharacteristics({
  teamCount: 30,
  attack: [
    { key: 'scoring', stat: 'pts', text: 'Scoring', unit: 'points' },
    { key: 'rebounding', stat: 'reb', text: 'Rebounding', unit: 'rebounds' },
    { key: 'playmaking', stat: 'ast', text: 'Ball movement', unit: 'assists' },
    { key: 'threes', stat: 'tpm', text: 'Three-point shooting', unit: 'threes' },
    { key: 'line', stat: 'ftm', text: 'Getting to the line', unit: 'free throws' },
    { key: 'security', stat: 'tov', text: 'Ball security', unit: 'turnovers', low: true },
  ],
  defense: [
    { key: 'ptsAgainst', stat: 'pts', text: 'Limiting points', unit: 'points' },
    { key: 'rebAgainst', stat: 'reb', text: 'Limiting rebounds', unit: 'rebounds' },
    { key: 'astAgainst', stat: 'ast', text: 'Limiting assists', unit: 'assists' },
    { key: 'tpmAgainst', stat: 'tpm', text: 'Defending the three', unit: 'threes' },
    { key: 'ftmAgainst', stat: 'ftm', text: 'Keeping opponents off the line', unit: 'free throws' },
    { key: 'forcing', stat: 'tov', text: 'Forcing turnovers', unit: 'turnovers', low: true },
    { key: 'rim', stat: 'blk', text: 'Rim protection', unit: 'blocks', own: true },
    { key: 'hands', stat: 'stl', text: 'Active hands', unit: 'steals', own: true },
  ],
  // The five positions PropFinder's opponent rows carry (G / F groups left aside), points allowed to each.
  positions: { stat: 'pts', only: ['PG', 'SG', 'SF', 'PF', 'C'], word: POS_WORD, noun: 'points', unit: () => 'points' },
  headline: 'pts',
  style: ({ own, against, league, leagueAgainst, pct }) => {
    if (!own) return [];
    const out = [];
    const share = (a, b) => (a != null && b > 0 ? a / b : null);
    const threes = share(own.tpm * 3, own.pts); const lgThrees = share(league.tpm * 3, league.pts);
    out.push(shareTrait({ key: 'threes', value: threes, league: lgThrees, up: 'Lives on the three', down: 'Scores inside the arc', detail: threes != null && lgThrees != null ? `${pct(threes)} of its points from threes, league ${pct(lgThrees)} · PropFinder` : null }));
    const line = share(own.ftm, own.pts); const lgLine = share(league.ftm, league.pts);
    out.push(shareTrait({ key: 'line', value: line, league: lgLine, up: 'Gets to the line', down: 'Rarely at the line', detail: line != null && lgLine != null ? `${pct(line)} of its points from the line, league ${pct(lgLine)} · PropFinder` : null }));
    const assists = share(own.ast, own.pts); const lgAssists = share(league.ast, league.pts);
    out.push(shareTrait({ key: 'sharing', value: assists, league: lgAssists, up: 'Shares the ball', down: 'Isolation-heavy', detail: assists != null && lgAssists != null ? `${(assists * 100).toFixed(1)} assists per 100 points, league ${(lgAssists * 100).toFixed(1)} · PropFinder` : null }));
    if (against?.pts != null && own.pts != null && league.pts > 0 && leagueAgainst.pts > 0) {
      const tempo = own.pts + against.pts; const lgTempo = league.pts + leagueAgainst.pts;
      out.push(shareTrait({ key: 'tempo', kind: 'tempo', value: tempo, league: lgTempo, edge: 0.04, up: 'Plays in shootouts', down: 'Plays low-scoring games', detail: `${tempo.toFixed(1)} points a game both ways, league ${lgTempo.toFixed(1)} · PropFinder` }));
    }
    return out;
  },
});

export const { teamCharacteristics, gameCharacteristics } = characteristics;

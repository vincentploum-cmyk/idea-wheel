#!/usr/bin/env node
// The day's results across the three sports, as markdown: reads the scorecards the daily results workflow saved
// (.github/workflows/daily-results.yml: nhl.json, nba.json, nfl.json, each `?rows=1` for one ET date) and prints
// how the model did. `node tools/audit/yesterday.mjs <dir> <date>`. A missing or failed file prints as such.
import fs from 'fs';
import path from 'path';

const [dir = '.', date = ''] = process.argv.slice(2);
const read = (name) => {
  try { return JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')); } catch { return null; }
};
const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);
const sgn = (x) => (x == null ? '–' : `${x >= 0 ? '+' : ''}${Math.round(x * 100)}`);
const num = (x, d = 3) => (x == null ? '–' : Number(x).toFixed(d));
const bias = (x) => (x == null ? '–' : `${x >= 0 ? '+' : ''}${Number(x).toFixed(2)}`);
const out = [];
const line = (...s) => out.push(...(s.length ? s : ['']));

line(`# How the model did${date ? ` on ${date}` : ''}`);

// ── NHL: the model's saved runs graded against the box scores (lib/nhl-data/scorecard.js).
const nhl = read('nhl');
line('', '## NHL');
if (!nhl || nhl.error) line(`No scorecard (${nhl?.error || 'not fetched'}).`);
else if (!nhl.players) line('No graded games (no final, or no run saved before puck drop).');
else {
  line(`${nhl.games} games, ${nhl.players} skaters graded${nhl.missing ? ` (${nhl.missing} not in the box scores)` : ''}.`, '');
  line('| Market | Calls | Said | Hit | Brier | Best-bet calls | Best-bet hit |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const m of nhl.markets || []) line(`| ${m.label} | ${m.n} | ${pct(m.avg)} | ${pct(m.hit)} | ${num(m.brier, 4)} | ${m.best?.n || 0} | ${pct(m.best?.hit)} |`);
  const p = nhl.picks || {};
  line('', `Top-5 boards replayed: shots ${p.shots?.n || 0} plays, 3+ SOG hit ${pct(p.shots?.s3?.hit)} (said ${pct(p.shots?.s3?.avg)}), 4+ SOG hit ${pct(p.shots?.s4?.hit)} (said ${pct(p.shots?.s4?.avg)}); goals ${p.goals?.n || 0} plays, 1+ G hit ${pct(p.goals?.g1?.hit)} (said ${pct(p.goals?.g1?.avg)}).`);
  // Each skater's best bet, strongest first, with what he did.
  const STAT = { '1+ point': ['pts', 1], 'Anytime goal': ['g', 1], '4+ shots': ['sog', 4], '3+ shots': ['sog', 3], '5+ shots': ['sog', 5], '2+ points': ['pts', 2], '2+ goals': ['g', 2] };
  const best = (nhl.rows || []).filter((r) => r.best && STAT[r.best] && r.bestProb != null).sort((a, b) => b.bestProb - a.bestProb).slice(0, 15);
  if (best.length) {
    line('', '**Strongest best bets**', '', '| Player | Game | Bet | Chance | Result |', '| --- | --- | --- | ---: | --- |');
    for (const r of best) {
      const [stat, min] = STAT[r.best];
      line(`| ${r.name} (${r.team}) | ${r.venue === 'H' || r.venue === 'home' ? `${r.opp} @ ${r.team}` : `${r.team} @ ${r.opp}`} | ${r.best} | ${pct(r.bestProb)} | ${r[stat] >= min ? 'hit' : 'miss'} (${r[stat]} ${stat}) |`);
    }
  }
  const s = nhl.scores;
  if (s?.games?.length) {
    // The stored projection where there is one, else the run's Σ λ goals (scoresReport); keyed by team.
    line('', '**Predicted scores**', '', '| Game | Predicted | Home win | Final | Winner called |', '| --- | --- | ---: | --- | --- |');
    let right = 0;
    let called = 0;
    for (const g of s.games) {
      const pr = g.stored || g.run;
      const fin = g.final;
      const pick = g.homeWin != null ? (g.homeWin >= 0.5 ? g.home : g.away) : null;
      const won = fin && fin.home !== fin.away ? (fin.home > fin.away ? g.home : g.away) : null;
      if (pick && won) { called += 1; if (pick === won) right += 1; }
      line(`| ${g.away} @ ${g.home} | ${pr ? `${num(pr[g.away], 1)}–${num(pr[g.home], 1)}` : '–'} | ${pct(g.homeWin)} | ${fin ? `${fin.away}–${fin.home}` : '–'} | ${pick && won ? (pick === won ? 'yes' : 'no') : '–'} |`);
    }
    if (called) line('', `Winners called: ${right} of ${called}.`);
  }
}

// ── NBA and NFL: the picks board replayed and graded (lib/picks/scorecard.js).
function picks(title, card) {
  line('', `## ${title}`);
  if (!card || card.error) { line(`No scorecard (${card?.error || 'not fetched'}${card?.detail ? `: ${card.detail}` : ''}).`); return; }
  if (!card.games) { line('No graded games (no final that day).'); return; }
  line(`${card.games} games, ${card.plays} plays graded, ${card.boardPlays} on the board.`, '');
  const row = (label, x) => `| ${label} | ${x?.n || 0} | ${pct(x?.said)} | ${pct(x?.hit)} | ${sgn(x?.diff)} | ${num(x?.brier, 4)} | ${x?.priced ? `${x.priced} / ${sgn(x.ret)}u per 100` : '–'} |`;
  if (card.plays) {
    line('| Set | Plays | Said | Hit | Hit − said | Brier | Priced / return |', '| --- | ---: | ---: | ---: | ---: | ---: | --- |');
    line(row('Every play', card.all));
    line(row('On the board', card.board));
    line('', '| Market | Plays | Said | Hit | Board plays | Board said | Board hit |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const m of card.markets || []) if (m.all?.n) line(`| ${m.label} | ${m.all.n} | ${pct(m.all.said)} | ${pct(m.all.hit)} | ${m.board?.n || 0} | ${pct(m.board?.said)} | ${pct(m.board?.hit)} |`);
  }
  // The projections against the books' consensus line (book-lines.json, stored since 2026-11-24): the lower miss wins.
  if (card.vsBook && Object.keys(card.vsBook).length) {
    line('', '**Projection against the books\' line** (average miss; got − said; on a 1+ point lean off the line, how often he landed on the board\'s side)', '',
      '| Stat | Players | Board miss | Book miss | Half-half miss | Board got − said | Book got − said | Leans | Board side right |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const [m, x] of Object.entries(card.vsBook)) line(`| ${m} | ${x.n} | ${num(x.board, 2)} | ${num(x.book, 2)} | ${num(x.half, 2)} | ${bias(x.boardBias)} | ${bias(x.bookBias)} | ${x.leans} | ${pct(x.leanRight)} |`);
  }
  const ladders = (card.ladders || []).filter((l) => l.main?.n);
  if (ladders.length) {
    line('', '| Ladder (main rung) | Rungs | Said | Hit | Brier |', '| --- | ---: | ---: | ---: | ---: |');
    for (const l of ladders) line(`| ${l.label} | ${l.main.n} | ${pct(l.main.said)} | ${pct(l.main.hit)} | ${num(l.main.brier, 4)} |`);
  } else if ((card.ladders || []).some((l) => l.blend?.n)) {
    // No book line stored (no main rung, no plays): every rung of the ladders, the blend against the model alone and
    // the hit rate alone, and the 20–35% ceiling rungs.
    if (!card.plays) line('No book lines stored for these games, so no plays: the ladders are graded on every rung.');
    line('', '| Ladder (every rung) | Rungs | Said | Hit | Brier blend | Brier model | Brier hit rate | Ceiling rungs said / hit |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
    for (const l of card.ladders) if (l.blend?.n) line(`| ${l.label} | ${l.blend.n} | ${pct(l.blend.said)} | ${pct(l.blend.hit)} | ${num(l.blend.brier, 4)} | ${num(l.model?.brier, 4)} | ${num(l.emp?.brier, 4)} | ${l.ceiling?.n ? `${pct(l.ceiling.said)} / ${pct(l.ceiling.hit)} (${l.ceiling.n})` : '–'} |`);
  }
  const board = (card.rows?.plays || []).filter((x) => x.onBoard).sort((a, b) => b.p - a.p);
  if (board.length) {
    line('', '**The board\'s plays**', '', '| Player | Play | Chance | Odds | Result |', '| --- | --- | ---: | ---: | --- |');
    for (const x of board) line(`| ${x.key} | ${x.side === 'under' ? 'under' : 'over'} ${x.line} ${x.market} | ${pct(x.p)} | ${x.odds ?? '–'} | ${x.hit ? 'hit' : 'miss'} (${x.actual ?? '–'}) |`);
  }
}
picks('NBA', read('nba'));
picks('NFL', read('nfl'));

process.stdout.write(`${out.join('\n')}\n`);

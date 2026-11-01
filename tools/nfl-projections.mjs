#!/usr/bin/env node
// The week's NFL projections as text (Vincent, 2026-11-01: "write a script based on the data from propfinder and the cheat
// sheet … the projected yards / TD candidates per game"): the Top TD board, the first-half TD board, the receiving /
// rushing / passing projections with the heights each player clears, the TE touchdowns, then every game. The figures are
// the site's own (lib/nfl/projections.js, `projections` on GET /api/nfl/picks): no price, no edge.
//
//   node tools/nfl-projections.mjs                         this week, from https://ideareels.io (NHL_ACTIONS_TOKEN in the env)
//   node tools/nfl-projections.mjs --season 2026 --week 9  a given week
//   node tools/nfl-projections.mjs --file picks.json       a saved /api/nfl/picks payload
//   --base http://localhost:3000   another server · --all   every row of every board · --games   the games alone
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, dflt = null) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt; };
const flag = (name) => args.includes(`--${name}`);

async function load() {
  const file = opt('file');
  if (file) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const base = opt('base', process.env.SITE_URL || 'https://ideareels.io');
  const token = process.env.NHL_ACTIONS_TOKEN || process.env.NHL_SYNC_TOKEN;
  if (!token) throw new Error('Set NHL_ACTIONS_TOKEN (the site’s sync token), or pass --file with a saved /api/nfl/picks payload.');
  const q = new URLSearchParams();
  for (const k of ['season', 'week', 'type', 'date']) if (opt(k)) q.set(k, opt(k));
  const res = await fetch(`${base}/api/nfl/picks${q.size ? `?${q}` : ''}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${res.status} from ${base}/api/nfl/picks: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const n0 = (v) => (v == null ? '—' : String(Math.round(v)));
const words = (r) => (r.role || []).map((x) => x.word).join(', ');
const tag = (r) => [r.onSheet ? '✓ sheet' : null, words(r) || null, r.health === 'DTD' ? 'DTD' : null].filter(Boolean).join(', ');
const who = (r) => `${r.player} (${r.team} ${r.venue === 'H' ? 'vs' : '@'} ${r.opp})${tag(r) ? `, ${tag(r)}` : ''}`;

const SHOWN = { td: 10, firstHalfTd: 8, receiving: 8, rushing: 6, passing: 4, teTd: 3 };
const YARDS = { receiving: 'rec_yds', rushing: 'rush_yds', passing: 'pass_yds' };
const TITLE = { td: 'Top TD Board', firstHalfTd: 'Best First-Half TD Board', receiving: 'Best Receiving Projections', rushing: 'Best Rushing Projections', passing: 'Best Passing Projections', teTd: 'TE TDs Across Slate' };

function boardLines(pj, key) {
  const ids = pj.boards[key] || [];
  const rows = (flag('all') ? ids : ids.slice(0, SHOWN[key])).map((id) => pj.rows[id]).filter(Boolean);
  const out = [TITLE[key], ''];
  rows.forEach((r, i) => {
    const m = YARDS[key];
    if (m) {
      const y = r.yards[m];
      const heights = y.marks.map((x) => `${x.mark} ${pct(x.p)}`).join(' / ');
      out.push(`${i + 1}. ${who(r)} — ${n0(y.exp)} yds (${y.floor}–${y.ceiling})${heights ? ` · ${heights}` : ''}${y.line != null ? ` · book ${y.line}` : ''}${y.sheetLine != null ? ` · sheet ${y.sheetLine}` : ''}`);
    } else {
      const t = r.td;
      const p = key === 'firstHalfTd' ? t.p1h : t.p;
      const vol = [t.carries > 0 ? `${n0(t.carries)} car` : null, t.targets > 0 ? `${n0(t.targets)} tgt` : null].filter(Boolean).join(', ');
      out.push(`${i + 1}. ${who(r)} — ${pct(p)}${r.pos === 'QB' ? ' rushing TD' : ''}${key === 'firstHalfTd' ? ` (anytime ${pct(t.p)})` : ` (1H ${pct(t.p1h)})`}${vol ? ` · ${vol}` : ''}${t.spot?.rank ? ` · ${r.opp} #${t.spot.rank} to ${t.spot.pos}s` : ''}`);
    }
  });
  if (!rows.length) out.push('(nothing yet: the week needs a PropFinder pull)');
  return out.join('\n');
}

function gameLines(pj) {
  const out = ['By Game', ''];
  for (const g of pj.games) {
    out.push(`${g.away} @ ${g.home}${g.odds?.total != null ? ` · total ${g.odds.total}` : ''}${g.odds?.spread ? ` · ${g.odds.spread}` : ''}${g.final ? ` · final ${g.awayScore}–${g.homeScore}` : ''}`);
    for (const team of [g.away, g.home]) {
      const t = g.teams[team];
      if (!t) { out.push(`  ${team}: no PropFinder players`); continue; }
      const y = (ids, m) => ids.map((id) => `${pj.rows[id].player} ${n0(pj.rows[id].yards[m].exp)}`).join(', ') || '—';
      out.push(`  ${team}${t.teamTd.tonight != null ? ` (${t.teamTd.tonight.toFixed(1)} TDs expected)` : ''}`);
      out.push(`    pass ${y(t.passing, 'pass_yds')} · rush ${y(t.rushing, 'rush_yds')} · rec ${y(t.receiving, 'rec_yds')}`);
      out.push(`    TD ${t.td.map((id) => `${pj.rows[id].player} ${pct(pj.rows[id].td.p)}${words(pj.rows[id]) ? ` (${words(pj.rows[id])})` : ''}`).join(', ') || '—'}`);
    }
    out.push('');
  }
  return out.join('\n');
}

const board = await load();
const pj = board.projections;
if (!pj) { console.error('The payload carries no projections (a board built before 2026-11-01, or no PropFinder pull for the week).'); process.exit(1); }
const head = `NFL ${board.type === 3 ? `postseason round ${board.week}` : `week ${board.week}`}, ${board.season}`;
const parts = flag('games') ? [gameLines(pj)] : [...Object.keys(TITLE).map((k) => boardLines(pj, k)), gameLines(pj)];
console.log([head, ...parts].join('\n\n'));

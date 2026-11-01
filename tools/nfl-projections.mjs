#!/usr/bin/env node
// The week's NFL projections as text, in the site's layout (Vincent, 2026-11-01: "based on today's matchup and the
// player's skill, and today's script, this is the floor and this is the ceiling … In case of touch down: Player -
// chance% of td"): every game with its TDs, receiving and rushing lists, then the three lists across the week. The
// figures are the site's own (lib/nfl/projections.js, `projections` on GET /api/nfl/picks): tonight's projection = his
// skill × the matchup × the game script, his floor and ceiling around it (a bad day, a good day); a touchdown chance is
// strong from 45%, lean from 30%. No price.
//
//   node tools/nfl-projections.mjs                         this week, from https://ideareels.io (NHL_ACTIONS_TOKEN in the env)
//   node tools/nfl-projections.mjs --season 2026 --week 9  a given week
//   node tools/nfl-projections.mjs --file picks.json       a saved /api/nfl/picks payload
//   --base http://localhost:3000   another server · --games   the games alone · --week-lists   the three week lists alone
//   --top 25   rows per week list (all by default)
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
const n1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
const words = (r) => (r.role || []).map((x) => x.word).join(', ');
const tag = (r) => [r.onSheet ? '✓' : null, r.health === 'DTD' ? 'DTD' : null, words(r) || null].filter(Boolean).join(', ');
const who = (r, game) => `${r.player} (${r.team}${game ? ` ${r.venue === 'H' ? 'vs' : '@'} ${r.opp}` : ''})${tag(r) ? ` [${tag(r)}]` : ''}`;
const n0 = (v) => (v == null ? '—' : String(Math.round(v)));

function lines(pj, ids, kind, game) {
  const rows = ids.map((id) => pj.rows[id]).filter(Boolean);
  if (!rows.length) return ['  (none)'];
  return rows.map((r, i) => {
    if (kind === 'td') return `  ${i + 1}. ${who(r, game)} — ${pct(r.td.p)} (${r.td.tier})${r.pos === 'QB' ? ' rushing' : ''} · 1st half ${pct(r.td.p1h)}`;
    const y = r.yards[kind === 'receiving' ? 'rec_yds' : 'rush_yds'];
    const c = kind === 'receiving' ? r.yards.receptions : null;
    const rec = c ? ` · rec ${n0(c.floor)} / ${n1(c.proj)} / ${n0(c.ceiling)}` : '';
    const got = y.actual != null ? ` · got ${y.actual}${y.grade === 'over' ? ' (over his ceiling)' : y.grade === 'under' ? ' (under his floor)' : ''}` : '';
    return `  ${i + 1}. ${who(r, game)} — floor ${n0(y.floor)} · proj ${n0(y.proj)} · ceiling ${n0(y.ceiling)} yds${rec}${got}`;
  });
}

const TITLES = [['td', 'TDs'], ['receiving', 'Receiving'], ['rushing', 'Rushing']];

function gameText(pj) {
  const out = [];
  for (const g of pj.games) {
    out.push(`${g.away} @ ${g.home}${g.odds?.total != null ? ` · total ${g.odds.total}` : ''}${g.odds?.spread ? ` · ${g.odds.spread}` : ''}${g.final ? ` · final ${g.awayScore}–${g.homeScore}` : ''}`);
    for (const team of [g.away, g.home]) {
      const sc = g.teams?.[team]?.script;
      if (sc?.words?.length) out.push(`  ${team} script: ${sc.words.join(' · ')} (volume × ${sc.volume}, run × ${sc.rush}, pass × ${sc.pass})`);
      const d = g.teams?.[team]?.defense;
      if (d?.weak?.length) out.push(`  ${d.of} defense gives up the most to ${d.weak.slice(0, 3).map((w) => `${w.word} (#${w.rank})`).join(', ')}`);
    }
    for (const [k, title] of TITLES) out.push(` ${title}`, ...lines(pj, g.lists?.[k] || [], k, false));
    out.push('');
  }
  return out.join('\n');
}

function weekText(pj) {
  const top = Number(opt('top')) || null;
  return TITLES.map(([k, title]) => [`All ${title}`, ...lines(pj, (pj.lists?.[k] || []).slice(0, top || undefined), k, true)].join('\n')).join('\n\n');
}

const board = await load();
const pj = board.projections;
if (!pj?.lists) { console.error('The payload carries no projection lists (a board built before 2026-11-01, or no PropFinder pull for the week).'); process.exit(1); }
const head = `NFL ${board.type === 3 ? `postseason round ${board.week}` : `week ${board.week}`}, ${board.season} · yards: tonight's projection (skill × matchup × game script) with a floor (bad day) and ceiling (good day); TDs strong from 45%, lean from 30%`;
const parts = flag('games') ? [gameText(pj)] : flag('week-lists') ? [weekText(pj)] : [gameText(pj), weekText(pj)];
console.log([head, ...parts].join('\n\n'));

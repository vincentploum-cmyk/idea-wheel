#!/usr/bin/env node
// Port the site's model changes into the local model app (App.jsx, the model's source of truth),
// the same edits made to components/nhl/model-core.js, in three groups, each all-or-nothing:
//   1. 2026-10-13 (a022443): p2s / p3s / p4s / p5s are the Poisson tails of λ shots; the ladder's
//      figures ride along as ladderP3s / P4s / P5s and still set the attack score.
//   2. 2026-10-20 (4ec641f): p1g / p2g / p3g are the Poisson tails of λ goals; the ladder's figures
//      ride along as ladderP1g / P2g / P3g and still set the attack score.
//   3. 2026-10-27 (26b1084): the home / away split's share of a skater's goal base and the
//      historical-profile multipliers on the goal ladder cut to a quarter (VENUE_SPLIT_WEIGHT,
//      H2H_WEIGHT, venueMix).
//
//   node tools/port-model-core.mjs [path to App.jsx] [--check]
//
// Default path: ~/Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx. Every edit is an exact-text
// replacement that must match once. A group whose new text is already there is reported as
// ported; a group with a missing anchor is skipped and named, the others still go in. A backup
// is written beside the file before it is changed. --check reports and writes nothing.
// Self-test: applied to the model-core of 2026-10-12, groups 1 and 2 reproduce the file of
// 2026-10-20 exactly (`git show 15512c0^1:components/nhl/model-core.js`, `git show 4ec641f:…`).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CONSTANTS_BLOCK = `
// ─── WEIGHTS UNDER REVIEW (2026-10-27) ────────────────────────────────────────
// Vincent's call after docs/shots-goals-predictors.md section 16 (this season's data: the home /
// away split moves P(1+ goal) ×1.02 across its range and the head-to-head ×1.00, against ×4.2 for
// his season rate): the split's share of a skater's goal base, which used to replace his season
// rate outright, and the historical-profile (position vs opponent) multipliers on the goal ladder
// are cut to a quarter for now. 1 is the model as it was, 0 the factor off.
const VENUE_SPLIT_WEIGHT = 0.25;
const H2H_WEIGHT = 0.25;
/** A venue-split figure at its weight over the season figure; the season figure alone without a split. */
function venueMix(venueValue, seasonValue) {
  if (venueValue == null || !Number.isFinite(Number(venueValue))) return seasonValue;
  return VENUE_SPLIT_WEIGHT * Number(venueValue) + (1 - VENUE_SPLIT_WEIGHT) * (Number(seasonValue) || 0);
}
`;

const SHOTS_ODDS = [
  {
    name: 'the published shots odds',
    old: '        p3s = clamp(Number.isFinite(Number(p3s)) ? Number(p3s) : 0, 0, 0.999);\n'
      + '        p4s = clamp(Number.isFinite(Number(p4s)) ? Number(p4s) : 0, 0, 0.999);\n'
      + '        p5s = clamp(Number.isFinite(Number(p5s)) ? Number(p5s) : 0, 0, 0.999);\n',
    new: '        const ladderP3s = clamp(Number.isFinite(Number(p3s)) ? Number(p3s) : 0, 0, 0.999);\n'
      + '        const ladderP4s = clamp(Number.isFinite(Number(p4s)) ? Number(p4s) : 0, 0, 0.999);\n'
      + '        const ladderP5s = clamp(Number.isFinite(Number(p5s)) ? Number(p5s) : 0, 0, 0.999);\n'
      + '        // The published shots odds are the Poisson tails of the row\'s λ shots (lineBoostedS).\n'
      + '        // Graded on 2,748 player-games (Oct 1-12, 2026), the ladder\'s figures above ran far\n'
      + '        // past what the box scores returned (at 50%+ they hit 49%; RW1/RW2 under, D1/D2 and\n'
      + '        // depth forwards off), while the Poisson read of the same λ scored better in every\n'
      + '        // bucket a bet is made in (Brier 0.159 vs 0.169). The ladder\'s figures stay on the row\n'
      + '        // as ladderP3s/P4s/P5s and still drive the attack score and the shot tiers.\n'
      + '        p3s = clamp(poissonAtLeast(lineBoostedS, 3), 0, 0.999);\n'
      + '        p4s = clamp(poissonAtLeast(lineBoostedS, 4), 0, 0.999);\n'
      + '        p5s = clamp(poissonAtLeast(lineBoostedS, 5), 0, 0.999);\n'
      + '        const p2s = clamp(poissonAtLeast(lineBoostedS, 2), 0, 0.999);\n',
  },
  {
    name: 'the result row\'s shots fields',
    old: '          p3s: +p3s.toFixed(4),\n          p4s: +p4s.toFixed(4),\n          p5s: +p5s.toFixed(4),\n',
    new: '          p2s: +p2s.toFixed(4),\n          p3s: +p3s.toFixed(4),\n          p4s: +p4s.toFixed(4),\n          p5s: +p5s.toFixed(4),\n'
      + '          ladderP3s: +ladderP3s.toFixed(4),\n          ladderP4s: +ladderP4s.toFixed(4),\n          ladderP5s: +ladderP5s.toFixed(4),\n',
  },
  {
    name: 'the attack score\'s shots terms',
    old: '            0.16 * p3s +\n            0.24 * p4s +\n            0.12 * p5s +\n',
    new: '            0.16 * ladderP3s +\n            0.24 * ladderP4s +\n            0.12 * ladderP5s +\n',
  },
];

const GOAL_ODDS = [
  {
    name: 'the published goal odds',
    old: '        p1g = clamp(Number.isFinite(Number(p1g)) ? Number(p1g) : 0, 0, 0.999);\n'
      + '        p2g = clamp(Number.isFinite(Number(p2g)) ? Number(p2g) : 0, 0, 0.999);\n'
      + '        p3g = clamp(Number.isFinite(Number(p3g)) ? Number(p3g) : 0, 0, 0.999);\n',
    new: '        const ladderP1g = clamp(Number.isFinite(Number(p1g)) ? Number(p1g) : 0, 0, 0.999);\n'
      + '        const ladderP2g = clamp(Number.isFinite(Number(p2g)) ? Number(p2g) : 0, 0, 0.999);\n'
      + '        const ladderP3g = clamp(Number.isFinite(Number(p3g)) ? Number(p3g) : 0, 0, 0.999);\n'
      + '        // The published goal odds are the Poisson tails of the row\'s λ goals (lambdaGDisplay),\n'
      + '        // the same step the shots odds took above. Graded on 1,728 player-games (Oct 13-20,\n'
      + '        // 2026), the goal ladder\'s figures did not follow the λ: at 50%+ they hit 30% (the\n'
      + '        // boards\' anytime-goal plays: stated 0.58, hit 0.29, n = 35), skaters on a λ near 0.25\n'
      + '        // were published at 60-67% and the top λ were capped near 0.37, while the Poisson read\n'
      + '        // of the same λ scored better over all rows (Brier 0.124 vs 0.130) and read 0.41 against\n'
      + '        // a 0.41 hit on the rows over the boards\' floor. The ladder\'s figures stay on the row as\n'
      + '        // ladderP1g/P2g/P3g and still drive the attack score and the goal tier.\n'
      + '        p1g = clamp(poissonAtLeast(lambdaGDisplay, 1), 0, 0.999);\n'
      + '        p2g = clamp(poissonAtLeast(lambdaGDisplay, 2), 0, 0.999);\n'
      + '        p3g = clamp(poissonAtLeast(lambdaGDisplay, 3), 0, 0.999);\n',
  },
  {
    name: 'the result row\'s goal fields',
    old: '          p1g: +p1g.toFixed(4),\n          p2g: +p2g.toFixed(4),\n          p3g: +p3g.toFixed(4),\n',
    new: '          p1g: +p1g.toFixed(4),\n          p2g: +p2g.toFixed(4),\n          p3g: +p3g.toFixed(4),\n'
      + '          ladderP1g: +ladderP1g.toFixed(4),\n          ladderP2g: +ladderP2g.toFixed(4),\n          ladderP3g: +ladderP3g.toFixed(4),\n',
  },
  {
    name: 'the attack score\'s goal terms',
    old: '            0.09 * p1g +\n            0.025 * p2g +\n            0.005 * p3g\n',
    new: '            0.09 * ladderP1g +\n            0.025 * ladderP2g +\n            0.005 * ladderP3g\n',
  },
];

const WEIGHTS = [
  { name: 'the ladder\'s venue-form multiplier', old: '  const compressedVenue = 1 + (venueGoalMult - 1) * 0.18;\n', new: '  const compressedVenue = 1 + (venueGoalMult - 1) * 0.18 * VENUE_SPLIT_WEIGHT;\n' },
  { name: 'the ladder\'s history multiplier (1+ goal)', old: '  const compressedHist1 = 1 + (histGoalMult1 - 1) * 0.22;\n', new: '  const compressedHist1 = 1 + (histGoalMult1 - 1) * 0.22 * H2H_WEIGHT;\n' },
  { name: 'the ladder\'s history multiplier (2+ goals)', old: '  const compressedHist2 = 1 + (histGoalMult2 - 1) * 0.18;\n', new: '  const compressedHist2 = 1 + (histGoalMult2 - 1) * 0.18 * H2H_WEIGHT;\n' },
  { name: 'the team goals budget', old: '    return sum + Math.max(0, venueGoals != null && venueGoals > 0 ? venueGoals : seasonGoals);\n', new: '    return sum + Math.max(0, venueGoals != null && venueGoals > 0 ? venueMix(venueGoals, seasonGoals) : seasonGoals);\n' },
  { name: 'the style read\'s goal base', old: '      goalsBase: p.pHA ? (isHome ? p.pHA.g_home : p.pHA.g_away) : goals,\n', new: '      goalsBase: p.pHA ? venueMix(isHome ? p.pHA.g_home : p.pHA.g_away, goals) : goals,\n' },
  {
    name: 'the capability floors\' goal base',
    old: '  const seasonGoals = skater.goalsSeason || 0;\n  const baseGoals = Math.max(0.001,\n    venueGoalsBase != null && venueGoalsBase > 0\n'
      + '      ? 0.72 * venueGoalsBase + 0.18 * seasonGoals + 0.10 * Math.max(0, venueGoalsL5 || 0)\n      : 0.80 * seasonGoals + 0.20 * Math.max(0, skater.goalsL5 || seasonGoals)\n  );\n',
    new: '  const seasonGoals = skater.goalsSeason || 0;\n  const seasonGoalsBase = 0.80 * seasonGoals + 0.20 * Math.max(0, skater.goalsL5 || seasonGoals);\n  const baseGoals = Math.max(0.001,\n    venueGoalsBase != null && venueGoalsBase > 0\n'
      + '      ? VENUE_SPLIT_WEIGHT * (0.72 * venueGoalsBase + 0.18 * seasonGoals + 0.10 * Math.max(0, venueGoalsL5 || 0)) + (1 - VENUE_SPLIT_WEIGHT) * seasonGoalsBase\n      : seasonGoalsBase\n  );\n',
  },
  {
    name: 'the skater\'s goal base (season and last five)',
    old: '        const goalsL5 = (venueGoalsL5 !== null ? venueGoalsL5 : skater.goalsL5) ?? 0;\n        const goalsSeason = (venueGoalsSeason !== null ? venueGoalsSeason : skater.goalsSeason) ?? 0;\n',
    new: '        // The venue split at VENUE_SPLIT_WEIGHT over his season figures (it used to replace them).\n        const goalsL5 = venueMix(venueGoalsL5, skater.goalsL5 ?? 0) ?? 0;\n        const goalsSeason = venueMix(venueGoalsSeason, skater.goalsSeason ?? 0) ?? 0;\n',
  },
];

export const GROUPS = [
  { key: 'shotsOdds20261013', label: 'shots odds (2026-10-13): p2s / p3s / p4s / p5s the Poisson tails of λ shots, the ladder as ladderP3s / P4s / P5s', edits: SHOTS_ODDS },
  { key: 'goalOdds20261020', label: 'goal odds (2026-10-20): p1g / p2g / p3g the Poisson tails of λ goals, the ladder as ladderP1g / P2g / P3g', edits: GOAL_ODDS },
  { key: 'weights20261027', label: 'venue split and head-to-head at a quarter (2026-10-27)', edits: WEIGHTS, constants: true },
];

/** The end index of the `function poissonAtLeast(` body (after its closing brace), or -1. */
function afterPoissonAtLeast(src) {
  const start = src.indexOf('function poissonAtLeast(');
  if (start < 0) return -1;
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.indexOf('\n', i) + 1; }
  }
  return -1;
}

/** One group on a source text, all or nothing: { text, status: 'ported' | 'applied' | 'missing', missing: [names] }. */
export function applyGroup(src, group) {
  const hasConstants = !group.constants || src.includes('const VENUE_SPLIT_WEIGHT = ');
  const present = group.edits.filter((e) => src.includes(e.new));
  if (hasConstants && present.length === group.edits.length) return { text: src, status: 'ported', missing: [] };
  const missing = [];
  if (present.length) missing.push(`already partly there (${present.map((e) => e.name).join(', ')}): port the rest by hand from components/nhl/model-core.js`);
  let out = src;
  if (group.constants && !src.includes('const VENUE_SPLIT_WEIGHT = ')) {
    const at = afterPoissonAtLeast(out);
    if (at < 0) missing.push('the weights and venueMix: no `function poissonAtLeast(` to put them after');
    else out = out.slice(0, at) + CONSTANTS_BLOCK + out.slice(at);
  }
  for (const e of group.edits) {
    const n = out.split(e.old).length - 1;
    if (n !== 1) { missing.push(`${e.name}: the anchor was found ${n} times, expected once:\n${e.old}`); continue; }
    out = out.replace(e.old, e.new);
  }
  return missing.length ? { text: src, status: 'missing', missing } : { text: out, status: 'applied', missing: [] };
}

/** Every group in order: { text, results: [{ key, label, status, missing }] }; a missing group leaves the text as it was. */
export function portText(src, groups = GROUPS) {
  let text = src; const results = [];
  for (const g of groups) {
    const r = applyGroup(text, g);
    text = r.text; results.push({ key: g.key, label: g.label, status: r.status, missing: r.missing });
  }
  return { text, results };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const file = args.find((a) => !a.startsWith('--')) || path.join(os.homedir(), 'Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx');
  if (!fs.existsSync(file)) { console.error(`No file at ${file}`); process.exit(2); }
  const src = fs.readFileSync(file, 'utf8');
  const { text, results } = portText(src);
  for (const r of results) {
    console.log(`${r.status === 'ported' ? 'already ported' : r.status === 'applied' ? (check ? 'would apply   ' : 'applied       ') : 'MISSING       '}  ${r.label}`);
    for (const m of r.missing) console.log(`                  ${m.split('\n').join('\n                  ')}`);
  }
  const applied = results.filter((r) => r.status === 'applied').length;
  const missing = results.filter((r) => r.status === 'missing').length;
  if (!applied) { console.log(missing ? '\nNothing written: the groups above are missing an anchor. Send the file and the lines above.' : '\nNothing to do.'); process.exit(missing ? 1 : 0); }
  if (check) { console.log('\n--check: nothing written.'); process.exit(0); }
  const bak = `${file}.bak-${new Date().toISOString().slice(0, 10)}`;
  fs.copyFileSync(file, bak);
  fs.writeFileSync(file, text);
  console.log(`\nWritten. Backup at ${bak}${missing ? '\nA group is missing an anchor (above): send the file and the lines.' : ''}`);
  process.exit(missing ? 1 : 0);
}

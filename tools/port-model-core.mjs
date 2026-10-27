#!/usr/bin/env node
// Port the 2026-10-27 model change into the local model app (App.jsx, the model's source of truth):
// the home / away split's share of a skater's goal base and the historical-profile multipliers on
// the goal ladder cut to a quarter (VENUE_SPLIT_WEIGHT, H2H_WEIGHT, venueMix) — the same edits made
// to components/nhl/model-core.js in commit 26b1084.
//
//   node tools/port-model-core.mjs [path to App.jsx] [--check]
//
// Default path: ~/Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx. Every edit is an exact-text
// replacement that must match once; an edit whose new text is already there is reported as ported.
// If any anchor is missing nothing is written and the missing one is named. A backup is written
// beside the file before it is changed. --check reports and writes nothing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CONSTANTS_BLOCK = `
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

export const EDITS = [
  {
    name: 'the ladder\'s venue-form multiplier',
    old: '  const compressedVenue = 1 + (venueGoalMult - 1) * 0.18;\n',
    new: '  const compressedVenue = 1 + (venueGoalMult - 1) * 0.18 * VENUE_SPLIT_WEIGHT;\n',
  },
  {
    name: 'the ladder\'s history multiplier (1+ goal)',
    old: '  const compressedHist1 = 1 + (histGoalMult1 - 1) * 0.22;\n',
    new: '  const compressedHist1 = 1 + (histGoalMult1 - 1) * 0.22 * H2H_WEIGHT;\n',
  },
  {
    name: 'the ladder\'s history multiplier (2+ goals)',
    old: '  const compressedHist2 = 1 + (histGoalMult2 - 1) * 0.18;\n',
    new: '  const compressedHist2 = 1 + (histGoalMult2 - 1) * 0.18 * H2H_WEIGHT;\n',
  },
  {
    name: 'the team goals budget',
    old: '    return sum + Math.max(0, venueGoals != null && venueGoals > 0 ? venueGoals : seasonGoals);\n',
    new: '    return sum + Math.max(0, venueGoals != null && venueGoals > 0 ? venueMix(venueGoals, seasonGoals) : seasonGoals);\n',
  },
  {
    name: 'the style read\'s goal base',
    old: '      goalsBase: p.pHA ? (isHome ? p.pHA.g_home : p.pHA.g_away) : goals,\n',
    new: '      goalsBase: p.pHA ? venueMix(isHome ? p.pHA.g_home : p.pHA.g_away, goals) : goals,\n',
  },
  {
    name: 'the capability floors\' goal base',
    old: '  const seasonGoals = skater.goalsSeason || 0;\n'
      + '  const baseGoals = Math.max(0.001,\n'
      + '    venueGoalsBase != null && venueGoalsBase > 0\n'
      + '      ? 0.72 * venueGoalsBase + 0.18 * seasonGoals + 0.10 * Math.max(0, venueGoalsL5 || 0)\n'
      + '      : 0.80 * seasonGoals + 0.20 * Math.max(0, skater.goalsL5 || seasonGoals)\n'
      + '  );\n',
    new: '  const seasonGoals = skater.goalsSeason || 0;\n'
      + '  const seasonGoalsBase = 0.80 * seasonGoals + 0.20 * Math.max(0, skater.goalsL5 || seasonGoals);\n'
      + '  const baseGoals = Math.max(0.001,\n'
      + '    venueGoalsBase != null && venueGoalsBase > 0\n'
      + '      ? VENUE_SPLIT_WEIGHT * (0.72 * venueGoalsBase + 0.18 * seasonGoals + 0.10 * Math.max(0, venueGoalsL5 || 0)) + (1 - VENUE_SPLIT_WEIGHT) * seasonGoalsBase\n'
      + '      : seasonGoalsBase\n'
      + '  );\n',
  },
  {
    name: 'the skater\'s goal base (season and last five)',
    old: '        const goalsL5 = (venueGoalsL5 !== null ? venueGoalsL5 : skater.goalsL5) ?? 0;\n'
      + '        const goalsSeason = (venueGoalsSeason !== null ? venueGoalsSeason : skater.goalsSeason) ?? 0;\n',
    new: '        // The venue split at VENUE_SPLIT_WEIGHT over his season figures (it used to replace them).\n'
      + '        const goalsL5 = venueMix(venueGoalsL5, skater.goalsL5 ?? 0) ?? 0;\n'
      + '        const goalsSeason = venueMix(venueGoalsSeason, skater.goalsSeason ?? 0) ?? 0;\n',
  },
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

/** Apply the port to a source text: { text, applied, ported, missing } — `text` is unchanged when anything is missing. */
export function portText(src) {
  const applied = []; const ported = []; const missing = [];
  let out = src;
  if (out.includes('const VENUE_SPLIT_WEIGHT = ')) ported.push('the weights and venueMix');
  else {
    const at = afterPoissonAtLeast(out);
    if (at < 0) missing.push('the weights and venueMix: no `function poissonAtLeast(` to put them after');
    else { out = out.slice(0, at) + CONSTANTS_BLOCK + out.slice(at); applied.push('the weights and venueMix'); }
  }
  for (const e of EDITS) {
    if (out.includes(e.new)) { ported.push(e.name); continue; }
    const n = out.split(e.old).length - 1;
    if (n !== 1) { missing.push(`${e.name}: the anchor was found ${n} times, expected once:\n${e.old}`); continue; }
    out = out.replace(e.old, e.new); applied.push(e.name);
  }
  return { text: missing.length ? src : out, applied, ported, missing };
}

/** Whether the earlier ports (2026-10-13 shots odds, 2026-10-20 goal odds) show in the text. */
export function earlierPorts(src) {
  return {
    shotsOdds20261013: src.includes('ladderP3s') && /p3s = clamp\(poissonAtLeast\(/.test(src),
    goalOdds20261020: src.includes('ladderP1g') && /p1g = clamp\(poissonAtLeast\(lambdaGDisplay, 1\)/.test(src),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const file = args.find((a) => !a.startsWith('--')) || path.join(os.homedir(), 'Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx');
  if (!fs.existsSync(file)) { console.error(`No file at ${file}`); process.exit(2); }
  const src = fs.readFileSync(file, 'utf8');
  const r = portText(src);
  const before = earlierPorts(src);
  for (const p of r.ported) console.log(`already ported  ${p}`);
  for (const a of r.applied) console.log(`${check ? 'would apply    ' : 'applied        '} ${a}`);
  for (const m of r.missing) console.log(`MISSING         ${m}`);
  console.log(`earlier ports: shots odds (2026-10-13) ${before.shotsOdds20261013 ? 'present' : 'NOT found'}; goal odds (2026-10-20) ${before.goalOdds20261020 ? 'present' : 'NOT found'}`);
  if (r.missing.length) { console.log('\nNothing written: an anchor differs. Send the file and the lines above.'); process.exit(1); }
  if (!r.applied.length) { console.log('\nNothing to do.'); process.exit(0); }
  if (check) { console.log('\n--check: nothing written.'); process.exit(0); }
  const bak = `${file}.bak-${new Date().toISOString().slice(0, 10)}`;
  fs.copyFileSync(file, bak);
  fs.writeFileSync(file, r.text);
  console.log(`\nWritten. Backup at ${bak}`);
}

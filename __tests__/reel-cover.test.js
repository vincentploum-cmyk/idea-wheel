import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The pre-spin curtain must be OPAQUE.
 *
 * Before the first spin the reels hold un-spun filler words, so `.sm-reel-cover`
 * is painted over them (components/IdeaWheel.jsx — "cover the reels so no words
 * are pre-populated"). If any rule wins the cascade with a see-through
 * background, the filler words read straight through the curtain and the
 * generator ships with three random words already showing.
 *
 * That is exactly how this broke once: the cover was converted from a <div> to a
 * <button>, and the button-chrome reset in app/globals.css added
 * `background: transparent`. `button.sm-reel-cover` (0,1,1) outranks
 * `.sm-reel-cover` (0,1,0), so the reset silently beat the curtain's own
 * `background:#fff` no matter which stylesheet loaded last.
 *
 * This guard is cascade-aware rather than a grep: it collects every declaration
 * targeting the cover across all stylesheets, ranks them the way a browser
 * would, and asserts the winner is opaque.
 */

const ROOT = join(__dirname, '..');

// Every stylesheet that can style the cover. IdeaWheel.jsx carries its rules in
// a `const CSS = \`…\`` template literal injected as a <style> tag on mount.
const SOURCES = [
  'app/globals.css',
  'components/IdeaWheel.jsx',
  'styles.css',
  'screens.css',
];

const TRANSPARENT = new Set(['transparent', 'none', 'initial', 'unset', 'revert', 'rgba(0,0,0,0)']);

/** Specificity of a simple selector, as [ids, classes, elements]. */
function specificity(selector) {
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const classes = (selector.match(/[.:[][\w-]+/g) || []).length;
  const elements = (selector.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return [ids, classes, elements];
}

function outranks(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true; // equal specificity → later declaration wins
}

/**
 * Find every `{ … }` block whose selector list targets `.sm-reel-cover` itself
 * (not `-title` / `-sub`), and pull its `background` / `background-color`.
 */
function collectCoverRules(css) {
  const found = [];
  // Drop comments first, or they ride along on the next selector.
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = blockRe.exec(css)) !== null) {
    const selectorList = m[1].trim();
    const body = m[2];
    for (const selector of selectorList.split(',').map((s) => s.trim())) {
      // `.sm-reel-cover` exactly — reject `.sm-reel-cover-title`, `-sub`, etc.
      if (!/\.sm-reel-cover(?![\w-])/.test(selector)) continue;
      const decl = body.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;!]+)(!important)?/i);
      if (!decl) continue;
      found.push({
        selector,
        value: decl[1].trim().toLowerCase().replace(/\s+/g, ''),
        important: Boolean(decl[2]),
        spec: specificity(selector),
      });
    }
  }
  return found;
}

const rules = SOURCES.flatMap((file) => {
  let css;
  try {
    css = readFileSync(join(ROOT, file), 'utf8');
  } catch {
    return []; // optional stylesheet absent — nothing to check
  }
  return collectCoverRules(css).map((r) => ({ ...r, file }));
});

describe('pre-spin reel cover', () => {
  test('at least one stylesheet paints the curtain', () => {
    expect(rules.length).toBeGreaterThan(0);
  });

  test('the winning background is opaque, so the reels stay hidden', () => {
    const winner = rules.reduce((best, r) => {
      if (!best) return r;
      if (r.important && !best.important) return r;
      if (best.important && !r.important) return best;
      return outranks(r.spec, best.spec) ? r : best;
    }, null);

    // Reported as a string so a failure names the rule that won, not just `true`.
    const verdict = TRANSPARENT.has(winner.value)
      ? `${winner.file}: "${winner.selector}" wins with background:${winner.value}`
      : 'opaque';
    expect(verdict).toBe('opaque');
  });

  test('no rule resets the curtain to transparent at all', () => {
    const offenders = rules.filter((r) => TRANSPARENT.has(r.value));
    expect(offenders.map((r) => `${r.file}: ${r.selector}`)).toEqual([]);
  });
});

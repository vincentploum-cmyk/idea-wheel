import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every OpenAI call site must read its model and web-search tool name from
 * lib/openai-config.js — never inline them.
 *
 * The failure this prevents: the model id was hardcoded in seven files and the
 * web-search tool name in four. When OpenAI retires either, every AI feature
 * dies simultaneously and the only remedy is a code change plus a deploy —
 * during an outage. Routed through the config module, both are env-overridable,
 * so recovery is a Render env edit and a restart.
 *
 * Static source assertions, deliberately: these paths need real credentials and
 * a live network to execute, so nothing in `npm test` can reach them at runtime.
 */

const ROOT = join(__dirname, '..');

const CALL_SITES = [
  'app/api/pipeline/validate/route.js',
  'app/api/pipeline/deep-research/route.js',
  'app/api/pipeline/build/route.js',
  'app/api/admin/seed-catalog/route.js',
  'app/api/cron/opportunity-scan/route.js',
  'lib/clarity.js',
];

// Routes that hit /v1/responses with a web-search tool.
const WEB_SEARCH_SITES = [
  'app/api/pipeline/validate/route.js',
  'app/api/pipeline/deep-research/route.js',
  'app/api/pipeline/build/route.js',
  'app/api/admin/seed-catalog/route.js',
];

const read = (f) => readFileSync(join(ROOT, f), 'utf8');

describe.each(CALL_SITES)('%s', (file) => {
  const src = read(file);

  test('does not hardcode a model id', () => {
    // Matches gpt-4o, gpt-4o-mini, gpt-5..., o3-mini — any quoted model-looking id.
    const hardcoded = src.match(/['"`](?:gpt|o\d)[\w.-]*['"`]/g) || [];
    expect(hardcoded).toEqual([]);
  });

  test('imports its model from lib/openai-config', () => {
    expect(src).toMatch(/from\s+['"][^'"]*openai-config['"]/);
    expect(src).toMatch(/MODELS/);
  });
});

describe.each(WEB_SEARCH_SITES)('%s web-search tool', (file) => {
  const src = read(file);

  test('does not hardcode the tool name', () => {
    expect(src).not.toMatch(/type:\s*['"`]web_search(_preview)?['"`]/);
  });

  test('reads the tool name from WEB_SEARCH_TOOL_TYPES', () => {
    expect(src).toMatch(/WEB_SEARCH_TOOL_TYPES\[/);
  });
});

describe('pipeline routes survive a renamed web-search tool', () => {
  // The three user-facing pipelines must fall back to the next tool name rather
  // than failing the request outright.
  const FALLBACK_SITES = [
    'app/api/pipeline/validate/route.js',
    'app/api/pipeline/deep-research/route.js',
    'app/api/pipeline/build/route.js',
  ];

  test.each(FALLBACK_SITES)('%s retries under the next tool name', (file) => {
    const src = read(file);
    expect(src).toMatch(/tool_unsupported/);
    expect(src).toMatch(/toolIndex \+ 1 < WEB_SEARCH_TOOL_TYPES\.length/);
  });

  test.each(FALLBACK_SITES)('%s only backs off on retryable failures', (file) => {
    const src = read(file);
    // The old code retried every 429, including insufficient_quota (a billing
    // state), burning 24s to reach the same failure.
    expect(src).toMatch(/info\.retryable && attempt < 2/);
    expect(src).not.toMatch(/res\.status === 429 && attempt < 2/);
  });
});

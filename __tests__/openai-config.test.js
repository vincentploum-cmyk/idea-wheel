import { describe, test, expect } from '@jest/globals';
import {
  MODELS,
  pricingFor,
  WEB_SEARCH_TOOL_TYPES,
  classifyOpenAiError,
  isToolNameRejected,
  openAiError,
} from '../lib/openai-config.js';

// Real OpenAI error bodies, shaped as the API returns them.
const body = (message, code, type = 'invalid_request_error') =>
  JSON.stringify({ error: { message, type, code } });

describe('model tiers', () => {
  test('both tiers resolve to a non-empty id', () => {
    expect(MODELS.fast).toBeTruthy();
    expect(MODELS.deep).toBeTruthy();
  });

  test('pricing is known for the default models', () => {
    expect(pricingFor('gpt-4o-mini')).toEqual({ input: 0.15, output: 0.60 });
    expect(pricingFor('gpt-4o')).toEqual({ input: 2.50, output: 10.00 });
  });

  test('an unknown (overridden) model bills at the highest known rate, never zero', () => {
    const p = pricingFor('some-future-model');
    expect(p.input).toBeGreaterThan(0);
    expect(p.output).toBeGreaterThan(0);
    expect(p).toEqual(pricingFor('gpt-4o'));
  });
});

describe('web-search tool fallback', () => {
  test('leads with the name already running in production, not the modern one', () => {
    // Deliberate: the fallback only fires on a clean tool_unsupported 400, so
    // leading with an unproven name could break a working path. Unchanged
    // behaviour when the preview tool works; self-heals when it stops.
    expect(WEB_SEARCH_TOOL_TYPES[0]).toBe('web_search_preview');
  });

  test('carries a fallback so a rename cannot take the pipeline down', () => {
    expect(WEB_SEARCH_TOOL_TYPES.length).toBeGreaterThan(1);
    expect(WEB_SEARCH_TOOL_TYPES).toContain('web_search');
  });
});

describe('error classification', () => {
  test('401 is a bad key and is never retried', () => {
    const c = classifyOpenAiError(401, body('Incorrect API key provided', 'invalid_api_key', 'invalid_request_error'));
    expect(c.kind).toBe('invalid_api_key');
    expect(c.retryable).toBe(false);
  });

  test('insufficient_quota is NOT retryable even though it arrives as a 429', () => {
    // The regression this guards: the old code backed off 8s then 16s on every
    // 429, so a billing failure cost 24s before failing anyway.
    const c = classifyOpenAiError(429, body('You exceeded your current quota', 'insufficient_quota'));
    expect(c.kind).toBe('insufficient_quota');
    expect(c.retryable).toBe(false);
  });

  test('a plain 429 IS retryable', () => {
    const c = classifyOpenAiError(429, body('Rate limit reached', 'rate_limit_exceeded'));
    expect(c.kind).toBe('rate_limited');
    expect(c.retryable).toBe(true);
  });

  test('a retired model is identified and points at the env override', () => {
    const c = classifyOpenAiError(404, body('The model `gpt-4o-mini` does not exist', 'model_not_found'));
    expect(c.kind).toBe('model_not_found');
    expect(c.retryable).toBe(false);
    expect(c.operator).toMatch(/OPENAI_MODEL_FAST/);
  });

  test('a deprecated-model 400 is identified too', () => {
    const c = classifyOpenAiError(400, body('The model `gpt-4o` has been deprecated', 'model_not_found'));
    expect(c.kind).toBe('model_not_found');
  });

  test('a rejected web-search tool name is identified', () => {
    const c = classifyOpenAiError(400, body("Invalid value: 'web_search_preview' is not a supported tool", 'invalid_value'));
    expect(c.kind).toBe('tool_unsupported');
    expect(isToolNameRejected(400, body("Invalid value: 'web_search_preview'", 'invalid_value'))).toBe(true);
  });

  test('5xx is an upstream incident and is retryable', () => {
    expect(classifyOpenAiError(503, 'upstream connect error')).toMatchObject({
      kind: 'server_error',
      retryable: true,
    });
  });

  test('a non-JSON body still classifies rather than throwing', () => {
    expect(() => classifyOpenAiError(500, '<html>502 Bad Gateway</html>')).not.toThrow();
    expect(classifyOpenAiError(500, '<html>502 Bad Gateway</html>').kind).toBe('server_error');
  });

  test('every classification carries an operator note and a user-safe message', () => {
    const cases = [
      [401, body('bad key', 'invalid_api_key')],
      [429, body('quota', 'insufficient_quota')],
      [429, body('slow down', 'rate_limit_exceeded')],
      [404, body('gone', 'model_not_found')],
      [400, body('web_search bad', 'invalid_value')],
      [503, 'boom'],
      [418, 'teapot'],
    ];
    for (const [status, b] of cases) {
      const c = classifyOpenAiError(status, b);
      expect(typeof c.operator).toBe('string');
      expect(c.operator.length).toBeGreaterThan(0);
      expect(typeof c.user).toBe('string');
      expect(c.user.length).toBeGreaterThan(0);
    }
  });

  test('user-facing messages never leak model ids, keys or raw upstream text', () => {
    const leaky = body('The model `gpt-4o-mini` does not exist, key sk-proj-abc123', 'model_not_found');
    const c = classifyOpenAiError(404, leaky);
    expect(c.user).not.toMatch(/gpt-4o|sk-|model_not_found/);
    // The operator note keeps the detail — that's the whole point.
    expect(c.operator).toMatch(/gpt-4o-mini/);
  });
});

describe('openAiError', () => {
  test('carries the classification and status on the Error object', () => {
    const err = openAiError(429, body('You exceeded your current quota', 'insufficient_quota'));
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(429);
    expect(err.openai.kind).toBe('insufficient_quota');
    expect(err.openai.retryable).toBe(false);
    // The thrown message is operator-facing (it lands in error_events), so it
    // must name the failure class rather than say "something went wrong".
    expect(err.message).toMatch(/insufficient_quota/);
  });
});

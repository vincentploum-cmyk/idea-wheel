// Shared "plain-English" clarity pass for the paid deliverables.
//
// Takes a finished, structured deliverable (deep market research, or a blueprint
// stage) and produces a short, jargon-free summary plus a few "what this means
// for you" takeaways — WITHOUT inventing facts. It's an additional readability
// check run on the paid outputs only, so both a non-technical founder and a
// technical builder can digest a dense deliverable at a glance.
//
// It is deliberately resilient: any failure returns null and the caller simply
// renders the deliverable without the plain-English layer. A clarity hiccup must
// never block or fail a paid result.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const CLARITY_MODEL = 'claude-haiku-4-5-20251001';

function extractJson(text) {
  const clean = String(text || '').replace(/```json\n?|```\n?/gi, '').trim();
  const start = clean.search(/[{]/);
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < clean.length; i += 1) {
    const ch = clean[i];
    if (inStr) {
      if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') { depth -= 1; if (depth === 0) return clean.slice(start, i + 1); }
  }
  return clean.slice(start);
}

function clampText(value, max) {
  if (!value) return '';
  const str = String(value).replace(/\s+/g, ' ').trim();
  if (str.length <= max) return str;
  // Cut at the last whole word before the limit so we never slice mid-word
  // (which produced ugly fragments like "copy this in 6–12…").
  const slice = str.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).replace(/[\s,;:.!?–—-]+$/, '');
  return `${trimmed}…`;
}

function clampList(value, count, max) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => clampText(v, max)).filter(Boolean).slice(0, count);
}

/**
 * Produce a plain-English summary + takeaways for one deliverable.
 *
 * @param {object} opts
 * @param {string} opts.label   - human label e.g. "Deep market research", "Infrastructure plan"
 * @param {object} opts.payload - the structured deliverable to summarise
 * @returns {Promise<{plainSummary: string, takeaways: string[]} | null>}
 */
export async function clarify({ label, payload, maxTokens = 700 }) {
  if (!ANTHROPIC_KEY || !payload) return null;

  const prompt = `You are an editor whose job is to make a product deliverable instantly easy to digest for BOTH a non-technical founder AND a technical builder.

Deliverable: ${label}
Content (JSON):
${JSON.stringify(payload).slice(0, 6500)}

Rules:
- Do NOT invent anything. Only restate what is already in the content, in clearer, simpler words.
- Plain, concrete language. No buzzwords, no hype.
- If a technical term is genuinely necessary, explain it in 3-5 words inside the sentence.
- A smart 12-year-old should understand the summary; a builder should still find it accurate.

Return ONLY a JSON object (no fences):
{
  "plainSummary": "2-3 short sentences: what this deliverable says and why it matters, in plain English.",
  "takeaways": ["3 short 'what this means for you' points, each under 14 words, no jargon"]
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLARITY_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const json = extractJson(text);
    if (!json) return null;
    const parsed = JSON.parse(json.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1'));
    const plainSummary = clampText(parsed?.plainSummary, 460);
    const takeaways = clampList(parsed?.takeaways, 3, 150);
    if (!plainSummary && takeaways.length === 0) return null;
    return { plainSummary, takeaways };
  } catch {
    return null;
  }
}

/**
 * Attach a plain-English layer onto a deliverable object in-place-safe fashion.
 * Returns a new object with plainSummary/takeaways set (or the original if the
 * clarity pass produced nothing). Never throws.
 */
export async function withPlainEnglish(label, deliverable) {
  if (!deliverable || typeof deliverable !== 'object') return deliverable;
  const clarity = await clarify({ label, payload: deliverable });
  if (!clarity) return deliverable;
  return { ...deliverable, plainSummary: clarity.plainSummary, takeaways: clarity.takeaways };
}

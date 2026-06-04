/**
 * api-shim.js
 *
 * Drop-in replacements for runScout and runBrief in IdeaWheel.jsx.
 * These call your local Next.js API routes instead of Anthropic directly,
 * keeping your API key server-side only.
 *
 * HOW TO USE:
 * In components/IdeaWheel.jsx, find and replace the two functions
 * "const runScout = async () => {" and "const runBrief = async () => {"
 * with the versions below.
 *
 * Also add this near the top of the component (after state declarations):
 *   const sessionId = useRef(crypto.randomUUID()).current;
 */

// ── Paste this near the top of IdeaWheel component ────────────────
// const sessionId = useRef(crypto.randomUUID()).current;


// ── Replace runScout with this ─────────────────────────────────────
const runScout = async () => {
  if (!complete || anySpinning) return;
  clearPipeline();
  setPipeline({ stage: 'scouting', results: [null,null,null,null,null], costs: [], error: null });

  try {
    const res = await fetch('/api/pipeline/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: landed[0],
        workflow: landed[1],
        industry: landed[2],
        mode,
        connector: m.connector,
        modeName: m.name,
        sessionId,
      }),
    });

    if (!res.ok) throw new Error(`Validation failed: ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const comp = data.comp;
    const scoutCost = { label: 'Scout', model: 'claude-haiku-4-5-20251001', ...data.cost.input_tokens ? { input_tokens: data.cost.input_tokens, output_tokens: data.cost.output_tokens } : {}, cost: data.cost.cost_usd };
    const vt = comp.verdictType || 'build';

    setPipeline({
      stage: vt === 'avoid' ? 'avoided' : 'scouted',
      results: [comp, null, null, null, null],
      costs: [scoutCost],
      error: null,
    });
  } catch (e) {
    setPipeline(p => ({ ...p, stage: null, error: { stage: 'scout', msg: 'Market check failed. ' + e.message } }));
  }
};


// ── Replace runBrief with this ─────────────────────────────────────
const runBrief = async () => {
  if (!pipeline || pipeline.stage !== 'scouted') return;
  if (credits <= 0) { setShowPricing(true); return; }

  const comp = pipeline.results[0];
  if (!comp) return;

  setCredits(c => c - 1);
  setShowPricing(false);
  setProtoOpen(true);

  const baseCosts = pipeline.costs || [];
  const combo = { action: landed[0], workflow: landed[1], industry: landed[2], mode, connector: m.connector, modeName: m.name };

  // ── Stage 1: Product Designer ──
  setPipeline(p => ({ ...p, stage: 1 }));
  let design;
  try {
    const res = await fetch('/api/pipeline/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...combo, stage: 'designer', comp, sessionId }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    design = data.result;
    const c2 = { label: 'Designer', model: 'claude-sonnet-4-6', input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens, cost: data.cost_usd };
    setPipeline(p => ({ ...p, results: [comp, design, null, null, null], costs: [...baseCosts, c2] }));
  } catch (e) {
    setCredits(c => c + 1);
    setPipeline(p => ({ ...p, error: { stage: 1, msg: 'Designer failed. ' + e.message } }));
    return;
  }

  // ── Stage 2: Launch Plan ──
  setPipeline(p => ({ ...p, stage: 2 }));
  let gtm;
  try {
    const res = await fetch('/api/pipeline/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...combo, stage: 'launch', comp, design, sessionId }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    gtm = data.result;
    const c3 = { label: 'Launch', model: 'claude-sonnet-4-6', input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens, cost: data.cost_usd };
    setPipeline(p => ({ ...p, results: [comp, design, gtm, null, null], costs: [...baseCosts, p.costs[0], c3] }));
  } catch (e) {
    setCredits(c => c + 1);
    setPipeline(p => ({ ...p, error: { stage: 2, msg: 'Launch Plan failed. ' + e.message } }));
    return;
  }

  // ── Stage 3: Infrastructure ──
  setPipeline(p => ({ ...p, stage: 3 }));
  let infra;
  try {
    const res = await fetch('/api/pipeline/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...combo, stage: 'infrastructure', comp, design, gtm, sessionId }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    infra = data.result;
    const c3b = { label: 'Infra', model: 'claude-haiku-4-5-20251001', input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens, cost: data.cost_usd };
    setPipeline(p => ({ ...p, results: [comp, design, gtm, infra, null], costs: [...p.costs, c3b] }));
  } catch (e) {
    setCredits(c => c + 1);
    setPipeline(p => ({ ...p, error: { stage: 3, msg: 'Infrastructure agent failed. ' + e.message } }));
    return;
  }

  // ── Stage 4: Prototype Builder ──
  setPipeline(p => ({ ...p, stage: 4 }));
  let proto;
  try {
    const res = await fetch('/api/pipeline/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...combo, stage: 'builder', comp, design, gtm, infra, sessionId }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    proto = data.result;
    const c4 = { label: 'Builder', model: 'claude-sonnet-4-6', input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens, cost: data.cost_usd };
    const allCosts = [...pipeline.costs, c4];
    setPipeline({ stage: 5, results: [comp, design, gtm, infra, proto], costs: allCosts, error: null });
  } catch (e) {
    setCredits(c => c + 1);
    setPipeline(p => ({ ...p, error: { stage: 4, msg: 'Prototype builder failed. ' + e.message } }));
  }
};

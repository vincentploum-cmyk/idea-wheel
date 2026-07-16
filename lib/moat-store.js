import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = process.env.MOAT_DATA_DIR
  || (process.env.VERCEL ? path.join('/tmp', 'idea-wheel-moat') : path.join(process.cwd(), 'data', 'moat'));
const FILES = {
  validations: path.join(DATA_DIR, 'validations.jsonl'),
  blueprints: path.join(DATA_DIR, 'blueprints.jsonl'),
  blueprintCharges: path.join(DATA_DIR, 'blueprint-charges.jsonl'),
  outcomes: path.join(DATA_DIR, 'outcomes.jsonl'),
  validationCache: path.join(DATA_DIR, 'validation-cache.jsonl'),
};

let supabaseClient;

function getSupabase() {
  if (supabaseClient !== undefined) return supabaseClient;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = null;
    return supabaseClient;
  }
  supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  return supabaseClient;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function appendJsonl(filePath, payload) {
  try {
    await ensureDir();
    await fs.appendFile(filePath, JSON.stringify(payload) + '\n', 'utf8');
  } catch (err) {
    console.error('[moat-store/appendJsonl]', err.message);
  }
}

async function readJsonl(filePath, limit = 400) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((line) => JSON.parse(line));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    console.error('[moat-store/readJsonl]', err.message);
    return [];
  }
}

async function optionalInsert(table, row) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from(table).insert(row);
  } catch (err) {
    console.error(`[moat-store/${table}]`, err.message);
  }
}

async function optionalSelect(table, limit = 400) {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    const message = err?.message || '';
    if (!message.includes('schema cache') && !message.includes('Could not find the table')) {
      console.error(`[moat-store/${table}/select]`, message);
    }
    return [];
  }
}

function isoNow() {
  return new Date().toISOString();
}

function shortText(value, max = 5000) {
  if (!value) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? text.slice(0, max) : text;
}

export function ensureSessionId(value) {
  return value && typeof value === 'string' ? value : crypto.randomUUID();
}

export async function recordValidation(payload) {
  const row = {
    id: crypto.randomUUID(),
    created_at: isoNow(),
    ...payload,
  };
  await appendJsonl(FILES.validations, row);
  await optionalInsert('pipeline_validations', {
    id: row.id,
    // Stored so the blueprint gate can enforce validation OWNERSHIP later —
    // a user can't build from a validationId that isn't theirs.
    user_id: row.userId || null,
    session_id: row.sessionId,
    mode_name: row.modeName,
    action: row.action,
    workflow: row.workflow,
    industry: row.industry,
    agent_desc: row.agentDesc,
    retrieval: row.retrieval,
    scout: row.scout,
    skeptic: row.skeptic,
    judge: row.judge,
    eval: row.eval,
    verdict_type: row.verdictType,
    cost_usd: row.costUsd,
    usage: row.usage,
    created_at: row.created_at,
  });
  return row;
}

/**
 * The authoritative overall score for a validation, read back from the row the
 * pipeline itself wrote (never from a client-supplied comp). Returns an integer
 * 0-100, or null if the validation is unknown or unscored. The save path uses
 * this so a forged client score can't become the stored score.
 */
export async function getAuthoritativeScore(validationId) {
  if (!validationId) return null;
  const id = String(validationId);
  const clamp = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
  };
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data } = await supabase
        .from('pipeline_validations')
        .select('eval')
        .eq('id', id)
        .maybeSingle();
      const overall = data?.eval?.scores?.overall;
      if (overall !== undefined && overall !== null) return clamp(overall);
    } catch (err) {
      console.error('[moat-store/getAuthoritativeScore]', err.message);
    }
  }
  // Local JSONL fallback (dev / migration-not-applied).
  const rows = await readJsonl(FILES.validations, 500);
  const match = [...rows].reverse().find((row) => String(row.id) === id);
  const overall = match?.eval?.scores?.overall;
  return overall !== undefined && overall !== null ? clamp(overall) : null;
}

/**
 * Authoritative blueprint eligibility for a validation, derived server-side from
 * the stored validation record — never from a client-supplied comp. Mirrors the
 * exact score capping buildFinalComp applies (premise-broken ideas capped at 35;
 * the deterministic overall already reflects the hard gates). Fails CLOSED: if
 * the validation is unknown, unscored, or scored under an old rubric version, it
 * is not eligible.
 *
 * @returns {Promise<{found:boolean, score:number|null, version:string|null, eligible:boolean, reason:string}>}
 */
export async function getValidationEligibility(validationId, { minScore = 60, requiredVersion = null, userId = null } = {}) {
  const fail = (reason, extra = {}) => ({ found: false, score: null, version: null, eligible: false, reason, ...extra });
  if (!validationId) return fail('missing_validation_id');
  const id = String(validationId);

  // Ownership check: a validation owned by someone else must look like it doesn't
  // exist (privacy — never leak that another user's validationId is real). Rows
  // with user_id === null are legacy (pre-migration) and treated as pass-through
  // so we don't strand existing users. New rows always store user_id.
  const ownsRow = (row) => {
    if (!userId) return true; // caller opted out of ownership (should be rare)
    const rowUser = row?.user_id ?? row?.userId ?? null;
    if (rowUser === null || rowUser === undefined) return true; // legacy row
    return String(rowUser) === String(userId);
  };

  const evaluate = (evalObj, scout) => {
    const overall = Number(evalObj?.scores?.overall);
    if (!Number.isFinite(overall)) return fail('unscored', { found: true });
    const premiseBroken = scout?.premiseFit === 'nonexistent';
    const score = premiseBroken ? Math.min(overall, 35) : Math.max(0, Math.min(100, Math.round(overall)));
    const version = evalObj?.deterministic?.rubricVersion || null;
    let eligible = true;
    let reason = 'eligible';
    if (score < minScore) { eligible = false; reason = 'below_threshold'; }
    else if (requiredVersion && version !== requiredVersion) { eligible = false; reason = 'stale_score_version'; }
    return { found: true, score, version, eligible, reason };
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data } = await supabase
        .from('pipeline_validations')
        .select('eval, scout, user_id')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        if (!ownsRow(data)) return fail('validation_not_found'); // privacy: don't leak existence
        return evaluate(data.eval, data.scout);
      }
    } catch (err) {
      const message = err?.message || '';
      // Pre-migration schema (no user_id column) — retry without it as a legacy path.
      if (message.includes('user_id') || message.includes('column')) {
        try {
          const { data } = await supabase
            .from('pipeline_validations')
            .select('eval, scout')
            .eq('id', id)
            .maybeSingle();
          if (data) return evaluate(data.eval, data.scout);
        } catch (err2) {
          console.error('[moat-store/getValidationEligibility legacy]', err2.message);
        }
      } else {
        console.error('[moat-store/getValidationEligibility]', message);
      }
    }
  }
  // Local JSONL fallback (dev / migration-not-applied).
  const rows = await readJsonl(FILES.validations, 500);
  const match = [...rows].reverse().find((row) => String(row.id) === id);
  if (match) {
    if (!ownsRow(match)) return fail('validation_not_found');
    return evaluate(match.eval, match.scout);
  }
  return fail('validation_not_found');
}

/**
 * Look up the most recent authorized blueprint charge for (userId, validationId)
 * — used after deductCredits reports `duplicate: true` (idempotency hit) so the
 * caller can reuse the existing charge token instead of double-debiting.
 */
export async function findBlueprintChargeByKey({ userId, validationId } = {}) {
  if (!userId || !validationId) return null;
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('blueprint_charges')
        .select('data')
        .filter('data->>userId', 'eq', String(userId))
        .filter('data->>validationId', 'eq', String(validationId))
        .order('updated_at', { ascending: false })
        .limit(1);
      if (!error && Array.isArray(data) && data[0]?.data) return data[0].data;
    } catch (err) {
      console.error('[moat-store/findBlueprintChargeByKey]', err.message);
    }
  }
  // JSONL fallback: scan recent charges for the same (user, validation).
  const rows = await readJsonl(FILES.blueprintCharges, 500);
  const match = [...rows].reverse().find((row) => String(row.userId) === String(userId) && String(row.validationId) === String(validationId));
  return match || null;
}

export async function readValidationCache(cacheKey, maxAgeMs = 72 * 60 * 60 * 1000) {
  const rows = await readJsonl(FILES.validationCache, 200);
  const newest = [...rows].reverse().find((row) => row.cacheKey === cacheKey);
  if (!newest) return null;
  const createdAt = Date.parse(newest.created_at || newest.createdAt || '');
  if (!Number.isFinite(createdAt)) return null;
  if (Date.now() - createdAt > maxAgeMs) return null;
  return newest.response || null;
}

export async function writeValidationCache(cacheKey, response, meta = {}) {
  await appendJsonl(FILES.validationCache, {
    id: crypto.randomUUID(),
    cacheKey,
    created_at: isoNow(),
    tier: meta.tier || 'deep',
    modeName: meta.modeName || null,
    action: meta.action || null,
    workflow: meta.workflow || null,
    industry: meta.industry || null,
    response,
  });
}

export async function recordBlueprint(payload) {
  const row = {
    id: crypto.randomUUID(),
    created_at: isoNow(),
    ...payload,
    prototypeHtmlPreview: shortText(payload.prototypeHtml, 12000),
  };
  await appendJsonl(FILES.blueprints, row);
  await optionalInsert('pipeline_blueprints', {
    id: row.id,
    session_id: row.sessionId,
    validation_id: row.validationId,
    mode_name: row.modeName,
    action: row.action,
    workflow: row.workflow,
    industry: row.industry,
    agent_desc: row.agentDesc,
    retrieval: row.retrieval,
    comp: row.comp,
    design: row.design,
    gtm: row.gtm,
    infra: row.infra,
    proto_spec: row.protoSpec,
    eval: row.eval,
    prototype_html_preview: row.prototypeHtmlPreview,
    cost_usd: row.costUsd,
    usage: row.usage,
    created_at: row.created_at,
  });
  return row;
}

export async function saveBlueprintCharge(payload) {
  const row = {
    ...payload,
    created_at: payload.created_at || isoNow(),
    updated_at: isoNow(),
  };
  // Durable primary store — survives instance restarts and is shared across
  // serverless instances (the /tmp JSONL was neither, so a charge minted on one
  // instance 403'd on the next). JSONL kept as an audit trail + fallback when the
  // blueprint_charges table isn't provisioned yet. Never throws → the build
  // route's `charge` is always assigned, so its refund path can't be skipped.
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('blueprint_charges')
        .upsert({ id: row.id, data: row, updated_at: row.updated_at }, { onConflict: 'id' });
      if (error) throw error;
    } catch (err) {
      console.error('[moat-store/blueprint_charges upsert]', err.message);
    }
  }
  await appendJsonl(FILES.blueprintCharges, row);
  return row;
}

export async function getBlueprintCharge(chargeId) {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('blueprint_charges')
        .select('data')
        .eq('id', chargeId)
        .maybeSingle();
      if (error) throw error;
      if (data?.data) return data.data;
    } catch (err) {
      // Table missing (pre-migration) or transient — fall back to the JSONL store.
      const message = err?.message || '';
      if (!message.includes('schema cache') && !message.includes('Could not find the table')) {
        console.error('[moat-store/blueprint_charges select]', message);
      }
    }
  }
  const rows = await readJsonl(FILES.blueprintCharges, 600);
  return [...rows].reverse().find((row) => row.id === chargeId) || null;
}

export async function recordOutcome(payload) {
  const row = {
    id: crypto.randomUUID(),
    created_at: isoNow(),
    ...payload,
  };
  await appendJsonl(FILES.outcomes, row);
  await optionalInsert('pipeline_outcomes', {
    id: row.id,
    session_id: row.sessionId,
    signal: row.signal,
    mode_name: row.modeName,
    action: row.action,
    workflow: row.workflow,
    industry: row.industry,
    payload: row.payload,
    created_at: row.created_at,
  });
  return row;
}

function normalizeValidationRow(row) {
  return {
    ...row,
    modeName: row.modeName || row.mode_name,
    validationTier: row.validationTier || row.validation_tier || 'deep',
    action: row.action || null,
    workflow: row.workflow || null,
    industry: row.industry || null,
    verdictType: row.verdictType || row.verdict_type || null,
    agentDesc: row.agentDesc || row.agent_desc || null,
    created_at: row.created_at || row.createdAt || null,
  };
}

function normalizeOutcomeRow(row) {
  return {
    ...row,
    modeName: row.modeName || row.mode_name,
    action: row.action || null,
    workflow: row.workflow || null,
    industry: row.industry || null,
    sessionId: row.sessionId || row.session_id || null,
    created_at: row.created_at || row.createdAt || null,
  };
}

function dedupeRows(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = row.id || `${row.created_at || ''}:${row.sessionId || row.session_id || ''}:${row.signal || row.verdictType || ''}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return Array.from(seen.values()).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

function matchesScope(row, scope) {
  return [
    !scope.modeName || row.modeName === scope.modeName,
    !scope.industry || row.industry === scope.industry,
    !scope.action || row.action === scope.action,
    !scope.workflow || row.workflow === scope.workflow,
  ].every(Boolean);
}

function countSignals(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key];
    if (!value) return acc;
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(map, limit = 5) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export async function loadGeneratorTrainingData(limit = 500) {
  const [localValidations, localOutcomes, remoteValidations, remoteOutcomes] = await Promise.all([
    readJsonl(FILES.validations, limit),
    readJsonl(FILES.outcomes, limit),
    optionalSelect('pipeline_validations', limit),
    optionalSelect('pipeline_outcomes', limit),
  ]);

  return {
    validations: dedupeRows([...localValidations.map(normalizeValidationRow), ...remoteValidations.map(normalizeValidationRow)]),
    outcomes: dedupeRows([...localOutcomes.map(normalizeOutcomeRow), ...remoteOutcomes.map(normalizeOutcomeRow)]),
  };
}

export async function loadLearningContext(scope) {
  const [{ validations, outcomes }, blueprints] = await Promise.all([
    loadGeneratorTrainingData(400),
    readJsonl(FILES.blueprints),
  ]);

  const scopedValidations = validations.filter((row) => matchesScope(row, scope));
  const scopedBlueprints = blueprints.filter((row) => matchesScope(row, scope));
  const scopedOutcomes = outcomes.filter((row) => matchesScope(row, scope));

  const broaderOutcomes = outcomes.filter((row) => row.modeName === scope.modeName);
  const signalCounts = countSignals(scopedOutcomes, 'signal');
  const broaderSignalCounts = countSignals(broaderOutcomes, 'signal');
  const verdictCounts = countSignals(scopedValidations, 'verdictType');

  const recentWins = scopedBlueprints
    .slice(-5)
    .map((row) => ({
      concept: row.agentDesc,
      differentiator: row.design?.differentiator,
      pricing: row.gtm?.pricing?.price,
      outcomeSignals: scopedOutcomes.filter((o) => o.sessionId === row.sessionId).map((o) => o.signal),
    }));

  return {
    exactMatchCounts: {
      validations: scopedValidations.length,
      blueprints: scopedBlueprints.length,
      outcomes: scopedOutcomes.length,
    },
    verdictPatterns: topEntries(verdictCounts, 4),
    topSignals: topEntries(signalCounts, 6),
    broaderSignals: topEntries(broaderSignalCounts, 6),
    recentWins,
    proof: {
      shortlistRate: scopedOutcomes.filter((o) => o.signal === 'shortlist_saved').length,
      blueprintStarts: scopedOutcomes.filter((o) => o.signal === 'blueprint_started').length,
      blueprintCompletions: scopedOutcomes.filter((o) => o.signal === 'blueprint_completed').length,
      shares: scopedOutcomes.filter((o) => o.signal === 'blueprint_copied').length,
    },
  };
}

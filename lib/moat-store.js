import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = process.env.MOAT_DATA_DIR
  || (process.env.VERCEL ? path.join('/tmp', 'idea-wheel-moat') : path.join(process.cwd(), 'data', 'moat'));
const FILES = {
  validations: path.join(DATA_DIR, 'validations.jsonl'),
  blueprints: path.join(DATA_DIR, 'blueprints.jsonl'),
  outcomes: path.join(DATA_DIR, 'outcomes.jsonl'),
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

export async function loadLearningContext(scope) {
  const [validations, blueprints, outcomes] = await Promise.all([
    readJsonl(FILES.validations),
    readJsonl(FILES.blueprints),
    readJsonl(FILES.outcomes),
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

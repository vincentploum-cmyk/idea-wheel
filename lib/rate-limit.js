import { createClient } from '@supabase/supabase-js';

// Durable, cross-instance rate limiter backed by Postgres (the check_rate_limit
// RPC in supabase/rate-limits.sql). Falls back to a per-instance in-memory
// counter when the durable store is unavailable, so a limiter outage can never
// break the feature it protects.

function getAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ── In-memory fallback (per-instance) ────────────────────────────────────────
const memory = new Map();
function memoryCheck(key, limit, windowMs) {
  const now = Date.now();
  const entry = memory.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  memory.set(key, entry);
  // Bound memory: evict entries whose window has fully elapsed.
  if (memory.size > 5000) {
    for (const [k, v] of memory) {
      if (now - v.windowStart > windowMs) memory.delete(k);
    }
  }
  return entry.count <= limit;
}

/**
 * Returns true if the action for `key` is allowed within the window.
 * @param {string} key         e.g. `validate:<userId>`
 * @param {{limit:number, windowSeconds:number}} opts
 */
export async function checkRateLimit(key, { limit, windowSeconds }) {
  const windowMs = windowSeconds * 1000;
  const db = getAdmin();
  if (!db) return memoryCheck(key, limit, windowMs);

  try {
    const { data, error } = await db.rpc('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    // Durable store missing/erroring (e.g. migration not yet run) — degrade to
    // the in-memory limiter rather than failing the request.
    console.error('[rate-limit] durable check failed, using memory fallback:', err.message);
    return memoryCheck(key, limit, windowMs);
  }
}

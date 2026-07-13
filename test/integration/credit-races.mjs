// Integration regression guard for the credit-integrity concurrency fixes.
// Spins up a REAL Postgres (embedded-postgres), loads the credits ledger + the
// repo's actual deduct_credits RPC and credit-integrity indexes, then fires
// concurrent requests to prove no double-charge / double-grant / farming is
// possible. A negative control (indexes dropped) proves the indexes are what do
// the work. Run with:  npm run test:races
//
// This lives in its own package (test/integration/package.json) so embedded-postgres
// is NOT installed during the production build (Render runs `npm install` at the root).

import EmbeddedPostgres from 'embedded-postgres';
import pgpkg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const { Pool } = pgpkg;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sql = (rel) => readFileSync(resolve(REPO, rel), 'utf8');

// isUniqueViolation — copied VERBATIM from lib/credits.js so we test the real predicate.
function isUniqueViolation(error) {
  return error?.code === '23505' || /duplicate key value|unique constraint/i.test(error?.message || '');
}

const UA = '11111111-1111-1111-1111-111111111111';
const UB = '22222222-2222-2222-2222-222222222222';
const UC = '33333333-3333-3333-3333-333333333333';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL ✗'}: ${name}${extra ? '  — ' + extra : ''}`); };

const DATA_DIR = resolve(tmpdir(), `idea-races-pg-${process.pid}`);
const pg = new EmbeddedPostgres({ databaseDir: DATA_DIR, user: 'postgres', password: 'pw', port: 55432, persistent: false });
await pg.initialise();
await pg.start();
await pg.createDatabase('testdb');
const pool = new Pool({ host: 'localhost', port: 55432, user: 'postgres', password: 'pw', database: 'testdb', max: 20 });

try {
  // Roles the repo SQL grants to (Supabase provides these; create them here).
  for (const r of ['service_role', 'anon', 'authenticated']) {
    await pool.query(`do $$ begin create role ${r}; exception when duplicate_object then null; end $$;`);
  }
  await pool.query('create extension if not exists pgcrypto;');
  // The ledger schema the app actually uses (documented in lib/credits.js header).
  await pool.query(`
    create table public.credits (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      user_id uuid, change integer, reason text,
      blueprint_id uuid, stripe_payment_intent text
    );`);
  // The REAL RPC + indexes from the repo — the actual code under test.
  await pool.query(sql('supabase/deduct-credits-rpc.sql'));
  await pool.query(sql('supabase/credit-integrity.sql'));
  await pool.query(`insert into public.credits(user_id, change, reason) values ($1,5,'seed'),($2,100,'seed'),($3,100,'seed')`, [UA, UB, UC]);

  const fire = (n, fn) => Promise.allSettled(Array.from({ length: n }, (_, i) => fn(i)));
  const balance = async (u) => Number((await pool.query(`select coalesce(sum(change),0) b from public.credits where user_id=$1 and reason<>'idea_credit_grant' and reason not like 'idea_unlock_%'`, [u])).rows[0].b);
  const countRows = async (u, reason) => (await pool.query(`select count(*)::int c from public.credits where user_id=$1 and reason=$2`, [u, reason])).rows[0].c;

  console.log('\n=== TEST 1: unlock double-charge race (WITH index) ===');
  {
    const res = await fire(10, () => pool.query(`select public.deduct_credits($1::uuid,1,'catalog_unlock_slugX') as r`, [UA]));
    const winners = res.filter(r => r.status === 'fulfilled' && r.value.rows[0].r.ok);
    const uniqRejects = res.filter(r => r.status === 'rejected' && isUniqueViolation(r.reason));
    const sampleErr = res.find(r => r.status === 'rejected')?.reason;
    ok('exactly 1 of 10 concurrent requests charged', winners.length === 1, `winners=${winners.length}`);
    ok('other 9 = unique-violation caught by the real isUniqueViolation()', uniqRejects.length === 9, `uniqRejects=${uniqRejects.length}`);
    ok('exactly 1 debit row for the slug', (await countRows(UA, 'catalog_unlock_slugX')) === 1);
    ok('balance dropped by exactly 1 (5→4), not by 10', (await balance(UA)) === 4, `balance=${await balance(UA)}`);
    ok('real PG error carries SQLSTATE 23505', sampleErr?.code === '23505', `code=${sampleErr?.code}`);
    ok('real PG error message matches the fallback regex too', /duplicate key value|unique constraint/i.test(sampleErr?.message || ''));
  }

  console.log('\n=== TEST 2: purchase double-grant race (webhook + confirm) ===');
  {
    const res = await fire(10, () => pool.query(`insert into public.credits(user_id,change,reason,stripe_payment_intent) values ($1,25,'purchase','sess_ABC')`, [UB]));
    const rej = res.filter(r => r.status === 'rejected' && isUniqueViolation(r.reason)).length;
    ok('exactly 1 purchase grant inserted', (await countRows(UB, 'purchase')) === 1);
    ok('9 duplicates rejected (unique)', rej === 9, `rej=${rej}`);
    ok('user got +25 once, not +250', (await balance(UB)) === 125, `balance=${await balance(UB)}`);
  }

  console.log('\n=== TEST 3: review-bonus farming race ===');
  {
    await fire(10, () => pool.query(`insert into public.credits(user_id,change,reason) values ($1,3,'review_bonus')`, [UC]));
    ok('exactly 1 review_bonus row', (await countRows(UC, 'review_bonus')) === 1);
    ok('user got +3 once, not +30', (await balance(UC)) === 103, `balance=${await balance(UC)}`);
  }

  console.log('\n=== TEST 4: NEGATIVE CONTROL — drop the unlock index, re-run the race ===');
  {
    await pool.query('drop index credits_unlock_idem');
    await fire(10, () => pool.query(`select public.deduct_credits($1::uuid,1,'catalog_unlock_slugY') as r`, [UA]));
    const dupCharges = await countRows(UA, 'catalog_unlock_slugY');
    ok('WITHOUT the index the double-charge DOES happen (index is load-bearing)', dupCharges > 1, `debit rows for one unlock = ${dupCharges}`);
  }

  console.log(`\n================  ${fail === 0 ? 'ALL GREEN' : 'FAILURES PRESENT'}: ${pass} passed, ${fail} failed  ================`);
} finally {
  await pool.end();
  await pg.stop();
}
process.exit(fail === 0 ? 0 : 1);

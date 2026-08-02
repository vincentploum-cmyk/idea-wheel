# IdeaReels Operational Runbook

**Purpose.** One place that tells whoever is on the incident exactly what to check, in what order, when something breaks. Written for a founder-of-one team; grows as we hit real incidents.

Last updated: 2026-07-16.

---

## Fast-lookup table

| Symptom | First thing to check | Second |
|---|---|---|
| Site down | `curl https://ideareels.io/api/health` | Render dashboard → service status |
| Users report "sign-in link expired" | Supabase → Auth → Logs | Resend → Emails → search their address |
| Users report "charged but no credits" | Stripe → Payments (find intent) | `error_events` where `scope='api:stripe-webhook'` |
| Blueprint generation fails | `error_events` where `scope like 'api:build:%'` | Render → Logs (OpenAI 429/500?) |
| Market research fails ("Market check failed") | `node scripts/openai-doctor.mjs` | `error_events.meta->>'openaiKind'` |
| /ideas card unlock 402 or 500 | `error_events` where `scope='api:catalog-unlock'` | Confirm `SEED_SECRET` re-seed ran for that slug |
| Spike in 5xx | `error_events` last 15 min, group by scope | Render → Deploys (roll back if recent) |

---

## Playbook 0 — any AI step is failing

Market research, deep research and blueprints all go through OpenAI, so one
upstream change takes them all down at once. Do NOT guess between the causes —
run the doctor, which reproduces the exact four calls the pipeline makes:

```bash
OPENAI_API_KEY=<the Render value> node scripts/openai-doctor.mjs
```

It exits 0 when everything the pipeline needs works, and otherwise prints the
single thing to fix. The three outcomes and their remedies:

| Doctor says | Cause | Fix |
|---|---|---|
| `ACCOUNT IS OUT OF CREDIT` | Billing / quota | Top up OpenAI. **No code change helps.** |
| `<model> is not in your account's model list` | Model retired | Set `OPENAI_MODEL_FAST` / `OPENAI_MODEL_DEEP` on Render to a current model, restart. No deploy needed. |
| `No web-search tool name is accepted` | Tool renamed upstream | Set `OPENAI_WEB_SEARCH_TOOL` on Render to the current name. |
| `API key rejected (401)` | Bad/revoked key | Rotate `OPENAI_API_KEY`. |

Already-recorded failures name their own cause — every OpenAI error is
classified before it is logged:

```bash
curl -s -H "Authorization: Bearer $SEED_SECRET" \
  "https://ideareels.io/api/admin/errors?hours=24&scope=api:validate" \
  | jq -r '.events[] | "\(.created_at)  \(.meta.openaiKind)  \(.meta.operatorNote)"'
```

`openaiKind` is one of `insufficient_quota`, `model_not_found`,
`tool_unsupported`, `invalid_api_key`, `rate_limited`, `server_error`,
`unknown`. Only `rate_limited` and `server_error` are worth waiting out; the
rest need the action above.

---

## Where things live

- **App code / deploys**: `github.com/vincentploum-cmyk/idea-wheel`, push to `main` → Render auto-deploys (~2-3 min).
- **Runtime**: Render Web Service (Node), Cloudflare in front (DNS + partial cache; most pages are `DYNAMIC`).
- **DB**: Supabase Pro (`ghvsxaarywfjsnhgagwm` project ref, `auth.ideareels.io` custom domain).
- **Payments**: Stripe LIVE mode, account `Shopzero` (`acct_1TK3DyIWmEeBJoTz`). Webhook = `https://ideareels.io/api/credits/webhook`.
- **Email**: Resend (`smtp.resend.com` for magic-link SMTP via Supabase; HTTP API for contact-form notifications).
- **AI**: OpenAI (via `OPENAI_API_KEY`).

## Key env vars (Render)

| Name | Purpose | Where to get |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://auth.ideareels.io` | Supabase settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key | Supabase → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, ALL server logging + catalog reads need this | Supabase → API |
| `STRIPE_SECRET_KEY` | LIVE mode key | Stripe → Developers |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/credits/webhook` | Stripe → Webhooks endpoint page |
| `OPENAI_API_KEY` | For validate/build pipelines | OpenAI dashboard |
| `RESEND_API_KEY` | Contact form owner-notify | Resend |
| `SEED_SECRET` | Auth for `POST /api/admin/seed-catalog` **and** `GET /api/admin/errors` | Rotated by Vincent |

---

## Standard checks

### Is the site actually up?

```
curl -s https://ideareels.io/api/health | jq
```

`{"ok": true, ...}` → healthy. `503` → Supabase unreachable; check Supabase status page and Render logs for connection errors.

### Recent errors, grouped

```
curl -s -H "Authorization: Bearer $SEED_SECRET" \
  https://ideareels.io/api/admin/errors?hours=1 | jq '.byScope'
```

Digging into one:

```
curl -s -H "Authorization: Bearer $SEED_SECRET" \
  "https://ideareels.io/api/admin/errors?hours=6&scope=api:build:build" | jq '.events[0:5]'
```

Query directly in Supabase SQL editor for anything more complex:

```sql
select scope, count(*), max(created_at) as latest
from error_events
where created_at > now() - interval '24 hours'
group by 1 order by 2 desc;
```

### Deploy sanity

```
curl -s https://ideareels.io/api/version | jq
```

`commit` field = the SHA Render shipped. Compare against `git log --oneline main | head -3`.

---

## Playbooks

### Playbook 1 — Site is down / 5xx storm

1. `curl -sI https://ideareels.io/` — HTTP status?
2. `/api/health` — up but 503 = DB issue; up but 200 = something else; timeout = Render process dead.
3. Render dashboard → Logs, last 15 min. Anything screaming?
4. `/api/admin/errors?hours=1` — bucket by scope. One route on fire, or all of them?
5. If a deploy shipped in the last hour and error rate exploded: **roll back**. Render → Deploys → prior successful → "Rollback". Then investigate on a branch.
6. If Supabase is down: check `status.supabase.com`, notify on Twitter/status page, wait — nothing to fix from our side.
7. If OpenAI is down: `api:validate` and `api:build:*` scopes will spike but everything else works. Post a banner ("AI is having a moment, blueprints unavailable"). Nothing else to do.

### Playbook 2 — "I paid and didn't get credits"

Sequence, easiest first:

1. Stripe dashboard → Payments → search customer email. Find the payment intent.
2. Is `payment_status = paid`? If no → they weren't charged; explain.
3. If yes, note the checkout session ID (`cs_live_…`).
4. Supabase SQL: `select * from credits_ledger where reason like 'purchase_%' and metadata->>'stripe_session_id' = '<cs_live_id>';` — was a grant recorded?
5. Also: `select * from error_events where scope='api:stripe-webhook' and meta->>'sessionId' = '<cs_live_id>';`
6. If ledger row exists → they DO have credits; the UI might not have refreshed. Have them reload `/pricing?session_id=<cs_live_id>` (that route re-verifies + fetches balance).
7. If ledger row is missing AND error_events has a matching failure → figure out why the webhook failed (bad secret? terminal reason?). Manually grant via the admin refund endpoint (never raw SQL — the endpoint enforces idempotency + audits):

   ```
   curl -X POST https://ideareels.io/api/admin/refund \
     -H "Authorization: Bearer $SEED_SECRET" \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "<uuid from Supabase auth.users>",
       "amount": 5,
       "reason": "manual_grant_ticket_<id>",
       "note": "webhook failed at <session_id>; customer confirmed charge on Stripe dashboard"
     }'
   ```

   Response includes `granted`, `duplicate` (was this reason already used?), and `newBalance`. If `duplicate: true` came back, the grant was already applied — don't call again with a different reason.

8. Reply to the customer inside 24h.

**Never** grant credits based only on a customer's word — always verify against Stripe.

### Playbook 3 — Magic-link sign-in broken

1. Supabase → Auth → Logs. Is the "send email" log line present at the time they clicked?
2. If yes → SMTP delivered. Resend dashboard → Emails → search their address. Delivered / bounced / soft-bounce?
3. If delivered but link "expired": Outlook/Hotmail Safe Links pre-fetch. Confirm we route through `/auth/confirm` (requires a real click) — fixed 2026-07-15 (b6a8b1c). If the fix rolled back somehow, restore.
4. If SMTP fell over: `/api/admin/errors?scope=auth:*` (nothing today, but keep in mind we may add).
5. Fallback: tell them to use Google / GitHub OAuth (both work independently).

### Playbook 4 — Blueprint generation failing

1. `/api/admin/errors?hours=6&scope=api:build:build` (also try `api:build:designer`, `api:build:launch`, `api:build:infra`).
2. Common causes:
   - **OpenAI 429** — hit RPM limit. Wait, or raise limits in OpenAI dashboard.
   - **OpenAI 500** — provider outage. Nothing to do; monitor status.openai.com.
   - **`validation_not_found`** — a legit ineligible-block, not a bug (score < 60 or stale version). No action.
   - **JSON parse fail** — model returned malformed output; the retry-repair loop should have caught it. If it didn't, that's a real regression — look at the raw output in the logged `meta`.
3. Verify refunds: `select * from credits_ledger where reason='blueprint_refund' and created_at > now() - interval '6 hours'` — every failed authorized charge should have a matching refund.

### Playbook 5 — Rolling back a bad deploy

1. Render → Services → ideareels → Deploys.
2. Find the last known-good deploy (green, before the incident).
3. Click ⋯ → "Redeploy this version".
4. Wait ~2-3 min. `curl /api/version` — SHA matches what you rolled back to?
5. Verify error rate drops.
6. On a branch, fix the actual bug. Do NOT push straight to main until reproduced + fixed.

---

## Backups & recovery

- Supabase Pro auto-runs daily backups (retained 7 days). Dashboard → Database → Backups.
- **Restore test procedure** (do this once per quarter):
  1. Spin up a scratch Supabase project.
  2. Download the latest backup dump from prod (Database → Backups → Download).
  3. Restore into the scratch project (Database → Backups → Restore from file).
  4. Verify: run `select count(*) from stripe_orders`, `select count(*) from credits_ledger` — non-zero, roughly matches prod dashboard.
  5. Tear down scratch project.
  6. Note the date in `docs/runbook.md` → "Last restore test verified: YYYY-MM-DD".

Last restore test verified: **never** — schedule the first one.

---

## Latency SLOs (target, not enforced)

Marketing copy claims:
- "Under 30 seconds" for first market verdict → target `p95(validate) < 30s`.
- "Under 5 minutes" for the full workflow → target `p95(validate + deep-research + build) < 300s`.

Measure via `pipeline_stage_timings` (see `supabase/pipeline-metrics.sql` and `/api/admin/metrics`). If p95 drifts past target for a week, tighten prompts / raise `maxTokens` / switch stage model. Do not silently rewrite marketing copy without measuring first.

---

## Incident log

Append every real incident here — even the tiny ones.

- 2026-07-10 — Stripe orders stuck 'pending' since June 6. Root cause: webhook fulfillment was the only grant path AND the success banner trusted URL params without verification. **Fix:** shared `lib/fulfillment.js` + server-side confirm (commit 30552ad). **Learning:** never let a UI state (banner, redirect) be authoritative for a paid grant.
- 2026-07-11 — Cloudflare bot-blocker was silently blocking GPTBot/Claude/PerplexityBot despite robots.txt allow. **Fix:** flip "Block Crawler" toggles OFF in CF dashboard. **Learning:** the CF UI column reads inverted from intuition (blue = blocked).
- 2026-07-12 — /ideas server component shipped full locked-idea blueprints in the RSC payload. Anon users could see paid content. **Fix:** RLS on `catalog_ideas`, teaser-only for locked, `/api/catalog-idea-unlock` returns full content on entitlement (commit 9cfc1d0). **Learning:** RSC payloads are just HTML — treat every field as "can the visitor see this."
- 2026-07-13 — Non-atomic check-then-write on unlock/purchase/review_bonus enabled double-grants under concurrency. **Fix:** partial unique indexes + `isUniqueViolation()` graceful-duplicate path + `test:races` regression suite (commit 5a4a189).
- 2026-07-15 — Score 60 excluded from blueprint gate (was `>=61`), plus the gate was advisory not enforced. **Fix:** shared `lib/score-policy.js` (visibleMin=60 inclusive, blueprintMin=60, version-locked), server-side gate in `/api/pipeline/build` designer stage, 422 before deductCredits (commit 94d0d98). **Learning:** boundary tests earn their keep.

# IdeaReels pre-launch checklist

The engineering side of launch is done. What's left is operator work — running the SQL migrations, wiring optional third-party services, and one legal review. Rough order of priority.

Last updated: 2026-07-16.

---

## Must-do before launch

### 1. Run these Supabase migrations (10 minutes)
In Supabase SQL editor for the production project (`ghvsxaarywfjsnhgagwm`, custom domain `auth.ideareels.io`):

- [ ] `supabase/error-log.sql` — turns on `error_events` capture. Until this runs, all errors log to Render only.
- [ ] `supabase/pipeline-metrics.sql` — turns on p50/p95 latency capture. Until this runs, /admin/overview shows empty latency tables.
- [ ] `supabase/user-preferences.sql` — turns on the "keep my ideas out of the public catalog" toggle. Until this runs, the profile-page toggle silently hides.

All three are idempotent (`create table if not exists`, `drop policy if exists`) — safe to re-run. Nothing else in the code depends on them running in a specific order.

### 2. Re-seed the catalog for the 3 new consumer ideas (2 minutes)

```
curl -X POST https://ideareels.io/api/admin/seed-catalog \
  -H "Authorization: Bearer $SEED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"slugs":["accentloop","projectkeep","skilltrail"]}'
```

Without this, users clicking Unlock on those three cards get a friendly 409 "content_not_ready" and are not charged.

### 3. Legal review (days–weeks)

- [ ] Hand `lib/content.js` (LEGAL_TERMS and LEGAL_PRIVACY constants) to a lawyer.
- [ ] Have them replace Section 17 (governing law) with a specific jurisdiction.
- [ ] Once satisfied, flip `LEGAL_COUNSEL_REVIEWED = true` in the same file. The visible "Beta notice" banner on /terms and /privacy disappears automatically.

Do NOT skip this. The current draft is honest and covers all the sections a real SaaS policy needs, but I'm not a lawyer — the language and jurisdiction choice need one.

### 4. Uptime monitor (5 minutes)

Sign up for [Better Uptime](https://betteruptime.com/) or [UptimeRobot](https://uptimerobot.com/) — free tier is enough. Monitor:
- `https://ideareels.io/api/health` — checks web + DB. Alert on `!ok`.
- `https://ideareels.io/api/version` — page-worthy if it 5xx's.

Point alerts at your phone. Once configured, /status becomes the public-facing summary of the same signal.

---

## Should-do before launch

### 5. Enable Cloudflare Turnstile (10 minutes)

Contact form and reviews form both accept a Turnstile token — the client widget and server verify are already wired.

- [ ] Cloudflare dashboard → Turnstile → Add site (`ideareels.io`).
- [ ] Copy the site key and secret.
- [ ] Render env → add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (site key) and `TURNSTILE_SECRET_KEY` (secret).
- [ ] Redeploy.

Without this, the honeypot + timing + spam-content heuristics still run — you just won't have proper bot verification.

### 6. Run the blueprint-quality audit (~30 minutes + credits)

Gate 1 in the original launch audit: pass or fail 10 B2B + 10 consumer generated blueprints against a strict rubric.

- [ ] Sign into `ideareels.io`. Ensure your account has ≥ 60 credits (each idea costs ~3 credits: 1 for research + 2 for build). At $19.99 for Power = 25 credits, that's about $50–60 in credits total.
- [ ] Chrome DevTools → Application → Cookies → copy the `sb-auth.ideareels.io-auth-token` cookie value.
- [ ] From the repo root:
  ```
  AUDIT_USER_COOKIE='<paste cookie>' OPENAI_API_KEY='<your key>' npm run audit:blueprints
  ```
- [ ] Read `audit-report-<timestamp>.md`. Aim for ≥ 16/20 passing. Anything failing hard on the same rubric check across multiple ideas points to a prompt regression.

### 7. First backup-restore test (30 minutes)

The runbook (`docs/runbook.md`) has the procedure. Set aside 30 minutes, run it end-to-end once. Update the runbook's "Last restore test verified" line with the date. Add a reminder to redo this every quarter.

---

## Nice-to-have (can wait until after launch)

### 8. Wire the authenticated E2E purchase test

`test/e2e/tests/authed-purchase.spec.mjs.disabled` is a sketch that walks buy → spin → blueprint → PDF. Needs:
- A separate staging deploy on Stripe test-mode keys, OR a way to safely run in production against a real (small) charge that's refunded automatically.
- A stored Playwright `storageState` with a signed-in test user.

Non-blocking; the CI smoke suite already runs after every deploy and catches the "the site is 500'ing" class of regressions.

### 9. Sentry (optional)

`error_events` + /admin/overview cover the "what's happening" question. Sentry adds better stack-trace grouping, release tracking, and native mobile if you go there. Add if you want it — the code is deliberately Supabase-first.

### 10. Directory listings + Reddit strategy

Both are in `docs/marketing/launch-checklist.md` (July 13 work). Non-engineering.

### 11. Product Hunt

Same — see `docs/marketing/launch-checklist.md`.

---

## The engineering side (done)

For the record, what's already shipped:

- ✅ Score-gate enforcement (60+, server-side, before deductCredits)
- ✅ Real source verification with `⚠ Unverified estimate` labels
- ✅ Competitor verification via live URL fetch
- ✅ Deterministic scoring rubric (`lib/scoring.js` v2.0)
- ✅ Race-safe credits (unique indexes + graceful duplicate path + regression test)
- ✅ RLS lockdown on all user-owned tables
- ✅ Concurrent-fulfillment webhook safety + payment_status guard
- ✅ Blueprint-charge durability (crash recovery for orphan charges)
- ✅ Never-repeat combos per user (`user_spins`)
- ✅ Custom auth domain (`auth.ideareels.io`)
- ✅ Magic-link Outlook Safe Links workaround (`/auth/confirm`)
- ✅ Self-serve account delete + data export
- ✅ Catalog-publication opt-out
- ✅ Honest cookie notice (was previously misleading)
- ✅ Rate limits + honeypot + optional Turnstile on contact + reviews
- ✅ Central `error_events` + `/api/admin/errors`
- ✅ `/api/health` (real DB check) + `/status` public page
- ✅ Pipeline latency capture + `/api/admin/metrics`
- ✅ `/admin/overview` operator dashboard
- ✅ 148 unit tests + Playwright public-path smoke + credits-race integration test
- ✅ GitHub Actions CI + post-deploy smoke
- ✅ Operational runbook (`docs/runbook.md`)
- ✅ Comprehensive Terms + Privacy Policy (19 + 15 sections, beta banner until counsel review)
- ✅ Accessibility: skip link, ARIA on wheel + score + purchase, reduced motion
- ✅ Cost-model line pricing + payment-processor line always included
- ✅ Live blueprints tested end-to-end multiple times

# Integration tests

Heavier tests that need a **real Postgres**. They live in their own package so
`embedded-postgres` (which downloads a Postgres binary) is **not** installed by
the root `npm install` that Render runs on every deploy.

## `credit-races.mjs` — credit-integrity concurrency guard

Proves the fixes in `supabase/credit-integrity.sql` actually prevent the billing
races. It boots a real Postgres, loads the credits ledger plus the repo's own
`deduct_credits` RPC and the credit-integrity indexes, then fires 10 concurrent
requests per scenario and asserts:

- **Unlock race** → exactly one charge (balance drops by 1, not 10).
- **Purchase race** (webhook + confirm) → one grant, not ten.
- **Review-bonus race** → +3 once, not +30.
- **Negative control** → with the indexes dropped, the double-charge *does*
  happen — proving the indexes are load-bearing.

It also asserts the real `23505` error is caught by the exact `isUniqueViolation`
predicate used in `lib/credits.js`.

Run from the repo root:

```bash
npm run test:races
```

First run downloads the Postgres binary into `test/integration/node_modules`
(gitignored). Runs in a few seconds thereafter.

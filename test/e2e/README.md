# E2E smoke tests

Playwright hitting the live URL. Public-path smoke by default; extendable to authenticated flows once Stripe test-mode + a test-user session are in place.

## Run

```
npm run test:e2e             # against production (ideareels.io)
E2E_BASE_URL=http://localhost:3000 npm run test:e2e   # against local dev
```

First run installs Playwright and its Chromium + WebKit browsers (~200 MB), isolated inside `test/e2e/node_modules` so nothing leaks into the root `npm install` that Render runs on deploy.

## What runs today

- Landing / pricing / ideas / privacy / terms / rate-my-startup-idea render.
- Privacy page does not contain the "does not store" contradiction (regression guard for the launch-blocker fix).
- Terms page shows the "not yet counsel-reviewed" beta banner.
- `/api/health` reports commit + DB ok.
- `/api/version` reports the enforcement guarantees the ChatGPT audits kept flagging.
- Anonymous requests to `/api/catalog-idea-unlock` and `/api/generator/config` return 401 (no accidental un-auth surface).
- Skip-to-content link is present.
- Landing page has no critical unhandled JS errors.

## Not implemented yet (Stripe-test-mode required)

- End-to-end purchase → blueprint → PDF flow.

To add this, provide:
- `STRIPE_TEST_SECRET_KEY` and a Stripe test webhook signing secret configured on a staging deploy of the app (currently all env is LIVE mode).
- A test user account whose session cookie can be captured via a magic-link log-in run inside Playwright (`storageState`).

Then add a spec like `authed-purchase.spec.mjs` that:
1. Loads the pre-authed `storageState`.
2. Buys a Starter pack with a `4242 4242 4242 4242` test card.
3. Spins a fixed workflow / industry combo that scores ≥60.
4. Runs deep research + blueprint.
5. Downloads the plan PDF and asserts the qualification block + cost table are present.

Sketch is in `tests/authed-purchase.spec.mjs.disabled` — enable + fill in the missing env when ready.

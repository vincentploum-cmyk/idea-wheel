# Legal review brief — IdeaReels launch

**For a lawyer. What you're being asked to do, what the product actually does, what's already been drafted, and the specific questions I need answered.**

---

## What IdeaReels is

- A one-person SaaS operated by Vincent Ploum.
- URL: https://ideareels.io.
- The product generates startup-idea concepts using AI (OpenAI models), computes a market-signal score by fetching public web sources, and — for ideas that clear a quality threshold — produces a technical implementation blueprint.
- **Revenue model**: one-time credit packs ($3.99 / $9.99 / $19.99) sold via Stripe. No subscription. Spinning is free. Deep research costs 1 credit; a full blueprint costs 2 credits. Credits never expire.
- **Users**: anyone 16+ globally; heavier concentration expected in US/EU/UK.
- **Infrastructure**: Supabase (auth + DB, US-hosted), Stripe (payment), OpenAI (AI inference), Cloudflare (DNS + edge), Render (application hosting), Resend (transactional email).

## What I need from you

1. Review the two documents at `lib/content.js` in the repo (LEGAL_TERMS and LEGAL_PRIVACY constants). They're written in plain language to cover the sections a real public SaaS policy needs — but I am not a lawyer and I want yours.
2. Choose and name the **governing law jurisdiction** for Section 17 of the Terms (currently a placeholder). Vincent is based in [YOUR LOCATION — Vincent, fill this in when you brief the lawyer].
3. Confirm the **liability cap** (currently the greater of USD $100 or last-12-month payments) is appropriate given the price point and product surface.
4. Confirm the **IP handling** in Sections 6 and 7:
   - Section 6 says users retain all rights to their inputs; we take a limited license only to operate the service.
   - Section 7 says users own AI outputs to the extent possible under applicable law, with a disclaimer that outputs may resemble other users' outputs for similar inputs.
5. Confirm the **failed-generation refund** language in Section 5 accurately describes what a court would enforce if a customer disputed a $3.99 charge for a failed blueprint.
6. Review the **catalog publication** consent in Section 8 (Terms) and the parallel "Public catalog" section in Privacy — we anonymize but publish some qualifying ideas to a public "vetted by founders" list on /ideas. Users can opt out from their account settings.
7. Sanity-check the **GDPR and CCPA** language in Privacy: legal basis, retention periods (90 days for logs, 7 years for payment records), subprocessor list, user rights.
8. Sanity-check the **age eligibility** (16+) — the ChatGPT models we use technically restrict to 13+, but SaaS common practice is 16 or 18. Advise.

## What's already been done

- Both policies are written as sectioned constants in `lib/content.js` — please treat those as the authoritative source, not any older cached copies on the internet.
- A prominent "Beta notice — not yet counsel-reviewed" banner is displayed at the top of /terms and /privacy while `LEGAL_COUNSEL_REVIEWED = false`. Once you sign off, we flip that boolean and the banner comes down automatically.
- Product-side compliance already implemented:
  - Self-serve account deletion (Terms §11, Privacy "Your rights").
  - Self-serve data export in a machine-readable JSON format (Privacy "Your rights").
  - Catalog opt-out from account settings (Terms §8, Privacy "Public catalog").
  - Age gate: sign-up page notes the 16+ requirement.
  - Cookie notice explains we use only strictly-necessary functional cookies (no advertising, no cross-site trackers). No consent mechanism because none is required for that use.
  - hello@ideareels.io is the disclosed contact for privacy and account requests.
  - Retention: payment records kept 7 years for tax obligations; everything else deleted with account or aged out at 90 days.
- **Not** yet in place (may become questions for you):
  - DPA / SCC agreements with subprocessors — we rely on their published standard terms; is that enough?
  - Explicit US state-privacy addenda beyond CCPA (Virginia, Colorado, etc.)?
  - Whether "IdeaReels" needs to be a legally-registered trade name or operate as a sole proprietorship / LLC.

## Specific things I'd like flagged

Anything that in your view is:
- A concrete liability trap I'd want to fix in code, not just wording.
- A gap that meaningfully increases the odds of an enforcement action or complaint.
- Wording that could be misread by a good-faith reader in a way that harms them.

Cosmetic red-lines are welcome but lower priority than the above.

## Deliverable I need back

- Marked-up copy of the two constants (Word / Google Doc / inline comments — whatever's easy).
- The chosen jurisdiction phrasing for Section 17.
- A one-page memo of anything you'd change beyond wording — process, disclosure, or product behavior.

Ping Vincent at hello@ideareels.io if anything is unclear.

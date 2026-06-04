# CLAUDE.md

This repository is the canonical local source of truth for IdeaWheel.

## Canonical locations

- Local repo: `/Users/vincent/.openclaw/workspace/projects/idea-wheel`
- GitHub: `https://github.com/vincentploum-cmyk/idea-wheel`
- Production: `https://idea-wheel-sigma.vercel.app`
- Vercel project: `idea-wheel`

## Do not use this old path for normal development

- `/Users/vincent/Documents/Projects/idea-wheel`

That older repo hit macOS file-provider and `.git` deadlock corruption. Treat it as deprecated unless explicitly doing recovery work.

## Required workflow

For any production-facing change:

1. Edit files in this repo only.
2. Run local verification.
3. Commit changes.
4. Push to GitHub `main`.
5. Prefer the GitHub -> Vercel auto-deploy path.

Do not treat `tmp/idea-wheel-vercel-deploy` as the canonical repo.
That directory is only a fallback deployment snapshot if recovery work is unavoidable.

## Local commands

Install deps:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Start production build locally:

```bash
npm run start
```

## Verification expectations

Before pushing changes that affect the UI or routing:

- run `npm run build`
- verify the homepage loads without runtime errors
- verify mobile layout on narrow widths when changing the main UI
- check `/pricing` if pricing or checkout surfaces changed
- check `/api/stripe/checkout` if checkout logic changed
- check `/api/pipeline/validate`, `/api/pipeline/build`, and `/api/score` if pipeline logic changed

## Deployment rules

Preferred path:
- commit and push to GitHub
- let Vercel auto-deploy

Fallback path only if absolutely necessary:
- use `vercel --prod` from a clean working copy
- if a local repo has filesystem deadlock issues, recover into a clean repo first instead of deploying from a corrupted tree

## Environment variables

Keep secrets out of git.
Expected env comes from Vercel for production.
Common vars include:

- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- Stripe vars when checkout is made truly live

## Known live caveats

- Stripe production checkout still needs real production credentials
- Some pipeline flows may still need hardening around provider output / billing edge cases
- Mobile UI should be judged from real screenshots, not just code diffs

## Working style

- Do not make subtle mobile-only changes and call them done
- For major UI passes, verify on real phone widths like 360, 375, and 390
- Prefer obvious, user-visible improvements over tiny polish that does not read in screenshots
- If production is currently healthy, avoid risky unrelated refactors

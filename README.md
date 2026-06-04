# IdeaWheel

Official local repo path:
- `/Users/vincent/.openclaw/workspace/projects/idea-wheel`

Official GitHub repo:
- `https://github.com/vincentploum-cmyk/idea-wheel`

Official production URL:
- `https://idea-wheel-sigma.vercel.app`

## Canonical source of truth

Use this workspace repo as the canonical local source of truth for IdeaWheel.

Do not use the older Documents-path repo for normal work:
- `/Users/vincent/Documents/Projects/idea-wheel`

That older path hit macOS file-provider / `.git` deadlock issues and is not the trusted working copy.

## Normal workflow

1. Make changes in this repo.
2. Run local checks.
3. Commit to `main`.
4. Push to GitHub.
5. Let Vercel auto-deploy from GitHub.

## Vercel

This repo is connected to the Vercel project `idea-wheel`.
Pushing to `main` should trigger production deploys automatically.

## Notes

- Keep `.env.local` out of git.
- Prefer GitHub-backed deploys over ad hoc clean-snapshot deploys.
- Use the temporary snapshot workaround only if the old broken repo path is being referenced for historical recovery.

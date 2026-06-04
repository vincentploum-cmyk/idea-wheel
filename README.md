# IdeaWheel

Official local repo path:
- `/Users/vincent/.openclaw/workspace/projects/idea-wheel`

Official GitHub repo:
- `https://github.com/vincentploum-cmyk/idea-wheel`

Official production URL:
- `https://idea-wheel.onrender.com`

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
5. Render auto-deploys from GitHub.

## Render

This repo is deployed on Render (free tier).
Pushing to `main` triggers automatic deploys.
Note: free tier spins down after 15 min of inactivity (~30s cold start).

## Notes

- Keep `.env.local` out of git.
- Prefer GitHub-backed deploys over ad hoc clean-snapshot deploys.
- Use the temporary snapshot workaround only if the old broken repo path is being referenced for historical recovery.

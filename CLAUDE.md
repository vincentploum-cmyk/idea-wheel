# CLAUDE.md

This repo is the NHL Model 3.0 site served at https://ideareels.io
(it replaced the former IdeaReels startup-idea product; that code is in git history
before the "Replace IdeaReels with NHL Model 3.0" commit).

## Canonical locations

- Local repo: `/Users/vincent/.openclaw/workspace/projects/idea-wheel`
- GitHub: `https://github.com/vincentploum-cmyk/idea-wheel`
- Production: `https://ideareels.io` (Cloudflare in front)
- Hosting: Render web service, auto-builds from GitHub `main` (`render.yaml`)
- Model source of truth for new logic: `~/Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx`

## Workflow

1. Edit files in this repo.
2. `npm test` and `npm run build`.
3. Check `/` at 1440 and 390 widths (landing signed out; workbench via
   `NHL_DEV_USER_EMAIL=... NHL_STORE_DRIVER=fs npm run dev`).
4. Commit, push `main`; Render deploys in ~2-3 min. CI smoke checks `/`, `/auth/login`,
   `/api/health` (commit match) and that `/api/nhl/runs` returns 401 when signed out.

## Automation

- `lib/nhl-data/*` pulls NHL API data into Supabase Storage and builds the model's
  input workbooks in the model's existing formats. Never change the model's
  parsers to fit the automation; change the builders instead.
- Scheduled by `.github/workflows/nhl-data.yml`; Mac folder sync in `tools/mac-sync`.
- Signed-in page = five hash tabs (`#teams`, `#matchups`, `#model`, `#league`, `#history`).
  Positions are frozen per game before puck drop (`lib/nhl-data/positions.js`,
  `data/positions/<date>.json`) and the stored skater rows carry that position. The
  Matchups tab (`lib/nhl-data/slate.js`) and the per-team defense card
  (`lib/nhl-data/defense.js`) are descriptive views over the stored rows; the model's
  own math stays in `NhlModel.jsx`. Logos/headshots are copied into `data/media/*` and
  served by `/api/nhl/data/media`; standings/leaders live in `data/league/*`.
- MoneyPuck team metrics (`lib/nhl-data/moneypuck.js`, `data/moneypuck/*`) feed the team
  page, Matchups defense cards and League; credit MoneyPuck.com wherever shown.
- Theme: dark by default (`<html data-theme>`, toggle in the header, tokens in
  `globals.css`). `NhlModel.jsx` carries inline light colours, so it renders inside a
  `.nhlx-light` island; keep new UI on the tokens, never hard-coded tints.

## Rules

- The model is admin-only (`NHL_ADMIN_EMAILS`). Every `/api/nhl/*` route must call `requireNhlAdmin()`.
- Keep the model's math untouched when restyling; port logic changes from the local app.
- Secrets stay out of git (Render env + `.env.local`).
- Site is `noindex` by design (robots.txt disallow + X-Robots-Tag).

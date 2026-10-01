# NHL Model 3.0 · Shot Supply Engine

Private NHL player-prop probability model served at **https://ideareels.io**.
Upload the night's matchup workbooks, run the model in the browser, and every
run is saved to Supabase with its input files so any slate can be reopened and
audited against box scores later.

- **Stack:** Next.js 14 (App Router) · React 18 · SheetJS · Supabase (auth + Storage)
- **Hosting:** Render (auto-deploys `main`), Cloudflare in front
- **Theme:** adapted from the Flowbit SaaS template (Envato), light and low-contrast-fatigue — `app/globals.css`

## Access

Only emails in `NHL_ADMIN_EMAILS` (default `vincentploum@gmail.com`) can use the
model or its API. Everyone else sees the landing page or an "access restricted" panel.

## Layout

| Path | What |
|---|---|
| `app/page.js` | Gate: landing (signed out) · locked (not admin) · workbench (admin) |
| `components/nhl/NhlModel.jsx` | The model (ported from `Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx`), Flowbit restyle, logic unchanged |
| `components/nhl/NhlApp.jsx` | Workbench shell: auto-save, run history, reopen/attach/delete |
| `app/api/nhl/runs/**` | Admin-only API over Supabase Storage |
| `lib/nhl-store.js` | Storage layer; bucket `nhl-model`, `runs/<id>/{manifest.json,results.json,inputs/<slot>}` |

No SQL migration is required: the private bucket is created on first save.

## Automatic inputs

The model still does every calculation in the browser; automation only
produces its input workbooks, in the exact formats the parsers already read.

| Input | Source | How it arrives |
|---|---|---|
| Season + L5 matchups | PropFinder export | Mac folder sync (`tools/mac-sync`) uploads `NHL-Goal-Matchups-*.xlsx` saved in `~/Desktop/NHL` |
| Lineups | Beat writers' game-day lines from gamedaytweets.com (`lib/nhl-data/gamedaytweets.js`), else NHL.com game previews (forge API) | scheduled refresh: hourly 12:05–23:05 ET for games starting within 2½ h, plus "Refresh lines" on the Matchups tab |
| Box scores | NHL API box score + play-by-play | scheduled refresh (next morning) |
| Historical profiles | stored skater games, last 365 days | built on demand |
| Home/away stats | stored skater games (last 82) incl. iCF/iFF/iSCF/iHDCF | built on demand |
| Defense rankings | latest PropFinder "Defense (Last 10)" block per team | updated on each matchup upload |
| Pace | not automated (upload manually if wanted) | — |
| PropFinder season stats | its Skater Stats / Team Stats CSV exports (`nhl-skater-stats-*.csv` season or last-N, all venues or Split Home / Away, `nhl-team-stats-Team-*.csv` for, `nhl-team-stats-Opponent-*.csv` against; add `-lw` / `-c` / `-rw` / `-d` to the file name of a per-position opponent export; a "Last 10" or "Last 5" Window export is stored as its own table and feeds the rink's L10 / L5 toggle) | Mac folder sync or "Import PropFinder files"; shown on the team card, League and the player card (the final 2025-26 exports are bundled in `lib/nhl-data/seed/`) |

- Schedule: `.github/workflows/nhl-data.yml` calls `POST /api/nhl/data/refresh`
  four times a day (anonymous calls are throttled to one per 15 min; the admin
  UI can refresh any time).
- Storage (bucket `nhl-model`): `data/games/<date>.json`, `data/rows/<season>.json`,
  `data/lineups/<date>.json`, `data/slates/<date>/{season,l5}.xlsx`,
  `data/defense/latest.json`, `data/propfinder/{skaters,skaters-l5,skaters-l5-home,skaters-l5-away,teams,opponents,opponents-<pos>}-<year>.json`.
- iSCF / iHDCF are a Natural Stat Trick-style approximation from shot
  location (see `lib/nhl-data/game.js`), not NST's exact numbers.
- Lineups are only auto-loaded once every game on the slate has a preview,
  because the model drops players missing from the lineup file.
- Backfill past seasons from the UI: Automatic inputs → Folder sync and data tools.

## Updating the model

The model's pipeline (parsers and `buildProjections`) lives in `components/nhl/model-core.js`;
the UI around it in `components/nhl/NhlModel.jsx`. When you change the local app, port the
changed functions into those files (colors in the UI file are already mapped to the palette).
The server runs the same pipeline automatically after each lineup capture (`lib/nhl-data/autorun.js`)
and saves the run, so the Matchups rinks show the model without a manual run.

## Local development

```bash
npm install
# Real Supabase (needs .env.local with the three Supabase vars):
npm run dev
# Offline: skip auth and store runs in ./.nhl-data
NHL_DEV_USER_EMAIL=vincentploum@gmail.com NHL_STORE_DRIVER=fs npm run dev
```

Both dev switches are ignored in production builds.

```bash
npm test        # unit tests
npm run build   # production build
```

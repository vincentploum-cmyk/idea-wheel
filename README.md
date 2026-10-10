# NHL Model 3.0 · Shot Supply Engine

Private NHL player-prop probability model served at **https://ideareels.io**.
Upload the night's matchup workbooks, run the model in the browser, and every
run is saved to Supabase with its input files so any slate can be reopened and
audited against box scores later.

- **Stack:** Next.js 14 (App Router) · React 18 · SheetJS · Supabase (auth + Storage)
- **Hosting:** Render (auto-deploys `main`), Cloudflare in front
- **Theme:** adapted from the Flowbit SaaS template (Envato), light and low-contrast-fatigue — `app/globals.css`

## Access

Only emails in `NHL_ADMIN_EMAILS` (default `vincentploum@gmail.com,sjlever@yahoo.com`) can use the
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
| Season + L5 matchups | PropFinder's API (`lib/nhl-data/propfinder-api.js`), signed in with `PROPFINDER_EMAIL` / `PROPFINDER_PASSWORD` from the server environment; else its `NHL-Goal-Matchups-*.xlsx` exports | pulled every morning (9:17 ET) and whenever lines are read while the slate's files are missing, or "Pull from PropFinder now" on the Model tab; otherwise Mac folder sync (`tools/mac-sync`) uploads the exports saved in `~/Desktop/NHL` |
| Lineups | Beat writers' game-day lines from gamedaytweets.com (`lib/nhl-data/gamedaytweets.js`), else NHL.com game previews (forge API), else PropFinder's depth chart from the last pull, else the roster | the `nhl-lineups.yml` run, on the rule "from 60 minutes before puck drop, read every 15 minutes until the lineups are found (both teams have a tweet from the 45 minutes before the start: the warm-ups), or the game is 10 minutes old": GitHub's cron only seeds it (two slots an hour 9:03 AM–11:53 PM ET, of which GitHub fires a few a day), "Refresh lines" on the Matchups tab starts one on demand (the server dispatches the workflow with `GITHUB_DISPATCH_TOKEN`, a fine-grained token with Actions read/write on this repo, then polls until the pages land), and every run hands itself on with its own token (`tools/lines-chain.mjs`): a run before the first window sleeps until it opens, a run inside a window sleeps 15 minutes, until every game has its lineups. The post-game settle is unchanged. gamedaytweets.com challenges cloud addresses (Render and GitHub alike), so its pages reach the site from elsewhere and are posted to `/api/nhl/data/lineups/gdt`: the runner fetches them with a real Chrome (`tools/gdt-pages.sh` → `tools/gdt-browser.mjs`; `NHL_ACTIONS_TOKEN` as repo secret and Render env var), and the Mac folder sync fetches them from the home connection once an hour, every 15 minutes from an hour before a game until ten minutes after (sync token; re-run `tools/mac-sync/install.command` after updating). The Matchups header says when the beat writers' pages last arrived |
| Box scores | NHL API box score + play-by-play | scheduled refresh (next morning) |
| Historical profiles | stored skater games, last 365 days | built on demand |
| Home/away stats | stored skater games (last 82) incl. iCF/iFF/iSCF/iHDCF | built on demand |
| Defense rankings | latest PropFinder "Defense (Last 10)" block per team | updated on each matchup upload |
| Pace | not automated (upload manually if wanted) | — |
| PropFinder season stats | the same API pull (season and last-5 skater rates for the teams playing; team, opponent and per-position opponent tables for the full season, last 5 and last 10), or its Skater Stats / Team Stats CSV exports (`nhl-skater-stats-*.csv` season or last-N, all venues or Split Home / Away, `nhl-team-stats-Team-*.csv` for, `nhl-team-stats-Opponent-*.csv` against; add `-lw` / `-c` / `-rw` / `-d` to the file name of a per-position opponent export; a "Last 10" or "Last 5" Window export is stored as its own table and feeds the rink's L10 / L5 toggle) | Mac folder sync or "Import PropFinder files"; shown on the team card, League and the player card (the final 2025-26 exports are bundled in `lib/nhl-data/seed/`) |

- Schedule: `.github/workflows/nhl-data.yml` calls `POST /api/nhl/data/refresh`
  twice a day, 9:17 ET and 00:41 ET (anonymous calls are throttled to one per 15 min per mode; the admin
  UI can refresh any time).
- Storage (bucket `nhl-model`): `data/games/<date>.json`, `data/rows/<season>.json`,
  `data/lineups/<date>.json`, `data/slates/<date>/{season,l5}.xlsx`,
  `data/defense/latest.json`, `data/propfinder/{skaters,skaters-l5,skaters-l5-home,skaters-l5-away,teams,opponents,opponents-<pos>}-<year>.json`.
- iSCF / iHDCF are a Natural Stat Trick-style approximation from shot
  location (see `lib/nhl-data/game.js`), not NST's exact numbers.
- Lineups are only auto-loaded once every game on the slate has a preview,
  because the model drops players missing from the lineup file.
- PropFinder API pull: `GET /NHL/teams` (32 teams' stats rows: Team / Opponent × All / LW / C /
  RW / D × full season / last 5 / 10 / 15) and `GET /NHL/players?teamIds=…&hydrate=stats`
  (one row per game) for the teams playing; season rates use that season's regular-season
  games (last season's until a player has one), "last 5" the last five games of any type, team
  columns are totals / games played ranked 1 = highest; the matchup workbooks are written in the
  export layout and stored through the same ingest as an upload. It is PropFinder's private
  API: when it changes, the Model tab shows the failed pull and the folder sync still works.
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

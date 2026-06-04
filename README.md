# Spinup

> Spin the wheel. Ship the company.

An interactive idea generator: spin a wheel to land on a startup frontier, validate the
market, and reveal a full blueprint (product, go-to-market, infrastructure, prototype).

## Run it
It's a static site — no build step. Just open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Host it free on GitHub Pages
1. Push this folder to a GitHub repo.
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Pick branch `main` and folder `/ (root)`, then **Save**.
4. Your site goes live at `https://<your-username>.github.io/<repo-name>/`.

## Files
- `index.html` / `Spinup.html` — entry point (identical; `index.html` is what Pages serves)
- `styles.css`, `screens.css` — design tokens + screen styles
- `data.js` — the idea dataset
- `components.jsx`, `wheel.jsx`, `screens.jsx`, `app.jsx` — React UI (compiled in-browser via Babel)
- `tweaks-panel.jsx` — the live Tweaks panel

React, ReactDOM, and Babel load from a CDN, so an internet connection is needed on first load.

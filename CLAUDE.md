# CLAUDE.md — LinkShelf (Bookmarkhere)

## Project Reference

- **App / Worker:** `linkshelf` (deployed app is "LinkShelf"; repo + folder are named **Bookmarkhere**).
- **Type:** Personal bookmark manager — Astro app on Cloudflare Workers, with bookmark/category data in Cloudflare D1 and sessions in Cloudflare KV.
- **Stack:** Astro 6 + `@astrojs/cloudflare` (Workers adapter), Wrangler, Tailwind CSS v4 (`@tailwindcss/postcss`), D1, KV, TypeScript.
- **GitHub:** https://github.com/barberryid/Bookmarkhere
- **Production:** https://linkshelf.wheyisolate.workers.dev (protected by Cloudflare Access, owner email only)

> The Astro 6 Cloudflare adapter is **Workers-only** — Cloudflare Pages cannot run this app. Deploy with `wrangler deploy`, never a Pages build.

### Paths

- Project folder: `C:\Users\Gary\code\Bookmarkhere`
- Maintenance/import scripts: `scripts/` (one-off Node `.mjs`)
- Retired working files (docx, design notes, data backups, dev logs) live in `archive/`

### Build / Deploy (Git Bash)

```bash
cd "/c/Users/Gary/code/Bookmarkhere"
npm run build      # astro check && astro build
npm run deploy     # astro build && wrangler deploy  <-- this is what deploys
```

**`git push` does NOT deploy** (no build integration is connected). Order:

```bash
npm run deploy
git add .
git commit -m "message"
git push           # GitHub only
```

### Database migrations

```bash
npm run db:migrate:local     # local D1
npm run db:migrate:remote    # production D1
```

## Conventions

- **Cloudflare bindings** are declared in `wrangler.toml`: D1 as `DB` (database `linkshelf`), KV as `SESSION`. IDs live there — do not hard-code them elsewhere.
- **Rendering:** Astro is static by default; the dashboard and API routes opt out with `export const prerender = false`. Add that to any new dynamic/API route.
- **Server logic** lives in `src/lib/` (auth, db, bookmarks, categories, collections, importers, urlNormalize). **Client-side TS** lives in `src/scripts/`. **API routes** are under `src/pages/api/`.
- **Schema changes** are migrations in `migrations/`, applied with `npm run db:migrate:remote` — never edit production tables by hand.
- **Styling** is Tailwind CSS v4 via PostCSS; global styles in `src/styles/global.css`. No `tailwind.config.js`.
- **Personal data** (D1 backups, generated import SQL) stays out of git — see `.gitignore` (`backups/`, `scripts/*.sql`).
- **`PROJECT_REFERENCE.md`** is the ops runbook (Cloudflare resources, first-time setup, Access management, import provenance). **`README.md`** is the overview + dev/deploy guide. Keep both current.

# LinkShelf

A personal bookmark manager. The deployed app is **LinkShelf**; the repository and project folder are named **Bookmarkhere**. It is an Astro app that runs on Cloudflare Workers, stores bookmarks and categories in a Cloudflare D1 database, and keeps sessions in Cloudflare KV.

The dashboard lets you organise bookmarks into categories and collections, search and run quick keyboard actions via a command palette, track most-used links, and import an existing Booky.io export.

## Tech Stack

- Astro 6 with the `@astrojs/cloudflare` adapter (**Workers**, not Pages)
- Cloudflare Workers + Wrangler for deployment
- Cloudflare D1 (SQLite) for bookmark/category data
- Cloudflare KV for sessions
- Tailwind CSS v4 (via `@tailwindcss/postcss`)
- TypeScript

> Note: the Astro 6 Cloudflare adapter is Workers-only. Cloudflare Pages cannot run this app, so deployment is via `wrangler deploy`, not a Pages build integration.

## Prerequisites

- Node.js 18+ and npm
- A Cloudflare account with Wrangler authenticated (`npx wrangler login`)
- A provisioned D1 database (`linkshelf`) and KV namespace (`SESSION`); their IDs live in `wrangler.toml`

See `PROJECT_REFERENCE.md` for the full one-time setup (creating the D1 database and KV namespace, first deploy, and enabling Cloudflare Access).

## Local Development

```bash
npm install
npm run dev
```

`platformProxy` is enabled in `astro.config.mjs`, so local dev has access to the Cloudflare bindings. Apply migrations to the local D1 database first if needed:

```bash
npm run db:migrate:local
```

## Database

Schema lives in `migrations/` and is applied with Wrangler:

```bash
npm run db:migrate:local     # local D1
npm run db:migrate:remote    # production D1
```

D1 (`DB`) and KV (`SESSION`) bindings are declared in `wrangler.toml`.

## Build and Deploy

```bash
npm run build     # astro check && astro build
npm run deploy    # astro build && wrangler deploy  -> deploys the Worker
```

**Important:** `git push` does **not** deploy — there is no build integration connected. `npm run deploy` is what publishes the Worker; `git push` only saves to GitHub.

```bash
npm run deploy
git add .
git commit -m "message"
git push
```

Production runs at `https://linkshelf.wheyisolate.workers.dev` (protected by Cloudflare Access, restricted to the owner's email).

## Project Structure

```
src/
  pages/
    index.astro, dashboard.astro, import.astro   Pages (dashboard opts out of
                                                 prerender for dynamic data)
    api/                                         JSON API routes:
      bookmarks/ categories/ export/ import/ meta
  components/    Astro UI (BookmarkCard, CommandPalette, ImportPanel, …)
  lib/           Server logic (auth, db, bookmarks, categories, collections,
                 importers, urlNormalize, types)
  scripts/       Client-side TypeScript (dashboard, search, dragdrop, palette,
                 shortcuts, theme, …)
  layouts/       BaseLayout.astro
  styles/        global.css (Tailwind v4)
migrations/      D1 schema migrations
scripts/         One-off Node maintenance/import scripts (.mjs)
public/          Static assets (favicon, fonts)
wrangler.toml    Worker config + D1/KV binding IDs
archive/         Retired working files (not used by the app)
```

Astro is static by default here; the dashboard and API routes opt out with `export const prerender = false`.

## Importing Bookmarks

Bookmarks can be imported from a Booky.io HTML export (Netscape bookmark format) through the dashboard Import panel — duplicate URLs are skipped and malformed HREFs are recovered automatically. A CLI route (`scripts/import-booky-to-d1.mjs`) exists for bulk/initial loads that bypass Cloudflare Access. See `PROJECT_REFERENCE.md` for details and import history.

## Further Reference

`PROJECT_REFERENCE.md` is the operations runbook: Cloudflare resource details, first-time setup, Cloudflare Access management, deploy/migration commands, and import provenance.

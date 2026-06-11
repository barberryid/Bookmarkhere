# REFERENCES Bookmarkhere

## Active Project Folder

`C:\Users\Gary\code\Bookmarkhere`

App / Worker name: `linkshelf` (deployed app is "LinkShelf"; repo + folder are named Bookmarkhere)

## Software Stack

GitHub, Git Bash, Astro 6, Cloudflare Workers, Wrangler, Tailwind CSS v4, D1 (database), KV (sessions)

Note: Astro 6's adapter is Workers-only — Cloudflare Pages cannot run this app (Pages is in maintenance mode).

## Websites

- GitHub repository: `https://github.com/barberryid/Bookmarkhere.git`
- Production URL: `https://linkshelf.wheyisolate.workers.dev`
- Production branch: `main`
- workers.dev subdomain: `wheyisolate`
- Old Pages URL: `https://bookmarkhere.pages.dev/` — deleted 2026-06-11 (never served this app); the only Cloudflare app is the linkshelf Worker

## Cloudflare Access (dashboard protection)

Enabled on the production URL; restricted to wheyisolate@gmail.com via one-time email code.
Manage: Workers & Pages -> linkshelf -> Domains -> Production row -> Manage policy

## Cloudflare Resources (IDs live in wrangler.toml)

- D1 database: `linkshelf` (region WEUR)
- KV namespace: `SESSION`

## First-Time Setup (one-time per Cloudflare account / new machine — already done for current prod)

```bash
npx wrangler login                         # opens browser; authorize Wrangler
npx wrangler d1 create linkshelf           # paste returned database_id into wrangler.toml
npx wrangler kv namespace create SESSION   # paste returned id into wrangler.toml
npm run db:migrate:remote                  # creates tables + seed user + seed categories
npm run deploy                             # first deploy -> live at linkshelf.wheyisolate.workers.dev
```

Then (dashboard, manual): enable Cloudflare Access on the workers.dev row, restrict to your email.

## Git Bash

```bash
cd "/c/Users/Gary/code/Bookmarkhere"
```

## Publish Changes

IMPORTANT: `git push` alone does NOT deploy — no build integration is connected.

```bash
npm run build
npm run deploy            # <-- this is what actually deploys the Worker
git status
git add .
git commit -m "message"
git push                  # saves to GitHub only; does not deploy
```

## Database Migrations (remote / production)

```bash
npm run db:migrate:remote
```

## Booky Import

- Normal use: dashboard Import panel with the Booky.io HTML export (Netscape
  bookmark format). Duplicate URLs are skipped; corrupted HREFs (title glued
  before the URL) are recovered automatically.
- Bulk/CLI route (bypasses Cloudflare Access, used for the initial production
  load): `scripts/import-booky-to-d1.mjs` — generates SQL from an export file
  and existing DB state, executed with `wrangler d1 execute`. Usage is in the
  script header. Production was loaded from `booky_backup_2026-06-11.html`
  on 2026-06-11: 2160 found, 2069 imported, 91 duplicates skipped,
  242 categories created.

## Folders

- Source images folder: None
- Research folder: Not set
- Scripts folder: `C:\Users\Gary\code\Bookmarkhere\scripts`

## Config / Docs

- `wrangler.toml` — holds D1 + KV IDs and Worker config
- `PROJECT_REFERENCE.md` — this file; documents the Pages->Workers deviation and deploy steps

## Build Settings (legacy Cloudflare Pages dashboard fields — no longer used; deploy is via npm run deploy / wrangler)

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

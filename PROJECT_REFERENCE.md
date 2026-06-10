# REFERENCES Bookmarkhere

## Active Project Folder

`C:\Users\Gary\code\Bookmarkhere`

## Software Stack

Github, Git Bash, Astro, Cloudflare Workers + D1, Tailwind CSS v4

Note: the Astro 6 Cloudflare adapter no longer supports Cloudflare Pages,
so the app deploys as a Cloudflare Worker with static assets instead.

## Websites

- GitHub repository: `https://github.com/barberryid/Bookmarkhere.git`
- Cloudflare Worker: Not deployed yet (see Deployment below)
- Production branch: `main`

## Git Bash

```bash
cd "/c/Users/Gary/code/Bookmarkhere"
npm run build
```

## Publish Changes

```bash
git status
git add .
git commit -m "bookmarkshere"
git push
```

## Folders

- Source images folder: None
- Research folder: Not set
- Scripts folder: `C:\Users\Gary\code\Bookmarkhere\scripts`

## Build Settings

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

## Local Development

```bash
npm run dev                # dev server with local D1 (state in .wrangler/)
npm run db:migrate:local   # apply migrations to the local D1 database
```

## Deployment (first time)

```bash
npx wrangler login
npx wrangler d1 create linkshelf          # paste database_id into wrangler.toml
npx wrangler kv namespace create SESSION  # paste id into wrangler.toml
npm run db:migrate:remote                 # create tables + seed user in production
npm run deploy                            # build and deploy the Worker
```

After deploying, protect the dashboard with Cloudflare Access
(Zero Trust > Access > Applications) before importing real bookmarks.

## Booky Import

Use the dashboard Import panel with the Booky.io HTML export file
(Netscape bookmark format). Duplicate URLs are skipped automatically.

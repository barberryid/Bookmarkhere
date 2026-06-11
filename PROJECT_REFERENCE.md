# REFERENCES Bookmarkhere

## Active Project Folder

`C:\Users\Gary\code\Bookmarkhere`

## Software Stack

Github, Git Bash, Astro, Cloudflare Workers + D1, Tailwind CSS v4

Note: the Astro 6 Cloudflare adapter no longer supports Cloudflare Pages,
so the app deploys as a Cloudflare Worker with static assets instead.

## Websites

- GitHub repository: `https://github.com/barberryid/Bookmarkhere.git`
- Live site (Cloudflare Worker): `https://linkshelf.wheyisolate.workers.dev`
- Production branch: `main`
- Note: `bookmarkhere.pages.dev` is an unused Pages project (the Astro 6
  adapter cannot run on Pages) and can be deleted in the dashboard.

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

## Deployment

First-time setup is done (D1 database `linkshelf`, KV namespace `SESSION`,
migrations applied, Worker deployed). To publish changes:

```bash
npm run deploy             # build and deploy the Worker
npm run db:migrate:remote  # only when there are new migration files
```

## Dashboard Protection (Cloudflare Access)

Protect the dashboard before importing real bookmarks:

1. Cloudflare dashboard > Workers & Pages > linkshelf > Settings >
   Domains & Routes > workers.dev > Enable Cloudflare Access
2. In the generated Access application, set the policy to allow only
   your email address.

## Booky Import

Use the dashboard Import panel with the Booky.io HTML export file
(Netscape bookmark format). Duplicate URLs are skipped automatically.

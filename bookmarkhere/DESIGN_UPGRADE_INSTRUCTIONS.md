# LinkShelf — Design & Usability Upgrade Instructions for Claude Code

**Goal:** Take the current LinkShelf dashboard from "clean Booky clone" to a bookmark manager with 10x better usability and design. Booky.io is the inspiration for *layout familiarity only* — the interaction quality should match modern tools like Linear, Raindrop.io, and Superhuman.

**Audience:** Claude Code, working in `C:\Users\Gary\code\Bookmarkhere`.

**Scope guardrails (unchanged from project brief):** No AI features, no screenshots/thumbnails, no browser extension, no public sharing, no multi-user UI. Keep JavaScript minimal — vanilla TS in Astro `<script>` blocks, no client-side framework. Desktop first; mobile must stay usable.

---

## How this document was produced

The current codebase was audited file-by-file (`dashboard.astro`, all components, `global.css`), and recommendations were cross-checked against: Raindrop.io's interface patterns (multiple view densities, keyboard-driven retrieval measured at ~1.8s median — 3.6x faster than mouse-driven UIs), command-palette UX guidance (Superhuman, uxpatterns.dev), Linear's design-system principles (restrained accent color, tight monochrome scale, intentional density), accessible-card patterns (Inclusive Components, Adrian Roselli), optimistic-UI best practice (update instantly, roll back with a visible toast on failure), and documented Booky.io pain points (drag-only sorting, weak hierarchy at scale).

---

## Current weaknesses found in the code (fix list)

These are concrete findings from the audit, in priority order. Each maps to a phase below.

1. **Every mutation triggers `window.location.reload()`** (`dashboard.astro` — add, edit, delete, move, rename, all of it). This is the single biggest usability problem: ~1–2s penalty per action, scroll position lost, collapsed state re-applied with flicker. → Phase 2.
2. **`window.confirm`, `window.prompt`, `window.alert`** used for delete bookmark, delete category, rename category, and every error. `ConfirmDialog.astro` exists but is never imported anywhere. → Phase 2.
3. **No keyboard support at all.** No shortcut to focus search, no way to navigate results, no command palette. For a 500–5,000 bookmark tool used many times a day, keyboard speed is the core 10x lever. → Phase 3.
4. **~30 hardcoded hex colors** (`#2f6f5e`, `#dfe5da`, `#17201b`, …) repeated across every component instead of Tailwind v4 `@theme` tokens. Makes restyling and dark mode impossible without a find-replace sweep. → Phase 1.
5. **No dark mode.** `color-scheme: light` is hardcoded in `global.css`. → Phase 1.
6. **Inter is named in the font stack but never loaded** — every user actually sees Segoe UI/system-ui. → Phase 1.
7. **Permanent 340px right sidebar** holds Add Bookmark form, Add Category form, and the full Import panel on every dashboard visit. Add/import are occasional actions; they're consuming ~28% of content width permanently while the actual bookmarks get squeezed. → Phase 4.
8. **Favourites are stored but never surfaced** — the star renders on cards, but there is no favourites section, filter, or sort. Dead feature. → Phase 4.
9. **Search is exact-substring only, with no match highlighting** and no per-category result counts. Multi-word queries fail unless words are adjacent ("travel insurance" won't match "insurance for travel"). → Phase 3.
10. **No way to jump to a category** — with 20+ categories (the Booky screenshot shows this user has dozens) the page is one long scroll. → Phase 4.
11. **Reorder is up/down buttons + full reload per click.** Moving a bookmark 5 positions = 5 clicks and 5 page reloads. This is the exact complaint users have about Booky's drag-only sorting, inverted. → Phase 5.
12. **No title autofill** — adding a bookmark requires manually typing the title before the URL. → Phase 5.
13. **No undo** for deletes; only a blocking confirm. → Phase 2.
14. **One fixed density.** Cards always show description lines; no compact/list mode for power scanning. Raindrop ships grid/list/headlines/masonry for this reason. → Phase 4.
15. Minor: favicon `onerror` handler replaces the `<img>` with a bare text node, losing the styled treatment; `h-13` is not a default Tailwind spacing (renders only because of arbitrary-value support in v4? verify); landing page footer still says "prepared for Cloudflare Pages" which is outdated.

---

## Phase 1 — Design foundation (tokens, type, dark mode)

*Do this first; everything else builds on it.*

### 1.1 Design tokens via Tailwind v4 `@theme`

Replace all hardcoded hex values with semantic tokens defined once in `src/styles/global.css`. Tailwind v4 supports this natively:

```css
@import "tailwindcss";

@theme {
  /* Surfaces */
  --color-canvas: oklch(0.98 0.005 120);      /* page background */
  --color-surface: oklch(1 0 0);              /* cards, panels */
  --color-surface-2: oklch(0.965 0.006 120);  /* section background, hover fills */

  /* Borders */
  --color-edge: oklch(0.9 0.01 120);
  --color-edge-strong: oklch(0.82 0.015 120);

  /* Text */
  --color-ink: oklch(0.22 0.01 150);
  --color-ink-mute: oklch(0.5 0.015 150);
  --color-ink-faint: oklch(0.62 0.01 150);

  /* Accent — keep the sage/forest green identity, but ration it */
  --color-accent: oklch(0.48 0.07 165);
  --color-accent-strong: oklch(0.42 0.08 165);
  --color-accent-soft: oklch(0.95 0.02 150);

  /* Status */
  --color-danger: oklch(0.5 0.12 25);
  --color-danger-soft: oklch(0.96 0.02 25);
  --color-warn-soft: oklch(0.97 0.02 80);
}
```

Then sweep every component: `border-[#dfe5da]` → `border-edge`, `text-[#17201b]` → `text-ink`, `bg-[#2f6f5e]` → `bg-accent`, etc. **Acceptance: zero `[#`-style arbitrary color values remain in any `.astro` file.**

Design principle (from Linear): the accent color appears on **one primary action per screen** plus interactive accents (focus rings, active states, favourite stars stay amber). Everything else lives on the monochrome scale. The current UI already leans this way — formalize it.

### 1.2 Dark mode

- Define dark values for every token under a `.dark` selector (or `@media (prefers-color-scheme: dark)` + class override). Dark surfaces should be desaturated near-black with a hint of the green hue (e.g. canvas `oklch(0.17 0.008 150)`), not pure `#000`.
- Default to system preference; add a 3-state toggle (light / dark / system) in the `Header`, persisted in `localStorage` (key `linkshelf-theme`). Apply the class in an inline `<head>` script in `BaseLayout.astro` *before* paint to avoid flash.
- Set `color-scheme: light dark` so native controls (the edit `<dialog>`, scrollbars, inputs) follow.
- Favicon images on dark: give the favicon chip a permanent light `bg-surface`-style well so dark-transparent favicons stay visible.

### 1.3 Typography & spacing polish

- Self-host **Inter variable** (woff2 in `public/fonts/`, `@font-face` with `font-display: swap`, preload in `BaseLayout`). Enable `font-feature-settings: "cv05", "ss01"` if desired. Alternatively switch to `Geist` — either way, the named font must actually load.
- Use `text-balance` on headings, `tabular-nums` on counts (bookmark counts, import stats).
- Tighten the type scale: card title `text-sm/5 font-medium` (not semibold — at 3-column density semibold everywhere reads heavy), domain `text-xs text-ink-faint`, category heading `text-sm font-semibold uppercase tracking-wide text-ink-mute` *or* keep current size — pick one and apply consistently.
- Radius: standardize on `rounded-lg` for cards/panels, `rounded-md` for buttons/inputs. The current mix of `rounded-md` everywhere is fine but slightly dated; a small bump on containers modernizes it cheaply.
- Shadows: replace ad-hoc `shadow-[0_1px_0_rgba(...)]` with two tokens — `--shadow-card` (1px hairline) and `--shadow-pop` (menus, dialogs). Dark mode should rely on borders, not shadows.

---

## Phase 2 — Kill the page reloads (the single biggest win)

### 2.1 In-place DOM updates instead of `window.location.reload()`

Rewrite the mutation handlers in `dashboard.astro` so the DOM updates surgically:

- **Add bookmark:** POST → on success, `POST /api/bookmarks` already returns `{ bookmark }` with status 201 (verified), and duplicates return 409 with `duplicate: true` — use that for the inline pre-submit duplicate warning too. Clone a `<template id="bookmark-card-template">` rendered server-side, fill in fields, insert into the right category grid, run a brief highlight animation (`animate-[pulse]`-style, 600ms). Update counts.
- **Edit bookmark:** PUT → patch the card's `data-*` attributes and visible text/href in place. If the category changed, move the card node to the new section.
- **Delete bookmark:** see 2.3 (undo pattern). Remove the node immediately.
- **Move up/down (and later drag-drop):** swap the DOM nodes immediately, then fire the API call (optimistic). On failure, swap back and toast.
- **Category collapse/rename/delete/reorder:** same approach — rename patches the `<h2>`, delete removes the section and moves its cards into the Uncategorised section in-DOM, reorder swaps section nodes.

Rules (research-backed optimistic-UI practice):
- Optimistic (update first, rollback on failure) for low-risk actions: reorder, favourite toggle, collapse.
- Pessimistic-but-fast (await response, then patch DOM — still no reload) for create/edit, since the server assigns ids and runs duplicate validation.
- **Never silently roll back** — every rollback fires a toast explaining what failed.
- Refactor the growing script: move the client logic out of the inline `<script>` in `dashboard.astro` into `src/scripts/dashboard.ts` (imported by the page) with small modules: `search.ts`, `mutations.ts`, `toast.ts`, `palette.ts`, `shortcuts.ts`. Keep zero-framework.

**Acceptance: a full add → edit → favourite → move → delete cycle causes zero full-page navigations, and scroll position never jumps.**

### 2.2 Replace all native dialogs

- Build a proper `ConfirmDialog` on `<dialog>` (the component file already exists — implement and actually use it): danger-styled confirm button, `Esc`/backdrop cancel, focus trapped, focus returned to the trigger on close.
- Replace `window.prompt` rename with inline editing: clicking rename turns the category `<h2>` into a text input (`Enter` saves, `Esc` cancels, blur saves).
- Replace every `window.alert(...)` error with a toast (2.3).

### 2.3 Toast system with Undo

Add a small toast module (`src/scripts/toast.ts` + a fixed-position container in `BaseLayout`):

- Bottom-center or bottom-right, max ~3 stacked, auto-dismiss 5s, pause on hover, `role="status"` (`aria-live="polite"`); errors use `role="alert"`.
- **Delete bookmark = no blocking confirm at all.** Remove the card instantly, show "Deleted 'Title' — **Undo**" for 6 seconds. Undo restores via re-POST (or a soft-delete flag if you prefer server-side; client-side re-create is acceptable at MVP scale and needs no schema change). This is strictly faster *and* safer than `confirm()`.
- Keep the blocking `ConfirmDialog` only for **category** deletion (it cascades bookmark moves) — and in that dialog state exactly how many bookmarks will move to Uncategorised.
- Success toasts for import completion and export start; error toasts for all failed mutations.

---

## Phase 3 — Keyboard-first speed (the 10x differentiator)

Raindrop's measured ~1.8s median keyboard retrieval vs mouse-driven UIs is the benchmark: the target loop is **`/` → type 3 letters → `Enter` → site opens**, under 2 seconds.

### 3.1 Global shortcuts (`src/scripts/shortcuts.ts`)

| Key | Action |
|---|---|
| `/` or `Ctrl/Cmd+K` | Focus search / open command palette |
| `Esc` | Clear search (when focused), close palette/dialog |
| `↓` / `↑` (from search box) | Move selection through visible result cards |
| `Enter` | Open selected bookmark in new tab |
| `Ctrl/Cmd+Enter` | Open selected and keep focus in results |
| `e` | Edit selected card |
| `f` | Toggle favourite on selected card |
| `Delete` | Delete selected card (with undo toast) |
| `a` | Open Add Bookmark |
| `?` | Open shortcut cheat-sheet overlay |

Implementation notes: ignore keydowns when an input/textarea/select/dialog has focus (except `Esc`); maintain a visible selection state (`data-selected` + a 2px accent ring + `scrollIntoView({block:"nearest"})`); selection follows search filtering. Add a one-line hint under the search bar: `Press / to search · ? for shortcuts` in `text-ink-faint`.

### 3.2 Command palette (`Ctrl/Cmd+K`)

A single overlay that merges bookmark search and commands — this can *be* the search experience for power use:

- `<dialog>` styled as a centered palette (max-w-xl, top-aligned ~20vh), fuzzy-matching list below the input, arrow-key navigation, `Enter` opens.
- Default mode: searches bookmarks (title, domain, description, category). Each row: favicon chip, title, domain, category badge, and `↵ open · ⌘↵ edit` hint on selection.
- Prefix `>` switches to command mode: "Add bookmark", "Add category", "Import", "Export JSON", "Export CSV", "Toggle dark mode", "Go to category …" (jumps + expands).
- Keep it dependency-free (~200 lines of TS). Build the searchable index from the server-rendered cards' `data-*` attributes at page load — no extra fetch needed at this scale.

### 3.3 Better search matching + highlighting

- **Multi-token AND matching:** split the query on whitespace; a card matches if *every* token appears somewhere in its search string. ("ins trav" finds "Travel Insurance".) This is cheap and removes 90% of the need for true fuzzy search; skip Fuse.js unless this proves insufficient.
- **Highlight matches** in title and domain via `<mark>` with a soft accent background (wrap/unwrap text nodes on the client; never innerHTML user content — XSS).
- Show **per-category match counts** while searching ("Insurance — 4 of 23") and keep the existing behavior of hiding empty sections.
- Debounce input at ~80ms; keep the URL `?search=` sync that already exists.
- Empty state gains a primary action: "Add '<query>' as a bookmark" pre-fills the Add form title.

---

## Phase 4 — Layout, density, and navigation

### 4.1 Retire the permanent sidebar

- **Add Bookmark** becomes a modal `<dialog>` (reuse the edit dialog's structure — they're nearly identical forms; consolidate into one `BookmarkDialog` used for both add and edit). Triggers: header button, `a` key, per-category `+`, palette.
- **Add Category** becomes an inline affordance: a ghost "+ New category" row at the end of the category list that turns into an input on click.
- **Import panel** moves to the existing `/import` page only (it's already there); the dashboard keeps just the Import link. First-run exception: when there are zero bookmarks, render the import panel front-and-center in the dashboard empty state.
- Bookmarks then take the full content width: bump the card grid to `md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`.

### 4.2 Category navigation rail (replaces the sidebar's job)

Add a slim left rail (~220px, `lg:` and up only; hidden on mobile in favor of a jump-menu button next to search):

- Lists all categories with counts; click = smooth-scroll to section (`scroll-mt` on sections already partially set up).
- Highlights the section currently in view (IntersectionObserver, ~40 lines).
- "Favourites" pseudo-entry at top (see 4.4), "Uncategorised" pinned last.
- This mirrors Booky's left "Collections" column — familiar to you — but acts as a scroll-spy TOC instead of separate pages, preserving the everything-on-one-page speed.

### 4.3 Density toggle (grid / compact list)

Header control + palette command, persisted in `localStorage` (`linkshelf-density`):

- **Grid** (current): favicon chip, title, domain, 2-line description.
- **Compact list:** single-row entries — favicon (16px), title, domain right-aligned in `text-ink-faint`, no description; rows ~36px tall, hairline separators, category sections become flat lists. This is the "scan 5,000 bookmarks" mode and the closest analogue to Booky's dense link lists, done cleanly.
- Implement via a `data-density` attribute on `<main>` + CSS (`group-data-*` variants or plain descendant selectors). The `compact` prop already on `BookmarkCard` is the starting point.

### 4.4 Surface favourites

- A "Favourites" virtual section pinned above all categories, rendered from `is_favourite` bookmarks across categories (cap at ~20, compact density). Hide when empty.
- Star toggle directly on the card hover-toolbar (`f` key / one click), optimistic. Currently favouriting requires opening the edit dialog — three clicks for a one-bit change.

### 4.5 Card refinements

- Keep the whole-card link pattern but harden it per accessible-card guidance: the action toolbar must not be inside the `<a>` (it isn't — good; keep it that way), `:focus-within` reveals the toolbar (already done — keep), and add `@media (hover: none)` always-visible actions (already done via `sm:` — keep).
- Add a **copy URL** button to the hover toolbar (clipboard + "Copied" toast). For a bookmark manager this is a top-3 action and currently impossible without opening the site.
- Replace the fragile `onerror="this.replaceWith(this.dataset.fallback)"` with a JS handler that swaps in the styled initial (keeping the chip styling), and add `referrerpolicy="no-referrer"` on favicon imgs.
- Hover: keep the current subtle `-translate-y-0.5` lift OR border+shadow emphasis — not both growing further. No new animation beyond 150ms ease-out transitions. (Calm > flashy; this is a daily tool.)
- Title `title` attribute (or tooltip) for truncated titles.

### 4.6 Landing page touch-ups (low priority)

- Fix footer copy ("Cloudflare Pages" → just remove the deployment detail).
- Apply the new tokens/dark mode so it doesn't look like a different product.
- Otherwise leave it — the dashboard is where the 10x lives.

---

## Phase 5 — Flow accelerators & final polish

### 5.1 Add-bookmark friction removal

- **Field order: URL first, then title.** When the URL field loses focus (or on paste), call a new endpoint `GET /api/meta?url=` that server-side fetches the page (Workers `fetch`, 3s timeout, text/html only, size-capped) and returns `<title>`. Autofill the empty title field — editable, never overwriting user input. Show a tiny spinner in the title field while fetching; fail silently to manual entry.
- Duplicate check on URL blur via existing duplicate logic (`GET /api/bookmarks?url=` or a lightweight `/api/bookmarks/check`): inline warning under the field — "Already saved as 'X' in Travel" with a "Go to it" link — *before* submit, not after.
- Category select defaults to the most-recently-used category (localStorage), not the first alphabetical.

### 5.2 Drag-and-drop reorder (keep buttons as fallback)

- Native HTML5 drag-and-drop (no library): cards draggable within and across category grids; categories draggable by their header grip. Drop = optimistic reorder + single API call with the new ordered id list (extend the existing `/reorder` endpoints to accept a full ordering array, not just up/down — one request instead of N).
- Keep the up/down buttons (now reload-free) — they're the keyboard/mobile accessibility fallback, which is exactly what Booky lacks.
- Visual affordances: `cursor-grab`, 50%-opacity drag ghost, 2px accent drop-indicator line.

### 5.3 Accessibility & quality gate (run before calling it done)

- Contrast: every token pair ≥ 4.5:1 for body text, 3:1 for large text/UI borders — verify in both themes (the current `#7b887e` placeholder on white is borderline; fix via tokens).
- Full keyboard pass: every action reachable without a mouse; visible focus everywhere; dialogs trap and restore focus; toolbar buttons have `aria-label`s (currently `title`-only — add `aria-label`).
- `prefers-reduced-motion`: disable the card lift, highlight pulses, and smooth scrolling.
- Lighthouse on `/dashboard` with ~1,000 seeded bookmarks: Performance ≥ 90, A11y ≥ 95. If initial HTML payload becomes the bottleneck at 5,000 bookmarks, *then* consider rendering collapsed categories' cards lazily (`<template>` + expand-time hydration) — don't pre-optimize.
- Verify `h-13` and any other nonstandard utilities actually emit CSS under Tailwind v4.

---

## Suggested execution order & commit slicing

Work top-to-bottom; each numbered item is a deployable commit (`npm run deploy` after each — remember git push alone does not deploy):

1. Phase 1.1 tokens sweep (pure refactor, no visual change intended) → 1.3 typography → 1.2 dark mode.
2. Phase 2.1 reload-free mutations + 2.3 toasts/undo + 2.2 dialogs (one commit per mutation group is fine).
3. Phase 3.1 shortcuts → 3.3 search upgrades → 3.2 palette.
4. Phase 4.1 sidebar retirement + 4.2 rail → 4.3 density toggle → 4.4 favourites → 4.5 card refinements.
5. Phase 5.1 URL-first add flow → 5.2 drag-drop → 5.3 audit.

After Phases 1–3 the app should already feel dramatically faster than Booky; Phases 4–5 are where it pulls visibly ahead on design.

## Definition of "10x better than Booky"

- Open any bookmark from anywhere in under 2 seconds using only the keyboard.
- Zero full-page reloads during normal use; every action gives instant visual feedback.
- Destructive actions are undoable, not just confirmable.
- Scales visually to 5,000 bookmarks via compact density + category rail + collapse.
- Looks intentional: one accent color, consistent tokens, real typography, first-class dark mode.
- Fully keyboard-accessible and WCAG AA — which Booky is not.

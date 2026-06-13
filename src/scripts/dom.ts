import { isSearching } from "./state";

export type CardData = {
  id: string;
  title: string;
  url: string;
  categoryId: string;
  description: string;
  isFavourite: boolean;
};

export function $<T extends HTMLElement>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}

export function $$<T extends HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] ?? url;
  }
}

export function faviconUrlForDomain(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

// ---- lookups --------------------------------------------------------------

export function sectionFor(categoryId: string): HTMLElement | null {
  return $(`[data-category-section][data-category-id="${CSS.escape(categoryId)}"]`);
}

export function gridFor(section: HTMLElement): HTMLElement | null {
  return $("[data-category-grid]", section);
}

export function allSections(): HTMLElement[] {
  return $$("[data-category-section]");
}

export function allCollections(): HTMLElement[] {
  return $$("[data-collection]");
}

/** Split a "Collection / Category" name on the first " / ". */
export function splitCollection(name: string): { collection: string | null; short: string } {
  const idx = name.indexOf(" / ");
  if (idx === -1) return { collection: null, short: name };
  return { collection: name.slice(0, idx), short: name.slice(idx + 3) };
}

/** Every copy of a bookmark card (main + the Favourites mirror). */
export function cardsById(id: string): HTMLElement[] {
  return $$(`[data-bookmark-card][data-id="${CSS.escape(id)}"]`);
}

/** The card copy that lives in its real category section. */
export function mainCardById(id: string): HTMLElement | null {
  return cardsById(id).find((card) => !card.closest("[data-favourites]")) ?? null;
}

export function cardData(card: HTMLElement): CardData {
  return {
    id: card.dataset.id ?? "",
    title: card.dataset.title ?? "",
    url: card.dataset.url ?? "",
    categoryId: card.dataset.categoryId ?? "",
    description: card.dataset.description ?? "",
    isFavourite: card.dataset.favourite === "1",
  };
}

export function categoryNameFor(categoryId: string): string {
  return sectionFor(categoryId)?.dataset.categoryName ?? "";
}

// ---- card rendering -------------------------------------------------------

function buildSearchText(data: CardData, categoryName: string): string {
  const domain = domainFromUrl(data.url);
  return [data.title, data.url, data.description, domain, categoryName].join(" ").toLowerCase();
}

/** Patch every visible/derived field of a card node from data. */
export function patchCard(card: HTMLElement, data: CardData, categoryName: string): void {
  const domain = domainFromUrl(data.url);

  card.dataset.id = data.id;
  card.dataset.title = data.title;
  card.dataset.url = data.url;
  card.dataset.categoryId = data.categoryId;
  card.dataset.description = data.description;
  card.dataset.favourite = data.isFavourite ? "1" : "0";
  card.dataset.search = buildSearchText(data, categoryName);

  const link = $("a[data-card-link]", card) as HTMLAnchorElement | null;
  if (link) {
    link.href = data.url;
    link.setAttribute("aria-label", `Open ${data.title}`);
  }

  const title = $("[data-card-title]", card);
  if (title) {
    title.textContent = data.title;
    title.setAttribute("title", data.title);
  }

  const domainEl = $("[data-card-domain]", card);
  if (domainEl) domainEl.textContent = domain;

  const desc = $("[data-card-desc]", card);
  if (desc) {
    desc.textContent = data.description;
    desc.classList.toggle("hidden", !data.description);
  }

  const star = $("[data-card-star]", card);
  star?.classList.toggle("hidden", !data.isFavourite);

  const favButton = $("[data-favourite-toggle]", card);
  favButton?.setAttribute("aria-pressed", data.isFavourite ? "true" : "false");

  const img = $("[data-card-favicon]", card) as HTMLImageElement | null;
  const fallback = $("[data-card-fallback]", card);
  const initial = data.title.trim().charAt(0).toUpperCase() || domain.charAt(0).toUpperCase();
  if (fallback) fallback.textContent = initial;
  if (img && domain) {
    img.classList.remove("hidden");
    fallback?.classList.add("hidden");
    img.src = faviconUrlForDomain(domain);
  } else {
    img?.classList.add("hidden");
    fallback?.classList.remove("hidden");
  }
}

/** Render a fresh card node from the server-rendered template. */
export function renderCard(data: CardData, categoryName: string): HTMLElement {
  const template = document.getElementById("bookmark-card-template") as HTMLTemplateElement;
  const card = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
  patchCard(card, data, categoryName);
  return card;
}

export function flashCard(card: HTMLElement): void {
  card.classList.add("card-flash");
  window.setTimeout(() => card.classList.remove("card-flash"), 700);
}

// ---- counts & empty states ------------------------------------------------

/** Refresh one section's count line, grid/empty visibility. */
export function refreshSection(section: HTMLElement): void {
  const grid = gridFor(section);
  if (!grid) return;
  const total = grid.children.length;
  const count = $("[data-category-count]", section);
  if (count) {
    count.dataset.total = String(total);
    if (isSearching()) {
      const visible = $$("[data-bookmark-card]", grid).filter(
        (card) => !card.classList.contains("hidden"),
      ).length;
      count.textContent = `${visible} of ${total} ${total === 1 ? "bookmark" : "bookmarks"}`;
    } else {
      count.textContent = `${total} ${total === 1 ? "bookmark" : "bookmarks"}`;
    }
  }
  const empty = $("[data-category-empty]", section);
  grid.classList.toggle("hidden", total === 0);
  empty?.classList.toggle("hidden", total > 0);

  // The Uncategorised fallback bucket hides itself entirely while empty.
  if (section.hasAttribute("data-hide-when-empty")) {
    section.classList.toggle("hidden", total === 0);
  }
}

/** Refresh the favourites strip visibility (hidden when empty or searching). */
export function refreshFavourites(): void {
  const section = $("[data-favourites]");
  if (!section) return;
  const grid = gridFor(section);
  const total = grid?.children.length ?? 0;
  section.classList.toggle("hidden", total === 0 || isSearching());
  const count = $("[data-favourites-count]", section);
  if (count) count.textContent = `${total} ${total === 1 ? "bookmark" : "bookmarks"}`;
}

/** Refresh the header totals line. */
export function refreshTotals(): void {
  const mainCards = allSections().flatMap((section) => {
    const grid = gridFor(section);
    return grid ? $$("[data-bookmark-card]", grid) : [];
  });
  const visible = mainCards.filter((card) => !card.classList.contains("hidden")).length;

  const visibleCount = $("[data-visible-count]");
  if (visibleCount) visibleCount.textContent = String(visible);
  const totalCount = $("[data-total-count]");
  if (totalCount) totalCount.textContent = String(mainCards.length);
  const categoryTotal = $("[data-category-total]");
  if (categoryTotal) {
    // Exclude the empty hide-when-empty bucket (Uncategorised) regardless of
    // search state, so the count reflects the user's real categories.
    const real = allSections().filter(
      (section) =>
        !(
          section.hasAttribute("data-hide-when-empty") &&
          (gridFor(section)?.children.length ?? 0) === 0
        ),
    );
    categoryTotal.textContent = String(real.length);
  }
}

/**
 * Hide a collection whose categories are all hidden (during search), and keep
 * its count badge in sync. Returns nothing; safe to call any time.
 */
export function refreshCollections(): void {
  for (const collection of allCollections()) {
    const sections = $$("[data-category-section]", collection);
    const visibleSections = sections.filter((s) => !s.classList.contains("hidden"));
    collection.classList.toggle("hidden", sections.length > 0 && visibleSections.length === 0);

    const badge = $("[data-collection-count]", collection);
    if (badge) {
      const cats = visibleSections.length;
      let total = 0;
      for (const section of visibleSections) {
        const grid = gridFor(section);
        if (grid) {
          total += $$("[data-bookmark-card]", grid).filter(
            (c) => !c.classList.contains("hidden"),
          ).length;
        }
      }
      badge.textContent = `${cats} ${cats === 1 ? "category" : "categories"} · ${total}`;
    }
  }
}

export function refreshAllCounts(): void {
  for (const section of allSections()) refreshSection(section);
  refreshCollections();
  refreshFavourites();
  refreshTotals();
}

// ---- favicon fallback (delegated; error events don't bubble) ---------------

export function initFaviconFallback(): void {
  document.addEventListener(
    "error",
    (event) => {
      const img = event.target as HTMLElement;
      if (!(img instanceof HTMLImageElement) || !img.matches("[data-card-favicon]")) return;
      img.classList.add("hidden");
      img.parentElement?.querySelector("[data-card-fallback]")?.classList.remove("hidden");
    },
    true,
  );
}

// ---- events ----------------------------------------------------------------

/** Notify other modules (rail, shortcuts, palette) that the DOM changed. */
export function announceDomChange(): void {
  document.dispatchEvent(new CustomEvent("linkshelf:domchange"));
}

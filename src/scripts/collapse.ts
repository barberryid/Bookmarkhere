import { $, allCollections, allSections } from "./dom";
import { isSearching } from "./state";

const COLLAPSE_KEY = "linkshelf-collapsed-categories";
const COLLECTION_COLLAPSE_KEY = "linkshelf-collapsed-collections";

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const rawCollapsed = readStored(COLLAPSE_KEY);
let collapsedIds = new Set<string>();
try {
  collapsedIds = new Set(JSON.parse(rawCollapsed ?? "[]"));
} catch {
  // ignore corrupted storage
}
// Whether the user already has saved collapse state. When absent, the board
// seeds every category/collection as collapsed so it loads dense (compact
// tiles) rather than as full-width expanded panels.
const hadCollapseState = rawCollapsed !== null;

function persist(): void {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsedIds]));
  } catch {
    // storage unavailable
  }
}

export function isCollapsed(section: HTMLElement): boolean {
  return collapsedIds.has(section.dataset.categoryId ?? "");
}

/** While searching, matching sections always show their bookmarks. */
export function applyCollapsed(section: HTMLElement): void {
  const collapsed = !isSearching() && isCollapsed(section);
  // The board grid keys off this attribute: collapsed tiles sit in a column,
  // expanded ones break out to a full-width panel.
  section.toggleAttribute("data-collapsed", collapsed);
  $("[data-category-body]", section)?.classList.toggle("hidden", collapsed);
  const toggle = $("[data-collapse-category]", section);
  toggle?.setAttribute("aria-expanded", String(!collapsed));
  toggle?.querySelector("svg")?.classList.toggle("-rotate-90", collapsed);
}

export function toggleCollapsed(section: HTMLElement): void {
  const id = section.dataset.categoryId ?? "";
  if (collapsedIds.has(id)) {
    collapsedIds.delete(id);
  } else {
    collapsedIds.add(id);
  }
  persist();
  applyCollapsed(section);
}

export function expandSection(section: HTMLElement): void {
  collapsedIds.delete(section.dataset.categoryId ?? "");
  persist();
  // A category inside a collapsed collection would stay hidden, so open its
  // parent collection too (keeps the rail/palette "jump to category" working).
  const collection = section.closest<HTMLElement>("[data-collection]");
  if (collection) {
    const name = collection.dataset.collectionName ?? "";
    if (collapsedCollections.has(name)) {
      collapsedCollections.delete(name);
      persistCollections();
      applyCollectionCollapsed(collection);
      document.dispatchEvent(
        new CustomEvent("linkshelf:collectioncollapse", { detail: { name } }),
      );
    }
  }
  applyCollapsed(section);
}

/**
 * First-run default: collapse every category and collection so the board loads
 * as a dense grid of compact tiles. Only seeds when the user has no saved
 * collapse state yet, so it never overrides an existing preference.
 */
export function seedCollapsedDefaults(): void {
  if (!hadCollapseState) {
    for (const section of allSections()) {
      if (section.closest("[data-favourites]")) continue;
      collapsedIds.add(section.dataset.categoryId ?? "");
    }
    persist();
  }
  if (!hadCollectionState) {
    for (const collection of allCollections()) {
      collapsedCollections.add(collection.dataset.collectionName ?? "");
    }
    persistCollections();
  }
}

export function applyAllCollapsed(): void {
  for (const section of allSections()) applyCollapsed(section);
  for (const collection of allCollections()) applyCollectionCollapsed(collection);
}

/** Collapse every collection (level 1) and every category (level 2) at once. */
export function collapseAll(): void {
  for (const section of allSections()) {
    if (section.closest("[data-favourites]")) continue;
    collapsedIds.add(section.dataset.categoryId ?? "");
  }
  for (const collection of allCollections()) {
    collapsedCollections.add(collection.dataset.collectionName ?? "");
  }
  persist();
  persistCollections();
  applyAllCollapsed();
  // Keep the rail's fold carets in sync with the bulk change.
  document.dispatchEvent(new CustomEvent("linkshelf:collectioncollapse", { detail: { name: "" } }));
}

/**
 * Expand every collection (level 1) so all category rows are revealed. Leaves
 * the categories (level 2) collapsed so we don't render thousands of cards.
 */
export function expandAllCollections(): void {
  collapsedCollections.clear();
  persistCollections();
  applyAllCollapsed();
  document.dispatchEvent(new CustomEvent("linkshelf:collectioncollapse", { detail: { name: "" } }));
}

// ---- collection-level collapse --------------------------------------------

const rawCollapsedCollections = readStored(COLLECTION_COLLAPSE_KEY);
let collapsedCollections = new Set<string>();
try {
  collapsedCollections = new Set(JSON.parse(rawCollapsedCollections ?? "[]"));
} catch {
  // ignore corrupted storage
}
const hadCollectionState = rawCollapsedCollections !== null;

function persistCollections(): void {
  try {
    localStorage.setItem(COLLECTION_COLLAPSE_KEY, JSON.stringify([...collapsedCollections]));
  } catch {
    // storage unavailable
  }
}

/** Is a collection (by name) collapsed, ignoring the search override? */
export function isCollectionCollapsed(name: string): boolean {
  return collapsedCollections.has(name);
}

export function applyCollectionCollapsed(collection: HTMLElement): void {
  const name = collection.dataset.collectionName ?? "";
  // Searching always reveals matching collections.
  const collapsed = !isSearching() && collapsedCollections.has(name);
  collection.toggleAttribute("data-collapsed", collapsed);
  $("[data-collection-body]", collection)?.classList.toggle("hidden", collapsed);
  const toggle = $("[data-collapse-collection]", collection);
  toggle?.setAttribute("aria-expanded", String(!collapsed));
  toggle?.querySelector("svg")?.classList.toggle("-rotate-90", collapsed);
}

/**
 * Toggle a collection's collapsed state (by name) and re-apply it to the main
 * view. The rail listens for "linkshelf:collectioncollapse" to stay in sync,
 * so collapsing from either place folds both.
 */
export function toggleCollectionCollapsed(collection: HTMLElement): void {
  const name = collection.dataset.collectionName ?? "";
  if (collapsedCollections.has(name)) {
    collapsedCollections.delete(name);
  } else {
    collapsedCollections.add(name);
  }
  persistCollections();
  applyCollectionCollapsed(collection);
  document.dispatchEvent(
    new CustomEvent("linkshelf:collectioncollapse", { detail: { name } }),
  );
}

/** Toggle by collection name (used by the rail, which has no main element). */
export function toggleCollectionCollapsedByName(name: string): void {
  const collection = $(`[data-collection][data-collection-name="${CSS.escape(name)}"]`);
  if (collection) {
    toggleCollectionCollapsed(collection);
    return;
  }
  // No matching main element — toggle state directly and notify.
  if (collapsedCollections.has(name)) collapsedCollections.delete(name);
  else collapsedCollections.add(name);
  persistCollections();
  document.dispatchEvent(
    new CustomEvent("linkshelf:collectioncollapse", { detail: { name } }),
  );
}

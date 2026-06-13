import { $, allSections } from "./dom";
import { isSearching } from "./state";

const COLLAPSE_KEY = "linkshelf-collapsed-categories";

let collapsedIds = new Set<string>();
try {
  collapsedIds = new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? "[]"));
} catch {
  // ignore corrupted storage
}

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
  applyCollapsed(section);
}

export function applyAllCollapsed(): void {
  for (const section of allSections()) applyCollapsed(section);
}

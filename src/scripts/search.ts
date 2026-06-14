import { applyCollapsed, applyCollectionCollapsed } from "./collapse";
import {
  $,
  $$,
  allCollections,
  allSections,
  gridFor,
  refreshCollections,
  refreshFavourites,
  refreshMostUsed,
  refreshSection,
  refreshTotals,
} from "./dom";
import { state } from "./state";

const DEBOUNCE_MS = 80;

// ---- highlighting ----------------------------------------------------------

function clearHighlight(el: HTMLElement): void {
  if (el.querySelector("mark")) {
    el.textContent = el.textContent ?? "";
  }
}

/** Wrap every token occurrence in <mark>, building nodes (never innerHTML). */
function highlightElement(el: HTMLElement, tokens: string[]): void {
  clearHighlight(el);
  const text = el.textContent ?? "";
  const lower = text.toLowerCase();

  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    if (!token) continue;
    let from = 0;
    while (true) {
      const index = lower.indexOf(token, from);
      if (index === -1) break;
      ranges.push([index, index + token.length]);
      from = index + token.length;
    }
  }
  if (!ranges.length) return;

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push([...range]);
    }
  }

  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) fragment.append(document.createTextNode(text.slice(cursor, start)));
    const mark = document.createElement("mark");
    mark.className = "search-hit";
    mark.textContent = text.slice(start, end);
    fragment.append(mark);
    cursor = end;
  }
  if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
  el.replaceChildren(fragment);
}

function highlightCard(card: HTMLElement, tokens: string[]): void {
  for (const selector of ["[data-card-title]", "[data-card-domain]"]) {
    const el = $(selector, card);
    if (!el) continue;
    if (tokens.length) {
      highlightElement(el, tokens);
    } else {
      clearHighlight(el);
    }
  }
}

// ---- filtering ---------------------------------------------------------------

/** Multi-token AND match: every token must appear somewhere in the search string. */
function cardMatches(card: HTMLElement, tokens: string[]): boolean {
  const haystack = card.dataset.search ?? "";
  return tokens.every((token) => haystack.includes(token));
}

export function applySearch(rawValue: string): void {
  state.query = rawValue;
  const query = rawValue.trim().toLowerCase();
  const tokens = query ? query.split(/\s+/) : [];
  let visibleBookmarks = 0;

  for (const section of allSections()) {
    const grid = gridFor(section);
    if (!grid) continue;
    let sectionMatches = 0;

    for (const card of $$("[data-bookmark-card]", grid)) {
      const matches = !tokens.length || cardMatches(card, tokens);
      card.classList.toggle("hidden", !matches);
      highlightCard(card, matches ? tokens : []);
      if (matches) sectionMatches += 1;
    }

    visibleBookmarks += sectionMatches;
    section.classList.toggle("hidden", Boolean(query) && sectionMatches === 0);
    refreshSection(section);
    applyCollapsed(section);
  }

  // Reveal collapsed collections while searching, then hide empty ones.
  for (const collection of allCollections()) applyCollectionCollapsed(collection);
  refreshCollections();

  // The Favourites + Most Used strips duplicate cards, so they sit out of
  // search entirely.
  refreshFavourites();
  refreshMostUsed();
  refreshTotals();

  const noResults = $("[data-search-empty]");
  noResults?.classList.toggle("hidden", !query || visibleBookmarks > 0);
  const queryEcho = $("[data-search-query]");
  if (queryEcho) queryEcho.textContent = rawValue.trim();

  const clearButton = $("[data-search-clear]");
  clearButton?.classList.toggle("hidden", !rawValue);

  document.dispatchEvent(new CustomEvent("linkshelf:searchapplied"));
}

function syncUrl(value: string): void {
  const nextUrl = new URL(window.location.href);
  if (value.trim()) {
    nextUrl.searchParams.set("search", value.trim());
  } else {
    nextUrl.searchParams.delete("search");
  }
  window.history.replaceState({}, "", nextUrl);
}

export function searchInput(): HTMLInputElement | null {
  return document.getElementById("bookmark-search") as HTMLInputElement | null;
}

export function clearSearch(refocus = true): void {
  const input = searchInput();
  if (!input) return;
  input.value = "";
  syncUrl("");
  applySearch("");
  if (refocus) input.focus();
}

export function initSearch(): void {
  const input = searchInput();
  if (!input) return;

  const initialQuery = new URLSearchParams(window.location.search).get("search") ?? "";
  input.value = initialQuery;
  applySearch(initialQuery);

  let debounce = 0;
  input.addEventListener("input", () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      syncUrl(input.value);
      applySearch(input.value);
    }, DEBOUNCE_MS);
  });

  // Enter is handled by shortcuts.ts (opens the selected result).
  input.form?.addEventListener("submit", (event) => event.preventDefault());

  // Both the search-bar clear (×) and the empty-state "Clear search" button.
  for (const button of $$("[data-search-clear]")) {
    button.addEventListener("click", () => clearSearch());
  }
}

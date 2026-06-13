import { $, $$, allSections, gridFor, splitCollection } from "./dom";
import { expandSection, isCollectionCollapsed, toggleCollectionCollapsedByName } from "./collapse";
import { collectionStyle } from "../lib/collections";

let observer: IntersectionObserver | null = null;

function railEl(): HTMLElement | null {
  return $("[data-category-rail]");
}

function sectionCount(section: HTMLElement): number {
  return gridFor(section)?.children.length ?? 0;
}

/**
 * Hide the category links under collapsed collections and rotate their carets.
 * Reads the shared collapse state (by collection name) so the rail and the
 * main view stay folded together.
 */
function applyCollapsed(): void {
  const rail = railEl();
  if (!rail) return;
  for (const link of $$("[data-rail-parent]", rail)) {
    link.classList.toggle("rail-hidden", isCollectionCollapsed(link.dataset.railParent ?? ""));
  }
  for (const header of $$("[data-rail-collection]", rail)) {
    header.classList.toggle("rail-collapsed", isCollectionCollapsed(header.dataset.railCollection ?? ""));
  }
}

/** Rebuild the rail links from the current collections + sections. */
function build(): void {
  const rail = railEl();
  if (!rail) return;
  const list = $("[data-rail-list]", rail);
  if (!list) return;

  list.replaceChildren();

  // Favourites pseudo-entry first.
  const favourites = $("[data-favourites]");
  if (favourites && !favourites.classList.contains("hidden")) {
    const grid = gridFor(favourites);
    list.append(
      categoryLink("favourites-section", "★ Favourites", grid?.children.length ?? 0, false, () => {
        favourites.scrollIntoView({ behavior: "smooth", block: "start" });
      }),
    );
  }

  const container = $("[data-sections-container]");
  if (!container) return;

  for (const node of Array.from(container.children) as HTMLElement[]) {
    if (node.matches("[data-collection]")) {
      const name = node.dataset.collectionName ?? "";
      const sections = $$("[data-category-section]", node);
      const total = sections.reduce((n, s) => n + sectionCount(s), 0);
      list.append(collectionHeader(name, total));
      for (const section of sections) {
        if (section.classList.contains("hidden")) continue;
        const full = section.dataset.categoryName ?? "";
        list.append(
          categoryLink(
            `rail-${section.dataset.categoryId}`,
            splitCollection(full).short,
            sectionCount(section),
            true,
            () => {
              expandSection(section);
              section.scrollIntoView({ behavior: "smooth", block: "start" });
            },
            name,
          ),
        );
      }
    } else if (node.matches("[data-category-section]")) {
      // Ungrouped category — skip the empty Uncategorised bucket.
      if (node.classList.contains("hidden")) continue;
      const full = node.dataset.categoryName ?? "";
      list.append(
        categoryLink(`rail-${node.dataset.categoryId}`, full, sectionCount(node), false, () => {
          expandSection(node);
          node.scrollIntoView({ behavior: "smooth", block: "start" });
        }),
      );
    }
  }

  applyCollapsed();
  observe();
}

/**
 * Collection header in the rail. Clicking it folds the collection in BOTH the
 * rail and the main view (shared state via toggleCollectionCollapsedByName).
 */
function collectionHeader(name: string, count: number): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.railCollection = name;
  button.className =
    "rail-collection focus-ring mt-2 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint hover:text-ink";

  const caret = document.createElement("span");
  caret.className = "rail-caret";
  caret.setAttribute("aria-hidden", "true");
  caret.textContent = "▾";

  const dot = document.createElement("span");
  dot.className = "rail-dot";
  dot.setAttribute("aria-hidden", "true");
  dot.style.background = `var(${collectionStyle(name).colorVar})`;

  const nameEl = document.createElement("span");
  nameEl.className = "rail-name flex-1";
  nameEl.textContent = name;

  const countEl = document.createElement("span");
  countEl.className = "rail-count";
  countEl.textContent = String(count);

  button.append(caret, dot, nameEl, countEl);
  button.addEventListener("click", () => toggleCollectionCollapsedByName(name));
  return button;
}

function categoryLink(
  key: string,
  name: string,
  count: number,
  indented: boolean,
  onClick: () => void,
  parentKey?: string,
): HTMLElement {
  const link = document.createElement("a");
  link.href = "#";
  link.className = indented ? "rail-link rail-link-nested" : "rail-link";
  link.dataset.railKey = key;
  if (parentKey) link.dataset.railParent = parentKey;

  const nameEl = document.createElement("span");
  nameEl.className = "rail-name";
  nameEl.textContent = name;

  const countEl = document.createElement("span");
  countEl.className = "rail-count";
  countEl.textContent = String(count);

  link.append(nameEl, countEl);
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onClick();
  });
  return link;
}

function highlight(categoryId: string): void {
  const rail = railEl();
  if (!rail) return;
  for (const link of $$("[data-rail-key]", rail)) {
    link.setAttribute("aria-current", String(link.dataset.railKey === `rail-${categoryId}`));
  }
}

function observe(): void {
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          highlight((entry.target as HTMLElement).dataset.categoryId ?? "");
        }
      }
    },
    { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
  );
  for (const section of allSections()) {
    if (!section.closest("[data-favourites]")) observer.observe(section);
  }
}

export function initRail(): void {
  build();
  document.addEventListener("linkshelf:domchange", build);
  // Fold the rail when a collection is collapsed from the main view (or rail).
  document.addEventListener("linkshelf:collectioncollapse", applyCollapsed);
}

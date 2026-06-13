import { $, $$, allSections, gridFor, splitCollection } from "./dom";
import { expandSection } from "./collapse";

let observer: IntersectionObserver | null = null;

function railEl(): HTMLElement | null {
  return $("[data-category-rail]");
}

function sectionCount(section: HTMLElement): number {
  return gridFor(section)?.children.length ?? 0;
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

  // Walk top-level children of the sections container in document order so
  // collection groups and any ungrouped sections keep their on-page order.
  const container = $("[data-sections-container]");
  if (!container) return;

  for (const node of Array.from(container.children) as HTMLElement[]) {
    if (node.matches("[data-collection]")) {
      const name = node.dataset.collectionName ?? "";
      const slug = node.id.replace(/^collection-/, "");
      const sections = $$("[data-category-section]", node);
      const total = sections.reduce((n, s) => n + sectionCount(s), 0);
      list.append(
        collectionHeader(`collection-${slug}`, name, total, () => {
          node.scrollIntoView({ behavior: "smooth", block: "start" });
        }),
      );
      for (const section of sections) {
        const full = section.dataset.categoryName ?? "";
        list.append(
          categoryLink(`rail-${section.dataset.categoryId}`, splitCollection(full).short, sectionCount(section), true, () => {
            expandSection(section);
            section.scrollIntoView({ behavior: "smooth", block: "start" });
          }),
        );
      }
    } else if (node.matches("[data-category-section]")) {
      const full = node.dataset.categoryName ?? "";
      list.append(
        categoryLink(`rail-${node.dataset.categoryId}`, full, sectionCount(node), false, () => {
          expandSection(node);
          node.scrollIntoView({ behavior: "smooth", block: "start" });
        }),
      );
    }
  }

  observe();
}

function collectionHeader(key: string, name: string, count: number, onClick: () => void): HTMLElement {
  const link = document.createElement("a");
  link.href = "#";
  link.className =
    "mt-2 flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-faint hover:text-ink";
  link.dataset.railKey = key;

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

function categoryLink(
  key: string,
  name: string,
  count: number,
  indented: boolean,
  onClick: () => void,
): HTMLElement {
  const link = document.createElement("a");
  link.href = "#";
  link.className = indented ? "rail-link rail-link-nested" : "rail-link";
  link.dataset.railKey = key;

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
}

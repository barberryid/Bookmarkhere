import { $, $$, allSections, gridFor } from "./dom";
import { expandSection } from "./collapse";

let observer: IntersectionObserver | null = null;

function railEl(): HTMLElement | null {
  return $("[data-category-rail]");
}

/** Rebuild the rail links from the current sections. */
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
      makeLink("favourites-section", "★ Favourites", grid?.children.length ?? 0, () => {
        favourites.scrollIntoView({ behavior: "smooth", block: "start" });
      }),
    );
  }

  for (const section of allSections()) {
    if (section.closest("[data-favourites]")) continue;
    const id = section.dataset.categoryId ?? "";
    const name = section.dataset.categoryName ?? "";
    const total = gridFor(section)?.children.length ?? 0;
    list.append(
      makeLink(`rail-${id}`, name, total, () => {
        expandSection(section);
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }),
    );
  }

  observe();
}

function makeLink(key: string, name: string, count: number, onClick: () => void): HTMLElement {
  const link = document.createElement("a");
  link.href = "#";
  link.className = "rail-link";
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
          const id = (entry.target as HTMLElement).dataset.categoryId ?? "";
          highlight(id);
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
  // Rebuild when categories/bookmarks change.
  document.addEventListener("linkshelf:domchange", build);
}

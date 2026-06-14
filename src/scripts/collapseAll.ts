import { collapseAll, expandAllCollections } from "./collapse";
import { $, $$, allCollections, allSections } from "./dom";

/** Is any collection (level 1) or category (level 2) currently expanded? */
function anythingExpanded(): boolean {
  for (const collection of allCollections()) {
    if (!collection.hasAttribute("data-collapsed")) return true;
  }
  for (const section of allSections()) {
    if (section.closest("[data-favourites]")) continue;
    if (!section.hasAttribute("data-collapsed")) return true;
  }
  return false;
}

/** Reflect the current board state on the toggle button (label + icon). */
function sync(): void {
  const expanded = anythingExpanded();
  for (const btn of $$("[data-collapse-all]")) {
    btn.setAttribute("aria-pressed", String(!expanded));
    btn.title = expanded ? "Collapse all" : "Expand all";
    btn.setAttribute(
      "aria-label",
      expanded ? "Collapse all categories" : "Expand all collections",
    );
    $(".collapse-all-fold", btn)?.classList.toggle("hidden", !expanded);
    $(".collapse-all-unfold", btn)?.classList.toggle("hidden", expanded);
  }
}

export function initCollapseAll(): void {
  for (const btn of $$("[data-collapse-all]")) {
    btn.addEventListener("click", () => {
      if (anythingExpanded()) {
        collapseAll();
      } else {
        expandAllCollections();
      }
      sync();
    });
  }

  // Individual collapse toggles don't announce a DOM change, so re-sync the
  // button after any disclosure click lands.
  document.addEventListener("click", (event) => {
    const toggle = (event.target as HTMLElement).closest(
      "[data-collapse-collection], [data-collapse-category]",
    );
    if (toggle) queueMicrotask(sync);
  });

  document.addEventListener("linkshelf:domchange", sync);
  document.addEventListener("linkshelf:searchapplied", sync);
  sync();
}

import { applyAllCollapsed, seedCollapsedDefaults } from "./collapse";
import { initDensity } from "./density";
import { initDragDrop } from "./dragdrop";
import { initDrawer } from "./drawer";
import { initFaviconFallback, refreshAllCounts } from "./dom";
import { hydrateCards } from "./hydrate";
import { initMutations } from "./mutations";
import { initPalette } from "./palette";
import { initRail } from "./rail";
import { initSearch } from "./search";
import { initShortcuts } from "./shortcuts";

function init(): void {
  initFaviconFallback();
  // Build cards from the embedded payload before anything reads the DOM.
  hydrateCards();
  initDensity();
  initMutations();
  seedCollapsedDefaults();
  applyAllCollapsed();
  refreshAllCounts();
  initSearch();
  initShortcuts();
  initPalette();
  initRail();
  initDragDrop();
  initDrawer();

  // Cheat-sheet + palette close buttons.
  document.addEventListener("click", (event) => {
    const close = (event.target as HTMLElement).closest("[data-close-overlay]");
    if (close) (close.closest("dialog") as HTMLDialogElement | null)?.close();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

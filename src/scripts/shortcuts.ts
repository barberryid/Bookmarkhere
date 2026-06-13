import { $$, cardData } from "./dom";
import { openBookmarkDialog, focusNewCategoryRow } from "./mutations";
import { openPalette } from "./palette";
import { clearSearch, searchInput } from "./search";

let selectedId: string | null = null;

function visibleMainCards(): HTMLElement[] {
  return $$("[data-bookmark-card]").filter(
    (card) => !card.classList.contains("hidden") && !card.closest("[data-favourites]"),
  );
}

function selectedCard(): HTMLElement | null {
  if (!selectedId) return null;
  return visibleMainCards().find((card) => card.dataset.id === selectedId) ?? null;
}

function paint(): void {
  for (const card of $$("[data-bookmark-card]")) {
    card.toggleAttribute("data-selected", card.dataset.id === selectedId && !card.closest("[data-favourites]"));
  }
}

export function clearSelection(): void {
  selectedId = null;
  paint();
}

function select(card: HTMLElement | null, scroll = true): void {
  selectedId = card?.dataset.id ?? null;
  paint();
  if (card && scroll) card.scrollIntoView({ block: "nearest" });
}

function move(delta: number): void {
  const cards = visibleMainCards();
  if (!cards.length) return;
  const current = selectedCard();
  const index = current ? cards.indexOf(current) : -1;
  const next = cards[Math.min(Math.max(index + delta, 0), cards.length - 1)] ?? cards[0];
  select(next);
}

function openCard(card: HTMLElement, keepFocus: boolean): void {
  window.open(card.dataset.url, "_blank", "noopener,noreferrer");
  if (keepFocus) searchInput()?.focus();
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

function anyDialogOpen(): boolean {
  return $$("dialog").some((dialog) => (dialog as HTMLDialogElement).open);
}

export function initShortcuts(): void {
  // Keep the selection valid as the DOM changes / search filters.
  document.addEventListener("linkshelf:searchapplied", () => {
    if (selectedCard() === null) clearSelection();
  });
  document.addEventListener("linkshelf:domchange", () => {
    if (selectedCard() === null) clearSelection();
  });

  document.addEventListener("keydown", (event) => {
    const input = searchInput();

    // ---- keys that work while typing in the search box ----
    if (event.target === input && input) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const card = selectedCard() ?? visibleMainCards()[0];
        if (card) openCard(card, event.metaKey || event.ctrlKey);
        return;
      }
      if (event.key === "Escape") {
        if (input.value) {
          clearSearch();
        } else {
          input.blur();
        }
        clearSelection();
        return;
      }
    }

    // ---- Ctrl/Cmd+K works everywhere ----
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openPalette();
      return;
    }

    if (event.key === "Escape" && !anyDialogOpen()) {
      clearSelection();
      return;
    }

    // ---- remaining shortcuts ignore typing targets & open dialogs ----
    if (isTypingTarget(event.target) || anyDialogOpen()) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    switch (event.key) {
      case "/":
        event.preventDefault();
        input?.focus();
        input?.select();
        break;
      case "?":
        event.preventDefault();
        openCheatSheet();
        break;
      case "a":
        event.preventDefault();
        openBookmarkDialog("add");
        break;
      case "c":
        event.preventDefault();
        focusNewCategoryRow();
        break;
      case "ArrowDown":
      case "j":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
      case "k":
        event.preventDefault();
        move(-1);
        break;
      case "Enter": {
        const card = selectedCard();
        if (card) {
          event.preventDefault();
          openCard(card, event.metaKey || event.ctrlKey);
        }
        break;
      }
      case "e": {
        const card = selectedCard();
        if (card) {
          event.preventDefault();
          openBookmarkDialog("edit", cardData(card));
        }
        break;
      }
      case "f": {
        const card = selectedCard();
        if (card) {
          event.preventDefault();
          card.querySelector<HTMLElement>("[data-favourite-toggle]")?.click();
        }
        break;
      }
      case "Delete":
      case "Backspace": {
        const card = selectedCard();
        if (card) {
          event.preventDefault();
          card.querySelector<HTMLElement>("[data-delete-bookmark]")?.click();
        }
        break;
      }
    }
  });
}

function openCheatSheet(): void {
  const dialog = document.getElementById("shortcut-cheatsheet") as HTMLDialogElement | null;
  dialog?.showModal();
}

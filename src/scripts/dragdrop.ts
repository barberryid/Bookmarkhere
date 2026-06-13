import { api } from "./api";
import {
  $$,
  allSections,
  announceDomChange,
  cardData,
  gridFor,
  patchCard,
  refreshSection,
} from "./dom";
import { toast } from "./toast";

let draggingCard: HTMLElement | null = null;
let draggingSection: HTMLElement | null = null;

function clearIndicators(): void {
  for (const el of $$(".drop-before, .drop-after")) {
    el.classList.remove("drop-before", "drop-after");
  }
}

function isFavouritesCard(card: HTMLElement): boolean {
  return Boolean(card.closest("[data-favourites]"));
}

// ---- bookmark drag ----------------------------------------------------------

async function persistBookmarkOrder(section: HTMLElement, movedId: string): Promise<void> {
  const grid = gridFor(section);
  if (!grid) return;
  const order = $$("[data-bookmark-card]", grid).map((card) => card.dataset.id ?? "");
  const categoryId = section.dataset.categoryId ?? "";
  const { ok, data } = await api("/api/bookmarks/reorder", "POST", {
    categoryId,
    order,
    movedId,
  });
  if (!ok) {
    toast(data.error ?? "Could not save the new order.", { kind: "error" });
    announceDomChange();
  }
}

// ---- category drag ----------------------------------------------------------

async function persistCategoryOrder(): Promise<void> {
  const order = allSections()
    .filter((section) => !section.closest("[data-favourites]"))
    .map((section) => section.dataset.categoryId ?? "");
  const { ok, data } = await api("/api/categories/reorder", "POST", { order });
  if (!ok) {
    toast(data.error ?? "Could not save the category order.", { kind: "error" });
    announceDomChange();
  }
}

export function initDragDrop(): void {
  document.addEventListener("dragstart", (event) => {
    const target = event.target as HTMLElement;

    const grip = target.closest<HTMLElement>("[data-category-grip]");
    if (grip) {
      draggingSection = grip.closest<HTMLElement>("[data-category-section]");
      draggingSection?.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", draggingSection?.dataset.categoryId ?? "");
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      return;
    }

    const card = target.closest<HTMLElement>("[data-bookmark-card]");
    if (card && !isFavouritesCard(card)) {
      draggingCard = card;
      card.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", card.dataset.id ?? "");
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    } else if (card) {
      // Favourites copies aren't reorderable.
      event.preventDefault();
    }
  });

  document.addEventListener("dragover", (event) => {
    if (draggingCard) {
      const grid = (event.target as HTMLElement).closest<HTMLElement>("[data-category-grid]");
      const overCard = (event.target as HTMLElement).closest<HTMLElement>("[data-bookmark-card]");
      if (!grid || grid.closest("[data-favourites]")) return;
      event.preventDefault();
      clearIndicators();
      if (overCard && overCard !== draggingCard && !isFavouritesCard(overCard)) {
        const after = isAfter(event.clientY, overCard);
        overCard.classList.add(after ? "drop-after" : "drop-before");
      }
      return;
    }

    if (draggingSection) {
      const overSection = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-category-section]",
      );
      if (!overSection || overSection.closest("[data-favourites]") || overSection === draggingSection)
        return;
      event.preventDefault();
      clearIndicators();
      const after = event.clientY > overSection.getBoundingClientRect().top + overSection.offsetHeight / 2;
      overSection.classList.add(after ? "drop-after" : "drop-before");
    }
  });

  document.addEventListener("drop", (event) => {
    if (draggingCard) {
      const overCard = (event.target as HTMLElement).closest<HTMLElement>("[data-bookmark-card]");
      const grid = (event.target as HTMLElement).closest<HTMLElement>("[data-category-grid]");
      if (!grid || grid.closest("[data-favourites]")) return;
      event.preventDefault();

      const sourceSection = draggingCard.closest<HTMLElement>("[data-category-section]");
      const targetSection = grid.closest<HTMLElement>("[data-category-section]");
      const movedId = draggingCard.dataset.id ?? "";

      if (overCard && overCard !== draggingCard) {
        const after = isAfter(event.clientY, overCard);
        grid.insertBefore(draggingCard, after ? overCard.nextElementSibling : overCard);
      } else if (!overCard) {
        grid.append(draggingCard);
      }
      clearIndicators();

      // Moving across categories updates the card's category + search index.
      if (targetSection && targetSection !== sourceSection) {
        const newCategoryId = targetSection.dataset.categoryId ?? "";
        const data = cardData(draggingCard);
        patchCard(draggingCard, { ...data, categoryId: newCategoryId }, targetSection.dataset.categoryName ?? "");
        // Keep favourites mirror in sync.
        const mirror = $$(`[data-favourites] [data-bookmark-card][data-id="${CSS.escape(movedId)}"]`)[0];
        if (mirror) patchCard(mirror, { ...data, categoryId: newCategoryId }, targetSection.dataset.categoryName ?? "");
        void api(`/api/bookmarks/${movedId}`, "PUT", {
          title: data.title,
          url: data.url,
          categoryId: newCategoryId,
          description: data.description || undefined,
          isFavourite: data.isFavourite,
        }).then(({ ok, data: res }) => {
          if (!ok) toast(res.error ?? "Could not move the bookmark.", { kind: "error" });
          if (sourceSection) refreshSection(sourceSection);
          void persistBookmarkOrder(targetSection, movedId);
        });
      } else if (targetSection) {
        void persistBookmarkOrder(targetSection, movedId);
      }

      if (sourceSection) refreshSection(sourceSection);
      if (targetSection) refreshSection(targetSection);
      announceDomChange();
      return;
    }

    if (draggingSection) {
      const overSection = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-category-section]",
      );
      if (!overSection || overSection.closest("[data-favourites]") || overSection === draggingSection)
        return;
      event.preventDefault();
      const after = event.clientY > overSection.getBoundingClientRect().top + overSection.offsetHeight / 2;
      overSection.parentElement?.insertBefore(
        draggingSection,
        after ? overSection.nextElementSibling : overSection,
      );
      clearIndicators();
      announceDomChange();
      void persistCategoryOrder();
    }
  });

  document.addEventListener("dragend", () => {
    draggingCard?.classList.remove("dragging");
    draggingSection?.classList.remove("dragging");
    draggingCard = null;
    draggingSection = null;
    clearIndicators();
  });
}

function isAfter(y: number, card: HTMLElement): boolean {
  const rect = card.getBoundingClientRect();
  return y > rect.top + rect.height / 2;
}

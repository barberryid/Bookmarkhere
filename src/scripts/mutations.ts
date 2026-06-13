import { api } from "./api";
import { toggleCollapsed, toggleCollectionCollapsed } from "./collapse";
import { confirmDanger } from "./confirm";
import {
  $,
  $$,
  allSections,
  announceDomChange,
  cardData,
  cardsById,
  flashCard,
  gridFor,
  mainCardById,
  patchCard,
  refreshAllCounts,
  refreshFavourites,
  refreshSection,
  refreshTotals,
  renderCard,
  sectionFor,
  splitCollection,
  type CardData,
} from "./dom";
import { applySearch } from "./search";
import { state } from "./state";
import { toast } from "./toast";

const MRU_CATEGORY_KEY = "linkshelf-last-category";

type Bookmark = {
  id: string;
  title: string;
  url: string;
  categoryId: string;
  description?: string;
  isFavourite: boolean;
};

function uncategorisedId(): string {
  return document.querySelector<HTMLElement>("main")?.dataset.uncategorisedId ?? "";
}

/** Re-run the active search so a changed/added card gets filtered correctly. */
function reapplySearch(): void {
  if (state.query.trim()) applySearch(state.query);
}

// ---- favourites strip sync --------------------------------------------------

function favouritesGrid(): HTMLElement | null {
  const section = $("[data-favourites]");
  return section ? gridFor(section) : null;
}

function addFavouriteCopy(data: CardData): void {
  const grid = favouritesGrid();
  if (!grid || $(`[data-bookmark-card][data-id="${CSS.escape(data.id)}"]`, grid)) return;
  grid.append(renderCard(data, categoryName(data.categoryId)));
  refreshFavourites();
}

function removeFavouriteCopy(id: string): void {
  const grid = favouritesGrid();
  $(`[data-bookmark-card][data-id="${CSS.escape(id)}"]`, grid ?? undefined!)?.remove();
  refreshFavourites();
}

function categoryName(categoryId: string): string {
  return sectionFor(categoryId)?.dataset.categoryName ?? "";
}

// ---- bookmark dialog ----------------------------------------------------------

function bookmarkDialog(): HTMLDialogElement | null {
  return document.getElementById("bookmark-dialog") as HTMLDialogElement | null;
}

function dialogForm(): HTMLFormElement | null {
  return document.getElementById("bookmark-dialog-form") as HTMLFormElement | null;
}

function field<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
  name: string,
): T | null {
  const form = dialogForm();
  return form ? form.querySelector<T>(`[name="${name}"]`) : null;
}

function showFormError(message: string): void {
  const region = dialogForm()?.querySelector("[data-form-error]");
  if (!region) return;
  region.textContent = message;
  region.classList.remove("hidden");
}

function hideFormError(): void {
  dialogForm()?.querySelector("[data-form-error]")?.classList.add("hidden");
}

function hideDuplicateWarning(): void {
  dialogForm()?.querySelector("[data-duplicate-warning]")?.classList.add("hidden");
}

export function openBookmarkDialog(
  mode: "add" | "edit",
  prefill: Partial<CardData> = {},
): void {
  const dialog = bookmarkDialog();
  const form = dialogForm();
  if (!dialog || !form) return;

  form.reset();
  hideFormError();
  hideDuplicateWarning();
  form.dataset.mode = mode;

  const title = $("[data-dialog-title]", dialog);
  if (title) title.textContent = mode === "add" ? "Add Bookmark" : "Edit Bookmark";
  const submitLabel = $("[data-dialog-submit-label]", dialog);
  if (submitLabel) submitLabel.textContent = mode === "add" ? "Add" : "Save";

  field<HTMLInputElement>("id")!.value = prefill.id ?? "";
  field<HTMLInputElement>("url")!.value = prefill.url ?? "";
  field<HTMLInputElement>("title")!.value = prefill.title ?? "";
  field<HTMLTextAreaElement>("description")!.value = prefill.description ?? "";
  field<HTMLInputElement>("is_favourite")!.checked = prefill.isFavourite ?? false;

  const select = field<HTMLSelectElement>("category_id")!;
  let categoryId = prefill.categoryId;
  if (!categoryId && mode === "add") {
    try {
      categoryId = localStorage.getItem(MRU_CATEGORY_KEY) ?? undefined;
    } catch {
      // storage unavailable
    }
  }
  if (categoryId && select.querySelector(`option[value="${CSS.escape(categoryId)}"]`)) {
    select.value = categoryId;
  }

  dialog.showModal();
  field<HTMLInputElement>(mode === "add" && !prefill.url ? "url" : "title")?.focus();
}

/** Fetch the page <title> for autofill. Fails silently to manual entry. */
async function autofillTitle(): Promise<void> {
  const form = dialogForm();
  const urlInput = field<HTMLInputElement>("url");
  const titleInput = field<HTMLInputElement>("title");
  const spinner = form?.querySelector("[data-title-spinner]");
  if (!form || !urlInput || !titleInput) return;
  if (titleInput.value.trim() || !urlInput.value.trim()) return;

  const requestedUrl = urlInput.value.trim();
  spinner?.classList.remove("hidden");
  const { ok, data } = await api<{ title?: string | null }>(
    `/api/meta?url=${encodeURIComponent(requestedUrl)}`,
  );
  spinner?.classList.add("hidden");
  // Never overwrite anything the user typed in the meantime.
  if (ok && data.title && !titleInput.value.trim() && urlInput.value.trim() === requestedUrl) {
    titleInput.value = data.title;
  }
}

/** Inline duplicate warning before submit, with a "Go to it" link. */
async function checkDuplicate(): Promise<void> {
  const form = dialogForm();
  const urlInput = field<HTMLInputElement>("url");
  if (!form || !urlInput || !urlInput.value.trim()) return;

  const warning = form.querySelector("[data-duplicate-warning]");
  const text = form.querySelector("[data-duplicate-text]");
  const link = form.querySelector<HTMLAnchorElement>("[data-duplicate-link]");
  if (!warning || !text || !link) return;

  const exclude = field<HTMLInputElement>("id")?.value ?? "";
  const { ok, data } = await api<{
    duplicate: boolean;
    bookmark?: { id: string; title: string; categoryId: string };
    categoryName?: string;
  }>(
    `/api/bookmarks/check?url=${encodeURIComponent(urlInput.value.trim())}&exclude=${encodeURIComponent(exclude)}`,
  );

  if (ok && data.duplicate && data.bookmark) {
    text.textContent = `Already saved as "${data.bookmark.title}"${data.categoryName ? ` in ${data.categoryName}` : ""}. `;
    link.dataset.bookmarkId = data.bookmark.id;
    warning.classList.remove("hidden");
  } else {
    warning.classList.add("hidden");
  }
}

function goToBookmark(id: string): void {
  bookmarkDialog()?.close();
  const card = mainCardById(id);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  flashCard(card);
}

async function submitBookmarkDialog(): Promise<void> {
  const form = dialogForm();
  const dialog = bookmarkDialog();
  if (!form || !dialog) return;
  hideFormError();

  const fields = new FormData(form);
  const payload = {
    title: String(fields.get("title") ?? ""),
    url: String(fields.get("url") ?? ""),
    categoryId: String(fields.get("category_id") ?? ""),
    description: String(fields.get("description") ?? "") || undefined,
    isFavourite: fields.get("is_favourite") === "on",
  };

  if (form.dataset.mode === "add") {
    const { ok, data } = await api<{ bookmark?: Bookmark }>("/api/bookmarks", "POST", payload);
    if (!ok || !data.bookmark) {
      showFormError(data.error ?? "Could not save the bookmark.");
      return;
    }
    const bookmark = data.bookmark;
    const cardInfo: CardData = {
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      categoryId: bookmark.categoryId,
      description: bookmark.description ?? "",
      isFavourite: bookmark.isFavourite,
    };
    const section = sectionFor(bookmark.categoryId);
    const grid = section ? gridFor(section) : null;
    if (!section || !grid) {
      // Section missing from the DOM (shouldn't happen) — fall back to reload.
      window.location.reload();
      return;
    }
    const card = renderCard(cardInfo, section.dataset.categoryName ?? "");
    grid.append(card);
    if (cardInfo.isFavourite) addFavouriteCopy(cardInfo);
    refreshSection(section);
    refreshTotals();
    reapplySearch();
    announceDomChange();
    try {
      localStorage.setItem(MRU_CATEGORY_KEY, bookmark.categoryId);
    } catch {
      // storage unavailable
    }
    dialog.close();
    flashCard(card);
    toast(`Added "${bookmark.title}".`, { kind: "success" });
    return;
  }

  // Edit mode — pessimistic-but-fast: await the response, then patch in place.
  const id = String(fields.get("id") ?? "");
  const { ok, data } = await api<{ bookmark?: Bookmark }>(`/api/bookmarks/${id}`, "PUT", payload);
  if (!ok || !data.bookmark) {
    showFormError(data.error ?? "Could not save the bookmark.");
    return;
  }
  applyBookmarkUpdate(data.bookmark);
  dialog.close();
}

/** Patch every copy of a bookmark after a server-confirmed update. */
function applyBookmarkUpdate(bookmark: Bookmark): void {
  const cardInfo: CardData = {
    id: bookmark.id,
    title: bookmark.title,
    url: bookmark.url,
    categoryId: bookmark.categoryId,
    description: bookmark.description ?? "",
    isFavourite: bookmark.isFavourite,
  };

  const main = mainCardById(bookmark.id);
  const previousCategory = main?.dataset.categoryId ?? "";

  for (const copy of cardsById(bookmark.id)) {
    patchCard(copy, cardInfo, categoryName(bookmark.categoryId));
  }

  if (main && previousCategory !== bookmark.categoryId) {
    const target = sectionFor(bookmark.categoryId);
    const targetGrid = target ? gridFor(target) : null;
    targetGrid?.append(main);
    const source = sectionFor(previousCategory);
    if (source) refreshSection(source);
    if (target) refreshSection(target);
  }

  if (cardInfo.isFavourite) {
    addFavouriteCopy(cardInfo);
  } else {
    removeFavouriteCopy(bookmark.id);
  }
  refreshTotals();
  reapplySearch();
  announceDomChange();
  if (main) flashCard(main);
}

// ---- card actions -------------------------------------------------------------

async function toggleFavourite(card: HTMLElement): Promise<void> {
  const data = cardData(card);
  const next = !data.isFavourite;
  const updated: CardData = { ...data, isFavourite: next };

  // Optimistic: flip every copy now, roll back with a toast on failure.
  for (const copy of cardsById(data.id)) {
    patchCard(copy, updated, categoryName(data.categoryId));
  }
  if (next) {
    addFavouriteCopy(updated);
  } else {
    removeFavouriteCopy(data.id);
  }

  const { ok, data: response } = await api(`/api/bookmarks/${data.id}`, "PUT", {
    title: data.title,
    url: data.url,
    categoryId: data.categoryId,
    description: data.description || undefined,
    isFavourite: next,
  });

  if (!ok) {
    for (const copy of cardsById(data.id)) {
      patchCard(copy, data, categoryName(data.categoryId));
    }
    if (next) {
      removeFavouriteCopy(data.id);
    } else {
      addFavouriteCopy(data);
    }
    toast(response.error ?? "Could not update the favourite.", { kind: "error" });
  }
}

async function copyBookmarkUrl(card: HTMLElement): Promise<void> {
  const url = card.dataset.url ?? "";
  try {
    await navigator.clipboard.writeText(url);
    toast("URL copied to clipboard.", { kind: "success", duration: 2500 });
  } catch {
    toast("Could not copy the URL.", { kind: "error" });
  }
}

async function moveBookmarkCard(card: HTMLElement, direction: "up" | "down"): Promise<void> {
  const main = mainCardById(card.dataset.id ?? "") ?? card;
  const sibling =
    direction === "up" ? main.previousElementSibling : main.nextElementSibling;
  if (!sibling) return;

  // Optimistic: swap the nodes immediately, then fire the API call.
  const parent = main.parentElement!;
  if (direction === "up") {
    parent.insertBefore(main, sibling);
  } else {
    parent.insertBefore(sibling, main);
  }

  const { ok, data } = await api("/api/bookmarks/reorder", "POST", {
    id: main.dataset.id,
    direction,
  });
  if (!ok) {
    // Roll back the swap — never silently.
    if (direction === "up") {
      parent.insertBefore(sibling, main);
    } else {
      parent.insertBefore(main, sibling);
    }
    toast(data.error ?? "Could not move the bookmark.", { kind: "error" });
  }
}

async function deleteBookmarkCard(card: HTMLElement): Promise<void> {
  const data = cardData(card);
  const main = mainCardById(data.id);
  if (!main) return;

  const parent = main.parentElement!;
  const anchor = main.nextElementSibling;
  const section = main.closest<HTMLElement>("[data-category-section]");

  // No blocking confirm: remove instantly, offer Undo for 6 seconds.
  for (const copy of cardsById(data.id)) copy.remove();
  if (section) refreshSection(section);
  refreshFavourites();
  refreshTotals();
  announceDomChange();

  const { ok, data: response } = await api(`/api/bookmarks/${data.id}`, "DELETE");
  if (!ok) {
    // Restore — the delete never happened server-side.
    parent.insertBefore(main, anchor && anchor.parentElement === parent ? anchor : null);
    if (data.isFavourite) addFavouriteCopy(data);
    if (section) refreshSection(section);
    refreshFavourites();
    refreshTotals();
    announceDomChange();
    toast(response.error ?? "Could not delete the bookmark.", { kind: "error" });
    return;
  }

  toast(`Deleted "${data.title}".`, {
    duration: 6000,
    action: {
      label: "Undo",
      onClick: async () => {
        const { ok: restored, data: restoreData } = await api<{ bookmark?: Bookmark }>(
          "/api/bookmarks",
          "POST",
          {
            title: data.title,
            url: data.url,
            categoryId: data.categoryId,
            description: data.description || undefined,
            isFavourite: data.isFavourite,
          },
        );
        if (!restored || !restoreData.bookmark) {
          toast(restoreData.error ?? "Could not restore the bookmark.", { kind: "error" });
          return;
        }
        const fresh: CardData = { ...data, id: restoreData.bookmark.id };
        patchCard(main, fresh, categoryName(data.categoryId));
        parent.insertBefore(main, anchor && anchor.parentElement === parent ? anchor : null);
        if (data.isFavourite) addFavouriteCopy(fresh);
        if (section) refreshSection(section);
        refreshFavourites();
        refreshTotals();
        reapplySearch();
        announceDomChange();
        flashCard(main);
      },
    },
  });
}

// ---- category actions -----------------------------------------------------------

function categorySelects(): HTMLSelectElement[] {
  return $$("select[data-category-select]") as unknown as HTMLSelectElement[];
}

function addCategoryOption(id: string, name: string): void {
  for (const select of categorySelects()) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = name;
    select.append(option);
  }
}

function renameCategoryOption(id: string, name: string): void {
  for (const select of categorySelects()) {
    const option = select.querySelector(`option[value="${CSS.escape(id)}"]`);
    if (option) option.textContent = name;
  }
}

function removeCategoryOption(id: string): void {
  for (const select of categorySelects()) {
    select.querySelector(`option[value="${CSS.escape(id)}"]`)?.remove();
  }
}

/** Rebuild data-search on every card in a section (category name is part of it). */
function reindexSectionCards(section: HTMLElement): void {
  const grid = gridFor(section);
  if (!grid) return;
  const name = section.dataset.categoryName ?? "";
  for (const card of $$("[data-bookmark-card]", grid)) {
    patchCard(card, cardData(card), name);
  }
}

function startInlineRename(section: HTMLElement): void {
  const heading = $("[data-category-title]", section);
  if (!heading || heading.querySelector("input")) return;

  // Inside a collection the heading shows the short name; keep the collection
  // prefix so saving rebuilds the full "Collection / Category" name.
  const fullName = section.dataset.categoryName ?? heading.textContent ?? "";
  const { collection, short } = splitCollection(fullName);
  const shortText = $("[data-category-title]", section)?.textContent ?? short;

  const input = document.createElement("input");
  input.value = shortText;
  input.className =
    "focus-ring h-8 w-56 max-w-full rounded-md border border-edge-strong bg-surface px-2 text-base font-semibold";
  input.setAttribute("aria-label", "Category name");
  heading.replaceChildren(input);
  input.focus();
  input.select();

  let finished = false;
  const restore = (text: string) => {
    finished = true;
    heading.replaceChildren(document.createTextNode(text));
  };

  const commit = async () => {
    if (finished) return;
    const nextShort = input.value.trim();
    if (!nextShort || nextShort === shortText) {
      restore(shortText);
      return;
    }
    const name = collection ? `${collection} / ${nextShort}` : nextShort;
    finished = true;
    const id = section.dataset.categoryId ?? "";
    const { ok, data } = await api<{ category?: { name: string } }>(
      `/api/categories/${id}`,
      "PUT",
      { name },
    );
    if (!ok) {
      restore(shortText);
      toast(data.error ?? "Could not rename the category.", { kind: "error" });
      return;
    }
    const finalName = data.category?.name ?? name;
    section.dataset.categoryName = finalName;
    const finalShort = splitCollection(finalName).short;
    heading.replaceChildren(document.createTextNode(finalShort));
    renameCategoryOption(id, finalName);
    reindexSectionCards(section);
    announceDomChange();
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    } else if (event.key === "Escape") {
      event.stopPropagation();
      restore(shortText);
    }
  });
  input.addEventListener("blur", () => void commit());
}

async function deleteCategorySection(section: HTMLElement): Promise<void> {
  const id = section.dataset.categoryId ?? "";
  const name = section.dataset.categoryName ?? "this category";
  const grid = gridFor(section);
  const count = grid?.children.length ?? 0;

  const confirmed = await confirmDanger({
    title: `Delete "${name}"?`,
    message:
      count === 0
        ? "This category is empty and will be removed."
        : `${count} ${count === 1 ? "bookmark" : "bookmarks"} will move to Uncategorised.`,
    confirmLabel: "Delete category",
  });
  if (!confirmed) return;

  const { ok, data } = await api(`/api/categories/${id}`, "DELETE");
  if (!ok) {
    toast(data.error ?? "Could not delete the category.", { kind: "error" });
    return;
  }

  const target = sectionFor(uncategorisedId());
  const targetGrid = target ? gridFor(target) : null;
  if (grid && targetGrid) {
    for (const card of $$("[data-bookmark-card]", grid)) {
      targetGrid.append(card);
    }
  }
  section.remove();
  if (target) {
    target.dataset.categoryName = target.dataset.categoryName ?? "";
    reindexSectionCards(target);
    refreshSection(target);
  }
  removeCategoryOption(id);
  refreshTotals();
  reapplySearch();
  announceDomChange();
  toast(
    count === 0
      ? `Deleted "${name}".`
      : `Deleted "${name}" — ${count} ${count === 1 ? "bookmark" : "bookmarks"} moved to Uncategorised.`,
    { kind: "success" },
  );
}

async function moveCategorySection(section: HTMLElement, direction: "up" | "down"): Promise<void> {
  const siblings = allSections().filter((candidate) => !candidate.closest("[data-favourites]"));
  const index = siblings.indexOf(section);
  const neighbor = siblings[direction === "up" ? index - 1 : index + 1];
  if (!neighbor) return;

  const parent = section.parentElement!;
  if (direction === "up") {
    parent.insertBefore(section, neighbor);
  } else {
    parent.insertBefore(neighbor, section);
  }
  announceDomChange();

  const { ok, data } = await api("/api/categories/reorder", "POST", {
    id: section.dataset.categoryId,
    direction,
  });
  if (!ok) {
    if (direction === "up") {
      parent.insertBefore(neighbor, section);
    } else {
      parent.insertBefore(section, neighbor);
    }
    announceDomChange();
    toast(data.error ?? "Could not move the category.", { kind: "error" });
  }
}

// ---- new category row -------------------------------------------------------------

function renderCategorySection(category: { id: string; name: string }): HTMLElement | null {
  const template = document.getElementById("category-section-template") as HTMLTemplateElement | null;
  if (!template) return null;
  const section = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
  section.dataset.categoryId = category.id;
  section.dataset.categoryName = category.name;
  section.id = `category-${category.id}`;
  const heading = $("[data-category-title]", section);
  if (heading) heading.textContent = category.name;
  $("[data-add-to-category]", section)?.setAttribute("data-add-to-category", category.id);
  refreshSection(section);
  return section;
}

function initNewCategoryRow(): void {
  const row = $("[data-new-category-row]");
  if (!row) return;
  const button = $("[data-new-category-button]", row);
  const form = row.querySelector<HTMLFormElement>("[data-new-category-form]");
  const input = form?.querySelector<HTMLInputElement>('input[name="name"]');
  if (!button || !form || !input) return;

  const open = () => {
    button.classList.add("hidden");
    form.classList.remove("hidden");
    input.focus();
  };
  const close = () => {
    form.classList.add("hidden");
    button.classList.remove("hidden");
    input.value = "";
  };

  button.addEventListener("click", open);
  form.querySelector("[data-new-category-cancel]")?.addEventListener("click", close);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    const { ok, data } = await api<{ category?: { id: string; name: string } }>(
      "/api/categories",
      "POST",
      { name },
    );
    if (!ok || !data.category) {
      toast(data.error ?? "Could not create the category.", { kind: "error" });
      return;
    }
    const section = renderCategorySection(data.category);
    if (!section) {
      window.location.reload();
      return;
    }
    row.parentElement?.insertBefore(section, row);
    addCategoryOption(data.category.id, data.category.name);
    refreshTotals();
    announceDomChange();
    close();
    section.scrollIntoView({ behavior: "smooth", block: "center" });
    toast(`Created "${data.category.name}".`, { kind: "success" });
  });
}

export function focusNewCategoryRow(): void {
  const row = $("[data-new-category-row]");
  const button = row ? $("[data-new-category-button]", row) : null;
  button?.click();
  row?.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---- wiring -----------------------------------------------------------------------

export function initMutations(): void {
  initNewCategoryRow();

  // Close any dialog from its backdrop.
  for (const dialog of $$<HTMLDialogElement>("dialog")) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  const form = dialogForm();
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitBookmarkDialog();
  });

  const urlInput = field<HTMLInputElement>("url");
  urlInput?.addEventListener("blur", () => {
    void autofillTitle();
    void checkDuplicate();
  });
  urlInput?.addEventListener("paste", () => {
    window.setTimeout(() => {
      void autofillTitle();
      void checkDuplicate();
    }, 50);
  });

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    const duplicateLink = target.closest<HTMLAnchorElement>("[data-duplicate-link]");
    if (duplicateLink) {
      event.preventDefault();
      goToBookmark(duplicateLink.dataset.bookmarkId ?? "");
      return;
    }

    const button = target.closest<HTMLElement>("button, a");
    if (!button) return;

    if (button.matches("[data-open-add-bookmark]")) {
      openBookmarkDialog("add");
      return;
    }
    if (button.hasAttribute("data-add-to-category")) {
      openBookmarkDialog("add", { categoryId: button.getAttribute("data-add-to-category") ?? "" });
      return;
    }
    if (button.matches("[data-close-dialog]")) {
      (button.closest("dialog") as HTMLDialogElement | null)?.close();
      return;
    }
    if (button.matches("[data-add-from-search]")) {
      openBookmarkDialog("add", { title: state.query.trim() });
      return;
    }

    const card = target.closest<HTMLElement>("[data-bookmark-card]");
    if (card) {
      if (button.matches("[data-favourite-toggle]")) void toggleFavourite(card);
      else if (button.matches("[data-copy-bookmark]")) void copyBookmarkUrl(card);
      else if (button.matches("[data-move-bookmark]"))
        void moveBookmarkCard(card, button.dataset.moveBookmark === "up" ? "up" : "down");
      else if (button.matches("[data-edit-bookmark]")) openBookmarkDialog("edit", cardData(card));
      else if (button.matches("[data-delete-bookmark]")) void deleteBookmarkCard(card);
      return;
    }

    const collection = target.closest<HTMLElement>("[data-collection]");
    if (collection && button.matches("[data-collapse-collection]")) {
      toggleCollectionCollapsed(collection);
      return;
    }

    const section = target.closest<HTMLElement>("[data-category-section]");
    if (section) {
      if (button.matches("[data-collapse-category]")) toggleCollapsed(section);
      else if (button.matches("[data-rename-category]")) startInlineRename(section);
      else if (button.matches("[data-delete-category]")) void deleteCategorySection(section);
      else if (button.matches("[data-move-category]"))
        void moveCategorySection(section, button.dataset.moveCategory === "up" ? "up" : "down");
    }
  });

  refreshAllCounts();
}

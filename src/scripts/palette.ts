import { $, $$, allSections, cardData, domainFromUrl, gridFor } from "./dom";
import { expandSection } from "./collapse";
import { openBookmarkDialog, focusNewCategoryRow } from "./mutations";
import { cycleTheme } from "./theme";
import { toggleDensity } from "./density";

type PaletteItem = {
  id: string;
  title: string;
  subtitle: string;
  hint: string;
  run: (keepFocus: boolean) => void;
  /** Lowercase string the query is matched against. */
  haystack: string;
};

let activeIndex = 0;
let items: PaletteItem[] = [];

function dialog(): HTMLDialogElement | null {
  return document.getElementById("command-palette") as HTMLDialogElement | null;
}

function inputEl(): HTMLInputElement | null {
  return $("[data-palette-input]");
}

function listEl(): HTMLElement | null {
  return $("[data-palette-list]");
}

// ---- index builders -----------------------------------------------------------

function bookmarkItems(): PaletteItem[] {
  const result: PaletteItem[] = [];
  for (const section of allSections()) {
    if (section.closest("[data-favourites]")) continue;
    const categoryName = section.dataset.categoryName ?? "";
    const grid = gridFor(section);
    if (!grid) continue;
    for (const card of $$("[data-bookmark-card]", grid)) {
      const data = cardData(card);
      const domain = domainFromUrl(data.url);
      result.push({
        id: `bm-${data.id}`,
        title: data.title,
        subtitle: `${domain} · ${categoryName}`,
        hint: "↵ open · ⌘↵ edit",
        haystack: `${data.title} ${domain} ${data.description} ${categoryName}`.toLowerCase(),
        run: (keepFocus) => {
          if (keepFocus) {
            openBookmarkDialog("edit", data);
          } else {
            window.open(data.url, "_blank", "noopener,noreferrer");
          }
        },
      });
    }
  }
  return result;
}

function commandItems(): PaletteItem[] {
  const base: PaletteItem[] = [
    {
      id: "cmd-add-bookmark",
      title: "Add bookmark",
      subtitle: "Create a new bookmark",
      hint: "↵",
      haystack: "add bookmark new create",
      run: () => openBookmarkDialog("add"),
    },
    {
      id: "cmd-add-category",
      title: "Add category",
      subtitle: "Create a new category",
      hint: "↵",
      haystack: "add category folder new",
      run: () => focusNewCategoryRow(),
    },
    {
      id: "cmd-import",
      title: "Import",
      subtitle: "Import a Booky export",
      hint: "↵",
      haystack: "import booky upload",
      run: () => (window.location.href = "/import"),
    },
    {
      id: "cmd-export-json",
      title: "Export JSON",
      subtitle: "Download a JSON backup",
      hint: "↵",
      haystack: "export json backup download",
      run: () => (window.location.href = "/api/export/json"),
    },
    {
      id: "cmd-export-csv",
      title: "Export CSV",
      subtitle: "Download a CSV backup",
      hint: "↵",
      haystack: "export csv backup download",
      run: () => (window.location.href = "/api/export/csv"),
    },
    {
      id: "cmd-theme",
      title: "Toggle dark mode",
      subtitle: "Cycle light / dark / system",
      hint: "↵",
      haystack: "toggle dark mode light theme system",
      run: () => cycleTheme(),
    },
    {
      id: "cmd-density",
      title: "Toggle density",
      subtitle: "Switch grid / compact list",
      hint: "↵",
      haystack: "toggle density compact grid list view",
      run: () => toggleDensity(),
    },
  ];

  const gotoItems: PaletteItem[] = allSections()
    .filter((section) => !section.closest("[data-favourites]"))
    .map((section) => {
      const name = section.dataset.categoryName ?? "";
      const id = section.dataset.categoryId ?? "";
      return {
        id: `goto-${id}`,
        title: `Go to ${name}`,
        subtitle: "Jump to category",
        hint: "↵",
        haystack: `go to category ${name}`.toLowerCase(),
        run: () => {
          expandSection(section);
          section.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      };
    });

  return [...base, ...gotoItems];
}

// ---- rendering -----------------------------------------------------------------

function render(query: string): void {
  const list = listEl();
  if (!list) return;

  const commandMode = query.startsWith(">");
  const term = (commandMode ? query.slice(1) : query).trim().toLowerCase();
  const tokens = term ? term.split(/\s+/) : [];

  const pool = commandMode ? commandItems() : [...bookmarkItems(), ...commandItems()];
  items = pool
    .filter((item) => tokens.every((token) => item.haystack.includes(token)))
    .slice(0, 50);

  activeIndex = 0;
  list.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "px-3 py-6 text-center text-sm text-ink-mute";
    empty.textContent = "No matches.";
    list.append(empty);
    return;
  }

  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.dataset.index = String(index);
    li.className =
      "flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm";
    li.setAttribute("role", "option");

    const left = document.createElement("div");
    left.className = "min-w-0";
    const title = document.createElement("div");
    title.className = "truncate font-medium text-ink";
    title.textContent = item.title;
    const sub = document.createElement("div");
    sub.className = "truncate text-xs text-ink-faint";
    sub.textContent = item.subtitle;
    left.append(title, sub);

    const hint = document.createElement("span");
    hint.className = "shrink-0 text-xs text-ink-faint";
    hint.textContent = item.hint;

    li.append(left, hint);
    li.addEventListener("mousemove", () => setActive(index));
    li.addEventListener("click", () => run(false));
    list.append(li);
  });

  paintActive();
}

function paintActive(): void {
  const list = listEl();
  if (!list) return;
  for (const li of $$("li[data-index]", list)) {
    const active = Number(li.dataset.index) === activeIndex;
    li.classList.toggle("bg-accent-soft", active);
    li.setAttribute("aria-selected", String(active));
    if (active) li.scrollIntoView({ block: "nearest" });
  }
}

function setActive(index: number): void {
  activeIndex = index;
  paintActive();
}

function run(keepFocus: boolean): void {
  const item = items[activeIndex];
  if (!item) return;
  close();
  item.run(keepFocus);
}

function close(): void {
  dialog()?.close();
}

export function openPalette(): void {
  const d = dialog();
  const input = inputEl();
  if (!d || !input) return;
  input.value = "";
  render("");
  d.showModal();
  input.focus();
}

export function initPalette(): void {
  const d = dialog();
  const input = inputEl();
  if (!d || !input) return;

  input.addEventListener("input", () => render(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(activeIndex + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(event.metaKey || event.ctrlKey);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });

  d.addEventListener("click", (event) => {
    if (event.target === d) close();
  });
}

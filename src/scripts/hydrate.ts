import {
  $,
  allSections,
  gridFor,
  refreshAllCounts,
  renderCard,
  sectionFor,
  type CardData,
} from "./dom";

type RawBookmark = {
  i: string; // id
  t: string; // title
  u: string; // url
  c: string; // categoryId
  d: string; // description
  f: 0 | 1; // isFavourite
};

const FAVOURITES_CAP = 20;

/**
 * Build all bookmark cards on the client from the embedded JSON payload. The
 * server only renders lightweight category shells, which keeps the Worker
 * within its CPU/memory budget at thousands of bookmarks.
 */
export function hydrateCards(): void {
  const dataEl = document.getElementById("bookmark-data");
  if (!dataEl?.textContent) {
    refreshAllCounts();
    return;
  }

  let raw: RawBookmark[];
  try {
    raw = JSON.parse(dataEl.textContent) as RawBookmark[];
  } catch {
    refreshAllCounts();
    return;
  }

  // Cache category name per section so we don't re-read the DOM per card.
  const nameByCategory = new Map<string, string>();
  for (const section of allSections()) {
    if (section.closest("[data-favourites]")) continue;
    nameByCategory.set(section.dataset.categoryId ?? "", section.dataset.categoryName ?? "");
  }

  // Append into each grid via one fragment per category to limit reflow.
  const fragments = new Map<string, DocumentFragment>();
  const favourites: CardData[] = [];

  for (const item of raw) {
    const data: CardData = {
      id: item.i,
      title: item.t,
      url: item.u,
      categoryId: item.c,
      description: item.d,
      isFavourite: item.f === 1,
    };
    const name = nameByCategory.get(item.c) ?? "";
    let fragment = fragments.get(item.c);
    if (!fragment) {
      fragment = document.createDocumentFragment();
      fragments.set(item.c, fragment);
    }
    fragment.append(renderCard(data, name));
    if (data.isFavourite && favourites.length < FAVOURITES_CAP) favourites.push(data);
  }

  for (const [categoryId, fragment] of fragments) {
    const section = sectionFor(categoryId);
    const grid = section ? gridFor(section) : null;
    grid?.append(fragment);
  }

  // Favourites strip mirrors a capped set of favourite cards (compact).
  const favSection = $("[data-favourites]");
  const favGrid = favSection ? gridFor(favSection) : null;
  if (favGrid) {
    const favFragment = document.createDocumentFragment();
    for (const data of favourites) {
      favFragment.append(renderCard(data, nameByCategory.get(data.categoryId) ?? ""));
    }
    favGrid.append(favFragment);
  }

  refreshAllCounts();

  // The payload is large; drop it once consumed to free memory.
  dataEl.remove();
}

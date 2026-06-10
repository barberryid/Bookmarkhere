import type { ImportParseResult, ImportedBookmark } from "./booky";

/**
 * Parses the Netscape bookmark HTML format that Booky.io exports
 * (<!DOCTYPE NETSCAPE-Bookmark-file-1>). Folders are <DT><H3> headings
 * followed by a <DL> block; links are <DT><A HREF=...> entries.
 *
 * Booky exports two folder levels (collection > category). Nested folder
 * names are joined with " / " so distinct folders that share a name
 * (e.g. several "Tools" folders) stay separate categories.
 */
export function parseNetscapeBookmarks(raw: string): ImportParseResult {
  const items: ImportedBookmark[] = [];
  const errors: string[] = [];
  const stack: string[] = [];
  let pendingFolder: string | null = null;

  const token = /<DT><H3[^>]*>([\s\S]*?)<\/H3>|<DL[^>]*>|<\/DL>|<DT><A\s+([^>]*)>([\s\S]*?)<\/A>/gi;

  for (const match of raw.matchAll(token)) {
    const tag = match[0];

    if (tag.toUpperCase().startsWith("<DT><H3")) {
      pendingFolder = decodeEntities(match[1]).trim();
      continue;
    }

    if (tag.toUpperCase().startsWith("<DL")) {
      stack.push(pendingFolder ?? "");
      pendingFolder = null;
      continue;
    }

    if (tag.toUpperCase().startsWith("</DL")) {
      stack.pop();
      continue;
    }

    // <DT><A ...>
    const href = match[2]?.match(/HREF="([^"]*)"/i)?.[1];
    if (!href) {
      errors.push(`Skipped a link without a URL: ${tag.slice(0, 80)}`);
      continue;
    }

    const url = decodeEntities(href).trim();
    const title = decodeEntities(match[3].replace(/<[^>]*>/g, "")).trim();
    const categoryName = stack.filter(Boolean).join(" / ") || "Imported";

    items.push({
      title: title || fallbackTitle(url),
      url,
      categoryName,
    });
  }

  if (!items.length && !errors.length) {
    errors.push("No bookmarks were found in the HTML file.");
  }

  return { source: "booky", items, errors };
}

function fallbackTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const namedEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return namedEntities[entity.toLowerCase()] ?? whole;
  });
}

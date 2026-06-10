import { parseNetscapeBookmarks } from "./htmlBookmarks";

export type ImportedBookmark = {
  title: string;
  url: string;
  categoryName: string;
  description?: string;
};

export type ImportParseResult = {
  source: "booky";
  items: ImportedBookmark[];
  errors: string[];
};

/**
 * Parses a Booky.io export. The real Booky export is Netscape bookmark HTML
 * (verified against an actual export file); a JSON fallback is kept for
 * hand-rolled backup files.
 */
export function parseBookyExport(raw: string): ImportParseResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { source: "booky", items: [], errors: ["The import file is empty."] };
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseBookyJson(trimmed);
  }

  if (/<!DOCTYPE NETSCAPE-Bookmark/i.test(trimmed) || /<DT><A\s/i.test(trimmed)) {
    return parseNetscapeBookmarks(trimmed);
  }

  return {
    source: "booky",
    items: [],
    errors: ["Unrecognised file format. Upload the HTML file exported from Booky.io."],
  };
}

function parseBookyJson(raw: string): ImportParseResult {
  try {
    const data = JSON.parse(raw) as unknown;
    const items: ImportedBookmark[] = [];

    collectJsonBookmarks(data, "Uncategorised", items);

    return { source: "booky", items, errors: [] };
  } catch {
    return { source: "booky", items: [], errors: ["The JSON export could not be parsed."] };
  }
}

function collectJsonBookmarks(
  value: unknown,
  categoryName: string,
  items: ImportedBookmark[],
) {
  if (Array.isArray(value)) {
    for (const child of value) {
      collectJsonBookmarks(child, categoryName, items);
    }
    return;
  }

  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const nextCategory =
    stringValue(record.folder) ||
    stringValue(record.category) ||
    stringValue(record.name) ||
    categoryName;
  const url = stringValue(record.url) || stringValue(record.href);
  const title = stringValue(record.title) || stringValue(record.name);

  if (url && title) {
    items.push({
      title,
      url,
      categoryName,
      description: stringValue(record.description),
    });
  }

  for (const key of ["children", "bookmarks", "items", "links"]) {
    collectJsonBookmarks(record[key], nextCategory, items);
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

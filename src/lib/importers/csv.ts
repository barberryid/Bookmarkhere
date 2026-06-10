import type { ImportParseResult } from "./booky";

export function parseCsvBookmarksExport(_raw: string): ImportParseResult {
  return {
    source: "booky",
    items: [],
    errors: [
      "CSV import is not supported. Booky.io exports bookmarks as HTML — upload that file instead.",
    ],
  };
}

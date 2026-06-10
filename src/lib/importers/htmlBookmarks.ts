import type { ImportParseResult } from "./booky";

export function parseHtmlBookmarksExport(_raw: string): ImportParseResult {
  return {
    source: "booky",
    items: [],
    errors: ["HTML bookmark import will be completed after inspecting the real Booky export."],
  };
}

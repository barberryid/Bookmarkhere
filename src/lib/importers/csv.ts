import type { ImportParseResult } from "./booky";

export function parseCsvBookmarksExport(_raw: string): ImportParseResult {
  return {
    source: "booky",
    items: [],
    errors: ["CSV bookmark import will be completed after inspecting the real Booky export."],
  };
}

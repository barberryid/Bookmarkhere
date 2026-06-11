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

  const token = /<DT><H3[^>]*>([\s\S]*?)<\/H3>|<DL[^>]*>|<\/DL>|<DT><A\s+([^>]*)>([\s\S]*?)<\/A>|<DD>([\s\S]*?)(?=<DT>|<DL|<\/DL>|$)/gi;

  for (const match of raw.matchAll(token)) {
    const tag = match[0];

    if (tag.toUpperCase().startsWith("<DT><H3")) {
      pendingFolder = cleanText(match[1]);
      continue;
    }

    if (tag.toUpperCase().startsWith("<DD")) {
      // A <DD> line is the description of the bookmark right before it.
      const description = cleanText(match[4].replace(/<[^>]*>/g, ""));
      const last = items[items.length - 1];
      if (last && description) last.description = description;
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
    const title = cleanText(match[3].replace(/<[^>]*>/g, ""));
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
  acirc: "â",
  Acirc: "Â",
  Agrave: "À",
  Aacute: "Á",
  Auml: "Ä",
  Eacute: "É",
  Egrave: "È",
  Ouml: "Ö",
  Uuml: "Ü",
  Oslash: "Ø",
  Aring: "Å",
  Ccedil: "Ç",
  Atilde: "Ã",
  euro: "€",
  trade: "™",
  middot: "·",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  copy: "©",
  reg: "®",
  deg: "°",
  pound: "£",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  szlig: "ß",
  aring: "å",
  oslash: "ø",
  raquo: "»",
  laquo: "«",
  iexcl: "¡",
  brvbar: "¦",
  bull: "•",
  times: "×",
  frac12: "½",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  atilde: "ã",
  otilde: "õ",
  ecirc: "ê",
  icirc: "î",
  ocirc: "ô",
  ucirc: "û",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    const named = namedEntities[entity] ?? namedEntities[entity.toLowerCase()];
    return named ?? whole;
  });
}

// Windows-1252 codepoints that differ from Latin-1, mapped back to their
// original byte. Needed to undo UTF-8 text that was once misread as cp1252.
const cp1252Reverse: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

/**
 * Repairs UTF-8 text that was double-encoded ("â€™" instead of "’"), which
 * appears in some Booky exports. Only rewrites strings that round-trip as
 * valid UTF-8; anything else is returned unchanged.
 */
export function repairMojibake(value: string): string {
  if (!/[ÂÃâ]/.test(value)) return value;

  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code <= 0xff) {
      bytes.push(code);
    } else if (cp1252Reverse[code] !== undefined) {
      bytes.push(cp1252Reverse[code]);
    } else {
      return value; // genuine non-Latin text, not mojibake
    }
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return value;
  }
}

export function cleanText(value: string): string {
  return repairMojibake(decodeEntities(value)).trim();
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  const url = new URL(withProtocol);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${url.protocol}`);
  }

  url.hostname = url.hostname.toLowerCase();

  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  if (url.pathname === "/" && !url.search && !url.hash) {
    return `${url.protocol}//${url.host}`;
  }

  return url.toString();
}

/**
 * Key used for duplicate detection. Protocol-insensitive (http vs https count
 * as the same saved site) but keeps the query string, since some URLs need it.
 */
export function normalizeUrlKey(input: string): string {
  const url = new URL(normalizeUrl(input));
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.host}${path}${url.search}${url.hash}`;
}

export function isValidHttpUrl(input: string): boolean {
  try {
    normalizeUrl(input);
    return true;
  } catch {
    return false;
  }
}

export function domainFromUrl(input: string): string {
  try {
    return new URL(normalizeUrl(input)).hostname.replace(/^www\./, "");
  } catch {
    return input.replace(/^https?:\/\//, "").split("/")[0] || input;
  }
}

export function faviconUrlForDomain(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

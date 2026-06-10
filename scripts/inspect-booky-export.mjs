// Inspect a Booky.io HTML export (Netscape bookmark format) and print structure stats.
// Usage: node scripts/inspect-booky-export.mjs "path/to/booky-bookmarks.html"
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/inspect-booky-export.mjs <export.html>");
  process.exit(1);
}

const raw = readFileSync(file, "utf8");

const h3s = [...raw.matchAll(/<DT><H3[^>]*>(.*?)<\/H3>/gis)].map((m) => m[1]);
const links = [...raw.matchAll(/<DT><A ([^>]*)>(.*?)<\/A>/gis)];

console.log("folders:", h3s.length);
console.log(JSON.stringify(h3s, null, 2));
console.log("links:", links.length);

const attrs = new Set();
for (const l of links) {
  for (const a of l[1].matchAll(/([A-Z_]+)="/g)) attrs.add(a[1]);
}
console.log("link attrs:", [...attrs]);
console.log("links without title:", links.filter((l) => !l[2].trim()).length);

let depth = 0;
let maxDepth = 0;
for (const m of raw.matchAll(/<DL>|<\/DL>/gi)) {
  depth += m[0].toLowerCase() === "<dl>" ? 1 : -1;
  maxDepth = Math.max(maxDepth, depth);
}
console.log("max DL depth:", maxDepth, "end depth:", depth);
console.log("DD count:", (raw.match(/<DD>/gi) || []).length);

const urls = links
  .map((l) => (l[1].match(/HREF="([^"]*)"/i) || [])[1])
  .filter(Boolean);
console.log("unique urls:", new Set(urls).size, "of", urls.length);

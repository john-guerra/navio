/**
 * Postbuild guard. The bundles must be ASCII-safe: Navio ships literal glyphs
 * (Ⓧ on filter chips, ↑/↓ on sorted headers) and a page served as latin-1 would
 * mangle them. Escaping is easy to lose silently - terser used to decode it
 * back, and the plugin that did the escaping only handled string literals - so
 * this asserts the property directly rather than trusting the pipeline. See #80.
 */
import { readFileSync } from "fs";

const BUNDLES = ["dist/navio.js", "dist/navio.esm.js", "dist/navio.min.js"];

let failed = false;

for (const file of BUNDLES) {
  let code;
  try {
    code = readFileSync(file, "utf8");
  } catch {
    console.error(`  MISSING  ${file}`);
    failed = true;
    continue;
  }

  // Only literals matter: those are what Navio renders, and a page served as
  // latin-1 would mangle them. Non-ASCII in a comment is cosmetic - it never
  // reaches the DOM - and bundled dependencies legitimately have emoji in
  // theirs. Strip comments before checking.
  //
  // The stripping is heuristic (it does not parse), but that is safe here: it
  // runs after the ascii transform, so any non-ASCII still inside a string
  // literal would already be a bug, and a `//` appearing within a string could
  // at worst hide one - never invent one.
  const body = code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const raw = [...body].filter((ch) => ch.charCodeAt(0) > 0x7f);

  if (raw.length) {
    const sample = [...new Set(raw)].slice(0, 8).join(" ");
    console.error(
      `  FAIL     ${file}: ${raw.length} unescaped non-ASCII char(s): ${sample}`
    );
    failed = true;
    continue;
  }

  // And the glyphs must actually still be in there, escaped - an empty bundle
  // would trivially satisfy the check above. Terser lowercases its escapes,
  // so match either case.
  if (!/\\u24cd/i.test(code)) {
    console.error(`  FAIL     ${file}: expected the escaped Ⓧ glyph (\\u24CD)`);
    failed = true;
    continue;
  }

  console.log(`  ok       ${file}`);
}

// The UMD global must stay the navio function itself. Adding a named export
// alongside the default silently turns it into a namespace object, and
// `new navio(...)` throws "navio is not a constructor" for every existing
// user - a break that only shows up in a browser. See src/index.js.
for (const file of ["dist/navio.js", "dist/navio.min.js"]) {
  const code = readFileSync(file, "utf8");
  if (/exports\.default\s*=|\bexports\.navio\s*=/.test(code)) {
    console.error(
      `  FAIL     ${file}: UMD global looks like a namespace, not the navio function`
    );
    failed = true;
  }
}

if (failed) {
  console.error("\nBundle verification failed.");
  process.exit(1);
}

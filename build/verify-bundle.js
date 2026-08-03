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

  // The banner is a comment; non-ASCII there cannot affect execution.
  const body = code.split("\n").slice(1).join("\n");
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

if (failed) {
  console.error("\nBundle verification failed.");
  process.exit(1);
}

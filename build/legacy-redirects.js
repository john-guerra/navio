/**
 * Writes redirect stubs for demo URLs that were published before the demos were
 * collected under examples/.
 *
 * navio.dev serves this repo, so those old paths are live URLs that external
 * pages, notebooks and papers may link to. They have to keep resolving - but
 * keeping five near-empty directories in the repo just to hold them put the
 * clutter back that moving the demos was meant to remove.
 *
 * Since the site is now built by a workflow, the stubs can be generated into
 * the deploy output instead. The repository stays clean; the URLs stay alive.
 *
 * Usage: node build/legacy-redirects.js <site-dir>
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/** old published path -> where it lives now */
export const MOVED = {
  example: "examples/basic",
  exampleSenate: "examples/senate",
  example_vispubdata: "examples/vispubdata",
  example_vastChallenge2017: "examples/vast-challenge-2017",
  example_d3v3: "examples/d3v3-legacy",
};

export function redirectHtml(to) {
  return `<!doctype html>
<meta charset="utf-8" />
<title>Moved</title>
<link rel="canonical" href="/${to}/" />
<meta http-equiv="refresh" content="0; url=/${to}/" />
<p>This demo moved to <a href="/${to}/">/${to}/</a>.</p>
`;
}

const siteDir = process.argv[2];
if (siteDir) {
  for (const [from, to] of Object.entries(MOVED)) {
    const dir = join(siteDir, from);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), redirectHtml(to));
    console.log(`  /${from}/ -> /${to}/`);
  }
}

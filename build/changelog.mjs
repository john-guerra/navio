/**
 * Read one version's notes out of CHANGELOG.md.
 *
 * Shared by the release script and the unit test that refuses to let a version
 * be published without notes, so "what the release says" and "what the test
 * checks" cannot be two different ideas of where the section starts.
 */
import { readFileSync } from "node:fs";

const FILE = new URL("../CHANGELOG.md", import.meta.url);

/** The body under `## <version>`, up to the next `## `. Null if absent. */
export function notesFor(version, file = FILE) {
  const text = readFileSync(file, "utf8");
  // The heading may carry a date after the version; the version itself has to
  // match exactly, so 0.3.1 never matches 0.3.10.
  const heading = new RegExp(
    `^## ${version.replace(/\./g, "\\.")}(?![\\w.])[^\\n]*\\n`,
    "m"
  );
  const start = text.match(heading);
  if (!start) return null;

  const from = start.index + start[0].length;
  const rest = text.slice(from);
  const next = rest.search(/^## /m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

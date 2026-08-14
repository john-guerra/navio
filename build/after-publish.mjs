/**
 * Everything that has to happen AFTER npm has accepted the package.
 *
 * Run from the `postpublish` lifecycle hook, which npm runs only on a
 * successful publish. That is the whole point: it makes the release order
 * structural rather than remembered.
 *
 *   npm version patch   -> bump, gate, commit, tag LOCALLY
 *   npm publish         -> gate again, publish, then this
 *
 * A tag pushed before a failed publish is the bad case: if the failure needs a
 * code change, the pushed tag points at the wrong commit, and a published tag
 * must not be moved - so the version is burnt. A tag that only exists locally
 * costs nothing to delete and retry.
 *
 * The other half is that a tag pushed by hand AFTER a successful publish is a
 * step someone has to remember once the interesting part is over. It was
 * documented in CLAUDE.md and 0.3.0 still went to npm with no tag anywhere.
 *
 * This script never fails the release - the package is already published by the
 * time it runs, so exiting non-zero would only make a finished release look
 * broken. Anything that does not work is printed as the command to run by hand.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { notesFor } from "./changelog.mjs";

const { version } = createRequire(import.meta.url)("../package.json");
const tag = `v${version}`;

// npm runs lifecycle scripts for --dry-run too, and a dry run must not push.
if (process.env.npm_config_dry_run === "true") {
  console.log(`\n  dry run: would push ${tag} and create its release\n`);
  process.exit(0);
}

const run = (cmd, args) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

/** Try something; on failure say what to run instead, and carry on. */
function attempt(what, manual, fn) {
  try {
    fn();
    console.log(`  ok       ${what}`);
    return true;
  } catch (err) {
    console.error(`\n  FAILED   ${what}`);
    console.error(`           ${(err.stderr || err.message || "").trim()}`);
    console.error(`\n  navio ${version} IS published. Finish by hand:\n`);
    console.error(`      ${manual}\n`);
    return false;
  }
}

console.log(`\n  navio ${version} published. Recording it:\n`);

const pushed = attempt(
  `pushed main and ${tag}`,
  `git push origin main --follow-tags`,
  () => run("git", ["push", "origin", "main", "--follow-tags"])
);

if (pushed) {
  const notes = notesFor(version);
  attempt(
    `created the ${tag} release`,
    `gh release create ${tag} --title ${tag} --notes-file CHANGELOG.md`,
    () => {
      if (!notes)
        // The unit test should have caught this long before here.
        throw new Error(`CHANGELOG.md has no section for ${version}`);
      run("gh", ["release", "create", tag, "--title", tag, "--notes", notes]);
    }
  );
}

console.log("");

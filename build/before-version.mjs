/**
 * Refuse to start a release that cannot finish cleanly.
 *
 * Run from `preversion`, before npm touches package.json. Everything here is
 * something that is cheap to fix now and expensive to fix after a tag exists:
 * `npm version` makes a commit, and the commit is what gets published and
 * tagged.
 *
 * `version` then runs the gate and regenerates the API docs, so a release
 * cannot carry a stale docs/ai/API.md; `git add -A` in that hook is why the
 * tree has to be clean here, or it would sweep unrelated work into the version
 * commit.
 */
import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const fail = (why, fix) => {
  console.error(`\n  Not releasing: ${why}`);
  console.error(`  ${fix}\n`);
  process.exit(1);
};

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "main")
  fail(
    `on branch ${branch}, not main`,
    "Releases are cut from main - merge first."
  );

if (git("status", "--porcelain"))
  fail(
    "the working tree has uncommitted changes",
    "The version hook runs `git add -A`, so anything left here lands in the version commit. Commit or stash it."
  );

// A version commit pushed on top of commits that were never pushed is fine;
// one made on top of a stale main is not, because the tag would point at a
// history that is about to be rewritten by a pull.
git("fetch", "origin", "main", "--quiet");
const behind = git("rev-list", "--count", "HEAD..origin/main");
if (behind !== "0")
  fail(
    `main is ${behind} commit(s) behind origin`,
    "Pull first, or the tag will point at a commit that is not what main becomes."
  );

console.log("  ok       clean tree, on main, up to date with origin");

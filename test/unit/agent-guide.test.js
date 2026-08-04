import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, lstatSync } from "node:fs";
import { join } from "node:path";

// CLAUDE.md holds the agent guide and AGENTS.md is a symlink to it, so the two
// conventional filenames can never drift apart. Different tools look for
// different names; two hand-maintained copies would have gone stale the first
// time one of them was edited.

const root = process.cwd();
const CLAUDE = join(root, "CLAUDE.md");
const AGENTS = join(root, "AGENTS.md");

describe("the agent guide", () => {
  it("exists at the repo root", () => {
    expect(existsSync(CLAUDE)).toBe(true);
    expect(existsSync(AGENTS)).toBe(true);
  });

  it("is one file under both conventional names", () => {
    // On a checkout without symlink support AGENTS.md degrades to a text file
    // containing the target's path; accept that, but not a divergent copy.
    const agents = readFileSync(AGENTS, "utf8");
    const claude = readFileSync(CLAUDE, "utf8");
    const isSymlink = lstatSync(AGENTS).isSymbolicLink();

    expect(isSymlink ? agents : agents.trim()).toBe(
      isSymlink ? claude : "CLAUDE.md"
    );
  });

  it("documents the commands an agent needs, and that check excludes e2e", () => {
    const guide = readFileSync(CLAUDE, "utf8");
    for (const cmd of ["npm run check", "npm run build", "playwright test"]) {
      expect(guide).toContain(cmd);
    }
    expect(guide).toMatch(/check.*does \*\*not\*\* run the e2e/i);
  });

  it("points at the filtering model rather than restating it", () => {
    const guide = readFileSync(CLAUDE, "utf8");
    expect(guide).toContain("docs/ai/FILTERING-MODEL.md");
    expect(existsSync(join(root, "docs/ai/FILTERING-MODEL.md"))).toBe(true);
  });

  it("only references files that exist", () => {
    const guide = readFileSync(CLAUDE, "utf8");
    // Backticked repo-relative paths with a directory separator or a known
    // extension - enough to catch a renamed or deleted file.
    const paths = [...guide.matchAll(/`((?:src|test|build|docs)\/[\w./-]+)`/g)]
      .map((m) => m[1])
      .filter((p) => !p.endsWith("/"));

    expect(paths.length).toBeGreaterThan(4);
    const missing = paths.filter((p) => !existsSync(join(root, p)));
    expect(missing, `referenced but absent: ${missing.join(", ")}`).toEqual([]);
  });
});

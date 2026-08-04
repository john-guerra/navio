import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Navio marks `d3` external and calls v7-only APIs (d3.pointer, and listeners
// that receive the event as their first argument). An example that loads an
// older d3 therefore breaks on interaction rather than at load, which is easy
// to miss - examples/senate sat on d3 v4 until someone tried to sort a column.
// This is the cheap version of that check: no browser, no network.

const EXAMPLES = join(process.cwd(), "examples");

// Predates Navio's d3 v7 rewrite and pins its own standalone build; it is kept
// deliberately as a record of the v3 API, not as a working demo of current Navio.
const EXEMPT = new Set(["d3v3-legacy"]);

const dirs = readdirSync(EXAMPLES, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !EXEMPT.has(e.name))
  .map((e) => e.name)
  .filter((name) => existsSync(join(EXAMPLES, name, "index.html")));

describe("examples load a compatible d3", () => {
  it("finds the example pages", () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  it.each(dirs)("%s does not pin d3 older than v7", (name) => {
    const html = readFileSync(join(EXAMPLES, name, "index.html"), "utf8");

    // d3js.org/d3.vN..., cdn/npm d3@N, unpkg d3@N
    const versions = [...html.matchAll(/d3(?:js\.org\/d3)?[.@]v?(\d+)/g)].map(
      (m) => Number(m[1])
    );

    const tooOld = versions.filter((v) => v < 7);
    expect(
      tooOld,
      `${name}/index.html references d3 major ${tooOld.join(", ")}`
    ).toEqual([]);
  });
});

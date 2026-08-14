import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { notesFor } from "../../build/changelog.mjs";

const { version } = createRequire(import.meta.url)("../../package.json");

// The release body comes from CHANGELOG.md, and build/after-publish.mjs runs
// AFTER npm has accepted the package - far too late to discover there is
// nothing to say. `npm run check` is what prepublishOnly runs, so a version
// with no notes cannot reach npm in the first place.
describe("CHANGELOG.md", () => {
  it(`has a section for the version being released (${version})`, () => {
    const notes = notesFor(version);
    expect(
      notes,
      `no "## ${version}" section - add one before publishing`
    ).toBeTruthy();
  });

  it("says something in it", () => {
    // An empty section would publish a release with a blank body, which is
    // worse than none: it looks like the release had nothing in it.
    expect(notesFor(version).length).toBeGreaterThan(80);
  });

  it("keeps version headings at one level, so sections do not truncate", () => {
    // notesFor stops at the next `## `. A heading inside a version's notes has
    // to be `###` or everything after it silently vanishes from the release.
    expect(notesFor(version)).not.toMatch(/^## /m);
  });
});

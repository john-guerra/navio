import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderApiDocs } from "../../build/gen-api-docs.js";

// docs/ai/API.md is generated from src/params.js. This is what stops the
// committed copy drifting from the table: change an option and forget to
// regenerate, and `npm run check` fails rather than shipping a doc that
// describes the previous release.
describe("docs/ai/API.md", () => {
  it("matches what src/params.js would generate", () => {
    const onDisk = readFileSync(
      new URL("../../docs/ai/API.md", import.meta.url),
      "utf8"
    );
    expect(
      onDisk.trim(),
      "docs/ai/API.md is stale - run `npm run docs:api`"
    ).toBe(renderApiDocs().trim());
  });
});

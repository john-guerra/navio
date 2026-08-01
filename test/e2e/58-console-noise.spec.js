import { test, expect } from "@playwright/test";

// Regression tests for https://github.com/john-guerra/navio/issues/58.
// A library should not spam the host page's console. Navio traces its
// internals only when the caller opts in via nv.DEBUG.

/** Collects every console message the page emits, tagged by type. */
function captureConsole(page) {
  const messages = [];
  page.on("console", (msg) => messages.push(`${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => messages.push(`pageerror: ${err.message}`));
  return messages;
}

test("mounting and auto-detecting attributes writes nothing to the console", async ({
  page,
}) => {
  const messages = captureConsole(page);

  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  expect(messages).toEqual([]);
});

test("interacting (hover, stray click, filter) stays silent", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  const canvas = page.locator("#nv canvas");
  await expect(canvas).toHaveCount(1);

  // Start capturing only after load, so this isolates interaction noise.
  const messages = captureConsole(page);
  const box = await canvas.boundingBox();

  // Hover across the widget, including empty space below the last row, which
  // used to log "Couldn't find datum for tooltip" on every mousemove.
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(box.x + 60, box.y + 60 + i * 40);
  }
  // Click in the left margin, outside any attribute column.
  await page.mouse.click(box.x + 2, box.y + 200);

  expect(messages).toEqual([]);
});

test("nv.DEBUG = true turns tracing back on", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");
  const messages = captureConsole(page);

  await page.evaluate(() => {
    window.nv.DEBUG = true;
    window.nv.update();
  });

  expect(messages.length).toBeGreaterThan(0);
});

test("skipped array attributes produce one actionable warning, not one per column", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  const messages = captureConsole(page);

  await page.evaluate(() => {
    // Arrays are always treated as leaves by getAttribsFromObjectRecursive, so
    // they reach the skip branch without touching recursion settings.
    const withArrays = [
      { id: 1, tags: ["a"], authors: ["x"], refs: [1] },
      { id: 2, tags: ["b"], authors: ["y"], refs: [2] },
    ];
    const nv2 = new window.navio(window.d3.select("#nv"), 400);
    nv2.data(withArrays);
    nv2.addAllAttribs();
  });

  const warnings = messages.filter((m) => m.startsWith("warning:"));
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("addAllAttribsIncludeArrays");
  // All three skipped columns are named in that single message.
  expect(warnings[0]).toContain("tags");
  expect(warnings[0]).toContain("authors");
  expect(warnings[0]).toContain("refs");
});

test("skipped object attributes are also reported once, when recursion is limited", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  const messages = captureConsole(page);

  await page.evaluate(() => {
    const withObjects = [
      { id: 1, meta: { a: 1 }, other: { b: 2 } },
      { id: 2, meta: { a: 2 }, other: { b: 3 } },
    ];
    const nv2 = new window.navio(window.d3.select("#nv"), 400);
    // Without this, nested objects are flattened into paths rather than
    // surfacing as object-typed attributes at all.
    nv2.addAllAttribsRecursionLevel = 0;
    nv2.data(withObjects);
    nv2.addAllAttribs();
  });

  const warnings = messages.filter((m) => m.startsWith("warning:"));
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("addAllAttribsIncludeObjects");
  expect(warnings[0]).toContain("meta");
  expect(warnings[0]).toContain("other");
});

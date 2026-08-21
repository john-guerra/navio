import { test, expect } from "@playwright/test";

// Pins the contract the modules extracted for issue #67 depend on.
//
// navio.js hands each module a CONTEXT OBJECT whose closure bindings are
// getters, not values. That is not a style choice. init() rebinds `selection`
// from whatever the caller passed to a real d3 selection
// (src/navio.js, "typeof selection === typeof ''"), and it does so long AFTER
// the module factories have been constructed. A context built with plain
// properties would still be holding the caller's string, and the first thing
// the panel does with it - selection.append("button") - would throw.
//
// Every other fixture in this suite constructs Navio with d3.select("#nv"), so
// nothing else here exercises the string path at all.
//
// To prove this test is worth its place: change the `selection` entry of the
// context in src/navio.js from
//     get selection() { return selection; }
// to
//     selection,
// and all three of these fail.
//
// They are not the ONLY tests that fail under that change - the three
// senate-example tests fail too, because examples/senate/assets/js/main.js:105
// is the one other place in the repo that constructs from a string. That
// coverage is incidental: it reports "the senate example throws" rather than
// which binding went stale, and it vanishes the day that example is rewritten.

const FIXTURE = "/test/e2e/fixtures/string-selector.html";

test("a widget built from a string selector draws", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(FIXTURE);

  await expect(page.locator("#nv canvas")).toHaveCount(1);
  expect(errors, "constructing from a string selector threw").toEqual([]);
});

test("a widget built from a string selector opens its settings panel", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // The gear is appended to `selection`. With a captured string rather than a
  // live binding there is no gear to click, and the failure happens during
  // init() rather than here.
  const gear = page.locator("#nv ._nv_gear");
  await expect(gear).toHaveCount(1);

  await gear.click();
  await expect(page.locator("#nv ._nv_settings")).toBeVisible();
  expect(errors, "opening the panel threw").toEqual([]);
});

test("the theme resolves against the page behind a string-built widget", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // backgroundBehind() walks up from selection.node(). It is the other reader
  // of the rebound binding, and it lives in a different module from the panel,
  // so it is worth asserting separately.
  const resolved = await page.evaluate(() => window.nv.resolvedTheme());
  expect(["light", "dark"]).toContain(resolved);
});

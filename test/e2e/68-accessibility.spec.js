import { test, expect } from "@playwright/test";

// Tests for https://github.com/john-guerra/navio/issues/68. Navio draws to a
// canvas, so its content is opaque to assistive tech and every control was
// mouse-only: click a header to sort, drag it to reorder, click a chip to remove
// a filter. These cover the labelling and the keyboard equivalents.

test("the widget describes itself", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const svg = page.locator("#nv svg").first();
  await expect(svg).toHaveAttribute("role", "group");
  await expect(svg).toHaveAttribute("aria-label", /column per attribute/i);
});

test("column headers are focusable buttons with a useful label", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const headers = page.locator("#nv .attribOverlay");
  expect(await headers.count()).toBeGreaterThan(2);

  const first = headers.first();
  await expect(first).toHaveAttribute("role", "button");
  await expect(first).toHaveAttribute("tabindex", "0");
  await expect(first).toHaveAttribute("aria-label", /Enter to sort/);
});

test("Enter on a header sorts it, like clicking does", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const order = () =>
    page.evaluate(() => window.nv.getRowsAtLevel(0).map((r) => r.value));
  const before = await order();

  // Focus the "value" header and press Enter.
  await page.locator('#nv .attribOverlay[aria-label^="value,"]').focus();
  await page.keyboard.press("Enter");

  await expect.poll(order).not.toEqual(before);
  const after = await order();
  expect(after).toEqual([...after].sort((a, b) => a - b));
});

test("Alt+Arrow reorders a column, the keyboard equivalent of the drag", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const attribs = () =>
    page.evaluate(() =>
      window.nv.getAttribs().map((a) => (typeof a === "function" ? a.name : a))
    );
  const before = await attribs();
  const moved = before[before.length - 1];

  await page.locator(`#nv .attribOverlay[aria-label^="${moved},"]`).focus();
  await page.keyboard.press("Alt+ArrowLeft");

  await expect.poll(attribs).not.toEqual(before);
  const after = await attribs();
  expect(after.indexOf(moved)).toBe(before.indexOf(moved) - 1);
  // Same set, only reordered.
  expect([...after].sort()).toEqual([...before].sort());
});

test("selection changes are announced in a live region", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const live = page.locator("#nv ._nv_live");
  await expect(live).toHaveAttribute("role", "status");
  await expect(live).toHaveAttribute("aria-live", "polite");

  await page.evaluate(() =>
    window.nv.setFilters([[{ type: "value", attrib: "category", value: "a" }]])
  );

  await expect(live).toHaveText(/of 5 rows selected/);
  await expect(live).toHaveText(/Filters: category == a/);

  await page.evaluate(() => window.nv.setFilters([]));
  await expect(live).toHaveText(/No filters/);
});

test("filter chips are labelled buttons, removable from the keyboard", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  await page.evaluate(() =>
    window.nv.setFilters([[{ type: "value", attrib: "category", value: "a" }]])
  );

  const chip = page.locator("#nv .filterExplanation div").first();
  await expect(chip).toHaveAttribute("role", "button");
  await expect(chip).toHaveAttribute("aria-label", /^Remove filter: /);

  await chip.focus();
  await page.keyboard.press("Enter");

  // Removing the only filter restores the full set.
  await expect
    .poll(() => page.evaluate(() => window.nv.getVisible().length))
    .toBe(5);
});

test("the close-level control is a labelled button", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const closeBtn = page.locator("#nv #closeButton path");
  await expect(closeBtn).toHaveAttribute("role", "button");
  await expect(closeBtn).toHaveAttribute("aria-label", /Close the last/);
});

test("destroy() takes the live region with it", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv ._nv_live")).toHaveCount(1);
  await page.evaluate(() => window.nv.destroy());
  await expect(page.locator("#nv ._nv_live")).toHaveCount(0);
});

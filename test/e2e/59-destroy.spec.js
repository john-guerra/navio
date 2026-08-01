import { test, expect } from "@playwright/test";

// Tests for https://github.com/john-guerra/navio/issues/59 (nv.destroy()).
// Also covers the long-standing complaint in #39 that the popover survived
// after the widget was removed.

test("destroy() removes the instance's tooltip and rendered content", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await expect(page.locator("#nv ._nv_popover")).toHaveCount(1);

  await page.evaluate(() => window.nv.destroy());

  await expect(page.locator("#nv canvas")).toHaveCount(0);
  await expect(page.locator("#nv ._nv_popover")).toHaveCount(0);
});

test("destroy() detaches only this instance's body listeners", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/two-instances.html");

  const before = await page.evaluate(() => ({
    nv1: typeof window.d3.select("body").on("keydown.navio-1") === "function",
    nv2: typeof window.d3.select("body").on("keydown.navio-2") === "function",
  }));
  expect(before).toEqual({ nv1: true, nv2: true });

  await page.evaluate(() => window.nv1.destroy());

  const after = await page.evaluate(() => ({
    nv1: typeof window.d3.select("body").on("keydown.navio-1") === "function",
    nv2: typeof window.d3.select("body").on("keydown.navio-2") === "function",
  }));
  expect(after).toEqual({ nv1: false, nv2: true });
});

test("destroying one instance leaves the other fully working", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/two-instances.html");

  await page.evaluate(() => window.nv1.destroy());

  await expect(page.locator("#nv1 canvas")).toHaveCount(0);
  await expect(page.locator("#nv2 canvas")).toHaveCount(1);
  await expect(page.locator("#nv2 ._nv_popover")).toHaveCount(1);

  // The survivor can still filter.
  const stillWorks = await page.evaluate(() => {
    window.nv2.sortBy("category");
    return window.nv2.getVisible().length;
  });
  expect(stillWorks).toBeGreaterThan(0);
});

test("destroy() is safe to call twice and writes nothing to the console", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");

  const messages = [];
  page.on("console", (msg) => messages.push(`${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => messages.push(`pageerror: ${err.message}`));

  await page.evaluate(() => {
    window.nv.destroy();
    window.nv.destroy();
  });

  expect(messages).toEqual([]);
});

test("destroy() releases the reference to the dataset", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");

  const rowsBefore = await page.evaluate(() => window.nv.data().length);
  expect(rowsBefore).toBe(5);

  const rowsAfter = await page.evaluate(() => {
    window.nv.destroy();
    return window.nv.data().length;
  });
  expect(rowsAfter).toBe(0);
});

import { test, expect } from "@playwright/test";

// Repro for https://github.com/john-guerra/navio/issues/57 (tooltips and
// body-scoped listeners collide when multiple Navio instances share a page):
// the tooltip container and the keydown/keyup cursor-swap listener used to be
// scoped to `document.body` / unnamespaced, so mounting a second instance
// silently deleted the first instance's tooltip and overwrote its keydown
// listener.

test("each instance keeps its own tooltip element after a second instance mounts", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/test/e2e/fixtures/two-instances.html");

  await expect(page.locator("#nv1 ._nv_popover")).toHaveCount(1);
  await expect(page.locator("#nv2 ._nv_popover")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("each instance keeps its own keydown/keyup listener on body after a second instance mounts", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/two-instances.html");

  const listeners = await page.evaluate(() => {
    // d3's selection.on(typename) getter returns the bound listener for that
    // exact type+namespace, or undefined if none is registered.
    return {
      nv1: typeof window.d3.select("body").on("keydown.navio-1") === "function",
      nv2: typeof window.d3.select("body").on("keydown.navio-2") === "function",
    };
  });

  expect(listeners).toEqual({ nv1: true, nv2: true });
});

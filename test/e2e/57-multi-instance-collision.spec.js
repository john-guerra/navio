import { test, expect } from "@playwright/test";

// Repro for https://github.com/john-guerra/navio/issues/57 (tooltips and
// body-scoped listeners collide when multiple Navio instances share a page):
// the tooltip container and the keydown/keyup cursor-swap listener used to be
// scoped to `document.body` / unnamespaced, so mounting a second instance
// silently deleted the first instance's tooltip and overwrote its keydown
// listener.

test("each instance keeps its own tooltip element after a second instance mounts", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/test/e2e/fixtures/two-instances.html");

  // Tooltips live on <body> rather than inside each container (Popper resolves
  // a virtual reference against the document - see tooltip-placement.spec.js),
  // so instance ownership is asserted through the stamped id instead of the
  // DOM ancestry.
  await expect(page.locator("body > ._nv_popover")).toHaveCount(2);
  const owners = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body > ._nv_popover")).map((el) =>
      el.getAttribute("data-navio-instance")
    )
  );
  expect(new Set(owners).size).toBe(2); // one each, not one shared
  expect(errors).toEqual([]);
});

test("each instance keeps its own keydown/keyup listener on body after a second instance mounts", async ({
  page,
}) => {
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

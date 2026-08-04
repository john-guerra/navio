import { test, expect } from "@playwright/test";

// Two brush defects found while changing the geometry live.
//
// 1. The brush join appended on enter AND update, so every redraw nested
//    another .brush inside the previous one. Each stale copy kept the width of
//    the geometry it was born under and was painted over the live one.
// 2. A brush rectangle is in pixels, so any geometry change leaves it pointing
//    at the wrong rows - and an orientation flip leaves it on the wrong axis
//    entirely, which makes it undraggable.

test("redrawing does not accumulate brushes, and their width tracks the columns", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const probe = () =>
    page.evaluate(() => ({
      count: document.querySelectorAll("#nv .brush").length,
      widths: Array.from(document.querySelectorAll("#nv .brush .overlay")).map(
        (r) => +r.getAttribute("width")
      ),
    }));

  expect((await probe()).count).toBe(1);

  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) window.nv.hardUpdate();
  });
  expect((await probe()).count).toBe(1);

  const before = (await probe()).widths[0];
  await page.evaluate(() => {
    window.nv.attribWidth = 30;
    window.nv.hardUpdate();
  });
  expect((await probe()).widths[0]).toBeGreaterThan(before * 1.5);
});

test("a brush follows a geometry change and an orientation flip", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/vertical.html?orientation=horizontal");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const box = await page.locator("#nv canvas").boundingBox();
  const g = await page.evaluate(() => ({
    y0: window.nv.y0,
    aw: window.nv.attribWidth,
  }));
  const x = box.x + g.aw * 2.5;
  await page.mouse.move(x, box.y + g.y0 + 30);
  await page.mouse.down();
  await page.mouse.move(x, box.y + g.y0 + 120, { steps: 8 });
  await page.mouse.up();

  const selected = () => page.evaluate(() => window.nv.getVisible().length);
  const rect = () =>
    page.evaluate(() => {
      const s = document.querySelector("#nv .brush .selection");
      return s
        ? { w: +s.getAttribute("width"), h: +s.getAttribute("height") }
        : null;
    });

  const n = await selected();
  expect(n).toBeGreaterThan(0);
  const before = await rect();

  await page.evaluate(() => {
    window.nv.attribWidth = 40;
    window.nv.hardUpdate();
  });
  expect(await selected()).toBe(n);
  expect(await rect()).not.toEqual(before);

  await page.evaluate(() => {
    window.nv.orientation = "vertical";
    window.nv.hardUpdate();
  });
  expect(await selected()).toBe(n);
  const flipped = await rect();
  expect(flipped.h).toBeGreaterThan(flipped.w);
});

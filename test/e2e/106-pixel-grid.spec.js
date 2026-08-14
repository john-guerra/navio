import { test, expect } from "@playwright/test";

// #105. Every record is stroked as a line, and a canvas stroke straddles its
// path - so a 1px line centred on an INTEGER y covers half of the pixel above
// and half of the one below rather than one pixel fully. Consecutive strokes
// then composite to roughly 75% of the intended colour, and the exact figure
// alternates with where each row falls. A run of identical values comes out
// striped and washed out instead of solid.
//
// It is invisible at devicePixelRatio 2, where the context scale makes a
// 1-unit line two device pixels starting on an even boundary. Playwright runs
// at dpr 1 by default, which is exactly the case that shows it - measured
// before the fix as 87 distinct colours and alphas of 239/247 down a column
// whose data has one value.

const F = "/test/e2e/fixtures/pixel-grid.html";

const read = async (page, query) => {
  await page.goto(`${F}${query}`);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  return page.evaluate(() => window.columnPixels());
};

test("a column of one value is one fully opaque colour", async ({ page }) => {
  // 4000 records in 400px: each row is a tenth of a pixel, the ordinary case
  // for a widget that draws one row per record.
  const m = await read(page, "?n=4000&height=400");

  expect(m.painted, "the column is drawn at all").toBeGreaterThan(100);
  // The data has one value. Anything else here is the renderer inventing
  // colours, which is what reads as banding.
  expect(m.colours, "distinct colours").toEqual(["31,119,180"]);
  // Partial alpha is the mechanism: it lets the background through, so the
  // colour is no longer the colour the scale chose.
  expect(m.alphas, "alpha values").toEqual([255]);
});

test("it holds when rows are taller than a pixel", async ({ page }) => {
  // 60 records in 400px: nearly 7px per row, where the stroke is thick and any
  // half-pixel straddle shows as a soft edge on both sides.
  const m = await read(page, "?n=60&height=400");

  expect(m.colours).toEqual(["31,119,180"]);
  expect(m.alphas).toEqual([255]);
});

test("it holds when rows land on awkward fractions", async ({ page }) => {
  // 333 rows in 500px is 1.5px each - a width that cannot sit on the pixel
  // grid whichever way it is rounded, so the snapping has to pick a side and
  // stay consistent rather than alternate.
  const m = await read(page, "?n=333&height=500");

  expect(m.colours).toEqual(["31,119,180"]);
  expect(m.alphas).toEqual([255]);
});

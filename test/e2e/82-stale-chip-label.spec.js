import { test, expect } from "@playwright/test";

// Regression tests for https://github.com/john-guerra/navio/issues/82.
//
// A brushed range is labelled from the attribute the level was sorted by when
// the brush was drawn. Re-sorting the level keeps the right rows selected
// (filters are evaluated once - see docs/ai/FILTERING-MODEL.md section 4) but
// left the chip describing a range that no longer corresponds to anything on
// screen. It now says so.

const chips = (page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll(".filterExplanation div")).map(
      (d) => d.textContent
    )
  );

async function brushMiddleRows(page) {
  const box = await page.locator("#nv canvas").boundingBox();
  // y0 is measured from the labels now, so read it instead of hardcoding 100.
  const y0 = await page.evaluate(() => window.nv.y0);
  const rowSpan = 400 / 6;
  const rowMid = (i) => box.y + y0 + rowSpan * i + rowSpan / 2;
  await page.mouse.move(box.x + 37, rowMid(1));
  await page.mouse.down();
  await page.mouse.move(box.x + 37, rowMid(3), { steps: 8 });
  await page.mouse.up();
}

test("a range chip reads plainly while its ordering still holds", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/sort-after-range.html");
  await brushMiddleRows(page);

  expect(await chips(page)).toEqual(["Ⓧ rank range including 2 to 4"]);
});

test("re-sorting the level marks the range chip as no longer visible", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/sort-after-range.html");
  await brushMiddleRows(page);

  await page.evaluate(() => window.nv.sortBy("grp", false, 0));

  // The rows are still right...
  expect(await page.evaluate(() => window.selectedIds().join(" "))).toBe(
    "b c d"
  );
  // ...but the label now admits the range is no longer on screen.
  expect(await chips(page)).toEqual([
    "Ⓧ rank range including 2 to 4 (re-sorted since)",
  ]);
});

test("value chips are unaffected by a re-sort", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");
  const box = await page.locator("#nv canvas").boundingBox();
  const cols = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".attribOverlay text")).map((t) => {
      const m = /translate\(([-\d.]+),/.exec(
        t.parentElement.getAttribute("transform") || ""
      );
      return { label: t.textContent, x: m ? parseFloat(m[1]) : null };
    })
  );
  const cat = cols.find((c) => c.label === "category");
  const y0b = await page.evaluate(() => window.nv.y0);
  const rowSpan = 400 / 5;
  await page.mouse.click(
    box.x + cat.x + 7.5,
    box.y + y0b + rowSpan * 0 + rowSpan / 2
  );
  expect(await chips(page)).toEqual(["Ⓧ category == a"]);

  await page.evaluate(() => window.nv.sortBy("value", false, 0));

  // A value filter compares raw attribute values, so ordering is irrelevant
  // to it and its label stays exactly as it was.
  expect(await chips(page)).toEqual(["Ⓧ category == a"]);
});

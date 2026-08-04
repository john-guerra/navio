import { test, expect } from "@playwright/test";

// Regression tests for https://github.com/john-guerra/navio/issues/81.
//
// nv.sortBy() recorded the sort in dSortBy and called nv.update(), which only
// redraws - updateSorting was never reached, so the data was not reordered.
// It failed deceptively: the column header gained its sort arrow, so it looked
// like it had worked.
//
// Fixture: rows a..f with rank 1..6 and other 60..10 (inverse), grp x/y/x/y/x/y.

const order = (page) =>
  page.evaluate(() =>
    window.nv
      .getRowsAtLevel(0)
      .map((d) => d.id)
      .join(" ")
  );

test("sortBy reorders the data, not just the label", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/sort-after-range.html");
  expect(await order(page)).toBe("a b c d e f");

  await page.evaluate(() => window.nv.sortBy("other", false, 0));

  expect(await order(page)).toBe("f e d c b a");
  expect(
    await page.evaluate(() => window.nv.sortBy(undefined, false, 0))
  ).toEqual({ attrib: "other", desc: false });
});

test("sortBy honours the descending flag", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/sort-after-range.html");

  await page.evaluate(() => window.nv.sortBy("rank", true, 0));

  expect(await order(page)).toBe("f e d c b a");
});

test("sortBy reaches the same result as clicking the header", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/sort-after-range.html");
  await page.evaluate(() => window.nv.sortBy("grp", false, 0));
  const viaApi = await order(page);

  await page.goto("/test/e2e/fixtures/sort-after-range.html");
  const target = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll(".attribOverlay text")).find(
      (n) => n.textContent.startsWith("grp")
    );
    const b = t.getBoundingClientRect();
    return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
  });
  await page.mouse.click(target.cx, target.cy);
  await page.evaluate(
    () =>
      new Promise((res) =>
        requestAnimationFrame(() => requestAnimationFrame(res))
      )
  );
  const viaUi = await order(page);

  expect(viaApi).toBe(viaUi);
});

test("sorting programmatically preserves an existing selection, like the UI does", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/sort-after-range.html");
  const box = await page.locator("#nv canvas").boundingBox();
  const rowSpan = (400 - 10 - 30 - 100) / 6;
  const rowMid = (i) => box.y + 100 + rowSpan * i + rowSpan / 2;

  await page.mouse.move(box.x + 37, rowMid(1));
  await page.mouse.down();
  await page.mouse.move(box.x + 37, rowMid(3), { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.selectedIds().join(" "))).toBe(
    "b c d"
  );

  await page.evaluate(() => window.nv.sortBy("grp", false, 0));

  // Same contract as the UI path: filters are evaluated once, at creation, so
  // re-sorting cannot change which rows are selected. See
  // docs/ai/FILTERING-MODEL.md section 4.
  expect(await order(page)).toBe("a c e b d f");
  expect(await page.evaluate(() => window.selectedIds().join(" "))).toBe(
    "b c d"
  );
});

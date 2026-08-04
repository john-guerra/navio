import { test, expect } from "@playwright/test";

// invertOrdinalScale caches its inverted quantize scale per scale object (#62).
// yScales[level] is replaced wholesale on update so WeakMap keying invalidates
// those, but xScale and levelScale are mutated IN PLACE - their entries only go
// away because updateScales calls invalidateInvertCache(). Drop that call and
// the tooltip names the wrong column under the cursor: silent, and it also
// misdirects click-to-filter, since onSelectByValue inverts the same scale.

/** Hover across the columns and report the reported name at each x. */
async function columnRuns(page, step = 3) {
  const box = await page.locator("#nv canvas").boundingBox();
  const y = box.y + (await page.evaluate(() => window.nv.y0)) + 25;
  const width = await page.evaluate(
    () => window.nv.attribWidth * window.nv.getAttribs().length
  );

  const runs = [];
  for (let dx = 2; dx < width; dx += step) {
    await page.mouse.move(box.x + dx, y);
    const name = await page.locator(".tool_value_name").innerText();
    if (runs.length && runs[runs.length - 1].name === name) {
      runs[runs.length - 1].px += step;
    } else {
      runs.push({ name, px: step });
    }
  }
  return runs;
}

test("column hit-testing follows attribWidth after a hardUpdate", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // Populate the cache with the CURRENT geometry first. Without this the cache
  // is cold when the width changes, gets filled with correct values, and the
  // test passes even with invalidateInvertCache() removed.
  const box0 = await page.locator("#nv canvas").boundingBox();
  const y0 = await page.evaluate(() => window.nv.y0);
  await page.mouse.move(box0.x + 20, box0.y + y0 + 25);
  await expect(page.locator("._nv_popover")).toBeVisible();

  // Now change the x geometry, which rewrites xScale's domain and range IN
  // PLACE - same object, so only the explicit invalidation clears the entry.
  await page.evaluate(() => {
    window.nv.attribWidth = 30;
    window.nv.hardUpdate();
  });

  const runs = await columnRuns(page);
  expect(runs.length).toBeGreaterThan(2);

  // Interior runs must each be about one column wide. With a stale cache they
  // come out at the OLD attribWidth, and the last column swallows the rest.
  const interior = runs.slice(1, -1);
  expect(interior.length).toBeGreaterThan(1);
  for (const run of interior) {
    expect(
      Math.abs(run.px - 30),
      `column "${run.name}" measured ${run.px}px, expected ~30`
    ).toBeLessThan(10);
  }
});

test("row hit-testing survives a re-sort", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const box = await page.locator("#nv canvas").boundingBox();
  const g = await page.evaluate(() => ({
    y0: window.nv.y0,
    aw: window.nv.attribWidth,
  }));
  // Hover a fixed point, then re-sort and hover the same point. yScales[level]
  // is rebuilt by the sort, so the cached entry must not be reused.
  const readAt = async (dy) => {
    await page.mouse.move(box.x + g.aw * 2.5, box.y + g.y0 + dy);
    return page.locator(".tool_id").innerText();
  };

  const before = await readAt(30);
  await page.evaluate(() => window.nv.sortBy("value", true));
  const after = await readAt(30);

  // Descending by value puts a different row at the same pixel.
  expect(before).not.toBe(after);
  // And the reported id is a real row, not a stale one.
  const ids = await page.evaluate(() =>
    window.nv.getRowsAtLevel(0).map((r) => String(r.id))
  );
  expect(ids).toContain(after);
});

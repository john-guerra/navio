import { test, expect } from "@playwright/test";

// A numeric column that contains a few strings. Found on
// 202105-citibike-tripdata.csv, where end_station_id is numeric except for 190
// rows out of 2,724,165.

const F = "/test/e2e/fixtures/scale-types.html";

test.describe("a numeric column with stray strings", () => {
  // citibike's end_station_id is numeric except for 190 rows of "JC095",
  // "HB102", "SYS035" - Jersey City, Hoboken and system stations. extentAt's
  // validity test is d3.extent's (`v != null && v >= v`), which STRINGS pass.
  // Once a string lands in min/max, every later number-vs-string comparison is
  // NaN, so it is never replaced: the domain came out ["HB102", "SYS035"] and
  // scaleSequential returned NaN for every real id.
  //
  // Reaching it needs a sort first, because unsorted the first row is numeric.
  // Sorting citibike by end_lng floats Jersey City to the top - the westernmost
  // stations - and then any colour-domain recompute hits a string first.
  // Measured: 174 distinct colours before, 2 after, 269 of 270 samples black.
  test("stray strings do not kill the colour scale", async ({ page }) => {
    await page.goto(F);
    await expect(page.locator("#nv canvas")).toHaveCount(1);

    const before = await page.evaluate(() => window.columnColours("mixedIds"));
    expect(before).toBeGreaterThan(10); // healthy to start with

    // The user's sequence: sort, then re-type a column from the settings panel,
    // which rebuilds every colour domain with the data in its sorted order.
    await page.evaluate(() => window.nv.sortBy("sortKey"));
    await page.evaluate(() => window.nv.setAttribType("allPositive", "div"));
    await page.waitForTimeout(100);

    const after = await page.evaluate(() => window.columnColours("mixedIds"));
    expect(after).toBeGreaterThan(10);
  });

  test("the strings are reported rather than silently dropped", async ({
    page,
  }) => {
    const warnings = [];
    page.on("console", (m) => {
      if (m.type() === "warning") warnings.push(m.text());
    });
    await page.goto(F);
    await expect(page.locator("#nv canvas")).toHaveCount(1);
    await page.evaluate(() => window.nv.sortBy("sortKey"));
    await page.evaluate(() => window.nv.setAttribType("allPositive", "div"));
    await page.waitForTimeout(100);

    // Named, so a mixed-type column is findable instead of just mis-coloured.
    expect(warnings.join("\n")).toMatch(/mixedIds/);
  });
});

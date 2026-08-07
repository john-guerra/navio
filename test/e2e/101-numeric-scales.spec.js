import { test, expect } from "@playwright/test";

// Two ways a numeric column stops carrying information, both found on
// 202105-citibike-tripdata.csv (2,724,165 rows) and both measured there.

const F = "/test/e2e/fixtures/scale-types.html";

test.describe("guessing diverging", () => {
  // addAllAttribs used to pick diverging whenever the minimum was negative.
  // updateColorDomains builds a diverging domain as [-absMax, absMax] around
  // zero - "Assumes diverging point on 0" - so a column that never crosses zero
  // gets a domain roughly twice its own magnitude with every value crammed into
  // one end. citibike's start_lng runs -74.02564..-73.886312, which is 0.139 of
  // a 148.05-wide domain: 0.094% of the ramp. Measured on the canvas: 3 distinct
  // colours in 230 samples, 229 of them the same brown.
  test("a column that never crosses zero is sequential, not diverging", async ({
    page,
  }) => {
    await page.goto(F);
    await expect(page.locator("#nv canvas")).toHaveCount(1);

    expect(
      await page.evaluate(() => window.nv.getAttribType("allNegative"))
    ).toBe("seq");
    // And it actually renders a range rather than one flat colour.
    expect(
      await page.evaluate(() => window.columnColours("allNegative"))
    ).toBeGreaterThan(10);
  });

  test("a column that does cross zero is still diverging", async ({ page }) => {
    await page.goto(F);
    await expect(page.locator("#nv canvas")).toHaveCount(1);

    expect(
      await page.evaluate(() => window.nv.getAttribType("straddling"))
    ).toBe("div");
  });

  test("an all-positive column is unaffected", async ({ page }) => {
    await page.goto(F);
    await expect(page.locator("#nv canvas")).toHaveCount(1);

    expect(
      await page.evaluate(() => window.nv.getAttribType("allPositive"))
    ).toBe("seq");
  });
});

import { test, expect } from "@playwright/test";

// examples/theme demonstrates nv.theme. The page swaps its OWN background with
// the buttons, so the thing to check is that the widget's chrome follows it -
// black headers on a black page were the original complaint.

const EXAMPLE = "/examples/theme/";

const headerLightness = (page) =>
  page.evaluate(() => {
    const t = document.querySelector("#nv svg .attribOverlay text");
    const m = getComputedStyle(t).fill.match(/\d+/g).map(Number);
    return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
  });

test("the widget follows the page's own light/dark buttons", async ({
  page,
}) => {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(EXAMPLE);
  await expect(page.locator("#nv canvas")).toHaveCount(1, { timeout: 20000 });

  await page.locator('#buttons button[data-value="light"]').click();
  expect(await headerLightness(page), "dark ink on a light page").toBeLessThan(
    90
  );

  await page.locator('#buttons button[data-value="dark"]').click();
  expect(
    await headerLightness(page),
    "light ink on a dark page"
  ).toBeGreaterThan(140);

  expect(errors).toEqual([]);
});

test("the data colours do not change with the theme", async ({ page }) => {
  await page.goto(EXAMPLE);
  await expect(page.locator("#nv canvas")).toHaveCount(1, { timeout: 20000 });

  const scale = () =>
    page.evaluate(() => {
      const s = window.nv.getColorScale("group");
      return s.domain().map((v) => s(v));
    });

  await page.locator('#buttons button[data-value="light"]').click();
  const light = await scale();
  await page.locator('#buttons button[data-value="dark"]').click();

  // Chrome adapts; the encoding does not.
  expect(await scale()).toEqual(light);
});

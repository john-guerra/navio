import { test, expect } from "@playwright/test";

// examples/palettes shows how to change nv.defaultColorCategorical. The data is
// nutrients.csv, whose `group` column has 25 categories - more than a ten-colour
// scheme can carry, which is the thing the example exists to demonstrate.
//
// The point of pinning an example is that it keeps WORKING: one that throws, or
// that quietly stops demonstrating its own claim, is worse than none.

const EXAMPLE = "/examples/palettes/";

const ready = async (page) => {
  // d3 and popper come from a CDN here, as in the other example fixtures.
  await expect(page.locator("#nv canvas")).toHaveCount(1, { timeout: 20000 });
};

/** The colours actually assigned, one per category. */
const assigned = (page) =>
  page.evaluate(() => window.nv.getColorScale("group").range().slice(0, 25));

test("it loads and draws, without errors", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(EXAMPLE);
  await ready(page);

  expect(errors).toEqual([]);
});

test("the default gives 25 categories 25 colours", async ({ page }) => {
  await page.goto(EXAMPLE);
  await ready(page);

  // The claim in the first paragraph, checked.
  expect(new Set(await assigned(page)).size).toBe(25);
});

test("picking category10 shows the recycling the page describes", async ({
  page,
}) => {
  await page.goto(EXAMPLE);
  await ready(page);

  await page.locator('#buttons button[data-key="category10"]').click();
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // Ten colours for 25 categories: the failure the example is about.
  await expect.poll(async () => new Set(await assigned(page)).size).toBe(10);
});

test("every palette button draws something", async ({ page }) => {
  await page.goto(EXAMPLE);
  await ready(page);

  const names = await page.evaluate(() =>
    [...document.querySelectorAll("#buttons button")].map((b) => b.dataset.key)
  );
  expect(names.length).toBeGreaterThan(3);

  for (const name of names) {
    await page.locator(`#buttons button[data-key="${name}"]`).click();
    await expect(page.locator("#nv canvas"), name).toHaveCount(1);
    expect((await assigned(page)).length, name).toBeGreaterThan(0);
  }
});

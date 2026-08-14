import { test, expect } from "@playwright/test";

// Categorical colour used to come from d3.schemeCategory10, which holds ten
// colours, and d3.scaleOrdinal RECYCLES its range - so category 11 was drawn in
// exactly the colour of category 1 and nothing said so. Two categories sharing
// a colour is a lie about the data that the reader has no way to detect.
//
// The default is now a generated 50-colour palette, and defaultColorCategorical
// accepts a FUNCTION of the category count as well as an array, so a palette can
// be sized to the column.
//
// Note none of this could work before: there was no `cat` branch in
// updateColorDomains at all, so the category count was never known - scaleOrdinal
// simply grew its domain as values arrived.

const F = "/test/e2e/fixtures/palette-option.html";

const load = async (page, query = "") => {
  await page.goto(`${F}${query}`);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
};

const assigned = (page) => page.evaluate(() => window.assigned());

test("25 categories get 25 different colours", async ({ page }) => {
  await load(page, "?cats=25");
  const colours = await assigned(page);

  expect(colours).toHaveLength(25);
  expect(new Set(colours).size, "distinct colours").toBe(25);
});

test("50 categories still get 50 different colours", async ({ page }) => {
  await load(page, "?cats=50");
  const colours = await assigned(page);

  expect(new Set(colours).size).toBe(50);
});

test("the old scheme is still available, and still recycles", async ({
  page,
}) => {
  await load(page, "?cats=25&palette=category10");
  const colours = await assigned(page);

  // Kept as an option so anyone who wants the pre-0.3.0 look can have it -
  // including the recycling, which is what it does.
  expect(colours).toHaveLength(25);
  expect(new Set(colours).size).toBe(10);
});

test("a palette can be a function of the category count", async ({ page }) => {
  await load(page, "?cats=25&custom=fn");

  // Called with the real count, not a guess.
  expect(await page.evaluate(() => window.calledWith)).toContain(25);
  expect(new Set(await assigned(page)).size).toBe(25);
});

test("a built-in generator is sized to the data", async ({ page }) => {
  await load(page, "?cats=32&palette=turbo");
  const colours = await assigned(page);

  expect(colours).toHaveLength(32);
  expect(new Set(colours).size).toBe(32);
});

test("an array shorter than the data warns, once, and says what to do", async ({
  page,
}) => {
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });

  await load(page, "?cats=25&custom=array");

  // Three colours for 25 categories still recycles - that is scaleOrdinal - but
  // it is no longer silent, and the message names the way out.
  const recycling = warnings.filter((w) => w.includes("colours repeat"));
  expect(recycling, "warned exactly once").toHaveLength(1);
  expect(recycling[0]).toContain("25 categories");
  expect(recycling[0]).toContain("navio.palettes");
});

test("navio.palettes exposes the built-ins", async ({ page }) => {
  await load(page, "?cats=12");

  const shape = await page.evaluate(() => {
    const p = window.navio.palettes;
    return {
      names: Object.keys(p).sort(),
      nameableLength: p.nameable.length,
      turboIsFunction: typeof p.turbo === "function",
      // Cyclical interpolators sampled at i/n must not repeat their endpoints.
      rainbowEndsDiffer: p.rainbow(10)[0] !== p.rainbow(10)[9],
    };
  });

  expect(shape.names).toEqual([
    "category10",
    "distinct",
    "mokole",
    "nameable",
    "rainbow",
    "sinebow",
    "tableau10",
    "turbo",
  ]);
  expect(shape.nameableLength).toBe(50);
  expect(shape.turboIsFunction).toBe(true);
  expect(shape.rainbowEndsDiffer).toBe(true);
});

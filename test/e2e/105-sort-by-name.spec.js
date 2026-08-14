import { test, expect } from "@playwright/test";

// nv.sortBy(name) did nothing, silently, when the column had been added as an
// accessor FUNCTION rather than a field name.
//
// The guard passed and the sort did not: `dAttribs.has(getAttribName(attrib))`
// resolves the name and finds the column, so no warning fired, but the raw
// string was then handed to the comparator, which read `row["palette A"]` -
// undefined for every row. Rows came back in the order they went in.
//
// It matters because the name is what the user has. Navio prints it on the
// column header and hands the FUNCTION back from getAttribs(), so reading a
// name off the screen and sorting by it is the obvious thing to try, and the
// obvious thing did nothing at all. setFilters already resolves names through
// dAttribs; sortBy simply did not.

const FIXTURE = "/test/e2e/fixtures/fn-attribs.html";

const ready = async (page) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
};

test("sortBy(name) sorts a column added as a function", async ({ page }) => {
  await ready(page);

  // Interleaved to start with: many more blocks than there are categories.
  expect(await page.evaluate(() => window.runs())).toBeGreaterThan(4);

  await page.evaluate(() => window.nv.sortBy("palette A"));

  // Sorted means one block per category, and nothing lost.
  expect(await page.evaluate(() => window.runs()), "blocks after sorting").toBe(
    4
  );
  expect(await page.evaluate(() => window.cats().length)).toBe(40);
});

test("sortBy(theFunction) keeps working", async ({ page }) => {
  await ready(page);

  const runs = await page.evaluate(() => {
    const fn = window.nv
      .getAttribs()
      .find((a) => typeof a === "function" && a.name === "palette A");
    window.nv.sortBy(fn);
    return window.runs();
  });
  expect(runs).toBe(4);
});

test("both columns of the same field group together", async ({ page }) => {
  await ready(page);

  // The point of function attributes: two columns over one field. Sorting by
  // either has to group both, or the comparison they exist for is worthless.
  const runs = await page.evaluate(() => {
    window.nv.sortBy("palette B");
    return window.runs();
  });
  expect(runs).toBe(4);
});

test("an unknown name still warns and changes nothing", async ({ page }) => {
  await ready(page);

  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });

  const before = await page.evaluate(() => window.cats().join(","));
  await page.evaluate(() => window.nv.sortBy("palette Q"));
  const after = await page.evaluate(() => window.cats().join(","));

  expect(after).toBe(before);
  await expect
    .poll(() => warnings.filter((w) => w.includes("palette Q")).length)
    .toBeGreaterThan(0);
});

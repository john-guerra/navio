import { test, expect } from "@playwright/test";

// Regression tests for https://github.com/john-guerra/navio/issues/88.
// Navio used to write __seqId, __i and selected onto the caller's row objects.
// That polluted user data and - because two Navios given the same array share
// the same row OBJECTS - let one instance silently overwrite another's
// selection. Bookkeeping now lives in per-instance side tables.

test("two Navios over the same rows no longer corrupt each other", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/two-instances.html");

  const both = () =>
    page.evaluate(() => ({
      nv1: window.nv1
        .getVisible()
        .map((d) => d.id)
        .sort()
        .join(","),
      nv2: window.nv2
        .getVisible()
        .map((d) => d.id)
        .sort()
        .join(","),
    }));

  expect(await both()).toEqual({ nv1: "1,2,3,4,5", nv2: "1,2,3,4,5" });

  // Filter ONLY nv1.
  await page.evaluate(() =>
    window.nv1.setFilters([[{ type: "value", attrib: "category", value: "a" }]])
  );

  const after = await both();
  expect(after.nv1).toBe("1,3");
  // nv2 was never filtered, so it must still show everything.
  expect(after.nv2).toBe("1,2,3,4,5");
});

test("selected is no longer written onto the caller's rows", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/two-instances.html");
  await page.evaluate(() =>
    window.nv1.setFilters([[{ type: "value", attrib: "category", value: "a" }]])
  );

  const row = await page.evaluate(() => {
    const r = window.nv1.data()[0];
    return { keys: Object.keys(r), json: JSON.stringify(r) };
  });
  expect(row.keys).not.toContain("selected");
  expect(row.json).not.toContain("selected");
});

test("nv.isSelected accepts a row or an index", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await page.evaluate(() =>
    window.nv.setFilters([[{ type: "value", attrib: "category", value: "a" }]])
  );

  const got = await page.evaluate(() => {
    const rows = window.nv.data();
    return {
      byRowSelected: window.nv.isSelected(rows[0]), // category a
      byRowNot: window.nv.isSelected(rows[1]), // category b
      byIndexSelected: window.nv.isSelected(0),
      byIndexNot: window.nv.isSelected(1),
      unknown: window.nv.isSelected({ not: "a row" }),
    };
  });

  expect(got).toEqual({
    byRowSelected: true,
    byRowNot: false,
    byIndexSelected: true,
    byIndexNot: false,
    unknown: false,
  });
});

test("the selected column still renders", async ({ page }) => {
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // "selected" is a real column; it must still be registered and drawn.
  const attribs = await page.evaluate(() =>
    window.nv.getAttribs().map((a) => (typeof a === "function" ? a.name : a))
  );
  expect(attribs).toContain("selected");
  expect(errs).toEqual([]);
});

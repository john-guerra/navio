import { test, expect } from "@playwright/test";

// Tests for https://github.com/john-guerra/navio/issues/89. The headline
// requirement, stated by the maintainer: selections must survive hiding or
// showing columns. That is why this is implemented as a VISIBILITY SET rather
// than as add/remove - hiding touches only the layout, never the filter chain
// or the sort, so a materialised selection cannot be invalidated by it.

const FIXTURE = "/test/e2e/fixtures/single.html";

const open = async (page) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();
  await expect(page.locator("#nv ._nv_settings")).toBeVisible();
};

test("the gear opens and closes the panel", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const gear = page.locator("#nv ._nv_gear");
  await expect(gear).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#nv ._nv_settings")).toBeHidden();

  await gear.click();
  await expect(page.locator("#nv ._nv_settings")).toBeVisible();
  await expect(gear).toHaveAttribute("aria-expanded", "true");

  // Escape closes it and returns focus to the gear.
  await page.keyboard.press("Escape");
  await expect(page.locator("#nv ._nv_settings")).toBeHidden();
  await expect(gear).toBeFocused();
});

test("unticking a column hides it without touching the data", async ({
  page,
}) => {
  await open(page);
  const before = await page.evaluate(
    () => window.nv.getVisibleAttribs().length
  );

  await page.locator("#nv ._nv_settings input[type=checkbox]").nth(3).uncheck();

  await expect
    .poll(() => page.evaluate(() => window.nv.getVisibleAttribs().length))
    .toBe(before - 1);
  // getAttribs() is the full set and is unchanged - this is hiding, not removal.
  expect(await page.evaluate(() => window.nv.getAttribs().length)).toBe(before);
  expect(await page.evaluate(() => window.nv.getHiddenAttribs())).toHaveLength(
    1
  );
});

// The requirement that drove the whole design.
test("selections and sort order survive hiding and showing columns", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const state = () =>
    page.evaluate(() => ({
      visible: window.nv
        .getVisible()
        .map((r) => r.id)
        .join(","),
      order: window.nv
        .getRowsAtLevel(0)
        .map((r) => r.id)
        .join(","),
      filters: JSON.stringify(window.nv.getFilters().filter((l) => l.length)),
    }));

  await page.evaluate(() => window.nv.sortBy("value", true));
  await page.evaluate(() =>
    window.nv.setFilters([[{ type: "value", attrib: "category", value: "a" }]])
  );
  const baseline = await state();
  expect(baseline.visible).not.toBe("");

  // Hide the column the FILTER is on.
  await page.evaluate(() => window.nv.setAttribVisible("category", false));
  expect(await state()).toEqual(baseline);

  // Hide the column the SORT is on. Sorting is in place, so the order stands.
  await page.evaluate(() => window.nv.setAttribVisible("value", false));
  expect(await state()).toEqual(baseline);

  // And bringing them back changes nothing either.
  await page.evaluate(() => window.nv.setHiddenAttribs([]));
  expect(await state()).toEqual(baseline);
});

test("hiding a column emits no change event, so bound peers stay put", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const fired = await page.evaluate(() => {
    let n = 0;
    window.nv.onChange(() => n++);
    window.nv.setAttribVisible("category", false);
    window.nv.setHiddenAttribs([]);
    return n;
  });
  expect(fired).toBe(0);
});

test("the attribute picker is pluggable", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // Any element will do; the contract is (names, {value, onChange, move}).
  const got = await page.evaluate(() => {
    let seen = null;
    window.nv.attribPicker = (names, opts) => {
      seen = { names, value: opts.value };
      const el = document.createElement("div");
      el.className = "_nv_custom_picker";
      el.textContent = names.join("|");
      return el;
    };
    document.querySelector("#nv ._nv_gear").click();
    return seen;
  });

  expect(got.names.length).toBeGreaterThan(3);
  expect(got.value).toHaveLength(got.names.length);
  await expect(page.locator("#nv ._nv_custom_picker")).toHaveCount(1);
  // The default picker is not also rendered.
  await expect(
    page.locator("#nv ._nv_settings input[type=checkbox]")
  ).toHaveCount(1); // just the nestedFilters toggle
});

test("nv.settings = false removes the gear entirely", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.evaluate(() => {
    window.nv.settings = false;
    window.nv.data(window.nv.data()); // re-init
  });
  await expect(page.locator("#nv ._nv_gear")).toHaveCount(0);
});

test("destroy() takes the panel with it", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.nv.destroy());
  await expect(page.locator("#nv ._nv_gear")).toHaveCount(0);
  await expect(page.locator("#nv ._nv_settings")).toHaveCount(0);
});

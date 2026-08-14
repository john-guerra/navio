import { test, expect } from "@playwright/test";

// Navio ships no stylesheet - every colour and every box it draws is an inline
// style or a canvas stroke - so that it can be dropped into any page without
// fighting it. That only works in one direction unless it is deliberate about
// the other: the settings panel is built from real <button>, <select> and
// <input> elements, and anything Navio leaves unset belongs to the host.
//
// A page with `button { margin: 0 6px 12px 0 }` - an ordinary rule for a page
// that has buttons of its own - added 11px to EVERY row of the attribute list,
// taking the pitch from 25px to 36px. With 19 attributes that is 209px of
// invented height, and it looked like Navio had grown its own spacing.

const F = "/test/e2e/fixtures/hostile-css.html";

const open = async (page, query = "") => {
  await page.goto(`${F}${query}`);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();
  await expect(page.locator("#nv ._nv_settings select")).not.toHaveCount(0);
};

test("a host page's button and input rules do not change the panel", async ({
  page,
}) => {
  await open(page, "?hostile=0");
  const plain = await page.evaluate(() => window.rowPitch());
  expect(plain, "a row has a height at all").toBeGreaterThan(0);

  await open(page);
  expect(await page.evaluate(() => window.rowPitch())).toBe(plain);
});

test("the panel's own buttons keep their size", async ({ page }) => {
  const measure = async (query) => {
    await open(page, query);
    return page.evaluate(() => {
      const b = document.querySelector("#nv ._nv_settings button");
      const cs = getComputedStyle(b);
      return { margin: cs.margin, padding: cs.padding };
    });
  };

  expect(await measure("")).toEqual(await measure("?hostile=0"));
});

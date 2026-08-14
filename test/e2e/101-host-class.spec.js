import { test, expect } from "@playwright/test";

// #101. init() set the container's class with `.attr("class", "navio")`, which
// REPLACES the attribute. Every class the host page had on that element was
// dropped, so the page's own styling stopped applying - with no error, and
// nothing in the DOM to say Navio had done it. The widget still renders
// correctly, which is what makes it read as a broken stylesheet rather than as
// a widget overwriting an attribute.
//
// Navio is a guest in that element. It may add to the class attribute; it may
// not own it.

const FIXTURE = "/test/e2e/fixtures/host-attributes.html";

const classesOf = (page) =>
  page.evaluate(() => [...document.querySelector("#nv").classList].sort());

test("the page's own classes survive construction", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  expect(await classesOf(page)).toEqual(["card", "featured", "navio"]);
});

test("the page's styling still applies", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // The point of keeping the class, rather than the class itself: .card's rule
  // has to still reach the element. Asserting on the rendered style is what
  // makes this test about the consequence and not about the implementation.
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector("#nv")).borderTopColor
    )
  ).toBe("rgb(0, 128, 0)");
});

test("other attributes are left alone", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  expect(
    await page.evaluate(() => document.querySelector("#nv").dataset.keep)
  ).toBe("yes");
});

test("destroy() gives the class attribute back", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  await page.evaluate(() => window.nv.destroy());

  // Navio adds to an attribute the page also owns, so it has to take its own
  // entry out again - the same reason the settings panel puts a lifted
  // `overflow` back (#100).
  expect(await classesOf(page)).toEqual(["card", "featured"]);
});

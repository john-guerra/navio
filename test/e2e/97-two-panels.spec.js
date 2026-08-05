import { test, expect } from "@playwright/test";

// Reported from a notebook with two Navios: "the selectors in the
// configuration panel stopped working", and the panel "showed in the wrong
// location because I had two navios".
//
// The panel opens BELOW its widget, which on a page that stacks Navios - a
// notebook, this fixture - is exactly where the NEXT Navio sits. Both panels
// could be open at once, so the upper widget's panel was painted over the
// lower widget's own controls and clicks landed on the wrong one.

const TWO = "/test/e2e/fixtures/two-instances.html";

const openPanels = (page) =>
  page.evaluate(() => document.querySelectorAll("._nv_settings[open]").length);

test("opening one panel closes the other instance's", async ({ page }) => {
  await page.goto(TWO);
  await page.waitForSelector("canvas");

  await page.locator("#nv1 ._nv_gear").click();
  expect(await openPanels(page)).toBe(1);

  // nv1's panel lies over nv2's gear, so the first pointer there is the light
  // dismiss and the second reaches the gear. Never both panels at once.
  await page.locator("#nv2 ._nv_gear").click();
  expect(await openPanels(page)).toBe(0);
  await page.locator("#nv2 ._nv_gear").click();

  expect(await openPanels(page)).toBe(1);
  expect(
    await page.evaluate(
      () => !!document.querySelector("#nv2 ._nv_settings").open
    )
  ).toBe(true);
  // The gear of whichever panel got closed has to follow, even though another
  // instance is what closed it.
  await expect(page.locator("#nv1 ._nv_gear")).toHaveAttribute(
    "aria-expanded",
    "false"
  );
});

test("the second widget's own controls are reachable, not covered", async ({
  page,
}) => {
  await page.goto(TWO);
  await page.waitForSelector("canvas");
  await page.locator("#nv1 ._nv_gear").click();

  // nv1's panel is absolutely positioned, so it OVERLAYS nv2 rather than
  // pushing it down - that is deliberate, nothing on the page should reflow.
  // It therefore lies over nv2's own gear.
  expect(
    await page.evaluate(() => {
      const p = document
        .querySelector("#nv1 ._nv_settings")
        .getBoundingClientRect();
      const g = document
        .querySelector("#nv2 ._nv_gear")
        .getBoundingClientRect();
      return (
        p.left < g.right &&
        p.right > g.left &&
        p.top < g.bottom &&
        p.bottom > g.top
      );
    })
  ).toBe(true);

  // Light dismiss is what makes that survivable: a pointer landing outside the
  // panel closes it, so the user's next click reaches the control they were
  // aiming at instead of being eaten by a panel from further up the page.
  await page.locator("#nv2 ._nv_gear").click();
  await expect.poll(() => openPanels(page)).toBe(0);

  await page.locator("#nv2 ._nv_gear").click();
  expect(
    await page.evaluate(
      () => !!document.querySelector("#nv2 ._nv_settings").open
    )
  ).toBe(true);
});

test("a select changes only its own instance", async ({ page }) => {
  await page.goto(TWO);
  await page.waitForSelector("canvas");

  const orientOf = (host) =>
    page
      .locator(`${host} ._nv_settings select`)
      .filter({ has: page.locator('option[value="vertical"]') });

  await page.locator("#nv2 ._nv_gear").click();
  await orientOf("#nv2").selectOption("vertical");
  await expect
    .poll(() =>
      page.evaluate(() => [window.nv1.orientation, window.nv2.orientation])
    )
    .toEqual(["horizontal", "vertical"]);
});

// drawSettingsPanel wipes the panel and rebuilds it on every type change and
// reorder, which destroys whatever had focus. A non-modal dialog only sees
// Escape when focus is inside it, so the panel became impossible to close with
// the keyboard after any change.
test("Escape still closes the panel after a control has been used", async ({
  page,
}) => {
  await page.goto(TWO);
  await page.waitForSelector("canvas");
  await page.locator("#nv1 ._nv_gear").click();

  await page
    .locator('#nv1 ._nv_settings select[aria-label="Type of category"]')
    .selectOption("text");
  await expect
    .poll(() => page.evaluate(() => window.nv1.getAttribType("category")))
    .toBe("text");

  await page.keyboard.press("Escape");
  expect(await openPanels(page)).toBe(0);
});

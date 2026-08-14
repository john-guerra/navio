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
  // Two 400-record widgets, each now also carrying a header band and a count
  // reserve, stack past the default 720px viewport - and a gear below the fold
  // puts the panel's viewport clamp in charge of the geometry instead of the
  // widget. Give them room, so this stays a test about two panels.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(TWO);
  await expect(page.locator("canvas").first()).toBeVisible();

  await page.locator("#nv1 ._nv_gear").click();
  expect(await openPanels(page)).toBe(1);

  // nv1's panel lies over nv2's gear, but the gear paints ABOVE it - both are
  // z-index 6 and nv2's container comes later in the document - so the pointer
  // reaches the gear itself. That one click does both jobs: light dismiss
  // closes nv1's panel and the gear opens nv2's. Never both at once, which is
  // the invariant this test exists for.
  //
  // It used to take two clicks, and that was an artifact of the fixture rather
  // than of the widget: nv2's gear sat below the default 720px viewport, so
  // Playwright scrolled before clicking. Measured on both builds, the gear is
  // the topmost element at its own centre either way.
  await page.locator("#nv2 ._nv_gear").click();
  await expect.poll(() => openPanels(page)).toBe(1);
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
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(TWO);
  await expect(page.locator("canvas").first()).toBeVisible();
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

  // And it is still reachable, in one click: the gear paints above the panel,
  // so the pointer lands on the control the user aimed at rather than being
  // eaten by a panel belonging to a widget further up the page. Light dismiss
  // takes nv1's panel away in the same gesture.
  await page.locator("#nv2 ._nv_gear").click();
  await expect.poll(() => openPanels(page)).toBe(1);
  expect(
    await page.evaluate(
      () => !!document.querySelector("#nv2 ._nv_settings").open
    )
  ).toBe(true);
});

test("a select changes only its own instance", async ({ page }) => {
  await page.goto(TWO);
  await expect(page.locator("canvas").first()).toBeVisible();

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
  await expect(page.locator("canvas").first()).toBeVisible();
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

import { test, expect } from "@playwright/test";

// Reported as "the settings popup disappears when I change the proportions".
// It never closed - it ran away. The panel is placed against the widget, and
// nv.update repositions it whenever the canvas changes size, so dragging
// "Size along records" from 420 to 1180 marched a below-placed panel 760px
// down the page: the slider left the cursor that was holding it and went off
// the bottom of the screen mid-drag.
//
// Two things keep it reachable: placeSettingsPanel refuses to move while a
// pointer is held on one of the panel's own controls, and the settled position
// is clamped into the viewport afterwards.

const FIXTURE = "/test/e2e/fixtures/vertical.html?orientation=horizontal&n=40";

const sliderIn = (page, root, label) =>
  page
    .locator(`${root} ._nv_settings label`)
    .filter({ hasText: label })
    .locator('input[type="range"]');

test("a slider does not walk away from the cursor holding it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();

  const slider = sliderIn(page, "#nv", "Size along records");
  const before = await slider.boundingBox();

  await page.mouse.move(
    before.x + before.width * 0.3,
    before.y + before.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    before.x + before.width * 0.9,
    before.y + before.height / 2,
    {
      steps: 10,
    }
  );

  // The widget really did resize - this is not a no-op drag.
  expect(await page.evaluate(() => window.nv.height())).toBeGreaterThan(600);
  // ...and the control is still exactly where the pointer left it.
  const mid = await slider.boundingBox();
  expect(Math.abs(mid.y - before.y)).toBeLessThanOrEqual(1);

  await page.mouse.up();
});

test("the panel stays on screen after a big resize", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();

  const slider = sliderIn(page, "#nv", "Size along records");
  const b = await slider.boundingBox();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.9, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();

  // A 1180px-tall widget does not fit a 1000px window, so an unclamped panel
  // anchored under the canvas would sit entirely below the fold.
  const m = await page.evaluate(() => {
    const r = document
      .querySelector("#nv ._nv_settings")
      .getBoundingClientRect();
    return {
      open: document.querySelector("#nv ._nv_settings").open,
      top: r.top,
      bottom: r.bottom,
      vh: window.innerHeight,
    };
  });
  expect(m.open).toBe(true);
  expect(m.top).toBeLessThan(m.vh);
  expect(m.bottom).toBeGreaterThan(0);
});

test("column width still leaves the panel alone", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();

  const slider = sliderIn(page, "#nv", "Column width");
  const b = await slider.boundingBox();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.8, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  expect(await page.evaluate(() => window.nv.attribWidth)).toBeGreaterThan(15);
  // Column width changes the canvas WIDTH, and a below-placed panel is
  // anchored to its bottom, so this one never moved it in the first place.
  const now = await slider.boundingBox();
  expect(Math.abs(now.y - b.y)).toBeLessThanOrEqual(1);
});

// The report came from the binding example, which stacks two Navios - the case
// where an open panel from the upper widget lies over the lower one.
test("the binding example's two widgets each keep their panel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto("/examples/binding/");
  await page.waitForSelector("canvas");

  const gears = page.locator("._nv_gear");
  expect(await gears.count()).toBeGreaterThanOrEqual(2);
  await gears.first().click();

  const panel = page.locator("._nv_settings[open]");
  await expect(panel).toHaveCount(1);

  const slider = panel
    .locator("label")
    .filter({ hasText: "Size along records" })
    .locator('input[type="range"]');
  // The panel scrolls inside itself (max-height: 70vh), and boundingBox does
  // not scroll for you the way an action would.
  await slider.scrollIntoViewIfNeeded();
  const b = await slider.boundingBox();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.75, b.y + b.height / 2, {
    steps: 10,
  });

  const mid = await slider.boundingBox();
  expect(Math.abs(mid.y - b.y)).toBeLessThanOrEqual(1);

  await page.mouse.up();
  await page.waitForTimeout(150);
  // Still open, still exactly one panel: dragging must not trip light dismiss
  // or the close-the-other-instance rule.
  await expect(page.locator("._nv_settings[open]")).toHaveCount(1);
});

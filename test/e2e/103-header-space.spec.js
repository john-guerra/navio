import { test, expect } from "@playwright/test";

// The header band was a fixed `y0: 100` carved OUT of `height`, which made it
// wrong in both directions at once:
//
//   - too small: long rotated names overflowed it and were destroyed. Not
//     scrolled out of view - destroyed. They are drawn at negative offsets
//     inside a scroll box, and a scroll box only exposes overflow in the
//     POSITIVE direction, so scrollHeight === clientHeight and there is no
//     scrollbar to reach them;
//   - too large: short names, and even `showAttribTitles: false`, still cost
//     the full 100px.
//
// And because it was carved out of `height`, whatever it cost came off the data.
// A 180px widget spent 100px on headers and left 40px of rows.
//
// `height` now means the RECORD extent - the data area is `height` whatever the
// names are - and the band is measured from the labels actually drawn.

const F = "/test/e2e/fixtures/header-space.html";
const NV_MARGIN = 10; // nv.margin default - the breathing room left when the band is 0

const ready = async (page) => {
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await expect(page.locator("#nv .brush .overlay")).toHaveCount(1);
};

const read = (page) =>
  page.evaluate(() => ({
    dataExtent: window.dataExtent(),
    headerOverflow: window.headerOverflow(),
    y0: window.nv.y0,
  }));

test("the data area is `height`, whatever the names are", async ({ page }) => {
  await page.goto(`${F}?names=long&height=180`);
  await ready(page);
  const long = await read(page);

  await page.goto(`${F}?names=short&height=180`);
  await ready(page);
  const short = await read(page);

  // The headline: naming an attribute does not cost the user their data area.
  expect(long.dataExtent).toBe(180);
  expect(short.dataExtent).toBe(180);
});

test("the band fits the longest label instead of a fixed 100", async ({
  page,
}) => {
  await page.goto(`${F}?names=short&height=180`);
  await ready(page);
  const short = await read(page);

  await page.goto(`${F}?names=long&height=180`);
  await ready(page);
  const long = await read(page);

  // The band tracks the labels instead of sitting at a constant...
  expect(long.y0).toBeGreaterThan(short.y0);
  // ...and long names get what they need instead of being cut off.
  expect(long.headerOverflow).toBe(0);
});

// With the derived columns on - the default - "sequential Index" is the widest
// label whatever the user's attributes are called, and at the default font it
// needs about 100px on its own. That is almost certainly where the old fixed
// default came from. The saving from measuring only shows once it is out of the
// way, so this is the test that the band can actually get SMALL.
test("short names cost little once the derived columns are off", async ({
  page,
}) => {
  await page.goto(`${F}?names=short&derived=0&height=180`);
  await ready(page);
  const m = await read(page);

  // Measured at 40 for single-character names - margin plus the glyph height,
  // and little else. Asserted loosely because the exact number is font metrics,
  // which differ by platform; the claim is that it is nowhere near the 100 it
  // used to cost regardless.
  expect(m.y0).toBeLessThan(60);
  expect(m.dataExtent).toBe(180);
});

test("headers turned off cost nothing", async ({ page }) => {
  await page.goto(`${F}?names=long&titles=0&height=180`);
  await ready(page);

  // 100px of headroom for headers that are not drawn.
  expect((await read(page)).y0).toBeLessThanOrEqual(NV_MARGIN);
});

test("it transposes: vertical measures along the record axis too", async ({
  page,
}) => {
  await page.goto(`${F}?names=long&orientation=vertical&height=180`);
  await ready(page);
  const m = await read(page);

  expect(m.dataExtent).toBe(180);
  expect(m.headerOverflow).toBe(0);
});

test("moving the Top offset slider takes control of the band", async ({
  page,
}) => {
  await page.goto(`${F}?names=long&height=180`);
  await ready(page);
  await page.locator("#nv ._nv_gear").click();

  const slider = page
    .locator("#nv ._nv_settings label")
    .filter({ hasText: "Top offset" })
    .locator('input[type="range"]');
  await slider.fill("60");
  await slider.dispatchEvent("input");

  // The measurement must not take it straight back. A slider that springs back
  // to a computed value reads as a dead control.
  await expect.poll(() => page.evaluate(() => window.nv.y0)).toBe(60);
  expect(await page.evaluate(() => window.nv.autoHeaderSpace)).toBe(false);
});

test("turning the measurement off survives a reload", async ({ page }) => {
  await page.goto(`${F}?names=long&height=180`);
  await ready(page);
  await page.evaluate(() => {
    window.nv.autoHeaderSpace = false;
    window.nv.y0 = 55;
  });

  const stored = await page.evaluate(() => window.nv.getSettings());
  expect(stored.autoHeaderSpace).toBe(false);
  expect(stored.y0).toBe(55);

  // Restoring it must not quietly switch the measurement back on, which would
  // overwrite the y0 restored alongside it.
  await page.goto(`${F}?names=long&height=180`);
  await ready(page);
  await page.evaluate((cfg) => window.nv.setSettings(cfg), stored);
  await expect.poll(() => page.evaluate(() => window.nv.y0)).toBe(55);
});

test("an explicit y0 still wins", async ({ page }) => {
  await page.goto(`${F}?names=long&y0=140&auto=0&height=180`);
  await ready(page);

  const m = await read(page);
  expect(m.y0).toBe(140);
  // Still the record extent, so the manual band does not eat the data either.
  expect(m.dataExtent).toBe(180);
});

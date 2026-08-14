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
    // Past the CONTAINER: expected once the band is capped, that is the spill.
    headerOverflow: window.headerOverflow(),
    // Past the SCROLL BOX: never expected, that is destroyed pixels.
    headerClipped: window.headerClipped(),
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
  // ...and long names are drawn in full instead of being cut off. Measured
  // against the scroll box, not the container: past the default 140px cap the
  // rest hangs above the widget deliberately, and only what falls outside the
  // BOX is destroyed.
  expect(long.headerClipped).toBe(0);
  expect(short.headerClipped).toBe(0);
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

// A zero band was impossible while y0 was a fixed 100, so nothing sized off it
// had to cope with zero. The header hit strip is `y0 - margin` tall, which
// turns negative the moment the band goes away, and the browser rejects the
// attribute once per column per redraw - visible only in the console.
test("a zero band draws no invalid geometry", async ({ page }) => {
  const bad = [];
  page.on("console", (m) => {
    if (m.type() === "error") bad.push(m.text());
  });

  await page.goto(`${F}?names=long&titles=0&height=180`);
  await ready(page);

  expect(await page.evaluate(() => window.nv.y0)).toBe(0);
  expect(bad.filter((t) => /negative|NaN|not valid/i.test(t))).toEqual([]);
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
  expect(m.headerClipped).toBe(0);
});

// A4. Long names would otherwise grow the widget without limit - the band is
// added on top of `height`, so a 40-character attribute name is 216px of page
// whatever the widget is for. headerMaxSpace bounds what the band RESERVES; the
// rest spills above the container, costing no layout space at all.
//
// The spill is not free: what it paints over, it also owns. A label hanging
// above the widget intercepts clicks on whatever is up there, and pointer-events
// cannot rescue it because the headers need those clicks themselves for sort and
// Shift-drag. Same trade-off as the settings panel in #100, taken deliberately.
test("a capped band stops the widget growing, and the rest spills", async ({
  page,
}) => {
  await page.goto(`${F}?names=long&height=180&cap=60`);
  await ready(page);

  const m = await page.evaluate(() => ({
    y0: window.nv.y0,
    containerH: Math.round(
      document.querySelector("#nv").getBoundingClientRect().height
    ),
    clipped: window.headerClipped(),
    spilled: window.headerOverflow(),
  }));

  // The reserve is bounded, so the widget is bounded: 180 of records + 60 of
  // band + 40 of count reserve. Uncapped this case measured 216px of band.
  expect(m.y0).toBe(60);
  expect(m.containerH).toBe(180 + 60 + 40);
  // The part that did not fit hangs above the widget...
  expect(m.spilled).toBeGreaterThan(0);
  // ...and is still drawn there, not destroyed.
  expect(m.clipped).toBe(0);
});

test("the spilled header does not move the widget itself", async ({ page }) => {
  await page.goto(`${F}?names=long&height=180&cap=60`);
  await ready(page);

  // The block above the widget must stay exactly where the page put it. A
  // negative margin-top would have collapsed with the parent's and dragged the
  // whole widget up instead - measured at 60px in a prototype, which is why
  // this uses `top`.
  const m = await page.evaluate(() => {
    const a = document.querySelector("#above").getBoundingClientRect();
    const nv = document.querySelector("#nv").getBoundingClientRect();
    return { aboveBottom: Math.round(a.bottom), nvTop: Math.round(nv.top) };
  });
  expect(m.nvTop).toBe(m.aboveBottom);
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

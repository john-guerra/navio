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

// The band is measured from the rotated label's reach, which includes half a
// column's bandwidth - so it depends on xScale. applyHeaderBand was running
// BEFORE xScale was rebuilt, measuring against the previous layout, and the
// reserve was a full redraw behind: widening the columns to 60px kept the old
// 40px band, and only the NEXT update caught up at 55. A widget that is not
// redrawn again keeps the wrong band, and the headers sit over the data.
test("the band is measured against the layout it is for", async ({ page }) => {
  await page.goto(`${F}?names=short&derived=0`);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const y0 = () => page.evaluate(() => window.nv.y0);
  const before = await y0();

  await page.evaluate(() => {
    window.nv.attribWidth = 60;
    window.nv.hardUpdate();
  });
  const afterWiden = await y0();

  // Wider columns reach further, so the band must grow - on THIS redraw.
  expect(afterWiden).toBeGreaterThan(before);

  // And it is already settled: a second redraw changes nothing.
  await page.evaluate(() => window.nv.hardUpdate());
  expect(await y0()).toBe(afterWiden);
});

// The scroll box is lifted headerSpill px above the container so the headers
// have somewhere to hang, and everything inside it is pushed back down by the
// same amount to stay put. The canvas and the SVG were; div.explanations, which
// carries the filter chips, was not - so the chips floated headerSpill px above
// the row they describe, up into the data.
test("the filter chips sit where they would with no spill", async ({
  page,
}) => {
  const measure = async (query) => {
    await page.goto(`${F}${query}`);
    await expect(page.locator("#nv canvas")).toHaveCount(1);
    await page.evaluate(() =>
      window.nv.setFilters([
        [
          {
            type: "value",
            attrib: "Departamento academico responsable",
            value: "d1",
          },
        ],
      ])
    );
    await expect(page.locator("#nv .filterExplanation div")).not.toHaveCount(0);

    return page.evaluate(() => {
      const box = document.querySelector("#nv > div");
      const c = document.querySelector("#nv canvas").getBoundingClientRect();
      const chip = document
        .querySelector("#nv .filterExplanation")
        .getBoundingClientRect();
      return {
        // The chip is drawn just under the last record. Measured from the top
        // of the canvas and with y0 taken out, so the two caps - which reserve
        // different amounts and therefore start the records in different places
        // - are directly comparable.
        offset: Math.round(chip.top - c.top - window.nv.y0),
        // Negative only when the box was lifted, which is the case under test.
        lift: box.style.top,
      };
    });
  };

  // cap=0 forces the whole band to spill; a generous cap forces none.
  const spilling = await measure("?cap=0");
  const flat = await measure("?cap=400");

  expect(spilling.lift, "the box really was lifted").toMatch(/^-\d/);
  expect(flat.lift, "and here it was not").toBeFalsy();
  expect(spilling.offset).toBe(flat.offset);
});

// The panel's setters are responsible for leaving the widget redrawn - the
// input handler skips its own hardUpdate for any option that has one, on the
// grounds that "opt.set does its own redraw". Top offset's did not: it turned
// the measurement off and assigned nv.y0, and nothing repainted. The value
// changed, the number beside the slider changed, and the drawing did not move
// until some unrelated interaction happened to redraw it.
test("moving the Top offset slider moves the drawing", async ({ page }) => {
  await page.goto(`${F}?names=long&height=180`);
  await ready(page);

  // Where the records start on screen: the brush covers the record axis, so
  // its top edge is y0 under the top of the canvas.
  const recordsStart = () =>
    page.evaluate(() => {
      const c = document.querySelector("#nv canvas").getBoundingClientRect();
      const o = document
        .querySelector("#nv .brush .overlay")
        .getBoundingClientRect();
      return Math.round(o.top - c.top);
    });

  const before = await recordsStart();

  await page.locator("#nv ._nv_gear").click();
  const slider = page
    .locator("#nv ._nv_settings label")
    .filter({ hasText: "Top offset" })
    .locator('input[type="range"]');
  await slider.fill("60");
  await slider.dispatchEvent("input");

  expect(await page.evaluate(() => window.nv.y0)).toBe(60);
  expect(await recordsStart(), "the records moved with it").not.toBe(before);
});

// Hovering a header grows it to attribFontSizeSelected so it can be read. The
// widget clips - div.navio's inner box is a scroll box in both axes - and a
// scroll box destroys anything above its top edge rather than offering a
// scrollbar for it. So the grown label ran straight out of the widget: 259px
// of a long name was cut off, which is most of it. The label was made bigger
// and became less readable, and the same happened with the band fully reserved
// and nothing spilling, so it was never about the spill.
test("a hovered header grows only as far as it can be seen", async ({
  page,
}) => {
  for (const query of [
    "?names=short&derived=0",
    "?names=short",
    "?names=long",
    "?names=long&cap=400",
  ]) {
    await page.goto(`${F}${query}`);
    await ready(page);

    const labels = page.locator("#nv svg .attribOverlay text");
    const n = await labels.count();
    expect(n, query).toBeGreaterThan(0);

    for (let i = 0; i < n; i++) {
      // force: SVG text hit-tests by its ink, so Playwright's actionability
      // check sees a rotated label as unstable and never settles on it. The
      // hover is the thing under test, not the reachability of the element.
      // eslint-disable-next-line playwright/no-force-option
      await labels.nth(i).hover({ force: true });
      // The growth is a 150ms transition and there is no state to poll on -
      // the assertion is about the geometry DURING the settled state, so
      // waiting for it is the point rather than a workaround.
      // eslint-disable-next-line playwright/no-wait-for-timeout
      await page.waitForTimeout(450);

      const over = await page.evaluate((idx) => {
        const box = document.querySelector("#nv > div").getBoundingClientRect();
        const el = document.querySelectorAll("#nv svg .attribOverlay text")[
          idx
        ];
        const bb = el.getBoundingClientRect();
        return { top: box.top - bb.top, name: el.textContent };
      }, i);

      expect(
        Math.round(over.top),
        `${query} / ${over.name}`
      ).toBeLessThanOrEqual(1);
    }
  }
});

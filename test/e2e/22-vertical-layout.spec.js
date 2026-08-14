import { test, expect } from "@playwright/test";

// Tests for https://github.com/john-guerra/navio/issues/22. Navio has two
// logical axes: the ATTRIBUTE axis, along which columns are laid out, and the
// RECORD axis, along which one line per row is drawn. Horizontal puts
// attributes on x and records on y; vertical transposes them. All the geometry
// goes through toXY(), so these tests are really checking that every call site
// was routed through it - a missed one shows up as chrome in the wrong place or
// hit-testing against the wrong axis.

const V = "/test/e2e/fixtures/vertical.html?orientation=vertical";
const H = "/test/e2e/fixtures/vertical.html?orientation=horizontal";

/** attribWidth and y0 - the widths of one attribute band and the leading gap. */
const geom = (page) =>
  page.evaluate(() => ({ aw: window.nv.attribWidth, y0: window.nv.y0 }));

test("vertical transposes the canvas: wider than tall", async ({ page }) => {
  await page.goto(V);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  const v = await page.locator("#nv canvas").boundingBox();

  await page.goto(H);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  const h = await page.locator("#nv canvas").boundingBox();

  // Same data, same options: the two orientations swap the canvas dimensions.
  expect(v.width).toBeGreaterThan(v.height);
  expect(h.height).toBeGreaterThan(h.width);
});

test("attribute labels are upright and stacked down the side", async ({
  page,
}) => {
  await page.goto(V);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const texts = page.locator("#nv .attribOverlay text");
  expect(await texts.count()).toBeGreaterThan(3);

  // Upright: no rotate() transform, unlike the horizontal layout.
  expect(await texts.first().getAttribute("transform")).toBeNull();
  await expect(texts.first()).toHaveAttribute("text-anchor", "end");

  // Each successive label sits BELOW the previous one, not to its right.
  const ys = await texts.evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect().top)
  );
  const sorted = [...ys].sort((a, b) => a - b);
  expect(ys).toEqual(sorted);
  expect(new Set(ys).size).toBe(ys.length); // genuinely stacked, not overlapping
});

test("hovering reports the cell under the cursor, on the transposed axes", async ({
  page,
}) => {
  await page.goto(V);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const box = await page.locator("#nv canvas").boundingBox();
  const g = await geom(page);

  // Records run along X now, attributes along Y.
  await page.mouse.move(box.x + g.y0 + 60, box.y + g.aw * 2.5);
  await expect(page.locator("._nv_popover")).toBeVisible();

  const shown = await page.evaluate(() => ({
    name: document.querySelector(".tool_value_name").textContent,
    val: document.querySelector(".tool_value_val").textContent,
    id: document.querySelector(".tool_id").textContent,
  }));

  // A real attribute and a real row, not undefined - which is what a missed
  // axis swap produces.
  const attribs = await page.evaluate(() =>
    window.nv.getAttribs().map((a) => (typeof a === "function" ? a.name : a))
  );
  expect(attribs).toContain(shown.name);
  expect(shown.val).not.toBe("undefined");
  expect(Number(shown.id)).toBeGreaterThan(0);
});

test("dragging along the record axis brushes a range", async ({ page }) => {
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(V);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const total = await page.evaluate(() => window.nv.getVisible().length);
  const box = await page.locator("#nv canvas").boundingBox();
  const g = await geom(page);
  const y = box.y + g.aw * 2.5;

  // Horizontal drag, because records run horizontally.
  await page.mouse.move(box.x + g.y0 + 30, y);
  await page.mouse.down();
  await page.mouse.move(box.x + g.y0 + 150, y, { steps: 10 });
  await page.mouse.up();

  await expect
    .poll(() => page.evaluate(() => window.nv.getVisible().length))
    .toBeLessThan(total);

  const filters = await page.evaluate(() =>
    window.nv.getFilters().filter((l) => l.length)
  );
  expect(filters[0][0].type).toBe("range");
  expect(errs).toEqual([]);
});

test("drilling down stacks levels along the attribute axis", async ({
  page,
}) => {
  await page.goto(V);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  await page.evaluate(() =>
    window.nv.setFilters([
      [{ type: "value", attrib: "category", value: "alpha" }],
    ])
  );

  // A second level exists and holds fewer rows.
  await expect
    .poll(() => page.evaluate(() => window.nv.getRowsAtLevel(1).length))
    .toBeGreaterThan(0);
  const [l0, l1] = await page.evaluate(() => [
    window.nv.getRowsAtLevel(0).length,
    window.nv.getRowsAtLevel(1).length,
  ]);
  expect(l1).toBeLessThan(l0);

  // Levels stack downward: level 1's labels sit below level 0's.
  const tops = await page
    .locator("#nv .attribOverlay text")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(Math.max(...tops)).toBeGreaterThan(Math.min(...tops) + 20);
});

test("filter chips and the close button are placed in vertical too", async ({
  page,
}) => {
  await page.goto(V);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  await page.evaluate(() =>
    window.nv.setFilters([
      [{ type: "value", attrib: "category", value: "alpha" }],
    ])
  );

  // The chip renders and sits beside the widget, not on top of it.
  const chip = page.locator("#nv .filterExplanation").first();
  await expect(chip).toHaveText(/category == alpha/);
  const canvas = await page.locator("#nv canvas").boundingBox();
  const chipBox = await chip.boundingBox();
  expect(chipBox.x).toBeGreaterThan(canvas.x);

  // The close button sits at the trailing edge of the records, not underneath.
  const close = await page.locator("#nv #closeButton").boundingBox();
  expect(close.x).toBeGreaterThan(canvas.x + canvas.width / 2);
});

test("an existing brush can be dragged along the record axis", async ({
  page,
}) => {
  await page.goto(V);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const box = await page.locator("#nv canvas").boundingBox();
  const g = await geom(page);
  const y = box.y + g.aw * 2.5;

  // Create a range.
  await page.mouse.move(box.x + g.y0 + 30, y);
  await page.mouse.down();
  await page.mouse.move(box.x + g.y0 + 120, y, { steps: 8 });
  await page.mouse.up();
  const first = await page.evaluate(() =>
    window.nv.getVisible().map((r) => r.id)
  );
  expect(first.length).toBeGreaterThan(0);

  // Grab the middle of the selection and move it.
  await page.mouse.move(box.x + g.y0 + 75, y);
  await page.mouse.down();
  await page.mouse.move(box.x + g.y0 + 160, y, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.nv
          .getVisible()
          .map((r) => r.id)
          .join(",")
      )
    )
    .not.toBe(first.join(","));
});

// drawCounts was the last draw* helper still writing raw screen x/y instead of
// going through toXY(). In vertical that put the label at (levelScale(level),
// recordEnd + 15) - the second number is the extent of the RECORD axis, which
// vertically is the canvas WIDTH, so the label was drawn ~255px below a 140px
// canvas and clipped away entirely. Measured before the fix: text at y=395,
// svg height 140.
test("the record count is visible in vertical", async ({ page }) => {
  await page.goto(V);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const label = page.locator("#nv .numNodesLabel").first();
  await expect(label).toHaveText("60");

  const m = await page.evaluate(() => {
    const t = document.querySelector(".numNodesLabel").getBoundingClientRect();
    const s = document.querySelector("#nv svg").getBoundingClientRect();
    return {
      label: {
        top: t.top - s.top,
        bottom: t.bottom - s.top,
        left: t.left - s.left,
        right: t.right - s.left,
      },
      svg: { w: s.width, h: s.height },
    };
  });

  // Inside the canvas on BOTH axes - the bug put it 255px past the bottom.
  expect(m.label.top).toBeGreaterThanOrEqual(0);
  expect(m.label.bottom).toBeLessThanOrEqual(m.svg.h);
  expect(m.label.left).toBeGreaterThanOrEqual(0);
  expect(m.label.right).toBeLessThanOrEqual(m.svg.w);
});

// Which side of the level the count goes on is decided by which side has room,
// and vertically the two sides are very different. Past the END OF THE RECORDS
// there is only `height - yScales.range()[1]` of slack - 40px measured on the
// vast-challenge example - against a 58px "171,477", so a count anchored there
// is drawn on top of the data whichever way it is aligned. Past the level's
// COLUMNS there is a whole levelsSeparation (41px measured) and the entire
// width of the record axis to write into. So vertical puts it there.
//
// The invariant, either orientation: the count never overlaps the block it is
// counting.
test("a long count does not overlap the columns in vertical", async ({
  page,
}) => {
  await page.goto(V + "&n=100000");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const label = page.locator("#nv .numNodesLabel").first();
  await expect(label).toHaveText("100,000");

  const m = await page.evaluate(() => {
    const t = document.querySelector(".numNodesLabel").getBoundingClientRect();
    const s = document.querySelector("#nv svg").getBoundingClientRect();
    const nv = window.nv;
    const nAttribs = nv.getAttribs().length;
    return {
      label: {
        top: t.top - s.top,
        bottom: t.bottom - s.top,
        left: t.left - s.left,
        right: t.right - s.left,
      },
      svg: { w: s.width, h: s.height },
      // The block of drawn data for level 0: records along x, columns along y.
      data: {
        left: nv.y0,
        right: nv.height() - nv.margin - 30,
        top: nv.x0 + nv.margin,
        bottom: nv.x0 + nv.margin + nv.attribWidth * nAttribs,
      },
    };
  });

  // On the canvas...
  expect(m.label.left).toBeGreaterThanOrEqual(0);
  expect(m.label.right).toBeLessThanOrEqual(m.svg.w);
  expect(m.label.top).toBeGreaterThanOrEqual(0);
  expect(m.label.bottom).toBeLessThanOrEqual(m.svg.h);

  // ...and clear of the data. Two boxes miss each other when one is wholly
  // past the other on either axis; here it is past the columns.
  const clear =
    m.label.left >= m.data.right ||
    m.label.right <= m.data.left ||
    m.label.top >= m.data.bottom ||
    m.label.bottom <= m.data.top;
  expect(clear).toBe(true);
});

test("horizontal keeps the count below the records", async ({ page }) => {
  await page.goto(H);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const m = await page.evaluate(() => {
    const t = document.querySelector(".numNodesLabel").getBoundingClientRect();
    const c = document.querySelector("#nv canvas").getBoundingClientRect();
    return {
      belowRecords: t.top - c.top > window.nv.height() - 60,
      left: Math.round(t.left - c.left),
      inside: t.bottom - c.top <= c.height,
    };
  });
  expect(m.belowRecords).toBe(true);
  expect(m.inside).toBe(true);
  // Still left-aligned at the level's own edge, as it always was.
  expect(m.left).toBeLessThan(40);
});

test("horizontal is unchanged by the refactor", async ({ page }) => {
  await page.goto(H);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // Labels rotated and laid out left-to-right, as they always were.
  const texts = page.locator("#nv .attribOverlay text");
  expect(await texts.first().getAttribute("transform")).toMatch(/rotate/);

  const xs = await texts.evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect().left)
  );
  expect(xs).toEqual([...xs].sort((a, b) => a - b));
});

// The container used to be set to the `height` option in both orientations.
// `height` is the extent along the RECORD axis, which is the screen height only
// when the widget is horizontal - so a vertical widget reserved a tall band of
// empty space below itself, and adding or hiding a column never changed it.
test("in vertical the container fits the attributes, not the record extent", async ({
  page,
}) => {
  await page.goto(V);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const m = await page.evaluate(() => {
    const h = document.querySelector("#nv").getBoundingClientRect();
    const c = document.querySelector("#nv canvas").getBoundingClientRect();
    return {
      heightOption: window.nv.height(),
      containerH: Math.round(h.height),
      canvasH: Math.round(c.height),
      canvasW: Math.round(c.width),
      slack: Math.round(h.bottom - c.bottom),
      y0: window.nv.y0,
      bottomReserve: window.nv.margin + 30,
    };
  });

  // `height` became the WIDTH: records run across. It is the extent of the
  // RECORDS - the header band sits before them and the count reserve after, and
  // in vertical both of those are horizontal too, so the canvas is wider than
  // `height` by exactly that much.
  expect(m.canvasW).toBe(m.heightOption + m.y0 + m.bottomReserve);
  // And the container is exactly as tall as the columns need, with nothing
  // left over underneath.
  expect(m.containerH).toBe(m.canvasH);
  expect(m.containerH).toBeLessThan(m.heightOption / 2);
  expect(m.slack).toBe(0);
});

test("hiding a column shortens the vertical container", async ({ page }) => {
  await page.goto(V);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const containerH = () =>
    page.evaluate(() =>
      Math.round(document.querySelector("#nv").getBoundingClientRect().height)
    );
  const before = await containerH();

  await page.evaluate(() => {
    const names = window.nv
      .getAttribs()
      .map((a) => (typeof a === "function" ? a.name : a));
    window.nv.setAttribVisible(names[names.length - 1], false);
  });

  await expect.poll(containerH).toBeLessThan(before);
  // By exactly one attribute band.
  expect(before - (await containerH())).toBe(
    await page.evaluate(() => window.nv.attribWidth)
  );
});

test("horizontal keeps the container at the height option", async ({
  page,
}) => {
  await page.goto(H);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const m = await page.evaluate(() => ({
    heightOption: window.nv.height(),
    containerH: Math.round(
      document.querySelector("#nv").getBoundingClientRect().height
    ),
    y0: window.nv.y0,
    bottomReserve: window.nv.margin + 30,
  }));
  // `height` is the RECORD extent, not the container's total. The container is
  // that plus the header band before the records and the count reserve after
  // them - which is the point of the change: naming an attribute grows the
  // widget instead of eating into the rows.
  expect(m.containerH).toBe(m.heightOption + m.y0 + m.bottomReserve);
});

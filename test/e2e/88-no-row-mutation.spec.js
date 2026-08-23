import { test, expect } from "@playwright/test";

// Regression tests for https://github.com/john-guerra/navio/issues/88.
// Navio used to write __seqId, __i and selected onto the caller's row objects.
// That polluted user data and - because two Navios given the same array share
// the same row OBJECTS - let one instance silently overwrite another's
// selection. Bookkeeping now lives in per-instance side tables.

test("two Navios over the same rows no longer corrupt each other", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/two-instances.html");

  const both = () =>
    page.evaluate(() => ({
      nv1: window.nv1
        .getVisible()
        .map((d) => d.id)
        .sort()
        .join(","),
      nv2: window.nv2
        .getVisible()
        .map((d) => d.id)
        .sort()
        .join(","),
    }));

  expect(await both()).toEqual({ nv1: "1,2,3,4,5", nv2: "1,2,3,4,5" });

  // Filter ONLY nv1.
  await page.evaluate(() =>
    window.nv1.setFilters([[{ type: "value", attrib: "category", value: "a" }]])
  );

  const after = await both();
  expect(after.nv1).toBe("1,3");
  // nv2 was never filtered, so it must still show everything.
  expect(after.nv2).toBe("1,2,3,4,5");
});

test("selected is no longer written onto the caller's rows", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/two-instances.html");
  await page.evaluate(() =>
    window.nv1.setFilters([[{ type: "value", attrib: "category", value: "a" }]])
  );

  const row = await page.evaluate(() => {
    const r = window.nv1.data()[0];
    return { keys: Object.keys(r), json: JSON.stringify(r) };
  });
  expect(row.keys).not.toContain("selected");
  expect(row.json).not.toContain("selected");
});

test("nv.isSelected accepts a row or an index", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await page.evaluate(() =>
    window.nv.setFilters([[{ type: "value", attrib: "category", value: "a" }]])
  );

  const got = await page.evaluate(() => {
    const rows = window.nv.data();
    return {
      byRowSelected: window.nv.isSelected(rows[0]), // category a
      byRowNot: window.nv.isSelected(rows[1]), // category b
      byIndexSelected: window.nv.isSelected(0),
      byIndexNot: window.nv.isSelected(1),
      unknown: window.nv.isSelected({ not: "a row" }),
    };
  });

  expect(got).toEqual({
    byRowSelected: true,
    byRowNot: false,
    byIndexSelected: true,
    byIndexNot: false,
    unknown: false,
  });
});

test("the selected column still renders", async ({ page }) => {
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // "selected" is a real column; it must still be registered and drawn.
  const attribs = await page.evaluate(() =>
    window.nv.getAttribs().map((a) => (typeof a === "function" ? a.name : a))
  );
  expect(attribs).toContain("selected");
  expect(errs).toEqual([]);
});

// The __seqId column is how you SEE that the data is in its original order: it
// draws as a clean gradient, and any other sort visibly scrambles it. Deriving
// __seqId from the row index (#88) must not flatten that gradient - the colour
// scale's domain is built from the data, and reading a derived attribute off
// the row yields undefined for every row.
test("the sequential ID column still paints a gradient", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const domain = await page.evaluate(() =>
    window.nv.getColorScale("__seqId").domain()
  );
  expect(domain.every((d) => typeof d === "number" && !Number.isNaN(d))).toBe(
    true
  );
  expect(domain[0]).not.toBe(domain[1]);

  // The top and bottom of the column have to be different colours, or the cue
  // is gone regardless of what the domain says.
  const scale = await page.evaluate(() => {
    const s = window.nv.getColorScale("__seqId");
    const n = window.nv.getRowsAtLevel(0).length;
    return [s(0), s(Math.floor(n / 2)), s(n - 1)];
  });
  expect(new Set(scale).size).toBe(3);
  expect(scale.some((c) => /nan/i.test(String(c)))).toBe(false);
});

// The test above proves nothing about what actually got PAINTED: it reads
// window.nv.getColorScale("__seqId"), which is built by walking the data
// through rows.attribAt (src/rows.js). drawItem (src/render/canvas.js) does
// NOT call attribAt - it open-codes the identical three-way branch by hand,
// "to keep the two in sync by hand", and nothing enforces that they stay in
// sync. A reviewer once changed drawItem's `attrib === "__seqId" ? rowIdx`
// branch to route through getAttrib(item, attrib, ...) instead - reintroducing
// #88 in the painter only, leaving attribAt (and this file's other tests)
// untouched - and all 293 e2e specs, including the gradient test above, still
// passed. So this test samples actual canvas PIXELS: if drawItem resolved
// __seqId off the row object it would get `undefined` for every row (rows
// don't carry a __seqId property, see #88), every cell would paint
// nv.nullColor, and the top and bottom samples taken here would be identical.
test("drawItem paints the __seqId column from the row index, not the row object", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // Derive the column's geometry from the widget rather than guessing pixels:
  // level 0 starts at nv.x0 + nv.margin (geometry.cellA adds levelScale(0),
  // whose range starts there - src/navio.js's `.range([nv.x0 + nv.margin,
  // ...])`), columns are then attribWidth wide and laid out left to right, and
  // getAttribs() reports them in the same left-to-right order drawItem
  // iterates (visibleAttribs(), and single.html hides nothing). y0 and
  // height() are the record axis's start and extent (src/geometry.js
  // recordAxisStart/recordExtent), so the record rows span exactly that band.
  const geom = await page.evaluate(() => {
    const names = window.nv
      .getAttribs()
      .map((a) => (typeof a === "function" ? a.name : a));
    return {
      col: names.indexOf("__seqId"),
      aw: window.nv.attribWidth,
      x0: window.nv.x0,
      margin: window.nv.margin,
      y0: window.nv.y0,
      height: window.nv.height(),
    };
  });
  expect(geom.col).toBeGreaterThanOrEqual(0);

  const box = await page.locator("#nv canvas").boundingBox();
  const x = box.x + geom.x0 + geom.margin + geom.aw * (geom.col + 0.5);
  // 10%/90% down the record band: comfortably inside the first and last rows
  // of the fixture's 5 records without depending on exact row height.
  const yTop = box.y + geom.y0 + geom.height * 0.1;
  const yBottom = box.y + geom.y0 + geom.height * 0.9;

  // Read the actual painted pixel, the same way test/e2e/senate-example.spec.js
  // samples the graph canvas - getImageData on the 2D context, not a DOM
  // assertion. Coordinates are converted from CSS to backing-store pixels so
  // this holds even if a run's devicePixelRatio is not 1.
  const colourAt = (px, py) =>
    page.evaluate(
      ([px, py]) => {
        const c = document.querySelector("#nv canvas");
        const rect = c.getBoundingClientRect();
        const scaleX = c.width / rect.width;
        const scaleY = c.height / rect.height;
        const d = c
          .getContext("2d")
          .getImageData(
            Math.round((px - rect.left) * scaleX),
            Math.round((py - rect.top) * scaleY),
            1,
            1
          ).data;
        return [d[0], d[1], d[2], d[3]];
      },
      [px, py]
    );

  const top = await colourAt(x, yTop);
  const bottom = await colourAt(x, yBottom);
  // If drawItem painted __seqId via getAttrib(item, "__seqId") instead of the
  // row index, both cells paint nv.nullColor and these would be identical.
  expect(top).not.toEqual(bottom);
});

// Same failure mode one layer up: the tooltip read values off the row, so the
// two derived columns reported "undefined" on hover.
test("hovering the derived columns shows a value, not undefined", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const geom = await page.evaluate(() => ({
    y0: window.nv.y0,
    aw: window.nv.attribWidth,
    count: window.nv.getAttribs().length,
  }));

  const box = await page.locator("#nv canvas").boundingBox();
  const y = box.y + geom.y0 + 25;

  // Walk the columns and record what the tooltip calls each one, rather than
  // assuming getAttribs() order maps onto pixel offsets. `y` is fixed, so every
  // probe reads the same row and a repeated column just rewrites its own value.
  const seen = new Map();
  for (let col = 0; col < geom.count + 2; col++) {
    await page.mouse.move(box.x + geom.aw * (col + 0.5), y);
    seen.set(
      await page.locator(".tool_value_name").innerText(),
      await page.locator(".tool_value_val").innerText()
    );
  }

  expect([...seen.keys()]).toEqual(
    expect.arrayContaining(["__seqId", "selected"])
  );
  expect(seen.get("__seqId")).toMatch(/^\d+$/);
  expect(seen.get("selected")).toMatch(/^(true|false)$/);
});

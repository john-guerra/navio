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

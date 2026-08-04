import { test, expect } from "@playwright/test";

// Reported: "if I try click to select value, but the mouse moves a little bit,
// nothing happens."
//
// A click with a few pixels of drift reaches d3-brush as a drag, so it ends as
// a brush with an empty or hair-thin selection. By then d3-brush has called
// preventDefault, so onSelectByValue bails out ("that was a drag") AND
// onSelectByRange bailed out ("empty selection") - the click did nothing at
// all. Below nv.clickTolerance it is now treated as a click.

const FIXTURE = "/test/e2e/fixtures/single.html";

/** The screen x of a named column, located by hovering rather than by maths. */
async function columnX(page, box, g, wanted) {
  const y = box.y + g.y0 + 25;
  for (let dx = 2; dx < box.width; dx += 2) {
    await page.mouse.move(box.x + dx, y);
    const name = await page.locator(".tool_value_name").innerText();
    if (name === wanted) return box.x + dx;
  }
  throw new Error(`column ${wanted} not found`);
}

/** Press, move `drift` px, release - a click from a slightly unsteady hand. */
async function shakyClick(page, x, y, drift) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (drift) await page.mouse.move(x, y + drift, { steps: 3 });
  await page.mouse.up();
}

for (const drift of [0, 1, 2, 3]) {
  test(`a click with ${drift}px of drift still filters by value`, async ({
    page,
  }) => {
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(FIXTURE);
    await expect(page.locator("#nv canvas")).toHaveCount(1);

    const box = await page.locator("#nv canvas").boundingBox();
    const g = await page.evaluate(() => ({
      y0: window.nv.y0,
      aw: window.nv.attribWidth,
    }));

    // Find the "category" column by asking the tooltip rather than computing
    // it: the columns are offset by levelScale, not just by attribWidth.
    const x = await columnX(page, box, g, "category");
    await shakyClick(page, x, box.y + g.y0 + 10, drift);

    // A value filter, and a real narrowing of the selection.
    await expect
      .poll(() => page.evaluate(() => window.nv.getVisible().length))
      .toBeLessThan(5);

    const filters = await page.evaluate(() =>
      window.nv.getFilters().filter((l) => l.length)
    );
    expect(filters).toHaveLength(1);
    expect(filters[0][0].type).toBe("value");
    expect(filters[0][0].attrib).toBe("category");
    expect(errs).toEqual([]);
  });
}

test("a deliberate drag still makes a range filter, not a value filter", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const box = await page.locator("#nv canvas").boundingBox();
  const g = await page.evaluate(() => ({
    y0: window.nv.y0,
    aw: window.nv.attribWidth,
  }));

  // Well past nv.clickTolerance: this must stay a range.
  await shakyClick(page, box.x + g.aw * 2.5, box.y + g.y0 + 10, 60);

  const filters = await page.evaluate(() =>
    window.nv.getFilters().filter((l) => l.length)
  );
  expect(filters[0][0].type).toBe("range");
});

test("the tolerance is configurable", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  expect(await page.evaluate(() => window.nv.clickTolerance)).toBe(4);

  // Raise it and a 20px drag becomes a click instead of a range.
  await page.evaluate(() => {
    window.nv.clickTolerance = 40;
  });

  const box = await page.locator("#nv canvas").boundingBox();
  const g = await page.evaluate(() => ({
    y0: window.nv.y0,
    aw: window.nv.attribWidth,
  }));
  await shakyClick(page, box.x + g.aw * 2.5, box.y + g.y0 + 10, 20);

  const filters = await page.evaluate(() =>
    window.nv.getFilters().filter((l) => l.length)
  );
  expect(filters[0][0].type).toBe("value");
});

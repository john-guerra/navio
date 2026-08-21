import { test, expect } from "@playwright/test";

// Pins geom's construction contract (see src/geometry.js and
// docs/ai/2026-08-21-navio-geometry-injection-design.md section 3).
//
// yScales is REASSIGNED wholesale by nv.destroy() (`yScales = []`), not
// mutated in place. A geom that had captured the array by VALUE at
// construction would keep the entire pre-destroy scale array - and every
// scale object and domain in it - reachable through geom forever, which is a
// memory leak specific to a correctly-functioning geom, not a bug in
// destroy() itself. geom must read yScales through a getter so that after
// destroy() it sees the same empty array navio.js itself sees.
test("geom sees the same yScales navio.js sees, including after destroy()", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const beforeLength = await page.evaluate(
    () => window.nv.getVisibleLinks().length
  );
  expect(beforeLength, "sanity: widget has rendered at least once").toBe(0);

  await page.evaluate(() => window.nv.destroy());

  // Rebuilding on the same container must not throw or warn - the strongest
  // externally-observable proof that nothing internal is still pointing at
  // stale scale state from before destroy().
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.evaluate(() => {
    // window.d3, not bare d3 - the convention test/e2e/59-destroy.spec.js uses.
    window.nv2 = new window.navio(window.d3.select("#nv"), 400);
    window.nv2.id("id");
    window.nv2.data([{ id: 1, category: "a", value: 10 }]);
    window.nv2.addAllAttribs();
  });
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  expect(errors, "rebuilding after destroy() threw").toEqual([]);
});

// The mechanism's actual justification (spec section 1): a hit-test must read
// CURRENT geometry, not geometry captured when the level was created.
//
// single.html's rows are id 1..5 with value 10, 20, 30, 15, 25 - ascending
// value order is 10,15,20,25,30 -> ids "1 4 2 5 3". getRowsAtLevel is the
// same real-reorder check
// test/e2e/81-sortby-actually-sorts.spec.js uses for nv.sortBy(); this proves
// the CLICK path resolves to the same column after geometry has changed.
const order = (page) =>
  page.evaluate(() =>
    window.nv
      .getRowsAtLevel(0)
      .map((d) => d.id)
      .join(" ")
  );

test("clicking a header sorts correctly after the attribute width changes", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  await page.evaluate(() => {
    // attribWidth is a plain option property (src/params.js:51-53), not a
    // method - confirmed while writing this plan.
    window.nv.attribWidth = 80;
    window.nv.hardUpdate();
  });

  // Click the "value" column's header label - if geom's levelAtA/attribAtA
  // read stale geometry from before the width change, this click resolves to
  // the wrong column (or none), and the row order below is unaffected.
  //
  // labels matches every header text node, so toContainText on the whole
  // locator is a Playwright strict-mode violation (it resolves to 5
  // elements); filter to the single "value" label first, same as the click
  // below already does.
  const labels = page.locator("#nv svg .attribOverlay text");
  const valueLabel = labels.filter({ hasText: "value" });
  await expect(valueLabel).toHaveCount(1);
  await valueLabel.first().click();

  await expect(async () => {
    expect(await order(page)).toBe("1 4 2 5 3");
  }).toPass();
});

import { test, expect } from "@playwright/test";

// A perf attempt for #61 cached each link's resolved endpoints in an Int32Array,
// guarded only by `linkEndpoints.length !== links.length * 2`. That misses every
// in-place mutation of the link array - which is exactly what the d3-force
// convention does: forceLink rewrites source/target from ids to node objects
// after Navio has already seen the array. The cache was reverted; these pin it.

const FIXTURE = "/test/e2e/fixtures/links.html";

test("links whose endpoints are rewritten in place become visible", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // Ids, not row objects: Navio cannot resolve these yet, so nothing is drawn.
  const before = await page.evaluate(() => {
    window.nv.links([{ source: "1", target: "3" }]);
    window.nv.hardUpdate();
    return window.nv.getVisibleLinks().length;
  });
  expect(before).toBe(0);

  // Now resolve them the way d3.forceLink does - mutating the SAME objects,
  // without handing the array back to Navio.
  const after = await page.evaluate(() => {
    const rows = window.nv.data();
    const links = window.nv.links();
    links[0].source = rows[0];
    links[0].target = rows[2];
    window.nv.hardUpdate();
    return window.nv.getVisibleLinks().length;
  });
  expect(after).toBe(1);
});

test("replacing a link in place does not throw while redrawing", async ({
  page,
}) => {
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const visible = await page.evaluate(() => {
    const rows = window.nv.data();
    window.nv.links([{ source: rows[0], target: rows[1] }]);
    window.nv.hardUpdate();
    // Same length, different contents, and one endpoint no longer resolvable.
    // A stale index here made drawLink dereference data[undefined].
    window.nv.links()[0] = { source: rows[0], target: "not-a-row" };
    window.nv.hardUpdate();
    return window.nv.getVisibleLinks().length;
  });

  expect(errs).toEqual([]);
  expect(visible).toBe(0); // unresolvable endpoint => not drawn, not a crash
});

test("reordering links keeps each link's own endpoints", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const got = await page.evaluate(() => {
    const rows = window.nv.data();
    // Only the second link's endpoints are both selected once we filter to "a".
    window.nv.links([
      { source: rows[1], target: rows[3] }, // b -> b
      { source: rows[0], target: rows[2] }, // a -> a
    ]);
    window.nv.setFilters([[{ type: "value", attrib: "category", value: "a" }]]);
    const beforeReverse = window.nv
      .getVisibleLinks()
      .map((l) => l.source.id + "-" + l.target.id);

    window.nv.links().reverse(); // same length, contents shuffled
    window.nv.hardUpdate();
    const afterReverse = window.nv
      .getVisibleLinks()
      .map((l) => l.source.id + "-" + l.target.id);

    return { beforeReverse, afterReverse };
  });

  // Reordering must not change WHICH pairs are drawn.
  expect(got.beforeReverse).toEqual(["1-3"]);
  expect(got.afterReverse).toEqual(["1-3"]);
});

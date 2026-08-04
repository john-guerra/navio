import { test, expect } from "@playwright/test";

// Guards examples/binding — the runnable demonstration of #60. Examples rot
// silently, so this drives the real page rather than a fixture.

test("two bound Navios stay in sync", async ({ page }) => {
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));

  await page.goto("/examples/binding/");
  await expect(page.locator("#navioA canvas")).toHaveCount(1);
  await expect(page.locator("#navioB canvas")).toHaveCount(1);

  const synced = await page.evaluate(() => {
    const a = document.querySelector("#navioA").firstChild;
    const b = document.querySelector("#navioB").firstChild;
    a.setValue([[{ type: "value", attrib: "species", value: "Adelie" }]]);
    return {
      a: a.getSelected().length,
      b: b.getSelected().length,
      sameValue: JSON.stringify(a.value) === JSON.stringify(b.value),
    };
  });

  expect(synced.a).toBeGreaterThan(0);
  expect(synced.b).toBe(synced.a); // the bound peer followed
  expect(synced.sameValue).toBe(true);
  expect(errs).toEqual([]);
});

test("interacting with a bound peer does not crash", async ({ page }) => {
  // Regression: filtering A then brushing B threw "Cannot read properties of
  // undefined (reading 'filter')" - filtersByLevel had become sparse, and
  // deleteObsoleteFiltersFromLevel dereferenced the hole.
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("/examples/binding/");

  await page.evaluate(() =>
    document
      .querySelector("#navioA")
      .firstChild.setValue([
        [{ type: "value", attrib: "species", value: "Adelie" }],
      ])
  );

  const box = await page.locator("#navioB canvas").boundingBox();
  const g = await page.evaluate(() => {
    const n = document.querySelector("#navioB").firstChild.navio;
    return { y0: n.y0, margin: n.margin, aw: n.attribWidth };
  });
  const rowSpan = (380 - g.margin - 30 - g.y0) / 40;
  const x = box.x + g.aw * 2.5;
  await page.mouse.move(x, box.y + g.y0 + rowSpan * 3);
  await page.mouse.down();
  await page.mouse.move(x, box.y + g.y0 + rowSpan * 12, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector("#navioB").firstChild.getSelected().length
      )
    )
    .toBeGreaterThan(0);

  expect(errs).toEqual([]);
  // And the two stay in agreement afterwards.
  const both = await page.evaluate(() => ({
    a: document.querySelector("#navioA").firstChild.getSelected().length,
    b: document.querySelector("#navioB").firstChild.getSelected().length,
  }));
  expect(both.a).toBe(both.b);
});

test("getFilters never emits holes", async ({ page }) => {
  await page.goto("/examples/binding/");
  await page.evaluate(() =>
    document
      .querySelector("#navioA")
      .firstChild.setValue([
        [{ type: "value", attrib: "species", value: "Adelie" }],
      ])
  );
  const v = await page.evaluate(
    () => document.querySelector("#navioB").firstChild.value
  );
  expect(v.every((level) => Array.isArray(level))).toBe(true);
});

// Closing the last level with the ✕ button empties the filters, so the value
// the peer receives has no filters to rebuild. setFilters splices the levels
// with shouldUpdate:false and then breaks out of its loop before reaching
// applyFiltersAndUpdate - the only thing that repaints - so the peer's data
// collapsed while its canvas kept showing the level.
test("closing a level in one navio closes it in the bound peer", async ({
  page,
}) => {
  await page.goto("/examples/binding/");

  const closeButtonShown = () =>
    page.evaluate(() =>
      ["#navioA", "#navioB"].map(
        (sel) =>
          document.querySelector(sel).querySelector("#closeButton").style
            .display
      )
    );
  // filtersByLevel intentionally keeps one empty slot past the last level (see
  // updateData), so assert on the filters themselves rather than the length.
  const anyFilters = () =>
    page.evaluate(() =>
      ["#navioA", "#navioB"].map((sel) =>
        document
          .querySelector(sel)
          .firstChild.navio.getFilters()
          .some((lvl) => lvl.length)
      )
    );

  await page.evaluate(() =>
    document
      .querySelector("#navioA")
      .firstChild.setValue([
        [{ type: "value", attrib: "species", value: "Adelie" }],
      ])
  );
  await expect.poll(closeButtonShown).toEqual(["block", "block"]);
  expect(await anyFilters()).toEqual([true, true]);

  await page.locator("#navioA #closeButton path").click();

  // Both must go back to a single level, chrome included.
  await expect.poll(closeButtonShown).toEqual(["none", "none"]);
  expect(await anyFilters()).toEqual([false, false]);

  const selected = await page.evaluate(() => [
    document.querySelector("#navioA").firstChild.getSelected().length,
    document.querySelector("#navioB").firstChild.getSelected().length,
  ]);
  expect(selected).toEqual([120, 120]);
});

test("the brush is restored in the bound peer, and is draggable there", async ({
  page,
}) => {
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("/examples/binding/");

  const geom = async (sel) => {
    const box = await page.locator(`${sel} canvas`).boundingBox();
    const g = await page.evaluate((s) => {
      const n = document.querySelector(s).firstChild.navio;
      return { y0: n.y0, margin: n.margin, aw: n.attribWidth };
    }, sel);
    return { box, g, rowSpan: (380 - g.margin - 30 - g.y0) / 120 };
  };
  const brushHeights = (sel) =>
    page.evaluate(
      (s) =>
        Array.from(document.querySelectorAll(`${s} .selection`))
          .filter((r) => getComputedStyle(r).display !== "none")
          .map((r) => +r.getAttribute("height")),
      sel
    );

  // Drag a range in A.
  const A = await geom("#navioA");
  const xa = A.box.x + A.g.aw * 2.5;
  await page.mouse.move(xa, A.box.y + A.g.y0 + A.rowSpan * 10);
  await page.mouse.down();
  await page.mouse.move(xa, A.box.y + A.g.y0 + A.rowSpan * 60, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  // A range filter is expressed on screen by its brush, so the synced peer
  // must show one too - otherwise it is filtered with nothing to grab.
  const [ha] = await brushHeights("#navioA");
  const [hb] = await brushHeights("#navioB");
  expect(ha).toBeGreaterThan(0);
  expect(hb).toBe(ha);

  // And it is a real brush: dragging it in B drives A back.
  const before = await page.evaluate(
    () => document.querySelector("#navioA").firstChild.getSelected().length
  );
  const B = await geom("#navioB");
  const xb = B.box.x + B.g.aw * 2.5;
  await page.mouse.move(xb, B.box.y + B.g.y0 + B.rowSpan * 20);
  await page.mouse.down();
  await page.mouse.move(xb, B.box.y + B.g.y0 + B.rowSpan * 40, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => ({
    a: document.querySelector("#navioA").firstChild.getSelected().length,
    b: document.querySelector("#navioB").firstChild.getSelected().length,
  }));
  expect(after.b).not.toBe(before); // B's drag changed the selection
  expect(after.a).toBe(after.b); // and A followed
  expect(errs).toEqual([]);
});

// The real @john-guerra/faceted-search, loaded from its notebook export. Its
// value is the surviving rows, so it cannot be bound to Navio directly - these
// pin the translation in both facet kinds.
test("a checkbox facet becomes value filters on one level", async ({
  page,
}) => {
  await page.goto("/examples/binding/");
  await page.waitForFunction(() => window.__facets && window.__navioC);

  const after = await page.evaluate(() => {
    const f = window.__facets.value.filters.get("species");
    f.selected = ["Adelie"];
    window.__facets.dispatchEvent(new Event("input", { bubbles: true }));
    return null;
  });
  expect(after).toBeNull();
  await page.waitForFunction(() =>
    window.__navioC.value.some((l) => l && l.length)
  );

  const state = await page.evaluate(() => ({
    value: window.__navioC.value.filter((l) => l && l.length),
    panels: document.querySelectorAll("#navioC .levelOverlay").length,
  }));
  expect(state.value).toEqual([
    [{ type: "value", attrib: "species", value: "Adelie" }],
  ]);
  expect(state.panels).toBe(2);
});

test("a range facet becomes a valueRange filter, not a positional brush", async ({
  page,
}) => {
  await page.goto("/examples/binding/");
  await page.waitForFunction(() => window.__facets && window.__navioC);

  const bounds = await page.evaluate(() => {
    const f = window.__facets.value.filters.get("beak");
    const [min, max] = f.allOptions;
    const lo = min + (max - min) * 0.25;
    const hi = min + (max - min) * 0.75;
    f.selected = [lo, hi];
    window.__facets.dispatchEvent(new Event("input", { bubbles: true }));
    return { lo, hi };
  });
  await page.waitForFunction(() =>
    window.__navioC.value.some((l) => l && l.length)
  );

  const state = await page.evaluate(() => ({
    value: window.__navioC.value.filter((l) => l && l.length),
    beaks: window.__navioC.getSelected().map((d) => d.beak),
  }));

  expect(state.value).toHaveLength(1);
  expect(state.value[0][0]).toMatchObject({
    type: "valueRange",
    attrib: "beak",
  });
  expect(state.beaks.length).toBeGreaterThan(0);
  // Every surviving row is genuinely inside the requested value range - which
  // a positional brush could not guarantee.
  for (const b of state.beaks) {
    expect(b).toBeGreaterThanOrEqual(bounds.lo);
    expect(b).toBeLessThanOrEqual(bounds.hi);
  }
});

test("a valueRange survives a re-sort, unlike a positional range", async ({
  page,
}) => {
  await page.goto("/examples/binding/");
  await page.waitForFunction(() => window.__facets && window.__navioC);

  await page.evaluate(() => {
    const f = window.__facets.value.filters.get("beak");
    const [min, max] = f.allOptions;
    f.selected = [min + (max - min) * 0.25, min + (max - min) * 0.75];
    window.__facets.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() =>
    window.__navioC.value.some((l) => l && l.length)
  );
  const before = await page.evaluate(
    () => window.__navioC.getSelected().length
  );

  // Re-sorting drops positional range filters as obsolete; a value range means
  // the same thing in any ordering and must be kept.
  await page.evaluate(() => window.__navioC.navio.sortBy("mass", false, 0));

  const after = await page.evaluate(() => ({
    selected: window.__navioC.getSelected().length,
    value: window.__navioC.value.filter((l) => l && l.length),
  }));
  expect(after.selected).toBe(before);
  expect(after.value[0][0].type).toBe("valueRange");
});

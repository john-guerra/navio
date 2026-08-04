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

test("a facet selection becomes a Navio level, exactly as clicking would", async ({
  page,
}) => {
  await page.goto("/examples/binding/");
  const state = () =>
    page.evaluate(() => {
      const c = document.querySelector("#navioC").firstChild;
      return {
        panels: document.querySelectorAll("#navioC .levelOverlay").length,
        selected: c.getSelected().length,
        value: c.value.filter((l) => l && l.length),
      };
    });

  const before = await state();
  expect(before.panels).toBe(1);
  expect(before.selected).toBe(120);

  // Tick "Adelie" in the facet widget.
  await page.locator("#facets input[type=checkbox]").first().check();
  await page.waitForTimeout(200);

  const after = await state();
  // A second panel appears - the drill-down - rather than the dataset being
  // swapped out underneath Navio.
  expect(after.panels).toBe(2);
  expect(after.selected).toBe(40);
  expect(after.value).toEqual([
    [{ type: "value", attrib: "species", value: "Adelie" }],
  ]);
});

test("the bridge also runs backwards, from Navio to the facets", async ({
  page,
}) => {
  await page.goto("/examples/binding/");

  await page.evaluate(() => {
    document
      .querySelector("#navioC")
      .firstChild.setValue([
        [{ type: "value", attrib: "island", value: "Biscoe" }],
      ]);
  });
  await page.waitForTimeout(200);

  const checked = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#facets input[type=checkbox]"))
      .filter((b) => b.checked)
      .map((b) => `${b.dataset.attr}=${b.dataset.value}`)
  );
  expect(checked).toEqual(["island=Biscoe"]);
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
  await page.waitForTimeout(250);

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

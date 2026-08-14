import { test, expect } from "@playwright/test";

// Tests for https://github.com/john-guerra/navio/issues/60, part 1:
// nv.getFilters() / nv.setFilters() round-tripping, including the multi-level
// drill-down chain. See docs/ai/FILTERING-MODEL.md for why a range descriptor
// has to carry the sort that produced it.

const selected = (page, target = "nv") =>
  page.evaluate(
    (t) =>
      window[t]
        .getVisible()
        .map((d) => d.id)
        .sort()
        .join(" "),
    target
  );

async function clickCell(page, column, rowIndex, opts = {}) {
  const box = await page.locator("#nv canvas").boundingBox();
  const geo = await page.evaluate(() => ({
    y0: window.nv.y0,
    attribWidth: window.nv.attribWidth,
    margin: window.nv.margin,
  }));
  const cols = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".attribOverlay")).map((g) => {
      const t = g.querySelector("text");
      const m = /translate\(([-\d.]+),/.exec(g.getAttribute("transform") || "");
      return {
        label: t ? t.textContent : null,
        x: m ? parseFloat(m[1]) : null,
      };
    })
  );
  const col = cols.find((c) => c.label === column);
  const rowSpan = 400 / 5; // the record axis IS `height` now
  const x = box.x + col.x + geo.attribWidth / 2;
  const y = box.y + geo.y0 + rowSpan * rowIndex + rowSpan / 2;
  if (opts.shift) await page.keyboard.down("Shift");
  await page.mouse.click(x, y);
  if (opts.shift) await page.keyboard.up("Shift");
}

test("getFilters returns an empty chain when nothing is filtered", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  const v = await page.evaluate(() => window.nv.getFilters());
  expect(v.every((level) => level.length === 0)).toBe(true);
});

test("a value filter survives a getFilters/setFilters round trip", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await clickCell(page, "category", 0); // category == a
  const before = await selected(page);
  const value = await page.evaluate(() => window.nv.getFilters());

  expect(value[0]).toHaveLength(1);
  expect(value[0][0]).toMatchObject({
    type: "value",
    attrib: "category",
    value: "a",
  });

  // Clear, then restore.
  await page.evaluate(() => window.nv.setFilters([]));
  expect(await selected(page)).toBe("1 2 3 4 5");

  await page.evaluate((v) => window.nv.setFilters(v), value);
  expect(await selected(page)).toBe(before);
});

test("the filter value is JSON-serializable", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await clickCell(page, "category", 0);

  const survives = await page.evaluate(() => {
    const v = window.nv.getFilters();
    const clone = JSON.parse(JSON.stringify(v));
    window.nv.setFilters([]);
    window.nv.setFilters(clone);
    return window.nv
      .getVisible()
      .map((d) => d.id)
      .sort()
      .join(" ");
  });
  expect(survives).toBe("1 3");
});

test("a multi-level drill-down chain round-trips", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/single.html");

  // Level 0: category == b, which leaves ids 2 and 5.
  await clickCell(page, "category", 1);
  expect(await selected(page)).toBe("2 5");

  const value = await page.evaluate(() => window.nv.getFilters());
  expect(value[0]).toHaveLength(1);

  await page.evaluate(() => window.nv.setFilters([]));
  expect(await selected(page)).toBe("1 2 3 4 5");

  await page.evaluate((v) => window.nv.setFilters(v), value);
  expect(await selected(page)).toBe("2 5");
});

test("setFilters emits exactly one change, not one per level", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await clickCell(page, "category", 0);
  const value = await page.evaluate(() => window.nv.getFilters());

  const calls = await page.evaluate((v) => {
    let n = 0;
    window.nv.onChange(() => n++);
    window.nv.setFilters(v);
    return n;
  }, value);

  expect(calls).toBe(1);
});

test("onChange is additive and never clobbers updateCallback", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");

  const result = await page.evaluate(() => {
    const seen = { legacy: 0, a: 0, b: 0 };
    window.nv.updateCallback(() => seen.legacy++);
    window.nv.onChange(() => seen.a++);
    const off = window.nv.onChange(() => seen.b++);
    window.nv.setFilters([]);
    off();
    window.nv.setFilters([]);
    return seen;
  });

  // The app's own updateCallback still fires on every change...
  expect(result.legacy).toBe(2);
  // ...both onChange listeners ran the first time...
  expect(result.a).toBe(2);
  // ...and unsubscribing stopped only the one that unsubscribed.
  expect(result.b).toBe(1);
});

test("setFilters rejects malformed input without throwing", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  const warnings = [];
  page.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));

  await page.evaluate(() => window.nv.setFilters("nonsense"));

  expect(warnings.join(" ")).toContain("expected an array");
  expect(await selected(page)).toBe("1 2 3 4 5");
});

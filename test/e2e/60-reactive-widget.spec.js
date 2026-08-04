import { test, expect } from "@playwright/test";

// Tests for https://github.com/john-guerra/navio/issues/60, part 2:
// NavioWidget as a Reactive Widget (https://reactivewidgets.org) - an
// HTMLElement carrying `.value` and emitting `input` - and two of them staying
// in sync through a plain Inputs.bind-style binding.

/** Click a cell in the first widget's canvas. */
async function clickCell(page, rowIndex) {
  const box = await page.locator("#host canvas").boundingBox();
  const geo = await page.evaluate(() => ({
    y0: window.w1.navio.y0,
    margin: window.w1.navio.margin,
    attribWidth: window.w1.navio.attribWidth,
  }));
  const cols = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#host .attribOverlay")).map((g) => {
      const t = g.querySelector("text");
      const m = /translate\(([-\d.]+),/.exec(g.getAttribute("transform") || "");
      return {
        label: t ? t.textContent : null,
        x: m ? parseFloat(m[1]) : null,
      };
    })
  );
  const col = cols.find((c) => c.label === "category");
  const rowSpan = (400 - geo.margin - 30 - geo.y0) / 5;
  await page.mouse.click(
    box.x + col.x + geo.attribWidth / 2,
    box.y + geo.y0 + rowSpan * rowIndex + rowSpan / 2
  );
}

test("the widget is an HTMLElement with a value, as the contract requires", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/reactive.html");

  const shape = await page.evaluate(() => ({
    isElement: window.w1 instanceof HTMLElement,
    hasValue: "value" in window.w1,
    valueIsArray: Array.isArray(window.w1.value),
    hasSetValue: typeof window.w1.setValue === "function",
    hasGetSelected: typeof window.w1.getSelected === "function",
    hasDestroy: typeof window.w1.destroy === "function",
    rendered: !!window.w1.querySelector("canvas"),
  }));

  expect(shape).toEqual({
    isElement: true,
    hasValue: true,
    valueIsArray: true,
    hasSetValue: true,
    hasGetSelected: true,
    hasDestroy: true,
    rendered: true,
  });
});

test("a user interaction emits input and updates value", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/reactive.html");
  expect(await page.evaluate(() => window.inputEvents)).toBe(0);

  await clickCell(page, 0); // category == a

  expect(await page.evaluate(() => window.inputEvents)).toBeGreaterThan(0);
  const value = await page.evaluate(() => window.w1.value);
  expect(value[0][0]).toMatchObject({
    type: "value",
    attrib: "category",
    value: "a",
  });
  expect(await page.evaluate(() => window.selectedOf(window.w1))).toBe("1 3");
});

test("assigning value applies the filters without re-dispatching", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/reactive.html");
  await clickCell(page, 0);
  const value = await page.evaluate(() => window.w1.value);

  const emitted = await page.evaluate((v) => {
    let n = 0;
    window.w2.addEventListener("input", () => n++);
    window.w2.value = v; // assignment, per the helper's contract
    return { n, selected: window.selectedOf(window.w2) };
  }, value);

  expect(emitted.selected).toBe("1 3");
  // A programmatic set must not look like a user change, or bindings loop.
  expect(emitted.n).toBe(0);
});

test("two bound widgets stay in sync and the binding converges", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/reactive.html");
  await page.evaluate(() => window.bind(window.w2, window.w1));

  await clickCell(page, 1); // category == b

  const state = await page.evaluate(() => ({
    w1: window.selectedOf(window.w1),
    w2: window.selectedOf(window.w2),
    sameValue:
      JSON.stringify(window.w1.value) === JSON.stringify(window.w2.value),
  }));

  expect(state.w1).toBe("2 5");
  expect(state.w2).toBe("2 5"); // the bound peer followed
  expect(state.sameValue).toBe(true);
});

test("binding does not loop: one interaction settles in one pass", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/reactive.html");

  const counts = await page.evaluate(async () => {
    let a = 0,
      b = 0;
    window.w1.addEventListener("input", () => a++);
    window.w2.addEventListener("input", () => b++);
    window.bind(window.w2, window.w1);
    window.bind(window.w1, window.w2); // deliberately bind both directions

    window.w1.setValue([[{ type: "value", attrib: "category", value: "a" }]]);
    await new Promise((r) => setTimeout(r, 50));
    return { a, b };
  });

  // Bidirectional binding must still terminate. Assignment never dispatches,
  // so the chain is one hop regardless of how many widgets are wired up.
  expect(counts.a).toBe(1);
  expect(counts.b).toBe(0);
});

test("snapshot returns filters and rows together, without being the bound value", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/reactive.html");
  await clickCell(page, 0);

  const snap = await page.evaluate(() => {
    const s = window.w1.snapshot();
    return {
      filterCount: s.filters[0].length,
      ids: s.selection.map((d) => d.id).sort(),
      valueIsJustFilters: Array.isArray(window.w1.value),
    };
  });

  expect(snap.filterCount).toBe(1);
  expect(snap.ids).toEqual([1, 3]);
  expect(snap.valueIsJustFilters).toBe(true);
});

test("destroy tears the widget down", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/reactive.html");
  await page.evaluate(() => window.w1.destroy());
  await expect(page.locator("#host canvas")).toHaveCount(0);
  // The other instance is unaffected.
  await expect(page.locator("#host2 canvas")).toHaveCount(1);
});

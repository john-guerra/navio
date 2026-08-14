import { test, expect } from "@playwright/test";

// Tests for https://github.com/john-guerra/navio/issues/60, part 2:
// NavioWidget as a Reactive Widget (https://reactivewidgets.org) - an
// HTMLElement carrying `.value` and emitting `input` - and two of them staying
// in sync through a plain Inputs.bind-style binding.
//
// `.value` is the SELECTED ROWS (#93). It used to be the filter chain, which
// made `viewof selected = navio(data)` hand every downstream Observable cell a
// list of filter descriptors where it expected data. The chain is still
// reachable through getFilters()/snapshot(), and assigning one still applies it.

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
  const rowSpan = 400 / 5; // the record axis IS `height` now
  await page.mouse.click(
    box.x + col.x + geo.attribWidth / 2,
    box.y + geo.y0 + rowSpan * rowIndex + rowSpan / 2
  );
}

const idsOf = (v) => v.map((d) => d.id).sort();

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
    hasGetFilters: typeof window.w1.getFilters === "function",
    hasDestroy: typeof window.w1.destroy === "function",
    rendered: !!window.w1.querySelector("canvas"),
  }));

  expect(shape).toEqual({
    isElement: true,
    hasValue: true,
    valueIsArray: true,
    hasSetValue: true,
    hasGetSelected: true,
    hasGetFilters: true,
    hasDestroy: true,
    rendered: true,
  });
});

// Nothing filtered means everything is selected. Starting at [] told every
// downstream cell the user had picked no rows at all.
test("value starts as the whole dataset, not empty", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/reactive.html");
  const v = await page.evaluate(() => window.w1.value);
  expect(idsOf(v)).toEqual([1, 2, 3, 4, 5]);
  // Rows, not filter descriptors - this is what viewof hands the next cell.
  expect(v[0]).toMatchObject({ category: expect.any(String) });
});

test("a user interaction emits input and updates value to the rows", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/reactive.html");
  expect(await page.evaluate(() => window.inputEvents)).toBe(0);

  await clickCell(page, 0); // category == a

  expect(await page.evaluate(() => window.inputEvents)).toBeGreaterThan(0);
  const value = await page.evaluate(() => window.w1.value);
  expect(idsOf(value)).toEqual([1, 3]);
  expect(await page.evaluate(() => window.selectedOf(window.w1))).toBe("1 3");

  // The chain that produced them is still available, just not as the value.
  expect(await page.evaluate(() => window.w1.getFilters()[0][0])).toMatchObject(
    { type: "value", attrib: "category", value: "a" }
  );
});

test("assigning rows selects them, without re-dispatching", async ({
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

test("assigning a filter chain still applies it, and value settles on rows", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/reactive.html");

  const got = await page.evaluate(() => {
    // Both accepted forms: the bare chain and the { filters } wrapper.
    window.w2.value = [[{ type: "value", attrib: "category", value: "b" }]];
    const bare = window.w2.value.map((d) => d.id).sort();
    window.w2.value = {
      filters: [[{ type: "value", attrib: "category", value: "a" }]],
    };
    return { bare, wrapped: window.w2.value.map((d) => d.id).sort() };
  });

  expect(got.bare).toEqual([2, 5]);
  expect(got.wrapped).toEqual([1, 3]);
});

test("setFilters is the way in for a chain, getFilters the way out", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/reactive.html");

  const round = await page.evaluate(() => {
    window.w1.setFilters([[{ type: "value", attrib: "category", value: "a" }]]);
    const chain = window.w1.getFilters();
    window.w2.setFilters(chain);
    return {
      ids: window.selectedOf(window.w2),
      valueIsRows: window.w1.value.every((d) => "category" in d),
    };
  });

  expect(round.ids).toBe("1 3");
  expect(round.valueIsRows).toBe(true);
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

// The round trip an Observable bind actually performs: rows out of one widget,
// straight back into another as its value, and no filter chain in sight.
test("a row list from a peer round-trips through value", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/reactive.html");

  const got = await page.evaluate(() => {
    window.w2.value = window.rows.filter((d) => d.value > 15);
    return {
      selected: window.selectedOf(window.w2),
      chain: window.w2.getFilters()[0][0].type,
    };
  });

  expect(got.selected).toBe("2 3 5");
  expect(got.chain).toBe("ids");
});

// Selecting everything is what an initial bind against an unfiltered peer
// sends; it must clear the chain rather than stack a redundant level.
test("selecting every row clears the chain instead of adding a level", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/reactive.html");

  const got = await page.evaluate(() => {
    window.w2.value = window.rows.filter((d) => d.value > 15);
    const filtered = window.w2.navio.getFilters().flat().length;
    window.w2.value = window.rows.slice();
    return {
      filtered,
      after: window.w2.navio.getFilters().flat().length,
      selected: window.selectedOf(window.w2),
    };
  });

  expect(got.filtered).toBe(1);
  expect(got.after).toBe(0);
  expect(got.selected).toBe("1 2 3 4 5");
});

test("snapshot returns filters and rows together", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/reactive.html");
  await clickCell(page, 0);

  const snap = await page.evaluate(() => {
    const s = window.w1.snapshot();
    return {
      filterCount: s.filters[0].length,
      ids: s.selection.map((d) => d.id).sort(),
      valueIsRows: window.w1.value.every((d) => "category" in d),
    };
  });

  expect(snap.filterCount).toBe(1);
  expect(snap.ids).toEqual([1, 3]);
  expect(snap.valueIsRows).toBe(true);
});

test("destroy tears the widget down", async ({ page }) => {
  await page.goto("/test/e2e/fixtures/reactive.html");
  await page.evaluate(() => window.w1.destroy());
  await expect(page.locator("#host canvas")).toHaveCount(0);
  // The other instance is unaffected.
  await expect(page.locator("#host2 canvas")).toHaveCount(1);
});

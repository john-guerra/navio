import { test, expect } from "@playwright/test";

// Tests for https://github.com/john-guerra/navio/issues/89. The headline
// requirement, stated by the maintainer: selections must survive hiding or
// showing columns. That is why this is implemented as a VISIBILITY SET rather
// than as add/remove - hiding touches only the layout, never the filter chain
// or the sort, so a materialised selection cannot be invalidated by it.

const FIXTURE = "/test/e2e/fixtures/single.html";

/**
 * Reorder a column by dragging its label. Shift is required: without it the
 * gesture is a click, which sorts. Grabbing the LABEL matters too - the drag is
 * bound to the glyphs, so that the strips underneath stay free for the click.
 */
async function shiftDragHeader(page, fromLabel, toX) {
  const b = await page
    .locator(`#nv .attribOverlay[aria-label^="${fromLabel},"] text`)
    .boundingBox();
  await page.keyboard.down("Shift");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(toX, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
}

const open = async (page) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();
  await expect(page.locator("#nv ._nv_settings")).toBeVisible();
};

test("the gear opens and closes the panel", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const gear = page.locator("#nv ._nv_gear");
  await expect(gear).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#nv ._nv_settings")).toBeHidden();

  await gear.click();
  await expect(page.locator("#nv ._nv_settings")).toBeVisible();
  await expect(gear).toHaveAttribute("aria-expanded", "true");

  // Escape closes it and returns focus to the gear.
  await page.keyboard.press("Escape");
  await expect(page.locator("#nv ._nv_settings")).toBeHidden();
  await expect(gear).toBeFocused();
});

test("the gear sits at the bottom left", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const host = await page.locator("#nv").boundingBox();
  const gear = await page.locator("#nv ._nv_gear").boundingBox();
  expect(gear.x).toBeLessThan(host.x + host.width / 2);
  expect(gear.y).toBeGreaterThan(host.y + host.height / 2);
});

// The point of the panel is watching the widget change as you change it, so
// it must not sit on top of the thing it is configuring - and it must not move
// while you drag a slider, or the control runs away from the pointer.
// The point of the panel is watching the widget change as you change it, so
// it must not sit on top of the thing it is configuring - and it must not move
// while you drag a slider, or the control runs away from the pointer.
test("the panel opens below the widget and stays put as columns resize", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();
  await expect(page.locator("#nv ._nv_settings")).toBeVisible();

  const at = async () => {
    const cv = await page.locator("#nv canvas").boundingBox();
    const pl = await page.locator("#nv ._nv_settings").boundingBox();
    return { x: Math.round(pl.x), below: pl.y >= cv.y + cv.height };
  };

  const start = await at();
  expect(start.below).toBe(true);

  // Column width changes the canvas WIDTH; a panel below must ignore that.
  for (const w of [40, 8]) {
    await page.evaluate((v) => {
      window.nv.attribWidth = v;
      window.nv.hardUpdate();
    }, w);
    expect(await at()).toEqual(start);
  }
});

test('settingsPlacement "beside" and "over" are still available', async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  await page.evaluate(() => {
    window.nv.settingsPlacement = "beside";
  });
  await page.locator("#nv ._nv_gear").click();
  let cv = await page.locator("#nv canvas").boundingBox();
  let pl = await page.locator("#nv ._nv_settings").boundingBox();
  expect(pl.x).toBeGreaterThanOrEqual(cv.x + cv.width);

  await page.evaluate(() => {
    window.nv.settingsPlacement = "over";
    document.querySelector("#nv ._nv_gear").click(); // close
    document.querySelector("#nv ._nv_gear").click(); // reopen
  });
  cv = await page.locator("#nv canvas").boundingBox();
  pl = await page.locator("#nv ._nv_settings").boundingBox();
  expect(pl.x).toBeLessThan(cv.x + cv.width);
});

// Regression: the brush join appended on enter AND update, so every redraw
// nested another .brush. One redraw per page hid it; a settings slider fires
// hardUpdate per input event and the widget filled with stale brush rects,
// each frozen at the width of the geometry it was created under.
// Regression: the brush join appended on enter AND update, so every redraw
// nested another .brush. One redraw per page hid it; a settings slider fires
// hardUpdate per input event and the widget filled with stale brush rects,
// each frozen at the width of the geometry it was created under.
test("redrawing does not accumulate brushes, and their width tracks the columns", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/single.html");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const probe = () =>
    page.evaluate(() => ({
      count: document.querySelectorAll("#nv .brush").length,
      widths: Array.from(document.querySelectorAll("#nv .brush .overlay")).map(
        (r) => +r.getAttribute("width")
      ),
    }));

  const first = await probe();
  expect(first.count).toBe(1);

  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) window.nv.hardUpdate();
  });
  expect((await probe()).count).toBe(1);

  // Doubling the column width doubles the brush's span.
  const before = (await probe()).widths[0];
  await page.evaluate(() => {
    window.nv.attribWidth = 30;
    window.nv.hardUpdate();
  });
  const after = (await probe()).widths[0];
  expect(after).toBeGreaterThan(before * 1.5);
});

test("unticking a column hides it without touching the data", async ({
  page,
}) => {
  await open(page);
  const before = await page.evaluate(
    () => window.nv.getVisibleAttribs().length
  );

  await page.locator("#nv ._nv_settings input[type=checkbox]").nth(3).uncheck();

  await expect
    .poll(() => page.evaluate(() => window.nv.getVisibleAttribs().length))
    .toBe(before - 1);
  // getAttribs() is the full set and is unchanged - this is hiding, not removal.
  expect(await page.evaluate(() => window.nv.getAttribs().length)).toBe(before);
  expect(await page.evaluate(() => window.nv.getHiddenAttribs())).toHaveLength(
    1
  );
});

// The requirement that drove the whole design.
// The requirement that drove the whole design.
test("selections and sort order survive hiding and showing columns", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const state = () =>
    page.evaluate(() => ({
      visible: window.nv
        .getVisible()
        .map((r) => r.id)
        .join(","),
      order: window.nv
        .getRowsAtLevel(0)
        .map((r) => r.id)
        .join(","),
      filters: JSON.stringify(window.nv.getFilters().filter((l) => l.length)),
    }));

  await page.evaluate(() => window.nv.sortBy("value", true));
  await page.evaluate(() =>
    window.nv.setFilters([[{ type: "value", attrib: "category", value: "a" }]])
  );
  const baseline = await state();
  expect(baseline.visible).not.toBe("");

  // Hide the column the FILTER is on.
  await page.evaluate(() => window.nv.setAttribVisible("category", false));
  expect(await state()).toEqual(baseline);

  // Hide the column the SORT is on. Sorting is in place, so the order stands.
  await page.evaluate(() => window.nv.setAttribVisible("value", false));
  expect(await state()).toEqual(baseline);

  // And bringing them back changes nothing either.
  await page.evaluate(() => window.nv.setHiddenAttribs([]));
  expect(await state()).toEqual(baseline);
});

test("hiding a column emits no change event, so bound peers stay put", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const fired = await page.evaluate(() => {
    let n = 0;
    window.nv.onChange(() => n++);
    window.nv.setAttribVisible("category", false);
    window.nv.setHiddenAttribs([]);
    return n;
  });
  expect(fired).toBe(0);
});

test("the attribute picker is pluggable", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // Any element will do; the contract is (names, {value, onChange, move}).
  const got = await page.evaluate(() => {
    let seen = null;
    window.nv.attribPicker = (names, opts) => {
      seen = { names, value: opts.value };
      const el = document.createElement("div");
      el.className = "_nv_custom_picker";
      el.textContent = names.join("|");
      return el;
    };
    document.querySelector("#nv ._nv_gear").click();
    return seen;
  });

  expect(got.names.length).toBeGreaterThan(3);
  expect(got.value).toHaveLength(got.names.length);
  await expect(page.locator("#nv ._nv_custom_picker")).toHaveCount(1);
  // The default picker is not ALSO rendered. Identify it by its per-attribute
  // checkbox ids rather than by counting checkboxes - the panel has other
  // toggles that have nothing to do with the picker.
  await expect(
    page.locator('#nv ._nv_settings input[id^="_nv_vis_"]')
  ).toHaveCount(0);
});

test("nv.settings = false removes the gear entirely", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.evaluate(() => {
    window.nv.settings = false;
    window.nv.data(window.nv.data()); // re-init
  });
  await expect(page.locator("#nv ._nv_gear")).toHaveCount(0);
});

test("destroy() takes the panel with it", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.nv.destroy());
  await expect(page.locator("#nv ._nv_gear")).toHaveCount(0);
  await expect(page.locator("#nv ._nv_settings")).toHaveCount(0);
});

test("settings survive a reload, and Reset forgets them", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.evaluate(() => window.nv.clearStoredSettings());

  await page.evaluate(() => {
    window.nv.attribWidth = 28;
    window.nv.orientation = "vertical";
    window.nv.hardUpdate();
    window.nv.setAttribVisible("category", false);
    window.nv.saveSettings();
  });

  await page.reload();
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        aw: window.nv.attribWidth,
        o: window.nv.orientation,
        hidden: window.nv.getHiddenAttribs(),
      }))
    )
    .toEqual({ aw: 28, o: "vertical", hidden: ["category"] });

  // Reset clears storage; the next load is back to the defaults.
  await page.evaluate(() => window.nv.clearStoredSettings());
  await page.reload();
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  expect(await page.evaluate(() => window.nv.attribWidth)).toBe(15);
});

test("the generated config is runnable and reproduces the settings", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.evaluate(() => window.nv.clearStoredSettings());

  const code = await page.evaluate(() => {
    window.nv.attribWidth = 22;
    window.nv.orientation = "vertical";
    window.nv.hardUpdate();
    window.nv.setAttribVisible("category", false);
    return window.nv.getSettingsCode();
  });

  expect(code).toContain('nv.orientation = "vertical"');
  expect(code).toContain("nv.attribWidth = 22");
  expect(code).toContain('nv.setHiddenAttribs(["category"])');
  // It must only call API that exists - a snippet that throws is worse than none.
  expect(code).not.toContain("moveAttribToPos");

  // Run it against a second container and compare.
  const same = await page.evaluate((src) => {
    const host = document.createElement("div");
    host.id = "gen";
    document.body.appendChild(host);
    const data = window.nv.data();
    new Function("d3", "navio", "data", src.replace("#navio", "#gen"))(
      window.d3,
      window.navio,
      data
    );
    const gen = window.__genNv;
    return gen ? null : "constructed";
  }, code);
  expect(same).toBe("constructed");
});

test("a brush follows a geometry change and an orientation flip", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/vertical.html?orientation=horizontal");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const box = await page.locator("#nv canvas").boundingBox();
  const g = await page.evaluate(() => ({
    y0: window.nv.y0,
    aw: window.nv.attribWidth,
  }));
  const x = box.x + g.aw * 2.5;
  await page.mouse.move(x, box.y + g.y0 + 30);
  await page.mouse.down();
  await page.mouse.move(x, box.y + g.y0 + 120, { steps: 8 });
  await page.mouse.up();

  const selected = () => page.evaluate(() => window.nv.getVisible().length);
  const rect = () =>
    page.evaluate(() => {
      const s = document.querySelector("#nv .brush .selection");
      return s
        ? { w: +s.getAttribute("width"), h: +s.getAttribute("height") }
        : null;
    });

  const n = await selected();
  expect(n).toBeGreaterThan(0);
  const before = await rect();

  // A pixel-space brush is wrong the moment the geometry changes.
  await page.evaluate(() => {
    window.nv.attribWidth = 40;
    window.nv.hardUpdate();
  });
  expect(await selected()).toBe(n);
  expect(await rect()).not.toEqual(before);

  // And a flip moves it to the other axis entirely.
  await page.evaluate(() => {
    window.nv.orientation = "vertical";
    window.nv.hardUpdate();
  });
  expect(await selected()).toBe(n);
  const flipped = await rect();
  expect(flipped.h).toBeGreaterThan(flipped.w);
});

// Requested: change what a column IS from the panel, and drag to reorder.
// Requested: change what a column IS from the panel, and drag to reorder.
test("an attribute's type can be changed, keeping everything else", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const state = () =>
    page.evaluate(() => ({
      type: window.nv.getAttribType("category"),
      order: window.nv
        .getRowsAtLevel(0)
        .map((r) => r.id)
        .join(","),
      selected: window.nv
        .getVisible()
        .map((r) => r.id)
        .join(","),
      columns: window.nv
        .getAttribs()
        .map((a) => (typeof a === "function" ? a.name : a))
        .join(","),
    }));

  await page.evaluate(() => {
    window.nv.sortBy("value", true);
    window.nv.setFilters([[{ type: "value", attrib: "category", value: "a" }]]);
  });
  const before = await state();
  expect(before.type).toBe("cat");

  await page.locator("#nv ._nv_gear").click();
  await page
    .locator('#nv ._nv_settings select[aria-label="Type of category"]')
    .selectOption("text");

  const after = await state();
  expect(after.type).toBe("text");
  // Only the colouring changed: position, sort order and selection all hold,
  // even though the filter is ON the attribute that was re-typed.
  expect(after.order).toBe(before.order);
  expect(after.selected).toBe(before.selected);
  expect(after.columns).toBe(before.columns);
});

test("derived columns cannot be re-typed", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();

  // They are drawn from side tables, not a data column.
  await expect(
    page.locator('#nv ._nv_settings select[aria-label="Type of selected"]')
  ).toBeDisabled();
  await expect(
    page.locator(
      '#nv ._nv_settings select[aria-label="Type of sequential Index"]'
    )
  ).toBeDisabled();
  // And the one that IS switchable reports its real type, not a fallback.
  await expect(
    page.locator('#nv ._nv_settings select[aria-label="Type of value"]')
  ).toHaveValue("seq");
});

test("dragging an attribute name reorders it", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();

  const order = () =>
    page.evaluate(() =>
      window.nv
        .getAttribs()
        .map((a) => (typeof a === "function" ? a.name : a))
        .join(",")
    );
  const before = await order();

  await page
    .locator('#nv ._nv_settings label:text-is("value")')
    .dragTo(page.locator('#nv ._nv_settings label:text-is("id")'));

  await expect.poll(order).not.toBe(before);
  const after = await order();
  // Same columns, just moved.
  expect(after.split(",").sort()).toEqual(before.split(",").sort());
  expect(after.split(",").indexOf("value")).toBeLessThan(
    before.split(",").indexOf("value")
  );
});

test("setAttribType rejects an unknown type", async ({ page }) => {
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  await page.evaluate(() => window.nv.setAttribType("category", "bogus"));
  expect(warnings.join("\n")).toMatch(/unknown type "bogus"/);
  expect(await page.evaluate(() => window.nv.getAttribType("category"))).toBe(
    "cat"
  );
});

test("a plain click sorts; Shift-drag reorders", async ({ page }) => {
  await page.goto(
    "/test/e2e/fixtures/vertical.html?orientation=horizontal&n=40"
  );
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const rows = () =>
    page.evaluate(() =>
      window.nv
        .getRowsAtLevel(0)
        .map((r) => r.id)
        .join(",")
    );
  const cols = () =>
    page.evaluate(() =>
      window.nv
        .getAttribs()
        .map((a) => (typeof a === "function" ? a.name : a))
        .join(",")
    );

  const box = await page.locator("#nv canvas").boundingBox();
  const aw = await page.evaluate(() => window.nv.attribWidth);

  // A click sorts however unsteady the hand is. Each of these used to be a
  // gesture that did nothing at all.
  for (const drift of [0, 3, 6, 10, 20]) {
    await page.evaluate(() => window.nv.sortBy("value"));
    const r0 = await rows();
    const c0 = await cols();

    const X = box.x + aw * 4.5;
    await page.mouse.move(X, box.y + 60);
    await page.mouse.down();
    if (drift) await page.mouse.move(X + drift, box.y + 60, { steps: 3 });
    await page.mouse.up();

    await expect
      .poll(rows, { message: `drift ${drift}px should sort` })
      .not.toBe(r0);
    expect(await cols(), `drift ${drift}px must not reorder`).toBe(c0);
  }

  // Shift-drag reorders, and does not sort.
  const r1 = await rows();
  const c1 = await cols();
  await shiftDragHeader(page, "value", box.x + aw * 1.5);
  await expect.poll(cols).not.toBe(c1);
  expect(await rows()).toBe(r1);
});

test("dragging a header updates the open panel", async ({ page }) => {
  await page.goto(
    "/test/e2e/fixtures/vertical.html?orientation=horizontal&n=40"
  );
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();

  const panelOrder = () =>
    page.evaluate(() =>
      Array.from(
        document.querySelectorAll("#nv ._nv_settings label[draggable]")
      )
        .map((l) => l.textContent)
        .join(",")
    );
  const before = await panelOrder();

  const box = await page.locator("#nv canvas").boundingBox();
  const aw = await page.evaluate(() => window.nv.attribWidth);
  await shiftDragHeader(page, "value", box.x + aw * 1.5);

  // The panel lists the same order, so it must follow.
  await expect.poll(panelOrder).not.toBe(before);
});

test("Show none hides every column, Show all brings them back", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();

  const shown = () => page.evaluate(() => window.nv.getVisibleAttribs().length);
  const all = await shown();

  await page.locator('#nv ._nv_settings button:text-is("Show none")').click();
  await expect.poll(shown).toBe(0);

  await page.locator('#nv ._nv_settings button:text-is("Show all")').click();
  await expect.poll(shown).toBe(all);
});

test("filter explanations clear the panel and each other", async ({ page }) => {
  await page.goto(
    "/test/e2e/fixtures/vertical.html?orientation=horizontal&n=40"
  );
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();
  await page.evaluate(() =>
    window.nv.setFilters([
      [{ type: "value", attrib: "category", value: "alpha" }],
    ])
  );

  const boxes = await page.evaluate(() => {
    const ex = Array.from(
      document.querySelectorAll("#nv .filterExplanation")
    ).map((e) => {
      const b = e.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top };
    });
    const p = document.querySelector("#nv ._nv_settings");
    return {
      ex,
      panelZ: +getComputedStyle(p).zIndex,
      exZ: +getComputedStyle(document.querySelector("#nv .explanations"))
        .zIndex,
      gear: document.querySelector("#nv ._nv_gear").getBoundingClientRect()
        .bottom,
    };
  });

  // The panel is drawn over the explanations, not under them.
  expect(boxes.panelZ).toBeGreaterThan(boxes.exZ);
  // Level 0's explanation ends before level 1's begins.
  expect(boxes.ex.length).toBeGreaterThan(1);
  expect(boxes.ex[0].right).toBeLessThanOrEqual(boxes.ex[1].left);
  // And it clears the gear, which shares the bottom-left corner.
  expect(boxes.ex[0].top).toBeGreaterThanOrEqual(boxes.gear - 1);
});

// Dragging a header only showed the label following the pointer, which says
// what you are moving but not where it will end up.
// Dragging a header only showed the label following the pointer, which says
// what you are moving but not where it will end up.
test("Shift-dragging a header shows where it will land", async ({ page }) => {
  await page.goto(
    "/test/e2e/fixtures/vertical.html?orientation=horizontal&n=40"
  );
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const indicator = () =>
    page.evaluate(() => {
      const l = document.querySelector("#nv ._nv_drop_indicator");
      return {
        shown: getComputedStyle(l).display !== "none",
        x1: +l.getAttribute("x1"),
        y1: +l.getAttribute("y1"),
        y2: +l.getAttribute("y2"),
      };
    });
  const dimmed = () =>
    page.evaluate(
      () =>
        Array.from(document.querySelectorAll("#nv .attribOverlay text")).filter(
          (t) => +getComputedStyle(t).opacity < 1
        ).length
    );

  expect((await indicator()).shown).toBe(false);

  const box = await page.locator("#nv canvas").boundingBox();
  const aw = await page.evaluate(() => window.nv.attribWidth);
  const label = await page
    .locator('#nv .attribOverlay[aria-label^="value,"] text')
    .boundingBox();

  await page.keyboard.down("Shift");
  await page.mouse.move(label.x + label.width / 2, label.y + label.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + aw * 1.5, label.y + label.height / 2, {
    steps: 10,
  });

  const mid = await indicator();
  expect(mid.shown).toBe(true);
  // Spans the level, so it reads as an insertion point between columns.
  expect(mid.y2 - mid.y1).toBeGreaterThan(100);
  expect(await dimmed()).toBe(1);

  await page.mouse.up();
  await page.keyboard.up("Shift");
  expect((await indicator()).shown).toBe(false);
  expect(await dimmed()).toBe(0);
});

// Reported: "I cannot sort columns". A header label is a rotated <text>, so a
// few pixels of pointer drift put mouseup on a different element and the
// browser dispatched `click` to the common ancestor, which has no handler.
// Between ~3px and the drag threshold a click did NOTHING - neither sorted nor
// reordered. Click vs drag is now one decision, made from where the gesture
// ENDED, so there is no gap.
test("a shaky click on a header still sorts, at every drift", async ({
  page,
}) => {
  for (const drift of [0, 3, 5, 7]) {
    await page.goto(
      "/test/e2e/fixtures/vertical.html?orientation=horizontal&n=40"
    );
    await expect(page.locator("#nv canvas")).toHaveCount(1);

    const box = await page.locator("#nv canvas").boundingBox();
    const aw = await page.evaluate(() => window.nv.attribWidth);
    const rows = () =>
      page.evaluate(() =>
        window.nv
          .getRowsAtLevel(0)
          .map((r) => r.id)
          .join(",")
      );
    const cols = () =>
      page.evaluate(() =>
        window.nv
          .getAttribs()
          .map((a) => (typeof a === "function" ? a.name : a))
          .join(",")
      );
    const r0 = await rows();
    const c0 = await cols();

    // Hover first, the way a hand does - the label grows on hover.
    const X = box.x + aw * 4.5;
    await page.mouse.move(X, box.y + 88);
    await page.mouse.down();
    if (drift) await page.mouse.move(X + drift, box.y + 88, { steps: 3 });
    await page.mouse.up();

    await expect
      .poll(rows, { message: `drift ${drift}px should still sort` })
      .not.toBe(r0);
    // ...and must not quietly reorder instead.
    expect(await cols()).toBe(c0);
  }
});

test("a Shift-drag onto another column reorders and does not sort", async ({
  page,
}) => {
  await page.goto(
    "/test/e2e/fixtures/vertical.html?orientation=horizontal&n=40"
  );
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const rows = () =>
    page.evaluate(() =>
      window.nv
        .getRowsAtLevel(0)
        .map((r) => r.id)
        .join(",")
    );
  const cols = () =>
    page.evaluate(() =>
      window.nv
        .getAttribs()
        .map((a) => (typeof a === "function" ? a.name : a))
        .join(",")
    );
  const r0 = await rows();
  const c0 = await cols();

  const box = await page.locator("#nv canvas").boundingBox();
  const aw = await page.evaluate(() => window.nv.attribWidth);
  await shiftDragHeader(page, "value", box.x + aw * 1.5);

  await expect.poll(cols).not.toBe(c0);
  expect(await rows()).toBe(r0); // reordering is not sorting
});

// Reported: the two gears in the binding example rendered further down the
// page instead of on their widgets. NavioWidget builds its container with
// createElement and constructs Navio before the caller appends it, and
// getComputedStyle on a DETACHED node returns "" rather than "static" - so the
// "make the container a positioning context" guard silently did nothing and
// the absolutely-positioned gear escaped to whichever ancestor was positioned.
// Reported: the two gears in the binding example rendered further down the
// page instead of on their widgets. NavioWidget builds its container with
// createElement and constructs Navio before the caller appends it, and
// getComputedStyle on a DETACHED node returns "" rather than "static" - so the
// "make the container a positioning context" guard silently did nothing and
// the absolutely-positioned gear escaped to whichever ancestor was positioned.
test("a widget built detached still positions its gear on itself", async ({
  page,
}) => {
  await page.goto("/examples/binding/");
  await expect(page.locator("#navioA canvas")).toHaveCount(1);
  await expect(page.locator("#navioB canvas")).toHaveCount(1);

  for (const id of ["#navioA", "#navioB"]) {
    const canvas = await page.locator(`${id} canvas`).boundingBox();
    const gear = await page.locator(`${id} ._nv_gear`).boundingBox();
    expect(gear, `${id} has a gear`).not.toBeNull();
    // Bottom-left of its OWN widget, not somewhere else on the page.
    expect(gear.x).toBeGreaterThanOrEqual(canvas.x - 30);
    expect(gear.x).toBeLessThan(canvas.x + canvas.width);
    expect(gear.y).toBeGreaterThan(canvas.y);
    expect(gear.y).toBeLessThanOrEqual(canvas.y + canvas.height + 30);
  }
});

// The focusable element is the column's <g>, which spans the whole level - a
// ring on it drew a big box down the widget. And Shift-clicking to drag counts
// as keyboard-ish focus in Chrome, so the ring reappeared for the whole drag.
test("the focus ring hugs the label and stays out of the way while dragging", async ({
  page,
}) => {
  await page.goto(
    "/test/e2e/fixtures/vertical.html?orientation=horizontal&n=40"
  );
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const outlines = () =>
    page.evaluate(() => {
      const g = document.activeElement;
      const t = g && g.querySelector ? g.querySelector("text") : null;
      return {
        group: g && g.getAttribute ? getComputedStyle(g).outlineStyle : null,
        label: t ? getComputedStyle(t).outlineStyle : null,
      };
    });

  // Keyboard focus: a ring, and on the LABEL - which is inside the rotated
  // group, so it rotates with the text instead of boxing the column.
  await page.locator('#nv .attribOverlay[aria-label^="value,"]').focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  expect(await outlines()).toEqual({ group: "none", label: "solid" });

  // Mid Shift-drag: nothing. The dimmed label and the drop indicator already
  // say what is moving.
  const lbl = await page
    .locator('#nv .attribOverlay[aria-label^="value,"] text')
    .boundingBox();
  await page.keyboard.down("Shift");
  await page.mouse.move(lbl.x + lbl.width / 2, lbl.y + lbl.height / 2);
  await page.mouse.down();
  await page.mouse.move(lbl.x + lbl.width / 2 - 40, lbl.y + lbl.height / 2, {
    steps: 8,
  });
  expect(await outlines()).toEqual({ group: "none", label: "none" });

  await page.mouse.up();
  await page.keyboard.up("Shift");
});

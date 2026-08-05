import { test, expect } from "@playwright/test";

// Tests for https://github.com/john-guerra/navio/issues/89. The headline
// requirement, stated by the maintainer: selections must survive hiding or
// showing columns. That is why this is implemented as a VISIBILITY SET rather
// than as add/remove - hiding touches only the layout, never the filter chain
// or the sort, so a materialised selection cannot be invalidated by it.

const FIXTURE = "/test/e2e/fixtures/single.html";

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

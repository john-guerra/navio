import { test, expect } from "@playwright/test";

// Options used to be settable only as properties after construction, which
// silently failed for the ~third of them that are read once (during
// construction, inside data(), or inside addAllAttribs). NavioWidget passed
// them through blindly, so a typo landed as a dead property and did nothing.

const FIXTURE = "/test/e2e/fixtures/options.html";

test("the constructor accepts an options object", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#a canvas")).toHaveCount(1);

  expect(
    await page.evaluate(() => ({
      attribWidth: window.a.attribWidth,
      orientation: window.a.orientation,
      // Read during construction - assigning it afterwards was too late.
      tooltipBg: getComputedStyle(document.querySelector("._nv_popover"))
        .backgroundColor,
    }))
  ).toEqual({
    attribWidth: 22,
    orientation: "vertical",
    tooltipBg: "rgb(255, 0, 0)",
  });
});

test("a number is still the height, as it always was", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#b canvas")).toHaveCount(1);
  expect(await page.evaluate(() => window.b.height())).toBe(321);
});

test("options read inside data() and addAllAttribs are applied in time", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#c canvas")).toHaveCount(1);

  const got = await page.evaluate(() => ({
    seqColumn: window.c.getAttribs().includes("__seqId"),
    // maxNumDistinctForCategorical: 2 forces the 3-value column to "ordered".
    catThreshold: window.c.maxNumDistinctForCategorical,
  }));
  expect(got.seqColumn).toBe(false); // showSequenceIDAttrib: false took effect
  expect(got.catThreshold).toBe(2);
});

test("an unknown option warns instead of silently doing nothing", async ({
  page,
}) => {
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await page.goto(FIXTURE);
  await expect(page.locator("#d canvas")).toHaveCount(1);

  expect(warnings.join("\n")).toMatch(/unknown option "attribWidht"/);
  // And it did not land as a dead property.
  expect(await page.evaluate(() => window.d.attribWidht)).toBeUndefined();
});

test("the renamed typo options still work, with a warning", async ({
  page,
}) => {
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await page.goto(FIXTURE);
  await expect(page.locator("#e canvas")).toHaveCount(1);

  expect(warnings.join("\n")).toMatch(
    /"maxNumDistictForCategorical" was a typo/
  );
  // The value forwarded to the correctly-spelled option.
  expect(await page.evaluate(() => window.e.maxNumDistinctForCategorical)).toBe(
    3
  );
  // And reading the old name still works.
  expect(await page.evaluate(() => window.e.maxNumDistictForCategorical)).toBe(
    3
  );
});

test("getOptions round-trips into a new instance", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#a canvas")).toHaveCount(1);

  const same = await page.evaluate(() => {
    const opts = window.a.getOptions();
    const host = document.createElement("div");
    document.body.appendChild(host);
    // eslint-disable-next-line no-undef
    const clone = new navio(d3.select(host), { ...opts, height: 300 });
    clone.data(window.rows);
    clone.addAllAttribs();
    const before = window.a.getOptions();
    const after = clone.getOptions();
    const differing = Object.keys(before).filter(
      (k) => typeof before[k] !== "function" && before[k] !== after[k]
    );
    clone.destroy();
    return differing;
  });

  expect(same).toEqual([]);
});

test("NavioWidget passes every option through to navio", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#w canvas")).toHaveCount(1);

  expect(
    await page.evaluate(() => ({
      attribWidth: window.w.navio.attribWidth,
      orientation: window.w.navio.orientation,
      height: window.w.navio.height(),
    }))
  ).toEqual({ attribWidth: 18, orientation: "vertical", height: 250 });
});

test("legendFont is gone - it had no read sites", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#a canvas")).toHaveCount(1);
  expect(await page.evaluate(() => "legendFont" in window.a)).toBe(false);
});

test("setOptions warns for options that are read once", async ({ page }) => {
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await page.goto(FIXTURE);
  await expect(page.locator("#a canvas")).toHaveCount(1);

  await page.evaluate(() => {
    // attribWidth is re-read every draw; tooltipBgColor is not.
    window.a.setOptions({ attribWidth: 30, tooltipBgColor: "#00ff00" });
  });

  expect(warnings.join("\n")).toMatch(/"tooltipBgColor" is read once/);
  expect(warnings.join("\n")).not.toMatch(/"attribWidth" is read once/);
  // The live one still applied.
  expect(await page.evaluate(() => window.a.attribWidth)).toBe(30);
});

test("id is a real option, not an unknown one", async ({ page }) => {
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await page.goto(FIXTURE);
  await expect(page.locator("#w canvas")).toHaveCount(1);

  // nv.id is an accessor defined late in the closure, so a naive schema
  // snapshot rejects it - and assigning it would replace the function.
  expect(warnings.join("\n")).not.toMatch(/unknown option "id"/);
  expect(await page.evaluate(() => window.w.navio.id())).toBe("id");
});

// Requested: a misspelled COLUMN should say so, not draw a stripe of nulls.
test("adding an attribute that is not in the data warns", async ({ page }) => {
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await page.goto(FIXTURE);
  await expect(page.locator("#a canvas")).toHaveCount(1);

  await page.evaluate(() => window.a.addCategoricalAttrib("caat"));

  expect(warnings.join("\n")).toMatch(/"caat" is not in the data/);
  // It still lists what IS available, so the typo is obvious.
  expect(warnings.join("\n")).toMatch(/Available: .*\bcat\b/);
});

test("a real attribute does not warn", async ({ page }) => {
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await page.goto(FIXTURE);
  await expect(page.locator("#a canvas")).toHaveCount(1);

  await page.evaluate(() => {
    window.a.data(window.rows); // reset so "v" is addable
    window.a.addSequentialAttrib("v");
  });
  expect(warnings.join("\n")).not.toMatch(/is not in the data/);
});

test("sorting by an attribute that was never added warns and does nothing", async ({
  page,
}) => {
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await page.goto(FIXTURE);
  await expect(page.locator("#a canvas")).toHaveCount(1);

  const before = await page.evaluate(() =>
    window.a
      .getRowsAtLevel(0)
      .map((r) => r.id)
      .join(",")
  );
  await page.evaluate(() => window.a.sortBy("nope"));

  expect(warnings.join("\n")).toMatch(/"nope" is not one of the attributes/);
  const after = await page.evaluate(() =>
    window.a
      .getRowsAtLevel(0)
      .map((r) => r.id)
      .join(",")
  );
  expect(after).toBe(before);

  // And a real one still sorts.
  await page.evaluate(() => window.a.sortBy("v", true));
  expect(
    await page.evaluate(() =>
      window.a
        .getRowsAtLevel(0)
        .map((r) => r.id)
        .join(",")
    )
  ).not.toBe(before);
});

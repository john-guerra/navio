import { test, expect } from "@playwright/test";

// Categorical colour used to come from d3.schemeCategory10, which holds ten
// colours, and d3.scaleOrdinal RECYCLES its range - so category 11 was drawn in
// exactly the colour of category 1 and nothing said so. Two categories sharing
// a colour is a lie about the data that the reader has no way to detect.
//
// The default is now a generated 50-colour palette, and defaultColorCategorical
// accepts a FUNCTION of the category count as well as an array, so a palette can
// be sized to the column.
//
// Note none of this could work before: there was no `cat` branch in
// updateColorDomains at all, so the category count was never known - scaleOrdinal
// simply grew its domain as values arrived.

const F = "/test/e2e/fixtures/palette-option.html";

const load = async (page, query = "") => {
  await page.goto(`${F}${query}`);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
};

const assigned = (page) => page.evaluate(() => window.assigned());

test("25 categories get 25 different colours", async ({ page }) => {
  await load(page, "?cats=25");
  const colours = await assigned(page);

  expect(colours).toHaveLength(25);
  expect(new Set(colours).size, "distinct colours").toBe(25);
});

// The same palette at every count, deliberately. Using schemeCategory10 below
// eleven and switching after was considered and measured: at ten categories the
// first ten of `nameable` beat it on normal vision (16.6 against 16.2), on
// nameability (0.51 against 0.49, and none confused against one), and on the
// worst vision type by 14.0 against 1.6 - below the just-noticeable difference.
// There was no trade to make, and a switch would also mean a ten-category
// column and an eleven-category column on one page came from visibly different
// palettes.
test("a small column uses the same palette as a large one", async ({
  page,
}) => {
  await load(page, "?cats=8");
  const colours = await assigned(page);

  expect(new Set(colours).size).toBe(8);

  const head = await page.evaluate(() =>
    window.navio.palettes.nameable.slice(0, 8).map((c) => c.toLowerCase())
  );
  expect(colours.map((c) => c.toLowerCase())).toEqual(head);
});

test("50 categories still get 50 different colours", async ({ page }) => {
  await load(page, "?cats=50");
  const colours = await assigned(page);

  expect(new Set(colours).size).toBe(50);
});

test("the old scheme is still available, and still recycles", async ({
  page,
}) => {
  await load(page, "?cats=25&palette=category10");
  const colours = await assigned(page);

  // Kept as an option so anyone who wants the pre-0.3.0 look can have it -
  // including the recycling, which is what it does.
  expect(colours).toHaveLength(25);
  expect(new Set(colours).size).toBe(10);
});

test("a palette can be a function of the category count", async ({ page }) => {
  await load(page, "?cats=25&custom=fn");

  // Called with the real count, not a guess.
  expect(await page.evaluate(() => window.calledWith)).toContain(25);
  expect(new Set(await assigned(page)).size).toBe(25);
});

test("a built-in generator is sized to the data", async ({ page }) => {
  await load(page, "?cats=32&palette=turbo");
  const colours = await assigned(page);

  expect(colours).toHaveLength(32);
  expect(new Set(colours).size).toBe(32);
});

test("an array shorter than the data warns, once, and says what to do", async ({
  page,
}) => {
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });

  await load(page, "?cats=25&custom=array");

  // Three colours for 25 categories still recycles - that is scaleOrdinal - but
  // it is no longer silent, and the message names the way out.
  const recycling = warnings.filter((w) => w.includes("colours repeat"));
  expect(recycling, "warned exactly once").toHaveLength(1);
  expect(recycling[0]).toContain("25 categories");
  expect(recycling[0]).toContain("navio.palettes");
});

test("navio.palettes exposes the built-ins", async ({ page }) => {
  await load(page, "?cats=12");

  const shape = await page.evaluate(() => {
    const p = window.navio.palettes;
    return {
      names: Object.keys(p).sort(),
      nameableLength: p.nameable.length,
      turboIsFunction: typeof p.turbo === "function",
      // Cyclical interpolators sampled at i/n must not repeat their endpoints.
      rainbowEndsDiffer: p.rainbow(10)[0] !== p.rainbow(10)[9],
    };
  });

  expect(shape.names).toEqual([
    "category10",
    "distinct",
    "mokole",
    "nameable",
    "rainbow",
    "sinebow",
    "tableau10",
    "turbo",
  ]);
  expect(shape.nameableLength).toBe(50);
  expect(shape.turboIsFunction).toBe(true);
  expect(shape.rainbowEndsDiffer).toBe(true);
});

// Changing the palette after the columns exist is the ordinary way to do it -
// addAllAttribs runs, you look at the result, you pick a different palette. It
// silently did nothing: the range was resolved once, when the column was added,
// and only a FUNCTION palette was ever re-resolved afterwards. The palettes
// example hid this by destroying and rebuilding the widget for every click.
test("setting the palette after addAllAttribs takes effect", async ({
  page,
}) => {
  await load(page, "?cats=12");
  const before = await assigned(page);

  await page.evaluate(() => window.setPalette("mokole"));
  const after = await assigned(page);

  const mokole = await page.evaluate(() =>
    window.navio.palettes.mokole.slice(0, 12).map((c) => c.toLowerCase())
  );
  expect(after.map((c) => c.toLowerCase())).toEqual(mokole);
  expect(after).not.toEqual(before);
});

test("a function palette set afterwards is called with the real count", async ({
  page,
}) => {
  await load(page, "?cats=12");

  const n = await page.evaluate(() => {
    const seen = [];
    window.setPalette((count) => {
      seen.push(count);
      return window.d3
        .range(count)
        .map((i) => window.d3.interpolateCool(i / count));
    });
    return seen;
  });

  expect(n).toContain(12);
});

// A caller who passes their own scale has said what they want. Navio needs the
// domain to know the category count, but the colours are theirs.
test("a caller's own scale keeps its colours and its domain order", async ({
  page,
}) => {
  await load(page, "?cats=3&custom=own");

  expect(await assigned(page)).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
  expect(
    await page.evaluate(() => window.nv.getColorScale("cat").domain())
  ).toEqual(["c2", "c1", "c0"]);

  // And it survives a palette change aimed at the columns Navio does own.
  await page.evaluate(() => window.setPalette("turbo"));
  expect(await assigned(page)).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
});

// Four values are drawn in nullColor rather than a category colour: undefined,
// null, "" and "none". They were still going into the scale's domain, so each
// one present consumed a palette colour that could never appear, and pushed
// every category after it along. With all four present a 12-category column
// asked for a 16-colour palette and used 12 of them.
test("missing values are not categories", async ({ page }) => {
  await load(page, "?cats=12&nulls=1");

  const domain = await page.evaluate(() =>
    window.nv.getColorScale("cat").domain()
  );
  expect(domain).not.toContain(null);
  expect(domain).not.toContain("");
  expect(domain).not.toContain("none");
  expect(domain).toHaveLength(12);

  // And the colours are the first twelve, not the first sixteen minus gaps.
  const head = await page.evaluate(() =>
    window.navio.palettes.nameable.slice(0, 12).map((c) => c.toLowerCase())
  );
  expect((await assigned(page)).map((c) => c.toLowerCase())).toEqual(head);
});

test("gaps do not push a full column into a false recycling warning", async ({
  page,
}) => {
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });

  // Fifty categories and a fifty-colour palette: an exact fit. Counting the
  // four kinds of gap as categories made it 54 and warned about a repeat that
  // does not happen - the gaps are drawn in nullColor.
  await load(page, "?cats=50&nulls=1");

  expect(warnings.filter((w) => w.includes("colours repeat"))).toEqual([]);
  expect(new Set(await assigned(page)).size).toBe(50);
});

import { test, expect } from "@playwright/test";

// Two crashes reported from a notebook, both of which only surface off the
// default configuration and neither of which throws where a model-only test
// would see it.

const F = "/test/e2e/fixtures/empty-and-bound.html";

/** Everything the page reports, including d3's console.error on a bad attr. */
const watching = (page) => {
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push("console: " + m.text());
  });
  return errs;
};

// Hiding every column leaves the ATTRIBUTE scale with an empty domain, so
// domain()[0] and domain()[length - 1] are undefined; scaleBand answers
// undefined for a value it does not know, and `levelScale(level) + undefined`
// is NaN. d3 writes that straight into the brush rects and the browser rejects
// each one - "<rect> attribute y: Expected length, NaN". Nothing throws, so
// this is invisible to any assertion on getVisibleAttribs().
test("hiding every column does not put NaN into the brush rects", async ({
  page,
}) => {
  const errs = watching(page);
  await page.goto(F + "?bind=off&a=horizontal");
  await expect(page.locator("#hostA canvas")).toHaveCount(1);

  await page.evaluate(() =>
    window.a.navio.setHiddenAttribs(
      window.a.navio
        .getAttribs()
        .map((x) => (typeof x === "string" ? x : x.name))
    )
  );
  await expect
    .poll(() => page.evaluate(() => window.a.navio.getVisibleAttribs().length))
    .toBe(0);

  expect(errs).toEqual([]);
});

test("an emptied widget can be repopulated", async ({ page }) => {
  const errs = watching(page);
  await page.goto(F + "?bind=off&a=horizontal");
  await expect(page.locator("#hostA canvas")).toHaveCount(1);

  await page.evaluate(() => {
    const nv = window.a.navio;
    const all = nv
      .getAttribs()
      .map((x) => (typeof x === "string" ? x : x.name));
    nv.setHiddenAttribs(all);
    nv.setHiddenAttribs([]);
  });
  await expect
    .poll(() => page.evaluate(() => window.a.navio.getVisibleAttribs().length))
    .toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

// `deleteSubsequentLevels` returned undefined when there was nothing to delete,
// but every caller threads its return value straight back:
//   newData = deleteSubsequentLevels(...)  ->  d3.range(fromLevel, newData.length)
// With nestedFilters ON the level chain has already grown past 1 by the time we
// get there, which is why the default configuration never hit it. Turning the
// setting off - there is a checkbox for it in the settings panel - made the
// FIRST brush throw "Cannot read properties of undefined (reading 'length')".
test("brushing works with nestedFilters off", async ({ page }) => {
  const errs = watching(page);
  await page.goto(F);
  await expect(page.locator("#hostA canvas")).toHaveCount(1);
  await page.evaluate(() => {
    window.a.navio.nestedFilters = false;
  });

  const g = await page.evaluate(() => {
    const r = document
      .querySelector("#hostA .brush .overlay")
      .getBoundingClientRect();
    return { x: r.x, y: r.y, h: r.height };
  });
  await page.mouse.move(g.x + 20, g.y + g.h / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + 60, g.y + g.h / 2, { steps: 5 });
  await page.mouse.move(g.x + 150, g.y + g.h / 2, { steps: 10 });
  await page.mouse.up();

  await expect
    .poll(() => page.evaluate(() => window.a.getSelected().length))
    .toBeLessThan(60);
  expect(errs).toEqual([]);
});

// The knock-on: the source threw before it could notify, so a widget bound to
// it silently kept the full dataset. The crash was visible in the console; the
// peer being wrong was not.
test("a bound peer follows a brush made with nestedFilters off", async ({
  page,
}) => {
  await page.goto(F);
  await expect(page.locator("#hostA canvas")).toHaveCount(1);
  await page.evaluate(() => {
    window.a.navio.nestedFilters = false;
  });

  const g = await page.evaluate(() => {
    const r = document
      .querySelector("#hostA .brush .overlay")
      .getBoundingClientRect();
    return { x: r.x, y: r.y, h: r.height };
  });
  await page.mouse.move(g.x + 20, g.y + g.h / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + 60, g.y + g.h / 2, { steps: 5 });
  await page.mouse.move(g.x + 150, g.y + g.h / 2, { steps: 10 });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(() => [
        window.a.getSelected().length,
        window.b.getSelected().length,
      ])
    )
    .toEqual(
      await page.evaluate(() => [
        window.a.getSelected().length,
        window.a.getSelected().length,
      ])
    );
});

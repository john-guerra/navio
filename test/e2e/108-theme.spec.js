import { test, expect } from "@playwright/test";

// Navio ships no stylesheet: its chrome is inline styles and canvas strokes, so
// a dark page got black header labels on a black ground and there was no CSS
// hook to fix it from outside.
//
// Two rules shape this, and both are deliberate:
//
//   CHROME ADAPTS, DATA COLOURS NEVER. Labels, counts, borders, dividers, the
//   panel, the tooltip and the null colour follow the theme. The categorical
//   and sequential scales do not - inverting them would change what a colour
//   MEANS, and a palette chosen for contrast on white does not become correct
//   by flipping it.
//
//   THE WIDGET STAYS TRANSPARENT. It sits on the page's own ground rather than
//   painting one, so it works in a notebook cell of any colour.

const F = "/test/e2e/fixtures/theme.html";

const load = async (page, query = "") => {
  await page.goto(`${F}${query}`);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
};

/** Perceived lightness, so a test can say "light" or "dark" without pinning hexes. */
const lightness = (css) => {
  const m = css.match(/\d+/g).map(Number);
  return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
};

test("headers are dark on a light page", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await load(page);

  expect(await page.evaluate(() => window.resolved())).toBe("light");
  expect(
    lightness(await page.evaluate(() => window.headerFill()))
  ).toBeLessThan(90);
});

test("headers are light on a dark page", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await load(page);

  // The whole complaint: a label the colour of the background is not a label.
  expect(await page.evaluate(() => window.resolved())).toBe("dark");
  expect(
    lightness(await page.evaluate(() => window.headerFill()))
  ).toBeGreaterThan(140);
});

test("the settings panel follows too", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await load(page);
  await page.locator("#nv ._nv_gear").click();

  const { background, color } = await page.evaluate(() =>
    window.panelColours()
  );
  expect(lightness(background), "panel background").toBeLessThan(90);
  expect(lightness(color), "panel text").toBeGreaterThan(140);
});

test("theme: dark wins over a light page, and the reverse", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await load(page, "?theme=dark");
  expect(await page.evaluate(() => window.resolved())).toBe("dark");
  expect(
    lightness(await page.evaluate(() => window.headerFill()))
  ).toBeGreaterThan(140);

  await page.emulateMedia({ colorScheme: "dark" });
  await load(page, "?theme=light");
  expect(await page.evaluate(() => window.resolved())).toBe("light");
  expect(
    lightness(await page.evaluate(() => window.headerFill()))
  ).toBeLessThan(90);
});

// "auto" has to mean auto, not "auto once at construction".
//
// The live half - a prefers-color-scheme listener - cannot be driven from here.
// Playwright's emulateMedia updates the MediaQueryList's `matches` (verified:
// false then true on the very object Navio holds) but does not dispatch
// `change` to a listener registered while the document was loading, which is
// when a widget registers. A listener added afterwards from the test DOES fire,
// so this is the harness and not the code.
//
// What is testable, and what actually matters, is that the theme is resolved
// FRESH rather than captured once: change the system setting and the next
// redraw is in the new theme. The listener exists so that redraw happens by
// itself; it is asserted below only by the fact that destroy() detaches it.
test("the theme is re-read, not captured at construction", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await load(page);
  const before = lightness(await page.evaluate(() => window.headerFill()));
  expect(before).toBeLessThan(90);

  await page.emulateMedia({ colorScheme: "dark" });
  expect(await page.evaluate(() => window.resolved())).toBe("dark");

  await page.evaluate(() => window.nv.hardUpdate());
  expect(
    lightness(await page.evaluate(() => window.headerFill())),
    "the next redraw is dark"
  ).toBeGreaterThan(140);
});

// NOT COVERED: that destroy() detaches the prefers-color-scheme listener.
// Two attempts to count listeners by patching MediaQueryList.prototype and then
// EventTarget.prototype both intercepted nothing, and a test that cannot fail
// is worse than an admitted gap. The removal is five lines in destroy(),
// symmetrical with the keydown/keyup and pointerdown listeners it already
// takes off, but nothing here proves it runs.

test("the widget never paints its own background", async ({ page }) => {
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: scheme });
    await load(page);
    // Transparent, so it sits on the page's ground whatever that is.
    expect(
      await page.evaluate(() => window.containerBackground()),
      scheme
    ).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  }
});

test("an explicit divisionsColor or nullColor wins over the theme", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await load(page, "?divisions=%23ff00ff&null=%2300ff00");

  // The sentinel is null, so anything a caller sets is theirs and stays.
  expect(await page.evaluate(() => window.nv.divisionsColor)).toBe("#ff00ff");
  expect(await page.evaluate(() => window.nv.nullColor)).toBe("#00ff00");
});

test("the data colours are the same in both themes", async ({ page }) => {
  const scaleFor = async (scheme) => {
    await page.emulateMedia({ colorScheme: scheme });
    await load(page);
    return page.evaluate(() => {
      const s = window.nv.getColorScale("cat");
      return s.domain().map((v) => s(v));
    });
  };

  // Chrome adapts; the encoding does not. A category that is teal on a light
  // page has to be the same teal on a dark one, or the colour stops meaning
  // one thing.
  expect(await scaleFor("dark")).toEqual(await scaleFor("light"));
});

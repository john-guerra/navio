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
  // The page paints itself dark. That, not the reader's OS setting, is what
  // makes black labels unreadable.
  await page.emulateMedia({ colorScheme: "dark" });
  await load(page, "?page=dark");

  // The whole complaint: a label the colour of the background is not a label.
  expect(await page.evaluate(() => window.resolved())).toBe("dark");
  expect(
    lightness(await page.evaluate(() => window.headerFill()))
  ).toBeGreaterThan(140);
});

test("the settings panel follows too", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await load(page, "?page=dark");
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
// This test was originally written as "the theme is re-read on the next
// redraw", with a comment blaming Playwright's emulateMedia for not dispatching
// `change` to a listener registered during page load. That was wrong. The
// listener was being registered in init() and then REMOVED again a few lines
// later by initTooltipPopper - a stray copy of the teardown block, which
// nv.data() then re-ran on every call. emulateMedia dispatches the event
// perfectly well; there was simply nothing listening. A code review caught it.
test("it follows the system changing under it", async ({ page }) => {
  // A page that DECLARED color-scheme and paints no background of its own, so
  // the browser canvas - and therefore the widget - follows the reader.
  await page.emulateMedia({ colorScheme: "light" });
  await load(page, "?scheme=1");
  expect(
    lightness(await page.evaluate(() => window.headerFill()))
  ).toBeLessThan(90);

  // No reload, no interaction: the reader changed their OS setting.
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(async () => lightness(await page.evaluate(() => window.headerFill())))
    .toBeGreaterThan(140);
});

test("it keeps following after data() is called again", async ({ page }) => {
  // The teardown that broke this lived in initTooltipPopper, which data() calls
  // - so a widget that was re-fed data lost the listener even once init() was
  // fixed. Re-feeding data is routine: addAllAttribs ends with nv.data(data).
  await page.emulateMedia({ colorScheme: "light" });
  await load(page, "?scheme=1");
  await page.evaluate(() => window.nv.data(window.nv.data()));

  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(async () => lightness(await page.evaluate(() => window.headerFill())))
    .toBeGreaterThan(140);
});

test("the tooltip arrow follows the theme with the tooltip", async ({
  page,
}) => {
  // The arrow's colour lives in a stylesheet built once, while the body is an
  // inline style - so switching theme repainted the body and left a dark
  // triangle stuck to a light panel. Both are driven by one custom property now.
  await page.emulateMedia({ colorScheme: "dark" });
  await load(page);
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => page.evaluate(() => window.resolved())).toBe("light");

  const read = () =>
    page.evaluate(() => {
      const tip = document.querySelector("._nv_popover");
      const arrowEl = tip.querySelector("[x-arrow]");
      const cs = getComputedStyle(arrowEl);
      // Each placement paints three sides transparent, so the arrow's real
      // colour is whichever side is left. Reading one named side would depend
      // on where popper happened to put the tooltip.
      const sides = [
        cs.borderTopColor,
        cs.borderRightColor,
        cs.borderBottomColor,
        cs.borderLeftColor,
      ].filter((c) => !/rgba\(0, 0, 0, 0\)|transparent/.test(c));
      return { body: getComputedStyle(tip).backgroundColor, sides };
    });

  // The redraw that repaints the tooltip is queued by the scheme listener.
  await expect.poll(async () => (await read()).body).toBe("rgb(178, 221, 241)");
  const { body, sides } = await read();
  expect(sides.length, "the arrow has a colour").toBeGreaterThan(0);
  expect(new Set(sides), "arrow matches the tooltip body").toEqual(
    new Set([body])
  );
});

// "auto" means MATCH WHAT IS BEHIND ME, not "match the reader's operating
// system". Following prefers-color-scheme alone put a dark-themed widget on
// the ten examples in this repo that never opted into dark mode - a white page
// with pale grey labels on it - which is how John found this, twice.
test("a light page that never opted in keeps a light widget", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await load(page, "?page=light");

  // The reader prefers dark. The page is white regardless, so the widget has
  // to be readable on white.
  expect(await page.evaluate(() => window.resolved())).toBe("light");
  expect(
    lightness(await page.evaluate(() => window.headerFill()))
  ).toBeLessThan(90);
});

test("a page that paints itself dark gets a dark widget", async ({ page }) => {
  // No color-scheme declared, light system preference: only the background
  // says what is going on, and it is what matters.
  await page.emulateMedia({ colorScheme: "light" });
  await load(page, "?page=dark");

  expect(await page.evaluate(() => window.resolved())).toBe("dark");
  expect(
    lightness(await page.evaluate(() => window.headerFill()))
  ).toBeGreaterThan(140);
});

test("a dark panel on a light page gets a dark widget", async ({ page }) => {
  // The nearest painted ancestor wins, not the page.
  await page.emulateMedia({ colorScheme: "light" });
  await load(page, "?page=light&box=dark");

  expect(await page.evaluate(() => window.resolved())).toBe("dark");
});

test("a page that opts in follows the reader", async ({ page }) => {
  // Nothing paints a background here, so the browser canvas decides - and that
  // follows the declared color-scheme.
  await page.emulateMedia({ colorScheme: "dark" });
  await load(page, "?scheme=1");
  expect(await page.evaluate(() => window.resolved())).toBe("dark");

  await page.emulateMedia({ colorScheme: "light" });
  await load(page, "?scheme=1");
  expect(await page.evaluate(() => window.resolved())).toBe("light");
});

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

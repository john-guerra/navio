import { test, expect } from "@playwright/test";

// #100. The settings panel was a child of the container the caller passes, so
// any host page that made that container a scroll box clipped the panel to the
// height of the widget - a 210px-tall Navio showing the first few rows of a
// 700px+ list, with no way to reach the rest, because scrolling the box scrolls
// the WIDGET.
//
// Reported as "Navio sets that same container to overflow: auto". It does not -
// the outer container computes to `visible` and the panel hangs happily below
// it on a plain page. The clip comes from the host's own CSS. That still makes
// it Navio's bug to fix: a library popover must not be clippable by whatever
// the page wraps it in.
//
// Fixed by lifting the `overflow` of every clipping ancestor while the panel is
// open, and putting it back on close. Moving the panel to <body> was the other
// candidate and was measured and rejected: it does make the panel unclippable,
// but a <body> child paints over every widget on the page, and #97 needs the
// opposite - the panel overlays the NEXT Navio's gear and that gear has to stay
// clickable. Being unclippable and being click-through-able are one z-order
// fact with opposite signs.

const FIXTURE = "/test/e2e/fixtures/clipping-host.html";

const open = async (page) => {
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("._nv_gear").click();
  await expect(page.locator("._nv_settings")).toBeVisible();
};

/**
 * Is the whole panel actually on screen and hittable? Hit-testing is the only
 * honest check: a clipped element keeps its full getBoundingClientRect, so
 * measuring the rect alone reports a panel that is 700px tall and entirely
 * invisible as perfectly fine.
 */
const panelReachable = (page) =>
  page.evaluate(() => {
    const panel = document.querySelector("._nv_settings");
    const b = panel.getBoundingClientRect();
    const at = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return !!el && (el === panel || panel.contains(el));
    };
    return {
      height: Math.round(b.height),
      withinViewport: b.bottom <= window.innerHeight + 1,
      top: at(b.left + 8, b.top + 8),
      middle: at(b.left + 8, b.top + b.height / 2),
      bottom: at(b.left + 8, b.bottom - 8),
    };
  });

test("the panel is not clipped by a scrolling host container", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(FIXTURE);
  await open(page);

  const m = await panelReachable(page);
  expect(m.height).toBeGreaterThan(300); // a genuinely tall list
  expect(m.withinViewport).toBe(true);
  expect({ top: m.top, middle: m.middle, bottom: m.bottom }).toEqual({
    top: true,
    middle: true,
    bottom: true,
  });
});

test("the panel escapes a clipping ancestor further up, not just the container", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(`${FIXTURE}?transform=1`);
  await open(page);

  const m = await panelReachable(page);
  expect({ top: m.top, middle: m.middle, bottom: m.bottom }).toEqual({
    top: true,
    middle: true,
    bottom: true,
  });
});

test("the panel still anchors to its own widget, not the viewport", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await open(page);

  const m = await page.evaluate(() => {
    const p = document.querySelector("._nv_settings").getBoundingClientRect();
    const host = document.querySelector("#nv").getBoundingClientRect();
    return { pLeft: Math.round(p.left), hLeft: Math.round(host.left) };
  });
  // Tracks the widget. This is what ruled out showModal(), which centres in the
  // viewport and so points at the wrong widget when a page has two.
  expect(Math.abs(m.pLeft - m.hLeft)).toBeLessThan(400);
});

test("the host page's overflow is put back when the panel closes", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  const overflowOf = () =>
    page.evaluate(
      () => getComputedStyle(document.querySelector("#nv")).overflowY
    );

  expect(await overflowOf()).toBe("auto");
  await open(page);
  expect(await overflowOf()).toBe("visible");

  await page.keyboard.press("Escape");
  await expect(page.locator("._nv_settings")).toBeHidden();
  // Navio borrowed something belonging to the page and has to give it back -
  // leaving the container unclipped would change the host's layout for good.
  expect(await overflowOf()).toBe("auto");
});

test("destroy() takes the panel with it", async ({ page }) => {
  await page.goto(FIXTURE);
  await open(page);

  await page.evaluate(() => window.nv.destroy());
  expect(await page.locator("._nv_settings").count()).toBe(0);
  expect(await page.locator("._nv_popover").count()).toBe(0);
});

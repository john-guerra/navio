import { test, expect } from "@playwright/test";

// The settings panel looked like it was being painted UNDER the code cell below
// it in an Observable notebook. It was not: the panel had `max-height: 70%`, and
// a percentage max-height resolves against the containing block - the Navio
// container, whose height is the `height` option. On a short widget that left a
// sliver a few rows tall, cut off mid-list, directly above a block of code.
//
// The fixture reproduces observablehq.com's actual cell nesting, read off the
// live page: .notebook is position:relative + z-index:0 (a stacking context),
// each cell is position:relative with z-index auto, and CodeMirror's .cm-scroller
// is position:relative + z-index:0. That is what the panel has to beat.

const FIXTURE = "/test/e2e/fixtures/stacking.html";

/** Is the panel the thing actually painted where it overlaps the code cell? */
const panelOnTop = (page) =>
  page.evaluate(() => {
    const panel = document.querySelector("._nv_settings");
    const r = panel.getBoundingClientRect();
    const code = document.querySelector("#codeCell").getBoundingClientRect();
    if (r.bottom <= code.top) return "does not reach the code cell";
    const y = Math.max(r.top + 10, Math.min(r.bottom - 10, code.top + 30));
    const hit = document.elementFromPoint(r.left + r.width / 2, y);
    return hit && panel.contains(hit) ? "on top" : "covered";
  });

test("the panel paints over a notebook code cell", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("._nv_gear").click();
  await expect(page.locator("._nv_settings")).toBeVisible();

  expect(await panelOnTop(page)).toBe("on top");
});

// Pins the diagnosis rather than the fix: if this ever starts failing, the
// problem really has become one of stacking and a z-index is the answer. As
// long as it passes, raising z-index cannot help and the cause is elsewhere.
test("z-index was never the constraint - even 1 wins here", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("._nv_gear").click();
  await expect(page.locator("._nv_settings")).toBeVisible();

  for (const z of [1, 2, 6]) {
    await page.evaluate(
      (zi) => (document.querySelector("._nv_settings").style.zIndex = zi),
      z
    );
    expect(await panelOnTop(page)).toBe("on top");
  }
});

// The regression itself: the panel must be sized by the screen, not by a widget
// that happens to be short.
test("the panel is not clipped to a fraction of a short widget", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("._nv_gear").click();

  const m = await page.evaluate(() => {
    const panel = document.querySelector("._nv_settings");
    return {
      panelH: panel.getBoundingClientRect().height,
      widgetH: document.querySelector("#nv").getBoundingClientRect().height,
      // Everything the panel wants to show, whether or not it fits.
      contentH: panel.scrollHeight,
      viewportH: window.innerHeight,
    };
  });

  // The widget asks for 200px of RECORDS; its container is that plus the header
  // band and the count reserve. Still far shorter than the panel, which is the
  // thing being tested - 70% of it used to be the cap.
  expect(m.widgetH).toBeLessThan(400);
  expect(m.panelH).toBeGreaterThan(m.widgetH);
  // Bounded by the viewport instead, and not scrolling when there is room.
  // max-height sizes the CONTENT box, so the rendered border box is 70vh plus
  // the panel's own padding and border - about 22px.
  expect(m.panelH).toBeLessThanOrEqual(m.viewportH * 0.7 + 24);
  expect(m.panelH).toBeGreaterThanOrEqual(Math.min(m.contentH, 300));
});

// Settings used to be stored under `navio.settings.<n>`, which is the same
// string on every page of an origin - so the first Navio in one notebook
// inherited the column layout of the first Navio in an unrelated one.
test("stored settings are scoped to the page", async ({ page }) => {
  const keysAfterVisiting = async (url) => {
    await page.goto(url);
    await expect(page.locator("canvas").first()).toBeVisible();
    return page.evaluate(() => {
      (window.nv || window.a).saveSettings();
      return Object.keys(localStorage).filter((k) =>
        k.startsWith("navio.settings")
      );
    });
  };

  await keysAfterVisiting(FIXTURE);
  const both = await keysAfterVisiting("/test/e2e/fixtures/vertical.html");

  expect(both).toHaveLength(2);
  expect(both.some((k) => k.includes("stacking.html"))).toBe(true);
  expect(both.some((k) => k.includes("vertical.html"))).toBe(true);
  // The container's own id names the instance within the page, so it survives
  // a reload however the page happens to construct its widgets.
  expect(both.every((k) => k.endsWith("#nv"))).toBe(true);
});

test("the query string is not part of the key", async ({ page }) => {
  const keys = async (url) => {
    await page.goto(url);
    await expect(page.locator("canvas").first()).toBeVisible();
    return page.evaluate(() => {
      (window.nv || window.a).saveSettings();
      return Object.keys(localStorage).filter((k) =>
        k.startsWith("navio.settings")
      );
    });
  };

  await keys(FIXTURE);
  // Filtering the page, or following a #anchor, is the same widget.
  const after = await keys(`${FIXTURE}?placement=beside#somewhere`);
  expect(after).toHaveLength(1);
});

test("settingsKey still overrides, and null turns persistence off", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const got = await page.evaluate(() => {
    localStorage.clear();
    window.nv.settingsKey = "my.own.bucket";
    window.nv.saveSettings();
    const named = Object.keys(localStorage);
    localStorage.clear();
    window.nv.settingsKey = null;
    window.nv.saveSettings();
    return { named, off: Object.keys(localStorage) };
  });

  expect(got.named).toEqual(["my.own.bucket"]);
  expect(got.off).toEqual([]);
});

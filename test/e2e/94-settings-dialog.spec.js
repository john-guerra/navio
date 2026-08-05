import { test, expect } from "@playwright/test";

// The settings panel is a real <dialog>, opened non-modally with show() and
// positioned by placeSettingsPanel. The element earns its place on its own:
// `open` is the single source of truth for "is the panel showing", and the
// browser supplies Escape and the dialog semantics.
//
// A "modal" placement using showModal() and the top layer was built and then
// removed. It centres in the VIEWPORT, so with two Navios on a page the panel
// appeared nowhere near the widget it belonged to, and its one real advantage
// - being unclippable - does not reach an Observable notebook, whose body is a
// sandboxed cross-origin iframe the top layer cannot escape.

const CLIPPED = "/test/e2e/fixtures/clipped.html";
const PLAIN = "/test/e2e/fixtures/vertical.html?orientation=horizontal&n=40";

const open = async (page) => {
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();
  await expect(page.locator("#nv ._nv_settings")).toBeVisible();
};

test("the panel is a dialog element, not a div", async ({ page }) => {
  await page.goto(PLAIN);
  await open(page);
  expect(
    await page.evaluate(() => {
      const p = document.querySelector("#nv ._nv_settings");
      return { tag: p.tagName, open: p.open };
    })
  ).toEqual({ tag: "DIALOG", open: true });
});

test("the anchored placements still anchor to the widget", async ({ page }) => {
  for (const placement of ["below", "beside", "over"]) {
    await page.goto(`${CLIPPED}?placement=${placement}`);
    await open(page);
    const m = await page.evaluate(() => {
      const p = document
        .querySelector("#nv ._nv_settings")
        .getBoundingClientRect();
      const host = document.querySelector("#nv").getBoundingClientRect();
      return { pLeft: Math.round(p.left), hLeft: Math.round(host.left) };
    });
    // Not viewport-centred: it tracks the widget.
    expect(Math.abs(m.pLeft - m.hLeft)).toBeLessThan(400);
  }
});

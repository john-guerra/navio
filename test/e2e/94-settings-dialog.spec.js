import { test, expect } from "@playwright/test";

// The settings panel is a real <dialog>. Three placements anchor it to the
// widget and open it with show(); "modal" opens it with showModal(), which
// hands positioning, dismissal and the focus trap to the browser and puts the
// panel in the TOP LAYER.
//
// The top layer is the only thing that gets out of a clipping ancestor. The
// fixture wraps a 180px widget in `overflow: hidden`, which an absolutely
// positioned panel cannot escape at any z-index.

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

test("an anchored panel is clipped by a scrolling ancestor; a modal is not", async ({
  page,
}) => {
  const overflow = async (placement) => {
    await page.goto(`${CLIPPED}?placement=${placement}`);
    await open(page);
    return page.evaluate(() => {
      const p = document
        .querySelector("#nv ._nv_settings")
        .getBoundingClientRect();
      const clip = document.querySelector("#clip").getBoundingClientRect();
      return {
        // How much of the panel falls outside the clipping box.
        past: Math.round(p.bottom - clip.bottom),
        height: Math.round(p.height),
        // Is the panel actually the thing painted at its own centre?
        visible: (() => {
          const hit = document.elementFromPoint(
            p.left + p.width / 2,
            p.top + Math.min(p.height / 2, 40)
          );
          return !!hit && document.querySelector("._nv_settings").contains(hit);
        })(),
      };
    });
  };

  const below = await overflow("below");
  const modal = await overflow("modal");

  // Anchored: the panel is taller than the 240px box it lives in, so it runs
  // past the bottom - and everything past it is cut off, invisibly.
  expect(below.past).toBeGreaterThan(0);
  // Modal: the browser centres it in the VIEWPORT, so it is not measured
  // against the clipping box at all, and it is genuinely on screen.
  expect(modal.height).toBeGreaterThan(0);
  expect(modal.visible).toBe(true);
});

test("a modal panel is in the top layer, above a stacking context that beats it", async ({
  page,
}) => {
  await page.goto(`${CLIPPED}?placement=modal`);
  await open(page);

  const onTop = await page.evaluate(() => {
    // A sibling that would out-paint any z-index the panel could carry.
    const hog = document.createElement("div");
    hog.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,255,0.2)";
    hog.id = "hog";
    document.body.appendChild(hog);
    const p = document
      .querySelector("#nv ._nv_settings")
      .getBoundingClientRect();
    const hit = document.elementFromPoint(p.left + p.width / 2, p.top + 20);
    return hit
      ? hit.closest("dialog,#hog").id || hit.closest("dialog").tagName
      : null;
  });

  // The top layer is above the whole z-index scale, by definition.
  expect(onTop).toBe("DIALOG");
});

test("Escape closes a modal panel and gives focus back to the gear", async ({
  page,
}) => {
  await page.goto(`${PLAIN.split("?")[0]}?orientation=horizontal&n=40`);
  await page.evaluate(() => {
    window.nv.settingsPlacement = "modal";
  });
  await open(page);

  await page.keyboard.press("Escape");
  await expect(page.locator("#nv ._nv_settings")).toBeHidden();
  expect(
    await page.evaluate(() =>
      document.activeElement.classList.contains("_nv_gear")
    )
  ).toBe(true);
  await expect(page.locator("#nv ._nv_gear")).toHaveAttribute(
    "aria-expanded",
    "false"
  );
});

test("the placement selector switches modes live", async ({ page }) => {
  await page.goto(PLAIN);
  await open(page);

  const mode = () =>
    page.evaluate(() => {
      const p = document.querySelector("#nv ._nv_settings");
      // A modal dialog is the only one that gets a ::backdrop, and the only
      // one whose position is not the absolute anchoring we set ourselves.
      return {
        placement: window.nv.settingsPlacement,
        pos: getComputedStyle(p).position,
      };
    });

  expect((await mode()).pos).toBe("absolute");

  await page
    .locator("#nv ._nv_settings select")
    .filter({ has: page.locator('option[value="modal"]') })
    .selectOption("modal");

  await expect(page.locator("#nv ._nv_settings")).toBeVisible();
  expect((await mode()).placement).toBe("modal");
  expect(
    await page.evaluate(() => document.querySelector("#nv ._nv_settings").open)
  ).toBe(true);
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

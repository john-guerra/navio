import { test, expect } from "@playwright/test";

// The tooltip is anchored to a VIRTUAL Popper reference - there is no DOM node
// under the cursor to attach to. popper.js v1 falls back to
// document.documentElement for any reference without a nodeType, so the offsets
// it computes are document-relative. While the tooltip lived inside the Navio
// container, a positioned ancestor made the browser resolve those same numbers
// against that ancestor instead, and the tooltip landed low by however far down
// the page the container sat.
//
// Observable notebooks wrap every cell in a position:relative block, so the
// tooltip showed up a few hundred pixels below the cursor there while every
// flat example page looked fine. The tooltip is now appended to <body>.

const FIXTURE = "/test/e2e/fixtures/tooltip-context.html";

/** Hover a cell and return the tooltip's offset from the pointer. */
async function tooltipOffset(page, { positioned, spacer }) {
  await page.goto(
    `${FIXTURE}?positioned=${positioned ? 1 : 0}&spacer=${spacer}`
  );
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  if (spacer) {
    await page.evaluate((y) => window.scrollTo(0, y), spacer);
  }

  const box = await page.locator("#nv canvas").boundingBox();
  const aw = await page.evaluate(() => window.nv.attribWidth);
  const y0 = await page.evaluate(() => window.nv.y0);
  const px = box.x + aw * 2.5;
  const py = box.y + y0 + 60;

  await page.mouse.move(px, py);
  await expect(page.locator("._nv_popover")).toBeVisible();

  return page.evaluate(
    ([x, y]) => {
      const el = document.querySelector("._nv_popover");
      const b = el.getBoundingClientRect();
      return {
        dx: Math.round(b.left - x),
        // Popper centres the tooltip vertically on the reference.
        dy: Math.round(b.top + b.height / 2 - y),
        parent: el.parentElement.tagName,
      };
    },
    [px, py]
  );
}

const CASES = [
  { name: "static ancestor, unscrolled", positioned: false, spacer: 0 },
  { name: "positioned ancestor, unscrolled", positioned: true, spacer: 0 },
  { name: "static ancestor, scrolled", positioned: false, spacer: 800 },
  { name: "positioned ancestor, scrolled", positioned: true, spacer: 800 },
];

for (const c of CASES) {
  test(`tooltip follows the cursor: ${c.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    const { dx, dy, parent } = await tooltipOffset(page, c);

    // It is placed to the right of and vertically centred on the cursor. Before
    // the fix the scrolled+positioned case was ~750px low.
    expect(Math.abs(dy)).toBeLessThan(30);
    expect(dx).toBeGreaterThan(0);
    expect(dx).toBeLessThan(200);
    // Living on <body> is what keeps the document-relative offsets honest.
    expect(parent).toBe("BODY");
  });
}

test("the Observable example places its tooltip on the cursor", async ({
  page,
}) => {
  // The real runtime, cells in position:relative wrappers, widget far down a
  // scrolling page - the configuration that actually broke.
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("/examples/observable/");

  const canvas = page.locator("#cell-widget canvas").first();
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await canvas.scrollIntoViewIfNeeded();

  const box = await canvas.boundingBox();
  const px = box.x + 40;
  const py = box.y + 120;
  await page.mouse.move(px, py);
  await expect(page.locator("._nv_popover")).toBeVisible();

  const { dy, scrollY } = await page.evaluate((y) => {
    const b = document.querySelector("._nv_popover").getBoundingClientRect();
    return {
      dy: Math.round(b.top + b.height / 2 - y),
      scrollY: Math.round(window.scrollY),
    };
  }, py);

  expect(scrollY).toBeGreaterThan(300); // the page really is scrolled
  expect(Math.abs(dy)).toBeLessThan(40);
});

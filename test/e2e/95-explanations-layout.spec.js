import { test, expect } from "@playwright/test";

// The filter chips are drawn 30px past the end of the RECORD axis, to clear the
// count labels and the settings gear. In horizontal that is past the bottom of
// the canvas, and two separate boxes have to grow to cover them:
//
//   - the container, or whatever follows the widget in normal flow paints over
//     them (a paragraph, the next notebook cell);
//   - divNavio, the scrolling wrapper, which CLIPS. It sets `overflow-x: auto`
//     for wide widgets, and CSS forces the other axis to `auto` whenever one
//     axis is not `visible` - so it clips vertically too. That is invisible in
//     the stylesheet, and is why growing the container alone fixed nothing.
//
// Measured before the fix: chips at y=428..443, container ending at 428,
// divNavio ending at 432.

const FIXTURE = "/test/e2e/fixtures/vertical.html?orientation=horizontal&n=40";
const TWO_LEVELS = [
  [{ type: "value", attrib: "category", value: "alpha" }],
  [{ type: "value", attrib: "category", value: "alpha" }],
];

const boxes = (page) =>
  page.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, height: b.height };
    };
    const host = document.querySelector("#nv");
    return {
      host: r(host),
      wrapper: r(host.firstElementChild),
      canvas: r(host.querySelector("canvas")),
      chips: Array.from(host.querySelectorAll(".filterExplanation > div")).map(
        (c) => ({ ...r(c), text: c.textContent })
      ),
    };
  });

test("the chips fit inside the widget instead of spilling below it", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.evaluate((f) => window.nv.setFilters(f), TWO_LEVELS);
  await expect(page.locator("#nv .filterExplanation > div")).toHaveCount(2);

  const b = await boxes(page);
  expect(b.chips).toHaveLength(2);
  for (const chip of b.chips) {
    // Below the canvas - that is where they belong.
    expect(chip.top).toBeGreaterThanOrEqual(b.canvas.bottom);
    // ...but inside BOTH boxes. Either one falling short slices them.
    expect(chip.bottom).toBeLessThanOrEqual(b.host.bottom);
    expect(chip.bottom).toBeLessThanOrEqual(b.wrapper.bottom);
  }
});

test("the chips are not clipped away by the scrolling wrapper", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.evaluate((f) => window.nv.setFilters(f), TWO_LEVELS);
  await expect(page.locator("#nv .filterExplanation > div")).toHaveCount(2);

  // Clipped content is not hit-testable, so the point falls through to an
  // ancestor. Sampling near the BOTTOM edge is the whole point: the top of
  // each chip stayed visible while its lower half was cut off.
  const bottomsHit = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#nv .filterExplanation > div")).map(
      (c) => {
        const r = c.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + 8, r.bottom - 3);
        return c === hit || c.contains(hit);
      }
    )
  );
  expect(bottomsHit).toEqual([true, true]);
});

test("content in normal flow below the widget does not cover the chips", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.evaluate(() => {
    const p = document.createElement("p");
    p.id = "below";
    p.textContent = "the next cell";
    p.style.cssText = "background:#cfe;margin:0;padding:8px";
    document.body.appendChild(p);
  });
  await page.evaluate((f) => window.nv.setFilters(f), TWO_LEVELS);
  await expect(page.locator("#nv .filterExplanation > div")).toHaveCount(2);

  const b = await boxes(page);
  const below = await page
    .locator("#below")
    .evaluate((e) => e.getBoundingClientRect().top);
  for (const chip of b.chips) expect(chip.bottom).toBeLessThanOrEqual(below);
});

test("each chip sits under the level it belongs to", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.evaluate((f) => window.nv.setFilters(f), TWO_LEVELS);
  await expect(page.locator("#nv .filterExplanation > div")).toHaveCount(2);

  const b = await boxes(page);
  // Left-aligned with its level, so the two chips are a level apart rather
  // than stacked on the same x.
  const gap = b.chips[1].left - b.chips[0].left;
  expect(gap).toBeGreaterThan(50);
  // And the first is at the left edge of the widget, not floating mid-canvas.
  expect(b.chips[0].left - b.host.left).toBeLessThan(60);
});

test("the widget gives the space back when the filters go", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  const bare = (await boxes(page)).host.height;

  await page.evaluate((f) => window.nv.setFilters(f), TWO_LEVELS);
  await expect(page.locator("#nv .filterExplanation > div")).toHaveCount(2);
  const filtered = (await boxes(page)).host.height;
  expect(filtered).toBeGreaterThan(bare);

  await page.evaluate(() => window.nv.setFilters([[]]));
  await expect(page.locator("#nv .filterExplanation > div")).toHaveCount(0);
  expect((await boxes(page)).host.height).toBe(bare);
});

test("the gear stays put whether or not there are filters", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  const gearY = () =>
    page
      .locator("#nv ._nv_gear")
      .evaluate((e) => e.getBoundingClientRect().top);

  const before = await gearY();
  await page.evaluate((f) => window.nv.setFilters(f), TWO_LEVELS);
  await expect(page.locator("#nv .filterExplanation > div")).toHaveCount(2);
  // Anchored to the canvas, not to the container - otherwise it walks down the
  // page every time a filter is added and back up when one is removed.
  expect(Math.abs((await gearY()) - before)).toBeLessThanOrEqual(1);
});

test("vertical is unaffected - the chips go out to the side", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/vertical.html?orientation=vertical&n=40");
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  await page.evaluate((f) => window.nv.setFilters(f), TWO_LEVELS);
  await expect(page.locator("#nv .filterExplanation > div")).toHaveCount(2);

  const b = await boxes(page);
  // The widget IS taller than it was: levels stack along the attribute axis,
  // which is the screen Y here, so three levels need three times the room.
  // What must not happen is the chips ALSO claiming height - toXY puts the
  // record axis on x when vertical, so they go out to the side instead and the
  // container should still hug the canvas exactly.
  expect(b.host.height).toBe(b.canvas.height);
  for (const chip of b.chips) {
    expect(chip.left).toBeGreaterThan(b.canvas.left);
    expect(chip.bottom).toBeLessThanOrEqual(b.host.bottom);
  }
});

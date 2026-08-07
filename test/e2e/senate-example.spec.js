import { test, expect } from "@playwright/test";

// The Colombian Senate demo shipped against d3 v4 while Navio is built for v7.
// Navio reads `d3` as a global (rollup marks it external), so it ran on
// whatever the page loaded: v4 has no d3.pointer, and v4 listeners receive
// (d, i, nodes) with a global d3.event rather than (event, d). Sorting a column
// therefore threw "d3.pointer is not a function" followed by "Cannot read
// properties of undefined (reading 'shiftKey')".

const load = async (page) => {
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200));
  });
  await page.goto("/examples/senate/");
  // 362 nodes plus a force simulation; wait for Navio to have drawn.
  await expect(page.locator("#nn canvas")).toHaveCount(1);
  await expect(page.locator("#nn svg text").first()).toBeVisible();
  return errs;
};

test("the senate example loads on d3 v7 without errors", async ({ page }) => {
  const errs = await load(page);
  expect(await page.evaluate(() => window.d3.version)).toMatch(/^7\./);
  // The v4-only global is gone in v7; its presence would mean a stale CDN pin.
  expect(await page.evaluate(() => typeof window.d3.pointer)).toBe("function");
  expect(errs).toEqual([]);
});

test("sorting the senate example by name does not throw", async ({ page }) => {
  const errs = await load(page);

  const nameHeader = page.locator("#nn svg text", { hasText: /^name/ }).first();

  // Click the same PHYSICAL point twice, the way a hand does, instead of
  // re-aiming at "the element" each time.
  //
  // The label GROWS when it gains a sort arrow - measured here, 34px wide to
  // 108px, with its centre moving 25px right and 34px up, because the header is
  // rotated -45deg so the box grows diagonally. Clicking the element a second
  // time therefore aims a column or more away: attribWidth is 15px. It lands on
  // the neighbour, sorts THAT column, and the arrow leaves `name` - which reads
  // as the sort mysteriously vanishing. Reproduced deterministically: the second
  // click put the arrow on `party`.
  //
  // Nothing wrong with the sorting; the test was aiming at a moving target. It
  // failed CI once against a src tree byte-identical to two green runs.
  const box = await nameHeader.boundingBox();
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.mouse.click(at.x, at.y);
  // The header gains a direction arrow once the sort has been applied. Assert
  // the DIRECTION, not just "an arrow": a click that strayed onto the next
  // column would otherwise satisfy [↑↓] by accident on the way past.
  await expect(nameHeader).toHaveText(/name\s*↑/);
  expect(errs).toEqual([]);

  // Toggling to descending goes through the same handlers.
  await page.mouse.click(at.x, at.y);
  await expect(nameHeader).toHaveText(/name\s*↓/);
  expect(errs).toEqual([]);
});

test("reclustering colours the graph", async ({ page }) => {
  const errs = await load(page);

  // The dataset ships without a cluster field - netClustering computes it - so
  // the graph starts one colour. This exercises the d3.nest -> d3.groups
  // migration with real keys.
  const distinctColours = () =>
    page.evaluate(() => {
      const c = document.querySelector("#graph");
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 200) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      }
      return seen.size;
    });

  const before = await distinctColours();
  await page.locator("#recluster").click();
  await expect
    .poll(distinctColours, { timeout: 15000 })
    .toBeGreaterThan(before);
  expect(errs).toEqual([]);
});

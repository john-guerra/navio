import { test, expect } from "@playwright/test";

// Repro for https://github.com/john-guerra/navio/issues/56 ("everything
// disappears" after closing a sub-selection): the filter-chip close handler
// removes by a stale positional index instead of by identity, and is
// double-bound to "click pointerup" so a single click can fire it twice.

async function attribColumnCenterX(page, canvasBox, attribLabel, attribWidth) {
  const columns = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".attribOverlay")).map((g) => {
      const text = g.querySelector("text");
      const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(
        g.getAttribute("transform") || ""
      );
      return { label: text ? text.textContent : null, x: m ? parseFloat(m[1]) : null };
    })
  );
  const col = columns.find((c) => c.label === attribLabel);
  if (!col) throw new Error(`Column "${attribLabel}" not found among ${JSON.stringify(columns)}`);
  return canvasBox.x + col.x + attribWidth / 2;
}

function rowCenterY(canvasBox, y0, margin, height, rowCount, rowIndex) {
  const rowSpan = (height - margin - 30 - y0) / rowCount;
  return canvasBox.y + y0 + rowSpan * rowIndex + rowSpan / 2;
}

test("closing one filter chip removes only that filter, not another one", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/test/e2e/fixtures/single.html");

  const canvasBox = await page.locator("#nv canvas").boundingBox();
  const geometry = await page.evaluate(() => ({
    y0: window.nv.y0,
    margin: window.nv.margin,
    attribWidth: window.nv.attribWidth,
  }));
  const x = await attribColumnCenterX(page, canvasBox, "category", geometry.attribWidth);

  // Row 0 -> id:1, category:"a". Row 1 -> id:2, category:"b" (see fixture data).
  const yRow0 = rowCenterY(canvasBox, geometry.y0, geometry.margin, 400, 5, 0);
  const yRow1 = rowCenterY(canvasBox, geometry.y0, geometry.margin, 400, 5, 1);

  // Plain click: filter by category == a
  await page.mouse.click(x, yRow0);
  await expect(page.locator(".filterExplanation div")).toHaveText(["Ⓧ category == a"]);

  // Shift-click: append a second filter, category == b
  // (page.mouse.click has no `modifiers` option - that's a locator.click()-only
  // param - so the shift key has to be held via the keyboard API instead.)
  await page.keyboard.down("Shift");
  await page.mouse.click(x, yRow1);
  await page.keyboard.up("Shift");
  await expect(page.locator(".filterExplanation div")).toHaveText([
    "Ⓧ category == a",
    "Ⓧ category == b",
  ]);

  // Close the SECOND chip ("category == b") - only that one should go away.
  await page.locator(".filterExplanation div", { hasText: "category == b" }).click();

  await expect(page.locator(".filterExplanation div")).toHaveText(["Ⓧ category == a"]);
  expect(errors).toEqual([]);
});

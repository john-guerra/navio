import { test, expect } from "@playwright/test";

// Regression tests for https://github.com/john-guerra/navio/issues/79.
//
// applyFilters composes a level as (OR of positives) AND (AND of negatives).
// An OR over an empty set seeds to false, which is only correct when positive
// filters exist - with negatives alone it made every row fail the predicate, so
// a single alt-click emptied the widget. These lock down the intended table:
//
//   nothing               -> level not filtered
//   positives only        -> OR of them
//   negatives only        -> everything except the excluded
//   positives + negatives -> (OR pos) AND (AND neg)
//
// Fixture rows, by category: a, b, a, c, b.

/** Center x of a named attribute column, read off the rendered header. */
async function columnCenterX(page, canvasBox, label, attribWidth) {
  const cols = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".attribOverlay")).map((g) => {
      const t = g.querySelector("text");
      const m = /translate\(([-\d.]+),/.exec(g.getAttribute("transform") || "");
      return {
        label: t ? t.textContent : null,
        x: m ? parseFloat(m[1]) : null,
      };
    })
  );
  const c = cols.find((c) => c.label === label);
  if (!c) throw new Error(`column ${label} not found`);
  return canvasBox.x + c.x + attribWidth / 2;
}

async function setup(page) {
  await page.goto("/test/e2e/fixtures/single.html");
  const box = await page.locator("#nv canvas").boundingBox();
  const geo = await page.evaluate(() => ({
    y0: window.nv.y0,
    margin: window.nv.margin,
    attribWidth: window.nv.attribWidth,
  }));
  const x = await columnCenterX(page, box, "category", geo.attribWidth);
  const rowSpan = 400 / 5; // the record axis IS `height` now
  const rowY = (i) => box.y + geo.y0 + rowSpan * i + rowSpan / 2;
  return { x, rowY };
}

const visible = (page) =>
  page.evaluate(() =>
    window.nv
      .getVisible()
      .map((d) => d.category)
      .sort()
  );

async function clickRow(page, x, y, { alt = false, shift = false } = {}) {
  if (alt) await page.keyboard.down("Alt");
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.click(x, y);
  if (shift) await page.keyboard.up("Shift");
  if (alt) await page.keyboard.up("Alt");
}

test("a lone negative filter selects the complement, not nothing", async ({
  page,
}) => {
  const { x, rowY } = await setup(page);
  expect(await visible(page)).toEqual(["a", "a", "b", "b", "c"]);

  // Row 0 is category "a" -> exclude it.
  await clickRow(page, x, rowY(0), { alt: true });

  await expect(page.locator(".filterExplanation div")).toHaveText([
    "Ⓧ category != a",
  ]);
  expect(await visible(page)).toEqual(["b", "b", "c"]);
});

test("two negatives on one level subtract both", async ({ page }) => {
  const { x, rowY } = await setup(page);

  await clickRow(page, x, rowY(0), { alt: true }); // not a
  await clickRow(page, x, rowY(1), { alt: true, shift: true }); // and not b

  await expect(page.locator(".filterExplanation div")).toHaveText([
    "Ⓧ category != a",
    "Ⓧ category != b",
  ]);
  expect(await visible(page)).toEqual(["c"]);
});

test("a positive filter still ORs as before", async ({ page }) => {
  const { x, rowY } = await setup(page);

  await clickRow(page, x, rowY(0)); // == a
  expect(await visible(page)).toEqual(["a", "a"]);

  await clickRow(page, x, rowY(3), { shift: true }); // or == c
  expect(await visible(page)).toEqual(["a", "a", "c"]);
});

test("positives and negatives combine as (OR pos) AND (AND neg)", async ({
  page,
}) => {
  const { x, rowY } = await setup(page);

  await clickRow(page, x, rowY(0)); // == a
  await clickRow(page, x, rowY(1), { shift: true }); // or == b
  await clickRow(page, x, rowY(0), { alt: true, shift: true }); // and not a

  expect(await visible(page)).toEqual(["b", "b"]);
});

test("removing the positive from a mixed level leaves the complement, not an empty widget", async ({
  page,
}) => {
  const { x, rowY } = await setup(page);

  await clickRow(page, x, rowY(0)); // == a
  await clickRow(page, x, rowY(1), { alt: true, shift: true }); // and not b
  await expect(page.locator(".filterExplanation div")).toHaveCount(2);

  // Closing the positive chip used to leave only a negative -> everything
  // vanished. This is the path users reported as "everything disappears".
  await page
    .locator(".filterExplanation div", { hasText: "category == a" })
    .click();

  await expect(page.locator(".filterExplanation div")).toHaveText([
    "Ⓧ category != b",
  ]);
  expect(await visible(page)).toEqual(["a", "a", "c"]);
});

import { test } from "@playwright/test";

// Pins the behaviour documented in docs/ai/FILTERING-MODEL.md section 4:
// filters are evaluated once, at creation, and `selected` is stored per row.
// onSortLevel deliberately never calls applyFilters, so re-sorting a level
// cannot change which rows are selected - even though it rewrites the
// __i[level] positions the range predicate is written against, and even when
// the selected rows stop being contiguous.
//
// Also guards #81: if nv.sortBy ever starts sorting, the UI path here must
// keep behaving the same.

import { expect } from "@playwright/test";

test("re-sorting a level keeps exactly the rows the brush selected", async ({
  page,
}) => {
  await page.goto("/test/e2e/fixtures/sort-after-range.html");
  const nvEl = page.locator("#nv");
  const box = await page.locator("#nv canvas").boundingBox();
  const rowSpan = (400 - 10 - 30 - 100) / 6;
  const rowMid = (i) => box.y + 100 + rowSpan * i + rowSpan / 2;

  const report = async (step, label) => {
    const s = await page.evaluate(() => ({
      order: window.nv
        .data()
        .slice()
        .sort((a, b) => a.__i[0] - b.__i[0])
        .map((d) => d.id)
        .join(" "),
      selected: window.selectedIds().join(" "),
    }));
    await nvEl.screenshot({ path: `test-results/probe/${step}-${label}.png` });
    return s;
  };

  const initial = await report("1", "sorted-by-rank");
  expect(initial.order).toBe("a b c d e f");
  expect(initial.selected).toBe("a b c d e f");

  await page.mouse.move(box.x + 37, rowMid(1));
  await page.mouse.down();
  await page.mouse.move(box.x + 37, rowMid(3), { steps: 10 });
  await page.mouse.up();
  const brushed = await report("2", "brushed-rows-b-c-d");
  expect(brushed.selected).toBe("b c d");

  // Click the `grp` header. grp is x,y,x,y,x,y so sorting by it interleaves
  // the rows and breaks up the brushed block.
  const r = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll(".attribOverlay text")).find(
      (n) => n.textContent.startsWith("grp")
    );
    const b = t.getBoundingClientRect();
    return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
  });
  await page.mouse.click(r.cx, r.cy);
  await page.evaluate(
    () =>
      new Promise((res) =>
        requestAnimationFrame(() => requestAnimationFrame(res))
      )
  );
  const resorted = await report(
    "3",
    "re-sorted-by-grp-same-rows-still-selected"
  );
  // grp is x,y,x,y,x,y so the sort interleaves the rows...
  expect(resorted.order).toBe("a c e b d f");
  // ...leaving b, c, d at visual positions 3, 1, 4 - no longer contiguous -
  // and yet still exactly the rows the user dragged over.
  expect(resorted.selected).toBe("b c d");
});

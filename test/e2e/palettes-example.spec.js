import { test, expect } from "@playwright/test";

// examples/palettes draws one attribute nine times, once per candidate colour
// palette, in a single widget. It exists to make two claims visible, and this
// pins both of them rather than merely checking the page loads:
//
//   - schemeCategory10 recycles, so 25 categories reach the screen as 10
//     colours while a generated palette reaches it as 25;
//   - sorting decides legibility: the same column is one band per group when
//     sorted by group, and shredded into single rows when sorted by calories.
//
// It also exercises #104 in the setting that found it - the columns are added
// as accessor functions, so sorting by the name a user reads off the header
// only works because sortBy resolves names through dAttribs.

const EXAMPLE = "/examples/palettes/";

const ready = async (page) => {
  await page.goto(EXAMPLE);
  // d3 and popper come from a CDN here, as in the other example fixtures.
  await expect(page.locator("#nv canvas")).toHaveCount(1, { timeout: 20000 });
  await expect(page.locator("#rows tr")).not.toHaveCount(0);
};

// Columns start after the margin and are attribWidth apart, so this is the
// middle of column i. Measured against the rendering rather than guessed: ink
// begins at x = nv.margin.
const CENTRE = (i) => 10 + i * 20 + 10;

/**
 * Which column a header sits in, by name. Looked up rather than hardcoded: the
 * palette list grows, and an index that was right when it was written silently
 * points at a different column afterwards. The sorted column carries an arrow,
 * so match on the stem.
 */
const columnOf = (page, label) =>
  page.evaluate(
    (want) =>
      [...document.querySelectorAll("#nv svg text")]
        .map((t) => t.textContent.replace(/\s*[\u2191\u2193]$/, ""))
        .indexOf(want),
    label
  );

/** Colour boundaries down one column: few means bands, many means shredded. */
const runsInColumn = (page, xCss) =>
  page.evaluate((x) => {
    const cv = document.querySelector("#nv canvas");
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const dpr = cv.width / parseFloat(cv.style.width);
    const d = ctx.getImageData(Math.round(x * dpr), 0, 1, cv.height).data;
    let runs = 0,
      prev = null;
    for (let y = 0; y < cv.height; y++) {
      const i = y * 4;
      if (d[i + 3] < 10) {
        prev = null;
        continue;
      }
      const c = `${d[i]},${d[i + 1]},${d[i + 2]}`;
      if (c !== prev) runs++;
      prev = c;
    }
    return runs;
  }, xCss);

test("the example loads and draws every palette", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await ready(page);

  const labels = await page.evaluate(() =>
    [...document.querySelectorAll("#nv svg text")].map((t) => t.textContent)
  );
  // Nine palettes plus the five real columns there to sort by.
  expect(labels).toContain("max-min CVD");
  expect(labels).toContain("Category10 today");
  expect(labels).toContain("calories");
  expect(errors).toEqual([]);
});

test("sorting by a palette column groups it; sorting by calories shreds it", async ({
  page,
}) => {
  await ready(page);

  await page.evaluate(() => window.nv.sortBy("calories"));
  // Polled, not read once: the sort and the redraw it triggers are not finished
  // just because the call returned, and sampling a half-drawn canvas reports a
  // number between the two answers.
  const paletteColumn = CENTRE(await columnOf(page, "max-min CVD"));
  await expect
    .poll(() => runsInColumn(page, paletteColumn), { message: "shredded" })
    .toBeGreaterThan(300);

  // By NAME, which is what the column header shows. The columns are accessor
  // functions, so this is the #104 path.
  await page.evaluate(() => window.nv.sortBy("max-min CVD"));

  // Compared against a NUMERIC column rather than against a fixed number. How
  // many runs a band shows depends on devicePixelRatio - the row strokes are
  // anti-aliased at dpr 1 and crisp at dpr 2, so the same view measures ~234
  // and ~27 on two machines (#105). The claim that survives either is that a
  // grouped column has far fewer colour boundaries than an ungrouped one.
  const grouped = await runsInColumn(
    page,
    CENTRE(await columnOf(page, "max-min CVD"))
  );
  const numeric = await runsInColumn(
    page,
    CENTRE(await columnOf(page, "calories"))
  );
  expect(grouped, "grouped vs a numeric column").toBeLessThan(numeric / 2);
});

test("Category10 reaches the screen as ten colours, the generated palette as 25", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => window.nv.sortBy("max-min CVD"));

  const counts = await page.evaluate(() => {
    const cv = document.querySelector("#nv canvas");
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const dpr = cv.width / parseFloat(cv.style.width);
    // The sorted column's label carries an arrow, so match on the stem.
    const labels = [...document.querySelectorAll("#nv svg text")].map((t) =>
      t.textContent.replace(/\s*[\u2191\u2193]$/, "")
    );
    const distinctAt = (columnIndex) => {
      // Ink starts at nv.margin, and columns are attribWidth apart.
      const x = Math.round((10 + columnIndex * 20 + 10) * dpr);
      const d = ctx.getImageData(x, 0, 1, cv.height).data;
      const seen = new Set();
      for (let y = 0; y < cv.height; y++)
        if (d[y * 4 + 3] > 10)
          seen.add(`${d[y * 4]},${d[y * 4 + 1]},${d[y * 4 + 2]}`);
      return seen.size;
    };
    return {
      generated: distinctAt(labels.indexOf("max-min CVD")),
      category10: distinctAt(labels.indexOf("Category10 today")),
    };
  });

  // The whole point: same 25 groups, and one palette simply cannot show them.
  // Compared as a ratio, because the absolute counts move with
  // devicePixelRatio - anti-aliased row strokes at dpr 1 inflate both (#105).
  expect(
    counts.generated,
    `generated ${counts.generated} vs Category10 ${counts.category10}`
  ).toBeGreaterThan(counts.category10 * 1.5);
});

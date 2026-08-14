import { test, expect } from "@playwright/test";

// examples/palettes shows how to change nv.defaultColorCategorical. The data is
// nutrients.csv, whose `group` column has 25 categories - more than a ten-colour
// scheme can carry, which is the thing the example exists to demonstrate.
//
// The point of pinning an example is that it keeps WORKING: one that throws, or
// that quietly stops demonstrating its own claim, is worse than none.

const EXAMPLE = "/examples/palettes/";

const ready = async (page) => {
  // d3 and popper come from a CDN here, as in the other example fixtures.
  await expect(page.locator("#nv canvas")).toHaveCount(1, { timeout: 20000 });
};

/** The colours actually assigned, one per category. */
const assigned = (page) =>
  page.evaluate(() => window.nv.getColorScale("group").range().slice(0, 25));

test("it loads and draws, without errors", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(EXAMPLE);
  await ready(page);

  expect(errors).toEqual([]);
});

test("the default gives 25 categories 25 colours", async ({ page }) => {
  await page.goto(EXAMPLE);
  await ready(page);

  // The claim in the first paragraph, checked.
  expect(new Set(await assigned(page)).size).toBe(25);
});

test("picking category10 shows the recycling the page describes", async ({
  page,
}) => {
  await page.goto(EXAMPLE);
  await ready(page);

  await page.locator('#buttons button[data-key="category10"]').click();
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  // Ten colours for 25 categories: the failure the example is about.
  await expect.poll(async () => new Set(await assigned(page)).size).toBe(10);
});

test("every palette button draws something", async ({ page }) => {
  await page.goto(EXAMPLE);
  await ready(page);

  const names = await page.evaluate(() =>
    [...document.querySelectorAll("#buttons button")].map((b) => b.dataset.key)
  );
  expect(names.length).toBeGreaterThan(3);

  for (const name of names) {
    await page.locator(`#buttons button[data-key="${name}"]`).click();
    await expect(page.locator("#nv canvas"), name).toHaveCount(1);
    expect((await assigned(page)).length, name).toBeGreaterThan(0);
  }
});

// The comparison table. Its numbers come from palettes.json, which
// `npm run palettes` writes from the same script that generates the shipped
// palettes - so the risk is not that a number is wrong, it is that the file
// goes stale or the page stops reading it.

const cell = (page, palette, column) =>
  page.evaluate(
    ([p, c]) => {
      const heads = [...document.querySelectorAll("#head th")].map((th) =>
        th.textContent.trim()
      );
      const row = [...document.querySelectorAll("#rows tr")].find((tr) =>
        tr.querySelector("td").textContent.startsWith(p)
      );
      return row ? row.children[heads.indexOf(c)].textContent.trim() : null;
    },
    [palette, column]
  );

test("the table scores every shipped palette", async ({ page }) => {
  await page.goto(EXAMPLE);
  await expect(page.locator("#rows tr")).not.toHaveCount(0);

  const shipped = await page.evaluate(() =>
    Object.keys(window.navio.palettes).sort()
  );
  const listed = await page.evaluate(() =>
    [...document.querySelectorAll("#rows tr td:first-child")]
      .map((td) => td.firstChild.textContent.trim())
      .sort()
  );

  // A palette added to navio.palettes and not to the table would be shipped
  // unmeasured, which is the one thing this page exists to prevent.
  expect(listed).toEqual(shipped);
});

test("it marks the palettes that collide at 25 categories", async ({
  page,
}) => {
  await page.goto(EXAMPLE);
  await expect(page.locator("#rows tr")).not.toHaveCount(0);

  // The default clears the just-noticeable difference for every vision type;
  // category10 does not, which is why the default changed.
  expect(Number(await cell(page, "nameable", "Worst"))).toBeGreaterThan(2.3);
  expect(Number(await cell(page, "category10", "Worst"))).toBeLessThan(2.3);
  await expect(
    page.locator("#rows tr", { hasText: "category10" }).locator(".broken")
  ).not.toHaveCount(0);
});

test("the table numbers match the palettes the library ships", async ({
  page,
}) => {
  await page.goto(EXAMPLE);
  await expect(page.locator("#rows tr")).not.toHaveCount(0);

  // palettes.json is generated and committed, so it can go stale against
  // src/palettes.js without anything failing to build.
  const drift = await page.evaluate(async () => {
    const data = await (await fetch("palettes.json")).json();
    const out = [];
    // Through d3.color first: the generator writes hex, and the interpolator
    // palettes hand back "rgb(...)" - the same colours in another notation.
    const norm = (list) =>
      list.map((c) => window.d3.color(c).formatHex()).join();
    for (const p of data.sets[50]) {
      const live = window.navio.palettes[p.name];
      const colours = typeof live === "function" ? live(50) : live;
      if (norm(colours) !== norm(p.colours)) out.push(p.name);
    }
    return out;
  });
  expect(drift, "palettes.json is stale - run npm run palettes").toEqual([]);
});

test("switching to a dichromat view repaints the swatches", async ({
  page,
}) => {
  await page.goto(EXAMPLE);
  await expect(page.locator("#rows tr")).not.toHaveCount(0);

  const swatches = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("#rows .swatch i")].map(
        (i) => i.style.background
      )
    );

  const normal = await swatches();
  await page.getByRole("button", { name: "protan", exact: true }).click();
  const protan = await swatches();

  expect(protan).toHaveLength(normal.length);
  expect(protan).not.toEqual(normal);
});

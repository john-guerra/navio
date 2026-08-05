import { test, expect } from "@playwright/test";

// The attribute list is one row per column, so it is the section that grows
// without bound and pushes Layout, Colours and Filtering out of reach. It
// folds, and past nv.settingsMaxAttribRows the list scrolls inside itself.
//
// A real <details>/<summary>, not a div with a click handler: the browser
// already has the disclosure widget, its keyboard behaviour and its ARIA.

const many = (n) => `/test/e2e/fixtures/wide.html?cols=${n}`;

const open = async (page) => {
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();
  await expect(page.locator("#nv ._nv_settings")).toBeVisible();
};

test("the attributes section is a native details element", async ({ page }) => {
  await page.goto(many(5));
  await open(page);

  const d = page.locator(
    '#nv ._nv_settings details[data-section="Attributes"]'
  );
  await expect(d).toHaveCount(1);
  await expect(d.locator("summary")).toHaveCount(1);
  // Open by default, and the summary carries the count so it still says how
  // many columns are on once it is folded away.
  expect(await d.evaluate((e) => e.open)).toBe(true);
  await expect(d.locator("summary")).toContainText("shown");
});

test("folding it puts the other sections back within reach", async ({
  page,
}) => {
  await page.goto(many(30));
  await open(page);

  const summary = page.locator(
    '#nv ._nv_settings details[data-section="Attributes"] summary'
  );
  const filtering = page.locator('#nv ._nv_settings >> text="Filtering"');

  const before = await page
    .locator('#nv ._nv_settings details[data-section="Attributes"]')
    .evaluate((e) => e.getBoundingClientRect().height);

  await summary.click();
  const after = await page
    .locator('#nv ._nv_settings details[data-section="Attributes"]')
    .evaluate((e) => e.getBoundingClientRect().height);

  expect(after).toBeLessThan(before);
  await expect(filtering).toBeVisible();
});

test("the fold survives a rebuild of the panel", async ({ page }) => {
  await page.goto(many(12));
  await open(page);

  const details = page.locator(
    '#nv ._nv_settings details[data-section="Attributes"]'
  );
  await details.locator("summary").click();
  expect(await details.evaluate((e) => e.open)).toBe(false);

  // Any type change wipes and rebuilds the whole panel; a <details> element's
  // own state would spring back open.
  await page.evaluate(() => window.nv.setAttribType("c0", "text"));
  await expect(details).toHaveCount(1);
  expect(await details.evaluate((e) => e.open)).toBe(false);
});

test("a short list is not capped; a long one scrolls", async ({ page }) => {
  const listBox = (page) =>
    page.evaluate(() => {
      const l = document.querySelector(
        "#nv ._nv_settings [data-navio-attrib-list]"
      );
      return {
        maxHeight: l.style.maxHeight || null,
        overflowY: getComputedStyle(l).overflowY,
        scrolls: l.scrollHeight > l.clientHeight + 1,
      };
    });

  await page.goto(many(5));
  await open(page);
  const short = await listBox(page);
  expect(short.maxHeight).toBeNull();

  await page.goto(many(30));
  await open(page);
  const long = await listBox(page);
  expect(long.maxHeight).not.toBeNull();
  expect(long.overflowY).toBe("auto");
  expect(long.scrolls).toBe(true);
});

test("the bulk buttons stay put while the list scrolls", async ({ page }) => {
  await page.goto(many(30));
  await open(page);

  // "Show all"/"Show none" sit OUTSIDE the scrolling box, so a long list never
  // carries them off the bottom - which would defeat capping the height.
  expect(
    await page.evaluate(() => {
      const list = document.querySelector(
        "#nv ._nv_settings [data-navio-attrib-list]"
      );
      const btn = Array.from(
        document.querySelectorAll("#nv ._nv_settings button")
      ).find((b) => b.textContent === "Show none");
      return { inside: list.contains(btn), found: !!btn };
    })
  ).toEqual({ inside: false, found: true });

  await expect(
    page.locator('#nv ._nv_settings button:text-is("Show none")')
  ).toBeVisible();
});

test("settingsMaxAttribRows controls when the cap kicks in", async ({
  page,
}) => {
  await page.goto(many(12));
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.evaluate(() => {
    window.nv.settingsMaxAttribRows = 0; // 0 disables capping entirely
  });
  await page.locator("#nv ._nv_gear").click();

  expect(
    await page.evaluate(
      () =>
        document.querySelector("#nv ._nv_settings [data-navio-attrib-list]")
          .style.maxHeight || null
    )
  ).toBeNull();
});

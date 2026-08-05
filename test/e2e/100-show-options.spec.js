import { test, expect } from "@playwright/test";

// The three "Show" checkboxes flipped their flags and changed nothing on
// screen. All three were add-only:
//
//   - showAttribTitles guarded the append of the header <text>, so once a
//     label existed nothing ever removed it;
//   - showSelectedAttrib / showSequenceIDAttrib only ADDED their derived
//     column, inside data(), and only when the flag was already true - so
//     unticking left the column in place and re-ticking found it already in
//     colScales and did nothing either.

const FIXTURE = "/test/e2e/fixtures/vertical.html?orientation=horizontal&n=40";

const box = (page, label) =>
  page
    .locator("#nv ._nv_settings label")
    .filter({ hasText: label })
    .locator('input[type="checkbox"]');

const toggle = async (page, label) => {
  const cb = box(page, label);
  await cb.scrollIntoViewIfNeeded();
  await cb.click();
};

const snap = (page) =>
  page.evaluate(() => ({
    visible: window.nv.getVisibleAttribs().length,
    headers: document.querySelectorAll("#nv .attribOverlay text").length,
  }));

const open = async (page) => {
  await page.setViewportSize({ width: 1400, height: 1500 });
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  await page.locator("#nv ._nv_gear").click();
};

test("column headers can be turned off and back on", async ({ page }) => {
  await open(page);
  const start = await snap(page);
  expect(start.headers).toBeGreaterThan(0);

  await toggle(page, "Column headers");
  await expect.poll(async () => (await snap(page)).headers).toBe(0);

  // Coming BACK is the half that stayed broken after the removal was added:
  // appending on enter only relabelled whichever columns happened to be
  // entering that pass - measured 2 of 6.
  await toggle(page, "Column headers");
  await expect.poll(async () => (await snap(page)).headers).toBe(start.headers);
});

test("the derived columns can be turned off and back on", async ({ page }) => {
  await open(page);
  const start = await snap(page);

  await toggle(page, "Selected column");
  await expect
    .poll(async () => (await snap(page)).visible)
    .toBe(start.visible - 1);

  await toggle(page, "Sequential index column");
  await expect
    .poll(async () => (await snap(page)).visible)
    .toBe(start.visible - 2);

  await toggle(page, "Selected column");
  await toggle(page, "Sequential index column");
  await expect.poll(async () => (await snap(page)).visible).toBe(start.visible);
});

test("every parameter carries a description", async ({ page }) => {
  await open(page);
  // Hovering any control in the panel has to explain what it does; a label
  // like "Top offset" or "Click tolerance" means nothing on its own.
  const rows = await page.evaluate(() => {
    // The parameter rows only. The attribute list's own rows are labels too,
    // but they name a column and carry "Drag to reorder".
    const labels = Array.from(
      document.querySelectorAll("#nv ._nv_settings label")
    ).filter((l) => !l.closest('details[data-section="Attributes"]'));
    return {
      total: labels.length,
      untitled: labels.filter((l) => !l.getAttribute("title")).length,
      // Real sentences, not the label repeated back.
      short: labels.filter((l) => (l.getAttribute("title") || "").length < 25)
        .length,
    };
  });
  expect(rows.total).toBeGreaterThan(20);
  expect(rows.untitled).toBe(0);
  expect(rows.short).toBe(0);
});

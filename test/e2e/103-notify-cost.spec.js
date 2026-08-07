import { test, expect } from "@playwright/test";

// Every change notification built the selected-rows array TWICE: once for the
// callback in notifyChange, then again in announceState, which only wanted its
// length. Both are full projections of the selection into row objects.
//
// It shows up worst when CLOSING a level, because closing re-selects
// everything: measured on 202105-citibike-tripdata.csv (2,724,165 rows),
// getSelected() alone was 60ms, so the pair was ~120ms of a 242ms close. The
// asymmetry users notice is that creating a level costs in proportion to the
// rows that SURVIVE, while closing one always costs the whole dataset:
//
//   filter               kept        create    close
//   narrow (1 station)   3,930       304ms     242ms
//   wide (member)        1,914,217   567ms     130ms

const F = "/test/e2e/fixtures/perf.html?n=2000";

const FILTER = [[{ type: "value", attrib: "category", value: "alpha" }]];

/**
 * Count calls to getSelected/getVisible across one user action. The action is
 * chosen by name and performed in the page - no string is ever evaluated.
 */
const countProjections = (page, kind, filter) =>
  page.evaluate(
    ({ kind, filter }) => {
      const nv = window.nv;
      let calls = 0;
      const real = nv.getSelected;
      const counting = function (...a) {
        calls++;
        return real.apply(this, a);
      };
      nv.getSelected = counting;
      nv.getVisible = counting; // the legacy alias announceState went through
      try {
        if (kind === "filter") nv.setFilters(filter);
        else
          document
            .querySelector("#nv #closeButton path")
            .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      } finally {
        nv.getSelected = real;
        nv.getVisible = real;
      }
      return calls;
    },
    { kind, filter }
  );

/**
 * Projections and notifications across one action.
 *
 * The assertion is one projection PER NOTIFICATION, not per action: setFilters
 * legitimately notifies more than once (it clears the chain, then applies), and
 * that is a separate question from building the same array twice for one of
 * them.
 */
const countBoth = (page, kind, filter) =>
  page.evaluate(
    ({ kind, filter }) => {
      const nv = window.nv;
      let projections = 0,
        notifications = 0;
      const real = nv.getSelected;
      const counting = function (...a) {
        projections++;
        return real.apply(this, a);
      };
      nv.getSelected = counting;
      nv.getVisible = counting;
      nv.updateCallback(() => notifications++);
      try {
        if (kind === "filter") nv.setFilters(filter);
        else
          document
            .querySelector("#nv #closeButton path")
            .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      } finally {
        nv.getSelected = real;
        nv.getVisible = real;
      }
      return { projections, notifications };
    },
    { kind, filter }
  );

test("a filter projects the selection once per notification, not twice", async ({
  page,
}) => {
  await page.goto(F);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const m = await countBoth(page, "filter", FILTER);
  expect(m.notifications).toBeGreaterThan(0);
  expect(m.projections).toBe(m.notifications);
});

test("closing a level projects the selection once, not twice", async ({
  page,
}) => {
  await page.goto(F);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  await page.evaluate((f) => window.nv.setFilters(f), FILTER);
  await expect(page.locator("#nv #closeButton")).toBeVisible();

  const m = await countBoth(page, "close", FILTER);
  expect(m.notifications).toBe(1);
  expect(m.projections).toBe(1);
});

// The default callback slot is a no-op, so with nobody registered there is
// nothing to project the rows FOR - and announceState needs only a count.
test("with no callback registered the selection is never projected", async ({
  page,
}) => {
  await page.goto(F);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  expect(await countProjections(page, "filter", FILTER)).toBe(0);
});

test("a registered callback still receives the selected rows", async ({
  page,
}) => {
  await page.goto(F);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const got = await page.evaluate((f) => {
    let seen = null;
    window.nv.updateCallback((rows) => {
      seen = rows;
    });
    window.nv.setFilters(f);
    return {
      len: seen && seen.length,
      isRows: !!(seen && seen[0] && seen[0].category !== undefined),
      matches: seen && seen.length === window.nv.getSelected().length,
    };
  }, FILTER);

  expect(got.len).toBeGreaterThan(0);
  expect(got.isRows).toBe(true);
  expect(got.matches).toBe(true);
});

test("the announcement still reports the right count", async ({ page }) => {
  await page.goto(F);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  await page.evaluate((f) => window.nv.setFilters(f), FILTER);

  const m = await page.evaluate(() => ({
    announced: document.querySelector("#nv [aria-live]")?.textContent || "",
    selected: window.nv.getSelected().length,
    total: window.nv.getRowsAtLevel(0).length,
  }));

  expect(m.selected).toBeGreaterThan(0);
  expect(m.announced).toContain(`${m.selected} of ${m.total} rows selected`);
});

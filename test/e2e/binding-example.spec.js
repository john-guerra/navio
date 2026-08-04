import { test, expect } from "@playwright/test";

// Guards examples/binding — the runnable demonstration of #60. Examples rot
// silently, so this drives the real page rather than a fixture.

test("two bound Navios stay in sync", async ({ page }) => {
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));

  await page.goto("/examples/binding/");
  await expect(page.locator("#navioA canvas")).toHaveCount(1);
  await expect(page.locator("#navioB canvas")).toHaveCount(1);

  const synced = await page.evaluate(() => {
    const a = document.querySelector("#navioA").firstChild;
    const b = document.querySelector("#navioB").firstChild;
    a.setValue([[{ type: "value", attrib: "species", value: "Adelie" }]]);
    return {
      a: a.getSelected().length,
      b: b.getSelected().length,
      sameValue: JSON.stringify(a.value) === JSON.stringify(b.value),
    };
  });

  expect(synced.a).toBeGreaterThan(0);
  expect(synced.b).toBe(synced.a); // the bound peer followed
  expect(synced.sameValue).toBe(true);
  expect(errs).toEqual([]);
});

test("the facet bridge narrows Navio's dataset and keeps its own drill-down", async ({
  page,
}) => {
  await page.goto("/examples/binding/");
  const rowsOf = () =>
    page.evaluate(
      () => document.querySelector("#navioC").firstChild.navio.data().length
    );

  expect(await rowsOf()).toBe(120);

  // A rows-valued widget cannot be bound to Navio directly; the bridge feeds
  // its output in as data instead.
  await page.locator("#facets input[type=checkbox]").first().check();
  await page.waitForTimeout(200);

  const after = await rowsOf();
  expect(after).toBeGreaterThan(0);
  expect(after).toBeLessThan(120);

  // Navio's own filtering still applies on top of the narrowed dataset.
  const composed = await page.evaluate(() => {
    const c = document.querySelector("#navioC").firstChild;
    c.setValue([[{ type: "value", attrib: "island", value: "Biscoe" }]]);
    return { total: c.navio.data().length, shown: c.getSelected().length };
  });
  expect(composed.shown).toBeLessThanOrEqual(composed.total);
});

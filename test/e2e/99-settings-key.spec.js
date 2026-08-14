import { test, expect } from "@playwright/test";

// #99. Settings are remembered per widget in localStorage. Telling two widgets
// on one page apart used to fall back to a per-page instance COUNTER when the
// container had no id - a number that describes construction order in this page
// load, not the identity of the widget. Build them in the other order next time
// (a lazily-built widget, a widget rebuilt when its data changes) and each
// restores the other's hiddenAttribs, attribOrder and attribTypes.
//
// Two independent halves, and both are needed:
//   - no container id and no settingsKey now means no persistence at all,
//     because a key that means "the Nth widget built here" cannot identify a
//     widget across loads;
//   - settingsKey passed through the options object is in effect before the
//     stored settings are READ, not only when they are written.

const FIXTURE = "/test/e2e/fixtures/settings-key.html";

const navioKeys = (page) =>
  page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("navio.settings."))
  );

/** Change something through the panel, which is what triggers a persist. */
const hideFirstAttrib = async (page, host) => {
  await page.locator(`${host} ._nv_gear`).click();
  const box = page.locator(`${host} ._nv_settings input[type="checkbox"]`);
  await expect(box.first()).toBeVisible();
  await box.first().click();
};

test("a container with no id persists nothing", async ({ page }) => {
  await page.goto(`${FIXTURE}?reset=1`);
  await expect(page.locator("[data-host=a] canvas")).toHaveCount(1);

  await hideFirstAttrib(page, "[data-host=a]");

  // The setting took effect on the widget...
  expect(await page.evaluate(() => window.nvA.getHiddenAttribs().length)).toBe(
    1
  );
  // ...and went nowhere, because there is nothing stable to file it under.
  expect(await navioKeys(page)).toEqual([]);
});

test("two id-less widgets never restore each other's settings", async ({
  page,
}) => {
  await page.goto(`${FIXTURE}?reset=1`);
  await expect(page.locator("[data-host=a] canvas")).toHaveCount(1);
  await hideFirstAttrib(page, "[data-host=a]");

  // Same page, same two widgets, built in the opposite order. Deliberately NOT
  // reset: what the load above persisted has to survive into this one, or the
  // test proves nothing.
  await page.goto(`${FIXTURE}?order=BA`);
  await expect(page.locator("[data-host=b] canvas")).toHaveCount(1);

  // B must not have been handed alpha/beta/gamma, which are A's attributes.
  expect(await page.evaluate(() => window.warnings)).toEqual([]);
  expect(await page.evaluate(() => window.nvB.getHiddenAttribs())).toEqual([]);
});

test("settingsKey from the options object is used for the initial READ", async ({
  page,
}) => {
  // Seeded before the page runs, as a previous visit would have left it.
  await page.addInitScript(() => {
    localStorage.setItem(
      "my-own-key",
      JSON.stringify({ hiddenAttribs: ["beta"] })
    );
  });

  await page.goto(`${FIXTURE}?reset=1&key=my-own-key`);
  await expect(page.locator("[data-host=a] canvas")).toHaveCount(1);

  // Applied at construction - not only honoured when saving.
  expect(await page.evaluate(() => window.nvA.getHiddenAttribs())).toEqual([
    "beta",
  ]);
});

test("settingsKey null turns persistence off", async ({ page }) => {
  await page.goto(`${FIXTURE}?reset=1&key=null`);
  await expect(page.locator("[data-host=a] canvas")).toHaveCount(1);

  await hideFirstAttrib(page, "[data-host=a]");

  expect(await navioKeys(page)).toEqual([]);
});

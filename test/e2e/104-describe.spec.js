import { test, expect } from "@playwright/test";

// navio.describe() is the runtime half of the API surface, and these are the
// tests that stop it describing a different Navio than the one it ships in.
//
// This has to be an e2e test rather than a unit test: the options and their
// defaults live on `nv` inside the closure, so only a real instance in a real
// browser can be asked what they actually are.

const FIXTURE = "/test/e2e/fixtures/single.html";

test("every option on the instance is described", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const { described, actual } = await page.evaluate(() => ({
    described: window.navio.describe().options.map((o) => o.key),
    actual: Object.keys(window.nv.getOptions()),
  }));

  // Adding an option without describing it has to fail, or the table falls
  // behind the code the first time anyone is in a hurry.
  const undocumented = actual.filter((k) => !described.includes(k));
  expect(undocumented, "options with no entry in src/params.js").toEqual([]);

  // ...and describing one that does not exist has to fail too. That is the
  // direction that actually happened: `snapshot()` was documented in CLAUDE.md
  // and NavioWidget.js and never existed.
  const invented = described.filter((k) => !actual.includes(k));
  expect(invented, "described options that are not on the instance").toEqual(
    []
  );
});

test("every described default is the real default", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const wrong = await page.evaluate(() => {
    const opts = window.navio.describe().options;
    // A fresh instance, so nothing the fixture configured counts as a default.
    const host = document.createElement("div");
    document.body.appendChild(host);
    const fresh = window.navio(window.d3.select(host));
    const actual = fresh.getOptions();
    const bad = [];
    for (const o of opts) {
      if (!("default" in o)) continue; // functions and schemes carry defaultText
      const real = actual[o.key];
      const same =
        Array.isArray(o.default) && Array.isArray(real)
          ? JSON.stringify(o.default) === JSON.stringify(real)
          : o.default === real;
      if (!same)
        bad.push({ key: o.key, described: o.default, actual: String(real) });
    }
    fresh.destroy();
    host.remove();
    return bad;
  });

  expect(
    wrong,
    "described defaults that do not match a fresh instance"
  ).toEqual([]);
});

test("every described method exists and is callable", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const missing = await page.evaluate(() =>
    window.navio
      .describe()
      .methods.map((m) => m.name)
      .filter((n) => typeof window.nv[n] !== "function")
  );
  expect(missing, "described methods missing from the instance").toEqual([]);
});

test("the schema is frozen, so a caller cannot edit it", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const stillRight = await page.evaluate(() => {
    const first = window.navio.describe().options[0];
    try {
      first.hint = "clobbered";
    } catch {
      /* strict mode throws; sloppy mode is silent. Either is fine. */
    }
    return window.navio.describe().options[0].hint !== "clobbered";
  });
  expect(stillRight).toBe(true);
});

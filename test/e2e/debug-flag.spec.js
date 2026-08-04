import { test, expect } from "@playwright/test";

// nv.DEBUG is per-instance and only reachable AFTER construction, by which
// point everything logged during construction and the first data() call is
// already gone. These two entry points let tracing be switched on beforehand,
// without rebuilding: useful from an Observable cell, or a devtools console
// followed by a reload.

const FIXTURE = "/test/e2e/fixtures/debug-flag.html";

/** Console lines that are not the once-per-load version banner. */
async function traceLines(page, query) {
  const logs = [];
  page.on("console", (m) => logs.push(m.text()));
  await page.goto(FIXTURE + query);
  await expect(page.locator("#nv canvas")).toHaveCount(1);
  return logs.filter((l) => !/^navio \d|^navio dev/.test(l));
}

test("stays silent by default", async ({ page }) => {
  expect(await traceLines(page, "")).toEqual([]);
  expect(await page.evaluate(() => window.nv.DEBUG)).toBe(false);
});

test("navio.DEBUG set before constructing traces from the first call", async ({
  page,
}) => {
  const lines = await traceLines(page, "?static=1");
  expect(await page.evaluate(() => window.nv.DEBUG)).toBe(true);
  expect(lines.length).toBeGreaterThan(5);
  // Construction-time tracing is the point - this happens inside data().
  expect(lines.join("\n")).toMatch(
    /Assiging indexes|Updating data|Update scales/
  );
});

test("globalThis.NAVIO_DEBUG set before the script loads also works", async ({
  page,
}) => {
  const lines = await traceLines(page, "?global=1");
  expect(await page.evaluate(() => window.nv.DEBUG)).toBe(true);
  expect(lines.length).toBeGreaterThan(5);
});

test("instances created after the flag flips pick it up, earlier ones do not", async ({
  page,
}) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#nv canvas")).toHaveCount(1);

  const got = await page.evaluate(() => {
    const before = window.nv.DEBUG;
    window.navio.DEBUG = true;
    const div = document.createElement("div");
    document.body.appendChild(div);
    // eslint-disable-next-line no-undef
    const second = new navio(d3.select(div), 200);
    const after = second.DEBUG;
    second.destroy();
    window.navio.DEBUG = false;
    return { before, after, firstStillOff: window.nv.DEBUG };
  });

  expect(got).toEqual({ before: false, after: true, firstStillOff: false });
});

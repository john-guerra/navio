import { test, expect } from "@playwright/test";

test("mounts a single Navio instance without console errors and draws a canvas", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/test/e2e/fixtures/single.html");

  await expect(page.locator("#nv canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("mounts two Navio instances on the same page without console errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/test/e2e/fixtures/two-instances.html");

  await expect(page.locator("#nv1 canvas")).toHaveCount(1);
  await expect(page.locator("#nv2 canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

import { describe, it, expect } from "vitest";
import navio from "../../src/navio.js";

// navio(selection, options) takes a container; NavioWidget(data, options) takes
// rows. The UMD default export is the former, so `require("navio")` in an
// Observable notebook hands you the low-level factory - and calling it as
// `navio(data, {height: 400})` used to reach d3.select() with an array, which
// wraps it happily and only fails one call later, deep inside init(), with
// "this.querySelectorAll is not a function". That message names nothing the
// caller wrote. Fail at the boundary instead, and say where the rows belong.

describe("navio(selection) argument guard", () => {
  it("rejects an array of rows by pointing at NavioWidget", () => {
    const data = [{ a: 1 }, { a: 2 }];

    expect(() => navio(data, { height: 400 })).toThrow(/NavioWidget/);
  });
});

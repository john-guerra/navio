import { describe, it, expect } from "vitest";
import {
  FilterByRange,
  FilterByValue,
  FilterByValueDifferent,
  FilterByRangeNegative,
} from "../../src/filters.js";

// Positions used to live on the row as `__i[level]`; they are now a side table
// owned by navio and handed to range filters as accessors (#88).
const ROWS = Array.from({ length: 8 }, (_unused, i) => ({ value: `v${i}` }));
/** Rows in their natural order, so a row's position IS its index. */
const positional = { getRow: (i) => ROWS[i], getPos: (i) => i };

describe("FilterByValue", () => {
  const sel = { value: "cat" };
  const f = FilterByValue({ itemAttr: "value", sel });

  it("matches rows with the same attribute value", () => {
    expect(f.filter({ value: "cat" })).toBe(true);
  });

  it("rejects rows with a different attribute value", () => {
    expect(f.filter({ value: "dog" })).toBe(false);
  });

  it("describes itself for the filter chip label", () => {
    expect(f.toStr()).toBe("value == cat");
  });

  it("is tagged as a positive value filter", () => {
    expect(f.type).toBe("value");
  });
});

describe("FilterByValueDifferent", () => {
  const sel = { value: "cat" };
  const f = FilterByValueDifferent({ itemAttr: "value", sel });

  it("matches rows with a different attribute value", () => {
    expect(f.filter({ value: "dog" })).toBe(true);
  });

  it("rejects rows with the same attribute value", () => {
    expect(f.filter({ value: "cat" })).toBe(false);
  });

  it("is tagged as a negative value filter", () => {
    expect(f.type).toBe("negativeValue");
  });
});

describe("FilterByRange", () => {
  const f = FilterByRange({
    firstIndex: 2,
    lastIndex: 5,
    level: 0,
    itemAttr: "value",
    ...positional,
  });

  it("includes rows whose position falls within [first, last]", () => {
    expect(f.filter(ROWS[2], 2)).toBe(true);
    expect(f.filter(ROWS[3], 3)).toBe(true);
    expect(f.filter(ROWS[5], 5)).toBe(true);
  });

  it("excludes rows whose position falls outside [first, last]", () => {
    expect(f.filter(ROWS[1], 1)).toBe(false);
    expect(f.filter(ROWS[6], 6)).toBe(false);
  });

  it("is tagged as a range filter", () => {
    expect(f.type).toBe("range");
  });
});

describe("FilterByRangeNegative", () => {
  const f = FilterByRangeNegative({
    firstIndex: 2,
    lastIndex: 5,
    level: 0,
    itemAttr: "value",
    ...positional,
  });

  it("excludes rows whose position falls within [first, last]", () => {
    expect(f.filter(ROWS[3], 3)).toBe(false);
  });

  it("includes rows whose position falls outside [first, last]", () => {
    expect(f.filter(ROWS[1], 1)).toBe(true);
    expect(f.filter(ROWS[6], 6)).toBe(true);
  });

  it("is tagged as a negative range filter", () => {
    expect(f.type).toBe("negativeRange");
  });
});

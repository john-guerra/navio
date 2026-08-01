import { describe, it, expect } from "vitest";
import {
  FilterByRange,
  FilterByValue,
  FilterByValueDifferent,
  FilterByRangeNegative,
} from "../../src/filters.js";

const rowAt = (i) => ({ __i: [i], value: `v${i}` });

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
  const level = 0;
  const first = rowAt(2);
  const last = rowAt(5);
  const f = FilterByRange({ first, last, level, itemAttr: "value" });

  it("includes rows whose sort-order index falls within [first, last]", () => {
    expect(f.filter(rowAt(2))).toBe(true);
    expect(f.filter(rowAt(3))).toBe(true);
    expect(f.filter(rowAt(5))).toBe(true);
  });

  it("excludes rows whose sort-order index falls outside [first, last]", () => {
    expect(f.filter(rowAt(1))).toBe(false);
    expect(f.filter(rowAt(6))).toBe(false);
  });

  it("is tagged as a range filter", () => {
    expect(f.type).toBe("range");
  });
});

describe("FilterByRangeNegative", () => {
  const level = 0;
  const first = rowAt(2);
  const last = rowAt(5);
  const f = FilterByRangeNegative({ first, last, level, itemAttr: "value" });

  it("excludes rows whose sort-order index falls within [first, last]", () => {
    expect(f.filter(rowAt(3))).toBe(false);
  });

  it("includes rows whose sort-order index falls outside [first, last]", () => {
    expect(f.filter(rowAt(1))).toBe(true);
    expect(f.filter(rowAt(6))).toBe(true);
  });

  it("is tagged as a negative range filter", () => {
    expect(f.type).toBe("negativeRange");
  });
});

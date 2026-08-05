import { describe, it, expect } from "vitest";
import {
  FilterByRange,
  FilterByValue,
  FilterByValueDifferent,
  FilterByRangeNegative,
  FilterByIds,
  filterFromValue,
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

// An external selection - a bound table's checked rows - names rows outright
// rather than describing them. Unlike a positional range it survives sorting,
// which is why it is a set membership test on the id rather than on a position.
describe("FilterByIds", () => {
  // A custom id: the third character of the row's value, so ids are not indices.
  const getId = (i) => ROWS[i].value;
  const f = FilterByIds({ ids: ["v1", "v4", "v7"], getId });

  it("matches only the named rows", () => {
    expect(f.filter(ROWS[1], 1)).toBe(true);
    expect(f.filter(ROWS[4], 4)).toBe(true);
    expect(f.filter(ROWS[7], 7)).toBe(true);
  });

  it("rejects everything else", () => {
    expect(f.filter(ROWS[0], 0)).toBe(false);
    expect(f.filter(ROWS[3], 3)).toBe(false);
  });

  it("defaults to the row index, which is what nv.id() means by __seqId", () => {
    const g = FilterByIds({ ids: [2, 3] });
    expect(g.filter(ROWS[2], 2)).toBe(true);
    expect(g.filter(ROWS[5], 5)).toBe(false);
  });

  it("accepts a Set as readily as an array", () => {
    const g = FilterByIds({ ids: new Set(["v1"]), getId });
    expect(g.filter(ROWS[1], 1)).toBe(true);
    expect(g.filter(ROWS[2], 2)).toBe(false);
  });

  it("describes itself for the filter chip label", () => {
    expect(f.toStr()).toBe("selection of 3 rows");
    expect(FilterByIds({ ids: [1] }).toStr()).toBe("selection of 1 row");
  });

  it("is tagged as an id filter", () => {
    expect(f.type).toBe("ids");
  });

  it("round-trips through filterFromValue", () => {
    const rebuilt = filterFromValue(f.toValue(), { getId });
    expect(rebuilt.type).toBe("ids");
    expect(rebuilt.filter(ROWS[4], 4)).toBe(true);
    expect(rebuilt.filter(ROWS[5], 5)).toBe(false);
  });

  it("rejects a descriptor with no id list rather than matching nothing", () => {
    expect(filterFromValue({ type: "ids" })).toBeNull();
    expect(filterFromValue({ type: "ids", ids: "v1" })).toBeNull();
  });
});

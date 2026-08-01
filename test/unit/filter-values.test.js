import { describe, it, expect } from "vitest";
import {
  FilterByRange,
  FilterByValue,
  FilterByValueDifferent,
  FilterByRangeNegative,
  filterFromValue,
} from "../../src/filters.js";

// Serialization layer for issue #60. A filter's `.value` form must survive
// being replayed on another Navio instance, which is only possible if it
// records raw attribute values rather than the sort-order-dependent position
// index (`__i[level]`) that FilterByRange actually compares at runtime.

const LEVEL = 0;

/** Penguins-ish rows, pre-sorted by beak ascending, with __i assigned. */
function makeRows() {
  const rows = [
    { __seqId: 0, species: "Adelie", island: "Torgersen", beak: 9 },
    { __seqId: 1, species: "Adelie", island: "Torgersen", beak: 10 },
    { __seqId: 2, species: "Adelie", island: "Biscoe", beak: 11 },
    { __seqId: 3, species: "Gentoo", island: "Biscoe", beak: 12 },
    { __seqId: 4, species: "Gentoo", island: "Dream", beak: 13 },
    { __seqId: 5, species: "Chinstrap", island: "Dream", beak: 14 },
  ];
  rows.forEach((r, i) => (r.__i = [i]));
  return rows;
}

const ctx = (rows) => ({
  level: LEVEL,
  rows,
  resolveAttrib: (name) => name,
});

describe("value filters round-trip", () => {
  it("serializes FilterByValue to a plain JSON-safe object", () => {
    const rows = makeRows();
    const f = FilterByValue({ itemAttr: "island", sel: rows[0] });

    expect(f.toValue()).toEqual({
      type: "value",
      attrib: "island",
      value: "Torgersen",
    });
    expect(JSON.parse(JSON.stringify(f.toValue()))).toEqual(f.toValue());
  });

  it("serializes FilterByValueDifferent as negativeValue", () => {
    const rows = makeRows();
    const f = FilterByValueDifferent({ itemAttr: "island", sel: rows[0] });
    expect(f.toValue().type).toBe("negativeValue");
    expect(f.toValue().value).toBe("Torgersen");
  });

  it("rehydrates a value filter that selects exactly the same rows", () => {
    const rows = makeRows();
    const original = FilterByValue({ itemAttr: "island", sel: rows[0] });

    const restored = filterFromValue(original.toValue(), ctx(rows));

    expect(rows.filter(restored.filter)).toEqual(rows.filter(original.filter));
    expect(rows.filter(restored.filter).map((r) => r.__seqId)).toEqual([0, 1]);
  });

  it("rehydrates a negative value filter", () => {
    const rows = makeRows();
    const original = FilterByValueDifferent({
      itemAttr: "island",
      sel: rows[0],
    });
    const restored = filterFromValue(original.toValue(), ctx(rows));
    expect(rows.filter(restored.filter)).toEqual(rows.filter(original.filter));
  });
});

describe("range filters round-trip", () => {
  it("records raw boundary values and sort context, not position indexes", () => {
    const rows = makeRows();
    const f = FilterByRange({
      first: rows[1],
      last: rows[4],
      level: LEVEL,
      itemAttr: "beak",
    });

    const v = f.toValue({ sortAttrib: "beak", sortDesc: false });

    expect(v).toMatchObject({
      type: "range",
      attrib: "beak",
      first: 10,
      last: 13,
      sortAttrib: "beak",
      sortDesc: false,
    });
    // Stable ids are kept only to disambiguate duplicate values.
    expect(v.firstId).toBe(1);
    expect(v.lastId).toBe(4);
    // Nothing position-derived leaks into the serialized form.
    expect(JSON.stringify(v)).not.toContain("__i");
  });

  it("rehydrates a range filter selecting the same rows", () => {
    const rows = makeRows();
    const original = FilterByRange({
      first: rows[1],
      last: rows[4],
      level: LEVEL,
      itemAttr: "beak",
    });

    const restored = filterFromValue(
      original.toValue({ sortAttrib: "beak", sortDesc: false }),
      ctx(rows)
    );

    expect(rows.filter(restored.filter).map((r) => r.__seqId)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("rehydrates negativeRange as the complement", () => {
    const rows = makeRows();
    const original = FilterByRangeNegative({
      first: rows[1],
      last: rows[4],
      level: LEVEL,
      itemAttr: "beak",
    });

    const restored = filterFromValue(
      original.toValue({ sortAttrib: "beak", sortDesc: false }),
      ctx(rows)
    );

    expect(rows.filter(restored.filter).map((r) => r.__seqId)).toEqual([0, 5]);
  });

  // The whole point of capturing raw values: a range means "beak 10..13",
  // not "whatever sat in positions 1..4 under the sort that was active".
  it("selects by value even when the target is sorted differently", () => {
    const rows = makeRows();
    const original = FilterByRange({
      first: rows[1],
      last: rows[4],
      level: LEVEL,
      itemAttr: "beak",
    });
    const serialized = original.toValue({
      sortAttrib: "beak",
      sortDesc: false,
    });

    // Same data, now sorted by beak DESCENDING, so __i is reversed.
    const reordered = makeRows().reverse();
    reordered.forEach((r, i) => (r.__i = [i]));

    const restored = filterFromValue(serialized, ctx(reordered));

    // Still beaks 10..13, regardless of position.
    expect(
      reordered
        .filter(restored.filter)
        .map((r) => r.beak)
        .sort((a, b) => a - b)
    ).toEqual([10, 11, 12, 13]);
  });

  it("falls back to the nearest value and flags approximate when a boundary row is gone", () => {
    const rows = makeRows();
    const serialized = FilterByRange({
      first: rows[1],
      last: rows[4],
      level: LEVEL,
      itemAttr: "beak",
    }).toValue({ sortAttrib: "beak", sortDesc: false });

    // The row holding beak=10 no longer exists in this dataset.
    const without = makeRows().filter((r) => r.beak !== 10);
    without.forEach((r, i) => (r.__i = [i]));

    const restored = filterFromValue(serialized, ctx(without));

    expect(restored).not.toBeNull();
    expect(restored.approximate).toBe(true);
    expect(without.filter(restored.filter).map((r) => r.beak)).toEqual([
      11, 12, 13,
    ]);
  });

  it("returns null rather than mis-selecting when the attribute is absent", () => {
    const rows = makeRows();
    const restored = filterFromValue(
      { type: "range", attrib: "nonexistent", first: 1, last: 2 },
      ctx(rows)
    );
    expect(restored).toBeNull();
  });
});

describe("filterFromValue input handling", () => {
  it("returns null for an unknown filter type instead of throwing", () => {
    const rows = makeRows();
    expect(filterFromValue({ type: "bogus" }, ctx(rows))).toBeNull();
    expect(filterFromValue(null, ctx(rows))).toBeNull();
  });

  it("preserves the human-readable label through a round-trip", () => {
    const rows = makeRows();
    const original = FilterByValue({ itemAttr: "island", sel: rows[0] });
    const restored = filterFromValue(original.toValue(), ctx(rows));
    expect(restored.toStr()).toBe(original.toStr());
  });
});

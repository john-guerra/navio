import { describe, it, expect } from "vitest";
import {
  FilterByRange,
  FilterByValue,
  FilterByValueDifferent,
  FilterByRangeNegative,
  FilterByValueRange,
  filterFromValue,
} from "../../src/filters.js";

// Serialization layer for issue #60. A filter's `.value` form must survive
// being replayed on another Navio instance, which is only possible if it
// records raw attribute values rather than the sort-order-dependent position
// index (`__i[level]`) that FilterByRange actually compares at runtime.

const LEVEL = 0;

/** Penguins-ish rows, pre-sorted by beak ascending, with __i assigned. */
function makeRows() {
  return [
    { species: "Adelie", island: "Torgersen", beak: 9 },
    { species: "Adelie", island: "Torgersen", beak: 10 },
    { species: "Adelie", island: "Biscoe", beak: 11 },
    { species: "Gentoo", island: "Biscoe", beak: 12 },
    { species: "Gentoo", island: "Dream", beak: 13 },
    { species: "Chinstrap", island: "Dream", beak: 14 },
  ];
}

/**
 * Bookkeeping lives in side tables now (#88), so a filter is given indices and
 * accessors rather than rows carrying `__i`/`__seqId`. `order` is the visual
 * order of the level: order[p] is the index of the row drawn at position p.
 */
const ctx = (rows, order = rows.map((_unused, i) => i)) => {
  const posOf = new Map(order.map((rowIdx, pos) => [rowIdx, pos]));
  return {
    level: LEVEL,
    indices: order,
    getRow: (i) => rows[i],
    getPos: (i) => posOf.get(i),
    resolveAttrib: (name) => name,
  };
};

/** Build a range filter the way navio does, over rows in their natural order. */
const rangeOver = (Make, rows, firstIndex, lastIndex) =>
  Make({
    firstIndex,
    lastIndex,
    level: LEVEL,
    itemAttr: "beak",
    getRow: (i) => rows[i],
    getPos: (i) => i,
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

    expect(rows.filter((r, i) => restored.filter(r, i))).toEqual(
      rows.filter((r, i) => original.filter(r, i))
    );
    expect(
      rows.filter((r, i) => restored.filter(r, i)).map((r) => r.island)
    ).toEqual(["Torgersen", "Torgersen"]);
  });

  it("rehydrates a negative value filter", () => {
    const rows = makeRows();
    const original = FilterByValueDifferent({
      itemAttr: "island",
      sel: rows[0],
    });
    const restored = filterFromValue(original.toValue(), ctx(rows));
    expect(rows.filter((r, i) => restored.filter(r, i))).toEqual(
      rows.filter((r, i) => original.filter(r, i))
    );
  });
});

describe("range filters round-trip", () => {
  it("records raw boundary values and sort context, not position indexes", () => {
    const rows = makeRows();
    const f = rangeOver(FilterByRange, rows, 1, 4);

    const v = f.toValue({ sortAttrib: "beak", sortDesc: false });

    expect(v).toMatchObject({
      type: "range",
      attrib: "beak",
      first: 10,
      last: 13,
      sortAttrib: "beak",
      sortDesc: false,
    });
    // Nothing position-derived leaks into the serialized form.
    expect(JSON.stringify(v)).not.toContain("__i");
  });

  it("rehydrates a range filter selecting the same rows", () => {
    const rows = makeRows();
    const original = rangeOver(FilterByRange, rows, 1, 4);

    const restored = filterFromValue(
      original.toValue({ sortAttrib: "beak", sortDesc: false }),
      ctx(rows)
    );

    expect(
      rows.filter((r, i) => restored.filter(r, i)).map((r) => r.beak)
    ).toEqual([10, 11, 12, 13]);
  });

  it("rehydrates negativeRange as the complement", () => {
    const rows = makeRows();
    const original = rangeOver(FilterByRangeNegative, rows, 1, 4);

    const restored = filterFromValue(
      original.toValue({ sortAttrib: "beak", sortDesc: false }),
      ctx(rows)
    );

    expect(
      rows.filter((r, i) => restored.filter(r, i)).map((r) => r.beak)
    ).toEqual([9, 14]);
  });

  // The whole point of capturing raw values: a range means "beak 10..13",
  // not "whatever sat in positions 1..4 under the sort that was active".
  it("selects by value even when the target is sorted differently", () => {
    const rows = makeRows();
    const original = rangeOver(FilterByRange, rows, 1, 4);
    const serialized = original.toValue({
      sortAttrib: "beak",
      sortDesc: false,
    });

    // Same rows, but the level is now ordered by beak DESCENDING, so the
    // positions are reversed while the row indices are unchanged.
    const descending = [5, 4, 3, 2, 1, 0];
    const restored = filterFromValue(serialized, ctx(rows, descending));

    // Still beaks 10..13, regardless of position.
    expect(
      rows
        .filter((r, i) => restored.filter(r, i))
        .map((r) => r.beak)
        .sort((a, b) => a - b)
    ).toEqual([10, 11, 12, 13]);
  });

  it("falls back to the nearest value and flags approximate when a boundary row is gone", () => {
    const rows = makeRows();
    const serialized = rangeOver(FilterByRange, rows, 1, 4).toValue({
      sortAttrib: "beak",
      sortDesc: false,
    });

    // The row holding beak=10 no longer exists in this dataset.
    const without = makeRows().filter((r) => r.beak !== 10);

    const restored = filterFromValue(serialized, ctx(without));

    expect(restored).not.toBeNull();
    expect(restored.approximate).toBe(true);
    expect(
      without.filter((r, i) => restored.filter(r, i)).map((r) => r.beak)
    ).toEqual([11, 12, 13]);
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

// "__seqId" is derived from the row's index rather than stored on the row
// (#88), so `row["__seqId"]` is undefined. A range serialized against it - the
// default for an unsorted level, which is what a first brush produces - has to
// rebuild through the index-aware accessor. Reading it off the row instead made
// setFilters drop the filter and collapse the bound peer back to one level.
describe("derived attributes survive the round-trip", () => {
  const seqCtx = (rows) => ({
    level: LEVEL,
    indices: rows.map((_unused, i) => i),
    getRow: (i) => rows[i],
    getPos: (i) => i,
    getAttribAt: (i, attrib) => (attrib === "__seqId" ? i : rows[i][attrib]),
    resolveAttrib: (name) => name,
  });

  const serialized = {
    type: "range",
    attrib: "__seqId",
    first: 1,
    last: 4,
    firstId: 1,
    lastId: 4,
  };

  it("rebuilds a range over __seqId even though no row carries it", () => {
    const rows = makeRows();
    expect(rows[0].__seqId).toBeUndefined();

    const restored = filterFromValue(serialized, seqCtx(rows));

    expect(restored).not.toBeNull();
    expect(
      rows.filter((r, i) => restored.filter(r, i)).map((r) => r.beak)
    ).toEqual([10, 11, 12, 13]);
  });

  it("still rejects an attribute that is genuinely absent", () => {
    const rows = makeRows();
    expect(
      filterFromValue({ ...serialized, attrib: "nonexistent" }, seqCtx(rows))
    ).toBeNull();
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

// FilterByValueRange is the semantic counterpart to FilterByRange: it compares
// raw attribute values rather than the sort-order-dependent __i[level]
// position, so it means "beak between 10 and 13" regardless of how the level is
// ordered. It is what a faceted-search range facet maps onto - see #60.
describe("FilterByValueRange", () => {
  const rows = () => makeRows();

  it("selects rows whose value falls inside the range, inclusive", () => {
    const f = FilterByValueRange({ itemAttr: "beak", min: 10, max: 13 });
    expect(
      rows()
        .filter(f.filter)
        .map((r) => r.beak)
    ).toEqual([10, 11, 12, 13]);
  });

  it("is independent of the level's ordering, unlike FilterByRange", () => {
    const f = FilterByValueRange({ itemAttr: "beak", min: 10, max: 13 });
    const reordered = makeRows().reverse();
    reordered.forEach((r, i) => (r.__i = [i]));
    expect(
      reordered
        .filter(f.filter)
        .map((r) => r.beak)
        .sort((a, b) => a - b)
    ).toEqual([10, 11, 12, 13]);
  });

  it("counts as a positive filter, so it ANDs with negatives and ORs with positives", () => {
    expect(FilterByValueRange({ itemAttr: "beak", min: 1, max: 2 }).type).toBe(
      "valueRange"
    );
  });

  it("round-trips through toValue/filterFromValue", () => {
    const original = FilterByValueRange({ itemAttr: "beak", min: 10, max: 13 });
    const v = original.toValue();
    expect(v).toEqual({ type: "valueRange", attrib: "beak", min: 10, max: 13 });
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);

    const restored = filterFromValue(v, ctx(rows()));
    expect(rows().filter(restored.filter)).toEqual(
      rows().filter(original.filter)
    );
  });

  it("describes itself for the chip label", () => {
    expect(
      FilterByValueRange({ itemAttr: "beak", min: 10, max: 13 }).toStr()
    ).toBe("beak in [10, 13]");
  });
});

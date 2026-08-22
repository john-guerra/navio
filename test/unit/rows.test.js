import { describe, it, expect } from "vitest";
import { createRows } from "../../src/rows.js";

function buildCtx(overrides = {}) {
  return {
    nv: { DEBUG: false },
    data: [],
    id: "__seqId",
    selectedFlags: new Uint8Array(0),
    ...overrides,
  };
}

describe("idOf", () => {
  it("is the index itself under the default __seqId id", () => {
    const rows = createRows(buildCtx({ data: [{ k: "a" }, { k: "b" }] }));
    expect(rows.idOf(1)).toBe(1);
  });
  it("reads the configured id off the row otherwise", () => {
    const rows = createRows(
      buildCtx({ data: [{ k: "a" }, { k: "b" }], id: "k" })
    );
    expect(rows.idOf(1)).toBe("b");
  });
});

describe("attribAt", () => {
  const ctx = () =>
    buildCtx({
      data: [{ v: 10 }, { v: 20 }],
      selectedFlags: Uint8Array.from([0, 1]),
    });

  it("resolves __seqId to the index", () => {
    expect(createRows(ctx()).attribAt(1, "__seqId")).toBe(1);
  });
  // `selected` is a rendered column backed by a side table, not a row
  // property - reading it off the row gives undefined, which is how a
  // serialized brush once silently failed to rebuild (#88).
  it("resolves selected from the side table as a boolean", () => {
    const rows = createRows(ctx());
    expect(rows.attribAt(1, "selected")).toBe(true);
    expect(rows.attribAt(0, "selected")).toBe(false);
  });
  it("reads a real attribute off the row", () => {
    expect(createRows(ctx()).attribAt(0, "v")).toBe(10);
  });

  // __seqId is the index itself, never idOf(index). With a custom id the two
  // differ, and routing __seqId through the id would paint the "sequential
  // Index" column with the wrong values. Nothing else pins this: the other
  // attribAt tests all run under the default __seqId id, where the two are
  // indistinguishable.
  it("resolves __seqId to the index even under a custom id", () => {
    const rows = createRows(
      buildCtx({ data: [{ k: "a" }, { k: "b" }], id: "k" })
    );
    expect(rows.attribAt(1, "__seqId")).toBe(1);
    expect(rows.idOf(1)).toBe("b"); // the two genuinely differ here
  });
});

describe("indexOfRow", () => {
  it("passes a number straight through", () => {
    expect(createRows(buildCtx()).indexOfRow(3)).toBe(3);
  });
  it("returns undefined for a non-object", () => {
    expect(createRows(buildCtx()).indexOfRow("x")).toBeUndefined();
  });
  it("finds a row object by identity", () => {
    const a = { v: 1 },
      b = { v: 2 };
    const rows = createRows(buildCtx({ data: [a, b] }));
    expect(rows.indexOfRow(b)).toBe(1);
  });

  // The lazy WeakMap is built once over `data`. If it is not dropped when data
  // is replaced, every lookup after nv.data() resolves against the old rows.
  it("invalidates its cache when the data is replaced", () => {
    const a = { v: 1 };
    let data = [a];
    const ctx = buildCtx();
    Object.defineProperty(ctx, "data", { get: () => data });
    const rows = createRows(ctx);
    expect(rows.indexOfRow(a)).toBe(0);

    const b = { v: 2 };
    data = [b, a];
    rows.initForData();
    expect(rows.indexOfRow(a)).toBe(1);
    expect(rows.indexOfRow(b)).toBe(0);
  });
});

describe("idFromRow", () => {
  it("uses object identity under the default id", () => {
    const a = { v: 1 },
      b = { v: 2 };
    const rows = createRows(buildCtx({ data: [a, b] }));
    expect(rows.idFromRow(b)).toBe(1);
  });
  it("reads the configured id off a foreign object", () => {
    const rows = createRows(buildCtx({ data: [], id: "k" }));
    expect(rows.idFromRow({ k: "z" })).toBe("z");
  });
});

describe("assignIndexes / posAt", () => {
  it("round-trips a level's positions", () => {
    const rows = createRows(buildCtx({ data: [{}, {}, {}] }));
    rows.initForData();
    rows.assignIndexes([2, 0, 1], 1);
    expect(rows.posAt(2, 1)).toBe(0);
    expect(rows.posAt(0, 1)).toBe(1);
    expect(rows.posAt(1, 1)).toBe(2);
  });
  it("returns undefined for a level that has none", () => {
    expect(createRows(buildCtx()).posAt(0, 7)).toBeUndefined();
  });
});

describe("initForData / clear", () => {
  it("initForData seeds level 0 as identity over the data", () => {
    const rows = createRows(buildCtx({ data: [{}, {}, {}] }));
    rows.initForData();
    expect(rows.posAt(0, 0)).toBe(0);
    expect(rows.posAt(2, 0)).toBe(2);
  });
  it("clear drops every level", () => {
    const rows = createRows(buildCtx({ data: [{}, {}] }));
    rows.initForData();
    rows.clear();
    expect(rows.posAt(0, 0)).toBeUndefined();
  });
});

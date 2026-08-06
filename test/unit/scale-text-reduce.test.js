import { describe, it, expect } from "vitest";
import * as d3 from "d3";
import { scaleText } from "../../src/scales.js";

// scaleText colours a value by its first `digits` characters. updateColorDomains
// leans on that to avoid collecting one distinct entry per row value on large
// columns (#61): it reduces DURING the scan instead of after it. That is only
// sound if reducing before de-duplicating and de-duplicating before reducing
// produce the same colours - which is what these tests pin. If someone changes
// how scaleText derives its keys and forgets the scan, this is what catches it.

const make = () => scaleText("#eee", 1, d3.interpolateGreys);

/** Distinct values, the way updateColorDomains collects them. */
const distinct = (values, reduce) =>
  Array.from(new Set(reduce ? values.map(reduce) : values));

describe("scaleText reduce", () => {
  const rows = [
    "E12103A91226099A",
    "E4499",
    "A0001",
    "B7",
    "briefly",
    "Bravo",
    "apple",
  ];

  it("keeps only the first `digits` characters", () => {
    const s = make();
    expect(s.reduce("E12103A91226099A")).toBe("E");
    expect(s.digits(3) && s.reduce("E12103A9")).toBe("E12");
  });

  it("is a no-op on an already-reduced value", () => {
    const s = make();
    const once = rows.map(s.reduce);
    expect(once.map(s.reduce)).toEqual(once);
  });

  it("passes falsy values through so they cannot collapse into each other", () => {
    const s = make();
    expect(s.reduce(null)).toBe(null);
    expect(s.reduce(undefined)).toBe(undefined);
    expect(s.reduce("")).toBe("");
    expect(s.reduce(0)).toBe(0);
    expect(s.reduce(false)).toBe(false);
  });

  it("stringifies non-strings, as compute() does", () => {
    const s = make();
    expect(s.reduce(42)).toBe("4");
    expect(s.reduce(true)).toBe("t");
    // Whatever the value stringifies to, first character - not timezone- or
    // locale-dependent assumptions about what that string is.
    const d = new Date(0);
    expect(s.reduce(d)).toBe(String(d)[0]);
  });

  it("colours identically whether the domain is reduced before or after dedup", () => {
    const full = make();
    const folded = make();

    full.domain(distinct(rows)); // every distinct full value
    folded.domain(distinct(rows, folded.reduce)); // reduced during the scan

    expect(rows.map(full)).toEqual(rows.map(folded));
    // And genuinely colouring, not all one shade.
    expect(new Set(rows.map(full)).size).toBeGreaterThan(1);
  });

  it("holds when many distinct values share a first character", () => {
    const many = d3.range(500).map((i) => `E${i}`);
    const full = make();
    const folded = make();

    full.domain(distinct(many));
    folded.domain(distinct(many, folded.reduce));

    // 500 distinct values, one key. That collapse is the whole point.
    expect(distinct(many).length).toBe(500);
    expect(distinct(many, folded.reduce).length).toBe(1);
    expect(many.map(full)).toEqual(many.map(folded));
  });

  it("holds with nulls and empties mixed in", () => {
    const messy = ["alpha", null, "", "beta", undefined, "another", ""];
    const full = make();
    const folded = make();

    full.domain(distinct(messy));
    folded.domain(distinct(messy, folded.reduce));

    expect(messy.map(full)).toEqual(messy.map(folded));
  });
});

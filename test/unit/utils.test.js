import { describe, it, expect, beforeEach } from "vitest";
import {
  convertAttribToFn,
  getAttribsFromObjectAsFn,
  getAttribsFromObjectRecursive,
} from "../../src/utils.js";

describe("convertAttribToFn", () => {
  it("accesses a nested path given as an array of segments", () => {
    const fn = convertAttribToFn(["a", "b"]);
    expect(fn({ a: { b: 42 } })).toBe(42);
  });

  it("accesses a nested path given as a dotted string", () => {
    const fn = convertAttribToFn("a.b");
    expect(fn({ a: { b: "x" } })).toBe("x");
  });

  it("returns undefined instead of throwing when the path is missing", () => {
    const fn = convertAttribToFn(["a", "b"]);
    expect(fn({})).toBeUndefined();
    expect(fn({ a: null })).toBeUndefined();
    expect(fn(undefined)).toBeUndefined();
  });

  it("names the accessor after the joined path, which Navio shows as the column label", () => {
    expect(convertAttribToFn(["a", "b"]).name).toBe("a_b");
  });

  it("preserves falsy leaf values rather than collapsing them to undefined", () => {
    const fn = convertAttribToFn(["a", "b"]);
    expect(fn({ a: { b: 0 } })).toBe(0);
    expect(fn({ a: { b: "" } })).toBe("");
    expect(fn({ a: { b: false } })).toBe(false);
    expect(fn({ a: { b: null } })).toBeNull();
  });

  // Regression test for #71. Attribute names come from the keys of whatever
  // data a user loads, so they must never reach an evaluator.
  describe("does not execute code embedded in attribute names (#71)", () => {
    beforeEach(() => {
      delete globalThis.__navioPwned;
    });

    it("ignores a payload crafted to break out of the function-name position", () => {
      const evilKey = "a(){}, (globalThis.__navioPwned = true), function b";

      const fn = convertAttribToFn([evilKey]);

      expect(globalThis.__navioPwned).toBeUndefined();
      // And it still behaves as a plain accessor for that literal key.
      expect(fn({ [evilKey]: "value" })).toBe("value");
    });

    it("ignores a payload crafted to break out of the property-access position", () => {
      const evilKey = 'x"], (globalThis.__navioPwned = true), d["y';

      const fn = convertAttribToFn([evilKey]);

      expect(globalThis.__navioPwned).toBeUndefined();
      expect(fn({ [evilKey]: 7 })).toBe(7);
    });

    it("does not execute payloads reached through getAttribsFromObjectAsFn", () => {
      const evilKey = "a(){}, (globalThis.__navioPwned = true), function b";
      const data = { outer: { [evilKey]: 1 } };

      getAttribsFromObjectAsFn(data);

      expect(globalThis.__navioPwned).toBeUndefined();
    });
  });
});

describe("getAttribsFromObjectRecursive", () => {
  it("returns each attribute as a path array", () => {
    expect(getAttribsFromObjectRecursive({ a: 1, b: 2 })).toEqual([
      ["a"],
      ["b"],
    ]);
  });

  it("descends into nested objects", () => {
    expect(getAttribsFromObjectRecursive({ a: { b: 1 } })).toEqual([
      ["a", "b"],
    ]);
  });

  it("skips Navio's internal bookkeeping keys", () => {
    const attribs = getAttribsFromObjectRecursive({
      real: 1,
      __i: 0,
      __seqId: 0,
      selected: true,
    });
    expect(attribs).toEqual([["real"]]);
  });

  it("treats arrays and dates as leaves rather than recursing into them", () => {
    const attribs = getAttribsFromObjectRecursive({
      list: [1, 2],
      when: new Date(),
    });
    expect(attribs).toEqual([["list"], ["when"]]);
  });
});

describe("getAttribsFromObjectAsFn", () => {
  it("returns a bare key for top-level attributes and an accessor for nested ones", () => {
    const attribs = getAttribsFromObjectAsFn({ top: 1, outer: { inner: 2 } });

    expect(attribs[0]).toBe("top");
    expect(typeof attribs[1]).toBe("function");
    expect(attribs[1]({ outer: { inner: 2 } })).toBe(2);
  });
});

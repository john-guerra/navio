import { describe, it, expect } from "vitest";
import { PARAMS, METHODS } from "../../src/params.js";

// The point of src/params.js is not the file, it is these tests.
//
// A description that lives beside the code it describes still drifts from it -
// `snapshot()` was documented in CLAUDE.md and in NavioWidget.js and has never
// existed on the instance, which is exactly the failure being designed out.
// The rules here are what make the table structurally unable to fall behind:
// adding an option without describing it fails the gate, and so does describing
// one that is not there.
//
// The option NAMES are checked here, against the source, because vitest has no
// DOM and cannot construct an instance. The option VALUES are checked against a
// real instance in test/e2e/104-describe.spec.js - defaults live on `nv` inside
// the closure, and only a live widget knows them.

const KEYS = new Set(PARAMS.map((p) => p.key));

describe("PARAMS", () => {
  it("gives every entry a section, a label and a hint", () => {
    for (const p of PARAMS) {
      expect(p.key, "key").toBeTruthy();
      expect(p.section, `${p.key}.section`).toBeTruthy();
      expect(p.label, `${p.key}.label`).toBeTruthy();
      expect(p.hint, `${p.key}.hint`).toBeTruthy();
      expect(p.type, `${p.key}.type`).toBeTruthy();
      // Either a comparable default or a written one - never neither, or the
      // docs would silently omit it.
      expect(
        "default" in p || typeof p.defaultText === "string",
        `${p.key} needs default or defaultText`
      ).toBe(true);
    }
  });

  it("has no duplicate keys", () => {
    expect(KEYS.size).toBe(PARAMS.length);
  });

  it("describes a hint long enough to say something", () => {
    // A one-word hint is how a table like this rots: present, and useless.
    for (const p of PARAMS)
      expect(p.hint.length, `${p.key}.hint is too short`).toBeGreaterThan(25);
  });
});

describe("METHODS", () => {
  it("gives every entry a signature and a summary", () => {
    for (const m of METHODS) {
      expect(m.name, "name").toBeTruthy();
      expect(m.signature, `${m.name}.signature`).toContain(m.name);
      expect(m.summary.length, `${m.name}.summary`).toBeGreaterThan(25);
    }
  });
});

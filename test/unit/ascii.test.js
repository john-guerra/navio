import { describe, it, expect } from "vitest";
import { escapeNonAscii } from "../../build/ascii.js";

// Unit tests for the bundle's ASCII-escaping (#80). The escaped form has to be
// read back by JS as the identical character, or Navio's filter chips and sort
// arrows render as mojibake.

describe("escapeNonAscii", () => {
  it("leaves pure ASCII untouched", () => {
    const s = `const x = "hello world"; // 123 !@#$%^&*()`;
    expect(escapeNonAscii(s)).toBe(s);
  });

  it("escapes a BMP glyph and round-trips to the same character", () => {
    expect(escapeNonAscii("Ⓧ")).toBe("\\u24CD");
    expect(JSON.parse(`"${escapeNonAscii("Ⓧ")}"`)).toBe("Ⓧ");
  });

  it("escapes the sort arrows Navio puts in column headers", () => {
    expect(escapeNonAscii("↑")).toBe("\\u2191");
    expect(escapeNonAscii("↓")).toBe("\\u2193");
    expect(JSON.parse(`"${escapeNonAscii("rank ↑")}"`)).toBe("rank ↑");
  });

  it("escapes astral characters as a surrogate pair, not a single code point", () => {
    // Matching code units rather than code points is deliberate: \\u{1F680} is
    // ES2015+ syntax, whereas a surrogate pair is understood everywhere.
    const escaped = escapeNonAscii("🚀");
    expect(escaped).toBe("\\uD83D\\uDE80");
    expect(JSON.parse(`"${escaped}"`)).toBe("🚀");
  });

  it("preserves surrounding syntax, escaping only the characters that need it", () => {
    expect(escapeNonAscii('"Ⓧ " + f.toStr()')).toBe('"\\u24CD " + f.toStr()');
  });

  it("round-trips a mixed string exactly", () => {
    const original = "Ⓧ rank ↑ 🚀 done";
    expect(JSON.parse(`"${escapeNonAscii(original)}"`)).toBe(original);
  });

  it("pads short code points to four hex digits", () => {
    // U+00F3, as in the copyright line's "Gómez".
    expect(escapeNonAscii("ó")).toBe("\\u00F3");
  });
});

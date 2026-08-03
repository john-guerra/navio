/**
 * Rollup plugin: escape non-ASCII characters in string and template literals so
 * the bundle is byte-safe regardless of how a host page declares its charset.
 * Navio ships literal glyphs (the Ⓧ on filter chips, arrows on sorted headers,
 * emoji in debug traces), so without this a page served as latin-1 mangles them.
 *
 * Replaces rollup-plugin-ascii, which did the same thing but parsed the source
 * with `acorn.parse(code, {ecmaVersion: 6})`. That silently capped all of src/
 * at ES2015 - object spread and optional catch binding failed the build with a
 * bare SyntaxError naming no rule, while tests stayed green because Vitest runs
 * the source directly. See #80.
 *
 * This uses Rollup's own parser via `this.parse`, so the supported syntax is
 * whatever Rollup supports. It also escapes template literals, which the old
 * plugin missed entirely.
 */

/**
 * Escape every non-ASCII character as \uXXXX.
 *
 * Deliberately matches on code units rather than code points (no `u` flag), so
 * astral characters become a surrogate pair of escapes - "🚀" becomes
 * "🚀" - which is what the previous implementation produced and what
 * every JS engine reads back identically.
 */
export function escapeNonAscii(text) {
  return text.replace(
    /[^\x00-\x7F]/g,
    (ch) => "\\u" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")
  );
}

/** Minimal AST walk; avoids pulling in estree-walker for ~10 lines of work. */
function walk(node, visit) {
  if (!node || typeof node.type !== "string") return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visit);
    } else if (value && typeof value.type === "string") {
      walk(value, visit);
    }
  }
}

export default function ascii() {
  return {
    name: "ascii",
    transform(code, id) {
      if (!id.endsWith(".js") || !/[^\x00-\x7F]/.test(code)) return null;

      const ast = this.parse(code);
      const edits = [];

      walk(ast, (node) => {
        const isString =
          node.type === "Literal" && typeof node.value === "string";
        // TemplateElement spans only the literal text between the backticks and
        // any ${...}, so rewriting it cannot disturb interpolation.
        const isTemplateChunk = node.type === "TemplateElement";
        if (!isString && !isTemplateChunk) return;

        const raw = code.slice(node.start, node.end);
        const escaped = escapeNonAscii(raw);
        if (escaped !== raw) {
          edits.push({ start: node.start, end: node.end, escaped });
        }
      });

      if (!edits.length) return null;

      // Apply back to front so earlier offsets stay valid.
      edits.sort((a, b) => b.start - a.start);
      let out = code;
      for (const { start, end, escaped } of edits) {
        out = out.slice(0, start) + escaped + out.slice(end);
      }
      return { code: out, map: null };
    },
  };
}

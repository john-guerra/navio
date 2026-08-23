import { getAttrib } from "./utils.js";

/**
 * Row identity and position.
 *
 * Owns `posByLevel` and `rowIndex` outright: an AST scan of src/navio.js found
 * no writer of either outside this group and the two lifecycle sites, so they
 * move in rather than being passed in. `selectedFlags` is the opposite case -
 * applyFilters and deleteSubsequentLevels write it - so it stays a read.
 *
 * `data`, `id` and `selectedFlags` all cross as GETTERS: each is reassigned on
 * nv.data() and nv.destroy(), and `id` also by nv.id(). CLAUDE.md's "a module
 * gets GETTERS, not values" landmine is about exactly this. `nv` is never
 * rebound and is a plain value.
 *
 * navio.js's half - that it supplies these as getters rather than values - is
 * pinned end-to-end by three specs: dropping `data` to a plain value fails 228
 * e2e tests, `id` fails test/e2e/60-reactive-widget.spec.js:98, and
 * `selectedFlags` fails test/e2e/92-options.spec.js:238. This module's own
 * half - that it re-reads `ctx.x` per call rather than capturing at
 * construction - is pinned only for `indexOfRow`, by the cache-invalidation
 * test below: the other unit tests build `ctx` from plain values, so capping
 * `id` or `selectedFlags` at construction here would still pass all of them.
 *
 * See docs/ai/2026-08-22-navio-row-access-design.md.
 *
 * @param {object} ctx - { nv, get data(), get id(), get selectedFlags() }
 */
export function createRows(ctx) {
  // One Int32Array per level, allocated on first use, rather than an array
  // object hanging off every row. See #88.
  let posByLevel = [];
  // Lazy identity index over `data`, built on first object lookup and dropped
  // whenever the data is replaced.
  let rowIndex = null;

  /**
   * The id value for a row index.
   *
   * The default id used to be a `__seqId` property written onto every row -
   * but `data` is never reordered (only `dataIs[level]` is), so it always
   * equalled the row's index. It is now derived rather than stored. A custom
   * id set via nv.id() points at one of the caller's own fields and is read
   * as before.
   */
  function idOf(index) {
    return ctx.id === "__seqId"
      ? index
      : getAttrib(ctx.data[index], ctx.id, ctx.nv.DEBUG);
  }

  /**
   * An attribute value by row INDEX. `__seqId` is derived from the index rather
   * than stored on the row (#88), so it needs resolving here.
   *
   * `__seqId` is the index itself, NOT `idOf(index)`. It used to be assigned as
   * `d.__seqId = i` regardless of any custom id, and it is drawn as the
   * "sequential Index" column - the visual cue that the data is still in its
   * original order. Routing it through a caller-supplied id would paint that
   * column with the wrong values.
   */
  function attribAt(index, attrib) {
    if (attrib === "__seqId") return index;
    // Also a drawn column backed by a side table, so it needs resolving here
    // for the same reason - otherwise sorting by it compares undefined to
    // undefined and does nothing.
    if (attrib === "selected") return !!ctx.selectedFlags[index];
    return getAttrib(ctx.data[index], attrib, ctx.nv.DEBUG);
  }

  function posAt(index, level) {
    const p = posByLevel[level];
    return p ? p[index] : undefined;
  }

  /**
   * Index of a row within `data`. Accepts an index unchanged, so internal
   * callers (which already have one) pay nothing.
   *
   * The map itself is not free at a million rows - see the laziness
   * rationale on `rowIndex` above.
   */
  function indexOfRow(rowOrIndex) {
    if (typeof rowOrIndex === "number") return rowOrIndex;
    if (!rowOrIndex || typeof rowOrIndex !== "object") return undefined;
    if (!rowIndex) {
      rowIndex = new WeakMap();
      const data = ctx.data;
      for (let i = 0; i < data.length; i++) rowIndex.set(data[i], i);
    }
    return rowIndex.get(rowOrIndex);
  }

  /**
   * The identity value of a row, however this instance identifies rows.
   *
   * A custom id lives on the row, so a foreign object resolves fine. The
   * default id is the row's index into `data`, which only an object we own
   * can supply - hence the identity lookup.
   */
  function idFromRow(row) {
    return ctx.id !== "__seqId"
      ? getAttrib(row, ctx.id, ctx.nv.DEBUG)
      : indexOfRow(row);
  }

  function assignIndexes(dataIsToUpdate, level) {
    if (ctx.nv.DEBUG) console.log("Assigning indexes ", level);
    if (!posByLevel[level]) posByLevel[level] = new Int32Array(ctx.data.length);
    for (let j = 0; j < dataIsToUpdate.length; j++) {
      posByLevel[level][dataIsToUpdate[j]] = j;
    }
  }

  /** Seed level 0 as the identity over the current data. Call AFTER `data`
   * has been reassigned - it reads the new length. */
  function initForData() {
    posByLevel = [
      Int32Array.from({ length: ctx.data.length }, (_unused, i) => i),
    ];
    rowIndex = null;
  }

  /** Drop everything. Teardown only. */
  function clear() {
    posByLevel = [];
    rowIndex = null;
  }

  return {
    idOf,
    attribAt,
    posAt,
    indexOfRow,
    idFromRow,
    assignIndexes,
    initForData,
    clear,
  };
}

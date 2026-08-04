export function FilterByRange(opts) {
  const first = opts.first;
  const last = opts.last;
  const level = opts.level;
  const itemAttr = opts.itemAttr;
  const getAttrib = opts.getAttrib || ((d) => d[itemAttr]);
  const getAttribName =
    opts.getAttribName ||
    ((attrib) => (typeof attrib === "function" ? attrib.name : attrib));

  // A closure variable rather than a property on the returned object: rollup
  // folds `obj.flag ? a : b` away when it can see the property initialised to a
  // literal and never reassigned inside the module, which silently deleted this
  // branch from the bundle while the source looked correct.
  let staleSort = false;

  /** Called by navio when this filter's level is re-sorted (#82). */
  function markSortStale() {
    staleSort = true;
  }

  function filter(d) {
    return d.__i[level] >= first.__i[level] && d.__i[level] <= last.__i[level];
  }

  function toStr() {
    let firstVal = `${getAttrib(first, itemAttr)}`,
      lastVal = `${getAttrib(last, itemAttr)}`;
    firstVal = typeof firstVal === typeof "" ? firstVal.slice(0, 5) : firstVal;
    lastVal = typeof lastVal === typeof "" ? lastVal.slice(0, 5) : lastVal;
    const label = `${getAttribName(itemAttr)} range including ${firstVal} to ${lastVal}`;
    // A brush is a band of rows in the ordering that was on screen at the time.
    // Once the level is re-sorted the rows stay selected but no longer form a
    // visible range, so say so rather than describing a range nobody can see.
    return staleSort ? `${label} (re-sorted since)` : label;
  }

  // Records the RAW boundary values, never `__i[level]`. The runtime predicate
  // compares position indexes, which only mean anything under the sort that was
  // active when the user brushed - so the sort context is captured alongside,
  // and rehydration re-resolves the boundaries by value (see filterFromValue).
  function toValue({
    sortAttrib = null,
    sortDesc = false,
    id = "__seqId",
  } = {}) {
    return {
      type: "range",
      attrib: getAttribName(itemAttr),
      first: getAttrib(first, itemAttr),
      last: getAttrib(last, itemAttr),
      firstId: first ? first[id] : undefined,
      lastId: last ? last[id] : undefined,
      sortAttrib,
      sortDesc,
    };
  }

  /** The rows the brush was dragged between, for redrawing it (#60). */
  function bounds() {
    return { first, last };
  }

  return {
    filter,
    toStr,
    toValue,
    markSortStale,
    bounds,
    type: "range",
  };
}

export function FilterByValue(opts) {
  const itemAttr = opts.itemAttr;
  const sel = opts.sel;
  const getAttrib = opts.getAttrib || ((d) => d[itemAttr]);
  const getAttribName =
    opts.getAttribName ||
    ((attrib) => (typeof attrib === "function" ? attrib.name : attrib));

  function filter(d) {
    return getAttrib(d, itemAttr) === getAttrib(sel, itemAttr);
  }

  function toStr() {
    return `${getAttribName(itemAttr)} == ${getAttrib(sel, itemAttr)}`;
  }

  function toValue() {
    return {
      type: "value",
      attrib: getAttribName(itemAttr),
      value: getAttrib(sel, itemAttr),
    };
  }

  return {
    filter,
    toStr,
    toValue,
    type: "value",
  };
}

export function FilterByValueDifferent(opts) {
  const itemAttr = opts.itemAttr;
  const sel = opts.sel;
  const getAttrib = opts.getAttrib || ((d) => d[itemAttr]);
  const getAttribName =
    opts.getAttribName ||
    ((attrib) => (typeof attrib === "function" ? attrib.name : attrib));

  function filter(d) {
    return getAttrib(d, itemAttr) !== getAttrib(sel, itemAttr);
  }

  function toStr() {
    return `${getAttribName(itemAttr)} != ${getAttrib(sel, itemAttr)}`;
  }

  function toValue() {
    return {
      type: "negativeValue",
      attrib: getAttribName(itemAttr),
      value: getAttrib(sel, itemAttr),
    };
  }

  return {
    filter,
    toStr,
    toValue,
    type: "negativeValue",
  };
}

/**
 * A range over raw attribute VALUES - "beak between 10 and 13" - as opposed to
 * FilterByRange, which is a band of positions in the level's current ordering.
 *
 * Navio's own brush produces the positional kind, because dragging selects
 * whatever rows fall under the pixels. This one is the semantic counterpart:
 * it is what an external widget means by a range facet, it survives re-sorting
 * and replaying onto another instance, and it is expressible without reference
 * to any ordering at all. Bounds are inclusive, matching the usual convention
 * for faceted range inputs. See #60.
 */
export function FilterByValueRange(opts) {
  const itemAttr = opts.itemAttr;
  const min = opts.min;
  const max = opts.max;
  const getAttrib = opts.getAttrib || ((d) => d[itemAttr]);
  const getAttribName =
    opts.getAttribName ||
    ((attrib) => (typeof attrib === "function" ? attrib.name : attrib));

  function filter(d) {
    const v = getAttrib(d, itemAttr);
    return v >= min && v <= max;
  }

  function toStr() {
    return `${getAttribName(itemAttr)} in [${min}, ${max}]`;
  }

  function toValue() {
    return {
      type: "valueRange",
      attrib: getAttribName(itemAttr),
      min,
      max,
    };
  }

  return {
    filter,
    toStr,
    toValue,
    type: "valueRange",
  };
}

export function FilterByRangeNegative(opts) {
  const first = opts.first;
  const last = opts.last;
  const level = opts.level;
  const itemAttr = opts.itemAttr;
  const getAttrib = opts.getAttrib || ((d) => d[itemAttr]);
  const getAttribName =
    opts.getAttribName ||
    ((attrib) => (typeof attrib === "function" ? attrib.name : attrib));

  // A closure variable rather than a property on the returned object: rollup
  // folds `obj.flag ? a : b` away when it can see the property initialised to a
  // literal and never reassigned inside the module, which silently deleted this
  // branch from the bundle while the source looked correct.
  let staleSort = false;

  /** Called by navio when this filter's level is re-sorted (#82). */
  function markSortStale() {
    staleSort = true;
  }

  function filter(d) {
    return d.__i[level] < first.__i[level] || d.__i[level] > last.__i[level];
  }

  function toStr() {
    let firstVal = `${getAttrib(first, itemAttr)}`,
      lastVal = `${getAttrib(last, itemAttr)}`;
    firstVal = typeof firstVal === typeof "" ? firstVal.slice(0, 5) : firstVal;
    lastVal = typeof lastVal === typeof "" ? lastVal.slice(0, 5) : lastVal;
    const label = `${getAttribName(itemAttr)} range excluding ${firstVal} to ${lastVal}`;
    // See the note in FilterByRange.toStr.
    return staleSort ? `${label} (re-sorted since)` : label;
  }

  // Records the RAW boundary values, never `__i[level]`. The runtime predicate
  // compares position indexes, which only mean anything under the sort that was
  // active when the user brushed - so the sort context is captured alongside,
  // and rehydration re-resolves the boundaries by value (see filterFromValue).
  function toValue({
    sortAttrib = null,
    sortDesc = false,
    id = "__seqId",
  } = {}) {
    return {
      type: "negativeRange",
      attrib: getAttribName(itemAttr),
      first: getAttrib(first, itemAttr),
      last: getAttrib(last, itemAttr),
      firstId: first ? first[id] : undefined,
      lastId: last ? last[id] : undefined,
      sortAttrib,
      sortDesc,
    };
  }

  /** The rows the brush was dragged between, for redrawing it (#60). */
  function bounds() {
    return { first, last };
  }

  return {
    filter,
    toStr,
    toValue,
    markSortStale,
    bounds,
    type: "negativeRange",
  };
}

/**
 * Rebuilds a filter from the plain object produced by `toValue()`.
 *
 * Boundaries are resolved by VALUE against the rows currently present, not by
 * object identity or by the `__i[level]` position the filter was originally
 * built from - that index is meaningless on another instance, another sort, or
 * after the data changes. When an exact boundary no longer exists the nearest
 * comparable value is used and the result is marked `approximate`, which is
 * strictly better than silently selecting the wrong rows.
 *
 * Returns null when the filter cannot be reconstructed (unknown type, missing
 * attribute, unresolvable boundaries) so the caller can skip it and report why.
 */
export function filterFromValue(value, ctx = {}) {
  if (!value || typeof value !== "object" || !value.type) return null;

  const {
    level = 0,
    rows = [],
    resolveAttrib = (name) => name,
    getAttrib,
    getAttribName,
  } = ctx;

  const itemAttr = resolveAttrib(value.attrib);
  if (itemAttr === undefined || itemAttr === null) return null;

  const read = getAttrib || ((d, a) => d[a]);

  // The attribute has to exist on the data, or every predicate would silently
  // compare undefined to undefined and match everything.
  const known = rows.some((r) => read(r, itemAttr) !== undefined);
  if (rows.length && !known) return null;

  const common = { itemAttr, getAttrib, getAttribName };

  if (value.type === "valueRange") {
    return FilterByValueRange({ ...common, min: value.min, max: value.max });
  }

  if (value.type === "value" || value.type === "negativeValue") {
    // A synthetic row is enough: both predicates only ever read itemAttr off it.
    const sel = { [value.attrib]: value.value };
    const make =
      value.type === "value" ? FilterByValue : FilterByValueDifferent;
    return make({ ...common, sel });
  }

  if (value.type === "range" || value.type === "negativeRange") {
    const first = resolveBoundary(
      rows,
      value.first,
      value.firstId,
      read,
      itemAttr,
      "ceil"
    );
    const last = resolveBoundary(
      rows,
      value.last,
      value.lastId,
      read,
      itemAttr,
      "floor"
    );
    if (!first.row || !last.row) return null;

    // The runtime predicate assumes first.__i <= last.__i. Under a descending
    // sort the lower VALUE sits at the higher position, so order the resolved
    // rows by position rather than trusting which one was named "first".
    let lo = first.row,
      hi = last.row;
    if (
      lo.__i &&
      hi.__i &&
      lo.__i[level] !== undefined &&
      hi.__i[level] !== undefined &&
      lo.__i[level] > hi.__i[level]
    ) {
      [lo, hi] = [hi, lo];
    }

    const make = value.type === "range" ? FilterByRange : FilterByRangeNegative;
    const filter = make({ ...common, level, first: lo, last: hi });
    if (first.approximate || last.approximate) filter.approximate = true;
    return filter;
  }

  return null;
}

/**
 * Resolves a serialized boundary back to a row: exact match on (value, id),
 * then on value alone, then the nearest usable value.
 *
 * `side` keeps an approximate match from WIDENING the selection: a missing
 * lower bound snaps up to the smallest value still inside the range, and a
 * missing upper bound snaps down. Snapping outward would silently include rows
 * the user never selected.
 */
function resolveBoundary(rows, wanted, wantedId, read, itemAttr, side) {
  if (wantedId !== undefined) {
    const exact = rows.find(
      (r) => r.__seqId === wantedId && read(r, itemAttr) === wanted
    );
    if (exact) return { row: exact, approximate: false };
  }

  const byValue = rows.find((r) => read(r, itemAttr) === wanted);
  if (byValue) return { row: byValue, approximate: false };

  // Only numbers and dates have a meaningful ordering here; for anything else a
  // guess would be arbitrary, so report failure instead of inventing one.
  const num = (v) =>
    v instanceof Date ? v.getTime() : typeof v === "number" ? v : null;
  const target = num(wanted);
  if (target === null) return { row: null };

  let inward = null,
    inwardD = Infinity,
    nearest = null,
    nearestD = Infinity;

  for (const r of rows) {
    const v = num(read(r, itemAttr));
    if (v === null) continue;
    const d = Math.abs(v - target);
    if (d < nearestD) {
      nearestD = d;
      nearest = r;
    }
    // "ceil" wants the smallest value >= target; "floor" the largest <= target.
    const isInward = side === "ceil" ? v >= target : v <= target;
    if (isInward && d < inwardD) {
      inwardD = d;
      inward = r;
    }
  }

  const row = inward || nearest;
  return row ? { row, approximate: true } : { row: null };
}

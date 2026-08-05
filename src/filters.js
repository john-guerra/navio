export function FilterByRange(opts) {
  // Boundaries are INDICES into `data`, and positions come from a side table.
  // Navio used to keep an `__i` array on every row; at a million rows that was
  // 214 MB of per-row array objects. See #88.
  const firstIndex = opts.firstIndex;
  const lastIndex = opts.lastIndex;
  const level = opts.level;
  const itemAttr = opts.itemAttr;
  const getPos = opts.getPos;
  const getRow = opts.getRow || ((i) => i);
  const first = getRow(firstIndex);
  const last = getRow(lastIndex);
  const getAttrib = opts.getAttrib || ((d) => d[itemAttr]);
  // Reads an attribute by row INDEX. Needed because the default itemAttr is
  // "__seqId", which is derived from the index rather than stored on the row
  // (#88), so a plain row lookup would return undefined.
  const attribAt =
    opts.getAttribAt || ((i, attrib) => getAttrib(getRow(i), attrib));
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

  function filter(_row, index) {
    const p = getPos(index, level);
    return p >= getPos(firstIndex, level) && p <= getPos(lastIndex, level);
  }

  function toStr() {
    let firstVal = `${attribAt(firstIndex, itemAttr)}`,
      lastVal = `${attribAt(lastIndex, itemAttr)}`;
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
      first: attribAt(firstIndex, itemAttr),
      last: attribAt(lastIndex, itemAttr),
      firstId: attribAt(firstIndex, id),
      lastId: attribAt(lastIndex, id),
      sortAttrib,
      sortDesc,
    };
  }

  /** Where the brush was dragged, for redrawing it (#60). */
  function bounds() {
    return { first, last, firstIndex, lastIndex };
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
  // See FilterByRange: indices plus a side table, not `__i` on the row.
  const firstIndex = opts.firstIndex;
  const lastIndex = opts.lastIndex;
  const level = opts.level;
  const itemAttr = opts.itemAttr;
  const getPos = opts.getPos;
  const getRow = opts.getRow || ((i) => i);
  const first = getRow(firstIndex);
  const last = getRow(lastIndex);
  const getAttrib = opts.getAttrib || ((d) => d[itemAttr]);
  // Reads an attribute by row INDEX. Needed because the default itemAttr is
  // "__seqId", which is derived from the index rather than stored on the row
  // (#88), so a plain row lookup would return undefined.
  const attribAt =
    opts.getAttribAt || ((i, attrib) => getAttrib(getRow(i), attrib));
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

  function filter(_row, index) {
    const p = getPos(index, level);
    return p < getPos(firstIndex, level) || p > getPos(lastIndex, level);
  }

  function toStr() {
    let firstVal = `${attribAt(firstIndex, itemAttr)}`,
      lastVal = `${attribAt(lastIndex, itemAttr)}`;
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
      first: attribAt(firstIndex, itemAttr),
      last: attribAt(lastIndex, itemAttr),
      firstId: attribAt(firstIndex, id),
      lastId: attribAt(lastIndex, id),
      sortAttrib,
      sortDesc,
    };
  }

  /** Where the brush was dragged, for redrawing it (#60). */
  function bounds() {
    return { first, last, firstIndex, lastIndex };
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
 * An explicit set of rows, named by nv.id().
 *
 * This is what an *external* selection means - the checked rows of a table, a
 * peer widget's brush - and it is the one filter that is not a predicate over
 * some attribute. Membership is decided against the ids, so it survives
 * re-sorting and replays onto another instance holding the same ids, unlike a
 * positional range. See #93.
 */
export function FilterByIds(opts) {
  const wanted = opts.ids instanceof Set ? opts.ids : new Set(opts.ids || []);
  // Ids are read by row INDEX for the same reason the range filters do it: the
  // default id is "__seqId", which is derived from the index rather than
  // stored on the row (#88).
  const getId = opts.getId || ((i) => i);

  function filter(_row, index) {
    return wanted.has(getId(index));
  }

  function toStr() {
    return `selection of ${wanted.size} row${wanted.size === 1 ? "" : "s"}`;
  }

  function toValue() {
    return { type: "ids", ids: Array.from(wanted) };
  }

  return {
    filter,
    toStr,
    toValue,
    type: "ids",
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
    // Indices into `data`, plus the accessors to reach a row and its position.
    // Rows are no longer materialized just to be searched. See #88.
    indices = [],
    getRow = (i) => i,
    getPos,
    getAttribAt,
    resolveAttrib = (name) => name,
    getAttrib,
    getAttribName,
    getId,
  } = ctx;

  // Handled before the attribute is resolved: an id set names rows directly and
  // carries no attribute at all, so the check below would reject it.
  if (value.type === "ids") {
    if (!Array.isArray(value.ids) && !(value.ids instanceof Set)) return null;
    return FilterByIds({ ids: value.ids, getId });
  }

  const itemAttr = resolveAttrib(value.attrib);
  if (itemAttr === undefined || itemAttr === null) return null;

  const read = getAttrib || ((d, a) => d[a]);
  // Read by INDEX, not by row: derived attributes such as "__seqId" are no
  // longer stored on the row, so `row[attrib]` would be undefined for them and
  // every boundary lookup below would fail. See #88.
  const readAt = getAttribAt || ((i, a) => read(getRow(i), a));

  // The attribute has to exist on the data, or every predicate would silently
  // compare undefined to undefined and match everything.
  const known = indices.some((i) => readAt(i, itemAttr) !== undefined);
  if (indices.length && !known) return null;

  const common = { itemAttr, getAttrib, getAttribName, getAttribAt };

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
      indices,
      value.first,
      value.firstId,
      readAt,
      itemAttr,
      "ceil"
    );
    const last = resolveBoundary(
      indices,
      value.last,
      value.lastId,
      readAt,
      itemAttr,
      "floor"
    );
    if (first.index === undefined || last.index === undefined) return null;

    // The runtime predicate assumes first sits at or before last. Under a
    // descending sort the lower VALUE is at the higher position, so order the
    // resolved boundaries by position rather than trusting which was named
    // "first".
    let lo = first.index,
      hi = last.index;
    if (getPos && getPos(lo, level) > getPos(hi, level)) {
      [lo, hi] = [hi, lo];
    }

    const make = value.type === "range" ? FilterByRange : FilterByRangeNegative;
    const filter = make({
      ...common,
      level,
      firstIndex: lo,
      lastIndex: hi,
      getPos,
      getRow,
    });
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
function resolveBoundary(indices, wanted, wantedId, readAt, itemAttr, side) {
  // With no custom id, the serialized id IS the row's index into `data`, so
  // matching on it is a plain equality check.
  if (wantedId !== undefined) {
    const exact = indices.find(
      (i) => i === wantedId && readAt(i, itemAttr) === wanted
    );
    if (exact !== undefined) return { index: exact, approximate: false };
  }

  const byValue = indices.find((i) => readAt(i, itemAttr) === wanted);
  if (byValue !== undefined) return { index: byValue, approximate: false };

  // Only numbers and dates have a meaningful ordering here; for anything else a
  // guess would be arbitrary, so report failure instead of inventing one.
  const num = (v) =>
    v instanceof Date ? v.getTime() : typeof v === "number" ? v : null;
  const target = num(wanted);
  if (target === null) return { index: undefined };

  let inward,
    inwardD = Infinity,
    nearest,
    nearestD = Infinity;

  for (const i of indices) {
    const v = num(readAt(i, itemAttr));
    if (v === null) continue;
    const d = Math.abs(v - target);
    if (d < nearestD) {
      nearestD = d;
      nearest = i;
    }
    // "ceil" wants the smallest value >= target; "floor" the largest <= target.
    const isInward = side === "ceil" ? v >= target : v <= target;
    if (isInward && d < inwardD) {
      inwardD = d;
      inward = i;
    }
  }

  const index = inward !== undefined ? inward : nearest;
  return index !== undefined
    ? { index, approximate: true }
    : { index: undefined };
}

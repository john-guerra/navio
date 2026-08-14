import * as d3 from "d3";
import ReactiveWidget from "reactive-widget-helper";
import navio from "./navio.js";

/**
 * Navio as a Reactive Widget (https://reactivewidgets.org).
 *
 * Returns an HTMLElement whose `.value` is the array of SELECTED ROWS, and
 * which emits an `input` event whenever the selection changes. That is the
 * contract every reactive widget shares - and what Observable's `viewof` reads,
 * so this works directly:
 *
 *     viewof selected = navio(data, { height: 400 })
 *     Table(selected)                       // the rows, as you would expect
 *     Inputs.bind(Inputs.table(data), viewof selected)
 *
 * Every nv.* option is accepted here; see nv.getOptions() for the full set.
 * `value`, `filters`, `attribs` and `autodetect` are the widget's own,
 * everything else is passed to navio() and applied before construction.
 *
 * The multi-level FILTER CHAIN - which is what Navio actually manipulates, and
 * the only form that replays faithfully onto another instance - stays available
 * through getFilters()/setFilters(). Assigning `.value` a
 * `{ filters }` wrapper, or a chain (an array of arrays), applies it as filters;
 * anything else is read as rows. Rows are matched by nv.id(), so a bind against
 * a peer over the same data round-trips. See issues #60 and #93.
 *
 * The existing `navio(selection, height)` API is untouched; this is additive.
 */
export default function NavioWidget(data, options = {}) {
  const { value, filters, attribs, autodetect = true, ...rest } = options;

  const container = document.createElement("div");
  // Everything else goes to the constructor rather than being assigned
  // afterwards. That is not cosmetic: options like tooltipBgColor and
  // showSelectedAttrib are read once, during construction or inside data(), so
  // assigning them after navio() returned only worked by accident - and not at
  // all when no data was supplied. navio() also warns about unknown keys, so a
  // typo is now visible instead of silently doing nothing.
  const nv = navio(d3.select(container), rest);

  if (data && data.length) {
    nv.data(data);
    if (autodetect) nv.addAllAttribs(attribs);
  }

  // Applying a value must not echo back out as a new user change. The helper
  // dispatches `input` on the element and then listens for it itself, so every
  // setValue() lands back in showValue() one tick later - with rows as the
  // value that would rebuild the user's drill-down as a flat id set. Comparing
  // by identity is enough: getSelected() returns a fresh array each time, so
  // only the array we just emitted can be the echo of our own change.
  let applying = false;
  let lastEmitted;

  /** Is this a filter chain rather than a list of rows? */
  const isChain = (v) =>
    v && typeof v === "object" && !Array.isArray(v) && Array.isArray(v.filters)
      ? true
      : Array.isArray(v) && v.length > 0 && Array.isArray(v[0]);

  /**
   * Bring `.value` back in line with the selection, WITHOUT dispatching.
   * Assigning `.value` must stay silent - that is what keeps a bind from
   * looping - but the value it settles on still has to be the rows, not the
   * chain the caller happened to hand us.
   */
  function syncValue() {
    applying = true;
    try {
      lastEmitted = nv.getSelected();
      widget.value = lastEmitted;
    } finally {
      applying = false;
    }
  }

  function showValue() {
    const v = widget.value;
    if (applying || v === lastEmitted) return;
    applying = true;
    try {
      if (isChain(v)) nv.setFilters(Array.isArray(v) ? v : v.filters);
      else if (Array.isArray(v)) nv.setSelectedRows(v);
    } finally {
      applying = false;
    }
    syncValue();
  }

  const widget = ReactiveWidget(container, {
    // Nothing filtered yet means everything is selected. Starting at [] told
    // every downstream cell the user had selected no rows at all.
    value: value === undefined ? nv.getSelected() : value,
    showValue,
  });

  // User-driven changes emit; programmatic ones already returned above.
  nv.onChange(() => {
    if (applying) return;
    lastEmitted = nv.getSelected();
    widget.setValue(lastEmitted);
  });

  /** The rows surviving every level - the same array as `.value`. */
  widget.getSelected = () => nv.getSelected();
  widget.getVisible = () => nv.getVisible();

  /**
   * The multi-level filter chain. This, not the row list, is what survives a
   * hop to another instance: rows are projections through this instance's own
   * arrays, whereas the chain describes how they were chosen.
   */
  widget.getFilters = () => nv.getFilters();
  widget.setFilters = (f) => {
    widget.value = { filters: f };
    return widget;
  };

  /**
   * One-shot, non-reactive read of both halves of the state, for when you want
   * the filters and the rows together without wiring two channels.
   */
  widget.snapshot = () => ({
    filters: nv.getFilters(),
    selection: nv.getSelected(),
  });

  /** Escape hatch to the underlying instance for anything not surfaced here. */
  widget.navio = nv;

  widget.destroy = () => {
    nv.destroy();
    return widget;
  };

  // Render whatever initial state was supplied. A chain is the more specific of
  // the two, so it wins when both are given.
  if (filters) widget.value = { filters };
  else if (value !== undefined) showValue();

  return widget;
}

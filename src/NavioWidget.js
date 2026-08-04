import * as d3 from "d3";
import ReactiveWidget from "reactive-widget-helper";
import navio from "./navio.js";

/**
 * Navio as a Reactive Widget (https://reactivewidgets.org).
 *
 * Returns an HTMLElement whose `.value` is the multi-level filter chain, and
 * which emits an `input` event whenever the user changes it. That makes it
 * bindable to any other reactive widget, and usable as an Observable `viewof`.
 *
 *     const w = NavioWidget(data, { height: 600 });
 *     document.body.appendChild(w);
 *     w.addEventListener("input", () => render(w.getSelected()));
 *
 * `.value` is the filter chain rather than the selected rows, deliberately.
 * On a bind hop the receiver has to apply the *filters* against its own data -
 * the sender's row objects are projections through the sender's own arrays and
 * are unusable on the other side. Shipping them would send, on every hop, the
 * one field the receiver is obliged to discard. The selection stays available
 * through getSelected()/getVisible(), which are fresh by the time `input`
 * fires. See issue #60 for the full argument.
 *
 * The existing `navio(selection, height)` API is untouched; this is additive.
 */
export default function NavioWidget(data, options = {}) {
  const {
    height = 600,
    value = [],
    attribs,
    autodetect = true,
    ...settings
  } = options;

  const container = document.createElement("div");
  const nv = navio(d3.select(container), height);

  // Any remaining option is a plain nv.* setting (margin, attribWidth, DEBUG…).
  for (const [key, v] of Object.entries(settings)) nv[key] = v;

  if (data && data.length) {
    nv.data(data);
    if (autodetect) nv.addAllAttribs(attribs);
  }

  // Applying a value must not echo back out as a new user change. The helper's
  // own contract already covers the common case - assigning `.value` calls
  // showValue() without dispatching - but a hand-rolled bidirectional binding
  // could still drive us in a loop, so guard the apply itself.
  let applying = false;

  function showValue() {
    if (applying) return;
    applying = true;
    try {
      // Accept either the bare chain or a { filters } wrapper, so a value
      // round-tripped through snapshot() still applies.
      const v = widget.value;
      const filters = Array.isArray(v) ? v : v && v.filters;
      if (filters) nv.setFilters(filters);
    } finally {
      applying = false;
    }
  }

  const widget = ReactiveWidget(container, { value, showValue });

  // User-driven changes emit; programmatic ones already returned above.
  nv.onChange(() => {
    if (applying) return;
    widget.setValue(nv.getFilters());
  });

  /** The rows surviving every level. Fresh whenever `input` has just fired. */
  widget.getSelected = () => nv.getSelected();
  widget.getVisible = () => nv.getVisible();

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

  // Render whatever initial value was supplied.
  showValue();

  return widget;
}

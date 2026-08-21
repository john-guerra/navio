import * as d3 from "d3";
import { PARAMS } from "./params.js";
import { createTheme } from "./theme.js";
import { createSettingsStorage } from "./settings-storage.js";

/**
 * The settings panel for one Navio instance, and the composition root for the
 * slice extracted in issue #67 - see
 * docs/ai/2026-08-20-navio-decomposition-design.md.
 *
 * This module owns the gear, the panel and everything drawn inside it, and it
 * constructs the theme and storage modules itself. The dependency graph is
 * deliberately one-way - navio.js -> settings-panel -> {settings-storage,
 * theme} - because the alternative, each importing the other, leaves neither
 * factory constructible first.
 *
 * applyTheme lives HERE rather than in theme.js: it restyles the gear, the
 * panel and the tooltip, and putting it beside the theme table would have made
 * theme.js import back into this file.
 *
 * Every non-const binding in `ctx` is a GETTER. init() rebinds `selection`
 * and `canvas` long after this factory is constructed, so a captured value
 * would be stale or, for selection, still the caller's string.
 *
 * @param {object} ctx - { nv, instanceId, get selection(), get attribsOrdered(),
 *   get dataIs(), get canvas(), get tooltipElement(),
 *   get/set hiddenAttribs, get/set height,
 *   announce, visibleAttribs, getAttribName, moveAttrToPos }
 */
export function createSettingsPanel(ctx) {
  // Panel-owned state. These left navio.js's let chain with this module and are
  // reached from outside only through what is returned below.
  let settingsButton;
  let settingsPanel;

  // Titles of the settings sections the user has folded away. Held here because
  // drawSettingsPanel rebuilds the panel from scratch on every type change,
  // reorder and header drag - a <details> element's own state would spring back
  // open each time.
  let collapsedSections = new Set();

  // True while a pointer is held down on a control inside the panel, so the
  // panel cannot reposition itself mid-drag.
  let panelPointerHeld = false;

  // Ancestors whose `overflow` was lifted to show the panel, with what to put
  // back. Null when the panel is closed. See liftClipsForPanel.
  let liftedClips = null;

  // Constructed before the body so nothing in it can run against a theme that
  // does not exist yet. createTheme only reads ctx lazily, so this is safe here.
  const _theme = createTheme(ctx);
  const { theme, divisionsColour, tooltipBackground } = _theme;
  // Stays a public method, and theme() reads it back off nv so replacing it
  // still works.
  ctx.nv.resolvedTheme = _theme.resolvedTheme;

  // The storage module reaches back only through these hooks. Its ctx getters
  // are lazy, so referring to LIVE_OPTIONS and friends - declared further down
  // in this file - is fine: nothing reads them until getSettings runs.
  const _storage = createSettingsStorage(
    {
      get nv() {
        return ctx.nv;
      },
      get selection() {
        return ctx.selection;
      },
      get attribsOrdered() {
        return ctx.attribsOrdered;
      },
      get hiddenAttribs() {
        return ctx.hiddenAttribs;
      },
      set hiddenAttribs(v) {
        ctx.hiddenAttribs = v;
      },
      get height() {
        return ctx.height;
      },
      set height(v) {
        ctx.height = v;
      },
      get liveOptions() {
        return LIVE_OPTIONS;
      },
      get liveColours() {
        return LIVE_COLOURS;
      },
      get liveSelects() {
        return LIVE_SELECTS;
      },
      getAttribName: ctx.getAttribName,
      moveAttrToPos: ctx.moveAttrToPos,
    },
    {
      redraw: () => drawSettingsPanel(),
      isOpen: () => settingsIsOpen(),
      getCollapsed: () => collapsedSections,
      setCollapsed: (s) => {
        collapsedSections = s;
      },
    }
  );
  const { persistSettings, maybeRestoreSettings, loadPending } = _storage;

  // ---------------------------------------------------------------------
  // Settings panel (#89)
  //
  // A gear button in the widget's corner opening a panel that changes options
  // live. Two rules shape the implementation:
  //
  //   1. Only options that are actually READ at draw time appear here. Roughly
  //      a third of nv.* is read once during construction (every tooltip*,
  //      every defaultColor*, showSelectedAttrib, ...); a control for one of
  //      those would silently do nothing, which is worse than its absence.
  //   2. Nothing here touches the filter chain, so nothing here emits a change
  //      event. A settings change must never make a bound peer refilter.
  //
  // Plain inline-styled DOM, like the rest of the widget: no CSS file, no
  // framework. It sits in the outer container next to the live region - not in
  // the inner div, which is a scroll container in both axes and would clip it.
  // ---------------------------------------------------------------------

  /**
   * The panel's controls, derived from PARAMS so the descriptions the panel
   * shows and the descriptions an agent reads are the same strings.
   *
   * Only get/set live here, because only those can close over this instance.
   * Everything else - label, hint, range, step - comes from the table.
   */
  const OPTION_ACCESSORS = {
    height: { get: () => ctx.nv.height(), set: (v) => ctx.nv.height(v) },
    settingsPlacement: {
      // Modal and non-modal are two different open() calls, so a live switch
      // cannot restyle what is already showing - it has to reopen.
      set: (v) => {
        ctx.nv.settingsPlacement = v;
        toggleSettings(false);
        toggleSettings(true);
      },
    },
    y0: {
      // Touching the slider hands control over. Without this the measurement
      // would overwrite the chosen value on the very next update, so the
      // control would appear to do nothing at all.
      set: (v) => {
        ctx.nv.autoHeaderSpace = false;
        ctx.nv.y0 = v;
        // A setter opts OUT of the handler's redraw, so it owes one. Without
        // this the option appeared dead in a different way: the value changed,
        // the number beside the slider changed, and nothing moved until some
        // unrelated interaction happened to repaint.
        ctx.nv.hardUpdate();
      },
    },
  };

  const fromParams = (control) =>
    PARAMS.filter((p) => p.control === control).map((p) => ({
      ...p,
      ...(OPTION_ACCESSORS[p.key] || {}),
    }));

  /** Options safe to expose: each is re-read on every hardUpdate(). */
  const LIVE_OPTIONS = fromParams("range");

  const LIVE_COLOURS = fromParams("color");

  /**
   * One-of-a-few options, drawn as a <select>.
   *
   * Orientation and panel placement were two hand-rolled copies of the same
   * twelve lines, each carrying its own copy of a hint that PARAMS already
   * held - so the panel and the docs could describe the same option
   * differently, which is the drift this table exists to prevent. Theme is the
   * third and was not reachable from the panel at all.
   */
  const LIVE_SELECTS = fromParams("select");

  /**
   * What an option is actually drawing right now. For the options whose default
   * is the follow-the-theme sentinel, that is the theme's colour rather than
   * `null`; for everything else it is just the value.
   */
  function effectiveColour(key) {
    if (key === "divisionsColor") return divisionsColour();
    if (key === "tooltipBgColor") return tooltipBackground();
    return ctx.nv[key];
  }

  /** <input type="color"> only accepts #rrggbb, so normalise whatever is set. */
  function toHex(colour) {
    const c = d3.color(colour);
    return c ? c.formatHex() : "#000000";
  }

  function styleButton(sel) {
    // padding is set below, deliberately: the panel's buttons are smaller than
    // a browser's default.
    return styleControl(sel, "button")
      .style("font", "13px sans-serif")
      .style("color", theme().ink)
      .style("background", theme().surface)
      .style("border", `1px solid ${theme().hairline}`)
      .style("border-radius", "4px")
      .style("padding", "2px 8px")
      .style("cursor", "pointer");
  }

  /**
   * The box metrics of the panel's form controls, stated rather than inherited.
   *
   * Navio ships no stylesheet so that it does not fight the page it is dropped
   * into, and that only works in one direction unless it is deliberate about
   * the other. The panel is built from real <button>, <select> and <input>
   * elements, so anything left unset belongs to whatever the host wrote - and
   * `button { margin: 0 6px 12px 0 }`, which is what any page with buttons of
   * its own writes, added 11px to EVERY row of the attribute list. At 19
   * attributes that is 209px of invented height, and it reads as Navio having
   * grown spacing of its own. A `select { padding: 8px }` on top of it took the
   * row from 25px to 46px.
   *
   * The values are Chrome's own defaults for each control, so a page with no
   * such rules looks exactly as it did - a blanket `margin: 0` would have
   * tightened every panel to fix a problem only some pages have. Being explicit
   * also means the panel is the same size in every engine rather than following
   * each one's idea of a checkbox.
   *
   * Only what moves a control relative to its row. Anything genuinely cosmetic
   * that a host wants to restyle is still theirs.
   */
  const CONTROL_BOX = {
    select: ["0", "0"],
    color: ["0", "1px 2px"],
    range: ["2px", "0"],
    checkbox: ["3px 3px 3px 4px", "0"],
  };

  function styleControl(sel, kind) {
    const [margin, padding] = CONTROL_BOX[kind] || ["0", "0"];
    return sel
      .style("margin", margin)
      .style("padding", padding)
      .style("box-sizing", "border-box");
  }

  function initSettingsPanel() {
    if (settingsPanel) settingsPanel.remove();
    if (settingsButton) settingsButton.remove();
    settingsPanel = settingsButton = null;
    if (!ctx.nv.settings) return;

    // The container must be a positioning context for the panel to sit in its
    // corner. Only set it when it would otherwise be static, so an embedder's
    // own positioning is left alone.
    // The gear and panel are absolutely positioned, so the container has to be
    // a positioning context or they fly off to whichever ancestor is.
    //
    // getComputedStyle on a DETACHED element returns "" rather than "static",
    // and NavioWidget builds its container with createElement and constructs
    // Navio before the caller appends it - so this check silently did nothing
    // there, and the two gears in the binding example landed further down the
    // page. Fall back to the inline style when the node is not in the document
    // yet.
    const host = ctx.selection.node();
    if (host) {
      const pos = host.isConnected
        ? getComputedStyle(host).position
        : host.style.position;
      if (!pos || pos === "static") ctx.selection.style("position", "relative");
    }

    settingsButton = styleButton(ctx.selection.append("button"))
      .attr("class", "_nv_gear")
      .attr("type", "button")
      .attr("aria-haspopup", "dialog")
      .attr("aria-expanded", "false")
      .attr("aria-label", "Widget settings")
      .attr("title", "Widget settings")
      .style("position", "absolute")
      .style("bottom", "2px")
      .style("left", "2px")
      .style("z-index", 6)
      .style("line-height", "1")
      .style("padding", "3px 6px")
      .text("⚙")
      .on("click", () => toggleSettings());

    // A real <dialog>, opened non-modally with show() and positioned by
    // placeSettingsPanel exactly as the plain div was. The element is worth it
    // for its own sake: `open` is the single source of truth for "is the panel
    // showing", and the browser supplies Escape and the dialog semantics.
    settingsPanel = ctx.selection
      .append("dialog")
      .attr("class", "_nv_settings")
      .attr("aria-label", "Widget settings")
      .attr("data-navio-instance", ctx.instanceId)
      // The UA stylesheet gives dialog `position:absolute; inset:0; margin:auto`,
      // which would centre it inside the container and fight the anchoring
      // below. Modal mode resets these again in openSettingsPanel.
      .style("margin", "0")
      .style("inset", "auto")
      .style("position", "absolute")
      .style("bottom", "26px")
      .style("left", "2px")
      // Above the filter explanations, which are z-index 5 - they were being
      // painted over the panel.
      .style("z-index", 6)
      // Bounded by the SCREEN, not by the widget.
      //
      // This was `70%`, and a percentage max-height resolves against the
      // containing block - the Navio container, whose height is the `height`
      // option. On a 200px-tall widget that is 140px: four checkboxes and a
      // scrollbar, cut off mid-list. In an Observable notebook, where the cell
      // below is a block of code, the result reads as the panel being painted
      // under the next cell, which is why this looked like a z-index problem.
      // It is not - see test/e2e/93-stacking.spec.js, which reproduces
      // observablehq.com's cell nesting and shows the panel wins at any
      // z-index down to 1.
      .style("max-height", "70vh")
      .style("overflow-y", "auto")
      .style("min-width", "230px")
      .style("padding", "10px 12px")
      .style("background", theme().surface)
      .style("color", theme().ink)
      .style("border", `1px solid ${theme().hairline}`)
      .style("border-radius", "6px")
      .style("box-shadow", "0 2px 10px rgba(0,0,0,0.25)")
      .style("font", "13px sans-serif")
      .style("text-align", "left")
      // Escape reaches us as `cancel` on a modal dialog, and as a keydown on a
      // non-modal one. Both close, and both hand focus back to the gear, so a
      // keyboard user is never dropped at the top of the document.
      // Whoever closes it - us, another instance opening its own, or the
      // browser - the button has to follow. Making the dialog's own event the
      // single source of truth is why a peer can close this panel directly and
      // still leave a correct aria-expanded behind.
      // Held while a control inside the panel is being dragged. placeSettings-
      // Panel bails out meanwhile, so a slider cannot walk away from the
      // cursor that is holding it. Released on the document because a drag
      // very often ends outside the element it started on.
      .on("pointerdown", () => {
        panelPointerHeld = true;
        if (typeof document !== "undefined")
          document.addEventListener("pointerup", releasePanelPointer, {
            once: true,
            capture: true,
          });
      })
      .on("close", () => {
        if (settingsButton) settingsButton.attr("aria-expanded", "false");
        // Whoever closed it - us, a peer instance opening its own, or the
        // browser - the page's own overflow has to go back.
        dropClipsForPanel();
        if (typeof document !== "undefined")
          document.removeEventListener(
            "pointerdown",
            dismissOnOutsidePointer,
            true
          );
      })
      .on("cancel", (event) => {
        event.preventDefault(); // close it ourselves, so aria-expanded follows
        toggleSettings(false);
        settingsButton.node().focus();
      })
      .on("keydown", (event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          toggleSettings(false);
          settingsButton.node().focus();
          return;
        }
        if (event.key !== "Tab") return;
        // Focus stays inside while the dialog is open.
        const items = focusablePanelItems();
        if (!items.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
  }

  /**
   * Re-colour the chrome that is built once and then kept.
   *
   * The drawn parts - headers, counts, borders, rows - are restyled on every
   * redraw and follow the theme for free. The tooltip, the gear and the panel
   * are created in init() and live for the widget's lifetime, so with
   * theme "auto" a reader switching their system to dark would otherwise be
   * left with a white panel until they reloaded.
   */
  function applyTheme() {
    const t = theme();
    if (settingsButton) {
      settingsButton.style("color", t.ink).style("background", t.surface);
      settingsButton.style("border", `1px solid ${t.hairline}`);
    }
    if (settingsPanel)
      settingsPanel
        .style("background", t.surface)
        .style("color", t.ink)
        .style("border", `1px solid ${t.hairline}`);
    if (ctx.tooltipElement)
      ctx.tooltipElement
        // The OPTION wins if it was set; only the default follows the theme.
        // Setting the custom property repaints the arrow too - its colour is in
        // a stylesheet built once, so it cannot be restyled directly.
        .style("--nv-tooltip-bg", tooltipBackground())
        .style("color", t.tooltipInk);
  }

  /** Is the panel showing? The dialog's own `open` state is the truth. */
  function settingsIsOpen() {
    return !!(settingsPanel && settingsPanel.node().open);
  }

  /**
   * Put the panel beside the drawn widget rather than on top of it, so the
   * effect of every control stays visible while you change it.
   *
   * The canvas is usually much narrower than the container - a five-column
   * widget is about 100px wide inside a full-width div - so there is normally
   * room to its right. Absolutely positioned, so nothing on the page reflows;
   * if the container is too narrow the panel simply extends past it, which the
   * outer container's overflow:visible allows.
   */
  function placeSettingsPanel() {
    if (!settingsPanel) return;

    // Never move the panel out from under a pointer that is holding one of its
    // own controls. Dragging "Size along records" from 420 to 1180 grew the
    // widget by 760px, and a below-placed panel follows the canvas bottom - so
    // the slider ran down the page away from the cursor and off the screen.
    // From the user's side the panel simply vanished mid-drag.
    if (panelPointerHeld) return;

    const host = ctx.selection.node(),
      cv = ctx.canvas;
    if (!host || !cv) return;
    const h = host.getBoundingClientRect(),
      c = cv.getBoundingClientRect();

    // Reset both axes each time; the modes anchor differently.
    settingsPanel
      .style("position", "absolute")
      .style("margin", "0")
      .style("inset", "auto")
      .style("top", null)
      .style("bottom", null)
      .style("left", null)
      .style("right", null);

    if (ctx.nv.settingsPlacement === "over") {
      settingsPanel.style("left", "2px").style("bottom", "26px");
      return;
    }

    if (ctx.nv.settingsPlacement === "beside") {
      settingsPanel
        .style("left", `${Math.round(c.right - h.left) + 12}px`)
        .style("bottom", `${Math.max(0, Math.round(h.bottom - c.bottom))}px`);
      return;
    }

    // "below": left-aligned under the canvas. Column width changes the
    // canvas's WIDTH, which this ignores, so the panel stays put while the
    // slider is dragged - which is the point.
    settingsPanel
      .style("left", "2px")
      .style(
        "top",
        `${clampToViewport(Math.round(c.bottom - h.top) + 30, h)}px`
      );
  }

  /**
   * A last resort for a panel that would land entirely off the bottom of the
   * window - a 1200px `height` on a laptop puts a below-placed panel past the
   * fold with nothing on screen to say where it went.
   *
   * Deliberately NOT a general "keep it fully visible" clamp. The panel is
   * 70vh at full stretch, so a fits-entirely rule fires almost always and drags
   * the panel up over the canvas, which is what "below" exists to avoid. Only
   * step in when there is effectively nothing left to see, and then show just
   * enough of the top edge to be findable and scrollable to.
   */
  function clampToViewport(top, hostRect) {
    if (typeof window === "undefined") return top;
    const KEEP_VISIBLE = 60;
    const absoluteTop = hostRect.top + top;
    if (absoluteTop <= window.innerHeight - KEEP_VISIBLE) return top;
    return Math.max(
      0,
      Math.round(window.innerHeight - KEEP_VISIBLE - hostRect.top)
    );
  }

  /**
   * Ancestors that would clip the settings panel, nearest first.
   *
   * #100: the panel is a child of the container the caller passes, and anything
   * absolutely positioned inside an element that clips is clipped with it.
   * Navio does not set `overflow` on that container - the outer container
   * computes to `visible` and on a plain page the panel hangs happily below a
   * short widget - but the HOST page is free to: an Observable Framework card,
   * a scrolling sidebar, any layout that gives the widget its own scroll box.
   * The panel is several times taller than a compact widget, so it became a
   * sliver with the rest unreachable, and scrolling the box scrolls the WIDGET
   * rather than the panel. Measured on a 210px widget: a 722px panel with
   * everything past the first ~200px clipped away.
   *
   * Note `overflow-x: auto` alone is enough to land here. CSS forces the other
   * axis to `auto` when one axis is not `visible`, so a box that only meant to
   * scroll sideways clips vertically too.
   */
  function clippingAncestorsOfPanel() {
    const out = [];
    if (!settingsPanel || typeof window === "undefined") return out;
    let el = settingsPanel.node().parentElement;
    while (el && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      if (cs.overflowX !== "visible" || cs.overflowY !== "visible")
        out.push(el);
      el = el.parentElement;
    }
    return out;
  }

  /**
   * Let the panel out of any scroll box it is sitting in, for as long as it is
   * open.
   *
   * Moving the panel to <body> was the other candidate and was measured and
   * rejected. It does make the panel unclippable, but a <body> child is a last
   * sibling that paints over every widget on the page, and #97 depends on the
   * opposite: with two Navios stacked, the upper panel overlays the lower
   * widget's gear, and that gear has to stay clickable. Being unclippable and
   * being click-through-able are the same z-order fact with opposite signs, so
   * a <body> panel cannot have both. This keeps the stacking exactly as shipped
   * and takes the clip away instead.
   *
   * Scroll offsets are saved with the overflow: an element reset to `visible`
   * loses its scroll position, which would jump a half-scrolled sidebar to the
   * top behind the panel.
   *
   * The two axes are lifted and restored as LONGHANDS, never as the `overflow`
   * shorthand. Assigning the shorthand replaces both longhands in the element's
   * inline block, so a host that wrote `overflow-x: auto` inline - what a
   * dashboard writes to let a wide widget scroll sideways - had that rule
   * overwritten on open and then deleted on close, when restoring the shorthand
   * to its old value ("") cleared the axis the page had set. The container
   * stopped clipping for the rest of the session, one gear click after the page
   * loaded, with nothing to say why. A rule coming from a stylesheet survives
   * either way, which is what made this easy to miss.
   */
  function liftClipsForPanel() {
    dropClipsForPanel();
    liftedClips = clippingAncestorsOfPanel().map((el) => ({
      el,
      overflowX: el.style.overflowX,
      overflowY: el.style.overflowY,
      scrollTop: el.scrollTop,
      scrollLeft: el.scrollLeft,
    }));
    for (const s of liftedClips) {
      s.el.style.overflowX = "visible";
      s.el.style.overflowY = "visible";
    }
  }

  /** Put back exactly what liftClipsForPanel found, inline style and all. */
  function dropClipsForPanel() {
    if (!liftedClips) return;
    for (const s of liftedClips) {
      // Restoring the empty string removes that axis from the inline style,
      // which is right: the value was coming from the page's own stylesheet.
      s.el.style.overflowX = s.overflowX;
      s.el.style.overflowY = s.overflowY;
      s.el.scrollTop = s.scrollTop;
      s.el.scrollLeft = s.scrollLeft;
    }
    liftedClips = null;
  }

  function focusablePanelItems() {
    return settingsPanel
      ? Array.from(
          settingsPanel.node().querySelectorAll("button, input, select")
        ).filter((el) => !el.disabled)
      : [];
  }

  function toggleSettings(force) {
    if (!settingsPanel) return;
    const node = settingsPanel.node(),
      open = force !== undefined ? force : !node.open;

    if (!open) {
      if (node.open) node.close();
      // Give the page its overflow back HERE, not only in the close handler.
      // <dialog>.close() queues the `close` event as a task rather than firing
      // it synchronously, so for one turn of the loop the panel reads as closed
      // while the host is still unclipped - which is long enough for anything
      // watching `open` to see the wrong state. dropClipsForPanel is idempotent,
      // and the close handler stays for the closes we do not make ourselves.
      dropClipsForPanel();
      settingsButton.attr("aria-expanded", "false");
      return;
    }

    // Only one settings panel on the page at a time.
    //
    // The panel opens BELOW its widget, which in a notebook - or any page that
    // stacks Navios - is exactly where the next Navio sits. Two panels open at
    // once meant the upper one was painted over the lower widget's own
    // controls, so clicking its selects hit the wrong panel or nothing at all.
    // Instances do not know about each other, so this coordinates through the
    // DOM, the same way the widgets already share a page.
    if (typeof document !== "undefined") {
      for (const other of document.querySelectorAll(
        "dialog._nv_settings[open]"
      ))
        if (other !== node && typeof other.close === "function") other.close();
    }

    drawSettingsPanel();
    // Show FIRST, then place. A closed <dialog> is display:none and measures
    // zero, and the placement now needs the panel's own height to keep it
    // inside the viewport - placing first meant the clamp did nothing on open
    // and then yanked the panel ~190px the first time anything repositioned it.
    if (!node.open) node.show();
    // Before placing, so the placement measures the layout the panel will
    // actually be laid out in.
    liftClipsForPanel();
    placeSettingsPanel();
    settingsButton.attr("aria-expanded", "true");

    focusFirstPanelItem();

    // Light dismiss. The panel is absolutely positioned so nothing on the page
    // reflows around it, which means it OVERLAYS whatever follows the widget -
    // on a page that stacks Navios, the next Navio's own gear and canvas. A
    // pointer landing anywhere else closes it, so the second click reaches the
    // control the user was aiming at instead of being eaten by a panel
    // belonging to a widget further up the page.
    if (typeof document !== "undefined") {
      document.addEventListener("pointerdown", dismissOnOutsidePointer, true);
    }
  }

  /** End a panel drag, and settle the position the drag was holding still. */
  function releasePanelPointer() {
    panelPointerHeld = false;
    if (settingsIsOpen()) placeSettingsPanel();
  }

  /** Close the panel when a pointer goes down outside it and outside the gear. */
  function dismissOnOutsidePointer(event) {
    if (!settingsPanel || !settingsPanel.node().open) {
      document.removeEventListener(
        "pointerdown",
        dismissOnOutsidePointer,
        true
      );
      return;
    }
    const t = event.target;
    if (settingsPanel.node().contains(t)) return;
    if (settingsButton && settingsButton.node().contains(t)) return;
    // The widget itself is not "outside". The panel exists to drive THIS
    // Navio, and several controls are on the widget rather than in the panel -
    // dragging a header reorders the columns and the open panel is expected to
    // follow. Only a pointer landing on some other part of the page, another
    // Navio included, means the user has moved on.
    if (
      ctx.selection &&
      ctx.selection.node() &&
      ctx.selection.node().contains(t)
    )
      return;
    document.removeEventListener("pointerdown", dismissOnOutsidePointer, true);
    toggleSettings(false);
  }

  /**
   * Put focus inside the panel.
   *
   * Needed after every rebuild, not just on open: drawSettingsPanel wipes the
   * panel and builds it again on each type change, reorder and header drag, so
   * whatever the user was on is destroyed and focus falls back to <body>. A
   * non-modal dialog only sees Escape when focus is inside it, so losing focus
   * silently stopped Escape from closing the panel.
   */
  function focusFirstPanelItem() {
    const items = focusablePanelItems();
    if (items.length) items[0].focus();
  }

  /**
   * A titled block in the settings panel. Returns the element to fill.
   *
   * `collapsible` makes it a real <details>/<summary>. The browser already has
   * a disclosure widget - keyboard operation, the expanded/collapsed ARIA
   * state, find-in-page opening it, the marker triangle - and a hand-rolled
   * div-and-a-click-handler would only be a worse copy of it.
   */
  function settingsSection(parent, title, opts = {}) {
    const { collapsible = false, hint = null } = opts;

    if (!collapsible) {
      parent
        .append("div")
        .text(title)
        .style("font-weight", "bold")
        .style("margin", "8px 0 4px")
        .style("border-bottom", "1px solid #eee");
      return parent.append("div");
    }

    const details = parent
      .append("details")
      .attr("data-section", title)
      .property("open", !collapsedSections.has(title))
      .style("margin", "8px 0 4px")
      .on("toggle", function () {
        // `toggle` also fires when WE set .open while rebuilding the panel, and
        // the panel is rebuilt on every type change, reorder and header drag.
        // Persisting on those would write the settings straight back to disk
        // the moment Reset cleared them. Only a real change counts.
        if (this.open === !collapsedSections.has(title)) return;
        if (this.open) collapsedSections.delete(title);
        else collapsedSections.add(title);
        persistSettings();
      });

    details
      .append("summary")
      .style("font-weight", "bold")
      .style("cursor", "pointer")
      .style("border-bottom", "1px solid #eee")
      .style("padding-bottom", "2px")
      // The count travels in the summary so it is still readable when the
      // section is folded - otherwise collapsing hides the only place that
      // says how many columns are on.
      .text(hint ? `${title} (${hint})` : title);

    return details.append("div");
  }

  /**
   * Cap the attribute list's height so the sections below it stay reachable.
   *
   * Measured rather than assumed: a row's height depends on the font, on the
   * type <select> inside it and on whatever a custom picker renders. The
   * element has to be in the document for that, which is why this runs after
   * the picker has been appended rather than inside the picker itself.
   */
  function capAttribList(pickerEl, count) {
    const max = ctx.nv.settingsMaxAttribRows;
    if (!max || count <= max) return;
    // A picker marks the part that should scroll; without one, scroll it all.
    const list = pickerEl.querySelector("[data-navio-attrib-list]") || pickerEl;
    const first = list.firstElementChild;
    const rowH = first ? first.getBoundingClientRect().height : 0;
    d3.select(list)
      .style("max-height", (rowH > 0 ? Math.round(rowH * max) : 240) + "px")
      .style("overflow-y", "auto");
  }

  function drawSettingsPanel() {
    if (!settingsPanel) return;
    // The rebuild is a wipe, so it destroys whatever the user was on. Only
    // put focus back if it was inside the panel to begin with - this also runs
    // on data updates, and stealing focus then would be worse than the bug.
    const panelNode = settingsPanel.node(),
      hadFocus = panelNode.contains(document.activeElement);
    settingsPanel.selectAll("*").remove();

    // --- attributes ------------------------------------------------------
    // Same label the column header uses, so the two agree.
    const label = (a) =>
      ctx.getAttribName(a) === "__seqId"
        ? "sequential Index"
        : ctx.getAttribName(a);
    const names = ctx.attribsOrdered.map(label);

    // One row per column, so this is the section that grows without bound and
    // pushes everything else out of reach. It folds, and past
    // settingsMaxAttribRows columns the list scrolls inside itself as well.
    const attribs = settingsSection(settingsPanel, "Attributes", {
      collapsible: true,
      hint: `${ctx.visibleAttribs().length} of ${names.length} shown`,
    });
    attribs
      .append("div")
      .style("font-size", "11px")
      .style("color", theme().muted)
      .style("margin-bottom", "4px")
      .text("Untick to hide. Drag a name, or use the arrows, to reorder.");

    // The picker is pluggable. The default is a plain checkbox list with
    // reorder arrows; set nv.attribPicker to swap in something richer - see
    // examples/settings, which plugs in @john-guerra/search-checkbox. Navio
    // must not fetch that itself: d3 and popper.js are already external and
    // the library takes no further dependencies.
    const picker = ctx.nv.attribPicker || defaultAttribPicker;
    const pickerEl = picker(names, {
      value: ctx.visibleAttribs().map(label),
      onChange: (visibleNames) => {
        const shown = new Set(visibleNames);
        ctx.nv.setHiddenAttribs(
          ctx.attribsOrdered
            .filter((a) => !shown.has(label(a)))
            .map((a) => ctx.getAttribName(a))
        );
        persistSettings();
        ctx.announce(`${shown.size} of ${names.length} columns shown`);
      },
      // The picker deals in LABELS ("sequential Index"), not attribute names
      // ("__seqId"), so the mapping back has to happen here rather than in the
      // picker - which is also why these are callbacks and not raw API.
      types: ctx.nv.getAttribTypes(),
      getType: (name) =>
        ctx.nv.getAttribType(ctx.attribsOrdered.find((a) => label(a) === name)),
      setType: (name, type) => {
        const attrib = ctx.attribsOrdered.find((a) => label(a) === name);
        ctx.nv.setAttribType(attrib, type);
        ctx.announce(`${name} is now ${type}`);
        persistSettings();
        drawSettingsPanel();
      },
      // Derived columns are drawn from side tables, not from a data column,
      // so re-typing them would only break how they render.
      canSetType: (name) => {
        const attrib = ctx.attribsOrdered.find((a) => label(a) === name);
        const n = ctx.getAttribName(attrib);
        return n !== "__seqId" && n !== "selected";
      },
      move: (name, delta) => {
        const attrib = ctx.attribsOrdered.find((a) => label(a) === name);
        const from = ctx.attribsOrdered.indexOf(attrib),
          to = from + delta;
        if (from === -1 || to < 0 || to >= ctx.attribsOrdered.length) return;
        ctx.moveAttrToPos(attrib, to);
        ctx.nv.updateData(ctx.dataIs);
        ctx.announce(`Moved ${name} to position ${to + 1}`);
        persistSettings();
        drawSettingsPanel();
      },
      // Not shorthand: the parameter defaultAttribPicker destructures is named
      // instanceId and shadows nothing here, but the value comes from ctx.
      instanceId: ctx.instanceId,
    });
    if (pickerEl) {
      attribs.node().appendChild(pickerEl);
      // After the append: measuring a row needs it to be in the document.
      capAttribList(pickerEl, names.length);
    }

    // A custom picker only owns visibility, so the type controls that the
    // built-in one carries in its rows would otherwise disappear with it.
    if (ctx.nv.attribPicker) {
      const types = settingsSection(settingsPanel, "Attribute types");
      const trow = types
        .selectAll("div")
        .data(
          ctx.attribsOrdered
            .filter((a) => {
              const n = ctx.getAttribName(a);
              return n !== "__seqId" && n !== "selected";
            })
            .map((a) => ({ attrib: a, name: label(a) }))
        )
        .enter()
        .append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "6px");
      trow
        .append("span")
        .style("flex", "1")
        .style("white-space", "nowrap")
        .style("overflow", "hidden")
        .style("text-overflow", "ellipsis")
        .text((d) => d.name);
      trow
        .append("select")
        .call((n) => styleControl(n, "select"))
        .attr("aria-label", (d) => `Type of ${d.name}`)
        .style("font-size", "11px")
        .on("change", function (event, d) {
          ctx.nv.setAttribType(d.attrib, this.value);
          ctx.announce(`${d.name} is now ${this.value}`);
          persistSettings();
        })
        .selectAll("option")
        .data((d) =>
          ctx.nv.getAttribTypes().map((t) => ({ ...t, attrib: d.attrib }))
        )
        .enter()
        .append("option")
        .attr("value", (t) => t.value)
        .property("selected", (t) => ctx.nv.getAttribType(t.attrib) === t.value)
        .text((t) => t.label);
    }

    // --- layout ----------------------------------------------------------
    const layout = settingsSection(settingsPanel, "Layout");

    for (const opt of LIVE_SELECTS) {
      const row = layout
        .append("label")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "6px")
        .style("margin-bottom", "6px")
        .attr("title", opt.hint || opt.label);
      row.append("span").style("flex", "1").text(opt.label);
      const write = opt.set || ((v) => (ctx.nv[opt.key] = v));
      row
        .append("select")
        .call((n) => styleControl(n, "select"))
        .attr("aria-label", opt.label)
        .on("change", function () {
          write(this.value);
          // A setter that reopens the panel has already redrawn what it needs;
          // everything else is read on the next update.
          if (!opt.set) ctx.nv.hardUpdate();
          persistSettings();
          ctx.announce(`${opt.label} ${this.value}`);
        })
        .selectAll("option")
        .data(opt.values)
        .enter()
        .append("option")
        .attr("value", (d) => d)
        .property("selected", (d) => d === ctx.nv[opt.key])
        .text((d) => d);
    }

    for (const opt of LIVE_OPTIONS) {
      const row = layout
        .append("label")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "6px")
        // On the row, not just the input: the label is the bigger target and
        // is what someone scanning the panel actually points at.
        .attr("title", opt.hint || opt.label);
      row.append("span").style("flex", "1").text(opt.label);
      const read = opt.get || (() => ctx.nv[opt.key]);
      const write = opt.set || ((v) => (ctx.nv[opt.key] = v));
      const out = row
        .append("span")
        .style("width", "34px")
        .style("text-align", "right")
        .style("color", theme().muted)
        .text(read());
      row
        .append("input")
        .attr("type", "range")
        .call((n) => styleControl(n, "range"))
        .attr("min", opt.min)
        .attr("max", opt.max)
        .attr("step", opt.step)
        .attr("aria-label", opt.label)
        .property("value", read())
        .style("width", "90px")
        .on("input", function () {
          write(+this.value);
          out.text(this.value);
          if (!opt.set) ctx.nv.hardUpdate(); // opt.set does its own redraw
          persistSettings();
        });
    }

    // --- colours ---------------------------------------------------------
    const colours = settingsSection(settingsPanel, "Colours");
    for (const c of LIVE_COLOURS) {
      const row = colours
        .append("label")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "6px")
        .attr("title", c.hint || c.label);
      row.append("span").style("flex", "1").text(c.label);
      row
        .append("input")
        .attr("type", "color")
        .call((n) => styleControl(n, "color"))
        .attr("aria-label", c.label)
        // The colour in USE, not the option's raw value. Two of these default
        // to null - the sentinel for "follow the theme" - and <input
        // type="color"> only speaks #rrggbb, so the swatch reported black for
        // options that were drawing white and pale blue.
        .property("value", toHex(effectiveColour(c.key)))
        .style("width", "40px")
        .on("input", function () {
          ctx.nv[c.key] = this.value;
          // Tooltip options are read in initTooltipPopper, which only runs on
          // data(); everything else is re-read on the next draw.
          if (c.needsData) ctx.nv.data(ctx.nv.data());
          else ctx.nv.hardUpdate();
          persistSettings();
        });
    }

    // --- what is drawn ---------------------------------------------------
    const shows = settingsSection(settingsPanel, "Show");
    for (const t of [
      {
        key: "showAttribTitles",
        label: "Column headers",
        hint: "Draw the rotated attribute names above the columns. Turn them off to save vertical space once you know the layout.",
      },
      {
        key: "showSelectedAttrib",
        label: "Selected column",
        column: "selected",
        hint: "Show the derived column that marks which rows are currently selected.",
      },
      {
        key: "showSequenceIDAttrib",
        label: "Sequential index column",
        column: "__seqId",
        hint: "Show the derived column holding each row's original position in the data, before any sorting.",
      },
    ]) {
      const row = shows
        .append("label")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "6px")
        .attr("title", t.hint || t.label);
      row
        .append("input")
        .attr("type", "checkbox")
        .call((n) => styleControl(n, "checkbox"))
        .property("checked", !!ctx.nv[t.key])
        .on("change", function () {
          ctx.nv[t.key] = this.checked;
          // The two derived columns were only ever ADDED, inside data(), and
          // only when the flag was already true - so unticking left the column
          // exactly where it was and re-ticking found it already in colScales
          // and did nothing either. Drive the visibility set instead, which is
          // what "display this column" means and which works both ways.
          if (t.column) ctx.nv.setAttribVisible(t.column, this.checked);
          else ctx.nv.hardUpdate();
          persistSettings();
          drawSettingsPanel();
        });
      row.append("span").text(t.label);
    }

    // --- filtering -------------------------------------------------------
    const behaviour = settingsSection(settingsPanel, "Filtering");
    const nested = behaviour
      .append("label")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "6px")
      .attr(
        "title",
        "Each filter opens a new level to its right, so a drill-down keeps its history on screen. Off, filtering narrows the single level in place."
      );
    nested
      .append("input")
      .attr("type", "checkbox")
      .call((n) => styleControl(n, "checkbox"))
      .property("checked", !!ctx.nv.nestedFilters)
      .on("change", function () {
        ctx.nv.nestedFilters = this.checked;
        ctx.announce(`Nested filters ${this.checked ? "on" : "off"}`);
        persistSettings();
      });
    nested.append("span").text("Nested filters (drill down into a new level)");

    const footer = settingsPanel
      .append("div")
      .style("display", "flex")
      .style("gap", "6px")
      .style("margin-top", "10px")
      .style("flex-wrap", "wrap");

    const copyBtn = footer
      .append("button")
      .attr("type", "button")
      .call(styleButton)
      .text("Copy config")
      .attr("title", "Copy the JS that reproduces these settings")
      .on("click", async function () {
        const code = ctx.nv.getSettingsCode();
        try {
          await navigator.clipboard.writeText(code);
          ctx.announce("Configuration copied to the clipboard");
        } catch {
          // Clipboard needs a secure context and permission; fall back to a
          // textarea the user can copy from by hand.
          const ta = settingsPanel
            .append("textarea")
            .attr("readonly", "")
            .attr("aria-label", "Configuration source")
            .style("width", "100%")
            .style("height", "120px")
            .style("font", "11px ui-monospace, Menlo, monospace")
            .text(code);
          ta.node().select();
          ctx.announce("Configuration ready to copy");
        }
        d3.select(this).text("Copied");
        setTimeout(() => d3.select(this).text("Copy config"), 1200);
      });
    void copyBtn;

    footer
      .append("button")
      .attr("type", "button")
      .call(styleButton)
      .text("Reset")
      .attr("title", "Put this widget back the way it started")
      .on("click", () => {
        ctx.nv.resetSettings();
        ctx.announce("Settings reset");
      });

    footer
      .append("button")
      .attr("type", "button")
      .call(styleButton)
      .style("margin-left", "auto")
      .text("Close")
      .on("click", () => {
        toggleSettings(false);
        settingsButton.node().focus();
      });

    // A non-modal dialog only sees Escape while focus is inside it, so losing
    // focus to <body> silently made the panel unclosable from the keyboard.
    if (hadFocus && panelNode.open) focusFirstPanelItem();
  }

  /**
   * Built-in attribute picker: a checkbox per attribute plus reorder arrows.
   *
   * Swap it out by assigning nv.attribPicker. The contract is
   *   (names, {value, onChange, move, instanceId}) -> HTMLElement
   * where `value` is the currently-visible names, `onChange` receives the new
   * visible names, and `move(name, delta)` reorders. A picker that does not
   * support reordering can simply ignore `move`.
   *
   * Mark the scrollable part with `data-navio-attrib-list` if the whole
   * element should not scroll - see capAttribList. Without it Navio caps the
   * returned element itself, which for this picker would carry the bulk
   * buttons off the bottom along with the rows.
   */
  function defaultAttribPicker(
    names,
    { value, onChange, move, instanceId, types, getType, setType, canSetType }
  ) {
    const shown = new Set(value);
    const wrap = d3.create("div");

    // Only the rows scroll. The bulk buttons live outside this box, so "Show
    // all" and "Show none" stay put instead of riding off the bottom with a
    // long list - which would defeat the point of capping the height.
    const list = wrap.append("div").attr("data-navio-attrib-list", "");

    const row = list
      .selectAll("div")
      .data(names)
      .enter()
      .append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "6px")
      .style("padding", "1px 0")
      .style("border-top", "2px solid transparent")
      .style("border-bottom", "2px solid transparent");

    const boxes = row
      .append("input")
      .attr("type", "checkbox")
      .call((n) => styleControl(n, "checkbox"))
      .attr("id", (n) => `_nv_vis_${instanceId}_${n}`)
      .property("checked", (n) => shown.has(n))
      .on("change", function (event, n) {
        if (this.checked) shown.add(n);
        else shown.delete(n);
        onChange(names.filter((x) => shown.has(x)));
      });

    // The label is the drag handle. Reordering by dragging is the direct
    // gesture; the arrows below stay because a drag is not keyboard-operable.
    row
      .append("label")
      .attr("for", (n) => `_nv_vis_${instanceId}_${n}`)
      .attr("draggable", true)
      .attr("title", "Drag to reorder")
      .style("flex", "1")
      .style("cursor", "grab")
      .style("white-space", "nowrap")
      .style("overflow", "hidden")
      .style("text-overflow", "ellipsis")
      .style("user-select", "none")
      .text((n) => n)
      .on("dragstart", function (event, n) {
        event.dataTransfer.effectAllowed = "move";
        // Firefox will not start a drag without data set.
        event.dataTransfer.setData("text/plain", n);
        dragging = n;
      })
      .on("dragend", function () {
        dragging = null;
        row
          .style("border-top", "2px solid transparent")
          .style("border-bottom", "2px solid transparent");
      });

    // The whole row is the drop target, not just the label, so the pointer
    // does not have to land exactly on the text.
    let dragging = null;
    row
      .on("dragover", function (event, n) {
        if (dragging === null || dragging === n) return;
        event.preventDefault(); // required, or the drop never fires
        event.dataTransfer.dropEffect = "move";
        const before = names.indexOf(dragging) > names.indexOf(n);
        d3.select(this)
          .style(
            "border-top",
            before ? "2px solid #1a73e8" : "2px solid transparent"
          )
          .style(
            "border-bottom",
            before ? "2px solid transparent" : "2px solid #1a73e8"
          );
      })
      .on("dragleave", function () {
        d3.select(this)
          .style("border-top", "2px solid transparent")
          .style("border-bottom", "2px solid transparent");
      })
      .on("drop", function (event, n) {
        event.preventDefault();
        if (dragging === null || dragging === n) return;
        move(dragging, names.indexOf(n) - names.indexOf(dragging));
        dragging = null;
      });

    const typeSel = row
      .append("select")
      .call((n) => styleControl(n, "select"))
      .attr("aria-label", (n) => `Type of ${n}`)
      .attr("title", "How this column is interpreted and coloured")
      .style("font-size", "11px")
      .style("max-width", "82px")
      .property("disabled", (n) => !canSetType(n))
      .on("change", function (event, n) {
        setType(n, this.value);
      });

    typeSel
      .selectAll("option")
      .data((n) => types.map((t) => ({ ...t, name: n })))
      .enter()
      .append("option")
      .attr("value", (t) => t.value)
      .property("selected", (t) => getType(t.name) === t.value)
      .text((t) => t.label);

    row
      .append("button")
      .attr("type", "button")
      .attr("aria-label", (n) => `Move ${n} earlier`)
      .property("disabled", (n) => names.indexOf(n) === 0)
      .call(styleButton)
      .style("padding", "0 5px")
      .text("\u2191")
      .on("click", (event, n) => move(n, -1));

    row
      .append("button")
      .attr("type", "button")
      .attr("aria-label", (n) => `Move ${n} later`)
      .property("disabled", (n) => names.indexOf(n) === names.length - 1)
      .call(styleButton)
      .style("padding", "0 5px")
      .text("\u2193")
      .on("click", (event, n) => move(n, 1));

    const bulk = wrap
      .append("div")
      .style("display", "flex")
      .style("gap", "6px")
      .style("margin-top", "6px");
    // `shown` is the picker's own record of the boxes, and the boxes are what
    // the user reads. Emitting the new set without moving both leaves the panel
    // contradicting the widget: "Show none" emptied the canvas with every box
    // still ticked, and the next single click then unticked one box and pushed
    // all the OTHERS back on. Set the state, then report it - never one alone.
    function setAll(visible) {
      shown.clear();
      if (visible) names.forEach((n) => shown.add(n));
      boxes.property("checked", visible);
      onChange(visible ? names.slice() : []);
    }

    bulk
      .append("button")
      .attr("type", "button")
      .call(styleButton)
      .text("Show all")
      .on("click", () => setAll(true));
    bulk
      .append("button")
      .attr("type", "button")
      .call(styleButton)
      .text("Show none")
      .on("click", () => setAll(false));

    return wrap.node();
  }

  /**
   * Keep the gear against the bottom of the CANVAS, not of the container.
   *
   * The layout pass in navio.js used to reach settingsButton directly. It
   * cannot now that the button lives here, so it asks instead.
   */
  function positionButton(top) {
    if (settingsButton)
      settingsButton.style("bottom", null).style("top", top + "px");
  }

  /**
   * Take the panel down.
   *
   * dismissOnOutsidePointer is a CAPTURING listener on document, so removing it
   * needs the same function identity that registered it. Registration and
   * removal therefore both live in this module; navio.js's destroy() calls this
   * and does not touch the listener itself.
   */
  function destroy() {
    if (settingsPanel) {
      // Never leave the host page's overflow lifted behind a panel that no
      // longer exists.
      dropClipsForPanel();
      // The light-dismiss listener lives on `document`, so removing the panel
      // is not enough to detach it - and because it was registered in the
      // CAPTURE phase, removal needs the same function identity.
      if (typeof document !== "undefined")
        document.removeEventListener(
          "pointerdown",
          dismissOnOutsidePointer,
          true
        );
      settingsPanel.remove();
      settingsPanel = null;
    }
    if (settingsButton) {
      settingsButton.remove();
      settingsButton = null;
    }
    liftedClips = null;
  }

  return {
    // panel
    initSettingsPanel,
    drawSettingsPanel,
    settingsIsOpen,
    placeSettingsPanel,
    toggleSettings,
    applyTheme,
    positionButton,
    destroy,
    // re-exported from the modules this one composes, so navio.js has a single
    // thing to construct
    theme,
    divisionsColour,
    tooltipBackground,
    persistSettings,
    maybeRestoreSettings,
    loadPending,
  };
}

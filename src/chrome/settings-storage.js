/**
 * Settings serialisation and persistence for one Navio instance.
 *
 * Moved out of src/navio.js for issue #67 - see
 * docs/ai/2026-08-20-navio-decomposition-design.md.
 *
 * This module knows how to turn the widget's options into a plain object and
 * back, and how to put that object in localStorage. It knows NOTHING about how
 * the panel is drawn: the two places it needs to reach the panel - redrawing an
 * open panel after settings change, and the fold state of its sections - come
 * in as `hooks`. That one-way dependency is what keeps the pair acyclic;
 * importing the panel from here and the storage from there would leave neither
 * constructible first.
 *
 * Every non-const binding in `ctx` is a GETTER. `selection` in particular is
 * rebound by init() long after this factory is constructed, and settingsSlot
 * reads its node to derive the storage key.
 *
 * @param {object} ctx - { nv, get selection(), get attribsOrdered(),
 *   get/set hiddenAttribs, get/set height, liveOptions, liveColours,
 *   liveSelects, getAttribName, moveAttrToPos }
 * @param {object} hooks - { redraw(), isOpen(), getCollapsed(), setCollapsed(set) }
 */
export function createSettingsStorage(ctx, hooks) {
  // Settings read from storage but not yet applied. init() fills this before
  // there are attributes to apply them to; maybeRestoreSettings drains it once
  // there are.
  let pendingSettings = null;

  // What this widget looked like before any stored settings landed on it - the
  // state Reset goes back to. Captured once, the first time there are
  // attributes to capture.
  let defaultSettings = null;

  /** Everything the panel can change, as a plain JSON-safe object. */
  /**
   * Stamped into every stored settings object so a later Navio can tell what
   * wrote it. Settings from before this existed carry no version at all, which
   * is the signal setSettings acts on - see LEGACY_COLOUR_DEFAULTS.
   */
  const SETTINGS_VERSION = 1;

  /**
   * Colours that were HARD defaults before 0.3.0, when there was no theme.
   *
   * A store written then spells them out, and setSettings assigning them is
   * indistinguishable from a user choosing them - which deliberately wins over
   * the theme. So anyone who had ever opened the settings panel got white row
   * dividers on a black ground, permanently, with no way to reach the dark
   * theme. A store that predates a feature is not a decision about it.
   */
  const LEGACY_COLOUR_DEFAULTS = {
    divisionsColor: "white",
    tooltipBgColor: "#b2ddf1",
  };

  ctx.nv.getSettings = function () {
    const out = { version: SETTINGS_VERSION, height: ctx.height };
    // orientation used to be listed here by hand; it is one of the selects.
    for (const o of ctx.liveSelects) out[o.key] = ctx.nv[o.key];
    for (const o of ctx.liveOptions)
      if (o.key !== "height") out[o.key] = ctx.nv[o.key];
    for (const c of ctx.liveColours) out[c.key] = ctx.nv[c.key];
    for (const k of [
      "showAttribTitles",
      "showSelectedAttrib",
      "showSequenceIDAttrib",
      "nestedFilters",
      // Without this, turning the measurement off did not survive a reload: the
      // stored y0 came back and was then immediately overwritten by a
      // measurement the user had switched off.
      "autoHeaderSpace",
    ])
      out[k] = ctx.nv[k];
    out.hiddenAttribs = Array.from(ctx.hiddenAttribs);
    out.attribTypes = Object.fromEntries(
      ctx.attribsOrdered.map((a) => [
        ctx.getAttribName(a),
        ctx.nv.getAttribType(a),
      ])
    );
    out.attribOrder = ctx.attribsOrdered.map((a) => ctx.getAttribName(a));
    out.collapsedSections = Array.from(hooks.getCollapsed());
    return out;
  };

  /**
   * Apply a settings object. Deliberately does NOT touch filters or the
   * selection - those are getFilters()/setFilters(), and keeping the two
   * separate is what lets settings be restored without disturbing a
   * selection the user has already made.
   */
  ctx.nv.setSettings = function (cfg = {}) {
    if (!cfg || typeof cfg !== "object") return ctx.nv;

    // No version means it was written before the theme existed, so the two
    // colours below are the old defaults rather than anything anyone picked.
    // Back to the sentinel, and the theme decides. A colour someone genuinely
    // chose that happens to equal the old default is lost here - the two are
    // not distinguishable, and following the page is the better guess.
    if (!cfg.version) {
      cfg = { ...cfg };
      for (const [key, was] of Object.entries(LEGACY_COLOUR_DEFAULTS))
        if (cfg[key] === was) cfg[key] = null;
    }

    for (const k of Object.keys(cfg)) {
      if (
        k === "hiddenAttribs" ||
        k === "attribOrder" ||
        k === "attribTypes" ||
        k === "collapsedSections" ||
        k === "height"
      )
        continue;
      if (k in ctx.nv) ctx.nv[k] = cfg[k];
    }
    // Not an nv property - it is panel state, held in the closure.
    if (Array.isArray(cfg.collapsedSections))
      hooks.setCollapsed(new Set(cfg.collapsedSections));
    if (typeof cfg.height === "number") ctx.height = cfg.height;
    if (Array.isArray(cfg.attribOrder)) {
      cfg.attribOrder.forEach((name, i) => {
        const a = ctx.attribsOrdered.find((x) => ctx.getAttribName(x) === name);
        if (a) ctx.moveAttrToPos(a, i);
      });
    }
    if (Array.isArray(cfg.hiddenAttribs)) {
      ctx.hiddenAttribs = new Set(cfg.hiddenAttribs);
    }
    if (cfg.attribTypes) {
      for (const [name, type] of Object.entries(cfg.attribTypes)) {
        if (type && ctx.nv.getAttribType(name) !== type)
          ctx.nv.setAttribType(name, type);
      }
    }
    ctx.nv.hardUpdate();
    if (hooks.isOpen()) hooks.redraw();
    return ctx.nv;
  };

  /**
   * Where panel settings are remembered between page loads. Set
   * `nv.settingsKey = null` to turn persistence off, or to a string to name the
   * bucket yourself.
   *
   * The key is scoped to the PAGE, not just to the instance. It used to be
   * `navio.settings.<n>`, which is the same string on every page of an origin -
   * so the first Navio in one notebook silently inherited the column layout of
   * the first Navio in a completely different one. The pathname is the coarsest
   * thing that separates them; the query and hash are deliberately left out so
   * that filtering the page, or following a link with #anchor, does not look
   * like a different widget.
   *
   * Within a page, instances are told apart by the container's own id - the one
   * thing about a widget that is stable across reloads however the page is
   * built. There is deliberately NO fallback for a container without one.
   *
   * It used to fall back to the construction counter, and that is #99: the
   * counter describes the order widgets were built in on THIS page load, not
   * which widget is which. Build them in another order next time - a widget
   * inside a collapsed <details>, a widget rebuilt when its data changes - and
   * they swap keys, so each one restores the other's hiddenAttribs, attribOrder
   * and attribTypes. It announces itself as a burst of
   * `setAttribType: "x" is not one of the attributes`, one per attribute of the
   * OTHER widget. Persisting nothing is strictly better than restoring
   * something that belongs to a different widget half the time.
   */
  function settingsSlot() {
    const host = ctx.selection && ctx.selection.node && ctx.selection.node();
    const domId = host && host.id;
    return domId ? `#${domId}` : null;
  }

  function settingsStorageKey() {
    if (ctx.nv.settingsKey !== undefined) return ctx.nv.settingsKey;
    const slot = settingsSlot();
    // No id and no settingsKey: nothing stable to file settings under, so this
    // widget does not persist. Give the container an id, or set settingsKey.
    if (!slot) return null;
    const page =
      typeof location !== "undefined"
        ? `${location.origin}${location.pathname}`
        : "";
    return `navio.settings.${page}.${slot}`;
  }

  function persistSettings() {
    const key = settingsStorageKey();
    if (!key || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(ctx.nv.getSettings()));
    } catch (e) {
      // Private mode, quota, disabled storage - never break the widget for it.
      if (ctx.nv.DEBUG) console.log("navio: could not persist settings", e);
    }
  }

  function readStoredSettings() {
    const key = settingsStorageKey();
    if (!key || typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      if (ctx.nv.DEBUG) console.log("navio: could not read settings", e);
      return null;
    }
  }

  /**
   * Apply stored settings once the widget actually has attributes to apply
   * them to. Runs at most once; after that the panel owns the state.
   */
  function maybeRestoreSettings() {
    if (!ctx.attribsOrdered.length) return;
    // Snapshot BEFORE anything stored is applied: the defaults are what the
    // caller constructed, not what a previous session left behind. Taken here
    // rather than at construction because there are no attributes to record
    // until data() and addAllAttribs have run.
    if (!defaultSettings) defaultSettings = ctx.nv.getSettings();
    if (!pendingSettings) return;
    const cfg = pendingSettings;
    pendingSettings = null;
    ctx.nv.setSettings(cfg);
  }

  /**
   * Save the current settings now. Plain option properties (nv.attribWidth =
   * 20) cannot notify anyone, so call this after setting them if you want the
   * change remembered.
   */
  ctx.nv.saveSettings = function () {
    persistSettings();
    return ctx.nv;
  };

  /**
   * Put the widget back the way it started, and forget what was saved.
   *
   * This is what the panel's Reset button does. Clearing storage alone - which
   * is all it used to do - changes nothing you can see until the page is
   * reloaded, so the button read as broken. Filters and the selection are
   * deliberately untouched: they are getFilters()/setFilters(), and keeping
   * the two apart is what lets a layout be reset without throwing away a
   * selection the user has already made.
   */
  ctx.nv.resetSettings = function () {
    ctx.nv.clearStoredSettings();
    hooks.setCollapsed(new Set());
    if (defaultSettings) ctx.nv.setSettings(defaultSettings);
    else ctx.nv.hardUpdate();
    if (hooks.isOpen()) hooks.redraw();
    // setSettings does not write, and nothing else should either: the point of
    // Reset is that a reload comes back to the defaults too.
    return ctx.nv;
  };

  /** Forget the stored settings on disk, leaving the live widget alone. */
  ctx.nv.clearStoredSettings = function () {
    const key = settingsStorageKey();
    if (key && typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        if (ctx.nv.DEBUG) console.log("navio: could not clear settings", e);
      }
    }
    return ctx.nv;
  };

  /** The JS that would reproduce the current settings on a fresh instance. */
  ctx.nv.getSettingsCode = function () {
    const cfg = ctx.nv.getSettings();
    const lines = [`const nv = new navio(d3.select("#navio"), ${cfg.height});`];
    for (const k of Object.keys(cfg)) {
      if (k === "height" || k === "hiddenAttribs" || k === "attribOrder")
        continue;
      lines.push(`nv.${k} = ${JSON.stringify(cfg[k])};`);
    }
    lines.push("");
    lines.push("nv.data(data);");
    lines.push("nv.addAllAttribs();");
    if (cfg.hiddenAttribs.length) {
      lines.push("");
      lines.push("// Hidden columns - hiding keeps the attribute and any");
      lines.push("// selection made on it; it only leaves it undrawn.");
      lines.push(`nv.setHiddenAttribs(${JSON.stringify(cfg.hiddenAttribs)});`);
    }
    lines.push("");
    lines.push("// Column order");
    lines.push(
      `nv.setSettings({ attribOrder: ${JSON.stringify(cfg.attribOrder)} });`
    );
    return lines.join("\n");
  };
  /**
   * Read what is in storage into the pending slot. init() calls this before
   * any attribute exists, which is why it is separate from applying it.
   */
  function loadPending() {
    pendingSettings = readStoredSettings();
  }

  return {
    persistSettings,
    readStoredSettings,
    maybeRestoreSettings,
    settingsSlot,
    settingsStorageKey,
    loadPending,
  };
}

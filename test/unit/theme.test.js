import { describe, it, expect } from "vitest";
import { createTheme, THEMES } from "../../src/theme.js";

/**
 * A context whose `selection` is a GETTER, the way navio.js builds it.
 *
 * init() rebinds the closure's `selection` from the caller's string to a d3
 * selection (src/navio.js:710-713), and backgroundBehind walks up from its
 * node. A context that captured the value at construction would still be
 * holding the string. `rebind` here reproduces that so the contract is tested,
 * not assumed.
 */
function ctxWith(nv, node) {
  let selection = node ? { node: () => node } : null;
  const ctx = {
    nv,
    get selection() {
      return selection;
    },
  };
  const t = createTheme(ctx);
  // navio.js does exactly this: resolvedTheme is a PUBLIC method, and theme()
  // reads it back off nv so that a caller who replaces it is still obeyed.
  nv.resolvedTheme = t.resolvedTheme;
  return {
    ctx,
    t,
    rebind(next) {
      selection = next ? { node: () => next } : null;
    },
  };
}

describe("resolvedTheme", () => {
  it("returns an explicit theme without consulting anything else", () => {
    const { t } = ctxWith({ theme: "dark" }, null);
    expect(t.resolvedTheme()).toBe("dark");

    const light = ctxWith({ theme: "light" }, null);
    expect(light.t.resolvedTheme()).toBe("light");
  });

  it("falls back to light when nothing paints a background", () => {
    const { t } = ctxWith({ theme: "auto" }, null);
    expect(t.resolvedTheme()).toBe("light");
  });
});

describe("theme", () => {
  it("hands back the colour table for the resolved theme", () => {
    const { t } = ctxWith({ theme: "dark" }, null);
    expect(t.theme()).toBe(THEMES.dark);
  });
});

describe("divisionsColour", () => {
  it("follows the theme when the option is the null sentinel", () => {
    const { t } = ctxWith({ theme: "light", divisionsColor: null }, null);
    expect(t.divisionsColour()).toBe(THEMES.light.divisions);
  });

  it("follows the theme when the option was never set at all", () => {
    const { t } = ctxWith({ theme: "dark" }, null);
    expect(t.divisionsColour()).toBe(THEMES.dark.divisions);
  });

  it("uses a colour the caller set, in either theme", () => {
    const dark = ctxWith({ theme: "dark", divisionsColor: "#ff0000" }, null);
    expect(dark.t.divisionsColour()).toBe("#ff0000");

    const light = ctxWith({ theme: "light", divisionsColor: "#ff0000" }, null);
    expect(light.t.divisionsColour()).toBe("#ff0000");
  });
});

describe("tooltipBackground", () => {
  it("follows the theme when the option is the null sentinel", () => {
    const { t } = ctxWith({ theme: "dark", tooltipBgColor: null }, null);
    expect(t.tooltipBackground()).toBe(THEMES.dark.tooltipBg);
  });

  it("uses a colour the caller set", () => {
    const { t } = ctxWith({ theme: "light", tooltipBgColor: "#abcdef" }, null);
    expect(t.tooltipBackground()).toBe("#abcdef");
  });
});

describe("the selection binding", () => {
  it("reads the live binding, not one captured at construction", () => {
    // Constructed while `selection` is still null, as navio() does before
    // init() runs. backgroundBehind must see the node bound afterwards.
    const { t, rebind } = ctxWith({ theme: "auto" }, null);
    expect(t.backgroundBehind()).toBe(null);

    // backgroundBehind bails out when there is no window, so the walk is only
    // observable with one. Stubbed for this test alone and restored after -
    // a global `window` would change what resolvedTheme answers everywhere
    // else in this file.
    const hadWindow = "window" in globalThis;
    globalThis.window = {};
    globalThis.getComputedStyle = () => ({ backgroundColor: "rgba(0,0,0,0)" });
    try {
      let asked = false;
      rebind({
        get parentElement() {
          asked = true;
          return null;
        },
      });
      t.backgroundBehind();
      expect(asked, "backgroundBehind walked up from the rebound node").toBe(
        true
      );
    } finally {
      if (!hadWindow) delete globalThis.window;
      delete globalThis.getComputedStyle;
    }
  });
});

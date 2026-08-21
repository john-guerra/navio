import * as d3 from "d3";

/**
 * The colours of Navio's own furniture, per theme.
 *
 * Navio ships no stylesheet - every colour is an inline style or a canvas
 * stroke - so a dark page got black labels on a black ground and there was no
 * CSS hook to fix it from outside. These are the values that answer to
 * nv.theme; the DATA scales deliberately do not appear here.
 *
 * The light column is what Navio drew before 0.3.0, so nothing moves on a
 * light page.
 */
export const THEMES = {
  light: {
    ink: "#000000", // labels, counts, the close button glyph
    muted: "#666666", // secondary text in the panel
    faint: "#777777", // tooltip footnote
    border: "#000000", // the box around a level
    surface: "#ffffff", // panel and button backgrounds
    hairline: "#bbbbbb", // panel and button borders
    divisions: "white", // lines between rows
    tooltipBg: "#b2ddf1",
    tooltipInk: "#000000",
  },
  dark: {
    ink: "#e9eaee",
    muted: "#9aa0aa",
    faint: "#8b919b",
    border: "#8a919c",
    surface: "#1b1e24",
    hairline: "#3a3f48",
    divisions: "#1b1e24",
    tooltipBg: "#204a5e",
    tooltipInk: "#eef4f8",
  },
};

/**
 * Theme resolution for one Navio instance.
 *
 * `ctx.selection` MUST be a getter. init() rebinds the closure's `selection`
 * from whatever the caller passed - a string in every example in this repo - to
 * a d3 selection (src/navio.js:710-713), and that happens AFTER this factory is
 * constructed. backgroundBehind walks up from `selection.node()`, so a context
 * that captured the value would still be holding the string and would throw.
 * The same applies to every other non-const binding a module is given.
 *
 * `applyTheme` deliberately does NOT live here: it restyles the gear, the panel
 * and the tooltip, which belong to the settings panel. Keeping it out is what
 * makes this module a leaf, with no import back into its siblings.
 *
 * @param {object} ctx - { nv, get selection() }
 */
export function createTheme(ctx) {
  /**
   * The colour actually painted behind the widget, or null if nothing paints
   * one all the way up.
   *
   * Backgrounds are transparent by default, so the nearest ancestor that
   * actually sets one is what a reader sees behind the labels - a dark panel on
   * a light page included.
   */
  function backgroundBehind() {
    if (
      typeof window === "undefined" ||
      !ctx.selection ||
      !ctx.selection.node()
    )
      return null;
    let el = ctx.selection.node();
    while (el) {
      const c = d3.color(getComputedStyle(el).backgroundColor);
      if (c && c.opacity > 0) return c;
      el = el.parentElement;
    }
    return null;
  }

  /**
   * Which way to colour the chrome.
   *
   * Whether a dark page is being asked for. Read fresh rather than cached: with
   * theme "auto" the answer changes when the reader changes their system
   * setting, and a widget that only looked once would be wrong for the rest of
   * the session.
   *
   * "auto" means MATCH WHAT IS BEHIND ME, not "match the reader's operating
   * system". Following prefers-color-scheme alone put a dark-themed widget on
   * every page that had never opted into dark mode: the reader's system says
   * dark, the page is still white, and the labels came out pale grey on white.
   * Ten of the twelve examples in this repo are such pages, and so is most of
   * the web.
   *
   * So the background decides. Only when NOTHING paints one - the browser's own
   * canvas is showing - does the reader's preference get a say, and then only
   * if the page declared `color-scheme`, which is precisely the page saying "I
   * follow the reader".
   */
  function resolvedTheme() {
    if (ctx.nv.theme === "dark" || ctx.nv.theme === "light")
      return ctx.nv.theme;
    if (typeof window === "undefined") return "light";

    const bg = backgroundBehind();
    // L* is perceptual lightness: 50 is the middle of the range, and a ground
    // below it needs light ink on top.
    if (bg) return d3.lab(bg).l < 50 ? "dark" : "light";

    const declared =
      getComputedStyle(document.documentElement).colorScheme || "";
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return declared.indexOf("dark") !== -1 && prefersDark ? "dark" : "light";
  }

  /**
   * The current chrome colours.
   *
   * Goes through `ctx.nv.resolvedTheme` rather than calling the local function
   * directly, because `resolvedTheme` is a PUBLIC method: a caller who replaces
   * it expects `theme()` to follow, and it did before this module existed.
   */
  function theme() {
    return THEMES[ctx.nv.resolvedTheme()] || THEMES.light;
  }

  /**
   * divisionsColor and nullColor are public options whose default is now `null`
   * - the sentinel for "follow the theme". Anything a caller sets is theirs and
   * is used in both themes, because a colour someone chose deliberately is not
   * ours to override.
   */
  function divisionsColour() {
    return ctx.nv.divisionsColor === null || ctx.nv.divisionsColor === undefined
      ? theme().divisions
      : ctx.nv.divisionsColor;
  }
  function tooltipBackground() {
    return ctx.nv.tooltipBgColor === null || ctx.nv.tooltipBgColor === undefined
      ? theme().tooltipBg
      : ctx.nv.tooltipBgColor;
  }

  return {
    theme,
    resolvedTheme,
    divisionsColour,
    tooltipBackground,
    backgroundBehind,
  };
}

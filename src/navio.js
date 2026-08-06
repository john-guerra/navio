// import * as d3 from "./../../node_modules/d3/dist/d3.js"; // Force react to use the es6 module

import * as d3 from "d3";

// import {
//   interpolateBlues,
//   interpolatePurples,
//   interpolateBrBG,
//   interpolateOranges,
//   interpolateGreys,
// } from "d3-scale-chromatic";

import Popper from "popper.js";

import {
  FilterByRange,
  FilterByValue,
  FilterByValueDifferent,
  FilterByRangeNegative,
  filterFromValue,
} from "./filters.js";
import {
  scaleText,
  scaleOrdered,
  d3AscendingNull,
  d3DescendingNull,
} from "./scales.js";
import {
  getAttribsFromObjectRecursive,
  getAttribsFromObjectAsFn,
} from "./utils.js";

let navioInstanceCount = 0;

// Injected by rollup (see versionIntro in rollup.config.js) so it tracks
// package.json automatically. Undefined when src/ is imported directly.
const VERSION =
  typeof __NAVIO_VERSION__ !== "undefined" ? __NAVIO_VERSION__ : "dev";

// Announced once per page load, not per instance. Loading the wrong build is
// easy to do and invisible otherwise - notebooks and CDNs cache aggressively,
// and unpkg's unpinned URL silently follows whatever is latest.
//
// Browser only: importing this module under Node (SSR, a build step, a test that
// never constructs a widget) should not write to stdout, which a consumer piping
// JSON would have to filter out.
if (
  typeof document !== "undefined" &&
  typeof console !== "undefined" &&
  console.info
) {
  console.info(`navio ${VERSION}`);
}

//selection should be a d3 selection or a string with the id of the element
/**
 * @param selection  a d3 selection, or a selector string
 * @param _h         the height, OR an options object. Passing a number is the
 *                   original signature and still works; an object lets every
 *                   option be set at construction instead of assigned one by
 *                   one afterwards, which also gets the ordering right for the
 *                   options that are only read once (see OPTION_PHASE).
 */
function navio(selection, _h) {
  "use strict";
  const instanceId = ++navioInstanceCount;
  const _options = _h !== null && typeof _h === "object" ? _h : null;
  let nv = this || {},
    data = [], //Contains the original data attributes
    dataIs = [], //Contains only the indices to the data, is an array of arrays, one for each level
    links = [],
    visibleLinks = [],
    dData = new Map(), // A hash for the data
    attribsOrdered = [],
    // Names of attributes the user has hidden from the panel (#89). Hiding is
    // NOT removal: the attribute keeps its inferred type, its colour scale and
    // its place in attribsOrdered, so unhiding is instant and nothing that
    // references it - a sort, a filter - can dangle.
    hiddenAttribs = new Set(),
    dAttribs = new Map(),
    dSortBy = [], //contains which attribute to sort by on each column
    dBrushes = [],
    filtersByLevel = [], // The filters applied to each level
    yScales = [],
    // scale object -> its inverted quantize scale. See invertOrdinalScale (#62).
    invertScaleCache = new WeakMap(),
    xScale,
    x,
    height = _options
      ? _options.height !== undefined
        ? _options.height
        : 600
      : _h !== undefined
        ? _h
        : 600,
    colScales = new Map(),
    levelScale,
    svg,
    canvas,
    context,
    tooltip,
    tooltipElement,
    liveRegion,
    settingsButton,
    settingsPanel,
    pendingSettings = null,
    // The scrolling wrapper between the container and the canvas. It has to be
    // reachable outside init(): it CLIPS, so its height is part of the layout.
    divNavio = null,
    // Titles of the settings sections the user has folded away. Held here
    // because drawSettingsPanel rebuilds the panel from scratch on every type
    // change, reorder and header drag - a <details> element's own state would
    // spring back open each time.
    collapsedSections = new Set(),
    // True while a pointer is held down on a control inside the settings
    // panel, so the panel cannot reposition itself mid-drag.
    panelPointerHeld = false,
    // What this widget looked like before any stored settings landed on it -
    // the state Reset goes back to. Captured once, the first time there are
    // attributes to capture.
    defaultSettings = null,
    // Screen pixels the filter chips need BELOW the canvas. The chips are drawn
    // past the end of the record axis, which is outside the canvas, so both
    // boxes have to be told to cover them - see applyContainerSize.
    explanationsPad = 0,
    tooltipCoords = { x: -50, y: -50 },
    id = "__seqId",
    updateCallback = function () {},
    changeListeners = [],
    // Navio's bookkeeping lives in side tables keyed by a row's index into
    // `data`, never on the caller's objects. Writing to the rows polluted them,
    // and - because two Navios given the same array share the same row objects
    // - let one instance silently overwrite another's selection. See #88.
    selectedFlags = new Uint8Array(0),
    posByLevel = [],
    rowIndex = null,
    cursorSubstractData =
      "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMzJweCIgaGVpZ2h0PSIzMnB4IiB2aWV3Qm94PSIwIDAgMzIgMzIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDU0LjEgKDc2NDkwKSAtIGh0dHBzOi8vc2tldGNoYXBwLmNvbSAtLT4KICAgIDx0aXRsZT5jdXJzb3JTdWJzdHJhY3Q8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iY3Vyc29yU3Vic3RyYWN0IiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8cGF0aCBkPSJNOSwwLjUgTDcsMC41IEw3LDcgTDAuNSw3IEwwLjUsOSBMNyw5IEw3LDE1LjUgTDksMTUuNSBMOSw5IEwxNS41LDkgTDE1LjUsNyBMOSw3IEw5LDAuNSBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIHN0cm9rZT0iI0ZGRkZGRiIgZmlsbD0iIzAwMDAwMCI+PC9wYXRoPgogICAgICAgIDxyZWN0IGlkPSJSZWN0YW5nbGUiIGZpbGw9IiMwMDAwMDAiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE1LjAwMDAwMCwgMTUuMDAwMDAwKSByb3RhdGUoLTI3MC4wMDAwMDApIHRyYW5zbGF0ZSgtMTUuMDAwMDAwLCAtMTUuMDAwMDAwKSAiIHg9IjE0IiB5PSIxMSIgd2lkdGg9IjIiIGhlaWdodD0iOCI+PC9yZWN0PgogICAgPC9nPgo8L3N2Zz4=",
    cursorAddData =
      "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMzJweCIgaGVpZ2h0PSIzMnB4IiB2aWV3Qm94PSIwIDAgMzIgMzIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDU0LjEgKDc2NDkwKSAtIGh0dHBzOi8vc2tldGNoYXBwLmNvbSAtLT4KICAgIDx0aXRsZT5jdXJzb3JBZGQ8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iY3Vyc29yQWRkIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8cGF0aCBkPSJNOSwwLjUgTDcsMC41IEw3LDcgTDAuNSw3IEwwLjUsOSBMNyw5IEw3LDE1LjUgTDksMTUuNSBMOSw5IEwxNS41LDkgTDE1LjUsNyBMOSw3IEw5LDAuNSBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIHN0cm9rZT0iI0ZGRkZGRiIgZmlsbD0iIzAwMDAwMCI+PC9wYXRoPgogICAgICAgIDxwYXRoIGQ9Ik0xNiwxNCBMMTksMTQgTDE5LDE2IEwxNiwxNiBMMTYsMTkgTDE0LDE5IEwxNCwxNiBMMTEsMTYgTDExLDE0IEwxNCwxNCBMMTQsMTEgTDE2LDExIEwxNiwxNCBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIGZpbGw9IiMwMDAwMDAiPjwvcGF0aD4KICAgIDwvZz4KPC9zdmc+",
    cursorData =
      "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMzJweCIgaGVpZ2h0PSIzMnB4IiB2aWV3Qm94PSIwIDAgMzIgMzIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDU0LjEgKDc2NDkwKSAtIGh0dHBzOi8vc2tldGNoYXBwLmNvbSAtLT4KICAgIDx0aXRsZT5jdXJzb3I8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iY3Vyc29yIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8cGF0aCBkPSJNOSwwLjUgTDcsMC41IEw3LDcgTDAuNSw3IEwwLjUsOSBMNyw5IEw3LDE1LjUgTDksMTUuNSBMOSw5IEwxNS41LDkgTDE1LjUsNyBMOSw3IEw5LDAuNSBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIHN0cm9rZT0iI0ZGRkZGRiIgZmlsbD0iIzAwMDAwMCI+PC9wYXRoPgogICAgPC9nPgo8L3N2Zz4=";

  // Default parameters
  nv.x0 = 0; //Where to start drawing navio in x
  nv.y0 = 100; //Where to start drawing navio in y, useful if your attrib names are too long
  // addAllAttribs decides an attribute is categorical below the first
  // threshold, ordered below the second, and text above it. Set the second to
  // Infinity to never choose text.
  nv.maxNumDistinctForCategorical = 10;
  nv.maxNumDistinctForOrdered = 90;
  nv.howManyItemsShouldSearchForNotNull = 100; // How many rows should addAllAttribs search to decide guess an attribute type
  nv.margin = 10; // Margin around navio

  nv.levelsSeparation = 40; // Separation between the levels
  nv.divisionsColor = "white"; // Border color for the divisions
  nv.nullColor = "#ffedfd"; // Color for null values
  nv.levelConnectionsColor = "rgba(205, 220, 163, 0.5)"; // Color for the connections between levels
  nv.divisionsThreshold = 4; // What's the minimum row height needed to draw divisions
  nv.fmtCounts = d3.format(",.0d"); // Format used to display the counts on the bottom
  nv.linkColor = "#ccc"; // Color used for network links if provided with nv.links()
  nv.nestedFilters = true; // Should navio use nested levels?

  nv.showAttribTitles = true; // Show headers?
  nv.attribWidth = 15; // Width of the columns
  nv.attribRotation = -45; // Headers rotation
  nv.attribFontSize = 13; // Headers font size
  nv.attribFontSizeSelected = 32; // Headers font size when mouse over

  // "horizontal" (default): attributes across, records down - the historical
  // layout. "vertical": transposed, attributes down and records across. See #22.
  nv.orientation = "horizontal";
  // A brush shorter than this many pixels is treated as a click, not a range.
  // Without it, a click with a little pointer drift did nothing at all.
  nv.clickTolerance = 4;
  // Show the gear button that opens the settings panel (#89). Embedders who
  // want a fixed configuration set this to false.
  nv.settings = true;
  // Where the panel opens, all of which keep the widget visible except "over":
  //   "below"  under the widget, left-aligned. Column width changes the
  //            canvas WIDTH, so a below-panel does not move when you drag the
  //            column-width slider - the default for that reason.
  //   "beside" to the right of the canvas; moves as the canvas widens.
  //   "over"   compact overlay on the widget, for layouts with no room.
  //
  // A modal placement (dialog.showModal, the top layer) was built and removed:
  // it centres in the VIEWPORT, which with two Navios on a page puts the panel
  // nowhere near the widget it belongs to, and its one real advantage - being
  // unclippable - does not reach an Observable notebook, whose body is a
  // sandboxed cross-origin iframe the top layer cannot escape.
  nv.settingsPlacement = "below";
  // Past this many columns the attribute list scrolls inside its own box
  // instead of pushing Layout, Colours and Filtering below the fold. The
  // bulk buttons stay outside the scroll area, so they never scroll away.
  nv.settingsMaxAttribRows = 10;
  // Swap the settings panel's attribute picker. See defaultAttribPicker for
  // the contract; examples/settings plugs in @john-guerra/search-checkbox.
  nv.attribPicker = null;
  nv.filterFontSize = 8; // Font size of the filters explanations on the bottom

  nv.tooltipFontSize = 12; // Font size for the tooltip
  nv.tooltipBgColor = "#b2ddf1"; // Font color for tooltip background
  nv.tooltipMargin = 50; // How much to separate the tooltip from the cursor
  nv.tooltipArrowSize = 10; // How big is the arrow on the tooltip

  nv.addAllAttribsRecursionLevel = Infinity; // How many levels depth do we keep on adding nested attributes
  nv.addAllAttribsIncludeObjects = false; // Should addAllAttribs include objects
  nv.addAllAttribsIncludeArrays = false; // Should addAllAttribs include arrays

  nv.digitsForText = 2; // How many digits to use for text attributes
  nv.digitsForObjects = Infinity; // How many digits to use for Arrays and Objects attributes

  nv.defaultColorInterpolator = d3.interpolateBlues;
  nv.defaultColorInterpolatorDate = d3.interpolatePurples;
  nv.defaultColorInterpolatorDiverging = d3.interpolateBrBG;
  nv.defaultColorInterpolatorOrdered = d3.interpolateOranges;
  nv.defaultColorInterpolatorText = d3.interpolateGreys;
  nv.defaultColorInterpolatorObject = d3.interpolateGreens;
  // nv.defaultColorInterpolatorObject = t => d3.interpolateTurbo(t*.95+0.05);

  nv.defaultColorRangeBoolean = ["#a1d76a", "#e9a3c9", "white"]; //true false null
  nv.defaultColorRangeSelected = ["white", "#b5cf6b"];
  nv.defaultColorCategorical = d3.schemeCategory10;

  nv.showSelectedAttrib = true; // Display the attribute that shows if a row is selected
  nv.showSequenceIDAttrib = true; // Display the attribute with the sequence ID
  // Trace Navio's internals to the console. Inherited from navio.DEBUG so it
  // can be switched on BEFORE any instance exists - otherwise everything logged
  // during construction and the first data() call is already gone by the time
  // you can reach nv.DEBUG. Still settable per instance afterwards.
  nv.DEBUG = navio.DEBUG === true;
  nv.stringify = JSON.stringify; // function to use to stringify the data, for speeding up use d => d

  // ---------------------------------------------------------------------
  // Options
  //
  // Every option above is a plain property, and the set of them IS the schema -
  // snapshotted here rather than written out by hand, so it can never drift
  // from the defaults it describes.
  // ---------------------------------------------------------------------
  const OPTION_NAMES = new Set(Object.keys(nv));

  // Renamed options. The old spelling still works and forwards to the new one,
  // because these shipped: silently ignoring `maxNumDistictForCategorical`
  // would change how a published notebook types its attributes.
  const RENAMED = {
    maxNumDistictForCategorical: "maxNumDistinctForCategorical",
    maxNumDistictForOrdered: "maxNumDistinctForOrdered",
  };
  const warnedRenames = new Set();
  for (const [oldName, newName] of Object.entries(RENAMED)) {
    Object.defineProperty(nv, oldName, {
      enumerable: false, // keeps it out of OPTION_NAMES and getOptions()
      configurable: true,
      get() {
        return nv[newName];
      },
      set(v) {
        if (!warnedRenames.has(oldName)) {
          warnedRenames.add(oldName);
          console.warn(
            `navio: "${oldName}" was a typo and is now "${newName}". ` +
              `The old name still works but will be removed.`
          );
        }
        nv[newName] = v;
      },
    });
  }

  /**
   * Which options must be applied before which phase.
   *
   * Most options are re-read on every draw, so when they are set does not
   * matter. These are the exceptions - they are read once, inside the call
   * named here, so setting them afterwards silently does nothing. applyOptions
   * uses this to apply everything in an order that actually works, rather than
   * relying on the caller to know.
   */
  const OPTION_PHASE = {
    // read by addAllAttribs
    maxNumDistinctForCategorical: "attribs",
    maxNumDistinctForOrdered: "attribs",
    howManyItemsShouldSearchForNotNull: "attribs",
    addAllAttribsRecursionLevel: "attribs",
    addAllAttribsIncludeObjects: "attribs",
    addAllAttribsIncludeArrays: "attribs",
    digitsForText: "attribs",
    digitsForObjects: "attribs",
    // read inside data()
    showSelectedAttrib: "data",
    showSequenceIDAttrib: "data",
    tooltipFontSize: "data",
    tooltipBgColor: "data",
    tooltipMargin: "data",
    tooltipArrowSize: "data",
    settings: "data",
    settingsPlacement: "data",
  };

  /**
   * Apply an options object.
   *
   * Unknown keys warn rather than throw: throwing would break anyone already
   * passing extra keys, and silence is what let `attribWidht: 999` sit there
   * doing nothing. `height` and `data` are handled by the caller, not here.
   */
  // Getter/setter APIs rather than plain properties, so they are applied by
  // CALLING them. They are defined further down the closure, after
  // OPTION_NAMES is snapshotted, so without this list `{ id: "id" }` - the
  // commonest thing anyone configures - would be rejected as unknown. Worse,
  // assigning it would replace the accessor function with a string.
  const ACCESSOR_OPTIONS = new Set(["id", "updateCallback", "links"]);

  function applyOptions(options = {}) {
    if (!options || typeof options !== "object") return;
    for (const [key, value] of Object.entries(options)) {
      if (key === "height" || key === "data" || key === "value") continue;
      if (ACCESSOR_OPTIONS.has(key)) {
        nv[key](value);
        continue;
      }
      if (!OPTION_NAMES.has(key) && !(key in RENAMED)) {
        console.warn(
          `navio: unknown option "${key}" - ignored. ` +
            `See nv.getOptions() for the full list.`
        );
        continue;
      }
      nv[key] = value;
    }
  }

  /** Every option and its current value. The shape accepted by the options
   *  argument, so nv.getOptions() round-trips back into a new instance. */
  nv.getOptions = function () {
    const out = {};
    for (const key of OPTION_NAMES) out[key] = nv[key];
    // The accessor-backed ones, read through their getters.
    out.id = nv.id();
    return out;
  };

  /**
   * Apply an options object to a LIVE instance, then redraw.
   *
   * Options in OPTION_PHASE are read once, during construction or inside
   * data()/addAllAttribs, so setting them here is too late - warn rather than
   * let them appear to work. Pass them to the constructor instead, or call
   * nv.data(nv.data()) afterwards to re-run the phase that reads them.
   */
  nv.setOptions = function (options) {
    for (const key of Object.keys(options || {})) {
      const phase = OPTION_PHASE[key];
      if (!phase) continue;
      console.warn(
        `navio: "${key}" is read once, inside ${
          phase === "attribs" ? "addAllAttribs()" : "data()"
        }. Setting it now has no effect - pass it to the constructor, or call ` +
          `nv.data(nv.data()) to re-run that step.`
      );
    }
    applyOptions(options);
    nv.hardUpdate();
    return nv;
  };

  // function nozoom(event) {
  //   if (nv.DEBUG) console.log("nozoom");
  //   event.preventDefault();
  // }

  function initTooltipPopper() {
    if (nv.DEBUG)
      console.log("initTooltipPopper, selection", selection, selection.node());
    if (tooltip && typeof tooltip.destroy === "function") tooltip.destroy();
    if (tooltipElement) tooltipElement.remove();

    // Anything this instance left behind inside the container, from before the
    // tooltip was moved out to <body>.
    selection.selectAll("._nv_popover").remove();

    // The tooltip lives on <body>, NOT inside the container.
    //
    // Popper positions against a virtual reference (there is no DOM node under
    // the cursor to anchor to), and popper.js v1 falls back to
    // document.documentElement whenever the reference has no nodeType. So the
    // offsets it computes are document-relative. If the tooltip sits inside the
    // container and any ancestor is positioned, the browser resolves those same
    // numbers against that ancestor instead, and the tooltip lands off by the
    // ancestor's distance down the page. Observable notebook cells are
    // position:relative, which is why the tooltip appeared a few hundred pixels
    // below the cursor there but was fine in the flat example pages.
    tooltipElement = d3
      .select(document.body)
      .append("div")
      .attr("class", "_nv_popover")
      // On <body> the tooltips of several instances are siblings, so stamp the
      // owner. destroy() works off the closure reference; this makes ownership
      // inspectable (and testable) from outside.
      .attr("data-navio-instance", instanceId)
      .style("top", 0)
      .style("left", 0)
      // .style("text-shadow", "0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff")
      .style("pointer-events", "none")
      .style("font-family", "sans-serif")
      .style("font-size", nv.tooltipFontSize)
      .style("text-align", "center")
      .style("background", nv.tooltipBgColor)
      .style("position", "absolute")
      .style("color", "black")
      // High, because the tooltip is a <body> child now: at z-index 4 it painted
      // underneath ordinary app chrome such as a Bootstrap modal backdrop
      // (1040). Cannot beat the browser's top layer (dialog.showModal, the
      // Popover API) - nothing positioned can.
      .style("z-index", 2147483000)
      .style("border-radius", "4px")
      .style("box-shadow", "0 0 2px rgba(0,0,0,0.5)")
      .style("padding", "10px")
      .style("text-align", "center")
      .style("display", "none");

    tooltipElement.append("style").attr("scoped", "").text(`
        [x-arrow] {
          width: 0;
          height: 0;
          border-style: solid;
          position: absolute;
          margin: ${nv.tooltipArrowSize}px;
          border-color: ${nv.tooltipBgColor}
        }

        ._nv_popover[x-placement="left"] {
            margin-right: ${nv.tooltipArrowSize + nv.tooltipMargin}px;
        }

        ._nv_popover[x-placement="left"] [x-arrow] {
          border-width: ${nv.tooltipArrowSize}px 0 ${nv.tooltipArrowSize}px ${
            nv.tooltipArrowSize
          }px;
          border-top-color: transparent;
          border-right-color: transparent;
          border-bottom-color: transparent;
          right: -${nv.tooltipArrowSize}px;
          top: calc(50% - ${nv.tooltipArrowSize}px);
          margin-left: 0;
          margin-right: 0;
        }

        ._nv_popover[x-placement="right"] {
            margin-left: ${nv.tooltipArrowSize + nv.tooltipMargin}px;
        }

        ._nv_popover[x-placement="right"] [x-arrow] {
          border-width: ${nv.tooltipArrowSize}px ${nv.tooltipArrowSize}px ${
            nv.tooltipArrowSize
          }px 0;
          border-left-color: transparent;
          border-top-color: transparent;
          border-bottom-color: transparent;
          left: -${nv.tooltipArrowSize}px;
          top: calc(50% - ${nv.tooltipArrowSize}px);
          margin-left: 0;
          margin-right: 0;
        }

        ._nv_popover[x-placement="bottom"] {
            margin-top: ${nv.tooltipArrowSize + nv.tooltipMargin}px;
        }

        ._nv_popover[x-placement="bottom"] [x-arrow] {
          border-width: 0 ${nv.tooltipArrowSize}px ${nv.tooltipArrowSize}px ${
            nv.tooltipArrowSize
          }px;
          border-left-color: transparent;
          border-right-color: transparent;
          border-top-color: transparent;
          top: -${nv.tooltipArrowSize}px;
          left: calc(50% - ${nv.tooltipArrowSize}px);
          margin-top: 0;
          margin-bottom: 0;
        }

        ._nv_popover[x-placement="top"] {
            margin-bottom: ${nv.tooltipArrowSize + nv.tooltipMargin}px;
        }

        ._nv_popover[x-placement="top"] [x-arrow] {
          border-width: ${nv.tooltipArrowSize}px ${nv.tooltipArrowSize}px 0 ${
            nv.tooltipArrowSize
          }px;
          border-left-color: transparent;
          border-right-color: transparent;
          border-bottom-color: transparent;
          bottom: -${nv.tooltipArrowSize}px;
          left: calc(50% - ${nv.tooltipArrowSize}px);
          margin-top: 0;
          margin-bottom: 0;
        }


      `);

    tooltipElement.append("div").attr("class", "tool_id");

    tooltipElement
      .append("div")
      .attr("class", "tool_value_name")
      .style("font-weight", "bold")
      .style("font-size", "120%");

    tooltipElement
      .append("div")
      .attr("class", "tool_value_val")
      .style("max-width", "400px")
      .style("max-height", "5.5em")
      .style("text-align", "left")
      .style("overflow", "hidden")
      .style("font-size", "90%");

    tooltipElement
      .append("div")
      .style("font-size", "70%")
      .style("margin-top", "10px")
      .style("text-align", "left")
      .style("color", "#777")
      .html(`<div>Click to filter a value (<strong>alt</strong> for negative filter).<br>
        Drag for filtering a range.<br> <strong>shift</strong> click for appending to the filters</div>`);

    tooltipElement.append("div").attr("x-arrow", "");

    const ref = {
      getBoundingClientRect: () => {
        const svgBR = svg.node().getBoundingClientRect();
        return {
          top: tooltipCoords.y + svgBR.top,
          right: tooltipCoords.x + svgBR.left,
          bottom: tooltipCoords.y + svgBR.top,
          left: tooltipCoords.x + svgBR.left,
          width: 0,
          height: 0,
        };
      },
      clientWidth: 0,
      clientHeight: 0,
    };

    tooltip = new Popper(ref, tooltipElement.node(), {
      placement: "right",
      // modifiers: {
      //   preventOverflow: {
      //     boundariesElement: selection.node(),
      //   },
      // },
    });
  }

  function changeCursorOnKey(event) {
    // Scoped to this instance's own container so multiple Navio instances on
    // the same page don't repaint each other's brush-overlay cursors.
    if (event.key === "Alt") {
      selection
        .selectAll(".overlay")
        .attr("cursor", `url(${cursorSubstractData}) 8 8, zoom-out`)
        .style("cursor", `url(${cursorSubstractData}) 8 8, zoom-out`);
      // console.log("Alt!");
    } else if (event.key === "Shift") {
      selection
        .selectAll(".overlay")
        .attr("cursor", `url(${cursorAddData}) 8 8, zoom-in`)
        .style("cursor", `url(${cursorAddData}) 8 8, zoom-in`);
      // console.log("Alt!");
    } else {
      selection
        .selectAll(".overlay")
        .style("cursor", `url(${cursorData}) 8 8, crosshair`);
    }

    if (event.type === "keyup")
      selection
        .selectAll(".overlay")
        .style("cursor", `url(${cursorData}) 8 8, crosshair`);
    // console.log("key", event.type);
  }

  function init() {
    // An array here is data, not a container. d3.select() wraps it without
    // complaint, so the mistake only surfaces one call later as
    // "this.querySelectorAll is not a function" - a message naming nothing the
    // caller typed. The UMD default export IS this factory (see src/index.js),
    // which makes navio(data, opts) an easy and invisible slip in a notebook.
    if (Array.isArray(selection)) {
      throw new TypeError(
        "navio(selection, options) expects a d3 selection, an element or a " +
          "selector string, but received an array. To pass rows directly, " +
          "use navio.NavioWidget(data, options)."
      );
    }

    // Try to support strings and elements
    selection =
      typeof selection === typeof "" ? d3.select(selection) : selection;
    selection =
      selection.selectAll === undefined ? d3.select(selection) : selection;

    selection.selectAll("*").remove();

    divNavio = selection
      // .on("touchstart", nozoom)
      // .on("touchmove", nozoom)
      .style("height", height + "px")
      .attr("class", "navio")
      .append("div")
      // Lets a widget with many levels scroll sideways. Note that this CLIPS
      // vertically too: CSS forces the other axis to `auto` when one axis is
      // not `visible`, so `overflow-x: auto` alone is never what it looks
      // like. applyContainerSize sizes this box to include the filter chips.
      .style("overflow-x", "auto")
      .style("position", "relative");

    divNavio.append("canvas");
    svg = divNavio
      .append("svg")
      .style("overflow", "visible")
      .style("position", "absolute")
      // .style("cursor", `url(${cursorData}) 8 8, crosshair`)
      .style("z-index", 3)
      .style("top", 0)
      .style("left", 0);

    divNavio
      .append("div")
      .attr("class", "explanations")
      .style("overflow", "visible")
      .style("position", "absolute")
      .style("z-index", 5)
      .style("top", nv.margin + "px")
      .style("left", nv.margin + "px");

    // Namespaced per instance so multiple Navio instances on the same page
    // don't overwrite each other's keydown/keyup listener on `body` (d3's
    // .on() replaces same-type-same-namespace listeners on the same node).
    d3.select("body")
      .on(`keydown.navio-${instanceId}`, changeCursorOnKey)
      .on(`keyup.navio-${instanceId}`, changeCursorOnKey);

    // Focus styling. The controls added for #68 are focusable, and a column
    // header's <g> spans the full height of the level - so a plain :focus
    // outline drew a large box around the whole column on every CLICK, which
    // is both ugly and useless (a mouse user can see what they clicked).
    // :focus-visible restricts it to keyboard navigation, where it is the
    // whole point. Scoped to this instance's svg via a <style> child, since
    // Navio ships no stylesheet.
    svg.append("style").text(`
      /* The focusable element is the column's <g>, which spans the whole
         level - a ring on it draws a large box down the widget. Put the ring
         on the LABEL instead: it is inside the rotated group, so the outline
         rotates with the text and hugs it. */
      .attribOverlay:focus,
      .attribOverlay:focus-visible,
      #closeButton path:focus {
        outline: none;
      }
      .attribOverlay:focus-visible text {
        outline: 2px solid #1a73e8;
        outline-offset: 2px;
      }
      /* Shift-clicking to drag counts as keyboard-ish focus in Chrome, so the
         ring would appear for the whole drag. It says nothing useful there -
         the dimmed label and the drop indicator already show what is moving. */
      .attribOverlay._nv_dragging text {
        outline: none;
      }
      #closeButton path:focus-visible {
        outline: 2px solid #1a73e8;
        outline-offset: 1px;
      }
    `);

    svg
      .append("g")
      .attr("class", "attribs")
      // Sorting is ONE click handler, here, on the group that contains every
      // header - the glyphs, the hit strips and the columns.
      //
      // Anything narrower does not fire reliably. A click that presses on a
      // label and releases on a strip - a few pixels of hand tremor is enough,
      // the strips are only ~15px wide - dispatches to their common ancestor,
      // which is neither of them, so per-label and per-strip handlers both
      // miss it and nothing happens. That was the "I cannot sort by clicking"
      // report. Here the ancestor is always this group, so it always fires;
      // the level and the column come from where the pointer is, and a click
      // outside the header band is ignored.
      .on("click", function (event) {
        if (!dataIs.length || !yScales.length) return;
        const p = d3.pointer(event, svg.node());
        const alongA = isVertical() ? p[1] : p[0],
          alongR = isVertical() ? p[0] : p[1];

        const level = invertOrdinalScale(levelScale, alongA);
        if (level === undefined || !yScales[level]) return;
        // The header band only; the data area belongs to the brush.
        if (alongR >= yScales[level].range()[0]) return;

        const attrib = columnAtPointer(event, level);
        if (attrib === undefined) return;

        const el = this;
        showLoading(el);
        requestAnimationFrame(() => {
          onSortLevel(event, {
            attrib,
            name: getAttribName(attrib),
            level,
          });
          hideLoading(el);
        });
      });

    // A canvas-drawn widget is opaque to a screen reader, so describe it and
    // announce what changes (#68). role=group rather than application: the
    // controls inside are ordinary buttons and should keep native behaviour.
    svg
      .attr("role", "group")
      .attr(
        "aria-label",
        "Navio: a column per attribute, a row per record. Sort with the column headers, filter by clicking a value or dragging a range."
      );

    // Same :focus-visible treatment for the HTML filter chips, which live
    // outside the svg so the svg's <style> does not reach them.
    selection.append("style").text(`
      .filterExplanation > div:focus { outline: none; }
      .filterExplanation > div:focus-visible {
        outline: 2px solid #1a73e8;
        outline-offset: 1px;
      }
    `);

    liveRegion = selection
      .append("div")
      .attr("class", "_nv_live")
      .attr("role", "status")
      .attr("aria-live", "polite")
      .attr("aria-atomic", "true")
      // Available to assistive tech, absent from the visual layout.
      .style("position", "absolute")
      .style("width", "1px")
      .style("height", "1px")
      .style("overflow", "hidden")
      .style("clip", "rect(0 0 0 0)")
      .style("white-space", "nowrap")
      .style("border", "0")
      .style("padding", "0")
      .style("margin", "-1px");

    initSettingsPanel();
    // NOT restored here: at init() there is no data and no attributes yet, so
    // hiddenAttribs and attribOrder would resolve against an empty list. It is
    // applied on the first draw that has attributes - see maybeRestoreSettings.
    pendingSettings = readStoredSettings();

    initTooltipPopper();

    // Where a dragged column would land. Above the columns, below the
    // headers, and pointer-transparent so it never eats the drag.
    svg
      .append("line")
      .attr("class", "_nv_drop_indicator")
      .style("display", "none")
      .style("pointer-events", "none")
      .style("stroke", "#1a73e8")
      .style("stroke-width", 3)
      .style("stroke-linecap", "round");

    svg
      .append("g")
      .attr("id", "closeButton")
      .style("fill", "white")
      .style("stroke", "black")
      .style("display", "none")
      .append("path")
      .call(function (sel) {
        let crossSize = 7,
          path = d3.path(); // Draw a cross and a circle
        path.moveTo(0, 0);
        path.lineTo(crossSize, crossSize);
        path.moveTo(crossSize, 0);
        path.lineTo(0, crossSize);
        path.moveTo(crossSize * 1.2 + crossSize / 2, crossSize / 2);
        path.arc(crossSize / 2, crossSize / 2, crossSize * 1.2, 0, Math.PI * 2);
        sel.attr("d", path.toString());
      })
      .on("click pointerup", () => deleteSubsequentLevels()) //delete last level
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", "Close the last filter level")
      .on("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        deleteSubsequentLevels();
      });

    xScale = d3
      .scaleBand()
      // .rangeBands([0, nv.attribWidth], 0.1, 0);
      .range([0, nv.attribWidth])
      .round(true)
      .paddingInner(0.1)
      .paddingOuter(0);
    levelScale = d3.scaleBand().round(true);
    colScales = new Map();

    x = function (val, level) {
      return levelScale(level) + xScale(val);
    };

    // Orientation (#22).
    //
    // Navio has two logical axes: the ATTRIBUTE axis, along which the columns
    // are laid out, and the RECORD axis, along which one line per row is drawn.
    // Horizontal (the default and the historical behaviour) puts attributes on
    // x and records on y; vertical transposes them. Every piece of geometry
    // below is expressed in (attribute, record) and mapped through toXY, so the
    // two orientations share one implementation rather than mirroring code.
    //
    // x(val, level) and yScales[level] keep their names: they are the
    // attribute-axis and record-axis scales respectively, whichever screen
    // direction those happen to be.

    canvas = selection.select("canvas").node();

    const ctxWidth = levelScale.range()[1] + nv.margin + nv.x0;
    // canvas.style.position = "absolute";
    canvas.style.top = canvas.offsetTop + "px";
    canvas.style.left = canvas.offsetLeft + "px";
    canvas.style.width = ctxWidth + "px";
    canvas.style.height = height + "px";

    const scale = window.devicePixelRatio;
    canvas.width = ctxWidth * scale;
    canvas.height = height * scale;

    context = canvas.getContext("2d");

    context.scale(scale, scale);

    context.imageSmoothingEnabled =
      context.mozImageSmoothingEnabled =
      context.webkitImageSmoothingEnabled =
        false;

    context.globalCompositeOperation = "source-over";
  }

  function showLoading(ele) {
    d3.select(ele).style("cursor", "progress");
    svg.style("cursor", "progress");
  }

  function hideLoading(ele) {
    // d3.select("._nv_loading").remove();
    d3.select(ele).style("cursor", null);
    svg.style("cursor", null);
  }

  /**
   * Inverts a band scale: given a pixel offset, which domain entry is there.
   *
   * Taken from https://bl.ocks.org/shimizu/808e0f5cadb6a63f28bb00082dc8fe3f
   *
   * Called from showTooltip and onSelectByRange, so it runs on every mousemove
   * during a hover or a brush drag. It used to build a fresh d3.scaleQuantize
   * each time - and worse, `scale.domain()` on a band scale returns a COPY, so
   * a 24k-row level allocated a 24k-element array per pointer event. Cached per
   * scale instead. See #62.
   */
  function invertOrdinalScale(scale, x) {
    let qScale = invertScaleCache.get(scale);
    if (!qScale) {
      qScale = d3.scaleQuantize().domain(scale.range()).range(scale.domain());
      invertScaleCache.set(scale, qScale);
    }
    return qScale(x);
  }

  /**
   * yScales[level] is replaced wholesale on every update, so keying the cache
   * on the scale object already invalidates those. xScale and levelScale are
   * mutated in place, though, so their entries have to be dropped explicitly -
   * a stale one would report the wrong column under the cursor.
   */
  function invalidateInvertCache() {
    invertScaleCache = new WeakMap();
  }

  function updateSorting(levelToUpdate, _dataIs) {
    if (!Object.prototype.hasOwnProperty.call(dSortBy, levelToUpdate)) {
      if (nv.DEBUG)
        console.log(
          "UpdateSorting called without attrib in dSortBy",
          levelToUpdate,
          dSortBy
        );
      return;
    }

    _dataIs = _dataIs !== undefined ? _dataIs : dataIs;

    let before = performance.now();

    const sort = dSortBy[levelToUpdate];
    // attribAt, not getAttrib: "__seqId" and "selected" are drawn columns
    // backed by side tables rather than row properties (#88), so reading them
    // off the row gives undefined for EVERY row - the comparator then returned
    // 0 throughout and sorting by the sequential index silently did nothing.
    _dataIs[levelToUpdate].sort(function (a, b) {
      return sort.desc
        ? d3DescendingNull(attribAt(a, sort.attrib), attribAt(b, sort.attrib))
        : d3AscendingNull(attribAt(a, sort.attrib), attribAt(b, sort.attrib));
    });
    assignIndexes(_dataIs[levelToUpdate], levelToUpdate);

    let after = performance.now();
    if (nv.DEBUG)
      console.log(
        "Sorting level " + levelToUpdate + " " + (after - before) + "ms"
      );
  }

  function onSortLevel(event, d) {
    if (nv.DEBUG) console.log("click " + d);
    if (event && event.defaultPrevented) {
      if (nv.DEBUG) console.log("clicked, defaultPrevented");
      return; // dragged
    }

    // Clicking the attribute already sorted by flips the direction.
    const desc =
      dSortBy[d.level] !== undefined && dSortBy[d.level].attrib === d.attrib
        ? !dSortBy[d.level].desc
        : false;

    applySort(d.level, d.attrib, desc);
  }

  // The single implementation of "sort this level", shared by the header-click
  // handler and by nv.sortBy so the UI and the public API cannot drift apart.
  // nv.sortBy used to set dSortBy and call nv.update(), which only redraws -
  // updateSorting was never reached, so the data was never actually reordered
  // while the header still gained its sort arrow. See #81.
  function applySort(level, attrib, desc, { silent = false } = {}) {
    dSortBy[level] = { attrib, desc };

    // A re-sort invalidates range filters further down the chain, since those
    // are expressed as positions in an ordering that no longer holds.
    deleteObsoleteFiltersFromLevel(level + 1);

    // A range filter AT this level keeps its rows - filters are evaluated once,
    // at creation - but it was authored as a band in the ordering being
    // replaced, so its label would otherwise describe a range that is no longer
    // visible anywhere. See #82.
    if (filtersByLevel[level]) {
      for (const f of filtersByLevel[level]) {
        if (f.markSortStale) f.markSortStale();
      }
    }

    updateSorting(level);
    removeBrushOnLevel(level);

    nv.updateData(dataIs, colScales, { levelsToUpdate: [level] });

    notifyChange({ silent });

    return nv;
  }

  // Every settled change funnels through here.
  //
  // `silent` marks a change Navio made on someone's behalf - setFilters
  // replaying a value - so a programmatic apply cannot re-enter and re-emit.
  // The guard has to live in the mutation path rather than in a wrapper,
  // because applyFiltersAndUpdate and deleteSubsequentLevels notify
  // unconditionally at the end of their work.
  /**
   * A transition, unless the reader asked for less motion (#68) - or the
   * selection has no transition() at all, which is the case under some test
   * harnesses.
   */
  function animated(sel, duration = 150) {
    if (sel.transition === undefined) return sel;
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return sel;
    }
    return sel.transition().duration(duration);
  }

  /** Send a message to the live region, if there is one yet. */
  function announce(message) {
    if (liveRegion) liveRegion.text(message);
  }

  /** What the current selection and filter chain amount to, in words. */
  function announceState() {
    if (!liveRegion || !data.length) return;
    const shown = nv.getVisible().length;
    const chips = filtersByLevel
      .filter((lvl) => lvl && lvl.length)
      .map((lvl) => lvl.map((f) => f.toStr()).join(" or "));
    announce(
      `${shown} of ${data.length} rows selected` +
        (chips.length ? `. Filters: ${chips.join("; then ")}` : ". No filters")
    );
  }

  function notifyChange({ silent = false } = {}) {
    // The legacy single-subscriber slot is always called, exactly as before.
    updateCallback(nv.getVisible());
    announceState();
    if (silent) return;
    // Copy first: a listener may unsubscribe itself while we iterate.
    for (const fn of changeListeners.slice()) fn();
  }

  /**
   * Index of a row within `data`. Accepts an index unchanged, so internal
   * callers (which already have one) pay nothing.
   *
   * The lookup table is built lazily: most work here is index-driven and never
   * needs it, and for a million rows the map is not free.
   */
  /**
   * The id value for a row index.
   *
   * The default id used to be a `__seqId` property written onto every row - but
   * `data` is never reordered (only `dataIs[level]` is), so it always equalled
   * the row's index. It is now derived rather than stored. A custom id set via
   * nv.id() points at one of the caller's own fields and is read as before.
   */
  function idOf(index) {
    return id === "__seqId" ? index : getAttrib(data[index], id);
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
    if (attrib === "selected") return !!selectedFlags[index];
    return getAttrib(data[index], attrib);
  }

  /**
   * The attributes that are actually laid out and drawn.
   *
   * Everything that turns attributes into geometry goes through this;
   * `attribsOrdered` remains the full, ordered set. Colour domains
   * deliberately still walk the full set, so unhiding needs no recompute.
   */
  function visibleAttribs() {
    return hiddenAttribs.size
      ? attribsOrdered.filter((a) => !hiddenAttribs.has(getAttribName(a)))
      : attribsOrdered;
  }

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

  /** Options safe to expose: each is re-read on every hardUpdate(). */
  const LIVE_OPTIONS = [
    {
      key: "height",
      hint: "The widget's extent along the RECORD axis - screen height when horizontal, width when vertical. More room means fewer rows share a pixel line.",
      label: "Size along records",
      min: 100,
      max: 1200,
      step: 20,
      get: () => nv.height(),
      set: (v) => nv.height(v),
    },
    {
      key: "attribWidth",
      hint: "How wide each column is drawn. Narrow columns fit more attributes on screen; wide ones make individual values easier to compare.",
      label: "Column width",
      min: 4,
      max: 60,
      step: 1,
    },
    {
      key: "attribFontSize",
      hint: "Size of the column header labels. Capped by the column width, so widening a column can be what actually makes a header legible.",
      label: "Header font",
      min: 6,
      max: 24,
      step: 1,
    },
    {
      key: "attribFontSizeSelected",
      hint: "Size a header grows to while the pointer is over it, so a rotated label can be read without changing the layout.",
      label: "Header font (hover)",
      min: 6,
      max: 32,
      step: 1,
    },
    {
      key: "attribRotation",
      hint: "Angle of the column headers, in degrees. 0 is horizontal and -90 is vertical; steeper angles fit longer names above narrow columns. Ignored in vertical orientation, where labels are upright.",
      label: "Header angle",
      min: -90,
      max: 0,
      step: 5,
    },
    {
      key: "levelsSeparation",
      hint: "Horizontal gap between drill-down levels. The filter chips are drawn in this gap, so a wider gap gives them more room.",
      label: "Level gap",
      min: 0,
      max: 200,
      step: 5,
    },
    {
      key: "filterFontSize",
      hint: "Size of the filter chips under the levels.",
      label: "Filter font",
      min: 6,
      max: 20,
      step: 1,
    },
    {
      key: "margin",
      hint: "Blank space around the drawing, inside the widget.",
      label: "Margin",
      min: 0,
      max: 100,
      step: 5,
    },
    {
      key: "x0",
      hint: "Offset of the whole drawing from the container's left edge.",
      label: "Left offset",
      min: 0,
      max: 200,
      step: 5,
    },
    {
      key: "y0",
      hint: "Offset of the whole drawing from the container's top edge. Headroom for the rotated column headers, which are drawn above the data.",
      label: "Top offset",
      min: 0,
      max: 300,
      step: 5,
    },
    {
      key: "divisionsThreshold",
      hint: "How many pixels a row must occupy before dividing lines are drawn between rows. Below this the lines would be thicker than the rows.",
      label: "Row divider threshold",
      min: 0,
      max: 20,
      step: 1,
    },
    {
      key: "clickTolerance",
      hint: "How far the pointer may drift during a click and still count as a click rather than a range selection. Raise it if selecting a single value is difficult.",
      label: "Click tolerance",
      min: 0,
      max: 20,
      step: 1,
    },
  ];

  /** Colours re-read on every draw. Excludes the ones baked into scales. */
  const LIVE_COLOURS = [
    {
      key: "divisionsColor",
      hint: "Colour of the lines drawn between rows when they are tall enough.",
      label: "Row dividers",
    },
    {
      key: "levelConnectionsColor",
      hint: "Colour of the ribbons linking a level to the rows it came from.",
      label: "Level connections",
    },
    {
      key: "linkColor",
      hint: "Colour of the curves drawn for links passed via nv.links().",
      label: "Links",
    },
    {
      key: "tooltipBgColor",
      hint: "Background of the hover tooltip.",
      label: "Tooltip background",
      needsData: true,
    },
  ];

  /** <input type="color"> only accepts #rrggbb, so normalise whatever is set. */
  function toHex(colour) {
    const c = d3.color(colour);
    return c ? c.formatHex() : "#000000";
  }

  function styleButton(sel) {
    return sel
      .style("font", "13px sans-serif")
      .style("background", "#fff")
      .style("border", "1px solid #bbb")
      .style("border-radius", "4px")
      .style("padding", "2px 8px")
      .style("cursor", "pointer");
  }

  /** Everything the panel can change, as a plain JSON-safe object. */
  nv.getSettings = function () {
    const out = { orientation: nv.orientation, height: height };
    for (const o of LIVE_OPTIONS)
      if (o.key !== "height") out[o.key] = nv[o.key];
    for (const c of LIVE_COLOURS) out[c.key] = nv[c.key];
    for (const k of [
      "showAttribTitles",
      "showSelectedAttrib",
      "showSequenceIDAttrib",
      "nestedFilters",
    ])
      out[k] = nv[k];
    out.hiddenAttribs = Array.from(hiddenAttribs);
    out.attribTypes = Object.fromEntries(
      attribsOrdered.map((a) => [getAttribName(a), nv.getAttribType(a)])
    );
    out.attribOrder = attribsOrdered.map((a) => getAttribName(a));
    out.collapsedSections = Array.from(collapsedSections);
    return out;
  };

  /**
   * Apply a settings object. Deliberately does NOT touch filters or the
   * selection - those are getFilters()/setFilters(), and keeping the two
   * separate is what lets settings be restored without disturbing a
   * selection the user has already made.
   */
  nv.setSettings = function (cfg = {}) {
    if (!cfg || typeof cfg !== "object") return nv;
    for (const k of Object.keys(cfg)) {
      if (
        k === "hiddenAttribs" ||
        k === "attribOrder" ||
        k === "attribTypes" ||
        k === "collapsedSections" ||
        k === "height"
      )
        continue;
      if (k in nv) nv[k] = cfg[k];
    }
    // Not an nv property - it is panel state, held in the closure.
    if (Array.isArray(cfg.collapsedSections))
      collapsedSections = new Set(cfg.collapsedSections);
    if (typeof cfg.height === "number") height = cfg.height;
    if (Array.isArray(cfg.attribOrder)) {
      cfg.attribOrder.forEach((name, i) => {
        const a = attribsOrdered.find((x) => getAttribName(x) === name);
        if (a) moveAttrToPos(a, i);
      });
    }
    if (Array.isArray(cfg.hiddenAttribs)) {
      hiddenAttribs = new Set(cfg.hiddenAttribs);
    }
    if (cfg.attribTypes) {
      for (const [name, type] of Object.entries(cfg.attribTypes)) {
        if (type && nv.getAttribType(name) !== type)
          nv.setAttribType(name, type);
      }
    }
    nv.hardUpdate();
    if (settingsIsOpen()) drawSettingsPanel();
    return nv;
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
   * Within a page, instances are told apart by the container's own id when it
   * has one - stable across reloads however the page is built - falling back to
   * construction order.
   */
  function settingsSlot() {
    const host = selection && selection.node && selection.node();
    const domId = host && host.id;
    return domId ? `#${domId}` : `${instanceId}`;
  }

  function settingsStorageKey() {
    if (nv.settingsKey !== undefined) return nv.settingsKey;
    const page =
      typeof location !== "undefined"
        ? `${location.origin}${location.pathname}`
        : "";
    return `navio.settings.${page}.${settingsSlot()}`;
  }

  function persistSettings() {
    const key = settingsStorageKey();
    if (!key || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(nv.getSettings()));
    } catch (e) {
      // Private mode, quota, disabled storage - never break the widget for it.
      if (nv.DEBUG) console.log("navio: could not persist settings", e);
    }
  }

  function readStoredSettings() {
    const key = settingsStorageKey();
    if (!key || typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      if (nv.DEBUG) console.log("navio: could not read settings", e);
      return null;
    }
  }

  /**
   * Apply stored settings once the widget actually has attributes to apply
   * them to. Runs at most once; after that the panel owns the state.
   */
  function maybeRestoreSettings() {
    if (!attribsOrdered.length) return;
    // Snapshot BEFORE anything stored is applied: the defaults are what the
    // caller constructed, not what a previous session left behind. Taken here
    // rather than at construction because there are no attributes to record
    // until data() and addAllAttribs have run.
    if (!defaultSettings) defaultSettings = nv.getSettings();
    if (!pendingSettings) return;
    const cfg = pendingSettings;
    pendingSettings = null;
    nv.setSettings(cfg);
  }

  /**
   * Save the current settings now. Plain option properties (nv.attribWidth =
   * 20) cannot notify anyone, so call this after setting them if you want the
   * change remembered.
   */
  nv.saveSettings = function () {
    persistSettings();
    return nv;
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
  nv.resetSettings = function () {
    nv.clearStoredSettings();
    collapsedSections = new Set();
    if (defaultSettings) nv.setSettings(defaultSettings);
    else nv.hardUpdate();
    if (settingsIsOpen()) drawSettingsPanel();
    // setSettings does not write, and nothing else should either: the point of
    // Reset is that a reload comes back to the defaults too.
    return nv;
  };

  /** Forget the stored settings on disk, leaving the live widget alone. */
  nv.clearStoredSettings = function () {
    const key = settingsStorageKey();
    if (key && typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        if (nv.DEBUG) console.log("navio: could not clear settings", e);
      }
    }
    return nv;
  };

  /** The JS that would reproduce the current settings on a fresh instance. */
  nv.getSettingsCode = function () {
    const cfg = nv.getSettings();
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

  function initSettingsPanel() {
    if (settingsPanel) settingsPanel.remove();
    if (settingsButton) settingsButton.remove();
    settingsPanel = settingsButton = null;
    if (!nv.settings) return;

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
    const host = selection.node();
    if (host) {
      const pos = host.isConnected
        ? getComputedStyle(host).position
        : host.style.position;
      if (!pos || pos === "static") selection.style("position", "relative");
    }

    settingsButton = styleButton(selection.append("button"))
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
    settingsPanel = selection
      .append("dialog")
      .attr("class", "_nv_settings")
      .attr("aria-label", "Widget settings")
      .attr("data-navio-instance", instanceId)
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
      .style("background", "#fff")
      .style("border", "1px solid #bbb")
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

    const host = selection.node(),
      cv = canvas;
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

    if (nv.settingsPlacement === "over") {
      settingsPanel.style("left", "2px").style("bottom", "26px");
      return;
    }

    if (nv.settingsPlacement === "beside") {
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
    if (selection && selection.node() && selection.node().contains(t)) return;
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
    const max = nv.settingsMaxAttribRows;
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
      getAttribName(a) === "__seqId" ? "sequential Index" : getAttribName(a);
    const names = attribsOrdered.map(label);

    // One row per column, so this is the section that grows without bound and
    // pushes everything else out of reach. It folds, and past
    // settingsMaxAttribRows columns the list scrolls inside itself as well.
    const attribs = settingsSection(settingsPanel, "Attributes", {
      collapsible: true,
      hint: `${visibleAttribs().length} of ${names.length} shown`,
    });
    attribs
      .append("div")
      .style("font-size", "11px")
      .style("color", "#666")
      .style("margin-bottom", "4px")
      .text("Untick to hide. Drag a name, or use the arrows, to reorder.");

    // The picker is pluggable. The default is a plain checkbox list with
    // reorder arrows; set nv.attribPicker to swap in something richer - see
    // examples/settings, which plugs in @john-guerra/search-checkbox. Navio
    // must not fetch that itself: d3 and popper.js are already external and
    // the library takes no further dependencies.
    const picker = nv.attribPicker || defaultAttribPicker;
    const pickerEl = picker(names, {
      value: visibleAttribs().map(label),
      onChange: (visibleNames) => {
        const shown = new Set(visibleNames);
        nv.setHiddenAttribs(
          attribsOrdered
            .filter((a) => !shown.has(label(a)))
            .map((a) => getAttribName(a))
        );
        persistSettings();
        announce(`${shown.size} of ${names.length} columns shown`);
      },
      // The picker deals in LABELS ("sequential Index"), not attribute names
      // ("__seqId"), so the mapping back has to happen here rather than in the
      // picker - which is also why these are callbacks and not raw API.
      types: nv.getAttribTypes(),
      getType: (name) =>
        nv.getAttribType(attribsOrdered.find((a) => label(a) === name)),
      setType: (name, type) => {
        const attrib = attribsOrdered.find((a) => label(a) === name);
        nv.setAttribType(attrib, type);
        announce(`${name} is now ${type}`);
        persistSettings();
        drawSettingsPanel();
      },
      // Derived columns are drawn from side tables, not from a data column,
      // so re-typing them would only break how they render.
      canSetType: (name) => {
        const attrib = attribsOrdered.find((a) => label(a) === name);
        const n = getAttribName(attrib);
        return n !== "__seqId" && n !== "selected";
      },
      move: (name, delta) => {
        const attrib = attribsOrdered.find((a) => label(a) === name);
        const from = attribsOrdered.indexOf(attrib),
          to = from + delta;
        if (from === -1 || to < 0 || to >= attribsOrdered.length) return;
        moveAttrToPos(attrib, to);
        nv.updateData(dataIs);
        announce(`Moved ${name} to position ${to + 1}`);
        persistSettings();
        drawSettingsPanel();
      },
      instanceId,
    });
    if (pickerEl) {
      attribs.node().appendChild(pickerEl);
      // After the append: measuring a row needs it to be in the document.
      capAttribList(pickerEl, names.length);
    }

    // A custom picker only owns visibility, so the type controls that the
    // built-in one carries in its rows would otherwise disappear with it.
    if (nv.attribPicker) {
      const types = settingsSection(settingsPanel, "Attribute types");
      const trow = types
        .selectAll("div")
        .data(
          attribsOrdered
            .filter((a) => {
              const n = getAttribName(a);
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
        .attr("aria-label", (d) => `Type of ${d.name}`)
        .style("font-size", "11px")
        .on("change", function (event, d) {
          nv.setAttribType(d.attrib, this.value);
          announce(`${d.name} is now ${this.value}`);
          persistSettings();
        })
        .selectAll("option")
        .data((d) =>
          nv.getAttribTypes().map((t) => ({ ...t, attrib: d.attrib }))
        )
        .enter()
        .append("option")
        .attr("value", (t) => t.value)
        .property("selected", (t) => nv.getAttribType(t.attrib) === t.value)
        .text((t) => t.label);
    }

    // --- layout ----------------------------------------------------------
    const layout = settingsSection(settingsPanel, "Layout");
    const orient = layout
      .append("label")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "6px")
      .style("margin-bottom", "6px");
    orient
      .attr(
        "title",
        "Which way the two axes run. Horizontal puts attributes across and one row per pixel line down; vertical transposes both."
      )
      .append("span")
      .style("flex", "1")
      .text("Orientation");
    const orientSel = orient.append("select").on("change", function () {
      nv.orientation = this.value;
      nv.hardUpdate();
      announce(`Orientation ${this.value}`);
    });
    orientSel
      .selectAll("option")
      .data(["horizontal", "vertical"])
      .enter()
      .append("option")
      .attr("value", (d) => d)
      .property("selected", (d) => d === nv.orientation)
      .text((d) => d);

    // Where this very panel opens. Changing it has to reopen the dialog,
    // because modal and non-modal are two different open() calls - a live
    // switch cannot just restyle what is already showing.
    const place = layout
      .append("label")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "6px")
      .style("margin-bottom", "6px");
    place
      .attr(
        "title",
        "Where this panel opens. Below keeps the widget visible and does not move while you drag a slider; beside needs room to the right; over is for tight layouts."
      )
      .append("span")
      .style("flex", "1")
      .text("Settings panel");
    const placeSel = place.append("select").on("change", function () {
      nv.settingsPlacement = this.value;
      persistSettings();
      toggleSettings(false);
      toggleSettings(true);
      announce(`Settings panel ${this.value}`);
    });
    placeSel
      .selectAll("option")
      .data(["below", "beside", "over"])
      .enter()
      .append("option")
      .attr("value", (d) => d)
      .property("selected", (d) => d === nv.settingsPlacement)
      .text((d) => d);

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
      const read = opt.get || (() => nv[opt.key]);
      const write = opt.set || ((v) => (nv[opt.key] = v));
      const out = row
        .append("span")
        .style("width", "34px")
        .style("text-align", "right")
        .style("color", "#666")
        .text(read());
      row
        .append("input")
        .attr("type", "range")
        .attr("min", opt.min)
        .attr("max", opt.max)
        .attr("step", opt.step)
        .attr("aria-label", opt.label)
        .property("value", read())
        .style("width", "90px")
        .on("input", function () {
          write(+this.value);
          out.text(this.value);
          if (!opt.set) nv.hardUpdate(); // opt.set does its own redraw
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
        .attr("aria-label", c.label)
        .property("value", toHex(nv[c.key]))
        .style("width", "40px")
        .on("input", function () {
          nv[c.key] = this.value;
          // Tooltip options are read in initTooltipPopper, which only runs on
          // data(); everything else is re-read on the next draw.
          if (c.needsData) nv.data(nv.data());
          else nv.hardUpdate();
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
        .property("checked", !!nv[t.key])
        .on("change", function () {
          nv[t.key] = this.checked;
          // The two derived columns were only ever ADDED, inside data(), and
          // only when the flag was already true - so unticking left the column
          // exactly where it was and re-ticking found it already in colScales
          // and did nothing either. Drive the visibility set instead, which is
          // what "display this column" means and which works both ways.
          if (t.column) nv.setAttribVisible(t.column, this.checked);
          else nv.hardUpdate();
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
      .property("checked", !!nv.nestedFilters)
      .on("change", function () {
        nv.nestedFilters = this.checked;
        announce(`Nested filters ${this.checked ? "on" : "off"}`);
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
        const code = nv.getSettingsCode();
        try {
          await navigator.clipboard.writeText(code);
          announce("Configuration copied to the clipboard");
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
          announce("Configuration ready to copy");
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
        nv.resetSettings();
        announce("Settings reset");
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

  /** True when attributes run down the screen and records run across (#22). */
  function isVertical() {
    return nv.orientation === "vertical";
  }

  /**
   * Map a logical (attribute-axis, record-axis) point to screen coordinates.
   * This single function is what makes the two orientations one implementation.
   */
  function toXY(a, r) {
    return isVertical() ? { x: r, y: a } : { x: a, y: r };
  }

  /** Screen width and height for a box that is `a` along A and `r` along R. */
  function toWH(a, r) {
    return isVertical() ? { width: r, height: a } : { width: a, height: r };
  }

  /** A row's position within its level, from the side table. */
  function posAt(index, level) {
    const p = posByLevel[level];
    return p ? p[index] : undefined;
  }

  function indexOfRow(rowOrIndex) {
    if (typeof rowOrIndex === "number") return rowOrIndex;
    if (!rowOrIndex || typeof rowOrIndex !== "object") return undefined;
    if (!rowIndex) {
      rowIndex = new WeakMap();
      for (let i = 0; i < data.length; i++) rowIndex.set(data[i], i);
    }
    return rowIndex.get(rowOrIndex);
  }

  function getAttrib(item, attrib) {
    if (typeof attrib === "function") {
      try {
        return attrib(item);
      } catch (e) {
        if (nv.DEBUG)
          console.log(
            "navio error getting attrib with item ",
            item,
            " attrib ",
            attrib,
            "error",
            e
          );
        return undefined;
      }
    } else {
      return item[attrib];
    }
  }

  function getAttribName(attrib) {
    if (typeof attrib === "function") {
      return attrib.name ? attrib.name : attrib;
    } else {
      return attrib;
    }
  }

  function drawItem(rowIdx, level) {
    const item = data[rowIdx];
    let attrib, i, y;

    const drawn = visibleAttribs();
    context.save();
    for (i = 0; i < drawn.length; i++) {
      attrib = drawn[i];
      // `selected` is a rendered column but is no longer a row property.
      // `selected` and `__seqId` are rendered columns but no longer row
      // properties - both are derived from the row's index. See #88.
      const val =
        attrib === "selected"
          ? !!selectedFlags[rowIdx]
          : attrib === "__seqId"
            ? rowIdx
            : getAttrib(item, attrib);
      const attribName = getAttribName(attrib);

      y = Math.round(
        yScales[level](idOf(rowIdx)) + yScales[level].bandwidth() / 2
      );
      // y = yScales[level](item[id]) + yScales[level].bandwidth()/2;

      // One stroke per (record, attribute) cell: it runs the width of the
      // attribute band along A, and is as thick as one record along R.
      const aStart = Math.round(x(attribName, level)),
        aEnd = Math.round(x(attribName, level) + xScale.bandwidth()),
        p0 = toXY(aStart, y),
        p1 = toXY(aEnd, y);
      context.beginPath();
      context.moveTo(p0.x, p0.y);
      context.lineTo(p1.x, p1.y);
      context.lineWidth = Math.ceil(yScales[level].bandwidth());
      // context.lineWidth = 1;

      context.strokeStyle =
        val === undefined || val === null || val === "" || val === "none"
          ? nv.nullColor
          : colScales.get(attrib)(val);

      context.stroke();

      // TODO get this out
      //If the range bands are tick enough draw divisions
      if (yScales[level].bandwidth() > nv.divisionsThreshold * 2) {
        let yLine = Math.round(yScales[level](idOf(rowIdx)));
        // y = yScales[level](item[id])+yScales[level].bandwidth()/2;
        const d0 = toXY(x(attribName, level), yLine),
          d1 = toXY(x(attribName, level) + xScale.bandwidth(), yLine);
        context.beginPath();
        context.moveTo(d0.x, d0.y);
        context.lineTo(d1.x, d1.y);
        context.lineWidth = 1;
        // context.lineWidth = 1;
        context.strokeStyle = nv.divisionsColor;
        context.stroke();
      }
    }
    context.restore();
  } // drawItem

  function drawLevelBorder(i) {
    context.save();
    context.beginPath();
    const origin = toXY(levelScale(i), yScales[i].range()[0] - 1),
      size = toWH(
        xScale.range()[1] + 1,
        yScales[i].range()[1] + 2 - yScales[i].range()[0]
      );
    context.rect(origin.x, origin.y, size.width, size.height);
    context.strokeStyle = "black";
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }

  // Level groups are identified by #levelN, which is NOT unique when several
  // Navios share a page - a document-wide d3.select would always return the
  // first instance's element and move the wrong widget's brush. Same class of
  // bug as #57; always go through this.
  function brushesOnLevel(lev) {
    return selection.select("#level" + lev).selectAll(".brush");
  }

  function removeBrushOnLevel(lev) {
    if (lev < 0 || !dBrushes[lev]) return;
    brushesOnLevel(lev).call(dBrushes[lev].move, null);
  }

  function removeAllBrushesBut(but) {
    for (let lev = 0; lev < dataIs.length; lev += 1) {
      if (lev === but) continue;
      removeBrushOnLevel(lev);
    }
  }

  // Assigns the indexes on the new level data
  function assignIndexes(dataIsToUpdate, level) {
    if (nv.DEBUG) console.log("Assigning indexes ", level);
    // One Int32Array per level, allocated on first use, rather than an array
    // object hanging off every row. See #88.
    if (!posByLevel[level]) posByLevel[level] = new Int32Array(data.length);
    for (let j = 0; j < dataIsToUpdate.length; j++) {
      posByLevel[level][dataIsToUpdate[j]] = j;
    }
  }

  // Some actions will make obsolete certain filters, such as a resort on a previous level
  // with range filters
  function deleteObsoleteFiltersFromLevel(level) {
    for (let l = level; l < filtersByLevel.length; l++) {
      // filtersByLevel can be sparse: deleteSubsequentLevels bails out early
      // when the level is missing from dataIs, so an index can exist without
      // ever having been assigned. A level with no filters has nothing to make
      // obsolete, so skip it rather than dereferencing a hole.
      if (!filtersByLevel[l]) continue;
      filtersByLevel[l] = filtersByLevel[l].filter(
        // Only positional ranges are invalidated by a re-sort. Value-based
        // filters - including valueRange, which compares raw attribute values
        // rather than __i[level] - mean the same thing in any ordering.
        (f) =>
          f.type === "value" ||
          f.type === "negativeValue" ||
          f.type === "valueRange"
      );
    }
  }

  // Applies the filters for the selected level, using the passed data if any
  function applyFilters(level, _dataIs) {
    let before, after;

    _dataIs = _dataIs !== undefined ? _dataIs : dataIs;

    if (nv.DEBUG)
      console.log(
        "applyFilters level=",
        level,
        " filtersByLevel ",
        filtersByLevel
      );

    before = performance.now();
    // Check if each item fits on any filter
    const negFilters = filtersByLevel[level].filter(
        (f) => f.type === "negativeValue" || f.type === "negativeRange"
      ),
      posFilters = filtersByLevel[level].filter(
        (f) => f.type !== "negativeValue" && f.type !== "negativeRange"
      );

    let filteredData = _dataIs[level].filter((d) => {
      // OR of positives, AND of negatives.
      //
      // With no positive filter the starting set is everything at this level,
      // so the OR has to seed to true. Seeding it to false (the correct seed
      // for an OR over a non-empty set) made a level holding only negative
      // filters select nothing at all - a single alt-click emptied the whole
      // widget. See #79.
      const keptByPositives = posFilters.length
        ? posFilters.reduce((p, f) => p || f.filter(data[d], d), false)
        : true;

      const keep =
        keptByPositives &&
        negFilters.reduce((p, f) => p && f.filter(data[d], d), true);
      selectedFlags[d] = keep ? 1 : 0;
      return keep;
      // // Check if a possitive filter apply
      // for (let filter of posFilters) {
      //   if (filter.filter(data[d])) {
      //     data[d].selected = true;
      //     // break;
      //     return data[d].selected;
      //   }
      // }

      // for (let filter of negFilters) {
      //   if (filter.filter(data[d])) {
      //     data[d].selected = false;
      //     return data[d].selected;
      //   }
      // }

      // return true;
    });

    // let filteredData = filtersByLevel[level].reduce(reduceFilters, dataIs[level]);
    after = performance.now();
    if (nv.DEBUG) console.log("Applying filters " + (after - before) + "ms");

    return filteredData;
  }

  function getLastLevelFromFilters() {
    let lastLevel = 0;
    for (let i = 0; i < filtersByLevel.length; i++) {
      lastLevel = i;
      if (!filtersByLevel[i] || !filtersByLevel[i].length) {
        break;
      }
    }

    return lastLevel;
  }

  function applyFiltersAndUpdate(fromLevel, { silent = false } = {}) {
    if (nv.DEBUG) console.log("applyFiltersAndUpdate ", fromLevel);

    const lastLevel = getLastLevelFromFilters();

    // Start from the previous data
    let newData = dataIs;

    for (let level = fromLevel; level <= lastLevel; level++) {
      // We don't have filters for this level, delete subsequent levels
      if (
        !Object.prototype.hasOwnProperty.call(filtersByLevel, level) ||
        !filtersByLevel[level].length
      ) {
        newData = deleteSubsequentLevels(level + 1, newData, {
          shouldUpdate: false,
        });
        break;
      }
      // else apply filters

      let filteredData = applyFilters(level, newData);

      //Assign the index
      assignIndexes(filteredData, level + 1);

      if (filteredData.length === 0) {
        if (nv.DEBUG) console.log("Empty filteredData!");
        //   return;
      }
      // newData = dataIs.slice(0,level+1);

      if (nv.nestedFilters) {
        // newData.push(filteredData);
        newData[level + 1] = filteredData;
      }

      // Update sortings of the next level
      updateSorting(level + 1);
      if (nv.DEBUG)
        console.log(
          `ApplyFiltersAndUpdate level ${level} filtered = ${filteredData.length} `
        );
    }

    // Update all the levels
    nv.updateData(newData, colScales, {
      shouldDrawBrushes: true,
      levelsToUpdate: d3.range(fromLevel, newData.length), // Range is not inclusive so is not length-1
    });

    if (nv.DEBUG)
      console.log("All filters applied calling updateCallback", dataIs);
    notifyChange({ silent });
  }

  function updateBrushes(d, level) {
    // The brush selects a RANGE OF RECORDS, so it runs along R: brushY when
    // records go down the screen, brushX when they go across (#22).
    //
    // Hiding every column empties the ATTRIBUTE scale's domain, so domain()[0]
    // and domain()[length - 1] are both undefined; scaleBand answers undefined
    // for a value it does not know, and `levelScale(level) + undefined` is NaN.
    // d3 then writes that NaN straight into the brush rects and the browser
    // rejects each one - "<rect> attribute y: Expected length, NaN", several
    // per redraw. An empty widget has nothing to brush, so collapse the
    // attribute extent to zero rather than letting it go non-finite.
    const domain = xScale.domain(),
      aLo = domain.length ? x(domain[0], level) : 0,
      aHi = domain.length
        ? x(domain[domain.length - 1], level) + xScale.bandwidth() * 1.1
        : 0,
      rLo = yScales[level].range()[0],
      rHi = yScales[level].range()[1],
      c0 = toXY(aLo, rLo),
      c1 = toXY(aHi, rHi);
    dBrushes[level] = (isVertical() ? d3.brushX() : d3.brushY())
      .extent([
        [c0.x, c0.y],
        [c1.x, c1.y],
      ])
      .on("brush", brushed)
      .on("end", onSelectByRange);

    let _brush = d3
      .select(this)
      .selectAll(".brush")
      .data([
        {
          data: d.map((index) => data[index]),
          level: level,
        },
      ]);

    // Append on ENTER only. This used to be
    //   _brush.enter().merge(_brush).append("g")
    // which appends to the update selection as well, so every redraw nested
    // another .brush inside the previous one. With one redraw per page load
    // that went unnoticed; anything that redraws repeatedly - a settings slider
    // fires hardUpdate on every input event - fills the widget with stale brush
    // rectangles, each keeping the width of the geometry it was born under and
    // drawn on top of the live one.
    const brushG = _brush
      .enter()
      .append("g")
      .attr("class", "brush")
      .merge(_brush);

    brushG
      .call(dBrushes[level]) // brush event must be before click (?) https://observablehq.com/@d3/click-vs-drag?collection=@d3/d3-drag
      .on("mousemove", onMouseOver)
      .on("click", onSelectByValue)
      .on("mouseout", onMouseOut);

    // Re-applied every pass: aHi comes from the current scales, so a
    // column-width change has to resize these.
    brushG.selectAll("rect").attr(isVertical() ? "height" : "width", aHi);

    _brush.exit().remove();

    function brushed(event) {
      if (!event.selection) {
        if (nv.DEBUG)
          console.log(
            "🖌️ Brushed",
            level,
            event.selection,
            event.type,
            event.sourceEvent
          );
        // return;
        // event.preventDefault();
        // onSelectByValueFromCoords(event.sourceEvent.clientX, event.sourceEvent.clientY);
        return; // Ignore empty selections.
      }

      if (!event.sourceEvent) return; // Only transition after input.

      // TODO do I need d3.pointer here
      const clientX = event.sourceEvent.clientX,
        clientY = event.sourceEvent.clientY,
        xOnWidget = event.sourceEvent.offsetX,
        yOnWidget = event.sourceEvent.offsetY;

      showTooltip(xOnWidget, yOnWidget, clientX, clientY, level);
    }

    function onSelectByRange(event) {
      if (!event.sourceEvent) return; // Only transition after input.

      const sel = event.selection;

      // No selection at all means a plain click, and d3 will deliver the click
      // event next - onSelectByValue handles it. Acting here too would apply
      // the filter twice. Measured: a 0px click ends with sel === null and IS
      // followed by a click; a 2px drag ends with sel === [110, 112] and is
      // NOT.
      if (!sel) return;

      // A click with a few pixels of pointer drift lands here instead, as a
      // hair-thin brush, and no click event follows it - so without this the
      // gesture did NOTHING: no value filter, no range filter, no feedback.
      if (Math.abs(sel[1] - sel[0]) < nv.clickTolerance) {
        if (nv.DEBUG)
          console.log(
            "Selection under click tolerance, treating as a click",
            level,
            sel,
            event.type
          );
        // Local coords for the same element the click handler reads from.
        // onSelectByValueFromCoords clears every brush itself, including the
        // hair-thin one that got us here.
        const p = d3.pointer(event.sourceEvent, this);
        onSelectByValueFromCoords(event.sourceEvent, p[0], p[1]);
        return;
      }

      showLoading(this);
      removeAllBrushesBut(level);

      let before = performance.now();
      let brushed = event.selection;

      let // first = dData.get(invertOrdinalScale(yScales[level], brushed[0] -yScales[level].bandwidth())),
        firstIndex = dData.get(invertOrdinalScale(yScales[level], brushed[0])),
        // last = dData.get(invertOrdinalScale(yScales[level], brushed[1] -yScales[level].bandwidth()))
        lastIndex = dData.get(invertOrdinalScale(yScales[level], brushed[1]));

      let newFilter;
      if (event.sourceEvent.altKey) {
        newFilter = new FilterByRangeNegative({
          firstIndex,
          lastIndex,
          getPos: posAt,
          getRow: (i) => data[i],
          getAttribAt: attribAt,
          level: level,
          itemAttr: dSortBy[level] ? dSortBy[level].attrib : "__seqId",
          getAttrib,
          getAttribName,
        });
      } else {
        newFilter = new FilterByRange({
          firstIndex,
          lastIndex,
          getPos: posAt,
          getRow: (i) => data[i],
          getAttribAt: attribAt,
          level: level,
          itemAttr: dSortBy[level] ? dSortBy[level].attrib : "__seqId",
          getAttrib,
          getAttribName,
        });
      }

      if (event.sourceEvent.shiftKey) {
        // First filter, create the list
        if (!(level in filtersByLevel)) {
          filtersByLevel[level] = [];
        }
        // Append the filter
        filtersByLevel[level].push(newFilter);
      } else {
        // Remove previous filters
        filtersByLevel[level] = [newFilter];
      }

      // A range filter on a former level makes range filters obsolete in subsequent levels
      deleteObsoleteFiltersFromLevel(level + 1);

      applyFiltersAndUpdate(level);

      let after = performance.now();
      if (nv.DEBUG)
        console.log(
          "selectByRange filtering " + (after - before) + "ms",
          firstIndex,
          lastIndex
        );

      hideLoading(this);
    } // onSelectByRange

    function onSelectByValue(event) {
      if (nv.DEBUG)
        console.log("👉🏼 Select by value click", event, d3.pointer(event));
      if (event.defaultPrevented) {
        if (nv.DEBUG)
          console.log(
            "Select by value click default prevented, assuming drag. return"
          );
        return;
      }
      showLoading(this);
      let clientY = d3.pointer(event)[1],
        clientX = d3.pointer(event)[0];

      onSelectByValueFromCoords(event, clientX, clientY);

      hideLoading(this);
    }

    function onSelectByValueFromCoords(event, clientX, clientY) {
      if (nv.DEBUG) console.log("onSelectByValueFromCoords", clientX, clientY);

      removeAllBrushesBut(-1); // Remove all brushes

      // Same axis swap as showTooltip: these are screen coords (#22).
      const onA = isVertical() ? clientY : clientX,
        onR = isVertical() ? clientX : clientY;

      const before = performance.now();
      const itemId = invertOrdinalScale(yScales[level], onR);
      const after = performance.now();
      if (nv.DEBUG)
        console.log("invertOrdinalScale " + (after - before) + "ms");

      let itemAttr = invertOrdinalScale(xScale, onA - levelScale(level));
      if (itemAttr === undefined) {
        if (nv.DEBUG)
          console.log(
            `navio.selectByValue: error, couldn't find attr in coords ${
              (clientX, clientY)
            }`
          );
        return;
      }
      itemAttr = dAttribs.get(itemAttr);

      const sel = data[dData.get(itemId)];
      let newFilter;
      if (event.altKey) {
        newFilter = new FilterByValueDifferent({
          sel,
          itemAttr,
          getAttrib,
          getAttribName,
        });
      } else {
        newFilter = new FilterByValue({
          sel,
          itemAttr,
          getAttrib,
          getAttribName,
        });
      }
      if (event.shiftKey) {
        // First filter, create the list
        if (!Object.prototype.hasOwnProperty.call(filtersByLevel, level)) {
          filtersByLevel[level] = [];
        }
        // Append the filter
        filtersByLevel[level].push(newFilter);
      } else {
        // Remove previous filters
        filtersByLevel[level] = [newFilter];
      }

      // A filter on a former level makes range filters obsolete in subsequent levels
      deleteObsoleteFiltersFromLevel(level + 1);

      applyFiltersAndUpdate(level);

      if (nv.DEBUG)
        console.log(
          "Selected " + nv.getVisible().length + " calling updateCallback"
        );
    }
  } // updateBrushes

  function showTooltip(xOnWidget, yOnWidget, clientX, clientY, level) {
    // Pointer coords are screen-space; the scales are axis-space. Vertical
    // swaps which is which (#22).
    const onA = isVertical() ? yOnWidget : xOnWidget,
      onR = isVertical() ? xOnWidget : yOnWidget;

    let itemId;
    try {
      itemId = invertOrdinalScale(yScales[level], onR);
    } catch (e) {
      nv.DEBUG && console.log("Navio.showTooltip Error inverting scale", e);
      return;
    }

    let itemAttr = invertOrdinalScale(xScale, onA - levelScale(level));
    const rowIdx = dData.get(itemId);
    const d = data[rowIdx];

    itemAttr = dAttribs.get(itemAttr);

    if (!d || d === undefined) {
      // Fires whenever the pointer is over a gap; trace only, and this runs on
      // every mousemove.
      if (nv.DEBUG)
        console.log("Couldn't find datum for tooltip y", yOnWidget, d);
      return;
    }

    tooltipCoords.x = xOnWidget;
    tooltipCoords.y = yOnWidget;

    tooltipElement.select(".tool_id").text(itemId);
    tooltipElement.select(".tool_value_name").text(getAttribName(itemAttr));
    // `selected` and `__seqId` are drawn columns backed by side tables rather
    // than row properties (#88), so hovering them has to read the same way the
    // renderer does or the tooltip just says "undefined".
    tooltipElement
      .select(".tool_value_val")
      .text(
        nv.stringify(
          itemAttr === "selected"
            ? !!selectedFlags[rowIdx]
            : attribAt(rowIdx, itemAttr)
        )
      );

    tooltipElement.style("display", "initial");

    tooltip.scheduleUpdate();

    // if ( nv.DEBUG ) console.log("Mouse over", d);
  }

  function onMouseOver(event, overData) {
    const xOnWidget = d3.pointer(event)[0],
      yOnWidget = d3.pointer(event)[1],
      clientX = event.clientX,
      clientY = event.clientY;

    nv.DEBUG &&
      console.log(
        "🐁 navio.onMouseOver",
        xOnWidget,
        yOnWidget,
        clientX,
        clientY,
        event
      );

    // if (event.altKey) {
    //   d3.selectAll(".overlay").style("cursor", "zoom-out");
    //   console.log("Alt!");
    // } else {
    //   d3.selectAll(".overlay").style("cursor", `url(${cursorData}) 8 8, crosshair`);
    // }
    // // console.log("key");

    if (!overData.data || overData.data.length === 0) {
      if (nv.DEBUG) console.log("onMouseOver no data", overData);
      return;
    }

    // if (nv.DEBUG) console.log("onMouseOver", xOnWidget, yOnWidget, clientY, event.pageY, event.offsetY, event);
    showTooltip(xOnWidget, yOnWidget, clientX, clientY, overData.level);
  }

  function onMouseOut() {
    tooltipCoords.x = -200;
    tooltipCoords.y = -200;
    tooltipElement.style("display", "none");
    tooltip.scheduleUpdate();

    // svg.select(".nvTooltip")
    //   .attr("transform", "translate(" + (-200) + "," + (-200) + ")")
    //   .call(function (tool) {
    //     tool.select(".tool_id")
    //       .text("");
    //     tool.select(".tool_value_name")
    //       .text("");
    //     tool.select(".tool_value_val")
    //       .text("");
    //   });
  }

  /**
   * The "N records" label for each level, just past the end of the RECORD axis.
   *
   * This was the last draw* helper writing raw screen x/y instead of going
   * through toXY(). Horizontally the two happen to agree; vertically the record
   * axis IS the screen width, so `recordEnd + 15` was written as a y - putting
   * the label 255px below a 140px canvas, where it was clipped away entirely
   * (#22).
   *
   * Vertical needs more than the swap. Past the records there is only the slack
   * between yScales.range()[1] and `height` - about 25px - which is narrower
   * than a seven-digit count. Anchored at the start the number would run off
   * the right edge; anchored at the END it grows back over the last few records
   * instead, which stays legible. Along A the label sits at the level's own
   * edge, and vertically that edge is a y, so the text has to HANG below it or
   * its ascender is clipped by the top of the canvas.
   */
  function drawCounts(levelOverlay, levelOverlayEnter) {
    const vertical = isVertical();
    const alongR = (i) => (vertical ? height - 4 : yScales[i].range()[1] + 15);

    levelOverlayEnter
      .append("text")
      .merge(levelOverlay.select("text.numNodesLabel"))
      .attr("class", "numNodesLabel")
      .style("font-family", "sans-serif")
      .style("pointer-events", "none")
      .attr("text-anchor", vertical ? "end" : "start")
      .attr("dominant-baseline", vertical ? "hanging" : "auto")
      .attr("x", function (_, i) {
        return toXY(levelScale(i), alongR(i)).x;
      })
      .attr("y", function (_, i) {
        return toXY(levelScale(i), alongR(i)).y;
      })
      .text(function (d) {
        return nv.fmtCounts(d.length);
      });
  }

  // Renders the filter chips as HTML under div.explanations. It reads
  // `selection`/`dataIs` from the closure rather than taking the level-overlay
  // selections the other draw* helpers do, so it needs no arguments.
  function drawFilterExplanationsHTML() {
    // A chip starts in the gap AFTER its level.
    //
    // filtersByLevel[i] is the filter that produced level i+1 - applyFilters
    // reads it at i and writes the result to i+1 - so the chip describes the
    // step between the two, and the inter-level gap is where that step is.
    // Anchoring it to level i's own left edge instead read as a label on level
    // i, which is the level the filter came FROM, not the one it made.
    //
    // Width runs from one gap to the next, so consecutive chips tile rather
    // than overlap. That is the constraint the earlier layout got wrong in the
    // other direction: chips did start at the level's right edge once, but
    // were given a 200px min-width against a 40px gap, so each one ran across
    // its neighbour.
    const levelRight = (level) => levelScale(level) + xScale.range()[1] + 4;
    const explanationWidth = (level) =>
      level < dataIs.length - 1
        ? Math.max(70, levelRight(level + 1) - levelRight(level) - 8)
        : Math.max(220, xScale.range()[1]);

    const filterExps = selection
      .select("div.explanations")
      .selectAll("div.filterExplanation")
      .data(dataIs);

    const filterExpEnter = filterExps
      .enter()
      .append("div")
      .attr("class", "filterExplanation")
      .merge(filterExps)
      .style("position", "absolute")
      .style("top", "0")
      .style("left", "0")
      // Bounded by the distance to the next level's explanation, so a long
      // filter label wraps instead of running across the level beside it.
      // min-width used to be 200px with levels only ~75px apart, which
      // guaranteed the overlap.
      // An explicit width, not just max-width: the parent .explanations div is
      // absolutely positioned with no width of its own, so the available width
      // for shrink-to-fit is 0 and the text collapsed to its longest single
      // word (37px for a 117px budget) no matter what max-width said.
      .style("width", (_, i) => `${explanationWidth(i)}px`)
      .style("overflow-wrap", "break-word")
      .style("transform", (_, i) => {
        // Both coordinates come from the axes, so they transpose together
        // (#22). The record-axis offset used to be 30 to clear the settings
        // gear as well as the count label; now that a chip starts past its
        // level's last column it is nowhere near the gear in the corner, so it
        // only has to clear the count, and the widget keeps the difference.
        const p = toXY(levelRight(i), yScales[i].range()[1] + 16);
        return `translate(${p.x}px, ${p.y}px)`;
      });

    const filterExpTexts = filterExpEnter
      // .append("div")
      // .attr("class", "filterExplanationText")
      .merge(filterExps.select(".filterExplanation"))
      .style("font-size", nv.filterFontSize + "pt")
      .selectAll("div")
      .data((_, i) =>
        filtersByLevel[i]
          ? filtersByLevel[i].map((f) => {
              f.level = i;
              return f;
            })
          : []
      );

    const removeFilter = (f) => {
      const levelFilters = filtersByLevel[f.level];
      const i = levelFilters.indexOf(f);
      if (nv.DEBUG) console.log("Click remove filter", i, f);
      if (i === -1) return; // Already removed (e.g. a stale/duplicate event).
      levelFilters.splice(i, 1);

      applyFiltersAndUpdate(f.level);
    };

    filterExpTexts
      .enter()
      .append("div")
      .merge(filterExpTexts)
      // .attr("dy", nv.filterFontSize * 1.2 + 7)
      // .attr("x", 0)
      .style("cursor", "not-allowed")
      // A chip is a button that removes the filter, so say so. The Ⓧ glyph
      // alone reads as "circled x" or is skipped entirely (#68).
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", (f) => `Remove filter: ${f.toStr()}`)
      .text((f) => "Ⓧ " + f.toStr())
      .on("click", (event, f) => removeFilter(f))
      .on("keydown", (event, f) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        removeFilter(f);
      });

    filterExpTexts.exit().remove();
    filterExps.exit().remove();

    // How far the chips reach below the canvas, so the container can cover
    // them. Measured rather than computed: a long filter label wraps to two or
    // three lines inside its level's width, and only layout knows how many.
    //
    // In VERTICAL the chips go out to the side instead - toXY puts the record
    // axis on x - so they never reach past the canvas bottom and this is 0,
    // which is exactly right: the container is a block and already has the
    // width.
    const cvBottom = canvas.getBoundingClientRect().bottom;
    let lowest = cvBottom;
    selection.selectAll("div.filterExplanation").each(function () {
      const r = this.getBoundingClientRect();
      if (r.height) lowest = Math.max(lowest, r.bottom);
    });
    // The margin is breathing room UNDER the chips, so it only applies when
    // there are chips below the canvas at all - otherwise every vertical
    // widget, where they go out to the side, grew by a margin for nothing.
    const over = Math.ceil(lowest - cvBottom),
      pad = over > 0 ? over + nv.margin : 0;
    if (pad !== explanationsPad) {
      explanationsPad = pad;
      applyContainerSize();
    }
  }

  /** Grow or restore a column's label. Driven by the hit rect, not the text. */
  function growHeaderLabel(hitNode, d, grown) {
    let label = d3.select(hitNode.parentNode).select("text");
    if (label.empty()) {
      // Called from the hit strip, which lives in a shared layer - find the
      // column's own label by name.
      label = svg
        .selectAll(".attribOverlay")
        .filter((dd) => dd && dd.name === d.name && dd.level === d.level)
        .select("text");
    }
    if (label.empty()) return;
    animated(label).style(
      "font-size",
      grown
        ? nv.attribFontSizeSelected + "px"
        : Math.min(nv.attribFontSize, nv.attribWidth) + "px"
    );
  }

  function drawAttribHeaders(attribOverlay, attribOverlayEnter, headerHit) {
    // Sort and reorder are bound to BOTH the hit rect and the glyphs.
    //
    // The rect alone is not enough: a rotated label overhangs its neighbours,
    // so clicking the visible word "name" would land in the next column's
    // strip and sort that instead. The glyphs alone were the original bug -
    // SVG hit-tests text by its ink, so most of the header was dead. The text
    // is drawn after the rect and therefore on top, so the glyphs win where
    // they overlap and the strip catches everything else.
    // The drag stays on the glyphs: its handlers move and dim this.parentNode,
    // which has to be the column's own <g>. The strip lives in a shared layer,
    // so binding the drag there would drag the whole layer.
    const bindHeader = (sel) =>
      sel
        .on("mousemove", function (event, d) {
          growHeaderLabel(this, d, true);
        })
        .on("mouseout", function (event, d) {
          growHeaderLabel(this, d, false);
        })
        .call(
          d3
            .drag()
            // Shift to reorder. Without a filter, d3.drag arms on every
            // mousedown and suppresses the following click as soon as the
            // pointer moves at all - which is what made a plain click on a
            // header unreliable. Filtered out, the drag does not exist unless
            // Shift is held, so the click path is completely unobstructed.
            .filter(
              (event) => event.shiftKey && !event.ctrlKey && !event.button
            )
            .container(attribOverlayEnter.merge(attribOverlay).node())
            .on("start", attribDragstarted)
            .on("drag", attribDragged)
            .on("end", attribDragended)
        );

    headerHit
      .style("cursor", "pointer")
      .on("mousemove", function (event, d) {
        growHeaderLabel(this, d, true);
      })
      .on("mouseout", function (event, d) {
        growHeaderLabel(this, d, false);
      });

    // Turning headers off has to REMOVE the labels, not merely stop creating
    // them. This was an `if` around the append+merge, so once a label existed
    // nothing ever took it away and the checkbox looked dead.
    if (!nv.showAttribTitles) {
      attribOverlayEnter.selectAll("text").remove();
      attribOverlay.selectAll("text").remove();
    } else {
      // Append where there is no label yet, on BOTH selections. Enter-only
      // appending meant that turning headers back on after turning them off
      // only relabelled the columns that happened to be entering that pass -
      // measured 2 of 6 - because the removal above had emptied the rest.
      const withLabels = attribOverlayEnter.merge(attribOverlay);
      withLabels.each(function () {
        const g = d3.select(this);
        if (g.select("text").empty()) g.append("text");
      });
      withLabels
        .select("text")
        .style("cursor", "point")
        .style("-webkit-user-select", "none")
        .style("-moz-user-select", "none")
        .style("-ms-user-select", "none")
        .style("user-select", "none")
        .text(function (d) {
          return d.attrib === "__seqId"
            ? "sequential Index"
            : d.name +
                (dSortBy[d.level] !== undefined &&
                dSortBy[d.level].attrib === d.attrib
                  ? dSortBy[d.level].desc
                    ? " ↓"
                    : " ↑"
                  : "");
        })
        // The group is already translated to the column's origin, so this is a
        // local offset. Horizontal: sit above the column and rotate. Vertical:
        // sit to the left of the row, upright and right-aligned (#22).
        .attr("x", () => (isVertical() ? -6 : xScale.bandwidth() / 2))
        .attr("y", () => (isVertical() ? xScale.bandwidth() / 2 : 0))
        .attr("text-anchor", () => (isVertical() ? "end" : "start"))
        .attr("dominant-baseline", () => (isVertical() ? "middle" : "auto"))
        .style("font-weight", function (d) {
          return dSortBy[d.level] !== undefined &&
            dSortBy[d.level].attrib === d.attrib
            ? "bolder"
            : "normal";
        })
        .style("font-family", "sans-serif")
        .style("font-size", function () {
          // make it grow ?
          // if (dSortBy[d.level]!==undefined &&
          //   dSortBy[d.level].attrib === d.attrib )
          // d3.select(this).dispatch("mousemove");
          return Math.min(nv.attribFontSize, nv.attribWidth) + "px";
        })
        .call(bindHeader)
        // Rotating the label only makes sense when it has to fit a narrow
        // column; along the record axis there is room to read it upright.
        .attr("transform", () =>
          isVertical() ? null : `rotate(${nv.attribRotation})`
        );
    } // if (nv.showAttribTitles) {
  }

  function drawAttributesHolders(levelOverlay, levelOverlayEnter) {
    let attribs = visibleAttribs();

    let attribOverlay = levelOverlayEnter
      .merge(levelOverlay)
      .selectAll(".attribOverlay")
      .data(function (_, i) {
        return attribs.map(function (a) {
          return {
            attrib: a,
            name: getAttribName(a),
            level: i,
          };
        });
      });

    let attribOverlayEnter = attribOverlay
      .enter()
      .append("g")
      .attr("class", "attribOverlay")
      .style("cursor", "pointer");

    // Column headers are the widget's primary control: click sorts, drag
    // reorders. Both were mouse-only. Enter/Space sorts; Alt+Arrow reorders,
    // which is the keyboard equivalent of the drag (#68).
    attribOverlayEnter
      .merge(attribOverlay)
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", (d) => {
        const sorted =
          dSortBy[d.level] && dSortBy[d.level].attrib === d.attrib
            ? dSortBy[d.level].desc
              ? ", currently sorted descending"
              : ", currently sorted ascending"
            : "";
        return (
          `${d.name}, level ${d.level + 1}${sorted}. ` +
          `Enter to sort, Alt with left or right arrow to move.`
        );
      })
      .on("keydown", function (event, d) {
        if (event.key === "Enter" || event.key === " ") {
          // Sort BEFORE preventDefault: onSortLevel treats a
          // defaultPrevented event as "this was a drag, not a click" and
          // returns early. preventDefault is only here to stop Space
          // scrolling the page.
          onSortLevel.call(this, event, d);
          event.preventDefault();
          announce(`Sorted level ${d.level + 1} by ${d.name}`);
          return;
        }
        if (!event.altKey) return;
        const delta =
          event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!delta) return;
        event.preventDefault();
        const from = attribsOrdered.indexOf(d.attrib);
        const to = from + delta;
        if (from === -1 || to < 0 || to >= attribsOrdered.length) return;
        moveAttrToPos(d.attrib, to);
        nv.updateData(dataIs);
        announce(`Moved ${d.name} to position ${to + 1}`);
      });

    attribOverlayEnter.merge(attribOverlay).attr("transform", (d) => {
      const p = toXY(x(d.name, d.level), yScales[d.level].range()[0]);
      return `translate(${p.x}, ${p.y})`;
    });

    attribOverlayEnter
      .append("rect")
      .merge(attribOverlay.select("rect"))

      .attr("fill", "none")
      // .style("opacity", "0.1")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", function (d) {
        return toWH(
          xScale.bandwidth() * 1.1,
          yScales[d.level].range()[1] - yScales[d.level].range()[0]
        ).width;
      })
      .attr("height", function (d) {
        return toWH(
          xScale.bandwidth() * 1.1,
          yScales[d.level].range()[1] - yScales[d.level].range()[0]
        ).height;
      });

    // A hit area for each column header.
    //
    // The label is a rotated <text> and SVG hit-tests text by its GLYPHS, so
    // the only clickable part was a thin diagonal strip - clicking the obvious
    // spot above a column missed entirely. This gives each column its own
    // strip of the header band. fill:transparent, not fill:none, which is not
    // hit-testable.
    //
    // They live in their own group placed BEFORE the columns rather than
    // inside each column's <g>. SVG has no z-index, so a later sibling paints
    // over an earlier one: with the rects inside the groups, column N+1's rect
    // covered column N's label - and a rotated label overhangs to the right,
    // so clicking the visible word sorted the wrong column. One layer beneath
    // everything keeps the labels on top, where they win over their own text.
    const hitLayer = levelOverlayEnter
      .merge(levelOverlay)
      .selectAll("g._nv_header_hits")
      // The level index, so the rects below can be positioned on their own
      // level rather than all landing on level 0.
      .data((_, i) => [i]);
    const hitLayerG = hitLayer
      .enter()
      .insert("g", ":first-child")
      .attr("class", "_nv_header_hits")
      .merge(hitLayer);

    const hits = hitLayerG.selectAll("rect").data(
      function () {
        const level = d3.select(this.parentNode).datum();
        return attribs.map((a) => ({
          attrib: a,
          name: getAttribName(a),
          level: typeof level === "number" ? level : 0,
        }));
      },
      (d) => d.name
    );
    hits.exit().remove();

    const headerHit = hits
      .enter()
      .append("rect")
      .attr("class", "_nv_header_hit")
      .merge(hits)
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .attr("transform", (d) => {
        const p = toXY(x(d.name, d.level), yScales[d.level].range()[0]);
        return `translate(${p.x}, ${p.y})`;
      })
      .attr("x", (d) => toXY(0, -(yScales[d.level].range()[0] - nv.margin)).x)
      .attr("y", (d) => toXY(0, -(yScales[d.level].range()[0] - nv.margin)).y)
      .attr(
        "width",
        (d) =>
          toWH(xScale.bandwidth(), yScales[d.level].range()[0] - nv.margin)
            .width
      )
      .attr(
        "height",
        (d) =>
          toWH(xScale.bandwidth(), yScales[d.level].range()[0] - nv.margin)
            .height
      );

    drawAttribHeaders(attribOverlay, attribOverlayEnter, headerHit);

    attribOverlay.exit().remove();
  }

  function drawBrushes(recomputeBrushes) {
    let levelOverlay = svg
      .select(".attribs")
      .selectAll(".levelOverlay")
      .data(dataIs);

    let levelOverlayEnter = levelOverlay.enter().append("g");

    levelOverlayEnter.attr("class", "levelOverlay").attr("id", function (d, i) {
      return "level" + i;
    });

    // Bugfix: when adding all attribs we need to update the brush
    if (recomputeBrushes) {
      levelOverlayEnter.merge(levelOverlay).each(updateBrushes);
    } else {
      levelOverlayEnter.each(updateBrushes);
    }

    drawAttributesHolders(levelOverlay, levelOverlayEnter);
    drawCounts(levelOverlay, levelOverlayEnter);
    drawFilterExplanationsHTML();

    levelOverlay.exit().remove();
  } // drawBrushes

  /** The drag coordinate along the ATTRIBUTE axis - x horizontally, y not (#22). */
  function dragAlongA(event) {
    return isVertical() ? event.y : event.x;
  }

  /** Where the dragged header should sit while it follows the pointer. */
  function draggedHeaderTransform(event, d) {
    const p = toXY(
      dragAlongA(event) + nv.attribFontSize / 2,
      yScales[d.level].range()[0]
    );
    return `translate(${p.x}, ${p.y})`;
  }

  /** Which column the pointer is over, in svg coordinates. */
  function columnAtPointer(event, level) {
    const p = d3.pointer(event, svg.node());
    const alongA = isVertical() ? p[1] : p[0];
    return dAttribs.get(invertOrdinalScale(xScale, alongA - levelScale(level)));
  }

  /** The attribute the pointer is currently over, during a header drag. */
  function dropTargetFor(event, d) {
    const name = invertOrdinalScale(
      xScale,
      dragAlongA(event) + nv.attribFontSize / 2 - levelScale(d.level)
    );
    return dAttribs.get(name);
  }

  /**
   * Show where the dragged column will land: a line at the edge it will be
   * inserted against, spanning the level. Without it the only feedback was the
   * header label following the pointer, which says what you are dragging but
   * not where it is going.
   */
  function showDropIndicator(event, d) {
    const target = dropTargetFor(event, d);
    const line = svg.select("._nv_drop_indicator");
    if (target === undefined || target === d.attrib) {
      line.style("display", "none");
      return;
    }
    const from = attribsOrdered.indexOf(d.attrib),
      to = attribsOrdered.indexOf(target);
    // Insert after the target when moving right, before it when moving left,
    // so the line sits on the side the column is actually coming from.
    const a =
      x(getAttribName(target), d.level) + (to > from ? xScale.bandwidth() : 0);
    const p0 = toXY(a, yScales[d.level].range()[0]),
      p1 = toXY(a, yScales[d.level].range()[1]);
    line
      .style("display", null)
      .attr("x1", p0.x)
      .attr("y1", p0.y)
      .attr("x2", p1.x)
      .attr("y2", p1.y);
  }

  function hideDropIndicator() {
    svg.select("._nv_drop_indicator").style("display", "none");
  }

  function attribDragstarted(event, d) {
    if (nv.DEBUG) console.log("attrib drag start", d);

    // Dim the LABEL being moved, so it reads as "in flight".
    d3.select(this.parentNode)
      .classed("_nv_dragging", true)
      .select("text")
      .style("opacity", 0.45);
    d3.select(this.parentNode).attr("transform", (dd) =>
      draggedHeaderTransform(event, dd)
    );
  }

  function attribDragged(event, d) {
    d3.select(this.parentNode).attr("transform", (dd) =>
      draggedHeaderTransform(event, dd)
    );
    showDropIndicator(event, d);
  }

  function attribDragended(event, d) {
    if (nv.DEBUG) console.log("attrib drag end", d);

    hideDropIndicator();
    d3.select(this.parentNode)
      .classed("_nv_dragging", false)
      .select("text")
      .style("opacity", null);

    // Click vs drag is decided HERE, from the distance the pointer travelled,
    // and nowhere else.
    //
    // It used to be split between d3.drag().clickDistance() and a DOM click
    // handler on the label, and the two disagreed: a header label is a rotated
    // <text>, so a few pixels of drift put mouseup on a different element and
    // the browser dispatched `click` to the common ancestor, which has no
    // handler. Between 3px and the drag threshold, a click did NOTHING - it
    // neither sorted nor reordered. d3.drag captures the pointer, so its end
    // event always fires on the right element no matter where the pointer
    // wandered, which makes it the only reliable place to make this call.
    // Only a Shift-drag reaches here, so this is always a reorder - sorting is
    // the plain click, handled in bindHeader. Keeping the two gestures on
    // different modifiers is what makes each one reliable: they no longer have
    // to be told apart after the fact.
    const attrDraggedInto = dropTargetFor(event, d);
    if (attrDraggedInto === undefined || attrDraggedInto === d.attrib) return;

    let pos;
    d3.select(this.parentNode).attr("transform", function (dd) {
      const p = toXY(x(dd.name, dd.level), yScales[dd.level].range()[0]);
      return `translate(${p.x}, ${p.y})`;
    });

    {
      pos = attribsOrdered.indexOf(attrDraggedInto);
      moveAttrToPos(d.attrib, pos);
      nv.updateData(dataIs);
      // The panel lists the same order, so it has to follow a drag made on the
      // widget itself - otherwise the two disagree until it is reopened.
      if (settingsIsOpen()) drawSettingsPanel();
      persistSettings();
    }
  }

  function drawCloseButton() {
    let maxLevel = dataIs.length - 1;
    svg
      .select("#closeButton")
      .style("display", dataIs.length === 1 ? "none" : "block")
      .attr("transform", () => {
        // Horizontal: below the level, at the start of the records.
        // Vertical: the same spot transposes to *under* the widget, which
        // reads badly - put it past the end of the records instead, so it
        // still sits at the trailing corner of its level.
        const alongA =
          levelScale(maxLevel) +
          levelScale.bandwidth() -
          nv.levelsSeparation +
          15;
        const p = isVertical()
          ? toXY(alongA - 15, yScales[maxLevel].range()[1] + 12)
          : toXY(alongA, yScales[maxLevel].range()[0]);
        return `translate(${p.x}, ${p.y})`;
      });
  }

  // Links between nodes
  function drawLink(link) {
    let lastAttrib = xScale.domain()[xScale.domain().length - 1],
      rightBorder = x(lastAttrib, dataIs.length - 1) + xScale.bandwidth() + 2,
      ys =
        yScales[dataIs.length - 1](idOf(indexOfRow(link.source))) +
        yScales[dataIs.length - 1].bandwidth() / 2,
      yt =
        yScales[dataIs.length - 1](idOf(indexOfRow(link.target))) +
        yScales[dataIs.length - 1].bandwidth() / 2,
      miny = Math.min(ys, yt),
      maxy = Math.max(ys, yt),
      midy = maxy - miny;
    context.moveTo(rightBorder, miny); //starting point
    context.quadraticCurveTo(
      rightBorder + midy / 6,
      miny + midy / 2, // mid point
      rightBorder,
      maxy // end point
    );
  }

  function drawLinks() {
    if (!links.length) return;
    if (nv.DEBUG)
      console.log("Draw links ", links[links.length - 1].length, links);
    context.save();
    context.beginPath();
    context.strokeStyle = nv.linkColor;
    context.globalAlpha = Math.min(
      1,
      // links.length, not links[last].length - the latter is a link object, so
      // this evaluated to NaN and canvas silently ignored the assignment.
      Math.max(0.1, 1000 / links.length)
    ); // More links more transparency
    // context.lineWidth = 0.5;
    for (let link of visibleLinks) {
      drawLink(link);
    }
    // visibleLinks.forEach(drawLink);
    context.stroke();
    context.restore();
  }

  function drawLine(points, width, color, close) {
    context.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) {
        context.moveTo(p.x, p.y);
      } else {
        context.lineTo(p.x, p.y);
      }
    }
    context.lineWidth = width;
    if (close) {
      context.fillStyle = color;
      context.closePath();
      context.fill();
    } else {
      context.strokeStyle = color;
      context.stroke();
    }
  }

  function drawLevelConnections(level) {
    if (level <= 0) {
      return;
    }
    for (let item of dataIs[level].representatives) {
      // Compute the yPrev by calculating the index of the corresponding representative
      let iOnPrev = posAt(item, level - 1);
      let iRep = Math.floor(
        iOnPrev - (iOnPrev % dataIs[level - 1].itemsPerpixel)
      );
      // if (nv.DEBUG) console.log("i rep = "+ iRep);
      // if (nv.DEBUG) console.log(data[level-1][iRep]);
      // if (nv.DEBUG) console.log(yScales[level-1](data[level-1][iRep][id]));
      let locPrevLevel = {
        x: levelScale(level - 1) + xScale.range()[1],
        y: yScales[level - 1](idOf(dataIs[level - 1][iRep])),
      };
      let locLevel = {
        x: levelScale(level),
        y: yScales[level](idOf(item)),
      };

      let points = [
        locPrevLevel,
        { x: locPrevLevel.x + nv.levelsSeparation * 0.3, y: locPrevLevel.y },
        { x: locLevel.x - nv.levelsSeparation * 0.3, y: locLevel.y },
        locLevel,
        { x: locLevel.x, y: locLevel.y + yScales[level].bandwidth() },
        {
          x: locLevel.x - nv.levelsSeparation * 0.3,
          y: locLevel.y + yScales[level].bandwidth(),
        },
        {
          x: locPrevLevel.x + nv.levelsSeparation * 0.3,
          y: locPrevLevel.y + yScales[level - 1].bandwidth(),
        },
        {
          x: locPrevLevel.x,
          y: locPrevLevel.y + yScales[level - 1].bandwidth(),
        },
        locPrevLevel,
      ];
      // `points` is built in (attribute-axis, record-axis) space above - the
      // .x fields come from levelScale/xScale and the .y fields from yScales -
      // so mapping the whole path through toXY transposes it for free (#22).
      const path = points.map((pt) => toXY(pt.x, pt.y));
      drawLine(path, 1, nv.levelConnectionsColor);
      drawLine(path, 1, nv.levelConnectionsColor, true);
    }
  }

  function computeRepresentatives(levelToUpdate) {
    if (nv.DEBUG) console.log("Compute representatives levels", levelToUpdate);
    let representatives = [];
    if (dataIs[levelToUpdate].length > height) {
      const itemsPerpixel = Math.max(
        Math.floor(dataIs[levelToUpdate].length / (height * 2)),
        1
      );
      if (nv.DEBUG) console.log("itemsPerpixel", itemsPerpixel);
      dataIs[levelToUpdate].itemsPerpixel = itemsPerpixel;
      for (let i = 0; i < dataIs[levelToUpdate].length; i += itemsPerpixel) {
        representatives.push(dataIs[levelToUpdate][i]);
      }
    } else {
      dataIs[levelToUpdate].itemsPerpixel = 1;
      representatives = dataIs[levelToUpdate];
    }
    dataIs[levelToUpdate].representatives = representatives;
    return representatives;
  }

  /**
   * min/max of an attribute over every row, in one pass.
   *
   * Same semantics as d3.extent (skips null/undefined/NaN) but without
   * materialising an intermediate array. updateColorDomains used to build one
   * per attribute, so a 7-attribute 100k-row dataset allocated 700k values
   * every time it ran. See #61.
   */
  function extentAt(attrib) {
    let min, max;
    for (let j = 0; j < dataIs[0].length; j++) {
      const v = attribAt(dataIs[0][j], attrib);
      if (v == null || !(v >= v)) continue; // NaN-safe, matches d3.extent
      if (min === undefined) {
        min = max = v;
      } else {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return [min, max];
  }

  /** Distinct values in first-appearance order - what scaleOrdinal keeps anyway. */
  function distinctAt(attrib) {
    const seen = new Set();
    for (let j = 0; j < dataIs[0].length; j++) {
      seen.add(attribAt(dataIs[0][j], attrib));
    }
    return Array.from(seen);
  }

  function updateColorDomains() {
    if (nv.DEBUG) console.log("Update color scale domains");
    // colScales = new Map();
    for (let attrib of attribsOrdered) {
      if (attrib === "selected") continue;

      let scale = colScales.get(attrib);
      // Through attribAt, not getAttrib: "__seqId" is a "seq" scale but is
      // derived from the index (#88), so reading it off the row would reset its
      // domain to [undefined, undefined] on every update and flatten the
      // sequential-index column.
      if (scale.__type === "seq" || scale.__type === "date") {
        scale.domain(extentAt(attrib)); //TODO: make it compute it based on the local range
      } else if (scale.__type === "div") {
        const [min, max] = extentAt(attrib);
        const absMax = Math.max(-min, max); // Assumes diverging point on 0
        scale.domain([-absMax, absMax]);
      } else if (scale.__type === "text" || scale.__type === "ordered") {
        scale.domain(distinctAt(attrib));
      }

      colScales.set(getAttribName(attrib), scale);
    }
  }

  function updateScales(opts) {
    let { levelsToUpdate, shouldUpdateColorDomains } = opts || {};
    if (nv.DEBUG) console.log("Update scales");

    const before = performance.now();

    const lastLevel = dataIs.length - 1;
    levelsToUpdate =
      levelsToUpdate !== undefined ? levelsToUpdate : [lastLevel];
    shouldUpdateColorDomains =
      shouldUpdateColorDomains !== undefined ? shouldUpdateColorDomains : false;

    // Delete unnecessary scales
    if (nv.DEBUG) console.log("Delete unnecessary scales");
    yScales.splice(lastLevel + 1, yScales.length);

    for (let levelToUp of levelsToUpdate) {
      yScales[levelToUp] = d3
        .scaleBand()
        .range([nv.y0, height - nv.margin - 30])
        .paddingInner(0.0)
        .paddingOuter(0);

      // Compute Representatives
      const representatives = computeRepresentatives(levelToUp);

      // Update x and y scales
      yScales[levelToUp].domain(
        representatives.map(function (rep) {
          return idOf(rep);
        })
      );
    }

    // Domain and range must be sized from the SAME set. They were not: the
    // domain came from attribsOrdered while the range was sized by dAttribs,
    // which is why splicing an attribute out left a dead column's width behind
    // (#89). Both now come from the visible set.
    const laidOut = visibleAttribs();
    xScale
      .domain(laidOut.map((d) => getAttribName(d)))
      .range([0, nv.attribWidth * laidOut.length])
      .paddingInner(0.1)
      .paddingOuter(0);
    levelScale
      .domain(
        dataIs.map(function (d, i) {
          return i;
        })
      )
      .range([
        nv.x0 + nv.margin,
        (xScale.range()[1] + nv.levelsSeparation) * dataIs.length + nv.x0,
      ])
      .paddingInner(0)
      .paddingOuter(0);

    // Every scale above has just had its domain or range rewritten.
    invalidateInvertCache();

    // Update color scales domains
    if (shouldUpdateColorDomains) {
      updateColorDomains();
    }

    const after = performance.now();
    if (nv.DEBUG) console.log("Updating Scales " + (after - before) + "ms");
  }

  // Deletes the last level by default, or all the subsequent levels of _level on _dataIs
  function deleteSubsequentLevels(_level, _dataIs, opts) {
    // Every caller that passes _dataIs threads the return value straight back
    // into its own variable, so this MUST hand the input back when there is
    // nothing to delete. Returning undefined here made applyFiltersAndUpdate
    // set `newData = undefined` and then read `newData.length` - which is how
    // brushing a widget with `nestedFilters` turned off threw "Cannot read
    // properties of undefined (reading 'length')". With nested filters on,
    // the level chain has already grown past 1 by the time we arrive, which is
    // why the default configuration never hit it.
    if (dataIs.length <= 1) return _dataIs !== undefined ? _dataIs : dataIs;

    let { shouldUpdate, silent = false } = opts || {};

    let level = _level !== undefined ? _level : dataIs.length - 1;
    _dataIs = _dataIs !== undefined ? _dataIs : dataIs;
    shouldUpdate = shouldUpdate !== undefined ? shouldUpdate : true;

    if (!Object.prototype.hasOwnProperty.call(_dataIs, level)) {
      if (nv.DEBUG)
        console.log("Asked to delete a level that doens't exist ", level);
      return _dataIs;
    }

    showLoading(this);
    if (nv.DEBUG) console.log("Delete one level", level);
    if (level > 0) {
      removeBrushOnLevel(level - 1);

      for (let d of _dataIs[level - 1]) {
        selectedFlags[d] = 1;
      }

      if (
        Object.prototype.hasOwnProperty.call(filtersByLevel, level - 1) &&
        filtersByLevel[level - 1].length
      ) {
        // Cleanup filters from the previous level
        for (let i = 0; i < filtersByLevel[level - 1].length; i++) {
          delete filtersByLevel[level - 1][i];
        }
      }
      filtersByLevel[level - 1] = [];
    }

    _dataIs.splice(level);

    if (shouldUpdate) {
      nv.updateData(_dataIs, colScales);
      notifyChange({ silent });
    }

    hideLoading(this);
    return _dataIs;
  }

  function moveAttrToPos(attr, pos) {
    let i = attribsOrdered.indexOf(attr);
    if (i === -1) {
      console.warn("navio.moveAttrToPos: attribute not found", attr);
      return;
    }
    if (pos > attribsOrdered.length || pos < 0) {
      console.warn(
        "navio.moveAttrToPos: position out of bounds",
        pos,
        attribsOrdered.length
      );
      return;
    }
    attribsOrdered.splice(i, 1);
    attribsOrdered.splice(pos, 0, attr);
  }

  function findNotNull(data, attr) {
    let i, val;
    for (
      i = 0;
      i < nv.howManyItemsShouldSearchForNotNull && i < data.length;
      i++
    ) {
      val = typeof attr === "function" ? attr(data[i]) : data[i][attr];
      if (val !== null && val !== undefined && val !== "") {
        return val;
      }
    }

    return val;
  }

  /**
   * Resolve every link's endpoints to row indices, once.
   *
   * Link endpoints are the caller's own row objects (the d3-force convention),
   * so this is the one place identity crosses the API. Endpoints do not change
   * unless links() or data() is called, but recomputeVisibleLinks runs on every
   * filter, sort, brush and reorder - so resolving them per call meant two
   * WeakMap lookups per link per interaction. -1 marks an endpoint that is not
   * part of the current data. See #61.
   */
  function recomputeVisibleLinks() {
    if (links.length > 0) {
      visibleLinks = links.filter(function (d) {
        // Link endpoints are the caller's own row objects (the d3-force
        // convention), so this is the one place identity crosses the API.
        const s = indexOfRow(d.source),
          t = indexOfRow(d.target);
        return s !== undefined && t !== undefined
          ? selectedFlags[s] && selectedFlags[t]
          : false;
      });
    }
  }

  function updateLevel(levelData, i) {
    drawLevelBorder(i);
    for (let rep of levelData.representatives) {
      drawItem(rep, i);
    }

    drawLevelConnections(i);
  }

  function updateWidthAndHeight() {
    // levelScale runs along A, `height` along R, so the two swap places on the
    // screen when the widget is vertical (#22).
    const alongA = levelScale.range()[1] + nv.margin + nv.x0,
      { width: ctxWidth, height: ctxHeight } = toWH(alongA, height);
    nv.DEBUG && console.log("updateWidthAndHeight: ", ctxWidth, ctxHeight);
    const scale = window.devicePixelRatio || 1;
    d3.select(canvas)
      .attr("width", ctxWidth * scale)
      .attr("height", ctxHeight * scale)
      .style("width", ctxWidth)
      .style("height", ctxHeight + "px");
    canvas.style.width = ctxWidth + "px";
    canvas.style.height = ctxHeight + "px";

    context.scale(scale, scale);

    svg.attr("width", ctxWidth).attr("height", ctxHeight);

    applyContainerSize();

    // Keep the gear against the bottom of the CANVAS, not of the container.
    // The container grows to cover the filter chips, and a gear anchored to
    // its bottom edge would jump down the page every time a filter was added
    // and back up when it was removed.
    if (settingsButton)
      settingsButton.style("bottom", null).style("top", ctxHeight - 22 + "px");
  }

  /**
   * Size the container to the canvas PLUS whatever the filter chips need.
   *
   * `height` is the extent along the RECORD axis, which is the screen height
   * only when the widget is horizontal. Vertical transposes it: records run
   * across, and what determines the screen height is the ATTRIBUTE extent -
   * the columns plus their headers. init() set the container to `height`
   * regardless, so a vertical widget reserved a tall band of empty space below
   * itself, and adding or hiding a column never changed it.
   *
   * The chips are a separate problem in the OTHER direction. They are drawn 30px
   * past the end of the record axis - clear of the count labels and the gear -
   * which in horizontal is past the bottom of the canvas. TWO boxes have to
   * grow to cover them, and missing either one leaves the chips half-drawn:
   *
   *   - the container, or content in normal flow below the widget (the next
   *     paragraph, the next notebook cell) simply paints on top of them;
   *   - divNavio, which CLIPS. It carries `overflow-x: auto` for wide widgets,
   *     and CSS forces the other axis to `auto` whenever one axis is not
   *     `visible` - so it clips vertically as well, which is invisible in the
   *     stylesheet and was the reason growing the container alone did nothing.
   *
   * Measured before the fix: chips at y=428..443, container ending at 428,
   * divNavio ending at 432, elementFromPoint returning the paragraph below.
   */
  function applyContainerSize() {
    const alongA = levelScale.range()[1] + nv.margin + nv.x0,
      { height: ctxHeight } = toWH(alongA, height),
      full = ctxHeight + explanationsPad + "px";
    selection.style("height", full);
    if (divNavio) divNavio.style("height", full);
  }

  nv.initData = function (mData, mColScales) {
    let before = performance.now();

    // getAttribsFromObject(mData[0][0]);
    colScales = mColScales;
    // colScales.keys().forEach(function (d) {
    //   dAttribs.set(d, true);
    // });
    dData = new Map();
    for (let i = 0; i < data.length; i++) {
      dData.set(idOf(i), i);
    }

    filtersByLevel = [];
    filtersByLevel[0] = []; // Initialise filters as empty for lev 0
    // nv.updateData(mData, mColScales, mSortByAttr);

    let after = performance.now();
    if (nv.DEBUG) console.log("Init data " + (after - before) + "ms");
  };

  nv.updateData = function (mDataIs, mColScales, opts) {
    const {
      levelsToUpdate,
      shouldUpdateColorDomains,
      shouldDrawBrushes,
      recomputeBrushes,
    } = opts || {};

    if (nv.DEBUG) console.log("updateData");
    let before = performance.now();

    if (typeof mDataIs !== typeof []) {
      console.warn("navio.updateData: expected an array, got", typeof mDataIs);
      return;
    }

    colScales = mColScales !== undefined ? mColScales : colScales;
    dataIs = mDataIs;

    // Delete filters on unused levels
    filtersByLevel.splice(mDataIs.length);
    // Initialize new filter level
    filtersByLevel[mDataIs.length] = [];

    recomputeVisibleLinks();

    // Delete unnecessary brushes
    dBrushes.splice(mDataIs.length);

    updateScales({
      levelsToUpdate,
      shouldUpdateColorDomains,
    });

    updateWidthAndHeight();

    nv.update({
      levelsToUpdate,
      shouldDrawBrushes,
      recomputeBrushes,
    });

    let after = performance.now();
    if (nv.DEBUG) console.log("Updating data " + (after - before) + "ms");

    // First draw that has attributes: this is the earliest point at which
    // stored hiddenAttribs / attribOrder can resolve to real attributes.
    maybeRestoreSettings();
  }; // updateData

  nv.update = function (opts) {
    let {
      recomputeBrushes,
      // levelsToUpdate,
      shouldDrawBrushes,
    } = opts || {};

    if (!dataIs.length) return nv;

    recomputeBrushes =
      recomputeBrushes !== undefined ? recomputeBrushes : false;
    shouldDrawBrushes =
      shouldDrawBrushes !== undefined ? shouldDrawBrushes : true;

    let before = performance.now();

    let w = levelScale.range()[1] + nv.margin + nv.x0;

    // If updating all levels erase everything
    // if (levelsToUpdate===undefined) {
    context.clearRect(0, 0, w + 1, height + 1);
    // }

    drawLinks();

    // If we didn't get a specific level to update, do them all
    // if (levelsToUpdate===undefined) {

    for (let i = 0; i < dataIs.length; i++) {
      updateLevel(dataIs[i], i);
    }
    // } else {

    //   levelToUpdate.forEach(levelToUp => {
    //     if (! dataIs.length.hasOwnProperty(levelToUp)) {
    //       updateLevel(dataIs[levelToUp], levelToUp);
    //     } else {
    //       if (nv.DEBUG) console.log("Asked to update a level that doesn't exist, ignoring. Level=" , levelToUp, " levs to update" levelsToUpdate);
    //     }

    //   });
    // }

    if (shouldDrawBrushes) {
      drawBrushes(recomputeBrushes);
      drawCloseButton();
    }

    let after = performance.now();
    if (nv.DEBUG) console.log("Redrawing " + (after - before) + "ms");
    return nv;
  };

  /**
   * Is this attribute actually present in the data?
   *
   * Checks a sample rather than every row: a column can legitimately be null
   * in the first few records without being absent. Returns true when there is
   * no data yet - the caller is allowed to declare attributes first.
   */
  function attribExistsInData(attr) {
    if (!data.length) return true;
    const name = getAttribName(attr);
    // Derived columns are not row properties. See #88.
    if (name === "__seqId" || name === "selected") return true;
    if (typeof attr === "function") return true; // an accessor computes its own
    const sample = Math.min(data.length, nv.howManyItemsShouldSearchForNotNull);
    for (let i = 0; i < sample; i++) {
      if (data[i] != null && name in data[i]) return true;
    }
    return false;
  }

  nv.addAttrib = function (attr, scale) {
    if (scale === undefined) {
      scale = d3.scaleOrdinal(d3.schemeCategory10);
    }
    if (dAttribs.has(getAttribName(attr))) {
      console.warn(`navio.addAttrib: attribute ${attr} already added`);
      return;
    }
    // A misspelled column used to be added silently and drawn as a stripe of
    // nulls, which looks like a data problem rather than a typo.
    if (!attribExistsInData(attr)) {
      const known = Object.keys(data[0] || {});
      console.warn(
        `navio.addAttrib: "${getAttribName(attr)}" is not in the data. ` +
          `The column will be empty. Available: ${known.join(", ")}`
      );
    }
    attribsOrdered.push(attr);
    dAttribs.set(getAttribName(attr), attr);
    colScales.set(attr, scale);
    return nv;
  };

  nv.addSequentialAttrib = function (attr, _scale) {
    const domain =
      data !== undefined && data.length > 0
        ? // By INDEX, not by row: "__seqId" is derived (#88), so reading it off
          // the row gives undefined for every row and collapses the domain to
          // [undefined, undefined] - a flat, unreadable column.
          d3.extent(data, function (_d, i) {
            return attribAt(i, attr);
          })
        : [0, 1]; //if we don"t have data, set the default domain
    const scale =
      _scale || d3.scaleSequential(nv.defaultColorInterpolator).domain(domain);
    scale.__type = "seq";
    nv.addAttrib(attr, scale);
    return nv;
  };

  // Same as addSequentialAttrib but with a different color
  nv.addDateAttrib = function (attr, _scale) {
    const domain =
      data !== undefined && data.length > 0
        ? d3.extent(data, function (d) {
            return getAttrib(d, attr);
          })
        : [0, 1];

    const scale =
      _scale ||
      d3.scaleSequential(nv.defaultColorInterpolatorDate).domain(domain); //if we don"t have data, set the default domain
    nv.addAttrib(attr, scale);

    scale.__type = "date";
    return nv;
  };

  // Adds a diverging scale
  nv.addDivergingAttrib = function (attr, _scale) {
    const domain =
      data !== undefined && data.length > 0
        ? d3.extent(data, function (d) {
            return getAttrib(d, attr);
          })
        : [-1, 1];
    const scale =
      _scale ||
      d3
        .scaleSequential(nv.defaultColorInterpolatorDiverging)
        .domain([domain[0], domain[1]]); //if we don"t have data, set the default domain
    scale.__type = "div";
    nv.addAttrib(attr, scale);
    return nv;
  };

  nv.addCategoricalAttrib = function (attr, _scale) {
    const scale = _scale || d3.scaleOrdinal(nv.defaultColorCategorical);
    scale.__type = "cat";
    nv.addAttrib(attr, scale);

    return nv;
  };

  nv.addTextAttrib = function (attr, _scale) {
    const scale =
      _scale ||
      scaleText(
        nv.nullColor,
        nv.digitsForText,
        nv.defaultColorInterpolatorText
      );

    nv.addAttrib(attr, scale);

    return nv;
  };

  nv.addOrderedAttrib = function (attr, _scale) {
    const scale =
      _scale || scaleOrdered(nv.nullColor, nv.defaultColorInterpolatorOrdered);

    nv.addAttrib(attr, scale);

    return nv;
  };

  nv.addBooleanAttrib = function (attr, _scale) {
    const scale =
      _scale ||
      d3
        .scaleOrdinal()
        .domain([true, false, null])
        .range(nv.defaultColorRangeBoolean);

    scale.__type = "bool";
    nv.addAttrib(attr, scale);

    return nv;
  };

  // Adds a more complex attribute with a wrapper to convert it into JSON
  nv.addObjectAttrib = function (attr, _scale) {
    const scale =
      _scale ||
      scaleText(
        nv.nullColor,
        nv.digitsForObjects, // nv.digitsForText,
        nv.defaultColorInterpolatorObject
      );

    let stringifiedAttr;
    if (typeof attr === "function") {
      stringifiedAttr = (d) => JSON.stringify(attr(d));
    } else {
      stringifiedAttr = (d) => {
        try {
          return d[attr] ? JSON.stringify(d[attr]) : d[attr];
        } catch (_e) {
          return undefined;
        }
      };
      // Navio derives a column's label from fn.name (see getAttribName), so
      // set it directly rather than baking the attribute name into evaluated
      // source the way convertAttribToFn still does - that pattern lets a
      // crafted key in user-supplied data execute arbitrary code (see #71).
      Object.defineProperty(stringifiedAttr, "name", { value: String(attr) });
    }
    nv.addAttrib(stringifiedAttr, scale);
    return nv;
  };

  // Adds all the attributes on the data, or all the attributes provided on the list based on their types
  nv.addAllAttribs = function (_attribs) {
    if (!data || !data.length)
      throw Error(
        "addAllAttribs called without data to guess the attribs. Make sure to call it after setting the data"
      );

    let attribs =
      _attribs !== undefined
        ? _attribs
        : getAttribsFromObjectAsFn(data[0], nv.addAllAttribsRecursionLevel);
    // Attributes we skip are reported once at the end rather than one console
    // line per column, so the message stays readable on wide datasets.
    const skippedArrays = [],
      skippedObjects = [];

    for (let attr of attribs) {
      if (attr === "__seqId" || attr === "__i" || attr === "selected") continue;

      const attrName = typeof attr === "function" ? attr.name : attr;
      const firstNotNull = findNotNull(data, attr);

      if (
        firstNotNull === null ||
        firstNotNull === undefined ||
        typeof firstNotNull === typeof ""
      ) {
        const numDistinctValues = new Set(
          data
            .slice(0, nv.howManyItemsShouldSearchForNotNull)
            .map((d) => getAttrib(d, attr))
        ).size;

        // How many different elements are there
        if (numDistinctValues < nv.maxNumDistinctForCategorical) {
          nv.DEBUG &&
            console.log(
              `Navio: Adding attr ${attrName} as categorical with ${numDistinctValues} categories`
            );
          nv.addCategoricalAttrib(attr);
        } else if (numDistinctValues < nv.maxNumDistinctForOrdered) {
          nv.addOrderedAttrib(attr);
          nv.DEBUG &&
            console.log(
              `Navio: Attr ${attrName} has more than ${nv.maxNumDistinctForCategorical} distinct values (${numDistinctValues}) using orderedAttrib`
            );
        } else {
          nv.DEBUG &&
            console.log(
              `Navio: Attr ${attrName} has more than ${nv.maxNumDistinctForOrdered} distinct values (${numDistinctValues}) using textAttrib`
            );
          nv.addTextAttrib(attr);
        }
      } else if (typeof firstNotNull === typeof 0) {
        // Numbers
        if (d3.min(data, (d) => getAttrib(d, attr)) < 0) {
          nv.DEBUG &&
            console.log(`Navio: Adding attr ${attrName} as diverging`);
          nv.addDivergingAttrib(attr);
        } else {
          nv.DEBUG &&
            console.log(`Navio: Adding attr ${attrName} as sequential`);
          nv.addSequentialAttrib(attr);
        }
      } else if (firstNotNull instanceof Date) {
        nv.DEBUG && console.log(`Navio: Adding attr ${attrName} as date`);
        nv.addDateAttrib(attr);
      } else if (typeof firstNotNull === typeof true) {
        nv.DEBUG && console.log(`Navio: Adding attr ${attrName} as boolean`);
        nv.addBooleanAttrib(attr);
      } else {
        // Default categories

        if (Array.isArray(firstNotNull)) {
          if (nv.addAllAttribsIncludeArrays) {
            nv.DEBUG &&
              console.log(
                `Navio: Adding ${attrName} adding as Object (type=array)`
              );
            // nv.addCategoricalAttrib(attr);
            nv.addObjectAttrib(attr);
          } else {
            skippedArrays.push(attrName);
          }
        } else {
          if (nv.addAllAttribsIncludeObjects) {
            nv.DEBUG &&
              console.log(
                `Navio: Adding object ${attrName} adding as Object (type=object)`
              );
            // nv.addCategoricalAttrib(attr);
            nv.addObjectAttrib(attr);
          } else {
            skippedObjects.push(attrName);
          }
        }
      }
    }

    // Skipping data silently would hide columns the caller expects to see, so
    // this warns unconditionally - but only once, and it says how to opt in.
    if (skippedArrays.length)
      console.warn(
        `navio.addAllAttribs: ignored ${skippedArrays.length} array attribute(s) [${skippedArrays.join(", ")}]. Set nv.addAllAttribsIncludeArrays = true to include them.`
      );
    if (skippedObjects.length)
      console.warn(
        `navio.addAllAttribs: ignored ${skippedObjects.length} object attribute(s) [${skippedObjects.join(", ")}]. Set nv.addAllAttribsIncludeObjects = true to include them.`
      );

    nv.data(data);
    // drawBrushes(true); // updates brushes width
    return nv;
  };

  nv.data = function (_) {
    initTooltipPopper();
    // nv.settings is read here, the same way the tooltip options are: set it
    // before data(), or call data() again to apply a change.
    initSettingsPanel();

    if (nv.showSelectedAttrib && !colScales.has("selected")) {
      nv.addAttrib(
        "selected",
        d3
          .scaleOrdinal()
          .domain([false, true])
          .range(nv.defaultColorRangeSelected)
        //, "#cddca3", "#8c6d31", "#bd9e39"]
      );
      moveAttrToPos("selected", 0);
    }
    if (nv.showSequenceIDAttrib && !colScales.has("__seqId")) {
      nv.addSequentialAttrib("__seqId");
      moveAttrToPos("__seqId", 1);
    }

    if (arguments.length) {
      data = _.slice(0);
      // Fresh side tables for the new dataset; everything starts selected.
      selectedFlags = new Uint8Array(data.length).fill(1);
      posByLevel = [
        Int32Array.from({ length: data.length }, (_unused, i) => i),
      ];
      rowIndex = null;
      dataIs = [
        data.map(function (_, i) {
          return i;
        }),
      ];

      nv.initData(dataIs, colScales);

      // Has the user added attributes already? then update
      if (
        attribsOrdered.length >
        (nv.showSelectedAttrib ? 1 : 0) + (nv.showSequenceIDAttrib ? 1 : 0)
      ) {
        nv.updateData(dataIs, colScales, { shouldUpdateColorDomains: true });
      }

      return nv;
    } else {
      return data;
    }
  };

  // --- Filter state, serializable ------------------------------------------
  //
  // Shape: one entry per level, each an array of filter descriptors. Levels are
  // a drill-down chain, so entries must be contiguous from 0 - see
  // docs/ai/FILTERING-MODEL.md.
  //
  // A dragged range is a band of rows in the ordering that was on screen, not a
  // value range on any single attribute, so a range descriptor carries the sort
  // that produced it. Restoring re-establishes that sort before rebuilding the
  // range, which is why this needs nv.sortBy to actually sort (#81).

  nv.getFilters = function () {
    // filtersByLevel can be sparse; emit [] for a missing level so the value is
    // plain JSON with no nulls in it.
    return Array.from(filtersByLevel, (levelFilters, level) =>
      (levelFilters || []).map((f) =>
        f.toValue({
          sortAttrib: dSortBy[level]
            ? getAttribName(dSortBy[level].attrib)
            : null,
          sortDesc: dSortBy[level] ? dSortBy[level].desc : false,
          id,
        })
      )
    );
  };

  nv.setFilters = function (value) {
    if (!Array.isArray(value)) {
      console.warn("navio.setFilters: expected an array of levels, got", value);
      return nv;
    }
    if (!data.length) {
      console.warn("navio.setFilters: no data loaded yet, ignoring");
      return nv;
    }

    const resolveAttrib = (name) =>
      dAttribs.has(name) ? dAttribs.get(name) : name;

    // Start from a clean chain; every apply below is silent so that restoring
    // a value emits exactly one change at the end rather than one per level.
    // Levels are filled with empty arrays rather than left as holes - Navio
    // indexes filtersByLevel by position, and a hole is not the same as "no
    // filters here".
    filtersByLevel = dataIs.map(() => []);
    deleteSubsequentLevels(1, dataIs, { shouldUpdate: false, silent: true });

    // Whether anything below repainted. The teardown above deliberately does
    // not, so that restoring a value costs one redraw instead of one per level
    // - but that leaves nothing to repaint when the incoming value has no
    // filters at all, which is exactly what closing the last level produces.
    // The peer's data collapsed while its canvas kept drawing the old level.
    let repainted = false;

    for (let level = 0; level < value.length; level++) {
      const specs = Array.isArray(value[level]) ? value[level] : [];
      // getLastLevelFromFilters stops at the first empty level, so anything
      // beyond a gap would be unreachable anyway.
      if (!specs.length) break;
      if (!dataIs[level]) break;

      // Ranges are positions in this level's ordering, so re-establish it
      // before resolving any boundaries against it.
      const ranged = specs.find((sp) => sp && sp.sortAttrib);
      if (ranged) {
        applySort(level, resolveAttrib(ranged.sortAttrib), !!ranged.sortDesc, {
          silent: true,
        });
      }

      const rebuilt = specs
        .map((spec) =>
          filterFromValue(spec, {
            level,
            indices: dataIs[level],
            getRow: (i) => data[i],
            getPos: posAt,
            getAttribAt: attribAt,
            getId: idOf,
            resolveAttrib,
            getAttrib,
            getAttribName,
          })
        )
        .filter(Boolean);

      if (rebuilt.length !== specs.length) {
        console.warn(
          `navio.setFilters: dropped ${specs.length - rebuilt.length} filter(s) at level ${level} that could not be rebuilt`
        );
      }
      if (!rebuilt.length) break;

      while (filtersByLevel.length < level) filtersByLevel.push([]);
      filtersByLevel[level] = rebuilt;
      // Produces dataIs[level + 1], which the next iteration needs.
      applyFiltersAndUpdate(level, { silent: true });
      repainted = true;
    }

    if (!repainted) nv.updateData(dataIs, colScales);

    // The brush is how a range filter is expressed on screen; put it back so a
    // synced widget can be dragged, not just read.
    restoreBrushes();

    notifyChange({ silent: false });
    return nv;
  };

  /**
   * Redraw the brush rectangle for every level holding a range filter.
   *
   * Applying filters programmatically reproduces the selection but not the
   * brush that expressed it, so a widget synced from a peer ends up filtered
   * with nothing to grab. Mapping the filter's boundary rows back through the
   * level's y scale puts the handles back where the user could drag them.
   */
  function restoreBrushes() {
    filtersByLevel.forEach((levelFilters, level) => {
      if (!levelFilters || !dBrushes[level] || !yScales[level]) return;

      const ranged = levelFilters.find((f) => f.bounds);
      const g = brushesOnLevel(level);
      if (g.empty()) return;

      if (!ranged) {
        g.call(dBrushes[level].move, null);
        return;
      }

      const { firstIndex, lastIndex } = ranged.bounds();
      const y0 = yScales[level](idOf(firstIndex));
      const y1 = yScales[level](idOf(lastIndex));
      if (y0 === undefined || y1 === undefined) return;

      const band = yScales[level].bandwidth();
      g.call(dBrushes[level].move, [Math.min(y0, y1), Math.max(y0, y1) + band]);
    });
  }

  /**
   * Is this row currently selected? Accepts a row object or its index.
   *
   * Navio no longer writes a `selected` property onto your rows, so use this
   * (or getSelected()) rather than reading `d.selected`. See #88.
   */
  /**
   * The rows at a level, in the order they are drawn.
   *
   * Row positions used to be readable as `d.__i[level]`; that bookkeeping now
   * lives in a side table (#88), so this is the supported way to observe the
   * visual ordering.
   */
  nv.getRowsAtLevel = function (level = 0) {
    return dataIs[level] ? dataIs[level].map((i) => data[i]) : [];
  };

  nv.isSelected = function (rowOrIndex) {
    const i = indexOfRow(rowOrIndex);
    return i === undefined ? false : !!selectedFlags[i];
  };

  nv.getSelected = function () {
    return dataIs[dataIs.length - 1]
      .filter(function (d) {
        return selectedFlags[d];
      })
      .map(function (d) {
        return data[d];
      });
  };
  // Legacy support
  nv.getVisible = nv.getSelected;

  /**
   * Select an explicit set of rows, replacing whatever chain is in place.
   *
   * The inbound half of a two-way binding: getSelected() says what the user
   * picked here, this says what a peer picked elsewhere. Rows are matched by
   * nv.id(), so the argument may be this instance's own row objects, another
   * instance's rows carrying the same id field, or bare id values.
   *
   * Selecting everything CLEARS the chain rather than adding a redundant level
   * - which is exactly what an initial bind against an unfiltered peer sends.
   */
  nv.setSelectedRows = function (rows) {
    if (!Array.isArray(rows)) {
      console.warn("navio.setSelectedRows: expected an array, got", rows);
      return nv;
    }
    if (!data.length) {
      console.warn("navio.setSelectedRows: no data loaded yet, ignoring");
      return nv;
    }

    let unresolved = 0;
    const ids = [];
    for (const r of rows) {
      // A bare id, already in the form the filter wants.
      if (r === null || typeof r !== "object") {
        ids.push(r);
        continue;
      }
      // A custom id lives on the row, so a foreign object resolves fine. The
      // default id is the row's index into `data`, which only an object we own
      // can supply - hence the identity lookup.
      const v = id !== "__seqId" ? getAttrib(r, id) : indexOfRow(r);
      if (v === undefined) unresolved++;
      else ids.push(v);
    }
    if (unresolved) {
      console.warn(
        `navio.setSelectedRows: ${unresolved} row(s) are not in this data` +
          (id === "__seqId"
            ? " - they are matched by object identity, so call nv.id() with a" +
              " shared key to sync rows across instances"
            : ` under id "${id}"`)
      );
    }

    if (ids.length >= data.length) return nv.setFilters([[]]);
    return nv.setFilters([[{ type: "ids", ids }]]);
  };

  /**
   * The links whose BOTH endpoints are currently selected - the ones Navio
   * draws. Recomputed on every update; endpoints are resolved from the caller's
   * own row objects each time, deliberately (see #61 and CLAUDE.md).
   */
  /**
   * Hide or show an attribute's column without removing it (#89).
   *
   * Hiding never touches the filter chain, the sort, or the attribute's colour
   * scale - so it emits no change event and a bound peer is unaffected. A
   * filter on a hidden attribute keeps working; you just cannot see the column.
   */
  nv.setAttribVisible = function (attrib, visible = true) {
    const name = getAttribName(attrib);
    if (visible) hiddenAttribs.delete(name);
    else hiddenAttribs.add(name);
    nv.hardUpdate();
    persistSettings();
    return nv;
  };

  /** Is this attribute's column currently drawn? */
  nv.isAttribVisible = function (attrib) {
    return !hiddenAttribs.has(getAttribName(attrib));
  };

  // The attribute types a column can be switched between, and the method that
  // builds each one's scale. "object" is excluded on purpose: addObjectAttrib
  // replaces the attribute with a stringifying accessor rather than just
  // changing its scale, so it is not a like-for-like swap.
  const ATTRIB_TYPES = {
    cat: { label: "categorical", add: "addCategoricalAttrib" },
    seq: { label: "sequential", add: "addSequentialAttrib" },
    ordered: { label: "ordered", add: "addOrderedAttrib" },
    text: { label: "text", add: "addTextAttrib" },
    date: { label: "date", add: "addDateAttrib" },
    div: { label: "diverging", add: "addDivergingAttrib" },
    bool: { label: "boolean", add: "addBooleanAttrib" },
  };

  /** The type tag of an attribute's colour scale: "cat", "seq", "text"... */
  nv.getAttribType = function (attrib) {
    const scale = colScales.get(attrib) || colScales.get(getAttribName(attrib));
    return scale && scale.__type;
  };

  /** The switchable types, as {value, label} - for building a picker. */
  nv.getAttribTypes = function () {
    return Object.entries(ATTRIB_TYPES).map(([value, t]) => ({
      value,
      label: t.label,
    }));
  };

  /**
   * Re-type a column: how it is coloured and how its values are interpreted.
   *
   * Only the colour scale changes. The attribute keeps its name, its position,
   * and anything pointing at it - sorting compares raw values and so does a
   * value filter, while a range filter compares positions, so none of them are
   * invalidated by a re-type. addAllAttribs guesses types from the data and
   * sometimes guesses wrong; this is the correction.
   */
  nv.setAttribType = function (attrib, type) {
    const spec = ATTRIB_TYPES[type];
    if (!spec) {
      console.warn(
        `navio.setAttribType: unknown type "${type}". ` +
          `One of: ${Object.keys(ATTRIB_TYPES).join(", ")}`
      );
      return nv;
    }
    const name = getAttribName(attrib);
    const pos = attribsOrdered.findIndex((a) => getAttribName(a) === name);
    if (pos === -1) {
      console.warn(
        `navio.setAttribType: "${name}" is not one of the attributes`
      );
      return nv;
    }
    const attr = attribsOrdered[pos];
    if (nv.getAttribType(attr) === type) return nv;

    // Drop it from all three structures and let the real add*Attrib rebuild
    // it, so the scale is constructed exactly as it would have been at setup -
    // domain included. Then put it back where it was: addAttrib appends.
    attribsOrdered.splice(pos, 1);
    dAttribs.delete(name);
    colScales.delete(attr);
    colScales.delete(name);

    nv[spec.add](attr);
    moveAttrToPos(attr, pos);

    nv.hardUpdate();
    return nv;
  };

  /** The attributes currently drawn, in order. A subset of getAttribs(). */
  nv.getVisibleAttribs = function () {
    return visibleAttribs().slice();
  };

  /** Replace the hidden set wholesale; accepts names or attribute values. */
  nv.setHiddenAttribs = function (names = []) {
    hiddenAttribs = new Set(Array.from(names, (n) => getAttribName(n)));
    nv.hardUpdate();
    persistSettings();
    return nv;
  };

  nv.getHiddenAttribs = function () {
    return Array.from(hiddenAttribs);
  };

  /**
   * The widget's extent along the RECORD axis - its height horizontally, its
   * width vertically (#22). It was a construction-only argument; the settings
   * panel needs to change it live.
   */
  nv.height = function (_) {
    if (!arguments.length) return height;
    height = +_;
    nv.hardUpdate();
    return nv;
  };

  nv.getVisibleLinks = function () {
    return visibleLinks;
  };

  nv.sortBy = function (_attrib, _desc = false, _level = undefined) {
    // The default level is the last one
    let level = Math.max(
      0,
      _level !== undefined && _level < dataIs.length
        ? _level
        : dataIs.length - 1
    );

    if (_attrib !== undefined) {
      // Sorting by a column that was never added silently did nothing - the
      // comparator read undefined for every row, so the order came out
      // unchanged and looked like a Navio bug rather than a typo.
      if (!dAttribs.has(getAttribName(_attrib))) {
        console.warn(
          `navio.sortBy: "${getAttribName(_attrib)}" is not one of the ` +
            `attributes. Nothing was sorted. Available: ` +
            `${Array.from(dAttribs.keys()).join(", ")}`
        );
        return nv;
      }
      return applySort(level, _attrib, _desc);
    } else {
      return dSortBy[level];
    }
  };

  // updateCallback is a single overwritable slot and the documented
  // integration point, so library code must never register on it - that would
  // silently clobber whatever the embedding app set. onChange is the additive,
  // multi-subscriber alternative. Returns an unsubscribe function.
  nv.onChange = function (fn) {
    changeListeners.push(fn);
    return function off() {
      const i = changeListeners.indexOf(fn);
      if (i !== -1) changeListeners.splice(i, 1);
    };
  };

  nv.updateCallback = function (_) {
    return arguments.length ? ((updateCallback = _), nv) : updateCallback;
  };

  nv.selectedColorRange = function (_) {
    return arguments.length
      ? ((nv.defaultColorRangeSelected = _), nv)
      : nv.defaultColorRangeSelected;
  };

  // nv.defaultColorInterpolator = function(_) {
  //   return arguments.length ? (nv.defaultColorInterpolator = _, nv) : nv.defaultColorInterpolator;
  // };

  nv.id = function (_) {
    return arguments.length ? ((id = _), nv) : id;
  };

  nv.links = function (_) {
    if (arguments.length) {
      links = _;
      recomputeVisibleLinks();
      return nv;
    } else {
      return links;
    }
  };

  // Returns a d3.scale used for coloring the corresponding attrib
  // check scale.__type for finding out the type of attribute (if undefined, navio doesn't know the type)
  nv.getColorScale = function (attrib) {
    return colScales.get(attrib);
  };

  // Returns an array with the list (in order) of attributes used right now
  nv.getAttribs = function () {
    return attribsOrdered;
  };

  // Slower update that recomputes brushes and checks for parameters.
  // Use it if you change any parameters or added new attributes after calling .data
  nv.hardUpdate = function (opts = {}) {
    const shouldDrawBrushes =
        opts.shouldDrawBrushes !== undefined ? opts.shouldDrawBrushes : true,
      shouldUpdateColorDomains =
        opts.shouldUpdateColorDomains !== undefined
          ? opts.shouldUpdateColorDomains
          : true,
      recomputeBrushes =
        opts.recomputeBrushes !== undefined ? opts.recomputeBrushes : true,
      levelsToUpdate =
        opts.levelsToUpdate !== undefined
          ? opts.levelsToUpdate
          : d3.range(dataIs.length); // Range is not inclusive so is not length-1;

    // Update all the levels
    nv.updateData(dataIs, colScales, {
      shouldDrawBrushes,
      shouldUpdateColorDomains,
      recomputeBrushes,
      levelsToUpdate,
    });

    // hardUpdate is the "geometry changed" path - attribWidth, orientation,
    // margins. A brush's on-screen rectangle is in pixels, so any of those
    // leaves it pointing at the wrong rows, and an orientation flip leaves it
    // on the wrong AXIS entirely, which makes it unusable. restoreBrushes
    // re-derives it from the filter's stored row bounds through the current
    // scales, so it lands correctly in either orientation.
    if (shouldDrawBrushes) restoreBrushes();

    // The canvas may have changed size under an open panel.
    if (settingsIsOpen()) placeSettingsPanel();
  };

  // Tears down everything this instance attached outside its own container,
  // and releases the data it holds. Without this, unmounting a Navio in a SPA
  // leaves listeners on `body` that keep the whole closure - dataset included -
  // reachable forever. Safe to call more than once.
  nv.destroy = function () {
    // Only this instance's namespaced listeners; other Navios keep theirs.
    d3.select("body")
      .on(`keydown.navio-${instanceId}`, null)
      .on(`keyup.navio-${instanceId}`, null);

    if (tooltip && typeof tooltip.destroy === "function") tooltip.destroy();
    tooltip = null;

    if (settingsPanel) {
      // The light-dismiss listener lives on `document`, so removing the panel
      // is not enough to detach it.
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

    if (liveRegion) {
      liveRegion.remove();
      liveRegion = null;
    }

    if (tooltipElement) {
      tooltipElement.remove();
      tooltipElement = null;
    }

    // Everything else Navio rendered lives under the container it was given.
    if (selection && selection.selectAll) selection.selectAll("*").remove();

    svg = canvas = context = undefined;

    // Drop references to the data so the closure stops pinning it in memory.
    data = [];
    selectedFlags = new Uint8Array(0);
    posByLevel = [];
    rowIndex = null;
    dataIs = [];
    links = [];
    visibleLinks = [];
    dData = new Map();
    attribsOrdered = [];
    hiddenAttribs = new Set();
    dAttribs = new Map();
    dSortBy = [];
    dBrushes = [];
    filtersByLevel = [];
    yScales = [];
    colScales = new Map();
    updateCallback = function () {};

    return nv;
  };

  // Construction-time options. Applied HERE, not next to the schema: the
  // accessor-backed ones (nv.id, nv.updateCallback, nv.links) are defined
  // further down the closure and do not exist yet up there. This is still
  // before init(), which is what reads the construction-time options
  // (tooltip*, settings*), so they land in time.
  if (_options) applyOptions(_options);

  init();
  return nv;
}

// Returns a flat array with all the attributes in an object up to recursionLevel
navio.getAttribsFromObjectRecursive = getAttribsFromObjectRecursive;
// Returns a flat array with all the attributes in an object up to recursionLevel, for nested attributes returns a function
navio.getAttribsFromObjectAsFn = getAttribsFromObjectAsFn;

// So the loaded build can be checked without reading the console - useful from
// a notebook cell, or from a test.
navio.version = VERSION;

/**
 * Default DEBUG for instances created from here on.
 *
 * Set it before constructing to capture the tracing that construction and the
 * first data() call emit:
 *
 *   navio.DEBUG = true;            // or globalThis.NAVIO_DEBUG = true
 *   const nv = new navio(el, 400); // traces from the very first call
 *
 * The global is honoured so it can be set before the script even loads - handy
 * from an Observable cell, or a devtools console followed by a reload.
 */
navio.DEBUG =
  typeof globalThis !== "undefined" && globalThis.NAVIO_DEBUG === true;

export default navio;

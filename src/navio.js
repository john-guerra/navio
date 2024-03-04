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

let DEBUG = false;

//eleId must be the ID of a context element where everything is going to be drawn
function navio(selection, _h) {
  "use strict";
  let nv = this || {},
    data = [], //Contains the original data attributes
    dataIs = [], //Contains only the indices to the data, is an array of arrays, one for each level
    links = [],
    visibleLinks = [],
    dData = new Map(), // A hash for the data
    attribsOrdered = [],
    dAttribs = new Map(),
    dSortBy = [], //contains which attribute to sort by on each column
    dBrushes = [],
    filtersByLevel = [], // The filters applied to each level
    yScales = [],
    xScale,
    x,
    height = _h !== undefined ? _h : 600,
    colScales = new Map(),
    levelScale,
    svg,
    canvas,
    context,
    tooltip,
    tooltipElement,
    tooltipCoords = { x: -50, y: -50 },
    id = "__seqId",
    updateCallback = function () {},
    cursorSubstractData =
      "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMzJweCIgaGVpZ2h0PSIzMnB4IiB2aWV3Qm94PSIwIDAgMzIgMzIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDU0LjEgKDc2NDkwKSAtIGh0dHBzOi8vc2tldGNoYXBwLmNvbSAtLT4KICAgIDx0aXRsZT5jdXJzb3JTdWJzdHJhY3Q8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iY3Vyc29yU3Vic3RyYWN0IiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8cGF0aCBkPSJNOSwwLjUgTDcsMC41IEw3LDcgTDAuNSw3IEwwLjUsOSBMNyw5IEw3LDE1LjUgTDksMTUuNSBMOSw5IEwxNS41LDkgTDE1LjUsNyBMOSw3IEw5LDAuNSBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIHN0cm9rZT0iI0ZGRkZGRiIgZmlsbD0iIzAwMDAwMCI+PC9wYXRoPgogICAgICAgIDxyZWN0IGlkPSJSZWN0YW5nbGUiIGZpbGw9IiMwMDAwMDAiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE1LjAwMDAwMCwgMTUuMDAwMDAwKSByb3RhdGUoLTI3MC4wMDAwMDApIHRyYW5zbGF0ZSgtMTUuMDAwMDAwLCAtMTUuMDAwMDAwKSAiIHg9IjE0IiB5PSIxMSIgd2lkdGg9IjIiIGhlaWdodD0iOCI+PC9yZWN0PgogICAgPC9nPgo8L3N2Zz4=",
    cursorAddData =
      "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMzJweCIgaGVpZ2h0PSIzMnB4IiB2aWV3Qm94PSIwIDAgMzIgMzIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDU0LjEgKDc2NDkwKSAtIGh0dHBzOi8vc2tldGNoYXBwLmNvbSAtLT4KICAgIDx0aXRsZT5jdXJzb3JBZGQ8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iY3Vyc29yQWRkIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8cGF0aCBkPSJNOSwwLjUgTDcsMC41IEw3LDcgTDAuNSw3IEwwLjUsOSBMNyw5IEw3LDE1LjUgTDksMTUuNSBMOSw5IEwxNS41LDkgTDE1LjUsNyBMOSw3IEw5LDAuNSBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIHN0cm9rZT0iI0ZGRkZGRiIgZmlsbD0iIzAwMDAwMCI+PC9wYXRoPgogICAgICAgIDxwYXRoIGQ9Ik0xNiwxNCBMMTksMTQgTDE5LDE2IEwxNiwxNiBMMTYsMTkgTDE0LDE5IEwxNCwxNiBMMTEsMTYgTDExLDE0IEwxNCwxNCBMMTQsMTEgTDE2LDExIEwxNiwxNCBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIGZpbGw9IiMwMDAwMDAiPjwvcGF0aD4KICAgIDwvZz4KPC9zdmc+",
    cursorData =
      "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMzJweCIgaGVpZ2h0PSIzMnB4IiB2aWV3Qm94PSIwIDAgMzIgMzIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDU0LjEgKDc2NDkwKSAtIGh0dHBzOi8vc2tldGNoYXBwLmNvbSAtLT4KICAgIDx0aXRsZT5jdXJzb3I8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iY3Vyc29yIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8cGF0aCBkPSJNOSwwLjUgTDcsMC41IEw3LDcgTDAuNSw3IEwwLjUsOSBMNyw5IEw3LDE1LjUgTDksMTUuNSBMOSw5IEwxNS41LDkgTDE1LjUsNyBMOSw3IEw5LDAuNSBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIHN0cm9rZT0iI0ZGRkZGRiIgZmlsbD0iIzAwMDAwMCI+PC9wYXRoPgogICAgPC9nPgo8L3N2Zz4=";

  // Default parameters
  nv.x0 = 0; //Where to start drawing navio in x
  nv.y0 = 100; //Where to start drawing navio in y, useful if your attrib names are too long
  nv.maxNumDistictForCategorical = 10; // addAllAttribs uses this for deciding if an attribute is categorical (has less than nv.maxNumDistictForCategorical categories) or ordered
  nv.maxNumDistictForOrdered = 90; // addAllAttribs uses this for deciding if an attribute is ordered (has less than nv.maxNumDistictForCategorical categories) or text
  // use nv.maxNumDistictForOrdered = Infinity for never choosing Text
  nv.howManyItemsShouldSearchForNotNull = 100; // How many rows should addAllAttribs search to decide guess an attribute type
  nv.margin = 10; // Margin around navio

  nv.levelsSeparation = 40; // Separation between the levels
  nv.divisionsColor = "white"; // Border color for the divisions
  nv.nullColor = "#ffedfd"; // Color for null values
  nv.levelConnectionsColor = "rgba(205, 220, 163, 0.5)"; // Color for the conections between levels
  nv.divisionsThreshold = 4; // What's the minimum row height needed to draw divisions
  nv.fmtCounts = d3.format(",.0d"); // Format used to display the counts on the bottom
  nv.legendFont = "14px sans-serif"; // The font for the header
  nv.linkColor = "#ccc"; // Color used for network links if provided with nv.links()
  nv.nestedFilters = true; // Should navio use nested levels?

  nv.showAttribTitles = true; // Show headers?
  nv.attribWidth = 15; // Width of the columns
  nv.attribRotation = -45; // Headers rotation
  nv.attribFontSize = 13; // Headers font size
  nv.attribFontSizeSelected = 32; // Headers font size when mouse over

  nv.filterFontSize = 8; // Font size of the filters explanations on the bottom

  nv.tooltipFontSize = 12; // Font size for the tooltip
  nv.tooltipBgColor = "#b2ddf1"; // Font color for tooltip background
  nv.tooltipMargin = 50; // How much to separate the tooltip from the cursor
  nv.tooltipArrowSize = 10; // How big is the arrow on the tooltip

  nv.addAllAttribsRecursionLevel = Infinity; // How many levels depth do we keep on adding nested attributes
  nv.addAllAttribsIncludeObjects = false; // Should addAllAttribs include objects
  nv.addAllAttribsIncludeArrays = false; // Should addAllAttribs include arrays

  nv.digitsForText = 2; // How many digits to use for text attributes

  nv.defaultColorInterpolator = d3.interpolateBlues;
  nv.defaultColorInterpolatorDate = d3.interpolatePurples;
  nv.defaultColorInterpolatorDiverging = d3.interpolateBrBG;
  nv.defaultColorInterpolatorOrdered = d3.interpolateOranges;
  nv.defaultColorInterpolatorText = d3.interpolateGreys;

  nv.defaultColorRangeBoolean = ["#a1d76a", "#e9a3c9", "white"]; //true false null
  nv.defaultColorRangeSelected = ["white", "#b5cf6b"];
  nv.defaultColorCategorical = d3.schemeCategory10;

  nv.showSelectedAttrib = true; // Display the attribute that shows if a row is selected
  nv.showSequenceIDAttrib = true; // Display the attribute with the sequence ID

  // function nozoom(event) {
  //   if (DEBUG) console.log("nozoom");
  //   event.preventDefault();
  // }

  function initTooltipPopper() {
    if (tooltipElement) tooltipElement.remove();

    d3.selectAll("._nv_popover").remove();
    tooltipElement = d3
      .select("body")
      .append("div")
      .attr("class", "_nv_popover")
      // .style("text-shadow", "0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff")
      .style("pointer-events", "none")
      .style("font-family", "sans-serif")
      .style("font-size", nv.tooltipFontSize)
      .style("text-align", "center")
      .style("background", nv.tooltipBgColor)
      .style("position", "relative")
      .style("color", "black")
      .style("z-index", 4)
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

    // const ref= {
    //   getBoundingClientRect: () => {
    //     return {
    //       top: tooltipCoords.y,
    //       right: tooltipCoords.x,
    //       bottom: tooltipCoords.y,
    //       left: tooltipCoords.x,
    //       width: 0,
    //       height: 0,
    //     };
    //   },
    //   clientWidth: 0,
    //   clientHeight: 0,
    // };

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
    if (event.key === "Alt") {
      d3.selectAll(".overlay")
        .attr("cursor", `url(${cursorSubstractData}) 8 8, zoom-out`)
        .style("cursor", `url(${cursorSubstractData}) 8 8, zoom-out`);
      // console.log("Alt!");
    } else if (event.key === "Shift") {
      d3.selectAll(".overlay")
        .attr("cursor", `url(${cursorAddData}) 8 8, zoom-in`)
        .style("cursor", `url(${cursorAddData}) 8 8, zoom-in`);
      // console.log("Alt!");
    } else {
      d3.selectAll(".overlay").style(
        "cursor",
        `url(${cursorData}) 8 8, crosshair`
      );
    }

    if (event.type === "keyup")
      d3.selectAll(".overlay").style(
        "cursor",
        `url(${cursorData}) 8 8, crosshair`
      );
    // console.log("key", event.type);
  }

  function init() {
    // Try to support strings and elements
    selection =
      typeof selection === typeof "" ? d3.select(selection) : selection;
    selection =
      selection.selectAll === undefined ? d3.select(selection) : selection;

    selection.selectAll("*").remove();

    const divNavio = selection
      // .on("touchstart", nozoom)
      // .on("touchmove", nozoom)
      .style("height", height + "px")
      .attr("class", "navio")
      .append("div")
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

    // TODO: Try a more localized selection
    d3.select("body")
      .on("keydown", changeCursorOnKey)
      .on("keyup", changeCursorOnKey);

    svg.append("g").attr("class", "attribs");

    initTooltipPopper();

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
      .on("click pointerup", () => deleteSubsequentLevels()); //delete last level

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

  function deferEvent(cbk) {
    return function (event, d, i, all) {
      showLoading(this);
      requestAnimationFrame(() => {
        cbk(event, d, i, all);
        hideLoading(this);
      });
    };
  }

  function invertOrdinalScale(scale, x) {
    // Taken from https://bl.ocks.org/shimizu/808e0f5cadb6a63f28bb00082dc8fe3f
    // custom invert function
    let domain = scale.domain();
    let range = scale.range();
    let qScale = d3.scaleQuantize().domain(range).range(domain);

    return qScale(x);
  }

  function updateSorting(levelToUpdate, _dataIs) {
    if (!dSortBy.hasOwnProperty(levelToUpdate)) {
      if (DEBUG)
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
    _dataIs[levelToUpdate].sort(function (a, b) {
      return sort.desc
        ? d3DescendingNull(
            getAttrib(data[a], sort.attrib),
            getAttrib(data[b], sort.attrib)
          )
        : d3AscendingNull(
            getAttrib(data[a], sort.attrib),
            getAttrib(data[b], sort.attrib)
          );
    });
    assignIndexes(_dataIs[levelToUpdate], levelToUpdate);

    let after = performance.now();
    if (DEBUG)
      console.log(
        "Sorting level " + levelToUpdate + " " + (after - before) + "ms"
      );
  }

  function onSortLevel(event, d) {
    if (DEBUG) console.log("click " + d);
    if (event && event.defaultPrevented) {
      if (DEBUG) console.log("clicked, defaultPrevented");
      return; // dragged
    }

    dSortBy[d.level] = {
      attrib: d.attrib,
      desc:
        dSortBy[d.level] !== undefined && dSortBy[d.level].attrib === d.attrib
          ? !dSortBy[d.level].desc
          : false,
    };

    deleteObsoleteFiltersFromLevel(d.level + 1);

    updateSorting(d.level);
    removeBrushOnLevel(d.level);

    nv.updateData(dataIs, colScales, {
      levelsToUpdate: [d.level],
    });

    updateCallback(nv.getVisible());
  }

  function getAttrib(item, attrib) {
    if (typeof attrib === "function") {
      try {
        return attrib(item);
      } catch (e) {
        // console.log("navio error getting attrib with item ", item, " attrib ", attrib, "error", e);
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

  function drawItem(item, level) {
    let attrib, i, y;

    context.save();
    for (i = 0; i < attribsOrdered.length; i++) {
      attrib = attribsOrdered[i];
      const val = getAttrib(item, attrib);
      const attribName = getAttribName(attrib);

      y = Math.round(yScales[level](item[id]) + yScales[level].bandwidth() / 2);
      // y = yScales[level](item[id]) + yScales[level].bandwidth()/2;

      context.beginPath();
      context.moveTo(Math.round(x(attribName, level)), y);
      context.lineTo(Math.round(x(attribName, level) + xScale.bandwidth()), y);
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
        let yLine = Math.round(yScales[level](item[id]));
        // y = yScales[level](item[id])+yScales[level].bandwidth()/2;
        context.beginPath();
        context.moveTo(x(attribName, level), yLine);
        context.lineTo(x(attribName, level) + xScale.bandwidth(), yLine);
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
    context.rect(
      levelScale(i),
      yScales[i].range()[0] - 1,
      xScale.range()[1] + 1,
      yScales[i].range()[1] + 2 - yScales[i].range()[0]
    );
    context.strokeStyle = "black";
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }

  function removeBrushOnLevel(lev) {
    if (lev < 0) return;
    d3.select("#level" + lev)
      .selectAll(".brush")
      .call(dBrushes[lev].move, null);
  }

  function removeAllBrushesBut(but) {
    for (let lev = 0; lev < dataIs.length; lev += 1) {
      if (lev === but) continue;
      removeBrushOnLevel(lev);
    }
  }

  // Assigns the indexes on the new level data
  function assignIndexes(dataIsToUpdate, level) {
    if (DEBUG) console.log("Assiging indexes ", level);
    for (let j = 0; j < dataIsToUpdate.length; j++) {
      data[dataIsToUpdate[j]].__i[level] = j;
    }
  }

  // Some actions will make obsolete certain filters, such as a resort on a previous level
  // with range filters
  function deleteObsoleteFiltersFromLevel(level) {
    for (let l = level; l < filtersByLevel.length; l++) {
      filtersByLevel[l] = filtersByLevel[l].filter(
        (f) => f.type === "value" || f.type === "negativeValue"
      );
    }
  }

  // Applies the filters for the selected level, using the passed data if any
  function applyFilters(level, _dataIs) {
    let before, after;

    _dataIs = _dataIs !== undefined ? _dataIs : dataIs;

    if (DEBUG)
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
        (f) => f.type !== "negativeValue" || f.type !== "negativeRange"
      );

    let filteredData = _dataIs[level].filter((d) => {
      // OR of positives, AND of negatives
      return (data[d].selected =
        posFilters.reduce((p, f) => p || f.filter(data[d]), false) &&
        negFilters.reduce((p, f) => p && f.filter(data[d]), true));
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
    if (DEBUG) console.log("Applying filters " + (after - before) + "ms");

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

  function applyFiltersAndUpdate(fromLevel) {
    if (DEBUG) console.log("applyFiltersAndUpdate ", fromLevel);

    const lastLevel = getLastLevelFromFilters();

    // Start from the previous data
    let newData = dataIs;

    for (let level = fromLevel; level <= lastLevel; level++) {
      // We don't have filters for this level, delete subsequent levels
      if (
        !filtersByLevel.hasOwnProperty(level) ||
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
        if (DEBUG) console.log("Empty filteredData!");
        //   return;
      }
      // newData = dataIs.slice(0,level+1);

      if (nv.nestedFilters) {
        // newData.push(filteredData);
        newData[level + 1] = filteredData;
      }

      // Update sortings of the next level
      updateSorting(level + 1);
      if (DEBUG)
        console.log(
          `ApplyFiltersAndUpdate level ${level} filtered = ${filteredData.length} `
        );
    }

    // Update all the levels
    nv.updateData(newData, colScales, {
      shouldDrawBrushes: true,
      levelsToUpdate: d3.range(fromLevel, newData.length), // Range is not inclusive so is not length-1
    });

    if (DEBUG)
      console.log("All filters applied calling updateCallback", dataIs);
    updateCallback(nv.getVisible());
  }

  function updateBrushes(d, level) {
    dBrushes[level] = d3
      .brushY()
      .extent([
        [x(xScale.domain()[0], level), yScales[level].range()[0]],
        [
          x(xScale.domain()[xScale.domain().length - 1], level) +
            xScale.bandwidth() * 1.1,
          yScales[level].range()[1],
        ],
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

    _brush
      .enter()
      .merge(_brush)
      .append("g")
      .call(dBrushes[level]) // brush event must be before click (?) https://observablehq.com/@d3/click-vs-drag?collection=@d3/d3-drag
      .on("mousemove", onMouseOver)
      .on("click", onSelectByValue)
      .on("mouseout", onMouseOut)
      .attr("class", "brush")      
      .selectAll("rect")
      .attr(
        "width",
        x(xScale.domain()[xScale.domain().length - 1], level) +
          xScale.bandwidth() * 1.1
      );

    _brush.exit().remove();

    function brushed(event) {
      if (!event.selection) {
        if (DEBUG)
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

      showTooptip(xOnWidget, yOnWidget, clientX, clientY, level);
    }

    function onSelectByRange(event) {
      if (!event.sourceEvent) return; // Only transition after input.
      if (!event.selection) {
        if (DEBUG)
          console.log(
            "Empty selection level",
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

      showLoading(this);
      removeAllBrushesBut(level);

      let before = performance.now();
      let brushed = event.selection;

      let // first = dData.get(invertOrdinalScale(yScales[level], brushed[0] -yScales[level].bandwidth())),
        first = dData.get(invertOrdinalScale(yScales[level], brushed[0])),
        // last = dData.get(invertOrdinalScale(yScales[level], brushed[1] -yScales[level].bandwidth()))
        last = dData.get(invertOrdinalScale(yScales[level], brushed[1]));

      let newFilter;
      if (event.sourceEvent.altKey) {
        newFilter = new FilterByRangeNegative({
          first,
          last,
          level: level,
          itemAttr: dSortBy[level] ? dSortBy[level].attrib : "__seqId",
          getAttrib,
          getAttribName,
        });
      } else {
        newFilter = new FilterByRange({
          first,
          last,
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
      if (DEBUG)
        console.log(
          "selectByRange filtering " + (after - before) + "ms",
          first,
          last
        );

      hideLoading(this);
    } // onSelectByRange

    function onSelectByValue(event) {
      if (DEBUG)
        console.log("👉🏼 Select by value click", event, d3.pointer(event));
      if (event.defaultPrevented) {
        if (DEBUG)
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
      if (DEBUG) console.log("onSelectByValueFromCoords", clientX, clientY);

      removeAllBrushesBut(-1); // Remove all brushes

      const before = performance.now();
      const itemId = invertOrdinalScale(yScales[level], clientY);
      const after = performance.now();
      if (DEBUG) console.log("invertOrdinalScale " + (after - before) + "ms");

      let itemAttr = invertOrdinalScale(xScale, clientX - levelScale(level));
      if (itemAttr === undefined) {
        console.log(
          `navio.selectByValue: error, couldn't find attr in coords ${
            (clientX, clientY)
          }`
        );
        return;
      }
      itemAttr = dAttribs.get(itemAttr);

      const sel = dData.get(itemId);
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
        if (!filtersByLevel.hasOwnProperty(level)) {
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

      if (DEBUG)
        console.log(
          "Selected " + nv.getVisible().length + " calling updateCallback"
        );
    }
  } // updateBrushes

  function showTooptip(xOnWidget, yOnWidget, clientX, clientY, level) {
    let itemId;
    try {
      itemId = invertOrdinalScale(yScales[level], yOnWidget);
    } catch (e) {
      return;
    }

    let itemAttr = invertOrdinalScale(xScale, xOnWidget - levelScale(level));
    const d = dData.get(itemId);

    itemAttr = dAttribs.get(itemAttr);

    if (!d || d === undefined) {
      console.log("Couldn't find datum for tooltip y", yOnWidget, d);
      return;
    }

    tooltipCoords.x = xOnWidget;
    tooltipCoords.y = yOnWidget;

    tooltipElement.select(".tool_id").text(itemId);
    tooltipElement.select(".tool_value_name").text(getAttribName(itemAttr));
    tooltipElement.select(".tool_value_val").text(getAttrib(d, itemAttr));

    tooltipElement.style("display", "initial");

    tooltip.scheduleUpdate();

    // if ( DEBUG ) console.log("Mouse over", d);
  }

  function onMouseOver(event, overData) {
    const xOnWidget = d3.pointer(event)[0],
      yOnWidget = d3.pointer(event)[1],
      clientX = event.clientX,
      clientY = event.clientY;

    // if (event.altKey) {
    //   d3.selectAll(".overlay").style("cursor", "zoom-out");
    //   console.log("Alt!");
    // } else {
    //   d3.selectAll(".overlay").style("cursor", `url(${cursorData}) 8 8, crosshair`);
    // }
    // // console.log("key");

    if (!overData.data || overData.data.length === 0) {
      if (DEBUG) console.log("onMouseOver no data", overData);
      return;
    }

    // if (DEBUG) console.log("onMouseOver", xOnWidget, yOnWidget, clientY, event.pageY, event.offsetY, event);
    showTooptip(xOnWidget, yOnWidget, clientX, clientY, overData.level);
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

  function drawCounts(levelOverlay, levelOverlayEnter) {
    levelOverlayEnter
      .append("text")
      .merge(levelOverlay.select("text.numNodesLabel"))
      .attr("class", "numNodesLabel")
      .style("font-family", "sans-serif")
      .style("pointer-events", "none")
      .attr("y", function (_, i) {
        return yScales[i].range()[1] + 15;
      })
      .attr("x", function (_, i) {
        return levelScale(i);
      })
      .text(function (d) {
        return nv.fmtCounts(d.length);
      });
  }

  function drawFilterExplanations(levelOverlay, levelOverlayEnter) {
    const lastAttrib = xScale.domain()[xScale.domain().length - 1],
      rightBorder = (level) => x(lastAttrib, level) + xScale.bandwidth() + 2;

    const filterExpEnter = levelOverlayEnter
      .append("g")
      .attr("class", "filterExplanation");

    filterExpEnter
      .merge(levelOverlay.select(".filterExplanation"))
      .attr(
        "transform",
        (_, i) =>
          `translate(${rightBorder(i)}, ${
            yScales[i].range()[1] + nv.filterFontSize * 1.2
          })`
      );

    filterExpEnter
      .append("rect")
      .merge(levelOverlay.select("rect.bgExplanation"))
      .attr("class", "bgExplanation")
      .style("fill", "white")
      .attr("x", 0)
      .attr("y", nv.filterFontSize * 0.3)
      .attr("width", levelScale.bandwidth())
      .attr("height", (_, i) =>
        filtersByLevel[i]
          ? filtersByLevel[i].length * nv.filterFontSize * 1.3
          : 0
      );

    const filterExpTexts = filterExpEnter
      .append("text")
      .merge(levelOverlay.select(".filterExplanation > text"))
      // .attr("x", function (_, i) {return  levelScale(i); })
      // .attr("y", function (_, i) {return yScales[i].range()[1] + 25; })
      .style("font-size", nv.filterFontSize + "pt")
      .selectAll("tspan")
      .data((_, i) =>
        filtersByLevel[i]
          ? filtersByLevel[i].map((f) => {
              f.level = i;
              return f;
            })
          : []
      );

    filterExpTexts
      .enter()
      .append("tspan")
      .merge(filterExpTexts)
      .attr("dy", nv.filterFontSize * 1.2 + 7)
      .attr("x", 0)
      .style("cursor", "not-allowed")
      .text((f) => "Ⓧ " + f.toStr())
      .on("click pointerup", (event, f, i) => {
        if (DEBUG) console.log("Click remove filter", i, f);
        filtersByLevel[f.level].splice(i, 1);

        applyFiltersAndUpdate(f.level);
      });

    filterExpTexts.exit().remove();
  }

  function drawFilterExplanationsHTML(levelOverlay, levelOverlayEnter) {
    const lastAttrib = xScale.domain()[xScale.domain().length - 1],
      rightBorder = (level) => x(lastAttrib, level) + xScale.bandwidth() + 2;

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
      .style("min-width", "200px")
      .style(
        "transform",
        (_, i) =>
          `translate(${rightBorder(i)}px, ${
            yScales[i].range()[1] + nv.filterFontSize * 1.2
          }px)`
      );

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

    filterExpTexts
      .enter()
      .append("div")
      .merge(filterExpTexts)
      // .attr("dy", nv.filterFontSize * 1.2 + 7)
      // .attr("x", 0)
      .style("cursor", "not-allowed")
      .text((f) => "Ⓧ " + f.toStr())
      .on("click pointerup", (event, f, i) => {
        if (DEBUG) console.log("Click remove filter", i, f);
        filtersByLevel[f.level].splice(i, 1);

        applyFiltersAndUpdate(f.level);
      });

    filterExpTexts.exit().remove();
    filterExps.exit().remove();
  }

  function drawAttribHeaders(attribOverlay, attribOverlayEnter) {
    if (nv.showAttribTitles) {
      attribOverlayEnter
        .append("text")
        .merge(attribOverlay.select("text"))
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
        .attr("x", xScale.bandwidth() / 2)
        .attr("y", 0)
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
        .call(
          d3
            .drag()
            .container(attribOverlayEnter.merge(attribOverlay).node())
            .on("start", attribDragstarted)
            .on("drag", attribDragged)
            .on("end", attribDragended)
        )
        .on("click", deferEvent(onSortLevel))
        // .on("click", onSortLevel)
        .on("mousemove", function () {
          let sel = d3.select(this);
          sel =
            sel.transition !== undefined ? sel.transition().duration(150) : sel;
          sel.style("font-size", nv.attribFontSizeSelected + "px");
        })
        .on("mouseout", function () {
          let sel = d3.select(this);
          sel =
            sel.transition !== undefined ? sel.transition().duration(150) : sel;
          sel.style(
            "font-size",
            Math.min(nv.attribFontSize, nv.attribWidth) + "px"
          );
        })
        .attr("transform", `rotate(${nv.attribRotation})`);
    } // if (nv.showAttribTitles) {
  }

  function drawAttributesHolders(levelOverlay, levelOverlayEnter) {
    let attribs = attribsOrdered;

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

    attribOverlayEnter
      .merge(attribOverlay)
      .attr(
        "transform",
        (d) =>
          `translate(${x(d.name, d.level)}, ${yScales[d.level].range()[0]})`
      );

    attribOverlayEnter
      .append("rect")
      .merge(attribOverlay.select("rect"))

      .attr("fill", "none")
      // .style("opacity", "0.1")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", function () {
        return xScale.bandwidth() * 1.1;
      })
      .attr("height", function (d) {
        return yScales[d.level].range()[1] - yScales[d.level].range()[0];
      });

    drawAttribHeaders(attribOverlay, attribOverlayEnter);

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
    // drawFilterExplanations(levelOverlay, levelOverlayEnter);
    drawFilterExplanationsHTML(levelOverlay, levelOverlayEnter);

    levelOverlay.exit().remove();
  } // drawBrushes

  function attribDragstarted(event, d) {
    if (DEBUG) console.log("attrib drag start", d);
    if (!event.sourceEvent.shiftKey) return;

    d3.select(this.parentNode).attr("transform", function (d) {
      return (
        "translate(" +
        (event.x + nv.attribFontSize / 2) +
        "," +
        yScales[d.level].range()[0] +
        ")"
      );
    });
  }

  function attribDragged(event) {
    if (!event.sourceEvent.shiftKey) return;

    d3.select(this.parentNode).attr("transform", function (d) {
      return (
        "translate(" +
        (event.x + nv.attribFontSize / 2) +
        "," +
        yScales[d.level].range()[0] +
        ")"
      );
    });
  }

  function attribDragended(event, d) {
    if (DEBUG) console.log("attrib drag end", d);
    if (!event.sourceEvent.shiftKey) return;

    let attrDraggedInto = invertOrdinalScale(
      xScale,
      event.x + nv.attribFontSize / 2 - levelScale(d.level)
    );
    attrDraggedInto = dAttribs.get(attrDraggedInto);

    let pos;
    d3.select(this.parentNode).attr("transform", function (d) {
      return (
        "translate(" +
        x(d.name, d.level) +
        "," +
        yScales[d.level].range()[0] +
        ")"
      );
    });

    if (attrDraggedInto !== d.attrib) {
      pos = attribsOrdered.indexOf(attrDraggedInto);
      moveAttrToPos(d.attrib, pos);
      nv.updateData(dataIs);
    }
  }

  function drawCloseButton() {
    let maxLevel = dataIs.length - 1;
    svg
      .select("#closeButton")
      .style("display", dataIs.length === 1 ? "none" : "block")
      .attr(
        "transform",
        "translate(" +
          (levelScale(maxLevel) +
            levelScale.bandwidth() -
            nv.levelsSeparation +
            15) +
          "," +
          yScales[maxLevel].range()[0] +
          ")"
      );
  }

  // Links between nodes
  function drawLink(link) {
    let lastAttrib = xScale.domain()[xScale.domain().length - 1],
      rightBorder = x(lastAttrib, dataIs.length - 1) + xScale.bandwidth() + 2,
      ys =
        yScales[dataIs.length - 1](link.source[id]) +
        yScales[dataIs.length - 1].bandwidth() / 2,
      yt =
        yScales[dataIs.length - 1](link.target[id]) +
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
    if (DEBUG)
      console.log("Draw links ", links[links.length - 1].length, links);
    context.save();
    context.beginPath();
    context.strokeStyle = nv.linkColor;
    context.globalAlpha = Math.min(
      1,
      Math.max(0.1, 1000 / links[links.length - 1].length)
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
      let iOnPrev = dData.get(data[item][id]).__i[level - 1];
      let iRep = Math.floor(
        iOnPrev - (iOnPrev % dataIs[level - 1].itemsPerpixel)
      );
      // if (DEBUG) console.log("i rep = "+ iRep);
      // if (DEBUG) console.log(data[level-1][iRep]);
      // if (DEBUG) console.log(yScales[level-1](data[level-1][iRep][id]));
      let locPrevLevel = {
        x: levelScale(level - 1) + xScale.range()[1],
        y: yScales[level - 1](data[dataIs[level - 1][iRep]][id]),
      };
      let locLevel = {
        x: levelScale(level),
        y: yScales[level](data[item][id]),
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
      drawLine(points, 1, nv.levelConnectionsColor);
      drawLine(points, 1, nv.levelConnectionsColor, true);
    }
  }

  function computeRepresentatives(levelToUpdate) {
    if (DEBUG) console.log("Compute representatives levels", levelToUpdate);
    let representatives = [];
    if (dataIs[levelToUpdate].length > height) {
      const itemsPerpixel = Math.max(
        Math.floor(dataIs[levelToUpdate].length / (height * 2)),
        1
      );
      if (DEBUG) console.log("itemsPerpixel", itemsPerpixel);
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

  function updateColorDomains() {
    if (DEBUG) console.log("Update color scale domains");
    // colScales = new Map();
    for (let attrib of attribsOrdered) {
      if (attrib === "selected") continue;

      let scale = colScales.get(attrib);
      if (scale.__type === "seq" || scale.__type === "date") {
        scale.domain(
          d3.extent(
            dataIs[0].map(function (i) {
              return getAttrib(data[i], attrib);
            })
          )
        ); //TODO: make it compute it based on the local range
      } else if (scale.__type === "div") {
        const [min, max] = d3.extent(
          dataIs[0].map(function (i) {
            return getAttrib(data[i], attrib);
          })
        );
        const absMax = Math.max(-min, max); // Assumes diverging point on 0
        scale.domain([-absMax, absMax]);
      } else if (scale.__type === "text" || scale.__type === "ordered") {
        scale.domain(dataIs[0].map((i) => getAttrib(data[i], attrib)));
      }

      colScales.set(getAttribName(attrib), scale);
    }
  }

  function updateScales(opts) {
    let { levelsToUpdate, shouldUpdateColorDomains } = opts || {};
    if (DEBUG) console.log("Update scales");

    const before = performance.now();

    const lastLevel = dataIs.length - 1;
    levelsToUpdate =
      levelsToUpdate !== undefined ? levelsToUpdate : [lastLevel];
    shouldUpdateColorDomains =
      shouldUpdateColorDomains !== undefined ? shouldUpdateColorDomains : false;

    // Delete unvecessary scales
    if (DEBUG) console.log("Delete unvecessary scales");
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
          return data[rep][id];
        })
      );
    }

    xScale
      .domain(attribsOrdered.map((d) => getAttribName(d)))
      .range([0, nv.attribWidth * Array.from(dAttribs.keys()).length])
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

    // Update color scales domains
    if (shouldUpdateColorDomains) {
      updateColorDomains();
    }

    const after = performance.now();
    if (DEBUG) console.log("Updating Scales " + (after - before) + "ms");
  }

  // Deletes the last level by default, or all the subsequent levels of _level on _dataIs
  function deleteSubsequentLevels(_level, _dataIs, opts) {
    if (dataIs.length <= 1) return;

    let { shouldUpdate } = opts || {};

    let level = _level !== undefined ? _level : dataIs.length - 1;
    _dataIs = _dataIs !== undefined ? _dataIs : dataIs;
    shouldUpdate = shouldUpdate !== undefined ? shouldUpdate : true;

    if (!_dataIs.hasOwnProperty(level)) {
      if (DEBUG)
        console.log("Asked to delete a level that doens't exist ", level);
      return _dataIs;
    }

    showLoading(this);
    if (DEBUG) console.log("Delete one level", level);
    if (level > 0) {
      removeBrushOnLevel(level - 1);

      for (let d of _dataIs[level - 1]) {
        data[d].selected = true;
      }

      if (
        filtersByLevel.hasOwnProperty(level - 1) &&
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
      updateCallback(nv.getVisible());
    }

    hideLoading(this);
    return _dataIs;
  }

  function moveAttrToPos(attr, pos) {
    let i = attribsOrdered.indexOf(attr);
    if (i === -1) {
      console.log("moveAttrToPos attr not found", attr);
      return;
    }
    if (pos > attribsOrdered.length || pos < 0) {
      console.log(
        "moveAttrToPos pos out of bounds",
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

  function recomputeVisibleLinks() {
    if (links.length > 0) {
      visibleLinks = links.filter(function (d) {
        return d.source.selected && d.target.selected;
      });
    }
  }

  function updateLevel(levelData, i) {
    drawLevelBorder(i);
    for (let rep of levelData.representatives) {
      drawItem(data[rep], i);
    }

    drawLevelConnections(i);
  }

  function updateWidthAndHeight() {
    const ctxWidth = levelScale.range()[1] + nv.margin + nv.x0;
    DEBUG && console.log("updateWidthAndHeight: ", ctxWidth, height);
    const scale = window.devicePixelRatio || 1;
    d3.select(canvas)
      .attr("width", ctxWidth * scale)
      .attr("height", height * scale)
      .style("width", ctxWidth)
      .style("height", height + "px");
    canvas.style.width = ctxWidth + "px";
    canvas.style.height = height + "px";

    context.scale(scale, scale);

    svg.attr("width", ctxWidth).attr("height", height);
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
      const d = data[i];
      d.__seqId = i; //create a default id with the sequential number
      dData.set(d[id], d);
      d.__i = [];
      d.__i[0] = i;
    }

    filtersByLevel = [];
    filtersByLevel[0] = []; // Initialice filters as empty for lev 0
    // nv.updateData(mData, mColScales, mSortByAttr);

    let after = performance.now();
    if (DEBUG) console.log("Init data " + (after - before) + "ms");
  };

  nv.updateData = function (mDataIs, mColScales, opts) {
    const {
      levelsToUpdate,
      shouldUpdateColorDomains,
      shouldDrawBrushes,
      recomputeBrushes,
    } = opts || {};

    if (DEBUG) console.log("updateData");
    let before = performance.now();

    if (typeof mDataIs !== typeof []) {
      console.log("navio updateData didn't receive an array");
      return;
    }

    colScales = mColScales !== undefined ? mColScales : colScales;
    dataIs = mDataIs;

    // Delete filters on unused levels
    filtersByLevel.splice(mDataIs.length);
    // Initialize new filter level
    filtersByLevel[mDataIs.length] = [];

    recomputeVisibleLinks();

    // Delete unnecesary brushes
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
    if (DEBUG) console.log("Updating data " + (after - before) + "ms");
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
    //       if (DEBUG) console.log("Asked to update a level that doesn't exist, ignoring. Level=" , levelToUp, " levs to update" levelsToUpdate);
    //     }

    //   });
    // }

    if (shouldDrawBrushes) {
      drawBrushes(recomputeBrushes);
      drawCloseButton();
    }

    let after = performance.now();
    if (DEBUG) console.log("Redrawing " + (after - before) + "ms");
    return nv;
  };

  nv.addAttrib = function (attr, scale) {
    if (scale === undefined) {
      scale = d3.scaleOrdinal(d3.schemeCategory10);
    }
    if (dAttribs.has(getAttribName(attr))) {
      console.log(`navio.addAttrib attribute ${attr} already added`);
      return;
    }
    attribsOrdered.push(attr);
    dAttribs.set(getAttribName(attr), attr);
    colScales.set(attr, scale);
    return nv;
  };

  nv.addSequentialAttrib = function (attr, _scale) {
    const domain =
      data !== undefined && data.length > 0
        ? d3.extent(data, function (d) {
            return getAttrib(d, attr);
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
    for (let attr of attribs) {
      if (attr === "__seqId" || attr === "__i" || attr === "selected") continue;

      const attrName = typeof attr === "function" ? attr.name : attr;
      const firstNotNull = findNotNull(data, attr);

      if (
        firstNotNull === null ||
        firstNotNull === undefined ||
        typeof firstNotNull === typeof ""
      ) {
        const numDistictValues = new Set(
          data
            .slice(0, nv.howManyItemsShouldSearchForNotNull)
            .map((d) => getAttrib(d, attr))
        ).size;

        // How many different elements are there
        if (numDistictValues < nv.maxNumDistictForCategorical) {
          console.log(
            `Navio: Adding attr ${attrName} as categorical with ${numDistictValues} categories`
          );
          nv.addCategoricalAttrib(attr);
        } else if (numDistictValues < nv.maxNumDistictForOrdered) {
          nv.addOrderedAttrib(attr);
          console.log(
            `Navio: Attr ${attrName} has more than ${nv.maxNumDistictForCategorical} distinct values (${numDistictValues}) using orderedAttrib`
          );
        } else {
          console.log(
            `Navio: Attr ${attrName} has more than ${nv.maxNumDistictForOrdered} distinct values (${numDistictValues}) using textAttrib`
          );
          nv.addTextAttrib(attr);
        }
      } else if (typeof firstNotNull === typeof 0) {
        // Numbers
        if (d3.min(data, (d) => getAttrib(d, attr)) < 0) {
          console.log(`Navio: Adding attr ${attrName} as diverging`);
          nv.addDivergingAttrib(attr);
        } else {
          console.log(`Navio: Adding attr ${attrName} as sequential`);
          nv.addSequentialAttrib(attr);
        }
      } else if (firstNotNull instanceof Date) {
        console.log(`Navio: Adding attr ${attrName} as date`);
        nv.addDateAttrib(attr);
      } else if (typeof firstNotNull === typeof true) {
        console.log(`Navio: Adding attr ${attrName} as boolean`);
        nv.addBooleanAttrib(attr);
      } else {
        // Default categories

        if (Array.isArray(firstNotNull)) {
          if (nv.addAllAttribsIncludeArrays) {
            console.log(
              `Navio: Adding ${attrName} adding as categorical (type=array)`
            );
            nv.addCategoricalAttrib(attr);
          } else {
            console.log(
              `Navio: AddAllAttribs detected array ${attrName}, but ignoring it. To include it set nv.addAllAttribsIncludeArrays=true`
            );
          }
        } else {
          if (nv.addAllAttribsIncludeObjects) {
            console.log(
              `Navio: Adding object ${attrName} adding as categorical (type=object)`
            );
            nv.addCategoricalAttrib(attr);
          } else {
            console.log(
              `Navio: AddAllAttribs detected object ${attrName}, but ignoring it. To include it set nv.addAllAttribsIncludeObjects=true`
            );
          }
        }
      }
    }

    nv.data(data);
    // drawBrushes(true); // updates brushes width
    return nv;
  };

  nv.data = function (_) {
    initTooltipPopper();

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
      for (let d of data) {
        d.selected = true;
      }
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

  nv.getSelected = function () {
    return dataIs[dataIs.length - 1]
      .filter(function (d) {
        return data[d].selected;
      })
      .map(function (d) {
        return data[d];
      });
  };
  // Legacy support
  nv.getVisible = nv.getSelected;

  nv.sortBy = function (_attrib, _desc = false, _level = undefined) {
    // The default level is the last one
    let level = Math.max(
      0,
      _level !== undefined && _level < dataIs.length
        ? _level
        : dataIs.length - 1
    );

    if (_attrib !== undefined) {
      // if (attribsOrdered.indexOf(_attrib)===-1) {
      //   throw `sortBy: ${_attrib} is not in the list of attributes`
      // }
      dSortBy[level] = {
        attrib: _attrib,
        desc: _desc,
      };
      return nv.update();
    } else {
      return dSortBy[level];
    }
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
  };

  init();
  return nv;
}

// Returns a flat array with all the attributes in an object up to recursionLevel
navio.getAttribsFromObjectRecursive = getAttribsFromObjectRecursive;
// Returns a flat array with all the attributes in an object up to recursionLevel, for nested attributes returns a function
navio.getAttribsFromObjectAsFn = getAttribsFromObjectAsFn;

export default navio;

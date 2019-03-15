// import * as d3 from "../node_modules/d3/build/d3.js"; // Force react to use the es6 module
import * as d3 from "d3";
import {interpolateBlues, interpolatePurples, interpolateBrBG} from "d3-scale-chromatic";
import {FilterByRange, FilterByValue} from "./filters.js";
import {scaleText} from "./scales.js";

let DEBUG = false;

//eleId must be the ID of a context element where everything is going to be drawn
function navio(selection, _h) {
  "use strict";
  var nv = this || {},
    data = [], //Contains the original data attributes
    dataIs = [], //Contains only the indices to the data, is an array of arrays, one for each level
    links = [],
    visibleLinks = [],
    dData = d3.map(), // A hash for the data
    dDimensions = d3.map(),
    dimensionsOrder = [],
    dSortBy = [], //contains which attribute to sort by on each column
    dBrushes = [],
    filtersByLevel = [], // The filters applied to each level
    yScales =[],
    xScale,
    x,
    height = _h!==undefined ? _h : 600,
    colScales = d3.map(),
    levelScale,
    canvas,
    context,
    defaultColorInterpolator =  "interpolateBlues" in d3 ? d3.interpolateBlues : interpolateBlues, // necessary for supporting d3v4 and d3v5
    defaultColorInterpolatorDate =  "interpolatePurples" in d3 ? d3.interpolatePurples : interpolatePurples,
    defaultColorInterpolatorDiverging =  "interpolateBrBG" in d3 ? d3.interpolateBrBG : interpolateBrBG,
    visibleColorRange = ["white", "#b5cf6b"],
    fmt = d3.format(",.0d"),
    x0=0,
    y0=100,
    id = "__seqId",
    updateCallback = function () {};

  nv.maxNumDistictForCategorical = 10;
  nv.howManyItemsShouldSearchForNotNull = 100;
  nv.margin = 10;
  nv.attribWidth = 15;
  nv.levelsSeparation = 40;
  nv.divisionsColor = "white";
  nv.levelConvectionsColor = "rgba(205, 220, 163, 0.5)";
  nv.divisionsThreshold = 4; // What's the minimum row width needed to draw divisions
  nv.attribFontSize = 13;
  nv.attribFontSizeSelected = 32;

  nv.startColor = "white";
  nv.endColor = "red";
  nv.legendFont = "14px Arial";
  nv.linkColor = "#2171b5";
  // nv.linkColor = "rgba(0,0,70,0.9)";


  function nozoom() {
    if (DEBUG) console.log("nozoom");
    d3.event.preventDefault();
  }

  // Try to support strings and elements
  selection = typeof(selection) === typeof("") ? d3.select(selection) : selection;
  selection = selection.selectAll === undefined ? d3.select(selection) : selection;

  selection.selectAll("*").remove();

  selection
    .on("touchstart", nozoom)
    .on("touchmove", nozoom)
    // .attr("width", 150)
    .style("height", height + "px")
    .attr("class", "navio")
    .append("div")
    // .style("float", "left")
    .attr("id", "navio")
    .style("position", "relative");
  selection
    .select("#navio")
    .append("canvas");
  var svg = selection
    .select("#navio")
    .append("svg")
    .style("overflow", "visible")
    .style("position", "absolute")
    .style("z-index", 99)
    .style("top", 0)
    .style("left", 0);


  svg.append("g")
    .attr("class", "attribs");

  svg.append("g")
    .attr("class", "nvTooltip")
    .style("text-shadow", "0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff")
    .attr("transform", "translate(-100,-10)")
    .append("text")
    .attr("x", 0)
    .attr("y", 0)
    .style("pointer-events", "none")
    .style("font-family", "sans-serif")
    .style("font-size", "16pt")
    .style("text-anchor", "middle");

  svg.select(".nvTooltip > text")
    .append("tspan")
    .attr("class", "tool_id")
    .attr("x", 0)
    .attr("dy", "1.2em");

  svg.select(".nvTooltip > text")
    .append("tspan")
    .attr("class", "tool_value_name")
    .style("font-weight", "bold")
    .attr("x", 0)
    .attr("dy", "1.2em");

  svg.select(".nvTooltip > text")
    .append("tspan")
    .attr("class", "tool_value_val")
    .style("font-weight", "bold")
    .attr("x", 0)
    .attr("dy", "1.2em");

  svg.append("g")
    .attr("id", "closeButton")
    .style("fill", "white")
    .style("stroke", "black")
    .style("display", "none")
    .append("path")
    .call(function (sel) {
      var crossSize = 7,
        path = d3.path(); // Draw a cross and a circle
      path.moveTo(0, 0);
      path.lineTo(crossSize, crossSize);
      path.moveTo(crossSize, 0);
      path.lineTo(0, crossSize);
      path.moveTo(crossSize*1.2 + crossSize/2, crossSize/2);
      path.arc(crossSize/2, crossSize/2, crossSize*1.2, 0, Math.PI*2);
      sel.attr("d", path.toString());
    })
    .on("click", deleteOneLevel);

  xScale = d3.scaleBand()
    // .rangeBands([0, nv.attribWidth], 0.1, 0);
    .range([0, nv.attribWidth])
    .round(true)
    .paddingInner(0.1)
    .paddingOuter(0);
  levelScale = d3.scaleBand()
    .round(true);
  colScales = d3.map();

  x = function (val, level) {
    return levelScale(level) + xScale(val);
  };

  canvas = selection.select("canvas").node();
  // canvas.style.position = "absolute";
  canvas.style.top = canvas.offsetTop + "px";
  canvas.style.left = canvas.offsetLeft + "px";
  // canvas.style.width =  "150px";
  canvas.style.height = height + "px";

  const scale = window.devicePixelRatio;
  // canvas.width = width * scale;
  canvas.height = height * scale;

  context = canvas.getContext("2d");

  context.scale(scale,scale);

  context.imageSmoothingEnabled = context.mozImageSmoothingEnabled = context.webkitImageSmoothingEnabled = false;

  context.globalCompositeOperation = "source-over";
  // context.strokeStyle = "rgba(0,100,160,1)";
  // context.strokeStyle = "rgba(0,0,0,0.02)";



  function showLoading(ele) {
    d3.select(ele).style("cursor", "progress");
    svg.style("cursor", "progress");
  }

  function hideLoading(ele) {
    d3.select(ele).style("cursor", null);
    svg.style("cursor", null);
  }

  function deferEvent(cbk) {
    return function(d, i, all) {
      showLoading(this);
      setTimeout(() => {
        cbk(d, i, all);
        hideLoading(this);
      },100);
    };
  }

  function invertOrdinalScale(scale, x) {
    // Taken from https://bl.ocks.org/shimizu/808e0f5cadb6a63f28bb00082dc8fe3f
    // custom invert function
    var domain = scale.domain();
    var range = scale.range();
    var qScale = d3.scaleQuantize().domain(range).range(domain);

    return qScale(x);
  }

  // Like d3.ascending but supporting null
  function d3AscendingNull(a, b) {
    if (b === null || b === undefined) {
      if (a === null || a === undefined) return 0; // a == b == null
      else return 1; // b==null a!=null
    } else { // b!=null
      if (a === null || a === undefined) return -1;
      else if (a < b) return -1;
      else if (a > b) return 1;
      else if (a >= b) return 0;
      else return NaN;
    }
  }

  function d3DescendingNull(a, b) {
    if (b === null || b === undefined) {
      if (a === null || a === undefined) return 0; // a == b == null
      else return -1; // b==null a!=null
    } else { // b!=null
      if (a === null || a === undefined) return 1;
      else if (a < b) return 1;
      else if (a > b) return -1;
      else if (a >= b) return 0;
      else return NaN;
    }
  }

  function updateSorting(levelToUpdate) {
    if (!dSortBy.hasOwnProperty(levelToUpdate)) {
      if (DEBUG) console.log("UpdateSorting called without attrib in dSortBy", levelToUpdate, dSortBy);
      return;
    }

    var before = performance.now();

    const sort = dSortBy[levelToUpdate];
    dataIs[levelToUpdate].sort(function (a, b) {
      return sort.reverse ?
        d3DescendingNull(data[a][sort.attrib], data[b][sort.attrib]) :
        d3AscendingNull(data[a][sort.attrib], data[b][sort.attrib]);
    });

    // dataIs[levelToUpdate].forEach(function (row,i) {
    //   data[row].__i[levelToUpdate] = i;
    // });
    assignIndexes(dataIs[levelToUpdate], levelToUpdate);

    var after = performance.now();
    if (DEBUG) console.log("Sorting level " + levelToUpdate + " " + (after-before) + "ms");

  }

  function onSortLevel(d) {
    if (d3.event && d3.event.defaultPrevented) return; // dragged
    if (DEBUG) console.log("click " + d);


    dSortBy[d.level] = {
      attrib:d.attrib,
      reverse:dSortBy[d.level]!==undefined && dSortBy[d.level].attrib === d.attrib ?
        !dSortBy[d.level].reverse :
        false
    };

    updateSorting(d.level);
    removeBrushOnLevel(d.level);

    nv.updateData(dataIs, colScales, {
      levelToUpdate: d.level
    });

    updateCallback(nv.getVisible());
  }

  function getAttribs(obj) {
    var attr, res = [];
    for (attr in obj) {
      if (obj.hasOwnProperty(attr)) {
        res.push(attr);
      }
    }
    return res;
  }

  function drawItem(item, level) {
    var attrib, i, y ;

    for (i = 0; i < dimensionsOrder.length; i++) {
      attrib = dimensionsOrder[i];
      y = Math.round(yScales[level](item[id]) + yScales[level].bandwidth()/2);
      // y = yScales[level](item[id]) + yScales[level].bandwidth()/2;

      context.beginPath();
      context.moveTo(Math.round(x(attrib, level)), y);
      context.lineTo(Math.round(x(attrib, level) + xScale.bandwidth()), y);
      context.lineWidth = Math.ceil(yScales[level].bandwidth())+1;
      // context.lineWidth = 1;
      context.strokeStyle = item[attrib] === undefined ||
                item[attrib] === null ||
                item[attrib] === "" ||
                item[attrib] === "none" ?
        "white" :
        colScales.get(attrib)(item[attrib]);

      context.stroke();


      //If the range bands are tick enough draw divisions
      if (yScales[level].bandwidth() > nv.divisionsThreshold*2) {
        var yLine = Math.round(yScales[level](item[id])) ;
        // y = yScales[level](item[id])+yScales[level].bandwidth()/2;
        context.beginPath();
        context.moveTo(x(attrib, level), yLine);
        context.lineTo(x(attrib, level) + xScale.bandwidth(), yLine);
        context.lineWidth = 1;
        // context.lineWidth = 1;
        context.strokeStyle = nv.divisionsColor;
        context.stroke();
      }

    }

  } // drawItem

  function drawLevelBorder(i) {
    context.beginPath();
    context.rect(levelScale(i),
      yScales[i].range()[0]-1,
      xScale.range()[1]+1,
      yScales[i].range()[1]+2-100);
    context.strokeStyle = "black";
    context.lineWidth = 1;
    context.stroke();
  }


  function removeBrushOnLevel(lev) {
    d3.select("#level"+lev)
      .selectAll(".brush")
      .call(dBrushes[lev].move, null);
  }

  function removeAllBrushesBut(but) {
    for (var lev=0; lev< dataIs.length ; lev+=1) {
      if (lev===but) continue;
      removeBrushOnLevel(lev);
    }
  }

  // Assigns the indexes on the new level data
  function assignIndexes(dataIsToUpdate, level) {
    if (DEBUG) console.log("Assiging indexes ", level);
    for (var j = 0; j < dataIsToUpdate.length; j++) {
      data[dataIsToUpdate[j]].__i[level] = j;
    }
  }



  function addBrush(d, level) {
    dBrushes[level] = d3
      .brushY()
      .extent([
        [x(xScale.domain()[0], level), yScales[level].range()[0]],
        [
          x(xScale.domain()[xScale.domain().length - 1], level) +
            xScale.bandwidth() * 1.1,
          yScales[level].range()[1]
        ]
      ])
      .on("brush", brushed)
      .on("end", onSelectByRange);
    var _brush = d3.select(this)
      .selectAll(".brush")
      .data([{
        data : data[d],
        level : level
      }]);

    _brush.enter()
      .merge(_brush)
      .append("g")
      .on("mousemove", onMouseOver)
      .on("click", onSelectByValue)
      .on("mouseout", onMouseOut)
      .attr("class", "brush")
      .call(dBrushes[level])
      .selectAll("rect")
      // .attr("x", -8)
      .attr("width", x(xScale.domain()[xScale.domain().length-1], level) + xScale.bandwidth()*1.1);

    _brush.exit().remove();


    // Applies the filters for the current level
    function applyFilters() {
      let before, after;

      if (DEBUG) console.log("applyFilters ", filtersByLevel);

      before = performance.now();
      // Check if each item fits on any filter
      var filteredData = dataIs[level].filter(d => {
        data[d].visible = false;
        for (let filter of filtersByLevel[level]) {
          if (filter.filter(data[d])) {
            data[d].visible = true;
            break;
          }
        }
        return data[d].visible;
      });


      // var filteredData = filtersByLevel[level].reduce(reduceFilters, dataIs[level]);
      after = performance.now();
      if (DEBUG) console.log("Applying filters " + (after-before) + "ms");


      return filteredData;

    }


    function brushed() {
      if (!d3.event.sourceEvent) return; // Only transition after input.
      if (!d3.event.selection){
        if (DEBUG) console.log("Empty selection", d3.event.selection,d3.event.type, d3.event.sourceEvent);
        // return;
        // d3.event.preventDefault();
        // onSelectByValueFromCoords(d3.event.sourceEvent.clientX, d3.event.sourceEvent.clientY);
        return; // Ignore empty selections.
      }

      const screenX = d3.event.sourceEvent.offsetX,
        screenY = d3.event.sourceEvent.offsetY;

      showTooptip(screenX, screenY, level);
    }


    function onSelectByRange() {
      showLoading(this);
      if (!d3.event.sourceEvent) return; // Only transition after input.
      if (!d3.event.selection){
        if (DEBUG) console.log("Empty selection", d3.event.selection,d3.event.type, d3.event.sourceEvent);
        // return;
        // d3.event.preventDefault();
        // onSelectByValueFromCoords(d3.event.sourceEvent.clientX, d3.event.sourceEvent.clientY);
        return; // Ignore empty selections.
      }

      removeAllBrushesBut(level);
      var before = performance.now();
      var brushed = d3.event.selection;

      var
        // first = dData.get(invertOrdinalScale(yScales[level], brushed[0] -yScales[level].bandwidth())),
        first = dData.get(invertOrdinalScale(yScales[level], brushed[0])),
        // last = dData.get(invertOrdinalScale(yScales[level], brushed[1] -yScales[level].bandwidth()))
        last = dData.get(invertOrdinalScale(yScales[level], brushed[1]));


      const newFilter = new FilterByRange({first, last, level:level});
      if (d3.event.sourceEvent.shiftKey) {
        // Append the filter
        filtersByLevel[level].push(newFilter);
      } else {
        // Remove previous filters
        filtersByLevel[level]= [ newFilter ];
      }


      var filteredData = applyFilters();

      //Assign the index
      assignIndexes(filteredData, level+1);

      var after = performance.now();
      if (DEBUG) console.log("selectByRange filtering " + (after-before) + "ms", first, last);


      if (DEBUG) console.log("Computing new data");
      var newData = dataIs;
      if (filteredData.length===0) {
        if (DEBUG) console.log("Empty selection!");
        return;
      } else {
        newData = dataIs.slice(0,level+1);
        newData.push(filteredData);
      }

      nv.updateData(
        newData,
        colScales
      );
      if (DEBUG) console.log("out of updateData");
      if (DEBUG) console.log("Selected " + filteredData.length + " calling updateCallback");
      updateCallback(nv.getVisible());


      hideLoading(this);
    }// onSelectByRange

    function onSelectByValue() {
      if (DEBUG) console.log("click");
      showLoading(this);
      var clientY = d3.mouse(d3.event.target)[1],
        clientX = d3.mouse(d3.event.target)[0];


      onSelectByValueFromCoords(clientX, clientY);

      hideLoading(this);
    }


    function onSelectByValueFromCoords(clientX, clientY) {
      if (DEBUG) console.log("onSelectByValueFromCoords", clientX, clientY);


      removeAllBrushesBut(-1); // Remove all brushes

      var before = performance.now();
      var itemId = invertOrdinalScale(yScales[level], clientY);
      var after = performance.now();
      if (DEBUG) console.log("invertOrdinalScale " + (after-before) + "ms");

      var itemAttr = invertOrdinalScale(xScale, clientX - levelScale(level));
      if (itemAttr === undefined) return;

      var sel = dData.get(itemId);
      const newFilter = new FilterByValue({sel, itemAttr});
      if (d3.event.shiftKey) {
        // Append the filter
        filtersByLevel[level].push(newFilter);
      } else {
        // Remove previous filters
        filtersByLevel[level]= [ newFilter ];
      }


      var filteredData = applyFilters();

      assignIndexes(filteredData, level+1);

      var newData = dataIs.slice(0,level+1);
      newData.push(filteredData);


      nv.updateData(
        newData,
        colScales
      );

      if (DEBUG) console.log("Selected " + nv.getVisible().length + " calling updateCallback");
      updateCallback(nv.getVisible());
    }
  } // addBrush

  function showTooptip(screenX, screenY, level) {
    var itemId = invertOrdinalScale(yScales[level], screenY);
    var itemAttr = invertOrdinalScale(xScale, screenX - levelScale(level));
    var d = dData.get(itemId);

    if (!d || d=== undefined) {
      console.log("Couldn't find datum for tooltip y", screenY, d);
      return;
    }

    svg.select(".nvTooltip")
      .attr("transform", "translate(" + (screenX) + "," + (screenY+20) + ")")
      .call(function (tool) {
        tool.select(".tool_id")
          .text(itemId);
        tool.select(".tool_value_name")
          .text(itemAttr + " : " );
        tool.select(".tool_value_val")
          .text(d[itemAttr]);

      });

    if ( DEBUG ) console.log("Mouse over", d);
  }

  function onMouseOver(overData) {
    var screenY = d3.mouse(d3.event.target)[1],
      screenX = d3.mouse(d3.event.target)[0];

    showTooptip(screenX, screenY, overData.level);
  }

  function onMouseOut() {
    svg.select(".nvTooltip")
      .attr("transform", "translate(" + (-200) + "," + (-200) + ")")
      .call(function (tool) {
        tool.select(".tool_id")
          .text("");
        tool.select(".tool_value_name")
          .text("");
        tool.select(".tool_value_val")
          .text("");
      });

  }

  function drawBrushes(updateBrushes) {
    var attribs = xScale.domain();

    var levelOverlay = svg.select(".attribs")
      .selectAll(".levelOverlay")
      .data(dataIs);

    var levelOverlayEnter = levelOverlay.enter()
      .append("g");


    levelOverlayEnter
      .attr("class", "levelOverlay")
      .attr("id", function (d,i) { return "level" +i; });

    // Bugfix: when adding all attribs we need to update the brush
    if (updateBrushes) {
      levelOverlayEnter
        .merge(levelOverlay)
        .each(addBrush);
    } else {
      levelOverlayEnter
        .each(addBrush);
    }

    var attribOverlay = levelOverlayEnter.merge(levelOverlay)
      .selectAll(".attribOverlay")
      .data(function (_, i) {
        return attribs.map(function (a) {
          return {attrib:a, level:i};
        });
      });

    var attribOverlayEnter = attribOverlay
      .enter()
      .append("g")
      .attr("class", "attribOverlay")
      .style("cursor", "pointer");

    attribOverlayEnter
      .merge(attribOverlay)
      .attr("transform", function (d) {
        return "translate(" +
          x(d.attrib, d.level) +
          "," +
          yScales[d.level].range()[0] +
          ")";
      });

    attribOverlayEnter
      .append("rect")
      .merge(attribOverlay.select("rect"))

      .attr("fill", "none")
      // .style("opacity", "0.1")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", function () {
        return xScale.bandwidth()*1.1;
      })
      .attr("height", function (d) { return yScales[d.level].range()[1] - yScales[d.level].range()[0]; });

    attribOverlayEnter
      .append("text")
      .merge(attribOverlay.select("text"))
      .style("cursor", "point")
      .style("-webkit-user-select", "none")
      .style("-moz-user-select", "none")
      .style("-ms-user-select", "none")
      .style("user-select", "none")
      .text(function (d) {
        return d.attrib === "__seqId" ?
          "sequential Index" :
          d.attrib +
          (dSortBy[d.level]!==undefined &&
            dSortBy[d.level].attrib === d.attrib ?
            dSortBy[d.level].reverse ?
              " ↓" :
              " ↑" :
            "");
      })
      .attr("x", xScale.bandwidth()/2)
      .attr("y", 0)
      .style("font-weight", function (d) {
        return (dSortBy[d.level]!==undefined &&
          dSortBy[d.level].attrib === d.attrib ?
          "bolder" :
          "normal");
      })
      .style("font-family", "sans-serif")
      .style("font-size", function (d) {
        // make it grow
        if (dSortBy[d.level]!==undefined &&
          dSortBy[d.level].attrib === d.attrib )
          d3.select(this).dispatch("mousemove");
        return nv.attribFontSize + "px";
      })
      .on("click", deferEvent(onSortLevel))
      .call(d3.drag()
        .container(attribOverlayEnter.merge(attribOverlay).node())
        .on("start", attribDragstarted)
        .on("drag", attribDragged)
        .on("end", attribDragended))
      .on("mousemove", function () {
        var sel = d3.select(this);
        sel = sel.transition!==undefined? sel.transition().duration(150) : sel;
        sel
          .style("font-size", nv.attribFontSizeSelected+"px");
      })
      .on("mouseout", function () {
        var sel = d3.select(this);
        sel = sel.transition!==undefined ? sel.transition().duration(150) : sel;
        sel
          .style("font-size", nv.attribFontSize+"px");
      })
      .attr("transform", "rotate(-45)");


    levelOverlayEnter
      .append("text")
      .merge(levelOverlay.select("text.numNodesLabel"))
      .attr("class", "numNodesLabel")
      .style("font-family", "sans-serif")
      .style("pointer-events", "none")
      .merge(levelOverlay.select(".numNodesLabel"))
      .attr("y", function (_, i) {
        return yScales[i].range()[1] + 15;
      })
      .attr("x", function (_, i) {
        return  levelScale(i);
      })
      .text(function (d) {
        return fmt(d.length);
      });


    attribOverlay.exit().remove();
    levelOverlay.exit().remove();
  } // drawBrushes

  function attribDragstarted(d) {
    if (!d3.event.sourceEvent.shiftKey)
      return;

    if (DEBUG) console.log("start", d);
    d3.select(this.parentNode)
      .attr("transform", function (d) {
        return "translate(" +
          (d3.event.x + nv.attribFontSize/2) +
          "," +
          yScales[d.level].range()[0] +
          ")";
      });

  }

  function attribDragged(d) {
    // var attribInto = invertOrdinalScale(xScale, d3.everythingnt.x + nv.attribFontSize/2 - levelScale(d.level));
    // if (DEBUG) console.log(d3.event.x, d3.event.y, attribInto);
    if (!d3.event.sourceEvent.shiftKey)
      return;

    d3.select(this.parentNode)
      .attr("transform", function (d) {
        return "translate(" +
          (d3.event.x + nv.attribFontSize/2) +
          "," +
          yScales[d.level].range()[0] +
          ")";
      });
  }

  function attribDragended(d) {
    if (!d3.event.sourceEvent.shiftKey)
      return;
    if (DEBUG) console.log("end", d);


    var attrDraggedInto = invertOrdinalScale(xScale, d3.event.x + nv.attribFontSize/2 - levelScale(d.level));
    var pos;
    d3.select(this.parentNode)
      .attr("transform", function (d) {
        return "translate(" +
          x(d.attrib, d.level) +
          "," +
          yScales[d.level].range()[0] +
          ")";
      });

    if (attrDraggedInto!== d.attrib) {
      pos = dimensionsOrder.indexOf(attrDraggedInto);
      moveAttrToPos(d.attrib, pos);
      nv.updateData(dataIs);
    }

  }

  function drawCloseButton() {
    var maxLevel = dataIs.length-1;
    svg.select("#closeButton")
      .style("display", dataIs.length === 1 ? "none":"block")
      .attr("transform", "translate(" + (levelScale(maxLevel) + levelScale.bandwidth() - nv.levelsSeparation +15)  + "," + yScales[maxLevel].range()[0] + ")");
  }

  // Links between nodes
  function drawLink(link) {
    var
      lastAttrib = xScale.domain()[xScale.domain().length-1],
      rightBorder = x(lastAttrib, dataIs.length-1)+ xScale.bandwidth(),
      ys = yScales[dataIs.length-1](link.source[id]) + yScales[dataIs.length-1].bandwidth()/2,
      yt = yScales[dataIs.length-1](link.target[id]) + yScales[dataIs.length-1].bandwidth()/2,
      miny = Math.min(ys, yt),
      maxy = Math.max(ys, yt),
      midy = maxy-miny;
    context.moveTo(rightBorder, miny); //starting point
    context.quadraticCurveTo(
      rightBorder + midy/6, miny + midy/2, // mid point
      rightBorder, maxy // end point
    );
  }

  function drawLinks() {
    if (!links.length) return;
    if (DEBUG) console.log("Draw links ", links[links.length-1].length , links);
    context.save();
    context.beginPath();
    context.strokeStyle = nv.linkColor;
    context.globalAlpha = Math.min(1,
      Math.max(0.1,1000 / links[links.length-1].length )
    ); // More links more transparency
    // context.lineWidth = 0.5;
    visibleLinks.forEach(drawLink);
    context.stroke();
    context.restore();
  }


  function drawLine(points, width, color, close) {
    context.beginPath();
    points.forEach(function (p, i) {
      if (i === 0) {
        context.moveTo(p.x, p.y);
      } else {
        context.lineTo(p.x, p.y);
      }
    });
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

  function drawLevelConvections(level) {
    if (level <= 0) {
      return;
    }
    dataIs[level].representatives.forEach(function (item) {
      // Compute the yPrev by calculating the index of the corresponding representative
      var iOnPrev = dData.get(data[item][id]).__i[level-1];
      var iRep = Math.floor(iOnPrev - iOnPrev%dataIs[level-1].itemsPerpixel);
      // if (DEBUG) console.log("i rep = "+ iRep);
      // if (DEBUG) console.log(data[level-1][iRep]);
      // if (DEBUG) console.log(yScales[level-1](data[level-1][iRep][id]));
      var locPrevLevel = {
        x: levelScale(level-1) + xScale.range()[1],
        y: yScales[level-1]( data[dataIs[level-1][iRep]] [id])
      };
      var locLevel = {
        x: levelScale(level),
        y: yScales[level](data[item][id]) };

      var points = [ locPrevLevel,
        {x: locPrevLevel.x + nv.levelsSeparation * 0.3, y: locPrevLevel.y},
        {x: locLevel.x - nv.levelsSeparation * 0.3, y: locLevel.y},
        locLevel,
        {x: locLevel.x, y: locLevel.y + yScales[level].bandwidth()},
        {x: locLevel.x - nv.levelsSeparation * 0.3, y: locLevel.y + yScales[level].bandwidth()},
        {x: locPrevLevel.x + nv.levelsSeparation * 0.3, y: locPrevLevel.y + yScales[level - 1].bandwidth()},
        {x: locPrevLevel.x, y: locPrevLevel.y + yScales[level -1 ].bandwidth()},
        locPrevLevel

      ];
      drawLine(points, 1, nv.levelConvectionsColor);
      drawLine(points, 1, nv.levelConvectionsColor, true);
    });
  }




  function updateScales(opts) {
    let {levelToUpdate, updateColorDomains} = opts || {};
    if (DEBUG) console.log("Update scales");

    const before = performance.now();

    const lastLevel = dataIs.length-1;
    levelToUpdate = levelToUpdate!==undefined ? levelToUpdate : lastLevel;
    updateColorDomains = updateColorDomains!==undefined ? updateColorDomains : false;

    // Delete unvecessary scales
    if (DEBUG) console.log("Delete unvecessary scales");
    yScales.splice(lastLevel+1, yScales.length);
    yScales[levelToUpdate] = d3.scaleBand()
      .range([y0, height-nv.margin - 30])
      .paddingInner(0.0)
      .paddingOuter(0);


    // Compute Representatives
    if (DEBUG) console.log("Compute representatives");
    let representatives = [];
    if (dataIs[levelToUpdate].length>height) {
      const itemsPerpixel = Math.max(Math.floor(dataIs[levelToUpdate].length / (height*2)), 1);
      if (DEBUG) console.log("itemsPerpixel", itemsPerpixel);
      dataIs[levelToUpdate].itemsPerpixel = itemsPerpixel;
      for (let i = 0; i< dataIs[levelToUpdate].length; i+=itemsPerpixel ) {
        representatives.push(dataIs[levelToUpdate][i]);
      }
    } else {
      dataIs[levelToUpdate].itemsPerpixel=1;
      representatives = dataIs[levelToUpdate];
    }
    dataIs[levelToUpdate].representatives = representatives;


    // Update x and y scales
    yScales[levelToUpdate].domain(representatives.map(function (rep) { return data[rep][id];}));
    xScale
      .domain(dimensionsOrder)
      .range([0, nv.attribWidth * (dDimensions.keys().length)])
      .paddingInner(0.1)
      .paddingOuter(0);
    levelScale.domain(dataIs.map(function (d,i) { return i; }))
      .range([x0+nv.margin, ((xScale.range()[1] + nv.levelsSeparation) * dataIs.length) + x0])
      .paddingInner(0)
      .paddingOuter(0);



    // Update color scales domains
    if (updateColorDomains) {
      if (DEBUG) console.log("Update color scale domains", levelToUpdate);
      // colScales = d3.map();
      dDimensions.keys().forEach(
        function (attrib) {
          if (attrib === "visible") return;

          var scale = colScales.get(attrib);

          if (scale.__type==="seq" || scale.__type==="date") {
            scale.domain(d3.extent(
              dataIs[0].map(function (i) {
                return data[i][attrib];
              })
            )); //TODO: make it compute it based on the local range

          } else if (scale.__type==="div") {
            const [min, max] = d3.extent(dataIs[0].map(function (i) {
              return data[i][attrib];
            }));
            const absMax = Math.max(-min, max); // Assumes diverging point on 0
            scale.domain([-absMax, absMax]);

          } else if (scale.__type==="text") {
            scale.domain(dataIs[0].map((i)  => data[i][attrib]));
          }

          colScales.set(attrib, scale);
        }
      );
    }



    const after = performance.now();
    if (DEBUG) console.log("Updating Scales " + (after-before) + "ms");
  }


  function deleteOneLevel() {
    if (dataIs.length<=1) return;

    showLoading(this);
    if (DEBUG) console.log("Delete one level");
    removeBrushOnLevel(dataIs.length-2);
    dataIs[dataIs.length-2].forEach(function (d) { data[d].visible=true; });

    dataIs = dataIs.slice(0, dataIs.length-1);

    nv.updateData(dataIs, colScales);
    updateCallback(nv.getVisible());

    hideLoading(this);
  }

  function moveAttrToPos(attr, pos) {
    var i = dimensionsOrder.indexOf(attr);
    if ( i === -1)  { console.err("moveAttrToPos attr not found", attr); return; }
    if ( pos > dimensionsOrder.length || pos < 0) { console.err("moveAttrToPos pos out of bounds", pos, dimensionsOrder.length); return; }
    dimensionsOrder.splice(i, 1);
    dimensionsOrder.splice(pos, 0, attr);
  }


  function findNotNull(data, attr) {
    let i,
      val;
    for ( i = 0; i<nv.howManyItemsShouldSearchForNotNull && i< data.length; i++ ) {
      val = data[i][attr];
      if (val !== null &&
        val !== undefined &&
        val !== "") {
        return val;
      }
    }

    return val;
  }

  nv.initData = function (mData,  mColScales) {
    var before = performance.now();
    // getAttribs(mData[0][0]);
    colScales  = mColScales;
    colScales.keys().forEach(function (d) {
      dDimensions.set(d, true);
    });
    dData = d3.map();
    for (var i = 0; i < data.length ; i++) {
      var d = data[i];
      d.__seqId = i; //create a default id with the sequential number
      dData.set(d[id], d);
      d.__i=[];
      d.__i[0] = i;
    }

    filtersByLevel = [];
    filtersByLevel[0] = []; // Initialice filters as empty for lev 0
    // nv.updateData(mData, mColScales, mSortByAttr);

    var after = performance.now();
    if (DEBUG) console.log("Init data " + (after-before) + "ms");

  };



  nv.updateData = function (mDataIs, mColScales, opts) {
    const {levelToUpdate, updateColorDomains} = opts || {};

    if (DEBUG) console.log("updateData");
    var before = performance.now();
    var ctxWidth;
    if (typeof mDataIs !== typeof []) {
      console.error("navio updateData didn't receive an array");
      return;
    }

    colScales = mColScales !== undefined ? mColScales: colScales;
    dataIs = mDataIs;


    // Delete filters on unused levels
    filtersByLevel.splice(mDataIs.length);
    // Initialize new filter level
    filtersByLevel[mDataIs.length] = [];

    if (links.length>0) {
      visibleLinks = links.filter(function (d) {
        return d.source.visible && d.target.visible;
      });
    }

    // Delete unnecesary brushes
    dBrushes.splice(mDataIs.length);

    // Update the sorting of the last level
    updateSorting(mDataIs.length-1);
    updateScales({
      levelToUpdate,
      updateColorDomains
    });

    ctxWidth = levelScale.range()[1] + nv.margin + x0;
    d3.select(canvas)
      .attr("width", ctxWidth)
      .attr("height", height)
      .style("width", ctxWidth)
      .style("height", height+"px");
    canvas.style.width = ctxWidth+"px";
    canvas.style.height = height+"px";

    svg
      .attr("width", ctxWidth)
      .attr("height", height);
    nv.update();
    var after = performance.now();
    if (DEBUG) console.log("Updating data " + (after-before) + "ms");

  }; // updateData

  nv.update = function(_updateBrushes) {
    var updateBrushes = _updateBrushes !== undefined ? _updateBrushes : false;

    var before = performance.now();

    var w = levelScale.range()[1] + nv.margin + x0;
    context.clearRect(0,0,w+1,height+1);
    dataIs.forEach(function (levelData, i) {
      // var itemsPerpixel = Math.floor(levelData.length/height);
      // if (itemsPerpixel>1) { //draw one per pixel
      //   for (var j = 0; j< levelData.length; j+=(itemsPerpixel-1)) {
      //     drawItem(levelData[j], i);
      //   }
      // } else { // draw all

      drawLevelBorder(i);
      levelData.representatives.forEach(function (rep) {
        drawItem(data[rep], i);
      });
      // }


      drawLevelConvections(i);

    });


    drawLinks();

    drawBrushes(updateBrushes);
    drawCloseButton();

    var after = performance.now();
    if (DEBUG) console.log("Redrawing " + (after-before) + "ms");

  };

  nv.addAttrib = function (attr, scale) {
    if (dimensionsOrder.indexOf(attr)!== -1) return;
    dimensionsOrder.push(attr);
    colScales.set(attr, scale);
    return nv;
  };

  nv.addSequentialAttrib = function (attr, _scale ) {
    const domain = data!==undefined && data.length>0 ?
      d3.extent(data, function (d) { return d[attr]; }) :
      [0, 1];   //if we don"t have data, set the default domain
    const scale = _scale ||
      d3.scaleSequential(defaultColorInterpolator)
        .domain(domain);
    scale.__type = "seq";
    nv.addAttrib(attr, scale);
    return nv;
  };

  // Same as addSequentialAttrib but with a different color
  nv.addDateAttrib = function (attr, _scale ) {
    const domain = data!==undefined && data.length>0 ?
      d3.extent(data, function (d) { return d[attr]; }) :
      [0, 1];

    const scale = _scale ||
      d3.scaleSequential(defaultColorInterpolatorDate)
        .domain(domain); //if we don"t have data, set the default domain
    nv.addAttrib(attr,scale);

    scale.__type = "date";
    return nv;
  };

  // Adds a diverging scale
  nv.addDivergingAttrib = function (attr, _scale ) {
    const domain = data!==undefined && data.length>0 ?
      d3.extent(data, function (d) { return d[attr]; }) :
      [-1,  1];
    const scale = _scale ||
      d3.scaleSequential(defaultColorInterpolatorDiverging)
        .domain([domain[0], domain[1]]); //if we don"t have data, set the default domain
    scale.__type = "div";
    nv.addAttrib(attr, scale);
    return nv;
  };

  nv.addCategoricalAttrib = function (attr, _scale ) {
    const scale = _scale ||
      d3.scaleOrdinal(d3.schemeCategory10);
    scale.__type = "cat";
    nv.addAttrib(attr, scale);

    return nv;
  };

  nv.addTextAttrib = function (attr, _scale ) {
    const scale = _scale ||
      scaleText();

    nv.addAttrib(attr, scale);

    return nv;
  };


  // Adds all the attributes on the data, or all the attributes provided on the list based on their types
  nv.addAllAttribs = function (_attribs) {
    if (!data || !data.length) throw Error("addAllAttribs called without data to guess the attribs. Make sure to call it after setting the data");

    var attribs = _attribs!==undefined ? _attribs : getAttribs(data[0]);
    attribs.forEach(function (attr) {
      if (attr === "__seqId" ||
        attr === "__i" ||
        attr === "visible")
        return;

      const firstNotNull = findNotNull(data, attr);
      if (firstNotNull === null ||
        firstNotNull === undefined ||
        typeof(firstNotNull) === typeof("")) {
        const counts = scaleText()
          .computeRepresentatives(data.slice(0, nv.howManyItemsShouldSearchForNotNull)
            .map(d => d[attr]))
          .counts;

        // How many different elements are there
        if (counts.keys().length < nv.maxNumDistictForCategorical) {
          console.log(`Navio: Adding attr ${attr} as categorical`);
          nv.addCategoricalAttrib(attr);
        } else {
          console.log(`Navio: Attr ${attr} has too many distinct elements (${counts.keys().length}) using textAttrib`);
          nv.addTextAttrib(attr);
        }
      } else if (typeof(firstNotNull) === typeof(0)) {
        // Numbers
        if (d3.min(data, d=> d[attr]) < 0) {
          console.log(`Navio: Adding attr ${attr} as diverging`);
          nv.addDivergingAttrib(attr);
        } else {
          console.log(`Navio: Adding attr ${attr} as sequential`);
          nv.addSequentialAttrib(attr);
        }
      } else if (typeof(firstNotNull) === typeof(new Date())) {
        console.log(`Navio: Adding attr ${attr} as date`);
        nv.addDateAttrib(attr);
      } else {
        // Default categories
        console.log(`Navio: Don't know what to do with attr ${attr} adding as text (type=${typeof(firstNotNull)})`);
        nv.addTextAttrib(attr);

      }
    });

    nv.data(data);
    drawBrushes(true); // updates brushes width
    return nv;
  };


  nv.data = function(_) {
    if (!colScales.has("visible")) {
      nv.addAttrib("visible",
        d3.scaleOrdinal()
          .domain([false,true])
          .range(visibleColorRange)
          //, "#cddca3", "#8c6d31", "#bd9e39"]
      );
      moveAttrToPos("visible", 0);
    }
    if (!colScales.has("__seqId")) {
      nv.addSequentialAttrib(
        "__seqId"
      );
      moveAttrToPos("__seqId", 1);
    }

    if (arguments.length) {


      data = _.slice(0);

      data.forEach(function (d) {
        d.visible = true;
      });
      dataIs = [data.map(function (_, i) { return i; })];


      nv.initData(
        dataIs,
        colScales
      );
      nv.updateData(
        dataIs,
        colScales,
        { updateColorDomains:true }
      );
      return nv;
    } else {
      return data[0];
    }
  };

  nv.getVisible = function() {
    return dataIs[dataIs.length-1]
      .filter(function (d) { return data[d].visible; })
      .map(function (d) { return data[d]; });
  };

  nv.updateCallback = function(_) {
    return arguments.length ? (updateCallback = _, nv) : updateCallback;
  };

  nv.visibleColorRange = function(_) {
    return arguments.length ? (visibleColorRange = _, nv) : visibleColorRange;
  };

  nv.defaultColorInterpolator = function(_) {
    return arguments.length ? (defaultColorInterpolator = _, nv) : defaultColorInterpolator;
  };

  nv.id = function(_) {
    return arguments.length ? (id = _, nv) : id;
  };

  nv.links = function(_) {
    if (arguments.length) {
      links = _;
      return nv;
    } else {
      return links;
    }
  };

  return nv;
}

export default navio;
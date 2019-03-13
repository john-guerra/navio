// https://github.com/john-guerra/Navio#readme v0.0.15 Copyright 2019 John Alexis Guerra Gómez
import * as d3 from 'd3';
import { map, interpolateBlues, format, event, select, path, scaleBand, scaleQuantize, ascending, brushY, mouse, drag, extent, scaleSequential, scaleOrdinal, schemeCategory10 } from 'd3';
import { interpolateBlues as interpolateBlues$1 } from 'd3-scale-chromatic';

class FilterByRange {
  constructor(opts ) {
    this.first = opts.first;
    this.last = opts.last;
    this.level = opts.level;
  }

  filter(d) {
    return d.__i[this.level] >= this.first.__i[this.level] && d.__i[this.level] <= this.last.__i[this.level];
  }
}

class FilterByValue {
  constructor(opts ) {
    this.itemAttr = opts.itemAttr;
    this.sel = opts.sel;
  }

  filter(d) {
    return d[this.itemAttr] === this.sel[this.itemAttr];
  }
}

// import * as d3 from "../node_modules/d3/build/d3.js"; // Force react to use the es6 module

//eleId must be the ID of a context element where everything is going to be drawn
function navio(selection, _h) {
  var nv = this || {},
    data = [], //Contains the original data attributes
    dataIs = [], //Contains only the indices to the data, is an array of arrays, one for each level
    dData = map(), // A hash for the data
    dDimensions = map(),
    dimensionsOrder = [],
    dSortBy = map(), //contains which attribute to sort by on each column
    dBrushes = map(),
    filtersByLevel = [], // The filters applied to each level
    yScales =[],
    xScale,
    x,
    height = _h!==undefined ? _h : 600,
    colScales = map(),
    levelScale,
    canvas,
    context,
    defaultColorInterpolator =  "interpolateBlues" in d3 ? interpolateBlues : interpolateBlues$1, // necessary for supporting d3v4 and d3v5
    // defaultColorInterpolatorDate =  "interpolatePurples" in d3 ? d3.interpolatePurples : interpolatePurples,
    // defaultColorInterpolatorDiverging =  "interpolateBrBG" in d3 ? d3.interpolateBrBG : interpolateBrBG,
    visibleColorRange = ["white", "#b5cf6b"],
    fmt = format(",.0d"),
    x0=0,
    y0=100,
    id = "__seqId",
    updateCallback = function () {};

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
    event.preventDefault();
  }

  // Try to support strings and elements
  selection = typeof(selection) === typeof("") ? select(selection) : selection;
  selection = selection.selectAll === undefined ? select(selection) : selection;

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
        path$$1 = path(); // Draw a cross and a circle
      path$$1.moveTo(0, 0);
      path$$1.lineTo(crossSize, crossSize);
      path$$1.moveTo(crossSize, 0);
      path$$1.lineTo(0, crossSize);
      path$$1.moveTo(crossSize*1.2 + crossSize/2, crossSize/2);
      path$$1.arc(crossSize/2, crossSize/2, crossSize*1.2, 0, Math.PI*2);
      sel.attr("d", path$$1.toString());
    })
    .on("click", function () {
      deleteOneLevel();
    });

  xScale = scaleBand()
    // .rangeBands([0, nv.attribWidth], 0.1, 0);
    .range([0, nv.attribWidth])
    .round(true)
    .paddingInner(0.1)
    .paddingOuter(0);
  levelScale = scaleBand()
    .round(true);
  colScales = map();

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



  function invertOrdinalScale(scale, x) {
    // Taken from https://bl.ocks.org/shimizu/808e0f5cadb6a63f28bb00082dc8fe3f
    // custom invert function
    var domain = scale.domain();
    var range = scale.range();
    var qScale = scaleQuantize().domain(range).range(domain);

    return qScale(x);
  }

  function nvOnClickLevel(d) {
    if (event && event.defaultPrevented) return; // dragged
    var before = performance.now();
    dataIs[d.level] = dataIs[d.level].sort(function (a, b) {
      return ascending(data[a][d.attrib], data[b][d.attrib]);
    });
    dataIs[d.level].forEach(function (row,i) { data[row].__i[d.level] = i; });
    var after = performance.now();
    dSortBy.set(d.level, d.attrib);
    nv.updateData(dataIs, colScales, d.level);
  }

  function drawItem(item, level) {
    var attrib, i, y ;

    if (yScales[level].bandwidth() > nv.divisionsThreshold) ;

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
    select("#level"+lev)
      .selectAll(".brush")
      .call(dBrushes.get(lev).move, null);
  }

  function removeAllBrushesBut(but) {
    for (var lev=0; lev< dataIs.length ; lev+=1) {
      if (lev===but) continue;
      removeBrushOnLevel(lev);
    }
  }


  function addBrush(d, i) {
    dBrushes.set(i,
      brushY()
        .extent([
          [x(xScale.domain()[0], i),yScales[i].range()[0]],
          [x(xScale.domain()[xScale.domain().length-1], i) + xScale.bandwidth()*1.1, yScales[i].range()[1]]
        ])
        .on("end", onSelectByRange));
    var _brush = select(this)
      .selectAll(".brush")
      .data([{
        data : data[d],
        level : i
      }]);

    _brush.enter()
      .merge(_brush)
      .append("g")
      .on("mousemove", onMouseOver)
      .on("click", onSelectByValue)
      .on("mouseout", onMouseOut)
      .attr("class", "brush")
      .call(dBrushes.get(i))
      .selectAll("rect")
      // .attr("x", -8)
      .attr("width", x(xScale.domain()[xScale.domain().length-1], i) + xScale.bandwidth()*1.1);

    _brush.exit().remove();


    // Assigns the indexes on the new level data
    function assignIndexes(filteredData) {
      for (var j = 0; j < filteredData.length; j++) {
        data[filteredData[j]].__i[i+1] = j;
      }
    }

    // Applies the filters for the current level
    function applyFilters() {
      let before, after;

      before = performance.now();
      // Check if each item fits on any filter
      var filteredData = dataIs[i].filter(d => {
        data[d].visible = false;
        for (let filter of filtersByLevel[i]) {
          if (filter.filter(data[d])) {
            data[d].visible = true;
            break;
          }
        }
        return data[d].visible;
      });


      // var filteredData = filtersByLevel[i].reduce(reduceFilters, dataIs[i]);
      after = performance.now();


      return filteredData;

    }

    function onSelectByRange() {
      // if (DEBUG) console.log("brushended", d3.event);
      if (!event.sourceEvent) return; // Only transition after input.
      if (!event.selection){
        // return;
        // d3.event.preventDefault();
        // onSelectByValueFromCoords(d3.event.sourceEvent.clientX, d3.event.sourceEvent.clientY);
        return; // Ignore empty selections.
      }

      removeAllBrushesBut(i);
      var before = performance.now();
      var brushed = event.selection;

      var
        // first = dData.get(invertOrdinalScale(yScales[i], brushed[0] -yScales[i].bandwidth())),
        first = dData.get(invertOrdinalScale(yScales[i], brushed[0])),
        // last = dData.get(invertOrdinalScale(yScales[i], brushed[1] -yScales[i].bandwidth()))
        last = dData.get(invertOrdinalScale(yScales[i], brushed[1]));

      const newFilter = new FilterByRange({first, last, level:i});
      if (event.sourceEvent.shiftKey) {
        // Append the filter
        filtersByLevel[i].push(newFilter);
      } else {
        // Remove previous filters
        filtersByLevel[i]= [ newFilter ];
      }


      var filteredData = applyFilters();

      //Assign the index
      assignIndexes(filteredData);

      var after = performance.now();
      var newData = dataIs;
      if (filteredData.length===0) {
        return;
      } else {
        newData = dataIs.slice(0,i+1);
        newData.push(filteredData);
      }


      nv.updateData(
        newData,
        colScales
      );
      updateCallback(nv.getVisible());

      // nv.update(false); //don"t update brushes

      // d3.select(this).transition().call(d3.event.target.move, d1.map(x));
    }// onSelectByRange

    function onSelectByValue() {
      var clientY = mouse(event.target)[1],
        clientX = mouse(event.target)[0];

      onSelectByValueFromCoords(clientX, clientY);
    }


    function onSelectByValueFromCoords(clientX, clientY) {


      removeAllBrushesBut(-1); // Remove all brushes

      var before = performance.now();
      var itemId = invertOrdinalScale(yScales[i], clientY);
      var after = performance.now();

      var itemAttr = invertOrdinalScale(xScale, clientX - levelScale(i));
      if (itemAttr === undefined) return;

      var sel = dData.get(itemId);
      const newFilter = new FilterByValue({sel, itemAttr});
      if (event.shiftKey) {
        // Append the filter
        filtersByLevel[i].push(newFilter);
      } else {
        // Remove previous filters
        filtersByLevel[i]= [ newFilter ];
      }


      var filteredData = applyFilters();


      // var filteredData = dataIs[i].filter(function (i) {
      //   data[i].visible = data[i][itemAttr] === sel[itemAttr];
      //   return data[i].visible;
      // });

      assignIndexes(filteredData);

      var newData = dataIs.slice(0,i+1);
      newData.push(filteredData);


      nv.updateData(
        newData,
        colScales
      );
      updateCallback(nv.getVisible());
    }
  }


  function onMouseOver(overData) {
    var screenY = mouse(event.target)[1],
      screenX = mouse(event.target)[0];

    var itemId = invertOrdinalScale(yScales[overData.level], screenY);
    var itemAttr = invertOrdinalScale(xScale, screenX - levelScale(overData.level));
    var d = dData.get(itemId);
    // var itemId = d.data.filter(function (e) {
    //   var y = yScales[d.level](e[id]);
    //   e.visible = y >= screenY && y < screenY + yScales[d.level];
    //   return e.visible;
    // });

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

  function drawBrushes() {
    var attribs = xScale.domain();

    var levelOverlay = svg.select(".attribs")
      .selectAll(".levelOverlay")
      .data(dataIs);

    var levelOverlayEnter = levelOverlay.enter()
      .append("g")
      .attr("class", "levelOverlay")
      .attr("id", function (d,i) { return "level" +i; })
      .each(addBrush);

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
          d.attrib;
      })
      .attr("x", xScale.bandwidth()/2)
      .attr("y", 0)
      .style("font-weight", function (d) {
        return dSortBy.has(d.level) &&
          dSortBy.get(d.level) === d.attrib ?
          "bolder" :
          "normal";
      })
      .style("font-family", "sans-serif")
      .style("font-size", nv.attribFontSize+"px")
      .on("click", nvOnClickLevel)
      .call(drag()
        .container(attribOverlayEnter.merge(attribOverlay).node())
        .on("start", attribDragstarted)
        .on("drag", attribDragged)
        .on("end", attribDragended))
      .on("mousemove", function () {
        var sel = select(this);
        sel = sel.transition!==undefined? sel.transition().duration(150) : sel;
        sel
          .style("font-size", nv.attribFontSizeSelected+"px");
      })
      .on("mouseout", function () {
        var sel = select(this);
        sel = sel.transition!==undefined ? sel.transition().duration(150) : sel;
        sel
          .style("font-size", nv.attribFontSize+"px");
      })
      .attr("transform", "rotate(-45)");


    levelOverlayEnter
      .append("text")
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
    if (!event.sourceEvent.shiftKey)
      return;
    select(this.parentNode)
      .attr("transform", function (d) {
        return "translate(" +
          (event.x + nv.attribFontSize/2) +
          "," +
          yScales[d.level].range()[0] +
          ")";
      });

  }

  function attribDragged(d) {
    // var attribInto = invertOrdinalScale(xScale, d3.everythingnt.x + nv.attribFontSize/2 - levelScale(d.level));
    // if (DEBUG) console.log(d3.event.x, d3.event.y, attribInto);
    if (!event.sourceEvent.shiftKey)
      return;

    select(this.parentNode)
      .attr("transform", function (d) {
        return "translate(" +
          (event.x + nv.attribFontSize/2) +
          "," +
          yScales[d.level].range()[0] +
          ")";
      });
  }

  function attribDragended(d) {
    if (!event.sourceEvent.shiftKey)
      return;


    var attrDraggedInto = invertOrdinalScale(xScale, event.x + nv.attribFontSize/2 - levelScale(d.level));
    var pos;
    select(this.parentNode)
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



  nv.initData = function (mData,  mColScales) {
    var before = performance.now();
    // getAttribs(mData[0][0]);
    colScales  = mColScales;
    colScales.keys().forEach(function (d) {
      dDimensions.set(d, true);
    });
    dData = map();
    for (var i = 0; i < data.length ; i++) {
      var d = data[i];
      d.__seqId = i; //create a default id with the sequential number
      dData.set(d[id], d);
      d.__i={};
      d.__i[0] = i;

    }

    filtersByLevel = [];
    filtersByLevel[0] = []; // Initialice filters as empty for lev 0
    // nv.updateData(mData, mColScales, mSortByAttr);

    var after = performance.now();

  };

  function updateScales(levelToUpdate) {
    var before = performance.now();
    // yScales=[];
    var lastLevel = dataIs.length-1;
    // Delete unvecessary scales
    yScales.splice(lastLevel+1, yScales.length);
    levelToUpdate = levelToUpdate!==undefined ? levelToUpdate : lastLevel;
    yScales[levelToUpdate] = scaleBand()
      .range([y0, height-nv.margin - 30])
      .paddingInner(0.0)
      .paddingOuter(0);
    var representatives = [];
    if (dataIs[levelToUpdate].length>height) {
      var itemsPerpixel = Math.max(Math.floor(dataIs[levelToUpdate].length / (height*2)), 1);
      dataIs[levelToUpdate].itemsPerpixel = itemsPerpixel;
      for (var i = 0; i< dataIs[levelToUpdate].length; i+=itemsPerpixel ) {
        representatives.push(dataIs[levelToUpdate][i]);
      }
    } else {
      dataIs[levelToUpdate].itemsPerpixel=1;
      representatives = dataIs[levelToUpdate];
    }
    dataIs[levelToUpdate].representatives = representatives;
    yScales[levelToUpdate].domain(representatives.map(function (rep) { return data[rep][id];}));
    // Update color scales domains

    // colScales = d3.map();
    dDimensions.keys().forEach(
      function (attrib) {
        if (attrib === "visible") return;
        var scale = colScales.get(attrib);
        scale.domain(extent(dataIs[0].representatives.map(function (rep) {
          return data[rep][attrib];
        }))); //TODO: make it compute it based on the local range
        colScales.set(attrib, scale);
      }
    );

    xScale
      .domain(dimensionsOrder)
      .range([0, nv.attribWidth * (dDimensions.keys().length)])
      .paddingInner(0.1)
      .paddingOuter(0);
    levelScale.domain(dataIs.map(function (d,i) { return i; }))
      .range([x0+nv.margin, ((xScale.range()[1] + nv.levelsSeparation) * dataIs.length) + x0])
      .paddingInner(0)
      .paddingOuter(0);

    var after = performance.now();
  }

  nv.updateData = function (mDataIs, mColScales, levelToUpdate) {
    var before = performance.now();
    var ctxWidth;
    if (typeof mDataIs !== typeof []) {
      console.error("navio updateData didn't receive an array");
      return;
    }
    // if (!dSortBy.has(mDataIs.length-1)) {
    //   dSortBy.set(mDataIs.length-1, mSortByAttr);
    // }
    colScales = mColScales !== undefined ? mColScales: colScales;
    dataIs = mDataIs;


    // Delete filters on unused levels
    filtersByLevel.splice(dataIs.length);
    // Initialize new filter level
    filtersByLevel[dataIs.length] = [];


    updateScales(levelToUpdate);

    ctxWidth = levelScale.range()[1] + nv.margin + x0;
    select(canvas)
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

  };

  function deleteOneLevel() {
    if (dataIs.length<=1) return;
    removeBrushOnLevel(dataIs.length-2);
    dataIs[dataIs.length-2].forEach(function (d) { data[d].visible=true; });

    dataIs = dataIs.slice(0, dataIs.length-1);
    nv.updateData(dataIs, colScales);
    updateCallback(nv.getVisible());
  }

  function moveAttrToPos(attr, pos) {
    var i = dimensionsOrder.indexOf(attr);
    if ( i === -1)  { console.err("moveAttrToPos attr not found", attr); return; }
    if ( pos > dimensionsOrder.length || pos < 0) { console.err("moveAttrToPos pos out of bounds", pos, dimensionsOrder.length); return; }
    dimensionsOrder.splice(i, 1);
    dimensionsOrder.splice(pos, 0, attr);
  }



  nv.update = function() {
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


    drawBrushes();
    drawCloseButton();
    var after = performance.now();

  };

  nv.addAttrib = function (attr, scale) {
    if (dimensionsOrder.indexOf(attr)!== -1) return;
    dimensionsOrder.push(attr);
    colScales.set(attr,scale);
    return nv;
  };

  nv.addSequentialAttrib = function (attr, scale ) {
    nv.addAttrib(attr,scale ||
      scaleSequential(defaultColorInterpolator)
        .domain(data!==undefined && data.length>0 ?
          extent(data, function (d) { return d[attr]; }) :
          [0, 1]) //if we don"t have data, set the default domain
    );
    return nv;
  };

  // nv.addDivergingAttrib = function (attr, scale ) {
  //   var domain = data!==undefined && data.length>0 ?
  //     d3.extent(data, function (d) { return d[attr]; }) :
  //     [-1,  1];
  //   nv.addAttrib(attr,scale ||
  //     d3.scaleDiverging(defaultColorInterpolator)
  //       .domain([domain[0], 0, domain[1]]) //if we don"t have data, set the default domain
  //   );
  //   return nv;
  // };

  nv.addCategoricalAttrib = function (attr, scale ) {
    nv.addAttrib(attr,scale ||
      scaleOrdinal(schemeCategory10));
    return nv;
  };

  // nv.addAllAttribs = function (_attribs, scale) {
  //   if (!data || !data.length) throw Error("no data defined yet!");

  //   var attribs = _attribs!==undefined ? _attribs : getAttribs(data[0]);
  //   var guessedScale, domain;
  //   attribs.forEach(function (attr) {
  //     if (typeof(data[attr]) === typeof("")) {
  //       guessedScale = d3.scaleOrdinal(d3.schemeCategory10);
  //     // } else if (typeof(data[attr]) === typeof(new Date())) {
  //     //   guessedScale = d3.scaleSequential(defaultColorInterpolatorDate)
  //     //     .domain(data!==undefined && data.length>0 ?
  //     //       d3.extent(data, function (d) { return d[attr]; }) :
  //     //       [0, 1]); //if we don"t have data, set the default domain
  //     } else {
  //       domain = data!==undefined && data.length>0 ?
  //         d3.extent(data, function (d) { return d[attr]; }) :
  //         [0, 1];

  //       // if (domain[0] < 0) {
  //       //   d3.scaleSequential(defaultColorInterpolatorDiverging)
  //       //     .domain([domain[0], 0, domain[1]]); //if we don"t have data, set the default domain
  //       // } else {
  //         d3.scaleSequential(defaultColorInterpolator)
  //           .domain(domain); //if we don"t have data, set the default domain
  //       // }
  //     }
  //     if (DEBUG) console.log("attr", attr, guessedScale);

  //     nv.addAttrib(attr,scale ||
  //       guessedScale);
  //   });

  //   nv.updateData(dataIs);
  //   return nv;
  // };


  nv.data = function(_) {
    if (!colScales.has("visible")) {
      nv.addAttrib("visible",
        scaleOrdinal()
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
      _.forEach(function (d) {
        d.visible = true;
      });

      data = _;
      dataIs = [data.map(function (_, i) { return i; })];


      nv.initData(
        dataIs,
        colScales
      );
      nv.updateData(
        dataIs,
        colScales
      );
      return nv;
    } else {
      return data[0];
    }
  };

  nv.getVisible = function() {
    return dataIs[dataIs.length-1].filter(function (d) { return data[d].visible; }).map(function (d) { return data[d]; });
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

  return nv;
}

export default navio;

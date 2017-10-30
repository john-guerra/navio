/* global d3, NodeNavigator, crossfilter */
var d3 = require("d3");
//eleId must be the ID of a context element where everything is going to be drawn
function NodeNavigator(eleId, h) {
  "use strict";
  var nn = this,
    data = [], //Contains the original data attributes in an array
    links = [], //Contains the original data attributes in an array
    dData = d3.map(), // A hash for the data
    dDimensions = d3.map(),
    dSortBy = d3.map(), //contains which attribute to sort by on each column
    dBrushes = d3.map(),
    yScales =[],
    xScale,
    x,
    colScales = d3.map(),
    levelScale,
    canvas,
    context,
    // Taken from d3.chromatic https://github.com/d3/d3-scale-chromatic/blob/master/src/sequential-single/Blues.js
    defaultColorRange = ["#deebf7", "#2171b5"],
    visibleColorRange = ["white", "#b5cf6b"],
    fmt = d3.format(",.0d"),
    x0=0,
    y0=100,
    id = "id",
    updateCallback = function () {};

  nn.margin = 10;
  nn.attribWidth = 10;
  nn.levelsSeparation = 40;
  nn.divisionsColor = "white";
  nn.levelConnectionsColor = "rgba(205, 220, 163, 0.5)";
  nn.divisionsThreshold = 3;

  nn.startColor = "white";
  nn.endColor = "red";
  nn.legendFont = "14px Arial";
  nn.linkColor = "#2171b5";
  // nn.linkColor = "rgba(0,0,70,0.9)";



  d3.select(eleId)
    // .attr("width", 150)
    .style("height", h + "px")
    .style("float", "left")
    .attr("class", "NodeNavigator")
    .append("div")
      .style("float", "left")
      .attr("id", "nodeNavigator")
      .style("position", "relative");
  d3.select(eleId)
    .select("#nodeNavigator")
    .append("canvas");
  var svg = d3.select(eleId)
    .select("#nodeNavigator")
    .append("svg")
      .style("overflow", "visible")
      .style("position", "absolute")
      .style("z-index", 99)
      .style("top", 0)
      .style("left", 0);
  svg.append("g")
    .attr("class", "attribs");

  svg.append("g")
    .attr("class", "tooltip")
    .style("text-shadow", "0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff")
    .attr("transform", "translate(-100,-10)")
    .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .style("pointer-events", "none")
      .style("font-family", "sans-serif")
      .style("font-size", "16pt");

  svg.select(".tooltip > text")
    .append("tspan")
      .attr("class", "tool_id")
      .attr("x", 0)
      .attr("dy", "1.2em");

  svg.select(".tooltip > text")
    .append("tspan")
      .attr("class", "tool_value")
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
    .on("click", function () {
      deleteOneLevel();
    });

  xScale = d3.scaleBand()
    // .rangeBands([0, nn.attribWidth], 0.1, 0);
    .range([0, nn.attribWidth])
    .round(true)
    .paddingInner(0.1)
    .paddingOuter(0);
  levelScale = d3.scaleBand()
    .round(true);
  colScales = d3.map();

  x = function (val, level) {
    return levelScale(level) + xScale(val);
  };

  canvas = d3.select(eleId).select("canvas").node();
  // canvas.style.position = "absolute";
  canvas.style.top = canvas.offsetTop + "px";
  canvas.style.left = canvas.offsetLeft + "px";
  // canvas.style.width =  "150px";
  canvas.style.height = h + "px";

  context = canvas.getContext("2d");
  // context.strokeStyle = "rgba(0,100,160,1)";
  // context.strokeStyle = "rgba(0,0,0,0.02)";



  function invertOrdinalScale(scale, x) {
    // Taken from https://bl.ocks.org/shimizu/808e0f5cadb6a63f28bb00082dc8fe3f
    // custom invert function
    var domain = scale.domain();
    var range = scale.range();
    var qScale = d3.scaleQuantize().domain(range).range(domain);

    return qScale(x);
  }

  function nnOnClickLevel(d) {
    console.log("click " + d);
    var before = performance.now();
    data[d.level] = data[d.level].sort(function (a, b) {
      return d3.ascending(a[d.attrib], b[d.attrib]);
    });
    data[d.level].forEach(function (row,i) { row.__i[d.level] = i; });
    var after = performance.now();
    console.log("Click sorting " + (after-before) + "ms");
    dSortBy.set(d.level, d.attrib);
    nn.updateData(data, colScales, d.level);
  }

  function getAttribs(obj) {
    var attr;
    dDimensions = d3.map();
    for (attr in obj) {
      if (obj.hasOwnProperty(attr)) {
        dDimensions.set(attr, true);
      }
    }
  }

  function drawItem(item, level) {
    var attrib, i, y ;

    for (i = 0; i < dDimensions.keys().length; i++) {
      attrib = dDimensions.keys()[i];
      y = Math.round(yScales[level](item[id]) + yScales[level].bandwidth()/2);
      // y = yScales[level](item[id]) + yScales[level].bandwidth()/2;

      context.beginPath();
      context.moveTo(x(attrib, level), y);
      context.lineTo(x(attrib, level) + xScale.bandwidth(), y);
      context.lineWidth = Math.round(yScales[level].bandwidth());
      // context.lineWidth = 1;
      context.strokeStyle = item[attrib] === undefined ||
                item[attrib] === null ||
                item[attrib] === "none" ?
                 "white" :
                colScales.get(attrib)(item[attrib]);
      context.stroke();


      //If the range bands are tick enough draw divisions
      if (yScales[level].bandwidth() > nn.divisionsThreshold) {
        var yLine = Math.round(yScales[level](item[id])) ;
        // y = yScales[level](item[id])+yScales[level].bandwidth()/2;
        context.beginPath();
        context.moveTo(x(attrib, level), yLine);
        context.lineTo(x(attrib, level) + xScale.bandwidth(), yLine);
        context.lineWidth = 1;
        // context.lineWidth = 1;
        context.strokeStyle = nn.divisionsColor;
        context.stroke();
      }

    }

  }

  function drawLevelBorder(i) {
    context.beginPath();
    context.rect(levelScale(i),
      yScales[i].range()[0],
      xScale.range()[1],
      yScales[i].range()[1]-100);
    context.strokeStyle = "black";
    context.lineWidth = 1;
    context.stroke();
  }


  function removeBrushOnLevel(lev) {
    d3.select("#level"+lev)
      .selectAll(".brush")
      .call(dBrushes.get(lev).move, null);
  }

  function removeAllBrushesBut(but) {
    for (var lev=0; lev< data.length ; lev+=1) {
      if (lev===but) continue;
      removeBrushOnLevel(lev);
    }
  }


  function addBrush(d, i) {
    dBrushes.set(i,
      d3.brushY()
        .extent([
          [x(xScale.domain()[0], i),yScales[i].range()[0]],
          [x(xScale.domain()[xScale.domain().length-1], i) + xScale.bandwidth(), yScales[i].range()[1]]
        ])
        .on("end", brushended));
    var _brush = d3.select(this)
      .selectAll(".brush")
      .data([{data:d,level:i}]);// fake data

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
      .attr("width", xScale.bandwidth()* (dDimensions.size()+1));

    _brush.exit().remove();

    function brushended() {
      if (!d3.event.sourceEvent) return; // Only transition after input.
      if (!d3.event.selection) return; // Ignore empty selections.

      removeAllBrushesBut(i);
      var before = performance.now();
      var brushed = d3.event.selection;

      var first = dData.get(invertOrdinalScale(yScales[i], brushed[0] -yScales[i].bandwidth())),
        last = dData.get(invertOrdinalScale(yScales[i], brushed[1] -yScales[i].bandwidth()));
      console.log("first and last");
      console.log(first);
      console.log(last);
      // var brush0_minus_bandwidth = brushed[0] - yScales[i].bandwidth();
      // var filteredData = data[i].filter(function (d) {
      //   var y = yScales[i](d[id]);
      //   d.visible = y >= (brush0_minus_bandwidth) && y <= (brushed[1] );
      //   return d.visible;
      // });

      var filteredData = data[i].filter(function (d) {
        d.visible = d.__i[i] >= first.__i[i] && d.__i[i] <= last.__i[i];
        return d.visible;
      });

      //Assign the index
      filteredData.forEach(function(d, j) {
        d.__i[i+1] = j;
      });

      var after = performance.now();
      console.log("Brushend filtering " + (after-before) + "ms");


      var newData;
      if (filteredData.length===0) { // empty selection -> remove level
        console.log("Empty selection!");
        return;
      } else {
        newData = data.slice(0,i+1);
        newData.push(filteredData);
      }
      if (links.length>0) {
        links = links.slice(0, i+1);
        links.push(links[i].filter(function (d) {
          return d.source.visible && d.target.visible;
        }));
      }


      nn.updateData(
        newData,
        colScales
      );
      console.log("Selected " + nn.getVisible().length + " calling updateCallback");
      updateCallback(nn.getVisible());

      // nn.update(false); //don't update brushes

      // d3.select(this).transition().call(d3.event.target.move, d1.map(x));
    }// brushend

    function onSelectByValue() {
      console.log("click");
      removeAllBrushesBut(-1); // Remove all brushes
      var screenY = d3.mouse(d3.event.target)[1],
        screenX = d3.mouse(d3.event.target)[0];
      var before = performance.now();
      var itemId = invertOrdinalScale(yScales[i], screenY);
      var after = performance.now();
      console.log("invertOrdinalScale " + (after-before) + "ms");

      var itemAttr = invertOrdinalScale(xScale, screenX - levelScale(i));
      var sel = dData.get(itemId);
      before = performance.now();
      var filteredData = data[i].filter(function (d) {
        d.visible = d[itemAttr] === sel[itemAttr];
        return d.visible;
      });
      filteredData.forEach(function (d, i) { d.__i[data.length] = i;});
      after = performance.now();
      console.log("Click filtering " + (after-before) + "ms");

      var newData = data.slice(0,i+1);
      newData.push(filteredData);

      nn.updateData(
        newData,
        colScales
      );

      console.log("Selected " + nn.getVisible().length + " calling updateCallback");
      updateCallback(nn.getVisible());
    }
    // Update the brush
  }


  function onMouseOver(data) {
    var screenY = d3.mouse(d3.event.target)[1],
      screenX = d3.mouse(d3.event.target)[0];

    var itemId = invertOrdinalScale(yScales[data.level], screenY);
    var itemAttr = invertOrdinalScale(xScale, screenX - levelScale(data.level));
    var d = dData.get(itemId);
    // var itemId = d.data.filter(function (e) {
    //   var y = yScales[d.level](e[id]);
    //   e.visible = y >= screenY && y < screenY + yScales[d.level];
    //   return e.visible;
    // });

    svg.select(".tooltip")
      .attr("transform", "translate(" + (screenX) + "," + (screenY+20) + ")")
      .call(function (tool) {
        tool.select(".tool_id")
          .text(itemId);
        tool.select(".tool_value")
          .text(itemAttr + " : " + d[itemAttr]);
      });
  }

  function onMouseOut() {
    svg.select(".tooltip")
      .attr("transform", "translate(" + (-200) + "," + (-200) + ")")
      .call(function (tool) {
        tool.select(".tool_id")
          .text("");
        tool.select(".tool_value")
          .text("");
      });

  }

  function drawBrushes() {
    // var attribHolder, attribsData;

    //Format the data to draw the phantom rects
    // attribsData = data.reduce(
    //   function (p, l, i) {
    //     return p.concat(xScale.domain().map(function (d) {
    //       return {attrib:d, level:i};
    //     }));
    //   },
    //   []
    // );

    var attribs = xScale.domain();

    var levelOverlay = svg.select(".attribs")
      .selectAll(".levelOverlay")
      .data(data);

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
        .style("cursor", "pointer")
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
      .attr("width", function () { return xScale.bandwidth(); })
      .attr("height", function (d) { return yScales[d.level].range()[1] - yScales[d.level].range()[0]; });

    attribOverlayEnter
      .append("text")
      .merge(attribOverlay.select("text"))
      .text(function (d) { return d.attrib; })
      .attr("x", xScale.bandwidth()/2)
      .attr("y", 0)
      .style("font-weight", function (d) {
        return dSortBy.has(d.level) &&
          dSortBy.get(d.level) === d.attrib ?
            "bolder" :
            "normal";
      })
      .style("font-family", "sans-serif")
      .style("font-size", "9px")
      .on("mousemove", function (d) { d3.select(this).style("font-size", "24px"); })
      .on("mouseout", function (d) { d3.select(this).style("font-size", "9px"); })
      .attr("transform", "rotate(-45)")
      .on("click", nnOnClickLevel);

    attribOverlay.exit().remove();
    levelOverlay.exit().remove();


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

    levelOverlay.exit().remove();
  }

  function drawCloseButton() {
    var maxLevel = data.length-1;
    svg.select("#closeButton")
      .style("display", data.length === 1 ? "none":"block")
      .attr("transform", "translate(" + (levelScale(maxLevel) + levelScale.bandwidth() - nn.levelsSeparation +15)  + "," + yScales[maxLevel].range()[0] + ")")
  }

  // Links between nodes
  function drawLink(link) {
    var
      lastAttrib = xScale.domain()[xScale.domain().length-1],
      rightBorder = x(lastAttrib, data.length-1)+ xScale.bandwidth(),
      ys = yScales[data.length-1](link.source[id]) + yScales[data.length-1].bandwidth()/2,
      yt = yScales[data.length-1](link.target[id]) + yScales[data.length-1].bandwidth()/2,
      miny = Math.min(ys, yt),
      maxy = Math.max(ys, yt),
      midy = maxy-miny;
    context.moveTo(rightBorder, miny); //starting point
    context.quadraticCurveTo(
      rightBorder + midy/8, miny + midy/2, // mid point
      rightBorder, maxy // end point
      );
  }

  function drawLinks() {
    console.log("draw links ");
    if (!links.length) return;

    context.save();
    context.beginPath();
    context.strokeStyle = nn.linkColor;
    context.globalAlpha = Math.min(1,
      Math.max(0.01,100 / links[links.length-1].length )
    ); // More links more transparency
    // context.lineWidth = 0.5;
    links[links.length-1].forEach(drawLink);
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

  function drawLevelConnections(level) {
    if (level <= 0) {
      return;
    }
    data[level].representatives.forEach(function (item) {
      // Compute the yPrev by calculating the index of the corresponding representative
      var iOnPrev = dData.get(item[id]).__i[level-1];
      var iRep = Math.floor(iOnPrev - iOnPrev%data[level-1].itemsPerpixel);
      // console.log("i rep = "+ iRep);
      // console.log(data[level-1][iRep]);
      // console.log(yScales[level-1](data[level-1][iRep][id]));
      var locPrevLevel = {
        x: levelScale(level-1) + xScale.range()[1],
        y: yScales[level-1](data[level-1][iRep][id])
      };
      var locLevel = {
        x: levelScale(level),
        y: yScales[level](item[id]) };

      var points = [ locPrevLevel,
        {x: locPrevLevel.x + nn.levelsSeparation * 0.3, y: locPrevLevel.y},
        {x: locLevel.x - nn.levelsSeparation * 0.3, y: locLevel.y},
        locLevel,
        {x: locLevel.x, y: locLevel.y + yScales[level].bandwidth()},
        {x: locLevel.x - nn.levelsSeparation * 0.3, y: locLevel.y + yScales[level].bandwidth()},
        {x: locPrevLevel.x + nn.levelsSeparation * 0.3, y: locPrevLevel.y + yScales[level - 1].bandwidth()},
        {x: locPrevLevel.x, y: locPrevLevel.y + yScales[level -1 ].bandwidth()},
        locPrevLevel

      ];
      drawLine(points, 1, nn.levelConnectionsColor);
      drawLine(points, 1, nn.levelConnectionsColor, true);
    });
  }


  function drawDimensionTitles(level) {
    dDimensions.keys().forEach(function (attrib) {
      // context.font = nn.legendFont;
      // context.rotate(-Math.PI/4);
      // context.fillText(attrib,x(attrib, level),y0);
      // context.rotate(Math.PI/4);

      context.save();
      context.translate(x(attrib, level)+xScale.bandwidth()/2 , y0-5);
      context.rotate(-Math.PI/4);
      // context.textAlign = "center";
      context.fillStyle="black";
      if (dSortBy.has(level) && dSortBy.get(level) === attrib) {
        context.font="Bold 10px Arial";
      } else {
        context.font="10px Arial";
      }

      context.fillText(attrib, 0, 0);
      context.restore();
    } );
    context.font="14px Arial";
    context.fillStyle="black";
    context.fillText(fmt(data[level].length), levelScale(level), yScales[level].range()[1] + 15);
  }



  nn.initData = function (mData,  mColScales) {
    var before = performance.now();
    // getAttribs(mData[0][0]);
    colScales  = mColScales;
    colScales.keys().forEach(function (d) {
      dDimensions.set(d, true);
    });
    dData = d3.map();
    mData[0].forEach(function (d, i) {
      dData.set(d[id], d);
      d.__i={};
      d.__i[0] = i;
    });
    // nn.updateData(mData, mColScales, mSortByAttr);

    var after = performance.now();
    console.log("Init data " + (after-before) + "ms");

  };

  function updateScales(levelToUpdate) {
    var before = performance.now();
    // yScales=[];
    var lastLevel = data.length-1;
    // Delete unnecessary scales
    yScales.splice(lastLevel+1, yScales.length);
    levelToUpdate = levelToUpdate!==undefined ? levelToUpdate : lastLevel;
    yScales[levelToUpdate] = d3.scaleBand()
      .range([y0, h-nn.margin - 30])
      .paddingInner(0.0)
      .paddingOuter(0);

    var representatives = [];
    if (data[levelToUpdate].length>h) {
      var itemsPerpixel = Math.floor(data[levelToUpdate].length / (h*2));
      data[levelToUpdate].itemsPerpixel = itemsPerpixel;
      for (var i = 0; i< data[levelToUpdate].length; i+=itemsPerpixel ){
        representatives.push(data[levelToUpdate][i]);
      }
    } else {
      representatives = data[levelToUpdate];
    }
    data[levelToUpdate].representatives = representatives;
    yScales[levelToUpdate].domain(representatives.map(function (d) { return d[id];}));




    // data.forEach(function (levelData, i) {
    //   yScales[i] = d3.scaleBand()
    //     .range([y0, h-nn.margin - 30])
    //     .paddingInner(0.0)
    //     .paddingOuter(0);
    //   yScales[i].domain(levelData.map(function (d) {
    //     return d[id];
    //   })
    //   );
    // });

    // Update color scales domains

    // colScales = d3.map();
    dDimensions.keys().forEach(
      function (attrib) {
        if (attrib === "visible") return;
        var scale = colScales.get(attrib);
        scale.domain(d3.extent(data[0].representatives.map(function (d) { return d[attrib]; }))); //TODO: make it compute it based on the local range
        colScales.set(attrib, scale);
      }
    );

    xScale
      .domain(dDimensions.keys().sort(function (a,b) {
        if (a==="visible") {
          return -1;
        }
        else if (b === "visible") {
          return 1;
        } else {
          return 0;
        }

      }))
      .range([0, nn.attribWidth * (dDimensions.keys().length)])
      .paddingInner(0.1)
      .paddingOuter(0);
    levelScale.domain(data.map(function (d,i) { return i; }))
      .range([x0+nn.margin, ((xScale.range()[1] + nn.levelsSeparation) * data.length) + x0])
      .paddingInner(0)
      .paddingOuter(0);

    var after = performance.now();
    console.log("Updating Scales " + (after-before) + "ms");
  }

  nn.updateData = function (mData, mColScales, levelToUpdate) {
    var before = performance.now();
    var ctxWidth;
    if (typeof mData !== typeof []) {
      console.error("NodeNavigator updateData didn't receive an array");
      return;
    }
    // if (!dSortBy.has(mData.length-1)) {
    //   dSortBy.set(mData.length-1, mSortByAttr);
    // }
    colScales = mColScales;
    data = mData;
    context = canvas.getContext("2d");

    updateScales(levelToUpdate);
    ctxWidth = levelScale.range()[1] + nn.margin + x0;
    d3.select(canvas)
      .attr("width", ctxWidth)
      .attr("height", h)
      .style("width", ctxWidth)
      .style("height", h+"px");
    canvas.style.width = ctxWidth+"px";
    canvas.style.height = h+"px";

    svg
      .attr("width", ctxWidth)
      .attr("height", h);
    nn.update();
    var after = performance.now();
    console.log("Updating data " + (after-before) + "ms");

  };

  function deleteOneLevel() {
    if (data.length<=1) return;
    console.log("Delete one level");
    removeBrushOnLevel(data.length-2);
    data[data.length-2].forEach(function (d) { d.visible=true; });

    if (links.length>1)
      links = links.slice(0, data.length-1);
    data = data.slice(0, data.length-1);
    nn.updateData(data, colScales);
  }



  nn.update = function() {
    var before = performance.now();

    var w = levelScale.range()[1] + nn.margin + x0;
    context.clearRect(0,0,w+1,h+1);
    data.forEach(function (levelData, i) {
      // var itemsPerpixel = Math.floor(levelData.length/h);
      // if (itemsPerpixel>1) { //draw one per pixel
      //   for (var j = 0; j< levelData.length; j+=(itemsPerpixel-1)) {
      //     drawItem(levelData[j], i);
      //   }
      // } else { // draw all
        levelData.representatives.forEach(function (d) {
          drawItem(d, i);
        });
      // }

      drawLevelBorder(i);
      drawLevelConnections(i);
      // drawDimensionTitles(i);




    });

    drawLinks();

    drawBrushes();
    drawCloseButton();
    var after = performance.now();
    console.log("Redrawing " + (after-before) + "ms");

  };

  nn.addAttrib = function (attr, scale) {
    colScales.set(attr,scale);
    return nn;
  };

  nn.addSequentialAttrib = function (attr, scale ) {
    nn.addAttrib(attr,scale ||
      d3.scaleLinear()
        .domain(data!==undefined && data.length>0 ?
            d3.extent(data[0], function (d) { return d[attr]; }) :
            [0, 1]) //if we don't have data, set the default domain
        .range(defaultColorRange));
    return nn;
  };

  nn.addCategoricalAttrib = function (attr, scale ) {
    nn.addAttrib(attr,scale ||
      d3.scaleOrdinal(d3.schemeCategory20));
    return nn;
  };

  nn.links = function (_) {
    if (arguments.length) {
      links = [_];
      return nn;
    } else {
      return links;
    }
  };


  nn.data = function(_) {
    if (!colScales.has("visible")) {
      nn.addAttrib("visible",
                d3.scaleOrdinal()
            .domain([false,true])
            .range(visibleColorRange)
            //, "#cddca3", "#8c6d31", "#bd9e39"]
      );
    }
    // nn.addCategoricalAttrib("group");


    if (arguments.length) {
      _.forEach(function (d) {
        d.visible = true;
      });

      data = [_];
      nn.initData(
        data,
        colScales
      );
      nn.updateData(
        data,
        colScales
      );
      return nn;
    } else {
      return data[0];
    }
  };

  nn.getVisible = function() {
    return data[data.length-1].filter(function (d) { return d.visible; });
  };


  nn.updateCallback = function(_) {
    return arguments.length ? (updateCallback = _, nn) : updateCallback;
  };

  nn.visibleColorRange = function(_) {
    return arguments.length ? (visibleColorRange = _, nn) : visibleColorRange;
  };

  nn.defaultColorRange = function(_) {
    return arguments.length ? (defaultColorRange = _, nn) : defaultColorRange;
  };

  nn.id = function(_) {
    return arguments.length ? (id = _, nn) : id;
  };

  return nn;
}

export default NodeNavigator;

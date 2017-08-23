/* global d3, NodeNavigator, crossfilter */

//eleId must be the ID of a context element where everything is going to be drawn
function NodeNavigator(eleId, h) {
  "use strict";
  var nn = this,
    data = [], //Contains the original data attributes in an array
    links = [], //Contains the original data attributes in an array
    dDimensions = d3.map(),
    dSortBy = d3.map(), //contains which attribute to sort by on each column
    yScales,
    xScale,
    x,
    colScales = d3.map(),
    levelScale,
    canvas,
    context,
    // Taken from d3.chromatic https://github.com/d3/d3-scale-chromatic/blob/master/src/sequential-single/Blues.js
    defaultColorRange = ["#deebf7", "#2171b5"],
    visibleColorRange = ["white", "#b5cf6b"],

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



  d3.select(eleId)
    // .attr("width", 150)
    // .attr("height", h)
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
      .style("top", 0)
      .style("left", 0);
  svg.append("g")
    .attr("class", "attribs");

  svg.append("text")
    .attr("class", "tooltip")
    .style("pointer-events", "none")
    .style("font-family", "sans-serif")
    .attr("x", -100);




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
  // canvas.style.height = h + "px";

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
    data[d.level] = data[d.level].sort(function (a, b) {
      return d3.ascending(a[d.attrib], b[d.attrib]);
    });
    dSortBy.set(d.level, d.attrib);
    nn.updateData(data, colScales);
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

  function addBrush(d, i) {
    var _brush = d3.select(this)
      .selectAll(".brush")
      .data([{data:d,level:i}]);// fake data

    _brush.enter()
      .merge(_brush)
      .append("g")
        .on("mousemove", onMouseOver)
        .on("mouseout", onMouseOut)
        .attr("class", "brush")
        .call(d3.brushY()
          .extent([
            [x(xScale.domain()[0], i),yScales[i].range()[0]],
            [x(xScale.domain()[xScale.domain().length-1], i) + xScale.bandwidth(), yScales[i].range()[1]]
          ])
          .on("end", brushended))
        .selectAll("rect")
          // .attr("x", -8)
          .attr("width", xScale.bandwidth()* dDimensions.size());

    _brush.exit().remove();


    function brushended(d) {
      if (!d3.event.sourceEvent) return; // Only transition after input.
      if (!d3.event.selection) return; // Ignore empty selections.
      console.log("Brush");
      console.log(d);
      var brushed = d3.event.selection;
      var filteredData = data[i].filter(function (d) {
        var y = yScales[i](d[id]);
        d.visible = y >= (brushed[0] - yScales[i].bandwidth()) && y <= (brushed[1] );
        return d.visible;
      });

      if (filteredData.length===0) return;

      var newData = data.slice(0,i+1);
      // var newData = data;
      newData.push(filteredData);


      nn.updateData(
        newData,
        colScales
      );
      console.log("Selected " + nn.getVisible().length + " calling updateCallback");
      updateCallback(nn.getVisible());

      // nn.update(false); //don't update brushes

      // d3.select(this).transition().call(d3.event.target.move, d1.map(x));
    }
    // Update the brush
  }

  function onMouseOver(d) {
    console.log(d);
    var screenY = d3.mouse(d3.event.target)[1],
      screenX = d3.mouse(d3.event.target)[0];

    var filteredData = invertOrdinalScale(yScales[d.level], screenY);

    // var filteredData = d.data.filter(function (e) {
    //   var y = yScales[d.level](e[id]);
    //   e.visible = y >= screenY && y < screenY + yScales[d.level];
    //   return e.visible;
    // });
    console.log(filteredData);

    svg.select(".tooltip")
      .attr("x", screenX)
      .attr("y", screenY)
      .text(filteredData);
  }

  function onMouseOut() {
    // svg.select(".tooltip")
    //   .attr("x", -100)
    //   .text("");
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
      .style("font-size", "10px")
      .attr("transform", "rotate(-45)")
      .on("click", nnOnClickLevel);

    attribOverlay.exit().remove();
    levelOverlay.exit().remove();


    levelOverlayEnter
      .append("text")
        .attr("class", "numNodesLabel")
        .style("font-family", "sans-serif")
      .merge(levelOverlay.select(".numNodesLabel"))
        .attr("y", function (_, i) {
          return yScales[i].range()[1] + 15;
        })
        .attr("x", function (_, i) {
          return  levelScale(i);
        })
        .text(function (d) {
          return d.length;
        });

    levelOverlay.exit().remove();
  }

  // Links between nodes
  function drawLink(link) {
    var
      lastAttrib = xScale.domain()[xScale.domain().length-1],
      rightBorder = x(lastAttrib, data.length-1)+ xScale.bandwidth(),
      ys = yScales[data.length-1](link.source[id]),
      yt = yScales[data.length-1](link.target[id]),
      miny = Math.min(ys, yt),
      maxy = Math.max(ys, yt),
      midy = maxy-miny;
    context.moveTo(rightBorder, miny); //starting point
    context.quadraticCurveTo(
      rightBorder + midy/3, miny + midy/2, // mid point
      rightBorder, maxy // end point
      );
  }

  function drawLinks() {
    console.log("draw links ");
    if (!links.length) return;

    context.save();
    context.beginPath();

    context.strokeStyle = nn.linkColor;
    context.globalAlpha = 0.1;
    context.lineWidth = 0.5;
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
    data[level].forEach(function (item, i) {
      var locPrevLevel = {x: levelScale(level-1) + xScale.range()[1],
        y: yScales[level-1](item[id]) };
      var locLevel = {x: levelScale(level),
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
    context.fillText(data[level].length, levelScale(level), yScales[level].range()[1] + 15);
  }



  nn.initData = function (mData,  mColScales, mSortByAttr) {
    // getAttribs(mData[0][0]);
    colScales  = mColScales;
    colScales.keys().forEach(function (d) {
      dDimensions.set(d, true);
    });
    // nn.updateData(mData, mColScales, mSortByAttr);

  };

  function updateScales() {
    yScales=[];
    data.forEach(function (levelData, i) {
      yScales[i] = d3.scaleBand()
        .range([y0, h-nn.margin - 30])
        .paddingInner(0.0)
        .paddingOuter(0);
      yScales[i].domain(levelData.map(function (d) {
        return d[id];
      })
      );
    });

    // Update color scales domains

    // colScales = d3.map();
    dDimensions.keys().forEach(function (attrib) {
      var scale = colScales.get(attrib);
      scale.domain(d3.extent(data[0].map(function (d) { return d[attrib]; }))); //TODO: make it compute it based on the local range
      colScales.set(attrib, scale);
    });

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

  }

  nn.updateData = function (mData, mColScales, mSortByAttr) {
    var ctxWidth;
    if (typeof mData !== typeof []) {
      console.error("NodeNavigator setData didn't receive an array");
      return;
    }
    if (!dSortBy.has(mData.length-1)) {
      dSortBy.set(mData.length-1, mSortByAttr);
    }
    colScales = mColScales;
    data = mData;
    context = canvas.getContext("2d");

    updateScales();
    ctxWidth = levelScale.range()[1] + nn.margin + x0;
    d3.select(canvas)
      .attr("width", ctxWidth)
      .attr("height", h)
      .style("width", ctxWidth)
      .style("height", h);
    canvas.style.width = ctxWidth+"px";
    canvas.style.height = h+"px";

    svg
      .attr("width", ctxWidth)
      .attr("height", h);
    nn.update();
  };



  nn.update = function(updateBrushes) {
    updateBrushes = updateBrushes||true;
    var w = levelScale.range()[1] + nn.margin + x0;
    context.clearRect(0,0,w+1,h+1);
    data.forEach(function (levelData, i) {
      levelData.forEach(function (d) {
        drawItem(d, i);
      });

      drawLevelBorder(i);
      drawLevelConnections(i);
      // drawDimensionTitles(i);




    });

    drawLinks();

    drawBrushes();

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
      var nodeSizeVar=100;
      nn.initData(
        data,
        colScales,
        nodeSizeVar
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


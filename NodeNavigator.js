/* global d3, NodeNavigator */


//eleId must be the ID of a context element where everything is going to be drawn
function NodeNavigator(eleId, x0, y0, h) {
  "use strict";
  var self = this,
    data, //Contains the original data attributes
    dDimensions = d3.map(),
    dSortBy = d3.map(), //contains which attribute to sort by on each column
    yScales,
    xScale,
    x,
    colScales = d3.map(),
    levelScale,
    canvas,
    context;

  self.margin = 10;
  self.attribWidth = 10;
  self.levelsSeparation = 40;
  self.divisionsColor = "white";
  self.levelConnectionsColor = "rgba(205, 220, 163, 0.5)";
  self.divisionsThreshold = 3;
  self.id = "id";
  self.startColor = "white";
  self.endColor = "red";
  self.legendFont = "14px Arial";

  d3.select("#"+eleId)
    // .attr("width", 150)
    // .attr("height", h)
    .attr("class", "NodeNavigator");


  xScale = d3.scaleBand()
    // .rangeBands([0, self.attribWidth], 0.1, 0);
    .range([0, self.attribWidth])
    .round(true)
    .paddingInner(0.1)
    .paddingOuter(0);
  levelScale = d3.scaleBand()
    .round(true);
  colScales = d3.map();

  x = function (val, level) {
    return levelScale(level) + xScale(val);
  };

  canvas = d3.select("#"+eleId).select("canvas").node();
  // canvas.style.position = "absolute";
  canvas.style.top = canvas.offsetTop + "px";
  canvas.style.left = canvas.offsetLeft + "px";
  // canvas.style.width =  "150px";
  // canvas.style.height = h + "px";

  context = canvas.getContext("2d");
  // context.strokeStyle = "rgba(0,100,160,1)";
  // context.strokeStyle = "rgba(0,0,0,0.02)";


  function selfOnClickLevel(d) {
    console.log("click " + d);
    data[d.level] = data[d.level].sort(function (a, b) {
      return d3.ascending(a[d.attrib], b[d.attrib]);
    });
    dSortBy.set(d.level, d.attrib);
    self.updateData(data, colScales);
  }

  function getAttribs(obj) {
    var attr;
    dDimensions =d3.map();
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
      y = Math.round(yScales[level](item[self.id]) + yScales[level].bandwidth()/2);
      // y = yScales[level](item[self.id]) + yScales[level].bandwidth()/2;

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
      if (yScales[level].bandwidth() > self.divisionsThreshold) {
        y = Math.round(yScales[level](item[self.id]));
        // context.beginPath();
        context.moveTo(x(attrib, level), y);
        context.lineTo(x(attrib, level) + xScale.bandwidth(), y);
        context.lineWidth = 1;
        // context.lineWidth = 1;
        context.strokeStyle = self.divisionsColor;
        context.stroke();
      }

    }
  }

  function drawLevelBorder(i) {
    var attribHolder, tempData ;
    context.beginPath();
    context.rect(levelScale(i),
      yScales[i].range()[0],
      xScale.range()[1],
      yScales[i].range()[1]-100);
    context.strokeStyle = "black";
    context.lineWidth = 1;
    context.stroke();


    //Format the data to draw the phantom rects
    tempData = data.reduce(
      function (p, l, i) {
        return p.concat(xScale.domain().map(function (d) {
          return {attrib:d, level:i};
        }));
      },
      []
    );

    attribHolder = d3.select("#"+eleId)
      .select("svg")
      .selectAll(".attribPlaceHolder")
      .data(tempData);

    attribHolder.enter()
      .append("rect")
      .attr("class", "attribPlaceHolder" )
      .attr("fill", "white")
      .style("opacity", "0.1")
      .attr("x", function (d) { return x(d.attrib, d.level); })
      .attr("y", function (d) { return yScales[d.level].range()[0]; })
      .attr("width", function () { return xScale.bandwidth(); })
      .attr("height", function (d) { return yScales[d.level].range()[1] - yScales[d.level].range()[0]; })
      .on("click", selfOnClickLevel);

    attribHolder.exit().remove();

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
        y: yScales[level-1](item[self.id]) };
      var locLevel = {x: levelScale(level),
        y: yScales[level](item[self.id]) };

      var points = [ locPrevLevel,
        {x: locPrevLevel.x + self.levelsSeparation * 0.3, y: locPrevLevel.y},
        {x: locLevel.x - self.levelsSeparation * 0.3, y: locLevel.y},
        locLevel,
        {x: locLevel.x, y: locLevel.y + yScales[level].bandwidth()},
        {x: locLevel.x - self.levelsSeparation * 0.3, y: locLevel.y + yScales[level].bandwidth()},
        {x: locPrevLevel.x + self.levelsSeparation * 0.3, y: locPrevLevel.y + yScales[level - 1].bandwidth()},
        {x: locPrevLevel.x, y: locPrevLevel.y + yScales[level -1 ].bandwidth()},
        locPrevLevel

      ];
      drawLine(points, 1, self.levelConnectionsColor);
      drawLine(points, 1, self.levelConnectionsColor, true);
    });
  }


  function drawDimensionTitles(level) {
    dDimensions.keys().forEach(function (attrib) {
      // context.font = self.legendFont;
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

  self.initData = function (mData,  mColScales, mSortByAttr) {
    // getAttribs(mData[0][0]);
    colScales  = mColScales;
    colScales.keys().forEach(function (d) {
      dDimensions.set(d, true);
    });
    // self.updateData(mData, mColScales, mSortByAttr);

  };

  function updateScales() {
    yScales=[];
    data.forEach(function (levelData, i) {
      yScales[i] = d3.scaleBand()
        .range([y0, h-self.margin - 30])
        .paddingInner(0.0)
        .paddingOuter(0);
      yScales[i].domain(levelData.map(function (d) {
          return d[self.id];
        })
      );
    });

    // colScales = d3.map();
    // dDimensions.keys().forEach(function (attrib) {
    //     var scale = d3.scale.linear()
    //         .domain(d3.extent(data[0].map(function (d) { return d[attrib]; }))) //TODO: make it compute it based on the local range
    //         .range([self.startColor, self.endColor] );
    //     colScales.set(attrib, scale);
    // });

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
      .range([0, self.attribWidth * (dDimensions.keys().length)])
      .paddingInner(0.1)
      .paddingOuter(0);
    levelScale.domain(data.map(function (d,i) { return i; }))
      .range([x0+self.margin, ((xScale.range()[1] + self.levelsSeparation) * data.length) + x0])
      .paddingInner(0)
      .paddingOuter(0);

  }


  self.updateData = function (mData, mColScales, mSortByAttr) {
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
    ctxWidth = levelScale.range()[1] + self.margin + x0;
    d3.select(canvas)
      .attr("width", ctxWidth)
      .attr("height", h)
      .style("width", ctxWidth)
      .style("height", h);
    canvas.style.width = ctxWidth+"px";
    canvas.style.height = h+"px";

    d3.select("#"+eleId).select("svg")
      .attr("width", ctxWidth)
      .attr("height", h);
    self.update();
  };



  self.update = function() {
    var w = levelScale.range()[1] + self.margin + x0;
    context.clearRect(0,0,w+1,h+1);
    data.forEach(function (levelData, i) {
      levelData.forEach(function (d) {
        drawItem(d, i);
      });

      drawLevelBorder(i);
      drawLevelConnections(i);
      drawDimensionTitles(i);
    });

  };

  return self;
}


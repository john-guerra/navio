(function () {
  "use strict";
  /* global d3, forceInABox */
  var margin = {
    x: 0,
    y: 0
  };

  var canvas = d3.select("#graph").node(),
    context = canvas.getContext("2d"),
    width = canvas.width - margin.x,
    height = canvas.height - margin.y,
    selected = null;
  // var canvasText = d3.select("#nodesText").node(),
  //     contextText = canvasText.getContext("2d"),
  //     widthText = canvasText.width,
  //     heightText = canvasText.height;
  var size = d3.scaleLinear().range([2,5]);

  // d3.schemeCategory20 was dropped in d3 v5. Inlined here rather than swapped
  // for a 10-colour scheme so the clusters keep the colours this demo has
  // always had.
  var schemeCategory20 = [
    "#1f77b4", "#aec7e8", "#ff7f0e", "#ffbb78",
    "#2ca02c", "#98df8a", "#d62728", "#ff9896",
    "#9467bd", "#c5b0d5", "#8c564b", "#c49c94",
    "#e377c2", "#f7b6d2", "#7f7f7f", "#c7c7c7",
    "#bcbd22", "#dbdb8d", "#17becf", "#9edae5"
  ];
  var color = d3.scaleOrdinal(schemeCategory20);

  var simulation = d3.forceSimulation()
    .force("link", d3.forceLink())
    .force("charge", d3.forceManyBody().strength(-20))
    .force("x", d3.forceX(width/2).strength(0.15))
    .force("y", d3.forceY(height/2).strength(0.15));
    // .force("center", d3.forceCenter(width/2, height/2));

  // d3.json takes a callback in v4 and returns a promise from v5 on.
  d3.json("VotacionesSenado2017.json").then(onLoadJSON).catch(function (error) {
    throw error;
  });
  function onLoadJSON(graph) {
    // d3.map() went away with d3-collection in v6; a native Map is a drop-in
    // here except that values() returns an iterator rather than an array.
    var dicNodes = new Map();
    //mapping nodes
    graph.nodes.forEach(function (n) {
      n.commonVotes = 0;
      n.visible = true;
      n.id = n.name;
      dicNodes.set(n.id, n);
    });
    graph.links.forEach(function (e) {
      if (dicNodes.has(e.source)) {
        e.source = dicNodes.get(e.source);
      } else {
        e.source = {
          id:e.source,
          name:e.source,
          commonVotes:0,
          // cluster: -1,
          screen_name:e.target.name,
          count:e.count
        };
        dicNodes.set(e.source.id, e.source);
      }

      e.source.commonVotes+=1;

      if (dicNodes.has(e.target)) {
        e.target = dicNodes.get(e.target);
      } else {
        e.target = {
          id:e.target,
          name:e.target,
          commonVotes:0,
          // cluster: -1,
          screen_name:e.target.name,
          count:e.count
        };
        dicNodes.set(e.target.id, e.target);
      }
      e.target.commonVotes+=1;
    });
    var mincommonVotes = 2;
    var filteredLinks = graph.links;
    var filteredGraph = {
      nodes: Array.from(dicNodes.values()),
      links: filteredLinks
    };

    nv.links(filteredGraph.links);
    nv.data(filteredGraph.nodes);
    nv.updateCallback(function (nodes) {
      update({
        nodes:nodes,
        links:graph.links
      });
    });
    update(filteredGraph);
  };


  var nv = new navio(
    "#nn",
    height
  ).id("name");
  nv.addTextAttrib("name");
  nv.addSequentialAttrib("commonVotes");
  nv.addCategoricalAttrib("party");
  nv.addCategoricalAttrib("cluster", color);
  function update(graph) {
    simulation.stop();
    var dVisibleNodes = {};
    graph.nodes.map(function (n) {
      return dVisibleNodes[n.id] = true;
    });
    var visibleLinks = graph.links.filter(function (d) {
      return dVisibleNodes[d.source.id]&&
        dVisibleNodes[d.target.id];
    });

    var visible = nv.getVisible();
    console.log("nodes = " + graph.nodes.length + " links="+visibleLinks.length);
    size.domain(d3.extent(visible, function (d) { return d.commonVotes; }));
    graph.nodes.forEach(function (d) {
      d.r = size(d.commonVotes);
    });
    // d3.nest() was removed in v6. d3.groups returns [key, values] pairs;
    // reshaped to {key, values} so the drawing code below is untouched.
    var clusters = d3.groups(visible, function (d) { return d.cluster; })
      .map(function (g) { return { key: g[0], values: g[1] }; })
      .sort(function(a, b) { return b.values.length - a.values.length; });
    // var groupingForce = forceInABox()
    //       .links(graph.links)
    //       .template("force")
    //       .groupBy("cluster")
    //       .linkStrengthInterCluster(0.001)
    //       .linkStrengthIntraCluster(0.000001)
    //       .size([width, height]);
    simulation
        .force("charge", d3.forceManyBody().strength(visible.length<100? -200: -20))
        .nodes(visible)
        .on("tick", ticked);
    simulation.force("link")
              .links(visibleLinks);
    d3.select(canvas)
        .on("mousemove", onHover)
        .call(d3.drag()
            .container(canvas)
            .subject(dragsubject)
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));
    d3.select("#recluster")
      .on("click", function () {
        console.log("Clustering");
        netClustering.cluster(visible, visibleLinks);
        nv.update();
        console.log("done");
        update(graph);
      });
    simulation.alpha(0.7).restart();

    function ticked() {
      context.clearRect(0, 0, width, height);
      if (simulation.alpha() < 0.15) {
        context.save();
        context.globalAlpha= visibleLinks.length > 500 ? 0.03: 0.3;
        visibleLinks.forEach(drawLink);
        context.restore();
      }
      clusters.forEach(function(cluster) {
        context.beginPath();
        context.globalAlpha = 1;
        cluster.values.forEach(drawNode(visible.length > 100? 1: 2));
        context.fillStyle = color(cluster.key);
        context.fill();
        context.beginPath();
        context.fillStyle = "black";
        context.fill();
      });

      if (selected) {
        // eraseNodeText(selected)
        // contextText.beginPath();
        // contextText.fillStyle = "black";
        drawNodeText(selected);
        // contextText.fill();

      }
      context.restore();
    }

    // From d3 v6 the event is passed to the handler instead of living on the
    // global d3.event, which is what made every one of these read a property
    // off undefined.
    function dragsubject(event) {
      return simulation.find(event.x, event.y);
    }
  }

  function onHover(event) {
    var mouse = d3.pointer(event); // d3.mouse(this) before v6
    var d = simulation.find(mouse[0], mouse[1]);
    // eraseNodeText(selected)
    selected = d;
    drawNodeText(selected);
    simulation.alpha(0.3).restart();
  }
  // function eraseNodeText(d){
  //   if (d) {
  //     contextText.clearRect(0, 0, widthText, heightText);
  //   }
  // }

  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }

  function drawLink(d) {
    context.beginPath();
    // context.strokeStyle = "rgba(180,180,180,0.01)";
    context.strokeStyle = color(d.target.cluster);
    // context.globalAlpha=0.03;
    context.moveTo(d.source.x, d.source.y);
    context.lineTo(d.target.x, d.target.y);
    context.stroke();
  }


  function drawNode(rFactor) {
    return function (d) {
      context.moveTo(d.x + (d.r *rFactor)/2, d.y + (d.r *rFactor)/2);
      context.arc(d.x, d.y, (d.r *rFactor), 0, 2 * Math.PI);

    };
  }

  function drawNodeText(d) {
    context.beginPath();
    context.fillStyle = "black";
    context.moveTo(d.x + d.r/2, d.y + d.r/2 + 5);
    context.fillText(d.name, d.x, d.y);
    context.fill();

  }
})();

(function () {
  "use strict";
  /* global d3, forceInABox, NodeNavigator */

  var canvas = d3.select("#graph").node(),
    context = canvas.getContext("2d"),
    width = canvas.width,
    height = canvas.height,
    selected = null;
  var size = d3.scaleLinear().range([2,5]);

  var color = d3.scaleOrdinal(d3.schemeCategory20);

  var simulation = d3.forceSimulation()
      .force("link", d3.forceLink())
      .force("charge", d3.forceManyBody().strength(-20))
      .force("x", d3.forceX(width/2).strength(0.15))
      .force("y", d3.forceY(height/2).strength(0.15));
      // .force("center", d3.forceCenter(width/2, height/2));

  d3.json("VotacionesSenado2017.json", onLoadJSON);
  function onLoadJSON(error, graph) {
    var dicNodes = d3.map();
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
      nodes: dicNodes.values(),
      links: filteredLinks
    };

    if (error) throw error;

    nodeNavigator.links(filteredGraph.links);
    nodeNavigator.data(filteredGraph.nodes);
    nodeNavigator.updateCallback(function (nodes) {
      update({
        nodes:nodes,
        links:graph.links
      });
    });
    update(filteredGraph);
  };


  var nodeNavigator = new NodeNavigator(
    "#nn",
    height
  ).id("name");
  nodeNavigator.addSequentialAttrib("commonVotes");
  nodeNavigator.addCategoricalAttrib("party");
  nodeNavigator.addCategoricalAttrib("cluster", color);
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

    var visible = nodeNavigator.getVisible();
    console.log("nodes = " + graph.nodes.length + " links="+visibleLinks.length);
    size.domain(d3.extent(visible, function (d) { return d.commonVotes; }));
    graph.nodes.forEach(function (d) {
      d.r = size(d.commonVotes);
    });
    var clusters = d3.nest()
      .key(function(d) { return d.cluster; })
      .entries(visible)
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
        console.log("done");
        update(graph);
      });
    simulation.alpha(0.7).restart();
    function ticked() {
      context.clearRect(0, 0, width, height);
      if (simulation.alpha() < 0.15) {
        context.save();
        visibleLinks.forEach(drawLink);
        context.restore();
      }
      clusters.forEach(function(cluster) {
        context.beginPath();
        context.globalAlpha = 1;
        cluster.values.forEach(drawNode);
        context.fillStyle = color(cluster.key);
        context.fill();
        context.beginPath();
        context.fillStyle = "black";
        context.fill();
      });

      if (selected) {
        context.beginPath();
        context.fillStyle = "black";
        drawNodeText(selected);
        context.fill();

      }
      context.restore();
    }

    function dragsubject() {
      return simulation.find(d3.event.x, d3.event.y);
    }
  }

  function onHover() {
    var mouse = d3.mouse(this);
    var d = simulation.find(mouse[0], mouse[1]);
    selected = d;
    drawNodeText(selected);
    simulation.alpha(0.3).restart();
  }

  function dragstarted() {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d3.event.subject.fx = d3.event.subject.x;
    d3.event.subject.fy = d3.event.subject.y;
  }

  function dragged() {
    d3.event.subject.fx = d3.event.x;
    d3.event.subject.fy = d3.event.y;
  }

  function dragended() {
    if (!d3.event.active) simulation.alphaTarget(0);
    d3.event.subject.fx = null;
    d3.event.subject.fy = null;
  }

  function drawLink(d) {
    context.beginPath();
    // context.strokeStyle = "rgba(180,180,180,0.01)";
    context.strokeStyle = color(d.target.cluster);
    context.globalAlpha=0.1;
    context.moveTo(d.source.x, d.source.y);
    context.lineTo(d.target.x, d.target.y);
    context.stroke();
  }


  function drawNode(d) {
    context.moveTo(d.x + d.r/2, d.y + d.r/2);
    context.arc(d.x, d.y, d.r, 0, 2 * Math.PI);
  }

  function drawNodeText(d) {
    context.beginPath();
    context.fillStyle = "black";
    context.moveTo(d.x + d.r/2, d.y + d.r/2 + 5);
    context.fillText(d.name, d.x, d.y);
    context.fill();

  }
})();

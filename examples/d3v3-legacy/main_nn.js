/*jslint browser: true, indent: 4 */
/* global d3: false, Navio, $: false, alert: false, TreeMap: false , FlickrUtils: true, console: true, utils: true */


var url = "IEEE VIS papers 1990-2015 - Main dataset.csv";

var w = 800,
    h = 800;

var MIN_NODE_VAL = 200;
var MIN_EDGE_VAL = 5;

var network;
var type = "Citations";
var data;


d3.select("#checkboxGroup").on("change", reload);
d3.select("#selectType").on("change", reload);
d3.select("#sliderMinLink").on("change", reload)
	.on("input", function (d) {
		d3.select("#sliderLabelMinLink").html("Min link value: " + d3.select("#sliderMinLink").property("value"));
	});
d3.select("#sliderMinNode").on("change", reload)
	.on("input", function (d) {
		d3.select("#sliderLabelMinNode").html("Min node value (labels): " + d3.select("#sliderMinNode").property("value"));
	});


d3.select("#nn")
  .append("div")
    .style("float", "left")
    .attr("id", "Navio")
    .style("position", "relative");
d3.select("#nn")
  .select("#Navio")
  .append("canvas");
d3.select("#nn")
  .select("#Navio")
  .append("svg")
    .style("position", "absolute")
    .style("top", 0)
    .style("left", 0);


var svg = d3.select("#chart").append("svg:svg")
    .attr("width", w)
    .attr("height", h);

svg.append("svg:rect")
    .attr("width", w)
    .attr("height", h);


// Per-type markers, as they don't inherit styles.
svg.append("defs").selectAll("marker")
    .data(["cites"])
  .enter().append("marker")
    .attr("id", function(d) { return d; })
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 30)
    .attr("refY", -5)
    .attr("markerWidth", 4)
    .attr("markerHeight", 4)
    .attr("orient", "auto")
  .append("path")
    .attr("d", "M0,-5L10,0L0,5");

svg.append("svg:g").attr("id", "paths");
svg.append("svg:g").attr("id", "nodes");
svg.append("svg:g").attr("id", "texts");

var force  = d3.layout.forceInABox()
	    .size([w, h])
	    .treemapSize([w-300, h-300])
	    .enableGrouping(d3.select("#checkboxGroup").property("checked"))
	    .linkDistance(50)
	    .gravityOverall(0.001)
	    .linkStrengthInsideCluster(0.3)
	    .linkStrengthInterCluster(0.05)
	    .gravityToFoci(0.35)
	    .charge(-100);

var rScale = d3.scale.linear().range([2, 20]);
var yScale = d3.scale.linear().range([h-20, 20]);
var xScale = d3.scale.linear().domain(["a".charCodeAt(0), "z".charCodeAt(0)]).range([0, w]);
var colScale = d3.scale.category20();
var lOpacity = d3.scale.linear().range([0.1, 0.9]);

var nnSizeVar = 100;
var nav = new Navio(
  "Navio",
  0,
  nnSizeVar,
  h
);



function nodeName (d) {
	return d.name + " (" + d.value + ")";
}

function nodeNameCond (d) {
	return d.value > MIN_NODE_VAL ? nodeName(d): "";
}

function updateNavio(nodes) {
  var nodesCopy = [nodes.slice(0, nodes.length-1)];
  var fnAddVar = function (colScales, attr) {
    colScales.set(attr,
      d3.scale.linear()
        .domain(d3.extent(nodes, function (d) { return d[attr]; }))
        .range(["white", "red"])
    );
    return colScales;
  };

  var colScales = d3.map();
  colScales.set("visible",
      d3.scale.ordinal()
        .domain([0, 1, 2, 3, 4])
        .range(["white", "#b5cf6b", "#cddca3", "#8c6d31", "#bd9e39"])
    );
  fnAddVar(colScales, "numPapers");

  colScales.set("cluster", colScale);


  nav.id="name";

  nav.initData(
    nodesCopy,
    colScales,
    nnSizeVar
  );

  console.log("Navio nodes length" + nodes.length);
  nav.updateData(
    nodesCopy,
    colScales,
    nnSizeVar);
}

function update(nodes, links) {
	MIN_EDGE_VAL = d3.select("#sliderMinLink").property("value");
	// force = d3.layout.force()
	console.log("update nodes,links " + nodes.length + "," + links.length);
	var filteredNodes = nodes.filter(function (d) { return d.visible; });
	var filteredLinks = links.filter(function (d) { return d.value > MIN_EDGE_VAL;});
	console.log("filterednodes="+filteredNodes.length+" links "+filteredLinks.length);

	netClustering.cluster(filteredNodes, filteredLinks);
	console.log("clustered");

	d3.select("#downloadButton").on("click", function() {
		downloadData({nodes:filteredNodes, links:filteredLinks});
	});



	force.stop();
	force
	    .nodes(filteredNodes)
	    .links(filteredLinks)
	    .enableGrouping(d3.select("#checkboxGroup").property("checked"))
	    .on("tick", tick)
	    .start();



	rScale.domain([0, d3.max(filteredNodes, function (d) { return d.value; } )]);
	yScale.domain([0, d3.max(filteredNodes, function (d) { return d.value; } )]);
	lOpacity.domain(d3.extent(filteredLinks, function (d) { return d.value; } ));

	updateNavio(nodes);

	var path = svg.select("#paths").selectAll("path")
	    .data(force.links(), function (e) { return e.source.name + "|" + e.target.name; });
  	path.enter().append("svg:path")
	    .attr("class", function(d) { return "link "; })
	    .style("stroke-width", "2px")
	    .append("title")


	path.attr("marker-end", function(d) { return "url(#" + d.type + ")"; })
		.style("stroke-opacity", function(d) { return lOpacity(d.value); });

	path.select("title")
		.text(function (e) { return e.source.name + " to " + e.target.name + " (" + e.value + ")"; });

	path.exit().remove();


	var circle = svg.select("#nodes").selectAll("circle")
	    .data(force.nodes(), function (d) { return d.name; });
	circle.enter().append("svg:circle")
	    .attr("r", function (d) { return rScale(d.value); })
	    .call(force.drag)
	    .append("title")
	    .text(nodeName);
	circle.style("fill", function (d) { return colScale(d.cluster); })
		.select("title")
		.text(nodeName);
	circle.exit().remove();


	var text = svg.select("#texts").selectAll("g")
		.data(force.nodes(), function (d) { return d.name; });

	var textEnter = text
	  	.enter().append("svg:g");

	// A copy of the text with a thick white stroke for legibility.
	textEnter.append("svg:text")
	    .attr("x", 12)
	    .attr("y", ".31em")
	    .attr("class", "shadow");

	textEnter.append("svg:text")
	    .attr("x", 12)
	    .attr("y", ".31em")
	    .attr("class", "foreground");

	text.select(".shadow").text(nodeNameCond);
	text.select(".foreground").text(nodeNameCond);

	text.exit().remove();

	// Use elliptical arc path segments to doubly-encode directionality.
	function tick(e) {
	  force.onTick(e);

	  //Collision detection
		var q = d3.geom.quadtree(nodes),
		  k = e.alpha * 0.1,
		  i = 0,
		  n = nodes.length,
		  o;

		while (++i < n) {
			o = nodes[i];
			// if (o.fixed) continue;
			// c = nodes[o.type];
			// o.x += (c.x - o.x) * k;
			// o.x += (xScale(o.name.charCodeAt(0)) - o.x) * k;
			// o.y += (yScale(o.value) - o.y) * k;
			q.visit(collide(o));
		}

	  path.attr("d", function(d) {
	    var dx = d.target.x - d.source.x,
	        dy = d.target.y - d.source.y,
	        dr = Math.sqrt(dx * dx + dy * dy);
	    return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
	  });

	  circle.attr("transform", function(d) {
	    return "translate(" + d.x + "," + d.y + ")";
	  });

	  text.attr("transform", function(d) {
	    return "translate(" + d.x + "," + d.y + ")";
	  });
	}
}

function collide(node) {
  var r = rScale(node.value) + 16,
      nx1 = node.x - r,
      nx2 = node.x + r,
      ny1 = node.y - r,
      ny2 = node.y + r;
  return function(quad, x1, y1, x2, y2) {
    if (quad.point && (quad.point !== node)) {
      var x = node.x - quad.point.x,
          y = node.y - quad.point.y,
          l = Math.sqrt(x * x + y * y),
          r = rScale(node.value) + rScale(quad.point.value);
      if (l < r) {
        l = (l - r) / l * .5;
        node.px += x * l;
        node.py += y * l;
      }
    }
    return x1 > nx2
        || x2 < nx1
        || y1 > ny2
        || y2 < ny1;
  };
}

function reload() {

	MIN_EDGE_VAL = d3.select("#sliderMinLink").property("value");
	MIN_NODE_VAL = d3.select("#sliderMinNode").property("value");

	if (data === undefined) { return; }
	if (d3.select("#selectType").property("value")==="Coauthorship") {
		network = getCoauthorNetwork(data, MIN_EDGE_VAL);
		console.log(network);
	} else {
		network = getCitationNetwork(data, MIN_EDGE_VAL);
		console.log(network);
	}


	update(network.nodes, network.links);
}

d3.csv(url, function (error, mdata) {


	data = mdata;
	reload();

});

function downloadData(network) {
//Code from http://stackoverflow.com/questions/11849562/how-to-save-the-output-of-a-console-logobject-to-a-file

  if(!network) {
      console.error('Console.save: No network')
      return;
  }
	var netProcessed = {}
  netProcessed.links = network.links.map(function (d) {
  	return {
  		source:network.nodes.indexOf(d.source),
  		target:network.nodes.indexOf(d.target),
  		type:d.type,
  		value:d.value
  	}
  });
  netProcessed.nodes = network.nodes.map(function (d) {
  	var e = {};
  	var attr;
  	for (attr in d) {
  		if (attr === "node") continue;
  		e[attr.replace(new RegExp("[^A-Za-z0-9]", 'g'),"")]=d[attr];
  	}
  	e.node = {};
  	for (attr in d.node) {
  		e.node[attr.replace(new RegExp("[^A-Za-z0-9]", 'g'),"")]=d.node[attr];
  	}
  	return e;
  })

  //Remove spaces from keys



  var filename = 'network.json'

  if(typeof netProcessed === "object"){
      netProcessed = JSON.stringify(netProcessed, undefined, 4)
  }

  var blob = new Blob([netProcessed], {type: 'text/json'}),
      e    = document.createEvent('MouseEvents'),
      a    = document.createElement('a')

  a.download = filename
  a.href = window.URL.createObjectURL(blob)
  a.dataset.downloadurl =  ['text/json', a.download, a.href].join(':')
  e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
  a.dispatchEvent(e)

}
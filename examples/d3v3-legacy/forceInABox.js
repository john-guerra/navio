/* global d3 */
/* jslint browser: true, devel: true, indent: 4, multistr: true */


d3.layout.forceInABox = function () {
    "use strict";
    var force = d3.layout.force(),
        tree,
        foci = {},
        oldStart = force.start,
        linkStrengthInsideCluster = force.linkStrength(),
        oldGravity = force.gravity(),
        treeMapNodes = [],
        groupBy = "cluster",
        enableGrouping = true,
        gravityToFoci = 0.1,
        gravityOverall = 0.01,
        treemapSize,
        linkStrengthInterCluster = 0.05;


    // force.gravity = function(x) {
    //     if (!arguments.length) return oldGravity;
    //     oldGravity = +x;
    //     return force;
    // };

    force.groupBy = function (x) {
        if (!arguments.length) return groupBy;
        groupBy = x;
        return force;
    };

    var update = function () {
        if (enableGrouping) {
            force.gravity(gravityOverall);
        } else {
            force.gravity(oldGravity);
        }
    };

    force.enableGrouping = function (x) {
        if (!arguments.length) return enableGrouping;
        enableGrouping = x;
        update();
        return force;
    };

    force.gravityToFoci = function (x) {
        if (!arguments.length) return gravityToFoci;
        gravityToFoci = x;
        return force;
    };

    force.gravityOverall = function (x) {
        if (!arguments.length) return gravityOverall;
        gravityOverall = x;
        return force;
    };

    force.linkStrengthInterCluster = function (x) {
        if (!arguments.length) return linkStrengthInterCluster;
        linkStrengthInterCluster = x;
        return force;
    };

    force.linkStrengthInsideCluster = function (x) {
        if (!arguments.length) return linkStrengthInsideCluster;
        linkStrengthInsideCluster = x;
        return force;
    };

    force.treemapSize = function (x) {
        if (!arguments.length) return treemapSize !== undefined ? treemapSize : force.size();
        treemapSize = x;
        return force;
    };

    force.linkStrength(function (e) {
        if (!force.enableGrouping() || e.source[groupBy] === e.target[groupBy]) {
            if (typeof(linkStrengthInsideCluster)==="function") {
                return linkStrengthInsideCluster(e);
            } else {
                return linkStrengthInsideCluster;
            }
        } else {
            if (typeof(linkStrengthInterCluster)==="function") {
                return linkStrengthInterCluster(e);
            } else {
                return linkStrengthInterCluster;
            }
        }
    });



    function computeClustersCounts(nodes) {
        var clustersCounts = d3.map();

        nodes.forEach(function (d) {
            if (!clustersCounts.has(d[groupBy])) {
                clustersCounts.set(d[groupBy], 0);
            }
        });

        nodes.forEach(function (d) {
            // if (!d.show) { return; }
            clustersCounts.set(d[groupBy], clustersCounts.get(d[groupBy]) + 1);
        });

        return clustersCounts;
    }


    function getGroupsTree() {
        var children = [],
        totalSize = 0,
        clustersList,
        c, i, size, clustersCounts;

        clustersCounts=computeClustersCounts(force.nodes());

        //map.keys() is really slow, it's crucial to have it outside the loop
        clustersList = clustersCounts.keys();
        for (i = 0; i< clustersList.length ; i+=1) {
            c = clustersList[i];
            size = clustersCounts.get(c);
            children.push({id : c, size :size });
            totalSize += size;
        }
        return {id: "clustersTree", size: totalSize, children : children};
    }


    force.recompute = function () {
        var treemap = d3.layout.treemap()
            .size(force.treemapSize())
            .sort(function (p, q) { return d3.ascending(p.size, q.size); })
            .value(function (d) { return d.size; });

        tree = getGroupsTree();
        treeMapNodes = treemap.nodes(tree);

        var marginX = (force.size()[0] - force.treemapSize()[0]) /2;
        var marginY = (force.size()[1] - force.treemapSize()[1]) /2;

        //compute foci
        foci.none = {x : 0, y : 0};
        treeMapNodes.forEach(function (d) {
            foci[d.id] = {
                x : marginX + (d.x + d.dx / 2),
                y : marginY + (d.y + d.dy / 2)
            };
        });


        // Draw the treemap
        return force;
    };

    force.drawTreemap = function (container) {
        container.selectAll("rect.cell").remove();
        container.selectAll("rect.cell")
          .data(treeMapNodes)
          .enter().append("svg:rect")
            .attr("class", "cell")
            .attr("x", function (d) { return d.x; })
            .attr("y", function (d) { return d.y; })
            .attr("width", function (d) { return d.dx; })
            .attr("height", function (d) { return d.dy; });

        return force;
    };

    force.deleteTreemap = function (container) {
        container.selectAll("rect.cell").remove();

        return force;
    };


    force.onTick = function (e) {
        if (!enableGrouping) {
            return force;
        }
        var k;
        k = force.gravityToFoci() * e.alpha;
        force.nodes().forEach(function (o) {
            if (!foci.hasOwnProperty(o[groupBy])) { return; }
            o.y += (foci[o[groupBy]].y - o.y) * k;
            o.x += (foci[o[groupBy]].x - o.x) * k;
        });
        return force;
    };

    force.start = function () {
        update();
        oldStart();
        if (enableGrouping) {
            force.recompute();
        }

        return force;
    };

    return force;
};
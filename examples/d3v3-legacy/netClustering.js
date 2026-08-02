/*
        Copyright 2010 by Robin W. Spencer

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You can find a copy of the GNU General Public License
    at http://www.gnu.org/licenses/.

*/
/*jslint browser: true, devel: true, regexp: true, white: true */
/*
*/
"use strict";

var netClustering = {
    version: "0.1"
};

(function() {
    // "use strict";
    //  Specific utilities: data import & recursive traverses
    function binaryTreeWalk(currentNode,tree,depth,doLeafAction,doDownAction,doUpAction){
        //  General purpose recursive binary depth-first tree walk, with three possible action functions:
        //  at each leaf node, on the way down a branch, and on the way back up a branch.
        if(tree[currentNode].leftChild>-1){
            depth+=1;
            if(doDownAction) { doDownAction(currentNode,tree,depth); }
            binaryTreeWalk(tree[currentNode].leftChild,tree,depth,doLeafAction,doDownAction,doUpAction);
        }
        if(tree[currentNode].rightChild==-1){ // It"s a leaf node
            if(doLeafAction){ doLeafAction(currentNode,tree,depth); }
        }
        if(tree[currentNode].rightChild>-1){
            binaryTreeWalk(tree[currentNode].rightChild,tree,depth,doLeafAction,doDownAction,doUpAction);
            if(doUpAction){ doUpAction(currentNode,tree,depth); }
            depth-=1;
        }
    }

    //  Community detection algorithms and recursion
    function addClosestPairByCommunity(tree,deltaQ,a){
        //  Newman"s communities algorithm, http://arxiv.org/abs/cond-mat/0309508v1
        //  Find the largest deltaQ for each row, and overall

        //  Where Newman et al keep the H as max-heaps, we rebuild H from scratch for code clarity.
        //  Semi-sparse:  We still make H arrays for sorting but do it in one pass from the sparse deltaQ.

        // logTime("start step");

        var n=tree.length;
        var H={};
        for(var hash in deltaQ){
            var dQ=deltaQ[hash];
            var keys=hash.split("~");
            var i=Number(keys[0]);
            var j=Number(keys[1]);
            if (!H[i]) { H[i]=[]; }
            if (!H[j]) { H[j]=[]; }
            H[i].push({"dQ": dQ, "i": i, "j": j});
            H[j].push({"dQ": dQ, "i": i, "j": j});
        }

        // logTime("assign H");

        //  Find nodes to join
        var Hmax={"dQ":-Infinity, "i": -1, "j": -1};
        for(var i=0;i<n;i++){
            if (H[i]){
                H[i].sort(function (a,b) {
                    return b.dQ-a.dQ;
                    });  // Full sort, overkill but native & clean
                //  The [0] element in each H array now has the largest deltaQ for that row
                if(H[i][0].dQ>Hmax.dQ){
                    Hmax.dQ=H[i][0].dQ;
                    Hmax.i =H[i][0].i;
                    Hmax.j =H[i][0].j;
                }
            }
        }

        // logTime("find Hmax");
        //  Diagnostic info
        //  console("&nbsp;("+Hmax.i+","+Hmax.j+") -> "+n+"&nbsp; &nbsp; &Delta;Q = "+Hmax.dQ.toFixed(3));

        //  On full recursion, unweighted datasets can end up with degenerate small subsets, trapped here.
        if (Hmax.i==-1) {
            return null;
        }

        //  Create a combined node.  The tree[] is needed only for later drawing;
        //  all the work here is done with the deltaQ[].
        var wt=tree[Hmax.i].weight+tree[Hmax.j].weight;
        tree.push({"parent": -1, "leftChild": Hmax.i, "rightChild": Hmax.j, "weight": wt, "dQ": Hmax.dQ});
        tree[Hmax.i].parent=n;  // n = the new one we just created
        tree[Hmax.j].parent=n;

        //  Update all deltaQ, Clauset eq 10a-c
        var hashToZap=[];  //  Remember the deltaQ for the nodes we"re joining, to null out later.
        for(var k=0;k<n;k++){
            if(k!=Hmax.i && k!=Hmax.j && H[k]){  //  H[k]!=null => node still in play
                var hashik=Math.min(Hmax.i,k)+"~"+Math.max(Hmax.i,k);
                var hashjk=Math.min(Hmax.j,k)+"~"+Math.max(Hmax.j,k);
                var hashNew=k+"~"+n;
                var t1=deltaQ[hashik];
                var t2=deltaQ[hashjk];
                //  Javascript thinks zero and null are both false, so some type tricks are needed;
                //  zero is a valid entry for deltaQ and common for small graphs.
                if(!isNaN(t1)){
                    hashToZap.push(hashik);
                    if(!isNaN(t2)){
                        hashToZap.push(hashjk);
                        deltaQ[hashNew]=t1+t2;
                    }else{
                        deltaQ[hashNew]=t1-2.0*a[Hmax.j]*a[k];
                    }
                }else{
                    if(!isNaN(t2)){
                        hashToZap.push(hashjk);
                        deltaQ[hashNew]=t2-2.0*a[Hmax.i]*a[k];
                    }else{
                        deltaQ[hashNew]=null; // Important to zap dQ when t1 & t2 undefined
                    }
                }
            }
        }

        // logTime("update dQ");

        //  Update a[]
        a[n]=a[Hmax.i]+a[Hmax.j];
        //   a[Hmax.i]=0;a[Hmax.j]=0;  //   No need to zero-out; these a[] are not used again

        //  Experiments verify that sum a[i] = 1.00 at all stages of agglomeration.

        //  Remove any deltaQ for nodes now absorbed in this join.
        deltaQ[Hmax.i+"~"+Hmax.j]=null;
        for(var i=0;i<hashToZap.length;i++){
            deltaQ[hashToZap[i]]=null;
        }
        //  Make dQ array smaller by not copying over any dQ set to null above.
        var dQcopy={};
        var ndq=0;
        for(var hash in deltaQ){
            if (deltaQ[hash]) {
                dQcopy[hash]=deltaQ[hash];
                ndq++;
            }
        }

        // logTime("add a[], prune dQ");
        return {"value": Hmax.dQ, "array": dQcopy};
    }
    function buildTreeByCommunities(dataObj,showNotes){
        //  Implement the fast Newman method, as in Clauset, Newman, Moore, arXiv:cond-mat/0408187v2
        var n=dataObj.names.length;
        var k=[];
        for(var i=0;i<n;i++){
            k[i]=0;
        }
        var m=0;
        var W=0;
        if(dataObj.useWeights){
            for(var hash in dataObj.distances){
                var keys=hash.split("~");
                var i=Number(keys[0]);
                var j=Number(keys[1]);
                var d=dataObj.distances[hash];
                k[i]+=d;
                k[j]+=d;
                W+=d;
                m+=1;
            }
            if(!W){W=1e-7};     //  This avoids some errors with disconnected components
            var inv2m=1/(2*W);
        }else{
            for(var hash in dataObj.distances){
                var keys=hash.split("~");
                var i=Number(keys[0]);
                var j=Number(keys[1]);
                k[i]+=1;
                k[j]+=1;
                m+=1;
            }
            if(!m){m=1e-7};     //  This avoids some errors with disconnected components
            var inv2m=1/(2*m);
        }
        //  See Berry et al arXiv:0903.1072v2 eq 16; note the 2x difference between Clauset and Berry.
        var deltaQ={};
        for(var hash in dataObj.distances){
            var keys=hash.split("~");
            var i=Number(keys[0]);
            var j=Number(keys[1]);
            if(dataObj.useWeights){
                deltaQ[hash]=2.0*inv2m*dataObj.distances[hash] - 2.0*inv2m*inv2m*k[i]*k[j];
            }else{
                deltaQ[hash]=2.0*(inv2m-k[i]*k[j]*inv2m*inv2m);  // 2x assures identical Q for unweighted datasets
            }
        }
        var a=[];
        for(var i=0;i<n;i++){
            a[i]=inv2m*k[i];
        }
        // var s=0;for(var i=0;i<a.length;i++){s+=a[i]};alert(s);  //  always 1.00 but good to check

        //  Initialize the binary tree, used only for later display.
        var tree=[];
        for(var i=0;i<n;i++){
            tree.push({"parent": -1, "leftChild": -1 ,"rightChild": -1, "weight": 1, "linkage": a[i], "name": dataObj.names[i], "primaryKey": i});
        }

        // logTime("initialize k,a,dQ");
        //  Do the actual agglomerative joining
        var Q=0.0;
        var maxQ=-Infinity;
        var dQobj={"value": 0, "array": deltaQ};
        var numCommunities=1;

        while(dQobj && tree.length<(2*n-1)) {
            dQobj=addClosestPairByCommunity(tree,dQobj.array,a);
            if(dQobj) {
                Q+=dQobj.value;
                if(dQobj.value<0){numCommunities+=1};
                maxQ=Math.max(maxQ,Q);
            }else{
                //  We hit a small degenerate subset -- another stop to recursion
                return null;
            }
        }
        //  showTimes();  //   diagnostic for speed optimization

        //  Assign index = sequence of traverse for coloring
        var index = 0;
        var root=tree.length - 1;
        binaryTreeWalk(root, tree, 0, function (currentNode,tree,depth){
            tree[currentNode].index=index;
            index+=1;
        },null,null);

        if(showNotes){
            var notes=n+" nodes, "+m+" of "+(n*(n-1)/2)+" possible edges ("+Math.round(200*m/(n*(n-1)))+"%) ";
            notes+="with data, and "+numCommunities+" primary communities identified.";
            notes+="&nbsp; &nbsp; Q="+maxQ.toFixed(3);
            document.getElementById("notes").innerHTML=notes;
        }
        return {"tree": tree, "distances": dataObj.distances, "root": root, "names": dataObj.names, "useWeights": dataObj.useWeights};
    }
    function findSplits(treeObj){
        //   The treeObj has dQ info from the Newman joining, so we can
        //   identify communities based on when dQ went negative.
        var breakNext = true;
        var breakNodes = [];
        var g = -1;
        var group = [];
        var members = "";
        var tracker = 0;
        binaryTreeWalk(treeObj.root, treeObj.tree, 0, function (node,tree,depth) {
           if(breakNext) {
                g += 1;
                breakNodes.push(node);
                breakNext = false;
           }
           group[node] = g;
           members += treeObj.tree[node].name + ",";
        },
        function(node, tree, depth) {
           var thisNode = tree[node];
            if(thisNode.dQ < 0){
                breakNext = true;
                tracker = 0;
            }
            tracker += 1;
        },
        function(node, tree, depth) {
            var thisNode = tree[node];
            tracker -= 1;
            if (tracker == 1){
                breakNext = true;
                members += "~";
            }
        });

        // //Search for any nodes that aren"t in any group and put them in one
        // var createdGroupForLoners = false, lonersCount = 0;

        // treeObj.names.forEach(function (d, i) {
        //     if (!group.hasOwnProperty(i)) {
        //         if (members[members.length-1]!="~" && !createdGroupForLoners) {
        //             members+="~"
        //         }
        //         group[i] = g+1;
        //         createdGroupForLoners = true;
        //         members+=d + ",";
        //         lonersCount++;
        //     }
        // })
        // //If we created a new group for loners increase the group size
        // if (createdGroupForLoners) {
        //     g+=1;
        //     members+="~";
        //     console.log("netClustering lonersCount=" + lonersCount);
        // }

        var numGroups = g + 1;
        members = members.slice(0, -2);
        members = members.replace(/,~/g, "~");
        //  members has the names of nodes, comma separated within groups and "~" between groups
        return {"numGroups": numGroups, "group": group, "members": members, "breakNodes": breakNodes};
    }
    function findSubCommunities(treeObj,depth,prevGroup){
        if (!treeObj) {return}

        var tree = treeObj.tree;
        var root = treeObj.root;
        var names = treeObj.names;
        //  Identify the communities in the data
        var splitInfo = findSplits(treeObj);
        var numGroups = splitInfo.numGroups;
        var group = splitInfo.group;

        var t = splitInfo.members.split("~");  //  string to array
        var groups = [];
        for(var g = 0; g < t.length; g++) {
            groups.push((t[g]).split(","));
        }
        //  groups is now a set of nested arrays of names, what we return

        //  Split the original distance & name tables into separate dataObj for each group
        //  so we can repeat the analysis recursively.
        var dataObjList = [];
        for (var g = 0; g < numGroups; g++){
           dataObjList.push({"names":[],"distances":[],"useWeights":treeObj.useWeights});
        }
        var nameKeys=[];   //  New groups must have new hash codes, thus new index keys

        for(var i=0;i<names.length;i++){
            var name=names[i];
            dataObjList[group[i]].names.push(name);  //  Assign names to groups in one pass
            nameKeys[i]=dataObjList[group[i]].names.length-1;
        }

        for(var hash in treeObj.distances){
            var keys=hash.split("~");
            var i=Number(keys[0]);
            var j=Number(keys[1]);
            if(group[i]==group[j]){
                //   These two are in the same group so keep this distance value
                var newHash=nameKeys[i]+"~"+nameKeys[j];
                dataObjList[group[i]].distances[newHash]=treeObj.distances[hash]
            }
        }
        //   Now we have separate dataObj"s for each community.  Do the analysis on each.
        if(numGroups>1){
            for(var g=0;g<numGroups;g++){
                //  This is where CNM is called for the sub-community
                var innerTreeObj=buildTreeByCommunities(dataObjList[g]);
                if(innerTreeObj && innerTreeObj.tree){
                    var innerGroups=findSplits(innerTreeObj).numGroups;
                    //   Simplest stopping rule -- communities of one
                    if(innerGroups>1){
                        //  Recursion: find any sub-groups
                        var subgroups=findSubCommunities(innerTreeObj,depth+1,g);
                        //  Replace the current group with its set of subgroups, which builds a tree.
                        groups[g]=subgroups;
                    }
                }
            }
        }
        return groups;
    }



    //Exports
    netClustering.buildTreeByCommunities = buildTreeByCommunities;
    netClustering.findSubCommunities = findSubCommunities;
    //buildTreeByCommunities parameter should be
    //Object {names: Array[39], distances: Array[0], method: "newman", useWeights: true}


    //Receives nodes and edges on the d3 format clusters them, and return the clusters
    // the nodes should be a list of objects that at least contains an attribute id
    // and the edges should be a list of objects {source:index, target:index, count}
    netClustering.cluster = function (nodes, edges, clusterAttr, edgesCountAttr) {
        var dataObj = {},
            treeObj, groups = [], i;

        if (clusterAttr === undefined) {
            clusterAttr="cluster";
        }
        if (edgesCountAttr === undefined) {
            edgesCountAttr="value";
        }

        var linksForClustering  = [];
        //Do edges come with pointers to the nodes or just indexes?
        if (edges.length>0 && typeof(edges[0].source)==="object") {
            linksForClustering = edges.map(function (d) {
                var sourceId=nodes.indexOf(d.source),
                    targetId=nodes.indexOf(d.target);
                if (sourceId===-1 || targetId===-1) {
                    return null;
                } else {
                    return {
                        source: sourceId,
                        target: targetId,
                        count : d[edgesCountAttr]!==undefined ? d[edgesCountAttr] : 1
                    }

                }
            })
        } else {
            //copy the links to ensure they have counts

            edges.forEach(function (d) {
                linksForClustering.push({
                    source: d.source,
                    target: d.target,
                    count: d[edgesCountAttr]!==undefined ? d[edgesCountAttr] : 1
                });
            });


        }

        dataObj.method = "newman";
        dataObj.useWeights = true;
        dataObj.names = nodes.map(function (d, i) { return ""+i; });

        // dataObj.names = nodes;
        dataObj.distances = {};
        linksForClustering =  linksForClustering.filter(function (d) { return d.source !== d.target; }); //avoid loops
        linksForClustering.forEach(function (d) {
            var hash = Math.min(d.source, d.target) + "~" + Math.max(d.source, d.target); // hash always has left key < right key})
            dataObj.distances[hash] = +d.count;
        });

        dataObj = addDummyMetaNode(dataObj);

        treeObj=buildTreeByCommunities(dataObj, false);
        groups=findSubCommunities(treeObj,0,0);

        groups=removeDummyMetaNode(groups);
        i=0;
        groups.forEach(function (d, i) {
            function assignToCluster(ele, i) {
                if (ele instanceof Array) {
                    ele.forEach(function (e) {
                        assignToCluster(e, i);
                    });
                } else {
                    nodes[+ele][clusterAttr] = i.toString();
                }

            }
            assignToCluster(d, i);
        });

        return groups;
    };



    function addDummyMetaNode(dataObj) {
        //Add a dummy node linked to all the nodes to guarantee that the graph is connected
        dataObj.names.push("DUMMY");
        dataObj.names.forEach(function (d, i) {
            if (i===dataObj.names.length-1) {
                return;
            }
            var hash = i+"~"+ (dataObj.names.length-1);
            dataObj.distances[hash] = 0.1;
        });
        return dataObj;
    }

    function removeDummyMetaNode(groups) {
        var i, ele;
        for (i = 0; i < groups.length; i++) {
            ele = groups[i];
            if (ele instanceof Array) {
                ele = removeDummyMetaNode(ele);
                if (ele.length===0) {
                    //DUMMY was on an empty cluster, delete it
                    groups.splice(i, 1);
                }
                // groups[i];
            } else {
                if (ele === "DUMMY" || ele === "DUMM") {
                    groups.splice(i, 1);//Remove
                    break;
                }
            }
        }
        return groups;
    }

})();

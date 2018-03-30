/*global Reveal, d3 */

var revealVizScroll = (function(){
  var
    scrollables = {};

  function makeScrollable(name, scrollFn, initFn, stopFn) {
    console.log("makeScrollable");
    var slides = d3.select(".slides");
    var s = slides
      .selectAll(".scrollable-"+name)
      .data([{}]);

    // If the div doesn't exist create it;
    s = s.enter()
      .append("div")
      .attr("class", "scrollable scrollable-" + name)
      .merge(s);

    // Default initFn
    initFn = initFn || function () {
      console.log("Init" + name);
      s
        .append("svg")
        .attr("width", 400)
        .attr("height", 400)
        .append("text")
        .attr("x", 100)
        .attr("y", 200);
    };

    // Default scrollFn
    scrollFn = scrollFn || function (step) {
      console.log("Scroll" + step);
      s.select("text")
        .transition()
        .duration(1000)
        .text("Step=" + step);
    };
    stopFn = stopFn || function (a) {
      console.log("Stop" + a);
    };

    // Bind the this element
    initFn = initFn.bind(s.node());
    scrollFn = scrollFn.bind(s.node());
    stopFn = stopFn.bind(s.node());

    // Run the init code
    initFn();

    // Add the scrollable to the list
    scrollables[name] = {
      "scroll": scrollFn,
      "stop": stopFn
    };
  }


  Reveal.addEventListener( "slidechanged", function( event ) {
    var scrollable;

    if (d3.select(event.currentSlide).classed("scroll")) {
      if (d3.select(event.currentSlide).attr("step") && d3.select(event.currentSlide).attr("scrollable")) {
        scrollable = d3.select(event.currentSlide).attr("scrollable");
        console.log("Scrollable = " + scrollable + " step "+ d3.select(event.currentSlide).attr("step"));
        d3.select(".scrollable-"+scrollable).style("display", "block");
        d3.select(".reveal").classed("scrolling", true);
        scrollables[scrollable].scroll(d3.select(event.currentSlide).attr("step"));
      }
    } else {
      // Not scrolling

      // Stop all scrollables
      for (var s in scrollables) {
        scrollables[s].stop();
      }
      d3.selectAll(".scrollable").style("display", "none");
      d3.select(".reveal").classed("scrolling", false);
    }

  } );

  return {
    makeScrollable: makeScrollable,
  };
})();
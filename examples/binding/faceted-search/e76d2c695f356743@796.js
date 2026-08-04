import define1 from "./a2e58f97fd5e8d7c@756.js";

function _1(md){return(
md`# Navio

[Navio](https://github.com/john-guerra/navio) is a data exploration widget that you can easily include on your code, and that you can even use on an observable to explore some data. Each attribute is represented on a column, and each item as a row. You can:

* Hover for see the selected row and attribute
* Drag for selecting a range
* Click to select all the instances of the hovered value.
* Create nested queries by filtering the results

**Usage for observable**

~~~js
import {navio} from "@john-guerra/navio"

viewof selected = navio(data)
~~~

If you want to **load your own data** use the [navio-load notebook instead](https://observablehq.com/@john-guerra/navio-load)


## Changelog
* [@796](https://observablehq.com/@john-guerra/navio@796) Transforming into a reactive widget
* [@747](https://observablehq.com/@john-guerra/navio@747) Previous stable version
`
)}

function _2(md){return(
md`## Example
[IEEEVIS Publications 1990-2024](https://sites.google.com/site/vispubdata/home)`
)}

function _selected(navio,data){return(
navio(data, { attribWidth: 20, addAllAttribsIncludeObjects: true, addAllAttribsRecursionLevel: 0 })
)}

function _4(md){return(
md`Here is the selected data:`
)}

function _5(Table,selected){return(
Table(selected)
)}

function _navio(d3,html,navio_npm,ReactiveWidget){return(
async function navio(data, _options = {}) {
  const options = {
    height: 300, // Navio's height
    attribs: undefined, // array of attrib names to be used, leave as null for all of them

    x0: 0, //Where to start drawing navio in x
    y0: 100, //Where to start drawing navio in y, useful if your attrib names are too long
    maxNumDistictForCategorical: 10, // addAllAttribs uses this for deciding if an attribute is categorical (has less than     maxNumDistictForCategorical categories) or ordered
    maxNumDistictForOrdered: 90, // addAllAttribs uses this for deciding if an attribute is ordered (has less than     maxNumDistictForCategorical categories) or text. Use    maxNumDistictForOrdered : Infinity for never choosing Text

    howManyItemsShouldSearchForNotNull: 100, // How many rows should addAllAttribs search to decide guess an attribute type
    margin: 10, // Margin around navio

    levelsSeparation: 40, // Separation between the levels
    divisionsColor: "white", // Border color for the divisions
    levelConnectionsColor: "rgba(205, 220, 163, 0.5)", // Color for the conections between levels
    divisionsThreshold: 4, // What's the minimum row height needed to draw divisions
    fmtCounts: d3.format(",.0d"), // Format used to display the counts on the bottom
    legendFont: "14px sans-serif", // The font for the header
    nestedFilters: true, // Should navio use nested levels?

    showAttribTitles: true, // Show headers?
    attribWidth: 15, // Width of the columns
    attribRotation: -45, // Headers rotation
    attribFontSize: 13, // Headers font size
    attribFontSizeSelected: 32, // Headers font size when mouse over

    filterFontSize: 10, // Font size of the filters explanations on the bottom

    tooltipFontSize: 12, // Font size for the tooltip
    tooltipBgColor: "#b2ddf1", // Font color for tooltip background
    tooltipMargin: 50, // How much to separate the tooltip from the cursor
    tooltipArrowSize: 10, // How big is the arrow on the tooltip

    digitsForText: 2, // How many digits to use for text attributes

    addAllAttribsRecursionLevel: Infinity, // How many levels depth do we keep on adding nested attributes
    addAllAttribsIncludeObjects: true, // Should addAllAttribs include objects
    addAllAttribsIncludeArrays: true, // Should addAllAttribs include arrays

    nullColor: "#ffedfd", // Color for null values
    defaultColorInterpolator: d3.interpolateBlues,
    defaultColorInterpolatorDate: d3.interpolatePurples,
    defaultColorInterpolatorDiverging: d3.interpolateBrBG,
    defaultColorInterpolatorOrdered: d3.interpolateOranges,
    defaultColorInterpolatorText: d3.interpolateGreys,
    defaultColorRangeBoolean: ["#a1d76a", "#e9a3c9", "white"], //true false null
    defaultColorRangeSelected: ["white", "#b5cf6b"],
    defaultColorCategorical: d3.schemeCategory10,

    showSelectedAttrib: true, // Display the attribute that shows if a row is selected
    showSequenceIDAttrib: true, // Display the attribute with the sequence ID

    ..._options
  };

  let div = html`<div  style="display:block; overflow-x:scroll"></div>`;

  // Create the navio
  const nv = navio_npm(d3.select(div), options.height);

  for (let opt in options) {
    if (opt === "id") {
      nv.id(options[opt]);
    } else if (opt !== "attribs") {
      nv[opt] = options[opt];
    }
  }

  // Add the data
  nv.data(data);

  if (options.attribs) {
    nv.addAllAttribs(options.attribs);
  } else {
    nv.addAllAttribs();
  }

  const widget = ReactiveWidget(div, {
    value: data,
    showValue
  });

  function showValue() {    
    // TODO update navio selection
    // nv.data(data);
    // nv.addAllAttribs(options.attribs);
    // nv.hardUpdate();
  }

  nv.updateCallback(() => {
    widget.setValue(nv.getVisible());
    // div.value = nv.getVisible();
    // div.dispatchEvent(new Event("input", { bubbles: true }));
    // notify(div);
  });
  showValue();

  // widget.addEventListener("input", () => {
  //   showValue();
  // });

  // div.value = data;
  widget.nv = nv;
  return widget;
}
)}

function _7(md){return(
md`
## How to implement Navio outside observable?
To create a navio you just need to import d3 (and d3-scale-chromatic if you are using version 4), then create a navio on the selection where you want it to draw, define the attributes and finally setup a update callback. See below for the code running this notebook

\`\`\`javascript
// Create a navio instance
const nv = navio(d3.select(div), height);  
// Add the data
nv.data(data);
// Add all attribs
nv.addAllAttribs();
// Set the initial visible elements, and setup a callback for when selecting new items
let visible = nv.getVisible();
// Setup a callback
nv.updateCallback(() => visible = nv.getVisible());
\`\`\`

`
)}

function _8(md){return(
md`## The data

The data comes from the wonderful [vispubdata](http://vispubdata.org) initiative, thanks Petra et al. If you want to try Navio with your own data just fork this Notebook`
)}

function _data(FileAttachment){return(
FileAttachment("IEEE VIS papers 1990-2024 - Main dataset.csv").csv({
  typed: true
})
)}

function _11(md){return(
md`## Widget synchronization

Ideally we want to make a navio fully synchronized with other reactive widgets`
)}

function _12(Inputs,data,$0){return(
Inputs.bind(Inputs.table(data), $0)
)}

function _13(md){return(
md`---
## Imports
`
)}

function _d3(require){return(
require("d3@7")
)}

async function _navio_npm(require)
{
  // return directly from npm
  // return require("navio@0.0.75")
  try {
    const navio =
      await require(`http://localhost:8080/dist/navio.js?${Date.now()}`);
    console.log("Loading navio from localhost");
    return navio;
  } catch {
    return require("navio@0.0.75");
  }
}


function _ReactiveWidget(require){return(
require("reactive-widget-helper")
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  function toString() { return this.url; }
  const fileAttachments = new Map([
    ["IEEE VIS papers 1990-2024 - Main dataset.csv", {url: new URL("./files/fe4ab6ce22f3b9542774447895e62013ca6b95cfbb03273d97e5d724bf9ae7f13ffcab0037eb3463b853eb72e2a465070d1254fdf1aa0abc112a055421f91e94.csv", import.meta.url), mimeType: "text/csv", toString}]
  ]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer()).define(["md"], _1);
  main.variable(observer()).define(["md"], _2);
  main.variable(observer("viewof selected")).define("viewof selected", ["navio","data"], _selected);
  main.variable(observer("selected")).define("selected", ["Generators", "viewof selected"], (G, _) => G.input(_));
  main.variable(observer()).define(["md"], _4);
  main.variable(observer()).define(["Table","selected"], _5);
  main.variable(observer("navio")).define("navio", ["d3","html","navio_npm","ReactiveWidget"], _navio);
  main.variable(observer()).define(["md"], _7);
  main.variable(observer()).define(["md"], _8);
  main.variable(observer("data")).define("data", ["FileAttachment"], _data);
  main.variable(observer()).define(["md"], _11);
  main.variable(observer()).define(["Inputs","data","viewof selected"], _12);
  main.variable(observer()).define(["md"], _13);
  main.variable(observer("d3")).define("d3", ["require"], _d3);
  main.variable(observer("navio_npm")).define("navio_npm", ["require"], _navio_npm);
  const child1 = runtime.module(define1);
  main.import("Table", child1);
  main.variable(observer("ReactiveWidget")).define("ReactiveWidget", ["require"], _ReactiveWidget);
  return main;
}

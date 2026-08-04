import define1 from "./600f1f80e771a771@509.js";
import define2 from "./9ac406907b45efa2@569.js";
import define3 from "./66e14fffe29297e2@201.js";
import define4 from "./b2bbebd2f186ed03@1816.js";
import define5 from "./1371b3b2446a73b4@335.js";

function _1(md){return(
md`# Faceted Search

A Faceted Search like filter widget that allows the user to filter the data. Uses a basic JS Filtering, but if you want you can pass your own \`\`\`filterData(data, filters)\`\`\` function to use a different backend. \`filters\` will be an array of objects with the following structure:

\`\`\`js
{
  attr: "attribute_name", // Attribute name
  ele: HTMLElement, // The HTML element used for the attribute filter widget
  type: "categorical", // ["categorical", "range"]
  selected: Array, // Attribute values selected
  allOptions: Array // All Attribute values available for categorical or the extent for ranges
}
\`\`\`

## Usage

\`\`\`js
import {FacetedSearch} from "@john-guerra/faceted-search"
\`\`\``
)}

function _selected(FacetedSearch,data,filterDataJS){return(
FacetedSearch(data, {
  // attribs: ["date_of_birth","nationality"], // leave blank for using all attributes
  filterData: filterDataJS
})
)}

function _3(selected){return(
selected.filters
)}

function _4(selected){return(
selected
)}

function _data(dataInput,olympians){return(
dataInput({value: olympians, format: "csv"})
)}

function _6(data){return(
data[0].date_of_birth
)}

function _d(){return(
new Date()
)}

function _8(d){return(
d.toLocaleString()
)}

function _attr(){return(
"year"
)}

function _extent(d3,data,attr){return(
d3.extent(data, (d) => +new Date(d[attr]))
)}

function _11(interval,extent,attr){return(
interval(extent, {
  label: attr,
  format: ([s, e]) => {
    console.log(s, e, typeof s);
    return `${new Date(s).toLocaleString()} ... ${new Date(e).toLocaleString()}`;
  }
})
)}

function _FacetedSearch(filterDataJS,html,debug,Event,addSearchCheckboxes,addRange){return(
function FacetedSearch(data, { attribs, filterData = filterDataJS } = {}) {
  if (!data || data.length < 0) {
    throw Error("Please provide an array of objects");
  }

  const filtersContainer = html`<div id="filters"></div>`;
  const target = html`
    ${filtersContainer}
  `;
  const filters = new Map();
  // the selected elements
  target.value = data;
  target.value.filters = filters;

  function redraw() {
    filtersContainer.innerHTML = "";
    filtersContainer.appendChild(
      html`<div >Selected ${target?.value.length} of ${data.length}
    ${Array.from(filters.values()).map(({ attr, ele }) => {
      return html`
      <div>${ele}</div>
    `;
    })}
  </div>`
    );
  }

  async function updateAndRedraw() {
    let before;
    if (debug) {
      before = performance.now();
    }

    const focused = document.activeElement;
    // Filter the data
    target.value = await filterData(data, filters);

    debug && console.log(`Finished filtering ${performance.now() - before}`);
    target.value.filters = filters;
    // Trigger an update
    target.dispatchEvent(new Event("input", { bubbles: true }));

    redraw();

    // Trying to return the focus
    console.log("Trying to return the focus to", focused, document.activeElement);
    focused.focus && focused.focus()
  }

  attribs = attribs || Object.keys(data[0]);

  for (let attr of attribs) {
    // Assumes NaN => categorical
    if (isNaN(data[0][attr])) {
      // if (possibleValues.length < 20) {
      addSearchCheckboxes({
        attr,
        filters,
        data,
        updateAndRedraw,
        target
      });
      // We need a better filter for many values
      // }
      // else {
      //   addMultiAutoSelect({
      //     attr,
      //     filters,
      //     data,
      //     updateAndRedraw,
      //     target,
      //     possibleValues
      //   });
      // }
    } else {
      // *** Quantitative or date
      addRange({ attr, filters, data, updateAndRedraw, target });
    }
  }

  redraw();

  return target;
}
)}

function _addSearchCheckboxes(d3,conditionalShow,searchCheckbox){return(
function addSearchCheckboxes({ attr, filters, data, updateAndRedraw, target }) {
  const groupCounts = d3.group(data, (d) => d[attr]),
    possibleValues = Array.from(groupCounts.keys());
  const ele = conditionalShow(
    searchCheckbox(possibleValues, {
      value: possibleValues,
      label: attr,
      height: 200,
      format: attr => `${attr} (${groupCounts.get(attr).length})`
    }),
    { label: attr }
  );

  ele.addEventListener("input", (evt) => {
    evt.stopPropagation();
    
    // Update the filter
    const filter = filters.get(attr);
    filter.selected = ele.value;
    filters.set(attr, filter);

    updateAndRedraw();
  });

  filters.set(attr, {
    attr,
    ele,
    type: "categorical",
    selected: possibleValues,
    allOptions: possibleValues
  });
}
)}

function _addMultiAutoSelect(d3,conditionalShow,multiAutoSelect){return(
function addMultiAutoSelect({
  attr,
  filters,
  data,
  updateAndRedraw,
  target
}) {
  const possibleValues = Array.from(d3.group(data, (d) => d[attr]).keys());
  const ele = conditionalShow(
    multiAutoSelect( {options: possibleValues,  label: attr }),
    { label: attr, value: possibleValues }
  );
  ele.addEventListener("input", (evt) => {
    evt.stopPropagation();
    
    // Update the filter
    const filter = filters.get(attr);
    filter.selected = ele.value;
    filters.set(attr, filter);

    updateAndRedraw();
  });

  filters.set(attr, {
    attr,
    ele,
    type: "categorical",
    selected: possibleValues,
    allOptions: possibleValues
  });
}
)}

function _15(){return(
Number("1.2") === 1.2
)}

function _16(d3){return(
d3.format(",d")(31234234)
)}

function _addRange(html,d3,conditionalShow,interval){return(
function addRange({
  attr,
  filters,
  data,
  updateAndRedraw,
  target,
  format,
  step
} = {}) {
  if (data[0][attr] instanceof Date) {
    const fmt = (d) => new Date(d).toLocaleString();
    format = format || (([s, e]) => html`${fmt(s)} ...<br> ${fmt(e)}`);
    step = 1;
  } else if (+data[0][attr] % 1 === 0) {
    // Integer
    const fmt = d3.format(",d");
    format = format || (([s, e]) => `${fmt(s)} ... ${fmt(e)}`);
    step = 1;
  } else {
    // float
    const fmt = d3.format(",.2f");
    format = format || (([s, e]) => `${fmt(s)} ... ${fmt(e)}`);
    step = 0.01;
  }
  const extent = d3.extent(data, (d) => +d[attr]);

  const ele = conditionalShow(
    interval(extent, {
      label: attr,
      format,
      step
    }),
    {
      label: attr
    }
  );
  ele.addEventListener("input", (evt) => {
    evt.stopPropagation();

    // Update the filter
    const filter = filters.get(attr);
    filter.selected = ele.value;
    filters.set(attr, filter);

    updateAndRedraw();
  });

  filters.set(attr, {
    attr,
    ele,
    type: "range",
    selected: extent,
    allOptions: extent
  });
}
)}

function _filterDataJS(){return(
async function filterDataJS(data, filters) {
  let res = data;

  for (let filter of filters.values()) {
    if (filter.type === "categorical") {
      res = res.filter((d) => filter.selected.includes(d[filter.attr]));
    } else if (filter.type === "range") {
      res = res.filter(
        (d) =>
          d[filter.attr] >= filter.selected[0] &&
          d[filter.attr] <= filter.selected[1]
      );
    }
  }

  return res;
}
)}

function _19(interval){return(
interval()
)}

function _debug(){return(
false
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("viewof selected")).define("viewof selected", ["FacetedSearch","data","filterDataJS"], _selected);
  main.variable(observer("selected")).define("selected", ["Generators", "viewof selected"], (G, _) => G.input(_));
  main.variable(observer()).define(["selected"], _3);
  main.variable(observer()).define(["selected"], _4);
  main.variable(observer("viewof data")).define("viewof data", ["dataInput","olympians"], _data);
  main.variable(observer("data")).define("data", ["Generators", "viewof data"], (G, _) => G.input(_));
  main.variable(observer()).define(["data"], _6);
  main.variable(observer("d")).define("d", _d);
  main.variable(observer()).define(["d"], _8);
  main.variable(observer("attr")).define("attr", _attr);
  main.variable(observer("extent")).define("extent", ["d3","data","attr"], _extent);
  main.variable(observer()).define(["interval","extent","attr"], _11);
  main.variable(observer("FacetedSearch")).define("FacetedSearch", ["filterDataJS","html","debug","Event","addSearchCheckboxes","addRange"], _FacetedSearch);
  main.variable(observer("addSearchCheckboxes")).define("addSearchCheckboxes", ["d3","conditionalShow","searchCheckbox"], _addSearchCheckboxes);
  main.variable(observer("addMultiAutoSelect")).define("addMultiAutoSelect", ["d3","conditionalShow","multiAutoSelect"], _addMultiAutoSelect);
  main.variable(observer()).define(_15);
  main.variable(observer()).define(["d3"], _16);
  main.variable(observer("addRange")).define("addRange", ["html","d3","conditionalShow","interval"], _addRange);
  main.variable(observer("filterDataJS")).define("filterDataJS", _filterDataJS);
  main.variable(observer()).define(["interval"], _19);
  main.variable(observer("debug")).define("debug", _debug);
  const child1 = runtime.module(define1);
  main.import("searchCheckbox", child1);
  const child2 = runtime.module(define2);
  main.import("multiAutoSelect", child2);
  const child3 = runtime.module(define3);
  main.import("conditionalShow", child3);
  const child4 = runtime.module(define4);
  main.import("interval", child4);
  const child5 = runtime.module(define5);
  main.import("dataInput", child5);
  return main;
}

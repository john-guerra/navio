function _1(md){return(
md`# Search Checkbox 🔎☑

An useful input control for when you want the user to be able to select quickly from a long list of elements. Supports:

* Select elements individually
* Search for specific elements
* Select/Deselect all the currently filtered elements

## Changelog

* @507 Nov 18, 2024 Bugfix when using max-height and format
* @459 Jan 30, 2023 Adding a height parameter
* @433 Jan 30, 2023 Reorganizing all/none buttons and add count of selected elements
* @357 Oct 12, 2022 Bugfix multiple input events were triggered

## Usage:

~~~js
import {searchCheckbox} from "@john-guerra/search-checkbox"
~~~

It tries to follow these best practices for [Observable Inputs](https://observablehq.com/@tophtucker/custom-input-example), and it is built by simply combining a [Search and Checkbox Observable inputs](https://observablehq.com/@observablehq/inputs). The second parameter is an option object that will be passed to these two components.

Compared it with my old [multiAutoSelect](https://observablehq.com/@john-guerra/multi-auto-select), the searchCheckbox shows all the options, and contains enable all/none.

## Example:

Showing the attributes in the [Kaggle Fifa dataset](https://www.kaggle.com/stefanoleone992/fifa-21-complete-player-dataset)`
)}

function _selected(searchCheckbox,data){return(
searchCheckbox(
  data, // What elements to chose from
  {// Any other options you pass here will be passed to the checkbox and search inputs
    value: data, // Start with everything selected
    label: "Variables",
    height: 200,
    // You can also pass specific options for the search and the checkboxes
    // optionsSearch: {
    // filter: fullSearchFilter
    // }
  }
)
)}

function _3(selected){return(
selected
)}

function _data(){return(
["ID","Name","Age","Photo","Nationality","Flag","Overall","Potential","Club","Club Logo","Value","Wage","Special","Preferred Foot","International Reputation","Weak Foot","Skill Moves","Work Rate","Body Type","Real Face","Position","Jersey Number","Joined","Loaned From","Contract Valid Until","Height","Weight","LS","ST","RS","LW","LF","CF","RF","RW","LAM","CAM","RAM","LM","LCM","CM","RCM","RM","LWB","LDM","CDM","RDM","RWB","LB","LCB","CB","RCB","RB","Crossing","Finishing","HeadingAccuracy","ShortPassing","Volleys","Dribbling","Curve","FKAccuracy","LongPassing","BallControl","Acceleration","SprintSpeed","Agility","Reactions","Balance","ShotPower","Jumping","Stamina","Strength","LongShots","Aggression","Interceptions","Positioning","Vision","Penalties","Composure","Marking","StandingTackle","SlidingTackle","GKDiving","GKHandling","GKKicking","GKPositioning","GKReflexes","Release Clause"]
)}

function _5(md){return(
md`## Binding to another input (WIP)`
)}

function _6(Inputs,data,$0){return(
Inputs.bind(Inputs.checkbox(data), $0 )
)}

function _useVanillaJS(md){return(
md`## Use it in vanilla JS

Technically you can use it outside of observable in vanilla JS. 

~~~html
<div id="myTarget"></div>
<label>You selected: <output id="myOutput"/></label>

<script type="module">
  import {Runtime} from "https://cdn.jsdelivr.net/npm/@observablehq/runtime@4/dist/runtime.js";
  import define from "https://api.observablehq.com/@john-guerra/search-checkbox.js?v=3";
  
  const searchCheckbox = await (new Runtime().module(define)).value("searchCheckbox");
  
  const myCheckboxes = searchCheckbox([1,2,3,4]);  
  
  document.querySelector("#myTarget").append(myCheckboxes);
  
  myCheckboxes.addEventListener("input", () => {
    document.querySelector("#myOutput").value=myCheckboxes.value
    
  })
</script>
~~~

Here a [codepen example](https://codepen.io/duto_guerra/pen/gOWMxmM)
`
)}

function _8(md){return(
md`## Code`
)}

function _searchCheckbox(fullSearchFilter,Inputs,html,htl,Event){return(
function searchCheckbox(
  data, // An array of possible selectable options
  options
) {
  options = {
    value: [],
    optionsCheckboxes: undefined, // use this if you want to pass specific options to the checkboxes or the search,
    format: (d) => d,
    optionsSearch: {
      format: () => "",
      filter: fullSearchFilter // searches in the whole word
    },
    height: 300,
    debug: false,
    ...options,    
  };

  // To remove the label from the options for the checkboxes
  function cloneIgnoring(obj, attrToIgnore) {
    const { [attrToIgnore]: _, ...rest } = obj;
    return rest;
  }

  
  let debug = options.debug;
  data = Array.from(data);
  // options.value = options.value === undefined ? [] : options.value;
  let checkboxes = Inputs.checkbox(
    data,
    options.optionsCheckboxes || cloneIgnoring(options, "label")
  );
  const search = Inputs.search(data, options.optionsSearch || options);
  const btnAll = html`<button>All</button>`;
  const btnNone = html`<button>None</button>`;

  let selected = new Map(Array.from(options.value).map((d) => [d, true]));

  function countSelected() {
    return Array.from(selected.entries()).filter(([k, v]) => v).length;
  }

  function changeSome(sel, changeTo) {
    for (let o of sel) selected.set(o, changeTo);
  }

  function selectedFromArray(sel) {
    changeSome(data, false);
    changeSome(sel, true);
  }

  function selectedToArray() {
    return Array.from(selected.entries())
      .filter(([k, v]) => v)
      .map(([k, v]) => k);
  }

  // HTML
  let output = htl.html`<output style="font-size: 80%; font-style: italics">(${countSelected()} of ${
    data.length
  } selected)</output>`;
  const component = htl.html`${
    options.label ? htl.html`<label>${options.label}</label>` : ""
  } 

  ${output}  
  
  <div style="display:flex">
    ${search} 
    <div style="margin: 0 5px"> ${btnAll}  </div>
    <div> ${btnNone} </div>
  </div>
  
  <div style="max-height: ${
    options.height
  }px; overflow: auto">${checkboxes}</div>`;

  // Update the display whenever the value changes
  Object.defineProperty(component, "value", {
    get() {
      return selectedToArray();
    },
    set(v) {
      selectedFromArray(v);
    }
  });

  function updateValueFromSelected() {
    checkboxes.value = selectedToArray();
    if (debug) console.log("searchCheckboxes", checkboxes.value);
    output.innerHTML = `(${countSelected()} of ${data.length} selected)`;
    component.dispatchEvent(new Event("input", { bubbles: true }));

    // inocuous change to recompute layout. Necesary when the format funtion sets max-height for example
    component.style.zIndex = 1;
  }

  btnAll.addEventListener("click", () => {
    changeSome(search.value, true);
    updateValueFromSelected();
  });
  btnNone.addEventListener("click", () => {
    changeSome(search.value, false);
    updateValueFromSelected();
  });

  component.value = selectedToArray();

  search.addEventListener("input", (evt) => {
    // Hide all the checkboxes that aren't in the searchbox result
    for (let check of checkboxes.querySelectorAll("input")) {
      if (search.value.includes(data[+check.value])) {
        check.parentElement.style.display = "inline-flex";
      } else {
        check.parentElement.style.display = "none";
      }
    }
    // We don't really need to update when value when searching
    // component.dispatchEvent(new Event("input", { bubbles: true }));
  });

  checkboxes.addEventListener("input", (evt) => {
    // avoids duplicated events
    evt.stopPropagation();

    selectedFromArray(checkboxes.value);
    updateValueFromSelected();
  });

  return component;
}
)}

function _10(md){return(
md`## Extra

This passes a different searchFilter that checks for occurrences in the whole text, not just the beginning. I sent a [PR for this](https://github.com/observablehq/inputs/pull/226)`
)}

function _termFilter(escapeRegExp){return(
function termFilter(term) {
  return new RegExp(`(?:^.*|[^\\p{L}-])${escapeRegExp(term)}`, "iu");
}
)}

function _escapeRegExp(){return(
function escapeRegExp(text) {
  return text.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}
)}

function _fullSearchFilter(termFilter,valuesof){return(
function fullSearchFilter(query) {
  const filters = `${query}`
    .split(/\s+/g)
    .filter((t) => t)
    .map(termFilter);
  return (d) => {
    if (d == null) return false;
    if (typeof d === "object") {
      out: for (const filter of filters) {
        for (const value of valuesof(d)) {
          if (filter.test(value)) {
            continue out;
          }
        }
        return false;
      }
    } else {
      for (const filter of filters) {
        if (!filter.test(d)) {
          return false;
        }
      }
    }
    return true;
  };
}
)}

function _valuesof(){return(
function* valuesof(d) {
  for (const key in d) {
    yield d[key];
  }
}
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("viewof selected")).define("viewof selected", ["searchCheckbox","data"], _selected);
  main.variable(observer("selected")).define("selected", ["Generators", "viewof selected"], (G, _) => G.input(_));
  main.variable(observer()).define(["selected"], _3);
  main.variable(observer("data")).define("data", _data);
  main.variable(observer()).define(["md"], _5);
  main.variable(observer()).define(["Inputs","data","viewof selected"], _6);
  main.variable(observer("useVanillaJS")).define("useVanillaJS", ["md"], _useVanillaJS);
  main.variable(observer()).define(["md"], _8);
  main.variable(observer("searchCheckbox")).define("searchCheckbox", ["fullSearchFilter","Inputs","html","htl","Event"], _searchCheckbox);
  main.variable(observer()).define(["md"], _10);
  main.variable(observer("termFilter")).define("termFilter", ["escapeRegExp"], _termFilter);
  main.variable(observer("escapeRegExp")).define("escapeRegExp", _escapeRegExp);
  main.variable(observer("fullSearchFilter")).define("fullSearchFilter", ["termFilter","valuesof"], _fullSearchFilter);
  main.variable(observer("valuesof")).define("valuesof", _valuesof);
  return main;
}

import define1 from "./e93997d5089d7165@2303.js";
import define2 from "./ded33661ef90d569@1130.js";

function _1(md){return(
md`# Multi Auto Select

A selector of multiple items with an autocomplete search box. See also my [search-checkbox](https://observablehq.com/@john-guerra/search-checkbox)

~~~js
MultiAutoSelect = require("multi-auto-select")

viewof options = MultiAutoSelect(["a", "b", "c"], {
  label: "Select some options",
  value: ["a"],
});
~~~
`
)}

function _mas(multiAutoSelect,states){return(
multiAutoSelect({
  options: states,
  placeholder: "Select some US states . . .",
  value: ["California", "Washington", "Alabama"],
  label: "State"
})
)}

function _3(mas){return(
mas
)}

function _4(md){return(
md`
## Usage outside of observable

~~~html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>multiAutoSelect test</title>
  </head>
  <body>
    <div id="target"></div>

    <div id="status"></div>
    <script src="https://unpkg.com/multi-auto-select/dist/multiAutoSelect.js"></script>

    <script>
      // create your input, returns an html input element
      const myInput = MultiAutoSelect(["a", "b", "c"], {
        label: "Select some options",
        value: ["a"],
      });

      // Listen to input events
      const onInput = (e) => {
        console.log("onInput", myInput.value);
        document.getElementById("status").innerText = "Current Selection " + myInput.value.join(", ");
      };
      myInput.addEventListener("input", onInput);
      onInput();

      // Append your input element to the page
      document.getElementById("target").appendChild(myInput);

    </script>
  </body>
</html>
~~~

Thanks @kasiviswanath for these enhancements: 

- Added draggable feature to re-order the selected element

### Changelog
* @468 11/11/2024 Rewritten as a npm module. Removed postRender option
* @440 08/06/2024 Published as an NPM module
* @260 04/05/2024 Added support for multiAutoSelect(data, {options}) format
* @248 04/06/2023 Added Kasi's improvements


## Example:`
)}

function _a(Inputs,multiAutoSelect,states,$0){return(
Inputs.bind(multiAutoSelect({
  options: states,
  placeholder: "Select some US states . . .",
  value: ["California", "Washington", "Alabama"],
  label: "State"
}), $0 )
)}

function _states(usa){return(
usa.objects.states.geometries.map((d) => d.properties.name)
)}

function _7(md){return(
md`## Passing objects

You can also pass objects with an attached accessor using \`attr\``
)}

function _eg2(multiAutoSelect,objects){return(
multiAutoSelect({ options: objects, attr: (d) => d.name , debug:true})
)}

function _objects(){return(
[
  { id: 1, name: "John" },
  { id: 2, name: "Alexis" },
  { id: 3, name: "Guerra" },
  { id: 4, name: "Gomez" }
]
)}

function _10(eg2){return(
eg2
)}

function _11(md){return(
md`## Testing with numbers`
)}

function _12(multiAutoSelect,d3){return(
multiAutoSelect({ options: d3.range(20).slice(1, 20) })
)}

function _Sortable(require){return(
require("sortablejs")
)}

function _15(md){return(
md`## (WIP) With a persistent url`
)}

function _persisted(PersistInput,multiAutoSelect,states){return(
PersistInput("states", multiAutoSelect({
  options: states,
  placeholder: "Select some US states . . .",
  value: [],
  label: "State"
}))
)}

function _17(Inputs,states,$0){return(
Inputs.bind(Inputs.checkbox(states), $0)
)}

function _18(persisted){return(
persisted
)}

function _19(md){return(
md`## Loading the library`
)}

async function _MultiAutoSelect(require)
{
  try {
    console.log("Trying to load module local");
    return await require(`http://localhost:8080/dist/multiAutoSelect.js?${Date.now()}`);
  } catch (e) {
    console.log("Failed. Trying to load module from NPM");
    return await require("multi-auto-select@0.0.10");
  }
}


function _multiAutoSelect(MultiAutoSelect){return(
MultiAutoSelect
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("viewof mas")).define("viewof mas", ["multiAutoSelect","states"], _mas);
  main.variable(observer("mas")).define("mas", ["Generators", "viewof mas"], (G, _) => G.input(_));
  main.variable(observer()).define(["mas"], _3);
  main.variable(observer()).define(["md"], _4);
  main.variable(observer("viewof a")).define("viewof a", ["Inputs","multiAutoSelect","states","viewof mas"], _a);
  main.variable(observer("a")).define("a", ["Generators", "viewof a"], (G, _) => G.input(_));
  main.variable(observer("states")).define("states", ["usa"], _states);
  main.variable(observer()).define(["md"], _7);
  main.variable(observer("viewof eg2")).define("viewof eg2", ["multiAutoSelect","objects"], _eg2);
  main.variable(observer("eg2")).define("eg2", ["Generators", "viewof eg2"], (G, _) => G.input(_));
  main.variable(observer("objects")).define("objects", _objects);
  main.variable(observer()).define(["eg2"], _10);
  main.variable(observer()).define(["md"], _11);
  main.variable(observer()).define(["multiAutoSelect","d3"], _12);
  const child1 = runtime.module(define1);
  main.import("input", child1);
  main.import("usa", child1);
  main.variable(observer("Sortable")).define("Sortable", ["require"], _Sortable);
  main.variable(observer()).define(["md"], _15);
  main.variable(observer("viewof persisted")).define("viewof persisted", ["PersistInput","multiAutoSelect","states"], _persisted);
  main.variable(observer("persisted")).define("persisted", ["Generators", "viewof persisted"], (G, _) => G.input(_));
  main.variable(observer()).define(["Inputs","states","viewof persisted"], _17);
  main.variable(observer()).define(["persisted"], _18);
  main.variable(observer()).define(["md"], _19);
  main.variable(observer("MultiAutoSelect")).define("MultiAutoSelect", ["require"], _MultiAutoSelect);
  main.variable(observer("multiAutoSelect")).define("multiAutoSelect", ["MultiAutoSelect"], _multiAutoSelect);
  const child2 = runtime.module(define2);
  main.import("PersistInput", child2);
  return main;
}

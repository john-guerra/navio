import define1 from "./c2dae147641e012a@46.js";
import define2 from "./a2a7845a5e2a5aec@139.js";

function _1(md){return(
md`# localStorageView: Non-invasive local persistance`
)}

function _2(md){return(
md`Lets make it simple to add local storage to a UI control (e.g. [@observablehq/inputs](/@observablehq/inputs))


We exploit back-writability and input binding to avoid having to mess with existing UI control code.

_localStorageView(key)_ creates a read/write view of a [safe-local-storage](/@mbostock/safe-local-storage). Because it's a view it can be [_synchronized_](https://observablehq.com/@observablehq/synchronized-inputs) to any control we want to provide persistence for.

We avoid having to write any _setItem_/_getItem_ imperative wiring.

If you want all users to share a networked value, consider [shareview](https://observablehq.com/@tomlarkworthy/shareview).

This works with an view that follows [design guidelines for views](https://observablehq.com/@tomlarkworthy/ui-linter?collection=@tomlarkworthy/ui). A similar notebook for URL query fields is the [urlQueryFieldView](https://observablehq.com/@tomlarkworthy/url-query-field-view).

~~~js
    import {localStorageView} from '@tomlarkworthy/local-storage-view'
~~~

### Change log
- 2021-11-21: Added json option which is true uses JSON.stringify/parse
- 2021-10-09: Added defaultValue option
`
)}

function _3(md){return(
md`### Demo

So starting with an ordinary control:`
)}

function _example1(Inputs){return(
Inputs.range()
)}

function _5(md){return(
md`We will use the excellent  [@mbostock/safe-local-storage](/@mbostock/safe-local-storage) which very nicely abstracts over enhanced privacy controls with an in memory fallback.`
)}

function _7(md){return(
md`However, we don't want to have to mess around with our original control to add local persistence. Instead we create a writable [view](https://observablehq.com/@observablehq/introduction-to-views) of a local storage key`
)}

function _example1storage(localStorageView){return(
localStorageView("example1")
)}

function _localStorageView(DOM,htl,inspect,localStorage,Inputs){return(
(
  key,
  { bindTo = undefined, defaultValue = null, json = false } = {}
) => {
  const id = DOM.uid().id;
  const ui = htl.html`<div class="observablehq--inspect" style="display:flex">
    <code>localStorageView(<span class="observablehq--string">"${key}"</span>): </code><span id="${id}">${inspect(
    localStorage.getItem(key) || defaultValue
  )}</span>
  </div>`;
  const holder = ui.querySelector(`#${id}`);

  const view = Object.defineProperty(ui, "value", {
    get: () => {
      const val = json
        ? JSON.parse(localStorage.getItem(key))
        : localStorage.getItem(key);
      return val || defaultValue;
    },
    set: (value) => {
      value = json ? JSON.stringify(value) : value;
      holder.removeChild(holder.firstChild);
      holder.appendChild(inspect(localStorage.getItem(key) || defaultValue));
      localStorage.setItem(key, value);
    },
    enumerable: true
  });

  if (bindTo) {
    Inputs.bind(bindTo, view);
  }

  return view;
}
)}

function _10(localStorageView){return(
localStorageView.value
)}

function _11(md){return(
md`And we bind our original control to the key view`
)}

function _12(Inputs,$0,$1){return(
Inputs.bind($0, $1)
)}

function _13(md){return(
md`Tada! that control will now persist its state across page refreshes.`
)}

function _14(md){return(
md`### JSON support

Set *json* to true to *serde*.`
)}

function _jsonView(localStorageView){return(
localStorageView("json", {
  json: true
})
)}

function _16(jsonView){return(
jsonView
)}

function _17($0){return(
$0.value
)}

function _18(md){return(
md`### Writing`
)}

function _19($0,Event)
{
  $0.value = {
    rnd: Math.random()
  };
  $0.dispatchEvent(new Event("input", { bubbles: true }));
}


function _20(md){return(
md`### In two cells

It is quite likely we often just want to create the view and bind it to a ui control so just pass the viewof in as the _bindTo_ option in the 2nd argument
`
)}

function _example2(Inputs){return(
Inputs.textarea()
)}

function _22(localStorageView,$0){return(
localStorageView("example2", {
  bindTo: $0
})
)}

function _23(md){return(
md`### In a single cell!

You can even declare a UI control, wrap it with local storage and return in a single cell! (thanks @mbostock!)
`
)}

function _example3(Inputs,localStorageView){return(
Inputs.bind(Inputs.textarea(), localStorageView("example3"))
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer()).define(["md"], _1);
  main.variable(observer()).define(["md"], _2);
  main.variable(observer()).define(["md"], _3);
  main.variable(observer("viewof example1")).define("viewof example1", ["Inputs"], _example1);
  main.variable(observer("example1")).define("example1", ["Generators", "viewof example1"], (G, _) => G.input(_));
  main.variable(observer()).define(["md"], _5);
  const child1 = runtime.module(define1);
  main.import("localStorage", child1);
  main.variable(observer()).define(["md"], _7);
  main.variable(observer("viewof example1storage")).define("viewof example1storage", ["localStorageView"], _example1storage);
  main.variable(observer("example1storage")).define("example1storage", ["Generators", "viewof example1storage"], (G, _) => G.input(_));
  main.variable(observer("localStorageView")).define("localStorageView", ["DOM","htl","inspect","localStorage","Inputs"], _localStorageView);
  main.variable(observer()).define(["localStorageView"], _10);
  main.variable(observer()).define(["md"], _11);
  main.variable(observer()).define(["Inputs","viewof example1","viewof example1storage"], _12);
  main.variable(observer()).define(["md"], _13);
  main.variable(observer()).define(["md"], _14);
  main.variable(observer("viewof jsonView")).define("viewof jsonView", ["localStorageView"], _jsonView);
  main.variable(observer("jsonView")).define("jsonView", ["Generators", "viewof jsonView"], (G, _) => G.input(_));
  main.variable(observer()).define(["jsonView"], _16);
  main.variable(observer()).define(["viewof jsonView"], _17);
  main.variable(observer()).define(["md"], _18);
  main.variable(observer()).define(["viewof jsonView","Event"], _19);
  main.variable(observer()).define(["md"], _20);
  main.variable(observer("viewof example2")).define("viewof example2", ["Inputs"], _example2);
  main.variable(observer("example2")).define("example2", ["Generators", "viewof example2"], (G, _) => G.input(_));
  main.variable(observer()).define(["localStorageView","viewof example2"], _22);
  main.variable(observer()).define(["md"], _23);
  main.variable(observer("viewof example3")).define("viewof example3", ["Inputs","localStorageView"], _example3);
  main.variable(observer("example3")).define("example3", ["Generators", "viewof example3"], (G, _) => G.input(_));
  const child2 = runtime.module(define2);
  main.import("inspect", child2);
  return main;
}

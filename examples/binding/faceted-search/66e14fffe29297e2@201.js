import define1 from "./e76d2c695f356743@796.js";

function _1(md){return(
md`# Conditional Show

Wraps an element into a details tag, but returns the element. Useful to hide an Observable Input, but still make the cell be reactive

\`\`\`js
import {conditionalShow} from "@john-guerra/conditional-show"
\`\`\`

## Changelog

* Jan 30 2023 @196 -  Switch to using the details element tag
* Jan 19 2023 @110 -  Switch to toggle
* Nov 10 2022 @84 -  Uses Inputs.checkbox

## Example

Say for instance that you want to show a summary of your data with [Navio](https://navio.dev)`
)}

async function _selected(conditionalShow,navio,penguins,htl){return(
conditionalShow(await navio(penguins), {
  label: htl.html`<h3 style="display:inline">Show Navio</h3>`,
  checked: this ? this.checked : true, // keep previous value
  // checked: false,
  returns: (checked, navElem) => (checked ? navElem.value : navElem.value) // what do you want it to return
})
)}

function _3(md){return(
md`Here is the value returned`
)}

function _4(selected){return(
selected
)}

function _conditionalShow(htl,Event){return(
function conditionalShow(
  element,
  {
    label = "Show",
    checked = false,
    returns = (checked, element) => element?.value || element,
    // returns = (checked, element) => checked ? element?.value || element : null, // If you want it to return null when unchecked
    bindInput = true,
    showValueSummary = true
  } = {}
) {
  const show = htl.html`${label}`;

  const container = htl.html`<div>${element}<div>`;
  const valueSummary = htl.html`<output></output>`;

  const target = htl.html`<details ${checked ? { open: true } : {}} >
    <summary>${show} ${showValueSummary ? valueSummary : ""}</summary>
    ${container}
  </details>
  `;

  function showValueSummary() {
    if (target.value && target.value && Array.isArray(target.value)) {
      valueSummary.innerHTML = `(Returns ${target.value.length} elements)`;
    } else {
      valueSummary.innerHTML = ``;
    }
  }

  function set(evt) {
    if (evt) {
      evt.stopPropagation();
    }
    target.value = returns(target.open, element);
    target.checked = target.open;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    showValueSummary();
  }

  set();

  if (bindInput) {
    element.addEventListener("input", set);
  }

  return target;
}
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("viewof selected")).define("viewof selected", ["conditionalShow","navio","penguins","htl"], _selected);
  main.variable(observer("selected")).define("selected", ["Generators", "viewof selected"], (G, _) => G.input(_));
  main.variable(observer()).define(["md"], _3);
  main.variable(observer()).define(["selected"], _4);
  main.variable(observer("conditionalShow")).define("conditionalShow", ["htl","Event"], _conditionalShow);
  const child1 = runtime.module(define1);
  main.import("navio", child1);
  return main;
}

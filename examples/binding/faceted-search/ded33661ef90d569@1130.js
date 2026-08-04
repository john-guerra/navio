import define1 from "./048a17a165be198d@275.js";

function _1(md){return(
md`# Persist Input

PersistInput the value of your inputs using the URL hash. Warning, **it will break the hash**, so you won't be able to change the anchor of your page, and it doesn't work with inner links, but it is useful for sharing specific configurations

## Usage 

~~~js
    import {PersistInput} from '@john-guerra/persist-input'
~~~
then
~~~js
PersistInput("paramName", <YourInput>)
~~~

Thanks @tomlarkworthy @mootari @mfviz hellonearthis for the ideas and contributions

## Examples

Change the following inputs and see the changes in the url`
)}

function _name(PersistInput,Inputs){return(
PersistInput(
  "name",
  Inputs.text({ label: "name", value: "initial Value" })
)
)}

function _choice(PersistInput,Inputs){return(
PersistInput("choice", Inputs.select(["1", 2, "3", 4]))
)}

function _r(PersistInput,Inputs){return(
PersistInput("radius", Inputs.range())
)}

function _checks(PersistInput,Inputs){return(
PersistInput("checks", Inputs.checkbox(["two words", "{B, C}", "D"]))
)}

function _6(md){return(
md`## The code`
)}

function _PersistInput(URLSearchParams,location,html,Event){return(
(field, input) => {
  const getHashValue = () => {
    let hashValue = new URLSearchParams(location.hash.slice(1)).get(field);
    try {
      hashValue = JSON.parse(hashValue);
    } catch {}
    return hashValue ? hashValue : input.value;
  };

  const setHashValue = (val) => {
    const params = new URLSearchParams(location.hash.slice(1));
    params.set(field, JSON.stringify(val));
    html`<a href="#${params.toString()}">`.click();
  };

  const setInput = (val) => {
    input.value = val;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const onInputChange = () => {
    setHashValue(input.value);
  };

  input.addEventListener("input", onInputChange);

  setInput(getHashValue() || input.value);
  onInputChange();

  return input;
}
)}

function _copyURL(html,currentURL)
{
  const target = html`<button>Copy URL`;

  target.addEventListener("click", () =>
    navigator.clipboard.writeText(currentURL)
  );
  return target;
}


function _currentURL(Generators,addEventListener,invalidation,removeEventListener){return(
Generators.observe((notify) => {
  const hashchange = () => {
    notify(document.baseURI);
  };
  hashchange();
  addEventListener("hashchange", hashchange);
  invalidation.then(() => removeEventListener("hashchange", hashchange));
})
)}

function _lo(logTracker){return(
logTracker()
)}

function _logTracker(localStorageView,html,Event,currentURL,Inputs){return(
function logTracker({ title = "Log", storageName = "persist-input" } = {}) {
  let log = [];
  const lsv = localStorageView(storageName, { json: true });
  const inName = html`<input name="name">`;
  const btnSave = html`<button type="submit">Save`;
  const listLogs = html`<ul>`;
  const target = html`
    <h3>${title}</h3>
    ${listLogs}
    <form><label>Name: ${inName}<label>${btnSave}</form>
`;
  log = [];

  function set(val) {
    target.value = val;
    target.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function renderLogs() {
    listLogs.innerHTML = "";
    const logsElems = log.map((l) => {
      const btnRemove = html`<button>❌`;
      btnRemove.onclick = () => {
        log.splice(log.indexOf(l), 1);
        set(log);
      };
      return html`<li><a href=${l.url} target="_blank">${l.name}</a> ${btnRemove}</a></li>`;
    });
    listLogs.appendChild(html`${logsElems}`);
  }

  btnSave.onclick = (evt) => {
    evt.preventDefault();
    target.value.push({
      name: inName.value,
      url: currentURL,
      created_at: new Date()
    });
    inName.value = "";
    set(target.value);
  };

  // Update the display whenever the value changes
  Object.defineProperty(target, "value", {
    get() {
      return log;
    },
    set(v) {
      log = v || [];
      renderLogs();
    }
  });

  return Inputs.bind(target, lsv);
}
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("viewof name")).define("viewof name", ["PersistInput","Inputs"], _name);
  main.variable(observer("name")).define("name", ["Generators", "viewof name"], (G, _) => G.input(_));
  main.variable(observer("viewof choice")).define("viewof choice", ["PersistInput","Inputs"], _choice);
  main.variable(observer("choice")).define("choice", ["Generators", "viewof choice"], (G, _) => G.input(_));
  main.variable(observer("viewof r")).define("viewof r", ["PersistInput","Inputs"], _r);
  main.variable(observer("r")).define("r", ["Generators", "viewof r"], (G, _) => G.input(_));
  main.variable(observer("viewof checks")).define("viewof checks", ["PersistInput","Inputs"], _checks);
  main.variable(observer("checks")).define("checks", ["Generators", "viewof checks"], (G, _) => G.input(_));
  main.variable(observer()).define(["md"], _6);
  main.variable(observer("PersistInput")).define("PersistInput", ["URLSearchParams","location","html","Event"], _PersistInput);
  main.variable(observer("copyURL")).define("copyURL", ["html","currentURL"], _copyURL);
  main.variable(observer("currentURL")).define("currentURL", ["Generators","addEventListener","invalidation","removeEventListener"], _currentURL);
  main.variable(observer("viewof lo")).define("viewof lo", ["logTracker"], _lo);
  main.variable(observer("lo")).define("lo", ["Generators", "viewof lo"], (G, _) => G.input(_));
  main.variable(observer("logTracker")).define("logTracker", ["localStorageView","html","Event","currentURL","Inputs"], _logTracker);
  const child1 = runtime.module(define1);
  main.import("localStorageView", child1);
  return main;
}

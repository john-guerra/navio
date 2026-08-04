// https://observablehq.com/@mbostock/safe-local-storage@46
function _1(md){return(
md`# Safe Local Storage

If a reader has localStorage disabled, simply referencing it will throw an error and prevent any downstream cells from running. This can break your notebook!

If you import from this notebook instead, you’ll be able to use localStorage safely: if the reader has disabled local storage, you’ll get an in-memory storage instance that evaporates when the page is unloaded.

\`\`\`js
import {localStorage} from "@mbostock/safe-local-storage"
\`\`\`

Please note that this implementation does not support direct-setting of properties on localStorage; use the [Storage interface methods](https://html.spec.whatwg.org/multipage/webstorage.html#webstorage) instead.
`
)}

function _localStorage(MemoryStorage)
{
  try {
    const storage = window.localStorage;
    const key = "__storage_test__";
    storage.setItem(key, key);
    storage.removeItem(key);
    return storage;
  } catch (error) {
    return new MemoryStorage;
  }
}


function _MemoryStorage(){return(
class MemoryStorage {
  constructor() {
    Object.defineProperties(this, {_: {value: new Map}});
  }
  get length() {
    return this._.size;
  }
  key(index) {
    return Array.from(this._.keys())[index | 0];
  }
  getItem(key) {
    return this._.has(key += "") ? this._.get(key) : null;
  }
  setItem(key, value) {
    this._.set(key + "", value + "");
  }
  removeItem(key) {
    this._.delete(key + "");
  }
  clear() {
    this._.clear();
  }
}
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("localStorage")).define("localStorage", ["MemoryStorage"], _localStorage);
  main.variable(observer("MemoryStorage")).define("MemoryStorage", _MemoryStorage);
  return main;
}

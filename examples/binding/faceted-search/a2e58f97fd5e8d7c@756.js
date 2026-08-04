function _1(md){return(
md`# Introduction to inputs

These lightweight interface components — buttons, sliders, dropdowns, tables, and the like — help you explore data and build interactive displays. For a walkthrough of how you might use these to support data analysis, see [Hello, Inputs!](/@observablehq/hello-inputs)`
)}

function _usage(md){return(
md`---
## Usage

Declare your inputs with [viewof](/@observablehq/introduction-to-views), like so:`
)}

function _gain(Inputs){return(
Inputs.range([0, 11], {value: 5, step: 0.1, label: "Gain"})
)}

function _now(md){return(
md`Now you can reference the input’s value (here *gain*) in any cell, and the cell will run whenever the input changes. No event listeners required!`
)}

function _gain2(gain){return(
gain
)}

function _currentgain(gain,md){return(
md`The current gain is ${gain.toFixed(1)}!`
)}

function _7(md){return(
md`Observable Inputs are released under the [ISC license](https://github.com/observablehq/inputs/blob/main/LICENSE) and depend only on [Hypertext Literal](/@observablehq/htl), our tagged template literal for safely generating dynamic HTML. If you are interested in contributing or wish to report an issue, please see [our repository](https://github.com/observablehq/inputs). For recent changes, please see [our release notes](https://github.com/observablehq/inputs/releases).`
)}

function _basics(md){return(
md`---

## Basics

These basic inputs will get you started.

* [Button](/@observablehq/input-button) - do something when a button is clicked
* [Toggle](/@observablehq/input-toggle) - toggle between two values (on or off)
* [Checkbox](/@observablehq/input-checkbox) - choose any from a set
* [Radio](/@observablehq/input-radio) - choose one from a set
* [Range](/@observablehq/input-range) or [Number](/@observablehq/input-range) - choose a number in a range (slider)
* [Select](/@observablehq/input-select) - choose one or any from a set (drop-down menu)
* [Text](/@observablehq/input-text) - enter freeform single-line text
* [Textarea](/@observablehq/input-textarea) - enter freeform multi-line text
* [Date](/@observablehq/input-date) or [Datetime](/@observablehq/input-date) - choose a date
* [Color](/@observablehq/input-color) - choose a color
* [File](/@observablehq/input-file) - choose a local file`
)}

function _button(md){return(
md`---

### [Button](/@observablehq/input-button) 

Do something when a button is clicked. [Examples ›](/@observablehq/input-button) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#button)`
)}

function _clicks(Inputs){return(
Inputs.button("Click me")
)}

function _11(clicks){return(
clicks
)}

function _toggle(md){return(
md`---

### [Toggle](/@observablehq/input-toggle) 

Toggle between two values (on or off). [Examples ›](/@observablehq/input-toggle) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#toggle)`
)}

function _mute(Inputs){return(
Inputs.toggle({label: "Mute"})
)}

function _14(mute){return(
mute
)}

function _checkbox(md){return(
md`---

### [Checkbox](/@observablehq/input-checkbox) 

Choose any from a set. [Examples ›](/@observablehq/input-checkbox) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#checkbox)`
)}

function _flavors(Inputs){return(
Inputs.checkbox(["salty", "sweet", "bitter", "sour", "umami"], {label: "Flavors"})
)}

function _17(flavors){return(
flavors
)}

function _radio(md){return(
md`---

### [Radio](/@observablehq/input-radio)

Choose one from a set. [Examples ›](/@observablehq/input-radio) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#radio)`
)}

function _flavor(Inputs){return(
Inputs.radio(["salty", "sweet", "bitter", "sour", "umami"], {label: "Flavor"})
)}

function _20(flavor){return(
flavor
)}

function _range(md){return(
md`---

### [Range](/@observablehq/input-range)

Pick a number. [Examples ›](/@observablehq/input-range) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#range)`
)}

function _n(Inputs){return(
Inputs.range([0, 255], {step: 1, label: "Favorite number"})
)}

function _23(n){return(
n
)}

function _select(md){return(
md`---

### [Select](/@observablehq/input-select)

Choose one, or any, from a menu. [Examples ›](/@observablehq/input-select) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#select)`
)}

function _homeState(Inputs,stateNames){return(
Inputs.select([null].concat(stateNames), {label: "Home state"})
)}

function _26(homeState){return(
homeState
)}

function _visitedStates(Inputs,stateNames){return(
Inputs.select(stateNames, {label: "Visited states", multiple: true})
)}

function _28(visitedStates){return(
visitedStates
)}

function _29(md){return(
md`---

### [Text](/@observablehq/input-text)

Enter freeform single-line text. [Examples ›](/@observablehq/input-text) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#text)`
)}

function _name(Inputs){return(
Inputs.text({label: "Name", placeholder: "What’s your name?"})
)}

function _31(name){return(
name
)}

function _32(md){return(
md`---

### [Textarea](/@observablehq/input-textarea)

Enter freeform multi-line text. [Examples ›](/@observablehq/input-textarea) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#textarea)`
)}

function _bio(Inputs){return(
Inputs.textarea({label: "Biography", placeholder: "What’s your story?"})
)}

function _34(bio){return(
bio
)}

function _35(md){return(
md`---

### [Date](/@observablehq/input-date)

Choose a date, or a date and time. [Examples ›](/@observablehq/input-date) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#date)`
)}

function _birthday(Inputs){return(
Inputs.date({label: "Birthday"})
)}

function _37(birthday){return(
birthday
)}

function _38(md){return(
md`---

### [Color](/@observablehq/input-color)

Choose a color. [Examples ›](/@observablehq/input-color) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#color)`
)}

function _color(Inputs){return(
Inputs.color({label: "Favorite color", value: "#4682b4"})
)}

function _40(color){return(
color
)}

function _41(md){return(
md`---

### [File](/@observablehq/input-file)

Choose a local file. [Examples ›](/@observablehq/input-file) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#file)`
)}

function _file(Inputs){return(
Inputs.file({label: "CSV file", accept: ".csv", required: true})
)}

function _data(file){return(
file.csv({typed: true})
)}

function _tables(md){return(
md`---

## Tabular data

These fancy inputs are designed to work with tabular data such as CSV or TSV [file attachments](/@observablehq/file-attachments) and [database clients](/@observablehq/databases).

* [Search](/@observablehq/input-search) - query a tabular dataset
* [Table](/@observablehq/input-table) - browse a tabular dataset`
)}

function _45(md){return(
md`---

### [Search](/@observablehq/input-search)

Query a tabular dataset. [Examples ›](/@observablehq/input-search) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#search)`
)}

function _search(Inputs,capitals){return(
Inputs.search(capitals, {placeholder: "Search U.S. capitals"})
)}

function _47(search){return(
search
)}

function _48(md){return(
md`---

### [Table](/@observablehq/input-table)

Browse a tabular dataset. [Examples ›](/@observablehq/input-table) [API Reference ›](https://github.com/observablehq/inputs/blob/main/README.md#table)`
)}

function _rows(Inputs,search){return(
Inputs.table(search)
)}

function _50(rows){return(
rows
)}

function _techniques(md){return(
md`---

## And more!

Got the basics? Here are a few more advanced techniques:

* [Form](https://observablehq.com/@observablehq/input-form?collection=@observablehq/inputs) - combine multiple inputs for a compact display
* [Synchronized inputs](https://observablehq.com/@observablehq/synchronized-inputs?collection=@observablehq/inputs) - bind two or more inputs
* [Introduction to Views](/@observablehq/introduction-to-views) - more on Observable’s viewof`
)}

function _52(md){return(
md`We are grateful to Jeremy Ashkenas for blazing the trail with [“The Grand Native Inputs Bazaar”](/@jashkenas/inputs). To migrate from Jeremy’s inputs to our new official inputs, consider our [legacy inputs](/@observablehq/legacy-inputs).`
)}

function _53(md){return(
md`For even more, consider these “friends & family” inputs and techniques shared by the Observable community:`
)}

function _54(Inputs,html){return(
Inputs.table([
  [["2D Slider", "/d/98bbb19bf9e859ee"], "Fabian Iwand", "a two-dimensional range"],
  [["Binary Input", "/@rreusser/binary-input"], "Ricky Reusser", "bitwise IEEE floating point"],
  [["DIY inputs", "/@bartok32/diy-inputs"], "Bartosz Prusinowski", "inputs with fun, custom styles"],
  [["FineRange", "/@rreusser/fine-range"], "Ricky Reusser", "high-precision numeric control"],
  [["Form Input", "/@mbostock/form-input"], "Mike Bostock", "multiple inputs in single cell"],
  [["Inputs", "/@jashkenas/inputs"], "Jeremy Ashkenas", "the original"],
  [["Player", "/@oscar6echo/player"], "oscar6echo", "detailed timing control for animation"],
  [["Scrubber", "/@mbostock/scrubber"], "Mike Bostock", "play/pause/scrub control for animation"],
  [["Range Slider", "/@mootari/range-slider"], "Fabian Iwand", "a two-ended range"],
  [["Ternary Slider", "/@yurivish/ternary-slider"], "Yuri Vishnevsky", "a proportion of three values"],
  [["Data driven range sliders", "/@bumbeishvili/data-driven-range-sliders"], "David B.", "a range input with a histogram"],
  [["Snapping Histogram Slider", "/@trebor/snapping-histogram-slider"], "Robert Harris", "a range input with a histogram"],
  [["Inputs in grid", "/@bumbeishvili/input-groups"], "David B.", "combine multiple inputs into a compact grid"],
  [["List Input", "/@harrislapiroff/list-input"], "Harris L.", "enter more than one of something"],
  [["Copier", "/@mbostock/copier"], "Mike Bostock", "a button to copy to the clipboard"],
  [["Tangle", "/@mbostock/tangle"], "Mike Bostock", "Bret Victor-inspired inline scrubbable numbers"],
  [["Editor", "/@cmudig/editor"], "CMU Data Interaction Group", "code editor with syntax highlighting"],
  [["Color Scheme Picker", "/@zechasault/color-schemes-and-interpolators-picker"], "Zack Ciminera", "pick a D3 color scheme"],
  [["Easing Curve Editor", "/@nhogs/easing-graphs-editor"], "Nhogs", "create a custom easing curve"]
].map(([Name, Author, Description]) => ({Name, Author, Description})), {
  sort: "Name",
  rows: Infinity,
  layout: "auto",
  width: {
    "Description": "60%"
  },
  format: {
    Name: ([title, link]) => html`<a href=${link} target=_blank>${title}`
  }
})
)}

function _55(md){return(
md`To share your reusable input or technique, please leave a comment.`
)}

function _56(md){return(
md`---

## Appendix`
)}

function _capitals(FileAttachment){return(
FileAttachment("us-state-capitals.tsv").tsv({typed: true})
)}

function _stateNames(capitals){return(
capitals.map(d => d.State)
)}

function _59(md){return(
md`The cells below provide deprecated aliases for older versions of Inputs. Please use Inputs.button *etc.* instead of importing from this notebook.`
)}

function _Button(Inputs){return(
Inputs.button
)}

function _Toggle(Inputs){return(
Inputs.toggle
)}

function _Radio(Inputs){return(
Inputs.radio
)}

function _Checkbox(Inputs){return(
Inputs.checkbox
)}

function _Range(Inputs){return(
Inputs.range
)}

function _Select(Inputs){return(
Inputs.select
)}

function _Text(Inputs){return(
Inputs.text
)}

function _Textarea(Inputs){return(
Inputs.textarea
)}

function _Search(Inputs){return(
Inputs.search
)}

function _Table(Inputs){return(
Inputs.table
)}

function _Input(Inputs){return(
Inputs.input
)}

function _bind(Inputs){return(
Inputs.bind
)}

function _disposal(Inputs){return(
Inputs.disposal
)}

function _svg(htl){return(
htl.svg
)}

function _html(htl){return(
htl.html
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  function toString() { return this.url; }
  const fileAttachments = new Map([
    ["us-state-capitals.tsv", {url: new URL("./files/eee4d2a928a36026dab4281b76deb7fe0cd885f1c6df6e546efb79db7e5fa5ccc98a395f865d31c1db3344ff1734683764bb1a63871fb1b39f77bb810f49699c.tsv", import.meta.url), mimeType: "text/tab-separated-values", toString}]
  ]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("usage")).define("usage", ["md"], _usage);
  main.variable(observer("viewof gain")).define("viewof gain", ["Inputs"], _gain);
  main.variable(observer("gain")).define("gain", ["Generators", "viewof gain"], (G, _) => G.input(_));
  main.variable(observer("now")).define("now", ["md"], _now);
  main.variable(observer("gain2")).define("gain2", ["gain"], _gain2);
  main.variable(observer("currentgain")).define("currentgain", ["gain","md"], _currentgain);
  main.variable(observer()).define(["md"], _7);
  main.variable(observer("basics")).define("basics", ["md"], _basics);
  main.variable(observer("button")).define("button", ["md"], _button);
  main.variable(observer("viewof clicks")).define("viewof clicks", ["Inputs"], _clicks);
  main.variable(observer("clicks")).define("clicks", ["Generators", "viewof clicks"], (G, _) => G.input(_));
  main.variable(observer()).define(["clicks"], _11);
  main.variable(observer("toggle")).define("toggle", ["md"], _toggle);
  main.variable(observer("viewof mute")).define("viewof mute", ["Inputs"], _mute);
  main.variable(observer("mute")).define("mute", ["Generators", "viewof mute"], (G, _) => G.input(_));
  main.variable(observer()).define(["mute"], _14);
  main.variable(observer("checkbox")).define("checkbox", ["md"], _checkbox);
  main.variable(observer("viewof flavors")).define("viewof flavors", ["Inputs"], _flavors);
  main.variable(observer("flavors")).define("flavors", ["Generators", "viewof flavors"], (G, _) => G.input(_));
  main.variable(observer()).define(["flavors"], _17);
  main.variable(observer("radio")).define("radio", ["md"], _radio);
  main.variable(observer("viewof flavor")).define("viewof flavor", ["Inputs"], _flavor);
  main.variable(observer("flavor")).define("flavor", ["Generators", "viewof flavor"], (G, _) => G.input(_));
  main.variable(observer()).define(["flavor"], _20);
  main.variable(observer("range")).define("range", ["md"], _range);
  main.variable(observer("viewof n")).define("viewof n", ["Inputs"], _n);
  main.variable(observer("n")).define("n", ["Generators", "viewof n"], (G, _) => G.input(_));
  main.variable(observer()).define(["n"], _23);
  main.variable(observer("select")).define("select", ["md"], _select);
  main.variable(observer("viewof homeState")).define("viewof homeState", ["Inputs","stateNames"], _homeState);
  main.variable(observer("homeState")).define("homeState", ["Generators", "viewof homeState"], (G, _) => G.input(_));
  main.variable(observer()).define(["homeState"], _26);
  main.variable(observer("viewof visitedStates")).define("viewof visitedStates", ["Inputs","stateNames"], _visitedStates);
  main.variable(observer("visitedStates")).define("visitedStates", ["Generators", "viewof visitedStates"], (G, _) => G.input(_));
  main.variable(observer()).define(["visitedStates"], _28);
  main.variable(observer()).define(["md"], _29);
  main.variable(observer("viewof name")).define("viewof name", ["Inputs"], _name);
  main.variable(observer("name")).define("name", ["Generators", "viewof name"], (G, _) => G.input(_));
  main.variable(observer()).define(["name"], _31);
  main.variable(observer()).define(["md"], _32);
  main.variable(observer("viewof bio")).define("viewof bio", ["Inputs"], _bio);
  main.variable(observer("bio")).define("bio", ["Generators", "viewof bio"], (G, _) => G.input(_));
  main.variable(observer()).define(["bio"], _34);
  main.variable(observer()).define(["md"], _35);
  main.variable(observer("viewof birthday")).define("viewof birthday", ["Inputs"], _birthday);
  main.variable(observer("birthday")).define("birthday", ["Generators", "viewof birthday"], (G, _) => G.input(_));
  main.variable(observer()).define(["birthday"], _37);
  main.variable(observer()).define(["md"], _38);
  main.variable(observer("viewof color")).define("viewof color", ["Inputs"], _color);
  main.variable(observer("color")).define("color", ["Generators", "viewof color"], (G, _) => G.input(_));
  main.variable(observer()).define(["color"], _40);
  main.variable(observer()).define(["md"], _41);
  main.variable(observer("viewof file")).define("viewof file", ["Inputs"], _file);
  main.variable(observer("file")).define("file", ["Generators", "viewof file"], (G, _) => G.input(_));
  main.variable(observer("data")).define("data", ["file"], _data);
  main.variable(observer("tables")).define("tables", ["md"], _tables);
  main.variable(observer()).define(["md"], _45);
  main.variable(observer("viewof search")).define("viewof search", ["Inputs","capitals"], _search);
  main.variable(observer("search")).define("search", ["Generators", "viewof search"], (G, _) => G.input(_));
  main.variable(observer()).define(["search"], _47);
  main.variable(observer()).define(["md"], _48);
  main.variable(observer("viewof rows")).define("viewof rows", ["Inputs","search"], _rows);
  main.variable(observer("rows")).define("rows", ["Generators", "viewof rows"], (G, _) => G.input(_));
  main.variable(observer()).define(["rows"], _50);
  main.variable(observer("techniques")).define("techniques", ["md"], _techniques);
  main.variable(observer()).define(["md"], _52);
  main.variable(observer()).define(["md"], _53);
  main.variable(observer()).define(["Inputs","html"], _54);
  main.variable(observer()).define(["md"], _55);
  main.variable(observer()).define(["md"], _56);
  main.variable(observer("capitals")).define("capitals", ["FileAttachment"], _capitals);
  main.variable(observer("stateNames")).define("stateNames", ["capitals"], _stateNames);
  main.variable(observer()).define(["md"], _59);
  main.variable(observer("Button")).define("Button", ["Inputs"], _Button);
  main.variable(observer("Toggle")).define("Toggle", ["Inputs"], _Toggle);
  main.variable(observer("Radio")).define("Radio", ["Inputs"], _Radio);
  main.variable(observer("Checkbox")).define("Checkbox", ["Inputs"], _Checkbox);
  main.variable(observer("Range")).define("Range", ["Inputs"], _Range);
  main.variable(observer("Select")).define("Select", ["Inputs"], _Select);
  main.variable(observer("Text")).define("Text", ["Inputs"], _Text);
  main.variable(observer("Textarea")).define("Textarea", ["Inputs"], _Textarea);
  main.variable(observer("Search")).define("Search", ["Inputs"], _Search);
  main.variable(observer("Table")).define("Table", ["Inputs"], _Table);
  main.variable(observer("Input")).define("Input", ["Inputs"], _Input);
  main.variable(observer("bind")).define("bind", ["Inputs"], _bind);
  main.variable(observer("disposal")).define("disposal", ["Inputs"], _disposal);
  main.variable(observer("svg")).define("svg", ["htl"], _svg);
  main.variable(observer("html")).define("html", ["htl"], _html);
  return main;
}

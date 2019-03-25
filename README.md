<h1 align="center">
  navio
  <br>
  <a href="https://infovis.co/momaExplorer"><img src="imgs/Navio_MomaExplorer.gif" alt="Moma Explorer" height="300"></a>
  <br>
</h1>
<h4 align="center">A visualization widget to understand and navigate your data</h4>

It supports three main interactions:

| Sort | Filter a Range | Filter By Value|
| -----| --- | ---|
| <img src="imgs/Navio_MomaExplorer.gif" alt="Moma Explorer" height="300"> | <img src="imgs/Navio_MomaExplorer.gif" alt="Moma Explorer" height="300"> | <img src="imgs/Navio_MomaExplorer.gif" alt="Moma Explorer" height="300"> |
, click on a header to sort the data, click on a value to select it, or drag to select a range.
![Navio Demo with the MoMa Collection](imgs/Navio_MomaExplorer.gif)

## Try it on Observable:

You can explore your own data very easily on ObervableHQ, using [this base Navio notebook](https://beta.observablehq.com/@john-guerra/navio). If you want to load your own data you can use the [Navio-load notebook](https://beta.observablehq.com/@john-guerra/navio-load)

## Use it with your own data with shipyard:

If you have data and just want a quick way of summarize it, explore it or filter it, you can try Shipyard, our stand-alone application for Navio. (You can also export template code to use it)

[Try Shipyard](https://shipyard.navio.dev)
![Shipyard demo](https://github.com/john-guerra/shipyard/raw/master/demo.png)

### Demos:

* [MoMa Collection](https://john-guerra.github.io/momaExplorer/) ([Code](https://github.com/john-guerra/momaExplorer))
* [Navio-only Vast 2017 MiniChallenge1 ](http://john-guerra.github.io/navio/example_vastChallenge2017/index.html) ([Code](https://github.com/john-guerra/navio/tree/master/example_vastChallenge2017))
* [Co-voting patterns of the Colombian senate](http://johnguerra.co/viz/senadoColombia)
* [Simplest example with Networks on SVG](https://john-guerra.github.io/navio/example/) ([Code](https://github.com/john-guerra/navio/tree/master/example))
* [Simple example with Networks on Canvas](https://john-guerra.github.io/navio/exampleSenate/) ([Code](https://github.com/john-guerra/navio/tree/master/exampleSenate))

# Install

```js
npm install navio
```

Or use it from unpkg

```html
  <script type="text/javascript" src="https://d3js.org/d3.v4.min.js"></script>
  <script src="https://d3js.org/d3-scale-chromatic.v1.min.js"></script>
  <script src="https://unpkg.com/popper.js@1.14/dist/umd/popper.min.js"></script>
  <script type="text/javascript" src="https://unpkg.com/navio/dist/navio.min.js"></script>
```

Requires [^popper.js@0.14](https://github.com/FezVrasta/popper.js/), [^d3@4.13](http://d3js.org) and [d3-scale-chromatic](https://github.com/d3/d3-scale-chromatic) (unless you use d3.v5).

# Usage

TLDR
```html
<!DOCTYPE html>
<body>
  <!-- Placeholder for the widget -->
  <div id="navio"></div>


  <!-- NAVIO Step 0: Load the libraries -->
  <script type="text/javascript" src="https://d3js.org/d3.v4.min.js"></script>
  <script src="https://d3js.org/d3-scale-chromatic.v1.min.js"></script>
  <script src="https://unpkg.com/popper.js@1.14/dist/umd/popper.min.js"></script>
  <script type="text/javascript" src="https://unpkg.com/navio/dist/navio.min.js"></script>
<script>
  // NAVIO  Step 1.  Create a Navio passing a d3 selection to place it and an optional height
  var nv = navio(d3.select("#navio"), 600);


  d3.csv(YOUR_DATA, function (err, data) {
    if (err) throw err;

    // NAVIO Step 2. Load your data!
    nv.data(data);

    // NAVIO Step 3. Detect your attributes (or load them manually)
    nv.addAllAttribs();
  });
</script>
</body>
</html>
```
### Step by step
1. **HTML**. Start with this template
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Basic Usage</title>
</head>
<body>

  // Your Navio widget goes here
  <div id="Navio"></div>

</body>
</html>

```
2. **Import Navio**. Create and import a new JavaScript file below the scripts (d3 and Navio) or right in the html like in the example below.
```html
<script src="https://d3js.org/d3.v4.min.js"></script>
<script type="text/javascript" src="https://john-guerra.github.io/navio/Navio.js"></script>
<script type="text/javascript">
  //   YOUR_JS_CODE_HERE
</script>
```

3. **Create a Navio Instance**

``` javascript
var nv = navio(d3.select("#Navio"), 600); //height 600
```

4. [Optional] **Configure navio to your liking**

```javascript
nv.x0 = 0;  //Where to start drawing navio in x
nv.y0 = 100; //Where to start drawing navio in y, useful if your attrib names are too long
nv.maxNumDistictForCategorical = 10; // addAllAttribs uses this for deciding if an attribute is categorical (has less than nv.maxNumDistictForCategorical categories) or text
nv.howManyItemsShouldSearchForNotNull = 100; // How many rows should addAllAttribs search to decide guess an attribute type
nv.margin = 10; // Margin around navio
nv.showAttribTitles = true; // Show headers?
nv.attribWidth = 15; // Width of the columns
nv.attribRotation = -45; // Headers rotation
nv.attribFontSize = 13; // Headers font size
nv.attribFontSizeSelected = 32; // Headers font size when mouse over
nv.levelsSeparation = 40; // Separation between the levels
nv.divisionsColor = "white"; // Border color for the divisions
nv.levelConnectionsColor = "rgba(205, 220, 163, 0.5)"; // Color for the conections between levels
nv.divisionsThreshold = 4; // What's the minimum row width needed to draw divisions
nv.legendFont = "14px sans-serif"; // The font for the header
nv.linkColor = "#ccc"; // Color used for network links if provided with nv.links()
nv.tooltipFontSize = 12; // Font size for the tooltip
nv.tooltipBgColor = "#b2ddf1"; // Font color for tooltip background
nv.tooltipMargin = 50; // How much to separate the tooltip from the cursor
nv.tooltipArrowSize = 10; // How big is the arrow on the tooltip

nv.id("attribName"); // Shows this id on the tooltip, should be unique
```

4. [Optional] **Add your attributes manually**. Navio supports six types of attributes: categorical, sequential (numerical), diverging (numerical with negative values), text, date and boolean. You can either add them manually or use `nv.addAllAttribs()` to auto detect them (must be called after seting the data with `nv.data(your_data)`)

```javascript
nv.addCategoricalAttrib("attribName", [customScale])
nv.addSequentialAttrib("attribName", [customScale])
nv.addDivergingAttrib("attribName", [customScale])
nv.addTextAttrib("attribName", [customScale])
nv.addDateAttrib("attribName", [customScale])
nv.addBooleanAttrib("attribName", [customScale])
```

If you ommit the [customScale] parameter it will use the defaults. You can also create your own custom made parameters using `nv.addAttrib("attribName", customScale)`. For example, if you already have a scale for setting the colors of a `cluster` property on your visualization, you can tell navio to use the same matching colors. Make sure to set the domain and range of the scale, as navio will not try to do it with this function.

```javascript
var color = d3.scaleOrdinal(d3.schemeSet3)
  .domain["cluster1", "cluster2", "cluster3"];

nv.addAttrib("cluster", color);

```


5. **Set the data**

After loading your data pass it to navio. This will trigger the drawing operation. You can force redrawing using `nv.update();`
``` javascript
nv.data(myData);
```

If your data is a network, or you have some links in the same format of a [d3.forceSimulation](https://github.com/d3/d3-force#links) you can also add them to navio using `nv.links([links])`. This won't trigger a redraw, so make sure to call it before setting your data

``` javascript
nv.links(myLinks);
nv.data(myData);
```

6. **Detect Attributes**. navio also includes a function that detects the attributes automatically, which is slow, redraws the whole thing, and my be buggy. Use it at your own risk. But make sure to call it after setting your data

``` javascript
nv.data(myData);
nv.addAllAttribs();
```

7. **Set a callback**. A function that navio will call when the user filters/sort the data
``` javascript
nv.updateCallback( data => console.log("The filtered data is ", data));
```


## License

Navio.js is licensed under the MIT license. (http://opensource.org/licenses/MIT)

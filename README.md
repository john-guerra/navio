# NodeNavigator

**NodeNavigator** is a d3 visualization widget to help summarizing, browsing and navigating large network visualizations.
<div style="width="100%><img style="height:200px; margin: 0 auto;" src="src/example.png" alt="NodeNavigator widget" align="center" ></div>
## Resources

### Example with SVG
* [Code](https://github.com/john-guerra/NodeNavigator/tree/master/example)
* [Visualization](https://john-guerra.github.io/NodeNavigator/example/)
### Example with Canvas
* [Code](https://github.com/john-guerra/NodeNavigator/tree/master/exampleSenate)
* [Visualization](https://john-guerra.github.io/NodeNavigator/exampleSenate/)

### Libraries
#### D3v4
```html
<script src="https://d3js.org/d3.v4.min.js"></script>
```
#### NodeNavigator

<br>
&nbsp;&nbsp;&nbsp;&nbsp;[Click here to download NodeNavigator.js](https://raw.githubusercontent.com/john-guerra/NodeNavigator/master/NodeNavigator.js)

## Installing

```html
<script src="path/to/d3.v4.min.js"></script>
<script src="path/to/NodeNavigator.js"></script>
```
## Basic Usage

1. Use the next template. The id of the div is crucial for proper execution
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

  <h1>Example</h1>
  <div id="nodeNavigator"></div>

  <script src="https://d3js.org/d3.v4.min.js"></script>
  <script src="path/to/NodeNavigator.js"></script>
</body>
</html>

```
2. Create and import a new JavaScript file below the scripts (d3 and NodeNavigator) or right in the html like in the example below.
```html
<script src="path/to/d3.v4.min.js"></script>
<script src="path/to/NodeNavigator.js"></script>
<script type="text/javascript">
  (function () {
    "use strict";
    /* global d3, NodeNavigator */
  })();
</script>
```
3. Create an array with the columns that are categorical and another for the sequential.

```javascript
var catColumns = [
  "car-type",
  "gate-name",
  "dayOfTheWeek"
];
var seqColumns = [
  "minutes",
  "hours",
  "day",
  "month"
];
```
4. Set the NodeNavigator and its attributes
``` javascript
var nn = new NodeNavigator("#nodeNavigator", 600)
  .id("i");
catColumns.forEach((c) => nn.addCategoricalAttrib(c));
seqColumns.forEach((c) => nn.addSequentialAttrib(c));
```
5. Read CSV dataset and set the data
``` javascript
d3.csv("./dataset.csv", function (err, data) {
  if (err) throw err;
  data.forEach((d,i) => d.i = i);
  nn.data(data);
});

```
## License
NodeNavigator.js is licensed under the MIT license. (http://opensource.org/licenses/MIT)

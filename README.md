# Navio

**Navio** is a d3 visualization widget to help summarizing, browsing and navigating large network visualizations.
<br>
<img src="src/example.png" alt="Navio widget" height="400">

## Live Demo

[Live Demo: Data-explorer](https://john-guerra.github.io/Navio/data-explorer/build/index.html)

## Resources

### Example with SVG
* [Code](https://github.com/john-guerra/Navio/tree/master/example)
* [Visualization](https://john-guerra.github.io/Navio/example/)
### Example with Canvas
* [Code](https://github.com/john-guerra/Navio/tree/master/exampleSenate)
* [Visualization](https://john-guerra.github.io/Navio/exampleSenate/)

### Libraries
#### D3v4
```html
<script src="https://d3js.org/d3.v4.min.js"></script>
```
#### Navio
[Download](https://raw.githubusercontent.com/john-guerra/Navio/master/Navio.js)
## Installing

```html
<script src="path/to/d3.v4.min.js"></script>
<script src="path/to/Navio.js"></script>
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
  <div id="Navio"></div>

  <script src="https://d3js.org/d3.v4.min.js"></script>
  <script src="path/to/Navio.js"></script>
</body>
</html>

```
2. Create and import a new JavaScript file below the scripts (d3 and Navio) or right in the html like in the example below.
```html
<script src="path/to/d3.v4.min.js"></script>
<script src="path/to/Navio.js"></script>
<script type="text/javascript">
  (function () {
    "use strict";
    /* global d3, Navio */
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
4. Set the Navio and its attributes
``` javascript
var nn = new Navio("#Navio", 600);
catColumns.forEach((c) => nn.addCategoricalAttrib(c));
seqColumns.forEach((c) => nn.addSequentialAttrib(c));

// If you have one field that you would like to use to identify each row
nn.id("nameAttrib");

```
5. Read CSV dataset and set the data
``` javascript
d3.csv("./dataset.csv", function (err, data) {
  if (err) throw err;
  nn.data(data);
});

```

## Demo

[vastChallenge2017](http://john-guerra.github.io/Navio/example_vastChallenge2017/index.html)


## License
Navio.js is licensed under the MIT license. (http://opensource.org/licenses/MIT)

var spec = {
"$schema": "https://vega.github.io/schema/vega-lite/v2.4.3.json",
"repeat": {
"row": ["BECTUAREAL2", "BECCVPTCHAREAL2", "BECAWMNSHPINDXL2", "BECAWMNNNGHL2", "BECEFFMESHSIZEL2", "BECAWEDGDENSL2", "BECPOPDENSADJL2", "BECADCRCTYAVGL2", "BECADINTDENSL2", "BECADSTTDENSL2", "BECURBTRVDELAYINDEXL2"]
},
"config": {
"view": {
  "width": 400,
  "height": 300
}
},
"spec": {
"encoding": {
  "color": {
    "condition": {
      "field": "clase",
      "selection": "selector057",
      "type": "nominal"
    },
    "value": "gray"
  },
  "y": {
    "field":"Country",
    // "aggregate": "count",
    "type": "nominal"
  },
  "tooltip": [
    {
      "field": "Country",
      "type": "nominal"
    },
    {
      "field": "L1Name",
      "type": "nominal"
    },
    {
      "field": "L2Namev2",
      "type": "nominal"
    }
  ],
  "x": {
    // "bin": true,
    "field": {
      "repeat": "row"
    },
    "scale": {"zero": false},
    "type": "quantitative"
  },
  "column": {"field": "clase", "type": "nominal"}
},
"width": 200,
"mark": {"type":"tick","opacity": "0.4"},
"selection": {
  "selector057": {
    "resolve": "global",
    "type": "interval"
  }
},
"data": {
  "url": "datos.csv"
},
"height": 150
}
};
var embed_opt = {"mode": "vega-lite"};

function showError(el, error){
    el.innerHTML = ('<div class="error">'
                    + '<p>JavaScript Error: ' + error.message + '</p>'
                    + "<p>This usually means there's a typo in your chart specification. "
                    + "See the javascript console for the full traceback.</p>"
                    + '</div>');
    throw error;
}
const el = document.getElementById('vis');
vegaEmbed("#vis", spec, embed_opt)
  .catch(error => showError(el, error));
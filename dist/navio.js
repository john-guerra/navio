// https://navio.dev v0.0.74 Copyright (c) 2017 John Alexis Guerra Gómez
(function (global, factory) {
typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('d3'), require('popper.js')) :
typeof define === 'function' && define.amd ? define(['d3', 'popper.js'], factory) :
(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.navio = factory(global.d3, global.Popper));
})(this, (function (d3, Popper) { 'use strict';

function _interopNamespaceDefault(e) {
var n = Object.create(null);
if (e) {
Object.keys(e).forEach(function (k) {
if (k !== 'default') {
var d = Object.getOwnPropertyDescriptor(e, k);
Object.defineProperty(n, k, d.get ? d : {
enumerable: true,
get: function () { return e[k]; }
});
}
});
}
n.default = e;
return Object.freeze(n);
}

var d3__namespace = /*#__PURE__*/_interopNamespaceDefault(d3);

function FilterByRange(opts) {
  const first = opts.first;
  const last = opts.last;
  const level = opts.level;
  const itemAttr = opts.itemAttr;
  const getAttrib = opts.getAttrib || (d => d[itemAttr]);
  const getAttribName = opts.getAttribName || (attrib => typeof(attrib) === "function" ? attrib.name :  attrib);

  function filter(d) {
    return d.__i[level] >= first.__i[level] && d.__i[level] <= last.__i[level];
  }

  function toStr() {
    let firstVal = `${getAttrib(first,itemAttr)}`,
      lastVal = `${getAttrib(last,itemAttr)}`;
    firstVal = typeof(firstVal) === typeof("") ? firstVal.slice(0,5) : firstVal;
    lastVal = typeof(lastVal) === typeof("") ? lastVal.slice(0,5) : lastVal;
    return `${getAttribName(itemAttr)} range including ${firstVal} to ${lastVal}`;
  }

  return {
    filter,
    toStr,
    type:"range"
  };
}

function FilterByValue(opts) {
  const itemAttr = opts.itemAttr;
  const sel = opts.sel;
  const getAttrib = opts.getAttrib || (d => d[itemAttr]);
  const getAttribName = opts.getAttribName || (attrib => typeof(attrib) === "function" ? attrib.name :  attrib);


  function filter(d) {
    return getAttrib(d, itemAttr) === getAttrib(sel, itemAttr);
  }

  function toStr() {
    return `${getAttribName(itemAttr)} == ${getAttrib(sel, itemAttr)}`;
  }

  return {
    filter,
    toStr,
    type:"value"
  };
}

function FilterByValueDifferent(opts) {
  const itemAttr = opts.itemAttr;
  const sel = opts.sel;
  const getAttrib = opts.getAttrib || (d => d[itemAttr]);
  const getAttribName = opts.getAttribName || (attrib => typeof(attrib) === "function" ? attrib.name :  attrib);


  function filter(d) {
    return getAttrib(d, itemAttr) !== getAttrib(sel, itemAttr);
  }

  function toStr() {
    return `${getAttribName(itemAttr)} != ${getAttrib(sel, itemAttr)}`;
  }

  return {
    filter,
    toStr,
    type:"negativeValue"
  };
}

function FilterByRangeNegative(opts) {
  const first = opts.first;
  const last = opts.last;
  const level = opts.level;
  const itemAttr = opts.itemAttr;
  const getAttrib = opts.getAttrib || (d => d[itemAttr]);
  const getAttribName = opts.getAttribName || (attrib => typeof(attrib) === "function" ? attrib.name :  attrib);

  function filter(d) {
    return d.__i[level] < first.__i[level] || d.__i[level] > last.__i[level];
  }

  function toStr() {
    let firstVal = `${getAttrib(first,itemAttr)}`,
      lastVal = `${getAttrib(last,itemAttr)}`;
    firstVal = typeof(firstVal) === typeof("") ? firstVal.slice(0,5) : firstVal;
    lastVal = typeof(lastVal) === typeof("") ? lastVal.slice(0,5) : lastVal;
    return `${getAttribName(itemAttr)} range excluding ${firstVal} to ${lastVal}`;
  }

  return {
    filter,
    toStr,
    type:"negativeRange"
  };
}

// Like d3.ascending but supporting null
function d3AscendingNull(a, b) {
  if (b === null || b === undefined) {
    if (a === null || a === undefined) return 0; // a == b == null
    else return 1; // b==null a!=null
  } else { // b!=null
    if (a === null || a === undefined) return -1;
    else {
      // Both are non null
      if (typeof(a)!==typeof(b)) {
        a = ""+a; b = ""+b; //If they have different types, convert them to strings
      }

      if (a < b) return -1;
      else if (a > b) return 1;
      else if (a >= b) return 0;
      else return NaN;
    }
  }
}

function d3DescendingNull(a, b) {
  if (b === null || b === undefined) {
    if (a === null || a === undefined) return 0; // a == b == null
    else return -1; // b==null a!=null
  } else { // b!=null
    if (a === null || a === undefined) return 1;
    else {
      // Both are non null
      if (typeof(a)!==typeof(b)) {
        a = ""+a; b = ""+b; //If they have different types, convert them to strings
      }

      if (a < b) return 1;
      else if (a > b) return -1;
      else if (a >= b) return 0;
      else return NaN;
    }
  }
}

// A fake scale that uses only the first digits of a text to compute the color.
// Creates a list of all the possible first digits and uses a sequential scale to color based on such index
function scaleText(nullColor, digits = 1, defaultColorInterpolator) {

  // const defaultColorInterpolator = "interpolateGreys" in d3 ? d3.interpolateGreys : interpolateGreys; // Hack to keep it working with d3.v4
  let scale = d3__namespace.scaleSequential(defaultColorInterpolator),
    dRepresentativesCounts = new Map(), // Contains the counts for each letter/substrg
    dRepresentativesIndexes = new Map();

  // Computes the actual value, based on the index of the first digits in the domain
  function compute(d) {
    if (typeof(d)!==typeof("")) {
      d = d + ""; // Force text
    }

    let ci = dRepresentativesIndexes.get(
      d.slice(0, digits)
    );
    if (ci === undefined) {
      console.log(
        `scaleText Couldn't find index for ${d} did you call domain? Using ascii of first letter`
      );
      ci = d
        // .slice(0, digits)
        .charCodeAt(0);
    }
    return scale(ci) || nullColor;
  }

  function computeRepresentatives(data, doIndex = true) {
    dRepresentativesCounts = new Map();
    for (let v of data) {
      //Initialize
      if (!dRepresentativesCounts.has(v)) dRepresentativesCounts.set(v, 0);

      //count+=1
      dRepresentativesCounts.set(v, dRepresentativesCounts.get(v) + 1);
    }
    const ret = {
      counts: dRepresentativesCounts
    };

    if (doIndex) {
      // Compute the indexes of each representative
      dRepresentativesIndexes = new Map();
      let i = 0;
      for (let r of Array.from(dRepresentativesCounts.keys()).sort()) {
        dRepresentativesIndexes.set(r, i++);
      }
      ret.indexes = dRepresentativesIndexes;
    }

    return ret;
  }

  compute.digits = function(_) {
    return arguments.length ? ((digits = _), compute) : digits;
  };

  compute.scale = function(_) {
    return arguments.length ? ((scale = _), compute) : scale;
  };

  compute.domain = function(data) {
    if (arguments.length) {
      // Compute representatives for letters/substrings
      computeRepresentatives(
        data
          // .filter(d => typeof(d) === typeof(""))
          .map(d => (""+d).slice(0, digits))
      );
      scale.domain([0, Array.from(dRepresentativesCounts.keys()).length]);
      return compute;
    } else {
      return scale.domain();
    }
  };

  compute.computeRepresentatives = computeRepresentatives;
  compute.__type = "text";

  return compute;
}




// A fake scale that uses the ranked order for coloring
function scaleOrdered(nullColor, defaultColorInterpolator) {

  let scale = d3__namespace.scaleOrdinal();
  // dRepresentativesCounts = new Map(), // Contains the counts for each letter/substrg
  // dRepresentativesIndexes = new Map();

  // Computes the actual value, based on the index of the first digits in the domain
  function compute(d) {
    if (d === undefined || d=== null) return nullColor;
    else return scale(d);
  }

  function computeRepresentatives(data) {
    // Sorting with d3 set converts to strings :(
    // return new Set(data).values().sort((a,b) => d3AscendingNull(a,b));

    // Also convert to strings :(
    // dValues = {};
    // for (let v of data) {
    //   //Initialize
    //   if (dValues[v]===undefined) dValues[v]=0;

    //   //count+=1
    //   dValues[v]+=1;
    // }
    // const vals = [];
    // for (let v in dValues) {
    //   vals.push(v);
    // }
    // return vals.sort();

    const vals = [];
    let prev = null;
    for (let v of data.sort((a,b) => d3AscendingNull(a,b))) {
      if (prev!==v) {
        vals.push(v);
        prev = v;
      }
    }

    return vals;
  }

  compute.domain = function(data) {
    if (arguments.length) {
      // Compute representatives for letters/substrings
      const values = computeRepresentatives(data);

      scale.domain(values)
        .range(values.map((_, i) => defaultColorInterpolator(i/values.length)));
      return compute;
    } else {
      return scale.domain();
    }
  };

  compute.computeRepresentatives = computeRepresentatives;
  compute.__type = "ordered";

  return compute;
}

// Returns a flat array with all the attributes in an object up to recursionLevel.
// Returns attributes as lists to avoid confusion with names containing dots
const getAttribsFromObjectRecursive = function(
  obj,
  recursionLevel = Infinity
) {
  function helper(obj, recursionCount) {
    var attr,
      res = [];
    for (attr in obj) {
      if (
        obj.hasOwnProperty(attr) &&
        attr !== "__i" &&
        attr !== "__seqId" &&
        attr !== "selected"
      ) {
        if (
          recursionCount < recursionLevel &&
          !Array.isArray(obj[attr]) &&
          obj[attr] !== null &&
          obj[attr] !== undefined &&
          !(obj[attr] instanceof Date) && // Not a date
          typeof obj[attr] === typeof {}
        ) {
          // Recursive call on objects
          res = res.concat(
            helper(obj[attr], recursionCount + 1).map(a => [attr].concat(a))
          );
        } else {
          res.push([attr]);
        }
      }
    }

    return res;
  }

  return helper(obj, 0);
};

function convertAttribToFn(attr) {
  if (typeof attr === "string") {
    attr = attr.split(".");
  }

  let fnName = attr.join("_");
  // .replace(/\./g, "_"); // Try to get a better function name

  // https://stackoverflow.com/questions/1661197/what-characters-are-valid-for-javascript-variable-names
  // const validRegExp = /^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[$A-Z\_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc][$A-Z\_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc0-9\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u0669\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u06f0-\u06f9\u0711\u0730-\u074a\u07a6-\u07b0\u07c0-\u07c9\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09cb-\u09cd\u09d7\u09e2\u09e3\u09e6-\u09ef\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e50-\u0e59\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e\u0f3f\u0f71-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1040-\u1049\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4-\u17d3\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u18a9\u1920-\u192b\u1930-\u193b\u1946-\u194f\u19b0-\u19c0\u19c8\u19c9\u19d0-\u19d9\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b00-\u1b04\u1b34-\u1b44\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1bb0-\u1bb9\u1be6-\u1bf3\u1c24-\u1c37\u1c40-\u1c49\u1c50-\u1c59\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf2-\u1cf4\u1dc0-\u1de6\u1dfc-\u1dff\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua620-\ua629\ua66f\ua674-\ua67d\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua880\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f1\ua900-\ua909\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9d0-\ua9d9\uaa29-\uaa36\uaa43\uaa4c\uaa4d\uaa50-\uaa59\uaa7b\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaeb-\uaaef\uaaf5\uaaf6\uabe3-\uabea\uabec\uabed\uabf0-\uabf9\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f]*$/;

  const access = attr.map(a => `["${a}"]`).join(""); // a.b.c => ["a"]["b"]["c"]

  let body = `return function ${fnName}(d) { try { return d${access} } catch (e) { return undefined }; };`;
  try {
    return new Function(body)();
  } catch (e) {
    // Try sanitizing the variable name
    fnName = fnName.replace(/[^a-zA-Z0-9_-]/g, ""); // remove special characters
    body = `return function ${fnName}(d) { try { return d${access} } catch (e) { return undefined }; };`;
    return new Function(body)();
  }
}

// Returns an array of strings or functions to access all the attributes in an object
function getAttribsFromObjectAsFn(obj, recursionLevel = Infinity) {
  const attribs = getAttribsFromObjectRecursive(obj, recursionLevel);
  return attribs.map(attr =>
    attr.length > 1 ? convertAttribToFn(attr) : attr
  );
}

// import * as d3 from "./../../node_modules/d3/dist/d3.js"; // Force react to use the es6 module


//eleId must be the ID of a context element where everything is going to be drawn
function navio(selection, _h) {
  let nv = this || {},
    data = [], //Contains the original data attributes
    dataIs = [], //Contains only the indices to the data, is an array of arrays, one for each level
    links = [],
    visibleLinks = [],
    dData = new Map(), // A hash for the data
    attribsOrdered = [],
    dAttribs = new Map(),
    dSortBy = [], //contains which attribute to sort by on each column
    dBrushes = [],
    filtersByLevel = [], // The filters applied to each level
    yScales = [],
    xScale,
    x,
    height = _h !== undefined ? _h : 600,
    colScales = new Map(),
    levelScale,
    svg,
    canvas,
    context,
    tooltip,
    tooltipElement,
    tooltipCoords = { x: -50, y: -50 },
    id = "__seqId",
    updateCallback = function () {},
    cursorSubstractData =
      "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMzJweCIgaGVpZ2h0PSIzMnB4IiB2aWV3Qm94PSIwIDAgMzIgMzIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDU0LjEgKDc2NDkwKSAtIGh0dHBzOi8vc2tldGNoYXBwLmNvbSAtLT4KICAgIDx0aXRsZT5jdXJzb3JTdWJzdHJhY3Q8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iY3Vyc29yU3Vic3RyYWN0IiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8cGF0aCBkPSJNOSwwLjUgTDcsMC41IEw3LDcgTDAuNSw3IEwwLjUsOSBMNyw5IEw3LDE1LjUgTDksMTUuNSBMOSw5IEwxNS41LDkgTDE1LjUsNyBMOSw3IEw5LDAuNSBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIHN0cm9rZT0iI0ZGRkZGRiIgZmlsbD0iIzAwMDAwMCI+PC9wYXRoPgogICAgICAgIDxyZWN0IGlkPSJSZWN0YW5nbGUiIGZpbGw9IiMwMDAwMDAiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE1LjAwMDAwMCwgMTUuMDAwMDAwKSByb3RhdGUoLTI3MC4wMDAwMDApIHRyYW5zbGF0ZSgtMTUuMDAwMDAwLCAtMTUuMDAwMDAwKSAiIHg9IjE0IiB5PSIxMSIgd2lkdGg9IjIiIGhlaWdodD0iOCI+PC9yZWN0PgogICAgPC9nPgo8L3N2Zz4=",
    cursorAddData =
      "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMzJweCIgaGVpZ2h0PSIzMnB4IiB2aWV3Qm94PSIwIDAgMzIgMzIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDU0LjEgKDc2NDkwKSAtIGh0dHBzOi8vc2tldGNoYXBwLmNvbSAtLT4KICAgIDx0aXRsZT5jdXJzb3JBZGQ8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iY3Vyc29yQWRkIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8cGF0aCBkPSJNOSwwLjUgTDcsMC41IEw3LDcgTDAuNSw3IEwwLjUsOSBMNyw5IEw3LDE1LjUgTDksMTUuNSBMOSw5IEwxNS41LDkgTDE1LjUsNyBMOSw3IEw5LDAuNSBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIHN0cm9rZT0iI0ZGRkZGRiIgZmlsbD0iIzAwMDAwMCI+PC9wYXRoPgogICAgICAgIDxwYXRoIGQ9Ik0xNiwxNCBMMTksMTQgTDE5LDE2IEwxNiwxNiBMMTYsMTkgTDE0LDE5IEwxNCwxNiBMMTEsMTYgTDExLDE0IEwxNCwxNCBMMTQsMTEgTDE2LDExIEwxNiwxNCBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIGZpbGw9IiMwMDAwMDAiPjwvcGF0aD4KICAgIDwvZz4KPC9zdmc+",
    cursorData =
      "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMzJweCIgaGVpZ2h0PSIzMnB4IiB2aWV3Qm94PSIwIDAgMzIgMzIiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDU0LjEgKDc2NDkwKSAtIGh0dHBzOi8vc2tldGNoYXBwLmNvbSAtLT4KICAgIDx0aXRsZT5jdXJzb3I8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iY3Vyc29yIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8cGF0aCBkPSJNOSwwLjUgTDcsMC41IEw3LDcgTDAuNSw3IEwwLjUsOSBMNyw5IEw3LDE1LjUgTDksMTUuNSBMOSw5IEwxNS41LDkgTDE1LjUsNyBMOSw3IEw5LDAuNSBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIHN0cm9rZT0iI0ZGRkZGRiIgZmlsbD0iIzAwMDAwMCI+PC9wYXRoPgogICAgPC9nPgo8L3N2Zz4=";

  // Default parameters
  nv.x0 = 0; //Where to start drawing navio in x
  nv.y0 = 100; //Where to start drawing navio in y, useful if your attrib names are too long
  nv.maxNumDistictForCategorical = 10; // addAllAttribs uses this for deciding if an attribute is categorical (has less than nv.maxNumDistictForCategorical categories) or ordered
  nv.maxNumDistictForOrdered = 90; // addAllAttribs uses this for deciding if an attribute is ordered (has less than nv.maxNumDistictForCategorical categories) or text
  // use nv.maxNumDistictForOrdered = Infinity for never choosing Text
  nv.howManyItemsShouldSearchForNotNull = 100; // How many rows should addAllAttribs search to decide guess an attribute type
  nv.margin = 10; // Margin around navio

  nv.levelsSeparation = 40; // Separation between the levels
  nv.divisionsColor = "white"; // Border color for the divisions
  nv.nullColor = "#ffedfd"; // Color for null values
  nv.levelConnectionsColor = "rgba(205, 220, 163, 0.5)"; // Color for the conections between levels
  nv.divisionsThreshold = 4; // What's the minimum row height needed to draw divisions
  nv.fmtCounts = d3__namespace.format(",.0d"); // Format used to display the counts on the bottom
  nv.legendFont = "14px sans-serif"; // The font for the header
  nv.linkColor = "#ccc"; // Color used for network links if provided with nv.links()
  nv.nestedFilters = true; // Should navio use nested levels?

  nv.showAttribTitles = true; // Show headers?
  nv.attribWidth = 15; // Width of the columns
  nv.attribRotation = -45; // Headers rotation
  nv.attribFontSize = 13; // Headers font size
  nv.attribFontSizeSelected = 32; // Headers font size when mouse over

  nv.filterFontSize = 8; // Font size of the filters explanations on the bottom

  nv.tooltipFontSize = 12; // Font size for the tooltip
  nv.tooltipBgColor = "#b2ddf1"; // Font color for tooltip background
  nv.tooltipMargin = 50; // How much to separate the tooltip from the cursor
  nv.tooltipArrowSize = 10; // How big is the arrow on the tooltip

  nv.addAllAttribsRecursionLevel = Infinity; // How many levels depth do we keep on adding nested attributes
  nv.addAllAttribsIncludeObjects = false; // Should addAllAttribs include objects
  nv.addAllAttribsIncludeArrays = false; // Should addAllAttribs include arrays

  nv.digitsForText = 2; // How many digits to use for text attributes

  nv.defaultColorInterpolator = d3__namespace.interpolateBlues;
  nv.defaultColorInterpolatorDate = d3__namespace.interpolatePurples;
  nv.defaultColorInterpolatorDiverging = d3__namespace.interpolateBrBG;
  nv.defaultColorInterpolatorOrdered = d3__namespace.interpolateOranges;
  nv.defaultColorInterpolatorText = d3__namespace.interpolateGreys;

  nv.defaultColorRangeBoolean = ["#a1d76a", "#e9a3c9", "white"]; //true false null
  nv.defaultColorRangeSelected = ["white", "#b5cf6b"];
  nv.defaultColorCategorical = d3__namespace.schemeCategory10;

  nv.showSelectedAttrib = true; // Display the attribute that shows if a row is selected
  nv.showSequenceIDAttrib = true; // Display the attribute with the sequence ID

  // function nozoom(event) {
  //   if (DEBUG) console.log("nozoom");
  //   event.preventDefault();
  // }

  function initTooltipPopper() {
    if (tooltipElement) tooltipElement.remove();

    d3__namespace.selectAll("._nv_popover").remove();
    tooltipElement = d3__namespace
      .select("body")
      .append("div")
      .attr("class", "_nv_popover")
      // .style("text-shadow", "0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff")
      .style("pointer-events", "none")
      .style("font-family", "sans-serif")
      .style("font-size", nv.tooltipFontSize)
      .style("text-align", "center")
      .style("background", nv.tooltipBgColor)
      .style("position", "relative")
      .style("color", "black")
      .style("z-index", 4)
      .style("border-radius", "4px")
      .style("box-shadow", "0 0 2px rgba(0,0,0,0.5)")
      .style("padding", "10px")
      .style("text-align", "center")
      .style("display", "none");

    tooltipElement.append("style").attr("scoped", "").text(`
        [x-arrow] {
          width: 0;
          height: 0;
          border-style: solid;
          position: absolute;
          margin: ${nv.tooltipArrowSize}px;
          border-color: ${nv.tooltipBgColor}
        }

        ._nv_popover[x-placement="left"] {
            margin-right: ${nv.tooltipArrowSize + nv.tooltipMargin}px;
        }

        ._nv_popover[x-placement="left"] [x-arrow] {
          border-width: ${nv.tooltipArrowSize}px 0 ${nv.tooltipArrowSize}px ${
      nv.tooltipArrowSize
    }px;
          border-top-color: transparent;
          border-right-color: transparent;
          border-bottom-color: transparent;
          right: -${nv.tooltipArrowSize}px;
          top: calc(50% - ${nv.tooltipArrowSize}px);
          margin-left: 0;
          margin-right: 0;
        }

        ._nv_popover[x-placement="right"] {
            margin-left: ${nv.tooltipArrowSize + nv.tooltipMargin}px;
        }

        ._nv_popover[x-placement="right"] [x-arrow] {
          border-width: ${nv.tooltipArrowSize}px ${nv.tooltipArrowSize}px ${
      nv.tooltipArrowSize
    }px 0;
          border-left-color: transparent;
          border-top-color: transparent;
          border-bottom-color: transparent;
          left: -${nv.tooltipArrowSize}px;
          top: calc(50% - ${nv.tooltipArrowSize}px);
          margin-left: 0;
          margin-right: 0;
        }

        ._nv_popover[x-placement="bottom"] {
            margin-top: ${nv.tooltipArrowSize + nv.tooltipMargin}px;
        }

        ._nv_popover[x-placement="bottom"] [x-arrow] {
          border-width: 0 ${nv.tooltipArrowSize}px ${nv.tooltipArrowSize}px ${
      nv.tooltipArrowSize
    }px;
          border-left-color: transparent;
          border-right-color: transparent;
          border-top-color: transparent;
          top: -${nv.tooltipArrowSize}px;
          left: calc(50% - ${nv.tooltipArrowSize}px);
          margin-top: 0;
          margin-bottom: 0;
        }

        ._nv_popover[x-placement="top"] {
            margin-bottom: ${nv.tooltipArrowSize + nv.tooltipMargin}px;
        }

        ._nv_popover[x-placement="top"] [x-arrow] {
          border-width: ${nv.tooltipArrowSize}px ${nv.tooltipArrowSize}px 0 ${
      nv.tooltipArrowSize
    }px;
          border-left-color: transparent;
          border-right-color: transparent;
          border-bottom-color: transparent;
          bottom: -${nv.tooltipArrowSize}px;
          left: calc(50% - ${nv.tooltipArrowSize}px);
          margin-top: 0;
          margin-bottom: 0;
        }


      `);

    tooltipElement.append("div").attr("class", "tool_id");

    tooltipElement
      .append("div")
      .attr("class", "tool_value_name")
      .style("font-weight", "bold")
      .style("font-size", "120%");

    tooltipElement
      .append("div")
      .attr("class", "tool_value_val")
      .style("max-width", "400px")
      .style("max-height", "5.5em")
      .style("text-align", "left")
      .style("overflow", "hidden")
      .style("font-size", "90%");

    tooltipElement
      .append("div")
      .style("font-size", "70%")
      .style("margin-top", "10px")
      .style("text-align", "left")
      .style("color", "#777")
      .html(`<div>Click to filter a value (<strong>alt</strong> for negative filter).<br>
        Drag for filtering a range.<br> <strong>shift</strong> click for appending to the filters</div>`);

    tooltipElement.append("div").attr("x-arrow", "");

    const ref = {
      getBoundingClientRect: () => {
        const svgBR = svg.node().getBoundingClientRect();
        return {
          top: tooltipCoords.y + svgBR.top,
          right: tooltipCoords.x + svgBR.left,
          bottom: tooltipCoords.y + svgBR.top,
          left: tooltipCoords.x + svgBR.left,
          width: 0,
          height: 0,
        };
      },
      clientWidth: 0,
      clientHeight: 0,
    };

    // const ref= {
    //   getBoundingClientRect: () => {
    //     return {
    //       top: tooltipCoords.y,
    //       right: tooltipCoords.x,
    //       bottom: tooltipCoords.y,
    //       left: tooltipCoords.x,
    //       width: 0,
    //       height: 0,
    //     };
    //   },
    //   clientWidth: 0,
    //   clientHeight: 0,
    // };

    tooltip = new Popper(ref, tooltipElement.node(), {
      placement: "right",
      // modifiers: {
      //   preventOverflow: {
      //     boundariesElement: selection.node(),
      //   },
      // },
    });
  }

  function changeCursorOnKey(event) {
    if (event.key === "Alt") {
      d3__namespace.selectAll(".overlay")
        .attr("cursor", `url(${cursorSubstractData}) 8 8, zoom-out`)
        .style("cursor", `url(${cursorSubstractData}) 8 8, zoom-out`);
      // console.log("Alt!");
    } else if (event.key === "Shift") {
      d3__namespace.selectAll(".overlay")
        .attr("cursor", `url(${cursorAddData}) 8 8, zoom-in`)
        .style("cursor", `url(${cursorAddData}) 8 8, zoom-in`);
      // console.log("Alt!");
    } else {
      d3__namespace.selectAll(".overlay").style(
        "cursor",
        `url(${cursorData}) 8 8, crosshair`
      );
    }

    if (event.type === "keyup")
      d3__namespace.selectAll(".overlay").style(
        "cursor",
        `url(${cursorData}) 8 8, crosshair`
      );
    // console.log("key", event.type);
  }

  function init() {
    // Try to support strings and elements
    selection =
      typeof selection === typeof "" ? d3__namespace.select(selection) : selection;
    selection =
      selection.selectAll === undefined ? d3__namespace.select(selection) : selection;

    selection.selectAll("*").remove();

    const divNavio = selection
      // .on("touchstart", nozoom)
      // .on("touchmove", nozoom)
      .style("height", height + "px")
      .attr("class", "navio")
      .append("div")
      .style("overflow-x", "auto")
      .style("position", "relative");

    divNavio.append("canvas");
    svg = divNavio
      .append("svg")
      .style("overflow", "visible")
      .style("position", "absolute")
      // .style("cursor", `url(${cursorData}) 8 8, crosshair`)
      .style("z-index", 3)
      .style("top", 0)
      .style("left", 0);

    divNavio
      .append("div")
      .attr("class", "explanations")
      .style("overflow", "visible")
      .style("position", "absolute")
      .style("z-index", 5)
      .style("top", nv.margin + "px")
      .style("left", nv.margin + "px");

    // TODO: Try a more localized selection
    d3__namespace.select("body")
      .on("keydown", changeCursorOnKey)
      .on("keyup", changeCursorOnKey);

    svg.append("g").attr("class", "attribs");

    initTooltipPopper();

    svg
      .append("g")
      .attr("id", "closeButton")
      .style("fill", "white")
      .style("stroke", "black")
      .style("display", "none")
      .append("path")
      .call(function (sel) {
        let crossSize = 7,
          path = d3__namespace.path(); // Draw a cross and a circle
        path.moveTo(0, 0);
        path.lineTo(crossSize, crossSize);
        path.moveTo(crossSize, 0);
        path.lineTo(0, crossSize);
        path.moveTo(crossSize * 1.2 + crossSize / 2, crossSize / 2);
        path.arc(crossSize / 2, crossSize / 2, crossSize * 1.2, 0, Math.PI * 2);
        sel.attr("d", path.toString());
      })
      .on("click pointerup", () => deleteSubsequentLevels()); //delete last level

    xScale = d3__namespace
      .scaleBand()
      // .rangeBands([0, nv.attribWidth], 0.1, 0);
      .range([0, nv.attribWidth])
      .round(true)
      .paddingInner(0.1)
      .paddingOuter(0);
    levelScale = d3__namespace.scaleBand().round(true);
    colScales = new Map();

    x = function (val, level) {
      return levelScale(level) + xScale(val);
    };

    canvas = selection.select("canvas").node();

    const ctxWidth = levelScale.range()[1] + nv.margin + nv.x0;
    // canvas.style.position = "absolute";
    canvas.style.top = canvas.offsetTop + "px";
    canvas.style.left = canvas.offsetLeft + "px";
    canvas.style.width = ctxWidth + "px";
    canvas.style.height = height + "px";

    const scale = window.devicePixelRatio;
    canvas.width = ctxWidth * scale;
    canvas.height = height * scale;

    context = canvas.getContext("2d");

    context.scale(scale, scale);

    context.imageSmoothingEnabled =
      context.mozImageSmoothingEnabled =
      context.webkitImageSmoothingEnabled =
        false;

    context.globalCompositeOperation = "source-over";
  }

  function showLoading(ele) {
    d3__namespace.select(ele).style("cursor", "progress");
    svg.style("cursor", "progress");
  }

  function hideLoading(ele) {
    // d3.select("._nv_loading").remove();
    d3__namespace.select(ele).style("cursor", null);
    svg.style("cursor", null);
  }

  function deferEvent(cbk) {
    return function (event, d, i, all) {
      showLoading(this);
      requestAnimationFrame(() => {
        cbk(event, d, i, all);
        hideLoading(this);
      });
    };
  }

  function invertOrdinalScale(scale, x) {
    // Taken from https://bl.ocks.org/shimizu/808e0f5cadb6a63f28bb00082dc8fe3f
    // custom invert function
    let domain = scale.domain();
    let range = scale.range();
    let qScale = d3__namespace.scaleQuantize().domain(range).range(domain);

    return qScale(x);
  }

  function updateSorting(levelToUpdate, _dataIs) {
    if (!dSortBy.hasOwnProperty(levelToUpdate)) {
      console.log(
          "UpdateSorting called without attrib in dSortBy",
          levelToUpdate,
          dSortBy
        );
      return;
    }

    _dataIs = _dataIs !== undefined ? _dataIs : dataIs;

    let before = performance.now();

    const sort = dSortBy[levelToUpdate];
    _dataIs[levelToUpdate].sort(function (a, b) {
      return sort.desc
        ? d3DescendingNull(
            getAttrib(data[a], sort.attrib),
            getAttrib(data[b], sort.attrib)
          )
        : d3AscendingNull(
            getAttrib(data[a], sort.attrib),
            getAttrib(data[b], sort.attrib)
          );
    });
    assignIndexes(_dataIs[levelToUpdate], levelToUpdate);

    let after = performance.now();
    console.log(
        "Sorting level " + levelToUpdate + " " + (after - before) + "ms"
      );
  }

  function onSortLevel(event, d) {
    console.log("click " + d);
    if (event && event.defaultPrevented) {
      console.log("clicked, defaultPrevented");
      return; // dragged
    }

    dSortBy[d.level] = {
      attrib: d.attrib,
      desc:
        dSortBy[d.level] !== undefined && dSortBy[d.level].attrib === d.attrib
          ? !dSortBy[d.level].desc
          : false,
    };

    deleteObsoleteFiltersFromLevel(d.level + 1);

    updateSorting(d.level);
    removeBrushOnLevel(d.level);

    nv.updateData(dataIs, colScales, {
      levelsToUpdate: [d.level],
    });

    updateCallback(nv.getVisible());
  }

  function getAttrib(item, attrib) {
    if (typeof attrib === "function") {
      try {
        return attrib(item);
      } catch (e) {
        // console.log("navio error getting attrib with item ", item, " attrib ", attrib, "error", e);
        return undefined;
      }
    } else {
      return item[attrib];
    }
  }

  function getAttribName(attrib) {
    if (typeof attrib === "function") {
      return attrib.name ? attrib.name : attrib;
    } else {
      return attrib;
    }
  }

  function drawItem(item, level) {
    let attrib, i, y;

    context.save();
    for (i = 0; i < attribsOrdered.length; i++) {
      attrib = attribsOrdered[i];
      const val = getAttrib(item, attrib);
      const attribName = getAttribName(attrib);

      y = Math.round(yScales[level](item[id]) + yScales[level].bandwidth() / 2);
      // y = yScales[level](item[id]) + yScales[level].bandwidth()/2;

      context.beginPath();
      context.moveTo(Math.round(x(attribName, level)), y);
      context.lineTo(Math.round(x(attribName, level) + xScale.bandwidth()), y);
      context.lineWidth = Math.ceil(yScales[level].bandwidth());
      // context.lineWidth = 1;

      context.strokeStyle =
        val === undefined || val === null || val === "" || val === "none"
          ? nv.nullColor
          : colScales.get(attrib)(val);

      context.stroke();

      // TODO get this out
      //If the range bands are tick enough draw divisions
      if (yScales[level].bandwidth() > nv.divisionsThreshold * 2) {
        let yLine = Math.round(yScales[level](item[id]));
        // y = yScales[level](item[id])+yScales[level].bandwidth()/2;
        context.beginPath();
        context.moveTo(x(attribName, level), yLine);
        context.lineTo(x(attribName, level) + xScale.bandwidth(), yLine);
        context.lineWidth = 1;
        // context.lineWidth = 1;
        context.strokeStyle = nv.divisionsColor;
        context.stroke();
      }
    }
    context.restore();
  } // drawItem

  function drawLevelBorder(i) {
    context.save();
    context.beginPath();
    context.rect(
      levelScale(i),
      yScales[i].range()[0] - 1,
      xScale.range()[1] + 1,
      yScales[i].range()[1] + 2 - yScales[i].range()[0]
    );
    context.strokeStyle = "black";
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }

  function removeBrushOnLevel(lev) {
    if (lev < 0) return;
    d3__namespace.select("#level" + lev)
      .selectAll(".brush")
      .call(dBrushes[lev].move, null);
  }

  function removeAllBrushesBut(but) {
    for (let lev = 0; lev < dataIs.length; lev += 1) {
      if (lev === but) continue;
      removeBrushOnLevel(lev);
    }
  }

  // Assigns the indexes on the new level data
  function assignIndexes(dataIsToUpdate, level) {
    console.log("Assiging indexes ", level);
    for (let j = 0; j < dataIsToUpdate.length; j++) {
      data[dataIsToUpdate[j]].__i[level] = j;
    }
  }

  // Some actions will make obsolete certain filters, such as a resort on a previous level
  // with range filters
  function deleteObsoleteFiltersFromLevel(level) {
    for (let l = level; l < filtersByLevel.length; l++) {
      filtersByLevel[l] = filtersByLevel[l].filter(
        (f) => f.type === "value" || f.type === "negativeValue"
      );
    }
  }

  // Applies the filters for the selected level, using the passed data if any
  function applyFilters(level, _dataIs) {
    let before, after;

    _dataIs = _dataIs !== undefined ? _dataIs : dataIs;

    console.log(
        "applyFilters level=",
        level,
        " filtersByLevel ",
        filtersByLevel
      );

    before = performance.now();
    // Check if each item fits on any filter
    const negFilters = filtersByLevel[level].filter(
        (f) => f.type === "negativeValue" || f.type === "negativeRange"
      ),
      posFilters = filtersByLevel[level].filter(
        (f) => f.type !== "negativeValue" || f.type !== "negativeRange"
      );

    let filteredData = _dataIs[level].filter((d) => {
      // OR of positives, AND of negatives
      return (data[d].selected =
        posFilters.reduce((p, f) => p || f.filter(data[d]), false) &&
        negFilters.reduce((p, f) => p && f.filter(data[d]), true));
      // // Check if a possitive filter apply
      // for (let filter of posFilters) {
      //   if (filter.filter(data[d])) {
      //     data[d].selected = true;
      //     // break;
      //     return data[d].selected;
      //   }
      // }

      // for (let filter of negFilters) {
      //   if (filter.filter(data[d])) {
      //     data[d].selected = false;
      //     return data[d].selected;
      //   }
      // }

      // return true;
    });

    // let filteredData = filtersByLevel[level].reduce(reduceFilters, dataIs[level]);
    after = performance.now();
    console.log("Applying filters " + (after - before) + "ms");

    return filteredData;
  }

  function getLastLevelFromFilters() {
    let lastLevel = 0;
    for (let i = 0; i < filtersByLevel.length; i++) {
      lastLevel = i;
      if (!filtersByLevel[i] || !filtersByLevel[i].length) {
        break;
      }
    }

    return lastLevel;
  }

  function applyFiltersAndUpdate(fromLevel) {
    console.log("applyFiltersAndUpdate ", fromLevel);

    const lastLevel = getLastLevelFromFilters();

    // Start from the previous data
    let newData = dataIs;

    for (let level = fromLevel; level <= lastLevel; level++) {
      // We don't have filters for this level, delete subsequent levels
      if (
        !filtersByLevel.hasOwnProperty(level) ||
        !filtersByLevel[level].length
      ) {
        newData = deleteSubsequentLevels(level + 1, newData, {
          shouldUpdate: false,
        });
        break;
      }
      // else apply filters

      let filteredData = applyFilters(level, newData);

      //Assign the index
      assignIndexes(filteredData, level + 1);

      if (filteredData.length === 0) {
        console.log("Empty filteredData!");
        //   return;
      }
      // newData = dataIs.slice(0,level+1);

      if (nv.nestedFilters) {
        // newData.push(filteredData);
        newData[level + 1] = filteredData;
      }

      // Update sortings of the next level
      updateSorting(level + 1);
      console.log(
          `ApplyFiltersAndUpdate level ${level} filtered = ${filteredData.length} `
        );
    }

    // Update all the levels
    nv.updateData(newData, colScales, {
      shouldDrawBrushes: true,
      levelsToUpdate: d3__namespace.range(fromLevel, newData.length), // Range is not inclusive so is not length-1
    });

    console.log("All filters applied calling updateCallback", dataIs);
    updateCallback(nv.getVisible());
  }

  function updateBrushes(d, level) {
    dBrushes[level] = d3__namespace
      .brushY()
      .extent([
        [x(xScale.domain()[0], level), yScales[level].range()[0]],
        [
          x(xScale.domain()[xScale.domain().length - 1], level) +
            xScale.bandwidth() * 1.1,
          yScales[level].range()[1],
        ],
      ])
      .on("brush", brushed)
      .on("end", onSelectByRange);

    let _brush = d3__namespace
      .select(this)
      .selectAll(".brush")
      .data([
        {
          data: d.map((index) => data[index]),
          level: level,
        },
      ]);

    _brush
      .enter()
      .merge(_brush)
      .append("g")
      .call(dBrushes[level]) // brush event must be before click (?) https://observablehq.com/@d3/click-vs-drag?collection=@d3/d3-drag
      .on("mousemove", onMouseOver)
      .on("click", onSelectByValue)
      .on("mouseout", onMouseOut)
      .attr("class", "brush")      
      .selectAll("rect")
      .attr(
        "width",
        x(xScale.domain()[xScale.domain().length - 1], level) +
          xScale.bandwidth() * 1.1
      );

    _brush.exit().remove();

    function brushed(event) {
      console.log('dn', event);
      if (!event.selection) {
        console.log(
            "\uD83D\uDD8C\uFE0F Brushed",
            level,
            event.selection,
            event.type,
            event.sourceEvent
          );
        // return;
        // event.preventDefault();
        // onSelectByValueFromCoords(event.sourceEvent.clientX, event.sourceEvent.clientY);
        return; // Ignore empty selections.
      }

      if (!event.sourceEvent) return; // Only transition after input.
      console.log('dn2', event);
      onSelectByRange(event);

      // TODO do I need d3.pointer here
      const clientX = event.sourceEvent.clientX,
        clientY = event.sourceEvent.clientY,
        xOnWidget = event.sourceEvent.offsetX,
        yOnWidget = event.sourceEvent.offsetY;

      showTooptip(xOnWidget, yOnWidget, clientX, clientY, level);
    }

    function onSelectByRange(event) {
      if (!event.sourceEvent) return; // Only transition after input.
      if (!event.selection) {
        console.log(
            "Empty selection level",
            level,
            event.selection,
            event.type,
            event.sourceEvent
          );
        // return;
        // event.preventDefault();
        // onSelectByValueFromCoords(event.sourceEvent.clientX, event.sourceEvent.clientY);
        return; // Ignore empty selections.
      }

      showLoading(this);
      removeAllBrushesBut(level);

      let before = performance.now();
      let brushed = event.selection;

      let // first = dData.get(invertOrdinalScale(yScales[level], brushed[0] -yScales[level].bandwidth())),
        first = dData.get(invertOrdinalScale(yScales[level], brushed[0])),
        // last = dData.get(invertOrdinalScale(yScales[level], brushed[1] -yScales[level].bandwidth()))
        last = dData.get(invertOrdinalScale(yScales[level], brushed[1]));

      let newFilter;
      if (event.sourceEvent.altKey) {
        newFilter = new FilterByRangeNegative({
          first,
          last,
          level: level,
          itemAttr: dSortBy[level] ? dSortBy[level].attrib : "__seqId",
          getAttrib,
          getAttribName,
        });
      } else {
        newFilter = new FilterByRange({
          first,
          last,
          level: level,
          itemAttr: dSortBy[level] ? dSortBy[level].attrib : "__seqId",
          getAttrib,
          getAttribName,
        });
      }

      if (event.sourceEvent.shiftKey) {
        // First filter, create the list
        if (!(level in filtersByLevel)) {
          filtersByLevel[level] = [];
        }
        // Append the filter
        filtersByLevel[level].push(newFilter);
      } else {
        // Remove previous filters
        filtersByLevel[level] = [newFilter];
      }

      // A range filter on a former level makes range filters obsolete in subsequent levels
      deleteObsoleteFiltersFromLevel(level + 1);

      applyFiltersAndUpdate(level);

      let after = performance.now();
      console.log(
          "selectByRange filtering " + (after - before) + "ms",
          first,
          last
        );

      hideLoading(this);
    } // onSelectByRange

    function onSelectByValue(event) {
      console.log("\uD83D\uDC49\uD83C\uDFFC Select by value click", event, d3__namespace.pointer(event));
      if (event.defaultPrevented) {
        console.log(
            "Select by value click default prevented, assuming drag. return"
          );
        return;
      }
      showLoading(this);
      let clientY = d3__namespace.pointer(event)[1],
        clientX = d3__namespace.pointer(event)[0];

      onSelectByValueFromCoords(event, clientX, clientY);

      hideLoading(this);
    }

    function onSelectByValueFromCoords(event, clientX, clientY) {
      console.log("onSelectByValueFromCoords", clientX, clientY);

      removeAllBrushesBut(-1); // Remove all brushes

      const before = performance.now();
      const itemId = invertOrdinalScale(yScales[level], clientY);
      const after = performance.now();
      console.log("invertOrdinalScale " + (after - before) + "ms");

      let itemAttr = invertOrdinalScale(xScale, clientX - levelScale(level));
      if (itemAttr === undefined) {
        console.log(
          `navio.selectByValue: error, couldn't find attr in coords ${
            (clientY)
          }`
        );
        return;
      }
      itemAttr = dAttribs.get(itemAttr);

      const sel = dData.get(itemId);
      let newFilter;
      if (event.altKey) {
        newFilter = new FilterByValueDifferent({
          sel,
          itemAttr,
          getAttrib,
          getAttribName,
        });
      } else {
        newFilter = new FilterByValue({
          sel,
          itemAttr,
          getAttrib,
          getAttribName,
        });
      }
      if (event.shiftKey) {
        // First filter, create the list
        if (!filtersByLevel.hasOwnProperty(level)) {
          filtersByLevel[level] = [];
        }
        // Append the filter
        filtersByLevel[level].push(newFilter);
      } else {
        // Remove previous filters
        filtersByLevel[level] = [newFilter];
      }

      // A filter on a former level makes range filters obsolete in subsequent levels
      deleteObsoleteFiltersFromLevel(level + 1);

      applyFiltersAndUpdate(level);

      console.log(
          "Selected " + nv.getVisible().length + " calling updateCallback"
        );
    }
  } // updateBrushes

  function showTooptip(xOnWidget, yOnWidget, clientX, clientY, level) {
    let itemId;
    try {
      itemId = invertOrdinalScale(yScales[level], yOnWidget);
    } catch (e) {
      return;
    }

    let itemAttr = invertOrdinalScale(xScale, xOnWidget - levelScale(level));
    const d = dData.get(itemId);

    itemAttr = dAttribs.get(itemAttr);

    if (!d || d === undefined) {
      console.log("Couldn't find datum for tooltip y", yOnWidget, d);
      return;
    }

    tooltipCoords.x = xOnWidget;
    tooltipCoords.y = yOnWidget;

    tooltipElement.select(".tool_id").text(itemId);
    tooltipElement.select(".tool_value_name").text(getAttribName(itemAttr));
    tooltipElement.select(".tool_value_val").text(getAttrib(d, itemAttr));

    tooltipElement.style("display", "initial");

    tooltip.scheduleUpdate();

    // if ( DEBUG ) console.log("Mouse over", d);
  }

  function onMouseOver(event, overData) {
    const xOnWidget = d3__namespace.pointer(event)[0],
      yOnWidget = d3__namespace.pointer(event)[1],
      clientX = event.clientX,
      clientY = event.clientY;

    // if (event.altKey) {
    //   d3.selectAll(".overlay").style("cursor", "zoom-out");
    //   console.log("Alt!");
    // } else {
    //   d3.selectAll(".overlay").style("cursor", `url(${cursorData}) 8 8, crosshair`);
    // }
    // // console.log("key");

    if (!overData.data || overData.data.length === 0) {
      console.log("onMouseOver no data", overData);
      return;
    }

    // if (DEBUG) console.log("onMouseOver", xOnWidget, yOnWidget, clientY, event.pageY, event.offsetY, event);
    showTooptip(xOnWidget, yOnWidget, clientX, clientY, overData.level);
  }

  function onMouseOut() {
    tooltipCoords.x = -200;
    tooltipCoords.y = -200;
    tooltipElement.style("display", "none");
    tooltip.scheduleUpdate();

    // svg.select(".nvTooltip")
    //   .attr("transform", "translate(" + (-200) + "," + (-200) + ")")
    //   .call(function (tool) {
    //     tool.select(".tool_id")
    //       .text("");
    //     tool.select(".tool_value_name")
    //       .text("");
    //     tool.select(".tool_value_val")
    //       .text("");
    //   });
  }

  function drawCounts(levelOverlay, levelOverlayEnter) {
    levelOverlayEnter
      .append("text")
      .merge(levelOverlay.select("text.numNodesLabel"))
      .attr("class", "numNodesLabel")
      .style("font-family", "sans-serif")
      .style("pointer-events", "none")
      .attr("y", function (_, i) {
        return yScales[i].range()[1] + 15;
      })
      .attr("x", function (_, i) {
        return levelScale(i);
      })
      .text(function (d) {
        return nv.fmtCounts(d.length);
      });
  }

  function drawFilterExplanationsHTML(levelOverlay, levelOverlayEnter) {
    const lastAttrib = xScale.domain()[xScale.domain().length - 1],
      rightBorder = (level) => x(lastAttrib, level) + xScale.bandwidth() + 2;

    const filterExps = selection
      .select("div.explanations")
      .selectAll("div.filterExplanation")
      .data(dataIs);

    const filterExpEnter = filterExps
      .enter()
      .append("div")
      .attr("class", "filterExplanation")
      .merge(filterExps)
      .style("position", "absolute")
      .style("top", "0")
      .style("left", "0")
      .style("min-width", "200px")
      .style(
        "transform",
        (_, i) =>
          `translate(${rightBorder(i)}px, ${
            yScales[i].range()[1] + nv.filterFontSize * 1.2
          }px)`
      );

    const filterExpTexts = filterExpEnter
      // .append("div")
      // .attr("class", "filterExplanationText")
      .merge(filterExps.select(".filterExplanation"))
      .style("font-size", nv.filterFontSize + "pt")
      .selectAll("div")
      .data((_, i) =>
        filtersByLevel[i]
          ? filtersByLevel[i].map((f) => {
              f.level = i;
              return f;
            })
          : []
      );

    filterExpTexts
      .enter()
      .append("div")
      .merge(filterExpTexts)
      // .attr("dy", nv.filterFontSize * 1.2 + 7)
      // .attr("x", 0)
      .style("cursor", "not-allowed")
      .text((f) => "\u24CD " + f.toStr())
      .on("click pointerup", (event, f, i) => {
        console.log("Click remove filter", i, f);
        filtersByLevel[f.level].splice(i, 1);

        applyFiltersAndUpdate(f.level);
      });

    filterExpTexts.exit().remove();
    filterExps.exit().remove();
  }

  function drawAttribHeaders(attribOverlay, attribOverlayEnter) {
    if (nv.showAttribTitles) {
      attribOverlayEnter
        .append("text")
        .merge(attribOverlay.select("text"))
        .style("cursor", "point")
        .style("-webkit-user-select", "none")
        .style("-moz-user-select", "none")
        .style("-ms-user-select", "none")
        .style("user-select", "none")
        .text(function (d) {
          return d.attrib === "__seqId"
            ? "sequential Index"
            : d.name +
                (dSortBy[d.level] !== undefined &&
                dSortBy[d.level].attrib === d.attrib
                  ? dSortBy[d.level].desc
                    ? " \u2193"
                    : " \u2191"
                  : "");
        })
        .attr("x", xScale.bandwidth() / 2)
        .attr("y", 0)
        .style("font-weight", function (d) {
          return dSortBy[d.level] !== undefined &&
            dSortBy[d.level].attrib === d.attrib
            ? "bolder"
            : "normal";
        })
        .style("font-family", "sans-serif")
        .style("font-size", function () {
          // make it grow ?
          // if (dSortBy[d.level]!==undefined &&
          //   dSortBy[d.level].attrib === d.attrib )
          // d3.select(this).dispatch("mousemove");
          return Math.min(nv.attribFontSize, nv.attribWidth) + "px";
        })
        .call(
          d3__namespace
            .drag()
            .container(attribOverlayEnter.merge(attribOverlay).node())
            .on("start", attribDragstarted)
            .on("drag", attribDragged)
            .on("end", attribDragended)
        )
        .on("click", deferEvent(onSortLevel))
        // .on("click", onSortLevel)
        .on("mousemove", function () {
          let sel = d3__namespace.select(this);
          sel =
            sel.transition !== undefined ? sel.transition().duration(150) : sel;
          sel.style("font-size", nv.attribFontSizeSelected + "px");
        })
        .on("mouseout", function () {
          let sel = d3__namespace.select(this);
          sel =
            sel.transition !== undefined ? sel.transition().duration(150) : sel;
          sel.style(
            "font-size",
            Math.min(nv.attribFontSize, nv.attribWidth) + "px"
          );
        })
        .attr("transform", `rotate(${nv.attribRotation})`);
    } // if (nv.showAttribTitles) {
  }

  function drawAttributesHolders(levelOverlay, levelOverlayEnter) {
    let attribs = attribsOrdered;

    let attribOverlay = levelOverlayEnter
      .merge(levelOverlay)
      .selectAll(".attribOverlay")
      .data(function (_, i) {
        return attribs.map(function (a) {
          return {
            attrib: a,
            name: getAttribName(a),
            level: i,
          };
        });
      });

    let attribOverlayEnter = attribOverlay
      .enter()
      .append("g")
      .attr("class", "attribOverlay")
      .style("cursor", "pointer");

    attribOverlayEnter
      .merge(attribOverlay)
      .attr(
        "transform",
        (d) =>
          `translate(${x(d.name, d.level)}, ${yScales[d.level].range()[0]})`
      );

    attribOverlayEnter
      .append("rect")
      .merge(attribOverlay.select("rect"))

      .attr("fill", "none")
      // .style("opacity", "0.1")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", function () {
        return xScale.bandwidth() * 1.1;
      })
      .attr("height", function (d) {
        return yScales[d.level].range()[1] - yScales[d.level].range()[0];
      });

    drawAttribHeaders(attribOverlay, attribOverlayEnter);

    attribOverlay.exit().remove();
  }

  function drawBrushes(recomputeBrushes) {
    let levelOverlay = svg
      .select(".attribs")
      .selectAll(".levelOverlay")
      .data(dataIs);

    let levelOverlayEnter = levelOverlay.enter().append("g");

    levelOverlayEnter.attr("class", "levelOverlay").attr("id", function (d, i) {
      return "level" + i;
    });

    // Bugfix: when adding all attribs we need to update the brush
    if (recomputeBrushes) {
      levelOverlayEnter.merge(levelOverlay).each(updateBrushes);
    } else {
      levelOverlayEnter.each(updateBrushes);
    }

    drawAttributesHolders(levelOverlay, levelOverlayEnter);
    drawCounts(levelOverlay, levelOverlayEnter);
    // drawFilterExplanations(levelOverlay, levelOverlayEnter);
    drawFilterExplanationsHTML();

    levelOverlay.exit().remove();
  } // drawBrushes

  function attribDragstarted(event, d) {
    console.log("attrib drag start", d);
    if (!event.sourceEvent.shiftKey) return;

    d3__namespace.select(this.parentNode).attr("transform", function (d) {
      return (
        "translate(" +
        (event.x + nv.attribFontSize / 2) +
        "," +
        yScales[d.level].range()[0] +
        ")"
      );
    });
  }

  function attribDragged(event) {
    if (!event.sourceEvent.shiftKey) return;

    d3__namespace.select(this.parentNode).attr("transform", function (d) {
      return (
        "translate(" +
        (event.x + nv.attribFontSize / 2) +
        "," +
        yScales[d.level].range()[0] +
        ")"
      );
    });
  }

  function attribDragended(event, d) {
    console.log("attrib drag end", d);
    if (!event.sourceEvent.shiftKey) return;

    let attrDraggedInto = invertOrdinalScale(
      xScale,
      event.x + nv.attribFontSize / 2 - levelScale(d.level)
    );
    attrDraggedInto = dAttribs.get(attrDraggedInto);

    let pos;
    d3__namespace.select(this.parentNode).attr("transform", function (d) {
      return (
        "translate(" +
        x(d.name, d.level) +
        "," +
        yScales[d.level].range()[0] +
        ")"
      );
    });

    if (attrDraggedInto !== d.attrib) {
      pos = attribsOrdered.indexOf(attrDraggedInto);
      moveAttrToPos(d.attrib, pos);
      nv.updateData(dataIs);
    }
  }

  function drawCloseButton() {
    let maxLevel = dataIs.length - 1;
    svg
      .select("#closeButton")
      .style("display", dataIs.length === 1 ? "none" : "block")
      .attr(
        "transform",
        "translate(" +
          (levelScale(maxLevel) +
            levelScale.bandwidth() -
            nv.levelsSeparation +
            15) +
          "," +
          yScales[maxLevel].range()[0] +
          ")"
      );
  }

  // Links between nodes
  function drawLink(link) {
    let lastAttrib = xScale.domain()[xScale.domain().length - 1],
      rightBorder = x(lastAttrib, dataIs.length - 1) + xScale.bandwidth() + 2,
      ys =
        yScales[dataIs.length - 1](link.source[id]) +
        yScales[dataIs.length - 1].bandwidth() / 2,
      yt =
        yScales[dataIs.length - 1](link.target[id]) +
        yScales[dataIs.length - 1].bandwidth() / 2,
      miny = Math.min(ys, yt),
      maxy = Math.max(ys, yt),
      midy = maxy - miny;
    context.moveTo(rightBorder, miny); //starting point
    context.quadraticCurveTo(
      rightBorder + midy / 6,
      miny + midy / 2, // mid point
      rightBorder,
      maxy // end point
    );
  }

  function drawLinks() {
    if (!links.length) return;
    console.log("Draw links ", links[links.length - 1].length, links);
    context.save();
    context.beginPath();
    context.strokeStyle = nv.linkColor;
    context.globalAlpha = Math.min(
      1,
      Math.max(0.1, 1000 / links[links.length - 1].length)
    ); // More links more transparency
    // context.lineWidth = 0.5;
    for (let link of visibleLinks) {
      drawLink(link);
    }
    // visibleLinks.forEach(drawLink);
    context.stroke();
    context.restore();
  }

  function drawLine(points, width, color, close) {
    context.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) {
        context.moveTo(p.x, p.y);
      } else {
        context.lineTo(p.x, p.y);
      }
    }
    context.lineWidth = width;
    if (close) {
      context.fillStyle = color;
      context.closePath();
      context.fill();
    } else {
      context.strokeStyle = color;
      context.stroke();
    }
  }

  function drawLevelConnections(level) {
    if (level <= 0) {
      return;
    }
    for (let item of dataIs[level].representatives) {
      // Compute the yPrev by calculating the index of the corresponding representative
      let iOnPrev = dData.get(data[item][id]).__i[level - 1];
      let iRep = Math.floor(
        iOnPrev - (iOnPrev % dataIs[level - 1].itemsPerpixel)
      );
      // if (DEBUG) console.log("i rep = "+ iRep);
      // if (DEBUG) console.log(data[level-1][iRep]);
      // if (DEBUG) console.log(yScales[level-1](data[level-1][iRep][id]));
      let locPrevLevel = {
        x: levelScale(level - 1) + xScale.range()[1],
        y: yScales[level - 1](data[dataIs[level - 1][iRep]][id]),
      };
      let locLevel = {
        x: levelScale(level),
        y: yScales[level](data[item][id]),
      };

      let points = [
        locPrevLevel,
        { x: locPrevLevel.x + nv.levelsSeparation * 0.3, y: locPrevLevel.y },
        { x: locLevel.x - nv.levelsSeparation * 0.3, y: locLevel.y },
        locLevel,
        { x: locLevel.x, y: locLevel.y + yScales[level].bandwidth() },
        {
          x: locLevel.x - nv.levelsSeparation * 0.3,
          y: locLevel.y + yScales[level].bandwidth(),
        },
        {
          x: locPrevLevel.x + nv.levelsSeparation * 0.3,
          y: locPrevLevel.y + yScales[level - 1].bandwidth(),
        },
        {
          x: locPrevLevel.x,
          y: locPrevLevel.y + yScales[level - 1].bandwidth(),
        },
        locPrevLevel,
      ];
      drawLine(points, 1, nv.levelConnectionsColor);
      drawLine(points, 1, nv.levelConnectionsColor, true);
    }
  }

  function computeRepresentatives(levelToUpdate) {
    console.log("Compute representatives levels", levelToUpdate);
    let representatives = [];
    if (dataIs[levelToUpdate].length > height) {
      const itemsPerpixel = Math.max(
        Math.floor(dataIs[levelToUpdate].length / (height * 2)),
        1
      );
      console.log("itemsPerpixel", itemsPerpixel);
      dataIs[levelToUpdate].itemsPerpixel = itemsPerpixel;
      for (let i = 0; i < dataIs[levelToUpdate].length; i += itemsPerpixel) {
        representatives.push(dataIs[levelToUpdate][i]);
      }
    } else {
      dataIs[levelToUpdate].itemsPerpixel = 1;
      representatives = dataIs[levelToUpdate];
    }
    dataIs[levelToUpdate].representatives = representatives;
    return representatives;
  }

  function updateColorDomains() {
    console.log("Update color scale domains");
    // colScales = new Map();
    for (let attrib of attribsOrdered) {
      if (attrib === "selected") continue;

      let scale = colScales.get(attrib);
      if (scale.__type === "seq" || scale.__type === "date") {
        scale.domain(
          d3__namespace.extent(
            dataIs[0].map(function (i) {
              return getAttrib(data[i], attrib);
            })
          )
        ); //TODO: make it compute it based on the local range
      } else if (scale.__type === "div") {
        const [min, max] = d3__namespace.extent(
          dataIs[0].map(function (i) {
            return getAttrib(data[i], attrib);
          })
        );
        const absMax = Math.max(-min, max); // Assumes diverging point on 0
        scale.domain([-absMax, absMax]);
      } else if (scale.__type === "text" || scale.__type === "ordered") {
        scale.domain(dataIs[0].map((i) => getAttrib(data[i], attrib)));
      }

      colScales.set(getAttribName(attrib), scale);
    }
  }

  function updateScales(opts) {
    let { levelsToUpdate, shouldUpdateColorDomains } = opts || {};
    console.log("Update scales");

    const before = performance.now();

    const lastLevel = dataIs.length - 1;
    levelsToUpdate =
      levelsToUpdate !== undefined ? levelsToUpdate : [lastLevel];
    shouldUpdateColorDomains =
      shouldUpdateColorDomains !== undefined ? shouldUpdateColorDomains : false;

    // Delete unvecessary scales
    console.log("Delete unvecessary scales");
    yScales.splice(lastLevel + 1, yScales.length);

    for (let levelToUp of levelsToUpdate) {
      yScales[levelToUp] = d3__namespace
        .scaleBand()
        .range([nv.y0, height - nv.margin - 30])
        .paddingInner(0.0)
        .paddingOuter(0);

      // Compute Representatives
      const representatives = computeRepresentatives(levelToUp);

      // Update x and y scales
      yScales[levelToUp].domain(
        representatives.map(function (rep) {
          return data[rep][id];
        })
      );
    }

    xScale
      .domain(attribsOrdered.map((d) => getAttribName(d)))
      .range([0, nv.attribWidth * Array.from(dAttribs.keys()).length])
      .paddingInner(0.1)
      .paddingOuter(0);
    levelScale
      .domain(
        dataIs.map(function (d, i) {
          return i;
        })
      )
      .range([
        nv.x0 + nv.margin,
        (xScale.range()[1] + nv.levelsSeparation) * dataIs.length + nv.x0,
      ])
      .paddingInner(0)
      .paddingOuter(0);

    // Update color scales domains
    if (shouldUpdateColorDomains) {
      updateColorDomains();
    }

    const after = performance.now();
    console.log("Updating Scales " + (after - before) + "ms");
  }

  // Deletes the last level by default, or all the subsequent levels of _level on _dataIs
  function deleteSubsequentLevels(_level, _dataIs, opts) {
    if (dataIs.length <= 1) return;

    let { shouldUpdate } = opts || {};

    let level = _level !== undefined ? _level : dataIs.length - 1;
    _dataIs = _dataIs !== undefined ? _dataIs : dataIs;
    shouldUpdate = shouldUpdate !== undefined ? shouldUpdate : true;

    if (!_dataIs.hasOwnProperty(level)) {
      console.log("Asked to delete a level that doens't exist ", level);
      return _dataIs;
    }

    showLoading(this);
    console.log("Delete one level", level);
    if (level > 0) {
      removeBrushOnLevel(level - 1);

      for (let d of _dataIs[level - 1]) {
        data[d].selected = true;
      }

      if (
        filtersByLevel.hasOwnProperty(level - 1) &&
        filtersByLevel[level - 1].length
      ) {
        // Cleanup filters from the previous level
        for (let i = 0; i < filtersByLevel[level - 1].length; i++) {
          delete filtersByLevel[level - 1][i];
        }
      }
      filtersByLevel[level - 1] = [];
    }

    _dataIs.splice(level);

    if (shouldUpdate) {
      nv.updateData(_dataIs, colScales);
      updateCallback(nv.getVisible());
    }

    hideLoading(this);
    return _dataIs;
  }

  function moveAttrToPos(attr, pos) {
    let i = attribsOrdered.indexOf(attr);
    if (i === -1) {
      console.log("moveAttrToPos attr not found", attr);
      return;
    }
    if (pos > attribsOrdered.length || pos < 0) {
      console.log(
        "moveAttrToPos pos out of bounds",
        pos,
        attribsOrdered.length
      );
      return;
    }
    attribsOrdered.splice(i, 1);
    attribsOrdered.splice(pos, 0, attr);
  }

  function findNotNull(data, attr) {
    let i, val;
    for (
      i = 0;
      i < nv.howManyItemsShouldSearchForNotNull && i < data.length;
      i++
    ) {
      val = typeof attr === "function" ? attr(data[i]) : data[i][attr];
      if (val !== null && val !== undefined && val !== "") {
        return val;
      }
    }

    return val;
  }

  function recomputeVisibleLinks() {
    if (links.length > 0) {
      visibleLinks = links.filter(function (d) {
        return d.source.selected && d.target.selected;
      });
    }
  }

  function updateLevel(levelData, i) {
    drawLevelBorder(i);
    for (let rep of levelData.representatives) {
      drawItem(data[rep], i);
    }

    drawLevelConnections(i);
  }

  function updateWidthAndHeight() {
    const ctxWidth = levelScale.range()[1] + nv.margin + nv.x0;
    console.log("updateWidthAndHeight: ", ctxWidth, height);
    const scale = window.devicePixelRatio || 1;
    d3__namespace.select(canvas)
      .attr("width", ctxWidth * scale)
      .attr("height", height * scale)
      .style("width", ctxWidth)
      .style("height", height + "px");
    canvas.style.width = ctxWidth + "px";
    canvas.style.height = height + "px";

    context.scale(scale, scale);

    svg.attr("width", ctxWidth).attr("height", height);
  }

  nv.initData = function (mData, mColScales) {
    let before = performance.now();

    // getAttribsFromObject(mData[0][0]);
    colScales = mColScales;
    // colScales.keys().forEach(function (d) {
    //   dAttribs.set(d, true);
    // });
    dData = new Map();
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      d.__seqId = i; //create a default id with the sequential number
      dData.set(d[id], d);
      d.__i = [];
      d.__i[0] = i;
    }

    filtersByLevel = [];
    filtersByLevel[0] = []; // Initialice filters as empty for lev 0
    // nv.updateData(mData, mColScales, mSortByAttr);

    let after = performance.now();
    console.log("Init data " + (after - before) + "ms");
  };

  nv.updateData = function (mDataIs, mColScales, opts) {
    const {
      levelsToUpdate,
      shouldUpdateColorDomains,
      shouldDrawBrushes,
      recomputeBrushes,
    } = opts || {};

    console.log("updateData");
    let before = performance.now();

    if (typeof mDataIs !== typeof []) {
      console.log("navio updateData didn't receive an array");
      return;
    }

    colScales = mColScales !== undefined ? mColScales : colScales;
    dataIs = mDataIs;

    // Delete filters on unused levels
    filtersByLevel.splice(mDataIs.length);
    // Initialize new filter level
    filtersByLevel[mDataIs.length] = [];

    recomputeVisibleLinks();

    // Delete unnecesary brushes
    dBrushes.splice(mDataIs.length);

    updateScales({
      levelsToUpdate,
      shouldUpdateColorDomains,
    });

    updateWidthAndHeight();

    nv.update({
      levelsToUpdate,
      shouldDrawBrushes,
      recomputeBrushes,
    });

    let after = performance.now();
    console.log("Updating data " + (after - before) + "ms");
  }; // updateData

  nv.update = function (opts) {
    let {
      recomputeBrushes,
      // levelsToUpdate,
      shouldDrawBrushes,
    } = opts || {};

    if (!dataIs.length) return nv;

    recomputeBrushes =
      recomputeBrushes !== undefined ? recomputeBrushes : false;
    shouldDrawBrushes =
      shouldDrawBrushes !== undefined ? shouldDrawBrushes : true;

    let before = performance.now();

    let w = levelScale.range()[1] + nv.margin + nv.x0;

    // If updating all levels erase everything
    // if (levelsToUpdate===undefined) {
    context.clearRect(0, 0, w + 1, height + 1);
    // }

    drawLinks();

    // If we didn't get a specific level to update, do them all
    // if (levelsToUpdate===undefined) {

    for (let i = 0; i < dataIs.length; i++) {
      updateLevel(dataIs[i], i);
    }
    // } else {

    //   levelToUpdate.forEach(levelToUp => {
    //     if (! dataIs.length.hasOwnProperty(levelToUp)) {
    //       updateLevel(dataIs[levelToUp], levelToUp);
    //     } else {
    //       if (DEBUG) console.log("Asked to update a level that doesn't exist, ignoring. Level=" , levelToUp, " levs to update" levelsToUpdate);
    //     }

    //   });
    // }

    if (shouldDrawBrushes) {
      drawBrushes(recomputeBrushes);
      drawCloseButton();
    }

    let after = performance.now();
    console.log("Redrawing " + (after - before) + "ms");
    return nv;
  };

  nv.addAttrib = function (attr, scale) {
    if (scale === undefined) {
      scale = d3__namespace.scaleOrdinal(d3__namespace.schemeCategory10);
    }
    if (dAttribs.has(getAttribName(attr))) {
      console.log(`navio.addAttrib attribute ${attr} already added`);
      return;
    }
    attribsOrdered.push(attr);
    dAttribs.set(getAttribName(attr), attr);
    colScales.set(attr, scale);
    return nv;
  };

  nv.addSequentialAttrib = function (attr, _scale) {
    const domain =
      data !== undefined && data.length > 0
        ? d3__namespace.extent(data, function (d) {
            return getAttrib(d, attr);
          })
        : [0, 1]; //if we don"t have data, set the default domain
    const scale =
      _scale || d3__namespace.scaleSequential(nv.defaultColorInterpolator).domain(domain);
    scale.__type = "seq";
    nv.addAttrib(attr, scale);
    return nv;
  };

  // Same as addSequentialAttrib but with a different color
  nv.addDateAttrib = function (attr, _scale) {
    const domain =
      data !== undefined && data.length > 0
        ? d3__namespace.extent(data, function (d) {
            return getAttrib(d, attr);
          })
        : [0, 1];

    const scale =
      _scale ||
      d3__namespace.scaleSequential(nv.defaultColorInterpolatorDate).domain(domain); //if we don"t have data, set the default domain
    nv.addAttrib(attr, scale);

    scale.__type = "date";
    return nv;
  };

  // Adds a diverging scale
  nv.addDivergingAttrib = function (attr, _scale) {
    const domain =
      data !== undefined && data.length > 0
        ? d3__namespace.extent(data, function (d) {
            return getAttrib(d, attr);
          })
        : [-1, 1];
    const scale =
      _scale ||
      d3__namespace
        .scaleSequential(nv.defaultColorInterpolatorDiverging)
        .domain([domain[0], domain[1]]); //if we don"t have data, set the default domain
    scale.__type = "div";
    nv.addAttrib(attr, scale);
    return nv;
  };

  nv.addCategoricalAttrib = function (attr, _scale) {
    const scale = _scale || d3__namespace.scaleOrdinal(nv.defaultColorCategorical);
    scale.__type = "cat";
    nv.addAttrib(attr, scale);

    return nv;
  };

  nv.addTextAttrib = function (attr, _scale) {
    const scale =
      _scale ||
      scaleText(
        nv.nullColor,
        nv.digitsForText,
        nv.defaultColorInterpolatorText
      );

    nv.addAttrib(attr, scale);

    return nv;
  };

  nv.addOrderedAttrib = function (attr, _scale) {
    const scale =
      _scale || scaleOrdered(nv.nullColor, nv.defaultColorInterpolatorOrdered);

    nv.addAttrib(attr, scale);

    return nv;
  };

  nv.addBooleanAttrib = function (attr, _scale) {
    const scale =
      _scale ||
      d3__namespace
        .scaleOrdinal()
        .domain([true, false, null])
        .range(nv.defaultColorRangeBoolean);

    scale.__type = "bool";
    nv.addAttrib(attr, scale);

    return nv;
  };

  // Adds all the attributes on the data, or all the attributes provided on the list based on their types
  nv.addAllAttribs = function (_attribs) {
    if (!data || !data.length)
      throw Error(
        "addAllAttribs called without data to guess the attribs. Make sure to call it after setting the data"
      );

    let attribs =
      _attribs !== undefined
        ? _attribs
        : getAttribsFromObjectAsFn(data[0], nv.addAllAttribsRecursionLevel);
    for (let attr of attribs) {
      if (attr === "__seqId" || attr === "__i" || attr === "selected") continue;

      const attrName = typeof attr === "function" ? attr.name : attr;
      const firstNotNull = findNotNull(data, attr);

      if (
        firstNotNull === null ||
        firstNotNull === undefined ||
        typeof firstNotNull === typeof ""
      ) {
        const numDistictValues = new Set(
          data
            .slice(0, nv.howManyItemsShouldSearchForNotNull)
            .map((d) => getAttrib(d, attr))
        ).size;

        // How many different elements are there
        if (numDistictValues < nv.maxNumDistictForCategorical) {
          console.log(
            `Navio: Adding attr ${attrName} as categorical with ${numDistictValues} categories`
          );
          nv.addCategoricalAttrib(attr);
        } else if (numDistictValues < nv.maxNumDistictForOrdered) {
          nv.addOrderedAttrib(attr);
          console.log(
            `Navio: Attr ${attrName} has more than ${nv.maxNumDistictForCategorical} distinct values (${numDistictValues}) using orderedAttrib`
          );
        } else {
          console.log(
            `Navio: Attr ${attrName} has more than ${nv.maxNumDistictForOrdered} distinct values (${numDistictValues}) using textAttrib`
          );
          nv.addTextAttrib(attr);
        }
      } else if (typeof firstNotNull === typeof 0) {
        // Numbers
        if (d3__namespace.min(data, (d) => getAttrib(d, attr)) < 0) {
          console.log(`Navio: Adding attr ${attrName} as diverging`);
          nv.addDivergingAttrib(attr);
        } else {
          console.log(`Navio: Adding attr ${attrName} as sequential`);
          nv.addSequentialAttrib(attr);
        }
      } else if (firstNotNull instanceof Date) {
        console.log(`Navio: Adding attr ${attrName} as date`);
        nv.addDateAttrib(attr);
      } else if (typeof firstNotNull === typeof true) {
        console.log(`Navio: Adding attr ${attrName} as boolean`);
        nv.addBooleanAttrib(attr);
      } else {
        // Default categories

        if (Array.isArray(firstNotNull)) {
          if (nv.addAllAttribsIncludeArrays) {
            console.log(
              `Navio: Adding ${attrName} adding as categorical (type=array)`
            );
            nv.addCategoricalAttrib(attr);
          } else {
            console.log(
              `Navio: AddAllAttribs detected array ${attrName}, but ignoring it. To include it set nv.addAllAttribsIncludeArrays=true`
            );
          }
        } else {
          if (nv.addAllAttribsIncludeObjects) {
            console.log(
              `Navio: Adding object ${attrName} adding as categorical (type=object)`
            );
            nv.addCategoricalAttrib(attr);
          } else {
            console.log(
              `Navio: AddAllAttribs detected object ${attrName}, but ignoring it. To include it set nv.addAllAttribsIncludeObjects=true`
            );
          }
        }
      }
    }

    nv.data(data);
    // drawBrushes(true); // updates brushes width
    return nv;
  };

  nv.data = function (_) {
    initTooltipPopper();

    if (nv.showSelectedAttrib && !colScales.has("selected")) {
      nv.addAttrib(
        "selected",
        d3__namespace
          .scaleOrdinal()
          .domain([false, true])
          .range(nv.defaultColorRangeSelected)
        //, "#cddca3", "#8c6d31", "#bd9e39"]
      );
      moveAttrToPos("selected", 0);
    }
    if (nv.showSequenceIDAttrib && !colScales.has("__seqId")) {
      nv.addSequentialAttrib("__seqId");
      moveAttrToPos("__seqId", 1);
    }

    if (arguments.length) {
      data = _.slice(0);
      for (let d of data) {
        d.selected = true;
      }
      dataIs = [
        data.map(function (_, i) {
          return i;
        }),
      ];

      nv.initData(dataIs, colScales);

      // Has the user added attributes already? then update
      if (
        attribsOrdered.length >
        (nv.showSelectedAttrib ? 1 : 0) + (nv.showSequenceIDAttrib ? 1 : 0)
      ) {
        nv.updateData(dataIs, colScales, { shouldUpdateColorDomains: true });
      }

      return nv;
    } else {
      return data;
    }
  };

  nv.getSelected = function () {
    return dataIs[dataIs.length - 1]
      .filter(function (d) {
        return data[d].selected;
      })
      .map(function (d) {
        return data[d];
      });
  };
  // Legacy support
  nv.getVisible = nv.getSelected;

  nv.sortBy = function (_attrib, _desc = false, _level = undefined) {
    // The default level is the last one
    let level = Math.max(
      0,
      _level !== undefined && _level < dataIs.length
        ? _level
        : dataIs.length - 1
    );

    if (_attrib !== undefined) {
      // if (attribsOrdered.indexOf(_attrib)===-1) {
      //   throw `sortBy: ${_attrib} is not in the list of attributes`
      // }
      dSortBy[level] = {
        attrib: _attrib,
        desc: _desc,
      };
      return nv.update();
    } else {
      return dSortBy[level];
    }
  };

  nv.updateCallback = function (_) {
    return arguments.length ? ((updateCallback = _), nv) : updateCallback;
  };

  nv.selectedColorRange = function (_) {
    return arguments.length
      ? ((nv.defaultColorRangeSelected = _), nv)
      : nv.defaultColorRangeSelected;
  };

  // nv.defaultColorInterpolator = function(_) {
  //   return arguments.length ? (nv.defaultColorInterpolator = _, nv) : nv.defaultColorInterpolator;
  // };

  nv.id = function (_) {
    return arguments.length ? ((id = _), nv) : id;
  };

  nv.links = function (_) {
    if (arguments.length) {
      links = _;
      recomputeVisibleLinks();
      return nv;
    } else {
      return links;
    }
  };

  // Returns a d3.scale used for coloring the corresponding attrib
  // check scale.__type for finding out the type of attribute (if undefined, navio doesn't know the type)
  nv.getColorScale = function (attrib) {
    return colScales.get(attrib);
  };

  // Returns an array with the list (in order) of attributes used right now
  nv.getAttribs = function () {
    return attribsOrdered;
  };

  // Slower update that recomputes brushes and checks for parameters.
  // Use it if you change any parameters or added new attributes after calling .data
  nv.hardUpdate = function (opts = {}) {
    const shouldDrawBrushes =
        opts.shouldDrawBrushes !== undefined ? opts.shouldDrawBrushes : true,
      shouldUpdateColorDomains =
        opts.shouldUpdateColorDomains !== undefined
          ? opts.shouldUpdateColorDomains
          : true,
      recomputeBrushes =
        opts.recomputeBrushes !== undefined ? opts.recomputeBrushes : true,
      levelsToUpdate =
        opts.levelsToUpdate !== undefined
          ? opts.levelsToUpdate
          : d3__namespace.range(dataIs.length); // Range is not inclusive so is not length-1;

    // Update all the levels
    nv.updateData(dataIs, colScales, {
      shouldDrawBrushes,
      shouldUpdateColorDomains,
      recomputeBrushes,
      levelsToUpdate,
    });
  };

  init();
  return nv;
}

// Returns a flat array with all the attributes in an object up to recursionLevel
navio.getAttribsFromObjectRecursive = getAttribsFromObjectRecursive;
// Returns a flat array with all the attributes in an object up to recursionLevel, for nested attributes returns a function
navio.getAttribsFromObjectAsFn = getAttribsFromObjectAsFn;

// export { getAttribsFromObjectRecursive } from "./utils.js";
// export {NavioComponent, navio};

return navio;

}));

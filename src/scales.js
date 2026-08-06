import * as d3 from "d3";

// Like d3.ascending but supporting null
export function d3AscendingNull(a, b) {
  if (b === null || b === undefined) {
    if (a === null || a === undefined)
      return 0; // a == b == null
    else return 1; // b==null a!=null
  } else {
    // b!=null
    if (a === null || a === undefined) return -1;
    else {
      // Both are non null
      if (typeof a !== typeof b) {
        a = "" + a;
        b = "" + b; //If they have different types, convert them to strings
      }

      if (a < b) return -1;
      else if (a > b) return 1;
      else if (a >= b) return 0;
      else return NaN;
    }
  }
}

export function d3DescendingNull(a, b) {
  if (b === null || b === undefined) {
    if (a === null || a === undefined)
      return 0; // a == b == null
    else return -1; // b==null a!=null
  } else {
    // b!=null
    if (a === null || a === undefined) return 1;
    else {
      // Both are non null
      if (typeof a !== typeof b) {
        a = "" + a;
        b = "" + b; //If they have different types, convert them to strings
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
export function scaleText(nullColor, digits = 1, defaultColorInterpolator) {
  const DEBUG = false;

  // const defaultColorInterpolator = "interpolateGreys" in d3 ? d3.interpolateGreys : interpolateGreys; // Hack to keep it working with d3.v4
  let scale = d3.scaleSequential(defaultColorInterpolator),
    dRepresentativesCounts = new Map(), // Contains the counts for each letter/substrg
    dRepresentativesIndexes = new Map();

  const stringify = (d) => d + "";
  // const stringify = JSON.stringify;

  /**
   * The only part of a value this scale ever looks at: its first `digits`
   * characters.
   *
   * Exposed (as compute.reduce) so a caller scanning a large column can fold it
   * into its own pass instead of collecting one entry per distinct FULL value.
   * The two are interchangeable: reducing before or after de-duplicating yields
   * the same key set, so the same sort order, so the same index for every value
   * and the same colour. Reducing an already-reduced value is a no-op, which is
   * what makes domain() safe to call with either.
   *
   * Falsy values pass through untouched - compute() maps them to nullColor and
   * they must not collapse into each other on the way in.
   */
  const reduce = (d) => (d ? stringify(d).slice(0, digits) : d);

  // Computes the actual value, based on the index of the first digits in the domain
  function compute(d) {
    if (!d) return nullColor;

    if (d && typeof d !== typeof "") {
      d = stringify(d); // Force text
    }

    let ci = dRepresentativesIndexes.get(d.slice(0, digits));
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
    if (DEBUG)
      console.log(
        `scaleText Compute representatives found ${Array.from(dRepresentativesCounts.keys()).length} categories `
      );
    const ret = {
      counts: dRepresentativesCounts,
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

  compute.digits = function (_) {
    return arguments.length ? ((digits = _), compute) : digits;
  };

  compute.scale = function (_) {
    return arguments.length ? ((scale = _), compute) : scale;
  };

  compute.domain = function (data) {
    if (DEBUG) console.log(`🚀 scaleText domain data.length=${data.length}`);
    if (arguments.length) {
      // Compute representatives for letters/substrings
      computeRepresentatives(
        data
          // .filter(d => typeof(d) === typeof(""))
          .map(reduce)
      );
      if (DEBUG)
        console.log(
          `scaleText domain reps.length=${Array.from(dRepresentativesCounts.keys()).length}`
        );
      scale.domain([0, Array.from(dRepresentativesCounts.keys()).length]);
      return compute;
    } else {
      return scale.domain();
    }
  };

  compute.computeRepresentatives = computeRepresentatives;
  compute.reduce = reduce;
  compute.__type = "text";

  return compute;
}

// A fake scale that uses the ranked order for coloring
export function scaleOrdered(nullColor, defaultColorInterpolator) {
  const DEBUG = false;

  let scale = d3.scaleOrdinal();
  // dRepresentativesCounts = new Map(), // Contains the counts for each letter/substrg
  // dRepresentativesIndexes = new Map();

  // Computes the actual value, based on the index of the first digits in the domain
  function compute(d) {
    if (d === undefined || d === null) return nullColor;
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
    for (let v of data.sort((a, b) => d3AscendingNull(a, b))) {
      if (prev !== v) {
        vals.push(v);
        prev = v;
      }
    }

    return vals;
  }

  compute.domain = function (data) {
    if (DEBUG) console.log(`scaleOrdered domain data.lengt=${data.length}`);
    if (arguments.length) {
      // Compute representatives for letters/substrings
      const values = computeRepresentatives(data);

      scale
        .domain(values)
        .range(
          values.map((_, i) => defaultColorInterpolator(i / values.length))
        );

      if (DEBUG)
        console.log(
          "scaleOrdered domain",
          values.length,
          scale.domain(),
          scale.range()
        );
      return compute;
    } else {
      return scale.domain();
    }
  };

  compute.computeRepresentatives = computeRepresentatives;
  compute.__type = "ordered";

  return compute;
}

// // A fake scale that tries to convert the value to a string using JSON.stringify and then uses textScale
// export function scaleObject(nullColor, digits = 20, defaultColorInterpolator) {
//   const DEBUG = false;

//   // const defaultColorInterpolator = "interpolateGreys" in d3 ? d3.interpolateGreys : interpolateGreys; // Hack to keep it working with d3.v4
//   let scale = d3.scaleSequential(defaultColorInterpolator),
//     dRepresentativesCounts = new Map(), // Contains the counts for each letter/substrg
//     dRepresentativesIndexes = new Map();

//   // Computes the actual value, based on the index of the first digits in the domain
//   function compute(d) {
//     if (typeof(d)!==typeof("")) {
//       d = d + ""; // Force text
//     }

//     let ci = dRepresentativesIndexes.get(
//       d.slice(0, digits)
//     );
//     if (ci === undefined) {
//       console.log(
//         `scaleText Couldn't find index for ${d} did you call domain? Using ascii of first letter`
//       );
//       ci = d
//         // .slice(0, digits)
//         .charCodeAt(0);
//     }
//     return scale(ci) || nullColor;
//   }

//   function computeRepresentatives(data, doIndex = true) {
//     dRepresentativesCounts = new Map();
//     for (let v of data) {
//       //Initialize
//       if (!dRepresentativesCounts.has(v)) dRepresentativesCounts.set(v, 0);

//       //count+=1
//       dRepresentativesCounts.set(v, dRepresentativesCounts.get(v) + 1);
//     }
//     if (DEBUG)
//       console.log(
//         `scaleText Compute representatives found ${Array.from(dRepresentativesCounts.keys()).length} categories `
//       );
//     const ret = {
//       counts: dRepresentativesCounts
//     };

//     if (doIndex) {
//       // Compute the indexes of each representative
//       dRepresentativesIndexes = new Map();
//       let i = 0;
//       for (let r of Array.from(dRepresentativesCounts.keys()).sort()) {
//         dRepresentativesIndexes.set(r, i++);
//       }
//       ret.indexes = dRepresentativesIndexes;
//     }

//     return ret;
//   }

//   compute.digits = function(_) {
//     return arguments.length ? ((digits = _), compute) : digits;
//   };

//   compute.scale = function(_) {
//     return arguments.length ? ((scale = _), compute) : scale;
//   };

//   compute.domain = function(data) {
//     if (DEBUG) console.log(`scaleText domain data.length=${data.length}`);
//     if (arguments.length) {
//       // Compute representatives for letters/substrings
//       computeRepresentatives(
//         data
//           // .filter(d => typeof(d) === typeof(""))
//           .map(d => (""+d).slice(0, digits))
//       );
//       if (DEBUG) console.log(`scaleText domain reps.length=${Array.from(dRepresentativesCounts.keys()).length}`);
//       scale.domain([0, Array.from(dRepresentativesCounts.keys()).length]);
//       return compute;
//     } else {
//       return scale.domain();
//     }
//   };

//   compute.computeRepresentatives = computeRepresentatives;
//   compute.__type = "text";

//   return compute;
// }

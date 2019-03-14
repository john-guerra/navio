import * as d3 from "d3";
import { _interpolateGreys } from "d3-scale-chromatic";

// A fake scale that uses only the first digits of a text to compute the color.
// Creates a list of all the possible first digits and uses a sequential scale to color based on such index
export function scaleText(digits = 1) {
  const DEBUG = false;

  const interpolateGreys =
    "interpolateGreys" in d3 ? d3.interpolateGreys : _interpolateGreys; // Hack to keep it working with d3.v4
  let scale = d3.scaleSequential(interpolateGreys).domain([32, 90]), // initialize with ascii
    dRepresentativesCounts = d3.map(), // Contains the counts for each letter/substrg
    dRepresentativesIndexes = d3.map();

  // Computes the actual value, based on the index of the first digits in the domain
  function compute(d) {
    let ci = dRepresentativesIndexes.get(
      d.slice(0, digits)
    );
    if (ci === undefined) {
      console.log(
        `scaleText Couldn't find index for ${d
          .slice(0, digits)
          } did you call domain? Using ascii of first letter`
      );
      ci = d
        .slice(0, digits)

        .charCodeAt(0);
    }
    return scale(ci) || "white";
  }

  function computeRepresentatives(data, doIndex = true) {
    dRepresentativesCounts = d3.map();
    for (let v of data) {
      //Initialize
      if (!dRepresentativesCounts.has(v)) dRepresentativesCounts.set(v, 0);

      //count+=1
      dRepresentativesCounts.set(v, dRepresentativesCounts.get(v) + 1);
    }
    if (DEBUG)
      console.log(
        `scaleText Compute representatives found ${dRepresentativesCounts.keys()} categories `
      );

    const ret = {
      counts: dRepresentativesCounts
    };

    if (doIndex) {
      // Compute the indexes of each representative
      dRepresentativesIndexes = d3.map();
      let i = 0;
      for (let r of dRepresentativesCounts.keys().sort()) {
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
    if (DEBUG) console.log(`scaleText domain data.lengt=${data.length}`);
    if (arguments.length) {
      // Compute representatives for letters/substrings
      computeRepresentatives(
        data
          .filter(d => d !== undefined && d !== null)
          .map(d => d.slice(0, digits))
      );
      scale.domain([0, dRepresentativesCounts.keys().length]);
      return compute;
    } else {
      return scale.domain();
    }
  };

  compute.computeRepresentatives = computeRepresentatives;
  compute.__type = "text";

  return compute;
}
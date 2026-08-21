import * as d3 from "d3";
import { scaleText, scaleOrdered } from "./scales.js";
import { getAttribsFromObjectAsFn } from "./utils.js";

/**
 * How a column becomes an attribute: declaring one with a scale, guessing the
 * type of every column in the data, and switching a column from one type to
 * another afterwards.
 *
 * Second slice extracted from src/navio.js for issue #67 - see
 * docs/ai/2026-08-20-navio-decomposition-design.md for the mechanism and, in
 * particular, section 11 for the measurement mistakes that are easy to repeat.
 *
 * This module registers thirteen public methods on `nv` and is otherwise
 * read-only: it never writes to any binding it is given, which is why `ctx`
 * here is all getters and no setters. It reads five bindings from navio.js's
 * closure - `data`, `attribsOrdered`, `dAttribs`, `colScales` and `nv` -
 * and every one of them is REASSIGNED elsewhere in navio.js, so all five must
 * cross as getters or the module would go on reading a replaced array.
 *
 * @param {object} ctx - { nv, get data(), get attribsOrdered(), get dAttribs(),
 *   get colScales(), attribAt, getAttrib, getAttribName, moveAttrToPos,
 *   findNotNull }
 */
export function createAttribs(ctx) {
  /**
   * Is this attribute actually present in the data?
   *
   * Checks a sample rather than every row: a column can legitimately be null
   * in the first few records without being absent. Returns true when there is
   * no data yet - the caller is allowed to declare attributes first.
   */
  function attribExistsInData(attr) {
    if (!ctx.data.length) return true;
    const name = ctx.getAttribName(attr);
    // Derived columns are not row properties. See #88.
    if (name === "__seqId" || name === "selected") return true;
    if (typeof attr === "function") return true; // an accessor computes its own
    const sample = Math.min(
      ctx.data.length,
      ctx.nv.howManyItemsShouldSearchForNotNull
    );
    for (let i = 0; i < sample; i++) {
      if (ctx.data[i] != null && name in ctx.data[i]) return true;
    }
    return false;
  }

  ctx.nv.addAttrib = function (attr, scale) {
    if (scale === undefined) {
      scale = d3.scaleOrdinal(d3.schemeCategory10);
    }
    if (ctx.dAttribs.has(ctx.getAttribName(attr))) {
      console.warn(`navio.addAttrib: attribute ${attr} already added`);
      return;
    }
    // A misspelled column used to be added silently and drawn as a stripe of
    // nulls, which looks like a data problem rather than a typo.
    if (!attribExistsInData(attr)) {
      const known = Object.keys(ctx.data[0] || {});
      console.warn(
        `navio.addAttrib: "${ctx.getAttribName(attr)}" is not in the data. ` +
          `The column will be empty. Available: ${known.join(", ")}`
      );
    }
    ctx.attribsOrdered.push(attr);
    ctx.dAttribs.set(ctx.getAttribName(attr), attr);
    ctx.colScales.set(attr, scale);
    return ctx.nv;
  };

  ctx.nv.addSequentialAttrib = function (attr, _scale) {
    const domain =
      ctx.data !== undefined && ctx.data.length > 0
        ? // By INDEX, not by row: "__seqId" is derived (#88), so reading it off
          // the row gives undefined for every row and collapses the domain to
          // [undefined, undefined] - a flat, unreadable column.
          d3.extent(ctx.data, function (_d, i) {
            return ctx.attribAt(i, attr);
          })
        : [0, 1]; //if we don"t have data, set the default domain
    const scale =
      _scale ||
      d3.scaleSequential(ctx.nv.defaultColorInterpolator).domain(domain);
    scale.__type = "seq";
    ctx.nv.addAttrib(attr, scale);
    return ctx.nv;
  };

  // Same as addSequentialAttrib but with a different color
  ctx.nv.addDateAttrib = function (attr, _scale) {
    const domain =
      ctx.data !== undefined && ctx.data.length > 0
        ? d3.extent(ctx.data, function (d) {
            return ctx.getAttrib(d, attr);
          })
        : [0, 1];

    const scale =
      _scale ||
      d3.scaleSequential(ctx.nv.defaultColorInterpolatorDate).domain(domain); //if we don"t have data, set the default domain
    ctx.nv.addAttrib(attr, scale);

    scale.__type = "date";
    return ctx.nv;
  };

  // Adds a diverging scale
  ctx.nv.addDivergingAttrib = function (attr, _scale) {
    const domain =
      ctx.data !== undefined && ctx.data.length > 0
        ? d3.extent(ctx.data, function (d) {
            return ctx.getAttrib(d, attr);
          })
        : [-1, 1];
    const scale =
      _scale ||
      d3
        .scaleSequential(ctx.nv.defaultColorInterpolatorDiverging)
        .domain([domain[0], domain[1]]); //if we don"t have data, set the default domain
    scale.__type = "div";
    ctx.nv.addAttrib(attr, scale);
    return ctx.nv;
  };

  /**
   * A palette is either an array or a function of the category count. The count
   * is not known when the column is added - scaleOrdinal builds its domain
   * lazily - so a function palette is resolved later, in updateColorDomains,
   * and remembered here until then.
   */
  function categoricalRange(n) {
    const p = ctx.nv.defaultColorCategorical;
    return typeof p === "function" ? p(n) : p;
  }

  ctx.nv.addCategoricalAttrib = function (attr, _scale) {
    // 10 is a starting range only; updateColorDomains sets the real one once it
    // knows how many categories there are.
    const scale = _scale || d3.scaleOrdinal(categoricalRange(10));
    // Who owns the colours. updateColorDomains re-resolves the palette for the
    // scales Navio made and leaves a caller's scale alone.
    scale.__navioOwned = !_scale;
    scale.__type = "cat";
    ctx.nv.addAttrib(attr, scale);

    return ctx.nv;
  };

  ctx.nv.addTextAttrib = function (attr, _scale) {
    const scale =
      _scale ||
      scaleText(
        ctx.nv.nullColor,
        ctx.nv.digitsForText,
        ctx.nv.defaultColorInterpolatorText
      );

    ctx.nv.addAttrib(attr, scale);

    return ctx.nv;
  };

  ctx.nv.addOrderedAttrib = function (attr, _scale) {
    const scale =
      _scale ||
      scaleOrdered(ctx.nv.nullColor, ctx.nv.defaultColorInterpolatorOrdered);

    ctx.nv.addAttrib(attr, scale);

    return ctx.nv;
  };

  ctx.nv.addBooleanAttrib = function (attr, _scale) {
    const scale =
      _scale ||
      d3
        .scaleOrdinal()
        .domain([true, false, null])
        .range(ctx.nv.defaultColorRangeBoolean);

    scale.__type = "bool";
    ctx.nv.addAttrib(attr, scale);

    return ctx.nv;
  };

  // Adds a more complex attribute with a wrapper to convert it into JSON
  ctx.nv.addObjectAttrib = function (attr, _scale) {
    const scale =
      _scale ||
      scaleText(
        ctx.nv.nullColor,
        ctx.nv.digitsForObjects, // nv.digitsForText,
        ctx.nv.defaultColorInterpolatorObject
      );

    let stringifiedAttr;
    if (typeof attr === "function") {
      stringifiedAttr = (d) => JSON.stringify(attr(d));
    } else {
      stringifiedAttr = (d) => {
        try {
          return d[attr] ? JSON.stringify(d[attr]) : d[attr];
        } catch (_e) {
          return undefined;
        }
      };
      // Navio derives a column's label from fn.name (see getAttribName), so
      // set it directly rather than baking the attribute name into evaluated
      // source the way convertAttribToFn still does - that pattern lets a
      // crafted key in user-supplied data execute arbitrary code (see #71).
      Object.defineProperty(stringifiedAttr, "name", { value: String(attr) });
    }
    ctx.nv.addAttrib(stringifiedAttr, scale);
    return ctx.nv;
  };

  // Adds all the attributes on the data, or all the attributes provided on the list based on their types
  ctx.nv.addAllAttribs = function (_attribs) {
    if (!ctx.data || !ctx.data.length)
      throw Error(
        "addAllAttribs called without data to guess the attribs. Make sure to call it after setting the data"
      );

    let attribs =
      _attribs !== undefined
        ? _attribs
        : getAttribsFromObjectAsFn(
            ctx.data[0],
            ctx.nv.addAllAttribsRecursionLevel
          );
    // Attributes we skip are reported once at the end rather than one console
    // line per column, so the message stays readable on wide datasets.
    const skippedArrays = [],
      skippedObjects = [];

    for (let attr of attribs) {
      if (attr === "__seqId" || attr === "__i" || attr === "selected") continue;

      const attrName = typeof attr === "function" ? attr.name : attr;
      const firstNotNull = ctx.findNotNull(ctx.data, attr);

      if (
        firstNotNull === null ||
        firstNotNull === undefined ||
        typeof firstNotNull === typeof ""
      ) {
        const numDistinctValues = new Set(
          ctx.data
            .slice(0, ctx.nv.howManyItemsShouldSearchForNotNull)
            .map((d) => ctx.getAttrib(d, attr))
        ).size;

        // How many different elements are there
        if (numDistinctValues < ctx.nv.maxNumDistinctForCategorical) {
          ctx.nv.DEBUG &&
            console.log(
              `Navio: Adding attr ${attrName} as categorical with ${numDistinctValues} categories`
            );
          ctx.nv.addCategoricalAttrib(attr);
        } else if (numDistinctValues < ctx.nv.maxNumDistinctForOrdered) {
          ctx.nv.addOrderedAttrib(attr);
          ctx.nv.DEBUG &&
            console.log(
              `Navio: Attr ${attrName} has more than ${ctx.nv.maxNumDistinctForCategorical} distinct values (${numDistinctValues}) using orderedAttrib`
            );
        } else {
          ctx.nv.DEBUG &&
            console.log(
              `Navio: Attr ${attrName} has more than ${ctx.nv.maxNumDistinctForOrdered} distinct values (${numDistinctValues}) using textAttrib`
            );
          ctx.nv.addTextAttrib(attr);
        }
      } else if (typeof firstNotNull === typeof 0) {
        // Numbers.
        //
        // Diverging only when the values actually STRADDLE the diverging point.
        // updateColorDomains builds a diverging domain as [-absMax, absMax]
        // around zero - "Assumes diverging point on 0" - so a column that never
        // crosses zero gets a domain about twice its own magnitude with every
        // value crammed into one end of the ramp. A negative minimum alone used
        // to be enough, which is how citibike's start_lng (-74.02564 ..
        // -73.886312) drew as one flat brown: its 0.139 of range sat inside a
        // 148.05-wide domain, 0.094% of the scale.
        const [numMin, numMax] = d3.extent(ctx.data, (d) =>
          ctx.getAttrib(d, attr)
        );
        if (numMin < 0 && numMax > 0) {
          ctx.nv.DEBUG &&
            console.log(`Navio: Adding attr ${attrName} as diverging`);
          ctx.nv.addDivergingAttrib(attr);
        } else {
          ctx.nv.DEBUG &&
            console.log(`Navio: Adding attr ${attrName} as sequential`);
          ctx.nv.addSequentialAttrib(attr);
        }
      } else if (firstNotNull instanceof Date) {
        ctx.nv.DEBUG && console.log(`Navio: Adding attr ${attrName} as date`);
        ctx.nv.addDateAttrib(attr);
      } else if (typeof firstNotNull === typeof true) {
        ctx.nv.DEBUG &&
          console.log(`Navio: Adding attr ${attrName} as boolean`);
        ctx.nv.addBooleanAttrib(attr);
      } else {
        // Default categories

        if (Array.isArray(firstNotNull)) {
          if (ctx.nv.addAllAttribsIncludeArrays) {
            ctx.nv.DEBUG &&
              console.log(
                `Navio: Adding ${attrName} adding as Object (type=array)`
              );
            // nv.addCategoricalAttrib(attr);
            ctx.nv.addObjectAttrib(attr);
          } else {
            skippedArrays.push(attrName);
          }
        } else {
          if (ctx.nv.addAllAttribsIncludeObjects) {
            ctx.nv.DEBUG &&
              console.log(
                `Navio: Adding object ${attrName} adding as Object (type=object)`
              );
            // nv.addCategoricalAttrib(attr);
            ctx.nv.addObjectAttrib(attr);
          } else {
            skippedObjects.push(attrName);
          }
        }
      }
    }

    // Skipping data silently would hide columns the caller expects to see, so
    // this warns unconditionally - but only once, and it says how to opt in.
    if (skippedArrays.length)
      console.warn(
        `navio.addAllAttribs: ignored ${skippedArrays.length} array attribute(s) [${skippedArrays.join(", ")}]. Set nv.addAllAttribsIncludeArrays = true to include them.`
      );
    if (skippedObjects.length)
      console.warn(
        `navio.addAllAttribs: ignored ${skippedObjects.length} object attribute(s) [${skippedObjects.join(", ")}]. Set nv.addAllAttribsIncludeObjects = true to include them.`
      );

    ctx.nv.data(ctx.data);
    // drawBrushes(true); // updates brushes width
    return ctx.nv;
  };

  // The attribute types a column can be switched between, and the method that
  // builds each one's scale. "object" is excluded on purpose: addObjectAttrib
  // replaces the attribute with a stringifying accessor rather than just
  // changing its scale, so it is not a like-for-like swap.
  const ATTRIB_TYPES = {
    cat: { label: "categorical", add: "addCategoricalAttrib" },
    seq: { label: "sequential", add: "addSequentialAttrib" },
    ordered: { label: "ordered", add: "addOrderedAttrib" },
    text: { label: "text", add: "addTextAttrib" },
    date: { label: "date", add: "addDateAttrib" },
    div: { label: "diverging", add: "addDivergingAttrib" },
    bool: { label: "boolean", add: "addBooleanAttrib" },
  };

  /** The type tag of an attribute's colour scale: "cat", "seq", "text"... */
  ctx.nv.getAttribType = function (attrib) {
    const scale =
      ctx.colScales.get(attrib) || ctx.colScales.get(ctx.getAttribName(attrib));
    return scale && scale.__type;
  };

  /** The switchable types, as {value, label} - for building a picker. */
  ctx.nv.getAttribTypes = function () {
    return Object.entries(ATTRIB_TYPES).map(([value, t]) => ({
      value,
      label: t.label,
    }));
  };

  /**
   * Re-type a column: how it is coloured and how its values are interpreted.
   *
   * Only the colour scale changes. The attribute keeps its name, its position,
   * and anything pointing at it - sorting compares raw values and so does a
   * value filter, while a range filter compares positions, so none of them are
   * invalidated by a re-type. addAllAttribs guesses types from the data and
   * sometimes guesses wrong; this is the correction.
   */
  ctx.nv.setAttribType = function (attrib, type) {
    const spec = ATTRIB_TYPES[type];
    if (!spec) {
      console.warn(
        `navio.setAttribType: unknown type "${type}". ` +
          `One of: ${Object.keys(ATTRIB_TYPES).join(", ")}`
      );
      return ctx.nv;
    }
    const name = ctx.getAttribName(attrib);
    const pos = ctx.attribsOrdered.findIndex(
      (a) => ctx.getAttribName(a) === name
    );
    if (pos === -1) {
      console.warn(
        `navio.setAttribType: "${name}" is not one of the attributes`
      );
      return ctx.nv;
    }
    const attr = ctx.attribsOrdered[pos];
    if (ctx.nv.getAttribType(attr) === type) return ctx.nv;

    // Drop it from all three structures and let the real add*Attrib rebuild
    // it, so the scale is constructed exactly as it would have been at setup -
    // domain included. Then put it back where it was: addAttrib appends.
    ctx.attribsOrdered.splice(pos, 1);
    ctx.dAttribs.delete(name);
    ctx.colScales.delete(attr);
    ctx.colScales.delete(name);

    ctx.nv[spec.add](attr);
    ctx.moveAttrToPos(attr, pos);

    ctx.nv.hardUpdate();
    return ctx.nv;
  };

  return { categoricalRange };
}

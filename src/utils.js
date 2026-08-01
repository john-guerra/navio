// Returns a flat array with all the attributes in an object up to recursionLevel.
// Returns attributes as lists to avoid confusion with names containing dots
export const getAttribsFromObjectRecursive = function (
  obj,
  recursionLevel = Infinity
) {
  function helper(obj, recursionCount) {
    var attr,
      res = [];
    for (attr in obj) {
      if (
        Object.prototype.hasOwnProperty.call(obj, attr) &&
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
            helper(obj[attr], recursionCount + 1).map((a) => [attr].concat(a))
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

export function convertAttribToFn(attr) {
  if (typeof attr === "string") {
    attr = attr.split(".");
  }

  const path = attr;
  const fnName = path.join("_");

  // Walk the path with a plain closure.
  //
  // This used to build the accessor by interpolating `attr` into new Function().
  // Attribute names come from the keys of whatever data the caller loads, so a
  // crafted key could break out of the generated source and execute arbitrary
  // code in the page - see #71. A closure removes that surface entirely rather
  // than trying to escape it.
  const accessor = (d) => {
    let current = d;
    for (const key of path) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    return current;
  };

  // Navio labels a column from fn.name (see getAttribName in navio.js), so set
  // it directly instead of baking the name into evaluated source.
  Object.defineProperty(accessor, "name", {
    value: fnName,
    configurable: true,
  });

  return accessor;
}

// Returns an array of strings or functions to access all the attributes in an object
export function getAttribsFromObjectAsFn(obj, recursionLevel = Infinity) {
  const attribs = getAttribsFromObjectRecursive(obj, recursionLevel);
  return attribs.map((attr) =>
    attr.length > 1 ? convertAttribToFn(attr) : attr[0]
  );
}

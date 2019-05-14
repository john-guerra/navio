const DEBUG = true;


// Returns a flat array with all the attributes in an object up to recursionLevel
export const getAttribsFromObjectRecursive = function(obj, recursionLevel=Infinity) {
  function helper(obj, recursionCount) {
    var attr, res = [];
    for (attr in obj) {
      if (obj.hasOwnProperty(attr) && attr!=="__i" && attr!=="__seqId" && attr!=="selected") {

        // Recursive call on objects
        if (recursionCount< recursionLevel &&
            !Array.isArray(obj[attr]) &&
            typeof(obj[attr]) === typeof({})) {

          res = res.concat(getAttribsFromObjectRecursive(obj[attr], recursionCount+1).map(a=> `${attr}.${a}`));
        } else {
          res.push(attr);
        }
      }
    }

    return res;
  }

  return helper(obj, 0);
};


// Returns an array of strings or functions to access all the attributes in an object
export function getAttribsFromObjectAsFn(obj, recursionLevel=Infinity) {
  const attribs = getAttribsFromObjectRecursive(obj, recursionLevel);
  return attribs
    .map(attr =>{
      const fnName = attr
        .replace(/\./g, "_") // change dots to underscore
        .replace(/[^a-zA-Z _]/g, ""); // remove special characters
      const body = `return function ${fnName}(d) { return d["${attr}"]; };`;

      if (DEBUG) { console.log("body",body); }
      return new Function(body)();
    });
}

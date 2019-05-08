export function FilterByRange(opts) {
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

export function FilterByValue(opts) {
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

export function FilterByValueDifferent(opts) {
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

export function FilterByRangeNegative(opts) {
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
    type:"negativeRange"
  };
}
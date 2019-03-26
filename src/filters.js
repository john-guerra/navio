export class FilterByRange {
  constructor(opts ) {
    this.first = opts.first;
    this.last = opts.last;
    this.level = opts.level;
    this.itemAttr = opts.itemAttr;
  }

  filter(d) {
    return d.__i[this.level] >= this.first.__i[this.level] && d.__i[this.level] <= this.last.__i[this.level];
  }

  toStr() {
    let firstVal = `${this.first[this.itemAttr]}`,
      lastVal = `${this.last[this.itemAttr]}`;
    firstVal = typeof(this.first[this.itemAttr]) === typeof("") ? firstVal.slice(0,5) : firstVal;
    lastVal = typeof(this.first[this.itemAttr]) === typeof("") ? lastVal.slice(0,5) : lastVal;
    return `${this.itemAttr} range including ${firstVal} to ${lastVal}`;
  }
}

export class FilterByValue {
  constructor(opts ) {
    this.itemAttr = opts.itemAttr;
    this.sel = opts.sel;
  }

  filter(d) {
    return d[this.itemAttr] === this.sel[this.itemAttr];
  }

  toStr() {
    return `${this.itemAttr} == ${this.sel[this.itemAttr]}`;
  }
}
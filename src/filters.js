export class FilterByRange {
  constructor(opts ) {
    this.first = opts.first;
    this.last = opts.last;
    this.level = opts.level;
  }

  filter(d) {
    return d.__i[this.level] >= this.first.__i[this.level] && d.__i[this.level] <= this.last.__i[this.level];
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
}
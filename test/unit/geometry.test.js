import { describe, it, expect } from "vitest";
import { createGeometry } from "../../src/geometry.js";

// A minimal fake scale: enough for cellA/cellR/bandwidthA/stepA/levelStartA/
// levelExtentA/attribAtA/rowAtR/levelAtA to exercise real math, not stubs.
function fakeXScale(domain, range) {
  const step = (range[1] - range[0]) / domain.length;
  const fn = (name) => range[0] + domain.indexOf(name) * step;
  fn.bandwidth = () => step * 0.9;
  fn.step = () => step;
  fn.range = () => range;
  fn.domain = () => domain;
  return fn;
}
function fakeLevelScale(domain, range) {
  const step = domain.length ? (range[1] - range[0]) / domain.length : 0;
  const fn = (level) => range[0] + level * step;
  fn.range = () => range;
  fn.domain = () => domain;
  return fn;
}
function fakeYScales(domain, range) {
  const step = domain.length ? (range[1] - range[0]) / domain.length : 0;
  const fn = (id) => range[0] + domain.indexOf(id) * step;
  fn.bandwidth = () => step * 0.9;
  fn.range = () => range;
  fn.domain = () => domain;
  return fn;
}

function buildCtx(overrides = {}) {
  const xScale = fakeXScale(["a", "b", "c"], [0, 300]);
  const levelScale = fakeLevelScale([0, 1], [0, 640]);
  const yScales = [fakeYScales(["r1", "r2", "r3", "r4"], [100, 500])];
  return {
    nv: {
      orientation: "horizontal",
      y0: 100,
      margin: 10,
      x0: 5,
      ...overrides.nv,
    },
    xScale,
    levelScale,
    get yScales() {
      return overrides.yScales || yScales;
    },
    get height() {
      return overrides.height !== undefined ? overrides.height : 400;
    },
    get pixelRatio() {
      return overrides.pixelRatio !== undefined ? overrides.pixelRatio : 1;
    },
  };
}

describe("orientation transposition", () => {
  it("horizontal: attribute is x, record is y", () => {
    const geom = createGeometry(buildCtx());
    expect(geom.toXY(10, 20)).toEqual({ x: 10, y: 20 });
    expect(geom.toWH(10, 20)).toEqual({ width: 10, height: 20 });
  });

  it("vertical: attribute is y, record is x", () => {
    const geom = createGeometry(buildCtx({ nv: { orientation: "vertical" } }));
    expect(geom.toXY(10, 20)).toEqual({ x: 20, y: 10 });
    expect(geom.toWH(10, 20)).toEqual({ width: 20, height: 10 });
  });
});

describe("forward and inverse round-trip", () => {
  it("attribAtA inverts cellA back to the attribute name", () => {
    const geom = createGeometry(buildCtx());
    const pos = geom.cellA("b", 1);
    expect(geom.attribAtA(pos, 1)).toBe("b");
  });

  it("rowAtR inverts cellR back to the row id", () => {
    const geom = createGeometry(buildCtx());
    const pos = geom.cellR("r3", 0);
    expect(geom.rowAtR(pos, 0)).toBe("r3");
  });

  it("levelAtA inverts levelStartA back to the level index", () => {
    const geom = createGeometry(buildCtx());
    const pos = geom.levelStartA(1);
    expect(geom.levelAtA(pos)).toBe(1);
  });
});

describe("live reads", () => {
  it("recordExtent reads the CURRENT height, not one captured at construction", () => {
    let h = 400;
    const ctx = buildCtx();
    Object.defineProperty(ctx, "height", { get: () => h });
    const geom = createGeometry(ctx);
    expect(geom.recordExtent()).toBe(400);
    h = 900;
    expect(geom.recordExtent()).toBe(900);
  });

  it("cellR reads the CURRENT yScales array, not one captured at construction", () => {
    let scales = [fakeYScales(["r1"], [0, 100])];
    const ctx = buildCtx();
    Object.defineProperty(ctx, "yScales", { get: () => scales });
    const geom = createGeometry(ctx);
    const before = geom.cellR("r1", 0);
    scales = [fakeYScales(["r1"], [500, 1000])];
    const after = geom.cellR("r1", 0);
    expect(after).not.toBe(before);
  });
});

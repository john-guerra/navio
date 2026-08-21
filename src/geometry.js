import * as d3 from "d3";

/**
 * navio's coordinate system: the one place that knows how an (attribute,
 * record) pair becomes a position on screen, and the reverse.
 *
 * Built ONCE, in init(), after xScale/levelScale/x are assigned
 * (src/navio.js:925-935) - x itself is superseded by cellA and is deleted
 * once every caller is converted (see the plan's Task 7).
 *
 * `yScales`, `height` and `pixelRatio` are reassigned during the widget's
 * life - yScales per update, all three at destroy or settings-restore - so
 * every method that touches them reads through ctx's GETTERS at call time.
 * A method that captured one of these as a plain value would go stale, and
 * for `yScales` specifically it would keep the pre-destroy scale array
 * reachable through `geom` forever - a memory leak in otherwise-correct code.
 * `xScale` and `levelScale` are the opposite case: assigned exactly once and
 * never reassigned, so capturing them as plain values is safe PROVIDED this
 * factory is constructed after that assignment - never earlier.
 *
 * See docs/ai/2026-08-21-navio-geometry-injection-design.md and
 * docs/superpowers/plans/2026-08-21-navio-geometry-injection.md.
 *
 * @param {object} ctx - { nv, xScale, levelScale, get yScales(), get height(),
 *   get pixelRatio() }
 */
export function createGeometry(ctx) {
  // Owned privately by this module. Previously the shared `invertScaleCache`
  // binding in navio.js; nothing outside attribAtA/rowAtR/levelAtA needs it.
  let invertScaleCache = new WeakMap();

  function invalidateInvertCache() {
    invertScaleCache = new WeakMap();
  }

  // yScales[level] is replaced wholesale on every update, so keying the cache
  // on the scale object already invalidates those entries for free. xScale
  // and levelScale are mutated in place, though, so a stale inversion has to
  // be dropped explicitly by the caller of invalidateInvertCache.
  function invert(scale, pos) {
    let qScale = invertScaleCache.get(scale);
    if (!qScale) {
      qScale = d3.scaleQuantize().domain(scale.range()).range(scale.domain());
      invertScaleCache.set(scale, qScale);
    }
    return qScale(pos);
  }

  function isVertical() {
    return ctx.nv.orientation === "vertical";
  }

  function toXY(a, r) {
    return isVertical() ? { x: r, y: a } : { x: a, y: r };
  }

  function toWH(a, r) {
    return isVertical() ? { width: r, height: a } : { width: a, height: r };
  }

  function cellA(attribName, level) {
    return ctx.levelScale(level) + ctx.xScale(attribName);
  }

  function cellR(rowId, level) {
    return ctx.yScales[level](rowId);
  }

  function bandwidthA() {
    return ctx.xScale.bandwidth();
  }

  function bandwidthR(level) {
    return ctx.yScales[level].bandwidth();
  }

  function stepA() {
    return ctx.xScale.step();
  }

  function levelStartA(level) {
    return ctx.levelScale(level);
  }

  function levelExtentA() {
    return ctx.xScale.range()[1];
  }

  function recordAxisStart() {
    return ctx.nv.y0;
  }

  function extentA() {
    return ctx.levelScale.range()[1] + ctx.nv.margin + ctx.nv.x0;
  }

  function recordExtent() {
    return ctx.height;
  }

  function pixelRatio() {
    return ctx.pixelRatio;
  }

  function snapToDevice(coord, deviceWidth) {
    const dev = Math.round(coord * pixelRatio()) + (deviceWidth % 2 ? 0.5 : 0);
    return dev / pixelRatio();
  }

  function attribAtA(pos, level) {
    return invert(ctx.xScale, pos - ctx.levelScale(level));
  }

  function rowAtR(pos, level) {
    return invert(ctx.yScales[level], pos);
  }

  function levelAtA(pos) {
    return invert(ctx.levelScale, pos);
  }

  return {
    isVertical,
    toXY,
    toWH,
    cellA,
    cellR,
    bandwidthA,
    bandwidthR,
    stepA,
    levelStartA,
    levelExtentA,
    recordAxisStart,
    extentA,
    recordExtent,
    pixelRatio,
    snapToDevice,
    attribAtA,
    rowAtR,
    levelAtA,
    invalidateInvertCache,
  };
}
